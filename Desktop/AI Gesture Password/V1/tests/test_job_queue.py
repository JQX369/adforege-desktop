import asyncio
from pathlib import Path

import pytest

from app.core.video_storage import VideoAnalysisStorage
from app.core.job_queue import JobQueue


@pytest.mark.asyncio
async def test_job_queue_processes_jobs_sequentially(tmp_path):
    storage = VideoAnalysisStorage(str(tmp_path / "storage"))
    queue = JobQueue(storage)
    processed_labels: list[str] = []

    async def handler(job_context):
        # Simulate a bit of work so the order would break if we ran concurrently.
        await asyncio.sleep(0.01)
        processed_labels.append(job_context["payload"]["label"])

    queue.register_handler("unit_test", handler)

    job_a = queue.enqueue("unit_test", analysis_id="analysis-a", payload={"label": "first"})
    job_b = queue.enqueue("unit_test", analysis_id="analysis-b", payload={"label": "second"})

    worker = asyncio.create_task(queue.start_worker())
    await queue.wait_for_all(timeout=2.0)
    await queue.shutdown()
    await worker

    assert processed_labels == ["first", "second"]
    assert storage.get_queue_job(job_a)["status"] == "completed"
    assert storage.get_queue_job(job_b)["status"] == "completed"


@pytest.mark.asyncio
async def test_ensure_worker_starts_worker_when_idle(tmp_path):
    storage = VideoAnalysisStorage(str(tmp_path / "storage"))
    queue = JobQueue(storage)
    processed: list[str] = []

    async def handler(job_context):
        processed.append(job_context["payload"]["label"])

    queue.register_handler("unit_test", handler)

    restarted = queue.ensure_worker()
    assert restarted is True
    assert queue.worker_running() is True

    queue.enqueue("unit_test", analysis_id="analysis-a", payload={"label": "only"})
    await queue.wait_for_all(timeout=2.0)
    await queue.shutdown()

    assert processed == ["only"]


@pytest.mark.asyncio
async def test_ensure_worker_restarts_after_crash(tmp_path):
    storage = VideoAnalysisStorage(str(tmp_path / "storage"))
    queue = JobQueue(storage)

    async def handler(job_context):
        pass

    queue.register_handler("unit_test", handler)

    worker = asyncio.create_task(queue.start_worker())
    await asyncio.sleep(0)
    worker.cancel()
    with pytest.raises(asyncio.CancelledError):
        await worker

    assert queue.worker_running() is False
    restarted = queue.ensure_worker()
    assert restarted is True

    await queue.shutdown()


@pytest.mark.asyncio
async def test_worker_health_reports_running_and_stopped_states(tmp_path):
    storage = VideoAnalysisStorage(str(tmp_path / "storage"))
    queue = JobQueue(storage)

    async def handler(job_context):
        return None

    queue.register_handler("unit_test", handler)

    health = queue.worker_health()
    assert health["running"] is False
    assert health["last_heartbeat"] is None

    restarted = queue.ensure_worker()
    assert restarted is True
    await asyncio.sleep(0)

    health = queue.worker_health()
    assert health["running"] is True
    assert health["last_heartbeat"] is not None

    await queue.shutdown()
    health = queue.worker_health()
    assert health["running"] is False


@pytest.mark.asyncio
async def test_resume_pending_jobs_requeues_processing_entries(tmp_path):
    storage = VideoAnalysisStorage(str(tmp_path / "storage"))
    queue = JobQueue(storage)
    processed: list[str] = []

    async def handler(job_context):
        processed.append(job_context["job_id"])

    queue.register_handler("unit_test", handler)

    job = storage.create_queue_job(
        job_type="unit_test",
        analysis_id="analysis-pending",
        payload={"label": "pending"},
    )
    storage.update_queue_job(
        job["job_id"],
        status="processing",
        started_at="2025-01-01T00:00:00",
    )

    queue.ensure_worker()
    await queue.wait_for_all(timeout=2.0)
    await queue.shutdown()

    assert processed == [job["job_id"]]
    final = storage.get_queue_job(job["job_id"])
    assert final["status"] == "completed"
def test_storage_persists_queue_jobs(tmp_path):
    storage_path = tmp_path / "storage"
    storage = VideoAnalysisStorage(str(storage_path))

    job = storage.create_queue_job(
        job_type="video_analysis",
        analysis_id="analysis-123",
        payload={"temp_path": str(Path(storage_path) / "video.mp4")},
    )
    job_id = job["job_id"]

    reloaded = VideoAnalysisStorage(str(storage_path))
    persisted = reloaded.get_queue_job(job_id)

    assert persisted is not None
    assert persisted["status"] == "queued"
    assert persisted["payload"]["temp_path"].endswith("video.mp4")
    assert persisted["analysis_id"] == "analysis-123"


def test_list_queue_jobs_filters_by_analysis(tmp_path):
    storage = VideoAnalysisStorage(str(tmp_path / "storage"))
    job_one = storage.create_queue_job("video_analysis", "analysis-a", payload={"label": "alpha"})
    storage.create_queue_job("reaction", "analysis-b", payload={"label": "beta"})

    all_jobs = storage.list_queue_jobs()
    assert {job["job_id"] for job in all_jobs} >= {job_one["job_id"]}

    filtered = storage.list_queue_jobs(analysis_id="analysis-a")
    assert len(filtered) == 1
    assert filtered[0]["analysis_id"] == "analysis-a"

