"""Video Analysis Storage System"""

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import uuid
import logging
import cv2
import base64
from io import BytesIO

logger = logging.getLogger(__name__)

class VideoAnalysisStorage:
    """Storage system for video analysis data"""
    
    def __init__(self, storage_dir: str = "video_analyses"):
        """Initialize storage system"""
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        self.videos_dir = self.storage_dir / "videos"
        self.videos_dir.mkdir(exist_ok=True)
        
        self.reactions_dir = self.storage_dir / "reactions"
        self.reactions_dir.mkdir(exist_ok=True)
        
        self.thumbnails_dir = self.storage_dir / "thumbnails"
        self.thumbnails_dir.mkdir(exist_ok=True)
        
        # Database file
        self.db_file = self.storage_dir / "analyses.json"
        self.db = self._load_database()
        
    def _load_database(self) -> Dict:
        """Load database from file"""
        if self.db_file.exists():
            try:
                with open(self.db_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load database: {e}")
                return {"analyses": {}, "reactions": {}}
        else:
            return {"analyses": {}, "reactions": {}}
            
    def _save_database(self):
        """Save database to file"""
        try:
            # Create a deep copy to avoid modifying the original
            db_copy = json.loads(json.dumps(self.db, default=self._json_encoder))
            
            with open(self.db_file, 'w') as f:
                json.dump(db_copy, f, indent=2, default=self._json_encoder)
        except Exception as e:
            logger.error(f"Failed to save database: {e}")
            
    def _json_encoder(self, obj):
        """Custom JSON encoder for handling bytes and other non-serializable types"""
        if isinstance(obj, bytes):
            # Convert bytes to base64 string
            return base64.b64encode(obj).decode('utf-8')
        elif isinstance(obj, (datetime,)):
            # Convert datetime to ISO format string
            return obj.isoformat()
        # Let the default encoder handle other types
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
            
    def count_user_videos(self, user_id: str) -> int:
        """Count number of videos for a specific user"""
        if not user_id:
            return 0
        
        count = 0
        for analysis in self.db["analyses"].values():
            if analysis.get("user_id") == user_id:
                count += 1
        return count
            
    def create_analysis(self, video_path: str, user_id: str = None, is_admin: bool = False) -> str:
        """Create a new analysis entry
        
        Args:
            video_path: Path to the video file
            user_id: ID of the user creating the analysis
            is_admin: Whether the user is an admin (bypasses video limit)
            
        Returns:
            analysis_id if successful, or error message starting with "ERROR:"
        """
        # Check video limit for non-admin users
        if user_id and not is_admin:
            video_count = self.count_user_videos(user_id)
            if video_count >= 3:
                logger.warning(f"User {user_id} has reached the 3 video limit")
                return "ERROR: You have reached the maximum limit of 3 videos. Please delete an existing video to upload a new one."
        
        analysis_id = str(uuid.uuid4())
        video_name = os.path.basename(video_path)
        
        # Copy video to storage
        video_dest = self.videos_dir / f"{analysis_id}{Path(video_path).suffix}"
        try:
            shutil.copy2(video_path, video_dest)
        except Exception as e:
            logger.error(f"Failed to copy video: {e}")
            video_dest = video_path  # Use original path
            
        # Generate video thumbnail
        thumbnail = self._generate_video_thumbnail(video_path)
            
        # Create analysis entry
        self.db["analyses"][analysis_id] = {
            "id": analysis_id,
            "video_name": video_name,
            "video_path": str(video_dest),
            "created_at": datetime.now().isoformat(),
            "user_id": user_id,  # Associate with user
            "reactions": [],
            "avg_engagement": 0.0,
            "emotion_summary": {},
            "transcription": {},
            "emotion_timeline": [],
            "trigger_words": {},
            "thumbnail": thumbnail,
            "clearcast_check": None,  # Will store Clearcast compliance results
            "clearcast_checked": False,  # Track if check has been performed
            "ai_breakdown": None,  # Will store AI breakdown results
            "ai_breakdown_checked": False,  # Track if breakdown has been performed
            "ai_airing_country": "United Kingdom",
        }
        
        self._save_database()
        
        # Start transcription in background
        import threading
        threading.Thread(
            target=self._transcribe_video, 
            args=(analysis_id, video_path),
            daemon=True
        ).start()
        
        return analysis_id
        
    def _generate_video_thumbnail(self, video_path: str) -> Optional[str]:
        """Generate thumbnail from video"""
        try:
            cap = cv2.VideoCapture(video_path)
            
            # Get frame from 10% into the video
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            target_frame = int(total_frames * 0.1)
            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            
            ret, frame = cap.read()
            cap.release()
            
            if ret:
                # Resize to thumbnail size
                frame = cv2.resize(frame, (320, 180))  # 16:9 aspect
                
                # Convert to JPEG
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                
                # Convert to base64
                img_base64 = base64.b64encode(buffer).decode('utf-8')
                return img_base64
                
        except Exception as e:
            logger.error(f"Failed to generate thumbnail: {e}")
            
        return None
        
    def save_reaction(self, analysis_id: str, reaction_data: Dict) -> Optional[str]:
        """Save a reaction to existing analysis"""
        # Check if analysis exists in database
        if analysis_id not in self.db["analyses"]:
            logger.error(f"Analysis {analysis_id} not found in database")
            return None
            
        reaction_id = f"reaction_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Determine dominant emotion
        emotion_summary = reaction_data.get("emotion_summary", {})
        dominant_emotion = max(emotion_summary, key=emotion_summary.get) if emotion_summary else "neutral"
        
        # Create full reaction entry for reactions database
        reaction_entry = {
            "id": reaction_id,
            "analysis_id": analysis_id,
            "created_at": datetime.now().isoformat(),
            "emotion_timeline": reaction_data.get("emotion_timeline", []),
            "engagement_score": reaction_data.get("engagement_score", 0.0),
            "emotion_summary": emotion_summary,
            "key_moments": reaction_data.get("key_moments", []),
            "dominant_emotion": dominant_emotion,
            "reaction_snapshots": reaction_data.get("reaction_snapshots", []),
            # New fields for enhanced analysis
            "demographics": reaction_data.get("demographics", {}),
            "enhanced_analysis": reaction_data.get("enhanced_analysis", {})
        }
        
        # Save to reactions database
        self.db["reactions"][reaction_id] = reaction_entry
        
        # Add summary to analysis (without full timeline data to save space)
        analysis_reaction = {
            "id": reaction_id,
            "engagement_score": reaction_entry["engagement_score"],
            "dominant_emotion": dominant_emotion,
            "reaction_snapshots": reaction_entry["reaction_snapshots"][:3],  # Keep only first 3 snapshots
            "demographics": reaction_data.get("demographics", {})  # Include demographics in summary
        }
        self.db["analyses"][analysis_id]["reactions"].append(analysis_reaction)
        
        # Update analysis aggregates
        self._update_analysis_aggregates(analysis_id)
        
        # Re-analyze emotion triggers now that we have new reaction data
        self.analyze_emotion_triggers(analysis_id)
            
        self._save_database()
        logger.info(f"Saved reaction {reaction_id} to analysis {analysis_id}")
        return reaction_id
        
    def _update_analysis_aggregates(self, analysis_id: str):
        """Update aggregate data for an analysis"""
        analysis = self.db["analyses"][analysis_id]
        reaction_ids = [r["id"] for r in analysis["reactions"]]
        
        if not reaction_ids:
            return
            
        # Get full reaction data
        full_reactions = []
        for reaction_id in reaction_ids:
            reaction = self.db["reactions"].get(reaction_id)
            if reaction:
                full_reactions.append(reaction)
                
        if not full_reactions:
            return
            
        # Calculate average engagement
        total_engagement = sum(r["engagement_score"] for r in full_reactions)
        analysis["avg_engagement"] = total_engagement / len(full_reactions)
        
        # Combine emotion summaries from full reaction data
        combined_emotions = {}
        for reaction in full_reactions:
            emotion_summary = reaction.get("emotion_summary", {})
            for emotion, percentage in emotion_summary.items():
                if emotion not in combined_emotions:
                    combined_emotions[emotion] = []
                combined_emotions[emotion].append(percentage)
                
        # Average emotion percentages
        analysis["emotion_summary"] = {
            emotion: sum(percentages) / len(percentages)
            for emotion, percentages in combined_emotions.items()
        }
        
        # Aggregate emotion timeline data across all reactions
        all_timeline_data = []
        for reaction in full_reactions:
            timeline = reaction.get("emotion_timeline", [])
            all_timeline_data.extend(timeline)
            
        # Sort by timestamp
        all_timeline_data.sort(key=lambda x: x.get("timestamp", 0))
        
        # Store aggregated timeline (limited to avoid huge data)
        analysis["emotion_timeline"] = all_timeline_data[:1000]  # Keep max 1000 data points
        
        # Update reaction entries in analysis with emotion_summary from full data
        for i, reaction_summary in enumerate(analysis["reactions"]):
            if i < len(full_reactions):
                reaction_summary["emotion_summary"] = full_reactions[i].get("emotion_summary", {})
        
    def get_analysis(self, analysis_id: str) -> Optional[Dict]:
        """Get analysis data by ID"""
        return self.db["analyses"].get(analysis_id)
        
    def get_all_analyses(self, user_id: str = None) -> List[Dict]:
        """Get all analyses, optionally filtered by user"""
        analyses = list(self.db["analyses"].values())
        if user_id:
            analyses = [a for a in analyses if a.get("user_id") == user_id]
        return analyses
        
    def get_reaction(self, reaction_id: str) -> Optional[Dict]:
        """Get reaction data by ID"""
        return self.db["reactions"].get(reaction_id)
        
    def delete_analysis(self, analysis_id: str):
        """Delete an analysis and all its reactions"""
        if analysis_id not in self.db["analyses"]:
            return
            
        analysis = self.db["analyses"][analysis_id]
        
        # Delete video file
        video_path = Path(analysis["video_path"])
        if video_path.exists() and video_path.parent == self.videos_dir:
            try:
                video_path.unlink()
            except Exception as e:
                logger.error(f"Failed to delete video: {e}")
                
        # Delete reactions
        for reaction in analysis["reactions"]:
            if reaction["id"] in self.db["reactions"]:
                del self.db["reactions"][reaction["id"]]
                
        # Delete analysis
        del self.db["analyses"][analysis_id]
        
        self._save_database()
        
    def search_analyses(self, query: str) -> List[Dict]:
        """Search analyses by video name"""
        results = []
        query_lower = query.lower()
        
        for analysis in self.db["analyses"].values():
            if query_lower in analysis["video_name"].lower():
                results.append(analysis)
                
        return results
        
    def get_recent_analyses(self, limit: int = 10) -> List[Dict]:
        """Get recent analyses"""
        analyses = list(self.db["analyses"].values())
        analyses.sort(key=lambda x: x["created_at"], reverse=True)
        return analyses[:limit]
        
    def _transcribe_video(self, analysis_id: str, video_path: str):
        """Transcribe video audio in background"""
        try:
            # Update transcription status
            if analysis_id in self.db["analyses"]:
                self.db["analyses"][analysis_id]["transcription_status"] = "processing"
                self._save_database()
            
            # Import required modules
            import speech_recognition as sr
            from pathlib import Path
            
            # Check if moviepy is available
            try:
                from moviepy.editor import VideoFileClip
                moviepy_available = True
            except ImportError:
                logger.warning("MoviePy not available - skipping transcription")
                if analysis_id in self.db["analyses"]:
                    self.db["analyses"][analysis_id]["transcription_status"] = "unavailable"
                    self._save_database()
                return
                
            # Extract audio from video
            temp_audio = Path(video_path).stem + "_transcript_temp.wav"
            try:
                video_clip = VideoFileClip(video_path)
                if video_clip.audio:
                    logger.info(f"Extracting audio for transcription: {analysis_id}")
                    video_clip.audio.write_audiofile(temp_audio, logger=None, verbose=False)
                    video_clip.close()
                    
                    # Transcribe audio with improved logic
                    r = sr.Recognizer()
                    
                    # Adjust for ambient noise to improve accuracy
                    r.energy_threshold = 300
                    r.dynamic_energy_threshold = True
                    r.pause_threshold = 0.8
                    
                    with sr.AudioFile(temp_audio) as source:
                        # Adjust for ambient noise
                        r.adjust_for_ambient_noise(source, duration=0.5)
                        
                        audio_duration = source.DURATION
                        transcription_segments = []
                        
                        # Improved chunking strategy - larger chunks for better word boundary detection
                        chunk_duration = 10  # Increased from 5 to 10 seconds
                        max_retries = 3
                        
                        start_time = 0
                        while start_time < audio_duration:
                            duration = min(chunk_duration, audio_duration - start_time)
                            
                            # Skip very short segments
                            if duration < 1.0:
                                break
                            
                            # Record chunk
                            audio_chunk = r.record(source, duration=duration)
                            
                            # Retry logic with exponential backoff
                            transcribed = False
                            for attempt in range(max_retries):
                                try:
                                    # Transcribe chunk
                                    text = r.recognize_google(audio_chunk, language='en-US', show_all=False)
                                    
                                    if text and text.strip():
                                        transcription_segments.append({
                                            'start_time': start_time,
                                            'end_time': start_time + duration,
                                            'text': text.strip(),
                                            'emotion': 'neutral',  # Will be updated when reactions are added
                                            'confidence': 1.0  # Google API doesn't provide confidence, but we can estimate
                                        })
                                        
                                        logger.info(f"Transcribed {start_time:.1f}s-{start_time + duration:.1f}s: {text[:50]}...")
                                        transcribed = True
                                        break
                                    
                                except sr.UnknownValueError:
                                    # Could not understand audio - might be silence or noise
                                    if attempt < max_retries - 1:
                                        logger.debug(f"Could not understand audio at {start_time}s, attempt {attempt + 1}/{max_retries}")
                                        # Wait before retry (exponential backoff)
                                        import time
                                        time.sleep(0.5 * (2 ** attempt))
                                    else:
                                        logger.debug(f"Skipping segment {start_time}s-{start_time + duration}s (unintelligible)")
                                    break  # Don't retry UnknownValueError
                                    
                                except sr.RequestError as e:
                                    error_str = str(e).lower()
                                    if attempt < max_retries - 1:
                                        logger.warning(f"Speech recognition error at {start_time}s (attempt {attempt + 1}/{max_retries}): {e}")
                                        # Wait before retry (exponential backoff)
                                        import time
                                        time.sleep(1.0 * (2 ** attempt))
                                    else:
                                        logger.error(f"Speech recognition failed after {max_retries} attempts: {e}")
                                        # Check if it's a quota/rate limit error
                                        if 'quota' in error_str or 'rate limit' in error_str:
                                            logger.error("API quota/rate limit exceeded. Transcription paused.")
                                            break  # Stop transcription if quota exceeded
                                        break  # Stop on persistent errors
                            
                            if not transcribed:
                                # Add empty segment marker for silence/unintelligible audio
                                transcription_segments.append({
                                    'start_time': start_time,
                                    'end_time': start_time + duration,
                                    'text': '',
                                    'emotion': 'neutral',
                                    'confidence': 0.0,
                                    'note': 'unintelligible_or_silent'
                                })
                            
                            # Move to next chunk
                            start_time += chunk_duration
                            
                            # Safety check to prevent infinite loops
                            if start_time >= audio_duration:
                                break
                    
                    # Combine all segments
                    full_text = ' '.join([seg['text'] for seg in transcription_segments])
                    
                    # Update analysis with transcription
                    raw_transcript = {
                        'full_text': full_text,
                        'segments': transcription_segments
                    }
                    
                    # Try to enhance with AI
                    try:
                        from app.enhanced_transcript_analyzer import EnhancedTranscriptAnalyzer
                        analyzer = EnhancedTranscriptAnalyzer()
                        
                        # Get video name for context
                        video_name = self.db["analyses"][analysis_id].get("video_name", "")
                        
                        # Enhance transcript with AI
                        enhanced_transcript = analyzer.enhance_transcript_with_ai(
                            raw_transcript,
                            video_context=f"Video: {video_name}"
                        )
                        
                        self.db["analyses"][analysis_id]["transcription"] = enhanced_transcript
                        logger.info(f"Transcription enhanced with AI for analysis {analysis_id}")
                    except Exception as e:
                        logger.warning(f"Failed to enhance transcript with AI: {e}")
                        # Fall back to raw transcript
                        self.db["analyses"][analysis_id]["transcription"] = raw_transcript
                    
                    self.db["analyses"][analysis_id]["transcription_status"] = "complete"
                    self._save_database()
                    
                    logger.info(f"Transcription complete for analysis {analysis_id}")
                else:
                    logger.info("Video has no audio track")
                    self.db["analyses"][analysis_id]["transcription_status"] = "no_audio"
                    self._save_database()
                    
            finally:
                # Clean up temp file
                try:
                    if Path(temp_audio).exists():
                        Path(temp_audio).unlink()
                except Exception:
                    pass
                    
        except Exception as e:
            logger.error(f"Failed to transcribe video: {e}")
            if analysis_id in self.db["analyses"]:
                self.db["analyses"][analysis_id]["transcription_status"] = "failed"
                self._save_database()
            
    def analyze_emotion_triggers(self, analysis_id: str):
        """Map detected emotions to transcript segments based on timing"""
        analysis = self.get_analysis(analysis_id)
        if not analysis:
            return
            
        transcription = analysis.get("transcription", {})
        timeline = analysis.get("emotion_timeline", [])
        
        if not transcription or not timeline or not isinstance(transcription, dict):
            return
            
        segments = transcription.get("segments", [])
        
        # Get all reactions for aggregated emotion data
        all_emotions_by_timestamp = {}
        
        # Aggregate emotions from all reactions
        for reaction_summary in analysis.get("reactions", []):
            reaction = self.get_reaction(reaction_summary["id"])
            if reaction:
                reaction_timeline = reaction.get("emotion_timeline", [])
                for emotion_data in reaction_timeline:
                    timestamp = emotion_data.get('timestamp', 0)
                    # Group by 0.5 second intervals
                    time_key = round(timestamp * 2) / 2
                    
                    if time_key not in all_emotions_by_timestamp:
                        all_emotions_by_timestamp[time_key] = []
                    
                    all_emotions_by_timestamp[time_key].append({
                        'emotion': emotion_data.get('emotion', 'neutral'),
                        'scores': emotion_data.get('scores', {})
                    })
        
        # Map aggregated emotions to transcript segments
        for segment in segments:
            start_time = segment['start_time']
            end_time = segment['end_time']
            
            # Collect all emotions during this segment
            segment_emotions = {}
            emotion_counts = {}
            
            for time_key, emotions_list in all_emotions_by_timestamp.items():
                if start_time <= time_key <= end_time:
                    for emotion_data in emotions_list:
                        emotion = emotion_data['emotion']
                        scores = emotion_data.get('scores', {})
                        
                        # Count occurrences
                        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
                        
                        # Aggregate scores
                        for emo, score in scores.items():
                            if emo not in segment_emotions:
                                segment_emotions[emo] = []
                            segment_emotions[emo].append(score)
            
            # Determine dominant emotion for this segment
            dominant_emotion = 'neutral'
            
            if segment_emotions:
                # Calculate average scores for each emotion
                avg_scores = {}
                for emotion, scores in segment_emotions.items():
                    avg_scores[emotion] = sum(scores) / len(scores)
                
                # Get emotion with highest average score
                dominant_emotion = max(avg_scores, key=avg_scores.get)
                
                # Store aggregated data in segment
                segment['emotion_scores'] = avg_scores
                segment['reaction_count'] = len(set(time_key for time_key in all_emotions_by_timestamp 
                                                   if start_time <= time_key <= end_time))
            
            # If we have multiple reactions showing different emotions, mark as "mixed"
            if emotion_counts and len(emotion_counts) > 1:
                # If no clear dominant emotion (less than 60% agreement)
                total_counts = sum(emotion_counts.values())
                max_count = max(emotion_counts.values())
                if max_count / total_counts < 0.6:
                    segment['emotion'] = 'mixed'
                else:
                    segment['emotion'] = dominant_emotion
            else:
                segment['emotion'] = dominant_emotion
                
        # Update transcription with emotion mapping
        self.db["analyses"][analysis_id]["transcription"]['segments'] = segments
        self._save_database()
        
    def save_clearcast_check(self, analysis_id: str, clearcast_results: Dict) -> bool:
        """
        Save Clearcast compliance check results
        
        Args:
            analysis_id: Analysis ID
            clearcast_results: Results from Clearcast checker
            
        Returns:
            True if saved successfully
        """
        if analysis_id not in self.db["analyses"]:
            logger.error(f"Analysis {analysis_id} not found")
            return False
        
        # Update analysis with Clearcast results
        self.db["analyses"][analysis_id]["clearcast_check"] = clearcast_results
        self.db["analyses"][analysis_id]["clearcast_checked"] = True
        self.db["analyses"][analysis_id]["clearcast_check_date"] = datetime.now().isoformat()
        
        self._save_database()
        logger.info(f"Saved Clearcast check results for analysis {analysis_id}")
        return True
    
    def save_ai_breakdown(self, analysis_id: str, breakdown_results: Dict) -> bool:
        """
        Save AI video breakdown results
        
        Args:
            analysis_id: Analysis ID
            breakdown_results: Results from AI breakdown analyzer
            
        Returns:
            True if saved successfully
        """
        if analysis_id not in self.db["analyses"]:
            logger.error(f"Analysis {analysis_id} not found")
            return False
        
        # Update analysis with AI breakdown results
        self.db["analyses"][analysis_id]["ai_breakdown"] = breakdown_results
        self.db["analyses"][analysis_id]["ai_breakdown_checked"] = True
        self.db["analyses"][analysis_id]["ai_breakdown_date"] = datetime.now().isoformat()
        
        self._save_database()
        logger.info(f"Saved AI breakdown results for analysis {analysis_id}")
        return True
    
    def set_ai_airing_country(self, analysis_id: str, country: str) -> bool:
        """Persist the preferred airing country for AI analysis context."""
        if analysis_id not in self.db["analyses"]:
            logger.error(f"Analysis {analysis_id} not found")
            return False
        normalized = (country or "").strip()
        self.db["analyses"][analysis_id]["ai_airing_country"] = normalized
        self._save_database()
        logger.info(f"Updated airing country for analysis {analysis_id} to '{normalized}'")
        return True
    
    def export_analysis(self, analysis_id: str, export_path: str):
        """Export analysis data to file"""
        analysis = self.get_analysis(analysis_id)
        if not analysis:
            return False
            
        try:
            with open(export_path, 'w') as f:
                json.dump(analysis, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to export analysis: {e}")
            return False

    def save_enhanced_transcript(self, analysis_id: str, transcript_chunks: List[Dict]):
        """Save enhanced transcript with emotion mapping"""
        if analysis_id not in self.db["analyses"]:
            logger.error(f"Analysis {analysis_id} not found in database")
            return
            
        # Save enhanced transcript to database
        self.db["analyses"][analysis_id]["enhanced_transcript"] = {
            'chunks': transcript_chunks,
            'analyzed_at': datetime.now().isoformat()
        }
        
        self._save_database()
        logger.info(f"Saved enhanced transcript for analysis {analysis_id}")
    
    def update_reaction_snapshot(self, reaction_id: str, snapshot_index: int, enhanced_analysis: Dict):
        """Update a specific snapshot in a reaction with enhanced analysis data"""
        try:
            # Find the reaction
            if reaction_id in self.db["reactions"]:
                reaction = self.db["reactions"][reaction_id]
                
                # Update the snapshot if index is valid
                if 0 <= snapshot_index < len(reaction.get("reaction_snapshots", [])):
                    reaction["reaction_snapshots"][snapshot_index]["enhanced_analysis"] = enhanced_analysis
                    
                    # Save to database
                    self._save_database()
                    logger.info(f"Updated snapshot {snapshot_index} in reaction {reaction_id}")
                else:
                    logger.warning(f"Invalid snapshot index {snapshot_index} for reaction {reaction_id}")
            else:
                                    logger.error(f"Reaction {reaction_id} not found")
        except Exception as e:
            logger.error(f"Failed to update reaction snapshot: {e}")
    
    def save_video_processing(self, analysis_id: str, processing_results: Dict) -> bool:
        """
        Save video processing results from Clearcast video processor
        
        Args:
            analysis_id: Analysis ID
            processing_results: Results from video processor
            
        Returns:
            True if saved successfully
        """
        if analysis_id not in self.db["analyses"]:
            logger.error(f"Analysis {analysis_id} not found")
            return False
        
        # Update analysis with processing results
        self.db["analyses"][analysis_id]["video_processing"] = {
            'results': processing_results,
            'processed_at': datetime.now().isoformat(),
            'output_path': processing_results.get('output_path'),
            'fixes_applied': processing_results.get('fixes_applied', []),
            'warnings': processing_results.get('warnings', []),
            'delivery_metadata': processing_results.get('delivery_metadata') or self._default_delivery_metadata(),
        }
        
        self._save_database()
        logger.info(f"Saved video processing results for analysis {analysis_id}")
        return True 

    def get_delivery_metadata(self, analysis_id: str) -> Dict:
        """Return stored clock/countdown metadata for the analysis."""
        default = self._default_delivery_metadata()
        analysis = self.db["analyses"].get(analysis_id) or {}
        processing = analysis.get("video_processing") or {}
        delivery = processing.get("delivery_metadata") or {}
        merged = default.copy()
        merged.update({k: v for k, v in delivery.items() if v is not None})
        return merged

    @staticmethod
    def _default_delivery_metadata() -> Dict:
        return {
            "clock_number": None,
            "client_name": None,
            "agency_name": None,
            "product_name": None,
            "title": None,
            "countdown_added": False,
            "padding_added": False,
            "ready": False,
        }