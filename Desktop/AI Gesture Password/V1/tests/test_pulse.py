import unittest
import numpy as np
from unittest.mock import MagicMock
from src.app.features.analytics.pulse_estimator import PulseEstimator

class TestPulseEstimator(unittest.TestCase):
    def setUp(self):
        self.estimator = PulseEstimator()
        
    def create_mock_frame(self, green_intensity):
        # Create a frame with specific green channel intensity
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame[:, :, 1] = green_intensity # Set green channel
        return frame
        
    def create_mock_landmarks(self):
        landmarks = MagicMock()
        landmark_list = []
        for _ in range(500):
            lm = MagicMock()
            lm.x = 0.5
            lm.y = 0.5
            landmark_list.append(lm)
            
        # Set face width landmarks (234 and 454)
        # Ear to ear distance needs to be > min_face_size (100px)
        # Frame width is 640. 0.4 * 640 = 256px > 100px
        landmark_list[234].x = 0.3
        landmark_list[454].x = 0.7
        
        # Set forehead landmarks (10, 151)
        landmark_list[10].y = 0.2
        landmark_list[151].y = 0.25
        
        landmarks.landmark = landmark_list
        return landmarks

    def test_buffer_filling(self):
        frame = self.create_mock_frame(100)
        landmarks = self.create_mock_landmarks()
        
        self.estimator.process(frame, landmarks)
        self.assertEqual(len(self.estimator.values), 1)
        
    def test_pulse_calculation(self):
        # Simulate a sine wave signal (heartbeat)
        # 60 BPM = 1 Hz
        # FPS = 30
        landmarks = self.create_mock_landmarks()
        
        # Generate 6 seconds of data (180 frames) to fill buffer (150) and stabilize
        for i in range(180):
            t = i / 30.0
            # Signal: Base 100 + Amplitude 10 * sin(2*pi*1.0*t)
            val = 100 + 10 * np.sin(2 * np.pi * 1.0 * t)
            frame = self.create_mock_frame(int(val))
            
            result = self.estimator.process(frame, landmarks)
            
        print(f"DEBUG: BPM={result['heart_rate_bpm']}")
        self.assertTrue(50 < result['heart_rate_bpm'] < 70)

if __name__ == '__main__':
    unittest.main()
