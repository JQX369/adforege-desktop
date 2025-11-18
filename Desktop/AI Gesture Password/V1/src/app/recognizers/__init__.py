"""Recognition modules for the authentication system."""

from .face_recognizer import FaceRecognizer
from .hand_recognizer import HandRecognizer
from .emotion_tracker import EmotionTracker, ViewerReactionProfile, ViewerEmotionFrame
from .speech_analyzer import SpeechAnalyzer, SpeechClip, SpeechAnalysisResult

__all__ = [
    'FaceRecognizer', 
    'HandRecognizer',
    'EmotionTracker',
    'ViewerReactionProfile',
    'ViewerEmotionFrame',
    'SpeechAnalyzer',
    'SpeechClip',
    'SpeechAnalysisResult'
] 