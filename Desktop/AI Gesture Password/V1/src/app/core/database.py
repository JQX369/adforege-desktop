"""Supabase Database Client

This module provides the Supabase client singleton for database operations.
Supports both the main SaaS database and the separate RAG database.
"""

import os
import logging
from typing import Optional
from functools import lru_cache

from supabase import create_client, Client as SupabaseClient

logger = logging.getLogger(__name__)

# Re-export for type hints
__all__ = ["SupabaseClient", "get_supabase_client", "get_rag_client"]


# =============================================================================
# Environment Configuration
# =============================================================================

def _get_env(key: str, required: bool = True) -> Optional[str]:
    """Get environment variable with optional requirement check"""
    value = os.environ.get(key)
    if required and not value:
        raise ValueError(f"Missing required environment variable: {key}")
    return value


# =============================================================================
# Main SaaS Database Client
# =============================================================================

_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """
    Get the main Supabase client (singleton).

    This client is used for:
    - User data (linked to Supabase Auth)
    - Organizations
    - Video analyses
    - Reactions
    - Ad scripts
    - Storyboards
    - Background jobs
    """
    global _supabase_client

    if _supabase_client is None:
        url = _get_env("SUPABASE_URL")
        # Use service key for backend (bypasses RLS)
        key = _get_env("SUPABASE_SERVICE_KEY", required=False) or _get_env("SUPABASE_ANON_KEY")

        if not url or not key:
            raise ValueError(
                "Supabase not configured. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) environment variables."
            )

        _supabase_client = create_client(url, key)
        logger.info("Supabase client initialized")

    return _supabase_client


def get_supabase_client_with_token(access_token: str) -> SupabaseClient:
    """
    Get a Supabase client authenticated with a user's access token.

    This respects RLS policies and should be used when you want
    queries to be scoped to the user's permissions.
    """
    url = _get_env("SUPABASE_URL")
    anon_key = _get_env("SUPABASE_ANON_KEY")

    if not url or not anon_key:
        raise ValueError("Supabase not configured")

    client = create_client(url, anon_key)
    client.auth.set_session(access_token, "")  # Set access token
    return client


# =============================================================================
# RAG Database Client (TV Ads)
# =============================================================================

_rag_client: Optional[SupabaseClient] = None


def get_rag_client() -> Optional[SupabaseClient]:
    """
    Get the RAG database client for TV ads search (singleton).

    This is a SEPARATE Supabase project used for:
    - TV ad embeddings
    - Similar ads search
    - RAG context retrieval

    Returns None if not configured (RAG features will be disabled).
    """
    global _rag_client

    if _rag_client is None:
        url = os.environ.get("SUPABASE_RAG_URL")
        key = os.environ.get("SUPABASE_RAG_KEY")

        if not url or not key:
            logger.warning(
                "RAG database not configured. Similar ads and RAG features disabled. "
                "Set SUPABASE_RAG_URL and SUPABASE_RAG_KEY to enable."
            )
            return None

        _rag_client = create_client(url, key)
        logger.info("RAG database client initialized")

    return _rag_client


# =============================================================================
# Database Utilities
# =============================================================================

async def check_database_connection() -> dict:
    """
    Health check for database connections.

    Returns:
        dict with 'main' and 'rag' connection status
    """
    result = {"main": False, "rag": False}

    # Check main database
    try:
        client = get_supabase_client()
        # Simple query to verify connection
        client.table("organizations").select("id").limit(1).execute()
        result["main"] = True
    except Exception as e:
        logger.error(f"Main database health check failed: {e}")

    # Check RAG database
    try:
        rag = get_rag_client()
        if rag:
            rag.table("tv_ads").select("id").limit(1).execute()
            result["rag"] = True
    except Exception as e:
        logger.warning(f"RAG database health check failed: {e}")

    return result


# =============================================================================
# Storage Utilities
# =============================================================================

def get_storage_url(bucket: str, path: str) -> str:
    """
    Get a public URL for a file in Supabase Storage.

    Args:
        bucket: Storage bucket name (e.g., "videos", "thumbnails")
        path: Path within the bucket

    Returns:
        Public URL for the file
    """
    client = get_supabase_client()
    return client.storage.from_(bucket).get_public_url(path)


async def upload_to_storage(
    bucket: str,
    path: str,
    file_data: bytes,
    content_type: str = "application/octet-stream"
) -> str:
    """
    Upload a file to Supabase Storage.

    Args:
        bucket: Storage bucket name
        path: Destination path within the bucket
        file_data: File content as bytes
        content_type: MIME type of the file

    Returns:
        Public URL for the uploaded file
    """
    client = get_supabase_client()

    # Upload the file
    client.storage.from_(bucket).upload(
        path=path,
        file=file_data,
        file_options={"content-type": content_type}
    )

    # Return public URL
    return get_storage_url(bucket, path)


async def delete_from_storage(bucket: str, paths: list[str]) -> None:
    """
    Delete files from Supabase Storage.

    Args:
        bucket: Storage bucket name
        paths: List of file paths to delete
    """
    client = get_supabase_client()
    client.storage.from_(bucket).remove(paths)
