"""Lightweight analyzer for recorded reaction videos.

Uses OpenCV Haar cascades for face/smile detection when ML dependencies
(MediaPipe, DeepFace, FER) are unavailable. This provides better emotion
detection than pure brightness/motion heuristics.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2  # type: ignore
import numpy as np

logger = logging.getLogger(__name__)

# Load OpenCV Haar cascades for face and feature detection
_CASCADE_DIR = cv2.data.haarcascades if hasattr(cv2, "data") else ""

def _load_cascade(name: str) -> Optional[cv2.CascadeClassifier]:
    """Load a Haar cascade classifier, returning None if unavailable."""
    path = os.path.join(_CASCADE_DIR, name) if _CASCADE_DIR else name
    if os.path.exists(path):
        cascade = cv2.CascadeClassifier(path)
        if not cascade.empty():
            return cascade
    logger.warning(f"Haar cascade not found: {name}")
    return None

# Pre-load cascades at module level for performance
FACE_CASCADE = _load_cascade("haarcascade_frontalface_default.xml")
SMILE_CASCADE = _load_cascade("haarcascade_smile.xml")
EYE_CASCADE = _load_cascade("haarcascade_eye.xml")

CASCADES_AVAILABLE = FACE_CASCADE is not None


@dataclass
class FrameEmotion:
    timestamp: float
    emotion: str
    engagement: float
    scores: Dict[str, float]
    face_detected: bool = False
    face_region: Optional[Dict[str, int]] = None


@dataclass
class MotionContext:
    """Track motion between frames for better engagement estimation."""
    prev_gray: Optional[np.ndarray] = None
    prev_face_center: Optional[Tuple[float, float]] = None
    motion_history: List[float] = field(default_factory=list)
    face_motion_history: List[float] = field(default_factory=list)


class ReactionVideoAnalyzer:
    """Analyze recorded webcam reactions without requiring live tracking.
    
    Uses OpenCV Haar cascades for face and smile detection to provide
    reasonable emotion estimates when ML-based analyzers are unavailable.
    """

    def __init__(self, sample_every_n_frames: int = 3, snapshot_limit: int = 5):
        self.sample_every_n_frames = max(1, sample_every_n_frames)
        self.snapshot_limit = snapshot_limit
        self.use_cascades = CASCADES_AVAILABLE
        if self.use_cascades:
            logger.info("ReactionVideoAnalyzer using OpenCV Haar cascades for face detection")
        else:
            logger.warning("ReactionVideoAnalyzer falling back to brightness heuristics (no cascades)")

    def analyze(self, video_path: str) -> Dict:
        path = Path(video_path)
        if not path.exists():
            raise FileNotFoundError(f"Reaction video not found: {video_path}")

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise RuntimeError(f"Failed to open reaction video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_count = 0
        timeline: List[FrameEmotion] = []
        snapshots: List[Dict] = []
        motion_ctx = MotionContext()
        faces_detected = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % self.sample_every_n_frames == 0:
                timestamp = frame_count / fps
                video_progress = frame_count / max(1, total_frames)
                frame_result = self._score_frame(frame, timestamp, video_progress, motion_ctx)
                timeline.append(frame_result)
                if frame_result.face_detected:
                    faces_detected += 1

                if len(snapshots) < self.snapshot_limit:
                    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    snapshots.append(
                        {
                            "timestamp": timestamp,
                            "emotion": frame_result.emotion,
                            "engagement": frame_result.engagement,
                            "image_data": buffer.tobytes(),
                        }
                    )
            frame_count += 1

        cap.release()

        if not timeline:
            logger.warning("Reaction analyzer found no frames; returning neutral baseline")
            return self._empty_result()

        # Log face detection stats
        face_rate = (faces_detected / len(timeline)) * 100 if timeline else 0
        logger.info(
            f"Reaction analysis complete: {len(timeline)} frames, "
            f"{faces_detected} faces detected ({face_rate:.1f}%)"
        )

        emotion_summary = self._summarize_emotions(timeline)
        key_moments = self._key_moments(timeline)
        engagement_score = float(
            np.mean([frame.engagement for frame in timeline])
        ) if timeline else 0.0

        return {
            "emotion_timeline": [
                {
                    "timestamp": frame.timestamp,
                    "emotion": frame.emotion,
                    "engagement": frame.engagement,
                    "scores": frame.scores,
                    "face_detected": frame.face_detected,
                }
                for frame in timeline
            ],
            "emotion_summary": emotion_summary,
            "key_moments": key_moments,
            "engagement_score": engagement_score,
            "reaction_snapshots": snapshots,
            "analyzer_info": {
                "method": "haar_cascade" if self.use_cascades else "brightness_heuristic",
                "face_detection_rate": face_rate,
            },
        }

    def _score_frame(
        self,
        frame: np.ndarray,
        timestamp: float,
        video_progress: float,
        motion_ctx: MotionContext,
    ) -> FrameEmotion:
        """Score a single frame for emotion and engagement.
        
        Uses Haar cascade face/smile detection when available, falling back
        to brightness/motion heuristics otherwise.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate frame motion (optical flow approximation)
        frame_motion = 0.0
        if motion_ctx.prev_gray is not None:
            diff = cv2.absdiff(gray, motion_ctx.prev_gray)
            frame_motion = float(np.mean(diff)) / 255.0
            motion_ctx.motion_history.append(frame_motion)
            if len(motion_ctx.motion_history) > 30:
                motion_ctx.motion_history.pop(0)
        motion_ctx.prev_gray = gray.copy()
        
        # Initialize default scores
        scores: Dict[str, float] = {
            "happy": 0.0,
            "surprised": 0.0,
            "neutral": 0.5,
            "focused": 0.0,
            "calm": 0.0,
        }
        face_detected = False
        face_region = None
        
        if self.use_cascades and FACE_CASCADE is not None:
            # Detect faces
            faces = FACE_CASCADE.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(60, 60),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )
            
            if len(faces) > 0:
                face_detected = True
                # Use the largest face
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                face_region = {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
                face_roi = gray[y : y + h, x : x + w]
                
                # Track face center motion for engagement
                face_center = (x + w / 2, y + h / 2)
                if motion_ctx.prev_face_center is not None:
                    dx = abs(face_center[0] - motion_ctx.prev_face_center[0])
                    dy = abs(face_center[1] - motion_ctx.prev_face_center[1])
                    face_motion = (dx + dy) / max(w, h)  # Normalize by face size
                    motion_ctx.face_motion_history.append(face_motion)
                    if len(motion_ctx.face_motion_history) > 30:
                        motion_ctx.face_motion_history.pop(0)
                motion_ctx.prev_face_center = face_center
                
                # Detect smiles within face region
                smile_detected = False
                if SMILE_CASCADE is not None:
                    # Focus on lower half of face for smile detection
                    smile_roi = face_roi[h // 2 :, :]
                    smiles = SMILE_CASCADE.detectMultiScale(
                        smile_roi,
                        scaleFactor=1.5,
                        minNeighbors=15,
                        minSize=(25, 15),
                    )
                    smile_detected = len(smiles) > 0
                
                # Detect eyes for surprise/focus estimation
                eyes_wide = False
                eyes_count = 0
                if EYE_CASCADE is not None:
                    eye_roi = face_roi[: h // 2, :]  # Upper half of face
                    eyes = EYE_CASCADE.detectMultiScale(
                        eye_roi,
                        scaleFactor=1.1,
                        minNeighbors=5,
                        minSize=(20, 20),
                    )
                    eyes_count = len(eyes)
                    # Wide eyes = larger than typical, more visible
                    if eyes_count >= 2:
                        avg_eye_height = np.mean([e[3] for e in eyes])
                        eyes_wide = avg_eye_height > (h * 0.12)  # Eyes > 12% of face height
                
                # Score emotions based on detected features
                if smile_detected:
                    scores["happy"] = 0.7 + (0.3 * min(1.0, frame_motion * 5))
                    scores["neutral"] = 0.1
                elif eyes_wide:
                    scores["surprised"] = 0.6
                    scores["happy"] = 0.2
                    scores["neutral"] = 0.2
                elif eyes_count >= 2:
                    # Eyes visible but normal = focused/attentive
                    scores["focused"] = 0.5
                    scores["neutral"] = 0.4
                    scores["calm"] = 0.1
                else:
                    # Face detected but features unclear
                    scores["neutral"] = 0.6
                    scores["calm"] = 0.2
                    scores["focused"] = 0.2
        
        if not face_detected:
            # Fall back to brightness/motion heuristics
            brightness = float(np.mean(gray))
            motion = float(np.std(gray))
            
            if motion > 40:
                scores["surprised"] = 0.3
                scores["neutral"] = 0.4
                scores["focused"] = 0.3
            elif brightness > 160:
                scores["happy"] = 0.2
                scores["neutral"] = 0.5
                scores["calm"] = 0.3
            elif brightness < 80:
                scores["calm"] = 0.4
                scores["neutral"] = 0.4
                scores["focused"] = 0.2
            else:
                scores["neutral"] = 0.6
                scores["calm"] = 0.2
                scores["focused"] = 0.2
        
        # Normalize scores
        total = sum(scores.values()) or 1.0
        scores = {k: v / total for k, v in scores.items()}
        
        # Determine dominant emotion
        emotion = max(scores, key=lambda k: scores[k])
        
        # Calculate engagement based on motion and face visibility
        base_engagement = 0.3 if not face_detected else 0.5
        motion_boost = 0.0
        if motion_ctx.motion_history:
            avg_motion = np.mean(motion_ctx.motion_history[-10:])
            motion_boost = min(0.3, avg_motion * 3)
        face_motion_boost = 0.0
        if motion_ctx.face_motion_history:
            avg_face_motion = np.mean(motion_ctx.face_motion_history[-10:])
            face_motion_boost = min(0.2, avg_face_motion * 2)
        
        engagement = min(1.0, base_engagement + motion_boost + face_motion_boost)
        
        # Boost engagement for positive emotions
        if emotion == "happy":
            engagement = min(1.0, engagement + 0.1)
        elif emotion == "surprised":
            engagement = min(1.0, engagement + 0.05)
        
        return FrameEmotion(
            timestamp=timestamp,
            emotion=emotion,
            engagement=engagement,
            scores=scores,
            face_detected=face_detected,
            face_region=face_region,
        )

    def _summarize_emotions(self, timeline: List[FrameEmotion]) -> Dict[str, float]:
        """Summarize emotion distribution across the timeline.
        
        Uses weighted scoring based on confidence (engagement) to give more
        weight to high-confidence detections.
        """
        if not timeline:
            return {"neutral": 100.0}
        
        # Aggregate scores weighted by engagement (confidence proxy)
        weighted_scores: Dict[str, float] = {}
        total_weight = 0.0
        
        for frame in timeline:
            weight = frame.engagement  # Higher engagement = more confident
            total_weight += weight
            for emotion, score in frame.scores.items():
                weighted_scores[emotion] = weighted_scores.get(emotion, 0.0) + score * weight
        
        if total_weight == 0:
            # Fall back to simple counting
            counts: Dict[str, int] = {}
            for frame in timeline:
                counts[frame.emotion] = counts.get(frame.emotion, 0) + 1
            total = sum(counts.values()) or 1
            return {emotion: (count / total) * 100.0 for emotion, count in counts.items()}
        
        # Normalize to percentages
        summary = {
            emotion: (score / total_weight) * 100.0
            for emotion, score in weighted_scores.items()
            if score > 0.01 * total_weight  # Filter out <1% emotions
        }
        
        # Ensure at least one emotion is present
        if not summary:
            summary = {"neutral": 100.0}
        
        return summary

    def _key_moments(self, timeline: List[FrameEmotion]) -> List[Dict]:
        """Identify key moments based on engagement and emotional peaks."""
        if not timeline:
            return []
        
        key_moments = []
        
        # Find peak engagement moments
        sorted_by_engagement = sorted(timeline, key=lambda f: f.engagement, reverse=True)
        for frame in sorted_by_engagement[:2]:
            key_moments.append({
                "timestamp": frame.timestamp,
                "emotion": frame.emotion,
                "reason": "Peak engagement",
                "engagement": frame.engagement,
            })
        
        # Find emotional peaks (happy/surprised moments)
        positive_frames = [f for f in timeline if f.emotion in ("happy", "surprised")]
        if positive_frames:
            best_positive = max(positive_frames, key=lambda f: f.scores.get(f.emotion, 0))
            if best_positive.timestamp not in [m["timestamp"] for m in key_moments]:
                key_moments.append({
                    "timestamp": best_positive.timestamp,
                    "emotion": best_positive.emotion,
                    "reason": f"Emotional peak ({best_positive.emotion})",
                    "engagement": best_positive.engagement,
                })
        
        # Sort by timestamp and limit to 3
        key_moments.sort(key=lambda m: m["timestamp"])
        return key_moments[:3]

    def _empty_result(self) -> Dict:
        return {
            "emotion_timeline": [],
            "emotion_summary": {"neutral": 100.0},
            "key_moments": [],
            "engagement_score": 0.0,
            "reaction_snapshots": [],
        }

