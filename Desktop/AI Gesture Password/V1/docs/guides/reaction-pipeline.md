# Reaction Pipeline Runbook

## Overview
The Custom Stories reaction pipeline lets producers record webcam reactions, upload them to the FastAPI backend, run the `EnhancedEmotionTracker` pipeline asynchronously, and surface the results inside both the Project Overview and Reaction Metrics pages. Recordings are captured as WebM in-browser and automatically transcoded to MP4 on the server (via MoviePy) so OpenCV/ffmpeg can analyze them reliably.

```
Recorder (React) → /reactions/{id} upload (WebM) → VideoAnalysisStorage.reaction_jobs
→ Background worker (process_reaction_video) → convert to MP4 (MoviePy or FFmpeg)
→ EnhancedEmotionTracker / fallback analyzer → reaction saved
→ GET /analysis/{id}/reactions + GET /reactions/{reaction_id}
→ UI polling (Recorder, Metrics, Project)
```

## Backend instrumentation & logging
### Metrics emitted (`REACTION_LOG`)
- `reaction.job.started`: recorded when a job transitions from `queued` → `processing`.
- `reaction.job.completed`: includes `timeline_points` and `engagement` when analysis persists successfully.
- `reaction.job.persist_failed`: successful analysis but persistence failed—storage layer should be inspected.
- `reaction.job.failed`: unhandled exception during analysis; `error` is persisted in the job metadata.
- `reaction.aggregate.updated`: emitted whenever `VideoAnalysisStorage` recomputes audience aggregates (avg engagement + normalized emotion summary).
- `reaction.job.timeout`: emitted when analysis exceeds the watchdog (`REACTION_PROCESSING_TIMEOUT_SECONDS`, default 180s). These jobs surface as `failed` with a timeout error and should be retried after investigating conversion/analyzer bottlenecks.

All logs include `analysis_id` and `reaction_id`, so you can filter by either value when debugging CloudWatch/LogDNA/etc.

### Storage metadata
- Every upload inserts a job entry under `VideoAnalysisStorage.db["reaction_jobs"]` with `status`, timestamps, and error reason.
- The `video_path` for a reaction is stored both in the job metadata and the final reaction summary to simplify manual re-processing.
- Reaction entries persist canonicalized emotion data: each timeline sample exposes `joy`, `surprise`, `neutral`, `calm`, `sadness`, and `love` values (0–1), making it easy for the web client to render multi-series charts.

### Runtime tuning (environment variables)
- `REACTION_ANALYZER_MODE` (`auto` | `lightweight`): in `auto`, the service attempts the EnhancedEmotionTracker when dependencies exist; set to `lightweight` to always use the fast heuristic analyzer (useful for CPU-only deployments or when processing time is a concern).
- `REACTION_FRAME_SKIP` (default `2`): number of frames to skip when the enhanced tracker is enabled; higher values reduce processing time at the expense of temporal resolution.
- `REACTION_MAX_FRAME_EDGE` (default `720`): downscales each frame so its longest edge is at most this many pixels before running the enhanced tracker.
- `REACTION_PROCESSING_TIMEOUT_SECONDS` (default `180`): watchdog duration; if analysis exceeds this window the job is marked `failed` with a timeout error.

### Engagement scoring & API payloads
- The backend now computes `audience_engagement` (0–1) alongside `avg_engagement` and records `score_source` (`audience_only`, `ai_only`, `blended`).
- `GET /results/{analysis_id}` includes `audience_engagement`, `ai_effectiveness`, and `score_source` so the UI can explain whether a score is AI-only, audience-only, or a 70/30 blend.
- `GET /reactions/{reaction_id}` returns the normalized timeline for that specific viewer; the React UI lets users toggle between the aggregate view and individual reactions via a viewer selector in Reaction Metrics.
- Aggregation logging (`reaction.aggregate.updated`) makes it easy to correlate score discrepancies with raw inputs.

## QA checklist

### 1. Happy-path reaction upload
1. Start backend (`uvicorn src/api/main:app`) and frontend (`pnpm dev`).
2. Record a short reaction with microphone + webcam enabled.
3. Let the advertisement finish playing (the recorder auto-stops when the ad ends) or click **Stop Recording** manually.
4. Verify Recorder shows the upload card with job status = `QUEUED` → `PROCESSING` → `COMPLETED`.
4. Navigate to Project Overview → confirm the “Viewer Reactions” card lists the new reaction.
5. Open Reaction Metrics → ensure charts refresh, the viewer selector defaults to the newest reaction, and the multi-series timeline shows engagement plus at least one emotion trace.
6. Return to Project Overview → confirm the engagement gauge shows the blended (AI + audience) score when both sources exist and the chip labels (“Audience 82%”, “AI 74%”) match the backend payload.

### 2. Webcam/Mic permissions denied
1. Open Reaction Recorder in a fresh browser profile.
2. Deny webcam/mic access.
3. Expected: error toast in console (`Failed to access webcam`), Recorder holds in idle state.
4. Manually grant permissions and retest; Recorder should recover without page refresh.

### 3. Slow / flaky network upload
1. Throttle network in DevTools (e.g., “Slow 3G”).
2. Record 10–15 seconds; stop recording and click “Save & Analyze”.
3. Ensure “Uploading…” state persists with no UI freeze.
4. If upload fails (timeout), Recorder should show `uploadState === 'error'` with the backend error message; retry button should resubmit without re-recording.

### 4. Backend offline / 500 errors
1. Stop FastAPI server.
2. Attempt “Save & Analyze” after recording.
3. Recorder should show the error pill with `Failed to store reaction recording` (from backend).
4. Start API, click “Retry Upload” and confirm success.

### 5. Processing failure
1. Monkeypatch `reaction_processor.analyze` locally to raise `RuntimeError`.
2. Upload a reaction.
3. Recorder + Reaction Metrics should show job status `FAILED` with the logged error message; job remains in history for post-mortem.

### 6. Large reaction video (size limits)
1. Record >90 seconds (or manually upload a large `Blob`) to ensure storage can handle multi-MB files.
2. Confirm backend still processes and persists within acceptable time.

### 7. Offline fallback
1. After recording, go offline before clicking “Save & Analyze”.
2. Recorder should display the upload error; once back online, “Retry Upload” should work without re-recording.

### 8. Viewer selector + engagement sanity
1. Record/upload at least two reactions for the same analysis.
2. On Reaction Metrics, toggle between “All viewers” and each viewer in the selector—verify the timeline and highlights change per selection.
3. On Project Overview, confirm the engagement gauge chip text (“AI + Audience blend (70/30)” vs “Audience reactions only”) matches the backend `score_source`.
4. If processing feels slow, try setting `REACTION_ANALYZER_MODE=lightweight` and `REACTION_FRAME_SKIP=2` (or higher) and re-run to confirm the watchdog logs show completion in seconds.

### 9. Autoplay-blocked preview overlay
1. In Chrome/Edge, open a fresh profile and deny autoplay or pause the `<video>` element before granting webcam permissions.
2. Load the Reaction Recorder—when autoplay is blocked you should see the “Tap to enable preview” overlay.
3. Click the overlay (or call `resumePreviewPlayback()` via DevTools) and confirm the live preview resumes without reloading the page.
4. Stop recording or reset the recorder—preview should restart automatically, and overlays should only reappear when the browser blocks playback again.

### 10. Queue worker watchdog / fallback
1. Stop the FastAPI app and delete `video_analyses/analyses.json` to simulate a crash mid-job (optional).
2. Restart the API and upload a new reaction while temporarily forcing `job_queue.worker_running()` to return `False`.
3. Verify `/reactions/{id}` responds with `queue_job_id = null`, `REACTION_LOG` emits `reaction.queue.health_unavailable`, and the fallback task still advances the job to `completed`/`failed`.
4. Re-enable the worker (or rely on `job_queue.ensure_worker()`); upload another reaction and confirm jobs now get queue IDs again.

## Manual testing quick-reference
- `pytest tests/test_reactions.py`
- `npm run build` (will surface TypeScript issues; chunk-size warning is expected for now)
- `pnpm dev` → `localhost:5173/reaction-metrics/<analysis_id>`

## Operational tips
- Jobs stuck in `processing` usually indicate a crashed worker; inspect `REACTION_LOG` and `reaction_jobs` for `started_at` without `finished_at`.
- `job_queue.ensure_worker()` restarts the background worker automatically whenever `/analyze` or `/reactions` detect it went down. Use `/queue/jobs` + `REACTION_LOG` to confirm the restart before diagnosing deeper issues.
- Old reaction videos accumulate under `video_analyses/reactions/`; plan a retention policy (e.g., archive after 30 days).
- To rerun a failed reaction manually, point the `ReactionProcessingPipeline` at the stored `video_path` and call `process_reaction_video`.
- When debugging score discrepancies, check `audience_engagement`, `ai_effectiveness`, and `score_source` in `GET /results/{analysis_id}`. The frontend mirrors these values 1:1, so mismatches are usually due to stale aggregates rather than UI math.

