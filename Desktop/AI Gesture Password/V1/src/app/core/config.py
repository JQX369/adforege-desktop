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

def _get_api_key(key_name: str, cached_value: str = '') -> str:
    """
    Get API key from environment, with fallback to cached value.
    Always checks environment first to handle late dotenv loading.
    """
    env_value = os.environ.get(key_name, '')
    if env_value and env_value.strip():
        return env_value.strip()
    return cached_value

# Try to import from secure config first
_cached_google_key = ''
_cached_openai_key = ''
try:
    from app.core.config_secure import GOOGLE_API_KEY as _secure_google, OPENAI_API_KEY as _secure_openai
    _cached_google_key = _secure_google
    _cached_openai_key = _secure_openai
except ImportError:
    pass

# Dynamic properties that always check environment first
# This handles cases where dotenv loads after this module is imported
@property
def _google_api_key():
    return _get_api_key('GOOGLE_API_KEY', _cached_google_key)

@property  
def _openai_api_key():
    return _get_api_key('OPENAI_API_KEY', _cached_openai_key)

# For backwards compatibility, use functions that check env each time
def get_google_api_key() -> str:
    """Get Google API key, checking environment on each call."""
    return _get_api_key('GOOGLE_API_KEY', _cached_google_key)

def get_openai_api_key() -> str:
    """Get OpenAI API key, checking environment on each call."""
    return _get_api_key('OPENAI_API_KEY', _cached_openai_key)

# Module-level variables for backwards compatibility
# These will be set at import time but may be empty if dotenv hasn't loaded
GOOGLE_API_KEY = _get_api_key('GOOGLE_API_KEY', _cached_google_key)
OPENAI_API_KEY = _get_api_key('OPENAI_API_KEY', _cached_openai_key)

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