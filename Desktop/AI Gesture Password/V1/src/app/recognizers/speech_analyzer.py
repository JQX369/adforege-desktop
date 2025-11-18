"""Speech analysis module for detecting emotions and intentions."""

import logging
import json
import wave
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from threading import Thread, Event
import queue
from app.config import OPENAI_API_KEY, AUDIO_SAMPLE_RATE, AUDIO_CHUNK_SIZE, SPEECH_CLIP_DURATION

logger = logging.getLogger(__name__)

# Try to import optional dependencies
try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False
    logger.warning("PyAudio not installed. Speech analysis will be disabled.")

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
    client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except ImportError:
    OPENAI_AVAILABLE = False
    client = None
    logger.warning("OpenAI library not installed. Speech analysis will use placeholder data.")


@dataclass
class SpeechClip:
    """Represents an analyzed speech clip."""
    clip_id: str
    timestamp: datetime
    duration: float
    transcription: str
    emotions: Dict[str, float]
    intentions: List[str]
    deception_indicators: Dict[str, float]
    analysis_summary: str


@dataclass
class SpeechAnalysisResult:
    """Complete analysis result for a recording session."""
    session_id: str
    recorded_at: datetime
    total_duration: float
    clips: List[SpeechClip]
    overall_summary: str


class SpeechAnalyzer:
    """Analyzes speech for emotions, intentions, and deception."""
    
    def __init__(self):
        """Initialize speech analyzer."""
        self.audio = None
        if PYAUDIO_AVAILABLE:
            try:
                self.audio = pyaudio.PyAudio()
            except Exception as e:
                logger.error(f"Failed to initialize PyAudio: {e}")
                self.audio = None
        
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.clips = []
        self.current_session_id = None
        self.record_thread = None
        self.stop_event = Event()
        
    def start_recording(self) -> str:
        """Start recording audio."""
        if not self.audio:
            logger.error("PyAudio not available. Cannot record.")
            return "error_no_audio"
            
        self.is_recording = True
        self.clips = []
        self.current_session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.stop_event.clear()
        
        self.record_thread = Thread(target=self._record_audio)
        self.record_thread.start()
        
        return self.current_session_id
    
    def stop_recording(self) -> Optional[SpeechAnalysisResult]:
        """Stop recording and analyze all clips."""
        self.is_recording = False
        self.stop_event.set()
        
        if self.record_thread:
            self.record_thread.join()
        
        if not self.clips:
            return None
            
        # Generate overall summary
        overall_summary = self._generate_overall_summary(self.clips)
        
        return SpeechAnalysisResult(
            session_id=self.current_session_id,
            recorded_at=datetime.now(),
            total_duration=sum(clip.duration for clip in self.clips),
            clips=self.clips,
            overall_summary=overall_summary
        )
    
    def _record_audio(self):
        """Record audio in chunks."""
        if not self.audio:
            return
            
        try:
            stream = self.audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=AUDIO_SAMPLE_RATE,
                input=True,
                frames_per_buffer=AUDIO_CHUNK_SIZE
            )
        except Exception as e:
            logger.error(f"Failed to open audio stream: {e}")
            return
        
        frames = []
        chunk_start_time = datetime.now()
        
        while not self.stop_event.is_set():
            try:
                data = stream.read(AUDIO_CHUNK_SIZE, exception_on_overflow=False)
                frames.append(data)
                
                # Check if we have enough for a clip
                elapsed = (datetime.now() - chunk_start_time).total_seconds()
                if elapsed >= SPEECH_CLIP_DURATION:
                    # Save and analyze clip
                    clip_data = b''.join(frames)
                    self._process_audio_clip(clip_data, elapsed)
                    
                    # Reset for next clip
                    frames = []
                    chunk_start_time = datetime.now()
            except Exception as e:
                logger.error(f"Error recording audio: {e}")
                break
        
        # Process remaining audio if any
        if frames:
            clip_data = b''.join(frames)
            elapsed = (datetime.now() - chunk_start_time).total_seconds()
            self._process_audio_clip(clip_data, elapsed)
        
        stream.stop_stream()
        stream.close()
    
    def _process_audio_clip(self, audio_data: bytes, duration: float):
        """Process and analyze an audio clip."""
        clip_id = f"{self.current_session_id}_{len(self.clips)}"
        
        # Save audio clip
        filename = f"temp_clip_{clip_id}.wav"
        try:
            self._save_audio_clip(audio_data, filename)
        except Exception as e:
            logger.error(f"Failed to save audio clip: {e}")
            return
        
        # Transcribe audio (placeholder - in production use speech-to-text)
        transcription = self._transcribe_audio(filename)
        
        if transcription:
            # Analyze with GPT-4
            analysis = self._analyze_with_gpt4(transcription)
            
            clip = SpeechClip(
                clip_id=clip_id,
                timestamp=datetime.now(),
                duration=duration,
                transcription=transcription,
                emotions=analysis.get("emotions", {}),
                intentions=analysis.get("intentions", []),
                deception_indicators=analysis.get("deception_indicators", {}),
                analysis_summary=analysis.get("summary", "")
            )
            
            self.clips.append(clip)
        
        # Clean up temp file
        try:
            import os
            os.remove(filename)
        except:
            pass
    
    def _save_audio_clip(self, audio_data: bytes, filename: str):
        """Save audio data to WAV file."""
        if not self.audio:
            return
            
        with wave.open(filename, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(self.audio.get_sample_size(pyaudio.paInt16))
            wf.setframerate(AUDIO_SAMPLE_RATE)
            wf.writeframes(audio_data)
    
    def _transcribe_audio(self, filename: str) -> str:
        """Transcribe audio to text."""
        # Placeholder - in production use OpenAI Whisper or similar
        # For demo purposes, return sample text
        import random
        sample_texts = [
            "I think the project is going well, but there might be some delays.",
            "Everything is fine, no issues at all.",
            "Well, actually, there's something I need to mention about the budget.",
            "The team is performing excellently, we're ahead of schedule.",
            "I'm not sure about that decision, let me think about it."
        ]
        return random.choice(sample_texts)
    
    def _analyze_with_gpt4(self, transcription: str) -> Dict:
        """Analyze speech with GPT-4."""
        if not OPENAI_AVAILABLE or not client:
            # Return placeholder data if OpenAI is not available
            import random
            return {
                "emotions": {
                    "neutral": random.uniform(0.3, 0.7),
                    "happy": random.uniform(0.1, 0.3),
                    "anxious": random.uniform(0.1, 0.3),
                },
                "intentions": ["Informing", "Explaining"],
                "deception_indicators": {
                    "hesitation": random.uniform(0.1, 0.4),
                    "deflection": random.uniform(0.1, 0.3),
                },
                "summary": "Analysis based on speech patterns and word choice."
            }
        
        try:
            prompt = f"""Analyze the following speech transcription for:
1. Emotional state (happiness, sadness, anger, fear, surprise, disgust, neutral) - provide confidence scores 0-1
2. Underlying intentions or goals
3. Indicators of deception or concealment (hesitation, contradiction, deflection, etc.) - provide confidence scores 0-1
4. Brief summary of the analysis

Transcription: "{transcription}"

Provide response in JSON format:
{{
    "emotions": {{"emotion_name": confidence_score}},
    "intentions": ["intention1", "intention2"],
    "deception_indicators": {{"indicator_name": confidence_score}},
    "summary": "brief analysis summary"
}}"""

            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert psychologist and behavioral analyst."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            result = response.choices[0].message.content
            return json.loads(result)
            
        except Exception as e:
            logger.error(f"GPT-4 analysis failed: {e}")
            return {
                "emotions": {"neutral": 1.0},
                "intentions": ["Unable to analyze"],
                "deception_indicators": {},
                "summary": "Analysis failed - using placeholder data"
            }
    
    def _generate_overall_summary(self, clips: List[SpeechClip]) -> str:
        """Generate overall summary of the session."""
        if not clips:
            return "No clips to analyze"
        
        # Aggregate emotions
        emotion_totals = {}
        for clip in clips:
            for emotion, score in clip.emotions.items():
                emotion_totals[emotion] = emotion_totals.get(emotion, 0) + score
        
        # Average emotions
        num_clips = len(clips)
        avg_emotions = {k: v/num_clips for k, v in emotion_totals.items()}
        
        # Find dominant emotion
        if avg_emotions:
            dominant_emotion = max(avg_emotions.items(), key=lambda x: x[1])
        else:
            dominant_emotion = ("neutral", 1.0)
        
        # Collect all intentions
        all_intentions = []
        for clip in clips:
            all_intentions.extend(clip.intentions)
        
        # Count deception indicators
        deception_count = sum(
            1 for clip in clips 
            if any(score > 0.5 for score in clip.deception_indicators.values())
        )
        
        summary = f"""Session Summary:
- Total Clips: {num_clips}
- Dominant Emotion: {dominant_emotion[0]} ({dominant_emotion[1]:.2f})
- Common Intentions: {', '.join(set(all_intentions)[:3]) if all_intentions else 'None detected'}
- Deception Indicators: {deception_count}/{num_clips} clips showed potential deception
"""
        
        return summary
    
    def __del__(self):
        """Cleanup PyAudio on deletion."""
        if self.audio:
            try:
                self.audio.terminate()
            except:
                pass 