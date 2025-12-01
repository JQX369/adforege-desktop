"""
Audio validation checks for Clearcast compliance.

Wraps ClearcastAudioAnalyzer with configurable strictness.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ..config import CheckConfig, CheckSeverity
from ..result import CheckResult

logger = logging.getLogger(__name__)


class AudioChecks:
    """
    Audio validation checks: LUFS, True Peak, Silence.

    Wraps the existing ClearcastAudioAnalyzer with mode-based configuration.
    """

    def __init__(self):
        # Lazy import to avoid circular dependencies
        self._analyzer = None

    @property
    def analyzer(self):
        """Lazy load the ClearcastAudioAnalyzer."""
        if self._analyzer is None:
            from ...clearcast_audio import ClearcastAudioAnalyzer
            self._analyzer = ClearcastAudioAnalyzer()
        return self._analyzer

    def run_all(
        self,
        video_path: str,
        configs: Dict[str, CheckConfig],
        is_slated_master: bool = False
    ) -> List[CheckResult]:
        """Run all audio checks and return results."""
        results = []

        # Run LUFS and True Peak check
        lufs_config = configs.get("lufs", CheckConfig(enabled=False))
        true_peak_config = configs.get("true_peak", CheckConfig(enabled=False))

        if lufs_config.enabled or true_peak_config.enabled:
            audio_results = self._check_loudness(
                video_path, lufs_config, true_peak_config
            )
            results.extend(audio_results)

        # Run silence checks
        silence_head_config = configs.get("silence_head", CheckConfig(enabled=False))
        silence_tail_config = configs.get("silence_tail", CheckConfig(enabled=False))

        if silence_head_config.enabled or silence_tail_config.enabled:
            silence_results = self._check_silence(
                video_path,
                silence_head_config,
                silence_tail_config,
                is_slated_master
            )
            results.extend(silence_results)

        return results

    def _check_loudness(
        self,
        video_path: str,
        lufs_config: CheckConfig,
        true_peak_config: CheckConfig
    ) -> List[CheckResult]:
        """Check LUFS and True Peak levels."""
        results = []

        try:
            report = self.analyzer.analyze(video_path)
        except Exception as e:
            logger.error(f"Audio analysis failed: {e}")
            return [
                CheckResult(
                    check_id="lufs",
                    passed=False,
                    severity="yellow",
                    message=f"Audio analysis failed: {str(e)}",
                    category="Audio",
                    fix_guidance="Verify the video file has a valid audio stream."
                )
            ]

        # Handle no audio case
        if report.status == "no_audio":
            return [
                CheckResult(
                    check_id="lufs",
                    passed=False,
                    severity=lufs_config.severity.value if lufs_config.enabled else "blue",
                    message="No audio detected in video file.",
                    category="Audio",
                    fix_guidance="Ensure the ad includes an audio track."
                )
            ]

        if report.status == "unknown":
            return [
                CheckResult(
                    check_id="lufs",
                    passed=True,  # Pass with warning - can't verify
                    severity="blue",
                    message=report.recommendation,
                    category="Audio"
                )
            ]

        # Check LUFS
        if lufs_config.enabled and report.integrated_lufs is not None:
            target = lufs_config.custom_params.get("target", -23.0)
            tolerance = lufs_config.tolerance or 1.0
            diff = abs(report.integrated_lufs - target)

            if diff > tolerance:
                results.append(CheckResult(
                    check_id="lufs",
                    passed=False,
                    severity=lufs_config.severity.value,
                    message=f"Audio loudness {report.integrated_lufs:.1f} LUFS is outside target {target} LUFS (±{tolerance} LU tolerance).",
                    category="Audio",
                    fix_guidance=f"Normalize audio to {target} LUFS using loudnorm filter.",
                    details={
                        "integrated_lufs": report.integrated_lufs,
                        "target_lufs": target,
                        "tolerance": tolerance,
                        "difference": diff
                    }
                ))
            else:
                results.append(CheckResult(
                    check_id="lufs",
                    passed=True,
                    severity="blue",
                    message=f"Audio loudness {report.integrated_lufs:.1f} LUFS is within target range.",
                    category="Audio",
                    details={"integrated_lufs": report.integrated_lufs}
                ))

        # Check True Peak
        if true_peak_config.enabled and report.true_peak is not None:
            max_peak = true_peak_config.custom_params.get("max", -1.0)
            tolerance = true_peak_config.tolerance or 0.0

            if report.true_peak > (max_peak + tolerance):
                results.append(CheckResult(
                    check_id="true_peak",
                    passed=False,
                    severity=true_peak_config.severity.value,
                    message=f"True peak {report.true_peak:.1f} dBTP exceeds maximum {max_peak} dBTP.",
                    category="Audio",
                    fix_guidance=f"Reduce peak levels to below {max_peak} dBTP using a limiter.",
                    details={
                        "true_peak": report.true_peak,
                        "max_allowed": max_peak
                    }
                ))
            else:
                results.append(CheckResult(
                    check_id="true_peak",
                    passed=True,
                    severity="blue",
                    message=f"True peak {report.true_peak:.1f} dBTP is within limits.",
                    category="Audio",
                    details={"true_peak": report.true_peak}
                ))

        return results

    def _check_silence(
        self,
        video_path: str,
        head_config: CheckConfig,
        tail_config: CheckConfig,
        is_slated_master: bool
    ) -> List[CheckResult]:
        """Check for silence at head and tail of video."""
        results = []

        # Get parameters from config
        duration_sec = head_config.custom_params.get("duration_sec", 0.24)
        threshold_db = head_config.custom_params.get("threshold_db", -60.0)

        try:
            silence_report = self.analyzer.check_silence_head_tail(
                video_path,
                duration_sec=duration_sec,
                threshold_db=threshold_db,
                is_slated_master=is_slated_master
            )
        except Exception as e:
            logger.error(f"Silence check failed: {e}")
            return [
                CheckResult(
                    check_id="silence_head",
                    passed=True,  # Pass with warning
                    severity="blue",
                    message=f"Silence check failed: {str(e)}",
                    category="Audio"
                )
            ]

        # Head silence
        if head_config.enabled:
            if not silence_report.get("head_silence", True):
                head_duration = 10.0 if is_slated_master else duration_sec
                results.append(CheckResult(
                    check_id="silence_head",
                    passed=False,
                    severity=head_config.severity.value,
                    message=f"Head silence check failed: Audio detected in first {head_duration}s.",
                    category="Audio",
                    fix_guidance=f"Ensure first {head_duration}s of video has silence (below {threshold_db} dB).",
                    details={"head_duration_checked": head_duration}
                ))
            else:
                results.append(CheckResult(
                    check_id="silence_head",
                    passed=True,
                    severity="blue",
                    message="Head silence check passed.",
                    category="Audio"
                ))

        # Tail silence
        if tail_config.enabled:
            if not silence_report.get("tail_silence", True):
                results.append(CheckResult(
                    check_id="silence_tail",
                    passed=False,
                    severity=tail_config.severity.value,
                    message=f"Tail silence check failed: Audio detected in last {duration_sec}s.",
                    category="Audio",
                    fix_guidance=f"Ensure last {duration_sec}s of video has silence (below {threshold_db} dB).",
                    details={"tail_duration_checked": duration_sec}
                ))
            else:
                results.append(CheckResult(
                    check_id="silence_tail",
                    passed=True,
                    severity="blue",
                    message="Tail silence check passed.",
                    category="Audio"
                ))

        return results
