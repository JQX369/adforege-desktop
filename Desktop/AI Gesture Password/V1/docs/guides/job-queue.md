# Job Queue Architecture

Updated: 2025-11-23

## Overview

All long-running workloads (video analysis + reaction processing) are now executed through a persisted job queue. This ensures uploads return immediately, jobs run sequentially on the desktop hardware, and the UI can display reliable progress + retry affordances.

```
Client upload → POST /analyze or /reactions/{analysis_id}
  ↳ VideoAnalysisStorage.create_{analysis|reaction_job}()
  ↳ JobQueue.enqueue(job_type, analysis_id, payload)
FastAPI startup → JobQueue.start_worker()
  ↳ sequentially pops queue jobs
  ↳ dispatches to registered handlers (video_analysis / reaction)
  ↳ updates queue_jobs + reaction_jobs with status/error
Web UI polls /queue/jobs/{id} + /reactions/{id}
```

## API Reference

| Endpoint | Description |
| --- | --- |
| `POST /analyze` | Stores the upload, enqueues `video_analysis`, returns `{analysis_id, job_id}` |
| `POST /reactions/{analysis_id}` | Stores recording, enqueues `reaction`, returns `{reaction_id, job, queue_job_id}` |
| `GET /queue/jobs` | List queue jobs (filter by `status`, `job_type`, `analysis_id`) |
| `GET /queue/jobs/{job_id}` | Fetch job status (`queued`, `processing`, `completed`, `failed`) with user-friendly error |
| `POST /queue/jobs/{job_id}/retry` | Reset failed job back to queued |

## Error Classification

`app/core/error_handler.py` maps internal exceptions to UX-safe copy:

| Category | Trigger | User Message | Transient |
| --- | --- | --- | --- |
| `timeout` | TimeoutError / message contains `timeout` | “Processing took too long…” | ✅ |
| `conversion_failed` | `ffmpeg`, `moviepy`, `convert` keywords | “We couldn't convert the recording…” | ✅ |
| `storage_failed` | `disk`, `storage`, `permission`, `save` | “We couldn't save the results…” | ❌ |
| `analysis_failed` | “analysis”, “emotion”, “tracker” | “The analyzer encountered an issue…” | ✅ |
| `unknown` | fallback | generic message | ❌ |

The queue worker persists both `error` (technical) and `error_user_message` (friendly). React components prefer the friendly variant.

## Frontend Hooks

- `useToast` (`@shared/components/Toast`) → global toasts for success/failure
- `JobStatus` → renders status badge + retry CTA
- `BatchQueue` → dashboard widget for simultaneous jobs
- `api.ts` helpers: `getQueueJobStatus`, `retryQueueJob`, `listQueueJobs`
- Reaction Recorder gracefully handles missing camera permissions by showing a contextual error banner instead of an empty preview.

Projects and Reaction Recorder now poll queue APIs and surface manual retries. When a job fails, `Retry Job` calls `/queue/jobs/{id}/retry`, reusing the persisted payload.

## Testing

- `tests/test_job_queue.py` covers sequential ordering, persistence, and filtering
- `tests/test_reactions.py` now waits for queue jobs before asserting reaction results

Run selectively:

```bash
pytest tests/test_job_queue.py
pytest tests/test_reactions.py -k upload_reaction_endpoint
```

## Operational Notes

- Queue persists into `video_analyses/analyses.json` (`queue_jobs` key)
- Worker restarts automatically on FastAPI startup and resumes `queued` jobs
- Watchdog timeout for reactions remains configurable via `REACTION_PROCESSING_TIMEOUT_SECONDS`
- For long job bursts, monitor `/queue/jobs?status=queued` and surface via dashboard BatchQueue

