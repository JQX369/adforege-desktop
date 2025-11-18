"""Typed utilities for loading Clearcast rule snapshots from JSON."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_SNAPSHOT_PATH = Path(__file__).parent / "clearcast_updates.json"


@dataclass(frozen=True)
class ClearcastRule:
    """Structured representation of a single Clearcast guideline."""

    code: str
    title: str
    category: str
    summary: str
    severity: str
    prohibited_or_conditional: str
    age_restrictions: Optional[str] = None
    alcohol_or_gambling: bool = False
    claims_require_substantiation: bool = False
    scheduling_notes: Optional[str] = None
    example_phrases: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    last_updated: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ClearcastRule":
        missing = [
            field_name
            for field_name in (
                "code",
                "title",
                "category",
                "summary",
                "severity",
                "prohibited_or_conditional",
            )
            if not data.get(field_name)
        ]
        if missing:
            raise ValueError(f"Rule is missing required field(s): {', '.join(missing)}")

        example_phrases = data.get("example_phrases") or []
        if not isinstance(example_phrases, list):
            raise ValueError("example_phrases must be a list")

        tags = data.get("tags") or []
        if not isinstance(tags, list):
            raise ValueError("tags must be a list")

        return cls(
            code=data["code"],
            title=data["title"],
            category=data["category"],
            summary=data["summary"],
            severity=data["severity"],
            prohibited_or_conditional=data["prohibited_or_conditional"],
            age_restrictions=data.get("age_restrictions"),
            alcohol_or_gambling=bool(data.get("alcohol_or_gambling", False)),
            claims_require_substantiation=bool(
                data.get("claims_require_substantiation", False)
            ),
            scheduling_notes=data.get("scheduling_notes"),
            example_phrases=example_phrases,
            tags=tags,
            last_updated=data.get("last_updated"),
        )


@dataclass(frozen=True)
class ClearcastRulesSnapshot:
    """Top-level container for a Clearcast rule snapshot."""

    version_id: str
    last_checked: str
    source_document: Optional[str]
    rules: List[ClearcastRule]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ClearcastRulesSnapshot":
        snapshot_data = data.get("snapshot")
        if not snapshot_data:
            raise ValueError("Snapshot data missing from Clearcast JSON")

        version_id = snapshot_data.get("version_id")
        last_checked = snapshot_data.get("last_checked")
        rules_data = snapshot_data.get("rules")

        if not version_id:
            raise ValueError("snapshot.version_id is required")
        if not last_checked:
            raise ValueError("snapshot.last_checked is required")
        if not isinstance(rules_data, list):
            raise ValueError("snapshot.rules must be a list")

        rules = [ClearcastRule.from_dict(rule) for rule in rules_data]

        return cls(
            version_id=version_id,
            last_checked=last_checked,
            source_document=snapshot_data.get("source_document"),
            rules=rules,
        )

    @classmethod
    def load_from_file(cls, path: Path | str) -> "ClearcastRulesSnapshot":
        snapshot_path = Path(path)
        if not snapshot_path.exists():
            raise FileNotFoundError(f"Clearcast snapshot file not found: {snapshot_path}")

        with snapshot_path.open("r", encoding="utf-8") as handle:
            data: Dict[str, Any] = json.load(handle)

        return cls.from_dict(data)


def load_default_snapshot() -> ClearcastRulesSnapshot:
    """Load the default Clearcast rules snapshot bundled with the app."""
    return ClearcastRulesSnapshot.load_from_file(DEFAULT_SNAPSHOT_PATH)


__all__ = [
    "ClearcastRule",
    "ClearcastRulesSnapshot",
    "load_default_snapshot",
    "DEFAULT_SNAPSHOT_PATH",
]

