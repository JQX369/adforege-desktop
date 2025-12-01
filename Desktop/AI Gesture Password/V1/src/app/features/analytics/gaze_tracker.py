"""
Gaze Tracker
Estimates gaze direction using MediaPipe Iris landmarks.
"""

import numpy as np
import cv2
from typing import Tuple, Dict, Optional

class GazeTracker:
    """
    Tracks eye gaze direction to estimate visual attention.
    """
    
    def __init__(self):
        # Calibration data could be stored here
        self.calibration_center = None
        
    def process(self, landmarks, frame_shape: Tuple[int, int]) -> Dict:
        """
        Process facial landmarks to determine gaze direction.
        
        Args:
            landmarks: MediaPipe face landmarks
            frame_shape: (height, width) of the frame
            
        Returns:
            Dict containing gaze metrics
        """
        if not landmarks:
            return {
                "gaze_direction": "Unknown",
                "attention_score": 0.0,
                "horizontal_ratio": 0.5,
                "vertical_ratio": 0.5
            }
            
        # Landmark indices for eyes (MediaPipe Face Mesh)
        # Left Eye
        LEFT_IRIS = [468, 469, 470, 471, 472]
        LEFT_EYE_CORNERS = [33, 133]  # Inner, Outer
        
        # Right Eye
        RIGHT_IRIS = [473, 474, 475, 476, 477]
        RIGHT_EYE_CORNERS = [362, 263] # Inner, Outer
        
        h, w = frame_shape
        points = np.array([[lm.x * w, lm.y * h] for lm in landmarks.landmark])
        
        # Calculate gaze for each eye
        left_gaze = self._get_eye_gaze(points, LEFT_IRIS, LEFT_EYE_CORNERS)
        right_gaze = self._get_eye_gaze(points, RIGHT_IRIS, RIGHT_EYE_CORNERS)
        
        # Average the ratios
        avg_dx = (left_gaze[0] + right_gaze[0]) / 2
        avg_dy = (left_gaze[1] + right_gaze[1]) / 2
        
        # Determine direction
        direction = "Center"
        attention_score = 1.0
        
        # Horizontal thresholds
        if avg_dx < 0.35:
            direction = "Right" # Mirrored
            attention_score = 0.5
        elif avg_dx > 0.65:
            direction = "Left" # Mirrored
            attention_score = 0.5
            
        # Vertical thresholds
        if avg_dy < 0.35:
            direction = "Up"
            attention_score = 0.3
        elif avg_dy > 0.65:
            direction = "Down"
            attention_score = 0.3
            
        return {
            "gaze_direction": direction,
            "attention_score": attention_score,
            "horizontal_ratio": avg_dx,
            "vertical_ratio": avg_dy
        }
        
    def _get_eye_gaze(self, points: np.ndarray, iris_indices: list, corner_indices: list) -> Tuple[float, float]:
        """
        Calculate the relative position of the iris within the eye.
        Returns (dx, dy) ratios where 0.5 is center.
        """
        # Iris center
        iris_center = points[iris_indices[0]]
        
        # Eye corners
        inner = points[corner_indices[0]]
        outer = points[corner_indices[1]]
        
        # Eye width
        eye_width = np.linalg.norm(outer - inner)
        if eye_width == 0:
            return 0.5, 0.5
            
        # Project iris center onto the line connecting corners (simplified)
        # We calculate the ratio of distance from inner corner to total width
        # Note: This is a 2D approximation
        
        # Horizontal ratio
        # Vector from inner to outer
        eye_vec = outer - inner
        # Vector from inner to iris
        iris_vec = iris_center - inner
        
        # Project iris_vec onto eye_vec
        projection = np.dot(iris_vec, eye_vec) / np.dot(eye_vec, eye_vec)
        dx = projection
        
        # Vertical ratio (simplified)
        # We can use the perpendicular distance or just relative height
        # For now, let's assume the eye is roughly horizontal and use Y coords
        # A better approach uses the eyelids, but corners are more stable
        eye_center_y = (inner[1] + outer[1]) / 2
        # Normalize by some estimated eye height (e.g., 1/3 of width)
        estimated_height = eye_width / 3
        dy = 0.5 + (iris_center[1] - eye_center_y) / estimated_height
        
        return dx, dy
