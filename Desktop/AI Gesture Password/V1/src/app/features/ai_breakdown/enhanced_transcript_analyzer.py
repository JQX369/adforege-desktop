"""Enhanced Transcript Analyzer with emotion mapping and AI correction"""

import logging
from typing import Dict, List, Optional, Tuple
import google.generativeai as genai
import re
from datetime import timedelta

logger = logging.getLogger(__name__)

class EnhancedTranscriptAnalyzer:
    """Analyze and enhance transcripts with emotion mapping and AI correction"""
    
    def __init__(self):
        """Initialize the enhanced analyzer"""
        # Get API key from config
        try:
            from app.core.config_secure import GOOGLE_API_KEY
            api_key = GOOGLE_API_KEY
        except ImportError:
            from app.core.config import GOOGLE_API_KEY
            api_key = GOOGLE_API_KEY
        
        if api_key and api_key != "DEMO_KEY_GET_YOUR_OWN":
            genai.configure(api_key=api_key)
            # Initialize model using utility function with automatic fallback
            from app.core.gemini_utils import create_gemini_model
            self.model = create_gemini_model('pro', api_key, fallback_to_pro=True)
            if self.model:
                logger.info("Enhanced Transcript Analyzer initialized with Gemini model")
            else:
                logger.warning("Failed to initialize Gemini model for Enhanced Transcript Analyzer")
                self.model = None
        else:
            logger.warning("Google API key not configured - Enhanced Transcript Analyzer will be limited")
            self.model = None
        
        self.logger = logging.getLogger('app.features.ai_breakdown.enhanced_transcript_analyzer')
    
    def analyze_transcript_with_emotions(self, 
                                       transcript_segments: List[Dict],
                                       emotion_timeline: List[Dict]) -> List[Dict]:
        """
        Analyze transcript segments and map emotions to words/phrases
        
        Args:
            transcript_segments: List of transcript segments with timestamps
            emotion_timeline: List of emotion data points with timestamps
            
        Returns:
            Enhanced transcript segments with emotion mapping
        """
        enhanced_segments = []
        
        for segment in transcript_segments:
            start_time = segment.get('start_time', 0)
            end_time = segment.get('end_time', 0)
            text = segment.get('text', '')
            
            # Find emotions during this segment
            segment_emotions = self._get_emotions_for_timerange(
                emotion_timeline, start_time, end_time
            )
            
            # Determine dominant emotion
            dominant_emotion = self._calculate_dominant_emotion(segment_emotions)
            
            # Enhanced segment
            enhanced_segment = {
                'start_time': start_time,
                'end_time': end_time,
                'text': text,
                'emotion': dominant_emotion,
                'emotion_scores': self._calculate_emotion_scores(segment_emotions),
                'reaction_count': len(segment_emotions)
            }
            
            enhanced_segments.append(enhanced_segment)
            
        return enhanced_segments
    
    def enhance_transcript_with_ai(self, 
                                 raw_transcript: Dict,
                                 video_context: Optional[str] = None) -> Dict:
        """
        Use AI to enhance and correct the raw transcript
        
        Args:
            raw_transcript: Raw transcript from speech recognition
            video_context: Optional context about the video content
            
        Returns:
            Enhanced transcript with corrections and improvements
        """
        # Check if model is available
        if not self.model:
            logger.warning("Gemini model not available for transcript enhancement, returning raw transcript")
            return raw_transcript
        
        try:
            # Extract text segments
            segments = raw_transcript.get('segments', [])
            if not segments:
                return raw_transcript
            
            # Combine segments for AI processing
            full_text = ' '.join([seg.get('text', '') for seg in segments])
            
            # Create enhancement prompt
            prompt = f"""
You are a transcript enhancement AI. Your task is to improve the accuracy and readability of this auto-generated transcript.

{f"Video Context: {video_context}" if video_context else ""}

Raw Transcript:
{full_text}

Please provide an enhanced version that:
1. Corrects obvious speech recognition errors
2. Adds proper punctuation and capitalization
3. Fixes grammar while preserving the original meaning
4. Identifies and corrects brand names, product names, and technical terms
5. Maintains the conversational tone if it's dialogue

IMPORTANT: Return the response in this JSON format:
{{
    "enhanced_text": "The complete enhanced transcript",
    "corrections": [
        {{
            "original": "incorrect phrase",
            "corrected": "correct phrase",
            "reason": "why it was corrected"
        }}
    ],
    "identified_elements": {{
        "brands": ["list of brand names found"],
        "products": ["list of product names found"],
        "technical_terms": ["list of technical terms found"]
    }}
}}

Keep the same overall structure and timing, just improve accuracy and readability.
"""
            
            # Generate enhanced transcript
            response = self.model.generate_content(prompt)
            
            # Parse response
            import json
            import re
            
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response.text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # Split enhanced text back into segments
                enhanced_text = result.get('enhanced_text', full_text)
                enhanced_segments = self._split_text_to_segments(
                    enhanced_text, 
                    segments
                )
                
                # Update segments with enhanced text
                for i, seg in enumerate(segments):
                    if i < len(enhanced_segments):
                        seg['text'] = enhanced_segments[i]
                        seg['ai_enhanced'] = True
                
                # Add metadata
                from datetime import datetime
                raw_transcript['ai_enhancement'] = {
                    'enhanced': True,
                    'corrections': result.get('corrections', []),
                    'identified_elements': result.get('identified_elements', {}),
                    'enhancement_date': datetime.now().isoformat()
                }
                
                logger.info("Transcript enhanced with AI")
                
                return raw_transcript
            else:
                logger.warning("Could not parse AI enhancement response")
                return raw_transcript
                
        except Exception as e:
            logger.error(f"Failed to enhance transcript with AI: {e}")
            return raw_transcript
    
    def _split_text_to_segments(self, 
                              enhanced_text: str, 
                              original_segments: List[Dict]) -> List[str]:
        """Split enhanced text back into segments based on original timing"""
        # Simple word-based splitting
        words = enhanced_text.split()
        total_words = len(words)
        
        segments = []
        word_index = 0
        
        for seg in original_segments:
            # Calculate proportion of words for this segment
            seg_duration = seg.get('end_time', 0) - seg.get('start_time', 0)
            total_duration = original_segments[-1].get('end_time', 0)
            
            if total_duration > 0:
                word_proportion = seg_duration / total_duration
                words_for_segment = int(total_words * word_proportion)
            else:
                words_for_segment = total_words // len(original_segments)
            
            # Extract words for this segment
            segment_words = words[word_index:word_index + words_for_segment]
            segments.append(' '.join(segment_words))
            word_index += words_for_segment
        
        # Add any remaining words to last segment
        if word_index < total_words:
            remaining_words = words[word_index:]
            if segments:
                segments[-1] += ' ' + ' '.join(remaining_words)
            else:
                segments.append(' '.join(remaining_words))
        
        return segments
    
    def _get_emotions_for_timerange(self, 
                                  emotion_timeline: List[Dict], 
                                  start_time: float, 
                                  end_time: float) -> List[Dict]:
        """Get all emotions within a time range"""
        emotions = []
        
        for emotion_data in emotion_timeline:
            timestamp = emotion_data.get('timestamp', 0)
            if start_time <= timestamp <= end_time:
                emotions.append(emotion_data)
                
        return emotions
    
    def _calculate_dominant_emotion(self, emotions: List[Dict]) -> str:
        """Calculate the dominant emotion from a list of emotion data"""
        if not emotions:
            return 'neutral'
            
        # Count occurrences of each emotion
        emotion_counts = {}
        for data in emotions:
            emotion = data.get('emotion', 'neutral')
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            
        # Return most common emotion
        return max(emotion_counts, key=emotion_counts.get)
    
    def _calculate_emotion_scores(self, emotions: List[Dict]) -> Dict[str, float]:
        """Calculate average emotion scores"""
        if not emotions:
            return {}
            
        # Aggregate scores
        total_scores = {}
        count = 0
        
        for data in emotions:
            if 'scores' in data:
                for emotion, score in data['scores'].items():
                    if emotion not in total_scores:
                        total_scores[emotion] = 0
                    total_scores[emotion] += score
                count += 1
                
        # Calculate averages
        if count > 0:
            return {emotion: score / count for emotion, score in total_scores.items()}
        else:
            return {}
    
    def analyze_transcript_emotions(self, transcript: str, emotion_timeline: List[Dict]) -> List[Dict]:
        """
        Analyze transcript and map emotions to specific words/phrases
        
        Args:
            transcript: Full transcript text
            emotion_timeline: List of emotion data with timestamps
            
        Returns:
            List of transcript chunks with emotion mappings
        """
        try:
            # Create prompt for AI analysis
            prompt = f"""Analyze this transcript and break it into small chunks (3-5 seconds each). 
For each chunk, identify key emotion-triggering words or phrases and map the likely viewer emotions.

Transcript:
{transcript}

Provide output in this JSON format:
{{
    "chunks": [
        {{
            "start_time": 0.0,
            "end_time": 3.5,
            "text": "chunk text here",
            "emotion_triggers": [
                {{
                    "phrase": "specific word or phrase",
                    "emotion": "happy/sad/angry/surprised/etc",
                    "intensity": 0.0-1.0,
                    "reason": "why this triggers emotion"
                }}
            ],
            "overall_emotion": "dominant emotion for chunk",
            "engagement_level": "High/Medium/Low"
        }}
    ]
}}

Focus on:
1. Emotional language and tone shifts
2. Keywords that trigger specific reactions
3. Pacing and dramatic moments
4. Call-to-action phrases
5. Humor or surprise elements"""

            # Get AI analysis
            response = self.model.generate_content(prompt)
            
            # Parse response
            chunks = self._parse_transcript_analysis(response.text)
            
            # Enhance with actual emotion data if available
            if emotion_timeline:
                chunks = self._merge_with_timeline_data(chunks, emotion_timeline)
            
            return chunks
            
        except Exception as e:
            logger.error(f"Failed to analyze transcript emotions: {e}")
            # Fallback to basic chunking
            return self._basic_chunk_transcript(transcript)
    
    def _parse_transcript_analysis(self, response_text: str) -> List[Dict]:
        """Parse AI response into structured chunks"""
        try:
            import json
            
            # Extract JSON
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data.get('chunks', [])
        except:
            pass
        
        # Fallback
        return self._basic_chunk_transcript(response_text)
    
    def _basic_chunk_transcript(self, transcript: str) -> List[Dict]:
        """Basic fallback chunking"""
        words = transcript.split()
        chunks = []
        chunk_size = 10  # words per chunk
        
        for i in range(0, len(words), chunk_size):
            chunk_words = words[i:i + chunk_size]
            chunk_text = ' '.join(chunk_words)
            
            chunks.append({
                'start_time': i * 2.0,  # Rough estimate
                'end_time': (i + chunk_size) * 2.0,
                'text': chunk_text,
                'emotion_triggers': [],
                'overall_emotion': 'neutral',
                'engagement_level': 'Medium'
            })
        
        return chunks
    
    def _merge_with_timeline_data(self, chunks: List[Dict], timeline: List[Dict]) -> List[Dict]:
        """Merge AI analysis with actual emotion timeline data"""
        for chunk in chunks:
            start_time = chunk['start_time']
            end_time = chunk['end_time']
            
            # Find emotions in this time range
            chunk_emotions = [
                t for t in timeline 
                if start_time <= t.get('timestamp', 0) <= end_time
            ]
            
            if chunk_emotions:
                # Calculate dominant emotion from actual data
                emotion_counts = {}
                for t in chunk_emotions:
                    emotion = t.get('emotion', 'neutral')
                    emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
                
                # Set overall emotion to most common
                if emotion_counts:
                    chunk['overall_emotion'] = max(emotion_counts, key=emotion_counts.get)
                    chunk['actual_viewer_emotions'] = emotion_counts
        
        return chunks
    
    def format_time_range(self, start: float, end: float) -> str:
        """Format time range for display"""
        start_str = str(timedelta(seconds=int(start)))[2:7]
        end_str = str(timedelta(seconds=int(end)))[2:7]
        return f"{start_str} - {end_str}"
    
    def get_emotion_color(self, emotion: str) -> str:
        """Get color for emotion display"""
        colors = {
            'happy': '#34C759',
            'sad': '#5856D6',
            'angry': '#FF3B30',
            'surprise': '#FF9500',
            'fear': '#AF52DE',
            'disgust': '#5AC8FA',
            'neutral': '#8E8E93',
            'bored': '#C7C7CC',
            'stressed': '#FF6482',
            'confused': '#5856D6'
        }
        return colors.get(emotion.lower(), '#8E8E93') 