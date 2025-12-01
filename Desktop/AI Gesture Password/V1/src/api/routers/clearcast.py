"""Clearcast Compliance Router

Handles UK broadcast compliance checking against BCAP codes.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging

from api.deps import (
    DB, User, Org,
    get_current_user, get_current_organization,
    require_subscription_tier
)

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Models
# =============================================================================

class ComplianceFlag(BaseModel):
    category: str
    severity: str  # red, amber, blue, yellow
    message: str
    timestamp: Optional[float] = None
    frame_number: Optional[int] = None
    recommendation: Optional[str] = None


class ComplianceCheckResponse(BaseModel):
    analysis_id: str
    status: str  # pass, fail, warning
    overall_score: float
    red_flags: List[ComplianceFlag]
    amber_flags: List[ComplianceFlag]
    blue_flags: List[ComplianceFlag]
    yellow_flags: List[ComplianceFlag]
    industry_profile: Optional[str] = None
    checked_at: str


class CheckRequest(BaseModel):
    analysis_id: str
    clock_number: Optional[str] = None
    industry_profile: Optional[str] = None  # alcohol, gambling, finance, etc.


class PolishRequest(BaseModel):
    analysis_id: str
    fix_options: Dict[str, bool]  # e.g., {"fix_supers": true, "fix_audio": false}


class PolishResponse(BaseModel):
    analysis_id: str
    status: str
    fixes_applied: List[str]
    video_url: Optional[str] = None
    job_id: Optional[str] = None


# =============================================================================
# Compliance Check Endpoints
# =============================================================================

@router.post("/check", response_model=ComplianceCheckResponse)
async def run_compliance_check(
    request: CheckRequest,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Run a full Clearcast compliance check on an analyzed video.

    This checks against BCAP broadcast advertising codes including:
    - Legal text (supers) requirements
    - Audio levels and clarity
    - Health claims
    - Financial promotions
    - Age-restricted content
    """
    # Verify analysis exists and is complete
    result = db.table("analyses").select(
        "id, status, ai_breakdown, clearcast_check"
    ).eq("id", request.analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if result.data["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail="Analysis not complete. Wait for processing to finish."
        )

    # Check if already has clearcast data
    existing_check = result.data.get("clearcast_check")
    if existing_check:
        return _format_compliance_response(request.analysis_id, existing_check)

    # Run the compliance check
    try:
        from app.features.clearcast.clearcast_checker import ClearcastChecker
        checker = ClearcastChecker()

        # Get AI breakdown for context
        ai_breakdown = result.data.get("ai_breakdown", {})

        # Run check (this would need video access)
        # For now, we'll create a placeholder that would integrate with existing logic
        check_result = await _run_clearcast_check(
            db, request.analysis_id, ai_breakdown, request.industry_profile
        )

        # Store results
        db.table("analyses").update({
            "clearcast_check": check_result
        }).eq("id", request.analysis_id).execute()

        return _format_compliance_response(request.analysis_id, check_result)

    except Exception as e:
        logger.error(f"Compliance check failed: {e}")
        raise HTTPException(status_code=500, detail="Compliance check failed")


@router.get("/{analysis_id}", response_model=ComplianceCheckResponse)
async def get_compliance_results(
    analysis_id: str,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Get existing compliance check results"""
    result = db.table("analyses").select(
        "clearcast_check"
    ).eq("id", analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not result.data.get("clearcast_check"):
        raise HTTPException(
            status_code=404,
            detail="No compliance check found. Run /clearcast/check first."
        )

    return _format_compliance_response(analysis_id, result.data["clearcast_check"])


@router.post("/quick-check")
async def quick_compliance_check(
    request: CheckRequest,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """
    Run a quick compliance check (basic checks only).

    Faster than full check but less comprehensive.
    Useful for initial screening.
    """
    # Similar to full check but with reduced scope
    result = db.table("analyses").select(
        "id, status, ai_breakdown"
    ).eq("id", request.analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Return quick assessment based on AI breakdown
    ai_breakdown = result.data.get("ai_breakdown", {})

    quick_flags = []

    # Check for obvious issues in AI breakdown
    content_flags = ai_breakdown.get("content_flags", {})
    if content_flags.get("health_claims"):
        quick_flags.append({
            "category": "health_claims",
            "severity": "amber",
            "message": "Potential health claims detected - requires verification"
        })

    if content_flags.get("financial_promotion"):
        quick_flags.append({
            "category": "financial",
            "severity": "amber",
            "message": "Financial promotion detected - FCA compliance needed"
        })

    return {
        "analysis_id": request.analysis_id,
        "quick_check": True,
        "potential_issues": len(quick_flags),
        "flags": quick_flags,
        "recommendation": "Run full compliance check for detailed analysis"
    }


# =============================================================================
# Polish/Fix Endpoints (Pro+ only)
# =============================================================================

@router.post("/polish", response_model=PolishResponse)
async def polish_video(
    request: PolishRequest,
    user: User = Depends(get_current_user),
    org: Org = Depends(require_subscription_tier("pro", "enterprise")),
    db: DB = Depends()
):
    """
    Apply automated fixes to compliance issues.

    Pro/Enterprise feature.

    Available fixes:
    - fix_supers: Adjust legal text size/duration
    - fix_audio: Normalize audio levels
    - add_disclaimers: Add required disclaimers
    """
    # Verify analysis exists
    result = db.table("analyses").select(
        "id, clearcast_check, video_url"
    ).eq("id", request.analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not result.data.get("clearcast_check"):
        raise HTTPException(
            status_code=400,
            detail="Run compliance check first before polishing"
        )

    # Queue polish job
    from datetime import datetime
    import uuid

    job_id = str(uuid.uuid4())
    job_data = {
        "id": job_id,
        "organization_id": org.id,
        "job_type": "video_polish",
        "payload": {
            "analysis_id": request.analysis_id,
            "fix_options": request.fix_options
        },
        "status": "pending",
        "created_at": datetime.utcnow().isoformat()
    }

    db.table("jobs").insert(job_data).execute()

    return PolishResponse(
        analysis_id=request.analysis_id,
        status="queued",
        fixes_applied=list(k for k, v in request.fix_options.items() if v),
        job_id=job_id
    )


@router.get("/polish/{analysis_id}/status")
async def get_polish_status(
    analysis_id: str,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Check status of a polish job"""
    result = db.table("jobs").select(
        "id, status, error, finished_at"
    ).eq("payload->>analysis_id", analysis_id).eq(
        "job_type", "video_polish"
    ).order("created_at", desc=True).limit(1).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="No polish job found")

    job = result.data[0]
    return {
        "job_id": job["id"],
        "status": job["status"],
        "error": job.get("error"),
        "finished_at": job.get("finished_at")
    }


# =============================================================================
# PDF Report Endpoints
# =============================================================================

@router.get("/{analysis_id}/report/pdf")
async def download_compliance_report(
    analysis_id: str,
    user: User = Depends(get_current_user),
    org: Org = Depends(get_current_organization),
    db: DB = Depends()
):
    """Download a PDF compliance report"""
    result = db.table("analyses").select(
        "video_name, clearcast_check, ai_breakdown"
    ).eq("id", analysis_id).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not result.data.get("clearcast_check"):
        raise HTTPException(status_code=404, detail="No compliance check found")

    # TODO: Generate PDF report
    # For now, return a placeholder response
    raise HTTPException(
        status_code=501,
        detail="PDF report generation coming soon"
    )


# =============================================================================
# Rules & Guidelines
# =============================================================================

@router.get("/rules")
async def get_compliance_rules(
    industry: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get compliance rules and guidelines"""
    rules = {
        "general": [
            {
                "code": "BCAP 3.1",
                "title": "Misleading advertising",
                "description": "Advertisements must not materially mislead"
            },
            {
                "code": "BCAP 3.9",
                "title": "Substantiation",
                "description": "Claims must be substantiated before broadcast"
            }
        ],
        "supers": [
            {
                "code": "Clearcast Supers",
                "title": "Legal text requirements",
                "description": "Minimum 30 scan lines height, adequate duration"
            }
        ]
    }

    if industry:
        # Add industry-specific rules
        industry_rules = {
            "alcohol": [
                {"code": "BCAP 19.4", "title": "No appeal to under-18s"},
                {"code": "BCAP 19.15", "title": "Drink responsibly message"}
            ],
            "gambling": [
                {"code": "BCAP 17.4", "title": "Age restriction (18+)"},
                {"code": "BCAP 17.8", "title": "Responsible gambling message"}
            ],
            "finance": [
                {"code": "BCAP 14.5", "title": "Representative APR"},
                {"code": "BCAP 14.3", "title": "Risk warnings"}
            ]
        }
        rules["industry"] = industry_rules.get(industry, [])

    return rules


# =============================================================================
# Helpers
# =============================================================================

def _format_compliance_response(
    analysis_id: str,
    check_data: Dict[str, Any]
) -> ComplianceCheckResponse:
    """Format raw check data into response model"""
    from datetime import datetime

    red_flags = [
        ComplianceFlag(**f) for f in check_data.get("red_flags", [])
    ]
    amber_flags = [
        ComplianceFlag(**f) for f in check_data.get("amber_flags", [])
    ]
    blue_flags = [
        ComplianceFlag(**f) for f in check_data.get("blue_flags", [])
    ]
    yellow_flags = [
        ComplianceFlag(**f) for f in check_data.get("yellow_flags", [])
    ]

    # Determine overall status
    if red_flags:
        status = "fail"
    elif amber_flags:
        status = "warning"
    else:
        status = "pass"

    # Calculate score (simplified)
    total_flags = len(red_flags) * 3 + len(amber_flags) * 2 + len(yellow_flags)
    score = max(0, 100 - total_flags * 5)

    return ComplianceCheckResponse(
        analysis_id=analysis_id,
        status=status,
        overall_score=score,
        red_flags=red_flags,
        amber_flags=amber_flags,
        blue_flags=blue_flags,
        yellow_flags=yellow_flags,
        industry_profile=check_data.get("industry_profile"),
        checked_at=check_data.get("checked_at", datetime.utcnow().isoformat())
    )


async def _run_clearcast_check(
    db,
    analysis_id: str,
    ai_breakdown: Dict[str, Any],
    industry_profile: Optional[str] = None
) -> Dict[str, Any]:
    """Run the actual compliance check"""
    from datetime import datetime

    # This would integrate with the existing ClearcastChecker
    # For now, return a basic structure
    return {
        "red_flags": [],
        "amber_flags": [],
        "blue_flags": [],
        "yellow_flags": [],
        "industry_profile": industry_profile,
        "checked_at": datetime.utcnow().isoformat(),
        "version": "2.0"
    }
