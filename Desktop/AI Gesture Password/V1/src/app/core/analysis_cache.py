"""
Analysis Result Caching

Caches expensive AI analysis results to avoid redundant calls.
Uses SQLite for persistence alongside existing storage.
"""

import hashlib
import json
import logging
import os
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Configuration for the analysis cache."""
    db_path: str = "analysis_cache.db"
    default_ttl_hours: int = 24
    max_entries: int = 1000
    enabled: bool = True


class AnalysisCache:
    """
    Cache for analysis results using SQLite.
    
    Stores results keyed by video file hash + analysis type + options.
    """
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self.db_path = Path(self.config.db_path)
        
        # Initialize database
        if self.config.enabled:
            self._init_db()
    
    def _init_db(self):
        """Initialize the SQLite database schema."""
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS analysis_cache (
                        cache_key TEXT PRIMARY KEY,
                        video_path TEXT,
                        analysis_type TEXT,
                        options_hash TEXT,
                        result_json TEXT,
                        created_at REAL,
                        expires_at REAL,
                        video_hash TEXT,
                        file_size INTEGER
                    )
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_expires_at 
                    ON analysis_cache(expires_at)
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_video_path 
                    ON analysis_cache(video_path)
                """)
                conn.commit()
                logger.info(f"Analysis cache initialized at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize cache database: {e}")
            self.config.enabled = False
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper cleanup."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            yield conn
        finally:
            conn.close()
    
    def _compute_file_hash(self, video_path: str) -> str:
        """
        Compute a hash of the video file for cache key.
        Uses file size and first/last 1MB for speed.
        """
        try:
            file_size = os.path.getsize(video_path)
            hasher = hashlib.sha256()
            hasher.update(str(file_size).encode())
            
            # Hash first and last 1MB for uniqueness without reading entire file
            chunk_size = 1024 * 1024  # 1MB
            
            with open(video_path, 'rb') as f:
                # First chunk
                hasher.update(f.read(chunk_size))
                
                # Last chunk (if file is large enough)
                if file_size > chunk_size * 2:
                    f.seek(-chunk_size, 2)  # Seek from end
                    hasher.update(f.read(chunk_size))
            
            return hasher.hexdigest()[:16]  # Truncate for readability
            
        except Exception as e:
            logger.warning(f"Failed to compute file hash: {e}")
            return hashlib.md5(video_path.encode()).hexdigest()[:16]
    
    def _compute_cache_key(
        self, 
        video_path: str, 
        analysis_type: str, 
        options: Optional[Dict] = None
    ) -> str:
        """
        Compute unique cache key for an analysis request.
        """
        video_hash = self._compute_file_hash(video_path)
        options_str = json.dumps(options or {}, sort_keys=True)
        options_hash = hashlib.md5(options_str.encode()).hexdigest()[:8]
        
        return f"{video_hash}_{analysis_type}_{options_hash}"
    
    def get(
        self, 
        video_path: str, 
        analysis_type: str, 
        options: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached analysis result if available and not expired.
        
        Args:
            video_path: Path to the video file
            analysis_type: Type of analysis ("clearcast" or "ai_breakdown")
            options: Analysis options that affect the result
            
        Returns:
            Cached result dict or None if not found/expired
        """
        if not self.config.enabled:
            return None
        
        cache_key = self._compute_cache_key(video_path, analysis_type, options)
        
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT result_json, expires_at 
                    FROM analysis_cache 
                    WHERE cache_key = ?
                """, (cache_key,))
                
                row = cursor.fetchone()
                
                if row is None:
                    return None
                
                result_json, expires_at = row
                
                # Check expiration
                if time.time() > expires_at:
                    logger.debug(f"Cache entry expired: {cache_key}")
                    self._delete_entry(cache_key)
                    return None
                
                logger.info(f"Cache hit for {analysis_type} analysis")
                return json.loads(result_json)
                
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
            return None
    
    def set(
        self, 
        video_path: str, 
        analysis_type: str, 
        result: Dict[str, Any],
        options: Optional[Dict] = None,
        ttl_hours: Optional[int] = None
    ):
        """
        Store analysis result in cache.
        
        Args:
            video_path: Path to the video file
            analysis_type: Type of analysis ("clearcast" or "ai_breakdown")
            result: Analysis result to cache
            options: Analysis options used
            ttl_hours: Time-to-live in hours (default from config)
        """
        if not self.config.enabled:
            return
        
        # Don't cache error results
        if result.get("error") or result.get("compliance_status") == "ERROR":
            return
        
        cache_key = self._compute_cache_key(video_path, analysis_type, options)
        video_hash = self._compute_file_hash(video_path)
        options_hash = hashlib.md5(json.dumps(options or {}, sort_keys=True).encode()).hexdigest()[:8]
        
        ttl = (ttl_hours or self.config.default_ttl_hours) * 3600
        created_at = time.time()
        expires_at = created_at + ttl
        
        try:
            file_size = os.path.getsize(video_path)
            result_json = json.dumps(result)
            
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO analysis_cache 
                    (cache_key, video_path, analysis_type, options_hash, result_json, 
                     created_at, expires_at, video_hash, file_size)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    cache_key, video_path, analysis_type, options_hash, result_json,
                    created_at, expires_at, video_hash, file_size
                ))
                conn.commit()
                
            logger.info(f"Cached {analysis_type} result (expires in {ttl_hours or self.config.default_ttl_hours}h)")
            
            # Cleanup old entries periodically
            self._cleanup_expired()
            
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")
    
    def invalidate(
        self, 
        video_path: str, 
        analysis_type: Optional[str] = None
    ):
        """
        Invalidate cached results for a video.
        
        Args:
            video_path: Path to the video file
            analysis_type: Specific type to invalidate, or all if None
        """
        if not self.config.enabled:
            return
        
        try:
            with self._get_connection() as conn:
                if analysis_type:
                    conn.execute("""
                        DELETE FROM analysis_cache 
                        WHERE video_path = ? AND analysis_type = ?
                    """, (video_path, analysis_type))
                else:
                    conn.execute("""
                        DELETE FROM analysis_cache 
                        WHERE video_path = ?
                    """, (video_path,))
                conn.commit()
                logger.info(f"Invalidated cache for {video_path}")
        except Exception as e:
            logger.warning(f"Cache invalidate failed: {e}")
    
    def _delete_entry(self, cache_key: str):
        """Delete a specific cache entry."""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM analysis_cache WHERE cache_key = ?", (cache_key,))
                conn.commit()
        except Exception:
            pass
    
    def _cleanup_expired(self):
        """Remove expired entries from the cache."""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM analysis_cache WHERE expires_at < ?", (time.time(),))
                
                # Also enforce max entries limit
                conn.execute("""
                    DELETE FROM analysis_cache 
                    WHERE cache_key NOT IN (
                        SELECT cache_key FROM analysis_cache 
                        ORDER BY created_at DESC 
                        LIMIT ?
                    )
                """, (self.config.max_entries,))
                
                conn.commit()
        except Exception as e:
            logger.warning(f"Cache cleanup failed: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.config.enabled:
            return {"enabled": False}
        
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM analysis_cache")
                total_entries = cursor.fetchone()[0]
                
                cursor = conn.execute("""
                    SELECT COUNT(*) FROM analysis_cache WHERE expires_at > ?
                """, (time.time(),))
                valid_entries = cursor.fetchone()[0]
                
                cursor = conn.execute("""
                    SELECT analysis_type, COUNT(*) 
                    FROM analysis_cache 
                    GROUP BY analysis_type
                """)
                by_type = dict(cursor.fetchall())
                
            return {
                "enabled": True,
                "total_entries": total_entries,
                "valid_entries": valid_entries,
                "expired_entries": total_entries - valid_entries,
                "by_type": by_type,
                "max_entries": self.config.max_entries,
                "default_ttl_hours": self.config.default_ttl_hours,
            }
        except Exception as e:
            return {"enabled": True, "error": str(e)}
    
    def clear(self):
        """Clear all cache entries."""
        if not self.config.enabled:
            return
        
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM analysis_cache")
                conn.commit()
            logger.info("Cache cleared")
        except Exception as e:
            logger.warning(f"Cache clear failed: {e}")


# Singleton instance
_cache_instance: Optional[AnalysisCache] = None


def get_analysis_cache() -> AnalysisCache:
    """Get the singleton cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = AnalysisCache()
    return _cache_instance


__all__ = [
    "CacheConfig",
    "AnalysisCache",
    "get_analysis_cache",
]








