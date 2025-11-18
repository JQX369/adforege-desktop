"""Stubbed audio normalization analysis for Clearcast readiness."""

from __future__ import annotations

import json
import logging
import os
import subprocess
from dataclasses import dataclass
from typing import Dict, Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AudioNormalizationReport:
    status: str
    recommendation: str
    integrated_lufs: Optional[float] = None
    true_peak: Optional[float] = None
    loudness_range: Optional[float] = None
    details: Optional[str] = None


class ClearcastAudioAnalyzer:
    """Lightweight wrapper that checks whether audio meets broadcast targets."""

    TARGET_LUFS = -23.0
    TOLERANCE = 1.0
    MAX_TRUE_PEAK = -1.0

    def __init__(self, ffmpeg_path: Optional[str] = None):
        self.ffmpeg_path = ffmpeg_path or self._find_ffmpeg()

    def analyze(self, video_path: str) -> AudioNormalizationReport:
        if not os.path.exists(video_path):
            return AudioNormalizationReport(
                status="unknown",
                recommendation="Video file not found; unable to inspect audio.",
            )

        if not self.ffmpeg_path:
            return AudioNormalizationReport(
                status="unknown",
                recommendation="FFmpeg unavailable; run normalization manually.",
            )

        try:
            loudness = self._probe_loudness(video_path)
        except Exception as exc:  # pragma: no cover - defensive log path
            logger.warning(f"Audio normalization probe failed: {exc}")
            return AudioNormalizationReport(
                status="unknown",
                recommendation="Could not read audio stream; please verify manually.",
                details=str(exc),
            )

        return self._evaluate_levels(loudness)

    def _evaluate_levels(self, loudness: Dict[str, Optional[float]]) -> AudioNormalizationReport:
        lufs = loudness.get("integrated_lufs")
        true_peak = loudness.get("true_peak")
        lra = loudness.get("lra")

        if lufs is None:
            return AudioNormalizationReport(
                status="no_audio",
                recommendation="No audio detected; confirm the ad includes sound.",
            )

        diff = abs(lufs - self.TARGET_LUFS)
        peak_exceeds = true_peak is not None and true_peak > self.MAX_TRUE_PEAK

        if diff <= self.TOLERANCE and not peak_exceeds:
            return AudioNormalizationReport(
                status="ok",
                recommendation="Audio loudness is within broadcast tolerance.",
                integrated_lufs=lufs,
                true_peak=true_peak,
                loudness_range=lra,
            )

        recommendation = (
            "Normalize to -23 LUFS and ensure peaks remain below -1 dBFS."
            if peak_exceeds
            else "Normalize overall loudness to -23 ±1 LUFS."
        )
        return AudioNormalizationReport(
            status="needs_normalization",
            recommendation=recommendation,
            integrated_lufs=lufs,
            true_peak=true_peak,
            loudness_range=lra,
        )

    def _probe_loudness(self, video_path: str) -> Dict[str, Optional[float]]:
        cmd = [
            self.ffmpeg_path,
            "-i",
            video_path,
            "-af",
            "loudnorm=print_format=json",
            "-f",
            "null",
            "-",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        audio_info: Dict[str, Optional[float]] = {}

        # FFmpeg prints the JSON to stderr; scan for block
        collecting = False
        buffer = []
        for line in result.stderr.splitlines():
            if line.strip().startswith("{"):
                collecting = True
            if collecting:
                buffer.append(line)
            if collecting and line.strip().endswith("}"):
                break

        if buffer:
            try:
                loudness_data = json.loads("\n".join(buffer))
                audio_info["integrated_lufs"] = float(loudness_data.get("input_i", -99))
                audio_info["true_peak"] = float(loudness_data.get("input_tp", 0))
                audio_info["lra"] = float(loudness_data.get("input_lra", 0))
            except json.JSONDecodeError as exc:
                logger.warning(f"Failed to decode loudness data: {exc}")

        return audio_info

    def _find_ffmpeg(self) -> Optional[str]:
        for candidate in [
            "ffmpeg",
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
        ]:
            try:
                result = subprocess.run(
                    [candidate, "-version"], capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    return candidate
            except Exception:
                continue
        return None


__all__ = ["ClearcastAudioAnalyzer", "AudioNormalizationReport"]

