"""Reaction processing pipeline that favors the EnhancedEmotionTracker but falls back to a heuristics analyzer."""

from __future__ import annotations

import logging
import shutil
import subprocess
import os
from pathlib import Path
from typing import Dict, List

import cv2  # type: ignore
import numpy as np  # type: ignore

from .reaction_video_analyzer import ReactionVideoAnalyzer

logger = logging.getLogger(__name__)

try:
    from .enhanced_emotion_tracker import EnhancedEmotionTracker  # type: ignore

    ENHANCED_TRACKER_AVAILABLE = True
except Exception as exc:  # pragma: no cover - optional dependency
    logger.warning("EnhancedEmotionTracker unavailable for reaction processing: %s", exc)
    EnhancedEmotionTracker = None  # type: ignore
    ENHANCED_TRACKER_AVAILABLE = False

FFMPEG_PATH = shutil.which("ffmpeg")

try:
    from moviepy.editor import VideoFileClip  # type: ignore

    MOVIEPY_AVAILABLE = True
except Exception as exc:  # pragma: no cover - optional dependency
    logger.warning("MoviePy unavailable for reaction conversions: %s", exc)
    MOVIEPY_AVAILABLE = False
    VideoFileClip = None  # type: ignore

REACTION_ANALYZER_MODE = os.environ.get("REACTION_ANALYZER_MODE", "auto").strip().lower()
REACTION_FRAME_SKIP = max(1, int(os.environ.get("REACTION_FRAME_SKIP", "2")))
REACTION_MAX_FRAME_EDGE = int(os.environ.get("REACTION_MAX_FRAME_EDGE", "720"))


class ReactionProcessingPipeline:
    """Process recorded reaction videos using the richest tracker available."""

    def __init__(self):
        self.fallback_analyzer = ReactionVideoAnalyzer()
        self.frame_skip_interval = REACTION_FRAME_SKIP
        self.max_frame_edge = max(0, REACTION_MAX_FRAME_EDGE)
        self.force_lightweight = REACTION_ANALYZER_MODE == "lightweight"
        self.use_enhanced = ENHANCED_TRACKER_AVAILABLE and not self.force_lightweight
        if self.force_lightweight:
            logger.info("REACTION_ANALYZER_MODE=lightweight -> using heuristic analyzer for reactions.")
        elif not ENHANCED_TRACKER_AVAILABLE:
            logger.info("Enhanced tracker unavailable; falling back to heuristic analyzer.")
        else:
            logger.info(
                "Reaction analyzer using EnhancedEmotionTracker (frame skip=%d, max edge=%d).",
                self.frame_skip_interval,
                self.max_frame_edge,
            )

    def analyze(self, video_path: str) -> Dict:
        safe_path = self._ensure_readable_video(video_path)
        if self.use_enhanced:
            try:
                return self._analyze_with_enhanced_tracker(safe_path)
            except Exception as exc:
                logger.error(
                    "EnhancedEmotionTracker failed for %s, falling back to lightweight analyzer: %s",
                    safe_path,
                    exc,
                )
        else:
            logger.info("Skipping EnhancedEmotionTracker for %s (mode=%s)", safe_path, REACTION_ANALYZER_MODE or "auto")
        return self.fallback_analyzer.analyze(safe_path)

    def _ensure_readable_video(self, video_path: str) -> str:
        path = Path(video_path)
        if path.suffix.lower() in {".mp4", ".mov"}:
            return video_path

        converted_path = path.with_name(f"{path.stem}_converted.mp4")
        if converted_path.exists():
            return str(converted_path)

        if MOVIEPY_AVAILABLE:
            try:
                clip = VideoFileClip(video_path)
                clip.write_videofile(
                    str(converted_path),
                    audio=False,
                    codec="libx264",
                    logger=None,
                )
                clip.close()
                logger.info("Converted reaction video %s -> %s via MoviePy", video_path, converted_path)
                return str(converted_path)
            except Exception as exc:
                logger.warning("MoviePy conversion failed for %s: %s", video_path, exc)

        if FFMPEG_PATH:
            ffmpeg_cmd = [
                FFMPEG_PATH,
                "-y",
                "-i",
                video_path,
                "-c:v",
                "libx264",
                "-an",
                str(converted_path),
            ]
            try:
                subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                logger.info("Converted reaction video %s -> %s via FFmpeg", video_path, converted_path)
                return str(converted_path)
            except subprocess.CalledProcessError as exc:
                logger.warning("FFmpeg conversion failed for %s: %s", video_path, exc.stderr.decode(errors="ignore"))

        logger.warning("Proceeding with original reaction video %s (no converter available)", video_path)
        return video_path

    # ------------------------------------------------------------------ #
    # Enhanced tracker (preferred path)
    # ------------------------------------------------------------------ #
    def _analyze_with_enhanced_tracker(self, video_path: str) -> Dict:
        tracker = EnhancedEmotionTracker()  # type: ignore[operator]
        tracker.reset()
        tracker.frame_skip_interval = self.frame_skip_interval
        tracker.frame_skip_counter = 0
        tracker.emotion_history = []
        tracker.reaction_snapshots = []
        # Guard typo attribute access in upstream class
        if not hasattr(tracker, "deeFace_enabled"):
            tracker.deeFace_enabled = False  # type: ignore[attr-defined]

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Failed to open reaction video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0

        timeline: List[Dict] = []
        snapshots: List[Dict] = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if self.max_frame_edge and max(frame.shape[0], frame.shape[1]) > self.max_frame_edge:
                scale = self.max_frame_edge / max(frame.shape[0], frame.shape[1])
                new_size = (int(frame.shape[1] * scale), int(frame.shape[0] * scale))
                frame = cv2.resize(frame, new_size)

            if frame_idx % self.frame_skip_interval != 0:
                frame_idx += 1
                continue

            result = tracker._analyze_frame(frame, frame_idx)  # type: ignore[attr-defined]
            if result:
                event = {
                    "timestamp": frame_idx / fps,
                    "emotion": result.get("emotion", "neutral"),
                    "engagement": float(result.get("engagement", 0.0)),
                    "scores": result.get("scores", {}),
                }
                timeline.append(event)
                tracker.emotion_history.append(event)

                if len(snapshots) < self.fallback_analyzer.snapshot_limit:
                    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    snapshots.append(
                        {
                            "timestamp": event["timestamp"],
                            "emotion": event["emotion"],
                            "engagement": event["engagement"],
                            "image_data": buffer.tobytes(),
                        }
                    )

            frame_idx += 1

        cap.release()

        if not timeline:
            logger.warning("Enhanced tracker produced no data; reverting to fallback analyzer")
            return self.fallback_analyzer.analyze(video_path)

        engagement_score = float(np.mean([entry["engagement"] for entry in timeline]))
        emotion_summary = self.fallback_analyzer._summarize_emotions(timeline)
        key_moments = self.fallback_analyzer._key_moments(timeline)

        return {
            "emotion_timeline": timeline,
            "emotion_summary": emotion_summary,
            "key_moments": key_moments,
            "engagement_score": engagement_score,
            "reaction_snapshots": snapshots,
        }

