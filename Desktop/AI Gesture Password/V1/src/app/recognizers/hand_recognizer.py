# FILE: app/recognizers/hand_recognizer.py
"""Hand gesture recognition using MediaPipe."""

import logging
from typing import Optional, List, Tuple
import numpy as np
import mediapipe as mp
from app.config import MIN_DETECTION_CONFIDENCE, MIN_TRACKING_CONFIDENCE

logger = logging.getLogger(__name__)


class HandRecognizer:
    """Recognizes hand gestures using MediaPipe Hands."""
    
    def __init__(self):
        """Initialize MediaPipe Hands."""
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=MIN_TRACKING_CONFIDENCE
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
    def recognize(self, frame: np.ndarray) -> Optional[str]:
        """
        Recognize hand gesture in the given frame.
        
        Args:
            frame: BGR image from OpenCV
            
        Returns:
            Detected gesture name or None
        """
        # Convert BGR to RGB
        rgb_frame = frame[:, :, ::-1]
        results = self.hands.process(rgb_frame)
        
        if not results.multi_hand_landmarks:
            return None
            
        # Get first hand landmarks
        hand_landmarks = results.multi_hand_landmarks[0]
        
        # Analyze landmarks to determine gesture
        gesture = self._classify_gesture(hand_landmarks.landmark)
        
        if gesture:
            logger.debug(f"Detected hand gesture: {gesture}")
            
        return gesture
    
    def _classify_gesture(self, landmarks: List) -> Optional[str]:
        """
        Classify hand gesture based on landmarks.
        
        Args:
            landmarks: MediaPipe hand landmarks
            
        Returns:
            Gesture name or None
        """
        # Convert landmarks to numpy array for easier manipulation
        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks])
        
        # Check for specific gestures
        if self._is_thumbs_up(points):
            return "THUMBS_UP"
        elif self._is_victory(points):
            return "VICTORY"
        elif self._is_open_palm(points):
            return "OPEN_PALM"
        elif self._is_ok_sign(points):
            return "OK_SIGN"
        elif self._is_fist(points):
            return "FIST"
            
        return None
    
    def _is_thumbs_up(self, points: np.ndarray) -> bool:
        """Check if hand is showing thumbs up."""
        # Thumb tip (4) is higher than thumb IP (3) and all other fingertips are below MCP joints
        thumb_up = points[4][1] < points[3][1]
        
        # Check other fingers are folded
        index_folded = points[8][1] > points[6][1]
        middle_folded = points[12][1] > points[10][1]
        ring_folded = points[16][1] > points[14][1]
        pinky_folded = points[20][1] > points[18][1]
        
        return thumb_up and index_folded and middle_folded and ring_folded and pinky_folded
    
    def _is_victory(self, points: np.ndarray) -> bool:
        """Check if hand is showing victory/peace sign."""
        # Index and middle fingers extended, others folded
        index_extended = points[8][1] < points[6][1]
        middle_extended = points[12][1] < points[10][1]
        
        ring_folded = points[16][1] > points[14][1]
        pinky_folded = points[20][1] > points[18][1]
        
        # Thumb should be somewhat folded
        thumb_folded = abs(points[4][0] - points[3][0]) < 0.1
        
        return index_extended and middle_extended and ring_folded and pinky_folded and thumb_folded
    
    def _is_open_palm(self, points: np.ndarray) -> bool:
        """Check if hand is showing open palm (all fingers extended)."""
        # All fingertips should be higher than their PIP joints
        thumb_extended = points[4][1] < points[3][1]
        index_extended = points[8][1] < points[6][1]
        middle_extended = points[12][1] < points[10][1]
        ring_extended = points[16][1] < points[14][1]
        pinky_extended = points[20][1] < points[18][1]
        
        return thumb_extended and index_extended and middle_extended and ring_extended and pinky_extended
    
    def _is_ok_sign(self, points: np.ndarray) -> bool:
        """Check if hand is showing OK sign."""
        # Thumb tip and index tip should be close together
        thumb_index_dist = np.linalg.norm(points[4] - points[8])
        
        # Other fingers should be extended
        middle_extended = points[12][1] < points[10][1]
        ring_extended = points[16][1] < points[14][1]
        pinky_extended = points[20][1] < points[18][1]
        
        return thumb_index_dist < 0.05 and middle_extended and ring_extended and pinky_extended
    
    def _is_fist(self, points: np.ndarray) -> bool:
        """Check if hand is showing a fist."""
        # All fingertips should be below their MCP joints
        index_folded = points[8][1] > points[5][1]
        middle_folded = points[12][1] > points[9][1]
        ring_folded = points[16][1] > points[13][1]
        pinky_folded = points[20][1] > points[17][1]
        
        # Thumb should be folded across fingers
        thumb_folded = points[4][0] > points[5][0] and points[4][0] < points[17][0]
        
        return index_folded and middle_folded and ring_folded and pinky_folded and thumb_folded
    
    def draw_landmarks(self, frame: np.ndarray, results) -> None:
        """Draw hand landmarks on the frame."""
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                self.mp_drawing.draw_landmarks(
                    frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS
                )
    
    def close(self):
        """Release resources."""
        self.hands.close() 