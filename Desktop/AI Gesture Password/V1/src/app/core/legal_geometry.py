"""
Legal Geometry Module
Performs math-based verification of legal text size and duration.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ClearcastSupersRuleSet:
    """
    Canonical Clearcast supers thresholds. Edit these values if the official
    guidance changes in the future.
    """

    reference_frame_height: int = 1080
    min_scan_lines_hd: int = 30
    # Legacy 3% buffer (≈30 HD lines). This will be replaced with the exact
    # scan-line calculation in the upcoming height-rule task.
    min_height_percent: float = 0.028
    seconds_per_word: float = 0.2
    recognition_delay_short: float = 2.0
    recognition_delay_long: float = 3.0
    long_delay_word_threshold: int = 10


DEFAULT_CLEARCAST_SUPERS = ClearcastSupersRuleSet()


class LegalGeometryVerifier:
    """
    Verifies technical compliance of on-screen text using geometry.
    """

    def __init__(self, rules: Optional[ClearcastSupersRuleSet] = None):
        self.rules = rules or DEFAULT_CLEARCAST_SUPERS

    def verify_text_height(self, bbox: List[int], frame_height: int) -> Tuple[bool, Dict[str, float], str]:
        """
        Verify if text height meets the minimum requirement.
        
        Args:
            bbox: [ymin, xmin, ymax, xmax] normalized coordinates (0-1000) from Gemini
            frame_height: Height of the video frame in pixels
            
        Returns:
            (passed, actual_height_percent, message)
        """
        if not bbox or len(bbox) != 4:
            return False, 0.0, "Invalid bounding box"
            
        ymin, _, ymax, _ = bbox
        
        # Calculate height in normalized units (0-1000)
        height_norm = ymax - ymin
        
        # Convert to percentage (0.0 - 1.0)
        height_percent = height_norm / 1000.0
        if frame_height <= 0:
            frame_height = self.rules.reference_frame_height
        
        required_lines = self.rules.min_scan_lines_hd
        reference_height = self.rules.reference_frame_height
        hd_equivalent_lines = height_percent * reference_height
        tolerance = 1e-6
        passed = (hd_equivalent_lines + tolerance) >= required_lines
        
        # Translate the HD-line requirement into the provided frame height (pixels)
        required_pixels = (required_lines / reference_height) * frame_height
        actual_pixels = height_percent * frame_height
        
        if passed:
            msg = (
                f"Text height is {hd_equivalent_lines:.1f} HD lines "
                f"(meets ≥{required_lines} lines / ≥{required_pixels:.0f}px at {frame_height}p)"
            )
        else:
            msg = (
                f"Text height is {hd_equivalent_lines:.1f} HD lines "
                f"(needs ≥{required_lines} lines / ≥{required_pixels:.0f}px at {frame_height}p)"
            )

        metrics = {
            "height_percent": height_percent,
            "hd_lines": hd_equivalent_lines,
            "required_lines": float(required_lines),
            "actual_pixels": actual_pixels,
            "required_pixels": required_pixels,
        }
            
        return passed, metrics, msg

    def verify_duration(self, word_count: int, duration_seconds: float) -> Tuple[bool, Dict[str, float], str]:
        """
        Verify if text duration meets the reading time rule.
        
        Args:
            word_count: Number of words in the legal text
            duration_seconds: How long the text is on screen
            
        Returns:
            (passed, required_seconds, message)
        """
        threshold = max(self.rules.long_delay_word_threshold, 1)
        uses_long_delay = word_count >= threshold
        recognition_delay = (
            self.rules.recognition_delay_long
            if uses_long_delay
            else self.rules.recognition_delay_short
        )
        required_seconds = (word_count * self.rules.seconds_per_word) + recognition_delay
        
        passed = duration_seconds >= required_seconds

        long_label = f"{threshold}+ words"
        short_label = f"{max(threshold - 1, 0)} words or fewer"
        delay_note = (
            f"{long_label} trigger +{recognition_delay:.1f}s recognition delay"
            if uses_long_delay
            else f"{short_label} use +{recognition_delay:.1f}s recognition delay"
        )
        
        if passed:
            msg = (
                f"Duration {duration_seconds:.1f}s is sufficient "
                f"(Required: {required_seconds:.1f}s; {delay_note})"
            )
        else:
            msg = (
                f"Duration {duration_seconds:.1f}s is too short "
                f"(Required: {required_seconds:.1f}s; {delay_note})"
            )
        
        metrics = {
            "required": required_seconds,
            "actual": duration_seconds,
            "word_count": word_count,
            "seconds_per_word": self.rules.seconds_per_word,
            "recognition_delay": recognition_delay,
            "recognition_delay_type": "long" if uses_long_delay else "short",
            "delay_threshold": threshold,
        }
            
        return passed, metrics, msg

    def check_compliance(self, text_item: Dict) -> Dict:
        """
        Run full compliance check on a text item.
        
        Args:
            text_item: Dict containing 'text', 'bbox', 'duration_seconds'
            
        Returns:
            Dict with verification results
        """
        text = text_item.get('text', '')
        bbox = text_item.get('bbox', [])
        duration = text_item.get('duration_seconds', 0.0)
        
        word_count = len(text.split())
        
        height_pass, height_metrics, height_msg = self.verify_text_height(bbox, 1080)
        dur_pass, duration_metrics, dur_msg = self.verify_duration(word_count, duration)
        
        return {
            "text_snippet": text[:50] + "..." if len(text) > 50 else text,
            "height_check": {
                "passed": height_pass,
                **height_metrics,
                "message": height_msg
            },
            "duration_check": {
                "passed": dur_pass,
                **duration_metrics,
                "message": dur_msg
            },
            "overall_pass": height_pass and dur_pass
        }
