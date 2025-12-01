"""Reactions Router

Handles viewer reaction capture and emotion analysis.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal
import logging

from api.deps import (
    DB, User, Org, ProOrEnterprise,
    get_current_user, get_current_organization, get_db
)

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Models
# =============================================================================

class EmotionData(BaseModel):
    timestamp: float
    emotions: dict[str, float]  # joy, surprise, anger, fear, disgust, sadness, neutral
    attention: float
    engagement: float


class ReactionSession(BaseModel):
    id: str
    analysis_id: str
    participant_id: Optional[str]
    status: Literal["pending", "recording", "processing", "completed", "failed"]
    duration: Optional[float]
    frame_count: int
    emotion_timeline: list[EmotionData]
    summary: Optional[dict]
    created_at: str


class ReactionSummary(BaseModel):
    average_attention: float
    average_engagement: float
    dominant_emotion: str
    emotion_peaks: list[dict]
    attention_drops: list[dict]
    overall_score: float


class StartSessionRequest(BaseModel):
    analysis_id: str
    participant_id: Optional[str] = None
    webcam_enabled: bool = True


class SessionChunk(BaseModel):
    """Chunk of reaction data from frontend"""
    session_id: str
    frame_data: list[dict]  # Frame-by-frame emotion data
    timestamp_start: float
    timestamp_end: float


# =============================================================================
# Session Management
# =============================================================================

@router.post("/sessions", response_model=ReactionSession)
async def start_reaction_session(
    request: StartSessionRequest,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Start a new reaction recording session.

    Creates a session linked to an analysis for capturing
    viewer emotions while watching the ad.
    """
    import uuid
    from datetime import datetime

    # Verify analysis exists and belongs to org
    analysis_result = db.table("analyses").select("id").eq(
        "id", request.analysis_id
    ).eq("organization_id", org.id).single().execute()

    if not analysis_result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    session_id = str(uuid.uuid4())

    session_data = {
        "id": session_id,
        "organization_id": org.id,
        "analysis_id": request.analysis_id,
        "participant_id": request.participant_id,
        "created_by": user.id,
        "status": "pending",
        "webcam_enabled": request.webcam_enabled,
        "duration": None,
        "frame_count": 0,
        "emotion_timeline": [],
        "summary": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

    result = db.table("reaction_sessions").insert(session_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")

    return ReactionSession(
        id=session_id,
        analysis_id=request.analysis_id,
        participant_id=request.participant_id,
        status="pending",
        duration=None,
        frame_count=0,
        emotion_timeline=[],
        summary=None,
        created_at=session_data["created_at"]
    )


@router.post("/sessions/{session_id}/start")
async def mark_session_recording(
    session_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Mark session as actively recording"""
    from datetime import datetime

    result = db.table("reaction_sessions").select("id").eq(
        "id", session_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    db.table("reaction_sessions").update({
        "status": "recording",
        "recording_started_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", session_id).execute()

    return {"status": "recording"}


@router.post("/sessions/{session_id}/chunk")
async def upload_reaction_chunk(
    session_id: str,
    chunk: SessionChunk,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Upload a chunk of reaction data.

    The frontend sends periodic chunks during recording
    to avoid data loss and enable real-time processing.
    """
    from datetime import datetime

    result = db.table("reaction_sessions").select(
        "id, status, emotion_timeline, frame_count"
    ).eq("id", session_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    if result.data["status"] not in ("recording", "pending"):
        raise HTTPException(status_code=400, detail="Session is not recording")

    # Process frame data into emotion timeline
    current_timeline = result.data.get("emotion_timeline", [])
    current_frame_count = result.data.get("frame_count", 0)

    for frame in chunk.frame_data:
        emotion_entry = EmotionData(
            timestamp=frame.get("timestamp", 0),
            emotions=frame.get("emotions", {}),
            attention=frame.get("attention", 0),
            engagement=frame.get("engagement", 0)
        )
        current_timeline.append(emotion_entry.model_dump())

    new_frame_count = current_frame_count + len(chunk.frame_data)

    db.table("reaction_sessions").update({
        "status": "recording",
        "emotion_timeline": current_timeline,
        "frame_count": new_frame_count,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", session_id).execute()

    return {
        "received_frames": len(chunk.frame_data),
        "total_frames": new_frame_count
    }


@router.post("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Complete a recording session and trigger analysis.

    Processes the emotion timeline to generate summary statistics
    and identify key moments (peaks, drops, etc).
    """
    from datetime import datetime

    result = db.table("reaction_sessions").select("*").eq(
        "id", session_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = result.data

    # Calculate duration from timeline
    timeline = session.get("emotion_timeline", [])
    duration = timeline[-1]["timestamp"] if timeline else 0

    db.table("reaction_sessions").update({
        "status": "processing",
        "duration": duration,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", session_id).execute()

    # Queue analysis
    background_tasks.add_task(
        _analyze_reactions_async,
        db, session_id, timeline
    )

    return {"status": "processing", "frame_count": len(timeline)}


async def _analyze_reactions_async(db, session_id: str, timeline: list):
    """Background task to analyze reaction data"""
    from datetime import datetime

    try:
        # Calculate summary statistics
        if not timeline:
            summary = {
                "average_attention": 0,
                "average_engagement": 0,
                "dominant_emotion": "neutral",
                "emotion_peaks": [],
                "attention_drops": [],
                "overall_score": 0
            }
        else:
            # Calculate averages
            total_attention = sum(t.get("attention", 0) for t in timeline)
            total_engagement = sum(t.get("engagement", 0) for t in timeline)
            n = len(timeline)

            avg_attention = total_attention / n if n > 0 else 0
            avg_engagement = total_engagement / n if n > 0 else 0

            # Find dominant emotion
            emotion_totals = {}
            for t in timeline:
                for emotion, value in t.get("emotions", {}).items():
                    emotion_totals[emotion] = emotion_totals.get(emotion, 0) + value

            dominant_emotion = max(emotion_totals, key=emotion_totals.get) if emotion_totals else "neutral"

            # Find peaks (moments of high engagement)
            emotion_peaks = []
            for i, t in enumerate(timeline):
                engagement = t.get("engagement", 0)
                if engagement > avg_engagement * 1.5:  # 50% above average
                    emotion_peaks.append({
                        "timestamp": t.get("timestamp", 0),
                        "engagement": engagement,
                        "emotions": t.get("emotions", {})
                    })

            # Find attention drops
            attention_drops = []
            for i, t in enumerate(timeline):
                attention = t.get("attention", 0)
                if attention < avg_attention * 0.5:  # 50% below average
                    attention_drops.append({
                        "timestamp": t.get("timestamp", 0),
                        "attention": attention
                    })

            # Calculate overall score (0-100)
            overall_score = min(100, (avg_attention * 50) + (avg_engagement * 50))

            summary = {
                "average_attention": round(avg_attention, 3),
                "average_engagement": round(avg_engagement, 3),
                "dominant_emotion": dominant_emotion,
                "emotion_peaks": emotion_peaks[:10],  # Top 10
                "attention_drops": attention_drops[:10],
                "overall_score": round(overall_score, 1)
            }

        db.table("reaction_sessions").update({
            "status": "completed",
            "summary": summary,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", session_id).execute()

    except Exception as e:
        logger.error(f"Reaction analysis failed for {session_id}: {e}")
        db.table("reaction_sessions").update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", session_id).execute()


# =============================================================================
# Session Retrieval
# =============================================================================

@router.get("/sessions", response_model=list[ReactionSession])
async def list_sessions(
    analysis_id: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """List reaction sessions for the organization"""
    query = db.table("reaction_sessions").select("*").eq(
        "organization_id", org.id
    ).order("created_at", desc=True).range(offset, offset + limit - 1)

    if analysis_id:
        query = query.eq("analysis_id", analysis_id)

    result = query.execute()

    return [
        ReactionSession(
            id=s["id"],
            analysis_id=s["analysis_id"],
            participant_id=s.get("participant_id"),
            status=s["status"],
            duration=s.get("duration"),
            frame_count=s.get("frame_count", 0),
            emotion_timeline=s.get("emotion_timeline", []),
            summary=s.get("summary"),
            created_at=s["created_at"]
        )
        for s in (result.data or [])
    ]


@router.get("/sessions/{session_id}", response_model=ReactionSession)
async def get_session(
    session_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get a specific reaction session"""
    result = db.table("reaction_sessions").select("*").eq(
        "id", session_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    s = result.data
    return ReactionSession(
        id=s["id"],
        analysis_id=s["analysis_id"],
        participant_id=s.get("participant_id"),
        status=s["status"],
        duration=s.get("duration"),
        frame_count=s.get("frame_count", 0),
        emotion_timeline=s.get("emotion_timeline", []),
        summary=s.get("summary"),
        created_at=s["created_at"]
    )


@router.get("/sessions/{session_id}/summary", response_model=ReactionSummary)
async def get_session_summary(
    session_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get just the summary for a reaction session"""
    result = db.table("reaction_sessions").select("summary, status").eq(
        "id", session_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    if result.data["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Session is {result.data['status']}, not completed"
        )

    summary = result.data.get("summary", {})
    return ReactionSummary(**summary)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Delete a reaction session"""
    result = db.table("reaction_sessions").select("id").eq(
        "id", session_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    db.table("reaction_sessions").delete().eq("id", session_id).execute()

    return {"message": "Session deleted"}


# =============================================================================
# Aggregated Analysis
# =============================================================================

@router.get("/analysis/{analysis_id}/aggregate")
async def get_aggregated_reactions(
    analysis_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Get aggregated reaction data across all sessions for an analysis.

    Combines data from multiple viewer sessions to identify
    consistent patterns and moments.
    """
    result = db.table("reaction_sessions").select(
        "summary, frame_count"
    ).eq("analysis_id", analysis_id).eq(
        "organization_id", org.id
    ).eq("status", "completed").execute()

    sessions = result.data or []

    if not sessions:
        return {
            "session_count": 0,
            "total_frames": 0,
            "aggregate": None
        }

    # Aggregate summaries
    total_attention = 0
    total_engagement = 0
    total_score = 0
    emotion_counts = {}
    all_peaks = []
    all_drops = []
    total_frames = 0

    for session in sessions:
        summary = session.get("summary", {})
        total_attention += summary.get("average_attention", 0)
        total_engagement += summary.get("average_engagement", 0)
        total_score += summary.get("overall_score", 0)
        total_frames += session.get("frame_count", 0)

        emotion = summary.get("dominant_emotion", "neutral")
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

        all_peaks.extend(summary.get("emotion_peaks", []))
        all_drops.extend(summary.get("attention_drops", []))

    n = len(sessions)
    dominant_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "neutral"

    return {
        "session_count": n,
        "total_frames": total_frames,
        "aggregate": {
            "average_attention": round(total_attention / n, 3),
            "average_engagement": round(total_engagement / n, 3),
            "average_score": round(total_score / n, 1),
            "dominant_emotion": dominant_emotion,
            "emotion_distribution": emotion_counts,
            "common_peaks": sorted(all_peaks, key=lambda x: x.get("engagement", 0), reverse=True)[:5],
            "common_drops": sorted(all_drops, key=lambda x: x.get("attention", 1))[:5]
        }
    }
