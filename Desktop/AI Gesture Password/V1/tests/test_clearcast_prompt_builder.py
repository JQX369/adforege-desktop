import json
from pathlib import Path

import pytest

from app.clearcast_rules import ClearcastRulesSnapshot
from app.clearcast_prompt_builder import PromptContext, build_clearcast_prompt


def _snapshot():
    return ClearcastRulesSnapshot.from_dict(
        {
            "snapshot": {
                "version_id": "clearcast-v2025.11.15",
                "last_checked": "2025-11-15T18:30:00Z",
                "source_document": "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf",
                "rules": [
                    {
                        "code": "BCAP 3.1",
                        "title": "Misleading advertising",
                        "category": "Misleading Claims",
                        "summary": "Claims must be substantiated.",
                        "severity": "high",
                        "prohibited_or_conditional": "conditional",
                        "example_phrases": ["include qualifying copy"],
                        "tags": ["claims"],
                    },
                    {
                        "code": "BCAP 5.2",
                        "title": "Children: pressure to purchase",
                        "category": "Children",
                        "summary": "No direct exhortations to children.",
                        "severity": "high",
                        "prohibited_or_conditional": "prohibited",
                        "tags": ["children"],
                    },
                ],
            }
        }
    )


def test_prompt_includes_snapshot_version_and_codes():
    snapshot = _snapshot()
    prompt = build_clearcast_prompt(snapshot, PromptContext())
    assert "clearcast-v2025.11.15" in prompt
    assert "BCAP 3.1" in prompt
    assert "BCAP 5.2" in prompt


def test_prompt_includes_contextual_details():
    snapshot = _snapshot()
    context = PromptContext(
        script_excerpt="Our product is a vegan snack that claims to boost mood.",
        product_notes={"sector": "Food", "risk": "Health claims"},
        brand_notes={"name": "Green Bites", "tone": "Playful"},
    )
    prompt = build_clearcast_prompt(snapshot, context)
    assert "vegan snack" in prompt
    assert "Food" in prompt
    assert "Green Bites" in prompt


def test_prompt_requests_reasoning_when_flag_enabled():
    snapshot = _snapshot()
    context = PromptContext(verbose_reasoning=True)
    prompt = build_clearcast_prompt(snapshot, context)
    assert "internal_reasoning" in prompt
    assert "Do not include the raw reasoning in user-facing output" in prompt


def test_prompt_includes_extra_notes():
    snapshot = _snapshot()
    context = PromptContext(
        script_excerpt="Sample",
        extra_notes=["Watch for alcohol-related claims and pricing clarity."],
    )
    prompt = build_clearcast_prompt(snapshot, context)
    assert "Watch for alcohol-related claims" in prompt


def test_prompt_requires_evidence_fields():
    snapshot = _snapshot()
    prompt = build_clearcast_prompt(snapshot, PromptContext())
    assert '"evidence_text"' in prompt
    assert "For every risk and technical issue" in prompt

