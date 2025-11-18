import json
import pytest

from app.clearcast_checker import ClearcastChecker
from app.clearcast_classifier import (
    BrandProfile,
    ClearcastClassificationResult,
    FocusArea,
    ProductProfile,
    ScriptProfile,
)


@pytest.fixture(autouse=True)
def stub_gemini(monkeypatch):
    monkeypatch.setattr("app.gemini_utils.create_gemini_model", lambda *args, **kwargs: None)


def _checker():
    return ClearcastChecker()


def test_parse_structured_response_maps_risks_and_reasoning():
    checker = _checker()
    payload = {
        "compliance_status": "REVIEW_NEEDED",
        "overall_risk": "MEDIUM",
        "summary": "Needs disclaimers.",
        "risks": [
            {
                "issue": "Missing APR disclaimer",
                "risk_level": "HIGH",
                "guideline_code": "BCAP 3.1",
                "guideline_title": "Misleading advertising",
                "category": "Financial",
                "timestamp": "00:12-00:18",
                "required_action": "Add APR on-screen for minimum 3s",
                "citations": ["BCAP 3.1"],
                "evidence_text": "“Representative APR is never displayed.”",
                "evidence_source": "Transcript 00:12-00:18",
            },
            {
                "issue": "Children shown buying the product",
                "risk_level": "MEDIUM",
                "guideline_code": "BCAP 5.2",
                "category": "Children",
                "timestamp": "00:05-00:07",
                "suggested_action": "Show parent final decision",
                "citations": ["BCAP 5.2"],
                "description": "Child voiceover says “Buy it now, no parents needed.”",
            },
        ],
        "technical_checks": [
            {
                "issue": "Audio peaks at -4 LUFS",
                "category": "Sound Quality",
                "risk_level": "LOW",
                "fix_required": True,
                "evidence_text": "Input loudness measured -19.2 LUFS, peaks -0.5 dBFS.",
                "evidence_source": "FFmpeg loudnorm output",
            }
        ],
        "compliant_elements": ["Clear VO diction"],
        "recommendations": ["Add APR card"],
        "internal_reasoning": "Chain-of-thought text.",
    }

    parsed = checker._parse_compliance_response(json.dumps(payload))

    assert parsed["compliance_status"] == "REVIEW_NEEDED"
    assert parsed["red_flags"][0]["guideline_code"] == "BCAP 3.1"
    assert parsed["red_flags"][0]["evidence_text"].startswith("“Representative APR")
    assert parsed["red_flags"][0]["evidence_source"] == "Transcript 00:12-00:18"
    assert parsed["yellow_flags"][0]["guideline_code"] == "BCAP 5.2"
    assert parsed["yellow_flags"][0]["evidence_text"].startswith("Child voiceover")
    assert parsed["blue_flags"][0]["category"] == "Sound Quality"
    assert "FFmpeg loudnorm" in parsed["blue_flags"][0]["evidence_source"]
    assert parsed["internal_reasoning"] == "Chain-of-thought text."


def test_focus_summary_links_flags():
    checker = _checker()
    classification = ClearcastClassificationResult(
        script=ScriptProfile(),
        product=ProductProfile(),
        brand=BrandProfile(),
        priority_focus_areas=[FocusArea(label="Children", reason="Kids addressed directly")],
        disclaimers_required=["Adult supervision"],
    )
    compliance = {
        "red_flags": [
            {
                "issue": "Children directly encouraged to buy",
                "category": "Children",
                "guideline_code": "BCAP 5.2",
                "severity": "HIGH",
            }
        ],
        "yellow_flags": [],
    }

    summary = checker._build_focus_summary(classification, compliance)

    assert summary
    assert summary[0]["severity"] == "HIGH"
    assert summary[0]["related_flags"][0]["guideline_code"] == "BCAP 5.2"

