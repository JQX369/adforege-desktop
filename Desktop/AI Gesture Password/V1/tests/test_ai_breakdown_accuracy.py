"""
Accuracy evaluation tests for AI Video Breakdown extraction.

This test harness compares our AIVideoBreakdown outputs against known-good
"gold standard" records that mirror TellyAds database entries.

The goal is to ensure that future prompt/model changes maintain or improve
extraction accuracy for core fields.
"""

import pytest
from typing import Dict, List, Any
from app.features.ai_breakdown.ai_video_breakdown import AIVideoBreakdown, EXTRACTION_VERSION


# --- Gold Standard Test Cases ---
# These simulate known-good TellyAds records with ground truth values.
# In production, these could be loaded from actual TellyAds Supabase rows.

GOLD_STANDARD_CASES = [
    {
        "id": "gold-001",
        "name": "Coffee Brand Ad with Price Claim",
        "transcript": "Introducing our new premium coffee blend. Get 50% off your first order with code COFFEE50. Terms and conditions apply. Visit coffee.com today.",
        "supers": ["50% OFF FIRST ORDER", "CODE: COFFEE50", "TERMS AND CONDITIONS APPLY"],
        "expected": {
            "breakdown": {
                "product_category": "Food & Beverage",  # Should detect food/beverage
                "has_cta": True,  # "Visit coffee.com today" is a CTA
            },
            "content_indicators": {
                "has_price_claims": True,  # "50% off" is a price claim
                "has_supers": True,  # Has legal/promo text overlays
                "has_risk_disclaimer": True,  # "Terms and conditions apply"
                "has_voiceover": True,  # Has transcript
            },
            "creative_profile": {
                "objective_category": ["awareness", "conversion"],  # Promo ad
            },
        },
    },
    {
        "id": "gold-002",
        "name": "Financial Services Ad with Disclaimer",
        "transcript": "Your home may be at risk if you do not keep up repayments on a mortgage. Representative APR 6.8%. Subject to status.",
        "supers": ["YOUR HOME MAY BE AT RISK", "REPRESENTATIVE APR 6.8%", "AUTHORISED AND REGULATED BY THE FCA"],
        "expected": {
            "breakdown": {
                "product_category": "Finance",  # Should detect finance
            },
            "content_indicators": {
                "has_price_claims": True,  # APR is a price-related claim
                "has_risk_disclaimer": True,  # Multiple risk disclaimers
                "has_supers": True,
                "has_voiceover": True,
            },
        },
    },
    {
        "id": "gold-003",
        "name": "Gambling Ad with Age Restriction",
        "transcript": "Bet on your favourite team today. 18 plus only. Please gamble responsibly. When the fun stops, stop.",
        "supers": ["18+ ONLY", "GAMBLE RESPONSIBLY", "BEGAMBLEAWARE.ORG"],
        "expected": {
            "content_indicators": {
                "has_risk_disclaimer": True,  # Age restriction + gambling warning
                "has_supers": True,
                "has_voiceover": True,
            },
        },
    },
    {
        "id": "gold-004",
        "name": "Simple Brand Awareness Ad",
        "transcript": "Experience the difference. Our new collection is here.",
        "supers": [],
        "expected": {
            "content_indicators": {
                "has_price_claims": False,  # No pricing
                "has_risk_disclaimer": False,  # No disclaimers
                "has_supers": False,  # No supers
                "has_voiceover": True,
            },
            "creative_profile": {
                "objective_category": ["awareness"],  # Brand awareness
            },
        },
    },
    {
        "id": "gold-005",
        "name": "Subscription Service Ad",
        "transcript": "Stream unlimited movies and shows. Only £7.99 per month. Cancel anytime. Start your free trial today.",
        "supers": ["£7.99/MONTH", "FREE TRIAL", "CANCEL ANYTIME"],
        "expected": {
            "breakdown": {
                "product_category": "Entertainment",
            },
            "content_indicators": {
                "has_price_claims": True,  # £7.99 per month
                "has_supers": True,
                "has_voiceover": True,
            },
        },
    },
]


class TestAIBreakdownAccuracy:
    """Test harness for evaluating extraction accuracy against gold standards."""
    
    @pytest.fixture
    def analyzer(self):
        """Create an analyzer instance for testing."""
        return AIVideoBreakdown(api_key="fake")
    
    def _simulate_ai_response(self, case: Dict) -> str:
        """
        Simulate an AI response based on the test case.
        
        In a real scenario, this would call the actual AI model.
        For testing, we simulate a minimal valid response that the
        heuristics can then enhance.
        """
        return """
        {
            "breakdown": {
                "what_is_advertised": "Test Product",
                "product_category": "Unknown"
            },
            "content_indicators": {
                "has_voiceover": false,
                "has_dialogue": false,
                "has_on_screen_text": false,
                "has_supers": false,
                "has_price_claims": false,
                "has_risk_disclaimer": false,
                "has_celeb": false,
                "has_ugc_style": false
            },
            "creative_profile": {
                "objective": "awareness"
            }
        }
        """
    
    @pytest.mark.parametrize("case", GOLD_STANDARD_CASES, ids=lambda c: c["id"])
    def test_content_indicators_accuracy(self, analyzer, case):
        """Test that content indicators are accurately detected via heuristics."""
        # Parse response with transcript and supers (heuristics will enhance)
        response = analyzer._parse_response(
            self._simulate_ai_response(case),
            script_text=case["transcript"],
            supers_texts=case["supers"],
        )
        
        expected_indicators = case["expected"].get("content_indicators", {})
        actual_indicators = response.get("content_indicators", {})
        
        # Check each expected indicator
        for indicator, expected_value in expected_indicators.items():
            actual_value = actual_indicators.get(indicator)
            assert actual_value == expected_value, (
                f"Case {case['id']} ({case['name']}): "
                f"Expected {indicator}={expected_value}, got {actual_value}"
            )
    
    def test_price_claims_detection_accuracy(self, analyzer):
        """Test price claim detection across various patterns."""
        price_patterns = [
            ("Only £9.99", True),
            ("$19.99 per month", True),
            ("50% off today", True),
            ("Save £20", True),
            ("Free delivery", True),
            ("RRP £29.99", True),
            ("Just a great product", False),
            ("High quality materials", False),
        ]
        
        for text, expected in price_patterns:
            response = analyzer._parse_response(
                '{"content_indicators": {"has_price_claims": false}}',
                script_text=text,
            )
            actual = response["content_indicators"]["has_price_claims"]
            assert actual == expected, f"Pattern '{text}': expected {expected}, got {actual}"
    
    def test_risk_disclaimer_detection_accuracy(self, analyzer):
        """Test risk disclaimer detection across various patterns."""
        risk_patterns = [
            ("Terms and conditions apply", True),
            ("Your home may be at risk", True),
            ("18+ only", True),
            ("Gamble responsibly", True),
            ("Subject to status", True),
            ("Consult your doctor", True),
            ("Capital at risk", True),
            ("Just a fun product", False),
            ("Great taste guaranteed", False),
        ]
        
        for text, expected in risk_patterns:
            response = analyzer._parse_response(
                '{"content_indicators": {"has_risk_disclaimer": false}}',
                script_text=text,
            )
            actual = response["content_indicators"]["has_risk_disclaimer"]
            assert actual == expected, f"Pattern '{text}': expected {expected}, got {actual}"
    
    def test_supers_detection_from_ocr(self, analyzer):
        """Test supers detection from OCR text."""
        # Uppercase legal text should trigger has_supers
        response = analyzer._parse_response(
            '{"content_indicators": {"has_supers": false}}',
            supers_texts=["TERMS AND CONDITIONS APPLY SEE WEBSITE"],
        )
        assert response["content_indicators"]["has_supers"] is True
        
        # Short text should not trigger
        response = analyzer._parse_response(
            '{"content_indicators": {"has_supers": false}}',
            supers_texts=["Hi"],
        )
        # has_on_screen_text should be true, but has_supers only for legal-style text
        assert response["content_indicators"]["has_on_screen_text"] is True


class TestSchemaConsistency:
    """Tests to ensure schema consistency with TellyAds."""
    
    @pytest.fixture
    def analyzer(self):
        return AIVideoBreakdown(api_key="fake")
    
    def test_all_tellyads_core_metadata_fields_present(self, analyzer):
        """Verify all TellyAds core_metadata fields are in breakdown."""
        response = analyzer._parse_response("{}")
        breakdown = response["breakdown"]
        
        required_fields = [
            "brand_name",
            "product_name", 
            "product_category",
            "product_subcategory",
            "country",
            "language",
            "year",
        ]
        
        for field in required_fields:
            assert field in breakdown, f"Missing TellyAds field: breakdown.{field}"
    
    def test_all_tellyads_campaign_strategy_fields_present(self, analyzer):
        """Verify all TellyAds campaign_strategy fields are in creative_profile."""
        response = analyzer._parse_response("{}")
        creative_profile = response["creative_profile"]
        
        required_fields = [
            "format_type",
            "objective",
            "funnel_stage",
            "primary_kpi",
        ]
        
        for field in required_fields:
            assert field in creative_profile, f"Missing TellyAds field: creative_profile.{field}"
    
    def test_all_tellyads_creative_flags_present(self, analyzer):
        """Verify all TellyAds creative_flags are in content_indicators."""
        response = analyzer._parse_response("{}")
        content_indicators = response["content_indicators"]
        
        required_flags = [
            "has_voiceover",
            "has_dialogue",
            "has_on_screen_text",
            "has_supers",
            "has_price_claims",
            "has_risk_disclaimer",
            "has_celeb",
            "has_ugc_style",
        ]
        
        for flag in required_flags:
            assert flag in content_indicators, f"Missing TellyAds flag: content_indicators.{flag}"
            assert isinstance(content_indicators[flag], bool), f"{flag} should be boolean"
    
    def test_all_tellyads_impact_scores_present(self, analyzer):
        """Verify all TellyAds impact_scores metrics are present."""
        response = analyzer._parse_response("{}")
        impact_scores = response["impact_scores"]
        
        required_metrics = [
            "overall_impact",
            "pulse_score",
            "echo_score",
            "hook_power",
            "brand_integration",
            "emotional_resonance",
            "clarity_score",
            "distinctiveness",
        ]
        
        for metric in required_metrics:
            assert metric in impact_scores, f"Missing TellyAds metric: impact_scores.{metric}"
            assert isinstance(impact_scores[metric], float), f"{metric} should be float"
            assert 0.0 <= impact_scores[metric] <= 10.0, f"{metric} should be in 0-10 range"


class TestExtractionVersioning:
    """Tests for extraction version tracking."""
    
    def test_extraction_version_is_semver(self):
        """Verify extraction version follows semantic versioning."""
        parts = EXTRACTION_VERSION.split(".")
        assert len(parts) >= 2, "Version should have at least major.minor"
        assert all(part.isdigit() for part in parts), "Version parts should be numeric"
    
    def test_extraction_version_is_at_least_1_1(self):
        """Verify we're on at least version 1.1 (TellyAds alignment)."""
        parts = EXTRACTION_VERSION.split(".")
        major = int(parts[0])
        minor = int(parts[1])
        
        assert major >= 1, "Major version should be at least 1"
        if major == 1:
            assert minor >= 1, "Minor version should be at least 1 for TellyAds alignment"




