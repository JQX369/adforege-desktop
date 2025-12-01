"""Unit tests for effectiveness benchmarks module"""

import pytest
from app.features.ai_breakdown.effectiveness_benchmarks import (
    get_tier,
    get_tier_range,
    get_tier_definition,
    get_tier_color,
    get_metric_estimate,
    get_score_color,
    convert_text_to_tier,
    get_all_tiers,
    format_score_with_tier,
    TIER_DEFINITIONS
)


class TestGetTier:
    """Test tier lookup by score"""
    
    def test_poor_tier(self):
        assert get_tier(0) == "Poor"
        assert get_tier(10) == "Poor"
        assert get_tier(19.9) == "Poor"
    
    def test_below_average_tier(self):
        assert get_tier(20) == "Below Average"
        assert get_tier(30) == "Below Average"
        assert get_tier(39.9) == "Below Average"
    
    def test_average_tier(self):
        assert get_tier(40) == "Average"
        assert get_tier(50) == "Average"
        assert get_tier(59.9) == "Average"
    
    def test_good_tier(self):
        assert get_tier(60) == "Good"
        assert get_tier(70) == "Good"
        assert get_tier(79.9) == "Good"
    
    def test_excellent_tier(self):
        assert get_tier(80) == "Excellent"
        assert get_tier(90) == "Excellent"
        assert get_tier(100) == "Excellent"
    
    def test_boundary_values(self):
        assert get_tier(20) == "Below Average"  # Lower boundary
        assert get_tier(40) == "Average"
        assert get_tier(60) == "Good"
        assert get_tier(80) == "Excellent"
    
    def test_out_of_range_clamping(self):
        assert get_tier(-10) == "Poor"
        assert get_tier(150) == "Excellent"


class TestGetTierRange:
    """Test tier range lookup"""
    
    def test_poor_range(self):
        assert get_tier_range(10) == (0, 20)
    
    def test_below_average_range(self):
        assert get_tier_range(30) == (20, 40)
    
    def test_average_range(self):
        assert get_tier_range(50) == (40, 60)
    
    def test_good_range(self):
        assert get_tier_range(70) == (60, 80)
    
    def test_excellent_range(self):
        assert get_tier_range(90) == (80, 100)


class TestGetTierDefinition:
    """Test tier definition lookup"""
    
    def test_all_tiers_have_definitions(self):
        for tier in get_all_tiers():
            definition = get_tier_definition(tier)
            assert isinstance(definition, dict)
            assert "range" in definition
            assert "color" in definition
            assert "overall" in definition
            assert "engagement" in definition
            assert "conversion" in definition
            assert "memorability" in definition
    
    def test_invalid_tier_defaults(self):
        definition = get_tier_definition("Invalid Tier")
        assert definition == TIER_DEFINITIONS["Average"]


class TestGetTierColor:
    """Test tier color lookup"""
    
    def test_color_by_tier_name(self):
        assert get_tier_color("Poor") == "#E74C3C"
        assert get_tier_color("Below Average") == "#F39C12"
        assert get_tier_color("Average") == "#F1C40F"
        assert get_tier_color("Good") == "#2ECC71"
        assert get_tier_color("Excellent") == "#27AE60"
    
    def test_color_by_score(self):
        assert get_tier_color(10) == "#E74C3C"  # Poor
        assert get_tier_color(30) == "#F39C12"  # Below Average
        assert get_tier_color(50) == "#F1C40F"  # Average
        assert get_tier_color(70) == "#2ECC71"  # Good
        assert get_tier_color(90) == "#27AE60"  # Excellent


class TestGetMetricEstimate:
    """Test metric estimate lookup"""
    
    def test_overall_estimate(self):
        estimate = get_metric_estimate("overall", "Good")
        assert "Strong performance" in estimate
    
    def test_engagement_estimate(self):
        estimate = get_metric_estimate("engagement", "Average")
        assert "Moderate" in estimate
    
    def test_conversion_estimate(self):
        estimate = get_metric_estimate("conversion", "Excellent")
        assert "Excellent" in estimate
    
    def test_memorability_estimate(self):
        estimate = get_metric_estimate("memorability", "Poor")
        assert "Poor" in estimate or "unlikely" in estimate.lower()
    
    def test_estimate_by_score(self):
        estimate = get_metric_estimate("overall", 75)
        assert isinstance(estimate, str)
        assert len(estimate) > 0


class TestGetScoreColor:
    """Test direct score-to-color conversion"""
    
    def test_score_colors(self):
        assert get_score_color(10) == "#E74C3C"  # Poor
        assert get_score_color(30) == "#F39C12"  # Below Average
        assert get_score_color(50) == "#F1C40F"  # Average
        assert get_score_color(70) == "#2ECC71"  # Good
        assert get_score_color(90) == "#27AE60"  # Excellent


class TestConvertTextToTier:
    """Test text-to-tier conversion"""
    
    def test_common_text_values(self):
        assert convert_text_to_tier("High") == "Good"
        assert convert_text_to_tier("Low") == "Below Average"
        assert convert_text_to_tier("Very Low") == "Poor"
        assert convert_text_to_tier("Very High") == "Excellent"
        assert convert_text_to_tier("Moderate") == "Average"
        assert convert_text_to_tier("Excellent") == "Excellent"
    
    def test_case_insensitive(self):
        assert convert_text_to_tier("HIGH") == "Good"
        assert convert_text_to_tier("high") == "Good"
        assert convert_text_to_tier("High") == "Good"
    
    def test_unknown_text(self):
        assert convert_text_to_tier("Unknown") is None
        assert convert_text_to_tier("") is None


class TestFormatScoreWithTier:
    """Test score formatting with tier"""
    
    def test_formatting(self):
        assert format_score_with_tier(75) == "75% — Good"
        assert format_score_with_tier(25) == "25% — Below Average"
        assert format_score_with_tier(95) == "95% — Excellent"
    
    def test_rounding(self):
        assert format_score_with_tier(75.7) == "75% — Good"
        assert format_score_with_tier(25.3) == "25% — Below Average"


class TestGetAllTiers:
    """Test tier list retrieval"""
    
    def test_tier_order(self):
        tiers = get_all_tiers()
        assert tiers == ["Poor", "Below Average", "Average", "Good", "Excellent"]
        assert len(tiers) == 5

