from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
import json
import asyncio
import concurrent.futures
import logging
import mimetypes
import os
import shutil
import sys
import uuid
import uvicorn
from contextlib import asynccontextmanager
from pathlib import Path

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    # Load .env from project root (2 levels up from src/api)
    env_path = Path(__file__).parent.parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        logger = logging.getLogger(__name__)
        logger.info(f"Loaded environment variables from {env_path}")
except ImportError:
    # python-dotenv not installed, skip loading .env
    pass

# Add src to path to import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.core.video_storage import VideoAnalysisStorage
from app.core.job_queue import JobQueue
from app.features.clearcast.clearcast_checker import ClearcastChecker
from app.features.ai_breakdown.ai_video_breakdown import AIVideoBreakdown
from app.features.analytics.reaction_processing import ReactionProcessingPipeline
from app.core.video_processor import ClearcastVideoProcessor
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

REACTION_LOG = logging.getLogger("app.reactions")

app = FastAPI(
    title="One-Shot API",
    description="Backend API for One-Shot Video Analysis",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances - Use project root for storage to avoid cwd issues
PROJECT_ROOT = Path(__file__).parent.parent.parent
STORAGE_DIR = PROJECT_ROOT / "video_analyses"
storage = VideoAnalysisStorage(str(STORAGE_DIR))
clearcast_checker = ClearcastChecker()
ai_breakdown = AIVideoBreakdown()
video_processor = ClearcastVideoProcessor()
reaction_processor = ReactionProcessingPipeline()
REACTION_PROCESSING_TIMEOUT_SECONDS = int(os.environ.get("REACTION_PROCESSING_TIMEOUT_SECONDS", "180"))
job_queue = JobQueue(storage)
_fallback_reaction_tasks: set[asyncio.Task] = set()
DEBUG_LOG_PATH = Path(r"c:\Users\Jacques Y\Desktop\AI Gesture Password\V1\.cursor\debug.log")
SUPPORTED_VIDEO_MEDIA_TYPES = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
}
ALLOWED_VIDEO_UPLOAD_EXTENSIONS = set(SUPPORTED_VIDEO_MEDIA_TYPES.keys())


@asynccontextmanager
async def job_queue_lifespan(app: FastAPI):
    try:
        worker_started = job_queue.ensure_worker()
        if worker_started:
            await asyncio.sleep(0.01)
        logger.info(
            "Job queue worker %s on startup",
            "started" if worker_started else "already running",
        )
    except RuntimeError as exc:
        logger.error("Unable to start job queue worker: %s", exc)
    try:
        yield
    finally:
        if _fallback_reaction_tasks:
            logger.info("Awaiting %d inline fallback reaction tasks", len(_fallback_reaction_tasks))
            for task in list(_fallback_reaction_tasks):
                task.cancel()
            await asyncio.gather(*_fallback_reaction_tasks, return_exceptions=True)
            _fallback_reaction_tasks.clear()
        await job_queue.shutdown()
        logger.info("Job queue worker stopped on shutdown")


app.router.lifespan_context = job_queue_lifespan


def _media_type_for_path(video_path: Path) -> str:
    """Infer media type for FileResponse."""
    suffix = video_path.suffix.lower()
    if suffix in SUPPORTED_VIDEO_MEDIA_TYPES:
        return SUPPORTED_VIDEO_MEDIA_TYPES[suffix]
    guessed, _ = mimetypes.guess_type(str(video_path))
    if guessed and guessed.startswith("video/"):
        return guessed
    return "video/mp4"


def _validate_upload_extension(filename: Optional[str]) -> None:
    """Raise HTTPException if filename extension is not allowed."""
    suffix = Path(filename or "").suffix.lower()
    if suffix in ALLOWED_VIDEO_UPLOAD_EXTENSIONS:
        return
    allowed_list = ", ".join(sorted(ext.upper() for ext in ALLOWED_VIDEO_UPLOAD_EXTENSIONS))
    display = suffix or "(no extension)"
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported video format '{display}'. Please upload one of: {allowed_list}.",
    )


def _debug_log(hypothesis_id: str, location: str, message: str, data: Optional[Dict[str, Any]] = None, run_id: str = "pre-fix") -> None:
    payload = {
        "sessionId": "debug-session",
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data or {},
        "timestamp": int(datetime.now().timestamp() * 1000),
    }
    try:
        DEBUG_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload) + "\n")
    except Exception:
        pass


def _track_fallback_task(task: asyncio.Task) -> None:
    _fallback_reaction_tasks.add(task)

    def _cleanup(t: asyncio.Task) -> None:
        _fallback_reaction_tasks.discard(t)
        if t.cancelled():
            logger.info("Fallback reaction task cancelled")
        elif (exc := t.exception()) is not None:
            logger.error("Fallback reaction task failed: %s", exc)

    task.add_done_callback(_cleanup)

# Pydantic Models
class Project(BaseModel):
    id: str
    video_name: str
    created_at: str
    video_path: str
    status: str = "completed"
    thumbnail: Optional[str] = None
    avg_engagement: float = 0.0

class AnalysisResult(BaseModel):
    id: str
    video_name: str
    created_at: str
    avg_engagement: float
    emotion_summary: Dict[str, float]
    emotion_timeline: List[Dict[str, Any]]
    clearcast_check: Optional[Dict[str, Any]] = None
    analyzed_frames: Optional[List[Dict[str, Any]]] = None
    ai_breakdown: Optional[Dict[str, Any]] = None
    audience_engagement: Optional[float] = None
    ai_effectiveness: Optional[float] = None
    score_source: Optional[str] = None
    playback_ready: Optional[bool] = None
    playback_job_id: Optional[str] = None

class ClearcastRequest(BaseModel):
    analysis_id: str
    clock_number: Optional[str] = None
    mode: str = "web"  # "web" for tolerant, "pure" for strict


class PureClearcastRequest(BaseModel):
    """Request model for strict Clearcast clearance check (DPP AS-11 style)."""
    analysis_id: str
    clock_number: str  # REQUIRED for pure mode
    agency_code: Optional[str] = None
    client_name: Optional[str] = None
    product_name: Optional[str] = None


class BreakdownRequest(BaseModel):
    analysis_id: str
    detail_level: str = "full"
    audience_country: Optional[str] = None

class SimilarAdsRequest(BaseModel):
    analysis_id: str
    limit: int = 10

class SimilarAd(BaseModel):
    id: str
    title: str
    brand: str
    category: str
    year: Optional[int] = None
    description: str
    script_excerpt: str
    video_url: Optional[str] = None
    effectiveness_score: Optional[float] = None
    awards: List[str] = []
    similarity_score: float
    tags: List[str] = []

class MetricBenchmark(BaseModel):
    value: float
    percentile: int
    category_avg: float
    category_min: float
    category_max: float
    sample_size: int

class BenchmarkData(BaseModel):
    category: str
    sample_size: int
    metrics: Dict[str, MetricBenchmark] = {}
    insights: List[str] = []
    strengths: List[str] = []
    improvements: List[str] = []

class SimilarAdsWithBenchmarks(BaseModel):
    similar_ads: List[SimilarAd]
    benchmarks: Optional[BenchmarkData] = None
    creative_profile: Optional[Dict[str, Any]] = None

class CountryUpdateRequest(BaseModel):
    country: str

class SlateInfo(BaseModel):
    clock_number: Optional[str] = None
    client_name: Optional[str] = None
    agency_name: Optional[str] = None
    product_name: Optional[str] = None
    title: Optional[str] = None


class PolishRequest(BaseModel):
    analysis_id: str
    actions: Optional[Dict[str, bool]] = None
    slate_info: Optional[SlateInfo] = None
    quality: Literal["high", "standard", "web"] = "standard"
    standard: Literal["UK_CLEARCAST", "US_BROADCAST", "WEB_BRIGHT"] = "UK_CLEARCAST"
    export_bright: bool = False
    options: Optional[Dict[str, Any]] = None  # legacy payload fallback

class ChatRequest(BaseModel):
    context: Dict[str, Any]
    message: str

class ReactionJob(BaseModel):
    reaction_id: str
    analysis_id: str
    video_path: Optional[str]
    status: str
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    queue_job_id: Optional[str] = None
    processing_mode: Optional[str] = "queue"

class ReactionDetail(BaseModel):
    job: ReactionJob
    reaction: Optional[Dict[str, Any]] = None


async def _run_reaction_job_async(analysis_id: str, reaction_id: str, reaction_path: str, *, processing_mode: str = "queue"):
    """Run reaction processing in a background thread."""
    await asyncio.to_thread(process_reaction_video, analysis_id, reaction_id, reaction_path, processing_mode)


class QueueJobModel(BaseModel):
    job_id: str
    job_type: str
    analysis_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    error_user_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 0
    payload: Dict[str, Any] = {}


class WorkerHealth(BaseModel):
    running: bool
    last_heartbeat: Optional[str] = None
    last_exception: Optional[str] = None


class Settings(BaseModel):
    corporation_name: str
    accent_color: str


@app.get("/settings", response_model=Settings)
async def get_settings():
    """Get global application settings"""
    return storage.get_settings()


@app.post("/settings", response_model=Settings)
async def update_settings(settings: Settings):
    """Update global application settings"""
    return storage.update_settings(settings.model_dump())


def _project_status_for_analysis(analysis_id: str) -> str:
    jobs = job_queue.list_jobs(analysis_id=analysis_id, job_type="video_analysis")
    for job in jobs:
        if job.get("status") in {"queued", "processing"}:
            return job["status"]
    if any(job.get("status") == "failed" for job in jobs):
        return "failed"
    return "completed"


def _normalize_polish_payload(request: PolishRequest):
    """Merge legacy `options` payload with the new structured fields."""
    legacy_options = request.options or {}
    actions = dict(request.actions or {})

    # Legacy payload sent all booleans at the root of `options`
    for key, value in legacy_options.items():
        if isinstance(value, bool) and key not in actions:
            actions[key] = value

    def _coerce_str(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    slate_info = request.slate_info.model_dump() if request.slate_info else {}
    for field in ("clock_number", "client_name", "agency_name", "product_name", "title"):
        if not _coerce_str(slate_info.get(field)):
            slate_info[field] = _coerce_str(legacy_options.get(field))
    slate_info = {k: v for k, v in slate_info.items() if v}

    quality = request.quality or legacy_options.get("quality") or "standard"
    standard = request.standard or legacy_options.get("standard") or "UK_CLEARCAST"
    export_bright = request.export_bright or bool(legacy_options.get("export_bright", False))

    return actions, slate_info, quality, standard, export_bright


def _build_delivery_metadata(actions: Dict[str, bool], slate_info: Dict[str, Optional[str]], video_duration: Optional[float]) -> Dict[str, Any]:
    """Construct delivery metadata saved alongside processing results."""
    metadata = VideoAnalysisStorage._default_delivery_metadata()
    metadata["countdown_added"] = bool(actions.get("add_slate"))
    metadata["padding_added"] = bool(actions.get("add_padding"))
    metadata["duration"] = video_duration

    if metadata["countdown_added"]:
        for field in ("clock_number", "client_name", "agency_name", "product_name", "title"):
            value = slate_info.get(field)
            if value:
                metadata[field] = value

    metadata["ready"] = bool(metadata.get("clock_number") and metadata["countdown_added"])
    return metadata


# Routes

@app.get("/")
async def root():
    return {"message": "One-Shot API is running"}


@app.get("/health", tags=["System"])
async def health_check():
    """
    Health check endpoint for monitoring backend status.
    Returns 200 if the server is running and responsive.
    """
    return {
        "status": "healthy",
        "service": "one-shot-api",
        "version": "1.0.0"
    }


@app.get("/projects", response_model=List[Project])
async def list_projects():
    """List all projects"""
    logger.info("Projects endpoint called")
    try:
        logger.info("Fetching all analyses...")
        analyses = storage.get_all_analyses()
        logger.info(f"Found {len(analyses)} analyses")
        projects = []
        for a in analyses:
            projects.append(Project(
                id=a["id"],
                video_name=a["video_name"],
                created_at=a["created_at"],
                video_path=a["video_path"],
                thumbnail=a.get("thumbnail"),
                avg_engagement=a.get("avg_engagement", 0.0),
                status=_project_status_for_analysis(a["id"])
            ))
        projects.sort(key=lambda x: x.created_at, reverse=True)
        logger.info(f"Returning {len(projects)} projects")
        return projects
    except Exception as e:
        logger.error(f"Error listing projects: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_video(
    file: UploadFile = File(...),
):
    """Upload and analyze a video"""
    try:
        _validate_upload_extension(file.filename)

        temp_dir = Path("temp_uploads")
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / f"{uuid.uuid4()}_{file.filename}"
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        analysis_id = storage.create_analysis(str(temp_path), defer_transcription=True)
        
        if analysis_id.startswith("ERROR:"):
            raise HTTPException(status_code=400, detail=analysis_id)
            
        try:
            os.remove(temp_path)
        except:
            pass

        worker_restarted = False
        try:
            worker_restarted = job_queue.ensure_worker()
        except RuntimeError as exc:
            logger.error("Unable to verify job queue worker during /analyze: %s", exc)

        if worker_restarted:
            logger.warning("Job queue worker restarted before enqueueing analysis %s", analysis_id)

        queue_job_id = job_queue.enqueue(
            job_type="video_analysis",
            analysis_id=analysis_id,
            payload={"analysis_id": analysis_id},
        )

        playback_job_id = _schedule_transcode_job(analysis_id)
            
        return {
            "analysis_id": analysis_id,
            "status": "queued",
            "job_id": queue_job_id,
            "playback_job_id": playback_job_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reactions/{analysis_id}", status_code=202)
async def upload_reaction_video(
    analysis_id: str,
    file: UploadFile = File(...),
):
    """Upload a recorded viewer reaction and queue processing."""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    reaction_dir = getattr(storage, "reactions_dir", Path("video_analyses/reactions"))
    reaction_dir.mkdir(parents=True, exist_ok=True)

    reaction_id = f"reaction_{uuid.uuid4().hex[:12]}"
    suffix = Path(file.filename or "").suffix or ".webm"
    reaction_path = reaction_dir / f"{reaction_id}{suffix}"

    try:
        with open(reaction_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        REACTION_LOG.info(
            "reaction.upload.received",
            extra={
                "analysis_id": analysis_id,
                "reaction_filename": Path(reaction_path).name,
                "size_bytes": Path(reaction_path).stat().st_size,
            },
        )
    except Exception as exc:
        logger.error(f"Failed to store reaction recording: {exc}")
        raise HTTPException(status_code=500, detail="Failed to store reaction recording")

    job = storage.create_reaction_job(analysis_id, reaction_id, str(reaction_path))
    REACTION_LOG.info(
        "reaction.job.queued",
        extra={
            "analysis_id": analysis_id,
            "reaction_id": reaction_id,
            "video_path": reaction_path,
        },
    )

    worker_restarted = False
    try:
        worker_restarted = job_queue.ensure_worker()
    except RuntimeError as exc:
        logger.error("Unable to ensure job queue worker for reactions: %s", exc)

    if worker_restarted:
        REACTION_LOG.warning(
            "reaction.queue.worker_restarted",
            extra={"analysis_id": analysis_id, "reaction_id": reaction_id},
        )

    queue_job_id: Optional[str] = None
    worker_alive = job_queue.worker_running()
    logger.info("Reaction upload: worker_running=%s", worker_alive)
    
    if worker_alive:
        queue_job_id = job_queue.enqueue(
            job_type="reaction",
            analysis_id=analysis_id,
            payload={
                "reaction_id": reaction_id,
                "reaction_path": str(reaction_path),
            },
        )
        job = storage.update_reaction_job(
            reaction_id,
            queue_job_id=queue_job_id,
            processing_mode="queue",
        ) or job
        REACTION_LOG.info(
            "reaction.job.scheduled",
            extra={"analysis_id": analysis_id, "reaction_id": reaction_id, "queue_job_id": queue_job_id},
        )
        # region agent log
        _debug_log(
            "H2",
            "main.py:326",
            "reaction queued",
            data={"reaction_id": reaction_id, "queue_job_id": queue_job_id},
        )
        # endregion
    else:
        REACTION_LOG.warning(
            "reaction.queue.fallback",
            extra={"analysis_id": analysis_id, "reaction_id": reaction_id},
        )
        REACTION_LOG.error(
            "reaction.queue.health_unavailable",
            extra={"analysis_id": analysis_id, "reaction_id": reaction_id, "active_fallbacks": len(_fallback_reaction_tasks)},
        )
        # region agent log
        _debug_log(
            "H2",
            "main.py:335",
            "queue worker not running, using fallback",
            data={"reaction_id": reaction_id},
        )
        # endregion
        job = storage.update_reaction_job(
            reaction_id,
            status="processing_fallback",
            started_at=datetime.now().isoformat(),
            queue_job_id=None,
            processing_mode="fallback",
        ) or job
        fallback_task = asyncio.create_task(
            _run_reaction_job_async(
                analysis_id,
                reaction_id,
                str(reaction_path),
                processing_mode="fallback",
            )
        )
        _track_fallback_task(fallback_task)

    return {"reaction_id": reaction_id, "job": job, "queue_job_id": queue_job_id}

@app.get("/results/{analysis_id}", response_model=AnalysisResult)
async def get_results(analysis_id: str):
    """Get analysis results"""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    ai_effectiveness = None
    ai_outcome = (analysis.get("ai_breakdown") or {}).get("outcome")
    if isinstance(ai_outcome, dict):
        ai_effectiveness = ai_outcome.get("effectiveness_score")
    
    audience_engagement = analysis.get("audience_engagement", analysis.get("avg_engagement", 0.0))
    score_source = analysis.get("score_source")
    if not score_source:
        if audience_engagement and ai_effectiveness:
            score_source = "blended"
        elif audience_engagement:
            score_source = "audience_only"
        elif ai_effectiveness:
            score_source = "ai_only"
        
    return AnalysisResult(
        id=analysis["id"],
        video_name=analysis["video_name"],
        created_at=analysis["created_at"],
        avg_engagement=analysis.get("avg_engagement", 0.0),
        emotion_summary=analysis.get("emotion_summary", {}),
        emotion_timeline=analysis.get("emotion_timeline", []),
        clearcast_check=analysis.get("clearcast_check"),
        analyzed_frames=analysis.get("clearcast_check", {}).get("analyzed_frames") if analysis.get("clearcast_check") else None,
        ai_breakdown=analysis.get("ai_breakdown"),
        audience_engagement=audience_engagement,
        ai_effectiveness=ai_effectiveness,
        score_source=score_source,
        playback_ready=analysis.get("playback_ready"),
        playback_job_id=analysis.get("playback_job_id"),
    )

@app.get("/analysis/{analysis_id}/reactions")
async def list_reactions_for_analysis(analysis_id: str):
    """Return reaction jobs and completed summaries for an analysis."""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    jobs = storage.list_reaction_jobs(analysis_id)
    reactions = storage.get_reaction_summary_for_analysis(analysis_id)
    return {"jobs": jobs, "reactions": reactions}

@app.get("/reactions/{reaction_id}", response_model=ReactionDetail)
async def get_reaction_details(reaction_id: str):
    """Return reaction job status plus full analysis (if available)."""
    try:
        job = storage.get_reaction_job(reaction_id)
        if not job:
            raise HTTPException(status_code=404, detail="Reaction not found")
        # Ensure all required fields exist with defaults
        job.setdefault("processing_mode", "queue")
        job.setdefault("queue_job_id", None)
        job.setdefault("video_path", None)
        job.setdefault("started_at", None)
        job.setdefault("finished_at", None)
        job.setdefault("error", None)
        
        # Validate job structure matches ReactionJob model
        try:
            validated_job = ReactionJob.model_validate(job)
        except Exception as validation_error:
            logger.error(
                "Reaction job validation failed for %s: %s. Job data: %s",
                reaction_id,
                validation_error,
                job,
                exc_info=True
            )
            raise HTTPException(
                status_code=500,
                detail=f"Invalid reaction job data: {str(validation_error)}"
            )
        
        reaction = storage.get_reaction(reaction_id)
        return {"job": validated_job.model_dump(), "reaction": reaction}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Failed to get reaction details for %s: %s",
            reaction_id,
            exc,
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while fetching reaction: {str(exc)}"
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch reaction detail for %s", reaction_id)
        raise HTTPException(status_code=500, detail="Failed to fetch reaction detail") from exc


@app.get("/queue/jobs", response_model=List[QueueJobModel])
async def list_queue_jobs(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    analysis_id: Optional[str] = None,
):
    """List queue jobs with optional filters."""
    jobs = job_queue.list_jobs(
        analysis_id=analysis_id,
        job_type=job_type,
        status=status,
    )
    return jobs


@app.get("/queue/jobs/{job_id}", response_model=QueueJobModel)
async def get_queue_job(job_id: str):
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/queue/jobs/{job_id}/retry", response_model=QueueJobModel)
async def retry_queue_job(job_id: str):
    job = await job_queue.retry_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/queue/worker/health", response_model=WorkerHealth)
async def get_queue_worker_health():
    return WorkerHealth.model_validate(job_queue.worker_health())

@app.post("/admin/reload-database")
async def reload_database():
    """Force reload database from disk (useful after external scripts modify it)"""
    try:
        storage.reload_database()
        logger.info("Database manually reloaded")
        return {"status": "success", "message": "Database reloaded"}
    except Exception as e:
        logger.error(f"Failed to reload database: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/clearcast/update-rules")
async def update_clearcast_rules(
    rules_file: Optional[UploadFile] = File(None),
    notes: Optional[str] = None,
):
    """
    Update Clearcast prediction rules from uploaded file.

    Upload a JSON or text file containing updated Clearcast guidance rules.
    Rules are versioned and can be rolled back.

    Args:
        rules_file: JSON or text file with rules
        notes: Optional notes about this update
    """
    try:
        from app.features.clearcast.clearcast_rules_updater import get_rules_updater

        updater = get_rules_updater()

        if not rules_file:
            raise HTTPException(status_code=400, detail="No rules file provided")

        # Read file content
        content = await rules_file.read()
        content_str = content.decode("utf-8")

        # Determine if JSON or text
        rules_data: dict
        try:
            rules_data = json.loads(content_str)
        except json.JSONDecodeError:
            rules_data = {"content": content_str, "format": "text"}

        # Update rules
        version = updater.update_rules(
            rules_data=rules_data,
            source=f"upload:{rules_file.filename}",
            notes=notes or f"Uploaded {rules_file.filename}",
        )

        logger.info(f"Clearcast rules updated to version {version.version_id}")

        return {
            "status": "success",
            "version_id": version.version_id,
            "created_at": version.created_at,
            "message": f"Rules updated successfully to version {version.version_id}",
        }

    except Exception as e:
        logger.error(f"Failed to update Clearcast rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/clearcast/rules")
async def get_clearcast_rules_info():
    """
    Get information about current Clearcast rules.

    Returns version history and current rules summary.
    """
    try:
        from app.features.clearcast.clearcast_rules_updater import get_rules_updater

        updater = get_rules_updater()

        return {
            "summary": updater.get_rules_summary(),
            "versions": updater.list_versions(),
        }

    except Exception as e:
        logger.error(f"Failed to get Clearcast rules info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/clearcast/rollback-rules")
async def rollback_clearcast_rules(version_id: str):
    """
    Rollback to a previous rules version.

    Args:
        version_id: The version ID to rollback to
    """
    try:
        from app.features.clearcast.clearcast_rules_updater import get_rules_updater

        updater = get_rules_updater()
        version = updater.rollback(version_id)

        if not version:
            raise HTTPException(status_code=404, detail=f"Version {version_id} not found")

        logger.info(f"Clearcast rules rolled back to version {version_id}")

        return {
            "status": "success",
            "version_id": version.version_id,
            "created_at": version.created_at,
            "message": f"Rolled back to version {version_id}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rollback Clearcast rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/clearcast/check")
async def run_clearcast_check(request: ClearcastRequest):
    """Run comprehensive Clearcast compliance check using full desktop workflow"""
    try:
        analysis = storage.get_analysis(request.analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Prefer playback copy for frame extraction (much faster for large MOV/ProRes files)
        playback_path = analysis.get("playback_video_path")
        playback_ready = analysis.get("playback_ready") is True
        
        if playback_ready and playback_path and Path(playback_path).exists():
            video_path = playback_path
            logger.info(f"Using playback copy for Clearcast check: {video_path}")
        else:
            original_path = storage.get_video_path(request.analysis_id)
            
            # Check if this is a large/problematic format that needs playback copy
            if original_path:
                original_ext = Path(original_path).suffix.lower()
                original_size = Path(original_path).stat().st_size if Path(original_path).exists() else 0
                is_large_file = original_size > 50 * 1024 * 1024  # > 50MB
                is_problematic_format = original_ext in ['.mov', '.mxf', '.avi', '.prores']
                
                if (is_large_file or is_problematic_format) and not playback_ready:
                    # Trigger transcode if not already running
                    _schedule_transcode_job(request.analysis_id)
                    
                    logger.warning(
                        f"Large/ProRes file detected ({original_ext}, {original_size // (1024*1024)}MB) "
                        f"but playback copy not ready. Analysis may be slow or incomplete."
                    )
            
            video_path = original_path
            logger.info(f"Using original video for Clearcast check: {video_path} (playback_ready={playback_ready})")
        
        if not video_path or not Path(video_path).exists():
            raise HTTPException(status_code=404, detail="Video file not found")
        
        delivery_metadata = None
        if request.clock_number:
            delivery_metadata = {"clock_number": request.clock_number}
        
        logger.info(f"Running full Clearcast check for {request.analysis_id} (mode={request.mode})")
        results = clearcast_checker.check_video_compliance(
            video_path=video_path,
            script_excerpt=analysis.get("transcript"),
            delivery_metadata=delivery_metadata,
            mode=request.mode
        )

        storage.save_clearcast_check(request.analysis_id, results)
        return results

    except Exception as e:
        logger.error(f"Clearcast check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/clearcast/pure-check")
async def run_pure_clearcast_check(request: PureClearcastRequest):
    """
    Run strict Clearcast clearance check (DPP AS-11 style).

    This endpoint performs FULL technical validation with NO auto-downgrade.
    All checks are at maximum strictness. Clock number is REQUIRED.

    Use this for broadcast master file validation before final delivery.
    """
    try:
        analysis = storage.get_analysis(request.analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        # Get video path (prefer original for pure check - need full quality)
        video_path = storage.get_video_path(request.analysis_id)

        # Also check playback path as fallback
        if not video_path or not Path(video_path).exists():
            playback_path = analysis.get("playback_video_path")
            if playback_path and Path(playback_path).exists():
                video_path = playback_path
                logger.warning(f"Using playback copy for pure check (original unavailable)")

        if not video_path or not Path(video_path).exists():
            raise HTTPException(status_code=404, detail="Video file not found")

        # Build delivery metadata with required clock number
        delivery_metadata = {
            "clock_number": request.clock_number,
        }
        if request.agency_code:
            delivery_metadata["agency_code"] = request.agency_code
        if request.client_name:
            delivery_metadata["client_name"] = request.client_name
        if request.product_name:
            delivery_metadata["product_name"] = request.product_name

        logger.info(f"Running PURE Clearcast check for {request.analysis_id} (clock: {request.clock_number})")
        results = clearcast_checker.check_video_compliance(
            video_path=video_path,
            script_excerpt=analysis.get("transcript"),
            delivery_metadata=delivery_metadata,
            mode="pure"  # Force strict mode
        )

        # Add pure mode metadata
        results["pure_mode"] = True
        results["clock_number_validated"] = request.clock_number

        storage.save_clearcast_check(request.analysis_id, results)
        return results

    except Exception as e:
        logger.error(f"Pure Clearcast check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/clearcast/quick-check")
async def run_quick_compliance_check(
    file: UploadFile = File(...),
    clock_number: str = Form(...),
    agency_code: Optional[str] = Form(None)
):
    """
    One-shot compliance check for temporary video analysis.

    This endpoint:
    - Accepts a video file upload
    - Runs full DPP AS-11 style compliance check
    - Returns results
    - Does NOT store the video permanently

    Use this for quick validation before upload or when you just need
    a compliance check without creating a project.
    """
    import tempfile
    import os

    temp_path = None
    try:
        # Save to temp file
        suffix = Path(file.filename).suffix if file.filename else ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name

        logger.info(f"Running quick compliance check: {file.filename} (clock: {clock_number})")

        # Build delivery metadata
        delivery_metadata = {
            "clock_number": clock_number,
        }
        if agency_code:
            delivery_metadata["agency_code"] = agency_code

        # Run strict compliance check (pure mode)
        results = clearcast_checker.check_video_compliance(
            video_path=temp_path,
            script_excerpt=None,  # No transcript for quick check
            delivery_metadata=delivery_metadata,
            mode="pure"  # Strict mode for compliance
        )

        # Determine if passed (no red flags)
        red_flags = results.get("red_flags", [])
        yellow_flags = results.get("yellow_flags", [])
        blue_flags = results.get("blue_flags", [])

        passed = len(red_flags) == 0

        # Build summary
        if passed:
            if len(yellow_flags) > 0:
                summary = f"Passed with {len(yellow_flags)} warning(s). Ready for broadcast with minor considerations."
            else:
                summary = "Full compliance achieved. Video meets all DPP AS-11 requirements."
        else:
            summary = f"Found {len(red_flags)} critical issue(s) that must be resolved before broadcast."

        return {
            "passed": passed,
            "red_flags": red_flags,
            "yellow_flags": yellow_flags,
            "blue_flags": blue_flags,
            "summary": summary,
            "clock_number": clock_number,
            "filename": file.filename
        }

    except Exception as e:
        logger.error(f"Quick compliance check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Always clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                logger.debug(f"Cleaned up temp file: {temp_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up temp file {temp_path}: {cleanup_error}")


@app.post("/analyze/breakdown")
async def run_ai_breakdown(request: BreakdownRequest):
    """Run comprehensive AI video breakdown using full desktop workflow"""
    try:
        analysis = storage.get_analysis(request.analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Prefer playback copy for frame extraction (much faster for large MOV/ProRes files)
        playback_path = analysis.get("playback_video_path")
        playback_ready = analysis.get("playback_ready") is True
        
        if playback_ready and playback_path and Path(playback_path).exists():
            video_path = playback_path
            logger.info(f"Using playback copy for AI breakdown: {video_path}")
        else:
            original_path = storage.get_video_path(request.analysis_id)
            
            # Check if this is a large/problematic format that needs playback copy
            if original_path:
                original_ext = Path(original_path).suffix.lower()
                original_size = Path(original_path).stat().st_size if Path(original_path).exists() else 0
                is_large_file = original_size > 50 * 1024 * 1024  # > 50MB
                is_problematic_format = original_ext in ['.mov', '.mxf', '.avi', '.prores']
                
                if (is_large_file or is_problematic_format) and not playback_ready:
                    # Trigger transcode if not already running
                    _schedule_transcode_job(request.analysis_id)
                    
                    logger.warning(
                        f"Large/ProRes file detected ({original_ext}, {original_size // (1024*1024)}MB) "
                        f"but playback copy not ready. Analysis may be slow or incomplete."
                    )
            
            video_path = original_path
            logger.info(f"Using original video for AI breakdown: {video_path} (playback_ready={playback_ready})")
        
        if not video_path or not Path(video_path).exists():
            raise HTTPException(status_code=404, detail="Video file not found")
        
        if request.audience_country:
            storage.set_ai_airing_country(request.analysis_id, request.audience_country)
        
        # Extract transcript text from the transcription structure
        # VideoAnalysisStorage stores ASR results in analysis["transcription"]["full_text"]
        script_text = None
        transcription = analysis.get("transcription")
        if isinstance(transcription, dict):
            script_text = transcription.get("full_text")
            # Fallback: build from segments if full_text is missing
            if not script_text:
                segments = transcription.get("segments", [])
                if segments:
                    script_text = " ".join(
                        seg.get("text", "") for seg in segments if seg.get("text")
                    ).strip() or None
        
        # Extract any existing supers/OCR text from previous analysis or transcription
        # This avoids redundant OCR processing if we already have the data
        supers_texts = None
        if isinstance(transcription, dict):
            supers_texts = transcription.get("supers", [])
        # Also check if there's OCR data from a previous breakdown
        existing_breakdown = analysis.get("ai_breakdown", {})
        if not supers_texts and isinstance(existing_breakdown, dict):
            debug_data = existing_breakdown.get("debug", {})
            if isinstance(debug_data, dict):
                supers_texts = debug_data.get("ocr_supers", [])
        
        # Log transcript availability for debugging
        if not script_text:
            logger.warning(f"Transcript not ready for {request.analysis_id}, AI breakdown may be less accurate")
        
        logger.info(f"Running full AI breakdown for {request.analysis_id} (transcript available: {bool(script_text)}, supers available: {bool(supers_texts)})")
        results = await ai_breakdown.analyze_video(
            video_path=video_path,
            detail_level=request.detail_level or "full",
            script_text=script_text,
            supers_texts=supers_texts,
            audience_country=request.audience_country
        )
        
        storage.save_ai_breakdown(request.analysis_id, results)
        return results
        
    except Exception as e:
        logger.error(f"AI breakdown failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/similar-ads")
async def find_similar_ads(request: SimilarAdsRequest):
    """Find similar TV ads using RAG based on AI breakdown data, with benchmarks"""
    try:
        analysis = storage.get_analysis(request.analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Verify AI breakdown exists
        ai_breakdown_data = analysis.get("ai_breakdown")
        if not ai_breakdown_data:
            raise HTTPException(
                status_code=400, 
                detail="AI breakdown must be completed first. Run AI Video Breakdown before searching for similar ads."
            )
        
        # Build search query from AI breakdown data
        query_parts = []
        
        # Add one-sentence summary (most important)
        if ai_breakdown_data.get("one_sentence_summary"):
            query_parts.append(ai_breakdown_data["one_sentence_summary"])
        
        # Add target audience
        if ai_breakdown_data.get("target_audience"):
            query_parts.append(f"Target audience: {ai_breakdown_data['target_audience']}")
        
        # Add key elements
        if ai_breakdown_data.get("key_elements"):
            elements = ai_breakdown_data["key_elements"]
            if isinstance(elements, list):
                query_parts.append(f"Key elements: {', '.join(elements[:5])}")
        
        # Add key messages
        if ai_breakdown_data.get("key_messages"):
            messages = ai_breakdown_data["key_messages"]
            if isinstance(messages, list):
                query_parts.append(f"Key messages: {', '.join(messages[:3])}")
        
        # Add product/brand info from breakdown details
        breakdown_details = ai_breakdown_data.get("breakdown", {})
        if breakdown_details.get("what_is_advertised"):
            query_parts.append(f"Product: {breakdown_details['what_is_advertised']}")
        if breakdown_details.get("brand_name"):
            query_parts.append(f"Brand: {breakdown_details['brand_name']}")
        
        # Get category for benchmarking
        category = breakdown_details.get("product_category", "General")
        if category:
            query_parts.append(f"Category: {category}")
        
        if not query_parts:
            raise HTTPException(
                status_code=400,
                detail="AI breakdown does not contain enough information for similarity search"
            )
        
        query = " ".join(query_parts)
        logger.info(f"Searching for similar ads with query: {query[:200]}...")
        
        # Get RAG client and search
        from app.features.ad_script_lab.rag_client import get_rag_client
        rag_client = get_rag_client()
        
        # Run async retrieval
        neighbors = await rag_client.retrieve(
            query=query,
            limit=request.limit,
            min_similarity=0.3
        )
        
        # Convert to response format
        similar_ads = [
            SimilarAd(
                id=n.id,
                title=n.title,
                brand=n.brand,
                category=n.category,
                year=n.year,
                description=n.description,
                script_excerpt=n.script_excerpt,
                video_url=n.video_url,
                effectiveness_score=n.effectiveness_score,
                awards=n.awards,
                similarity_score=n.similarity_score,
                tags=n.tags
            )
            for n in neighbors
        ]
        
        # Calculate benchmarks if we have impact_scores in the breakdown
        benchmarks_data = None
        creative_profile_data = None
        
        # Extract impact_scores from AI breakdown (new enhanced format)
        impact_scores = ai_breakdown_data.get("impact_scores", {})
        if impact_scores and isinstance(impact_scores, dict):
            # Remove the 'reasoning' sub-object if present, keep only numeric scores
            ad_scores = {
                k: v for k, v in impact_scores.items() 
                if isinstance(v, (int, float))
            }
            
            if ad_scores:
                try:
                    from app.features.ad_script_lab.benchmark_service import get_benchmark_service
                    benchmark_service = get_benchmark_service()
                    benchmark_result = await benchmark_service.calculate_benchmarks(ad_scores, category)
                    
                    # Convert to response model
                    benchmarks_data = BenchmarkData(
                        category=benchmark_result.category,
                        sample_size=benchmark_result.sample_size,
                        metrics={
                            k: MetricBenchmark(
                                value=v.value,
                                percentile=v.percentile,
                                category_avg=v.category_avg,
                                category_min=v.category_min,
                                category_max=v.category_max,
                                sample_size=v.sample_size
                            )
                            for k, v in benchmark_result.metrics.items()
                        },
                        insights=benchmark_result.insights,
                        strengths=benchmark_result.strengths,
                        improvements=benchmark_result.improvements
                    )
                    logger.info(f"Calculated benchmarks for category: {category}")
                except Exception as bench_error:
                    logger.warning(f"Failed to calculate benchmarks: {bench_error}")
        
        # Extract creative_profile if present
        creative_profile = ai_breakdown_data.get("creative_profile")
        if creative_profile and isinstance(creative_profile, dict):
            creative_profile_data = creative_profile
        
        logger.info(f"Found {len(similar_ads)} similar ads for analysis {request.analysis_id}")
        
        return SimilarAdsWithBenchmarks(
            similar_ads=similar_ads,
            benchmarks=benchmarks_data,
            creative_profile=creative_profile_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similar ads search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/persona")
async def chat_with_persona(request: ChatRequest):
    """Chat with a simulated persona about the ad using GPT-5 (GPT-5.1 Persona Engine)."""
    try:
        from app.features.ai_breakdown.ai_video_breakdown import AIVideoBreakdown
        from app.core.config import get_openai_api_key
        
        # Extract persona and ad context
        persona = request.context.get("persona", {})
        ad_elements = request.context.get("ad_elements", {})
        chat_history = request.context.get("chat_history", [])
        
        if not persona:
            raise HTTPException(status_code=400, detail="Persona data required in context")
        
        # Check for OpenAI API key (use getter for fresh env check)
        api_key = get_openai_api_key()
        if not api_key or api_key.strip() == '':
            raise HTTPException(
                status_code=503, 
                detail="AI service unavailable. Please configure OPENAI_API_KEY in your .env file."
            )
        
        # Create analyzer and generate response
        analyzer = AIVideoBreakdown()
        
        reply = await analyzer.chat_with_persona(
            persona=persona,
            ad_elements=ad_elements,
            chat_history=chat_history,
            user_message=request.message
        )
        
        return {"reply": reply}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Persona chat failed: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# =====================================================
# Ad Q&A with GPT-5.1 and RAG
# =====================================================

class AdQARequest(BaseModel):
    """Request model for ad Q&A."""
    question: str
    mode: str = "general"  # general, compare, improve, brainstorm
    include_similar_ads: bool = True
    max_similar_ads: int = 3


class AdQAResponse(BaseModel):
    """Response model for ad Q&A."""
    answer: str
    sources: List[Dict[str, Any]] = []
    suggestions: List[str] = []
    similar_ads_referenced: List[Dict[str, Any]] = []
    confidence: float = 0.8


@app.post("/analyze/{analysis_id}/qa", response_model=AdQAResponse, tags=["Ad Q&A"])
async def ask_about_ad(analysis_id: str, request: AdQARequest):
    """
    Ask questions about an ad using GPT-5.1 with RAG context.
    
    Modes:
    - general: General questions about the ad
    - compare: Compare to similar ads in database
    - improve: Get improvement suggestions
    - brainstorm: Creative brainstorming and ideas
    
    The response includes:
    - AI-generated answer with context from the ad analysis
    - References to similar ads used for comparison
    - Suggested follow-up questions
    """
    try:
        from app.features.ad_qa.ad_qa_service import get_qa_service, QARequest
        
        # Get analysis data
        analysis = storage.get_analysis(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        ai_breakdown = analysis.get("ai_breakdown")
        if not ai_breakdown:
            raise HTTPException(
                status_code=400, 
                detail="AI breakdown not available. Run AI analysis first."
            )
        
        # Get Q&A service and process request
        qa_service = get_qa_service()
        qa_request = QARequest(
            question=request.question,
            mode=request.mode,
            include_similar_ads=request.include_similar_ads,
            max_similar_ads=request.max_similar_ads,
        )
        
        response = await qa_service.ask(ai_breakdown, qa_request)
        
        return AdQAResponse(
            answer=response.answer,
            sources=response.sources,
            suggestions=response.suggestions,
            similar_ads_referenced=response.similar_ads_referenced,
            confidence=response.confidence,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ad Q&A failed: {e}")
        raise HTTPException(status_code=500, detail=f"Q&A failed: {str(e)}")


@app.get("/analyze/{analysis_id}/qa/suggestions", tags=["Ad Q&A"])
async def get_qa_suggestions(analysis_id: str, mode: str = "general"):
    """
    Get suggested questions for a given mode.
    
    Modes:
    - general: General questions about the ad
    - compare: Questions for comparing to similar ads
    - improve: Questions about improvements
    - brainstorm: Creative brainstorming questions
    """
    try:
        from app.features.ad_qa.ad_qa_service import get_qa_service
        
        # Verify analysis exists
        analysis = storage.get_analysis(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        qa_service = get_qa_service()
        suggestions = qa_service.get_suggested_questions(mode)
        
        return {"mode": mode, "suggestions": suggestions}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get Q&A suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/videos/{analysis_id}")
async def stream_video(analysis_id: str):
    """Stream video file for playback"""
    logger.info(f"[VIDEO_STREAM] Request for analysis_id={analysis_id}")
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        logger.warning(f"[VIDEO_STREAM] Analysis not found: {analysis_id}")
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    primary_path = Path(analysis["video_path"])
    playback_value = analysis.get("playback_video_path")
    playback_path = Path(playback_value) if playback_value else None
    
    # Check playback readiness: explicitly handle None as False
    playback_ready_flag = analysis.get("playback_ready")
    playback_ready = playback_ready_flag is True and playback_path and playback_path.exists()
    
    logger.info(
        f"[VIDEO_STREAM] analysis_id={analysis_id} "
        f"playback_ready_flag={playback_ready_flag} "
        f"playback_path={playback_path} "
        f"playback_path_exists={playback_path.exists() if playback_path else False} "
        f"playback_ready={playback_ready}"
    )

    if playback_ready and playback_path:
        serving_path = playback_path
        media_type = "video/mp4"
        logger.info(f"[VIDEO_STREAM] Serving playback copy: {serving_path} ({serving_path.stat().st_size} bytes)")
    else:
        # If playback_ready is None or False, we need to transcode
        if playback_ready_flag is not True:
            logger.info(f"[VIDEO_STREAM] Playback not ready, scheduling transcode job for {analysis_id}")
            _schedule_transcode_job(analysis_id)
            raise HTTPException(
                status_code=202,
                detail="Video is being optimized for playback. Please retry shortly.",
            )
        # Fallback: serve original file (shouldn't happen if logic is correct)
        serving_path = primary_path
        media_type = _media_type_for_path(serving_path)
        logger.warning(
            f"[VIDEO_STREAM] Falling back to original file: {serving_path} "
            f"({serving_path.stat().st_size} bytes, media_type={media_type})"
        )

    if not serving_path.exists():
        logger.error(f"[VIDEO_STREAM] File not found: {serving_path}")
        raise HTTPException(status_code=404, detail="Video file not found")
    
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    logger.info(f"[VIDEO_STREAM] Returning FileResponse: {serving_path} with media_type={media_type}")
    return FileResponse(serving_path, media_type=media_type, headers=headers)


@app.head("/videos/{analysis_id}")
async def head_video(analysis_id: str):
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    primary_path = Path(analysis["video_path"])
    playback_value = analysis.get("playback_video_path")
    playback_path = Path(playback_value) if playback_value else None
    
    # Check playback readiness: explicitly handle None as False
    playback_ready_flag = analysis.get("playback_ready")
    playback_ready = playback_ready_flag is True and playback_path and playback_path.exists()

    if playback_ready:
        headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Content-Type": "video/mp4",
        }
        return Response(status_code=200, headers=headers)

    # If playback_ready is None or False, we need to transcode
    if playback_ready_flag is not True:
        _schedule_transcode_job(analysis_id)
        raise HTTPException(status_code=202, detail="Video is being optimized for playback.")

    if not primary_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Type": _media_type_for_path(primary_path),
    }
    return Response(status_code=200, headers=headers)

@app.put("/analysis/{analysis_id}/country")
async def update_airing_country(analysis_id: str, request: CountryUpdateRequest):
    """Update airing country preference for analysis"""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    success = storage.set_ai_airing_country(analysis_id, request.country)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update country")
    
    return {"status": "success", "country": request.country}

@app.get("/pdf/breakdown/{analysis_id}")
async def download_ai_breakdown_pdf(analysis_id: str):
    """Generate and download AI breakdown PDF"""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    ai_breakdown_data = analysis.get("ai_breakdown")
    if not ai_breakdown_data:
        raise HTTPException(status_code=404, detail="AI breakdown not available")
    
    try:
        from app.features.reporting.pdf_generator import AIBreakdownPDFGenerator
        
        pdf_gen = AIBreakdownPDFGenerator()
        pdf_dir = Path("temp_pdfs")
        pdf_dir.mkdir(exist_ok=True)
        pdf_path = pdf_dir / f"ai_breakdown_{analysis_id}.pdf"
        
        success = pdf_gen.generate_pdf(
            results=ai_breakdown_data,
            video_name=analysis["video_name"],
            video_duration=analysis.get("video_duration", 0.0),
            thumbnail_base64=analysis.get("thumbnail"),
            output_path=str(pdf_path)
        )
        
        if not success or not pdf_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate PDF")
        
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"ai_breakdown_{analysis['video_name']}.pdf"
        )
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pdf/clearcast/{analysis_id}")
async def download_clearcast_pdf(analysis_id: str):
    """Generate and download Clearcast compliance PDF"""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    clearcast_data = analysis.get("clearcast_check")
    if not clearcast_data:
        raise HTTPException(status_code=404, detail="Clearcast check not available")
    
    try:
        from app.features.reporting.pdf_generator import ClearcastPDFGenerator
        
        pdf_gen = ClearcastPDFGenerator()
        pdf_dir = Path("temp_pdfs")
        pdf_dir.mkdir(exist_ok=True)
        pdf_path = pdf_dir / f"clearcast_{analysis_id}.pdf"
        
        success = pdf_gen.generate_pdf(
            results=clearcast_data,
            video_name=analysis["video_name"],
            video_duration=analysis.get("video_duration", 0.0),
            thumbnail_base64=analysis.get("thumbnail"),
            output_path=str(pdf_path)
        )
        
        if not success or not pdf_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate PDF")
        
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"clearcast_{analysis['video_name']}.pdf"
        )
    except Exception as e:
        logger.error(f"Clearcast PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clearcast/polish")
async def polish_video(request: PolishRequest):
    """Process video to make it Clearcast-ready (technical fixes)"""
    analysis = storage.get_analysis(request.analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    video_path = storage.get_video_path(request.analysis_id)
    if not video_path or not Path(video_path).exists():
        raise HTTPException(status_code=404, detail="Video file not found")
        
    try:
        logger.info(f"Starting video polish for {request.analysis_id}")

        output_dir = Path(storage.storage_dir) / "processed"
        output_dir.mkdir(parents=True, exist_ok=True)
        source_suffix = Path(video_path).suffix or ".mp4"
        output_filename = f"{request.analysis_id}_polished{source_suffix}"
        output_path = output_dir / output_filename

        actions, slate_info, quality, standard, export_bright = _normalize_polish_payload(request)
        processing_options = dict(actions)
        processing_options["quality"] = quality
        processing_options["standard"] = standard
        processing_options["export_bright"] = export_bright
        if slate_info:
            processing_options["slate_info"] = slate_info

        results = video_processor.process_video(
            input_path=video_path,
            output_path=str(output_path),
            options=processing_options
        )

        if not results.get("success"):
            raise Exception(results.get("error", "Unknown error during processing"))

        delivery_metadata = _build_delivery_metadata(actions, slate_info, analysis.get("video_duration"))
        results_payload = dict(results)
        results_payload.update(
            {
                "output_path": str(output_path),
                "delivery_metadata": delivery_metadata,
                "quality": quality,
                "standard": standard,
                "export_bright": export_bright,
            }
        )
        storage.save_video_processing(request.analysis_id, results_payload)

        return {
            "status": "success", 
            "message": "Video polished successfully",
            "fixes_applied": results.get("fixes_applied", []),
            "download_url": f"/videos/polished/{request.analysis_id}"  # We need to add this endpoint
        }
        
    except Exception as e:
        logger.error(f"Video polish failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/videos/polished/{analysis_id}")
async def download_polished_video_by_id(analysis_id: str):
    """Download polished video for an analysis"""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    processing = analysis.get("video_processing") or {}
    output_path = processing.get("output_path")
    if not output_path:
        raise HTTPException(status_code=404, detail="Polished video not found. Please run polish first.")

    output_path = Path(output_path)
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Polished video not found. Please run polish first.")

    return FileResponse(
        output_path,
        media_type=_media_type_for_path(output_path),
        filename=output_path.name
    )

@app.delete("/projects/{analysis_id}")
async def delete_project(analysis_id: str):
    """Delete a project and all its associated data"""
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        storage.delete_analysis(analysis_id)
        logger.info(f"Deleted project {analysis_id}")
        return {"status": "success", "message": "Project deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def process_reaction_video(analysis_id: str, reaction_id: str, reaction_path: str, processing_mode: str = "queue"):
    """Background task to analyze a stored reaction recording."""
    start_time = datetime.now()
    # region agent log
    _debug_log(
        "H3",
        "main.py:683",
        "process_reaction_video start",
        data={"analysis_id": analysis_id, "reaction_id": reaction_id, "video_path": reaction_path},
    )
    # endregion
    storage.update_reaction_job(
        reaction_id,
        status="processing_fallback" if processing_mode == "fallback" else "processing",
        started_at=start_time.isoformat(),
        error=None,
        processing_mode=processing_mode,
    )
    job_status = "failed"
    error_msg: Optional[str] = None
    try:
        REACTION_LOG.info(
            "reaction.job.started",
            extra={
                "analysis_id": analysis_id,
                "reaction_id": reaction_id,
                "video_path": reaction_path,
                "processing_mode": processing_mode,
            }
        )

        def _run_analysis():
            return reaction_processor.analyze(reaction_path)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_run_analysis)
            try:
                reaction_results = future.result(timeout=REACTION_PROCESSING_TIMEOUT_SECONDS)
            except concurrent.futures.TimeoutError:
                future.cancel()
                raise TimeoutError(
                    f"Reaction processing exceeded {REACTION_PROCESSING_TIMEOUT_SECONDS} seconds"
                )

        reaction_results["video_path"] = reaction_path

        saved = storage.save_reaction(
            analysis_id=analysis_id,
            reaction_data=reaction_results,
            reaction_id=reaction_id
        )

        if saved:
            job_status = "completed"
            REACTION_LOG.info(
                "reaction.job.completed",
                extra={
                    "analysis_id": analysis_id,
                    "reaction_id": reaction_id,
                    "timeline_points": len(reaction_results.get("emotion_timeline", [])),
                    "engagement": reaction_results.get("engagement_score"),
                    "processing_mode": processing_mode,
                }
            )
        else:
            error_msg = "Failed to persist reaction data"
            REACTION_LOG.error(
                "reaction.job.persist_failed",
                extra={"analysis_id": analysis_id, "reaction_id": reaction_id, "processing_mode": processing_mode},
            )
    except Exception as exc:
        error_msg = str(exc)
        event = "reaction.job.failed"
        if isinstance(exc, TimeoutError):
            event = "reaction.job.timeout"
        REACTION_LOG.error(
            event,
            extra={"analysis_id": analysis_id, "reaction_id": reaction_id, "processing_mode": processing_mode},
            exc_info=not isinstance(exc, TimeoutError),
        )
    finally:
        finished_at = datetime.now()
        storage.update_reaction_job(
            reaction_id,
            status=job_status,
            finished_at=finished_at.isoformat(),
            error=error_msg,
            processing_mode=processing_mode,
        )
        duration = (finished_at - start_time).total_seconds()
        REACTION_LOG.info(
            "reaction.job.finished",
            extra={
                "analysis_id": analysis_id,
                "reaction_id": reaction_id,
                "status": job_status,
                "seconds": duration,
                "processing_mode": processing_mode,
            },
        )
        # region agent log
        _debug_log(
            "H3",
            "main.py:709",
            "process_reaction_video finished",
            data={"analysis_id": analysis_id, "reaction_id": reaction_id, "status": job_status, "error": error_msg},
        )
        # endregion


async def _handle_video_analysis_job(job_context: Dict[str, Any]) -> None:
    analysis_id = job_context.get("analysis_id")
    if not analysis_id:
        raise RuntimeError("Missing analysis_id in job payload")
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise RuntimeError(f"Analysis {analysis_id} not found")
    video_path = analysis.get("video_path")
    if not video_path or not Path(video_path).exists():
        raise FileNotFoundError(f"Video for analysis {analysis_id} not found")
    await asyncio.to_thread(storage._transcribe_video, analysis_id, video_path)


async def _handle_reaction_job(job_context: Dict[str, Any]) -> None:
    payload = job_context.get("payload") or {}
    reaction_id = payload.get("reaction_id")
    reaction_path = payload.get("reaction_path")
    analysis_id = job_context.get("analysis_id")
    if not reaction_id or not reaction_path or not analysis_id:
        raise RuntimeError("Invalid reaction job payload")
    await _run_reaction_job_async(analysis_id, reaction_id, reaction_path)


async def _handle_video_transcode_job(job_context: Dict[str, Any]) -> None:
    analysis_id = job_context.get("analysis_id")
    if not analysis_id:
        raise RuntimeError("Missing analysis_id for transcode job")
    await asyncio.to_thread(storage.generate_playback_copy, analysis_id)


def _schedule_transcode_job(analysis_id: str) -> Optional[str]:
    analysis = storage.get_analysis(analysis_id)
    if not analysis or analysis.get("playback_ready"):
        return None

    job_id = analysis.get("playback_job_id")
    if job_id:
        job = job_queue.get_job(job_id)
        if job and job.get("status") in {"queued", "processing"}:
            return job_id

    job_queue.ensure_worker()
    new_job_id = job_queue.enqueue(
        job_type="video_transcode",
        analysis_id=analysis_id,
        payload={},
        max_retries=2,
    )
    storage.set_playback_job_id(analysis_id, new_job_id)
    return new_job_id


job_queue.register_handler("video_analysis", _handle_video_analysis_job)
job_queue.register_handler("reaction", _handle_reaction_job)
job_queue.register_handler("video_transcode", _handle_video_transcode_job)


# =============================================================================
# Ad Script Lab Endpoints
# =============================================================================

from app.features.ad_script_lab.types import (
    AdScriptGenerateRequest,
    AdScriptRunResponse,
)
from app.features.ad_script_lab.orchestrator import get_orchestrator, run_ad_script_protocol

from app.features.storyboards.router import router as storyboard_router

# Ad Script Lab now uses persistent storage for runs (v2)
AD_SCRIPT_LOG = logging.getLogger("app.ad_script_lab")

app.include_router(storyboard_router)



@app.post("/ad-script/generate", response_model=AdScriptRunResponse, tags=["Ad Script Lab"])
async def generate_ad_script(request: AdScriptGenerateRequest):
    """
    Start a new ad script generation run.
    
    This initiates the multi-agent protocol to generate TV ad scripts
    based on the provided brief. If a website_url is provided, brand
    discovery will be run first to extract brand context.
    """
    AD_SCRIPT_LOG.info(
        "Starting ad script generation for asset: %s (website_url: %s)",
        request.asset_name,
        request.website_url or "none"
    )
    
    try:
        # Use the helper function that includes brand discovery
        run = await run_ad_script_protocol(request)
        
        return AdScriptRunResponse.from_run(run)
        
    except Exception as e:
        AD_SCRIPT_LOG.exception("Ad script generation failed: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Ad script generation failed: {str(e)}"
        )


@app.get("/ad-script/runs/{run_id}", response_model=AdScriptRunResponse, tags=["Ad Script Lab"])
async def get_ad_script_run(run_id: str):
    """
    Get the status and results of an ad script generation run.
    """
    orchestrator = get_orchestrator()
    run = orchestrator.get_run(run_id)
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return AdScriptRunResponse.from_run(run)


@app.delete("/ad-script/runs/{run_id}", tags=["Ad Script Lab"])
async def delete_ad_script_run(run_id: str):
    """
    Delete an ad script generation run.
    """
    try:
        orchestrator = get_orchestrator()
        success = orchestrator.delete_run(run_id)
        
        if not success:
            AD_SCRIPT_LOG.warning("Attempted to delete non-existent run: %s", run_id)
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
        
        AD_SCRIPT_LOG.info("Successfully deleted run: %s", run_id)
        return {"status": "success", "message": f"Run {run_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        AD_SCRIPT_LOG.exception("Error deleting run %s: %s", run_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete run: {str(e)}")


@app.get("/ad-script/runs", response_model=List[AdScriptRunResponse], tags=["Ad Script Lab"])
async def list_ad_script_runs(limit: int = 20):
    """
    List recent ad script generation runs.
    """
    orchestrator = get_orchestrator()
    runs = orchestrator.list_runs(limit=limit)
    
    return [AdScriptRunResponse.from_run(run) for run in runs]


@app.get("/ad-script/health", tags=["Ad Script Lab"])
async def ad_script_health():
    """
    Check the health of the Ad Script Lab service.
    """
    from app.features.ad_script_lab.rag_client import get_rag_client
    
    rag_client = get_rag_client()
    rag_healthy = await rag_client.health_check()
    
    return {
        "status": "healthy" if rag_healthy else "degraded",
        "rag_available": rag_healthy,
        "message": "Ad Script Lab is operational" if rag_healthy else "RAG service unavailable"
    }


class UpdateScriptRequest(BaseModel):
    content: str


@app.put("/ad-script/runs/{run_id}/scripts/{script_id}", tags=["Ad Script Lab"])
async def update_ad_script(run_id: str, script_id: str, request: UpdateScriptRequest):
    """
    Update a script's content within a run.
    This is called by the script editor's auto-save functionality.
    """
    orchestrator = get_orchestrator()
    run = orchestrator.get_run(run_id)
    
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    if not run.artifacts or not run.artifacts.polished_3:
        raise HTTPException(status_code=404, detail="No scripts found in this run")
    
    # Find and update the script
    updated_script = None
    for script in run.artifacts.polished_3:
        if script.id == script_id:
            script.full_script = request.content
            updated_script = script
            break
    
    # Also check final_script
    if run.artifacts.final_script and run.artifacts.final_script.id == script_id:
        run.artifacts.final_script.full_script = request.content
        updated_script = run.artifacts.final_script
    
    if not updated_script:
        raise HTTPException(status_code=404, detail=f"Script {script_id} not found in run")
    
    # Persist the update
    orchestrator.update_run(run)
    
    AD_SCRIPT_LOG.info("Updated script %s in run %s", script_id, run_id)
    
    return {
        "id": updated_script.id,
        "title": updated_script.title,
        "full_script": updated_script.full_script,
        "concept_id": updated_script.concept_id,
        "opening": updated_script.opening,
        "development": updated_script.development,
        "climax": updated_script.climax,
        "resolution": updated_script.resolution,
        "visual_style": updated_script.visual_style,
        "audio_notes": updated_script.audio_notes,
        "talent_notes": updated_script.talent_notes,
        "production_considerations": updated_script.production_considerations,
        "estimated_duration_seconds": updated_script.estimated_duration_seconds,
        "overall_score": getattr(updated_script, 'overall_score', None),
    }


@app.post("/ad-script/process-briefing", tags=["Ad Script Lab"])
async def process_briefing_docs(files: List[UploadFile] = File(...)):
    """
    Process uploaded briefing documents (PDFs, Word docs, images, text files)
    and extract relevant context for the creative brief.
    """
    import pypdf
    import io
    from app.core.gemini_utils import create_gemini_model, safe_get_response_text
    import google.generativeai as genai
    
    AD_SCRIPT_LOG.info("Processing %d briefing documents", len(files))
    
    extracted_texts = []
    
    for file in files:
        try:
            content = await file.read()
            filename = file.filename or "unknown"
            content_type = file.content_type or ""
            
            AD_SCRIPT_LOG.info("Processing file: %s (%s, %d bytes)", filename, content_type, len(content))
            
            # Handle different file types
            if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
                # Extract text from PDF
                try:
                    pdf_reader = pypdf.PdfReader(io.BytesIO(content))
                    pdf_text = ""
                    for page in pdf_reader.pages:
                        text = page.extract_text()
                        if text:
                            pdf_text += text + "\n"
                    if pdf_text.strip():
                        extracted_texts.append(f"--- From {filename} ---\n{pdf_text[:10000]}")
                except Exception as pdf_err:
                    AD_SCRIPT_LOG.warning("Failed to parse PDF %s: %s", filename, pdf_err)
            
            elif content_type == "text/plain" or filename.lower().endswith(".txt"):
                # Plain text file
                try:
                    text_content = content.decode('utf-8')
                    extracted_texts.append(f"--- From {filename} ---\n{text_content[:10000]}")
                except Exception as txt_err:
                    AD_SCRIPT_LOG.warning("Failed to read text file %s: %s", filename, txt_err)
            
            elif content_type.startswith("image/"):
                # Use Gemini Vision to extract text from images
                try:
                    model = create_gemini_model('flash')
                    if model:
                        import base64
                        image_data = base64.b64encode(content).decode()
                        
                        response = model.generate_content([
                            "Extract all text and key information from this image. If it's a creative brief or brand guidelines, summarize the key points.",
                            {"inline_data": {"mime_type": content_type, "data": image_data}}
                        ])
                        
                        image_text = safe_get_response_text(response)
                        if image_text:
                            extracted_texts.append(f"--- From {filename} (image) ---\n{image_text[:5000]}")
                except Exception as img_err:
                    AD_SCRIPT_LOG.warning("Failed to process image %s: %s", filename, img_err)
            
            elif "word" in content_type or filename.lower().endswith((".doc", ".docx")):
                # For Word docs, we'll try basic text extraction
                # A more robust solution would use python-docx
                try:
                    # Simple approach: look for readable text
                    text_content = content.decode('utf-8', errors='ignore')
                    # Filter to likely text portions
                    readable = ''.join(c if c.isprintable() or c in '\n\t' else ' ' for c in text_content)
                    readable = ' '.join(readable.split())[:5000]
                    if len(readable) > 100:
                        extracted_texts.append(f"--- From {filename} ---\n{readable}")
                except Exception as doc_err:
                    AD_SCRIPT_LOG.warning("Failed to extract from Word doc %s: %s", filename, doc_err)
        
        except Exception as e:
            AD_SCRIPT_LOG.error("Error processing file %s: %s", file.filename, e)
    
    if not extracted_texts:
        return {"extracted_context": "", "files_processed": 0}
    
    # Combine all extracted texts
    combined_text = "\n\n".join(extracted_texts)
    
    # Use Gemini to synthesize and summarize the briefing context
    try:
        model = create_gemini_model('flash')
        if model:
            synthesis_prompt = f"""You are analyzing uploaded briefing documents for a TV ad campaign.
            
Extract and synthesize the key information into a structured brief context. Focus on:
- Brand information (name, values, positioning)
- Target audience details
- Key messages or propositions
- Tone of voice guidelines
- Visual style preferences
- Any mandatories or restrictions
- Campaign objectives

Here are the extracted documents:

{combined_text[:15000]}

Provide a clear, concise summary that can be used by creative teams to generate ad scripts.
Format your response as a structured brief."""

            response = model.generate_content(synthesis_prompt, generation_config=genai.types.GenerationConfig(temperature=0.3))
            synthesized = safe_get_response_text(response)
            
            if synthesized:
                AD_SCRIPT_LOG.info("Successfully synthesized briefing context from %d files", len(files))
                return {"extracted_context": synthesized, "files_processed": len(files)}
    
    except Exception as synth_err:
        AD_SCRIPT_LOG.warning("Failed to synthesize briefing: %s", synth_err)
    
    # Fallback: return raw extracted text
    return {"extracted_context": combined_text[:10000], "files_processed": len(files)}


# =====================================================
# Ad Script Lab Admin Endpoints
# =====================================================

class AdminAuthRequest(BaseModel):
    password: str


ADMIN_PASSWORD = os.environ.get("AD_SCRIPT_ADMIN_PASSWORD", "admin123")  # Set in production


@app.post("/ad-script/admin/auth", tags=["Ad Script Lab Admin"])
async def admin_authenticate(request: AdminAuthRequest):
    """Authenticate for admin access."""
    if request.password == ADMIN_PASSWORD:
        return {"authenticated": True, "message": "Access granted"}
    raise HTTPException(status_code=401, detail="Invalid password")


@app.get("/ad-script/admin/stats", tags=["Ad Script Lab Admin"])
async def get_admin_stats(password: str = ""):
    """
    Get pipeline statistics for the admin dashboard.
    Requires password query parameter.
    """
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")

    orchestrator = get_orchestrator()
    runs = orchestrator.list_runs(limit=100)

    total_runs = len(runs)
    completed_runs = [r for r in runs if r.status.value == "completed"]
    failed_runs = [r for r in runs if r.status.value == "failed"]
    running_runs = [r for r in runs if r.status.value == "running"]

    # Calculate average duration for completed runs
    durations = []
    for run in completed_runs:
        if run.created_at and run.updated_at:
            duration = (run.updated_at - run.created_at).total_seconds()
            durations.append(duration)

    avg_duration = sum(durations) / len(durations) if durations else 0

    # Get RAG stats
    from app.features.ad_script_lab.rag_client import get_rag_client
    rag_client = get_rag_client()
    rag_healthy = await rag_client.health_check()
    rag_type = type(rag_client).__name__

    # Recent activity by day
    from datetime import datetime, timedelta
    today = datetime.utcnow().date()
    runs_by_day = {}
    for i in range(7):
        day = today - timedelta(days=i)
        day_str = day.isoformat()
        runs_by_day[day_str] = 0

    for run in runs:
        if run.created_at:
            day_str = run.created_at.date().isoformat()
            if day_str in runs_by_day:
                runs_by_day[day_str] += 1

    return {
        "total_runs": total_runs,
        "completed_runs": len(completed_runs),
        "failed_runs": len(failed_runs),
        "running_runs": len(running_runs),
        "success_rate": len(completed_runs) / total_runs * 100 if total_runs > 0 else 0,
        "avg_duration_seconds": round(avg_duration, 1),
        "rag_status": {
            "healthy": rag_healthy,
            "client_type": rag_type,
            "using_real_db": rag_type == "SupabaseTvAdsRagClient"
        },
        "runs_by_day": runs_by_day
    }


@app.get("/ad-script/admin/pipeline-flow", tags=["Ad Script Lab Admin"])
async def get_pipeline_flow(password: str = ""):
    """
    Get pipeline flow data for visualization.
    Returns stage-by-stage timing and status information.
    """
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")

    # Define the pipeline stages
    stages = [
        {"id": "brand_discovery", "name": "Brand Discovery", "optional": True},
        {"id": "synthesizer", "name": "Synthesizer", "optional": True},
        {"id": "retriever", "name": "RAG Retriever", "optional": False},
        {"id": "amazon_start", "name": "Working Backwards", "optional": False},
        {"id": "ideate", "name": "Ideate", "optional": False},
        {"id": "selector", "name": "Selector", "optional": False},
        {"id": "polish", "name": "Polish", "optional": False},
        {"id": "braintrust", "name": "Braintrust", "optional": False},
        {"id": "compliance", "name": "Compliance Check", "optional": False},
        {"id": "compliance_fix", "name": "Compliance Fix", "optional": False},
        {"id": "finalize", "name": "Finalize", "optional": False},
    ]

    orchestrator = get_orchestrator()
    recent_runs = orchestrator.list_runs(limit=20)

    # Calculate stage success rates and avg times from recent runs
    stage_stats = {s["id"]: {"successes": 0, "failures": 0, "total_time": 0, "count": 0} for s in stages}

    for run in recent_runs:
        current_stage = run.current_stage
        status = run.status.value

        # Mark all stages up to current as successful
        for stage in stages:
            if stage["id"] == current_stage:
                if status == "failed":
                    stage_stats[stage["id"]]["failures"] += 1
                else:
                    stage_stats[stage["id"]]["successes"] += 1
                break
            else:
                stage_stats[stage["id"]]["successes"] += 1

    # Build flow data
    flow_data = []
    for stage in stages:
        stats = stage_stats[stage["id"]]
        total = stats["successes"] + stats["failures"]
        success_rate = stats["successes"] / total * 100 if total > 0 else 100

        flow_data.append({
            **stage,
            "success_rate": round(success_rate, 1),
            "runs_through": total,
            "failures": stats["failures"]
        })

    return {
        "stages": flow_data,
        "total_recent_runs": len(recent_runs)
    }


@app.get("/ad-script/admin/recent-runs", tags=["Ad Script Lab Admin"])
async def get_admin_recent_runs(password: str = "", limit: int = 20):
    """
    Get recent runs with detailed status for admin view.
    """
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")

    orchestrator = get_orchestrator()
    runs = orchestrator.list_runs(limit=limit)

    return [{
        "run_id": run.run_id,
        "asset_name": run.brief.asset_name,
        "brand_name": run.brief.brand_name,
        "status": run.status.value,
        "current_stage": run.current_stage,
        "creative_mode": run.brief.creative_mode.value,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        "duration_seconds": (run.updated_at - run.created_at).total_seconds() if run.created_at and run.updated_at else None,
        "error": run.error,
        "scripts_generated": len(run.artifacts.polished_3) if run.artifacts else 0,
        "has_final_script": run.artifacts.final_script is not None if run.artifacts else False
    } for run in runs]


# =====================================================
# Media Report Consolidator - AI PDF Parsing
# =====================================================

class MediaReportParseResult(BaseModel):
    """Result from AI-powered PDF parsing for media reports"""
    supplier: str = "Unknown"
    planned_impressions: int = 0
    delivered_impressions: int = 0
    clicks: int = 0
    vtr: float = 0.0
    frequency: Optional[float] = None
    device_split: Dict[str, float] = {"mobile": 0, "desktop": 0, "tv": 1}
    top_shows: List[Dict[str, Any]] = []
    buying_lines: List[Dict[str, Any]] = []
    daily_impressions: List[Dict[str, Any]] = []  # Day-by-day breakdown
    daypart_split: Optional[Dict[str, float]] = None  # Time-of-day breakdown
    raw_text: Optional[str] = None


@app.post("/parse-pdf-ai", response_model=MediaReportParseResult, tags=["Media Reports"])
async def parse_pdf_with_ai(file: UploadFile = File(...)):
    """
    Parse a media report PDF using AI (Gemini Vision) to extract structured data.
    
    Supports ITV/ITVX historical analysis PDFs and other media report formats.
    Returns structured data including impressions, device splits, top programmes, etc.
    """
    import google.generativeai as genai
    import base64
    import pypdf
    import io
    from app.core.gemini_utils import create_gemini_model, safe_get_response_text
    
    logger.info(f"[AI PDF Parse] Processing file: {file.filename}")
    
    try:
        # Read the PDF file
        pdf_bytes = await file.read()
        
        # First, extract text using pypdf for context
        pdf_reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        full_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
        
        logger.info(f"[AI PDF Parse] Extracted {len(full_text)} chars of text from {len(pdf_reader.pages)} pages")
        
        # Create Gemini model for analysis
        model = create_gemini_model('pro')
        if not model:
            logger.warning("[AI PDF Parse] No Gemini model available, falling back to basic extraction")
            # Fallback to basic regex extraction
            return await _basic_pdf_extraction(full_text, file.filename)
        
        # Create structured extraction prompt with enhanced buying_lines extraction
        # Detect if this looks like an ITV report for specialized prompting
        is_itv = 'itv' in full_text.lower() or 'itvx' in full_text.lower()
        
        itv_specific_instructions = """
## ITV/ITVX SPECIFIC EXTRACTION RULES:
ITV Historical Analysis PDFs have a specific format. Look for:

1. **Campaign Summary Section** (usually page 2-3):
   - "Target" label followed by a number (e.g., "Target 655,045")
   - "Delivered" label followed by a number (e.g., "Delivered 657,163")  
   - "Delivery" or "Delivery rate" as a percentage

2. **Completion Rate/VTR**:
   - Look for "Completion rate" or "VTR" followed by a percentage
   - Often shown as "97.7%" - convert to 0.977

3. **Device Split** (often labeled "Delivery by device type"):
   - DESKTOP - XX,XXX (XX.X%)
   - MOBILE - XX,XXX (XX.X%)
   - TV - XX,XXX (XX.X%)
   Extract the PERCENTAGES, convert to decimals

4. **Top Programmes** (often labeled "Delivery by programme"):
   - Programme names like "CODE.OF.SILENCE", "MIDSOMER.MURDERS", "VERA"
   - Followed by impression counts (often in K notation like "42.68K")
   - Clean up names: replace dots with spaces, proper capitalization

5. **Campaign Line Items/Segments** (IMPORTANT for ITV):
   - Look for named segments like "Tom Ford_Bois Pacifique_ITV_Masthead"
   - Simplify long ITV segment names to core buying type (e.g., "ITV Masthead", "ITVX Standard")
   - If segment names contain demographics, extract them (e.g., "ABC1 Adults", "ABC1 Men")
   - Each segment has its own Target, Delivered, Clicks values
   - Extract EACH segment as a separate buying_line
   - If no clear buying segments are found, set buying_lines to empty array
   - Mark "is_inferred": true for any estimated/guessed data, false for exact extracted data

6. **Daily Impressions** (if day-by-day data is available):
   - Look for daily delivery charts or tables
   - Extract date and impressions for each day

7. **Daypart Split** (time-of-day breakdown if available):
   - Morning (6am-12pm), Daytime (12pm-5:25pm), Early Peak (5:25pm-8pm)
   - Late Peak (8pm-11pm), Post Peak (11pm-12:30am), Late Night (12:30am-6am)

""" if is_itv else ""
        
        prompt = f"""You are a media report data extraction expert. Analyze this media report PDF text and extract ALL structured data with EXACT values.

The text is from a media report (likely ITV/ITVX, Sky, or Channel 4). Extract the following information:

1. **Supplier**: Which platform/supplier is this from? (e.g., "ITV", "ITVX", "Sky", "Channel 4")
2. **Target/Planned Impressions**: The total number of impressions that were booked/planned
3. **Delivered Impressions**: The total actual impressions delivered
4. **Clicks**: Total number of clicks (if available)
5. **VTR/Completion Rate**: Video completion rate or VTR as a decimal (e.g., 0.977 for 97.7%)
6. **Device Split**: Breakdown by device type (mobile, desktop, TV/big screen) as percentages
7. **Top Shows/Programmes**: Top performing programmes with their impression counts
8. **Frequency**: Average frequency if available (impressions / unique reach)
9. **Buying Lines**: IMPORTANT - Extract EACH campaign segment, line item, or buying type as a SEPARATE entry
{itv_specific_instructions}
For buying_lines, look for:
- Campaign segments with names like "ABC1 Men", "Premium/Luxe Shopper", "Boost - ABC1 Adults"
- ITV segments often named like "Tom Ford_Bois Pacifique_ITV_Masthead" or similar
- Line items with individual planned/delivered impressions
- Each segment should have its own metrics (planned, delivered, clicks, VTR)
- Calculate CTR for each line: CTR = (clicks / delivered_impressions) * 100

Return your response as valid JSON with this exact structure:
{{
  "supplier": "ITV",
  "planned_impressions": 655045,
  "delivered_impressions": 657163,
  "clicks": 575,
  "vtr": 0.977,
  "frequency": 1.98,
  "device_split": {{
    "mobile": 0.1569,
    "desktop": 0.0706,
    "tv": 0.7725
  }},
  "top_shows": [
    {{"title": "Code of Silence", "impressions": 42680}},
    {{"title": "Midsomer Murders", "impressions": 27580}}
  ],
  "buying_lines": [
    {{
      "buying_type": "ABC1 Men 30'",
      "planned_impressions": 338816,
      "delivered_impressions": 339885,
      "vtr": 0.979,
      "clicks": 232,
      "ctr": 0.0683
    }}
  ],
  "daily_impressions": [
    {{"date": "08/05/2025", "impressions": 32456, "clicks": 28}},
    {{"date": "09/05/2025", "impressions": 35123, "clicks": 31}}
  ],
  "daypart_split": {{
    "morning": 0.12,
    "daytime": 0.18,
    "early_peak": 0.25,
    "late_peak": 0.28,
    "post_peak": 0.10,
    "late_night": 0.07
  }}
}}

DAYPART DEFINITIONS:
- morning: 6am to 12pm (Midday)
- daytime: 12pm to 5:25pm
- early_peak: 5:25pm to 8pm
- late_peak: 8pm to 11pm
- post_peak: 11pm to 12:30am
- late_night: 12:30am to 6am

IMPORTANT RULES:
- Extract the EXACT numbers from the document - do not estimate or round
- Extract EVERY buying segment/line item found in the document
- If the PDF shows multiple campaigns or audience segments, create a buying_line for each
- If a value is not found, use 0 for numbers or empty arrays for lists
- Convert K notation (e.g., "42.68K") to actual numbers (42680)
- Convert percentages to decimals for VTR and device splits (e.g., 97.7% -> 0.977)
- CTR should be a percentage value (e.g., 0.15 for 0.15%)
- Look for tables or sections labeled "Line Items", "Campaign Breakdown", "Buying Segments", etc.
- For programme names, clean up dots and formatting (e.g., "CODE.OF.SILENCE" -> "Code of Silence")

Here is the PDF text to analyze:
---
{full_text[:20000]}
---

Return ONLY valid JSON, no markdown code blocks or explanations."""

        # Call Gemini
        generation_config = genai.types.GenerationConfig(
            temperature=0.0,
            candidate_count=1
        )
        
        response = model.generate_content(prompt, generation_config=generation_config)
        response_text = safe_get_response_text(response)
        
        if not response_text:
            logger.warning("[AI PDF Parse] Empty response from Gemini, falling back to basic extraction")
            return await _basic_pdf_extraction(full_text, file.filename)
        
        # Parse JSON response
        try:
            # Clean up response - remove markdown code blocks if present
            clean_response = response_text.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            parsed_data = json.loads(clean_response)
            
            result = MediaReportParseResult(
                supplier=parsed_data.get("supplier", "Unknown"),
                planned_impressions=int(parsed_data.get("planned_impressions", 0)),
                delivered_impressions=int(parsed_data.get("delivered_impressions", 0)),
                clicks=int(parsed_data.get("clicks", 0)),
                vtr=float(parsed_data.get("vtr", 0)),
                frequency=float(parsed_data.get("frequency")) if parsed_data.get("frequency") else None,
                device_split=parsed_data.get("device_split", {"mobile": 0, "desktop": 0, "tv": 1}),
                top_shows=parsed_data.get("top_shows", []),
                buying_lines=parsed_data.get("buying_lines", []),
                daily_impressions=parsed_data.get("daily_impressions", []),
                daypart_split=parsed_data.get("daypart_split"),
                raw_text=full_text[:5000]  # Include first 5k chars for debugging
            )
            
            logger.info(f"[AI PDF Parse] Successfully parsed: {result.supplier}, {result.delivered_impressions:,} impressions")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"[AI PDF Parse] Failed to parse JSON response: {e}")
            logger.debug(f"[AI PDF Parse] Response was: {response_text[:500]}")
            return await _basic_pdf_extraction(full_text, file.filename)
        
    except Exception as e:
        logger.exception(f"[AI PDF Parse] Error processing PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")


async def _basic_pdf_extraction(full_text: str, filename: str) -> MediaReportParseResult:
    """Basic regex-based extraction fallback when AI is not available"""
    import re
    
    result = MediaReportParseResult(raw_text=full_text[:5000])
    
    # Detect supplier
    if "itv" in full_text.lower() or "itvx" in full_text.lower():
        result.supplier = "ITV"
    elif "sky" in full_text.lower():
        result.supplier = "Sky"
    elif "channel 4" in full_text.lower() or "c4" in full_text.lower():
        result.supplier = "Channel 4"
    
    # Extract Target/Planned
    target_match = re.search(r'Target\s*(?:.*?)(\d{1,3}(?:,\d{3})*)', full_text, re.IGNORECASE | re.DOTALL)
    if target_match:
        result.planned_impressions = int(target_match.group(1).replace(',', ''))
    
    # Extract Delivered
    delivered_match = re.search(r'Delivered\s*(?:.*?)(\d{1,3}(?:,\d{3})*)', full_text, re.IGNORECASE | re.DOTALL)
    if delivered_match:
        result.delivered_impressions = int(delivered_match.group(1).replace(',', ''))
    
    # Extract VTR/Completion
    vtr_match = re.search(r'(?:Completion|VTR)\s*(?:rate)?\s*(?:.*?)([\d.]+)%', full_text, re.IGNORECASE)
    if vtr_match:
        result.vtr = float(vtr_match.group(1)) / 100
    
    # Extract device splits
    desktop_match = re.search(r'DESKTOP\s*[-–]?\s*[\d.,]+K?\s*\(([\d.]+)%\)', full_text, re.IGNORECASE)
    mobile_match = re.search(r'MOBILE\s*[-–]?\s*[\d.,]+K?\s*\(([\d.]+)%\)', full_text, re.IGNORECASE)
    tv_match = re.search(r'TV\s*[-–]?\s*[\d.,]+K?\s*\(([\d.]+)%\)', full_text, re.IGNORECASE)
    
    if desktop_match or mobile_match or tv_match:
        result.device_split = {
            "desktop": float(desktop_match.group(1)) / 100 if desktop_match else 0,
            "mobile": float(mobile_match.group(1)) / 100 if mobile_match else 0,
            "tv": float(tv_match.group(1)) / 100 if tv_match else 0.75
        }
    
    logger.info(f"[AI PDF Parse] Basic extraction: {result.supplier}, {result.delivered_impressions:,} impressions")
    return result


@app.post("/parse-pdf-vision", response_model=MediaReportParseResult, tags=["Media Reports"])
async def parse_pdf_with_vision(file: UploadFile = File(...)):
    """
    Parse a media report PDF using Gemini Vision to analyze page screenshots.
    
    This endpoint converts PDF pages to images and uses Gemini's vision capabilities
    to extract structured data - especially useful for PDFs with complex layouts,
    charts, or embedded graphics that text extraction misses.
    """
    import google.generativeai as genai
    import base64
    import io
    from app.core.gemini_utils import create_gemini_model, safe_get_response_text
    
    logger.info(f"[Vision PDF Parse] Processing file: {file.filename}")
    
    try:
        # Try to import fitz (PyMuPDF) for PDF to image conversion
        try:
            import fitz  # PyMuPDF
        except ImportError:
            logger.error("[Vision PDF Parse] PyMuPDF not installed. Falling back to text-based parsing.")
            # Reset file position and use text-based parsing
            await file.seek(0)
            return await parse_pdf_with_ai(file)
        
        # Read the PDF file
        pdf_bytes = await file.read()
        
        # Open PDF with PyMuPDF
        pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        num_pages = len(pdf_doc)
        logger.info(f"[Vision PDF Parse] PDF has {num_pages} pages")
        
        # Convert first 4 pages to images (most important content is usually at start)
        page_images = []
        for page_num in range(min(4, num_pages)):
            page = pdf_doc[page_num]
            # Render page at 150 DPI for good quality without huge file size
            mat = fitz.Matrix(150/72, 150/72)  # 150 DPI
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            page_images.append({
                "page_num": page_num + 1,
                "image_bytes": img_bytes,
                "mime_type": "image/png"
            })
            logger.debug(f"[Vision PDF Parse] Converted page {page_num + 1} to image ({len(img_bytes)} bytes)")
        
        pdf_doc.close()
        
        # Create Gemini model with vision capability
        model = create_gemini_model('flash')  # Use flash for vision - faster and cheaper
        if not model:
            logger.warning("[Vision PDF Parse] No Gemini model available, falling back to text extraction")
            await file.seek(0)
            return await parse_pdf_with_ai(file)
        
        # Prepare the prompt with all page images
        vision_prompt = """You are analyzing screenshots of a media report PDF. Extract ALL data you can see from these pages.

The report is likely from ITV/ITVX, Sky, or Channel 4. Look carefully at:

1. **Summary Metrics**: 
   - Target/Planned impressions (the number booked)
   - Delivered impressions (actual served)
   - Delivery percentage
   - Completion rate / VTR (video completion rate)
   - Frequency (average times shown per viewer)

2. **Device Breakdown** (often shown as a pie chart or bar chart):
   - Mobile percentage
   - Desktop percentage  
   - TV / Big Screen / CTV percentage
   Read the actual percentages from labels or legends

3. **Top Programmes/Content** (usually a chart or table):
   - Programme names
   - Their impression counts (may be in K notation like "42.68K")

4. **Campaign/Buying Segments** (line items with individual metrics):
   - Segment names like "ABC1 Men", "Premium/Luxe Shopper", etc.
   - Each segment's planned/delivered impressions
   - Each segment's clicks and CTR

5. **Daily Impressions** (if there's a day-by-day chart or table):
   - Date and impressions for each day

6. **Daypart Split** (time-of-day breakdown if available):
   - Morning (6am-12pm), Daytime (12pm-5:25pm), Early Peak (5:25pm-8pm)
   - Late Peak (8pm-11pm), Post Peak (11pm-12:30am), Late Night (12:30am-6am)

Look at ALL charts, tables, and text. Convert K notation to actual numbers (e.g., 42.68K = 42680).

Return your findings as valid JSON:
{
  "supplier": "ITV",
  "planned_impressions": 655045,
  "delivered_impressions": 657163,
  "clicks": 575,
  "vtr": 0.977,
  "frequency": 1.98,
  "device_split": {
    "mobile": 0.157,
    "desktop": 0.071,
    "tv": 0.772
  },
  "top_shows": [
    {"title": "Code of Silence", "impressions": 42680},
    {"title": "Midsomer Murders", "impressions": 27580}
  ],
  "buying_lines": [
    {
      "buying_type": "ABC1 Men 30'",
      "planned_impressions": 338816,
      "delivered_impressions": 339885,
      "vtr": 0.979,
      "clicks": 232,
      "ctr": 0.0683
    }
  ],
  "daily_impressions": [
    {"date": "08/05/2025", "impressions": 32456, "clicks": 28}
  ],
  "daypart_split": {
    "morning": 0.12,
    "daytime": 0.18,
    "early_peak": 0.25,
    "late_peak": 0.28,
    "post_peak": 0.10,
    "late_night": 0.07
  }
}

Analyze the page images and return ONLY valid JSON, no explanation."""

        # Build content with images
        content_parts = [vision_prompt]
        for img_info in page_images:
            # Add image as inline data
            content_parts.append({
                "inline_data": {
                    "mime_type": img_info["mime_type"],
                    "data": base64.b64encode(img_info["image_bytes"]).decode()
                }
            })
        
        # Call Gemini Vision
        generation_config = genai.types.GenerationConfig(
            temperature=0.1,
            candidate_count=1
        )
        
        response = model.generate_content(content_parts, generation_config=generation_config)
        response_text = safe_get_response_text(response)
        
        if not response_text:
            logger.warning("[Vision PDF Parse] Empty response from Gemini Vision")
            await file.seek(0)
            return await parse_pdf_with_ai(file)
        
        # Parse JSON response
        try:
            # Clean up response
            clean_response = response_text.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            parsed_data = json.loads(clean_response)
            
            result = MediaReportParseResult(
                supplier=parsed_data.get("supplier", "Unknown"),
                planned_impressions=int(parsed_data.get("planned_impressions", 0)),
                delivered_impressions=int(parsed_data.get("delivered_impressions", 0)),
                clicks=int(parsed_data.get("clicks", 0)),
                vtr=float(parsed_data.get("vtr", 0)),
                frequency=parsed_data.get("frequency"),
                device_split=parsed_data.get("device_split", {"mobile": 0, "desktop": 0, "tv": 1}),
                top_shows=parsed_data.get("top_shows", []),
                buying_lines=parsed_data.get("buying_lines", []),
                daily_impressions=parsed_data.get("daily_impressions", []),
                daypart_split=parsed_data.get("daypart_split")
            )
            
            logger.info(f"[Vision PDF Parse] Successfully extracted: {result.supplier}, "
                       f"{result.delivered_impressions:,} delivered, "
                       f"{len(result.buying_lines)} buying lines, "
                       f"{len(result.top_shows)} shows")
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"[Vision PDF Parse] Failed to parse JSON: {e}")
            logger.debug(f"[Vision PDF Parse] Response was: {response_text[:500]}")
            # Fall back to text-based parsing
            await file.seek(0)
            return await parse_pdf_with_ai(file)
        
    except Exception as e:
        logger.exception(f"[Vision PDF Parse] Error processing PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF with vision: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
