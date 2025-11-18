# FILE: app/video_player.py
"""Video player module with audio support."""

import logging
import threading
import time
import cv2
import numpy as np
from typing import Optional, Callable

logger = logging.getLogger(__name__)

# Try to import pygame for audio
try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False
    logger.warning("Pygame not installed. Video will play without audio.")


class VideoPlayer:
    """Video player with audio support."""
    
    def __init__(self):
        """Initialize video player."""
        self.video_path = None
        self.video_cap = None
        self.is_playing = False
        self.is_paused = False
        self.current_frame = None
        self.fps = 30
        self.frame_duration = 1.0 / 30
        self.start_time = None
        self.pause_time = None
        self.total_pause_duration = 0
        
        # Audio support
        self.audio_initialized = False
        if PYGAME_AVAILABLE:
            try:
                pygame.mixer.init()
                self.audio_initialized = True
            except Exception as e:
                logger.error(f"Failed to initialize pygame mixer: {e}")
        
        # Callbacks
        self.on_frame_callback = None
        self.on_end_callback = None
        
        # Playback thread
        self.playback_thread = None
        self.stop_event = threading.Event()
    
    def load_video(self, video_path: str) -> bool:
        """Load a video file."""
        self.video_path = video_path
        
        # Open video with FFMPEG backend for better compatibility
        self.video_cap = cv2.VideoCapture(video_path, cv2.CAP_FFMPEG)
        if not self.video_cap.isOpened():
            logger.warning("Failed to open with FFMPEG, trying default backend")
            self.video_cap = cv2.VideoCapture(video_path)
        
        if not self.video_cap.isOpened():
            logger.error(f"Failed to open video: {video_path}")
            return False
        
        # Get video properties
        self.fps = self.video_cap.get(cv2.CAP_PROP_FPS) or 30
        self.frame_duration = 1.0 / self.fps
        
        # Load audio if available
        if self.audio_initialized:
            try:
                # Pygame can play video files' audio directly
                pygame.mixer.music.load(video_path)
                logger.info("Audio loaded successfully")
            except Exception as e:
                logger.warning(f"Could not load audio: {e}")
        
        return True
    
    def play(self, on_frame: Optional[Callable] = None, on_end: Optional[Callable] = None):
        """Start or resume video playback."""
        if self.is_playing and not self.is_paused:
            return
        
        self.on_frame_callback = on_frame
        self.on_end_callback = on_end
        
        if self.is_paused:
            # Resume from pause
            self.is_paused = False
            self.total_pause_duration += time.time() - self.pause_time
            
            # Resume audio
            if self.audio_initialized:
                try:
                    pygame.mixer.music.unpause()
                except:
                    pass
        else:
            # Start new playback
            self.is_playing = True
            self.is_paused = False
            self.start_time = time.time()
            self.total_pause_duration = 0
            self.stop_event.clear()
            
            # Start audio
            if self.audio_initialized:
                try:
                    pygame.mixer.music.play()
                except Exception as e:
                    logger.warning(f"Could not start audio: {e}")
            
            # Start playback thread
            self.playback_thread = threading.Thread(target=self._playback_loop)
            self.playback_thread.daemon = True
            self.playback_thread.start()
    
    def pause(self):
        """Pause video playback."""
        if self.is_playing and not self.is_paused:
            self.is_paused = True
            self.pause_time = time.time()
            
            # Pause audio
            if self.audio_initialized:
                try:
                    pygame.mixer.music.pause()
                except:
                    pass
    
    def stop(self):
        """Stop video playback."""
        self.is_playing = False
        self.is_paused = False
        self.stop_event.set()
        
        # Stop audio
        if self.audio_initialized:
            try:
                pygame.mixer.music.stop()
            except:
                pass
        
        # Wait for playback thread
        if self.playback_thread:
            self.playback_thread.join(timeout=1)
        
        # Reset video position
        if self.video_cap:
            self.video_cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    
    def get_current_frame(self) -> Optional[np.ndarray]:
        """Get the current video frame."""
        return self.current_frame
    
    def _playback_loop(self):
        """Main playback loop running in separate thread."""
        frame_count = 0
        
        while self.is_playing and not self.stop_event.is_set():
            if self.is_paused:
                time.sleep(0.1)
                continue
            
            # Calculate target time for this frame
            elapsed_time = time.time() - self.start_time - self.total_pause_duration
            target_frame = int(elapsed_time * self.fps)
            
            # Skip frames if behind
            current_pos = int(self.video_cap.get(cv2.CAP_PROP_POS_FRAMES))
            if current_pos < target_frame:
                frames_to_skip = target_frame - current_pos
                for _ in range(frames_to_skip):
                    self.video_cap.grab()
            
            # Read frame
            ret, frame = self.video_cap.read()
            if not ret:
                # Video ended
                self.is_playing = False
                if self.on_end_callback:
                    self.on_end_callback()
                break
            
            self.current_frame = frame
            
            # Call frame callback
            if self.on_frame_callback:
                self.on_frame_callback(frame)
            
            # Sleep to maintain frame rate
            frame_end_time = self.start_time + (frame_count + 1) * self.frame_duration - self.total_pause_duration
            sleep_time = frame_end_time - time.time()
            if sleep_time > 0:
                time.sleep(sleep_time)
            
            frame_count += 1
    
    def cleanup(self):
        """Clean up resources."""
        self.stop()
        
        if self.video_cap:
            self.video_cap.release()
            self.video_cap = None
        
        if self.audio_initialized:
            try:
                pygame.mixer.quit()
            except:
                pass 