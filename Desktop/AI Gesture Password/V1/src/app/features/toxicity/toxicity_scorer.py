"""
Toxicity Scorer - Main Scoring Engine

Calculates a 0-100 toxicity score across three pillars:
1. Physiological Harm (40% weight) - Sensory assault metrics
2. Psychological Manipulation (40% weight) - Dark patterns and manipulative language
3. Regulatory Risk (20% weight) - Compliance violations

Formula: Toxicity Score = (Physiological × 0.40) + (Psychological × 0.40) + (Regulatory × 0.20)
"""

import logging
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple

from .dark_patterns import (
    detect_dark_patterns,
    format_dark_pattern_flags,
    DarkPatternMatch,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Constants and Thresholds
# =============================================================================

# Weights (must sum to 1.0)
WEIGHT_PHYSIOLOGICAL = 0.40
WEIGHT_PSYCHOLOGICAL = 0.40
WEIGHT_REGULATORY = 0.20

# AI blending weights
HEURISTIC_WEIGHT = 0.40  # 40% heuristic-based scoring
AI_WEIGHT = 0.60  # 60% AI-based scoring (when available)

# Risk level thresholds
RISK_LOW_MAX = 30
RISK_MEDIUM_MAX = 60

# Physiological thresholds and points
CUTS_PER_MINUTE_THRESHOLD = 80
LOUDNESS_LU_THRESHOLD = -10  # LUFS, anything louder (less negative) is extreme
BRIGHTNESS_VARIANCE_THRESHOLD = 0.8
MOTION_ENERGY_THRESHOLD = 0.9

POINTS_HIGH_CUTS = 20
POINTS_LOUD_AUDIO = 30
POINTS_PHOTOSENSITIVITY = 50
POINTS_BRIGHTNESS_VARIANCE = 25
POINTS_MOTION_ENERGY = 10

# Psychological thresholds and points
CLAIM_DENSITY_THRESHOLD = 6  # claims per minute
POINTS_CLAIM_OVERLOAD = 20
POINTS_AI_MANIPULATION = 15  # max from AI analysis
POINTS_SUBTLE_PATTERN = 5  # per subtle pattern

# Regulatory thresholds and points
POINTS_GARM_HIGH_RISK = 50
POINTS_GARM_MEDIUM_RISK = 25
POINTS_MISSING_DISCLAIMER = 50
POINTS_CATEGORY_DISCLAIMER = 15

# Regulated category keywords
REGULATED_CATEGORIES = {
    "pharma": {
        "keywords": ["medication", "prescription", "drug", "medicine", "pharmaceutical", "pill"],
        "required": ["side effects", "consult doctor", "ask your doctor"],
    },
    "alcohol": {
        "keywords": ["beer", "wine", "vodka", "whiskey", "liquor", "alcohol", "spirits"],
        "required": ["drink responsibly", "21+", "legal drinking age"],
    },
    "gambling": {
        "keywords": ["bet", "casino", "poker", "lottery", "wager", "odds", "gamble"],
        "required": ["gamble responsibly", "18+", "play responsibly"],
    },
    "financial": {
        "keywords": ["invest", "stock", "loan", "mortgage", "credit", "insurance", "bank"],
        "required": ["past performance", "risk of loss", "not guaranteed"],
    },
}


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class PillarBreakdown:
    """Breakdown for a single scoring pillar."""
    score: int = 0
    flags: List[str] = field(default_factory=list)
    
    def to_dict(self):
        return asdict(self)


@dataclass
class PsychologicalBreakdown(PillarBreakdown):
    """Extended breakdown for psychological pillar with AI analysis."""
    ai_analysis: Optional[Dict[str, Any]] = None
    
    def to_dict(self):
        result = asdict(self)
        if self.ai_analysis is None:
            result.pop("ai_analysis", None)
        return result


@dataclass
class ToxicityReport:
    """Complete toxicity analysis report."""
    toxic_score: int = 0
    risk_level: str = "LOW"
    breakdown: Dict[str, Any] = field(default_factory=dict)
    dark_patterns_detected: List[str] = field(default_factory=list)
    recommendation: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self):
        return {
            "toxic_score": self.toxic_score,
            "risk_level": self.risk_level,
            "breakdown": self.breakdown,
            "dark_patterns_detected": self.dark_patterns_detected,
            "recommendation": self.recommendation,
            "metadata": self.metadata,
        }


# =============================================================================
# Toxicity Scorer
# =============================================================================

class ToxicityScorer:
    """
    Main toxicity scoring engine.
    
    Calculates a weighted toxicity score across three pillars:
    - Physiological Harm (40%)
    - Psychological Manipulation (40%)
    - Regulatory Risk (20%)
    """
    
    def __init__(self, use_ai: bool = True):
        """
        Initialize the scorer.
        
        Args:
            use_ai: Whether to use AI for enhanced dark pattern detection
        """
        self.use_ai = use_ai
    
    def calculate_toxicity(
        self,
        analysis_data: Dict[str, Any],
        ai_toxicity: Optional[Dict[str, Any]] = None,
    ) -> ToxicityReport:
        """
        Calculate the complete toxicity report.

        Args:
            analysis_data: Dictionary containing:
                - visual_physics: VisualPhysics data (or dict)
                - audio_physics: AudioPhysics data (or dict)
                - transcript: Full ad transcript text
                - claims: List of claims from analysis
                - duration_seconds: Ad duration
                - garm_risk_level: "low", "medium", or "high"
                - required_disclaimers: List of required disclaimers
                - present_disclaimers: List of disclaimers found in ad
            ai_toxicity: Optional AI-generated toxicity assessment from Gemini

        Returns:
            ToxicityReport with complete breakdown
        """
        # Extract data with defaults
        visual = analysis_data.get("visual_physics", {})
        audio = analysis_data.get("audio_physics", {})
        transcript = analysis_data.get("transcript", "")
        claims = analysis_data.get("claims", [])
        duration = analysis_data.get("duration_seconds", 0.0)
        garm_level = analysis_data.get("garm_risk_level", "low")
        required_disclaimers = analysis_data.get("required_disclaimers", [])
        present_disclaimers = analysis_data.get("present_disclaimers", [])

        # Calculate heuristic pillar scores
        physio_score, physio_flags = self._score_physiological(visual, audio)
        psycho_breakdown = self._score_psychological(transcript, claims, duration)
        regulatory_score, regulatory_flags = self._score_regulatory(
            transcript, garm_level, required_disclaimers, present_disclaimers
        )

        # Blend with AI scores if available
        if ai_toxicity and isinstance(ai_toxicity, dict) and ai_toxicity.get("overall_score", 0) > 0:
            ai_physio = ai_toxicity.get("physiological_concerns", {}).get("score", 0)
            ai_psycho = ai_toxicity.get("psychological_concerns", {}).get("score", 0)
            ai_regulatory = ai_toxicity.get("regulatory_concerns", {}).get("score", 0)

            # Blend heuristic and AI scores (40% heuristic, 60% AI)
            physio_score = round(HEURISTIC_WEIGHT * physio_score + AI_WEIGHT * ai_physio)
            psycho_breakdown.score = round(HEURISTIC_WEIGHT * psycho_breakdown.score + AI_WEIGHT * ai_psycho)
            regulatory_score = round(HEURISTIC_WEIGHT * regulatory_score + AI_WEIGHT * ai_regulatory)

            # Merge AI flags with heuristic flags
            ai_physio_flags = ai_toxicity.get("physiological_concerns", {}).get("flags", [])
            ai_psycho_tactics = ai_toxicity.get("psychological_concerns", {}).get("manipulation_tactics", [])
            ai_psycho_patterns = ai_toxicity.get("psychological_concerns", {}).get("dark_patterns", [])
            ai_regulatory_risks = ai_toxicity.get("regulatory_concerns", {}).get("compliance_risks", [])

            # Add AI-detected flags that aren't duplicates
            for flag in ai_physio_flags:
                if flag and flag not in physio_flags:
                    physio_flags.append(f"[AI] {flag}")

            for tactic in ai_psycho_tactics + ai_psycho_patterns:
                if tactic and tactic not in psycho_breakdown.flags:
                    psycho_breakdown.flags.append(f"[AI] {tactic}")

            for risk in ai_regulatory_risks:
                if risk and risk not in regulatory_flags:
                    regulatory_flags.append(f"[AI] {risk}")

            logger.info(f"AI toxicity blended: physio={physio_score}, psycho={psycho_breakdown.score}, regulatory={regulatory_score}")

        # Apply weights
        weighted_physio = physio_score * WEIGHT_PHYSIOLOGICAL
        weighted_psycho = psycho_breakdown.score * WEIGHT_PSYCHOLOGICAL
        weighted_regulatory = regulatory_score * WEIGHT_REGULATORY

        # Calculate final score
        total_score = round(weighted_physio + weighted_psycho + weighted_regulatory)
        total_score = max(0, min(100, total_score))
        
        # Determine risk level
        if total_score <= RISK_LOW_MAX:
            risk_level = "LOW"
        elif total_score <= RISK_MEDIUM_MAX:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"
        
        # Generate recommendation
        recommendation = self._generate_recommendation(
            risk_level, physio_flags, psycho_breakdown.flags, regulatory_flags
        )
        
        # Build report
        report = ToxicityReport(
            toxic_score=total_score,
            risk_level=risk_level,
            breakdown={
                "physiological": {
                    "score": physio_score,
                    "weight": WEIGHT_PHYSIOLOGICAL,
                    "flags": physio_flags,
                },
                "psychological": {
                    "score": psycho_breakdown.score,
                    "weight": WEIGHT_PSYCHOLOGICAL,
                    "flags": psycho_breakdown.flags,
                    **({"ai_analysis": psycho_breakdown.ai_analysis} if psycho_breakdown.ai_analysis else {}),
                },
                "regulatory": {
                    "score": regulatory_score,
                    "weight": WEIGHT_REGULATORY,
                    "flags": regulatory_flags,
                },
            },
            dark_patterns_detected=self._extract_dark_pattern_texts(transcript),
            recommendation=recommendation,
            metadata={
                "weights": {
                    "physiological": WEIGHT_PHYSIOLOGICAL,
                    "psychological": WEIGHT_PSYCHOLOGICAL,
                    "regulatory": WEIGHT_REGULATORY,
                },
                "duration_seconds": duration,
                "claims_count": len(claims) if isinstance(claims, list) else 0,
                "ai_enabled": self.use_ai,
            },
        )
        
        logger.info(
            f"Toxicity calculated: score={total_score}, risk={risk_level}, "
            f"physio={physio_score}, psycho={psycho_breakdown.score}, regulatory={regulatory_score}"
        )
        
        return report
    
    def _score_physiological(
        self,
        visual: Dict[str, Any],
        audio: Dict[str, Any]
    ) -> Tuple[int, List[str]]:
        """
        Score physiological harm pillar.
        
        Metrics:
        - Cuts per minute (>80 = +20 points)
        - Loudness (>-10 LUFS = +30 points)
        - Photosensitivity fail = +50 points
        - Brightness variance (>0.8 = +25 points)
        - Motion energy (>0.9 = +10 points)
        """
        score = 0
        flags: List[str] = []
        
        # Handle dict or dataclass
        if hasattr(visual, "to_dict"):
            visual = visual.to_dict()
        if hasattr(audio, "to_dict"):
            audio = audio.to_dict()
        
        # Cuts per minute
        cuts_pm = visual.get("cuts_per_minute", 0)
        if cuts_pm > CUTS_PER_MINUTE_THRESHOLD:
            score += POINTS_HIGH_CUTS
            flags.append(f"Rapid Cuts ({cuts_pm:.0f}/min exceeds {CUTS_PER_MINUTE_THRESHOLD})")
        
        # Loudness
        loudness = audio.get("loudness_lu", -24)
        if loudness > LOUDNESS_LU_THRESHOLD:
            score += POINTS_LOUD_AUDIO
            flags.append(f"Extreme Loudness ({loudness:.1f} LUFS exceeds {LOUDNESS_LU_THRESHOLD})")
        
        # Photosensitivity
        if visual.get("photosensitivity_fail", False):
            score += POINTS_PHOTOSENSITIVITY
            flags.append("Seizure Risk (Photosensitivity test failed)")
        
        # Brightness variance
        brightness_var = visual.get("brightness_variance", 0)
        if brightness_var > BRIGHTNESS_VARIANCE_THRESHOLD:
            score += POINTS_BRIGHTNESS_VARIANCE
            flags.append(f"Flash Warning (Brightness variance {brightness_var:.2f})")
        
        # Motion energy
        motion = visual.get("motion_energy_score", 0)
        if motion > MOTION_ENERGY_THRESHOLD:
            score += POINTS_MOTION_ENERGY
            flags.append(f"Hyper-Stimulation (Motion score {motion:.2f})")
        
        # Cap at 100
        score = min(score, 100)
        
        return score, flags
    
    def _score_psychological(
        self,
        transcript: str,
        claims: List[Any],
        duration_seconds: float
    ) -> PsychologicalBreakdown:
        """
        Score psychological manipulation pillar.
        
        Metrics:
        - Dark pattern categories (10 points each, max 30)
        - Claim density (>6/min = +20 points)
        - AI subtle patterns (+5 each, max 15)
        - AI manipulation score (up to +15)
        """
        score = 0
        flags: List[str] = []
        ai_analysis = None
        
        # Dark pattern detection
        matches, categories, pattern_score = detect_dark_patterns(transcript)
        score += pattern_score
        
        # Add flags for each category
        pattern_flags = format_dark_pattern_flags(matches)
        flags.extend(pattern_flags)
        
        # Claim density (Gish Gallop detection)
        duration_minutes = duration_seconds / 60.0 if duration_seconds > 0 else 0
        num_claims = len(claims) if isinstance(claims, list) else 0
        
        if duration_minutes > 0:
            claim_density = num_claims / duration_minutes
            if claim_density > CLAIM_DENSITY_THRESHOLD:
                score += POINTS_CLAIM_OVERLOAD
                flags.append(f"Claim Overload ({claim_density:.1f} claims/min exceeds {CLAIM_DENSITY_THRESHOLD})")
        
        # AI-enhanced detection would go here
        # For now, we'll use heuristics based on existing analysis
        if self.use_ai:
            # Placeholder for AI analysis - could integrate with Gemini
            ai_analysis = {
                "model": "heuristic",
                "manipulation_score": min(1.0, len(categories) * 0.2),
                "subtle_patterns": [],
                "fear_appeals": [m.matched_text for m in matches if m.category == "fear_appeal"],
            }
            
            # Add AI manipulation score contribution
            if ai_analysis["manipulation_score"] > 0.5:
                ai_contribution = int(ai_analysis["manipulation_score"] * POINTS_AI_MANIPULATION)
                score += ai_contribution
        
        # Cap at 100
        score = min(score, 100)
        
        return PsychologicalBreakdown(
            score=score,
            flags=flags,
            ai_analysis=ai_analysis,
        )
    
    def _score_regulatory(
        self,
        transcript: str,
        garm_level: str,
        required_disclaimers: List[str],
        present_disclaimers: List[str]
    ) -> Tuple[int, List[str]]:
        """
        Score regulatory risk pillar.
        
        Metrics:
        - GARM risk level (high=50, medium=25 points)
        - Missing required disclaimers (+50 points)
        - Regulated category without disclaimers (+15 points)
        """
        score = 0
        flags: List[str] = []
        
        # GARM risk level
        garm_level_lower = (garm_level or "low").lower()
        if garm_level_lower == "high":
            score += POINTS_GARM_HIGH_RISK
            flags.append("GARM High Risk Category")
        elif garm_level_lower == "medium":
            score += POINTS_GARM_MEDIUM_RISK
            flags.append("GARM Medium Risk Category")
        
        # Missing disclaimers
        if required_disclaimers:
            present_lower = [d.lower() for d in present_disclaimers]
            missing = []
            
            for required in required_disclaimers:
                # Check if any present disclaimer contains the required text
                required_lower = required.lower()
                found = any(required_lower in p or p in required_lower for p in present_lower)
                if not found:
                    missing.append(required)
            
            if missing:
                score += POINTS_MISSING_DISCLAIMER
                flags.append(f"Missing Disclaimers: {', '.join(missing[:3])}")
        
        # Check regulated categories
        transcript_lower = transcript.lower() if transcript else ""
        
        for category, rules in REGULATED_CATEGORIES.items():
            # Check if transcript contains category keywords
            has_category_keyword = any(kw in transcript_lower for kw in rules["keywords"])
            
            if has_category_keyword:
                # Check if any required disclaimer is present
                has_disclaimer = any(
                    req.lower() in transcript_lower or 
                    any(req.lower() in p.lower() for p in present_disclaimers)
                    for req in rules["required"]
                )
                
                if not has_disclaimer:
                    score += POINTS_CATEGORY_DISCLAIMER
                    flags.append(f"{category.title()} Category Disclaimer May Be Required")
                    break  # Only flag once
        
        # Cap at 100
        score = min(score, 100)
        
        return score, flags
    
    def _extract_dark_pattern_texts(self, transcript: str) -> List[str]:
        """Extract matched text from all dark patterns."""
        matches, _, _ = detect_dark_patterns(transcript, include_all_matches=True)
        return list(set(m.matched_text for m in matches))
    
    def _generate_recommendation(
        self,
        risk_level: str,
        physio_flags: List[str],
        psycho_flags: List[str],
        regulatory_flags: List[str]
    ) -> str:
        """Generate a recommendation based on the risk level and flags."""
        all_flags = physio_flags + psycho_flags + regulatory_flags
        num_issues = len(all_flags)
        
        if risk_level == "LOW":
            if num_issues == 0:
                return "LOW RISK. This ad appears safe for broadcast with no significant concerns."
            else:
                return f"LOW RISK. {num_issues} minor concern(s) detected but within acceptable limits."
        
        elif risk_level == "MEDIUM":
            concerns = []
            if physio_flags:
                concerns.append("sensory intensity")
            if psycho_flags:
                concerns.append("persuasion tactics")
            if regulatory_flags:
                concerns.append("compliance")
            
            concern_text = ", ".join(concerns) if concerns else "various areas"
            return f"MODERATE RISK. Review recommended for {concern_text}. Address flagged concerns before broadcast."
        
        else:  # HIGH
            return f"HIGH RISK. {num_issues} significant concern(s) require immediate attention. This ad may face regulatory challenges or audience backlash. Consider major revisions."


def calculate_toxicity_score(
    analysis_data: Dict[str, Any],
    use_ai: bool = True,
    ai_toxicity: Optional[Dict[str, Any]] = None,
) -> ToxicityReport:
    """
    Convenience function to calculate toxicity score.

    Args:
        analysis_data: Analysis data dictionary
        use_ai: Whether to use AI for enhanced detection
        ai_toxicity: Optional AI-generated toxicity assessment from Gemini

    Returns:
        ToxicityReport
    """
    scorer = ToxicityScorer(use_ai=use_ai)
    return scorer.calculate_toxicity(analysis_data, ai_toxicity=ai_toxicity)

