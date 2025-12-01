"""
Legal text validation checks for Clearcast compliance.

Handles legal text size and duration requirements.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ..config import CheckConfig, CheckSeverity
from ..result import CheckResult

logger = logging.getLogger(__name__)


class LegalChecks:
    """
    Legal text validation checks: Text Size, Text Duration.

    Validates that legal text meets minimum visibility requirements.
    """

    # Minimum text height in HD scan-lines (Clearcast requirement)
    MIN_SCANLINES = 30
    # Minimum reading time per word (seconds)
    TIME_PER_WORD = 0.2
    # Recognition delay for text appearance
    RECOGNITION_DELAY_SHORT = 2.0  # <10 words
    RECOGNITION_DELAY_LONG = 3.0   # >=10 words
    WORD_COUNT_THRESHOLD = 10

    def run_all(
        self,
        legal_text_data: List[Dict[str, Any]],
        configs: Dict[str, CheckConfig],
        video_height: int = 1080
    ) -> List[CheckResult]:
        """
        Run all legal text checks and return results.

        Args:
            legal_text_data: List of detected legal text instances from AI analysis
            configs: Check configurations
            video_height: Video height in pixels (for scan-line calculation)
        """
        results = []

        if not legal_text_data:
            return results  # No legal text to check

        # Text size check
        size_config = configs.get("legal_text_size", CheckConfig(enabled=False))
        if size_config.enabled:
            size_results = self._check_text_sizes(legal_text_data, size_config, video_height)
            results.extend(size_results)

        # Text duration check
        duration_config = configs.get("legal_text_duration", CheckConfig(enabled=False))
        if duration_config.enabled:
            duration_results = self._check_text_durations(legal_text_data, duration_config)
            results.extend(duration_results)

        return results

    def _check_text_sizes(
        self,
        legal_text_data: List[Dict[str, Any]],
        config: CheckConfig,
        video_height: int
    ) -> List[CheckResult]:
        """Check that legal text meets minimum size requirements."""
        results = []
        min_height_pixels = (self.MIN_SCANLINES / 1080) * video_height  # Scale to video height
        min_height_percent = (self.MIN_SCANLINES / 1080) * 100

        undersized_texts = []

        for item in legal_text_data:
            text = item.get("text", "")[:50] + "..." if len(item.get("text", "")) > 50 else item.get("text", "")
            height_percent = item.get("height_percent", 0)
            height_pixels = (height_percent / 100) * video_height if height_percent else 0
            timestamp = item.get("timestamp", "unknown")

            if height_percent and height_percent < min_height_percent:
                undersized_texts.append({
                    "text": text,
                    "height_percent": height_percent,
                    "height_pixels": height_pixels,
                    "timestamp": timestamp
                })

        if not undersized_texts:
            return [CheckResult(
                check_id="legal_text_size",
                passed=True,
                severity="blue",
                message=f"All legal text meets minimum size requirement (≥{self.MIN_SCANLINES} HD scan-lines).",
                category="Legal Text"
            )]

        # Build summary of undersized texts
        summary_items = []
        for item in undersized_texts[:3]:
            summary_items.append(
                f"'{item['text']}' at {item['timestamp']} ({item['height_percent']:.1f}%)"
            )

        summary = "; ".join(summary_items)
        if len(undersized_texts) > 3:
            summary += f" (+{len(undersized_texts) - 3} more)"

        results.append(CheckResult(
            check_id="legal_text_size",
            passed=False,
            severity=config.severity.value,
            message=f"Legal text below minimum size: {summary}. Minimum: {min_height_percent:.1f}% of frame height.",
            category="Legal Text",
            fix_guidance=f"Increase text height to at least {self.MIN_SCANLINES} HD scan-lines ({min_height_percent:.1f}% of frame).",
            details={
                "undersized_count": len(undersized_texts),
                "min_scanlines": self.MIN_SCANLINES,
                "min_height_percent": min_height_percent,
                "undersized_items": undersized_texts
            }
        ))

        return results

    def _check_text_durations(
        self,
        legal_text_data: List[Dict[str, Any]],
        config: CheckConfig
    ) -> List[CheckResult]:
        """Check that legal text is displayed long enough to be read."""
        results = []
        short_duration_texts = []

        for item in legal_text_data:
            text = item.get("text", "")
            word_count = len(text.split())
            duration_sec = item.get("duration_sec", 0)
            timestamp = item.get("timestamp", "unknown")

            if not duration_sec or duration_sec == 0:
                continue  # Can't check without duration

            # Calculate minimum required duration
            recognition_delay = (
                self.RECOGNITION_DELAY_LONG
                if word_count >= self.WORD_COUNT_THRESHOLD
                else self.RECOGNITION_DELAY_SHORT
            )
            min_duration = (word_count * self.TIME_PER_WORD) + recognition_delay

            if duration_sec < min_duration:
                short_text = text[:50] + "..." if len(text) > 50 else text
                short_duration_texts.append({
                    "text": short_text,
                    "word_count": word_count,
                    "duration_sec": duration_sec,
                    "min_required": min_duration,
                    "timestamp": timestamp
                })

        if not short_duration_texts:
            return [CheckResult(
                check_id="legal_text_duration",
                passed=True,
                severity="blue",
                message="All legal text displayed for adequate reading time.",
                category="Legal Text"
            )]

        # Build summary of short-duration texts
        summary_items = []
        for item in short_duration_texts[:3]:
            summary_items.append(
                f"'{item['text']}' ({item['duration_sec']:.1f}s shown, {item['min_required']:.1f}s needed)"
            )

        summary = "; ".join(summary_items)
        if len(short_duration_texts) > 3:
            summary += f" (+{len(short_duration_texts) - 3} more)"

        results.append(CheckResult(
            check_id="legal_text_duration",
            passed=False,
            severity=config.severity.value,
            message=f"Legal text displayed too briefly: {summary}.",
            category="Legal Text",
            fix_guidance=f"Increase text display time to allow {self.TIME_PER_WORD}s per word + {self.RECOGNITION_DELAY_SHORT}-{self.RECOGNITION_DELAY_LONG}s recognition delay.",
            details={
                "short_duration_count": len(short_duration_texts),
                "time_per_word": self.TIME_PER_WORD,
                "recognition_delay_short": self.RECOGNITION_DELAY_SHORT,
                "recognition_delay_long": self.RECOGNITION_DELAY_LONG,
                "short_duration_items": short_duration_texts
            }
        ))

        return results

    def calculate_min_duration(self, word_count: int) -> float:
        """Calculate minimum display duration for text with given word count."""
        recognition_delay = (
            self.RECOGNITION_DELAY_LONG
            if word_count >= self.WORD_COUNT_THRESHOLD
            else self.RECOGNITION_DELAY_SHORT
        )
        return (word_count * self.TIME_PER_WORD) + recognition_delay
