"""
Pulse Estimator (rPPG)
Estimates heart rate by analyzing subtle color changes in the forehead.
"""

import numpy as np
import cv2
import time
from typing import Dict, List

class PulseEstimator:
    """
    Remote Photoplethysmography (rPPG) implementation.
    """
    
    def __init__(self):
        self.buffer_size = 150  # Number of frames to analyze (approx 5 sec at 30fps)
        self.values = []
        self.times = []
        self.fps_buffer = []
        self.last_bpm = 0.0
        self.min_face_size = 100
        
    def process(self, frame, landmarks) -> Dict:
        """
        Process frame to estimate pulse.
        """
        if frame is None or not landmarks:
            return {"heart_rate_bpm": self.last_bpm, "signal_quality": "None"}
            
        # 1. Extract ROI (Forehead)
        # Landmarks: 10 (top center), 338 (right), 109 (left), 69 (bottom center approx)
        h, w, _ = frame.shape
        points = np.array([[lm.x * w, lm.y * h] for lm in landmarks.landmark])
        
        # Define a forehead rectangle
        # Center of forehead is roughly between eyebrows and hairline
        # We'll use a safe region above the eyebrows
        
        # Approx forehead center
        forehead_x = int(points[10][0])
        forehead_y = int((points[10][1] + points[151][1]) / 2) # Between top and eyebrows
        
        # ROI size (adaptive)
        face_width = np.linalg.norm(points[234] - points[454]) # Ear to ear
        if face_width < self.min_face_size:
             return {"heart_rate_bpm": self.last_bpm, "signal_quality": "Low (Face too small)"}
             
        roi_w = int(face_width * 0.2)
        roi_h = int(face_width * 0.1)
        
        x1 = max(0, forehead_x - roi_w // 2)
        y1 = max(0, forehead_y - roi_h // 2)
        x2 = min(w, x1 + roi_w)
        y2 = min(h, y1 + roi_h)
        
        if x2 <= x1 or y2 <= y1:
            return {"heart_rate_bpm": self.last_bpm, "signal_quality": "Error"}
            
        roi = frame[y1:y2, x1:x2]
        
        # 2. Get Green Channel Mean
        # Green light is absorbed by hemoglobin, so it contains the strongest PPG signal
        g_mean = np.mean(roi[:, :, 1])
        
        # 3. Add to buffer
        current_time = time.time()
        self.values.append(g_mean)
        self.times.append(current_time)
        
        # Maintain buffer size
        if len(self.values) > self.buffer_size:
            self.values.pop(0)
            self.times.pop(0)
            
        # 4. Calculate FPS
        if len(self.times) > 1:
            duration = self.times[-1] - self.times[0]
            if duration > 0.5:
                fps = len(self.times) / duration
            else:
                fps = 30.0
        else:
            fps = 30.0
            
        # 5. Signal Processing (FFT)
        # Need at least 3 seconds of data
        if len(self.values) > fps * 3:
            try:
                # Detrending (remove slow changes like lighting)
                # Simple approach: subtract moving average
                signal = np.array(self.values)
                # Normalize
                signal = (signal - np.mean(signal)) / np.std(signal)
                
                # FFT
                fft = np.fft.rfft(signal)
                freqs = np.fft.rfftfreq(len(signal), 1.0/fps)
                
                # Filter frequencies (Human HR range: 40-180 BPM -> 0.66 - 3.0 Hz)
                mask = (freqs > 0.66) & (freqs < 3.0)
                
                valid_fft = np.abs(fft)[mask]
                valid_freqs = freqs[mask]
                
                if len(valid_fft) > 0:
                    peak_idx = np.argmax(valid_fft)
                    peak_freq = valid_freqs[peak_idx]
                    bpm = peak_freq * 60.0
                    
                    # Smoothing
                    alpha = 0.1
                    self.last_bpm = (alpha * bpm) + ((1 - alpha) * self.last_bpm)
            except Exception:
                pass
                
        return {
            "heart_rate_bpm": round(self.last_bpm, 1),
            "signal_quality": "Good" if len(self.values) > 30 else "Calibrating"
        }
