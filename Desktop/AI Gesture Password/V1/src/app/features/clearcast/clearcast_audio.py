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
        self.ffprobe_path = self._find_ffprobe()

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

    def check_silence_head_tail(self, video_path: str, duration_sec: float = 0.24, threshold_db: float = -60.0, is_slated_master: bool = False) -> Dict:
        """
        Check for silence at the head and tail of the video.
        
        Args:
            video_path: Path to video file
            duration_sec: Duration to check (default 0.24s = 6 frames @ 25fps)
            threshold_db: Silence threshold in dB (default -60dB)
            is_slated_master: If True, enforces 10s silence at head
            
        Returns:
            Dict with pass/fail status and details
        """
        results = {
            "passed": True,
            "head_silence": True,
            "tail_silence": True,
            "details": []
        }
        
        # Adjust head duration for slated masters
        head_duration = 10.0 if is_slated_master else duration_sec
        
        if not self.ffmpeg_path or not self.ffprobe_path:
            results["passed"] = False
            results["details"].append("FFmpeg/FFprobe not available for silence check")
            return results
            
        try:
            # Get video duration first
            probe_cmd = [
                self.ffprobe_path, '-i', video_path,
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1'
            ]
            duration_res = subprocess.run(probe_cmd, capture_output=True, text=True)
            total_duration = float(duration_res.stdout.strip())
            
            # Check Head (0 to duration_sec)
            # We use silencedetect filter. If it outputs nothing, it means NO silence detected (fail).
            # Wait, silencedetect outputs when silence IS detected.
            # So we want silence to BE detected for the entire duration.
            # Actually, simpler approach: measure max volume in that segment.
            
            # Check Head
            head_cmd = [
                self.ffmpeg_path, '-i', video_path,
                '-t', str(head_duration),
                '-af', f'volumedetect',
                '-f', 'null', '-'
            ]
            head_res = subprocess.run(head_cmd, capture_output=True, text=True)
            
            # Parse max_volume
            import re
            max_vol_match = re.search(r"max_volume: ([\-\d\.]+) dB", head_res.stderr)
            if max_vol_match:
                max_vol = float(max_vol_match.group(1))
                if max_vol > threshold_db:
                    results["head_silence"] = False
                    results["passed"] = False
                    results["details"].append(f"Head not silent ({head_duration}s check): Max level {max_vol}dB > {threshold_db}dB")
            
            # Check Tail
            start_tail = total_duration - duration_sec
            tail_cmd = [
                self.ffmpeg_path, '-ss', str(start_tail),
                '-i', video_path,
                '-af', f'volumedetect',
                '-f', 'null', '-'
            ]
            tail_res = subprocess.run(tail_cmd, capture_output=True, text=True)
            
            max_vol_match = re.search(r"max_volume: ([\-\d\.]+) dB", tail_res.stderr)
            if max_vol_match:
                max_vol = float(max_vol_match.group(1))
                if max_vol > threshold_db:
                    results["tail_silence"] = False
                    results["passed"] = False
                    results["details"].append(f"Tail not silent: Max level {max_vol}dB > {threshold_db}dB")
                    
        except Exception as e:
            logger.error(f"Silence check failed: {e}")
            results["passed"] = False
            results["details"].append(f"Check failed: {str(e)}")
            
        return results

    def _find_ffprobe(self) -> Optional[str]:
        import shutil
        import os
        
        if self.ffmpeg_path and os.path.isabs(self.ffmpeg_path):
            ffprobe_path = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe.exe")
            if os.path.exists(ffprobe_path):
                return ffprobe_path
            ffprobe_path = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe")
            if os.path.exists(ffprobe_path):
                return ffprobe_path
                
        if shutil.which('ffprobe'):
            return 'ffprobe'
            
        for candidate in [
            r"J:\ffmpeg-2025-03-31-git-35c091f4b7-essentials_build\bin\ffprobe.exe",
            r"C:\ffmpeg\bin\ffprobe.exe",
            r"C:\Program Files\ffmpeg\bin\ffprobe.exe",
            "/usr/bin/ffprobe",
            "/usr/local/bin/ffprobe",
        ]:
            if os.path.exists(candidate):
                return candidate
        return None

    def _find_ffmpeg(self) -> Optional[str]:
        import shutil
        if shutil.which('ffmpeg'):
            return 'ffmpeg'
            
        for candidate in [
            r"J:\ffmpeg-2025-03-31-git-35c091f4b7-essentials_build\bin\ffmpeg.exe",
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

