"""
Enhanced Emotional Timeline Module

Provides granular emotion tracking for video analysis with:
- 15 emotions (expanded from 9)
- 5x more granular readings (every 1-2 seconds)
- Secondary emotions and triggers
- Emotional transition tracking
- Enhanced summary metrics

Aligns with TellyAds v2.0 emotional_timeline schema.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Literal
import logging

logger = logging.getLogger(__name__)


class EmotionType(str, Enum):
    """
    15 supported emotions for analysis.
    
    Original 9:
    - joy, surprise, trust, anticipation, sadness, fear, anger, disgust, neutral
    
    New 6:
    - excitement, nostalgia, tension, relief, pride, empathy
    """
    # Original emotions
    JOY = "joy"
    SURPRISE = "surprise"
    TRUST = "trust"
    ANTICIPATION = "anticipation"
    SADNESS = "sadness"
    FEAR = "fear"
    ANGER = "anger"
    DISGUST = "disgust"
    NEUTRAL = "neutral"
    
    # New emotions for enhanced analysis
    EXCITEMENT = "excitement"      # High-energy moments
    NOSTALGIA = "nostalgia"        # Brand heritage/retro ads
    TENSION = "tension"            # Urgency/suspense
    RELIEF = "relief"              # Problem-solution resolution
    PRIDE = "pride"                # Achievement/aspiration
    EMPATHY = "empathy"            # Emotional connection


class TriggerType(str, Enum):
    """What caused the emotional response."""
    VISUAL = "visual"           # Something seen
    AUDIO = "audio"             # Sound effect or ambient
    DIALOGUE = "dialogue"       # Spoken words
    MUSIC = "music"             # Background music
    PACING = "pacing"           # Edit rhythm/speed
    REVEAL = "reveal"           # Product/brand reveal


class TransitionType(str, Enum):
    """Type of emotional shift."""
    GRADUAL = "gradual"         # Slow build
    SUDDEN = "sudden"           # Quick shift
    CONTRAST = "contrast"       # Dramatic reversal


class ArcShape(str, Enum):
    """Shape of the emotional arc."""
    PEAK_EARLY = "peak_early"           # Hook-heavy
    PEAK_MIDDLE = "peak_middle"         # Classic story arc
    PEAK_LATE = "peak_late"             # Building finale
    FLAT = "flat"                       # Consistent emotion
    ROLLER_COASTER = "roller_coaster"   # Multiple peaks


# Emotion colors for UI visualization
EMOTION_COLORS: Dict[str, str] = {
    # Original emotions
    "joy": "#FFD700",           # Gold
    "surprise": "#FF69B4",      # Hot Pink
    "trust": "#4169E1",         # Royal Blue
    "anticipation": "#FFA500",  # Orange
    "sadness": "#4682B4",       # Steel Blue
    "fear": "#8B008B",          # Dark Magenta
    "anger": "#DC143C",         # Crimson
    "disgust": "#556B2F",       # Dark Olive Green
    "neutral": "#808080",       # Gray
    # New emotions
    "excitement": "#FF4500",    # Orange Red
    "nostalgia": "#DEB887",     # Burlywood
    "tension": "#800000",       # Maroon
    "relief": "#90EE90",        # Light Green
    "pride": "#9370DB",         # Medium Purple
    "empathy": "#DB7093",       # Pale Violet Red
}

# Valence mapping (positive/negative emotion)
EMOTION_VALENCE: Dict[str, float] = {
    "joy": 0.9,
    "surprise": 0.3,       # Can be positive or negative
    "trust": 0.7,
    "anticipation": 0.4,
    "sadness": -0.7,
    "fear": -0.8,
    "anger": -0.6,
    "disgust": -0.8,
    "neutral": 0.0,
    "excitement": 0.85,
    "nostalgia": 0.4,      # Bittersweet
    "tension": -0.3,
    "relief": 0.6,
    "pride": 0.8,
    "empathy": 0.5,
}


@dataclass
class EmotionReading:
    """
    A single emotional reading at a timestamp.
    
    Enhanced with secondary emotion and trigger tracking.
    """
    t_s: float                          # Timestamp in seconds
    dominant_emotion: str               # Primary emotion (15 options)
    secondary_emotion: Optional[str]    # Layered emotion (NEW)
    intensity: float                    # Strength 0.0-1.0
    valence: float                      # Positive/negative -1.0 to 1.0
    arousal: float                      # Calm/excited 0.0-1.0
    trigger: str                        # What caused it (NEW)
    
    def to_dict(self) -> Dict:
        return {
            "t_s": self.t_s,
            "dominant_emotion": self.dominant_emotion,
            "secondary_emotion": self.secondary_emotion,
            "intensity": self.intensity,
            "valence": self.valence,
            "arousal": self.arousal,
            "trigger": self.trigger,
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "EmotionReading":
        return cls(
            t_s=data.get("t_s", 0.0),
            dominant_emotion=data.get("dominant_emotion", "neutral"),
            secondary_emotion=data.get("secondary_emotion"),
            intensity=data.get("intensity", 0.5),
            valence=data.get("valence", 0.0),
            arousal=data.get("arousal", 0.5),
            trigger=data.get("trigger", "visual"),
        )


@dataclass
class EmotionalTransition:
    """
    Tracks significant emotion shifts.
    
    Use cases:
    - Identify emotional pivot points
    - Measure transition effectiveness
    - Optimize pacing for emotional impact
    """
    from_emotion: str
    to_emotion: str
    transition_time_s: float
    transition_type: str    # gradual/sudden/contrast
    effectiveness: float    # How well the transition works 0.0-1.0
    
    def to_dict(self) -> Dict:
        return {
            "from_emotion": self.from_emotion,
            "to_emotion": self.to_emotion,
            "transition_time_s": self.transition_time_s,
            "transition_type": self.transition_type,
            "effectiveness": self.effectiveness,
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "EmotionalTransition":
        return cls(
            from_emotion=data.get("from_emotion", "neutral"),
            to_emotion=data.get("to_emotion", "neutral"),
            transition_time_s=data.get("transition_time_s", 0.0),
            transition_type=data.get("transition_type", "gradual"),
            effectiveness=data.get("effectiveness", 0.5),
        )


@dataclass
class EmotionalMetrics:
    """
    Enhanced summary metrics for the emotional timeline.
    """
    arc_shape: str                  # Shape of emotional arc
    peak_moment_s: float            # Timestamp of peak emotion
    peak_emotion: str               # Emotion at peak
    trough_moment_s: float          # Timestamp of lowest point (NEW)
    trough_emotion: str             # Emotion at trough (NEW)
    emotional_range: float          # Variation measure 0-1 (NEW)
    final_viewer_state: str         # Ending emotion (NEW)
    average_intensity: float
    positive_ratio: float           # % of positive emotions
    
    def to_dict(self) -> Dict:
        return {
            "arc_shape": self.arc_shape,
            "peak_moment_s": self.peak_moment_s,
            "peak_emotion": self.peak_emotion,
            "trough_moment_s": self.trough_moment_s,
            "trough_emotion": self.trough_emotion,
            "emotional_range": self.emotional_range,
            "final_viewer_state": self.final_viewer_state,
            "average_intensity": self.average_intensity,
            "positive_ratio": self.positive_ratio,
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "EmotionalMetrics":
        return cls(
            arc_shape=data.get("arc_shape", "flat"),
            peak_moment_s=data.get("peak_moment_s", 0.0),
            peak_emotion=data.get("peak_emotion", "neutral"),
            trough_moment_s=data.get("trough_moment_s", 0.0),
            trough_emotion=data.get("trough_emotion", "neutral"),
            emotional_range=data.get("emotional_range", 0.0),
            final_viewer_state=data.get("final_viewer_state", "neutral"),
            average_intensity=data.get("average_intensity", 0.5),
            positive_ratio=data.get("positive_ratio", 0.5),
        )


@dataclass
class EmotionalTimeline:
    """
    Complete emotional timeline for a video.
    
    Contains:
    - Granular readings every 1-2 seconds
    - Emotional transitions
    - Summary metrics
    """
    readings: List[EmotionReading] = field(default_factory=list)
    emotional_transitions: List[EmotionalTransition] = field(default_factory=list)
    metrics: Optional[EmotionalMetrics] = None
    
    def to_dict(self) -> Dict:
        return {
            "readings": [r.to_dict() for r in self.readings],
            "emotional_transitions": [t.to_dict() for t in self.emotional_transitions],
            "emotional_metrics": self.metrics.to_dict() if self.metrics else {},
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "EmotionalTimeline":
        readings = [EmotionReading.from_dict(r) for r in data.get("readings", [])]
        transitions = [EmotionalTransition.from_dict(t) for t in data.get("emotional_transitions", [])]
        metrics_data = data.get("emotional_metrics", {})
        metrics = EmotionalMetrics.from_dict(metrics_data) if metrics_data else None
        
        return cls(
            readings=readings,
            emotional_transitions=transitions,
            metrics=metrics,
        )
    
    def calculate_metrics(self) -> EmotionalMetrics:
        """Calculate summary metrics from readings."""
        if not self.readings:
            return EmotionalMetrics(
                arc_shape="flat",
                peak_moment_s=0.0,
                peak_emotion="neutral",
                trough_moment_s=0.0,
                trough_emotion="neutral",
                emotional_range=0.0,
                final_viewer_state="neutral",
                average_intensity=0.5,
                positive_ratio=0.5,
            )
        
        # Find peak and trough
        peak_reading = max(self.readings, key=lambda r: r.intensity)
        trough_reading = min(self.readings, key=lambda r: r.intensity)
        
        # Calculate average intensity
        avg_intensity = sum(r.intensity for r in self.readings) / len(self.readings)
        
        # Calculate emotional range (variance)
        intensities = [r.intensity for r in self.readings]
        intensity_range = max(intensities) - min(intensities)
        
        # Calculate positive ratio
        positive_emotions = {"joy", "trust", "excitement", "relief", "pride", "empathy"}
        positive_count = sum(1 for r in self.readings if r.dominant_emotion in positive_emotions)
        positive_ratio = positive_count / len(self.readings)
        
        # Determine arc shape
        arc_shape = self._determine_arc_shape()
        
        self.metrics = EmotionalMetrics(
            arc_shape=arc_shape,
            peak_moment_s=peak_reading.t_s,
            peak_emotion=peak_reading.dominant_emotion,
            trough_moment_s=trough_reading.t_s,
            trough_emotion=trough_reading.dominant_emotion,
            emotional_range=intensity_range,
            final_viewer_state=self.readings[-1].dominant_emotion if self.readings else "neutral",
            average_intensity=avg_intensity,
            positive_ratio=positive_ratio,
        )
        
        return self.metrics
    
    def _determine_arc_shape(self) -> str:
        """Determine the shape of the emotional arc."""
        if len(self.readings) < 3:
            return "flat"
        
        # Divide into thirds
        third = len(self.readings) // 3
        early = self.readings[:third]
        middle = self.readings[third:2*third]
        late = self.readings[2*third:]
        
        early_avg = sum(r.intensity for r in early) / len(early) if early else 0
        middle_avg = sum(r.intensity for r in middle) / len(middle) if middle else 0
        late_avg = sum(r.intensity for r in late) / len(late) if late else 0
        
        # Count significant peaks
        threshold = 0.7
        peaks = sum(1 for r in self.readings if r.intensity > threshold)
        
        if peaks >= 3:
            return "roller_coaster"
        elif early_avg > middle_avg and early_avg > late_avg:
            return "peak_early"
        elif late_avg > middle_avg and late_avg > early_avg:
            return "peak_late"
        elif middle_avg > early_avg and middle_avg > late_avg:
            return "peak_middle"
        else:
            return "flat"
    
    def detect_transitions(self, threshold: float = 0.3) -> List[EmotionalTransition]:
        """
        Detect significant emotional transitions.
        
        Args:
            threshold: Minimum intensity change to count as transition
            
        Returns:
            List of detected transitions
        """
        transitions = []
        
        for i in range(1, len(self.readings)):
            prev = self.readings[i - 1]
            curr = self.readings[i]
            
            # Check if emotion changed significantly
            emotion_changed = prev.dominant_emotion != curr.dominant_emotion
            intensity_change = abs(curr.intensity - prev.intensity)
            
            if emotion_changed or intensity_change > threshold:
                # Determine transition type
                time_diff = curr.t_s - prev.t_s
                if time_diff < 1.0:
                    transition_type = "sudden"
                elif intensity_change > 0.5:
                    transition_type = "contrast"
                else:
                    transition_type = "gradual"
                
                # Calculate effectiveness (higher for intentional-feeling transitions)
                effectiveness = min(1.0, intensity_change + 0.3) if emotion_changed else intensity_change
                
                transitions.append(EmotionalTransition(
                    from_emotion=prev.dominant_emotion,
                    to_emotion=curr.dominant_emotion,
                    transition_time_s=curr.t_s,
                    transition_type=transition_type,
                    effectiveness=round(effectiveness, 2),
                ))
        
        self.emotional_transitions = transitions
        return transitions


def get_reading_interval(duration_seconds: float) -> float:
    """
    Calculate optimal reading interval based on video duration.
    
    Target: ~20 readings for a 30-second ad (every 1.5s)
    
    Args:
        duration_seconds: Video duration
        
    Returns:
        Interval in seconds between readings
    """
    if duration_seconds <= 10:
        return 0.5  # More granular for short videos
    elif duration_seconds <= 30:
        return 1.5  # Standard for typical ads
    elif duration_seconds <= 60:
        return 2.0
    else:
        return 3.0  # Longer content


def get_num_readings(duration_seconds: float) -> int:
    """
    Calculate number of emotional readings needed.
    
    Args:
        duration_seconds: Video duration
        
    Returns:
        Number of readings to request
    """
    interval = get_reading_interval(duration_seconds)
    return max(5, min(30, int(duration_seconds / interval)))


def validate_emotion(emotion: str) -> str:
    """Validate and normalize emotion string."""
    valid_emotions = {e.value for e in EmotionType}
    emotion_lower = emotion.lower().strip()
    
    if emotion_lower in valid_emotions:
        return emotion_lower
    
    # Common aliases
    aliases = {
        "happy": "joy",
        "excited": "excitement",
        "scared": "fear",
        "sad": "sadness",
        "angry": "anger",
        "curious": "anticipation",
        "content": "trust",
        "anxious": "tension",
        "grateful": "relief",
        "proud": "pride",
        "compassion": "empathy",
        "disguted": "disgust",  # Common typo
    }
    
    return aliases.get(emotion_lower, "neutral")


def validate_trigger(trigger: str) -> str:
    """Validate and normalize trigger string."""
    valid_triggers = {t.value for t in TriggerType}
    trigger_lower = trigger.lower().strip()
    
    if trigger_lower in valid_triggers:
        return trigger_lower
    
    # Aliases
    aliases = {
        "sound": "audio",
        "sfx": "audio",
        "voice": "dialogue",
        "voiceover": "dialogue",
        "vo": "dialogue",
        "image": "visual",
        "scene": "visual",
        "beat": "music",
        "song": "music",
        "edit": "pacing",
        "cut": "pacing",
        "product": "reveal",
        "brand": "reveal",
    }
    
    return aliases.get(trigger_lower, "visual")


__all__ = [
    "EmotionType",
    "TriggerType",
    "TransitionType",
    "ArcShape",
    "EMOTION_COLORS",
    "EMOTION_VALENCE",
    "EmotionReading",
    "EmotionalTransition",
    "EmotionalMetrics",
    "EmotionalTimeline",
    "get_reading_interval",
    "get_num_readings",
    "validate_emotion",
    "validate_trigger",
]

