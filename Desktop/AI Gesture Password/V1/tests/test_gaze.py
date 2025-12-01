import unittest
import numpy as np
from unittest.mock import MagicMock
from src.app.features.analytics.gaze_tracker import GazeTracker

class TestGazeTracker(unittest.TestCase):
    def setUp(self):
        self.tracker = GazeTracker()
        self.frame_shape = (480, 640) # H, W

    def create_mock_landmarks(self, left_iris_x, left_iris_y, right_iris_x, right_iris_y):
        # Create a mock landmarks object structure
        landmarks = MagicMock()
        landmark_list = []
        
        # We need to populate specific indices used by GazeTracker
        # LEFT_IRIS = [468, 469, 470, 471, 472]
        # LEFT_EYE_CORNERS = [33, 133]
        # RIGHT_IRIS = [473, 474, 475, 476, 477]
        # RIGHT_EYE_CORNERS = [362, 263]
        
        # Initialize all with 0
        for _ in range(500):
            lm = MagicMock()
            lm.x = 0.5
            lm.y = 0.5
            landmark_list.append(lm)
            
        # Set specific values
        # Left Eye (Indices 33, 133) - Let's say eye is at x=0.3, width=0.1
        landmark_list[33].x = 0.25
        landmark_list[33].y = 0.4
        landmark_list[133].x = 0.35
        landmark_list[133].y = 0.4
        
        # Right Eye (Indices 362, 263) - Let's say eye is at x=0.7, width=0.1
        landmark_list[362].x = 0.65
        landmark_list[362].y = 0.4
        landmark_list[263].x = 0.75
        landmark_list[263].y = 0.4
        
        # Set Iris positions (Indices 468 and 473 are centers)
        landmark_list[468].x = left_iris_x
        landmark_list[468].y = left_iris_y
        
        landmark_list[473].x = right_iris_x
        landmark_list[473].y = right_iris_y
        
        landmarks.landmark = landmark_list
        return landmarks

    def test_center_gaze(self):
        # Iris in center of eyes
        # Left eye center: 0.3
        # Right eye center: 0.7
        landmarks = self.create_mock_landmarks(0.3, 0.4, 0.7, 0.4)
        result = self.tracker.process(landmarks, self.frame_shape)
        
        self.assertEqual(result['gaze_direction'], "Center")
        self.assertAlmostEqual(result['horizontal_ratio'], 0.5, delta=0.1)

    def test_look_left(self):
        # Looking left (user's left, screen right) -> Iris moves to outer corner of left eye, inner corner of right eye
        # Actually, "Left" usually means user looking to their left (screen right)
        # Let's check the logic: 
        # avg_dx > 0.65 -> "Left"
        
        # Move iris to the right side of the eye (relative to eye corners)
        # Left eye: 0.25 to 0.35. Center 0.3. Right side > 0.3
        # Right eye: 0.65 to 0.75. Center 0.7. Right side > 0.7
        
        landmarks = self.create_mock_landmarks(0.34, 0.4, 0.74, 0.4)
        result = self.tracker.process(landmarks, self.frame_shape)
        
        self.assertEqual(result['gaze_direction'], "Left")
        
    def test_look_right(self):
        # Looking right -> avg_dx < 0.35
        # Move iris to left side of eye
        
        landmarks = self.create_mock_landmarks(0.26, 0.4, 0.66, 0.4)
        result = self.tracker.process(landmarks, self.frame_shape)
        
        self.assertEqual(result['gaze_direction'], "Right")

    def test_no_landmarks(self):
        result = self.tracker.process(None, self.frame_shape)
        self.assertEqual(result['gaze_direction'], "Unknown")

if __name__ == '__main__':
    unittest.main()
