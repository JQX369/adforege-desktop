import io
import time
from pathlib import Path

import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient

from app.core.video_storage import VideoAnalysisStorage


def _write_dummy_video(path: Path, frames: int = 12, bright_every: int = 2):
    """Create a small mp4 video alternating between bright and dark frames."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, 8.0, (64, 64))
    for i in range(frames):
        if i % bright_every == 0:
            frame = np.full((64, 64, 3), 240, dtype=np.uint8)
        else:
            frame = np.full((64, 64, 3), 30, dtype=np.uint8)
        writer.write(frame)
    writer.release()
    return path


def _wait_for_queue_job(client: TestClient, job_id: str, *, timeout: float = 5.0):
    """Poll queue job status until it completes or fails."""
    deadline = time.time() + timeout
    last_payload = None
    while time.time() < deadline:
        resp = client.get(f"/queue/jobs/{job_id}")
        if resp.status_code == 404:
            break
        payload = resp.json()
        last_payload = payload
        if payload["status"] in {"completed", "failed"}:
            return payload
        time.sleep(0.05)
    raise AssertionError(f"Queue job {job_id} did not settle. Last payload: {last_payload}")


def _wait_for_reaction_job(client: TestClient, reaction_id: str, *, timeout: float = 5.0):
    """Poll reaction job detail until it is no longer queued/processing."""
    deadline = time.time() + timeout
    last_detail = None
    while time.time() < deadline:
        resp = client.get(f"/reactions/{reaction_id}")
        detail = resp.json()
        last_detail = detail
        if detail["job"]["status"] in {"completed", "failed"}:
            return detail
        time.sleep(0.05)
    raise AssertionError(f"Reaction job {reaction_id} did not settle. Last detail: {last_detail}")


def test_reaction_video_analyzer_generates_summary(tmp_path):
    """Reaction analyzer should return timeline + summary for recorded video."""
    from app.features.analytics.reaction_video_analyzer import ReactionVideoAnalyzer

    reaction_video = _write_dummy_video(tmp_path / "reaction_source.mp4")
    analyzer = ReactionVideoAnalyzer()
    result = analyzer.analyze(str(reaction_video))

    assert "emotion_summary" in result
    assert "emotion_timeline" in result
    assert result["emotion_timeline"], "timeline should contain entries"
    assert isinstance(result["engagement_score"], float)
    dominant = max(result["emotion_summary"], key=result["emotion_summary"].get)
    assert dominant in {"excited", "neutral", "calm"}


def test_upload_reaction_endpoint_accepts_file(monkeypatch, tmp_path):
    """Uploading a reaction schedules processing, records jobs, and exposes APIs."""
    from api import main

    storage_dir = tmp_path / "video_analyses"
    test_storage = VideoAnalysisStorage(storage_dir=str(storage_dir))

    source_video = _write_dummy_video(tmp_path / "analysis_source.mp4")
    analysis_id = test_storage.create_analysis(str(source_video))

    # Patch the global storage, job queue, and processor used by the API module
    monkeypatch.setattr(main, "storage", test_storage, raising=False)
    main.job_queue.storage = test_storage
    if hasattr(main.job_queue, "_scheduled_jobs"):
        main.job_queue._scheduled_jobs.clear()

    def fake_analyze(_video_path: str):
        return {
            "emotion_timeline": [
                {"timestamp": 0.0, "emotion": "delight", "engagement": 0.95, "scores": {"delight": 1.0}}
            ],
            "emotion_summary": {"delight": 100.0},
            "key_moments": [
                {"timestamp": 0.0, "emotion": "delight", "reason": "Upload test", "engagement": 0.95}
            ],
            "engagement_score": 0.95,
            "reaction_snapshots": [],
        }

    fake_processor = type("StubProcessor", (), {"analyze": staticmethod(fake_analyze)})()
    monkeypatch.setattr(main, "reaction_processor", fake_processor)

    reaction_file = _write_dummy_video(tmp_path / "viewer_reaction.mp4")

    with TestClient(main.app) as client:
        with open(reaction_file, "rb") as fh:
            response = client.post(
                f"/reactions/{analysis_id}",
                files={"file": ("reaction.webm", fh, "video/webm")},
            )

        assert response.status_code == 202
        payload = response.json()
        reaction_id = payload["reaction_id"]
        assert reaction_id.startswith("reaction_")
        assert payload["job"]["status"] == "queued"
        assert payload["job"]["processing_mode"] == "queue"

        queue_job_id = payload.get("queue_job_id")
        if queue_job_id:
            _wait_for_queue_job(client, queue_job_id)

        detail = _wait_for_reaction_job(client, reaction_id)
        assert detail["job"]["status"] == "completed"
        assert detail["reaction"]["emotion_summary"]["joy"] == pytest.approx(100.0)
        assert detail["reaction"]["emotion_timeline"][0]["joy"] == pytest.approx(1.0)

        list_resp = client.get(f"/analysis/{analysis_id}/reactions")
        assert list_resp.status_code == 200
        jobs = list_resp.json()["jobs"]
        reactions = list_resp.json()["reactions"]
        assert jobs[0]["status"] == "completed"
        assert reactions[0]["id"] == reaction_id

        results_resp = client.get(f"/results/{analysis_id}")
        assert results_resp.status_code == 200
        results = results_resp.json()
        assert results["audience_engagement"] == pytest.approx(0.95, rel=1e-3)
        assert results["score_source"] == "audience_only"
        assert results["emotion_timeline"][0]["joy"] == pytest.approx(1.0)


def test_upload_reaction_endpoint_fallback_when_worker_down(monkeypatch, tmp_path):
    """If the job queue worker is offline, the fallback task should still finish."""
    from api import main

    storage_dir = tmp_path / "video_analyses"
    test_storage = VideoAnalysisStorage(storage_dir=str(storage_dir))

    source_video = _write_dummy_video(tmp_path / "analysis_source_fallback.mp4")
    analysis_id = test_storage.create_analysis(str(source_video))

    monkeypatch.setattr(main, "storage", test_storage, raising=False)
    main.job_queue.storage = test_storage
    if hasattr(main.job_queue, "_scheduled_jobs"):
        main.job_queue._scheduled_jobs.clear()
    main._fallback_reaction_tasks.clear()

    def fake_analyze(_video_path: str):
        return {
            "emotion_timeline": [
                {"timestamp": 0.0, "emotion": "delight", "engagement": 0.95, "scores": {"delight": 1.0}}
            ],
            "emotion_summary": {"delight": 100.0},
            "key_moments": [],
            "engagement_score": 0.95,
            "reaction_snapshots": [],
        }

    fake_processor = type("StubProcessor", (), {"analyze": staticmethod(fake_analyze)})()
    monkeypatch.setattr(main, "reaction_processor", fake_processor)
    monkeypatch.setattr(main.job_queue, "ensure_worker", lambda: False, raising=False)
    monkeypatch.setattr(main.job_queue, "worker_running", lambda: False, raising=False)

    reaction_file = _write_dummy_video(tmp_path / "fallback_reaction.mp4")

    with TestClient(main.app) as client:
        with open(reaction_file, "rb") as fh:
            response = client.post(
                f"/reactions/{analysis_id}",
                files={"file": ("reaction.webm", fh, "video/webm")},
            )

        assert response.status_code == 202
        payload = response.json()
        assert payload["queue_job_id"] is None
        assert payload["job"]["status"] == "processing_fallback"
        assert payload["job"]["processing_mode"] == "fallback"

        detail = _wait_for_reaction_job(client, payload["reaction_id"], timeout=5.0)
        assert detail["job"]["status"] == "completed"
        assert detail["job"]["processing_mode"] == "fallback"

    assert not main._fallback_reaction_tasks


def test_reaction_processing_mp4_passthrough(tmp_path):
    """Ensure reaction processing doesn't alter already-compatible mp4 files."""
    from app.features.analytics.reaction_processing import ReactionProcessingPipeline

    pipeline = ReactionProcessingPipeline()
    sample_video = _write_dummy_video(tmp_path / "sample.mp4")
    assert pipeline._ensure_readable_video(str(sample_video)) == str(sample_video)


def test_reaction_processing_timeout_marks_job_failed(monkeypatch, tmp_path):
    """If reaction analysis hangs longer than timeout, the job should fail."""
    from api import main
    storage_dir = tmp_path / "video_analyses"
    test_storage = VideoAnalysisStorage(storage_dir=str(storage_dir))

    source_video = _write_dummy_video(tmp_path / "analysis_source_timeout.mp4")
    analysis_id = test_storage.create_analysis(str(source_video))

    monkeypatch.setattr(main, "storage", test_storage, raising=False)
    main.job_queue.storage = test_storage
    if hasattr(main.job_queue, "_scheduled_jobs"):
        main.job_queue._scheduled_jobs.clear()

    def slow_analyze(_video_path: str):
        time.sleep(0.2)
        return {
            "emotion_timeline": [],
            "emotion_summary": {},
            "key_moments": [],
            "engagement_score": 0.0,
            "reaction_snapshots": [],
        }

    fake_processor = type("StubProcessor", (), {"analyze": staticmethod(slow_analyze)})()
    monkeypatch.setattr(main, "reaction_processor", fake_processor)
    monkeypatch.setattr(main, "REACTION_PROCESSING_TIMEOUT_SECONDS", 0.05, raising=False)

    reaction_file = _write_dummy_video(tmp_path / "slow_viewer_reaction.mp4")

    with TestClient(main.app) as client:
        with open(reaction_file, "rb") as fh:
            response = client.post(
                f"/reactions/{analysis_id}",
                files={"file": ("reaction.webm", fh, "video/webm")},
            )

        assert response.status_code == 202
        payload = response.json()
        reaction_id = payload["reaction_id"]
        queue_job_id = payload.get("queue_job_id")
        if queue_job_id:
            _wait_for_queue_job(client, queue_job_id, timeout=5.0)

        detail = _wait_for_reaction_job(client, reaction_id, timeout=5.0)
        assert detail["job"]["status"] == "failed"
        error_text = (detail["job"].get("error") or "").lower()
        assert "timeout" in error_text or "exceeded" in error_text

