from __future__ import annotations

from datetime import datetime
from pathlib import Path
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.video_storage import VideoAnalysisStorage


def _register_analysis(
    storage: VideoAnalysisStorage,
    video_path: Path,
    *,
    processed_path: Path | None = None,
) -> str:
    analysis_id = f"analysis_{uuid.uuid4().hex[:8]}"
    suffix = video_path.suffix.lower()
    playback_ready = suffix == ".mp4"
    playback_path = str(video_path) if playback_ready else None
    storage.db["analyses"][analysis_id] = {
        "id": analysis_id,
        "video_name": video_path.name,
        "video_path": str(video_path),
        "created_at": datetime.utcnow().isoformat(),
        "playback_ready": playback_ready,
        "playback_video_path": playback_path,
        "playback_job_id": None,
    }
    if processed_path is not None:
        storage.db["analyses"][analysis_id]["video_processing"] = {"output_path": str(processed_path)}
    storage._save_database()
    return analysis_id


def _build_storage(tmp_path: Path, monkeypatch) -> VideoAnalysisStorage:
    from api import main

    storage_dir = tmp_path / "video_analyses"
    test_storage = VideoAnalysisStorage(storage_dir=str(storage_dir))
    monkeypatch.setattr(main, "storage", test_storage, raising=False)
    return test_storage


@pytest.mark.parametrize(
    ("suffix", "expected_type"),
    [
        (".mp4", "video/mp4"),
        (".mov", "video/quicktime"),
        (".webm", "video/webm"),
    ],
)
def test_stream_video_sets_content_type_by_extension(tmp_path, monkeypatch, suffix, expected_type):
    from api import main

    storage = _build_storage(tmp_path, monkeypatch)
    video_path = tmp_path / f"source{suffix}"
    video_path.write_bytes(b"fake-video-data")
    analysis_id = _register_analysis(storage, video_path)

    client = TestClient(main.app)
    response = client.get(f"/videos/{analysis_id}")

    expected_status = 200 if suffix == ".mp4" else 202
    assert response.status_code == expected_status
    if expected_status == 200:
        assert response.headers["content-type"] == expected_type
        assert response.content == b"fake-video-data"


@pytest.mark.parametrize(
    ("suffix", "expected_type"),
    [
        (".mp4", "video/mp4"),
        (".mov", "video/quicktime"),
        (".webm", "video/webm"),
    ],
)
def test_stream_polished_video_uses_output_extension(tmp_path, monkeypatch, suffix, expected_type):
    from api import main

    storage = _build_storage(tmp_path, monkeypatch)
    placeholder_source = tmp_path / ("source" + suffix)
    placeholder_source.write_bytes(b"original")
    polished_path = tmp_path / ("polished" + suffix)
    polished_path.write_bytes(b"processed")
    analysis_id = _register_analysis(storage, placeholder_source, processed_path=polished_path)

    client = TestClient(main.app)
    response = client.get(f"/videos/polished/{analysis_id}")

    assert response.status_code == 200
    assert response.headers["content-type"] == expected_type
    assert response.content == b"processed"


def test_analyze_rejects_unsupported_extension(tmp_path, monkeypatch):
    from api import main

    _build_storage(tmp_path, monkeypatch)
    client = TestClient(main.app)

    files = {"file": ("clip.wmv", b"fake-data", "video/x-ms-wmv")}

    response = client.post("/analyze", files=files)

    assert response.status_code == 400
    detail = response.json().get("detail", "")
    assert "unsupported" in detail.lower() or "not allowed" in detail.lower()


def test_stream_video_prefers_playback_copy(tmp_path, monkeypatch):
    from api import main

    storage = _build_storage(tmp_path, monkeypatch)
    original = tmp_path / "original.mov"
    original.write_bytes(b"original")
    playback = tmp_path / "original_playback.mp4"
    playback.write_bytes(b"playback")
    analysis_id = _register_analysis(storage, original)
    storage.db["analyses"][analysis_id]["playback_video_path"] = str(playback)
    storage.db["analyses"][analysis_id]["playback_ready"] = True
    storage._save_database()

    client = TestClient(main.app)
    response = client.get(f"/videos/{analysis_id}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    assert response.content == b"playback"


def test_generate_playback_copy_updates_analysis(tmp_path, monkeypatch):
    from app.core.video_storage import VideoAnalysisStorage

    storage_dir = tmp_path / "video_analyses"
    storage = VideoAnalysisStorage(storage_dir=str(storage_dir))
    source = tmp_path / "upload.mov"
    source.write_bytes(b"source")
    playback_target = tmp_path / "converted.mp4"

    def fake_convert(self, video_dest: Path) -> str | None:
        assert video_dest.suffix == ".mov"
        playback_target.write_bytes(b"converted")
        return str(playback_target)

    monkeypatch.setattr(VideoAnalysisStorage, "_ensure_playback_copy", fake_convert, raising=False)

    analysis_id = storage.create_analysis(str(source))
    storage.generate_playback_copy(analysis_id)
    analysis = storage.get_analysis(analysis_id)

    assert analysis is not None
    assert analysis.get("playback_ready") is True
    assert analysis.get("playback_video_path") == str(playback_target)


def test_create_analysis_flags_ready_for_mp4(tmp_path):
    from app.core.video_storage import VideoAnalysisStorage

    storage = VideoAnalysisStorage(storage_dir=str(tmp_path / "video_analyses"))
    source = tmp_path / "clip.mp4"
    source.write_bytes(b"mp4data")

    analysis_id = storage.create_analysis(str(source))
    analysis = storage.get_analysis(analysis_id)

    assert analysis["playback_ready"] is True
    assert Path(analysis["playback_video_path"]).suffix == ".mp4"


def test_create_analysis_flags_pending_for_mov(tmp_path):
    from app.core.video_storage import VideoAnalysisStorage

    storage = VideoAnalysisStorage(storage_dir=str(tmp_path / "video_analyses"))
    source = tmp_path / "clip.mov"
    source.write_bytes(b"movdata")

    analysis_id = storage.create_analysis(str(source))
    analysis = storage.get_analysis(analysis_id)

    assert analysis["playback_ready"] is False
    assert analysis.get("playback_video_path") is None


def test_stream_video_returns_202_while_playback_pending(tmp_path, monkeypatch):
    from api import main

    storage = _build_storage(tmp_path, monkeypatch)
    video_path = tmp_path / "source.mov"
    video_path.write_bytes(b"original")
    analysis_id = _register_analysis(storage, video_path)
    storage.db["analyses"][analysis_id]["playback_ready"] = False
    storage.db["analyses"][analysis_id]["playback_video_path"] = None

    invoked = {}

    def fake_schedule(aid: str):
        invoked["analysis_id"] = aid
        return "job-123"

    monkeypatch.setattr(main, "_schedule_transcode_job", fake_schedule, raising=False)

    client = TestClient(main.app)
    response = client.get(f"/videos/{analysis_id}")

    assert response.status_code == 202
    assert invoked["analysis_id"] == analysis_id


def test_head_video_returns_200_for_ready(tmp_path, monkeypatch):
    from api import main

    storage = _build_storage(tmp_path, monkeypatch)
    video_path = tmp_path / "clip.mp4"
    video_path.write_bytes(b"mp4data")
    analysis_id = _register_analysis(storage, video_path)
    storage.db["analyses"][analysis_id]["playback_ready"] = True
    storage.db["analyses"][analysis_id]["playback_video_path"] = str(video_path)

    client = TestClient(main.app)
    response = client.head(f"/videos/{analysis_id}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"


def test_head_video_returns_202_when_pending(tmp_path, monkeypatch):
    from api import main

    storage = _build_storage(tmp_path, monkeypatch)
    video_path = tmp_path / "clip.mov"
    video_path.write_bytes(b"movdata")
    analysis_id = _register_analysis(storage, video_path)
    storage.db["analyses"][analysis_id]["playback_ready"] = False
    storage.db["analyses"][analysis_id]["playback_video_path"] = None

    client = TestClient(main.app)
    response = client.head(f"/videos/{analysis_id}")

    assert response.status_code == 202


def test_storage_reloads_on_external_update(tmp_path):
    """Test that storage reloads database when file is modified externally."""
    storage_dir = tmp_path / "video_analyses"
    storage = VideoAnalysisStorage(storage_dir=str(storage_dir))
    
    # Create an analysis
    video_path = tmp_path / "test.mov"  # Use .mov so playback_ready starts as False
    video_path.write_bytes(b"test")
    analysis_id = storage.create_analysis(str(video_path))
    
    # Verify initial state
    initial = storage.get_analysis(analysis_id, check_stale=False)
    assert initial is not None
    assert initial.get("playback_ready") is False
    
    # Manually modify the database file externally (simulating backfill script)
    import json
    import time
    time.sleep(0.1)  # Ensure mtime difference from create_analysis
    
    db_data = json.loads(storage.db_file.read_text())
    db_data["analyses"][analysis_id]["playback_ready"] = True
    db_data["analyses"][analysis_id]["playback_video_path"] = "updated_path.mp4"
    storage.db_file.write_text(json.dumps(db_data, indent=2))
    
    # Force mtime update by touching the file
    storage.db_file.touch()
    time.sleep(0.1)  # Ensure mtime difference
    
    # Get analysis with stale check - should reload and see updated data
    updated = storage.get_analysis(analysis_id, check_stale=True)
    assert updated is not None
    assert updated["playback_ready"] is True
    assert updated["playback_video_path"] == "updated_path.mp4"
    
    # Verify reload_database() also works
    db_data["analyses"][analysis_id]["playback_ready"] = False
    storage.db_file.write_text(json.dumps(db_data, indent=2))
    storage.db_file.touch()
    time.sleep(0.1)
    
    storage.reload_database()
    reloaded = storage.get_analysis(analysis_id, check_stale=False)
    assert reloaded["playback_ready"] is False

