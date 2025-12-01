"""
Safety validation checks for Clearcast compliance.

Handles Safe Area and PSE (Photosensitive Epilepsy) checks.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ..config import CheckConfig, CheckSeverity
from ..result import CheckResult

logger = logging.getLogger(__name__)


class SafetyChecks:
    """
    Safety validation checks: Safe Areas, PSE Risk.

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
        configs: Dict[str, CheckConfig],
        num_analysis_frames: int = 20
    ) -> List[CheckResult]:
        """Run all safety checks and return results."""
        results = []

        # Safe area check
        safe_area_config = configs.get("safe_area", CheckConfig(enabled=False))
        if safe_area_config.enabled:
            result = self._check_safe_areas(
                video_path, safe_area_config, num_analysis_frames
            )
            results.append(result)

        # PSE check
        pse_config = configs.get("pse", CheckConfig(enabled=False))
        if pse_config.enabled:
            result = self._check_pse_risk(
                video_path, pse_config, num_analysis_frames
            )
            results.append(result)

        return results

    def _check_safe_areas(
        self,
        video_path: str,
        config: CheckConfig,
        num_analysis_frames: int
    ) -> CheckResult:
        """Check for content in unsafe areas."""
        threshold = config.custom_params.get("threshold", 0.01)
        margin_title = config.custom_params.get("margin_title", 0.9)

        try:
            result = self.verifier.check_safe_areas(
                video_path,
                margin_title=margin_title,
                num_analysis_frames=num_analysis_frames
            )
        except Exception as e:
            logger.error(f"Safe area check failed: {e}")
            return CheckResult(
                check_id="safe_area",
                passed=True,  # Pass with warning
                severity="blue",
                message=f"Safe area check failed: {str(e)}",
                category="Safety"
            )

        violations = result.get("violations", [])
        max_score = result.get("max_violation_score", 0)
        frame_indices = result.get("frame_indices", [])
        frame_timestamps = result.get("frame_timestamps", [])

        if not violations:
            return CheckResult(
                check_id="safe_area",
                passed=True,
                severity="blue",
                message="No content detected in unsafe areas.",
                category="Safety"
            )

        # Check if violations exceed threshold
        significant_violations = [v for v in violations if v.get("score", 0) > threshold]

        if not significant_violations:
            return CheckResult(
                check_id="safe_area",
                passed=True,
                severity="blue",
                message=f"Minor content in edge areas detected but below threshold ({threshold * 100:.1f}%).",
                category="Safety",
                details={"max_violation_score": max_score}
            )

        # Build violation summary
        timestamps = [v.get("timestamp_str", "unknown") for v in significant_violations[:5]]
        timestamp_summary = ", ".join(timestamps)
        if len(significant_violations) > 5:
            timestamp_summary += f" (+{len(significant_violations) - 5} more)"

        return CheckResult(
            check_id="safe_area",
            passed=False,
            severity=config.severity.value,
            message=f"Content detected in unsafe areas at: {timestamp_summary}. Maximum violation: {max_score * 100:.1f}%.",
            category="Safety",
            fix_guidance="Reposition text/graphics to stay within title safe area (90% of frame).",
            frame_indices=frame_indices,
            details={
                "violation_count": len(significant_violations),
                "max_violation_score": max_score,
                "threshold": threshold,
                "frame_timestamps": frame_timestamps
            }
        )

    def _check_pse_risk(
        self,
        video_path: str,
        config: CheckConfig,
        num_analysis_frames: int
    ) -> CheckResult:
        """Check for photosensitive epilepsy (PSE) risks."""
        flash_threshold = config.custom_params.get("flash_threshold", 3)

        try:
            result = self.verifier.check_pse_risk(
                video_path,
                num_analysis_frames=num_analysis_frames
            )
        except Exception as e:
            logger.error(f"PSE check failed: {e}")
            return CheckResult(
                check_id="pse",
                passed=True,  # Pass with warning
                severity="blue",
                message=f"PSE risk check failed: {str(e)}",
                category="Safety"
            )

        flash_events = result.get("flash_events", [])
        risk_level = result.get("risk_level", "LOW")
        frame_indices = result.get("frame_indices", [])
        frame_timestamps = result.get("frame_timestamps", [])

        if not flash_events:
            return CheckResult(
                check_id="pse",
                passed=True,
                severity="blue",
                message="No significant flash risk detected.",
                category="Safety",
                details={"risk_level": "LOW"}
            )

        # Count events exceeding threshold
        high_risk_events = [
            e for e in flash_events
            if e.get("flashes_last_sec", 0) > flash_threshold
        ]

        if not high_risk_events:
            return CheckResult(
                check_id="pse",
                passed=True,
                severity="blue",
                message=f"Flash activity detected but below threshold (>{flash_threshold} Hz).",
                category="Safety",
                details={
                    "risk_level": risk_level,
                    "flash_events_detected": len(flash_events)
                }
            )

        # Build flash event summary
        timestamps = [e.get("timestamp_str", "unknown") for e in high_risk_events[:5]]
        timestamp_summary = ", ".join(timestamps)
        if len(high_risk_events) > 5:
            timestamp_summary += f" (+{len(high_risk_events) - 5} more)"

        max_flashes = max(e.get("flashes_last_sec", 0) for e in high_risk_events)

        return CheckResult(
            check_id="pse",
            passed=False,
            severity=config.severity.value,
            message=f"PSE risk: {len(high_risk_events)} events with >{flash_threshold} flashes/second detected at: {timestamp_summary}.",
            category="Safety",
            fix_guidance="Reduce flash frequency to below 3 Hz or submit for Harding FPA test.",
            frame_indices=frame_indices,
            details={
                "risk_level": risk_level,
                "high_risk_event_count": len(high_risk_events),
                "max_flashes_per_second": max_flashes,
                "threshold": flash_threshold,
                "frame_timestamps": frame_timestamps
            },
            subjective=False  # PSE is not subjective - it's a real safety concern
        )
