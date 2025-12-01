import asyncio
import logging
from collections import deque
from datetime import datetime
from typing import Any, Awaitable, Callable, Deque, Dict, Optional

from app.core.error_handler import classify_error
from app.core.video_storage import VideoAnalysisStorage

JobHandler = Callable[[Dict[str, Any]], Awaitable[None]]


class JobQueue:
    """Simple sequential job queue backed by VideoAnalysisStorage."""

    def __init__(self, storage: VideoAnalysisStorage):
        self.storage = storage
        self._handlers: Dict[str, JobHandler] = {}
        self._queue: Optional[asyncio.Queue[Optional[str]]] = None
        self._scheduled_jobs: set[str] = set()
        self._pending_jobs: Deque[str] = deque()
        self._logger = logging.getLogger("app.job_queue")
        self._worker_task: Optional[asyncio.Task] = None
        self._last_heartbeat: Optional[str] = None
        self._last_exception: Optional[str] = None

    def _mark_heartbeat(self) -> None:
        self._last_heartbeat = datetime.now().isoformat()

    def register_handler(self, job_type: str, handler: JobHandler) -> None:
        """Register an async handler for a specific job type."""
        self._handlers[job_type] = handler

    def worker_running(self) -> bool:
        if self._worker_task is None:
            return False
        if self._worker_task.done():
            try:
                exc = self._worker_task.exception()
                if exc:
                    self._last_exception = repr(exc)
                    self._logger.error("JobQueue worker terminated with error: %s", exc)
            except asyncio.CancelledError:
                pass
            finally:
                self._worker_task = None
            return False
        return True

    def worker_health(self) -> Dict[str, Any]:
        running = self.worker_running()
        return {
            "running": running,
            "last_heartbeat": self._last_heartbeat,
            "last_exception": self._last_exception,
        }

    def ensure_worker(self) -> bool:
        """Ensure the worker task is running; restart if needed."""
        if self.worker_running():
            return False
        self._last_exception = None
        loop = asyncio.get_running_loop()
        self._worker_task = loop.create_task(self.start_worker(), name="job-queue-worker")
        self._worker_task.add_done_callback(self._on_worker_exit)
        self._logger.warning("JobQueue worker restarted via ensure_worker()")
        return True

    def enqueue(
        self,
        job_type: str,
        analysis_id: str,
        payload: Dict[str, Any],
        *,
        max_retries: int = 0,
    ) -> str:
        """Persist a job to storage and schedule it for processing."""
        job = self.storage.create_queue_job(
            job_type=job_type,
            analysis_id=analysis_id,
            payload=payload,
            max_retries=max_retries,
        )
        job_id = job["job_id"]
        self._schedule_job_id(job_id)
        return job_id

    async def start_worker(self) -> None:
        """Run the worker loop until `shutdown()` is called. MUST be called via create_task."""
        self._queue = asyncio.Queue()
        while self._pending_jobs:
            job_id = self._pending_jobs.popleft()
            self._queue.put_nowait(job_id)
        await self._resume_pending_jobs()
        self._mark_heartbeat()

        while True:
            job_id = await self._queue.get()  # type: ignore[arg-type]
            if job_id is None:
                self._queue.task_done()
                self._mark_heartbeat()
                break
            try:
                await self._process_job(job_id)
            finally:
                self._queue.task_done()
                self._mark_heartbeat()

        self._queue = None

    def _on_worker_exit(self, task: asyncio.Task) -> None:
        if task.cancelled():
            self._logger.info("JobQueue worker task cancelled")
        elif (exc := task.exception()) is not None:
            self._last_exception = repr(exc)
            self._logger.error("JobQueue worker crashed", exc_info=exc)
        else:
            self._last_exception = None
            self._logger.info("JobQueue worker task exited normally")
        if self._worker_task is task:
            self._worker_task = None

    async def wait_for_all(self, timeout: Optional[float] = None) -> None:
        """Wait until all queued jobs have been processed."""
        if self._queue is None:
            return
        await asyncio.wait_for(self._queue.join(), timeout=timeout)

    async def shutdown(self) -> None:
        """Signal the worker loop to exit and wait for completion."""
        if self._worker_task is None:
            return
        if self._queue is not None:
            await self._queue.put(None)
        await self._worker_task
        self._worker_task = None

    async def retry_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Reset a failed job back to queued state and reschedule it."""
        job = self.storage.get_queue_job(job_id)
        if not job:
            return None
        updated_retry_count = job.get("retry_count", 0) + 1
        updated = self.storage.update_queue_job(
            job_id,
            status="queued",
            started_at=None,
            finished_at=None,
            error=None,
            error_user_message=None,
            retry_count=updated_retry_count,
        )
        if updated:
            self._schedule_job_id(job_id)
        return updated

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self.storage.get_queue_job(job_id)

    def list_jobs(
        self,
        *,
        analysis_id: Optional[str] = None,
        job_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[Dict[str, Any]]:
        return self.storage.list_queue_jobs(
            analysis_id=analysis_id,
            job_type=job_type,
            status=status,
        )

    async def _resume_pending_jobs(self) -> None:
        pending = self.storage.list_queue_jobs()
        for job in pending:
            if job.get("status") in {"queued", "processing"}:
                if job.get("status") == "processing":
                    self.storage.update_queue_job(
                        job["job_id"],
                        status="queued",
                        started_at=None,
                    )
                self._schedule_job_id(job["job_id"])

    def _schedule_job_id(self, job_id: str) -> None:
        if job_id in self._scheduled_jobs:
            return
        self._scheduled_jobs.add(job_id)
        if self._queue is not None:
            self._queue.put_nowait(job_id)
        else:
            self._logger.debug("Queue not ready; deferring job %s", job_id)
            self._pending_jobs.append(job_id)

    async def _process_job(self, job_id: str) -> None:
        job = self.storage.get_queue_job(job_id)
        if not job:
            self._scheduled_jobs.discard(job_id)
            return

        handler = self._handlers.get(job.get("job_type", ""))
        if not handler:
            self._logger.error("No handler registered for job %s", job_id)
            self.storage.update_queue_job(
                job_id,
                status="failed",
                finished_at=datetime.now().isoformat(),
                error=f"No handler registered for job type {job.get('job_type')}",
                error_user_message="No worker is available to process this job.",
            )
            self._scheduled_jobs.discard(job_id)
            return

        started_at = datetime.now().isoformat()
        self.storage.update_queue_job(
            job_id,
            status="processing",
            started_at=started_at,
        )

        try:
            await handler(job)
        except Exception as exc:  # pragma: no cover - exercised via classification tests
            classification = classify_error(exc)
            self.storage.update_queue_job(
                job_id,
                status="failed",
                finished_at=datetime.now().isoformat(),
                error=classification["technical_details"],
                error_user_message=classification["user_message"],
            )
            self._logger.exception(
                "Job %s failed (%s)", job_id, classification["category"]
            )
        else:
            self.storage.update_queue_job(
                job_id,
                status="completed",
                finished_at=datetime.now().isoformat(),
            )
        finally:
            self._scheduled_jobs.discard(job_id)

