from __future__ import annotations

from datetime import datetime
from pathlib import Path
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.video_storage import VideoAnalysisStorage
from api import main


def _prepare_storage(tmp_path: Path, monkeypatch) -> VideoAnalysisStorage:
    storage_dir = tmp_path / "video_analyses"
    storage = VideoAnalysisStorage(storage_dir=str(storage_dir))
    monkeypatch.setattr(main, "storage", storage, raising=False)
    return storage


def _register_analysis(storage: VideoAnalysisStorage, video_path: Path) -> str:
    analysis_id = f"analysis_{uuid.uuid4().hex[:8]}"
    storage.db["analyses"][analysis_id] = {
        "id": analysis_id,
        "video_name": video_path.name,
        "video_path": str(video_path),
        "created_at": datetime.utcnow().isoformat(),
        "transcript": "Sample script",
    }
    storage._save_database()
    return analysis_id


@pytest.mark.parametrize("suffix", [".mp4", ".mov", ".webm"])
def test_clearcast_check_accepts_multiple_formats(tmp_path, monkeypatch, suffix):
    storage = _prepare_storage(tmp_path, monkeypatch)
    video_path = tmp_path / f"creative{suffix}"
    video_path.write_bytes(b"video")
    analysis_id = _register_analysis(storage, video_path)

    class StubClearcastChecker:
        def __init__(self):
            self.last_call = None

        def check_video_compliance(self, *, video_path, script_excerpt=None, delivery_metadata=None):
            self.last_call = {
                "video_path": video_path,
                "script_excerpt": script_excerpt,
                "delivery_metadata": delivery_metadata,
            }
            return {"status": "ok", "video_suffix": Path(video_path).suffix}

    checker = StubClearcastChecker()
    monkeypatch.setattr(main, "clearcast_checker", checker, raising=False)

    client = TestClient(main.app)
    response = client.post("/clearcast/check", json={"analysis_id": analysis_id})

    assert response.status_code == 200
    assert response.json()["video_suffix"] == suffix
    assert checker.last_call is not None
    assert Path(checker.last_call["video_path"]).suffix == suffix


@pytest.mark.parametrize("suffix", [".mp4", ".mov", ".webm"])
def test_ai_breakdown_accepts_multiple_formats(tmp_path, monkeypatch, suffix):
    storage = _prepare_storage(tmp_path, monkeypatch)
    video_path = tmp_path / f"ad{suffix}"
    video_path.write_bytes(b"video")
    analysis_id = _register_analysis(storage, video_path)

    class StubBreakdown:
        def __init__(self):
            self.calls: list[dict] = []

        def analyze_video(self, *, video_path, detail_level, script_text=None, audience_country=None):
            payload = {
                "video_suffix": Path(video_path).suffix,
                "detail_level": detail_level,
                "audience_country": audience_country,
            }
            self.calls.append(payload)
            return payload

    breakdown = StubBreakdown()
    monkeypatch.setattr(main, "ai_breakdown", breakdown, raising=False)

    client = TestClient(main.app)
    response = client.post(
        "/analyze/breakdown",
        json={"analysis_id": analysis_id, "detail_level": "full", "audience_country": "UK"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["video_suffix"] == suffix
    assert breakdown.calls and breakdown.calls[0]["video_suffix"] == suffix









