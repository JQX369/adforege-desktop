# FILE: app/config.py
"""Configuration settings for the gesture authentication system."""

# Window settings
WINDOW_WIDTH = 1000
WINDOW_HEIGHT = 700
WINDOW_TITLE = "AI Authentication & Analysis System"

# Modern Dark Theme Colors
BG_COLOR = "#1a1a1a"        # Very dark background
FG_COLOR = "#ffffff"        # White text
BUTTON_BG = "#2d2d2d"      # Dark gray buttons
BUTTON_FG = "#ffffff"      # White button text
BUTTON_HOVER = "#404040"   # Lighter gray on hover
SUCCESS_COLOR = "#4ade80"  # Modern green
ERROR_COLOR = "#f87171"    # Modern red
WARNING_COLOR = "#fbbf24"  # Modern yellow
INFO_COLOR = "#60a5fa"     # Modern blue
ACCENT_COLOR = "#a78bfa"   # Modern purple accent

# Frame and container colors
FRAME_BG = "#262626"       # Slightly lighter than background
BORDER_COLOR = "#404040"   # Subtle borders

# Camera settings
CAMERA_INDEX = 0
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
TARGET_FPS = 15
DISPLAY_WIDTH = 400
DISPLAY_HEIGHT = 300

# Detection settings
MIN_DETECTION_CONFIDENCE = 0.7
MIN_TRACKING_CONFIDENCE = 0.5

# Authentication settings
MIN_PASSWORD_LENGTH = 3
MAX_TOKEN_GAP_SECONDS = 5.0
PROFILE_FILE = "profiles.json"

# Liveness detection
MIN_Z_DEPTH_CHANGE_MM = 2.0
MAX_NO_FACE_SECONDS = 1.0

# Recognition thresholds
GESTURE_HOLD_TIME = 2.0  # seconds (increased for accuracy)
EXPRESSION_HOLD_TIME = 2.0  # seconds (increased for accuracy)

# Supported gestures
HAND_GESTURES = [
    "THUMBS_UP",
    "VICTORY",
    "OPEN_PALM",
    "OK_SIGN",
    "FIST"
]

# Supported expressions
FACE_EXPRESSIONS = [
    "SMILE",
    "NEUTRAL",
    "RAISE_EYEBROWS"
]

# Combined tokens for authentication
ALL_TOKENS = HAND_GESTURES + FACE_EXPRESSIONS 

# API Configuration - loaded securely
import os
try:
    from app.config_secure import GOOGLE_API_KEY
except ImportError:
    # Fallback for development
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
    
# OpenAI API is not currently used
OPENAI_API_KEY = ""

# Emotion Tracker Settings
EMOTION_CATEGORIES = [
    "happy", "sad", "angry", "surprise", 
    "fear", "disgust", "neutral", "bored"
]
EMOTION_CONFIDENCE_THRESHOLD = 0.3

# Speech Analysis Settings
AUDIO_SAMPLE_RATE = 16000
AUDIO_CHUNK_SIZE = 1024
SPEECH_CLIP_DURATION = 5  # seconds 