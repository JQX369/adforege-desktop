"""Authentication Router

Handles user authentication, registration, and profile management.
Uses Supabase Auth for the underlying authentication.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging

from api.deps import (
    DB, User, Org, get_db, get_current_user, get_current_organization
)
from app.core.auth import (
    create_user_record,
    create_organization,
    add_user_to_organization,
    remove_user_from_organization,
    create_invitation,
    accept_invitation,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    organization_id: Optional[str] = None
    role: str


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    subscription_tier: str
    subscription_status: str
    monthly_analysis_limit: int
    monthly_analyses_used: int


class CreateOrganizationRequest(BaseModel):
    name: str
    slug: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: str = "member"


class AcceptInvitationRequest(BaseModel):
    invitation_id: str


class TeamMemberResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str


# =============================================================================
# Profile Endpoints
# =============================================================================

@router.get("/me", response_model=UserProfileResponse)
async def get_current_profile(user: User):
    """Get the current user's profile"""
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=None,  # Would need to fetch from users table
        avatar_url=None,
        organization_id=user.organization_id,
        role=user.role
    )


@router.get("/me/full", response_model=UserProfileResponse)
async def get_full_profile(user: User, db: DB):
    """Get the current user's full profile with all details"""
    result = db.table("users").select("*").eq("id", user.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = result.data
    return UserProfileResponse(
        id=profile["id"],
        email=profile["email"],
        full_name=profile.get("full_name"),
        avatar_url=profile.get("avatar_url"),
        organization_id=profile.get("organization_id"),
        role=profile.get("role", "member")
    )


@router.patch("/me")
async def update_profile(
    data: UpdateProfileRequest,
    user: User,
    db: DB
):
    """Update the current user's profile"""
    update_data = {}
    if data.full_name is not None:
        update_data["full_name"] = data.full_name
    if data.avatar_url is not None:
        update_data["avatar_url"] = data.avatar_url

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    db.table("users").update(update_data).eq("id", user.id).execute()

    return {"message": "Profile updated"}


# =============================================================================
# Organization Endpoints
# =============================================================================

@router.get("/organization", response_model=OrganizationResponse)
async def get_organization(org: Org):
    """Get the current user's organization"""
    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        subscription_tier=org.subscription_tier,
        subscription_status=org.subscription_status,
        monthly_analysis_limit=org.monthly_analysis_limit,
        monthly_analyses_used=org.monthly_analyses_used
    )


@router.post("/organization", response_model=OrganizationResponse, status_code=201)
async def create_new_organization(
    data: CreateOrganizationRequest,
    user: User,
    db: DB
):
    """Create a new organization (user becomes owner)"""
    if user.organization_id:
        raise HTTPException(
            status_code=400,
            detail="You are already part of an organization. Leave it first."
        )

    try:
        org = await create_organization(db, data.name, user.id, data.slug)

        return OrganizationResponse(
            id=org["id"],
            name=org["name"],
            slug=org["slug"],
            subscription_tier=org.get("subscription_tier", "free"),
            subscription_status=org.get("subscription_status", "active"),
            monthly_analysis_limit=org.get("monthly_analysis_limit", 5),
            monthly_analyses_used=org.get("monthly_analyses_used", 0)
        )
    except Exception as e:
        logger.error(f"Failed to create organization: {e}")
        raise HTTPException(status_code=500, detail="Failed to create organization")


@router.patch("/organization")
async def update_organization(
    name: str,
    user: User,
    org: Org,
    db: DB
):
    """Update organization name (owner/admin only)"""
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can update organization")

    db.table("organizations").update({"name": name}).eq("id", org.id).execute()

    return {"message": "Organization updated"}


@router.post("/organization/leave")
async def leave_organization(user: User, db: DB):
    """Leave the current organization"""
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="Not part of an organization")

    if user.role == "owner":
        raise HTTPException(
            status_code=400,
            detail="Owners cannot leave. Transfer ownership or delete the organization."
        )

    await remove_user_from_organization(db, user.id)

    return {"message": "Left organization"}


# =============================================================================
# Team Management Endpoints
# =============================================================================

@router.get("/organization/members", response_model=list[TeamMemberResponse])
async def list_team_members(org: Org, db: DB):
    """List all members of the organization"""
    result = db.table("users").select(
        "id, email, full_name, role"
    ).eq("organization_id", org.id).execute()

    return [
        TeamMemberResponse(
            id=m["id"],
            email=m["email"],
            full_name=m.get("full_name"),
            role=m.get("role", "member")
        )
        for m in result.data or []
    ]


@router.post("/organization/invite")
async def invite_team_member(
    data: InviteUserRequest,
    user: User,
    org: Org,
    db: DB
):
    """Invite a user to join the organization"""
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can invite")

    # Check team limit
    from app.core.billing import get_team_limit
    team_limit = get_team_limit(org.subscription_tier)

    if team_limit != -1:
        current_members = db.table("users").select(
            "id", count="exact"
        ).eq("organization_id", org.id).execute()

        if current_members.count >= team_limit:
            raise HTTPException(
                status_code=403,
                detail=f"Team member limit reached ({team_limit}). Upgrade to add more."
            )

    invitation = await create_invitation(
        db, org.id, data.email, data.role, user.id
    )

    # TODO: Send invitation email

    return {"message": "Invitation sent", "invitation_id": invitation["id"]}


@router.post("/invitation/accept")
async def accept_team_invitation(
    data: AcceptInvitationRequest,
    user: User,
    db: DB
):
    """Accept an organization invitation"""
    if user.organization_id:
        raise HTTPException(
            status_code=400,
            detail="Already part of an organization. Leave it first."
        )

    success = await accept_invitation(db, data.invitation_id, user.id)

    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    return {"message": "Invitation accepted"}


@router.patch("/organization/members/{member_id}/role")
async def update_member_role(
    member_id: str,
    role: str,
    user: User,
    org: Org,
    db: DB
):
    """Update a team member's role (owner only)"""
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can change roles")

    if role not in ("admin", "member", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")

    if member_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # Verify member is in the same org
    result = db.table("users").select("id").eq(
        "id", member_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Member not found")

    db.table("users").update({"role": role}).eq("id", member_id).execute()

    return {"message": "Role updated"}


@router.delete("/organization/members/{member_id}")
async def remove_team_member(
    member_id: str,
    user: User,
    org: Org,
    db: DB
):
    """Remove a member from the organization (owner/admin only)"""
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

    if member_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    # Check if target is owner
    result = db.table("users").select("role").eq(
        "id", member_id
    ).eq("organization_id", org.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Member not found")

    if result.data["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    await remove_user_from_organization(db, member_id)

    return {"message": "Member removed"}
