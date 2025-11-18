import os
from pathlib import Path

import pytest

from app.pdf_generator import (
    resolve_ad_name,
    resolve_brand_name,
    format_report_title,
    AIBreakdownPDFGenerator,
    ClearcastPDFGenerator,
)


def test_resolve_ad_name_prefers_specific_product():
    results = {
        "breakdown": {
            "specific_product": "Custom Stories Ultra",
            "what_is_advertised": "Custom Stories Platform",
            "brand_name": "Custom Stories",
        }
    }
    assert resolve_ad_name(results, "fallback") == "Custom Stories Ultra"


def test_resolve_ad_name_falls_back_to_video_name():
    results = {}
    assert resolve_ad_name(results, "MyVideo") == "MyVideo"


def test_resolve_brand_name_prefers_breakdown_brand():
    results = {
        "breakdown": {
            "brand_name": "Custom Stories"
        },
        "brand_name": "Fallback Brand"
    }
    assert resolve_brand_name(results) == "Custom Stories"


def test_format_report_title_with_ad_and_brand():
    title = format_report_title("Holiday Ad", "Custom Stories")
    assert title == "Custom Stories Report — Holiday Ad (Custom Stories)"


def test_format_report_title_missing_brand():
    title = format_report_title("Holiday Ad", "")
    assert title == "Custom Stories Report — Holiday Ad"


def test_format_report_title_missing_everything():
    title = format_report_title("", None)
    assert title == "Custom Stories Report — Untitled Ad"


def test_ai_breakdown_pdf_generation_smoke(tmp_path: Path):
    """AI Breakdown PDF generates successfully even with very long fields."""
    long_text = "This is a very long sentence. " * 200
    results = {
        "breakdown": {
            "what_is_advertised": long_text,
            "brand_name": "Example Brand",
            "specific_product": "Example Product",
            "product_category": "Category",
            "content_type": "Advertisement",
            "duration_category": "Short (10-30s)",
            "target_audience": long_text,
            "production_quality": "High",
            "narrative_structure": long_text,
            "cta_clarity": long_text,
            "suggested_improved_cta": long_text,
            "key_messages": [long_text] * 3,
        },
        "estimated_outcome": {
            "primary_goal": "Brand Awareness",
            "effectiveness_score": 85,
            "reasoning": long_text,
            "score_rationale": [long_text] * 3,
            "expected_metrics": {
                "engagement_rate": "High",
                "conversion_potential": "Medium",
                "memorability": "High",
            },
        },
        "green_highlights": [
            {"aspect": long_text, "explanation": long_text, "impact": "High"}
        ],
        "yellow_highlights": [
            {"aspect": long_text, "suggestion": long_text, "priority": "Medium"}
        ],
        "soft_risks": [
            {"risk": long_text, "impact": long_text, "mitigation": long_text}
        ],
        "audience_reactions": [
            {
                "profile": long_text,
                "engagement_level": "High",
                "reaction": long_text,
                "likely_action": long_text,
            }
        ],
        "summary": long_text,
    }

    output_path = tmp_path / "ai_breakdown.pdf"
    generator = AIBreakdownPDFGenerator()
    success = generator.generate_pdf(
        results=results,
        video_name="X" * 250,
        video_duration=30.0,
        thumbnail_base64=None,
        output_path=str(output_path),
    )

    assert success is True
    assert output_path.exists()
    assert output_path.stat().st_size > 0


def test_clearcast_pdf_generation_smoke(tmp_path: Path):
    """Clearcast PDF generates successfully even with long fields and empty lists."""
    long_text = "This is a very long sentence. " * 150
    results = {
        "summary": long_text,
        "clearance_prediction": "Will likely clear",
        "compliance_status": "PASS",
        "breakdown": {
            "identification_confidence": 92.3,
            "possible_alternatives": ["Alt 1", "Alt 2"],
        },
        "red_flags": [],
        "yellow_flags": [],
        "blue_flags": [],
        "compliant_elements": ["Element 1", "Element 2"],
        "recommendations": [long_text],
    }

    output_path = tmp_path / "clearcast.pdf"
    generator = ClearcastPDFGenerator()
    success = generator.generate_pdf(
        results=results,
        video_name="Y" * 220,
        video_duration=25.0,
        thumbnail_base64=None,
        output_path=str(output_path),
    )

    assert success is True
    assert output_path.exists()
    assert output_path.stat().st_size > 0
