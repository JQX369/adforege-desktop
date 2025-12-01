"""Projects Router

Handles project (campaign) management - listing, details, deletion.
Projects are containers for video analyses.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from api.deps import DB, User, Org, get_current_user, get_current_organization

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Models
# =============================================================================

class ProjectResponse(BaseModel):
    id: str
    video_name: str
    created_at: str
    status: str
    thumbnail_url: Optional[str] = None
    avg_engagement: float = 0.0
    ai_effectiveness: Optional[float] = None
    has_clearcast: bool = False
    has_reactions: bool = False


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
    limit: int
    offset: int


class ProjectStats(BaseModel):
    total_projects: int
    completed: int
    processing: int
    failed: int
    this_month: int


# =============================================================================
# Endpoints
# =============================================================================

@router.get("", response_model=ProjectListResponse)
async def list_projects(
    user: User,
    org: Org,
    db: DB,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None
):
    """
    List all projects for the organization.

    Query params:
    - limit: Max results (default 50)
    - offset: Pagination offset
    - status: Filter by status (pending, processing, completed, failed)
    """
    query = db.table("analyses").select(
        "id, video_name, created_at, status, thumbnail_url, "
        "avg_engagement, ai_effectiveness, clearcast_check, ai_breakdown",
        count="exact"
    ).eq("organization_id", org.id)

    if status:
        query = query.eq("status", status)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()

    projects = []
    for row in result.data or []:
        projects.append(ProjectResponse(
            id=row["id"],
            video_name=row["video_name"],
            created_at=row["created_at"],
            status=row.get("status", "completed"),
            thumbnail_url=row.get("thumbnail_url"),
            avg_engagement=row.get("avg_engagement", 0.0),
            ai_effectiveness=_extract_effectiveness(row.get("ai_breakdown")),
            has_clearcast=bool(row.get("clearcast_check")),
            has_reactions=False  # Would need to check reactions table
        ))

    return ProjectListResponse(
        projects=projects,
        total=result.count or len(projects),
        limit=limit,
        offset=offset
    )


@router.get("/stats", response_model=ProjectStats)
async def get_project_stats(user: User, org: Org, db: DB):
    """Get project statistics for the organization"""
    # Total projects
    total_result = db.table("analyses").select(
        "id", count="exact"
    ).eq("organization_id", org.id).execute()

    # By status
    completed = db.table("analyses").select(
        "id", count="exact"
    ).eq("organization_id", org.id).eq("status", "completed").execute()

    processing = db.table("analyses").select(
        "id", count="exact"
    ).eq("organization_id", org.id).eq("status", "processing").execute()

    failed = db.table("analyses").select(
        "id", count="exact"
    ).eq("organization_id", org.id).eq("status", "failed").execute()

    # This month
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0).isoformat()
    this_month = db.table("analyses").select(
        "id", count="exact"
    ).eq("organization_id", org.id).gte("created_at", month_start).execute()

    return ProjectStats(
        total_projects=total_result.count or 0,
        completed=completed.count or 0,
        processing=processing.count or 0,
        failed=failed.count or 0,
        this_month=this_month.count or 0
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    user: User,
    org: Org,
    db: DB
):
    """Get a specific project by ID"""
    result = db.table("analyses").select("*").eq(
        "id", project_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    row = result.data
    return ProjectResponse(
        id=row["id"],
        video_name=row["video_name"],
        created_at=row["created_at"],
        status=row.get("status", "completed"),
        thumbnail_url=row.get("thumbnail_url"),
        avg_engagement=row.get("avg_engagement", 0.0),
        ai_effectiveness=_extract_effectiveness(row.get("ai_breakdown")),
        has_clearcast=bool(row.get("clearcast_check")),
        has_reactions=False
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: User,
    org: Org,
    db: DB
):
    """
    Delete a project and all associated data.

    This will delete:
    - The analysis record
    - Associated reactions
    - Video files from storage
    """
    # Verify project exists and belongs to org
    result = db.table("analyses").select("id, video_url").eq(
        "id", project_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete associated reactions
    db.table("reactions").delete().eq("analysis_id", project_id).execute()

    # Delete the analysis
    db.table("analyses").delete().eq("id", project_id).execute()

    # TODO: Delete video file from Supabase Storage

    logger.info(f"Deleted project {project_id} for org {org.id}")

    return {"message": "Project deleted", "id": project_id}


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    video_name: Optional[str] = None,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Update project metadata (e.g., rename)"""
    # Verify project exists and belongs to org
    result = db.table("analyses").select("id").eq(
        "id", project_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = {}
    if video_name:
        update_data["video_name"] = video_name

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    db.table("analyses").update(update_data).eq("id", project_id).execute()

    return {"message": "Project updated"}


# =============================================================================
# Helpers
# =============================================================================

def _extract_effectiveness(ai_breakdown: Optional[dict]) -> Optional[float]:
    """Extract effectiveness score from AI breakdown"""
    if not ai_breakdown:
        return None
    outcome = ai_breakdown.get("outcome")
    if isinstance(outcome, dict):
        return outcome.get("effectiveness_score")
    return None
