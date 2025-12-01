"""
Shared Frame Analysis Module

Provides common frame extraction, encoding, and video metadata utilities
for use by both ClearcastChecker and AIVideoBreakdown.
"""

import base64
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import uuid
import hashlib

logger = logging.getLogger(__name__)


def generate_external_id(video_path: str, prefix: str = "TA") -> str:
    """
    Generate a TellyAds-style external ID for a video.
    
    Creates a deterministic ID based on the video file path hash.
    Format: TA{5-digit number} (e.g., "TA10081")
    
    Args:
        video_path: Path to the video file
        prefix: ID prefix (default "TA" for TellyAds)
        
    Returns:
        External ID string
    """
    # Create a hash of the video path for deterministic IDs
    path_hash = hashlib.md5(video_path.encode()).hexdigest()
    # Convert first 5 hex chars to a 5-digit number
    num = int(path_hash[:5], 16) % 100000
    return f"{prefix}{num:05d}"


@dataclass
class VideoMetadata:
    """Video file metadata."""
    duration: float  # seconds
    fps: float
    total_frames: int
    width: int
    height: int
    codec: str = "unknown"
    
    @property
    def aspect_ratio(self) -> str:
        """Calculate aspect ratio string (e.g., '16:9', '4:3')."""
        if self.width == 0 or self.height == 0:
            return "unknown"
        
        from math import gcd
        divisor = gcd(self.width, self.height)
        w_ratio = self.width // divisor
        h_ratio = self.height // divisor
        return f"{w_ratio}:{h_ratio}"
    
    @property
    def aspect_ratio_decimal(self) -> float:
        """Calculate aspect ratio as decimal (width/height)."""
        if self.height == 0:
            return 0.0
        return round(self.width / self.height, 3)
    
    def to_tellyads_format(self, external_id: Optional[str] = None, video_url: Optional[str] = None) -> dict:
        """
        Convert to TellyAds-compatible metadata format.
        
        Args:
            external_id: Optional external ID (e.g., "TA12345")
            video_url: Optional URL to video file
            
        Returns:
            Dict with TellyAds schema fields
        """
        return {
            "duration_seconds": self.duration,
            "width": self.width,
            "height": self.height,
            "aspect_ratio": self.aspect_ratio,
            "fps": self.fps,
            "codec": self.codec,
            "total_frames": self.total_frames,
            "external_id": external_id,
            "video_url": video_url,
        }


@dataclass
class ExtractedFrame:
    """A single extracted frame with metadata."""
    index: int  # 0-based frame index in original video
    timestamp: str  # Human-readable "MM:SS"
    timestamp_sec: float  # Seconds from start
    base64_image: str  # Base64-encoded JPEG


def get_video_metadata(video_path: str) -> Optional[VideoMetadata]:
    """
    Get metadata for a video file.
    
    Args:
        video_path: Path to video file
        
    Returns:
        VideoMetadata or None if failed
    """
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Could not open video: {video_path}")
            return None
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
        codec = "".join([chr((fourcc >> 8 * i) & 0xFF) for i in range(4)])
        
        duration = total_frames / fps if fps > 0 else 0.0
        
        cap.release()
        
        return VideoMetadata(
            duration=round(duration, 2),
            fps=fps,
            total_frames=total_frames,
            width=width,
            height=height,
            codec=codec.strip()
        )
        
    except Exception as e:
        logger.error(f"Error getting video metadata: {e}")
        return None


def encode_frame(frame: np.ndarray, max_width: int = 960, quality: int = 80) -> str:
    """
    Resize (if needed) and encode a frame to base64 JPEG.
    
    Args:
        frame: OpenCV frame (BGR)
        max_width: Maximum width to resize to
        quality: JPEG quality (1-100)
        
    Returns:
        Base64-encoded JPEG string
    """
    if frame is None:
        return ""
    
    height, width = frame.shape[:2]
    
    # Resize if too wide
    if width > max_width:
        scale = max_width / width
        new_width = int(width * scale)
        new_height = int(height * scale)
        frame = cv2.resize(frame, (new_width, new_height))
    
    # Encode to JPEG
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode('utf-8')


def format_timestamp(seconds: float) -> str:
    """
    Format seconds as MM:SS string.
    
    Args:
        seconds: Time in seconds
        
    Returns:
        Formatted string "MM:SS"
    """
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


def _compute_frame_hash(frame: np.ndarray) -> str:
    """Compute a simple perceptual hash of a frame for duplicate detection."""
    # Resize to small size for fast comparison
    small = cv2.resize(frame, (8, 8), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY) if len(small.shape) == 3 else small
    # Simple hash based on mean
    mean_val = np.mean(gray)
    bits = (gray > mean_val).flatten()
    hash_str = ''.join(['1' if b else '0' for b in bits])
    return hash_str


@dataclass
class FrameQualityResult:
    """Result of frame quality validation."""
    valid: bool
    brightness: float
    sharpness: float
    reason: str = ""


def validate_frame_quality(
    frame: np.ndarray,
    min_brightness: float = None,
    max_brightness: float = None,
    min_sharpness: float = None
) -> FrameQualityResult:
    """
    Validate that a frame is usable for AI analysis.

    Checks for:
    - Black/blank frames (low brightness)
    - Overexposed/white frames (high brightness)
    - Blurry frames (low Laplacian variance)

    Args:
        frame: OpenCV frame (BGR or grayscale)
        min_brightness: Minimum mean brightness (0-255), uses FrameThresholds.MIN_BRIGHTNESS if None
        max_brightness: Maximum mean brightness (0-255), uses FrameThresholds.MAX_BRIGHTNESS if None
        min_sharpness: Minimum Laplacian variance for blur detection, uses FrameThresholds.MIN_SHARPNESS if None

    Returns:
        FrameQualityResult with validation status and metrics
    """
    # Import thresholds with fallback defaults
    try:
        from app.core.thresholds import FrameThresholds
        if min_brightness is None:
            min_brightness = FrameThresholds.MIN_BRIGHTNESS
        if max_brightness is None:
            max_brightness = FrameThresholds.MAX_BRIGHTNESS
        if min_sharpness is None:
            min_sharpness = FrameThresholds.MIN_SHARPNESS
    except ImportError:
        # Fallback defaults if thresholds module not available
        min_brightness = min_brightness or 10.0
        max_brightness = max_brightness or 245.0
        min_sharpness = min_sharpness or 50.0
    if frame is None:
        return FrameQualityResult(valid=False, brightness=0, sharpness=0, reason="null_frame")

    # Convert to grayscale if needed
    if len(frame.shape) == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame

    # Calculate mean brightness
    mean_brightness = float(np.mean(gray))

    # Check for black/blank frame
    if mean_brightness < min_brightness:
        return FrameQualityResult(
            valid=False,
            brightness=mean_brightness,
            sharpness=0,
            reason="black_frame"
        )

    # Check for overexposed/white frame
    if mean_brightness > max_brightness:
        return FrameQualityResult(
            valid=False,
            brightness=mean_brightness,
            sharpness=0,
            reason="overexposed"
        )

    # Calculate sharpness using Laplacian variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = float(laplacian.var())

    # Check for blur
    if sharpness < min_sharpness:
        return FrameQualityResult(
            valid=False,
            brightness=mean_brightness,
            sharpness=sharpness,
            reason="blurry"
        )

    return FrameQualityResult(
        valid=True,
        brightness=mean_brightness,
        sharpness=sharpness,
        reason=""
    )


def _sequential_read_to_frame(cap: cv2.VideoCapture, target_frame: int, current_frame: int) -> Tuple[bool, Optional[np.ndarray], int]:
    """
    Read frames sequentially until reaching target frame.
    Used as fallback when seeking fails.
    
    Returns:
        Tuple of (success, frame, actual_frame_number)
    """
    while current_frame < target_frame:
        ret, _ = cap.read()
        if not ret:
            return False, None, current_frame
        current_frame += 1
    
    ret, frame = cap.read()
    if ret:
        return True, frame, current_frame + 1
    return False, None, current_frame


def extract_frames_with_timestamps(
    video_path: str,
    num_frames: int = 20,
    max_width: int = 960,
    quality: int = 80,
    validate_quality: bool = True
) -> List[ExtractedFrame]:
    """
    Extract key frames from video with timestamps.

    Frames are extracted at regular intervals to cover the entire video duration.
    Includes seek verification, fallback to sequential reading if seeking fails,
    and optional quality validation (brightness, blur detection).

    Args:
        video_path: Path to video file
        num_frames: Number of frames to extract (default 20)
        max_width: Maximum frame width for encoding
        quality: JPEG quality (1-100)
        validate_quality: If True, filter out black/overexposed/blurry frames

    Returns:
        List of ExtractedFrame objects
    """
    frames: List[ExtractedFrame] = []
    frame_hashes: List[str] = []
    seek_failures = 0
    duplicate_warnings = 0
    quality_rejections = {"black_frame": 0, "overexposed": 0, "blurry": 0}
    
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Could not open video: {video_path}")
            return frames
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        
        if total_frames <= 0 or fps <= 0:
            logger.warning("Could not determine video properties for frame extraction")
            cap.release()
            return frames
        
        # Track current position for sequential fallback
        last_read_frame = -1
        
        # Calculate frame positions to extract (evenly distributed)
        for i in range(num_frames):
            if num_frames == 1:
                frame_pos = 0
            else:
                frame_pos = int((i / (num_frames - 1)) * (total_frames - 1))
            
            frame = None
            actual_pos = frame_pos
            
            # Try to seek
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)
            
            # Verify seek position
            reported_pos = cap.get(cv2.CAP_PROP_POS_FRAMES)
            seek_delta = abs(reported_pos - frame_pos)
            
            if seek_delta > 5:
                # Seek failed significantly - log warning
                logger.warning(f"Seek to frame {frame_pos} landed at {reported_pos} (delta: {seek_delta:.0f})")
                seek_failures += 1
                
                # If seek is way off and we need to go forward, try sequential
                if reported_pos < frame_pos and (frame_pos - last_read_frame) < 100:
                    # Only use sequential if target is reasonably close
                    success, seq_frame, new_pos = _sequential_read_to_frame(cap, frame_pos, int(reported_pos))
                    if success and seq_frame is not None:
                        frame = seq_frame
                        actual_pos = new_pos - 1
                        last_read_frame = new_pos
                        logger.debug(f"Sequential fallback succeeded for frame {frame_pos}")
            
            # If sequential didn't work or wasn't attempted, try normal read
            if frame is None:
                ret, frame = cap.read()
                if ret:
                    last_read_frame = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
                else:
                    frame = None
            
            if frame is not None:
                # Quality validation (optional)
                if validate_quality:
                    quality_result = validate_frame_quality(frame)
                    if not quality_result.valid:
                        reason = quality_result.reason
                        quality_rejections[reason] = quality_rejections.get(reason, 0) + 1
                        if quality_rejections[reason] <= 3:  # Limit log spam
                            logger.debug(f"Frame at position {frame_pos} rejected: {reason} "
                                       f"(brightness={quality_result.brightness:.1f}, "
                                       f"sharpness={quality_result.sharpness:.1f})")
                        continue  # Skip this frame, try next position

                # Compute hash for duplicate detection
                frame_hash = _compute_frame_hash(frame)

                # Check for duplicates
                if frame_hashes and frame_hash == frame_hashes[-1]:
                    duplicate_warnings += 1
                    if duplicate_warnings <= 3:  # Limit log spam
                        logger.warning(f"Possible duplicate frame detected at position {frame_pos} (same hash as previous)")

                frame_hashes.append(frame_hash)

                # Get actual timestamp if available
                actual_timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                if actual_timestamp_ms > 0:
                    timestamp_sec = actual_timestamp_ms / 1000.0
                else:
                    # Fallback to calculated timestamp
                    timestamp_sec = actual_pos / fps

                timestamp_str = format_timestamp(timestamp_sec)
                base64_img = encode_frame(frame, max_width=max_width, quality=quality)

                frames.append(ExtractedFrame(
                    index=actual_pos,
                    timestamp=timestamp_str,
                    timestamp_sec=round(timestamp_sec, 2),
                    base64_image=base64_img
                ))
            else:
                logger.warning(f"Failed to read frame at position {frame_pos}")

        cap.release()

        # Summary logging
        if seek_failures > 0:
            logger.warning(f"Frame extraction had {seek_failures} seek failures (fallback used)")
        if duplicate_warnings > 0:
            logger.warning(f"Frame extraction detected {duplicate_warnings} potential duplicates")
        total_rejected = sum(quality_rejections.values())
        if total_rejected > 0:
            logger.warning(f"Frame extraction rejected {total_rejected} low-quality frames: {quality_rejections}")
        logger.info(f"Extracted {len(frames)} valid frames from video (evenly distributed)")
        
    except Exception as e:
        logger.error(f"Failed to extract frames: {e}")
    
    return frames


def extract_frames_at_fps(
    video_path: str,
    target_fps: float = 1.0,
    max_frames: int = 60,
    max_width: int = 960,
    quality: int = 80
) -> List[ExtractedFrame]:
    """
    Extract frames at a target FPS rate using SEEK-based extraction.
    
    Uses cap.set(CV2.CAP_PROP_POS_FRAMES) to jump directly to target frames
    instead of sequential reading, making it much faster for large files.
    Includes seek verification and duplicate detection.
    
    Args:
        video_path: Path to video file
        target_fps: Target frames per second to extract
        max_frames: Maximum number of frames to extract
        max_width: Maximum frame width for encoding
        quality: JPEG quality (1-100)
        
    Returns:
        List of ExtractedFrame objects
    """
    frames: List[ExtractedFrame] = []
    frame_hashes: List[str] = []
    seek_failures = 0
    duplicate_count = 0
    
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Could not open video: {video_path}")
            return frames
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if total_frames == 0 or fps == 0:
            cap.release()
            return frames
        
        # Calculate how many frames to extract based on video duration and target FPS
        video_duration = total_frames / fps
        num_frames_to_extract = min(int(video_duration * target_fps), max_frames)
        num_frames_to_extract = max(1, num_frames_to_extract)  # At least 1 frame
        
        # Calculate interval between extracted frames (in original frame indices)
        interval = total_frames / num_frames_to_extract if num_frames_to_extract > 0 else total_frames
        
        # Use SEEK-based extraction (much faster for large files)
        for i in range(num_frames_to_extract):
            frame_pos = int(i * interval)
            frame_pos = min(frame_pos, total_frames - 1)  # Clamp to valid range
            
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)
            
            # Verify seek accuracy
            actual_pos = cap.get(cv2.CAP_PROP_POS_FRAMES)
            if abs(actual_pos - frame_pos) > 5:
                seek_failures += 1
                if seek_failures <= 3:
                    logger.warning(f"Seek to {frame_pos} landed at {actual_pos:.0f}")
            
            ret, frame = cap.read()
            
            if ret:
                # Duplicate detection
                frame_hash = _compute_frame_hash(frame)
                if frame_hashes and frame_hash == frame_hashes[-1]:
                    duplicate_count += 1
                    if duplicate_count <= 3:
                        logger.warning(f"Possible duplicate frame at position {frame_pos}")
                frame_hashes.append(frame_hash)
                
                # Get actual timestamp if available
                actual_timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                if actual_timestamp_ms > 0:
                    timestamp_sec = actual_timestamp_ms / 1000.0
                else:
                    timestamp_sec = frame_pos / fps
                
                timestamp_str = format_timestamp(timestamp_sec)
                base64_img = encode_frame(frame, max_width=max_width, quality=quality)
                
                frames.append(ExtractedFrame(
                    index=frame_pos,
                    timestamp=timestamp_str,
                    timestamp_sec=round(timestamp_sec, 2),
                    base64_image=base64_img
                ))
        
        cap.release()
        
        if seek_failures > 0:
            logger.warning(f"Frame extraction had {seek_failures} seek accuracy issues")
        if duplicate_count > 0:
            logger.warning(f"Frame extraction detected {duplicate_count} potential duplicates")
        logger.info(f"Extracted {len(frames)} frames from video (seek-based, {target_fps} FPS target)")
        
    except Exception as e:
        logger.error(f"Error extracting frames: {e}")
    
    return frames


def map_timestamp_to_frame_index(
    timestamp_sec: float,
    total_frames: int,
    num_analysis_frames: int
) -> int:
    """
    Map a video timestamp to the corresponding analysis frame index.
    
    Args:
        timestamp_sec: Timestamp in seconds
        total_frames: Total frames in the video
        num_analysis_frames: Number of frames extracted for analysis
        
    Returns:
        0-based index into the analysis frames array
    """
    if total_frames <= 0 or num_analysis_frames <= 0:
        return 0
    
    # Calculate the video fraction
    duration = total_frames / 25.0  # Assume 25 FPS if not known
    video_fraction = timestamp_sec / duration if duration > 0 else 0
    
    # Map to analysis frame index
    analysis_idx = int(video_fraction * (num_analysis_frames - 1))
    return max(0, min(analysis_idx, num_analysis_frames - 1))


def frames_to_legacy_format(frames: List[ExtractedFrame]) -> List[Tuple[str, str]]:
    """
    Convert ExtractedFrame list to legacy (base64, timestamp) tuple format.
    
    For backwards compatibility with existing code.
    
    Args:
        frames: List of ExtractedFrame objects
        
    Returns:
        List of (base64_image, timestamp_string) tuples
    """
    return [(f.base64_image, f.timestamp) for f in frames]


def frames_to_dict_format(frames: List[ExtractedFrame]) -> List[dict]:
    """
    Convert ExtractedFrame list to dictionary format for API responses.
    
    Args:
        frames: List of ExtractedFrame objects
        
    Returns:
        List of dicts with index, timestamp, and image keys
    """
    return [
        {
            "index": f.index,
            "timestamp": f.timestamp,
            "image": f.base64_image
        }
        for f in frames
    ]


__all__ = [
    "VideoMetadata",
    "ExtractedFrame",
    "FrameQualityResult",
    "generate_external_id",
    "get_video_metadata",
    "encode_frame",
    "format_timestamp",
    "validate_frame_quality",
    "extract_frames_with_timestamps",
    "extract_frames_at_fps",
    "map_timestamp_to_frame_index",
    "frames_to_legacy_format",
    "frames_to_dict_format",
]


