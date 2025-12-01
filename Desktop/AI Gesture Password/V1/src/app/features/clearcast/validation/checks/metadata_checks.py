"""
Metadata validation checks for Clearcast compliance.

Wraps MetadataVerifier with configurable strictness.
"""

from __future__ import annotations

import logging
import subprocess
import json
from typing import Any, Dict, List, Optional

from ..config import CheckConfig, CheckSeverity
from ..result import CheckResult

logger = logging.getLogger(__name__)


class MetadataChecks:
    """
    Metadata validation checks: Clock Number, Duration Match.

    Wraps the existing MetadataVerifier with mode-based configuration.
    """

    def __init__(self):
        self._verifier = None

    @property
    def verifier(self):
        """Lazy load the MetadataVerifier."""
        if self._verifier is None:
            from .....core.metadata_verifier import MetadataVerifier
            self._verifier = MetadataVerifier()
        return self._verifier

    def run_all(
        self,
        video_path: str,
        configs: Dict[str, CheckConfig],
        delivery_metadata: Dict[str, Any]
    ) -> List[CheckResult]:
        """Run all metadata checks and return results."""
        results = []

        clock_number = delivery_metadata.get("clock_number")

        # Clock number syntax check
        clock_config = configs.get("clock_number", CheckConfig(enabled=False))
        if clock_config.enabled:
            result = self._check_clock_number(clock_number, clock_config)
            results.append(result)

        # Duration match check
        duration_config = configs.get("duration_match", CheckConfig(enabled=False))
        if duration_config.enabled and clock_number:
            actual_duration = self._get_video_duration(video_path)
            if actual_duration:
                result = self._check_duration_match(
                    clock_number, actual_duration, duration_config
                )
                results.append(result)

        # AS-11 metadata check (Pure mode)
        as11_config = configs.get("as11_metadata", CheckConfig(enabled=False))
        if as11_config.enabled:
            result = self._check_as11_metadata(video_path, as11_config)
            if result:
                results.append(result)

        return results

    def _check_clock_number(
        self,
        clock_number: Optional[str],
        config: CheckConfig
    ) -> CheckResult:
        """Validate clock number syntax."""
        if not clock_number:
            if config.required:
                return CheckResult(
                    check_id="clock_number",
                    passed=False,
                    severity=config.severity.value,
                    message="Clock number is required but not provided.",
                    category="Metadata",
                    fix_guidance="Provide a valid Clearcast clock number in format AAA/BBBB123/030."
                )
            else:
                return CheckResult(
                    check_id="clock_number",
                    passed=True,
                    severity="blue",
                    message="No clock number provided (optional for this mode).",
                    category="Metadata"
                )

        valid, message = self.verifier.verify_clock_syntax(clock_number)

        if valid:
            return CheckResult(
                check_id="clock_number",
                passed=True,
                severity="blue",
                message=f"Clock number '{clock_number}' format is valid.",
                category="Metadata",
                details={"clock_number": clock_number}
            )
        else:
            return CheckResult(
                check_id="clock_number",
                passed=False,
                severity=config.severity.value,
                message=message,
                category="Metadata",
                fix_guidance="Use format AAA/BBBB123/030 (3 letters / 4-7 alphanumeric / 3 digits).",
                details={"clock_number": clock_number, "validation_message": message}
            )

    def _check_duration_match(
        self,
        clock_number: str,
        actual_duration: float,
        config: CheckConfig
    ) -> CheckResult:
        """Validate video duration matches clock number."""
        tolerance = config.tolerance or 0.5
        allow_slate = config.custom_params.get("allow_slate", True)

        valid, message = self.verifier.verify_duration_match(
            clock_number,
            actual_duration,
            tolerance=tolerance,
            allow_slate=allow_slate
        )

        clock_duration = self.verifier.extract_clock_duration(clock_number)

        if valid:
            return CheckResult(
                check_id="duration_match",
                passed=True,
                severity="blue",
                message=message,
                category="Metadata",
                details={
                    "clock_number": clock_number,
                    "actual_duration": actual_duration,
                    "clock_duration": clock_duration
                }
            )
        else:
            return CheckResult(
                check_id="duration_match",
                passed=False,
                severity=config.severity.value,
                message=message,
                category="Metadata",
                fix_guidance=f"Ensure video duration matches clock number ({clock_duration}s) within {tolerance}s tolerance.",
                details={
                    "clock_number": clock_number,
                    "actual_duration": actual_duration,
                    "clock_duration": clock_duration,
                    "tolerance": tolerance
                }
            )

    def _check_as11_metadata(
        self,
        video_path: str,
        config: CheckConfig
    ) -> Optional[CheckResult]:
        """Check for AS-11 (DPP) metadata in file."""
        # AS-11 metadata is typically embedded in MXF files
        # This is a placeholder for future implementation

        import os
        _, ext = os.path.splitext(video_path)

        if ext.lower() != ".mxf":
            return None  # AS-11 only applies to MXF

        # TODO: Implement AS-11 metadata extraction and validation
        # Would need to parse MXF headers for:
        # - Programme title
        # - Episode title
        # - Synopsis
        # - Etc.

        return CheckResult(
            check_id="as11_metadata",
            passed=True,
            severity="blue",
            message="AS-11 metadata validation not yet implemented for MXF files.",
            category="Metadata",
            details={"note": "Manual verification of AS-11 metadata recommended"}
        )

    def _get_video_duration(self, video_path: str) -> Optional[float]:
        """Get video duration using ffprobe."""
        try:
            import shutil
            ffprobe = shutil.which("ffprobe")
            if not ffprobe:
                # Try common locations
                import os
                for path in [
                    r"J:\ffmpeg-2025-03-31-git-35c091f4b7-essentials_build\bin\ffprobe.exe",
                    r"C:\ffmpeg\bin\ffprobe.exe",
                    "/usr/bin/ffprobe",
                ]:
                    if os.path.exists(path):
                        ffprobe = path
                        break

            if not ffprobe:
                logger.warning("ffprobe not found, cannot get video duration")
                return None

            cmd = [
                ffprobe, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            return float(result.stdout.strip())
        except Exception as e:
            logger.error(f"Failed to get video duration: {e}")
            return None

    def is_slated_master(
        self,
        video_path: str,
        clock_number: Optional[str]
    ) -> bool:
        """Check if video is a slated master (duration > clock + 10s)."""
        if not clock_number:
            return False

        clock_duration = self.verifier.extract_clock_duration(clock_number)
        if not clock_duration:
            return False

        actual_duration = self._get_video_duration(video_path)
        if not actual_duration:
            return False

        return self.verifier.is_slated_master(actual_duration, clock_duration)
