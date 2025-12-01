"""
Shared Validation Engine for Clearcast Compliance.

Orchestrates all validation checks with configurable modes.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from .config import (
    ValidationMode,
    CheckConfig,
    ModeConfig,
    get_preset,
    WEB_COMPLIANCE_CONFIG,
    PURE_CLEARCAST_CONFIG,
)
from .result import CheckResult, ValidationResult
from .checks import (
    AudioChecks,
    VideoChecks,
    FormatChecks,
    MetadataChecks,
    SafetyChecks,
    LegalChecks,
)

logger = logging.getLogger(__name__)


# Keywords that indicate subjective/advisory issues (for auto-downgrade)
SUBJECTIVE_KEYWORDS = [
    "variable tolerance",
    "seek advice",
    "may need",
    "might require",
    "could be interpreted",
    "potentially",
    "advisory text",
    "may clear",
    "borderline",
    "subjective",
    "consider",
    "possibly",
    "unclear",
    "ambiguous",
    "open to interpretation",
]


class SharedValidationEngine:
    """
    Shared validation engine that runs checks based on mode configuration.

    Two modes supported:
    - WEB_COMPLIANCE: Tolerant, auto-downgrade for subjective issues
    - PURE_CLEARCAST: Strict DPP AS-11 style, no auto-downgrade

    Usage:
        engine = SharedValidationEngine(mode=ValidationMode.WEB_COMPLIANCE)
        result = engine.validate(
            video_path,
            delivery_metadata={"clock_number": "ABC/PROD001/030"}
        )
    """

    def __init__(
        self,
        mode: ValidationMode = ValidationMode.WEB_COMPLIANCE,
        config_overrides: Optional[Dict[str, CheckConfig]] = None
    ):
        """
        Initialize the validation engine.

        Args:
            mode: Validation mode (WEB_COMPLIANCE or PURE_CLEARCAST)
            config_overrides: Optional check config overrides
        """
        self.mode = mode
        self.config = get_preset(mode)

        # Apply overrides
        if config_overrides:
            for check_id, override in config_overrides.items():
                if check_id in self.config.checks:
                    self.config.checks[check_id] = override

        # Initialize check modules
        self.audio_checks = AudioChecks()
        self.video_checks = VideoChecks()
        self.format_checks = FormatChecks()
        self.metadata_checks = MetadataChecks()
        self.safety_checks = SafetyChecks()
        self.legal_checks = LegalChecks()

    def validate(
        self,
        video_path: str,
        delivery_metadata: Optional[Dict[str, Any]] = None,
        legal_text_data: Optional[List[Dict[str, Any]]] = None,
        num_analysis_frames: int = 20,
    ) -> ValidationResult:
        """
        Run all enabled checks against the video.

        Args:
            video_path: Path to the video file
            delivery_metadata: Metadata including clock_number, etc.
            legal_text_data: Legal text instances from AI analysis (for legal checks)
            num_analysis_frames: Number of frames in the analysis (for frame index mapping)

        Returns:
            ValidationResult with all flags and status
        """
        result = ValidationResult(mode=self.mode.value)
        delivery_metadata = delivery_metadata or {}

        # Determine if this is a slated master
        clock_number = delivery_metadata.get("clock_number")
        is_slated_master = False
        if clock_number:
            is_slated_master = self.metadata_checks.is_slated_master(video_path, clock_number)
            result.metadata["is_slated_master"] = is_slated_master

        # Run check categories
        try:
            self._run_format_checks(video_path, result)
        except Exception as e:
            logger.error(f"Format checks failed: {e}")
            result.errors.append(f"Format checks failed: {str(e)}")

        try:
            video_metadata = self._run_video_checks(video_path, result)
        except Exception as e:
            logger.error(f"Video checks failed: {e}")
            result.errors.append(f"Video checks failed: {str(e)}")
            video_metadata = {}

        try:
            self._run_audio_checks(video_path, is_slated_master, result)
        except Exception as e:
            logger.error(f"Audio checks failed: {e}")
            result.errors.append(f"Audio checks failed: {str(e)}")

        try:
            self._run_metadata_checks(video_path, delivery_metadata, result)
        except Exception as e:
            logger.error(f"Metadata checks failed: {e}")
            result.errors.append(f"Metadata checks failed: {str(e)}")

        try:
            self._run_safety_checks(video_path, num_analysis_frames, result)
        except Exception as e:
            logger.error(f"Safety checks failed: {e}")
            result.errors.append(f"Safety checks failed: {str(e)}")

        # Legal checks require pre-extracted legal text data
        if legal_text_data:
            try:
                video_height = video_metadata.get("height", 1080)
                self._run_legal_checks(legal_text_data, video_height, result)
            except Exception as e:
                logger.error(f"Legal checks failed: {e}")
                result.errors.append(f"Legal checks failed: {str(e)}")

        # Apply auto-downgrade if allowed
        if self.config.allow_auto_downgrade:
            self._apply_subjective_downgrade(result)

        # Compute final status
        result.compute_status()

        return result

    def _run_format_checks(
        self,
        video_path: str,
        result: ValidationResult
    ) -> None:
        """Run container format checks."""
        check_results = self.format_checks.run_all(
            video_path,
            self.config.checks
        )
        for check_result in check_results:
            result.add_check_result(check_result)

    def _run_video_checks(
        self,
        video_path: str,
        result: ValidationResult
    ) -> Dict[str, Any]:
        """Run video format checks and return metadata."""
        check_results = self.video_checks.run_all(
            video_path,
            self.config.checks
        )
        for check_result in check_results:
            result.add_check_result(check_result)

        # Get metadata for other checks
        return self.video_checks.get_metadata(video_path)

    def _run_audio_checks(
        self,
        video_path: str,
        is_slated_master: bool,
        result: ValidationResult
    ) -> None:
        """Run audio checks."""
        check_results = self.audio_checks.run_all(
            video_path,
            self.config.checks,
            is_slated_master=is_slated_master
        )
        for check_result in check_results:
            result.add_check_result(check_result)

    def _run_metadata_checks(
        self,
        video_path: str,
        delivery_metadata: Dict[str, Any],
        result: ValidationResult
    ) -> None:
        """Run metadata checks."""
        check_results = self.metadata_checks.run_all(
            video_path,
            self.config.checks,
            delivery_metadata
        )
        for check_result in check_results:
            result.add_check_result(check_result)

    def _run_safety_checks(
        self,
        video_path: str,
        num_analysis_frames: int,
        result: ValidationResult
    ) -> None:
        """Run safety checks (safe areas, PSE)."""
        check_results = self.safety_checks.run_all(
            video_path,
            self.config.checks,
            num_analysis_frames=num_analysis_frames
        )
        for check_result in check_results:
            result.add_check_result(check_result)

    def _run_legal_checks(
        self,
        legal_text_data: List[Dict[str, Any]],
        video_height: int,
        result: ValidationResult
    ) -> None:
        """Run legal text checks."""
        check_results = self.legal_checks.run_all(
            legal_text_data,
            self.config.checks,
            video_height=video_height
        )
        for check_result in check_results:
            result.add_check_result(check_result)

    def _apply_subjective_downgrade(self, result: ValidationResult) -> None:
        """
        Downgrade subjective red flags to yellow.

        Only applies in WEB_COMPLIANCE mode when allow_auto_downgrade is True.
        """
        if not self.config.allow_auto_downgrade:
            return

        downgraded_flags = []
        remaining_red = []

        for flag in result.red_flags:
            issue_text = flag.get("issue", "").lower()

            # Check if issue contains subjective keywords
            is_subjective = any(
                keyword in issue_text
                for keyword in SUBJECTIVE_KEYWORDS
            )

            # Also check if flag was marked as subjective
            if flag.get("subjective", False):
                is_subjective = True

            if is_subjective:
                flag["downgraded_from"] = "RED"
                flag["severity"] = "YELLOW"
                flag["auto_downgraded"] = True
                downgraded_flags.append(flag)
            else:
                remaining_red.append(flag)

        # Update flag lists
        result.red_flags = remaining_red
        result.yellow_flags = downgraded_flags + result.yellow_flags

        if downgraded_flags:
            result.metadata["auto_downgraded_count"] = len(downgraded_flags)

    def merge_ai_results(
        self,
        result: ValidationResult,
        ai_red_flags: List[Dict[str, Any]],
        ai_yellow_flags: List[Dict[str, Any]],
        ai_blue_flags: List[Dict[str, Any]],
        apply_downgrade: bool = True
    ) -> None:
        """
        Merge AI analysis results into validation result.

        Args:
            result: The ValidationResult to merge into
            ai_red_flags: Red flags from AI analysis
            ai_yellow_flags: Yellow flags from AI analysis
            ai_blue_flags: Blue flags from AI analysis
            apply_downgrade: Whether to apply subjective downgrade to AI flags
        """
        # Merge flags
        result.merge_flags(ai_red_flags, ai_yellow_flags, ai_blue_flags)

        # Apply auto-downgrade to merged result if allowed
        if apply_downgrade and self.config.allow_auto_downgrade:
            self._apply_subjective_downgrade(result)

        # Recompute status
        result.compute_status()

    def get_mode_summary(self) -> Dict[str, Any]:
        """Get a summary of the current mode configuration."""
        enabled_checks = [
            check_id for check_id, config in self.config.checks.items()
            if config.enabled
        ]

        return {
            "mode": self.mode.value,
            "allow_auto_downgrade": self.config.allow_auto_downgrade,
            "require_clock_number": self.config.require_clock_number,
            "ai_prediction_enabled": self.config.ai_prediction_enabled,
            "accepted_formats": self.config.accepted_formats,
            "enabled_checks": enabled_checks,
            "check_count": len(enabled_checks)
        }


def create_engine(mode: str = "web", **overrides) -> SharedValidationEngine:
    """
    Factory function to create a validation engine.

    Args:
        mode: "web" for WEB_COMPLIANCE, "pure" for PURE_CLEARCAST
        **overrides: Check config overrides

    Returns:
        Configured SharedValidationEngine
    """
    validation_mode = (
        ValidationMode.PURE_CLEARCAST
        if mode == "pure"
        else ValidationMode.WEB_COMPLIANCE
    )

    config_overrides = None
    if overrides:
        config_overrides = {
            key: CheckConfig(**val) if isinstance(val, dict) else val
            for key, val in overrides.items()
        }

    return SharedValidationEngine(
        mode=validation_mode,
        config_overrides=config_overrides
    )
