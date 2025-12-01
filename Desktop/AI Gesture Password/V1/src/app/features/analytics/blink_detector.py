"""
Blink Detector
Detects blinks using Eye Aspect Ratio (EAR) to estimate fatigue.
"""

import numpy as np
import time
from typing import Dict, List

class BlinkDetector:
    """
    Detects blinks and calculates blink rate (BPM).
    """
    
    def __init__(self):
        # EAR Thresholds
        self.EYE_AR_THRESH = 0.25  # Below this is a blink
        self.EYE_AR_CONSEC_FRAMES = 2  # Minimum frames for a blink
        
        # State
        self.counter = 0
        self.total_blinks = 0
        self.start_time = time.time()
        self.blink_times = []  # Timestamps of recent blinks
        
    def process(self, landmarks, frame_shape) -> Dict:
        """
        Process landmarks to detect blinks.
        """
        if not landmarks:
            return {
                "blink_detected": False,
                "blink_rate_bpm": 0.0,
                "fatigue_level": "Unknown"
            }
            
        # Landmark indices (MediaPipe Face Mesh)
        # Left Eye
        LEFT_EYE = [362, 385, 387, 263, 373, 380]
        # Right Eye
        RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        
        h, w = frame_shape
        points = np.array([[lm.x * w, lm.y * h] for lm in landmarks.landmark])
        
        leftEAR = self._eye_aspect_ratio(points, LEFT_EYE)
        rightEAR = self._eye_aspect_ratio(points, RIGHT_EYE)
        
        avgEAR = (leftEAR + rightEAR) / 2.0
        
        blink_detected = False
        
        # Blink detection logic
        if avgEAR < self.EYE_AR_THRESH:
            self.counter += 1
            if self.counter == self.EYE_AR_CONSEC_FRAMES:
                self.total_blinks += 1
                self.blink_times.append(time.time())
                blink_detected = True
        else:
            self.counter = 0
            
        # Calculate Blink Rate (BPM)
        # Only consider blinks in the last 60 seconds
        current_time = time.time()
        self.blink_times = [t for t in self.blink_times if current_time - t <= 60.0]
        bpm = len(self.blink_times)
        
        # Estimate Fatigue
        # Normal blink rate is 10-20 BPM. 
        # Low (<10) = High Visual Attention (or staring)
        # High (>20) = Fatigue / Stress / Dry Eyes
        fatigue_level = "Normal"
        if bpm > 30:
            fatigue_level = "High (Fatigue/Stress)"
        elif bpm < 5:
            fatigue_level = "Low (Intense Focus)"
            
        return {
            "blink_detected": blink_detected,
            "blink_rate_bpm": float(bpm),
            "fatigue_level": fatigue_level,
            "ear": float(avgEAR)
        }
        
    def _eye_aspect_ratio(self, points, eye_indices):
        """
        Compute the Eye Aspect Ratio (EAR).
        """
        # Vertical landmarks
        A = np.linalg.norm(points[eye_indices[1]] - points[eye_indices[5]])
        B = np.linalg.norm(points[eye_indices[2]] - points[eye_indices[4]])
        
        # Horizontal landmarks
        C = np.linalg.norm(points[eye_indices[0]] - points[eye_indices[3]])
        
        if C == 0:
            return 0.0
            
        ear = (A + B) / (2.0 * C)
        return ear
