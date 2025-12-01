"""
Clearcast Rules Updater - Versioned rule management for AI predictions.

Provides mechanisms to:
- Update Clearcast guidance rules from files
- Version rules with timestamps
- Track rule history for rollback
- Integrate with knowledge base embeddings
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# Default rules storage location
RULES_DIR = Path(__file__).parent.parent.parent.parent / "data" / "clearcast_rules"


class RulesVersion:
    """Represents a specific version of Clearcast rules."""

    def __init__(
        self,
        version_id: str,
        rules_data: Dict[str, Any],
        created_at: str,
        source: str = "manual",
        notes: Optional[str] = None,
    ):
        self.version_id = version_id
        self.rules_data = rules_data
        self.created_at = created_at
        self.source = source
        self.notes = notes

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "rules_data": self.rules_data,
            "created_at": self.created_at,
            "source": self.source,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RulesVersion":
        return cls(
            version_id=data["version_id"],
            rules_data=data["rules_data"],
            created_at=data["created_at"],
            source=data.get("source", "unknown"),
            notes=data.get("notes"),
        )


class ClearcastRulesUpdater:
    """
    Manages versioned Clearcast rules for AI predictions.

    Features:
    - Load rules from JSON/text files
    - Version and timestamp rules
    - Keep history for rollback
    - Update knowledge base embeddings
    """

    def __init__(self, rules_dir: Optional[Path] = None):
        self.rules_dir = rules_dir or RULES_DIR
        self.rules_dir.mkdir(parents=True, exist_ok=True)

        self.versions_file = self.rules_dir / "versions.json"
        self.current_file = self.rules_dir / "current.json"
        self.history_dir = self.rules_dir / "history"
        self.history_dir.mkdir(exist_ok=True)

        self._versions: List[RulesVersion] = []
        self._current_version_id: Optional[str] = None

        self._load_versions()

    def _load_versions(self) -> None:
        """Load version history from disk."""
        if self.versions_file.exists():
            try:
                with open(self.versions_file, "r") as f:
                    data = json.load(f)
                    self._versions = [
                        RulesVersion.from_dict(v) for v in data.get("versions", [])
                    ]
                    self._current_version_id = data.get("current_version_id")
            except Exception as e:
                logger.error(f"Failed to load rules versions: {e}")
                self._versions = []
                self._current_version_id = None

    def _save_versions(self) -> None:
        """Save version history to disk."""
        try:
            data = {
                "versions": [v.to_dict() for v in self._versions],
                "current_version_id": self._current_version_id,
                "last_updated": datetime.utcnow().isoformat(),
            }
            with open(self.versions_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save rules versions: {e}")

    def get_current_version(self) -> Optional[RulesVersion]:
        """Get the currently active rules version."""
        if not self._current_version_id:
            return None

        for version in self._versions:
            if version.version_id == self._current_version_id:
                return version
        return None

    def get_current_rules(self) -> Optional[Dict[str, Any]]:
        """Get the currently active rules data."""
        version = self.get_current_version()
        return version.rules_data if version else None

    def list_versions(self) -> List[Dict[str, Any]]:
        """List all available rule versions."""
        return [
            {
                "version_id": v.version_id,
                "created_at": v.created_at,
                "source": v.source,
                "notes": v.notes,
                "is_current": v.version_id == self._current_version_id,
            }
            for v in reversed(self._versions)  # Most recent first
        ]

    def update_rules(
        self,
        rules_data: Dict[str, Any],
        source: str = "manual",
        notes: Optional[str] = None,
    ) -> RulesVersion:
        """
        Add a new rules version and set it as current.

        Args:
            rules_data: The rules data to store
            source: Source of the update (manual, api, upload)
            notes: Optional notes about the update

        Returns:
            The created RulesVersion
        """
        # Generate version ID
        timestamp = datetime.utcnow()
        version_id = timestamp.strftime("%Y%m%d_%H%M%S")

        # Create version object
        version = RulesVersion(
            version_id=version_id,
            rules_data=rules_data,
            created_at=timestamp.isoformat(),
            source=source,
            notes=notes,
        )

        # Save to history
        history_file = self.history_dir / f"{version_id}.json"
        with open(history_file, "w") as f:
            json.dump(version.to_dict(), f, indent=2)

        # Save as current
        with open(self.current_file, "w") as f:
            json.dump(version.to_dict(), f, indent=2)

        # Update in-memory state
        self._versions.append(version)
        self._current_version_id = version_id
        self._save_versions()

        logger.info(f"Rules updated to version {version_id} (source: {source})")

        # Update knowledge base embeddings if available
        self._update_knowledge_base(rules_data)

        return version

    def update_from_file(
        self,
        file_path: str,
        notes: Optional[str] = None,
    ) -> RulesVersion:
        """
        Update rules from a JSON or text file.

        Args:
            file_path: Path to the rules file
            notes: Optional notes about the update

        Returns:
            The created RulesVersion
        """
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"Rules file not found: {file_path}")

        # Parse based on file type
        if path.suffix.lower() == ".json":
            with open(path, "r", encoding="utf-8") as f:
                rules_data = json.load(f)
        else:
            # Treat as text content
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            rules_data = {"content": content, "format": "text"}

        return self.update_rules(
            rules_data=rules_data,
            source=f"file:{path.name}",
            notes=notes or f"Loaded from {path.name}",
        )

    def rollback(self, version_id: str) -> Optional[RulesVersion]:
        """
        Rollback to a previous rules version.

        Args:
            version_id: The version ID to rollback to

        Returns:
            The activated version, or None if not found
        """
        # Find version
        target_version = None
        for version in self._versions:
            if version.version_id == version_id:
                target_version = version
                break

        if not target_version:
            logger.error(f"Version {version_id} not found")
            return None

        # Set as current
        self._current_version_id = version_id
        self._save_versions()

        # Update current file
        with open(self.current_file, "w") as f:
            json.dump(target_version.to_dict(), f, indent=2)

        logger.info(f"Rolled back to version {version_id}")

        # Update knowledge base
        self._update_knowledge_base(target_version.rules_data)

        return target_version

    def _update_knowledge_base(self, rules_data: Dict[str, Any]) -> None:
        """Update the knowledge base embeddings with new rules."""
        try:
            from .clearcast_knowledge_base import get_knowledge_base

            kb = get_knowledge_base()

            # Check if rules_data has text content to embed
            content = rules_data.get("content")
            if isinstance(content, str) and content.strip():
                # This would reindex the content
                logger.info("Knowledge base update triggered (embeddings may need regeneration)")
                # Note: Full reindexing would require KB modifications
                # For now, just log that it should be done

        except ImportError:
            logger.debug("Knowledge base not available for rules update")
        except Exception as e:
            logger.warning(f"Failed to update knowledge base: {e}")

    def get_rules_summary(self) -> Dict[str, Any]:
        """Get a summary of the current rules state."""
        current = self.get_current_version()
        return {
            "current_version_id": self._current_version_id,
            "current_version_date": current.created_at if current else None,
            "current_version_source": current.source if current else None,
            "total_versions": len(self._versions),
            "rules_dir": str(self.rules_dir),
        }


# Singleton instance
_updater: Optional[ClearcastRulesUpdater] = None


def get_rules_updater() -> ClearcastRulesUpdater:
    """Get the singleton rules updater instance."""
    global _updater
    if _updater is None:
        _updater = ClearcastRulesUpdater()
    return _updater


def update_rules_from_content(
    content: str,
    source: str = "api",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Convenience function to update rules from text content.

    Args:
        content: The rules content as text
        source: Source identifier
        notes: Optional notes

    Returns:
        Version info dict
    """
    updater = get_rules_updater()
    version = updater.update_rules(
        rules_data={"content": content, "format": "text"},
        source=source,
        notes=notes,
    )
    return version.to_dict()
