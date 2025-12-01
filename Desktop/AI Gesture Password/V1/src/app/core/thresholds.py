"""
Centralized Threshold Configuration

All magic numbers and thresholds used throughout the analysis pipeline
are defined here with documentation explaining their purpose and rationale.

This makes it easy to:
- Find and understand all threshold values
- Tune values for different use cases
- Maintain consistency across the codebase
"""


class AnalysisThresholds:
    """Thresholds for video analysis pipeline."""

    # === RAG Similarity Thresholds ===
    # Used in ai_video_breakdown.py for similar ad retrieval
    RAG_MIN_SIMILARITY = 0.4  # Below this, ads are considered unrelated
    RAG_HIGH_SIMILARITY = 0.7  # Above this, ads are very similar
    RAG_DEFAULT_LIMIT = 6  # Number of similar ads to retrieve

    # === Score Validation Thresholds ===
    # Used for evaluating ad element strengths and impact scores
    STRENGTH_HIGH = 7  # Score >= this is considered "strong"
    STRENGTH_MEDIUM = 5  # Score >= this is "medium", below is "weak"
    STRENGTH_LOW = 4  # Score <= this is considered "weak"

    # === Impact Score Blending Weights ===
    # Used in _adjust_impact_scores_with_data()
    AI_SCORE_WEIGHT = 0.6  # Weight given to AI-generated scores
    DATA_SCORE_WEIGHT = 0.4  # Weight given to data-driven adjustments

    # === Emotional Resonance Components ===
    # Weights for calculating data-driven emotional resonance
    INTENSITY_WEIGHT = 0.5  # Average intensity contribution
    POSITIVE_RATIO_WEIGHT = 0.3  # Positive emotion ratio contribution
    EMOTIONAL_RANGE_WEIGHT = 0.2  # Emotional variety contribution

    # === Impact Score Weights for Overall Calculation ===
    # Weights used in _adjust_impact_scores_with_data()
    HOOK_POWER_WEIGHT = 0.15
    EMOTIONAL_RESONANCE_WEIGHT = 0.20
    CLARITY_WEIGHT = 0.15
    BRAND_INTEGRATION_WEIGHT = 0.15
    PULSE_SCORE_WEIGHT = 0.15
    ECHO_SCORE_WEIGHT = 0.10
    DISTINCTIVENESS_WEIGHT = 0.10


class ToxicityThresholds:
    """Thresholds for toxicity analysis."""

    # === Toxicity Risk Levels ===
    # Used in toxicity_scorer.py
    LOW_MAX = 30  # 0-30 = Low risk (green)
    MEDIUM_MAX = 60  # 31-60 = Medium risk (amber)
    # 61-100 = High risk (red)

    # === Pillar Weights ===
    # Used to calculate overall toxicity from pillar scores
    PHYSIOLOGICAL_WEIGHT = 0.40  # Weight for sensory assault concerns
    PSYCHOLOGICAL_WEIGHT = 0.40  # Weight for manipulation tactics
    REGULATORY_WEIGHT = 0.20  # Weight for compliance issues

    # === AI vs Heuristic Blending ===
    # Used when blending AI toxicity with heuristic analysis
    HEURISTIC_WEIGHT = 0.40  # Weight for rule-based analysis
    AI_WEIGHT = 0.60  # Weight for AI-based analysis


class AudioThresholds:
    """Thresholds for audio analysis."""

    # === Loudness (LUFS) ===
    # Used in audio analysis and toxicity scoring
    LUFS_LOUD = -14  # Above this = potentially too loud
    LUFS_QUIET = -24  # Below this = potentially too quiet
    LUFS_TARGET = -18  # Ideal loudness for broadcast

    # === Speech Rate (Words Per Minute) ===
    SPEECH_SLOW_WPM = 100  # Below this = slow speech
    SPEECH_NORMAL_MIN = 120  # Normal speech lower bound
    SPEECH_NORMAL_MAX = 150  # Normal speech upper bound
    SPEECH_FAST_WPM = 180  # Above this = fast speech
    SPEECH_RAPID_WPM = 200  # Above this = rapid/rushed speech

    # === Silence Detection ===
    SILENCE_THRESHOLD_DB = -40  # Below this is considered silence
    MIN_SILENCE_DURATION = 0.3  # Minimum duration for silence to be notable


class FrameThresholds:
    """Thresholds for frame quality validation."""

    # === Brightness (0-255 scale) ===
    # Used in validate_frame_quality()
    MIN_BRIGHTNESS = 10  # Below this = black/blank frame
    MAX_BRIGHTNESS = 245  # Above this = overexposed/white frame

    # === Sharpness (Laplacian variance) ===
    MIN_SHARPNESS = 50  # Below this = blurry frame

    # === Duplicate Detection ===
    DUPLICATE_HASH_THRESHOLD = 5  # Max Hamming distance for "similar" frames


class EmotionThresholds:
    """Thresholds for emotion detection and timeline analysis."""

    # === Intensity ===
    LOW_INTENSITY = 0.3  # Below this = low emotional intensity
    HIGH_INTENSITY = 0.7  # Above this = high emotional intensity

    # === Emotional Range ===
    FLAT_ARC_THRESHOLD = 0.2  # Below this = flat emotional arc
    DYNAMIC_ARC_THRESHOLD = 0.5  # Above this = dynamic emotional arc

    # === Timeline Granularity ===
    READINGS_PER_SECOND = 1.0  # Target readings per second for 30s ad
    MIN_READINGS = 10  # Minimum readings for valid timeline
    SMOOTHING_WINDOW_SIZE = 3  # Window size for temporal smoothing


class ComplianceThresholds:
    """Thresholds for BCAP/Clearcast compliance checking."""

    # === Flag Severity ===
    # Risk levels for compliance flags
    RED_FLAG_THRESHOLD = 8  # Score >= this = critical issue
    AMBER_FLAG_THRESHOLD = 5  # Score >= this = warning
    # Below 5 = informational

    # === Legal Text Visibility ===
    LEGAL_TEXT_MIN_DURATION = 2.0  # Minimum seconds for legal text display
    LEGAL_TEXT_MIN_CONTRAST = 4.5  # WCAG AA contrast ratio
    LEGAL_TEXT_MIN_SIZE_PCT = 2.0  # Minimum text size as % of frame height

    # === Price Claims ===
    PRICE_CLAIM_DURATION = 3.0  # Minimum seconds for price display


class IdentificationThresholds:
    """Thresholds for ad identification confidence."""

    # === Confidence Levels ===
    HIGH_CONFIDENCE = 85  # Above this = confident identification
    MEDIUM_CONFIDENCE = 70  # Above this = moderate confidence
    LOW_CONFIDENCE = 50  # Below this = uncertain identification

    # Threshold for triggering alternative suggestions
    ALTERNATIVES_THRESHOLD = 70  # Below this, suggest alternatives


# Convenience class for importing all thresholds at once
class Thresholds:
    """Unified access to all threshold categories."""

    Analysis = AnalysisThresholds
    Toxicity = ToxicityThresholds
    Audio = AudioThresholds
    Frame = FrameThresholds
    Emotion = EmotionThresholds
    Compliance = ComplianceThresholds
    Identification = IdentificationThresholds


__all__ = [
    "AnalysisThresholds",
    "ToxicityThresholds",
    "AudioThresholds",
    "FrameThresholds",
    "EmotionThresholds",
    "ComplianceThresholds",
    "IdentificationThresholds",
    "Thresholds",
]
