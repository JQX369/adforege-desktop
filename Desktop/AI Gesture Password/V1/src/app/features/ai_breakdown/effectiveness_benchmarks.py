"""Effectiveness Score Benchmark System

Provides tier definitions and lookup functions for effectiveness scores (0-100%)
with consistent application across all metrics (effectiveness, engagement, conversion, memorability).
"""

from typing import Dict, Tuple, Optional

# Tier definitions with ranges, colors, and metric estimates
TIER_DEFINITIONS = {
    "Poor": {
        "range": (0, 20),
        "color": "#E74C3C",  # Red
        "overall": "Minimal impact expected; significant improvements needed across multiple areas",
        "engagement": "Very Low (<5% expected engagement)",
        "conversion": "Minimal lift expected; viewers are unlikely to take immediate action",
        "memorability": "Poor (unlikely to be remembered)"
    },
    "Below Average": {
        "range": (20, 40),
        "color": "#F39C12",  # Orange
        "overall": "Limited effectiveness; multiple areas need attention before launch",
        "engagement": "Low (5-15% expected engagement)",
        "conversion": "Needs nurturing before audiences even consider responding",
        "memorability": "Weak (low recall after 24 hours)"
    },
    "Average": {
        "range": (40, 60),
        "color": "#F1C40F",  # Yellow
        "overall": "Moderate impact; some strengths but room for improvement",
        "engagement": "Moderate (15-30% expected engagement)",
        "conversion": "Capable of nudging curious viewers toward consideration when supported",
        "memorability": "Fair (moderate recall, may need reinforcement)"
    },
    "Good": {
        "range": (60, 80),
        "color": "#2ECC71",  # Light Green
        "overall": "Strong performance; minor optimizations could enhance results",
        "engagement": "High (30-50% expected engagement)",
        "conversion": "Strong prompt to explore next steps; expect steady hand-raisers",
        "memorability": "Strong (good recall, brand association forming)"
    },
    "Excellent": {
        "range": (80, 100),
        "color": "#27AE60",  # Dark Green
        "overall": "Exceptional effectiveness; best-in-class performance",
        "engagement": "Very High (>50% expected engagement)",
        "conversion": "Excellent action intent—audiences are ready to respond immediately",
        "memorability": "Excellent (high recall, strong brand association)"
    }
}

# Text-to-numeric mapping for metrics that come as text
TEXT_TO_TIER_MAP = {
    "very low": "Poor",
    "low": "Below Average",
    "moderate": "Average",
    "medium": "Average",
    "high": "Good",
    "very high": "Excellent",
    "excellent": "Excellent",
    "poor": "Poor",
    "weak": "Below Average",
    "fair": "Average",
    "strong": "Good",
    "minimal": "Poor"
}


def get_tier(score: float) -> str:
    """Get tier name for a given score (0-100).
    
    Args:
        score: Numeric score from 0 to 100
        
    Returns:
        Tier name: "Poor", "Below Average", "Average", "Good", or "Excellent"
    """
    score = max(0.0, min(100.0, float(score)))
    
    if score < 20:
        return "Poor"
    elif score < 40:
        return "Below Average"
    elif score < 60:
        return "Average"
    elif score < 80:
        return "Good"
    else:
        return "Excellent"


def get_tier_range(score: float) -> Tuple[int, int]:
    """Get the min and max values for the tier containing this score.
    
    Args:
        score: Numeric score from 0 to 100
        
    Returns:
        Tuple of (min, max) for the tier range
    """
    tier = get_tier(score)
    return TIER_DEFINITIONS[tier]["range"]


def get_tier_definition(tier: str) -> Dict:
    """Get full definition dictionary for a tier.
    
    Args:
        tier: Tier name ("Poor", "Below Average", "Average", "Good", "Excellent")
        
    Returns:
        Dictionary with tier definition including range, color, and all metric estimates
    """
    return TIER_DEFINITIONS.get(tier, TIER_DEFINITIONS["Average"])


def get_tier_color(tier: str) -> str:
    """Get hex color code for a tier.
    
    Args:
        tier: Tier name or score (if float, will be converted to tier)
        
    Returns:
        Hex color code string
    """
    if isinstance(tier, (int, float)):
        tier = get_tier(float(tier))
    
    definition = get_tier_definition(tier)
    return definition.get("color", "#95A5A6")  # Default gray


def get_metric_estimate(metric: str, tier: str) -> str:
    """Get estimate for a specific metric within a tier.
    
    Args:
        metric: One of "overall", "engagement", "conversion", "memorability"
        tier: Tier name or score (if float, will be converted to tier)
        
    Returns:
        Estimate string for the metric
    """
    if isinstance(tier, (int, float)):
        tier = get_tier(float(tier))
    
    definition = get_tier_definition(tier)
    return definition.get(metric, "Unknown")


def get_score_color(score: float) -> str:
    """Get color for a score directly (convenience function).
    
    Args:
        score: Numeric score from 0 to 100
        
    Returns:
        Hex color code string
    """
    tier = get_tier(score)
    return get_tier_color(tier)


def convert_text_to_tier(text: str) -> Optional[str]:
    """Convert text-based metric description to tier name.
    
    Args:
        text: Text description (e.g., "High", "Low", "Very Low")
        
    Returns:
        Tier name or None if no match found
    """
    text_lower = text.lower().strip()
    return TEXT_TO_TIER_MAP.get(text_lower)


def get_all_tiers() -> list:
    """Get list of all tier names in order.
    
    Returns:
        List of tier names from lowest to highest
    """
    return ["Poor", "Below Average", "Average", "Good", "Excellent"]


def format_score_with_tier(score: float) -> str:
    """Format score with tier label (e.g., "75% — Good").
    
    Args:
        score: Numeric score from 0 to 100
        
    Returns:
        Formatted string with score and tier
    """
    tier = get_tier(score)
    return f"{int(score)}% — {tier}"

