import unittest
import numpy as np
from unittest.mock import MagicMock
from src.app.features.analytics.blink_detector import BlinkDetector

class TestBlinkDetector(unittest.TestCase):
    def setUp(self):
        self.detector = BlinkDetector()
        self.frame_shape = (480, 640)

    def create_mock_landmarks(self, eye_openness=0.3):
        # Create landmarks with adjustable eye openness
        landmarks = MagicMock()
        landmark_list = []
        
        # Initialize
        for _ in range(500):
            lm = MagicMock()
            lm.x = 0.5
            lm.y = 0.5
            landmark_list.append(lm)
            
        # Left Eye Indices: 362, 385, 387, 263, 373, 380
        # Horizontal: 362, 263
        # Vertical: (385, 373) and (387, 380)
        
        # Set horizontal width to 0.1
        landmark_list[362].x = 0.2
        landmark_list[263].x = 0.3
        
        # Set vertical height based on openness
        # Center y = 0.4
        height = 0.1 * eye_openness # EAR approx equal to openness if width is constant
        
        # Set x for vertical points to be in the middle (0.25)
        mid_x = 0.25
        landmark_list[385].x = mid_x
        landmark_list[373].x = mid_x
        landmark_list[387].x = mid_x
        landmark_list[380].x = mid_x
        
        landmark_list[385].y = 0.4 - height/2
        landmark_list[373].y = 0.4 + height/2
        
        landmark_list[387].y = 0.4 - height/2
        landmark_list[380].y = 0.4 + height/2
        
        # Right Eye (Similar logic)
        landmark_list[33].x = 0.7
        landmark_list[133].x = 0.8
        mid_x_right = 0.75
        
        landmark_list[160].x = mid_x_right
        landmark_list[144].x = mid_x_right
        landmark_list[158].x = mid_x_right
        landmark_list[153].x = mid_x_right
        
        landmark_list[160].y = 0.4 - height/2
        landmark_list[144].y = 0.4 + height/2
        
        landmark_list[158].y = 0.4 - height/2
        landmark_list[153].y = 0.4 + height/2
        
        landmarks.landmark = landmark_list
        return landmarks

    def test_open_eyes(self):
        # Openness 0.4 -> EAR approx 0.4 -> > 0.25 threshold
        landmarks = self.create_mock_landmarks(eye_openness=0.4)
        result = self.detector.process(landmarks, self.frame_shape)
        
        self.assertFalse(result['blink_detected'])
        self.assertGreater(result['ear'], 0.25)

    def test_blink_detection(self):
        # Closed eyes -> Openness 0.1 -> EAR approx 0.1 -> < 0.25
        landmarks = self.create_mock_landmarks(eye_openness=0.1)
        
        # Need consecutive frames
        # Frame 1
        self.detector.process(landmarks, self.frame_shape)
        # Frame 2
        result = self.detector.process(landmarks, self.frame_shape)
        print(f"DEBUG: EAR={result['ear']}, Blink={result['blink_detected']}")
        
        self.assertTrue(result['blink_detected'])

if __name__ == '__main__':
    unittest.main()
