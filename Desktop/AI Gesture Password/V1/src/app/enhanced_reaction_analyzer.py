"""Enhanced Reaction Analyzer with AI demographic analysis"""

import logging
import base64
from typing import Dict, Optional, Tuple
import google.generativeai as genai
import cv2
import numpy as np
import re

logger = logging.getLogger(__name__)

class EnhancedReactionAnalyzer:
    """Analyze viewer reactions including demographics and detailed emotions"""
    
    def __init__(self):
        """Initialize the enhanced analyzer"""
        # Get API key from config
        try:
            from app.config_secure import GOOGLE_API_KEY
            api_key = GOOGLE_API_KEY
        except ImportError:
            from app.config import GOOGLE_API_KEY
            api_key = GOOGLE_API_KEY
        
        if api_key and api_key != "DEMO_KEY_GET_YOUR_OWN":
            genai.configure(api_key=api_key)
            # Initialize model using utility function with automatic fallback
            from app.gemini_utils import create_gemini_model
            self.model = create_gemini_model('pro', api_key, fallback_to_pro=True)
            if self.model:
                logger.info("Enhanced Reaction Analyzer initialized with Gemini model")
            else:
                logger.warning("Failed to initialize Gemini model for Enhanced Reaction Analyzer")
                self.model = None
        else:
            logger.warning("Google API key not configured - Enhanced Reaction Analyzer will be limited")
            self.model = None
        
        self.last_call_time = 0
    
    def analyze_reaction_frame(self, frame_data: str) -> Dict:
        """
        Analyze a reaction frame for demographics and emotions
        
        Args:
            frame_data: Base64 encoded image or numpy array
            
        Returns:
            Dict with demographic and emotion analysis
        """
        # Check if model is available
        if not self.model:
            logger.warning("Gemini model not available for reaction analysis")
            return {
                "demographics": {},
                "emotion_analysis": {"primary_emotion": "neutral", "emotion_intensity": 0.0},
                "engagement_metrics": {"attention_level": "Unknown"},
                "error": "Model not initialized"
            }
        
        try:
            # Prepare frame for analysis
            if isinstance(frame_data, str):
                # Already base64
                frame_base64 = frame_data
            else:
                # Convert numpy array to base64
                _, buffer = cv2.imencode('.jpg', frame_data, [cv2.IMWRITE_JPEG_QUALITY, 85])
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Create analysis prompt
            prompt = """Analyze this person's reaction in the image. Provide a structured analysis in JSON format:

{
    "demographics": {
        "gender": "Male/Female/Non-binary",
        "age_estimate": <number between 1-100>,
        "age_range": "Child (0-12)/Teen (13-19)/Young Adult (20-35)/Adult (36-55)/Senior (56+)",
        "ethnicity": "General appearance description (be respectful)",
        "appearance_notes": "Brief note about visible characteristics"
    },
    "emotion_analysis": {
        "primary_emotion": "happy/sad/angry/surprised/fear/disgust/neutral/confused/bored",
        "emotion_intensity": <0.0-1.0>,
        "secondary_emotions": ["list of other detected emotions"],
        "facial_expression": "Description of facial expression",
        "body_language": "If visible, describe posture/gestures"
    },
    "engagement_metrics": {
        "attention_level": "High/Medium/Low",
        "eye_contact": "Direct/Averted/Closed",
        "facial_quality": <0.0-1.0>,
        "confidence_score": <0.0-1.0>
    },
    "reaction_summary": "One sentence describing their overall reaction"
}

Be accurate but respectful in demographic estimates. Focus on observable reactions and engagement."""

            # Prepare image for Gemini
            image_part = {
                "mime_type": "image/jpeg",
                "data": frame_base64
            }
            
            # Generate analysis
            response = self.model.generate_content([prompt, image_part])
            
            # Parse response
            result = self._parse_analysis_response(response.text)
            return result
            
        except Exception as e:
            logger.error(f"Failed to analyze reaction frame: {e}")
            return self._get_default_analysis()
    
    def _parse_analysis_response(self, response_text: str) -> Dict:
        """Parse the AI response into structured format"""
        try:
            import json
            
            # Clean the response text
            cleaned_text = response_text.strip()
            
            # Remove code block markers if present
            cleaned_text = re.sub(r'```json\s*', '', cleaned_text)
            cleaned_text = re.sub(r'```\s*', '', cleaned_text)
            
            # Try multiple approaches to extract JSON
            
            # Approach 1: Direct parse if it's pure JSON
            try:
                return json.loads(cleaned_text)
            except json.JSONDecodeError:
                pass
            
            # Approach 2: Find JSON using balanced braces
            json_match = re.search(r'\{[^{}]*\{[^{}]*\}[^{}]*\}', cleaned_text, re.DOTALL)
            if not json_match:
                # Try simpler pattern for deeply nested JSON
                json_match = re.search(r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}', cleaned_text, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(0)
                try:
                    # Attempt to fix common issues
                    # Remove trailing commas before closing braces/brackets
                    json_str = re.sub(r',\s*}', '}', json_str)
                    json_str = re.sub(r',\s*]', ']', json_str)
                    
                    return json.loads(json_str)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}")
                    logger.debug(f"Failed JSON string: {json_str[:500]}...")
            
            # Approach 3: Manual extraction by counting braces
            brace_count = 0
            start_idx = -1
            end_idx = -1
            
            for i, char in enumerate(cleaned_text):
                if char == '{':
                    if start_idx == -1:
                        start_idx = i
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0 and start_idx != -1:
                        end_idx = i + 1
                        break
            
            if start_idx != -1 and end_idx != -1:
                json_str = cleaned_text[start_idx:end_idx]
                try:
                    # Clean up common issues
                    json_str = re.sub(r',\s*}', '}', json_str)
                    json_str = re.sub(r',\s*]', ']', json_str)
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    pass
                    
            logger.warning("No valid JSON found in response, using defaults")
            return self._get_default_analysis()
                
        except Exception as e:
            logger.error(f"Failed to parse analysis response: {e}")
            return self._get_default_analysis()
    
    def _get_default_analysis(self) -> Dict:
        """Return default analysis structure"""
        return {
            "demographics": {
                "gender": "Unknown",
                "age_estimate": 30,
                "age_range": "Unknown",
                "ethnicity": "Not determined",
                "appearance_notes": "Analysis unavailable"
            },
            "emotion_analysis": {
                "primary_emotion": "neutral",
                "emotion_intensity": 0.5,
                "secondary_emotions": [],
                "facial_expression": "Not analyzed",
                "body_language": "Not visible"
            },
            "engagement_metrics": {
                "attention_level": "Medium",
                "eye_contact": "Unknown",
                "facial_quality": 0.5,
                "confidence_score": 0.0
            },
            "reaction_summary": "Unable to analyze reaction"
        }
    
    def format_reaction_display(self, analysis: Dict) -> str:
        """Format analysis for display"""
        demo = analysis.get('demographics', {})
        emotion = analysis.get('emotion_analysis', {})
        
        # Format: Gender, Age, Primary Emotion
        gender = demo.get('gender', 'Unknown')
        age = demo.get('age_estimate', '?')
        primary_emotion = emotion.get('primary_emotion', 'neutral')
        
        return f"{gender}\n{age} years\n{primary_emotion.upper()}" 