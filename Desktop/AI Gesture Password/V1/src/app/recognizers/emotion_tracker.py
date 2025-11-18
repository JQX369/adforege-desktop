# FILE: app/recognizers/emotion_tracker.py
"""Emotion tracking module for analyzing viewer reactions to videos."""

import logging
import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import threading
import time
import os
import tempfile
import subprocess
from app.config import EMOTION_CATEGORIES, EMOTION_CONFIDENCE_THRESHOLD
import tkinter as tk
from tkinter import messagebox
from app.video_player import VideoPlayer

logger = logging.getLogger(__name__)

# Try to import speech recognition
try:
    import speech_recognition as sr
    import moviepy.editor as mp
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    logger.warning("Speech recognition not available. Install speech_recognition and moviepy.")

# Try to import FER for advanced emotion detection
try:
    from fer import FER
    FER_AVAILABLE = True
except ImportError:
    FER_AVAILABLE = False
    logger.warning("FER not installed. Using basic emotion detection.")

# Try DeepFace as alternative
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    logger.warning("DeepFace not installed.")


# Emotional trigger words and their associations
EMOTIONAL_TRIGGERS = {
    # Negative emotions - with content rewording suggestions
    "stress": {
        "emotion": "anxious",
        "recommendations": [
            "Try: 'challenging' instead of 'stressful'",
            "Reframe as: 'opportunity for growth'",
            "Consider: 'requires focus' vs 'stress-inducing'"
        ]
    },
    "angry": {
        "emotion": "angry",
        "recommendations": [
            "Replace with: 'disappointed' or 'concerned'",
            "Try: 'passionate about improvement'",
            "Soften to: 'frustrated but motivated'"
        ]
    },
    "sad": {
        "emotion": "sad", 
        "recommendations": [
            "Reword as: 'reflective' or 'thoughtful'",
            "Try: 'experiencing a transition'",
            "Consider: 'learning from this experience'"
        ]
    },
    "worried": {
        "emotion": "anxious",
        "recommendations": [
            "Replace with: 'mindful of' or 'considering'",
            "Try: 'preparing for possibilities'",
            "Reframe as: 'being proactive about'"
        ]
    },
    "frustrated": {
        "emotion": "angry",
        "recommendations": [
            "Try: 'seeking solutions' or 'problem-solving'",
            "Reword as: 'navigating challenges'",
            "Consider: 'working through complexities'"
        ]
    },
    "boring": {
        "emotion": "bored",
        "recommendations": [
            "Replace with: 'straightforward' or 'routine'",
            "Try: 'foundational concepts'",
            "Reframe as: 'building essential skills'"
        ]
    },
    "bored": {
        "emotion": "bored",
        "recommendations": [
            "Try: 'ready for new challenges'",
            "Consider: 'seeking engagement'",
            "Reword as: 'looking for inspiration'"
        ]
    },
    "difficult": {
        "emotion": "anxious",
        "recommendations": [
            "Replace with: 'comprehensive' or 'thorough'",
            "Try: 'requires practice'",
            "Reframe as: 'skill-building opportunity'"
        ]
    },
    "hate": {
        "emotion": "angry",
        "recommendations": [
            "Soften to: 'prefer alternatives to'",
            "Try: 'find challenging'",
            "Replace with: 'not aligned with'"
        ]
    },
    "terrible": {
        "emotion": "sad",
        "recommendations": [
            "Try: 'area for improvement'",
            "Replace with: 'needs refinement'",
            "Consider: 'learning opportunity'"
        ]
    },
    "annoying": {
        "emotion": "angry",
        "recommendations": [
            "Reword as: 'requires patience'",
            "Try: 'detailed process'",
            "Replace with: 'thorough approach'"
        ]
    },
    "anxious": {
        "emotion": "anxious",
        "recommendations": [
            "Try: 'anticipating' or 'preparing'",
            "Reframe as: 'excited about possibilities'",
            "Replace with: 'energized for what's ahead'"
        ]
    },
    "depressed": {
        "emotion": "sad",
        "recommendations": [
            "Replace with: 'reflecting deeply'",
            "Try: 'in a transitional phase'",
            "Consider: 'processing important feelings'"
        ]
    },
    "stupid": {
        "emotion": "angry",
        "recommendations": [
            "Replace with: 'learning curve'",
            "Try: 'developing understanding'",
            "Reframe as: 'building knowledge'"
        ]
    },
    # Positive emotions - encourage these
    "happy": {
        "emotion": "happy",
        "recommendations": [
            "Great positive word! Keep using it",
            "Consider also: 'joyful', 'delighted'",
            "Positive framing enhances engagement"
        ]
    },
    "excited": {
        "emotion": "happy",
        "recommendations": [
            "Excellent energy! Maintain this tone",
            "Also try: 'enthusiastic', 'eager'",
            "Positive anticipation drives interest"
        ]
    },
    "love": {
        "emotion": "happy",
        "recommendations": [
            "Strong positive emotion! Use freely",
            "Also consider: 'appreciate', 'value'",
            "Emotional connection enhances learning"
        ]
    },
    "interesting": {
        "emotion": "happy",
        "recommendations": [
            "Good engagement word!",
            "Also try: 'fascinating', 'compelling'",
            "Curiosity-driven language is effective"
        ]
    },
    "amazing": {
        "emotion": "happy",
        "recommendations": [
            "Excellent positive descriptor!",
            "Also: 'remarkable', 'impressive'",
            "Enthusiasm is contagious"
        ]
    },
    # Complex emotions
    "confused": {
        "emotion": "neutral",
        "recommendations": [
            "Try: 'clarifying' or 'exploring'",
            "Reframe as: 'discovering connections'",
            "Replace with: 'building understanding'"
        ]
    },
    "overwhelmed": {
        "emotion": "anxious",
        "recommendations": [
            "Try: 'comprehensive content'",
            "Reword as: 'rich with information'",
            "Consider: 'multiple learning opportunities'"
        ]
    },
    "tired": {
        "emotion": "bored",
        "recommendations": [
            "Replace with: 'ready for a break'",
            "Try: 'processing information'",
            "Consider: 'integrating knowledge'"
        ]
    },
    "exhausted": {
        "emotion": "sad",
        "recommendations": [
            "Try: 'intensive learning session'",
            "Reframe as: 'deeply engaged'",
            "Replace with: 'thorough exploration'"
        ]
    }
}


@dataclass
class ViewerEmotionFrame:
    """Represents viewer's emotions at a specific video timestamp."""
    video_timestamp: float  # Timestamp in the video
    capture_time: datetime  # When emotion was captured
    emotions: Dict[str, float]
    dominant_emotion: str
    face_detected: bool
    confidence: float
    

@dataclass
class ViewerReactionProfile:
    """Complete viewer reaction profile for a video."""
    video_name: str
    video_duration: float
    viewing_date: datetime
    emotion_frames: List[ViewerEmotionFrame]
    emotion_summary: Dict[str, float]  # Average emotions
    emotional_journey: List[Tuple[float, str]]  # Key emotional moments
    engagement_score: float  # Overall engagement level
    transcription: Optional[str] = None  # Video transcription
    trigger_words: Optional[Dict[str, Dict]] = None  # Detected trigger words


class EmotionTracker:
    """Tracks viewer emotions while watching videos."""
    
    def __init__(self):
        """Initialize emotion tracker with advanced detection."""
        self.emotion_detector = None
        self.detection_method = None
        self._fer_initialized = False
        
        # Check what's available but don't initialize yet
        if FER_AVAILABLE:
            self.detection_method = "FER"
            logger.info("FER available - will initialize on first use")
        elif DEEPFACE_AVAILABLE:
            self.detection_method = "DeepFace"
            logger.info("Using DeepFace for emotion detection")
        else:
            self.detection_method = "Basic"
            logger.warning("No advanced emotion detection available")
        
        # Video playback state
        self.is_playing = False
        self.video_path = None
        self.video_player = VideoPlayer()  # Use new video player
        self.webcam_cap = None
        self.current_timestamp = 0.0
        
        # Emotion tracking state
        self.emotion_frames = []
        self.tracking_thread = None
        self.stop_event = threading.Event()
        
        # Transcription state
        self.transcription = None
        self.trigger_words = {}
        self.enable_transcription = False
        
        # Callbacks
        self.on_emotion_update = None
        self.on_analysis_complete = None
        
        # Initialize webcam
        self._init_webcam()
    
    def _init_webcam(self):
        """Initialize webcam for viewer emotion capture."""
        try:
            self.webcam_cap = cv2.VideoCapture(0)
            self.webcam_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.webcam_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        except Exception as e:
            logger.error(f"Failed to initialize webcam: {e}")
    
    def start_analysis(self, video_path: str, 
                      on_emotion_update: Optional[Callable] = None,
                      on_analysis_complete: Optional[Callable] = None,
                      enable_transcription: bool = False):
        """Start video analysis with emotion tracking and optional transcription."""
        self.on_emotion_update = on_emotion_update
        self.on_analysis_complete = on_analysis_complete
        self.enable_transcription = enable_transcription
        
        # Start video analysis
        if not self.start_video_analysis(video_path):
            return False
        
        # Start transcription in background if enabled
        if enable_transcription and SPEECH_RECOGNITION_AVAILABLE:
            transcription_thread = threading.Thread(target=self._transcribe_video)
            transcription_thread.daemon = True
            transcription_thread.start()
        
        return True
    
    def pause_analysis(self):
        """Pause video playback."""
        if self.video_player:
            self.video_player.pause()
            self.is_playing = False
    
    def start_video_analysis(self, video_path: str) -> bool:
        """Start playing video and tracking viewer emotions."""
        self.video_path = video_path
        self.emotion_frames = []
        self.stop_event.clear()
        
        # Load video with audio support
        if not self.video_player.load_video(video_path):
            logger.error(f"Failed to open video: {video_path}")
            return False
        
        # Get video properties from player's video capture
        if self.video_player.video_cap:
            self.fps = self.video_player.fps
            self.total_frames = int(self.video_player.video_cap.get(cv2.CAP_PROP_FRAME_COUNT))
            self.duration = self.total_frames / self.fps if self.fps > 0 else 0
        else:
            logger.error("Video capture not initialized")
            return False
        
        # Ensure webcam is initialized
        if not self.webcam_cap or not self.webcam_cap.isOpened():
            logger.warning("Webcam not initialized, attempting to reinitialize...")
            self._init_webcam()
            
        if not self.webcam_cap or not self.webcam_cap.isOpened():
            logger.error("Failed to initialize webcam for emotion tracking")
            messagebox.showwarning(
                "Webcam Error", 
                "Cannot access webcam for emotion tracking.\n"
                "Please ensure:\n"
                "1. Webcam is connected\n"
                "2. No other app is using the webcam\n"
                "3. Camera permissions are granted"
            )
            return False
        
        # Start emotion tracking thread
        self.is_playing = True
        self.tracking_thread = threading.Thread(target=self._track_emotions)
        self.tracking_thread.daemon = True
        self.tracking_thread.start()
        
        # Start video playback with audio
        self.video_player.play()
        
        logger.info(f"Started video analysis for: {video_path}")
        return True
    
    def _track_emotions(self):
        """Track viewer emotions in background thread."""
        emotion_capture_interval = 0.5  # Capture emotions every 0.5 seconds
        last_capture_time = 0
        frames_processed = 0
        emotions_detected = 0
        
        logger.info("Emotion tracking thread started")
        
        while not self.stop_event.is_set() and self.is_playing:
            current_time = time.time()
            
            # Capture emotion at intervals
            if current_time - last_capture_time >= emotion_capture_interval:
                ret, frame = self.webcam_cap.read() if self.webcam_cap else (False, None)
                
                if ret and frame is not None:
                    frames_processed += 1
                    
                    # Analyze viewer's emotions
                    emotions = self._analyze_viewer_emotions(frame)
                    
                    if emotions and any(v > 0 for v in emotions.values()):
                        emotions_detected += 1
                        
                        # Get current video timestamp from video player
                        if self.video_player.video_cap:
                            video_pos = self.video_player.video_cap.get(cv2.CAP_PROP_POS_FRAMES)
                            video_timestamp = video_pos / self.fps if self.fps > 0 else 0
                        else:
                            video_timestamp = 0
                        
                        # Find dominant emotion
                        dominant_emotion = max(emotions.items(), key=lambda x: x[1])[0]
                        confidence = max(emotions.values())
                        
                        # Create emotion frame
                        emotion_frame = ViewerEmotionFrame(
                            video_timestamp=video_timestamp,
                            capture_time=datetime.now(),
                            emotions=emotions,
                            dominant_emotion=dominant_emotion,
                            face_detected=True,
                            confidence=confidence
                        )
                        
                        self.emotion_frames.append(emotion_frame)
                        
                        # Call update callback if provided
                        if self.on_emotion_update:
                            self.on_emotion_update({
                                'emotion': dominant_emotion,
                                'confidence': confidence,
                                'timestamp': video_timestamp
                            })
                        
                        if emotions_detected % 10 == 0:
                            logger.debug(f"Captured {emotions_detected} emotion frames")
                else:
                    logger.warning("Failed to read webcam frame")
                
                last_capture_time = current_time
            
            time.sleep(0.1)  # Small delay to prevent CPU overload
        
        logger.info(f"Emotion tracking stopped. Frames processed: {frames_processed}, "
                   f"Emotions detected: {emotions_detected}, Total captured: {len(self.emotion_frames)}")
    
    def _analyze_viewer_emotions(self, frame: np.ndarray) -> Dict[str, float]:
        """Analyze viewer's emotions using advanced detection."""
        emotions = {}
        
        if self.detection_method == "FER":
            # Initialize FER on first use (lazy loading)
            if not self._fer_initialized:
                self._initialize_fer()
            
            if self.emotion_detector:
                try:
                    # Use FER for emotion detection
                    result = self.emotion_detector.detect_emotions(frame)
                    if result:
                        # Get the first face's emotions
                        face_emotions = result[0]['emotions']
                        # Map to our emotion categories
                        emotions = {
                            "happy": face_emotions.get('happy', 0),
                            "sad": face_emotions.get('sad', 0),
                            "angry": face_emotions.get('angry', 0),
                            "surprise": face_emotions.get('surprise', 0),
                            "fear": face_emotions.get('fear', 0),
                            "disgust": face_emotions.get('disgust', 0),
                            "neutral": face_emotions.get('neutral', 0)
                        }
                except Exception as e:
                    logger.error(f"FER detection error: {e}")
                
        elif self.detection_method == "DeepFace" and DEEPFACE_AVAILABLE:
            try:
                # Use DeepFace for emotion detection
                result = DeepFace.analyze(
                    frame, 
                    actions=['emotion'],
                    enforce_detection=False,
                    detector_backend='opencv'
                )
                if isinstance(result, list):
                    result = result[0]
                emotions = result.get('emotion', {})
            except Exception as e:
                logger.error(f"DeepFace detection error: {e}")
        
        else:
            # Basic detection - placeholder
            # In a real scenario, you might use OpenCV cascades with trained models
            emotions = {
                "neutral": 0.7,
                "happy": 0.2,
                "sad": 0.1
            }
        
        # Ensure all emotions have values
        for emotion in EMOTION_CATEGORIES:
            if emotion not in emotions:
                emotions[emotion] = 0.0
        
        # Normalize emotions to sum to 1
        total = sum(emotions.values())
        if total > 0:
            emotions = {k: v/total for k, v in emotions.items()}
        
        return emotions
    
    def get_video_frame(self) -> Optional[np.ndarray]:
        """Get current video frame for display."""
        if self.video_player and self.is_playing:
            return self.video_player.get_current_frame()
        return None
    
    def get_webcam_frame(self) -> Optional[np.ndarray]:
        """Get current webcam frame for display."""
        if self.webcam_cap:
            ret, frame = self.webcam_cap.read()
            if ret:
                return frame
        return None
    
    def stop_analysis(self) -> Optional[ViewerReactionProfile]:
        """Stop video playback and emotion tracking, return analysis."""
        self.is_playing = False
        self.stop_event.set()
        
        # Stop video player (including audio)
        if self.video_player:
            self.video_player.stop()
        
        if self.tracking_thread:
            self.tracking_thread.join(timeout=2)
        
        if not self.emotion_frames:
            logger.warning("No emotion frames captured during session")
            return None
        
        # Generate viewer reaction profile
        profile = self._generate_reaction_profile()
        
        # Call completion callback if provided
        if self.on_analysis_complete:
            # Convert profile to dict format
            results = {
                'duration': profile.video_duration,
                'timeline': [
                    {
                        'timestamp': frame.video_timestamp,
                        'emotion': frame.dominant_emotion,
                        'confidence': frame.confidence
                    }
                    for frame in profile.emotion_frames
                ],
                'emotion_summary': profile.emotion_summary,
                'engagement_score': profile.engagement_score
            }
            
            # Add transcription if available
            if self.transcription:
                results['transcription'] = self.transcription
                results['trigger_words'] = self.trigger_words
            
            self.on_analysis_complete(results)
        
        return profile
    
    def _generate_reaction_profile(self) -> ViewerReactionProfile:
        """Generate comprehensive viewer reaction profile."""
        # Calculate emotion summary (averages)
        emotion_totals = {emotion: 0.0 for emotion in EMOTION_CATEGORIES}
        
        for frame in self.emotion_frames:
            for emotion, value in frame.emotions.items():
                emotion_totals[emotion] += value
        
        num_frames = len(self.emotion_frames)
        emotion_summary = {k: v/num_frames for k, v in emotion_totals.items()}
        
        # Convert to percentages
        emotion_summary = {k: v * 100 for k, v in emotion_summary.items()}
        
        # Find emotional journey (significant moments)
        emotional_journey = self._find_emotional_peaks()
        
        # Calculate engagement score
        engagement_score = self._calculate_engagement()
        
        return ViewerReactionProfile(
            video_name=self.video_path.split('/')[-1] if self.video_path else "Unknown",
            video_duration=self.duration,
            viewing_date=datetime.now(),
            emotion_frames=self.emotion_frames,
            emotion_summary=emotion_summary,
            emotional_journey=emotional_journey,
            engagement_score=engagement_score,
            transcription=self.transcription,
            trigger_words=self.trigger_words
        )
    
    def _find_emotional_peaks(self) -> List[Tuple[float, str]]:
        """Find moments of peak emotional response."""
        peaks = []
        
        # Group by significant emotion changes
        for i, frame in enumerate(self.emotion_frames):
            if frame.confidence > EMOTION_CONFIDENCE_THRESHOLD:  # High confidence moments
                if frame.dominant_emotion not in ['neutral']:
                    peaks.append((frame.video_timestamp, frame.dominant_emotion))
        
        # Sort by timestamp and limit to top moments
        peaks.sort(key=lambda x: x[0])
        return peaks[:10]  # Top 10 moments
    
    def _calculate_engagement(self) -> float:
        """Calculate overall engagement score based on emotional variety and intensity."""
        if not self.emotion_frames:
            return 0.0
        
        # Factors for engagement:
        # 1. Emotional variety (not just neutral)
        # 2. Emotion intensity
        # 3. Face detection rate
        
        non_neutral_frames = sum(
            1 for frame in self.emotion_frames 
            if frame.dominant_emotion != 'neutral'
        )
        
        avg_confidence = sum(f.confidence for f in self.emotion_frames) / len(self.emotion_frames)
        face_detection_rate = sum(1 for f in self.emotion_frames if f.face_detected) / len(self.emotion_frames)
        
        engagement = (
            (non_neutral_frames / len(self.emotion_frames)) * 0.4 +
            avg_confidence * 0.3 +
            face_detection_rate * 0.3
        )
        
        return min(engagement, 1.0)
    
    def create_emotion_heatmap(self, profile: ViewerReactionProfile, width: int = 800, height: int = 400) -> np.ndarray:
        """Create visual heatmap of viewer emotions over video timeline."""
        img = np.ones((height, width, 3), dtype=np.uint8) * 255
        
        # Import centralized emotion colors
        from app.emotion_colors import EMOTION_COLORS_BGR
        emotion_colors = EMOTION_COLORS_BGR
        
        if not profile.emotion_frames:
            return img
        
        # Draw timeline
        timeline_y = height - 50
        cv2.line(img, (50, timeline_y), (width - 50, timeline_y), (100, 100, 100), 2)
        
        # Draw time markers
        for i in range(5):
            x = 50 + (width - 100) * i // 4
            time_marker = profile.video_duration * i / 4
            cv2.putText(img, f"{time_marker:.0f}s", (x - 15, timeline_y + 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
        
        # Plot emotions over time
        emotion_height = (timeline_y - 50) // len(EMOTION_CATEGORIES)
        
        for emotion_idx, emotion in enumerate(EMOTION_CATEGORIES):
            y_base = 50 + emotion_idx * emotion_height
            
            # Draw emotion label
            cv2.putText(img, emotion, (5, y_base + emotion_height // 2),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, emotion_colors[emotion], 1)
            
            # Plot emotion intensity
            points = []
            for frame in profile.emotion_frames:
                if profile.video_duration > 0:
                    x = int(50 + (width - 100) * frame.video_timestamp / profile.video_duration)
                    intensity = frame.emotions.get(emotion, 0)
                    y = int(y_base + emotion_height * (1 - intensity))
                    points.append((x, y))
            
            # Draw emotion curve
            if len(points) > 1:
                for i in range(len(points) - 1):
                    cv2.line(img, points[i], points[i + 1], emotion_colors[emotion], 2)
        
        # Add engagement score
        cv2.putText(img, f"Engagement Score: {profile.engagement_score:.1%}", 
                   (width - 200, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        
        return img
    
    def cleanup(self):
        """Clean up resources."""
        if self.webcam_cap:
            self.webcam_cap.release()
        if self.video_player:
            self.video_player.cleanup()

    def _initialize_fer(self):
        """Initialize FER detector (lazy loading to prevent startup freeze)."""
        if self._fer_initialized or self.detection_method != "FER":
            return
            
        try:
            logger.info("Initializing FER detector...")
            self.emotion_detector = FER(mtcnn=True)
            self._fer_initialized = True
            logger.info("FER detector initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize FER: {e}")
            self.detection_method = "Basic"

    def _transcribe_video(self):
        """Transcribe video audio and detect emotional triggers."""
        try:
            logger.info("Starting video transcription...")
            
            # Extract audio from video
            audio_path = self._extract_audio_from_video()
            if not audio_path:
                logger.error("Failed to extract audio from video")
                return
            
            # Transcribe audio
            recognizer = sr.Recognizer()
            
            with sr.AudioFile(audio_path) as source:
                # Load audio
                audio_data = recognizer.record(source)
                
                try:
                    # Attempt transcription
                    self.transcription = recognizer.recognize_google(audio_data)
                    logger.info(f"Transcription completed: {len(self.transcription)} characters")
                    
                    # Detect emotional trigger words
                    self._detect_trigger_words()
                    
                except sr.UnknownValueError:
                    logger.warning("Could not understand audio")
                    self.transcription = "Could not transcribe audio - speech unclear"
                except sr.RequestError as e:
                    logger.error(f"Speech recognition error: {e}")
                    self.transcription = "Transcription failed - check internet connection"
            
            # Clean up temp audio file
            if os.path.exists(audio_path):
                os.remove(audio_path)
                
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            self.transcription = f"Transcription error: {str(e)}"
    
    def _extract_audio_from_video(self) -> Optional[str]:
        """Extract audio from video file."""
        try:
            # Create temp file for audio
            temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_audio_path = temp_audio.name
            temp_audio.close()
            
            # Use moviepy to extract audio
            video = mp.VideoFileClip(self.video_path)
            audio = video.audio
            
            if audio:
                audio.write_audiofile(temp_audio_path, logger=None, verbose=False)
                video.close()
                return temp_audio_path
            else:
                logger.warning("Video has no audio track")
                video.close()
                return None
                
        except Exception as e:
            logger.error(f"Audio extraction error: {e}")
            return None
    
    def _detect_trigger_words(self):
        """Detect emotional trigger words in transcription."""
        if not self.transcription:
            return
        
        self.trigger_words = {}
        transcription_lower = self.transcription.lower()
        
        # Check for each trigger word
        for trigger_word, info in EMOTIONAL_TRIGGERS.items():
            if trigger_word in transcription_lower:
                self.trigger_words[trigger_word] = info
                logger.info(f"Detected emotional trigger: {trigger_word}")
        
        # Also detect emotion-related words not in our predefined list
        emotion_keywords = {
            "anxious": ["anxiety", "nervous", "worry", "tense", "stressful", "overwhelming"],
            "happy": ["joy", "delighted", "pleased", "cheerful", "wonderful", "fantastic"],
            "sad": ["depressed", "down", "unhappy", "miserable", "gloomy", "melancholy"],
            "angry": ["furious", "annoyed", "irritated", "mad", "rage", "hostile"],
            "bored": ["tedious", "monotonous", "dull", "uninteresting", "repetitive", "mundane"]
        }
        
        for emotion, keywords in emotion_keywords.items():
            for keyword in keywords:
                if keyword in transcription_lower and keyword not in self.trigger_words:
                    self.trigger_words[keyword] = {
                        "emotion": emotion,
                        "recommendations": EMOTIONAL_TRIGGERS.get(emotion, {}).get("recommendations", [
                            f"Acknowledged feeling: {keyword}",
                            "Practice self-awareness",
                            "Consider your emotional needs"
                        ])
                    } 