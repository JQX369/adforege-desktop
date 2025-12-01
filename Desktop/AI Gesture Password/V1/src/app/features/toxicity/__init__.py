"""
Toxicity scoring module for ad analysis.

Evaluates ads across three pillars:
1. Physiological Harm (40%) - Sensory assault metrics
2. Psychological Manipulation (40%) - Dark patterns and manipulative language
3. Regulatory Risk (20%) - Compliance violations
"""

from .dark_patterns import detect_dark_patterns, DarkPatternMatch
from .toxicity_scorer import ToxicityScorer, ToxicityReport

__all__ = [
    "detect_dark_patterns",
    "DarkPatternMatch", 
    "ToxicityScorer",
    "ToxicityReport",
]

