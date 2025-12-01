"""Ad Script Lab Router

Handles AI-powered ad script generation using multi-agent system.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
import logging
import json
import asyncio

from api.deps import (
    DB, User, Org, ProOrEnterprise,
    get_current_user, get_current_organization, get_db
)

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Models
# =============================================================================

class ScriptTone(str, Enum):
    professional = "professional"
    casual = "casual"
    humorous = "humorous"
    emotional = "emotional"
    urgent = "urgent"


class TargetAudience(BaseModel):
    age_range: str = Field(default="25-54", description="Target age range")
    demographics: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)


class ScriptRequest(BaseModel):
    """Request to generate an ad script"""
    product_name: str = Field(..., min_length=1, max_length=200)
    product_description: str = Field(..., min_length=10, max_length=2000)
    duration: int = Field(default=30, ge=15, le=120, description="Target duration in seconds")
    tone: ScriptTone = Field(default=ScriptTone.professional)
    target_audience: Optional[TargetAudience] = None
    key_messages: list[str] = Field(default_factory=list, max_length=5)
    call_to_action: Optional[str] = None
    style_references: list[str] = Field(default_factory=list, description="Reference ad IDs")
    compliance_check: bool = Field(default=True, description="Run Clearcast check")
    industry: Optional[str] = Field(default=None, description="Industry for compliance rules")


class ScriptVersion(BaseModel):
    version: int
    content: str
    scenes: list[dict]
    voiceover: str
    compliance_notes: Optional[list[str]] = None
    created_at: str


class ScriptResponse(BaseModel):
    id: str
    status: Literal["pending", "generating", "completed", "failed"]
    product_name: str
    duration: int
    versions: list[ScriptVersion]
    selected_version: Optional[int] = None
    storyboard_id: Optional[str] = None
    created_at: str
    updated_at: str


class ScriptFeedback(BaseModel):
    """Feedback for script iteration"""
    feedback: str = Field(..., min_length=10, max_length=1000)
    aspects: list[str] = Field(
        default_factory=list,
        description="Aspects to improve: tone, pacing, visuals, dialogue, cta"
    )


class ScriptExportFormat(str, Enum):
    pdf = "pdf"
    docx = "docx"
    json = "json"
    fdx = "fdx"  # Final Draft format


# =============================================================================
# Script Generation
# =============================================================================

@router.post("", response_model=ScriptResponse, status_code=201)
async def create_script(
    request: ScriptRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Generate a new ad script using AI multi-agent system.

    The generation process:
    1. Research Agent analyzes product and competitors
    2. Creative Agent generates initial concepts
    3. Writer Agent crafts the script
    4. Compliance Agent checks against BCAP codes

    Requires Pro or Enterprise subscription.
    """
    import uuid
    from datetime import datetime

    script_id = str(uuid.uuid4())

    # Create script record
    script_data = {
        "id": script_id,
        "organization_id": org.id,
        "created_by": user.id,
        "status": "pending",
        "product_name": request.product_name,
        "product_description": request.product_description,
        "duration": request.duration,
        "tone": request.tone.value,
        "target_audience": request.target_audience.model_dump() if request.target_audience else None,
        "key_messages": request.key_messages,
        "call_to_action": request.call_to_action,
        "style_references": request.style_references,
        "compliance_check": request.compliance_check,
        "industry": request.industry,
        "versions": [],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

    result = db.table("ad_scripts").insert(script_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create script")

    # Queue background generation
    background_tasks.add_task(
        _generate_script_async,
        db, script_id, request
    )

    return ScriptResponse(
        id=script_id,
        status="pending",
        product_name=request.product_name,
        duration=request.duration,
        versions=[],
        created_at=script_data["created_at"],
        updated_at=script_data["updated_at"]
    )


async def _generate_script_async(db, script_id: str, request: ScriptRequest):
    """Background task to generate script via multi-agent system"""
    from datetime import datetime

    try:
        # Update status to generating
        db.table("ad_scripts").update({
            "status": "generating",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", script_id).execute()

        # Import the script lab module
        try:
            from app.features.ad_script_lab.script_generator import generate_script

            # Generate script
            result = await generate_script(
                product_name=request.product_name,
                product_description=request.product_description,
                duration=request.duration,
                tone=request.tone.value,
                target_audience=request.target_audience.model_dump() if request.target_audience else None,
                key_messages=request.key_messages,
                call_to_action=request.call_to_action,
                run_compliance=request.compliance_check,
                industry=request.industry
            )

            # Create version from result
            version = {
                "version": 1,
                "content": result.get("script", ""),
                "scenes": result.get("scenes", []),
                "voiceover": result.get("voiceover", ""),
                "compliance_notes": result.get("compliance_notes", []),
                "created_at": datetime.utcnow().isoformat()
            }

            db.table("ad_scripts").update({
                "status": "completed",
                "versions": [version],
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", script_id).execute()

        except ImportError:
            # Fallback if module not available
            logger.warning("Ad Script Lab module not available, using placeholder")

            version = {
                "version": 1,
                "content": f"[Script for {request.product_name}]\n\nDuration: {request.duration}s\nTone: {request.tone.value}\n\n[Script generation requires Ad Script Lab module]",
                "scenes": [],
                "voiceover": "",
                "compliance_notes": ["Module not configured"],
                "created_at": datetime.utcnow().isoformat()
            }

            db.table("ad_scripts").update({
                "status": "completed",
                "versions": [version],
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", script_id).execute()

    except Exception as e:
        logger.error(f"Script generation failed for {script_id}: {e}")
        db.table("ad_scripts").update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", script_id).execute()


@router.get("", response_model=list[ScriptResponse])
async def list_scripts(
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """List all scripts for the organization"""
    query = db.table("ad_scripts").select("*").eq(
        "organization_id", org.id
    ).order("created_at", desc=True).range(offset, offset + limit - 1)

    if status:
        query = query.eq("status", status)

    result = query.execute()

    return [
        ScriptResponse(
            id=s["id"],
            status=s["status"],
            product_name=s["product_name"],
            duration=s["duration"],
            versions=s.get("versions", []),
            selected_version=s.get("selected_version"),
            storyboard_id=s.get("storyboard_id"),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )
        for s in (result.data or [])
    ]


@router.get("/{script_id}", response_model=ScriptResponse)
async def get_script(
    script_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get a specific script with all versions"""
    result = db.table("ad_scripts").select("*").eq(
        "id", script_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Script not found")

    s = result.data
    return ScriptResponse(
        id=s["id"],
        status=s["status"],
        product_name=s["product_name"],
        duration=s["duration"],
        versions=s.get("versions", []),
        selected_version=s.get("selected_version"),
        storyboard_id=s.get("storyboard_id"),
        created_at=s["created_at"],
        updated_at=s["updated_at"]
    )


@router.get("/{script_id}/status")
async def get_script_status(
    script_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get script generation status (for polling)"""
    result = db.table("ad_scripts").select(
        "id, status, updated_at"
    ).eq("id", script_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Script not found")

    return result.data


# =============================================================================
# Script Iteration
# =============================================================================

@router.post("/{script_id}/iterate", response_model=ScriptResponse)
async def iterate_script(
    script_id: str,
    feedback: ScriptFeedback,
    background_tasks: BackgroundTasks,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Generate a new version of the script based on feedback.

    The AI will analyze the feedback and create an improved version
    while maintaining the core concept and requirements.
    """
    from datetime import datetime

    result = db.table("ad_scripts").select("*").eq(
        "id", script_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Script not found")

    script = result.data

    if script["status"] == "generating":
        raise HTTPException(
            status_code=400,
            detail="Script is still being generated"
        )

    # Update status
    db.table("ad_scripts").update({
        "status": "generating",
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", script_id).execute()

    # Queue iteration
    background_tasks.add_task(
        _iterate_script_async,
        db, script_id, script, feedback
    )

    return ScriptResponse(
        id=script["id"],
        status="generating",
        product_name=script["product_name"],
        duration=script["duration"],
        versions=script.get("versions", []),
        selected_version=script.get("selected_version"),
        storyboard_id=script.get("storyboard_id"),
        created_at=script["created_at"],
        updated_at=datetime.utcnow().isoformat()
    )


async def _iterate_script_async(db, script_id: str, script: dict, feedback: ScriptFeedback):
    """Background task to iterate on script"""
    from datetime import datetime

    try:
        versions = script.get("versions", [])
        latest_version = versions[-1] if versions else None
        new_version_num = len(versions) + 1

        try:
            from app.features.ad_script_lab.script_generator import iterate_script

            result = await iterate_script(
                current_script=latest_version.get("content", "") if latest_version else "",
                feedback=feedback.feedback,
                aspects=feedback.aspects,
                product_name=script["product_name"],
                duration=script["duration"]
            )

            new_version = {
                "version": new_version_num,
                "content": result.get("script", ""),
                "scenes": result.get("scenes", []),
                "voiceover": result.get("voiceover", ""),
                "compliance_notes": result.get("compliance_notes", []),
                "created_at": datetime.utcnow().isoformat()
            }

        except ImportError:
            new_version = {
                "version": new_version_num,
                "content": f"[Iterated version {new_version_num}]\n\nFeedback: {feedback.feedback}\n\n[Iteration requires Ad Script Lab module]",
                "scenes": [],
                "voiceover": "",
                "compliance_notes": ["Module not configured"],
                "created_at": datetime.utcnow().isoformat()
            }

        versions.append(new_version)

        db.table("ad_scripts").update({
            "status": "completed",
            "versions": versions,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", script_id).execute()

    except Exception as e:
        logger.error(f"Script iteration failed for {script_id}: {e}")
        db.table("ad_scripts").update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", script_id).execute()


@router.post("/{script_id}/select-version")
async def select_version(
    script_id: str,
    version: int,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Select a version as the final script"""
    from datetime import datetime

    result = db.table("ad_scripts").select("versions").eq(
        "id", script_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Script not found")

    versions = result.data.get("versions", [])
    if version < 1 or version > len(versions):
        raise HTTPException(status_code=400, detail="Invalid version number")

    db.table("ad_scripts").update({
        "selected_version": version,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", script_id).execute()

    return {"message": f"Version {version} selected", "version": version}


# =============================================================================
# Export & Storyboard
# =============================================================================

@router.get("/{script_id}/export")
async def export_script(
    script_id: str,
    format: ScriptExportFormat = ScriptExportFormat.pdf,
    version: Optional[int] = None,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Export script in various formats"""
    result = db.table("ad_scripts").select("*").eq(
        "id", script_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Script not found")

    script = result.data
    versions = script.get("versions", [])

    # Get specific version or selected/latest
    if version:
        if version < 1 or version > len(versions):
            raise HTTPException(status_code=400, detail="Invalid version")
        selected = versions[version - 1]
    else:
        v = script.get("selected_version")
        selected = versions[v - 1] if v else versions[-1] if versions else None

    if not selected:
        raise HTTPException(status_code=400, detail="No script version available")

    if format == ScriptExportFormat.json:
        return {
            "script_id": script_id,
            "product_name": script["product_name"],
            "duration": script["duration"],
            "version": selected["version"],
            "content": selected["content"],
            "scenes": selected.get("scenes", []),
            "voiceover": selected.get("voiceover", "")
        }

    elif format == ScriptExportFormat.pdf:
        try:
            from app.features.ad_script_lab.export import export_script_pdf

            pdf_bytes = await export_script_pdf(script, selected)

            return StreamingResponse(
                iter([pdf_bytes]),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{script["product_name"]}_script_v{selected["version"]}.pdf"'
                }
            )
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="PDF export not available"
            )

    else:
        raise HTTPException(
            status_code=501,
            detail=f"Export format {format.value} not implemented"
        )


@router.post("/{script_id}/storyboard")
async def generate_storyboard(
    script_id: str,
    version: Optional[int] = None,
    background_tasks: BackgroundTasks = None,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Generate a visual storyboard from the script.

    Creates scene-by-scene visual representations using AI image generation.
    """
    import uuid
    from datetime import datetime

    result = db.table("ad_scripts").select("*").eq(
        "id", script_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Script not found")

    script = result.data
    versions = script.get("versions", [])

    # Get version
    if version:
        if version < 1 or version > len(versions):
            raise HTTPException(status_code=400, detail="Invalid version")
        selected = versions[version - 1]
    else:
        v = script.get("selected_version")
        selected = versions[v - 1] if v else versions[-1] if versions else None

    if not selected:
        raise HTTPException(status_code=400, detail="No script version available")

    # Create storyboard record
    storyboard_id = str(uuid.uuid4())

    storyboard_data = {
        "id": storyboard_id,
        "organization_id": org.id,
        "script_id": script_id,
        "script_version": selected["version"],
        "status": "pending",
        "frames": [],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

    db.table("storyboards").insert(storyboard_data).execute()

    # Update script with storyboard reference
    db.table("ad_scripts").update({
        "storyboard_id": storyboard_id,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", script_id).execute()

    # Queue storyboard generation
    if background_tasks:
        background_tasks.add_task(
            _generate_storyboard_async,
            db, storyboard_id, script, selected
        )

    return {
        "storyboard_id": storyboard_id,
        "status": "pending",
        "message": "Storyboard generation started"
    }


async def _generate_storyboard_async(db, storyboard_id: str, script: dict, version: dict):
    """Background task to generate storyboard frames"""
    from datetime import datetime

    try:
        db.table("storyboards").update({
            "status": "generating",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", storyboard_id).execute()

        try:
            from app.features.ad_script_lab.storyboard_generator import generate_storyboard

            frames = await generate_storyboard(
                scenes=version.get("scenes", []),
                product_name=script["product_name"],
                duration=script["duration"]
            )

            db.table("storyboards").update({
                "status": "completed",
                "frames": frames,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", storyboard_id).execute()

        except ImportError:
            db.table("storyboards").update({
                "status": "completed",
                "frames": [{"frame": 1, "description": "Storyboard module not available"}],
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", storyboard_id).execute()

    except Exception as e:
        logger.error(f"Storyboard generation failed: {e}")
        db.table("storyboards").update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", storyboard_id).execute()


@router.delete("/{script_id}")
async def delete_script(
    script_id: str,
    user: User = Depends(ProOrEnterprise),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Delete a script and associated storyboard"""
    result = db.table("ad_scripts").select("storyboard_id").eq(
        "id", script_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Script not found")

    # Delete storyboard if exists
    if result.data.get("storyboard_id"):
        db.table("storyboards").delete().eq(
            "id", result.data["storyboard_id"]
        ).execute()

    # Delete script
    db.table("ad_scripts").delete().eq("id", script_id).execute()

    return {"message": "Script deleted"}
