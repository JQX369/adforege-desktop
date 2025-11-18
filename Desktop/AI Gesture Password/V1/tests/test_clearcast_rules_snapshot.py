import json
from pathlib import Path

import pytest

from app.clearcast_rules import ClearcastRulesSnapshot


def _sample_snapshot():
    return {
        "snapshot": {
            "version_id": "clearcast-v2025.11.15",
            "last_checked": "2025-11-15T18:30:00Z",
            "source_document": "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf",
            "rules": [
                {
                    "code": "BCAP 3.1",
                    "title": "Misleading advertising must not materially mislead",
                    "category": "Misleading Claims",
                    "summary": "Claims must be substantiated and not exaggerate performance or savings.",
                    "severity": "high",
                    "prohibited_or_conditional": "conditional",
                    "age_restrictions": None,
                    "alcohol_or_gambling": False,
                    "claims_require_substantiation": True,
                    "scheduling_notes": None,
                    "example_phrases": [
                        "No small print that contradicts audio claims",
                        "Include qualifying information on-screen"
                    ],
                    "tags": ["claims", "pricing", "substantiation"],
                    "last_updated": "2024-10-01T00:00:00Z"
                },
                {
                    "code": "BCAP 10.4",
                    "title": "Alcohol advertising must not appeal to under 18s",
                    "category": "Alcohol",
                    "summary": "Avoid youthful portrayals, heroes, or settings likely to appeal to under-18s.",
                    "severity": "medium",
                    "prohibited_or_conditional": "conditional",
                    "age_restrictions": "18+ only",
                    "alcohol_or_gambling": True,
                    "claims_require_substantiation": False,
                    "scheduling_notes": "post-watershed if youthful themes",
                    "example_phrases": [
                        "Cast looks older than 25",
                        "No drinking games or dares"
                    ],
                    "tags": ["alcohol", "youth"],
                    "last_updated": "2024-08-15T00:00:00Z"
                }
            ]
        }
    }


def test_load_snapshot_success(tmp_path: Path):
    snapshot_path = tmp_path / "clearcast_updates.json"
    snapshot_path.write_text(json.dumps(_sample_snapshot()), encoding="utf-8")

    snapshot = ClearcastRulesSnapshot.load_from_file(snapshot_path)

    assert snapshot.version_id == "clearcast-v2025.11.15"
    assert snapshot.last_checked == "2025-11-15T18:30:00Z"
    assert snapshot.source_document.endswith("Clearcast Guidance.pdf")
    assert len(snapshot.rules) == 2

    rule = snapshot.rules[0]
    assert rule.code == "BCAP 3.1"
    assert "Claims must be substantiated" in rule.summary
    assert "pricing" in rule.tags


def test_snapshot_validation_requires_rules(tmp_path: Path):
    invalid_data = _sample_snapshot()
    invalid_data["snapshot"].pop("rules")

    snapshot_path = tmp_path / "clearcast_updates.json"
    snapshot_path.write_text(json.dumps(invalid_data), encoding="utf-8")

    with pytest.raises(ValueError, match="rules"):
        ClearcastRulesSnapshot.load_from_file(snapshot_path)


def test_rule_validation_requires_code(tmp_path: Path):
    invalid = _sample_snapshot()
    invalid["snapshot"]["rules"][0].pop("code")

    snapshot_path = tmp_path / "clearcast_updates.json"
    snapshot_path.write_text(json.dumps(invalid), encoding="utf-8")

    with pytest.raises(ValueError, match="code"):
        ClearcastRulesSnapshot.load_from_file(snapshot_path)

