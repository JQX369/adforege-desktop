"""Analyses Router

Handles video upload, analysis processing, and results retrieval.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from pathlib import Path
from datetime import datetime
import uuid
import logging

from api.deps import (
    DB, User, Org,
    get_current_user, get_current_organization,
    check_analysis_limit, increment_analysis_count,
    require_subscription_tier
)

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Models
# =============================================================================

class AnalysisResponse(BaseModel):
    id: str
    video_name: str
    created_at: str
    status: str
    avg_engagement: float = 0.0
    ai_effectiveness: Optional[float] = None
    emotion_summary: Optional[Dict[str, float]] = None
    emotion_timeline: Optional[List[Dict[str, Any]]] = None
    clearcast_check: Optional[Dict[str, Any]] = None
    ai_breakdown: Optional[Dict[str, Any]] = None
    playback_ready: bool = False
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class UploadResponse(BaseModel):
    analysis_id: str
    status: str
    job_id: Optional[str] = None
    message: str


class QARequest(BaseModel):
    question: str
    mode: str = "general"  # general, compare, improve, brainstorm


class QAResponse(BaseModel):
    answer: str
    sources: Optional[List[str]] = None
    suggestions: Optional[List[str]] = None


# =============================================================================
# Upload & Analysis Endpoints
# =============================================================================

@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload_video(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    org: Org = Depends(check_analysis_limit),
    db: DB = Depends()
):
    """
    Upload a video for analysis.

    The video will be stored in Supabase Storage and a background job
    will be queued for AI analysis.

    Limits:
    - Free: 5 analyses/month
    - Pro: 50 analyses/month
    - Enterprise: Unlimited
    """
    # Validate file extension
    allowed_extensions = {".mp4", ".mov", ".webm"}
    file_ext = Path(file.filename or "").suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Allowed: {', '.join(allowed_extensions)}"
        )

    try:
        # Generate unique ID
        analysis_id = str(uuid.uuid4())

        # Read file content
        content = await file.read()

        # Upload to Supabase Storage
        storage_path = f"{org.id}/{analysis_id}{file_ext}"

        from app.core.database import upload_to_storage
        video_url = await upload_to_storage(
            bucket="videos",
            path=storage_path,
            file_data=content,
            content_type=file.content_type or "video/mp4"
        )

        # Create analysis record
        analysis_data = {
            "id": analysis_id,
            "organization_id": org.id,
            "created_by": user.id,
            "video_name": file.filename,
            "video_url": video_url,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }

        db.table("analyses").insert(analysis_data).execute()

        # Queue background job
        job_id = _queue_analysis_job(db, analysis_id, org.id)

        # Increment usage counter
        await increment_analysis_count(org, db)

        return UploadResponse(
            analysis_id=analysis_id,
            status="queued",
            job_id=job_id,
            message="Video uploaded successfully. Analysis in progress."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload video")


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get analysis results by ID"""
    result = db.table("analyses").select("*").eq(
        "id", analysis_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    row = result.data

    # Extract effectiveness from AI breakdown
    ai_effectiveness = None
    if row.get("ai_breakdown"):
        outcome = row["ai_breakdown"].get("outcome")
        if isinstance(outcome, dict):
            ai_effectiveness = outcome.get("effectiveness_score")

    return AnalysisResponse(
        id=row["id"],
        video_name=row["video_name"],
        created_at=row["created_at"],
        status=row.get("status", "completed"),
        avg_engagement=row.get("avg_engagement", 0.0),
        ai_effectiveness=ai_effectiveness,
        emotion_summary=row.get("emotion_summary"),
        emotion_timeline=row.get("emotion_timeline"),
        clearcast_check=row.get("clearcast_check"),
        ai_breakdown=row.get("ai_breakdown"),
        playback_ready=row.get("status") == "completed",
        video_url=row.get("video_url"),
        thumbnail_url=row.get("thumbnail_url")
    )


@router.get("/{analysis_id}/status")
async def get_analysis_status(
    analysis_id: str,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get just the status of an analysis (for polling)"""
    result = db.table("analyses").select(
        "id, status"
    ).eq("id", analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Also check job status
    job_result = db.table("jobs").select(
        "status, error"
    ).eq("payload->>analysis_id", analysis_id).order(
        "created_at", desc=True
    ).limit(1).execute()

    job_status = None
    job_error = None
    if job_result.data:
        job_status = job_result.data[0].get("status")
        job_error = job_result.data[0].get("error")

    return {
        "analysis_id": analysis_id,
        "status": result.data["status"],
        "job_status": job_status,
        "error": job_error
    }


# =============================================================================
# AI Q&A Endpoints (Pro+ only)
# =============================================================================

@router.post("/{analysis_id}/qa", response_model=QAResponse)
async def ask_question(
    analysis_id: str,
    request: QARequest,
    user: User = Depends(get_current_user),
    org: Org = Depends(require_subscription_tier("pro", "enterprise")),
    db: DB = Depends()
):
    """
    Ask a question about the analyzed video.

    Modes:
    - general: General questions about the ad
    - compare: Compare with similar ads
    - improve: Get improvement suggestions
    - brainstorm: Creative brainstorming

    Requires Pro or Enterprise subscription.
    """
    # Verify analysis exists
    result = db.table("analyses").select(
        "ai_breakdown, clearcast_check"
    ).eq("id", analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not result.data.get("ai_breakdown"):
        raise HTTPException(
            status_code=400,
            detail="Analysis not complete. Wait for AI breakdown to finish."
        )

    # TODO: Implement actual Q&A with Gemini/GPT
    # For now, return a placeholder
    return QAResponse(
        answer="Q&A feature coming soon. Your question was: " + request.question,
        sources=["ai_breakdown"],
        suggestions=[
            "What makes this ad effective?",
            "How could the emotional impact be improved?",
            "Compare this to competitor ads"
        ]
    )


@router.get("/{analysis_id}/qa/suggestions")
async def get_qa_suggestions(
    analysis_id: str,
    user: User = Depends(get_current_user),
    org: Org = Depends(require_subscription_tier("pro", "enterprise")),
    db: DB = Depends()
):
    """Get suggested questions for an analysis"""
    return {
        "suggestions": [
            "What is the main message of this ad?",
            "Who is the target audience?",
            "What emotions does this ad evoke?",
            "How effective is the call to action?",
            "What improvements would you suggest?",
            "How does this compare to industry benchmarks?"
        ]
    }


# =============================================================================
# Video Streaming
# =============================================================================

@router.get("/{analysis_id}/video")
async def stream_video(
    analysis_id: str,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Stream the analysis video"""
    result = db.table("analyses").select(
        "video_url"
    ).eq("id", analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data or not result.data.get("video_url"):
        raise HTTPException(status_code=404, detail="Video not found")

    # Redirect to Supabase Storage URL
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=result.data["video_url"])


# =============================================================================
# Similar Ads (Enterprise only)
# =============================================================================

@router.get("/{analysis_id}/similar")
async def get_similar_ads(
    analysis_id: str,
    limit: int = 5,
    user: User = Depends(get_current_user),
    org: Org = Depends(require_subscription_tier("enterprise")),
    db: DB = Depends()
):
    """
    Find similar ads using RAG search.

    Enterprise only feature.
    """
    # Verify analysis exists
    result = db.table("analyses").select(
        "ai_breakdown"
    ).eq("id", analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # TODO: Implement RAG search against TV ads database
    return {
        "similar_ads": [],
        "message": "Similar ads feature coming soon"
    }


# =============================================================================
# Helpers
# =============================================================================

def _queue_analysis_job(db, analysis_id: str, organization_id: str) -> str:
    """Queue a video analysis job"""
    job_id = str(uuid.uuid4())

    job_data = {
        "id": job_id,
        "organization_id": organization_id,
        "job_type": "video_analysis",
        "payload": {"analysis_id": analysis_id},
        "status": "pending",
        "created_at": datetime.utcnow().isoformat()
    }

    db.table("jobs").insert(job_data).execute()

    return job_id
