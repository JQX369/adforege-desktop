"""
Video format validation checks for Clearcast compliance.

Wraps TechnicalVerifier with configurable strictness.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ..config import CheckConfig, CheckSeverity
from ..result import CheckResult

logger = logging.getLogger(__name__)


class VideoChecks:
    """
    Video format validation checks: Resolution, FPS, Codec.

    Wraps the existing TechnicalVerifier with mode-based configuration.
    """

    def __init__(self):
        self._verifier = None

    @property
    def verifier(self):
        """Lazy load the TechnicalVerifier."""
        if self._verifier is None:
            from .....core.technical_qc import TechnicalVerifier
            self._verifier = TechnicalVerifier()
        return self._verifier

    def run_all(
        self,
        video_path: str,
        configs: Dict[str, CheckConfig]
    ) -> List[CheckResult]:
        """Run all video format checks and return results."""
        results = []

        # Get format metadata
        try:
            format_result = self.verifier.verify_format(video_path)
            metadata = format_result.get("metadata", {})
        except Exception as e:
            logger.error(f"Format verification failed: {e}")
            return [
                CheckResult(
                    check_id="resolution",
                    passed=False,
                    severity="yellow",
                    message=f"Format verification failed: {str(e)}",
                    category="Video Format",
                    fix_guidance="Verify the video file is valid and readable."
                )
            ]

        # Resolution check
        resolution_config = configs.get("resolution", CheckConfig(enabled=False))
        if resolution_config.enabled:
            results.append(self._check_resolution(metadata, resolution_config))

        # FPS check
        fps_config = configs.get("fps", CheckConfig(enabled=False))
        if fps_config.enabled:
            results.append(self._check_fps(metadata, fps_config))

        # Codec check
        codec_config = configs.get("codec", CheckConfig(enabled=False))
        if codec_config.enabled:
            results.append(self._check_codec(metadata, codec_config))

        return results

    def _check_resolution(
        self,
        metadata: Dict[str, Any],
        config: CheckConfig
    ) -> CheckResult:
        """Check video resolution."""
        width = metadata.get("width", 0)
        height = metadata.get("height", 0)
        expected_width = config.custom_params.get("width", 1920)
        expected_height = config.custom_params.get("height", 1080)

        if width == expected_width and height == expected_height:
            return CheckResult(
                check_id="resolution",
                passed=True,
                severity="blue",
                message=f"Resolution {width}x{height} matches broadcast standard.",
                category="Video Format",
                details={"width": width, "height": height}
            )
        else:
            return CheckResult(
                check_id="resolution",
                passed=False,
                severity=config.severity.value,
                message=f"Resolution {width}x{height} does not match required {expected_width}x{expected_height}.",
                category="Video Format",
                fix_guidance=f"Transcode video to {expected_width}x{expected_height} resolution.",
                details={
                    "width": width,
                    "height": height,
                    "expected_width": expected_width,
                    "expected_height": expected_height
                }
            )

    def _check_fps(
        self,
        metadata: Dict[str, Any],
        config: CheckConfig
    ) -> CheckResult:
        """Check video frame rate."""
        fps = metadata.get("fps", 0)
        target = config.custom_params.get("target", 25.0)
        tolerance = config.tolerance or 0.1

        diff = abs(fps - target)

        if diff <= tolerance:
            return CheckResult(
                check_id="fps",
                passed=True,
                severity="blue",
                message=f"Frame rate {fps:.2f} fps matches broadcast standard.",
                category="Video Format",
                details={"fps": fps, "target": target}
            )
        else:
            return CheckResult(
                check_id="fps",
                passed=False,
                severity=config.severity.value,
                message=f"Frame rate {fps:.2f} fps does not match required {target} fps (±{tolerance}).",
                category="Video Format",
                fix_guidance=f"Transcode video to {target} fps.",
                details={
                    "fps": fps,
                    "target": target,
                    "tolerance": tolerance,
                    "difference": diff
                }
            )

    def _check_codec(
        self,
        metadata: Dict[str, Any],
        config: CheckConfig
    ) -> CheckResult:
        """Check video codec."""
        codec = metadata.get("codec", "unknown")
        preferred = config.custom_params.get("preferred", ["prores", "h264"])
        web_allowed = config.custom_params.get("web_allowed", [])
        rejected = config.custom_params.get("rejected", [])

        # Check if codec is in rejected list (for strict mode)
        if codec in rejected:
            return CheckResult(
                check_id="codec",
                passed=False,
                severity=config.severity.value,
                message=f"Codec '{codec}' is not accepted for broadcast delivery.",
                category="Video Format",
                fix_guidance=f"Transcode to an accepted codec: {', '.join(preferred)}.",
                details={"codec": codec, "rejected": rejected}
            )

        # Check if codec is in preferred list
        if codec in preferred:
            return CheckResult(
                check_id="codec",
                passed=True,
                severity="blue",
                message=f"Codec '{codec}' is broadcast-ready.",
                category="Video Format",
                details={"codec": codec}
            )

        # Check if codec is in web-allowed list (for web mode)
        if codec in web_allowed:
            return CheckResult(
                check_id="codec",
                passed=True,
                severity="blue",
                message=f"Codec '{codec}' is acceptable for web delivery.",
                category="Video Format",
                details={"codec": codec, "web_only": True}
            )

        # Codec not in any list - warning
        return CheckResult(
            check_id="codec",
            passed=True,  # Warning only, not a fail
            severity="blue",
            message=f"Codec '{codec}' may not be accepted by all broadcasters. Preferred: {', '.join(preferred)}.",
            category="Video Format",
            fix_guidance=f"Consider transcoding to ProRes or H.264 for maximum compatibility.",
            details={"codec": codec, "preferred": preferred}
        )

    def get_metadata(self, video_path: str) -> Dict[str, Any]:
        """Get video metadata for other checks."""
        try:
            format_result = self.verifier.verify_format(video_path)
            return format_result.get("metadata", {})
        except Exception as e:
            logger.error(f"Failed to get video metadata: {e}")
            return {}
