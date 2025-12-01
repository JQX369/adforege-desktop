"""Authentication Module

This module handles Supabase Auth integration:
- Token verification
- User lookup
- Session management
"""

import os
import logging
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)


# =============================================================================
# Token Verification
# =============================================================================

async def verify_supabase_token(access_token: str) -> Optional[Dict[str, Any]]:
    """
    Verify a Supabase access token and return user data.

    Args:
        access_token: JWT access token from Supabase Auth

    Returns:
        User data dict with 'sub' (user id), 'email', etc.
        None if token is invalid
    """
    supabase_url = os.environ.get("SUPABASE_URL")

    if not supabase_url:
        logger.error("SUPABASE_URL not configured")
        return None

    # Call Supabase Auth API to verify token
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": os.environ.get("SUPABASE_ANON_KEY", "")
                },
                timeout=10.0
            )

            if response.status_code == 200:
                user_data = response.json()
                return {
                    "sub": user_data.get("id"),
                    "email": user_data.get("email"),
                    "email_verified": user_data.get("email_confirmed_at") is not None,
                    "app_metadata": user_data.get("app_metadata", {}),
                    "user_metadata": user_data.get("user_metadata", {})
                }
            else:
                logger.warning(f"Token verification failed: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return None


async def get_user_from_token(db, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user record from our users table.

    Args:
        db: Supabase client
        user_id: User ID from Supabase Auth

    Returns:
        User record dict or None
    """
    try:
        result = db.table("users").select("*").eq("id", user_id).single().execute()
        return result.data
    except Exception as e:
        logger.warning(f"User not found in database: {user_id} - {e}")
        return None


# =============================================================================
# User Management
# =============================================================================

async def create_user_record(
    db,
    user_id: str,
    email: str,
    full_name: Optional[str] = None,
    organization_id: Optional[str] = None,
    role: str = "member"
) -> Dict[str, Any]:
    """
    Create a user record in our users table.

    This is called after a user signs up via Supabase Auth.
    Can be triggered by a database trigger or webhook.

    Args:
        db: Supabase client
        user_id: User ID from Supabase Auth
        email: User's email
        full_name: User's display name
        organization_id: Organization to join (optional)
        role: Role in the organization

    Returns:
        Created user record
    """
    user_data = {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "organization_id": organization_id,
        "role": role
    }

    result = db.table("users").insert(user_data).execute()
    return result.data[0] if result.data else user_data


async def create_organization(
    db,
    name: str,
    owner_user_id: str,
    slug: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new organization and assign the owner.

    Args:
        db: Supabase client
        name: Organization name
        owner_user_id: User ID of the owner
        slug: URL-friendly slug (generated from name if not provided)

    Returns:
        Created organization record
    """
    import re
    from datetime import datetime

    # Generate slug if not provided
    if not slug:
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        # Add timestamp to ensure uniqueness
        slug = f"{slug}-{int(datetime.now().timestamp())}"

    org_data = {
        "name": name,
        "slug": slug,
        "subscription_tier": "free",
        "subscription_status": "active",
        "monthly_analysis_limit": 5,
        "monthly_analyses_used": 0
    }

    # Create organization
    result = db.table("organizations").insert(org_data).execute()
    org = result.data[0]

    # Update user to be owner of the organization
    db.table("users").update({
        "organization_id": org["id"],
        "role": "owner"
    }).eq("id", owner_user_id).execute()

    return org


async def add_user_to_organization(
    db,
    user_id: str,
    organization_id: str,
    role: str = "member"
) -> bool:
    """
    Add an existing user to an organization.

    Args:
        db: Supabase client
        user_id: User to add
        organization_id: Organization to join
        role: Role to assign (member, admin, viewer)

    Returns:
        True if successful
    """
    try:
        db.table("users").update({
            "organization_id": organization_id,
            "role": role
        }).eq("id", user_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to add user to organization: {e}")
        return False


async def remove_user_from_organization(db, user_id: str) -> bool:
    """
    Remove a user from their organization.

    Args:
        db: Supabase client
        user_id: User to remove

    Returns:
        True if successful
    """
    try:
        db.table("users").update({
            "organization_id": None,
            "role": "member"
        }).eq("id", user_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to remove user from organization: {e}")
        return False


# =============================================================================
# Invitation System
# =============================================================================

async def create_invitation(
    db,
    organization_id: str,
    email: str,
    role: str = "member",
    invited_by: str = None
) -> Dict[str, Any]:
    """
    Create an invitation for a user to join an organization.

    Args:
        db: Supabase client
        organization_id: Organization to invite to
        email: Email to invite
        role: Role to assign when accepted
        invited_by: User ID of inviter

    Returns:
        Invitation record
    """
    import uuid
    from datetime import datetime, timedelta

    invitation_data = {
        "id": str(uuid.uuid4()),
        "organization_id": organization_id,
        "email": email,
        "role": role,
        "invited_by": invited_by,
        "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        "status": "pending"
    }

    result = db.table("invitations").insert(invitation_data).execute()
    return result.data[0] if result.data else invitation_data


async def accept_invitation(db, invitation_id: str, user_id: str) -> bool:
    """
    Accept an organization invitation.

    Args:
        db: Supabase client
        invitation_id: Invitation to accept
        user_id: User accepting the invitation

    Returns:
        True if successful
    """
    try:
        # Get invitation
        result = db.table("invitations").select("*").eq(
            "id", invitation_id
        ).eq("status", "pending").single().execute()

        if not result.data:
            return False

        invitation = result.data

        # Add user to organization
        await add_user_to_organization(
            db, user_id, invitation["organization_id"], invitation["role"]
        )

        # Mark invitation as accepted
        db.table("invitations").update({
            "status": "accepted"
        }).eq("id", invitation_id).execute()

        return True

    except Exception as e:
        logger.error(f"Failed to accept invitation: {e}")
        return False
