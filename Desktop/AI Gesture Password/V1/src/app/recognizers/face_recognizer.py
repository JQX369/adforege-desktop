# FILE: app/recognizers/face_recognizer.py
"""Facial expression recognition using MediaPipe."""

import logging
import time
from typing import Optional, Tuple
import numpy as np
import mediapipe as mp
from app.config import MIN_DETECTION_CONFIDENCE, MIN_TRACKING_CONFIDENCE, MIN_Z_DEPTH_CHANGE_MM

logger = logging.getLogger(__name__)


class FaceRecognizer:
    """Recognizes facial expressions using MediaPipe Face Mesh."""
    
    def __init__(self):
        """Initialize MediaPipe Face Mesh."""
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=MIN_TRACKING_CONFIDENCE
        )
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        # For liveness detection
        self.prev_nose_z = None
        self.max_z_change = 0.0
        self.last_face_time = time.time()
        
        # Key landmark indices
        self.LEFT_EYE_OUTER = 33
        self.LEFT_EYE_INNER = 133
        self.RIGHT_EYE_OUTER = 362
        self.RIGHT_EYE_INNER = 263
        self.MOUTH_LEFT = 61
        self.MOUTH_RIGHT = 291
        self.MOUTH_TOP = 13
        self.MOUTH_BOTTOM = 14
        self.LEFT_EYEBROW = 70
        self.RIGHT_EYEBROW = 300
        self.NOSE_TIP = 1
        
    def recognize(self, frame: np.ndarray) -> Tuple[Optional[str], bool]:
        """
        Recognize facial expression in the given frame.
        
        Args:
            frame: BGR image from OpenCV
            
        Returns:
            Tuple of (detected expression name or None, liveness check passed)
        """
        # Convert BGR to RGB
        rgb_frame = frame[:, :, ::-1]
        results = self.face_mesh.process(rgb_frame)
        
        if not results.multi_face_landmarks:
            self.last_face_time = time.time()
            return None, False
            
        # Update face detection time
        self.last_face_time = time.time()
        
        # Get face landmarks
        face_landmarks = results.multi_face_landmarks[0]
        
        # Check liveness
        liveness_passed = self._check_liveness(face_landmarks.landmark)
        
        # Analyze landmarks to determine expression
        expression = self._classify_expression(face_landmarks.landmark)
        
        if expression:
            logger.debug(f"Detected facial expression: {expression}")
            
        return expression, liveness_passed
    
    def _check_liveness(self, landmarks: list) -> bool:
        """
        Perform basic liveness detection using Z-depth changes.
        
        This is a demo-level check only - production systems would need
        more sophisticated anti-spoofing measures.
        
        Args:
            landmarks: MediaPipe face landmarks
            
        Returns:
            True if liveness check passed
        """
        # Get nose tip Z coordinate (approximate depth)
        nose_z = landmarks[self.NOSE_TIP].z
        
        if self.prev_nose_z is not None:
            # Calculate Z change in approximate mm (assuming typical face width ~140mm)
            z_change_mm = abs(nose_z - self.prev_nose_z) * 140
            self.max_z_change = max(self.max_z_change, z_change_mm)
            
        self.prev_nose_z = nose_z
        
        # Check if we've seen enough Z movement
        return self.max_z_change >= MIN_Z_DEPTH_CHANGE_MM
    
    def _classify_expression(self, landmarks: list) -> Optional[str]:
        """
        Classify facial expression based on landmarks.
        
        Args:
            landmarks: MediaPipe face landmarks
            
        Returns:
            Expression name or None
        """
        # Calculate key distances and ratios
        mouth_width = self._calculate_distance(landmarks, self.MOUTH_LEFT, self.MOUTH_RIGHT)
        mouth_height = self._calculate_distance(landmarks, self.MOUTH_TOP, self.MOUTH_BOTTOM)
        
        left_eyebrow_height = landmarks[self.LEFT_EYEBROW].y
        right_eyebrow_height = landmarks[self.RIGHT_EYEBROW].y
        left_eye_y = landmarks[self.LEFT_EYE_INNER].y
        right_eye_y = landmarks[self.RIGHT_EYE_INNER].y
        
        # Normalized eyebrow raise (relative to eye position)
        left_eyebrow_raise = left_eye_y - left_eyebrow_height
        right_eyebrow_raise = right_eye_y - right_eyebrow_height
        avg_eyebrow_raise = (left_eyebrow_raise + right_eyebrow_raise) / 2
        
        # Mouth aspect ratio
        mouth_ratio = mouth_height / mouth_width if mouth_width > 0 else 0
        
        # Classify expressions
        if self._is_smile(mouth_ratio, landmarks):
            return "SMILE"
        elif self._is_raised_eyebrows(avg_eyebrow_raise):
            return "RAISE_EYEBROWS"
        else:
            return "NEUTRAL"
    
    def _is_smile(self, mouth_ratio: float, landmarks: list) -> bool:
        """Check if face is smiling."""
        # Smile detection: mouth wider and corners raised
        mouth_left_y = landmarks[self.MOUTH_LEFT].y
        mouth_right_y = landmarks[self.MOUTH_RIGHT].y
        mouth_center_y = landmarks[self.MOUTH_BOTTOM].y
        
        # Mouth corners should be higher than center
        corners_raised = (mouth_left_y < mouth_center_y and 
                         mouth_right_y < mouth_center_y)
        
        # Mouth should be relatively wide
        wide_mouth = mouth_ratio < 0.5
        
        return corners_raised and wide_mouth
    
    def _is_raised_eyebrows(self, avg_eyebrow_raise: float) -> bool:
        """Check if eyebrows are raised."""
        # Threshold for raised eyebrows (normalized units)
        return avg_eyebrow_raise > 0.03
    
    def _calculate_distance(self, landmarks: list, idx1: int, idx2: int) -> float:
        """Calculate Euclidean distance between two landmarks."""
        p1 = landmarks[idx1]
        p2 = landmarks[idx2]
        return np.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)
    
    def get_face_detection_status(self) -> bool:
        """Check if face has been detected recently."""
        return (time.time() - self.last_face_time) < 1.0
    
    def reset_liveness(self):
        """Reset liveness detection state."""
        self.prev_nose_z = None
        self.max_z_change = 0.0
    
    def draw_landmarks(self, frame: np.ndarray, results) -> None:
        """Draw face mesh landmarks on the frame."""
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                self.mp_drawing.draw_landmarks(
                    image=frame,
                    landmark_list=face_landmarks,
                    connections=self.mp_face_mesh.FACEMESH_TESSELATION,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=self.mp_drawing_styles
                    .get_default_face_mesh_tesselation_style()
                )
    
    def close(self):
        """Release resources."""
        self.face_mesh.close() 