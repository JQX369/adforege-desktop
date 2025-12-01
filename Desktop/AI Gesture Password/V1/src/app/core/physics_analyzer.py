"""
Video/Audio Physics Analyzer

Extracts physiological metrics from video files for toxicity scoring:
- Visual: cuts per minute, motion energy, brightness variance, photosensitivity
- Audio: loudness in LUFS

Uses OpenCV for video analysis and FFmpeg for audio analysis.
"""

import asyncio
import logging
import subprocess
import json
import re
from dataclasses import dataclass, asdict
from typing import Optional, Tuple, List
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

logger = logging.getLogger(__name__)


@dataclass
class VisualPhysics:
    """Visual physics metrics extracted from video."""
    cuts_per_minute: float = 0.0
    motion_energy_score: float = 0.0  # 0-1 scale
    brightness_variance: float = 0.0  # 0-1 scale
    photosensitivity_fail: bool = False
    total_cuts: int = 0
    avg_brightness: float = 0.0
    
    def to_dict(self):
        return asdict(self)


@dataclass
class AudioPhysics:
    """Audio physics metrics extracted from video."""
    loudness_lu: float = -24.0  # LUFS, typical broadcast is -24
    loudness_range: float = 0.0
    true_peak: float = 0.0
    
    def to_dict(self):
        return asdict(self)


# Thresholds for photosensitivity (based on W3C WCAG guidelines)
PHOTOSENSITIVITY_FLASH_THRESHOLD = 3  # flashes per second
PHOTOSENSITIVITY_BRIGHTNESS_THRESHOLD = 0.1  # 10% luminance change


def _compute_histogram_diff(frame1: np.ndarray, frame2: np.ndarray) -> float:
    """
    Compute histogram difference between two frames.
    Returns a value between 0 (identical) and 1 (completely different).
    """
    # Convert to grayscale if needed
    if len(frame1.shape) == 3:
        gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
    else:
        gray1 = frame1
        
    if len(frame2.shape) == 3:
        gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)
    else:
        gray2 = frame2
    
    # Compute histograms
    hist1 = cv2.calcHist([gray1], [0], None, [256], [0, 256])
    hist2 = cv2.calcHist([gray2], [0], None, [256], [0, 256])
    
    # Normalize histograms
    cv2.normalize(hist1, hist1)
    cv2.normalize(hist2, hist2)
    
    # Compare using correlation (1 = identical, -1 = opposite)
    correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
    
    # Convert to difference (0 = identical, 1 = completely different)
    return 1.0 - max(0.0, correlation)


def _compute_frame_brightness(frame: np.ndarray) -> float:
    """Compute average brightness of a frame (0-1 scale)."""
    if len(frame.shape) == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame
    return float(np.mean(gray) / 255.0)


def _compute_optical_flow_energy(prev_frame: np.ndarray, curr_frame: np.ndarray) -> float:
    """
    Compute optical flow magnitude between two frames.
    Returns energy score between 0 (static) and 1 (extreme motion).
    """
    # Convert to grayscale
    if len(prev_frame.shape) == 3:
        prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    else:
        prev_gray = prev_frame
        
    if len(curr_frame.shape) == 3:
        curr_gray = cv2.cvtColor(curr_frame, cv2.COLOR_BGR2GRAY)
    else:
        curr_gray = curr_frame
    
    # Resize for faster processing
    scale = 0.25
    prev_small = cv2.resize(prev_gray, None, fx=scale, fy=scale)
    curr_small = cv2.resize(curr_gray, None, fx=scale, fy=scale)
    
    # Compute dense optical flow
    flow = cv2.calcOpticalFlowFarneback(
        prev_small, curr_small, None,
        pyr_scale=0.5, levels=3, winsize=15,
        iterations=3, poly_n=5, poly_sigma=1.2, flags=0
    )
    
    # Compute magnitude
    magnitude = np.sqrt(flow[..., 0]**2 + flow[..., 1]**2)
    
    # Normalize to 0-1 scale (assuming max motion of ~50 pixels)
    avg_magnitude = float(np.mean(magnitude))
    normalized = min(1.0, avg_magnitude / 50.0)
    
    return normalized


def analyze_visual_physics_sync(video_path: str, sample_rate: int = 5) -> VisualPhysics:
    """
    Synchronous visual physics analysis.
    
    Args:
        video_path: Path to video file
        sample_rate: Analyze every Nth frame (higher = faster but less accurate)
        
    Returns:
        VisualPhysics dataclass with extracted metrics
    """
    if cv2 is None:
        logger.error("OpenCV not available for visual physics analysis")
        return VisualPhysics()
    
    result = VisualPhysics()
    
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Could not open video: {video_path}")
            return result
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_seconds = total_frames / fps if fps > 0 else 0.0
        
        if duration_seconds == 0:
            logger.warning("Video has zero duration")
            cap.release()
            return result
        
        # Metrics accumulators
        cuts_detected = 0
        brightness_values: List[float] = []
        motion_energies: List[float] = []
        brightness_changes: List[float] = []
        
        # Scene change threshold (histogram difference > 0.5 = likely cut)
        CUT_THRESHOLD = 0.5
        
        prev_frame = None
        frame_count = 0
        prev_brightness = None
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Only process every Nth frame
            if frame_count % sample_rate != 0:
                continue
            
            # Compute brightness
            brightness = _compute_frame_brightness(frame)
            brightness_values.append(brightness)
            
            if prev_brightness is not None:
                brightness_change = abs(brightness - prev_brightness)
                brightness_changes.append(brightness_change)
            prev_brightness = brightness
            
            if prev_frame is not None:
                # Detect scene change (cut)
                hist_diff = _compute_histogram_diff(prev_frame, frame)
                if hist_diff > CUT_THRESHOLD:
                    cuts_detected += 1
                
                # Compute motion energy
                motion_energy = _compute_optical_flow_energy(prev_frame, frame)
                motion_energies.append(motion_energy)
            
            prev_frame = frame.copy()
        
        cap.release()
        
        # Calculate final metrics
        duration_minutes = duration_seconds / 60.0
        
        # Cuts per minute (scale by sample rate since we sampled)
        result.total_cuts = cuts_detected
        result.cuts_per_minute = (cuts_detected / duration_minutes) if duration_minutes > 0 else 0.0
        
        # Motion energy (average)
        result.motion_energy_score = float(np.mean(motion_energies)) if motion_energies else 0.0
        
        # Brightness variance (normalize to 0-1)
        if brightness_values:
            result.avg_brightness = float(np.mean(brightness_values))
            variance = float(np.var(brightness_values))
            # Normalize: typical variance is 0.01-0.1, map to 0-1
            result.brightness_variance = min(1.0, variance * 10)
        
        # Photosensitivity check
        # High brightness variance + rapid changes = potential seizure risk
        if brightness_changes:
            rapid_changes = sum(1 for c in brightness_changes if c > PHOTOSENSITIVITY_BRIGHTNESS_THRESHOLD)
            changes_per_second = (rapid_changes / duration_seconds) * sample_rate if duration_seconds > 0 else 0
            
            # Check against WCAG threshold (3 flashes per second)
            if changes_per_second >= PHOTOSENSITIVITY_FLASH_THRESHOLD:
                result.photosensitivity_fail = True
            
            # Also fail if high cuts + high brightness variance
            if result.cuts_per_minute > 80 and result.brightness_variance > 0.5:
                result.photosensitivity_fail = True
        
        logger.info(
            f"Visual physics: cuts/min={result.cuts_per_minute:.1f}, "
            f"motion={result.motion_energy_score:.2f}, "
            f"brightness_var={result.brightness_variance:.2f}, "
            f"photosensitivity_fail={result.photosensitivity_fail}"
        )
        
    except Exception as e:
        logger.error(f"Error analyzing visual physics: {e}")
    
    return result


def analyze_audio_physics_sync(video_path: str) -> AudioPhysics:
    """
    Synchronous audio physics analysis using FFmpeg.
    
    Measures loudness in LUFS (Loudness Units Full Scale).
    
    Args:
        video_path: Path to video file
        
    Returns:
        AudioPhysics dataclass with extracted metrics
    """
    result = AudioPhysics()
    
    try:
        # Use FFmpeg's loudnorm filter to analyze audio
        # This gives us integrated loudness (LUFS), loudness range (LRA), and true peak
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-af', 'loudnorm=print_format=json',
            '-f', 'null',
            '-'
        ]
        
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )
        
        # FFmpeg outputs to stderr
        output = process.stderr
        
        # Find the JSON output from loudnorm
        # It appears after "Parsed_loudnorm" line
        json_match = re.search(r'\{[^}]+\"input_i\"[^}]+\}', output, re.DOTALL)
        
        if json_match:
            loudness_data = json.loads(json_match.group())
            
            # Extract metrics
            result.loudness_lu = float(loudness_data.get('input_i', -24.0))
            result.loudness_range = float(loudness_data.get('input_lra', 0.0))
            result.true_peak = float(loudness_data.get('input_tp', 0.0))
            
            logger.info(
                f"Audio physics: loudness={result.loudness_lu:.1f} LUFS, "
                f"range={result.loudness_range:.1f} LRA, "
                f"peak={result.true_peak:.1f} dBTP"
            )
        else:
            logger.warning("Could not parse FFmpeg loudnorm output, using defaults")
            
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg audio analysis timed out")
    except FileNotFoundError:
        logger.error("FFmpeg not found in PATH - cannot analyze audio loudness")
    except Exception as e:
        logger.error(f"Error analyzing audio physics: {e}")
    
    return result


async def analyze_visual_physics(video_path: str, sample_rate: int = 5) -> VisualPhysics:
    """
    Async wrapper for visual physics analysis.
    Runs the CPU-intensive analysis in a thread pool.
    """
    return await asyncio.to_thread(analyze_visual_physics_sync, video_path, sample_rate)


async def analyze_audio_physics(video_path: str) -> AudioPhysics:
    """
    Async wrapper for audio physics analysis.
    Runs FFmpeg in a thread pool.
    """
    return await asyncio.to_thread(analyze_audio_physics_sync, video_path)


async def analyze_all_physics(video_path: str) -> Tuple[VisualPhysics, AudioPhysics]:
    """
    Analyze both visual and audio physics concurrently.
    
    Args:
        video_path: Path to video file
        
    Returns:
        Tuple of (VisualPhysics, AudioPhysics)
    """
    visual_task = analyze_visual_physics(video_path)
    audio_task = analyze_audio_physics(video_path)
    
    visual, audio = await asyncio.gather(visual_task, audio_task)
    
    return visual, audio

