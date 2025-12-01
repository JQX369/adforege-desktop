"""
Technical QC Module for Clearcast Compliance
Verifies video format, safe areas, and PSE risks.
"""

import logging
import subprocess
import json
import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class TechnicalVerifier:
    """
    Performs technical checks on video files against broadcast standards.
    """
    
    def __init__(self, ffmpeg_path: Optional[str] = None):
        self.ffmpeg_path = ffmpeg_path or self._find_ffmpeg()
        self.ffprobe_path = self._find_ffprobe()
        
    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable"""
        import shutil
        
        # Check PATH first
        which_path = shutil.which('ffmpeg')
        if which_path:
            return 'ffmpeg'
            
        possible_paths = [
            r'J:\ffmpeg-2025-03-31-git-35c091f4b7-essentials_build\bin\ffmpeg.exe',
            r'C:\ffmpeg\bin\ffmpeg.exe',
            r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
        ]
        for path in possible_paths:
            try:
                subprocess.run([path, '-version'], capture_output=True, timeout=5)
                return path
            except Exception:
                continue
        return None

    def _find_ffprobe(self) -> Optional[str]:
        """Find FFprobe executable"""
        import shutil
        import os
        
        # If we have ffmpeg path, check same dir
        if self.ffmpeg_path and os.path.isabs(self.ffmpeg_path):
            ffprobe_path = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe.exe")
            if os.path.exists(ffprobe_path):
                return ffprobe_path
            # Try without .exe
            ffprobe_path = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe")
            if os.path.exists(ffprobe_path):
                return ffprobe_path
                
        # Check PATH
        which_path = shutil.which('ffprobe')
        if which_path:
            return 'ffprobe'
            
        # Fallback locations
        possible_paths = [
            r'J:\ffmpeg-2025-03-31-git-35c091f4b7-essentials_build\bin\ffprobe.exe',
            r'C:\ffmpeg\bin\ffprobe.exe',
            r'C:\Program Files\ffmpeg\bin\ffprobe.exe',
            '/usr/bin/ffprobe',
            '/usr/local/bin/ffprobe',
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
        return None

    def verify_format(self, video_path: str, standard_name: str = 'UK_CLEARCAST') -> Dict:
        """
        Verify video format against specific broadcast standards.
        """
        results = {
            "passed": True,
            "issues": [],
            "metadata": {}
        }
        
        if not self.ffprobe_path:
            results["issues"].append("FFprobe not found, cannot verify format")
            results["passed"] = False
            return results

        try:
            # Probe video
            cmd = [
                self.ffprobe_path, '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height,r_frame_rate,codec_name,pix_fmt,field_order',
                '-of', 'json',
                video_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            data = json.loads(result.stdout)
            stream = data['streams'][0]
            
            # Parse FPS
            fps_parts = stream.get('r_frame_rate', '0/0').split('/')
            fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 and float(fps_parts[1]) != 0 else 0
            
            metadata = {
                "width": int(stream.get('width', 0)),
                "height": int(stream.get('height', 0)),
                "fps": fps,
                "codec": stream.get('codec_name', 'unknown'),
                "pix_fmt": stream.get('pix_fmt', 'unknown'),
                "field_order": stream.get('field_order', 'unknown')
            }
            results["metadata"] = metadata
            
            # Check against standards (UK Clearcast defaults)
            if standard_name == 'UK_CLEARCAST':
                if metadata["width"] != 1920 or metadata["height"] != 1080:
                    results["issues"].append(f"Resolution {metadata['width']}x{metadata['height']} invalid (Expected 1920x1080)")
                    results["passed"] = False
                    
                if abs(metadata["fps"] - 25.0) > 0.1:
                    results["issues"].append(f"Frame rate {metadata['fps']:.2f} invalid (Expected 25.0)")
                    results["passed"] = False
                    
                # Codec check (ProRes or H.264 for delivery)
                valid_codecs = ['prores', 'h264']
                if metadata["codec"] not in valid_codecs:
                    results["issues"].append(f"Codec {metadata['codec']} may be rejected (Expected ProRes or H.264)")
                    # Warning only, not a hard fail for checker
                    
        except Exception as e:
            results["issues"].append(f"Format verification failed: {str(e)}")
            results["passed"] = False
            
        return results

    def check_safe_areas(self, video_path: str, margin_title: float = 0.9, margin_action: float = 0.93, num_analysis_frames: int = 20) -> Dict:
        """
        Check for content violating safe areas.
        Uses a heuristic: detects high contrast/luminance in the unsafe regions.
        
        Args:
            video_path: Path to video file
            margin_title: Title safe area margin (default 90%)
            margin_action: Action safe area margin (default 93%)
            num_analysis_frames: Number of frames used in the main analysis (for index mapping)
        """
        results = {
            "passed": True,
            "violations": [],
            "max_violation_score": 0.0,
            "frame_indices": [],  # 0-based indices matching the analyzed_frames array
            "frame_timestamps": []  # Human-readable timestamps
        }
        
        try:
            cap = cv2.VideoCapture(video_path)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            # Define unsafe regions (outside title safe)
            # Title safe is usually center 90%
            x_start = int(width * (1 - margin_title) / 2)
            x_end = int(width * (1 + margin_title) / 2)
            y_start = int(height * (1 - margin_title) / 2)
            y_end = int(height * (1 + margin_title) / 2)
            
            # Sample frames (every 1 second)
            fps = cap.get(cv2.CAP_PROP_FPS) or 25
            step = int(fps)
            
            for i in range(0, total_frames, step):
                cap.set(cv2.CAP_PROP_POS_FRAMES, i)
                ret, frame = cap.read()
                if not ret:
                    break
                    
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
                # Create mask for unsafe area
                mask = np.ones_like(gray) * 255
                mask[y_start:y_end, x_start:x_end] = 0
                
                # Check for significant content in unsafe area
                # Threshold: pixels brighter than 50 (to ignore black/dark noise)
                unsafe_content = cv2.bitwise_and(gray, gray, mask=mask)
                _, thresh = cv2.threshold(unsafe_content, 50, 255, cv2.THRESH_BINARY)
                
                violation_pixels = cv2.countNonZero(thresh)
                total_unsafe_pixels = (width * height) - ((x_end - x_start) * (y_end - y_start))
                
                violation_ratio = violation_pixels / total_unsafe_pixels if total_unsafe_pixels > 0 else 0
                
                # If > 1% of unsafe area has content, flag it
                if violation_ratio > 0.01:
                    timestamp = i / fps
                    timestamp_str = f"{int(timestamp // 60):02d}:{int(timestamp % 60):02d}"
                    
                    # Map to analysis frame index (approximate)
                    if total_frames > 0 and num_analysis_frames > 0:
                        analysis_frame_idx = int((i / total_frames) * (num_analysis_frames - 1))
                        if analysis_frame_idx not in results["frame_indices"]:
                            results["frame_indices"].append(analysis_frame_idx)
                            results["frame_timestamps"].append(timestamp_str)
                    
                    results["violations"].append({
                        "timestamp": timestamp,
                        "timestamp_str": timestamp_str,
                        "frame_index": i,
                        "score": violation_ratio,
                        "message": f"Content detected in unsafe area at {timestamp:.1f}s"
                    })
                    results["max_violation_score"] = max(results["max_violation_score"], violation_ratio)
            
            if results["violations"]:
                results["passed"] = False
                
            cap.release()
            
        except Exception as e:
            logger.error(f"Safe area check failed: {e}")
            
        return results

    def check_pse_risk(self, video_path: str, num_analysis_frames: int = 20) -> Dict:
        """
        Heuristic check for Photosensitive Epilepsy (PSE) risks.
        Detects rapid luminance changes (flashes) > 3Hz.
        
        Args:
            video_path: Path to video file
            num_analysis_frames: Number of frames used in the main analysis (for index mapping)
        """
        results = {
            "passed": True,
            "risk_level": "LOW",
            "flash_events": [],
            "frame_indices": [],  # 0-based indices matching the analyzed_frames array
            "frame_timestamps": []  # Human-readable timestamps
        }
        
        try:
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS) or 25
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            prev_mean_lum = 0
            flash_count = 0
            window_start_time = 0
            flash_timestamps = []
            current_frame_idx = 0
            
            # Sliding window of 1 second
            window_frames = int(fps)
            frame_diffs = []
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                # Calculate mean luminance
                mean_lum = np.mean(frame)
                
                # Check for significant change (flash)
                # Harding threshold is complex, we use a simple heuristic:
                # > 20% change in luminance between frames is a "transition"
                if abs(mean_lum - prev_mean_lum) > 40: # 40/255 approx 15%
                    flash_timestamps.append(cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0)
                
                prev_mean_lum = mean_lum
                
                # Clean up old timestamps (> 1s ago)
                current_time = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
                flash_timestamps = [t for t in flash_timestamps if current_time - t <= 1.0]
                
                # If > 3 flashes in last second, flag risk
                if len(flash_timestamps) > 3:
                    timestamp_str = f"{int(current_time // 60):02d}:{int(current_time % 60):02d}"
                    
                    # Map to analysis frame index (approximate)
                    if total_frames > 0 and num_analysis_frames > 0:
                        analysis_frame_idx = int((current_frame_idx / total_frames) * (num_analysis_frames - 1))
                        if analysis_frame_idx not in results["frame_indices"]:
                            results["frame_indices"].append(analysis_frame_idx)
                            results["frame_timestamps"].append(timestamp_str)
                    
                    results["flash_events"].append({
                        "timestamp": current_time,
                        "timestamp_str": timestamp_str,
                        "flashes_last_sec": len(flash_timestamps)
                    })
                
                current_frame_idx += 1
            
            if results["flash_events"]:
                results["passed"] = False
                results["risk_level"] = "HIGH" if len(results["flash_events"]) > 5 else "MEDIUM"
                
            cap.release()
            
        except Exception as e:
            logger.error(f"PSE check failed: {e}")
            
        return results
