"""
Neuro-Saliency Engine
Simulates human visual attention using contrast, motion, and face detection.
"""

import cv2
import numpy as np
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

class SaliencyEngine:
    """
    Generates a saliency map predicting where viewers will look.
    """
    
    def __init__(self):
        # Load face cascade for face bias
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def generate_heatmap(self, frame: np.ndarray, prev_frame: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Generate a saliency heatmap for a single frame.
        
        Args:
            frame: Current video frame (BGR)
            prev_frame: Previous frame for motion detection (optional)
            
        Returns:
            Heatmap (0-255) single channel image
        """
        if frame is None:
            return None
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        
        # 1. Contrast Map (Itti-Koch inspired approximation)
        # High frequency content attracts attention
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        contrast_map = cv2.absdiff(gray, blur)
        contrast_map = cv2.normalize(contrast_map, None, 0, 255, cv2.NORM_MINMAX)
        
        # 2. Motion Map
        motion_map = np.zeros_like(gray)
        if prev_frame is not None:
            prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
            diff = cv2.absdiff(gray, prev_gray)
            motion_map = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)[1]
            motion_map = cv2.GaussianBlur(motion_map, (21, 21), 0)
        
        # 3. Face Map (Center bias + Face bias)
        face_map = np.zeros_like(gray)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
        for (x, y, w, h) in faces:
            # Create a gaussian blob at face location
            center_x, center_y = x + w//2, y + h//2
            cv2.circle(face_map, (center_x, center_y), int(w*1.5), 255, -1)
        face_map = cv2.GaussianBlur(face_map, (51, 51), 0)
        
        # Combine maps (Weights: Motion > Face > Contrast)
        # Motion is the strongest attractor in video
        combined = (0.2 * contrast_map) + (0.5 * motion_map) + (0.3 * face_map)
        combined = cv2.normalize(combined, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        
        # Apply colormap for visualization
        heatmap_color = cv2.applyColorMap(combined, cv2.COLORMAP_JET)
        
        # Blend with original frame for visualization
        blended = cv2.addWeighted(frame, 0.6, heatmap_color, 0.4, 0)
        
        return blended

    def analyze_attention(self, frame: np.ndarray, bbox: Tuple[int, int, int, int]) -> str:
        """
        Check if a specific region (e.g., legal text) is in a high-attention zone.
        
        Args:
            frame: The video frame
            bbox: [ymin, xmin, ymax, xmax] normalized (0-1000)
            
        Returns:
            "Hot", "Warm", or "Cold"
        """
        # Generate raw saliency map (grayscale)
        heatmap = self.generate_heatmap(frame)
        gray_heat = cv2.cvtColor(heatmap, cv2.COLOR_BGR2GRAY)
        
        h, w = gray_heat.shape
        ymin, xmin, ymax, xmax = bbox
        
        # Convert normalized coords to pixels
        py_min = int((ymin / 1000) * h)
        py_max = int((ymax / 1000) * h)
        px_min = int((xmin / 1000) * w)
        px_max = int((xmax / 1000) * w)
        
        # Extract ROI
        roi = gray_heat[py_min:py_max, px_min:px_max]
        
        if roi.size == 0:
            return "Unknown"
            
        avg_heat = np.mean(roi)
        
        if avg_heat > 150:
            return "Hot (High Attention)"
        elif avg_heat > 80:
            return "Warm (Medium Attention)"
        else:
            return "Cold (Low Attention - Risk of Missed Info)"
