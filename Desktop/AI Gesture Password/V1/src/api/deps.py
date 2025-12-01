"""FastAPI Dependency Injection

This module provides dependency injection for common resources across all routers:
- Database client (Supabase)
- Current authenticated user
- Current organization
- Subscription tier checks
- Rate limiting
"""

from typing import Optional, Annotated
from fastapi import Depends, HTTPException, Header, status
from pydantic import BaseModel
import logging

from app.core.database import get_supabase_client, SupabaseClient
from app.core.auth import verify_supabase_token, get_user_from_token

logger = logging.getLogger(__name__)


# =============================================================================
# Models
# =============================================================================

class CurrentUser(BaseModel):
    """Authenticated user from Supabase Auth"""
    id: str
    email: str
    organization_id: Optional[str] = None
    role: str = "member"  # owner, admin, member, viewer


class CurrentOrganization(BaseModel):
    """Current user's organization with subscription info"""
    id: str
    name: str
    slug: str
    subscription_tier: str  # free, pro, enterprise
    subscription_status: str  # active, past_due, canceled
    monthly_analysis_limit: int
    monthly_analyses_used: int


# =============================================================================
# Database Dependencies
# =============================================================================

async def get_db() -> SupabaseClient:
    """Get Supabase database client"""
    return get_supabase_client()


# =============================================================================
# Authentication Dependencies
# =============================================================================

async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: SupabaseClient = Depends(get_db)
) -> CurrentUser:
    """
    Extract and validate the current user from the Authorization header.

    The header should be: "Bearer <supabase_access_token>"
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]  # Remove "Bearer " prefix

    try:
        # Verify token with Supabase
        user_data = await verify_supabase_token(token)

        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get user's organization and role from our users table
        user_record = await get_user_from_token(db, user_data["sub"])

        return CurrentUser(
            id=user_data["sub"],
            email=user_data.get("email", ""),
            organization_id=user_record.get("organization_id") if user_record else None,
            role=user_record.get("role", "member") if user_record else "member"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    authorization: Annotated[str | None, Header()] = None,
    db: SupabaseClient = Depends(get_db)
) -> Optional[CurrentUser]:
    """Optional authentication - returns None if not authenticated"""
    if not authorization:
        return None

    try:
        return await get_current_user(authorization, db)
    except HTTPException:
        return None


async def get_current_organization(
    current_user: CurrentUser = Depends(get_current_user),
    db: SupabaseClient = Depends(get_db)
) -> CurrentOrganization:
    """Get the current user's organization with subscription info"""
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not part of an organization"
        )

    try:
        result = db.table("organizations").select("*").eq(
            "id", current_user.organization_id
        ).single().execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        org = result.data
        return CurrentOrganization(
            id=org["id"],
            name=org["name"],
            slug=org["slug"],
            subscription_tier=org.get("subscription_tier", "free"),
            subscription_status=org.get("subscription_status", "active"),
            monthly_analysis_limit=org.get("monthly_analysis_limit", 5),
            monthly_analyses_used=org.get("monthly_analyses_used", 0)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching organization: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch organization"
        )


# =============================================================================
# Authorization Dependencies
# =============================================================================

def require_subscription_tier(*allowed_tiers: str):
    """
    Dependency factory to require specific subscription tiers.

    Usage:
        @router.post("/premium-feature")
        async def premium_feature(
            org: CurrentOrganization = Depends(require_subscription_tier("pro", "enterprise"))
        ):
            ...
    """
    async def check_tier(
        org: CurrentOrganization = Depends(get_current_organization)
    ) -> CurrentOrganization:
        if org.subscription_tier not in allowed_tiers:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires {' or '.join(allowed_tiers)} subscription"
            )
        if org.subscription_status != "active":
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Subscription is not active"
            )
        return org

    return check_tier


def require_role(*allowed_roles: str):
    """
    Dependency factory to require specific user roles.

    Usage:
        @router.delete("/organization")
        async def delete_org(
            user: CurrentUser = Depends(require_role("owner"))
        ):
            ...
    """
    async def check_role(
        user: CurrentUser = Depends(get_current_user)
    ) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires {' or '.join(allowed_roles)} role"
            )
        return user

    return check_role


# =============================================================================
# Usage Limit Dependencies
# =============================================================================

async def check_analysis_limit(
    org: CurrentOrganization = Depends(get_current_organization),
    db: SupabaseClient = Depends(get_db)
) -> CurrentOrganization:
    """Check if organization has remaining analysis quota"""
    # Unlimited for enterprise
    if org.subscription_tier == "enterprise":
        return org

    if org.monthly_analyses_used >= org.monthly_analysis_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Monthly analysis limit reached ({org.monthly_analysis_limit}). "
                   f"Upgrade to Pro or Enterprise for more analyses."
        )

    return org


async def increment_analysis_count(
    org: CurrentOrganization = Depends(get_current_organization),
    db: SupabaseClient = Depends(get_db)
) -> None:
    """Increment the organization's monthly analysis count"""
    try:
        db.table("organizations").update({
            "monthly_analyses_used": org.monthly_analyses_used + 1
        }).eq("id", org.id).execute()
    except Exception as e:
        logger.error(f"Failed to increment analysis count: {e}")
        # Don't fail the request, just log the error


# =============================================================================
# Type Aliases for cleaner signatures
# =============================================================================

# Use these in router functions for cleaner code
DB = Annotated[SupabaseClient, Depends(get_db)]
User = Annotated[CurrentUser, Depends(get_current_user)]
UserOptional = Annotated[Optional[CurrentUser], Depends(get_current_user_optional)]
Org = Annotated[CurrentOrganization, Depends(get_current_organization)]
ProOrEnterprise = Annotated[CurrentOrganization, Depends(require_subscription_tier("pro", "enterprise"))]
EnterpriseOnly = Annotated[CurrentOrganization, Depends(require_subscription_tier("enterprise"))]
OwnerOnly = Annotated[CurrentUser, Depends(require_role("owner"))]
AdminOrOwner = Annotated[CurrentUser, Depends(require_role("owner", "admin"))]
