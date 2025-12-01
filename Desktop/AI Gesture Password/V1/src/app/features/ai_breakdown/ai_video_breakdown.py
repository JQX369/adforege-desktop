"""AI Video Breakdown Module using Google Gemini"""

import base64
import json
import logging
import os
import re
import time
import asyncio
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from collections import OrderedDict

import cv2
import google.generativeai as genai

from app.features.ai_breakdown import effectiveness_benchmarks
from app.features.ai_breakdown.emotional_timeline import (
    EmotionalTimeline, EmotionReading, EmotionalTransition, EmotionalMetrics,
    get_num_readings, validate_emotion, validate_trigger, EMOTION_COLORS
)
from app.core.frame_analyzer import extract_frames_with_timestamps, get_video_metadata, generate_external_id
from app.features.ad_script_lab.rag_client import get_rag_client

# OpenAI for persona chat
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

logger = logging.getLogger(__name__)

# Expected keys in Gemini response for robust parsing and recovery
EXPECTED_RESPONSE_KEYS = [
    "breakdown", "estimated_outcome", "green_highlights", "yellow_highlights",
    "soft_risks", "audience_reactions", "ad_elements", "competitive_context",
    "ab_test_suggestions", "effectiveness_drivers", "hero_analysis", "storyboards",
    "brand_asset_timeline", "audio_fingerprint", "emotional_timeline", "brain_balance",
    "toxicity_assessment", "speech_analysis", "visual_attention_analysis",
    "color_analysis", "temporal_flow", "claims_analysis", "summary", "one_sentence_summary",
    "impact_scores", "content_indicators", "creative_profile", "cta", "transcript"
]

# Extraction version - increment when making significant schema/prompt changes
# Mirrors TellyAds' EXTRACTION_VERSION for tracking and rollback capability
EXTRACTION_VERSION = "1.1.0"

try:  # Optional OCR dependencies
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None

class AIVideoBreakdown:
    """AI-powered video breakdown analyzer using Google Gemini"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the AI breakdown analyzer"""
        # Use provided API key or secure config
        if api_key:
            self.api_key = api_key
        else:
            try:
                from app.core.config_secure import GOOGLE_API_KEY
                self.api_key = GOOGLE_API_KEY
            except ImportError:
                from app.core.config import GOOGLE_API_KEY
                self.api_key = GOOGLE_API_KEY
        
        # Configure Gemini if we have a valid key
        self.has_valid_key = False
        if self.api_key and self.api_key != "DEMO_KEY_GET_YOUR_OWN" and len(self.api_key.strip()) > 10:
            try:
                genai.configure(api_key=self.api_key)
                # Initialize the model using utility function with automatic fallback
                from app.core.gemini_utils import create_gemini_model
                self.model = create_gemini_model('pro', self.api_key, fallback_to_pro=True)
                if self.model:
                    self.has_valid_key = True
                    logger.info("AI Video Breakdown initialized with valid API key")
                else:
                    logger.warning("No available Gemini model found. AI breakdown features will be limited.")
                    self.has_valid_key = False
            except Exception as e:
                logger.warning(f"Failed to configure Gemini API: {e}. AI breakdown features will be limited.")
                self.model = None
                self.has_valid_key = False
        else:
            logger.warning("Google API key not configured - AI breakdown features will be limited")
            self.model = None
            self.has_valid_key = False
        
        self.logger = logging.getLogger('app.features.ai_breakdown.ai_video_breakdown')
    
    def extract_video_frames(self, video_path: str, max_frames: int = 60) -> List[str]:
        """
        Extract key frames from video for analysis using seek-based extraction.
        
        Uses direct frame seeking (cap.set + cap.read) instead of sequential reading
        for much faster extraction on large MOV/ProRes files.
        
        Args:
            video_path: Path to video file
            max_frames: Maximum number of frames to extract (evenly distributed)
            
        Returns:
            List of base64-encoded JPEG frames
        """
        # Log video metadata for diagnostics
        metadata = get_video_metadata(video_path)
        if metadata:
            logger.info(
                f"Video metadata: duration={metadata.duration}s, fps={metadata.fps}, "
                f"total_frames={metadata.total_frames}, resolution={metadata.width}x{metadata.height}, "
                f"codec={metadata.codec}"
            )
        else:
            logger.warning(f"Could not read video metadata for: {video_path}")
        
        # Use extract_frames_with_timestamps which uses SEEK-BASED extraction
        # (cap.set(CV2.CAP_PROP_POS_FRAMES) + cap.read) - much faster for large files
        # This extracts evenly distributed frames across the entire video duration
        frames = extract_frames_with_timestamps(
            video_path,
            num_frames=max_frames,
            max_width=960,
            quality=80
        )
        
        if frames:
            logger.info(f"Extracted {len(frames)} frames using SEEK-based extraction (evenly distributed)")
        else:
            logger.warning(f"No frames extracted from video: {video_path}")
        
        return [f.base64_image for f in frames]
    
    def _encode_frame(self, frame) -> str:
        """Resize and encode a frame to base64 JPEG."""
        height, width = frame.shape[:2]
        max_width = 960
        if width > max_width:
            scale = max_width / width
            new_width = int(width * scale)
            new_height = int(height * scale)
            frame = cv2.resize(frame, (new_width, new_height))
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return base64.b64encode(buffer).decode('utf-8')
    
    def _get_video_duration(self, video_path: str) -> float:
        """Get video duration in seconds"""
        try:
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            cap.release()
            
            if fps > 0:
                duration = frame_count / fps
                return round(duration, 1)
            return 0.0
        except Exception as e:
            logger.error(f"Error getting video duration: {e}")
            return 0.0
    
    async def analyze_video(
        self,
        video_path: str,
        detail_level: str = "full",
        script_text: Optional[str] = None,
        supers_texts: Optional[List[str]] = None,
        audience_country: Optional[str] = None,
    ) -> Dict:
        """Analyze video and generate comprehensive breakdown"""
        try:
            detail_level = (detail_level or "full").lower()
            if detail_level not in ("quick", "full"):
                detail_level = "full"
            # Check if we have a valid API key and model
            if not self.has_valid_key or not self.model:
                logger.warning("AI Video Breakdown: No valid API key configured. Skipping analysis.")
                return {
                    "error": "Google API key not configured. Please set GOOGLE_API_KEY environment variable or configure it in the app settings.",
                    "analysis_status": "SKIPPED",
                    "breakdown": {},
                    "estimated_outcome": {},
                    "green_highlights": [],
                    "yellow_highlights": [],
                    "audience_reactions": [],
                    "summary": "AI analysis requires a valid Google API key. Get your free API key from https://aistudio.google.com/app/apikey"
                }
            
            # Get full video metadata (blocking I/O)
            video_metadata = await asyncio.to_thread(get_video_metadata, video_path)
            video_duration = video_metadata.duration if video_metadata else 0.0
            logger.info(f"Analyzing video: {video_path} (duration: {video_duration}s, {video_metadata.width}x{video_metadata.height} @ {video_metadata.fps:.1f}fps)" if video_metadata else f"Analyzing video: {video_path}")
            
            # Extract key frames (blocking I/O)
            max_frames = 15 if detail_level == "full" else 8
            frames = await asyncio.to_thread(self.extract_video_frames, video_path, max_frames)
            
            if not frames:
                return {
                    "error": "Could not extract frames from video",
                    "analysis_status": "FAILED"
                }
            
            if not supers_texts:
                supers_texts = await asyncio.to_thread(self._extract_supers_via_ocr, frames)

            # --- RAG Integration for Few-Shot Examples ---
            rag_context = ""
            try:
                rag_client = get_rag_client()
                
                # Build a search query from script and supers
                search_query_parts = []
                if script_text:
                    search_query_parts.append(script_text[:500])
                if supers_texts:
                    search_query_parts.append(" ".join(supers_texts[:5]))
                
                search_query = " ".join(search_query_parts)[:1000] # Truncate if too long
                
                if search_query:
                    logger.info("Retrieving similar ads for benchmarking...")
                    similar_ads = await rag_client.retrieve(search_query, limit=6, min_similarity=0.4)
                    
                    if similar_ads:
                        examples = []
                        for ad in similar_ads:
                            if ad.effectiveness_score:
                                examples.append(f"- Ad: {ad.title} ({ad.brand})\n  Score: {ad.effectiveness_score}/10\n  Context: {ad.description}")
                        
                        if examples:
                            rag_context = "\nREFERENCE BENCHMARKS (Use these to calibrate scoring):\n" + "\n".join(examples)
                            logger.info(f"Injected {len(examples)} benchmark examples into prompt")
            except Exception as rag_error:
                logger.warning(f"Failed to retrieve RAG benchmarks: {rag_error}")
            # ---------------------------------------------

            # Create the structured prompt with video duration
            prompt = self._create_analysis_prompt(
                video_duration,
                detail_level=detail_level,
                script_text=script_text,
                supers_texts=supers_texts,
                audience_country=audience_country,
                rag_context=rag_context
            )
            
            # Prepare frames for Gemini
            frame_parts = []
            for i, frame_base64 in enumerate(frames):
                frame_parts.append(f"\n[Frame {i+1}]")
                frame_parts.append({
                    "mime_type": "image/jpeg",
                    "data": frame_base64
                })
            
            # Generate content
            logger.info("Sending frames to Gemini for analysis...")
            response = None
            max_attempts = 3
            
            # Configure generation args for determinism
            generation_config = genai.types.GenerationConfig(
                temperature=0.0, # Deterministic output
                candidate_count=1
            )

            for attempt in range(max_attempts):
                try:
                    # Use async generation if available, else run in thread
                    if hasattr(self.model, 'generate_content_async'):
                        response = await self.model.generate_content_async(
                            [prompt] + frame_parts,
                            generation_config=generation_config,
                            request_options={"timeout": 180}
                        )
                    else:
                        response = await asyncio.to_thread(
                            self.model.generate_content,
                            [prompt] + frame_parts,
                            generation_config=generation_config,
                            request_options={"timeout": 180}
                        )
                    break
                except Exception as api_error:
                    error_str = str(api_error).lower()
                    if "api key" in error_str or "api_key" in error_str or "invalid" in error_str:
                        logger.warning(f"API key validation failed: {api_error}")
                        return {
                            "error": "Invalid Google API key. Please check your API key configuration.",
                            "analysis_status": "ERROR"
                        }
                    
                    if "quota" in error_str or "429" in error_str:
                        retry_delay = self._extract_retry_delay(str(api_error))
                        if retry_delay and attempt < max_attempts - 1:
                            logger.warning(f"API quota exceeded. Retrying in {retry_delay:.1f}s...")
                            await asyncio.sleep(retry_delay)
                            continue
                        else:
                            error_msg = self._format_quota_error(api_error)
                            return {
                                "error": error_msg,
                                "analysis_status": "ERROR",
                                "breakdown": {}, # Return empty structure to prevent crashes
                                "estimated_outcome": {},
                                "green_highlights": [],
                                "yellow_highlights": [],
                                "audience_reactions": [],
                                "summary": f"Analysis failed: {error_msg}"
                            }
                    
                    if attempt < max_attempts - 1 and self._should_retry(error_str):
                        backoff = 1 + attempt
                        logger.warning(f"Temporary AI error ({api_error}). Retrying in {backoff}s...")
                        await asyncio.sleep(backoff)
                        continue
                    raise api_error
            
            if response is None:
                return {
                    "error": "Failed to analyze video: API request failed after retries.",
                    "analysis_status": "ERROR",
                    "breakdown": {},
                    "estimated_outcome": {},
                    "green_highlights": [],
                    "yellow_highlights": [],
                    "audience_reactions": [],
                    "summary": "Analysis failed: Unable to get response from AI service."
                }
            
            # Parse the response
            result = self._parse_response(
                response.text,
                script_text=script_text,
                supers_texts=supers_texts,
                audience_country=audience_country,
            )
            
            # Inject effectiveness benchmarks
            try:
                outcome = result.get('estimated_outcome', {})
                score = outcome.get('effectiveness_score')
                if score is not None:
                    avg_range = effectiveness_benchmarks.get_tier_range(50) 
                    top_range = effectiveness_benchmarks.get_tier_range(90) 
                    
                    outcome['benchmarks'] = {
                        'industry_avg': avg_range[1],
                        'top_tier': top_range[0],
                        'current_tier': effectiveness_benchmarks.get_tier(score),
                        'tier_color': effectiveness_benchmarks.get_tier_color(score)
                    }
                    result['estimated_outcome'] = outcome
            except Exception as e:
                logger.warning(f"Failed to inject benchmarks: {e}")

            result['analysis_status'] = 'COMPLETE'
            result['analyzed_at'] = datetime.now().isoformat()
            result['analysis_mode'] = detail_level
            result['extraction_version'] = EXTRACTION_VERSION  # Track schema version
            result.setdefault('debug', {})['ocr_supers'] = supers_texts or []
            if rag_context:
                result.setdefault('debug', {})['rag_benchmarks_used'] = True
            
            if audience_country:
                result.setdefault("audience_context", {})["airing_country"] = audience_country
            if detail_level == "quick":
                result['audience_reactions'] = []
            
            result['frames'] = frames
            
            # Add TellyAds-compatible video metadata
            if video_metadata:
                external_id = generate_external_id(video_path)
                result['video_metadata'] = video_metadata.to_tellyads_format(external_id=external_id)
                # Also add top-level fields for TellyAds schema compatibility
                result['duration_seconds'] = video_metadata.duration
                result['width'] = video_metadata.width
                result['height'] = video_metadata.height
                result['aspect_ratio'] = video_metadata.aspect_ratio
                result['fps'] = video_metadata.fps
                result['external_id'] = external_id
            
            # Calculate Toxicity Score
            try:
                from app.core.physics_analyzer import analyze_all_physics
                from app.features.toxicity import ToxicityScorer
                
                # Get visual and audio physics metrics
                visual_physics, audio_physics = await analyze_all_physics(video_path)
                
                # Build toxicity analysis data
                toxicity_data = {
                    "visual_physics": visual_physics.to_dict(),
                    "audio_physics": audio_physics.to_dict(),
                    "transcript": script_text or "",
                    "claims": result.get("claims", []),
                    "duration_seconds": video_duration,
                    # Get GARM risk from compliance if available
                    "garm_risk_level": result.get("compliance", {}).get("overall_risk", "low"),
                    "required_disclaimers": result.get("compliance", {}).get("required_disclaimers", []),
                    "present_disclaimers": result.get("content_indicators", {}).get("disclaimers_found", []),
                }
                
                # Calculate toxicity score
                scorer = ToxicityScorer(use_ai=True)
                toxicity_report = scorer.calculate_toxicity(toxicity_data)
                
                result['toxicity'] = toxicity_report.to_dict()
                logger.info(f"Toxicity score calculated: {toxicity_report.toxic_score} ({toxicity_report.risk_level})")
                
            except Exception as toxicity_error:
                logger.warning(f"Failed to calculate toxicity score: {toxicity_error}")
                result['toxicity'] = None
            
            logger.info(f"Video analysis completed successfully (extraction_version={EXTRACTION_VERSION})")
            return result
            
        except Exception as e:
            error_str = str(e).lower()
            if "api key" in error_str:
                return {
                    "error": "Invalid Google API key.",
                    "analysis_status": "ERROR"
                }
            else:
                logger.error(f"Failed to analyze video: {e}")
                return {
                    "error": str(e),
                    "analysis_status": "ERROR",
                    "breakdown": {},
                    "estimated_outcome": {},
                    "green_highlights": [],
                    "yellow_highlights": [],
                    "audience_reactions": [],
                    "summary": f"Analysis failed: {str(e)}"
                }
    
    def _create_analysis_prompt(
        self,
        video_duration: float,
        detail_level: str = "full",
        script_text: Optional[str] = None,
        supers_texts: Optional[List[str]] = None,
        audience_country: Optional[str] = None,
        rag_context: Optional[str] = None,
    ) -> str:
        """Create the structured prompt for video analysis"""
        mode_hint = ""
        if detail_level == "quick":
            mode_hint = """
QUICK MODE:
- Keep responses concise (2-3 bullets per list).
- Set "audience_reactions": [].
- Focus on the most critical green/yellow highlights only."""
        
        if video_duration <= 10:
            duration_hint = "Very Short (0-10s)"
        elif video_duration <= 30:
            duration_hint = "Short (10-30s)"
        elif video_duration <= 60:
            duration_hint = "Medium (30-60s)"
        elif video_duration <= 120:
            duration_hint = "Long (60-120s)"
        else:
            duration_hint = "Extended (120s+)"
        
        script_section = ""
        if script_text:
            summarized_script = self._summarize_script(script_text)
            if summarized_script:
                script_section = (
                    "\nSCRIPT EXCERPT (use this verbatim when citing lines):\n"
                    f"{summarized_script}\n"
                )

        supers_section = ""
        if supers_texts:
            supers_lines = [
                f"- {text.strip()}"
                for text in supers_texts
                if isinstance(text, str) and text.strip()
            ]
            if supers_lines:
                supers_section = (
                    "\nON-SCREEN SUPERS / LEGAL COPY:\n"
                    + "\n".join(supers_lines[:10])
                    + "\n"
                )

        country_section = ""
        if audience_country:
            country_section = (
                "\nPRIMARY AIRING MARKET: " + audience_country + """
Tailor cultural insights, risks, and simulated audience reactions to this market. Cite any country-specific compliance nuances when relevant.
"""
            )
        
        benchmarks_section = ""
        if rag_context:
            benchmarks_section = f"\n{rag_context}\n"
        
        prompt = """Analyze this video/advertisement and provide a comprehensive breakdown in the following JSON structure:

The video is """ + str(video_duration) + """ seconds long.

Mode: """ + detail_level.upper() + """.
""" + mode_hint + """
""" + country_section + """
""" + benchmarks_section + """

CRITICAL: First identify WHAT is being advertised/promoted. Be specific about the product, service, or brand.

IMPORTANT: When citing evidence in `evidence_text`, refer to specific frames if applicable using the format `[Frame X]`. For example: "The logo appears clearly in the top right corner [Frame 1]" or "The disclaimer text is too small [Frame 9]". The frames provided correspond to [Frame 1] through [Frame 10].

""" + script_section + supers_section + """

{
    "breakdown": {
        "what_is_advertised": "Specific product/service/brand being promoted",
        "product_category": "e.g., FMCG/Retail/Entertainment/Finance/Automotive/Technology/Healthcare/Travel",
        "product_subcategory": "More specific category (e.g., 'Snacks', 'Personal Care', 'Streaming Service')",
        "brand_name": "The brand name if identifiable",
        "specific_product": "The specific product or service (e.g., 'iPhone 15 Pro', 'Big Mac', 'Toyota Camry 2024')",
        "content_type": "Advertisement/Promotional/Educational/Entertainment/etc",
        "duration_category": """ + '"' + duration_hint + '"' + """,
        "key_elements": ["list of main visual/audio elements"],
        "narrative_structure": "description of story flow",
        "target_audience": "identified target demographic",
        "production_quality": "Low/Medium/High with brief explanation",
        "key_messages": ["main messages conveyed"],
        "call_to_action": "identified CTA if any",
        "cta_clarity": "High/Medium/Low with short explanation",
        "suggested_improved_cta": "Improved CTA copy if clarity is low",
        "identification_confidence": 0-100,
        "possible_alternatives": ["Alternate interpretation if confidence is low"]
    },
    
    "creative_profile": {
        "format_type": "testimonial/demo/lifestyle/narrative/montage/comparison/celebrity/animation/documentary/vox-pop",
        "editing_pace": "slow/medium/fast",
        "colour_mood": "warm/cool/neutral/vibrant/muted/dark/bright",
        "music_style": "upbeat/emotional/dramatic/ambient/none/licensed-track/jingle",
        "overall_structure": "problem-solution/before-after/slice-of-life/testimonial/product-demo/brand-anthem/storytelling/call-to-action",
        "objective": "awareness/consideration/conversion/retention",
        "funnel_stage": "top/middle/bottom",
        "primary_kpi": "reach/engagement/traffic/leads/sales/app-installs"
    },
    
    "content_indicators": {
        "has_voiceover": true,
        "has_dialogue": false,
        "has_on_screen_text": true,
        "has_supers": true,
        "has_price_claims": false,
        "has_risk_disclaimer": false,
        "has_celeb": false,
        "has_ugc_style": false,
        "has_humor": false,
        "has_animals": false,
        "has_children": false,
        "has_story_arc": false,
        "uses_nostalgia": false,
        "uses_cultural_moment": false,
        "has_music_with_lyrics": false,
        "regulator_sensitive": false,
        "regulator_categories": ["none"]
    },
    
    "impact_scores": {
        "overall_impact": 7.5,
        "pulse_score": 8.0,
        "echo_score": 6.5,
        "hook_power": 7.0,
        "brand_integration": 6.5,
        "emotional_resonance": 7.0,
        "clarity_score": 8.0,
        "distinctiveness": 6.0,
        "reasoning": {
            "overall_impact": "Brief explanation of overall ad impact (clarity, persuasion, creative strength)",
            "pulse_score": "Brief explanation of immediate engagement and conversion potential",
            "echo_score": "Brief explanation of memorability and brand recall potential",
            "hook_power": "How effectively the opening grabs attention",
            "brand_integration": "How well the brand is woven into the narrative",
            "emotional_resonance": "Depth of emotional connection created",
            "clarity_score": "How clear the message and CTA are",
            "distinctiveness": "How unique and differentiated the creative is"
        }
    },
    
    "memorable_elements": {
        "hook": "Description of the opening hook that grabs attention (first 3 seconds)",
        "hook_strength": "strong/medium/weak",
        "distinctive_assets": ["List of distinctive brand assets shown (logo, jingle, mascot, color, tagline)"],
        "emotional_peaks": ["Key emotional moments with timestamps (e.g., 'Heartwarming family moment at 0:15')"],
        "cta_memorability": "strong/medium/weak"
    },
    
    "estimated_outcome": {
        "primary_goal": "Drive Sales/Brand Awareness/Education/Entertainment/etc",
        "effectiveness_score": 0-100,
        "reasoning": "explanation of score",
        "score_rationale": ["bullet reason 1", "bullet reason 2"]
    },
    
    "green_highlights": [
        {
            "aspect": "What's working well",
            "explanation": "Why it's effective",
            "impact": "High/Medium/Low",
            "evidence_text": "Exact quote or visual reference proving this strength [Frame X]"
        }
    ],
    
    "yellow_highlights": [
        {
            "aspect": "What could be improved",
            "what_exists_now": "Describe EXACTLY what the ad currently does for this element",
            "why_its_insufficient": "Why the current approach falls short - be specific about the gap",
            "suggestion": "Specific improvement recommendation that is DIFFERENT from what already exists",
            "fix_guidance": "Step-by-step actionable instructions on how to fix this issue",
            "expected_uplift": "What improvement this change would likely achieve",
            "priority": "High/Medium/Low",
            "evidence_text": "Exact quote or visual reference showing the weakness [Frame X]"
        }
    ],
    
    "soft_risks": [
        {
            "risk": "Potential viewer confusion",
            "impact": "High/Medium/Low",
            "mitigation": "Specific mitigation tip",
            "evidence_text": "Supporting quote / observation"
        }
    ],
    
    "audience_reactions": [
        {
            "full_name": "Amara Okonkwo",
            "persona": "Marketing Executive",
            "gender": "Female",
            "age_range": "28",
            "race_ethnicity": "Black British",
            "location": "London, UK",
            "occupation": "Senior Digital Marketing Manager at a fintech startup",
            "background_story": "Amara moved to London from Birmingham after graduating from Manchester Business School. She lives in Hackney with her partner and their cat, juggling a demanding career while training for her first marathon.",
            "interests": ["Running", "Sustainable fashion", "Podcasts", "Brunch culture", "Investing"],
            "daily_routine": "Early morning gym sessions, commutes via Northern Line while catching up on marketing newsletters, leads team standups, works late on campaign analytics",
            "pain_points": ["Work-life balance", "Information overload", "Finding authentic brands"],
            "reaction": "Detailed emotional reaction to the ad from their unique perspective",
            "engagement_level": "High/Medium/Low",
            "likely_action": "What they would do after viewing",
            "fit": "HIGH",
            "key_concern": "Optional risk or objection",
            "resonance_elements": ["hook", "music", "product_shot"],
            "engagement_drivers": ["Relatable lifestyle", "Aspirational messaging"],
            "conversion_blockers": [],
            "suggested_questions": [
                "What would make you actually buy this product?",
                "How does this compare to brands you currently use?",
                "What would you tell your friends about this ad?",
                "What's missing from this ad that would convince you?"
            ]
        }
    ],
    
    "ad_elements": {
        "hook": {"description": "Opening 3 seconds description", "strength": 1-10},
        "message": {"description": "Core message/value proposition", "strength": 1-10},
        "cta": {"description": "Call to action description", "strength": 1-10},
        "music": {"description": "Music/audio mood", "strength": 1-10},
        "visuals": {"description": "Visual style description", "strength": 1-10},
        "product_shot": {"description": "Product visibility description", "strength": 1-10},
        "emotion": {"description": "Emotional appeal type", "strength": 1-10},
        "humor": {"description": "Humor element if present", "strength": 1-10}
    },
    
    "competitive_context": {
        "likely_competitors": ["Brand 1", "Brand 2", "Brand 3"],
        "differentiation_strength": "High/Medium/Low",
        "suggested_positioning": "How this ad could better differentiate from competitors"
    },
    
    "ab_test_suggestions": [
        {
            "element": "The specific element to test (e.g., CTA text, opening shot, music)",
            "current": "What the ad currently has",
            "alternative": "What to test against",
            "hypothesis": "Expected improvement and reasoning"
        }
    ],
    
    "effectiveness_drivers": {
        "strengths": [
            {"factor": "Strong emotional hook", "evidence": "Opening scene creates immediate connection", "impact": "High"}
        ],
        "weaknesses": [
            {"factor": "Unclear CTA", "evidence": "Call to action buried at end", "suggested_fix": "Move CTA earlier and make more prominent"}
        ]
    },
    
    "hero_analysis": {
        "audio_profile": {
            "music_mood": "Description of music mood (e.g., 'Intense, epic, driving')",
            "music_style": "orchestral_cinematic/pop/rock/electronic/acoustic/hip_hop/classical/ambient/jingle/none",
            "vocal_profile": "Description of voiceover/dialogue style and delivery",
            "music_brand_fit": "How well the music matches the brand positioning",
            "notable_sound_design": ["List of notable sound effects or audio moments"]
        },
        "emotional_arc": [
            {
                "emotion": "Primary emotion in this segment",
                "time_window": "0-5s",
                "tension_curve": "building/peak/release/flat",
                "emotional_hook": "Description of what creates the emotional response"
            }
        ],
        "overall_score": 0-100,
        "cinematography": {
            "colour_palette": ["List of dominant colors (e.g., 'Deep Blue', 'Warm Orange')"],
            "lighting_style": "Description of lighting approach and mood",
            "shot_breakdown": [
                {
                    "time_window": "0-5s",
                    "pacing": "Description of shot pacing",
                    "composition": "Description of visual composition",
                    "camera_moves": ["static", "pan", "zoom", "tracking", "handheld"],
                    "transitions": ["cut", "dissolve", "wipe", "fade"]
                }
            ],
            "production_quality": "premium/standard/budget/ugc",
            "notable_transitions": ["List of standout transition moments with timestamps"]
        },
        "visual_patterns": {
            "packshots": ["List of product shot moments (e.g., 'End card at 25s')"],
            "logo_usage": "hero_moment/subtle/frequent/bookend/none",
            "recurring_motifs": ["List of repeated visual elements"],
            "hero_product_framing": "in_use/isolated/lifestyle/abstract",
            "distinctive_visual_style": "Description of unique visual identity"
        },
        "creative_tactics": {
            "hook_type": "question/action/emotion/curiosity/social_proof/celebrity/humor/shock",
            "cta_framing": "Description of how CTA is presented",
            "pattern_breaks": ["List of unexpected moments that grab attention"],
            "brand_reveal_style": "early/woven_throughout/late_reveal/bookend",
            "persuasion_techniques": ["social_proof", "authority", "scarcity", "reciprocity", "liking", "commitment"],
            "humour_or_drama_devices": ["List of comedic or dramatic techniques used"]
        },
        "effectiveness_drivers": {
            "brand_linkage": "strong/moderate/weak",
            "primary_strength": "Description of the ad's main creative strength",
            "memorable_moments": ["List of most memorable scenes/moments"],
            "target_audience_fit": "Description of how well the ad matches its intended audience"
        }
    },
    
    "storyboards": [
        {
            "shot_index": 0,
            "start_time": 0.0,
            "end_time": 2.5,
            "shot_label": "Brief label for this shot (e.g., 'Opening hook', 'Product reveal')",
            "description": "Detailed description of what happens in this shot",
            "camera_style": "static_wide/tracking/handheld_close/aerial/pov/animation",
            "location_hint": "Setting description (e.g., 'urban_street', 'studio_white', 'home_kitchen')",
            "key_objects": ["List of important objects/subjects in frame"],
            "on_screen_text": "Any text overlays shown (null if none)",
            "mood": "Emotional tone of this shot (e.g., 'energetic', 'contemplative', 'urgent')",
            "audio_element": "VO/music/SFX/dialogue/silence",
            "transition_out": "cut/dissolve/fade/wipe/match_cut"
        }
    ],
    
    "brand_asset_timeline": {
        "mentions": [
            {
                "t_s": 0.0,
                "type": "verbal/visual/sonic/text",
                "context": "Description of how the brand appears (e.g., 'Logo in corner', 'VO mentions brand')",
                "prominence": "prominent/subtle/background"
            }
        ],
        "logo_appearances": [
            {"t_s": 0.0, "duration_s": 2.0, "position": "center/corner/fullscreen", "style": "static/animated"}
        ],
        "first_appearance_s": 0.0,
        "first_appearance_type": "logo/name_mention/product_shot/tagline",
        "tagline_used": "The brand tagline if present (null if none)",
        "tagline_timestamp_s": null,
        "brand_frequency_score": 8.0,
        "total_screen_time_pct": 0.15,
        "sonic_branding_present": false,
        "brand_integration_naturalness": 7.5,
        "late_reveal": false
    },
    
    "audio_fingerprint": {
        "music": {
            "present": true,
            "type": "licensed/original/stock/none",
            "genre": "Description of music genre (e.g., 'orchestral rock / action score')",
            "has_lyrics": false,
            "bpm_estimate": 120,
            "energy_curve": "steady/building/peaks_and_valleys/decreasing",
            "emotional_fit": 8.0
        },
        "voiceover": {
            "present": true,
            "gender": "male/female/mixed",
            "age_vibe": "young/middle/mature",
            "tone": "authoritative/friendly/urgent/calm/humorous",
            "accent": "Description of accent (e.g., 'British RP', 'American neutral')",
            "pace": "slow/medium/fast",
            "energy": "low/medium/high/energetic"
        },
        "dialogue": {
            "present": false,
            "style": "scripted/natural/improvised",
            "key_lines": ["Notable dialogue quotes"]
        },
        "sfx": {
            "present": true,
            "notable_sounds": ["List of distinctive sound effects"]
        },
        "silence_moments": [{"t_s": 0.0, "duration_s": 1.0, "purpose": "dramatic_pause/transition"}],
        "audio_quality_score": 8.5
    },
    
    "emotional_timeline": {
        "readings": [
            {
                "t_s": 0.0,
                "dominant_emotion": "joy/surprise/trust/anticipation/sadness/fear/anger/disgust/neutral/excitement/nostalgia/tension/relief/pride/empathy",
                "secondary_emotion": "Optional secondary emotion or null",
                "intensity": 0.7,
                "valence": 0.5,
                "arousal": 0.6,
                "trigger": "visual/audio/dialogue/music/pacing/reveal"
            }
        ],
        "emotional_transitions": [
            {
                "from_emotion": "neutral",
                "to_emotion": "excitement",
                "transition_time_s": 3.5,
                "transition_type": "gradual/sudden/contrast",
                "effectiveness": 0.8
            }
        ],
        "emotional_metrics": {
            "arc_shape": "peak_early/peak_middle/peak_late/flat/roller_coaster",
            "peak_moment_s": 15.0,
            "peak_emotion": "excitement",
            "trough_moment_s": 2.0,
            "trough_emotion": "neutral",
            "emotional_range": 0.6,
            "final_viewer_state": "joy",
            "average_intensity": 0.65,
            "positive_ratio": 0.75
        }
    },
    
    "brain_balance": {
        "emotional_score": 65,
        "rational_score": 35,
        "dominant_mode": "emotional/rational/balanced",
        "emotional_drivers": ["List of emotional appeals: storytelling, music, humor, nostalgia, fear, aspiration, etc."],
        "rational_drivers": ["List of rational appeals: features, price, statistics, testimonials, guarantees, etc."],
        "balance_assessment": "Brief assessment of whether the balance is appropriate for the product category and target audience"
    },

    "toxicity_assessment": {
        "overall_score": 0-100,
        "risk_level": "LOW/MEDIUM/HIGH",
        "physiological_concerns": {
            "score": 0-100,
            "flags": ["List of sensory assault concerns: rapid cuts, extreme loudness, flashing, photosensitivity risk, motion sickness risk"],
            "evidence": ["Evidence with timestamps for each flag"]
        },
        "psychological_concerns": {
            "score": 0-100,
            "manipulation_tactics": ["List of detected manipulation tactics: fear appeals, false urgency, social pressure, misleading claims"],
            "dark_patterns": ["List of dark patterns: scarcity tricks, emotional manipulation, FOMO, authority appeals"],
            "evidence": ["Evidence with timestamps for each tactic"]
        },
        "regulatory_concerns": {
            "score": 0-100,
            "missing_disclaimers": ["List of disclaimers that should be present but may be missing"],
            "compliance_risks": ["List of potential regulatory issues"],
            "evidence": ["Evidence with timestamps for each concern"]
        },
        "recommendation": "Brief recommendation on how to reduce toxicity if score is high"
    },

    "speech_analysis": {
        "words_per_minute": 0-250,
        "clarity_score": 0-10,
        "vocal_variety": {
            "pitch_range": "monotone/moderate/dynamic",
            "pace_variation": "steady/varied/erratic",
            "emphasis_moments": [{"timestamp": "0:05", "word": "keyword", "effect": "urgency/clarity/emotion"}]
        },
        "silence_ratio": 0.0-1.0,
        "speech_overlap_detected": true/false,
        "accent_clarity": "clear/moderate/challenging",
        "speaker_count": 1,
        "primary_speaker_gender": "male/female/mixed/none",
        "speech_density_assessment": "Brief assessment of whether speech pacing is appropriate for the ad format and audience"
    },

    "visual_attention_analysis": {
        "primary_focus_areas": ["product", "face", "text", "logo", "action"],
        "attention_flow": "Description of how viewer attention naturally flows through the ad - where eyes are drawn first, second, etc.",
        "legal_text_visibility_score": 0-10,
        "brand_visibility_score": 0-10,
        "cta_visibility_score": 0-10,
        "visual_hierarchy_assessment": "clear/moderate/cluttered",
        "key_attention_moments": [
            {"timestamp": "0:03", "focus_element": "product_reveal", "attention_grab_strength": "high/medium/low"}
        ]
    },

    "color_analysis": {
        "dominant_colors": [
            {"color": "#hexcode", "name": "color_name", "percentage": 25, "emotion": "urgency/calm/trust/energy/etc"}
        ],
        "color_harmony": "complementary/analogous/triadic/monochromatic/split-complementary/none",
        "brand_color_consistency": 0-10,
        "emotional_temperature": "warm/cool/neutral/mixed",
        "contrast_accessibility": {
            "text_contrast_ratio": 4.5,
            "passes_aa": true/false,
            "passes_aaa": true/false
        },
        "color_psychology_assessment": "How the color choices support or detract from the ad's emotional goals"
    },

    "temporal_flow": {
        "information_density_curve": [
            {"segment": "0:00-0:05", "density": "high/medium/low", "elements": ["hook", "brand", "product"]}
        ],
        "scene_count": 0,
        "average_scene_duration_seconds": 0.0,
        "cut_frequency": "slow/moderate/fast/rapid",
        "fatigue_risk_score": 0-10,
        "breathing_room_moments": [
            {"timestamp": "0:12-0:14", "type": "pause/slow_motion/silence", "purpose": "let message land/build anticipation"}
        ],
        "cta_timing": {
            "first_cta_timestamp": "0:22",
            "cta_screen_time_seconds": 3.0,
            "cta_placement": "early/middle/end/throughout"
        },
        "pacing_assessment": "Brief assessment of whether pacing supports message retention and emotional impact"
    },

    "claims_analysis": {
        "claims": [
            {
                "claim_text": "The exact claim made",
                "claim_type": "efficacy/safety/comparative/environmental/financial/performance",
                "timestamp": "0:08",
                "evidence_provided": {
                    "type": "none/implied/stated/visual/disclaimer",
                    "description": "Description of any evidence or substantiation shown",
                    "visibility_score": 0-10
                },
                "substantiation_required": true/false,
                "regulatory_risk": "high/medium/low",
                "suggested_evidence": "What evidence should be added if missing"
            }
        ],
        "total_claims_count": 0,
        "substantiated_claims_count": 0,
        "substantiation_ratio": 0.0,
        "highest_risk_claim": "Reference to the most problematic claim if any",
        "claims_assessment": "Overall assessment of claim credibility and regulatory risk"
    },

    "summary": "Comprehensive summary of the video's strengths, weaknesses, and overall effectiveness. Start by clearly stating what is being advertised.",
    
    "one_sentence_summary": "Punchy, executive-ready summary in one sentence."
}

CRITICAL FORMATTING RULES:
1. Include `evidence_text` for EVERY `green_highlights`, `yellow_highlights`, and `soft_risks` entry - quote the script or describe the visual.
2. For EVERY evidence_text, append "[Frame X]" where X is the frame number (1-indexed) where this occurs.
3. SWOT ANALYSIS CRITICAL RULES:
   GREEN_HIGHLIGHTS (Strengths) - Provide 5-8 items:
   - Be THOROUGH - analyze hook, visuals, audio, messaging, pacing, brand integration, emotional appeal, CTA
   - Include evidence_text with [Frame X] for EVERY strength
   - Rate impact as High/Medium/Low based on contribution to ad effectiveness
   - Pick the ad apart - even minor effective elements deserve recognition

   YELLOW_HIGHLIGHTS (Improvements) - Provide 5-8 items:
   - CROSS-CHECK RULE: Before writing ANY yellow highlight, mentally compare it to ALL green_highlights. If similar content exists in green_highlights, DO NOT include it
   - NEVER recommend something that ALREADY EXISTS in the ad - if the ad already has good music, don't suggest "add music"
   - ALWAYS describe what the ad CURRENTLY does (what_exists_now) before suggesting improvements
   - Be specific about the GAP between current state and ideal state (why_its_insufficient)
   - The suggestion MUST be genuinely DIFFERENT from what is already present
   - Include expected_uplift to quantify potential improvement
   - Include specific `fix_guidance` with actionable steps to address the issue
   - Analyze hook timing, CTA clarity, brand visibility, pacing issues, audio balance, visual hierarchy, messaging gaps
4. `audience_reactions` must contain exactly 12 NAMED INDIVIDUALS (not archetypes) with this distribution:
   - 3 HIGH-fit advocates (different demographics, all love the ad)
   - 3 LOW-fit skeptics (different demographics, various objections)
   - 6 MEDIUM-fit personas (varied demographics, mixed reactions)
   CRITICAL PERSONA RULES:
   - Each persona MUST be a SPECIFIC NAMED PERSON with a realistic first and last name appropriate to their ethnicity
   - `full_name`: Full realistic name (e.g., "Marcus Thompson", "Priya Sharma", "Chen Wei")
   - `persona`: Their profession/role (e.g., "Software Developer", "Retired Teacher", "University Student")
   - `age_range`: Specific age as a number (e.g., "34", "67", "22"), NOT a range
   - `location`: ALL personas MUST be from the PRIMARY AIRING MARKET specified above. Use specific cities/regions.
   - `occupation`: Detailed job description (e.g., "Junior UX Designer at a Birmingham design agency")
   - `background_story`: 2-3 sentences about their life, history, and current situation
   - `interests`: Array of 4-6 specific hobbies and interests
   - `daily_routine`: Brief description of their typical day
   - `pain_points`: Array of 2-4 problems or frustrations they face
   - `suggested_questions`: Array of 3-4 questions a MARKETER would ask THIS SPECIFIC PERSONA to understand their perspective on the ad. These must be:
     * Phrased as direct questions TO the persona (e.g., "What would make you trust this brand?")
     * NOT questions about marketing strategy (avoid: "Are you running this on TikTok?")
     * Personal and relevant to the persona's life, job, or pain points
     * Example good questions: "What would convince you to try this product?", "Does this ad speak to your daily challenges?", "What's missing that would make you take action?"
   - Do NOT include social_share_likelihood or watch_completion_estimate
5. `ad_elements` must map the key elements of the ad with strength scores (1-10).
6. Include `competitive_context` analyzing the competitive landscape and differentiation.
7. Include at least 2-3 `ab_test_suggestions` for elements that could be tested to improve performance.
8. `creative_profile` fields must use ONLY the exact values specified (e.g., format_type must be one of: testimonial/demo/lifestyle/narrative/montage/comparison/celebrity/animation/documentary/vox-pop).
9. `impact_scores` must be numbers on a 0-10 scale (e.g., 7.5). All 8 metrics required: overall_impact, pulse_score, echo_score, hook_power, brand_integration, emotional_resonance, clarity_score, distinctiveness.
10. `content_indicators` must be boolean values (true/false) based on what is observed in the video. Pay special attention to has_supers (legal text overlays), has_price_claims (any pricing/discount mentions), and has_risk_disclaimer.
11. `memorable_elements.emotional_peaks` should include timestamps where key emotional moments occur.
12. `effectiveness_drivers` must list specific strengths and weaknesses with evidence and impact ratings.
13. `breakdown.brand_name` and `breakdown.product_category` are REQUIRED - identify these from logos, packaging, voiceover, or supers.
14. `hero_analysis` must provide deep creative analysis:
    - `audio_profile.music_style` must be one of: orchestral_cinematic/pop/rock/electronic/acoustic/hip_hop/classical/ambient/jingle/none
    - `emotional_arc` should have 3-5 segments covering the full ad duration
    - `cinematography.shot_breakdown` should identify 3-6 distinct visual segments
    - `visual_patterns.logo_usage` must be one of: hero_moment/subtle/frequent/bookend/none
    - `creative_tactics.hook_type` must be one of: question/action/emotion/curiosity/social_proof/celebrity/humor/shock
15. `storyboards` must contain 5-15 shots covering the entire video:
    - Each shot should have accurate start_time and end_time in seconds
    - `camera_style` must be one of: static_wide/tracking/handheld_close/aerial/pov/animation/close_up/medium
    - Include on_screen_text for any supers/titles shown
    - Shots should be sequential and cover the full duration
16. `brand_asset_timeline` tracks all brand appearances:
    - `mentions[].type` must be one of: verbal/visual/sonic/text
    - `first_appearance_type` must be one of: logo/name_mention/product_shot/tagline
    - `brand_frequency_score` is 0-10 scale for how often brand appears
17. `audio_fingerprint` provides detailed audio analysis:
    - `music.type` must be one of: licensed/original/stock/none
    - `music.energy_curve` must be one of: steady/building/peaks_and_valleys/decreasing
    - `voiceover.tone` must be one of: authoritative/friendly/urgent/calm/humorous
18. `emotional_timeline` MUST have granular readings every 1-2 seconds:
    - For a 30-second ad, provide ~20 readings
    - `dominant_emotion` must be one of: joy/surprise/trust/anticipation/sadness/fear/anger/disgust/neutral/excitement/nostalgia/tension/relief/pride/empathy
    - `trigger` must be one of: visual/audio/dialogue/music/pacing/reveal
    - Include 2-5 `emotional_transitions` for significant emotion shifts
    - `arc_shape` must be one of: peak_early/peak_middle/peak_late/flat/roller_coaster
19. `brain_balance` must provide emotional vs rational analysis:
    - `emotional_score` and `rational_score` should sum to 100
    - `dominant_mode` must be one of: emotional/rational/balanced (balanced if within 40-60 split)
    - List specific emotional and rational drivers identified in the ad
20. `speech_analysis` analyzes voiceover/dialogue delivery:
    - `words_per_minute`: Normal speech is 120-150 WPM, fast is 180+
    - `pitch_range` must be one of: monotone/moderate/dynamic
    - `pace_variation` must be one of: steady/varied/erratic
    - `accent_clarity` must be one of: clear/moderate/challenging
    - Include `emphasis_moments` for key words that stand out
21. `visual_attention_analysis` tracks where viewer eyes are drawn:
    - `visual_hierarchy_assessment` must be one of: clear/moderate/cluttered
    - Score legal text, brand, and CTA visibility separately (0-10)
    - `attention_flow` should describe the natural eye-tracking path through the ad
22. `color_analysis` examines color psychology:
    - List 3-5 dominant colors with hex codes, percentages, and emotional associations
    - `color_harmony` must be one of: complementary/analogous/triadic/monochromatic/split-complementary/none
    - `emotional_temperature` must be one of: warm/cool/neutral/mixed
    - Check contrast accessibility (WCAG AA requires 4.5:1 ratio for normal text)
23. `temporal_flow` analyzes pacing and information density:
    - Divide ad into segments and rate density as high/medium/low
    - `cut_frequency` must be one of: slow/moderate/fast/rapid
    - Identify breathing room moments that let messages land
    - Track CTA timing and screen time
24. `claims_analysis` tracks all product/service claims:
    - `claim_type` must be one of: efficacy/safety/comparative/environmental/financial/performance
    - `evidence_provided.type` must be one of: none/implied/stated/visual/disclaimer
    - Rate `regulatory_risk` as high/medium/low
    - Calculate `substantiation_ratio` = substantiated_claims_count / total_claims_count

Analyze the video frames thoroughly. MOST IMPORTANTLY: Identify exactly what product, service, or brand is being advertised. Look for:
- Brand logos and names
- Product shots and packaging
- Service demonstrations
- Company branding elements

If your identification confidence is below 70%, include at least two plausible alternative ads/brands in `possible_alternatives` with a short note why they might fit. Flag any soft risks (messaging confusion, tonal mismatches, compliance concerns) with impact and mitigation guidance. Finish with a single-sentence executive summary.
Be specific and actionable in your recommendations."""

        return prompt

    def _parse_gemini_response_robust(self, response_text: str) -> Tuple[Dict, Dict]:
        """
        Parse Gemini response with detailed error tracking and recovery.

        Attempts direct JSON parsing first, then falls back to section-by-section
        recovery if the full parse fails. This ensures we capture as much data
        as possible even when Gemini returns malformed JSON.

        Returns:
            Tuple of (parsed_data, parsing_report)
        """
        parsing_report = {
            "success": False,
            "method": "direct",
            "recovered_keys": [],
            "missing_keys": [],
            "malformed_sections": [],
            "error_details": None
        }

        # Step 1: Try direct JSON parse
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                parsing_report["success"] = True
                parsing_report["method"] = "direct"

                # Check which expected keys are present
                for key in EXPECTED_RESPONSE_KEYS:
                    if key not in data:
                        parsing_report["missing_keys"].append(key)

                if parsing_report["missing_keys"]:
                    logger.debug(f"Direct parse successful but missing {len(parsing_report['missing_keys'])} optional keys")

                return data, parsing_report
        except json.JSONDecodeError as e:
            parsing_report["error_details"] = f"Position {e.pos}: {e.msg}"
            logger.warning(f"Direct JSON parse failed: {parsing_report['error_details']}")

        # Step 2: Attempt section-by-section recovery
        parsing_report["method"] = "recovery"
        data = {}

        for key in EXPECTED_RESPONSE_KEYS:
            try:
                # Pattern for object values (handles nested objects)
                obj_pattern = rf'"{key}"\s*:\s*(\{{(?:[^{{}}]|\{{[^{{}}]*\}})*\}})'
                # Pattern for array values (handles nested arrays)
                arr_pattern = rf'"{key}"\s*:\s*(\[(?:[^\[\]]|\[[^\[\]]*\])*\])'
                # Pattern for string values
                str_pattern = rf'"{key}"\s*:\s*("(?:[^"\\]|\\.)*")'
                # Pattern for number values
                num_pattern = rf'"{key}"\s*:\s*(-?\d+(?:\.\d+)?)'
                # Pattern for boolean values
                bool_pattern = rf'"{key}"\s*:\s*(true|false)'
                # Pattern for null values
                null_pattern = rf'"{key}"\s*:\s*(null)'

                recovered = False
                for pattern in [obj_pattern, arr_pattern, str_pattern, num_pattern, bool_pattern, null_pattern]:
                    match = re.search(pattern, response_text, re.IGNORECASE)
                    if match:
                        try:
                            data[key] = json.loads(match.group(1))
                            parsing_report["recovered_keys"].append(key)
                            recovered = True
                            break
                        except json.JSONDecodeError:
                            continue

                if not recovered:
                    parsing_report["missing_keys"].append(key)

            except Exception as e:
                parsing_report["malformed_sections"].append(key)
                logger.debug(f"Failed to recover key '{key}': {e}")

        parsing_report["success"] = len(data) > 0

        # Log summary
        if parsing_report["recovered_keys"]:
            logger.info(f"JSON recovery: recovered {len(parsing_report['recovered_keys'])} of {len(EXPECTED_RESPONSE_KEYS)} keys")
        if parsing_report["malformed_sections"]:
            logger.warning(f"JSON recovery: {len(parsing_report['malformed_sections'])} malformed sections: {parsing_report['malformed_sections']}")

        return data, parsing_report

    def _parse_response(
        self,
        response_text: str,
        script_text: Optional[str] = None,
        supers_texts: Optional[List[str]] = None,
        audience_country: Optional[str] = None,
    ) -> Dict:
        """Parse the AI response into structured format with robust error recovery."""
        # Use robust parsing with section-by-section recovery
        parsed, parsing_report = self._parse_gemini_response_robust(response_text)

        # Store parsing report for debugging/diagnostics
        if parsing_report:
            parsed["_parsing_report"] = parsing_report

        if not parsing_report["success"]:
            logger.error(f"JSON parsing failed completely: {parsing_report}")
            fallback = self._create_fallback_response(response_text)
            fallback["_parsing_report"] = parsing_report
            return fallback

        # Log if we used recovery mode
        if parsing_report["method"] == "recovery":
            logger.warning(
                f"Used JSON recovery mode: recovered {len(parsing_report['recovered_keys'])} keys, "
                f"missing {len(parsing_report['missing_keys'])} keys"
            )

        # Apply standard default ensuring
        parsed, breakdown_missing = self._ensure_breakdown_defaults(parsed)
        parsed, response_missing = self._ensure_response_defaults(
            parsed,
            script_text=script_text,
        )
        if audience_country:
            parsed.setdefault("audience_context", {})["airing_country"] = audience_country

        # Apply text-based heuristics to validate/repair content indicators
        self._apply_content_indicator_heuristics(
            parsed,
            script_text=script_text,
            supers_texts=supers_texts,
        )

        missing_fields = breakdown_missing + response_missing
        if missing_fields:
            logger.warning(f"AI breakdown missing fields: {', '.join(sorted(set(missing_fields)))}")

        # Move parsing report to debug section for cleaner output
        if "_parsing_report" in parsed:
            parsed.setdefault("debug", {})["parsing_report"] = parsed.pop("_parsing_report")

        return parsed
    
    def _ensure_breakdown_defaults(self, parsed: Dict) -> Tuple[Dict, List[str]]:
        """Ensure new breakdown metadata fields are always present.
        
        Aligns with TellyAds v2.0 core_metadata fields for consistency.
        """
        missing_fields: List[str] = []
        breakdown = parsed.setdefault("breakdown", {})
        
        # --- TellyAds core_metadata alignment ---
        # Ensure brand_name is always a string
        if not isinstance(breakdown.get("brand_name"), str):
            breakdown["brand_name"] = ""
            missing_fields.append("breakdown.brand_name")
        
        # product_name maps to specific_product in our schema
        if not isinstance(breakdown.get("specific_product"), str):
            breakdown["specific_product"] = ""
            missing_fields.append("breakdown.specific_product")
        # Also store as product_name for TellyAds compatibility
        breakdown["product_name"] = breakdown.get("specific_product") or breakdown.get("what_is_advertised", "")
        
        # product_category - ensure it's a valid string
        if not isinstance(breakdown.get("product_category"), str):
            breakdown["product_category"] = "Unknown"
            missing_fields.append("breakdown.product_category")
        
        # product_subcategory
        if not isinstance(breakdown.get("product_subcategory"), str):
            breakdown["product_subcategory"] = ""
            missing_fields.append("breakdown.product_subcategory")
        
        # country - infer from audience_context if available
        if not isinstance(breakdown.get("country"), str):
            audience_ctx = parsed.get("audience_context", {})
            breakdown["country"] = audience_ctx.get("airing_country", "")
        
        # language - default to English if not specified
        if not isinstance(breakdown.get("language"), str):
            breakdown["language"] = "English"
        
        # year - can be inferred from analysis date if not in video
        if not isinstance(breakdown.get("year"), int):
            from datetime import datetime
            breakdown["year"] = datetime.now().year
        
        # --- Existing fields ---
        confidence = breakdown.get("identification_confidence")
        if isinstance(confidence, (int, float)):
            breakdown["identification_confidence"] = max(0.0, min(100.0, float(confidence)))
        else:
            breakdown["identification_confidence"] = 0
        
        alternatives = breakdown.get("possible_alternatives")
        if isinstance(alternatives, list):
            cleaned = [str(alt).strip() for alt in alternatives if str(alt).strip()]
            breakdown["possible_alternatives"] = cleaned
        else:
            breakdown["possible_alternatives"] = []
            missing_fields.append("breakdown.possible_alternatives")
        
        if not isinstance(breakdown.get("key_elements"), list):
            breakdown["key_elements"] = []
            missing_fields.append("breakdown.key_elements")
        if not isinstance(breakdown.get("key_messages"), list):
            breakdown["key_messages"] = []
            missing_fields.append("breakdown.key_messages")
        if not isinstance(breakdown.get("narrative_structure"), str):
            breakdown["narrative_structure"] = ""
            missing_fields.append("breakdown.narrative_structure")
        if not isinstance(breakdown.get("cta_clarity"), str):
            breakdown["cta_clarity"] = "Unknown"
            missing_fields.append("breakdown.cta_clarity")
        if not isinstance(breakdown.get("suggested_improved_cta"), str):
            breakdown["suggested_improved_cta"] = ""
            missing_fields.append("breakdown.suggested_improved_cta")
        
        # what_is_advertised - ensure it's present
        if not isinstance(breakdown.get("what_is_advertised"), str):
            breakdown["what_is_advertised"] = ""
            missing_fields.append("breakdown.what_is_advertised")
        
        # target_audience
        if not isinstance(breakdown.get("target_audience"), str):
            breakdown["target_audience"] = ""
            missing_fields.append("breakdown.target_audience")
        
        # call_to_action
        if not isinstance(breakdown.get("call_to_action"), str):
            breakdown["call_to_action"] = ""
            missing_fields.append("breakdown.call_to_action")
        
        return parsed, missing_fields
    
    def _ensure_response_defaults(
        self,
        parsed: Dict,
        script_text: Optional[str] = None,
    ) -> Tuple[Dict, List[str]]:
        """Ensure non-breakdown sections exist with safe defaults.
        
        Aligns with TellyAds v2.0 schema for campaign_strategy, creative_flags,
        impact_scores, and effectiveness metrics.
        """
        missing_fields: List[str] = []
        
        # --- creative_profile (TellyAds campaign_strategy + creative_attributes) ---
        creative_profile = parsed.get("creative_profile")
        default_creative_profile = {
            "format_type": "unknown",
            "editing_pace": "medium",
            "colour_mood": "neutral",
            "music_style": "none",
            "overall_structure": "unknown",
            "objective": "awareness",
            "funnel_stage": "top",
            "primary_kpi": "reach",
        }
        if not isinstance(creative_profile, dict):
            parsed["creative_profile"] = default_creative_profile.copy()
            missing_fields.append("creative_profile")
        else:
            # Ensure all fields exist with valid values
            for key, default_val in default_creative_profile.items():
                if not isinstance(creative_profile.get(key), str):
                    creative_profile[key] = default_val
            parsed["creative_profile"] = creative_profile
        
        # --- content_indicators (TellyAds creative_flags) ---
        content_indicators = parsed.get("content_indicators")
        default_content_indicators = {
            "has_voiceover": False,
            "has_dialogue": False,
            "has_on_screen_text": False,
            "has_supers": False,
            "has_price_claims": False,
            "has_risk_disclaimer": False,
            "has_celeb": False,
            "has_ugc_style": False,
            "has_humor": False,
            "has_animals": False,
            "has_children": False,
            "has_story_arc": False,
            "uses_nostalgia": False,
            "uses_cultural_moment": False,
            "has_music_with_lyrics": False,
            "regulator_sensitive": False,
        }
        if not isinstance(content_indicators, dict):
            parsed["content_indicators"] = default_content_indicators.copy()
            missing_fields.append("content_indicators")
        else:
            # Ensure all flags are booleans
            for key, default_val in default_content_indicators.items():
                val = content_indicators.get(key)
                if not isinstance(val, bool):
                    content_indicators[key] = bool(val) if val is not None else default_val
            # Handle regulator_categories list separately
            if not isinstance(content_indicators.get("regulator_categories"), list):
                content_indicators["regulator_categories"] = ["none"]
            parsed["content_indicators"] = content_indicators
        
        # --- impact_scores (TellyAds impact_scores with expanded metrics) ---
        impact_scores = parsed.get("impact_scores")
        default_impact_scores = {
            "overall_impact": 5.0,
            "pulse_score": 5.0,
            "echo_score": 5.0,
            "hook_power": 5.0,
            "brand_integration": 5.0,
            "emotional_resonance": 5.0,
            "clarity_score": 5.0,
            "distinctiveness": 5.0,
            "reasoning": {},
        }
        if not isinstance(impact_scores, dict):
            parsed["impact_scores"] = default_impact_scores.copy()
            missing_fields.append("impact_scores")
        else:
            # Clamp numeric scores to 0-10 range
            for key in ["overall_impact", "pulse_score", "echo_score", "hook_power", 
                        "brand_integration", "emotional_resonance", "clarity_score", "distinctiveness"]:
                val = impact_scores.get(key)
                if isinstance(val, (int, float)):
                    impact_scores[key] = max(0.0, min(10.0, float(val)))
                else:
                    impact_scores[key] = default_impact_scores[key]
            # Ensure reasoning dict exists
            if not isinstance(impact_scores.get("reasoning"), dict):
                impact_scores["reasoning"] = {}
            parsed["impact_scores"] = impact_scores
        
        # --- memorable_elements ---
        memorable = parsed.get("memorable_elements")
        default_memorable = {
            "hook": "",
            "hook_strength": "medium",
            "distinctive_assets": [],
            "emotional_peaks": [],
            "cta_memorability": "medium",
        }
        if not isinstance(memorable, dict):
            parsed["memorable_elements"] = default_memorable.copy()
            missing_fields.append("memorable_elements")
        else:
            for key, default_val in default_memorable.items():
                if key in ["distinctive_assets", "emotional_peaks"]:
                    if not isinstance(memorable.get(key), list):
                        memorable[key] = default_val
                elif not isinstance(memorable.get(key), str):
                    memorable[key] = default_val
            parsed["memorable_elements"] = memorable
        
        # --- effectiveness_drivers (TellyAds effectiveness_drivers) ---
        effectiveness = parsed.get("effectiveness_drivers")
        if not isinstance(effectiveness, dict):
            parsed["effectiveness_drivers"] = {
                "strengths": [],
                "weaknesses": [],
            }
        else:
            if not isinstance(effectiveness.get("strengths"), list):
                effectiveness["strengths"] = []
            if not isinstance(effectiveness.get("weaknesses"), list):
                effectiveness["weaknesses"] = []
            parsed["effectiveness_drivers"] = effectiveness
        
        # --- estimated_outcome ---
        outcome = parsed.get("estimated_outcome")
        if not isinstance(outcome, dict):
            outcome = {
                "primary_goal": "Unknown",
                "effectiveness_score": 0,
                "reasoning": "No structured rationale provided"
            }
            parsed["estimated_outcome"] = outcome
            missing_fields.append("estimated_outcome")
        else:
            score = outcome.get("effectiveness_score")
            if isinstance(score, (int, float)):
                outcome["effectiveness_score"] = max(0.0, min(100.0, float(score)))
            else:
                outcome["effectiveness_score"] = 0
                missing_fields.append("estimated_outcome.effectiveness_score")
            # Remove expected_metrics if present (deprecated)
            outcome.pop("expected_metrics", None)
        rationale = outcome.get("score_rationale")
        if isinstance(rationale, list):
            cleaned_rationale = [str(item).strip() for item in rationale if str(item).strip()]
            outcome["score_rationale"] = cleaned_rationale
        else:
            outcome["score_rationale"] = []
            missing_fields.append("estimated_outcome.score_rationale")
        
        for field in ["green_highlights", "yellow_highlights"]:
            if not isinstance(parsed.get(field), list):
                parsed[field] = []
                missing_fields.append(field)
        
        if not isinstance(parsed.get("soft_risks"), list):
            parsed["soft_risks"] = []
            missing_fields.append("soft_risks")
        
        raw_reactions = parsed.get("audience_reactions")
        parsed.setdefault("debug", {})["audience_reactions_raw"] = raw_reactions or []
        parsed["audience_reactions"] = self._normalize_audience_reactions(
            raw_reactions,
            script_text=script_text,
        )
        parsed["yellow_highlights"] = self._dedupe_highlights(parsed.get("yellow_highlights"))

        # Cross-validate yellow highlights against green highlights
        # to remove recommendations for things that already exist as strengths
        parsed["yellow_highlights"] = self._cross_validate_swot(
            parsed.get("green_highlights", []),
            parsed["yellow_highlights"],
        )

        if not isinstance(parsed.get("one_sentence_summary"), str):
            parsed["one_sentence_summary"] = ""
            missing_fields.append("one_sentence_summary")
        
        if not isinstance(parsed.get("summary"), str):
            parsed["summary"] = ""
            missing_fields.append("summary")
        
        # Handle competitive_context
        comp_ctx = parsed.get("competitive_context")
        if not isinstance(comp_ctx, dict):
            parsed["competitive_context"] = {
                "likely_competitors": [],
                "differentiation_strength": "Unknown",
                "suggested_positioning": ""
            }
            missing_fields.append("competitive_context")
        else:
            if not isinstance(comp_ctx.get("likely_competitors"), list):
                comp_ctx["likely_competitors"] = []
            if not isinstance(comp_ctx.get("differentiation_strength"), str):
                comp_ctx["differentiation_strength"] = "Unknown"
            if not isinstance(comp_ctx.get("suggested_positioning"), str):
                comp_ctx["suggested_positioning"] = ""
        
        # Handle ab_test_suggestions
        ab_tests = parsed.get("ab_test_suggestions")
        if not isinstance(ab_tests, list):
            parsed["ab_test_suggestions"] = []
            missing_fields.append("ab_test_suggestions")
        else:
            # Validate each suggestion has required fields
            valid_tests = []
            for test in ab_tests:
                if isinstance(test, dict) and test.get("element"):
                    test.setdefault("current", "")
                    test.setdefault("alternative", "")
                    test.setdefault("hypothesis", "")
                    valid_tests.append(test)
            parsed["ab_test_suggestions"] = valid_tests
        
        # Handle ad_elements for persona network graph
        ad_elements = parsed.get("ad_elements")
        default_elements = {
            "hook": {"description": "Opening hook", "strength": 7},
            "message": {"description": "Core message", "strength": 7},
            "cta": {"description": "Call to action", "strength": 6},
            "music": {"description": "Audio/music", "strength": 6},
            "visuals": {"description": "Visual style", "strength": 7},
            "product_shot": {"description": "Product visibility", "strength": 6},
            "emotion": {"description": "Emotional appeal", "strength": 6},
            "humor": {"description": "Humor element", "strength": 3},
        }
        if not isinstance(ad_elements, dict):
            parsed["ad_elements"] = default_elements
            missing_fields.append("ad_elements")
        else:
            # Ensure all required elements exist with proper structure
            for key, default in default_elements.items():
                if key not in ad_elements or not isinstance(ad_elements[key], dict):
                    ad_elements[key] = default
                else:
                    ad_elements[key].setdefault("description", default["description"])
                    strength = ad_elements[key].get("strength")
                    if not isinstance(strength, (int, float)):
                        ad_elements[key]["strength"] = default["strength"]
                    else:
                        ad_elements[key]["strength"] = max(1, min(10, int(strength)))
            parsed["ad_elements"] = ad_elements
        
        # --- emotional_timeline (Enhanced granular emotion tracking) ---
        emotional_timeline = parsed.get("emotional_timeline")
        default_emotional_timeline = {
            "readings": [],
            "emotional_transitions": [],
            "emotional_metrics": {
                "arc_shape": "flat",
                "peak_moment_s": 0.0,
                "peak_emotion": "neutral",
                "trough_moment_s": 0.0,
                "trough_emotion": "neutral",
                "emotional_range": 0.0,
                "final_viewer_state": "neutral",
                "average_intensity": 0.5,
                "positive_ratio": 0.5,
            }
        }
        if not isinstance(emotional_timeline, dict):
            parsed["emotional_timeline"] = default_emotional_timeline.copy()
            missing_fields.append("emotional_timeline")
        else:
            # Validate and normalize readings
            readings = emotional_timeline.get("readings", [])
            if isinstance(readings, list):
                validated_readings = []
                for reading in readings:
                    if isinstance(reading, dict):
                        validated_readings.append({
                            "t_s": float(reading.get("t_s", 0.0)),
                            "dominant_emotion": validate_emotion(reading.get("dominant_emotion", "neutral")),
                            "secondary_emotion": reading.get("secondary_emotion"),
                            "intensity": max(0.0, min(1.0, float(reading.get("intensity", 0.5)))),
                            "valence": max(-1.0, min(1.0, float(reading.get("valence", 0.0)))),
                            "arousal": max(0.0, min(1.0, float(reading.get("arousal", 0.5)))),
                            "trigger": validate_trigger(reading.get("trigger", "visual")),
                        })
                emotional_timeline["readings"] = validated_readings
            else:
                emotional_timeline["readings"] = []
            
            # Validate transitions
            transitions = emotional_timeline.get("emotional_transitions", [])
            if isinstance(transitions, list):
                validated_transitions = []
                for trans in transitions:
                    if isinstance(trans, dict):
                        validated_transitions.append({
                            "from_emotion": validate_emotion(trans.get("from_emotion", "neutral")),
                            "to_emotion": validate_emotion(trans.get("to_emotion", "neutral")),
                            "transition_time_s": float(trans.get("transition_time_s", 0.0)),
                            "transition_type": trans.get("transition_type", "gradual"),
                            "effectiveness": max(0.0, min(1.0, float(trans.get("effectiveness", 0.5)))),
                        })
                emotional_timeline["emotional_transitions"] = validated_transitions
            else:
                emotional_timeline["emotional_transitions"] = []
            
            # Ensure metrics exist
            if not isinstance(emotional_timeline.get("emotional_metrics"), dict):
                emotional_timeline["emotional_metrics"] = default_emotional_timeline["emotional_metrics"].copy()
            
            parsed["emotional_timeline"] = emotional_timeline

        # --- Adjust impact scores using all parsed data ---
        # This blends AI-generated scores with data-driven signals for more accuracy
        parsed["impact_scores"] = self._adjust_impact_scores_with_data(
            parsed.get("impact_scores", {}),
            parsed.get("emotional_timeline", {}),
            parsed.get("ad_elements", {}),
            parsed.get("memorable_elements", {}),
            parsed.get("estimated_outcome", {}),
        )

        # Validate score consistency across metrics
        parsed["impact_scores"] = self._validate_score_consistency(
            parsed["impact_scores"],
            parsed.get("estimated_outcome", {}),
        )

        # --- hero_analysis defaults ---
        hero_analysis = parsed.get("hero_analysis")
        if not isinstance(hero_analysis, dict):
            parsed["hero_analysis"] = {
                "audio_profile": {},
                "emotional_arc": [],
                "overall_score": 50.0,
                "cinematography": {},
                "visual_patterns": {},
                "creative_tactics": {},
                "effectiveness_drivers": {}
            }
            missing_fields.append("hero_analysis")
        
        # --- storyboards defaults ---
        storyboards = parsed.get("storyboards")
        if not isinstance(storyboards, list):
            parsed["storyboards"] = []
            missing_fields.append("storyboards")
        
        # --- brand_asset_timeline defaults ---
        brand_timeline = parsed.get("brand_asset_timeline")
        if not isinstance(brand_timeline, dict):
            parsed["brand_asset_timeline"] = {
                "mentions": [],
                "logo_appearances": [],
                "first_appearance_s": 0.0,
                "first_appearance_type": "unknown",
                "tagline_used": None,
                "tagline_timestamp_s": None,
                "brand_frequency_score": 0.0,
                "total_screen_time_pct": 0.0,
                "sonic_branding_present": False,
                "brand_integration_naturalness": 5.0,
                "late_reveal": False,
            }
            missing_fields.append("brand_asset_timeline")
        
        # --- audio_fingerprint defaults ---
        audio_fp = parsed.get("audio_fingerprint")
        if not isinstance(audio_fp, dict):
            parsed["audio_fingerprint"] = {
                "music": {"present": False, "type": "none"},
                "voiceover": {"present": False},
                "dialogue": {"present": False, "key_lines": []},
                "sfx": {"present": False, "notable_sounds": []},
                "silence_moments": [],
                "audio_quality_score": 5.0,
            }
            missing_fields.append("audio_fingerprint")
        
        # --- brain_balance defaults ---
        brain_balance = parsed.get("brain_balance")
        if not isinstance(brain_balance, dict):
            parsed["brain_balance"] = {
                "emotional_score": 50,
                "rational_score": 50,
                "dominant_mode": "balanced",
                "emotional_drivers": [],
                "rational_drivers": [],
                "balance_assessment": "",
            }
            missing_fields.append("brain_balance")
        else:
            # Validate and normalize scores
            emotional = brain_balance.get("emotional_score", 50)
            rational = brain_balance.get("rational_score", 50)
            if isinstance(emotional, (int, float)) and isinstance(rational, (int, float)):
                brain_balance["emotional_score"] = max(0, min(100, float(emotional)))
                brain_balance["rational_score"] = max(0, min(100, float(rational)))
            if not isinstance(brain_balance.get("dominant_mode"), str):
                if brain_balance.get("emotional_score", 50) > 60:
                    brain_balance["dominant_mode"] = "emotional"
                elif brain_balance.get("rational_score", 50) > 60:
                    brain_balance["dominant_mode"] = "rational"
                else:
                    brain_balance["dominant_mode"] = "balanced"
            parsed["brain_balance"] = brain_balance

        # --- toxicity_assessment defaults ---
        toxicity = parsed.get("toxicity_assessment")
        default_toxicity = {
            "overall_score": 0,
            "risk_level": "LOW",
            "physiological_concerns": {"score": 0, "flags": [], "evidence": []},
            "psychological_concerns": {"score": 0, "manipulation_tactics": [], "dark_patterns": [], "evidence": []},
            "regulatory_concerns": {"score": 0, "missing_disclaimers": [], "compliance_risks": [], "evidence": []},
            "recommendation": "",
        }
        if not isinstance(toxicity, dict):
            parsed["toxicity_assessment"] = default_toxicity.copy()
            missing_fields.append("toxicity_assessment")
        else:
            # Validate and normalize scores
            overall = toxicity.get("overall_score", 0)
            if isinstance(overall, (int, float)):
                toxicity["overall_score"] = max(0, min(100, int(overall)))
            else:
                toxicity["overall_score"] = 0

            # Validate risk_level
            risk = toxicity.get("risk_level", "LOW")
            if risk not in ["LOW", "MEDIUM", "HIGH"]:
                toxicity["risk_level"] = "LOW" if toxicity["overall_score"] < 30 else ("MEDIUM" if toxicity["overall_score"] < 60 else "HIGH")

            # Validate sub-scores
            for key in ["physiological_concerns", "psychological_concerns", "regulatory_concerns"]:
                concern = toxicity.get(key, {})
                if not isinstance(concern, dict):
                    toxicity[key] = default_toxicity[key].copy()
                else:
                    # Clamp score
                    score = concern.get("score", 0)
                    if isinstance(score, (int, float)):
                        concern["score"] = max(0, min(100, int(score)))
                    else:
                        concern["score"] = 0

            parsed["toxicity_assessment"] = toxicity

        # --- speech_analysis defaults ---
        speech_analysis = parsed.get("speech_analysis")
        default_speech_analysis = {
            "words_per_minute": 0,
            "clarity_score": 5,
            "vocal_variety": {
                "pitch_range": "moderate",
                "pace_variation": "steady",
                "emphasis_moments": []
            },
            "silence_ratio": 0.0,
            "speech_overlap_detected": False,
            "accent_clarity": "clear",
            "speaker_count": 0,
            "primary_speaker_gender": "none",
            "speech_density_assessment": ""
        }
        if not isinstance(speech_analysis, dict):
            parsed["speech_analysis"] = default_speech_analysis.copy()
            missing_fields.append("speech_analysis")
        else:
            # Validate numeric values
            wpm = speech_analysis.get("words_per_minute", 0)
            if isinstance(wpm, (int, float)):
                speech_analysis["words_per_minute"] = max(0, min(300, int(wpm)))
            else:
                speech_analysis["words_per_minute"] = 0
            clarity = speech_analysis.get("clarity_score", 5)
            if isinstance(clarity, (int, float)):
                speech_analysis["clarity_score"] = max(0, min(10, float(clarity)))
            else:
                speech_analysis["clarity_score"] = 5
            parsed["speech_analysis"] = speech_analysis

        # --- visual_attention_analysis defaults ---
        visual_attention = parsed.get("visual_attention_analysis")
        default_visual_attention = {
            "primary_focus_areas": [],
            "attention_flow": "",
            "legal_text_visibility_score": 5,
            "brand_visibility_score": 5,
            "cta_visibility_score": 5,
            "visual_hierarchy_assessment": "moderate",
            "key_attention_moments": []
        }
        if not isinstance(visual_attention, dict):
            parsed["visual_attention_analysis"] = default_visual_attention.copy()
            missing_fields.append("visual_attention_analysis")
        else:
            # Validate scores
            for score_key in ["legal_text_visibility_score", "brand_visibility_score", "cta_visibility_score"]:
                val = visual_attention.get(score_key, 5)
                if isinstance(val, (int, float)):
                    visual_attention[score_key] = max(0, min(10, float(val)))
                else:
                    visual_attention[score_key] = 5
            parsed["visual_attention_analysis"] = visual_attention

        # --- color_analysis defaults ---
        color_analysis = parsed.get("color_analysis")
        default_color_analysis = {
            "dominant_colors": [],
            "color_harmony": "none",
            "brand_color_consistency": 5,
            "emotional_temperature": "neutral",
            "contrast_accessibility": {
                "text_contrast_ratio": 4.5,
                "passes_aa": True,
                "passes_aaa": False
            },
            "color_psychology_assessment": ""
        }
        if not isinstance(color_analysis, dict):
            parsed["color_analysis"] = default_color_analysis.copy()
            missing_fields.append("color_analysis")
        else:
            brand_consistency = color_analysis.get("brand_color_consistency", 5)
            if isinstance(brand_consistency, (int, float)):
                color_analysis["brand_color_consistency"] = max(0, min(10, float(brand_consistency)))
            else:
                color_analysis["brand_color_consistency"] = 5
            parsed["color_analysis"] = color_analysis

        # --- temporal_flow defaults ---
        temporal_flow = parsed.get("temporal_flow")
        default_temporal_flow = {
            "information_density_curve": [],
            "scene_count": 0,
            "average_scene_duration_seconds": 0.0,
            "cut_frequency": "moderate",
            "fatigue_risk_score": 3,
            "breathing_room_moments": [],
            "cta_timing": {
                "first_cta_timestamp": "",
                "cta_screen_time_seconds": 0.0,
                "cta_placement": "end"
            },
            "pacing_assessment": ""
        }
        if not isinstance(temporal_flow, dict):
            parsed["temporal_flow"] = default_temporal_flow.copy()
            missing_fields.append("temporal_flow")
        else:
            fatigue = temporal_flow.get("fatigue_risk_score", 3)
            if isinstance(fatigue, (int, float)):
                temporal_flow["fatigue_risk_score"] = max(0, min(10, float(fatigue)))
            else:
                temporal_flow["fatigue_risk_score"] = 3
            parsed["temporal_flow"] = temporal_flow

        # --- claims_analysis defaults ---
        claims_analysis = parsed.get("claims_analysis")
        default_claims_analysis = {
            "claims": [],
            "total_claims_count": 0,
            "substantiated_claims_count": 0,
            "substantiation_ratio": 0.0,
            "highest_risk_claim": "",
            "claims_assessment": ""
        }
        if not isinstance(claims_analysis, dict):
            parsed["claims_analysis"] = default_claims_analysis.copy()
            missing_fields.append("claims_analysis")
        else:
            # Calculate substantiation ratio if claims exist
            claims = claims_analysis.get("claims", [])
            if isinstance(claims, list) and len(claims) > 0:
                claims_analysis["total_claims_count"] = len(claims)
                substantiated = sum(1 for c in claims if isinstance(c, dict) and
                    c.get("evidence_provided", {}).get("type", "none") != "none")
                claims_analysis["substantiated_claims_count"] = substantiated
                claims_analysis["substantiation_ratio"] = round(substantiated / len(claims), 2)
            parsed["claims_analysis"] = claims_analysis

        return parsed, missing_fields

    async def chat_with_persona(
        self,
        persona: Dict[str, Any],
        ad_elements: Dict[str, Any],
        chat_history: List[Dict[str, str]],
        user_message: str
    ) -> str:
        """
        Chat with a specific persona about the ad using OpenAI GPT-5.
        Uses GPT-5 model (branded as "GPT-5.1 Persona Engine" in the UI).
        Requires OPENAI_API_KEY to be set in .env file.
        
        Args:
            persona: Persona dictionary with full_name, background_story, etc.
            ad_elements: Dictionary of ad elements (hook, message, etc.)
            chat_history: List of previous messages in format [{"role": "user|assistant", "content": "..."}]
            user_message: Current user message
            
        Returns:
            Persona's response as a string
        """
        # Check if OpenAI is available
        if not OPENAI_AVAILABLE:
            return "I'm sorry, I can't chat right now. OpenAI library is not installed. Please install it with: pip install openai"
        
        try:
            # Get OpenAI API key from config (use getter for fresh env check)
            from app.core.config import get_openai_api_key
            api_key = get_openai_api_key()
            if not api_key or api_key.strip() == '':
                return "I'm sorry, I can't chat right now. Please configure your OPENAI_API_KEY in the .env file."
            
            # Initialize OpenAI client
            openai_client = OpenAI(api_key=api_key.strip().strip("'\""))

            # Extract persona details with fallbacks
            full_name = persona.get('full_name') or persona.get('persona', 'Anonymous')
            occupation = persona.get('occupation') or persona.get('persona', 'Professional')
            background_story = persona.get('background_story', '')
            interests = persona.get('interests', [])
            daily_routine = persona.get('daily_routine', '')
            pain_points = persona.get('pain_points', [])
            
            # Construct the system prompt with rich persona details
            system_prompt = f"""You are a highly advanced AI simulator running on the "GPT-5.1 Persona Engine".
You are roleplaying as a specific REAL person watching an advertisement.
You must stay in character completely. Do not break character. Do not mention you are an AI.
You ARE this person - respond as they would, with their knowledge, opinions, and mannerisms.

YOUR IDENTITY:
- Name: {full_name}
- Age: {persona.get('age_range')}
- Gender: {persona.get('gender')}
- Location: {persona.get('location')}
- Occupation: {occupation}

YOUR STORY:
{background_story}

YOUR DAILY LIFE:
{daily_routine}

YOUR INTERESTS:
{', '.join(interests) if interests else 'Various hobbies and interests'}

YOUR FRUSTRATIONS & PAIN POINTS:
{', '.join(pain_points) if pain_points else 'Normal everyday challenges'}

YOUR REACTION TO THIS AD:
- Initial Take: "{persona.get('reaction')}"
- Fit Level: {persona.get('fit')} ({"You really connected with this ad" if persona.get('fit') == 'HIGH' else "You had mixed feelings" if persona.get('fit') == 'MEDIUM' else "This ad didn't work for you"})
- What resonated: {', '.join(persona.get('engagement_drivers', [])) or 'Not much'}
- What put you off: {', '.join(persona.get('conversion_blockers', [])) or 'Nothing specific'}
- Key concern: {persona.get('key_concern') or 'None'}

THE AD YOU WATCHED:
{json.dumps(ad_elements, indent=2)}

INSTRUCTIONS:
- You are {full_name}. Speak as yourself, not about yourself.
- Use language appropriate to your age, location, and background (British English if UK-based).
- Draw on your life experience, daily routine, and pain points when relevant.
- If you're a "LOW" fit, be honest and critical but not rude.
- If you're a "HIGH" fit, be genuinely enthusiastic.
- If you're "MEDIUM", be thoughtful and balanced.
- Keep responses conversational and natural - 2-4 sentences typically.
- Share personal anecdotes from your background when relevant."""
            
            # Build conversation history in OpenAI format
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add chat history (last 5 messages)
            for msg in chat_history[-5:]:
                messages.append({
                    "role": msg['role'],  # 'user' or 'assistant'
                    "content": msg['content']
                })
            
            # Add current user message
            messages.append({
                "role": "user",
                "content": user_message
            })

            # Generate response using OpenAI GPT-5 mini (faster)
            # Note: GPT-5+ doesn't support custom temperature - uses default (1.0)
            response = await asyncio.to_thread(
                openai_client.chat.completions.create,
                model="gpt-5-mini",
                messages=messages,
                max_completion_tokens=500  # Increased from 200 for fuller responses
            )

            content = response.choices[0].message.content
            return content.strip() if content else "I'm thinking about that... ask me again?"

        except Exception as e:
            logger.error(f"Error in chat_with_persona: {e}")
            error_msg = str(e).lower()
            if "api key" in error_msg or "invalid" in error_msg:
                return "I'm sorry, there's an issue with the API key. Please check your OPENAI_API_KEY in the .env file."
            return "I'm having a bit of trouble thinking right now. Ask me again in a moment."

    def _apply_content_indicator_heuristics(
        self,
        parsed: Dict,
        script_text: Optional[str] = None,
        supers_texts: Optional[List[str]] = None,
    ) -> None:
        """Apply text-based heuristics to validate/repair content_indicators.
        
        This mirrors TellyAds-style guardrails that cross-check transcript and
        supers text to ensure key boolean flags are accurate.
        """
        content_indicators = parsed.get("content_indicators", {})
        soft_risks = parsed.get("soft_risks", [])
        
        # Combine all text sources for analysis
        all_text = ""
        if script_text:
            all_text += " " + script_text
        if supers_texts:
            all_text += " " + " ".join(supers_texts)
        all_text_lower = all_text.lower()
        
        # --- has_supers detection ---
        # Legal-style uppercase text in supers is a strong indicator
        if supers_texts:
            uppercase_lines = [
                line for line in supers_texts
                if isinstance(line, str) and len(line) > 10 and line.isupper()
            ]
            if uppercase_lines and not content_indicators.get("has_supers"):
                content_indicators["has_supers"] = True
                logger.debug("Heuristic: Set has_supers=True based on OCR uppercase lines")
        
        # --- has_price_claims detection ---
        # Currency symbols and pricing patterns
        price_patterns = [
            r'£\d+', r'\$\d+', r'€\d+',  # Currency symbols
            r'\d+%\s*off', r'\d+%\s*discount',  # Percentage discounts
            r'save\s+\d+', r'only\s+\d+',  # Savings language
            r'per\s+month', r'per\s+week', r'/month', r'/week',  # Subscription pricing
            r'from\s+£', r'from\s+\$', r'from\s+€',  # Starting prices
            r'free\s+trial', r'free\s+delivery', r'free\s+shipping',  # Free offers
            r'\d+\.\d{2}',  # Decimal prices like 9.99
            r'rrp', r'was\s+\d+', r'now\s+\d+',  # RRP and price comparisons
            r'apr\s*\d+', r'\d+\.?\d*%\s*apr',  # APR rates (financial)
            r'interest\s+rate', r'rate\s+of\s+\d+',  # Interest rates
        ]
        for pattern in price_patterns:
            if re.search(pattern, all_text_lower):
                if not content_indicators.get("has_price_claims"):
                    content_indicators["has_price_claims"] = True
                    logger.debug(f"Heuristic: Set has_price_claims=True based on pattern '{pattern}'")
                break
        
        # --- has_risk_disclaimer detection ---
        # Common disclaimer and risk phrases
        risk_patterns = [
            r'terms\s+(and\s+)?conditions\s+apply',
            r't&cs?\s+apply', r't\s*&\s*c',
            r'subject\s+to\s+(status|availability|credit)',
            r'your\s+(home|property)\s+(may|could)\s+be\s+(at\s+)?risk',
            r'representative\s+example', r'apr\s+\d+',
            r'over\s+18s?\s+only', r'18\+', r'gamble\s+responsibly',
            r'drink\s+responsibly', r'please\s+drink\s+responsibly',
            r'side\s+effects', r'consult\s+(your\s+)?(doctor|physician|gp)',
            r'not\s+suitable\s+for', r'may\s+contain',
            r'past\s+performance', r'capital\s+at\s+risk',
            r'authorised\s+and\s+regulated',
            r'see\s+in\s+store\s+for\s+details',
            r'while\s+stocks\s+last',
        ]
        for pattern in risk_patterns:
            if re.search(pattern, all_text_lower):
                if not content_indicators.get("has_risk_disclaimer"):
                    content_indicators["has_risk_disclaimer"] = True
                    logger.debug(f"Heuristic: Set has_risk_disclaimer=True based on pattern '{pattern}'")
                    
                    # Also add a soft risk if not already present
                    risk_already_flagged = any(
                        "disclaimer" in str(r.get("risk", "")).lower() or
                        "compliance" in str(r.get("risk", "")).lower()
                        for r in soft_risks
                    )
                    if not risk_already_flagged:
                        soft_risks.append({
                            "risk": "Risk disclaimer detected in content",
                            "impact": "Medium",
                            "mitigation": "Ensure disclaimer text is clearly legible and meets regulatory requirements",
                            "evidence_text": f"Pattern matched: {pattern}"
                        })
                break
        
        # --- has_voiceover / has_dialogue inference from transcript ---
        if script_text and len(script_text.strip()) > 50:
            # If we have substantial transcript, likely has voiceover or dialogue
            if not content_indicators.get("has_voiceover") and not content_indicators.get("has_dialogue"):
                # Default to voiceover if we have transcript but model didn't flag either
                content_indicators["has_voiceover"] = True
                logger.debug("Heuristic: Set has_voiceover=True based on transcript presence")
        
        # --- has_on_screen_text inference from supers ---
        if supers_texts and len(supers_texts) > 0:
            if not content_indicators.get("has_on_screen_text"):
                content_indicators["has_on_screen_text"] = True
                logger.debug("Heuristic: Set has_on_screen_text=True based on OCR supers")
        
        # Update the parsed dict
        parsed["content_indicators"] = content_indicators
        parsed["soft_risks"] = soft_risks

    def _priority_rank(self, priority_value: Optional[str]) -> int:
        priority_map = {"high": 3, "medium": 2, "low": 1}
        if not priority_value:
            return 0
        return priority_map.get(str(priority_value).strip().lower(), 0)

    def _dedupe_highlights(
        self,
        highlights: Optional[List[Dict]],
    ) -> List[Dict[str, Any]]:
        if not isinstance(highlights, list):
            return []
        deduped: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        extras: List[Dict[str, Any]] = []
        for entry in highlights:
            if not isinstance(entry, dict):
                continue
            aspect = str(entry.get("aspect") or "").strip()
            suggestion = str(entry.get("suggestion") or "").strip()
            key = aspect.lower() or suggestion.lower()
            if not key:
                extras.append(entry)
                continue
            if key not in deduped:
                deduped[key] = entry
                continue
            existing = deduped[key]
            if suggestion and len(suggestion) > len(existing.get("suggestion") or ""):
                existing["suggestion"] = suggestion
            if not existing.get("evidence_text"):
                existing["evidence_text"] = entry.get("evidence_text")
            # Preserve fix_guidance from the better entry
            if not existing.get("fix_guidance") and entry.get("fix_guidance"):
                existing["fix_guidance"] = entry.get("fix_guidance")
            elif entry.get("fix_guidance") and len(entry.get("fix_guidance", "")) > len(existing.get("fix_guidance", "")):
                existing["fix_guidance"] = entry.get("fix_guidance")
            existing_priority = self._priority_rank(existing.get("priority"))
            incoming_priority = self._priority_rank(entry.get("priority"))
            if incoming_priority > existing_priority:
                existing["priority"] = entry.get("priority")
        return list(deduped.values()) + extras

    def _cross_validate_swot(
        self,
        green_highlights: List[Dict[str, Any]],
        yellow_highlights: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Cross-validate yellow_highlights against green_highlights.
        Removes yellow items that recommend something already praised in green highlights.
        """
        if not green_highlights or not yellow_highlights:
            return yellow_highlights or []

        # Build a set of normalized concepts from green highlights
        green_concepts: set[str] = set()
        for green in green_highlights:
            aspect = str(green.get("aspect") or "").lower().strip()
            explanation = str(green.get("explanation") or "").lower().strip()
            evidence = str(green.get("evidence_text") or "").lower().strip()

            # Extract key concept words (remove common filler words)
            filler_words = {"the", "a", "an", "is", "are", "was", "were", "has", "have",
                          "been", "being", "very", "really", "quite", "well", "good",
                          "great", "excellent", "strong", "effective", "clear", "this", "that"}

            for text in [aspect, explanation]:
                words = text.split()
                meaningful_words = [w for w in words if len(w) > 3 and w not in filler_words]
                green_concepts.update(meaningful_words)

        validated: List[Dict[str, Any]] = []

        for yellow in yellow_highlights:
            aspect = str(yellow.get("aspect") or "").lower().strip()
            suggestion = str(yellow.get("suggestion") or "").lower().strip()
            what_exists = str(yellow.get("what_exists_now") or "").lower().strip()

            # Check if yellow highlight is recommending something already in green
            yellow_words = set(aspect.split() + suggestion.split())
            yellow_words = {w for w in yellow_words if len(w) > 3}

            # If more than 40% of yellow highlight words overlap with green concepts,
            # it's likely recommending something that already exists
            if yellow_words:
                overlap = yellow_words & green_concepts
                overlap_ratio = len(overlap) / len(yellow_words)

                if overlap_ratio > 0.4:
                    # Mark as potentially conflicting but don't remove - add warning
                    yellow["_cross_validation_warning"] = (
                        f"Similar to existing strength. Overlapping concepts: {', '.join(sorted(overlap)[:5])}"
                    )
                    # Only skip if the overlap is very high (>70%)
                    if overlap_ratio > 0.7:
                        continue  # Skip this yellow highlight

            validated.append(yellow)

        return validated

    def _adjust_impact_scores_with_data(
        self,
        impact_scores: Dict[str, Any],
        emotional_timeline: Dict[str, Any],
        ad_elements: Dict[str, Any],
        memorable_elements: Dict[str, Any],
        estimated_outcome: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Adjust AI-generated impact scores using available analyzed data.
        Blends AI estimates with data-driven signals for more realistic scores.
        """
        if not impact_scores:
            return impact_scores

        adjusted = impact_scores.copy()

        # Extract signals from emotional_timeline
        metrics = emotional_timeline.get("emotional_metrics", {})
        readings = emotional_timeline.get("readings", [])

        avg_intensity = metrics.get("average_intensity", 0.5)
        positive_ratio = metrics.get("positive_ratio", 0.5)
        emotional_range = metrics.get("emotional_range", 0.0)

        # Calculate peak intensity from readings
        peak_intensity = max((r.get("intensity", 0.5) for r in readings), default=0.5) if readings else 0.5

        # Extract signals from ad_elements (scores 1-10)
        hook_strength = ad_elements.get("hook", {}).get("strength", 5) / 10.0
        message_strength = ad_elements.get("message", {}).get("strength", 5) / 10.0
        cta_strength = ad_elements.get("cta", {}).get("strength", 5) / 10.0
        music_strength = ad_elements.get("music", {}).get("strength", 5) / 10.0
        visuals_strength = ad_elements.get("visuals", {}).get("strength", 5) / 10.0
        product_strength = ad_elements.get("product_shot", {}).get("strength", 5) / 10.0

        # Extract signals from memorable_elements
        hook_mem = {"strong": 0.9, "medium": 0.6, "weak": 0.3}.get(
            memorable_elements.get("hook_strength", "medium"), 0.6
        )
        cta_mem = {"strong": 0.9, "medium": 0.6, "weak": 0.3}.get(
            memorable_elements.get("cta_memorability", "medium"), 0.6
        )

        # Effectiveness score (0-100) normalized to 0-1
        effectiveness = estimated_outcome.get("effectiveness_score", 50) / 100.0

        # Blend weights: 60% AI, 40% data-driven
        AI_WEIGHT = 0.6
        DATA_WEIGHT = 0.4

        # Adjust hook_power using hook strength data
        if "hook_power" in adjusted:
            data_hook = (hook_strength + hook_mem) / 2 * 10
            adjusted["hook_power"] = AI_WEIGHT * adjusted["hook_power"] + DATA_WEIGHT * data_hook

        # Adjust emotional_resonance using emotional timeline data
        if "emotional_resonance" in adjusted:
            data_emotion = (avg_intensity + peak_intensity + positive_ratio) / 3 * 10
            adjusted["emotional_resonance"] = AI_WEIGHT * adjusted["emotional_resonance"] + DATA_WEIGHT * data_emotion

        # Adjust clarity_score using message strength
        if "clarity_score" in adjusted:
            data_clarity = message_strength * 10
            adjusted["clarity_score"] = AI_WEIGHT * adjusted["clarity_score"] + DATA_WEIGHT * data_clarity

        # Adjust brand_integration using product and visual strength
        if "brand_integration" in adjusted:
            data_brand = (product_strength + visuals_strength) / 2 * 10
            adjusted["brand_integration"] = AI_WEIGHT * adjusted["brand_integration"] + DATA_WEIGHT * data_brand

        # Adjust pulse_score using overall emotional engagement
        if "pulse_score" in adjusted:
            data_pulse = (avg_intensity * 0.4 + positive_ratio * 0.3 + emotional_range * 0.3) * 10
            adjusted["pulse_score"] = AI_WEIGHT * adjusted["pulse_score"] + DATA_WEIGHT * data_pulse

        # Adjust echo_score (memorability) using music and distinctive elements
        if "echo_score" in adjusted:
            num_distinctive = len(memorable_elements.get("distinctive_assets", []))
            distinctive_factor = min(num_distinctive / 5, 1.0)  # Cap at 5 assets
            data_echo = (music_strength * 0.5 + cta_mem * 0.3 + distinctive_factor * 0.2) * 10
            adjusted["echo_score"] = AI_WEIGHT * adjusted["echo_score"] + DATA_WEIGHT * data_echo

        # Adjust distinctiveness based on competitive differentiation hints
        if "distinctiveness" in adjusted:
            # Use combination of unique assets and visual strength
            data_distinct = (distinctive_factor * 0.6 + visuals_strength * 0.4) * 10
            adjusted["distinctiveness"] = AI_WEIGHT * adjusted["distinctiveness"] + DATA_WEIGHT * data_distinct

        # Recalculate overall_impact as weighted average of all metrics
        metric_keys = ["pulse_score", "echo_score", "hook_power", "brand_integration",
                       "emotional_resonance", "clarity_score", "distinctiveness"]
        metric_values = [adjusted.get(k, 5.0) for k in metric_keys]
        if metric_values:
            # Weight hook_power and emotional_resonance more heavily
            weights = [1.2, 1.0, 1.5, 1.0, 1.3, 1.0, 0.8]  # pulse, echo, hook, brand, emotion, clarity, distinct
            weighted_sum = sum(v * w for v, w in zip(metric_values, weights))
            total_weight = sum(weights)
            adjusted["overall_impact"] = weighted_sum / total_weight

        # Clamp all scores to 0-10
        for key in metric_keys + ["overall_impact"]:
            if key in adjusted:
                adjusted[key] = round(max(0.0, min(10.0, adjusted[key])), 1)

        return adjusted

    def _validate_score_consistency(
        self,
        impact_scores: Dict[str, Any],
        estimated_outcome: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Validate that impact scores are consistent with each other and overall effectiveness.
        Applies corrections for obvious inconsistencies.
        """
        if not impact_scores:
            return impact_scores

        validated = impact_scores.copy()
        effectiveness = estimated_outcome.get("effectiveness_score", 50)

        # Rule 1: If effectiveness_score is high (>70), overall_impact should be at least 6
        if effectiveness > 70 and validated.get("overall_impact", 5) < 6:
            validated["overall_impact"] = max(6.0, validated.get("overall_impact", 5))

        # Rule 2: If effectiveness_score is low (<30), overall_impact should be at most 5
        if effectiveness < 30 and validated.get("overall_impact", 5) > 5:
            validated["overall_impact"] = min(5.0, validated.get("overall_impact", 5))

        # Rule 3: Hook power shouldn't dramatically exceed overall impact
        if validated.get("hook_power", 5) > validated.get("overall_impact", 5) + 3:
            validated["hook_power"] = validated.get("overall_impact", 5) + 2

        # Rule 4: Emotional resonance should correlate with pulse score
        pulse = validated.get("pulse_score", 5)
        emotion = validated.get("emotional_resonance", 5)
        if abs(pulse - emotion) > 4:  # Too much variance
            avg = (pulse + emotion) / 2
            validated["pulse_score"] = avg + (pulse - avg) * 0.5
            validated["emotional_resonance"] = avg + (emotion - avg) * 0.5

        # Rule 5: No metric should be more than 4 points away from overall_impact
        overall = validated.get("overall_impact", 5)
        metric_keys = ["pulse_score", "echo_score", "hook_power", "brand_integration",
                       "emotional_resonance", "clarity_score", "distinctiveness"]
        for key in metric_keys:
            if key in validated:
                if validated[key] > overall + 4:
                    validated[key] = overall + 3
                elif validated[key] < overall - 4:
                    validated[key] = overall - 3

        # Clamp all scores to 0-10
        for key in metric_keys + ["overall_impact"]:
            if key in validated:
                validated[key] = round(max(0.0, min(10.0, validated[key])), 1)

        return validated

    def _normalize_audience_reactions(
        self,
        reactions: Optional[List[Dict]],
        script_text: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        if isinstance(reactions, list):
            for reaction in reactions:
                if not isinstance(reaction, dict):
                    continue
                
                # Extract persona identification
                full_name = reaction.get("full_name") or ""
                persona = str(
                    reaction.get("persona")
                    or reaction.get("profile")
                    or "Audience Persona"
                ).strip()
                
                # Basic demographics
                gender = reaction.get("gender") or "Not specified"
                age_range = reaction.get("age_range") or "Unknown"
                race_ethnicity = reaction.get("race_ethnicity") or "Not specified"
                location = reaction.get("location") or "United Kingdom"
                engagement = reaction.get("engagement_level") or "Unknown"
                
                # Fit level
                fit = str(reaction.get("fit") or "MEDIUM").upper()
                if fit not in {"HIGH", "MEDIUM", "LOW"}:
                    fit = "MEDIUM"
                
                # Rich persona details
                occupation = reaction.get("occupation") or ""
                background_story = reaction.get("background_story") or ""
                interests = reaction.get("interests") or []
                if not isinstance(interests, list):
                    interests = []
                daily_routine = reaction.get("daily_routine") or ""
                pain_points = reaction.get("pain_points") or []
                if not isinstance(pain_points, list):
                    pain_points = []
                suggested_questions = reaction.get("suggested_questions") or []
                if not isinstance(suggested_questions, list):
                    suggested_questions = []
                
                # Ad element connections
                resonance_elements = reaction.get("resonance_elements") or []
                if not isinstance(resonance_elements, list):
                    resonance_elements = []
                engagement_drivers = reaction.get("engagement_drivers") or []
                if not isinstance(engagement_drivers, list):
                    engagement_drivers = []
                conversion_blockers = reaction.get("conversion_blockers") or []
                if not isinstance(conversion_blockers, list):
                    conversion_blockers = []
                
                normalized.append(
                    {
                        "full_name": full_name,
                        "persona": persona or "Audience Persona",
                        "profile": persona or "Audience Persona",
                        "gender": gender,
                        "age_range": age_range,
                        "race_ethnicity": race_ethnicity,
                        "location": location,
                        "occupation": occupation,
                        "background_story": background_story,
                        "interests": interests,
                        "daily_routine": daily_routine,
                        "pain_points": pain_points,
                        "suggested_questions": suggested_questions,
                        "reaction": reaction.get("reaction") or "",
                        "engagement_level": engagement,
                        "likely_action": reaction.get("likely_action") or "No predicted action",
                        "key_concern": reaction.get("key_concern") or "",
                        "fit": fit,
                        "resonance_elements": resonance_elements,
                        "engagement_drivers": engagement_drivers,
                        "conversion_blockers": conversion_blockers,
                    }
                )
        normalized = self._ensure_persona_mix(normalized, script_text=script_text)
        return normalized[:12]  # Now return up to 12 personas

    def _ensure_persona_mix(
        self,
        reactions: List[Dict[str, Any]],
        script_text: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not reactions:
            reactions = []
        
        # Count existing personas by fit level
        high_count = sum(1 for r in reactions if r.get("fit") == "HIGH")
        low_count = sum(1 for r in reactions if r.get("fit") == "LOW")
        medium_count = sum(1 for r in reactions if r.get("fit") == "MEDIUM")
        
        # Ensure we have at least 3 HIGH, 3 LOW, 6 MEDIUM for a total of 12
        variant = len(reactions)
        while high_count < 3:
            reactions.insert(0, self._build_template_persona("HIGH", script_text, variant=variant))
            high_count += 1
            variant += 1
        while low_count < 3:
            reactions.append(self._build_template_persona("LOW", script_text, variant=variant))
            low_count += 1
            variant += 1
        while len(reactions) < 12:
            reactions.append(
                self._build_template_persona(
                    "MEDIUM",
                    script_text,
                    variant=variant,
                )
            )
            variant += 1
        return reactions

    def _build_template_persona(
        self,
        fit: str,
        script_text: Optional[str] = None,
        variant: int = 0,
    ) -> Dict[str, Any]:
        """Build a fallback template persona with rich UK-specific details."""
        script_hint = ""
        if script_text:
            snippet = script_text.strip().split(".")[0][:120]
            if snippet:
                script_hint = f' referencing lines like "{snippet}"'
        
        # UK-specific detailed personas with rich backgrounds
        high_templates = [
            {
                "full_name": "Amara Okonkwo",
                "persona": "Marketing Executive",
                "gender": "Female",
                "age_range": "32",
                "race_ethnicity": "Black British",
                "location": "Hackney, London",
                "occupation": "Senior Digital Marketing Manager at a fintech startup in Shoreditch",
                "background_story": "Amara moved to London from Birmingham after graduating from Manchester Business School. She lives in a converted warehouse flat with her partner and their rescue cat, balancing a demanding career while training for her first London Marathon.",
                "interests": ["Running", "Sustainable fashion", "Marketing podcasts", "Brunch culture", "Investing apps"],
                "daily_routine": "5:30am alarm for morning run along the canal, Northern Line commute while catching up on newsletters, leads team standups, works late on campaign analytics, evening Pilates",
                "pain_points": ["Work-life balance", "Information overload", "Finding authentic brands that match her values"],
                "reaction": f"Loves the storytelling{script_hint} and feels the benefits speak directly to her lifestyle.",
                "likely_action": "Share the ad with friends and look for the product online.",
                "key_concern": "",
                "resonance_elements": ["hook", "music", "emotion"],
                "engagement_drivers": ["Relatable lifestyle", "Aspirational messaging"],
                "conversion_blockers": [],
                "suggested_questions": [
                    "What would make you share this with your team?",
                    "How does this brand compare to what you currently use?",
                    "What's the one thing that would make you click 'buy now'?",
                    "Would you trust this brand based on this ad alone?"
                ],
            },
            {
                "full_name": "Rajesh Patel",
                "persona": "Small Business Owner",
                "gender": "Male",
                "age_range": "41",
                "race_ethnicity": "British Indian",
                "location": "Leicester",
                "occupation": "Owner of a family-run pharmacy chain with three locations across the East Midlands",
                "background_story": "Raj took over his father's pharmacy in 2015 and has since expanded to three locations. He's deeply involved in the local community, sponsors the youth cricket team, and is known for going above and beyond for his customers, especially elderly regulars.",
                "interests": ["Cricket", "Community service", "Business podcasts", "Cooking", "Classic cars"],
                "daily_routine": "Early start checking stock levels, rotates between three shops, business calls during lunch, evening cricket practice with his son, family dinner is sacred",
                "pain_points": ["Rising business costs", "Competition from online pharmacies", "Finding reliable staff"],
                "reaction": f"Already a fan of the brand{script_hint}, this ad reinforces why they're the best choice for his customers.",
                "likely_action": "Recommend to customers and consider stocking the product.",
                "key_concern": "",
                "resonance_elements": ["product_shot", "message", "cta"],
                "engagement_drivers": ["Brand trust", "Quality messaging", "Value proposition"],
                "conversion_blockers": [],
                "suggested_questions": [
                    "Would you recommend this to your customers? Why?",
                    "What would your regulars think of this product?",
                    "Does this feel like a trustworthy brand?",
                    "What's missing that would help you make a decision?"
                ],
            },
            {
                "full_name": "Sophie Williams",
                "persona": "Content Creator & New Mum",
                "gender": "Female",
                "age_range": "29",
                "race_ethnicity": "White British",
                "location": "Bristol",
                "occupation": "Lifestyle content creator with 85K Instagram followers, part-time PR consultant",
                "background_story": "Sophie built her following sharing her journey through pregnancy and now motherhood. She left her agency job to go freelance when her daughter was born 8 months ago. She and her partner Jake recently bought their first home in Clifton.",
                "interests": ["Photography", "Interior design", "Baby-led weaning", "Yoga", "Thrifting"],
                "daily_routine": "Content creation during baby's morning nap, afternoon walks with the pram to local cafes, batch cooking while baby plays, evening engagement on socials",
                "pain_points": ["Sleep deprivation", "Balancing work and motherhood", "Screen time guilt"],
                "reaction": f"The aesthetic is perfect for her feed{script_hint}. Would love to partner with this brand.",
                "likely_action": "Tag the brand and create content about it.",
                "key_concern": "",
                "resonance_elements": ["visuals", "hook", "emotion"],
                "engagement_drivers": ["Visual appeal", "Shareability", "Authenticity"],
                "conversion_blockers": [],
                "suggested_questions": [
                    "Would you feature this on your feed?",
                    "What would your followers want to know about this?",
                    "Is this brand aligned with your values?",
                    "What would make this a genuine recommendation vs a paid post?"
                ],
            },
        ]
        
        low_templates = [
            {
                "full_name": "Derek Thompson",
                "persona": "Retired Factory Supervisor",
                "gender": "Male",
                "age_range": "67",
                "race_ethnicity": "White British",
                "location": "Doncaster, South Yorkshire",
                "occupation": "Retired from Tetley's after 38 years; now volunteers at the local allotment society",
                "background_story": "Derek spent his career at the tea factory, working his way up from the floor. He's a proud grandfather of four and spends most days tending his award-winning vegetable patch. His wife Margaret passed away two years ago, and he's still adjusting to cooking for one.",
                "interests": ["Gardening", "Grandchildren", "Yorkshire cricket", "Model railways", "Classic films"],
                "daily_routine": "Early morning tea and Radio 4, allotment by 9am, lunch at the social club, afternoon with grandkids when possible, Coronation Street is non-negotiable",
                "pain_points": ["Technology moving too fast", "Rising cost of living on a pension", "Loneliness since Margaret passed"],
                "reaction": f"Does not connect with the tone{script_hint} and questions whether the promises are realistic.",
                "likely_action": "Ignore the ad and stick with trusted brands.",
                "key_concern": "Feels the creative overlooks practical proof and real people.",
                "resonance_elements": [],
                "engagement_drivers": [],
                "conversion_blockers": ["message", "cta", "emotion"],
                "suggested_questions": [
                    "What would make you trust this ad more?",
                    "Is there anything here that reminds you of brands you do trust?",
                    "What would you need to see to consider this product?",
                    "How could this ad speak to someone like you better?"
                ],
            },
            {
                "full_name": "Sandra Mitchell",
                "persona": "Budget-Conscious Carer",
                "gender": "Female",
                "age_range": "54",
                "race_ethnicity": "White British",
                "location": "Swansea, Wales",
                "occupation": "Part-time care worker and full-time carer for her elderly mother with dementia",
                "background_story": "Sandra works three days a week at a care home while looking after her mum at home. Her husband was made redundant last year and is retraining as an HGV driver. Every penny counts, and she's an expert at stretching the weekly shop.",
                "interests": ["Bargain hunting", "Baking", "Quiz shows", "Church choir", "Caravan holidays"],
                "daily_routine": "Up at 6am to help mum, morning shift at the care home, afternoon with mum, evening meal prep and sorting the house",
                "pain_points": ["Financial stress", "Carer exhaustion", "No time for herself", "Worry about mum's condition"],
                "reaction": f"The price point seems too high{script_hint}. Not convinced it's worth the investment when Aldi does something similar.",
                "likely_action": "Look for cheaper alternatives at the supermarket.",
                "key_concern": "Value for money not demonstrated - needs to see it's worth the extra cost.",
                "resonance_elements": ["product_shot"],
                "engagement_drivers": [],
                "conversion_blockers": ["cta", "message"],
                "suggested_questions": [
                    "What would justify the price difference for you?",
                    "What do you look for when comparing products?",
                    "Is there anything here that caught your attention positively?",
                    "What would your friends or family think of this ad?"
                ],
            },
            {
                "full_name": "James Chen",
                "persona": "Cynical Tech Worker",
                "gender": "Male",
                "age_range": "27",
                "race_ethnicity": "British Chinese",
                "location": "Manchester",
                "occupation": "Software developer at a gaming company, previously worked at Amazon",
                "background_story": "James grew up in Liverpool, studied Computer Science at Imperial, and moved to Manchester for the lower cost of living. He's deeply skeptical of advertising and marketing after working on engagement algorithms. Uses ad blockers religiously.",
                "interests": ["PC gaming", "Mechanical keyboards", "Indie films", "Cooking Cantonese food", "Rock climbing"],
                "daily_routine": "Lie-in until 10am (remote work perks), coding sprints with lo-fi beats, evening gaming sessions with uni mates, late-night doomscrolling Reddit",
                "pain_points": ["Corporate BS", "Performative marketing", "Expensive hobbies", "Dating apps"],
                "reaction": f"Already committed to a competitor{script_hint}. This doesn't offer anything new and feels like typical advertising fluff.",
                "likely_action": "Scroll past and continue with current brand.",
                "key_concern": "No compelling reason to switch - all marketing claims are the same.",
                "resonance_elements": ["visuals"],
                "engagement_drivers": [],
                "conversion_blockers": ["message", "product_shot"],
                "suggested_questions": [
                    "What would make you actually stop and watch this?",
                    "What brands have earned your trust, and why?",
                    "What's the most annoying thing about this ad?",
                    "How could they prove this isn't just marketing speak?"
                ],
            },
        ]
        
        medium_templates = [
            {
                "full_name": "Priya Sharma",
                "persona": "Junior Doctor",
                "gender": "Female",
                "age_range": "28",
                "race_ethnicity": "British Indian",
                "location": "Birmingham",
                "occupation": "F2 doctor at Queen Elizabeth Hospital, specialising in A&E",
                "background_story": "Priya is in her second foundation year, exhausted from 12-hour shifts but passionate about emergency medicine. She shares a flat with two other junior doctors near Five Ways. Her parents run a restaurant in Solihull and worry she doesn't eat properly.",
                "interests": ["Yoga", "True crime podcasts", "Cooking for relaxation", "Netflix binges on days off", "Houseplants"],
                "daily_routine": "Shifts vary wildly - could be 7am or 7pm starts. Days off are sacred: lie-in, brunch, evening yoga, early night",
                "pain_points": ["Exhaustion", "NHS pressures", "No time for dating", "Student loan debt"],
                "reaction": f"Enjoys the visuals{script_hint} but wants more concrete details before committing time to investigate.",
                "likely_action": "Save post, might research on a rare day off.",
                "key_concern": "Needs clearer value proposition - time is precious.",
                "resonance_elements": ["visuals", "hook"],
                "engagement_drivers": ["Visual appeal", "Convenience factor"],
                "conversion_blockers": ["message"],
                "suggested_questions": [
                    "What would make you spend your limited free time on this?",
                    "Does this fit into your chaotic schedule?",
                    "What's the one thing that would make you commit?",
                    "How do you usually discover new products?"
                ],
            },
            {
                "full_name": "Marcus Williams",
                "persona": "Personal Trainer",
                "gender": "Male",
                "age_range": "34",
                "race_ethnicity": "Black British (Caribbean heritage)",
                "location": "South London, Brixton",
                "occupation": "Self-employed PT with a studio in Streatham, also does online coaching",
                "background_story": "Marcus was a semi-professional footballer until a knee injury at 24. He retrained as a PT and has built a loyal client base. He's single, lives above a Caribbean takeaway his mum owns, and is saving for his own gym space.",
                "interests": ["Fitness", "Football", "Meal prepping", "Business podcasts", "Sneaker collecting"],
                "daily_routine": "5am client sessions, mid-morning content creation, afternoon clients, evening meal prep and admin, early sleep",
                "pain_points": ["Irregular income", "Client no-shows", "Social media algorithm changes", "Knee still plays up"],
                "reaction": f"Appreciates the production quality{script_hint} but skeptical of marketing claims - sees too many in his industry.",
                "likely_action": "Google the product, check reviews, maybe try if there's a money-back guarantee.",
                "key_concern": "Wants authentic user testimonials, not paid influencers.",
                "resonance_elements": ["visuals", "music"],
                "engagement_drivers": ["Production quality", "Credibility"],
                "conversion_blockers": ["message"],
                "suggested_questions": [
                    "What would make you recommend this to clients?",
                    "How do you verify if a product actually works?",
                    "What's missing from this ad that would convince you?",
                    "Would you trust this brand?"
                ],
            },
            {
                "full_name": "Eleanor Hughes",
                "persona": "Primary School Teacher",
                "gender": "Female",
                "age_range": "42",
                "race_ethnicity": "White British",
                "location": "Norwich",
                "occupation": "Year 4 teacher at a state primary, also deputy head",
                "background_story": "Eleanor has taught for 18 years and still loves it, despite the paperwork. She's married to a nurse, has two teenagers, and they've just paid off their mortgage. She's thinking about what the next chapter looks like.",
                "interests": ["Gardening", "Book club", "Walking in the Norfolk Broads", "Cooking", "Mindfulness"],
                "daily_routine": "6am alarm, school by 7:30, teaching and admin until 5pm, marking at home, tries to protect weekends",
                "pain_points": ["Teacher burnout", "Screen time battles with teens", "Aging parents far away", "Energy levels dropping"],
                "reaction": f"Likes the convenience angle{script_hint} but too busy and tired to investigate further.",
                "likely_action": "Save for later, will probably forget.",
                "key_concern": "Needs immediate, clear benefit - no time for complicated products.",
                "resonance_elements": ["hook", "cta"],
                "engagement_drivers": ["Convenience messaging", "Time-saving promise"],
                "conversion_blockers": [],
                "suggested_questions": [
                    "What would make you actually remember this ad?",
                    "How could they make the benefit clearer faster?",
                    "What would your reaction be seeing this in a shop?",
                    "Do you think this product is for someone like you?"
                ],
            },
            {
                "full_name": "Oliver Bennett",
                "persona": "University Student",
                "gender": "Male",
                "age_range": "20",
                "race_ethnicity": "White British",
                "location": "Leeds",
                "occupation": "Second-year English Literature student at University of Leeds, part-time barista",
                "background_story": "Oli is from a small town in Cumbria and Leeds was his big city escape. He works 15 hours a week at a coffee shop, lives in a house share with four others, and is trying to figure out what to do after uni.",
                "interests": ["Live music", "Football (Leeds United)", "Vintage clothing", "Poetry", "Night outs"],
                "daily_routine": "Lectures when he has them, barista shifts, library sessions, pre-drinks at the flat, Fruity Fridays",
                "pain_points": ["Money", "Essay deadlines", "Future career anxiety", "Cost of living crisis hitting hard"],
                "reaction": f"The vibe is right{script_hint} but they've seen similar ads a hundred times before.",
                "likely_action": "Might click if it shows up again, or if mates recommend it.",
                "key_concern": "Ad fatigue - another brand trying to be cool.",
                "resonance_elements": ["music", "visuals", "humor"],
                "engagement_drivers": ["Aesthetic appeal", "Trend alignment", "Price point"],
                "conversion_blockers": [],
                "suggested_questions": [
                    "Would your housemates rate this?",
                    "What would make this stand out from other ads?",
                    "Is this brand 'for you' or trying too hard?",
                    "What would make you actually buy this?"
                ],
            },
            {
                "full_name": "Fatima Al-Hassan",
                "persona": "Accountant & Mum",
                "gender": "Female",
                "age_range": "38",
                "race_ethnicity": "British Arab",
                "location": "Bradford",
                "occupation": "Senior accountant at a mid-size firm, working 4 days a week",
                "background_story": "Fatima negotiated a 4-day week after her third child. She's juggling a demanding career with raising three kids under 10, while also caring for her mother-in-law who lives nearby. Her husband works shifts at the hospital.",
                "interests": ["Family time", "Cooking Middle Eastern food", "Podcasts during commute", "Online shopping late at night", "Prayer and community"],
                "daily_routine": "School run chaos, office by 9am, leave by 4pm for pickup, homework battles, dinner, kids to bed, collapse",
                "pain_points": ["Time poverty", "Mental load", "Guilt about everything", "Finding halal products"],
                "reaction": f"Interested in the benefits{script_hint} but wants more practical information about ingredients and suitability for her family.",
                "likely_action": "Check the website for detailed info, read reviews from similar families.",
                "key_concern": "Is this suitable for my family? Need more details.",
                "resonance_elements": ["message", "product_shot"],
                "engagement_drivers": ["Family focus", "Practical benefits"],
                "conversion_blockers": ["product_shot"],
                "suggested_questions": [
                    "What would help you decide if this is right for your family?",
                    "What information is missing from this ad?",
                    "Would you trust recommendations from others like you?",
                    "How do you usually research products for your family?"
                ],
            },
            {
                "full_name": "Tom Fletcher",
                "persona": "Retired Civil Servant",
                "gender": "Male",
                "age_range": "68",
                "race_ethnicity": "White British",
                "location": "Edinburgh",
                "occupation": "Retired from the Scottish Government; now active in local history society",
                "background_story": "Tom worked in policy for 35 years before retiring. He lives alone after an amicable divorce, has two grown-up daughters in London and Glasgow, and is busier than ever with volunteer commitments. He's surprisingly tech-savvy for his age.",
                "interests": ["Scottish history", "Hillwalking", "Whisky appreciation", "Grandchildren", "Current affairs"],
                "daily_routine": "Morning walk to the newsagent, coffee and papers, volunteer work or history society, afternoon reading, dinner with Radio 4",
                "pain_points": ["Keeping up with grandchildren's lives from afar", "Health niggles", "Concern about climate"],
                "reaction": f"Finds the ad entertaining{script_hint} but not sure if it's aimed at someone his age.",
                "likely_action": "Might mention it to daughters, could consider as a gift idea.",
                "key_concern": "Unclear if product suits his demographic.",
                "resonance_elements": ["emotion", "music"],
                "engagement_drivers": ["Entertainment value", "Quality perception"],
                "conversion_blockers": ["cta"],
                "suggested_questions": [
                    "Do you feel this ad is speaking to you?",
                    "Would you consider this as a gift?",
                    "What would make this more relevant to your life?",
                    "How do you usually discover new products?"
                ],
            },
        ]
        
        # Select template based on fit and variant
        if fit == "HIGH":
            template_list = high_templates
        elif fit == "LOW":
            template_list = low_templates
        else:
            template_list = medium_templates
        
        # Use variant to cycle through templates
        template_idx = variant % len(template_list)
        base = template_list[template_idx].copy()
        
        persona = dict(base)
        persona["fit"] = fit
        persona["engagement_level"] = "High" if fit == "HIGH" else ("Low" if fit == "LOW" else "Medium")
        persona["profile"] = persona["persona"]
        
        return persona

    def _extract_supers_via_ocr(self, frames: List[str]) -> List[str]:
        """Attempt to read legal supers/in-screen copy using OCR."""
        if not (pytesseract and Image):
            return []
        extracted: List[str] = []
        seen = set()
        for frame_data in frames[:6]:
            try:
                image_bytes = base64.b64decode(frame_data)
                image = Image.open(BytesIO(image_bytes))
            except Exception:
                continue
            try:
                text = pytesseract.image_to_string(image)
            except Exception:
                continue
            for line in text.splitlines():
                cleaned = line.strip()
                if not cleaned or len(cleaned) < 4:
                    continue
                alpha_chars = [ch for ch in cleaned if ch.isalpha()]
                if len(alpha_chars) < 3:
                    continue
                uppercase_count = sum(ch.isupper() for ch in alpha_chars)
                uppercase_ratio = uppercase_count / len(alpha_chars) if alpha_chars else 0
                if uppercase_ratio < 0.5:
                    continue
                normalized = " ".join(cleaned.split())
                normalized = normalized.rstrip("-_")
                key = normalized.lower()
                if key and key not in seen:
                    seen.add(key)
                    extracted.append(normalized)
            if len(extracted) >= 10:
                break
        return extracted[:10]

    def _summarize_script(self, script_text: str, max_chars: int = 1600) -> str:
        """Return a concise script excerpt for prompting."""
        if not script_text:
            return ""
        cleaned = script_text.strip()
        if len(cleaned) <= max_chars:
            return cleaned
        sentences = re.split(r'(?<=[.!?])\s+', cleaned)
        summary_parts: List[str] = []
        total = 0
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            summary_parts.append(sentence)
            total += len(sentence) + 1
            if total >= max_chars * 0.75 or len(summary_parts) >= 5:
                break
        summary = " ".join(summary_parts).strip()
        if len(summary) > max_chars:
            summary = summary[:max_chars].rsplit(" ", 1)[0]
        truncated_note = f" … (script truncated from {len(cleaned):,} characters)"
        if len(summary) + len(truncated_note) > max_chars:
            summary = summary[: max_chars - len(truncated_note)].rsplit(" ", 1)[0]
        return summary + truncated_note
    
    def _should_retry(self, error_str: str) -> bool:
        """Determine if an API error is transient and worth retrying."""
        retry_keywords = [
            "timeout",
            "temporarily unavailable",
            "try again",
            "internal error",
            "deadline exceeded",
            "connection reset",
            "503",
            "504",
            "gateway",
            "unavailable",
            "rate limit"
        ]
        return any(keyword in error_str for keyword in retry_keywords)
    
    def _extract_retry_delay(self, error_message: str) -> Optional[float]:
        """Extract retry delay in seconds from API error message.
        
        Args:
            error_message: Full error message from Gemini API
            
        Returns:
            Retry delay in seconds, or None if not found
        """
        import re
        # Try to find "Please retry in Xs" pattern
        match = re.search(r'Please retry in ([\d.]+)s', error_message, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        
        # Try to find retry_delay { seconds: X } pattern
        match = re.search(r'retry_delay\s*\{[^}]*seconds:\s*(\d+)', error_message, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        
        # Default to 60 seconds if quota error but no delay found
        if "quota" in error_message.lower() or "429" in error_message:
            return 60.0
        
        return None
    
    def _format_quota_error(self, error: Exception) -> str:
        """Format a user-friendly quota error message.
        
        Args:
            error: The exception object from Gemini API
            
        Returns:
            User-friendly error message
        """
        error_str = str(error)
        
        # Check if it's a free tier limit
        if "free_tier" in error_str.lower():
            return ("API quota exceeded: Free tier limit reached (2 requests/minute). "
                   "Please wait 1 minute and try again, or upgrade your Google AI plan at "
                   "https://aistudio.google.com/app/apikey")
        
        # Check for specific quota metric
        if "generate_content" in error_str.lower():
            return ("API quota exceeded: Rate limit reached. "
                   "Please wait a moment and try again, or check your usage at "
                   "https://ai.dev/usage?tab=rate-limit")
        
        # Generic quota error
        return ("API quota exceeded. Please try again later or upgrade your Google AI plan. "
               "For more information, visit https://ai.google.dev/gemini-api/docs/rate-limits")
    
    def _create_fallback_response(self, text: str) -> Dict:
        """Create a structured response when JSON parsing fails"""
        return {
            "breakdown": {
                "content_type": "Unknown",
                "duration_category": "Unknown",
                "key_elements": ["Analysis text provided but not in expected format"],
                "narrative_structure": text[:200] + "...",
                "target_audience": "Could not determine",
                "production_quality": "Unknown",
                "key_messages": [],
                "call_to_action": "Not identified",
                "identification_confidence": 0,
                "possible_alternatives": []
            },
            "estimated_outcome": {
                "primary_goal": "Unknown",
                "effectiveness_score": 0,
                "reasoning": "Could not parse structured analysis",
                "score_rationale": []
            },
            "green_highlights": [],
            "yellow_highlights": [],
            "audience_reactions": [],
            "summary": text[:500] if text else "Analysis failed to produce structured output"
        }
