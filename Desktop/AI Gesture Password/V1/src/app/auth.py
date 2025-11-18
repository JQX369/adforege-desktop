# FILE: app/auth.py
"""Authentication module for gesture/expression password capture and verification."""

import logging
import time
import winsound
from typing import List, Optional, Tuple
import cv2
import numpy as np
from app.recognizers.hand_recognizer import HandRecognizer
from app.recognizers.face_recognizer import FaceRecognizer
from app.storage import ProfileStorage
from app.config import (
    MAX_TOKEN_GAP_SECONDS, MIN_PASSWORD_LENGTH, 
    GESTURE_HOLD_TIME, EXPRESSION_HOLD_TIME
)

logger = logging.getLogger(__name__)


class AuthenticationManager:
    """Manages authentication flows for enrollment and verification."""
    
    def __init__(self):
        """Initialize authentication components."""
        self.hand_recognizer = HandRecognizer()
        self.face_recognizer = FaceRecognizer()
        self.storage = ProfileStorage()
        
        # State tracking
        self.is_recording = False
        self.captured_tokens: List[str] = []
        self.last_token_time = 0.0
        self.current_token = None
        self.current_token_start_time = 0.0
        
        # For visual feedback
        self.last_recognized_token = None
        self.last_recognized_time = 0.0
        
        # Hold progress tracking
        self.hold_progress = 0.0  # 0.0 to 1.0
        self.detection_confidence = 0.0
        self.detection_points = []  # Landmark points for visualization
        self.is_hand_detection = False
        
    def start_capture(self) -> None:
        """Start capturing gesture/expression sequence."""
        self.is_recording = True
        self.captured_tokens = []
        self.last_token_time = time.time()
        self.current_token = None
        self.face_recognizer.reset_liveness()
        logger.info("Started gesture/expression capture")
    
    def stop_capture(self) -> List[str]:
        """
        Stop capturing and return captured tokens.
        
        Returns:
            List of captured tokens
        """
        self.is_recording = False
        logger.info(f"Stopped capture with {len(self.captured_tokens)} tokens")
        return self.captured_tokens
    
    def process_frame(self, frame: np.ndarray) -> Tuple[Optional[str], bool, bool]:
        """
        Process a single frame for gesture/expression recognition.
        
        Args:
            frame: BGR image from webcam
            
        Returns:
            Tuple of (detected token or None, liveness passed, token added to sequence)
        """
        if not self.is_recording:
            self.hold_progress = 0.0
            self.detection_points = []
            return None, False, False
        
        # Check for timeout between tokens
        current_time = time.time()
        if (self.captured_tokens and 
            current_time - self.last_token_time > MAX_TOKEN_GAP_SECONDS):
            logger.warning("Token gap timeout exceeded")
            self.stop_capture()
            return None, False, False
        
        # Try hand gesture recognition
        hand_gesture = self.hand_recognizer.recognize(frame)
        
        # Try face expression recognition
        face_expression, liveness_passed = self.face_recognizer.recognize(frame)
        
        # Get detection points and confidence for visualization
        self.detection_points = []
        self.detection_confidence = 0.0
        self.is_hand_detection = False
        
        if hand_gesture:
            self.is_hand_detection = True
            self.detection_points = self.get_hand_landmarks(frame)
            self.detection_confidence = 0.85  # Simulated confidence
        elif face_expression:
            self.is_hand_detection = False
            self.detection_points = self.get_face_landmarks(frame)
            self.detection_confidence = 0.80  # Simulated confidence
        
        # Determine which token to use (hand gestures take priority)
        detected_token = hand_gesture or face_expression
        
        # Track token consistency over time
        token_added = False
        if detected_token:
            if detected_token == self.current_token:
                # Continue tracking same token
                hold_time = (GESTURE_HOLD_TIME if detected_token in 
                           ["THUMBS_UP", "VICTORY", "OPEN_PALM", "OK_SIGN", "FIST"] 
                           else EXPRESSION_HOLD_TIME)
                
                # Calculate hold progress
                elapsed = current_time - self.current_token_start_time
                self.hold_progress = min(elapsed / hold_time, 1.0)
                
                if self.hold_progress >= 1.0:
                    # Token held long enough, add to sequence
                    if not self.captured_tokens or self.captured_tokens[-1] != detected_token:
                        self.captured_tokens.append(detected_token)
                        self.last_token_time = current_time
                        self.last_recognized_token = detected_token
                        self.last_recognized_time = current_time
                        token_added = True
                        logger.info(f"Added token: {detected_token}")
                        
                        # Play success beep
                        try:
                            winsound.Beep(1500, 200)  # Higher pitch for success
                        except:
                            pass
                        
                        # Reset progress
                        self.hold_progress = 0.0
            else:
                # New token detected
                self.current_token = detected_token
                self.current_token_start_time = current_time
                self.hold_progress = 0.0
                
                # Play detection beep
                try:
                    winsound.Beep(800, 50)  # Low pitch for detection
                except:
                    pass
        else:
            # No token detected
            self.current_token = None
            self.hold_progress = 0.0
            self.detection_points = []
        
        return detected_token, liveness_passed, token_added
    
    def create_user_profile(self, username: str) -> bool:
        """
        Create a new user profile with captured tokens.
        
        Args:
            username: Username for the profile
            
        Returns:
            True if created successfully
        """
        if len(self.captured_tokens) < MIN_PASSWORD_LENGTH:
            logger.error(f"Password too short: {len(self.captured_tokens)} tokens")
            return False
        
        return self.storage.create_profile(username, self.captured_tokens)
    
    def verify_user(self, username: str) -> bool:
        """
        Verify user with captured tokens.
        
        Args:
            username: Username to verify
            
        Returns:
            True if verification successful
        """
        if not self.face_recognizer.get_face_detection_status():
            logger.warning("No face detected during verification")
            return False
        
        return self.storage.verify_password(username, self.captured_tokens)
    
    def get_usernames(self) -> List[str]:
        """Get list of all registered usernames."""
        return self.storage.get_usernames()
    
    def get_visual_feedback(self) -> Optional[str]:
        """
        Get token to display for visual feedback.
        
        Returns:
            Token name if recently recognized, None otherwise
        """
        if (self.last_recognized_token and 
            time.time() - self.last_recognized_time < 1.0):
            return self.last_recognized_token
        return None
    
    def draw_overlay(self, frame: np.ndarray) -> np.ndarray:
        """
        Draw advanced overlay with detection visualization.
        
        Args:
            frame: BGR image to draw on
            
        Returns:
            Frame with overlay
        """
        overlay_frame = frame.copy()
        h, w = frame.shape[:2]
        
        # Draw detection points with cool effects
        if self.detection_points:
            # Draw connecting lines for hand landmarks
            if self.is_hand_detection and len(self.detection_points) == 21:
                # Hand connections
                connections = [
                    (0, 1), (1, 2), (2, 3), (3, 4),  # Thumb
                    (0, 5), (5, 6), (6, 7), (7, 8),  # Index
                    (5, 9), (9, 10), (10, 11), (11, 12),  # Middle
                    (9, 13), (13, 14), (14, 15), (15, 16),  # Ring
                    (13, 17), (17, 18), (18, 19), (19, 20),  # Pinky
                    (0, 17)  # Palm
                ]
                for conn in connections:
                    if conn[0] < len(self.detection_points) and conn[1] < len(self.detection_points):
                        pt1 = self.detection_points[conn[0]]
                        pt2 = self.detection_points[conn[1]]
                        # Gradient color based on hold progress
                        color = (int(255 * (1 - self.hold_progress)), 
                                int(255 * self.hold_progress), 
                                128)
                        cv2.line(overlay_frame, pt1, pt2, color, 2)
            
            # Draw landmark points
            for i, point in enumerate(self.detection_points):
                # Pulsing effect based on hold progress
                radius = int(3 + 3 * np.sin(self.hold_progress * np.pi))
                cv2.circle(overlay_frame, point, radius, (0, 255, 255), -1)
                cv2.circle(overlay_frame, point, radius + 2, (0, 150, 150), 1)
        
        # Draw hold progress indicator
        if self.current_token and self.hold_progress > 0:
            # Position for progress indicator
            cx, cy = w - 100, 100
            radius = 60
            
            # Background circle
            cv2.circle(overlay_frame, (cx, cy), radius, (50, 50, 50), -1)
            cv2.circle(overlay_frame, (cx, cy), radius, (100, 100, 100), 2)
            
            # Progress arc
            angle = int(360 * self.hold_progress)
            cv2.ellipse(overlay_frame, (cx, cy), (radius-5, radius-5), -90, 0, angle,
                       (0, 255, 0) if self.hold_progress < 0.5 else (0, 255, 255), 5)
            
            # Center text
            progress_text = f"{int(self.hold_progress * 100)}%"
            text_size = cv2.getTextSize(progress_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
            cv2.putText(overlay_frame, progress_text,
                       (cx - text_size[0]//2, cy + text_size[1]//2),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Token name
            cv2.putText(overlay_frame, self.current_token,
                       (cx - 80, cy + radius + 25),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            
            # Hold instruction
            cv2.putText(overlay_frame, "HOLD FOR 2s",
                       (cx - 50, cy - radius - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
        
        # Draw confidence meter
        if self.detection_confidence > 0:
            # Confidence bar position
            bar_x = 20
            bar_y = 100
            bar_width = 200
            bar_height = 20
            
            # Background
            cv2.rectangle(overlay_frame, (bar_x, bar_y), 
                         (bar_x + bar_width, bar_y + bar_height), (50, 50, 50), -1)
            
            # Confidence fill
            fill_width = int(bar_width * self.detection_confidence)
            color = (0, 255, 0) if self.detection_confidence > 0.7 else (0, 255, 255)
            cv2.rectangle(overlay_frame, (bar_x, bar_y),
                         (bar_x + fill_width, bar_y + bar_height), color, -1)
            
            # Border
            cv2.rectangle(overlay_frame, (bar_x, bar_y),
                         (bar_x + bar_width, bar_y + bar_height), (100, 100, 100), 2)
            
            # Label
            cv2.putText(overlay_frame, f"Confidence: {int(self.detection_confidence * 100)}%",
                       (bar_x, bar_y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Draw captured tokens with success animation
        feedback_token = self.get_visual_feedback()
        if feedback_token:
            # Success flash effect
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (w, h), (0, 255, 0), -1)
            cv2.addWeighted(overlay, 0.1, overlay_frame, 0.9, 0, overlay_frame)
            
            # Success message
            text = f"✓ {feedback_token} CAPTURED!"
            text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)[0]
            text_x = (w - text_size[0]) // 2
            text_y = h // 2
            
            # Text shadow
            cv2.putText(overlay_frame, text, (text_x + 2, text_y + 2),
                       cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 3)
            # Main text
            cv2.putText(overlay_frame, text, (text_x, text_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
        
        # Draw recording status
        if self.is_recording:
            # Recording indicator with pulsing effect
            pulse = int(127 + 127 * np.sin(time.time() * 3))
            cv2.circle(overlay_frame, (30, 30), 10, (0, 0, pulse), -1)
            cv2.putText(overlay_frame, "RECORDING", (50, 35),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            
            # Token counter
            token_text = f"Captured: {len(self.captured_tokens)} tokens"
            cv2.putText(overlay_frame, token_text, (20, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Instruction text
            if len(self.captured_tokens) < MIN_PASSWORD_LENGTH:
                remaining = MIN_PASSWORD_LENGTH - len(self.captured_tokens)
                inst_text = f"Need {remaining} more token(s)"
                cv2.putText(overlay_frame, inst_text, (20, 80),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
        
        return overlay_frame
    
    def get_hand_landmarks(self, frame: np.ndarray) -> List[Tuple[int, int]]:
        """Get hand landmark points for visualization."""
        rgb_frame = frame[:, :, ::-1]
        results = self.hand_recognizer.hands.process(rgb_frame)
        
        if results.multi_hand_landmarks:
            landmarks = results.multi_hand_landmarks[0]
            h, w = frame.shape[:2]
            points = []
            for lm in landmarks.landmark:
                x = int(lm.x * w)
                y = int(lm.y * h)
                points.append((x, y))
            return points
        return []
    
    def get_face_landmarks(self, frame: np.ndarray) -> List[Tuple[int, int]]:
        """Get key face landmark points for visualization."""
        rgb_frame = frame[:, :, ::-1]
        results = self.face_recognizer.face_mesh.process(rgb_frame)
        
        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0]
            h, w = frame.shape[:2]
            # Get key points for visualization (eyes, nose, mouth corners)
            key_indices = [33, 133, 362, 263, 1, 61, 291, 13, 14, 70, 300]
            points = []
            for idx in key_indices:
                lm = landmarks.landmark[idx]
                x = int(lm.x * w)
                y = int(lm.y * h)
                points.append((x, y))
            return points
        return []
    
    def close(self):
        """Release resources."""
        self.hand_recognizer.close()
        self.face_recognizer.close() 