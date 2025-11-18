"""Enhanced Emotion Tracker with High Sensitivity"""

import cv2
import numpy as np
import logging
import threading
import time
from typing import Optional, Callable, Dict, List, Tuple
from pathlib import Path
import mediapipe as mp
from deepface import DeepFace
import speech_recognition as sr
import queue
import pygame
import os
import base64
from io import BytesIO
import tempfile
from datetime import datetime

# Set up logger first
logger = logging.getLogger(__name__)

# Suppress OpenCV warnings globally
import sys

# Redirect stderr temporarily to suppress OpenCV warnings
class SuppressOpenCVWarnings:
    def __init__(self):
        self.null_fds = None
        self.save_fds = None
        
    def __enter__(self):
        # Only suppress on Windows where the VIDEOIO warnings occur
        if sys.platform == 'win32':
            self.null_fds = os.open(os.devnull, os.O_RDWR)
            self.save_fds = os.dup(2)  # Save stderr
            os.dup2(self.null_fds, 2)  # Redirect stderr to null
            
    def __exit__(self, _exc_type, _exc_val, _exc_tb):
        if sys.platform == 'win32' and self.save_fds is not None:
            os.dup2(self.save_fds, 2)  # Restore stderr
            os.close(self.null_fds)
            os.close(self.save_fds)

# Set OpenCV log level to suppress warnings
os.environ['OPENCV_LOG_LEVEL'] = 'ERROR'

# Import emotion optimization module
try:
    from app.emotion_optimization import ResearchBasedEmotionOptimizer, ContextAwareEmotionDetector
    OPTIMIZATION_AVAILABLE = True
except ImportError:
    logger.warning("Emotion optimization module not available - using default weights")
    OPTIMIZATION_AVAILABLE = False

# Try to import moviepy, but make it optional
try:
    from moviepy.editor import VideoFileClip
    MOVIEPY_AVAILABLE = True
except ImportError:
    logger.warning("MoviePy not available - audio emotion analysis will be disabled")
    MOVIEPY_AVAILABLE = False

# Configuration option to enable/disable Gemini API calls during video
# Set to False to disable demographic analysis (gender/age detection)
ENABLE_GEMINI_ANALYSIS = True  # <-- Now only makes ONE API call for demographics

# Try to import enhanced analyzer if available
try:
    from app.enhanced_reaction_analyzer import EnhancedReactionAnalyzer
    ENHANCED_ANALYZER_AVAILABLE = True
except ImportError:
    ENHANCED_ANALYZER_AVAILABLE = False
    logger.warning("Enhanced reaction analyzer not available")

class EnhancedEmotionTracker:
    """Enhanced emotion tracker with multiple detection methods for high sensitivity"""
    
    def __init__(self):
        """Initialize the Enhanced Emotion Tracker"""
        self.video_cap = None
        self.video_display_cap = None  # Separate capture for smooth display
        self.webcam = None
        self.webcam_initialized = False
        self.webcam_lock = threading.Lock()
        self.is_analyzing = False
        # Removed stop_analysis boolean to avoid conflict with method name
        self.analysis_thread = None
        self.video_thread = None
        self.webcam_thread = None
        
        # Queues for frame processing
        self.webcam_queue = queue.Queue(maxsize=2)
        self.video_frame_queue = queue.Queue(maxsize=10)  # Reduced buffer for lower latency
        self.stop_webcam = False
        
        # Initialize enhanced analyzer if available
        self.enhanced_analyzer = None
        if ENHANCED_ANALYZER_AVAILABLE and ENABLE_GEMINI_ANALYSIS:
            try:
                self.enhanced_analyzer = EnhancedReactionAnalyzer()
                logger.info("Enhanced reaction analyzer initialized - Gemini API calls ENABLED")
            except Exception as e:
                logger.warning(f"Failed to initialize enhanced analyzer: {e}")
        elif ENHANCED_ANALYZER_AVAILABLE and not ENABLE_GEMINI_ANALYSIS:
            logger.info("Enhanced analyzer disabled - No Gemini API calls during video playback")
        
        # Performance optimization settings
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Reduce TensorFlow logging
        
        # Frame data
        self.current_video_frame = None
        self.current_webcam_frame = None
        self.current_frame_idx = 0
        self.total_frames = 0
        self.video_fps = 30.0
        
        # Display timing
        self.display_start_time = None
        self.display_frame_count = 0
        
        # Analysis data
        self.emotion_history = []
        self.reaction_snapshots = []
        self.current_analysis_id = None
        
        # Callbacks
        self.emotion_callback = None
        self.frame_callback = None
        self.quality_callback = None
        
        # Face cascade for quality checks
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Initialize FER detector early to avoid first-run delay
        try:
            from fer import FER
            self.fer_detector = FER(mtcnn=True)
            logger.info("FER detector initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize FER detector: {e}")
            self.fer_detector = None
        
        # Initialize emotion optimizer if available
        if OPTIMIZATION_AVAILABLE:
            self.emotion_optimizer = ResearchBasedEmotionOptimizer()
            self.context_detector = ContextAwareEmotionDetector()
        else:
            self.emotion_optimizer = None
            self.context_detector = None
            
        # Webcam retry settings
        self.webcam_retry_count = 3
        self.webcam_retry_delay = 0.5
        
        # Frame skip settings for performance
        self.analyze_every_n_frames = 3  # Analyze every 3rd frame
        self.frame_skip_counter = 0
        
        # MediaPipe setup
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_drawing = mp.solutions.drawing_utils
        
        # Initialize face mesh and detection
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.5
        )
        
        # Pre-warm models flag
        self.models_warmed = False
        
        # Video and webcam capture
        self.video_path = None
        self.total_frames = 0
        self.video_fps = 60  # Default FPS changed to 60
        self.total_frames = 0
        self.current_frame_idx = 0
        
        # Threading control
        self.is_running = False
        self.is_paused = False
        self.analysis_thread = None
        self.video_thread = None  # Separate thread for video playback
        
        # Callbacks
        self.emotion_callback = None
        self.completion_callback = None
        self.quality_callback = None  # New callback for face quality
        
        # Current state
        self.current_video_frame = None
        self.current_webcam_frame = None
        self.emotion_history = []
        self.frame_emotions = []
        
        # Audio processing
        self.recognizer = sr.Recognizer()
        self.audio_queue = queue.Queue()
        
        # Analysis ID
        self.analysis_id = None
        
        # Audio playback
        self.audio_playing = False
        self.audio_start_time = None
        
        # Webcam snapshots for reactions
        self.reaction_snapshots = []
        
        # PHASE 1: Emotion Smoothing - Moving average window
        self.emotion_window_size = 5  # Average over last 5 frames
        self.emotion_buffer = []  # Buffer for smoothing
        self.min_emotion_duration = 0.5  # Emotion must persist for 0.5s
        
        # PHASE 1: Face Quality Metrics
        self.face_quality_threshold = 0.7
        self.last_quality_score = 1.0
        self.quality_history = []
        
        # Baseline Emotion Tracking (NEW)
        self.baseline_collection_duration = 5.0  # Collect baseline for first 5 seconds
        self.baseline_emotions = {}  # Store baseline emotion profile
        self.baseline_collected = False  # Flag to track if baseline is ready
        self.baseline_samples = []  # Samples during baseline period
        
        # PHASE 2: Frame Processing Optimization
        self.frame_skip_interval = 3  # Process every 3rd frame
        self.frame_skip_counter = 0
        self.video_frame_queue = queue.Queue(maxsize=10)  # Reduced buffer for lower latency
        
        # PHASE 2: Performance Metrics
        self.fps_frame_count = 0
        self.last_fps_time = time.time()
        self.actual_fps = 0
        
        # Initialize processing
        self.is_running = True
        self.is_paused = False
        self.fps_frame_count = 0
        self.last_fps_time = time.time()
        self.emotion_history = []
        self.reaction_snapshots = []
        self.video_frame_queue = queue.Queue(maxsize=10)  # Reduced buffer for lower latency
        
        # Initialize webcam
        self.webcam = None
        self.webcam_initialized = False
        self.webcam_thread = None
        self.webcam_queue = queue.Queue(maxsize=2)
        self.stop_webcam = False
        
    def start_analysis(self, video_path: str, emotion_callback: Callable, 
                      completion_callback: Callable, analysis_id: str, quality_callback: Optional[Callable] = None):
        """Start emotion analysis on video"""
        # Reset for new analysis
        self.reset()
        
        self.current_video_path = video_path
        self.current_analysis_id = analysis_id
        self.emotion_callback = emotion_callback
        self.completion_callback = completion_callback
        self.quality_callback = quality_callback
        
        # Open video capture for analysis
        self.video_cap = cv2.VideoCapture(video_path, cv2.CAP_FFMPEG)
        if not self.video_cap.isOpened():
            self.video_cap = cv2.VideoCapture(video_path)
        
        if not self.video_cap.isOpened():
            logger.error(f"Failed to open video: {video_path}")
            return False
            
        # Open separate video capture for display (independent timing)
        self.video_display_cap = cv2.VideoCapture(video_path, cv2.CAP_FFMPEG)
        if not self.video_display_cap.isOpened():
            self.video_display_cap = cv2.VideoCapture(video_path)
            
        # Optimize both captures for performance
        for cap in [self.video_cap, self.video_display_cap]:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimal buffering
        
        # Get actual video FPS from the file
        actual_fps = self.video_cap.get(cv2.CAP_PROP_FPS)
        if actual_fps <= 0 or actual_fps > 120:  # Sanity check
            actual_fps = 30.0
        self.video_fps = actual_fps
        
        self.total_frames = int(self.video_cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Initialize webcam using the new method
        if not self._initialize_webcam():
            logger.warning("Webcam initialization failed - continuing without webcam")
            # Don't fail the entire analysis if webcam fails
        
        # Initialize audio playback
        self._start_audio_playback()
        
        # Start analysis in background thread with proper timing
        self.is_running = True
        self.is_paused = False
        
        # Start smooth video display thread (completely independent)
        def video_display_thread():
            """Display video frames smoothly without any processing delays"""
            frame_time = 1.0 / self.video_fps
            self.display_start_time = time.perf_counter()
            last_frame_time = self.display_start_time
            
            while self.is_running:
                if self.is_paused:
                    time.sleep(0.01)
                    continue
                    
                current_time = time.perf_counter()
                
                # Check if it's time for next frame
                if current_time - last_frame_time >= frame_time:
                    ret, frame = self.video_display_cap.read()
                    if ret:
                        self.current_video_frame = frame
                        self.display_frame_count += 1
                        last_frame_time += frame_time  # Maintain consistent timing
                    else:
                        # Video ended
                        logger.info(f"Video display ended after {self.display_frame_count} frames")
                        break
                else:
                    # Sleep until next frame time
                    sleep_time = frame_time - (current_time - last_frame_time)
                    if sleep_time > 0:
                        time.sleep(sleep_time * 0.9)  # Sleep 90% of time to account for processing
                        
        self.display_thread = threading.Thread(target=video_display_thread)
        self.display_thread.daemon = True
        self.display_thread.start()
        
        # PHASE 2: Start video analysis thread (separate from display)
        def video_buffer_thread():
            """Pre-buffer video frames for smooth playback"""
            frame_count = 0
            frame_time = 1.0 / self.video_fps
            last_frame_time = time.perf_counter()
            
            while self.is_running:
                current_time = time.perf_counter()
                
                # Read frame based on timing, not buffer size
                if current_time - last_frame_time >= frame_time:
                    ret, frame = self.video_cap.read()
                    if ret:
                        try:
                            # Drop old frames if queue is full (prefer latest frames)
                            if self.video_frame_queue.full():
                                try:
                                    self.video_frame_queue.get_nowait()
                                except queue.Empty:
                                    pass
                                    
                            self.video_frame_queue.put(frame, timeout=0.001)
                            frame_count += 1
                            last_frame_time = current_time
                        except queue.Full:
                            pass  # Skip this frame if queue is full
                    else:
                        # Video ended
                        logger.info(f"Video ended after {frame_count} frames")
                        break
                else:
                    # Small sleep to prevent CPU spinning
                    time.sleep(0.001)
                    
        self.video_thread = threading.Thread(target=video_buffer_thread)
        self.video_thread.daemon = True
        self.video_thread.start()
        
        def start_thread():
            # Small delay to ensure everything is initialized
            time.sleep(0.5)
            self._analysis_loop()
            
        self.analysis_thread = threading.Thread(target=start_thread)
        self.analysis_thread.daemon = True
        self.analysis_thread.start()
        
        return True
        
    def pause_analysis(self):
        """Pause the analysis"""
        self.is_paused = True
        if self.audio_playing:
            pygame.mixer.music.pause()
        
    def resume_analysis(self):
        """Resume the analysis"""
        self.is_paused = False
        if self.audio_playing:
            pygame.mixer.music.unpause()
        
    def stop_analysis(self):
        """Stop the analysis"""
        self.is_running = False
        
        # Wait for threads to finish if they exist and we're not in the same thread
        current_thread = threading.current_thread()
        
        for thread_name, thread in [("analysis", self.analysis_thread), 
                                   ("video", self.video_thread),
                                   ("display", self.display_thread)]:
            if thread and thread.is_alive() and current_thread != thread:
                thread.join(timeout=2.0)
        
        self.cleanup()
        
    def reset(self):
        """Reset the tracker for a new analysis"""
        self.emotion_history = []
        self.reaction_snapshots = []
        self.frame_emotions = []
        self.current_frame_idx = 0
        self.emotion_buffer = []  # Reset emotion buffer
        self.quality_history = []  # Reset quality history
        if hasattr(self, 'transcription_segments'):
            self.transcription_segments = []
        
        # Reset frame counters
        self.display_frame_count = 0
        self.frame_skip_counter = 0
        
        # Reset baseline tracking
        self.baseline_emotions = {}
        self.baseline_collected = False
        self.baseline_samples = []
        
    def get_video_frame(self) -> Optional[np.ndarray]:
        """Get current video frame"""
        return self.current_video_frame
        
    def get_webcam_frame(self) -> Optional[np.ndarray]:
        """Get current webcam frame"""
        return self.current_webcam_frame
        
    def _check_face_quality(self, frame: np.ndarray, face_region: Optional[Dict] = None) -> Dict[str, float]:
        """Check face quality for reliable emotion detection"""
        quality_metrics = {
            'overall_score': 0.0,
            'brightness': 0.0,
            'contrast': 0.0,
            'face_size': 0.0,
            'face_angle': 0.0,
            'blur_score': 0.0,
            'occlusion': 0.0
        }
        
        try:
            # Check if frame is valid
            if frame is None or frame.size == 0:
                logger.debug("Empty frame provided to face quality check")
                return quality_metrics
                
            # Convert to grayscale for analysis
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # 1. Brightness check (0-1, where 1 is optimal)
            mean_brightness = np.mean(gray) / 255.0
            quality_metrics['brightness'] = 1.0 - abs(mean_brightness - 0.5) * 2  # Optimal at 0.5
            
            # 2. Contrast check using standard deviation
            contrast = np.std(gray) / 128.0  # Normalize to 0-1
            quality_metrics['contrast'] = min(contrast, 1.0)
            
            # 3. Blur detection using Laplacian variance
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            quality_metrics['blur_score'] = min(laplacian_var / 500.0, 1.0)  # Normalize
            
            # 4. Face size check (if face region provided)
            if face_region:
                face_area = face_region.get('w', 0) * face_region.get('h', 0)
                frame_area = frame.shape[0] * frame.shape[1]
                face_ratio = face_area / frame_area if frame_area > 0 else 0
                
                # Optimal face size is 10-40% of frame
                if face_ratio < 0.1:
                    quality_metrics['face_size'] = face_ratio * 10
                elif face_ratio > 0.4:
                    quality_metrics['face_size'] = 1.0 - (face_ratio - 0.4) * 2
                else:
                    quality_metrics['face_size'] = 1.0
            else:
                quality_metrics['face_size'] = 0.5  # Default if no face region
                
            # 5. Face angle estimation (simplified - checking if face is centered)
            if face_region:
                face_center_x = face_region.get('x', 0) + face_region.get('w', 0) / 2
                frame_center_x = frame.shape[1] / 2
                offset_ratio = abs(face_center_x - frame_center_x) / frame_center_x
                quality_metrics['face_angle'] = 1.0 - min(offset_ratio, 1.0)
            else:
                quality_metrics['face_angle'] = 0.5
                
            # Calculate overall quality score
            weights = {
                'brightness': 0.2,
                'contrast': 0.2,
                'blur_score': 0.25,
                'face_size': 0.25,
                'face_angle': 0.1
            }
            
            quality_metrics['overall_score'] = sum(
                quality_metrics[metric] * weight 
                for metric, weight in weights.items()
            )
            
            # Store quality history
            self.quality_history.append(quality_metrics['overall_score'])
            if len(self.quality_history) > 30:  # Keep last 30 frames
                self.quality_history.pop(0)
                
            self.last_quality_score = quality_metrics['overall_score']
            
            # Notify callback if quality is poor
            if self.quality_callback and quality_metrics['overall_score'] < self.face_quality_threshold:
                self.quality_callback(quality_metrics)
                
        except Exception as e:
            logger.error(f"Error in face quality check: {e}")
            
        return quality_metrics
        
    def _smooth_emotions(self, current_scores: Dict[str, float]) -> Dict[str, float]:
        """Apply emotion smoothing using moving average"""
        # Add current scores to buffer
        self.emotion_buffer.append(current_scores.copy())
        
        # Maintain buffer size
        if len(self.emotion_buffer) > self.emotion_window_size:
            self.emotion_buffer.pop(0)
            
        # If not enough frames yet, return current scores
        if len(self.emotion_buffer) < 3:
            return current_scores
            
        # Calculate weighted average (more recent frames have higher weight)
        smoothed_scores = {emotion: 0.0 for emotion in current_scores}
        total_weight = 0.0
        
        for i, frame_scores in enumerate(self.emotion_buffer):
            weight = (i + 1) / len(self.emotion_buffer)  # Linear weight increase
            total_weight += weight
            
            for emotion, score in frame_scores.items():
                smoothed_scores[emotion] += score * weight
                
        # Normalize by total weight
        for emotion in smoothed_scores:
            smoothed_scores[emotion] /= total_weight
            
        # Apply minimum duration filter
        if len(self.emotion_history) >= int(self.min_emotion_duration * self.video_fps):
            # Check if emotion has been consistent
            recent_dominant = [h['emotion'] for h in self.emotion_history[-int(self.min_emotion_duration * self.video_fps):]]
            current_dominant = max(smoothed_scores, key=smoothed_scores.get)
            
            # If emotion hasn't been consistent, blend with previous
            if recent_dominant.count(current_dominant) < len(recent_dominant) * 0.7:
                # Blend with previous dominant emotion
                prev_dominant = recent_dominant[-1] if recent_dominant else 'neutral'
                if prev_dominant in smoothed_scores:
                    smoothed_scores[prev_dominant] *= 1.5  # Boost previous emotion
                    
                    # Re-normalize
                    total = sum(smoothed_scores.values())
                    for emotion in smoothed_scores:
                        smoothed_scores[emotion] /= total
                        
        return smoothed_scores
    
    def _collect_baseline_sample(self, emotion_scores: Dict[str, float]):
        """Collect emotion samples during baseline period"""
        self.baseline_samples.append(emotion_scores.copy())
        
        # Check if we've collected enough samples (at least 30 frames)
        if len(self.baseline_samples) >= 30:
            # Calculate baseline as average of all samples
            self.baseline_emotions = {emotion: 0.0 for emotion in emotion_scores}
            
            for sample in self.baseline_samples:
                for emotion, score in sample.items():
                    self.baseline_emotions[emotion] += score
            
            # Average the scores
            num_samples = len(self.baseline_samples)
            for emotion in self.baseline_emotions:
                self.baseline_emotions[emotion] /= num_samples
            
            self.baseline_collected = True
            logger.info(f"Baseline collected from {num_samples} samples: {self.baseline_emotions}")
    
    def _apply_baseline_adjustment(self, emotion_scores: Dict[str, float]) -> Dict[str, float]:
        """Adjust emotion scores based on baseline"""
        adjusted_scores = emotion_scores.copy()
        
        # Calculate the difference from baseline
        for emotion in adjusted_scores:
            baseline_value = self.baseline_emotions.get(emotion, 0.5)
            
            # Calculate relative change from baseline
            # If baseline is high for an emotion, we need a higher threshold to detect it
            # If baseline is low, we're more sensitive to that emotion
            
            # Apply adjustment: emphasize changes from baseline
            difference = adjusted_scores[emotion] - baseline_value
            
            if difference > 0:
                # Emotion is stronger than baseline
                # Amplify positive changes, especially for emotions that are rare in baseline
                if baseline_value < 0.2:  # Rare emotion in baseline
                    adjusted_scores[emotion] = baseline_value + (difference * 1.5)
                else:
                    adjusted_scores[emotion] = baseline_value + (difference * 1.2)
            else:
                # Emotion is weaker than baseline
                # Reduce score more aggressively if it's below baseline
                adjusted_scores[emotion] = baseline_value + (difference * 0.8)
            
            # Ensure scores stay in valid range
            adjusted_scores[emotion] = max(0.0, min(1.0, adjusted_scores[emotion]))
        
        # Re-normalize to sum to 1
        total = sum(adjusted_scores.values())
        if total > 0:
            for emotion in adjusted_scores:
                adjusted_scores[emotion] /= total
        
        return adjusted_scores
        
    def _analysis_loop(self):
        """Main analysis loop focused on webcam emotion detection"""
        if self.video_fps <= 0:
            self.video_fps = 30  # Fallback to 30 FPS
            
        # Time-based processing - analyze at fixed intervals
        analysis_interval = 0.1  # Analyze 10 times per second (every 100ms)
        
        # Use high-precision timing
        analysis_start_time = time.perf_counter()
        last_analysis_time = analysis_start_time - analysis_interval  # Force immediate first analysis
        
        analyzed_frame_count = 0
        
        while self.is_running:
            if self.is_paused:
                time.sleep(0.01)
                continue
                
            current_time = time.perf_counter()
            elapsed_time = current_time - analysis_start_time
            
            # Check if video has ended (use display thread status)
            if self.display_thread and not self.display_thread.is_alive():
                logger.info(f"Video analysis complete. Analyzed: {analyzed_frame_count} frames")
                self._complete_analysis()
                return
                
            # Only analyze at fixed time intervals
            if current_time - last_analysis_time >= analysis_interval:
                # Read webcam frame and analyze
                if self.webcam_cap and self.webcam_cap.isOpened():
                    ret_webcam, webcam_frame = self.webcam_cap.read()
                    if ret_webcam:
                        self.current_webcam_frame = webcam_frame
                        
                        # Analyze webcam emotions
                        emotion_data = self._analyze_frame(webcam_frame, analyzed_frame_count)
                        if emotion_data:
                            # Calculate video progress based on elapsed time
                            video_progress = elapsed_time / (self.total_frames / self.video_fps) if self.total_frames > 0 else 0
                            
                            emotion_data['timestamp'] = elapsed_time
                            emotion_data['frame_number'] = int(elapsed_time * self.video_fps)
                            emotion_data['video_progress'] = min(video_progress, 1.0)
                            
                            # Add baseline status
                            emotion_data['baseline_collected'] = self.baseline_collected
                            emotion_data['collecting_baseline'] = not self.baseline_collected and elapsed_time < self.baseline_collection_duration
                            
                            self.emotion_history.append(emotion_data)
                            analyzed_frame_count += 1
                            
                            # Capture webcam snapshot at key moments
                            if self._should_capture_snapshot(emotion_data):
                                snapshot = {
                                    'frame': webcam_frame.copy(),
                                    'emotion': emotion_data['emotion'],
                                    'timestamp': elapsed_time,
                                    'engagement': emotion_data['engagement']
                                }
                                
                                # Analyze with enhanced analyzer if available - do it asynchronously
                                if ENABLE_GEMINI_ANALYSIS and self.enhanced_analyzer and webcam_frame is not None:
                                    # Create a copy of the frame for async processing
                                    frame_copy = webcam_frame.copy()
                                    snapshot_index = len(self.reaction_snapshots)
                                    
                                    # Run enhanced analysis in background thread
                                    def analyze_async(frame, idx):
                                        try:
                                            # Convert frame to base64
                                            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                                            img_base64 = base64.b64encode(buffer).decode('utf-8')
                                            
                                            # Get enhanced analysis
                                            enhanced_analysis = self.enhanced_analyzer.analyze_reaction_frame(img_base64)
                                            
                                            # Update snapshot with analysis results
                                            if idx < len(self.reaction_snapshots):
                                                self.reaction_snapshots[idx]['enhanced_analysis'] = enhanced_analysis
                                                
                                                # Log demographics if available
                                                if 'demographics' in enhanced_analysis:
                                                    demo = enhanced_analysis['demographics']
                                                    logger.info(f"Snapshot analysis - Gender: {demo.get('gender')}, Age: {demo.get('age_estimate')}")
                                                
                                                # If we have an analysis ID and this is during a reaction, update storage
                                                if self.current_analysis_id and hasattr(self, '_reaction_id'):
                                                    self._update_snapshot_in_storage(idx, enhanced_analysis)
                                        except Exception as e:
                                            logger.error(f"Enhanced snapshot analysis failed: {e}")
                                    
                                    # Start async analysis
                                    analysis_thread = threading.Thread(
                                        target=analyze_async,
                                        args=(frame_copy, snapshot_index),
                                        daemon=True
                                    )
                                    analysis_thread.start()
                                
                                self.reaction_snapshots.append(snapshot)
                            
                            # Callback with emotion data
                            if self.emotion_callback:
                                try:
                                    self.emotion_callback(emotion_data)
                                except Exception as e:
                                    # Only log non-TclError exceptions (widget destroyed errors are expected)
                                    if "invalid command name" not in str(e) and "TclError" not in str(type(e)):
                                        logger.error(f"Emotion callback error: {e}")
                                    
                last_analysis_time = current_time
                                
            # Small sleep to prevent CPU spinning
            time.sleep(0.001)
        
    def _analyze_frame(self, frame: np.ndarray, frame_number: int) -> Optional[Dict]:
        """Analyze a single frame for emotions using multiple methods"""
        emotion_scores = {
            'happy': 0.0, 'sad': 0.0, 'angry': 0.0, 'surprise': 0.0,
            'fear': 0.0, 'disgust': 0.0, 'neutral': 0.0, 'bored': 0.0,
            'stressed': 0.0, 'confused': 0.0
        }
        confidence = 0.0
        methods_used = 0
        face_region = None
        
        # PHASE 2: Frame skip optimization
        self.frame_skip_counter += 1
        if self.frame_skip_counter % self.frame_skip_interval != 0:
            # Return last known emotion for skipped frames
            if self.emotion_history:
                return self.emotion_history[-1]
            else:
                return None
        
        try:
            # PHASE 1: Check face quality first
            quality_metrics = self._check_face_quality(frame)
            
            # Skip analysis if quality is too poor
            if quality_metrics['overall_score'] < 0.3:
                logger.warning(f"Face quality too low: {quality_metrics['overall_score']:.2f}")
                # Return neutral with low confidence
                return {
                    'emotion': 'neutral',
                    'scores': {'neutral': 0.8, 'bored': 0.2},
                    'confidence': 0.1,
                    'engagement': 0.1,
                    'methods_used': 0,
                    'quality': quality_metrics['overall_score']
                }
            
            # Method 1: DeepFace emotion detection
            deepface_success = False
            try:
                results = DeepFace.analyze(
                    frame, 
                    actions=['emotion'], 
                    enforce_detection=False,
                    detector_backend='opencv'  # Faster than default retinaface
                )
                if results:
                    if isinstance(results, list):
                        results = results[0]
                    
                    deepface_emotions = results.get('emotion', {})
                    for emotion, score in deepface_emotions.items():
                        if emotion in emotion_scores:
                            emotion_scores[emotion] += score / 100.0
                    methods_used += 1
                    deepface_success = True
                    
                    # Get face region for quality check
                    if 'region' in results:
                        face_region = results['region']
                    
                    # Get confidence from face detection
                    if 'face_confidence' in results:
                        confidence += results['face_confidence']
                    elif 'region' in results:
                        confidence += 0.7  # Default confidence if face detected
                    else:
                        confidence += 0.5
            except Exception as e:
                logger.debug(f"DeepFace analysis failed: {e}")
                
            # PHASE 1: Method 2 - FER (Multi-model consensus)
            fer_success = False
            try:
                # Use pre-initialized FER detector
                if self.fer_detector:
                    fer_results = self.fer_detector.detect_emotions(frame)
                    if fer_results:
                        fer_emotions = fer_results[0]['emotions']
                        # Map FER emotions to our emotion set
                        fer_mapping = {
                            'happy': 'happy',
                            'sad': 'sad',
                            'angry': 'angry',
                            'surprise': 'surprise',
                            'fear': 'fear',
                            'disgust': 'disgust',
                            'neutral': 'neutral'
                        }
                        
                        for fer_emotion, score in fer_emotions.items():
                            if fer_emotion in fer_mapping:
                                mapped_emotion = fer_mapping[fer_emotion]
                                emotion_scores[mapped_emotion] += score
                                
                        methods_used += 1
                        fer_success = True
                        confidence += 0.8
                        
                        # Update face region if not already set
                        if not face_region and fer_results[0].get('box'):
                            box = fer_results[0]['box']
                            face_region = {'x': box[0], 'y': box[1], 'w': box[2], 'h': box[3]}
                else:
                    logger.debug("FER detector not available")
                        
            except Exception as e:
                logger.debug(f"FER analysis failed: {e}")
                
            # Method 3: MediaPipe facial landmarks analysis
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_frame)
            
            if results.multi_face_landmarks:
                face_landmarks = results.multi_face_landmarks[0]
                
                # Analyze micro-expressions
                micro_scores = self._analyze_micro_expressions(face_landmarks)
                for emotion, score in micro_scores.items():
                    emotion_scores[emotion] += score
                methods_used += 1
                confidence += 0.7
                
            # Method 4: Face detection confidence
            detection_results = self.face_detection.process(rgb_frame)
            if detection_results.detections:
                detection = detection_results.detections[0]
                detection_confidence = detection.score[0]
                
                # High confidence detection suggests engagement
                if detection_confidence > 0.9:
                    emotion_scores['happy'] += 0.1
                    emotion_scores['neutral'] += 0.1
                elif detection_confidence < 0.6:
                    emotion_scores['bored'] += 0.2
                    
                confidence += detection_confidence
                methods_used += 1
                
            # PHASE 1: Multi-model consensus - require agreement
            if deepface_success and fer_success:
                # Boost emotions that both models agree on
                for emotion in emotion_scores:
                    if emotion_scores[emotion] > 0.5:  # Both models detected it
                        emotion_scores[emotion] *= 1.2
                        
            # Normalize scores if we have data
            if methods_used > 0:
                for emotion in emotion_scores:
                    emotion_scores[emotion] /= methods_used
                confidence /= methods_used
            else:
                # No face detected - assume neutral/bored
                emotion_scores['neutral'] = 0.7
                emotion_scores['bored'] = 0.3
                confidence = 0.1
                
            # Detect boredom from lack of movement
            if frame_number > 30 and len(self.emotion_history) > 10:
                recent_emotions = [h['emotion'] for h in self.emotion_history[-10:]]
                if recent_emotions.count('neutral') > 7:
                    emotion_scores['bored'] += 0.3
                    emotion_scores['neutral'] -= 0.2
                    
            # Ensure scores are non-negative
            for emotion in emotion_scores:
                emotion_scores[emotion] = max(0, emotion_scores[emotion])
                
            # Collect baseline or apply baseline adjustment
            timestamp = frame_number / self.video_fps if self.video_fps > 0 else 0
            
            if not self.baseline_collected and timestamp < self.baseline_collection_duration:
                # Still collecting baseline
                self._collect_baseline_sample(emotion_scores)
                
            # PHASE 1: Apply emotion smoothing
            smoothed_scores = self._smooth_emotions(emotion_scores)
            
            # Apply baseline adjustment if baseline is ready
            if self.baseline_collected:
                smoothed_scores = self._apply_baseline_adjustment(smoothed_scores)
                
            # Apply optimization if available
            if OPTIMIZATION_AVAILABLE and self.emotion_optimizer:
                # Get micro expressions for optimizer
                micro_expressions = {}
                if results.multi_face_landmarks:
                    micro_expressions = self._extract_micro_expressions_for_optimizer(face_landmarks)
                
                # Ensure the correct method name is used
                optimized_scores = self.emotion_optimizer.optimize_emotion_scores(
                    raw_scores=smoothed_scores,
                    micro_expressions=micro_expressions,
                    face_quality=quality_metrics['overall_score'],
                    temporal_context=self.emotion_history[-10:] if self.emotion_history else None
                )
                
                # Apply context if available
                if self.context_detector:
                    # Get context adjustments
                    context_adjustments = self.context_detector.get_contextual_adjustment(
                        max(optimized_scores, key=optimized_scores.get)
                    )
                    
                    # Apply context adjustments
                    for emotion in list(optimized_scores.keys()):
                        optimized_scores[emotion] *= context_adjustments.get(emotion, 1.0)
                            
                    # Re-normalize
                    total = sum(optimized_scores.values())
                    if total > 0:
                        optimized_scores = {k: v/total for k, v in optimized_scores.items()}
                
                smoothed_scores = optimized_scores
            else:
                # Normalize scores to sum to 1
                total_score = sum(smoothed_scores.values())
                if total_score > 0:
                    smoothed_scores = {k: v / total_score for k, v in smoothed_scores.items()}
                    
            # Get dominant emotion
            dominant_emotion = max(smoothed_scores, key=smoothed_scores.get)
            
            # Calculate engagement score (inverse of neutral + bored)
            engagement = 1.0 - (smoothed_scores['neutral'] + smoothed_scores['bored']) / 2.0
            engagement = max(0.1, min(1.0, engagement))  # Clamp between 0.1 and 1.0
            
            return {
                'emotion': dominant_emotion,
                'scores': smoothed_scores,
                'confidence': confidence * quality_metrics['overall_score'],  # Factor in quality
                'engagement': engagement,
                'methods_used': methods_used,
                'quality': quality_metrics['overall_score'],
                'face_region': face_region
            }
            
        except Exception as e:
            logger.error(f"Error in frame analysis: {e}")
            # Return a default neutral result
            return {
                'emotion': 'neutral',
                'scores': emotion_scores,
                'confidence': 0.1,
                'engagement': 0.5,
                'methods_used': 0,
                'quality': 0.5
            }
        
    def _extract_micro_expressions_for_optimizer(self, landmarks) -> Dict[str, float]:
        """Extract micro-expression intensities for the optimizer"""
        micro_expressions = {}
        
        # Convert landmarks to numpy array
        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks.landmark])
        
        # Eyebrow analysis
        left_eyebrow = points[70][1]
        right_eyebrow = points[107][1]
        eyebrow_height = (left_eyebrow + right_eyebrow) / 2
        
        # Detect eyebrow raise
        if eyebrow_height < 0.4:
            micro_expressions['eyebrow_raise'] = 1.0 - (eyebrow_height / 0.4)
        
        # Detect eyebrow furrow
        eyebrow_distance = abs(points[70][0] - points[107][0])
        if eyebrow_distance < 0.15:
            micro_expressions['eyebrow_furrow'] = 1.0 - (eyebrow_distance / 0.15)
        
        # Eye analysis
        left_eye_height = abs(points[159][1] - points[145][1])
        right_eye_height = abs(points[386][1] - points[374][1])
        eye_openness = (left_eye_height + right_eye_height) / 2
        
        # Eye squint (for genuine smiles)
        if eye_openness < 0.01:
            micro_expressions['eye_squint'] = 1.0 - (eye_openness / 0.01)
        
        # Eye widening
        if eye_openness > 0.03:
            micro_expressions['eye_widening'] = (eye_openness - 0.03) / 0.02
        
        # Mouth analysis
        mouth_left = points[61]
        mouth_right = points[291]
        mouth_top = points[13]
        mouth_bottom = points[14]
        
        mouth_corner_left_height = mouth_left[1]
        mouth_corner_right_height = mouth_right[1]
        mouth_center_height = mouth_top[1]
        
        # Mouth corner up (smile)
        if mouth_corner_left_height < mouth_center_height:
            left_smile = (mouth_center_height - mouth_corner_left_height) / 0.02
            right_smile = (mouth_center_height - mouth_corner_right_height) / 0.02
            micro_expressions['mouth_corner_up'] = (left_smile + right_smile) / 2
        
        # Mouth corner down
        if mouth_corner_left_height > mouth_center_height:
            left_frown = (mouth_corner_left_height - mouth_center_height) / 0.02
            right_frown = (mouth_corner_right_height - mouth_center_height) / 0.02
            micro_expressions['mouth_corner_down'] = (left_frown + right_frown) / 2
        
        # Mouth open
        mouth_height = abs(mouth_bottom[1] - mouth_top[1])
        if mouth_height > 0.03:
            micro_expressions['mouth_open'] = (mouth_height - 0.03) / 0.02
        
        # Lip compression
        if mouth_height < 0.01:
            micro_expressions['lip_compression'] = 1.0 - (mouth_height / 0.01)
        
        # Nose wrinkle
        nose_tip = points[1][1]
        nose_base = points[2][1]
        if nose_tip < nose_base - 0.01:
            micro_expressions['nose_wrinkle'] = (nose_base - nose_tip - 0.01) / 0.01
        
        # Jaw clench (simplified - using jaw width)
        jaw_left = points[172][0]
        jaw_right = points[397][0]
        jaw_width = abs(jaw_right - jaw_left)
        if jaw_width < 0.2:  # Narrower jaw indicates clenching
            micro_expressions['jaw_clench'] = 1.0 - (jaw_width / 0.2)
        
        # Face tension (using overall face movement variance)
        face_variance = np.var(points[:, :2])  # X,Y variance
        if face_variance < 0.001:  # Low movement = tension
            micro_expressions['face_tension'] = 1.0 - (face_variance / 0.001)
        
        # Normalize all values to 0-1 range
        for key in micro_expressions:
            micro_expressions[key] = min(max(micro_expressions[key], 0.0), 1.0)
        
        return micro_expressions
    
    def _analyze_micro_expressions(self, landmarks) -> Dict[str, float]:
        """Analyze facial landmarks for micro-expressions"""
        scores = {emotion: 0.0 for emotion in ['happy', 'sad', 'angry', 'surprise', 
                                               'fear', 'disgust', 'neutral', 'bored', 
                                               'stressed', 'confused']}
        
        # Convert landmarks to numpy array for easier processing
        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks.landmark])
        
        # Eyebrow analysis (landmarks 70, 63, 105, 66, 107)
        left_eyebrow = points[70][1]
        right_eyebrow = points[107][1]
        eyebrow_height = (left_eyebrow + right_eyebrow) / 2
        
        if eyebrow_height < 0.4:  # Raised eyebrows
            scores['surprise'] += 0.3
            scores['fear'] += 0.1
            
        # Eye analysis (landmarks 159, 145, 386, 374)
        left_eye_height = abs(points[159][1] - points[145][1])
        right_eye_height = abs(points[386][1] - points[374][1])
        eye_openness = (left_eye_height + right_eye_height) / 2
        
        if eye_openness < 0.01:  # Squinted eyes
            scores['happy'] += 0.2
            scores['disgust'] += 0.1
        elif eye_openness > 0.03:  # Wide eyes
            scores['surprise'] += 0.2
            scores['fear'] += 0.2
            
        # Mouth analysis (landmarks 61, 84, 17, 314, 405, 320)
        mouth_left = points[61]
        mouth_right = points[291]
        mouth_top = points[13]
        mouth_bottom = points[14]
        
        mouth_width = abs(mouth_right[0] - mouth_left[0])
        mouth_height = abs(mouth_bottom[1] - mouth_top[1])
        
        # Smile detection
        mouth_corner_left = points[61][1]
        mouth_corner_right = points[291][1]
        mouth_center = points[13][1]
        
        if mouth_corner_left < mouth_center and mouth_corner_right < mouth_center:
            scores['happy'] += 0.4
        elif mouth_corner_left > mouth_center and mouth_corner_right > mouth_center:
            scores['sad'] += 0.3
            
        # Mouth openness
        if mouth_height > 0.03:
            scores['surprise'] += 0.2
            scores['angry'] += 0.1
            
        # Nose analysis (landmarks 1, 2, 5, 4)
        nose_tip = points[1][1]
        nose_base = points[2][1]
        
        if nose_tip < nose_base - 0.01:  # Wrinkled nose
            scores['disgust'] += 0.3
            
        # Overall face movement
        if len(self.emotion_history) > 5:
            # Calculate movement by comparing with previous frames
            scores['bored'] += 0.1  # Low movement indicates boredom
            
        return scores
        
    def _extract_audio_emotions(self):
        """Extract emotions from audio track and transcribe"""
        if not MOVIEPY_AVAILABLE:
            logger.info("MoviePy not available - skipping audio emotion analysis")
            return
            
        try:
            # Extract audio from video
            video_clip = VideoFileClip(self.current_video_path)
            if video_clip.audio:
                logger.info("Processing audio for transcription")
                
                # Extract audio to temporary file
                temp_audio = Path(self.current_video_path).stem + "_temp_wav.wav"
                video_clip.audio.write_audiofile(temp_audio, logger=None, verbose=False)
                video_clip.close()
                
                # Transcribe audio
                self._transcribe_audio(temp_audio)
                
                # Clean up
                try:
                    Path(temp_audio).unlink()
                except:
                    pass
            else:
                logger.info("Video has no audio track")
        except Exception as e:
            logger.error(f"Audio extraction failed: {e}")
            
    def _transcribe_audio(self, audio_path):
        """Transcribe audio and map to timestamps"""
        try:
            # Use speech recognition
            r = sr.Recognizer()
            
            # Load audio file
            with sr.AudioFile(audio_path) as source:
                # Process in chunks for timestamp mapping
                chunk_duration = 5  # 5 second chunks
                audio_duration = source.DURATION
                
                self.transcription_segments = []
                
                for start_time in range(0, int(audio_duration), chunk_duration):
                    # Read chunk
                    duration = min(chunk_duration, audio_duration - start_time)
                    audio_chunk = r.record(source, duration=duration)
                    
                    try:
                        # Transcribe chunk
                        text = r.recognize_google(audio_chunk)
                        
                        # Map to emotion at this timestamp
                        emotion_at_time = self._get_emotion_at_timestamp(start_time)
                        
                        self.transcription_segments.append({
                            'start_time': start_time,
                            'end_time': start_time + duration,
                            'text': text,
                            'emotion': emotion_at_time
                        })
                        
                        logger.info(f"Transcribed {start_time}s-{start_time + duration}s: {text[:50]}...")
                        
                    except sr.UnknownValueError:
                        # Could not understand audio
                        pass
                    except sr.RequestError as e:
                        logger.error(f"Speech recognition error: {e}")
                        break
                        
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            
    def _get_emotion_at_timestamp(self, timestamp):
        """Get the dominant emotion at a specific timestamp"""
        # Find emotions around this timestamp
        emotions_near = []
        for entry in self.emotion_history:
            if abs(entry['timestamp'] - timestamp) < 2.5:  # Within 2.5 seconds
                emotions_near.append(entry['emotion'])
                
        if emotions_near:
            # Return most common emotion
            from collections import Counter
            return Counter(emotions_near).most_common(1)[0][0]
        return 'neutral'
        
    def _update_snapshot_in_storage(self, snapshot_index: int, enhanced_analysis: Dict):
        """Update snapshot in storage with enhanced analysis data"""
        try:
            # Import here to avoid circular dependency
            from app.video_storage import VideoAnalysisStorage
            storage = VideoAnalysisStorage()
            
            # Get the current reaction ID if available
            if hasattr(self, '_reaction_id') and self._reaction_id:
                # Update the specific snapshot in the reaction
                storage.update_reaction_snapshot(
                    self._reaction_id, 
                    snapshot_index, 
                    enhanced_analysis
                )
                logger.info(f"Updated snapshot {snapshot_index} in reaction {self._reaction_id}")
        except Exception as e:
            logger.error(f"Failed to update snapshot in storage: {e}")
    
    def _complete_analysis(self):
        """Complete the analysis and generate results"""
        results = {
            'analysis_id': self.current_analysis_id,
            'emotion_timeline': self.emotion_history,
            'engagement_score': self._calculate_overall_engagement(),
            'emotion_summary': self._calculate_emotion_summary(),
            'key_moments': self._identify_key_moments(),
            # Transcription is now handled on video upload, not per reaction
            'reaction_snapshots': self._process_snapshots()
        }
        
        # Add aggregated demographics if available
        demographics = self._aggregate_demographics()
        if demographics:
            results['demographics'] = demographics
        
        if self.completion_callback:
            self.completion_callback(results)
            
        # Properly stop the analysis - this is a method, not an attribute
        self.is_running = False  # Set the flag instead of calling stop_analysis from within the thread
        
    def _calculate_overall_engagement(self) -> float:
        """Calculate overall engagement score"""
        if not self.emotion_history:
            return 0.0
            
        engagements = [e['engagement'] for e in self.emotion_history]
        return sum(engagements) / len(engagements)
        
    def _calculate_emotion_summary(self) -> Dict[str, float]:
        """Calculate emotion percentages"""
        if not self.emotion_history:
            return {}
            
        emotion_counts = {}
        total = len(self.emotion_history)
        
        for entry in self.emotion_history:
            emotion = entry['emotion']
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            
        return {emotion: (count / total * 100) for emotion, count in emotion_counts.items()}
        
    def _identify_key_moments(self) -> List[Dict]:
        """Identify key emotional moments"""
        key_moments = []
        
        # Find moments of high emotion or emotion changes
        for i, entry in enumerate(self.emotion_history):
            if entry['engagement'] > 0.8:  # High engagement
                key_moments.append({
                    'timestamp': entry['timestamp'],
                    'emotion': entry['emotion'],
                    'reason': 'High engagement'
                })
                
        return key_moments[:10]  # Top 10 moments
        
    def _get_transcription(self) -> str:
        """Get video transcription with emotion mapping"""
        if hasattr(self, 'transcription_segments') and self.transcription_segments:
            # Combine all segments
            full_transcript = []
            emotion_segments = []
            
            for segment in self.transcription_segments:
                full_transcript.append(segment['text'])
                emotion_segments.append({
                    'text': segment['text'],
                    'emotion': segment['emotion'],
                    'start_time': segment['start_time'],
                    'end_time': segment['end_time']
                })
                
            return {
                'full_text': ' '.join(full_transcript),
                'segments': emotion_segments
            }
        return {
            'full_text': 'Transcription not available',
            'segments': []
        }
        
    def _start_audio_playback(self):
        """Start audio playback from video"""
        try:
            # Check if temp audio already exists from preprocessing
            temp_audio = Path(self.current_video_path).stem + "_temp_audio.mp3"
            
            # If not, try to extract it
            if not Path(temp_audio).exists() and MOVIEPY_AVAILABLE:
                logger.info("Extracting audio for playback...")
                video_clip = VideoFileClip(self.current_video_path)
                if video_clip.audio:
                    video_clip.audio.write_audiofile(temp_audio, logger=None, verbose=False)
                    video_clip.close()
                else:
                    logger.info("Video has no audio track")
                    return
            
            # Load and play audio if file exists
            if Path(temp_audio).exists():
                logger.info(f"Playing audio from: {temp_audio}")
                pygame.mixer.music.load(str(temp_audio))
                pygame.mixer.music.play()
                self.audio_playing = True
                self.audio_start_time = time.time()
                
                # Don't delete the temp file immediately - it might be reused
                logger.info("Audio playback started successfully")
            else:
                logger.warning("No audio file available for playback")
                
        except Exception as e:
            logger.error(f"Failed to start audio playback: {e}")
        
    def cleanup(self):
        """Clean up resources"""
        try:
            # Stop audio if playing
            if hasattr(self, 'audio_playing') and self.audio_playing:
                pygame.mixer.music.stop()
                self.audio_playing = False
                
            # Release video captures
            if self.video_cap:
                self.video_cap.release()
                self.video_cap = None
                
            if self.video_display_cap:
                self.video_display_cap.release()
                self.video_display_cap = None
                
            if self.webcam_cap:
                self.webcam_cap.release()
                self.webcam_cap = None
                
            logger.info("Cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
        
    def _should_capture_snapshot(self, emotion_data):
        """Determine if we should capture a webcam snapshot"""
        # For demographics, only capture ONE snapshot (the first good one)
        if ENABLE_GEMINI_ANALYSIS and self.enhanced_analyzer:
            # Check if we already have a snapshot with demographics
            has_demographics = any(
                'enhanced_analysis' in snap and 
                'demographics' in snap.get('enhanced_analysis', {})
                for snap in self.reaction_snapshots
            )
            
            if has_demographics:
                # Already have demographics, don't capture more
                return False
            
            # Only capture if face quality is good enough
            if emotion_data.get('quality', 0) > 0.7:
                return True
            else:
                return False
        
        # If demographics disabled, use normal capture logic for emotion tracking
        # Capture if high engagement
        if emotion_data['engagement'] > 0.8:
            return True
            
        # Capture if emotion changed significantly
        if len(self.emotion_history) > 10:
            recent_emotion = self.emotion_history[-10]['emotion']
            if recent_emotion != emotion_data['emotion']:
                return True
                
        # Capture periodically (every 30 seconds)
        if len(self.reaction_snapshots) == 0 or (
            emotion_data['timestamp'] - self.reaction_snapshots[-1]['timestamp'] > 30
        ):
            return True
            
        return False
        
    def _process_snapshots(self):
        """Process reaction snapshots for storage"""
        processed = []
        for snapshot in self.reaction_snapshots[:20]:  # Limit to 20 snapshots
            # Convert frame to base64 for storage
            _, buffer = cv2.imencode('.jpg', snapshot['frame'], [cv2.IMWRITE_JPEG_QUALITY, 70])
            img_base64 = buffer.tobytes()
            
            processed_snapshot = {
                'emotion': snapshot['emotion'],
                'timestamp': snapshot['timestamp'],
                'engagement': snapshot['engagement'],
                'image_data': img_base64
            }
            
            # Include enhanced analysis if available
            if 'enhanced_analysis' in snapshot:
                processed_snapshot['enhanced_analysis'] = snapshot['enhanced_analysis']
                
            processed.append(processed_snapshot)
            
        return processed

    def _aggregate_demographics(self) -> Optional[Dict]:
        """Aggregate demographic data from snapshots"""
        all_demographics = []
        
        # Collect all demographic data
        for snapshot in self.reaction_snapshots:
            if 'enhanced_analysis' in snapshot and 'demographics' in snapshot['enhanced_analysis']:
                all_demographics.append(snapshot['enhanced_analysis']['demographics'])
        
        if not all_demographics:
            return None
        
        # Aggregate the data
        aggregated = {
            'sample_count': len(all_demographics),
            'gender_distribution': {},
            'age_range': {'min': None, 'max': None, 'average': None},
            'attention_average': None
        }
        
        # Count genders
        genders = [d.get('gender', 'Unknown') for d in all_demographics]
        for gender in set(genders):
            aggregated['gender_distribution'][gender] = genders.count(gender) / len(genders)
        
        # Calculate age statistics
        ages = [d.get('age_estimate', 0) for d in all_demographics if d.get('age_estimate')]
        if ages:
            aggregated['age_range']['min'] = min(ages)
            aggregated['age_range']['max'] = max(ages)
            aggregated['age_range']['average'] = sum(ages) / len(ages)
        
        # Calculate average attention
        attentions = [d.get('attention_level', 0) for d in all_demographics if 'attention_level' in d]
        if attentions:
            aggregated['attention_average'] = sum(attentions) / len(attentions)
        
        return aggregated

    def pre_initialize_webcam(self):
        """Pre-initialize webcam to reduce startup time"""
        try:
            logger.info("Pre-initializing webcam...")
            
            # Suppress OpenCV warnings
            with SuppressOpenCVWarnings():
                # Try different backends in order of preference
                backends = [
                    (cv2.CAP_DSHOW, "DirectShow"),
                    (cv2.CAP_MSMF, "Media Foundation"),
                    (cv2.CAP_ANY, "Default")
                ]
                
                for backend, name in backends:
                    try:
                        self.webcam_cap = cv2.VideoCapture(0, backend)
                        if self.webcam_cap.isOpened():
                            # Configure webcam for low latency
                            self.webcam_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                            self.webcam_cap.set(cv2.CAP_PROP_FPS, 30)
                            
                            # Read a test frame to ensure it's working
                            ret, _ = self.webcam_cap.read()
                            if ret:
                                logger.info(f"Webcam pre-initialized successfully with {name}")
                                return True
                            else:
                                self.webcam_cap.release()
                                self.webcam_cap = None
                    except:
                        pass
                
                logger.warning("Webcam pre-initialization failed with all backends")
                    
        except Exception as e:
            logger.error(f"Failed to pre-initialize webcam: {e}")
            if self.webcam_cap:
                self.webcam_cap.release()
                self.webcam_cap = None
                
        return False 

    def _initialize_webcam(self):
        """Initialize or reuse webcam for emotion detection"""
        # Check if webcam is already initialized and working
        if self.webcam_cap and self.webcam_cap.isOpened():
            ret, _ = self.webcam_cap.read()
            if ret:
                logger.info("Using pre-initialized webcam")
                return True
        
        # Otherwise initialize fresh
        
        for attempt in range(self.webcam_retry_count):
            try:
                with SuppressOpenCVWarnings():
                    # Try different backends
                    backends = [
                        (cv2.CAP_DSHOW, "DirectShow"),
                        (cv2.CAP_MSMF, "Media Foundation"),
                        (cv2.CAP_ANY, "Default")
                    ]
                    
                    for backend, name in backends:
                        try:
                            self.webcam_cap = cv2.VideoCapture(0, backend)
                            if self.webcam_cap.isOpened():
                                # Configure for low latency
                                self.webcam_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                                self.webcam_cap.set(cv2.CAP_PROP_FPS, 30)
                                
                                # Test read
                                ret, _ = self.webcam_cap.read()
                                if ret:
                                    logger.info(f"Webcam initialized with {name} on attempt {attempt + 1}")
                                    return True
                                else:
                                    self.webcam_cap.release()
                                    self.webcam_cap = None
                        except:
                            pass
                        
            except Exception as e:
                logger.warning(f"Webcam init attempt {attempt + 1} failed: {e}")
                
            if attempt < self.webcam_retry_count - 1:
                time.sleep(self.webcam_retry_delay)
                
        logger.error("Failed to initialize webcam after all attempts")
        return False 

    def warm_models(self) -> bool:
        """Warm up all models by running them on dummy data"""
        try:
            logger.info("Starting comprehensive model warm-up...")
            start_time = time.time()
            
            # Create a more realistic dummy frame with face
            dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            # Draw a realistic face pattern
            cv2.rectangle(dummy_frame, (200, 150), (440, 350), (200, 180, 170), -1)  # Face color
            cv2.circle(dummy_frame, (280, 220), 30, (50, 50, 50), -1)  # Left eye
            cv2.circle(dummy_frame, (360, 220), 30, (50, 50, 50), -1)  # Right eye
            cv2.ellipse(dummy_frame, (320, 280), (60, 30), 0, 0, 180, (100, 50, 50), 2)  # Mouth
            
            # 1. Warm up DeepFace
            try:
                logger.info("Warming up DeepFace...")
                for _ in range(2):  # Run twice to ensure JIT compilation
                    DeepFace.analyze(
                        dummy_frame, 
                        actions=['emotion'], 
                        enforce_detection=False,
                        detector_backend='opencv'
                    )
                logger.info("DeepFace warmed up successfully")
            except Exception as e:
                logger.warning(f"DeepFace warm-up failed: {e}")
            
            # 2. Warm up FER
            if self.fer_detector:
                try:
                    logger.info("Warming up FER...")
                    for _ in range(2):  # Run twice
                        self.fer_detector.detect_emotions(dummy_frame)
                    logger.info("FER warmed up successfully")
                except Exception as e:
                    logger.warning(f"FER warm-up failed: {e}")
            
            # 3. Warm up MediaPipe
            try:
                logger.info("Warming up MediaPipe...")
                rgb_frame = cv2.cvtColor(dummy_frame, cv2.COLOR_BGR2RGB)
                for _ in range(2):  # Run twice
                    self.face_mesh.process(rgb_frame)
                    self.face_detection.process(rgb_frame)
                logger.info("MediaPipe warmed up successfully")
            except Exception as e:
                logger.warning(f"MediaPipe warm-up failed: {e}")
            
            # 4. Warm up emotion optimizer if available
            if OPTIMIZATION_AVAILABLE and self.emotion_optimizer:
                try:
                    logger.info("Warming up emotion optimizer...")
                    dummy_scores = {
                        'happy': 0.3, 'sad': 0.1, 'angry': 0.1, 'surprise': 0.1,
                        'fear': 0.1, 'disgust': 0.1, 'neutral': 0.1, 
                        'bored': 0.05, 'stressed': 0.05, 'confused': 0.0
                    }
                    dummy_micro = {'eyebrow_raise': 0.5, 'mouth_corner_up': 0.7}
                    
                    self.emotion_optimizer.optimize_emotion_scores(
                        raw_scores=dummy_scores,
                        micro_expressions=dummy_micro,
                        face_quality=0.8,
                        temporal_context=[]
                    )
                    logger.info("Emotion optimizer warmed up successfully")
                except Exception as e:
                    logger.warning(f"Emotion optimizer warm-up failed: {e}")
            
            # 5. Run full analysis to warm up the entire pipeline
            try:
                logger.info("Running full pipeline warm-up...")
                for i in range(3):  # Run 3 times to ensure everything is cached
                    self._analyze_frame(dummy_frame, i)
                logger.info("Full pipeline warmed up successfully")
            except Exception as e:
                logger.warning(f"Full pipeline warm-up failed: {e}")
            
            elapsed = time.time() - start_time
            logger.info(f"Model warm-up completed in {elapsed:.2f} seconds")
            
            self.models_warmed = True
            return True
            
        except Exception as e:
            logger.error(f"Model warm-up failed: {e}")
            self.models_warmed = False
            return False 