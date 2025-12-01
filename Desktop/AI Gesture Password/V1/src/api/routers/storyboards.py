"""Storyboards Router

Handles visual storyboard management and frame operations.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
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

class StoryboardFrame(BaseModel):
    frame_number: int
    timestamp_start: float
    timestamp_end: float
    description: str
    image_url: Optional[str] = None
    notes: Optional[str] = None
    camera_direction: Optional[str] = None
    audio_notes: Optional[str] = None


class Storyboard(BaseModel):
    id: str
    script_id: Optional[str]
    analysis_id: Optional[str]
    title: str
    status: Literal["pending", "generating", "completed", "failed"]
    frames: list[StoryboardFrame]
    total_duration: Optional[float]
    created_at: str
    updated_at: str


class CreateStoryboardRequest(BaseModel):
    """Create storyboard from analysis or manually"""
    analysis_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    duration: Optional[float] = Field(default=30, ge=5, le=300)
    frame_count: int = Field(default=8, ge=4, le=30)


class UpdateFrameRequest(BaseModel):
    description: Optional[str] = None
    notes: Optional[str] = None
    camera_direction: Optional[str] = None
    audio_notes: Optional[str] = None


class RegenerateFrameRequest(BaseModel):
    prompt: Optional[str] = Field(
        default=None,
        description="Additional prompt guidance for regeneration"
    )


# =============================================================================
# Storyboard CRUD
# =============================================================================

@router.post("", response_model=Storyboard, status_code=201)
async def create_storyboard(
    request: CreateStoryboardRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Create a new storyboard.

    Can be created from an existing analysis (extracting key frames)
    or as a blank canvas for manual creation.
    """
    import uuid
    from datetime import datetime

    storyboard_id = str(uuid.uuid4())

    # If from analysis, verify it exists
    if request.analysis_id:
        analysis_result = db.table("analyses").select("id, duration").eq(
            "id", request.analysis_id
        ).eq("organization_id", org.id).single().execute()

        if not analysis_result.data:
            raise HTTPException(status_code=404, detail="Analysis not found")

        duration = analysis_result.data.get("duration", request.duration)
    else:
        duration = request.duration

    storyboard_data = {
        "id": storyboard_id,
        "organization_id": org.id,
        "created_by": user.id,
        "analysis_id": request.analysis_id,
        "script_id": None,
        "title": request.title,
        "status": "pending" if request.analysis_id else "completed",
        "frames": [],
        "total_duration": duration,
        "frame_count": request.frame_count,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

    result = db.table("storyboards").insert(storyboard_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create storyboard")

    # If from analysis, queue frame extraction
    if request.analysis_id:
        background_tasks.add_task(
            _extract_frames_async,
            db, storyboard_id, request.analysis_id, request.frame_count, duration
        )

    return Storyboard(
        id=storyboard_id,
        script_id=None,
        analysis_id=request.analysis_id,
        title=request.title,
        status=storyboard_data["status"],
        frames=[],
        total_duration=duration,
        created_at=storyboard_data["created_at"],
        updated_at=storyboard_data["updated_at"]
    )


async def _extract_frames_async(
    db, storyboard_id: str, analysis_id: str, frame_count: int, duration: float
):
    """Background task to extract key frames from analysis"""
    from datetime import datetime

    try:
        db.table("storyboards").update({
            "status": "generating",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", storyboard_id).execute()

        # Calculate frame timestamps
        interval = duration / frame_count
        frames = []

        for i in range(frame_count):
            timestamp_start = i * interval
            timestamp_end = min((i + 1) * interval, duration)

            frame = {
                "frame_number": i + 1,
                "timestamp_start": round(timestamp_start, 2),
                "timestamp_end": round(timestamp_end, 2),
                "description": f"Scene {i + 1}",
                "image_url": None,
                "notes": None,
                "camera_direction": None,
                "audio_notes": None
            }
            frames.append(frame)

        # Try to extract actual frames from video
        try:
            from app.features.reporting.storyboard_extractor import extract_key_frames

            extracted = await extract_key_frames(
                analysis_id=analysis_id,
                frame_count=frame_count
            )

            # Merge extracted data
            for i, extracted_frame in enumerate(extracted):
                if i < len(frames):
                    frames[i]["description"] = extracted_frame.get("description", frames[i]["description"])
                    frames[i]["image_url"] = extracted_frame.get("image_url")

        except ImportError:
            logger.warning("Frame extraction module not available")

        db.table("storyboards").update({
            "status": "completed",
            "frames": frames,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", storyboard_id).execute()

    except Exception as e:
        logger.error(f"Frame extraction failed for {storyboard_id}: {e}")
        db.table("storyboards").update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", storyboard_id).execute()


@router.get("", response_model=list[Storyboard])
async def list_storyboards(
    limit: int = 20,
    offset: int = 0,
    script_id: Optional[str] = None,
    analysis_id: Optional[str] = None,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """List all storyboards for the organization"""
    query = db.table("storyboards").select("*").eq(
        "organization_id", org.id
    ).order("created_at", desc=True).range(offset, offset + limit - 1)

    if script_id:
        query = query.eq("script_id", script_id)
    if analysis_id:
        query = query.eq("analysis_id", analysis_id)

    result = query.execute()

    return [
        Storyboard(
            id=s["id"],
            script_id=s.get("script_id"),
            analysis_id=s.get("analysis_id"),
            title=s["title"],
            status=s["status"],
            frames=s.get("frames", []),
            total_duration=s.get("total_duration"),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )
        for s in (result.data or [])
    ]


@router.get("/{storyboard_id}", response_model=Storyboard)
async def get_storyboard(
    storyboard_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get a specific storyboard with all frames"""
    result = db.table("storyboards").select("*").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    s = result.data
    return Storyboard(
        id=s["id"],
        script_id=s.get("script_id"),
        analysis_id=s.get("analysis_id"),
        title=s["title"],
        status=s["status"],
        frames=s.get("frames", []),
        total_duration=s.get("total_duration"),
        created_at=s["created_at"],
        updated_at=s["updated_at"]
    )


@router.patch("/{storyboard_id}")
async def update_storyboard(
    storyboard_id: str,
    title: Optional[str] = None,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Update storyboard metadata"""
    from datetime import datetime

    result = db.table("storyboards").select("id").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    updates = {"updated_at": datetime.utcnow().isoformat()}
    if title:
        updates["title"] = title

    db.table("storyboards").update(updates).eq("id", storyboard_id).execute()

    return {"message": "Storyboard updated"}


@router.delete("/{storyboard_id}")
async def delete_storyboard(
    storyboard_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Delete a storyboard"""
    result = db.table("storyboards").select("id").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    db.table("storyboards").delete().eq("id", storyboard_id).execute()

    return {"message": "Storyboard deleted"}


# =============================================================================
# Frame Operations
# =============================================================================

@router.get("/{storyboard_id}/frames/{frame_number}", response_model=StoryboardFrame)
async def get_frame(
    storyboard_id: str,
    frame_number: int,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get a specific frame from the storyboard"""
    result = db.table("storyboards").select("frames").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    frames = result.data.get("frames", [])

    for frame in frames:
        if frame.get("frame_number") == frame_number:
            return StoryboardFrame(**frame)

    raise HTTPException(status_code=404, detail="Frame not found")


@router.patch("/{storyboard_id}/frames/{frame_number}")
async def update_frame(
    storyboard_id: str,
    frame_number: int,
    updates: UpdateFrameRequest,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Update a specific frame's details"""
    from datetime import datetime

    result = db.table("storyboards").select("frames").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    frames = result.data.get("frames", [])
    frame_found = False

    for i, frame in enumerate(frames):
        if frame.get("frame_number") == frame_number:
            # Apply updates
            if updates.description is not None:
                frames[i]["description"] = updates.description
            if updates.notes is not None:
                frames[i]["notes"] = updates.notes
            if updates.camera_direction is not None:
                frames[i]["camera_direction"] = updates.camera_direction
            if updates.audio_notes is not None:
                frames[i]["audio_notes"] = updates.audio_notes
            frame_found = True
            break

    if not frame_found:
        raise HTTPException(status_code=404, detail="Frame not found")

    db.table("storyboards").update({
        "frames": frames,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", storyboard_id).execute()

    return {"message": f"Frame {frame_number} updated"}


@router.post("/{storyboard_id}/frames/{frame_number}/regenerate")
async def regenerate_frame(
    storyboard_id: str,
    frame_number: int,
    request: RegenerateFrameRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Regenerate a frame's image using AI"""
    from datetime import datetime

    result = db.table("storyboards").select("frames, analysis_id").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    frames = result.data.get("frames", [])
    frame_idx = None

    for i, frame in enumerate(frames):
        if frame.get("frame_number") == frame_number:
            frame_idx = i
            break

    if frame_idx is None:
        raise HTTPException(status_code=404, detail="Frame not found")

    # Queue regeneration
    background_tasks.add_task(
        _regenerate_frame_async,
        db, storyboard_id, frame_idx, frames, request.prompt
    )

    return {"status": "regenerating", "frame_number": frame_number}


async def _regenerate_frame_async(
    db, storyboard_id: str, frame_idx: int, frames: list, prompt: Optional[str]
):
    """Background task to regenerate frame image"""
    from datetime import datetime

    try:
        frame = frames[frame_idx]

        try:
            from app.features.ad_script_lab.image_generator import generate_frame_image

            image_url = await generate_frame_image(
                description=frame.get("description", ""),
                additional_prompt=prompt
            )

            frames[frame_idx]["image_url"] = image_url

        except ImportError:
            logger.warning("Image generation module not available")
            frames[frame_idx]["notes"] = (frames[frame_idx].get("notes") or "") + "\n[Image regeneration not available]"

        db.table("storyboards").update({
            "frames": frames,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", storyboard_id).execute()

    except Exception as e:
        logger.error(f"Frame regeneration failed: {e}")


@router.post("/{storyboard_id}/frames")
async def add_frame(
    storyboard_id: str,
    frame: StoryboardFrame,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Add a new frame to the storyboard"""
    from datetime import datetime

    result = db.table("storyboards").select("frames").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    frames = result.data.get("frames", [])

    # Ensure frame number is unique
    existing_numbers = {f.get("frame_number") for f in frames}
    if frame.frame_number in existing_numbers:
        # Auto-increment
        frame.frame_number = max(existing_numbers) + 1

    frames.append(frame.model_dump())

    # Sort by timestamp
    frames.sort(key=lambda x: x.get("timestamp_start", 0))

    db.table("storyboards").update({
        "frames": frames,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", storyboard_id).execute()

    return {"message": "Frame added", "frame_number": frame.frame_number}


@router.delete("/{storyboard_id}/frames/{frame_number}")
async def delete_frame(
    storyboard_id: str,
    frame_number: int,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Delete a frame from the storyboard"""
    from datetime import datetime

    result = db.table("storyboards").select("frames").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    frames = result.data.get("frames", [])
    original_count = len(frames)

    frames = [f for f in frames if f.get("frame_number") != frame_number]

    if len(frames) == original_count:
        raise HTTPException(status_code=404, detail="Frame not found")

    db.table("storyboards").update({
        "frames": frames,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", storyboard_id).execute()

    return {"message": f"Frame {frame_number} deleted"}


# =============================================================================
# Export
# =============================================================================

@router.get("/{storyboard_id}/export/pdf")
async def export_storyboard_pdf(
    storyboard_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Export storyboard as PDF"""
    result = db.table("storyboards").select("*").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    if result.data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Storyboard not ready for export")

    try:
        from app.features.reporting.storyboard_pdf import generate_storyboard_pdf

        pdf_bytes = await generate_storyboard_pdf(result.data)

        filename = f"{result.data['title'].replace(' ', '_')}_storyboard.pdf"

        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="PDF export not available"
        )


@router.get("/{storyboard_id}/export/json")
async def export_storyboard_json(
    storyboard_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Export storyboard as JSON"""
    result = db.table("storyboards").select("*").eq(
        "id", storyboard_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    s = result.data
    return {
        "id": s["id"],
        "title": s["title"],
        "total_duration": s.get("total_duration"),
        "frames": s.get("frames", []),
        "created_at": s["created_at"]
    }
