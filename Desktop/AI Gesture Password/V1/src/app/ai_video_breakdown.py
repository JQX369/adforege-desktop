"""AI Video Breakdown Module using Google Gemini"""

import base64
import json
import logging
import os
import time
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from collections import OrderedDict

import cv2
import google.generativeai as genai

logger = logging.getLogger(__name__)

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
                from app.config_secure import GOOGLE_API_KEY
                self.api_key = GOOGLE_API_KEY
            except ImportError:
                from app.config import GOOGLE_API_KEY
                self.api_key = GOOGLE_API_KEY
        
        # Configure Gemini if we have a valid key
        self.has_valid_key = False
        if self.api_key and self.api_key != "DEMO_KEY_GET_YOUR_OWN" and len(self.api_key.strip()) > 10:
            try:
                genai.configure(api_key=self.api_key)
                # Initialize the model using utility function with automatic fallback
                from app.gemini_utils import create_gemini_model
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
        
        self.logger = logging.getLogger('app.ai_video_breakdown')
    
    def extract_video_frames(self, video_path: str, max_frames: int = 10) -> List[str]:
        """Extract key frames from video for analysis"""
        frames_base64 = []
        
        try:
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            if total_frames == 0:
                return frames_base64
            
            base_indices = {0, max(total_frames // 2, 0), max(total_frames - 1, 0)}
            base_indices = {idx for idx in base_indices if 0 <= idx < total_frames}
            motion_samples = min(3, max_frames // 2)
            interval = max(1, total_frames // max_frames) if total_frames > max_frames else 1
            next_uniform_index = 0
            captured_indices = set()
            top_motion: List[Tuple[float, Any, int]] = []
            prev_gray = None
            frame_idx = 0
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            
            uniform_limit = max_frames - motion_samples if max_frames > motion_samples else max_frames
            
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                if frame_idx in base_indices and frame_idx not in captured_indices and len(frames_base64) < max_frames:
                    frames_base64.append(self._encode_frame(frame))
                    captured_indices.add(frame_idx)
                
                elif (
                    len(frames_base64) < uniform_limit
                    and frame_idx >= next_uniform_index
                    and frame_idx not in captured_indices
                ):
                    frames_base64.append(self._encode_frame(frame))
                    captured_indices.add(frame_idx)
                    next_uniform_index += interval
                
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                if prev_gray is not None:
                    diff = cv2.absdiff(prev_gray, gray)
                    score = float(diff.mean())
                    if len(top_motion) < motion_samples:
                        top_motion.append((score, frame.copy(), frame_idx))
                        top_motion.sort(key=lambda x: x[0])
                    elif score > top_motion[0][0]:
                        top_motion[0] = (score, frame.copy(), frame_idx)
                        top_motion.sort(key=lambda x: x[0])
                prev_gray = gray
                frame_idx += 1
            
            cap.release()
            
            for _, motion_frame, motion_idx in sorted(top_motion, key=lambda x: x[0], reverse=True):
                if len(frames_base64) >= max_frames:
                    break
                if motion_idx in captured_indices:
                    continue
                frames_base64.append(self._encode_frame(motion_frame))
                captured_indices.add(motion_idx)
            
            logger.info(f"Extracted {len(frames_base64)} frames from video (optimized sampling)")
            
        except Exception as e:
            logger.error(f"Error extracting frames: {e}")
        
        return frames_base64
    
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
    
    def analyze_video(
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
            
            # Get video duration first
            video_duration = self._get_video_duration(video_path)
            logger.info(f"Analyzing video: {video_path} (duration: {video_duration}s)")
            
            # Extract key frames
            max_frames = 10 if detail_level == "full" else 5
            frames = self.extract_video_frames(video_path, max_frames=max_frames)
            
            if not frames:
                return {
                    "error": "Could not extract frames from video",
                    "analysis_status": "FAILED"
                }
            
            if not supers_texts:
                supers_texts = self._extract_supers_via_ocr(frames)

            # Create the structured prompt with video duration
            prompt = self._create_analysis_prompt(
                video_duration,
                detail_level=detail_level,
                script_text=script_text,
                supers_texts=supers_texts,
                audience_country=audience_country,
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
            # Note: The Google Generative AI SDK doesn't automatically retry quota/rate limit errors (429).
            # We implement manual retry logic that respects the API's suggested retry delay.
            logger.info("Sending frames to Gemini for analysis...")
            response = None
            max_attempts = 3
            for attempt in range(max_attempts):
                try:
                    response = self.model.generate_content(
                        [prompt] + frame_parts,
                        request_options={"timeout": 120}
                    )
                    break
                except Exception as api_error:
                    # The SDK doesn't have built-in retry for quota errors, so we handle them manually.
                    # The API error messages include retry delay information that we extract and respect.
                    error_str = str(api_error).lower()
                    error_type = type(api_error).__name__
                    # API key issues are never retried
                    if "api key" in error_str or "api_key" in error_str or "invalid" in error_str:
                        logger.warning(f"API key validation failed: {api_error}")
                        return {
                            "error": "Invalid Google API key. Please check your API key configuration.",
                            "analysis_status": "ERROR",
                            "breakdown": {},
                            "estimated_outcome": {},
                            "green_highlights": [],
                            "yellow_highlights": [],
                            "audience_reactions": [],
                            "summary": "AI analysis failed due to invalid API key. Please verify your Google API key at https://aistudio.google.com/app/apikey"
                        }
                    if "quota" in error_str or "429" in error_str:
                        # Try to extract retry delay from error message
                        retry_delay = self._extract_retry_delay(str(api_error))
                        if retry_delay and attempt < max_attempts - 1:
                            logger.warning(f"API quota exceeded (attempt {attempt + 1}/{max_attempts}). "
                                         f"Retrying in {retry_delay:.1f}s...")
                            time.sleep(retry_delay)
                            continue
                        else:
                            # Final attempt failed or no retry delay found
                            logger.error(f"API quota exceeded after {attempt + 1} attempts: {api_error}")
                            error_msg = self._format_quota_error(api_error)
                            return {
                                "error": error_msg,
                                "analysis_status": "ERROR",
                                "breakdown": {},
                                "estimated_outcome": {},
                                "green_highlights": [],
                                "yellow_highlights": [],
                                "audience_reactions": [],
                                "summary": f"Analysis failed due to API quota limits. {error_msg}"
                            }
                    if attempt < max_attempts - 1 and self._should_retry(error_str):
                        backoff = 1 + attempt
                        logger.warning(f"Temporary AI error ({api_error}). Retrying in {backoff}s...")
                        time.sleep(backoff)
                        continue
                    raise api_error
            
            # Check if we got a response
            if response is None:
                logger.error("Failed to get response from Gemini API after all retry attempts")
                return {
                    "error": "Failed to analyze video: API request failed after retries. Please try again later.",
                    "analysis_status": "ERROR",
                    "breakdown": {},
                    "estimated_outcome": {},
                    "green_highlights": [],
                    "yellow_highlights": [],
                    "audience_reactions": [],
                    "summary": "Analysis failed: Unable to get response from AI service. Please try again."
                }
            
            # Parse the response
            result = self._parse_response(
                response.text,
                script_text=script_text,
                supers_texts=supers_texts,
                audience_country=audience_country,
            )
            result['analysis_status'] = 'COMPLETE'
            result['analyzed_at'] = datetime.now().isoformat()
            result['analysis_mode'] = detail_level
            result.setdefault('debug', {})['ocr_supers'] = supers_texts or []
            if audience_country:
                result.setdefault("audience_context", {})["airing_country"] = audience_country
            if detail_level == "quick":
                result['audience_reactions'] = []
            
            logger.info("Video analysis completed successfully")
            return result
            
        except Exception as e:
            error_str = str(e).lower()
            # Check if it's an API key error
            if "api key" in error_str or "api_key" in error_str or "invalid" in error_str or "api_key_invalid" in error_str:
                logger.warning(f"API key validation failed during video analysis: {e}")
                return {
                    "error": "Invalid Google API key. Please check your API key configuration.",
                    "analysis_status": "ERROR",
                    "breakdown": {},
                    "estimated_outcome": {},
                    "green_highlights": [],
                    "yellow_highlights": [],
                    "audience_reactions": [],
                    "summary": "AI analysis failed due to invalid API key. Please verify your Google API key at https://aistudio.google.com/app/apikey"
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
    ) -> str:
        """Create the structured prompt for video analysis"""
        mode_hint = ""
        if detail_level == "quick":
            mode_hint = """
QUICK MODE:
- Keep responses concise (2-3 bullets per list).
- Set "audience_reactions": [].
- Focus on the most critical green/yellow highlights only."""
        # Determine duration category based on actual duration
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
        
        # Build the prompt without f-string to avoid brace escaping issues
        prompt = """Analyze this video/advertisement and provide a comprehensive breakdown in the following JSON structure:

The video is """ + str(video_duration) + """ seconds long.

Mode: """ + detail_level.upper() + """.
""" + mode_hint + """
""" + country_section + """

CRITICAL: First identify WHAT is being advertised/promoted. Be specific about the product, service, or brand.
""" + script_section + supers_section + """

{
    "breakdown": {
        "what_is_advertised": "Specific product/service/brand being promoted",
        "product_category": "e.g., Automotive/Food & Beverage/Technology/Fashion/Finance/etc",
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
    
    "estimated_outcome": {
        "primary_goal": "Drive Sales/Brand Awareness/Education/Entertainment/etc",
        "effectiveness_score": 0-100,
        "reasoning": "explanation of score",
        "score_rationale": ["bullet reason 1", "bullet reason 2"],
        "expected_metrics": {
            "engagement_rate": "Low/Medium/High",
            "conversion_potential": "Low/Medium/High",
            "shareability": "Low/Medium/High",
            "memorability": "Low/Medium/High"
        }
    },
    
    "green_highlights": [
        {
            "aspect": "What's working well",
            "explanation": "Why it's effective",
            "impact": "High/Medium/Low",
            "evidence_text": "Exact quote or visual reference proving this strength"
        }
    ],
    
    "yellow_highlights": [
        {
            "aspect": "What could be improved",
            "suggestion": "Specific improvement recommendation",
            "priority": "High/Medium/Low",
            "evidence_text": "Exact quote or visual reference showing the weakness"
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
            "persona": "Tech-Savvy Millennial",
            "gender": "Female",
            "age_range": "25-34",
            "race_ethnicity": "Black British",
            "location": "London (Urban)",
            "reaction": "Detailed reaction",
            "engagement_level": "High/Medium/Low",
            "likely_action": "What they would do after viewing",
            "fit": "HIGH",
            "key_concern": "Optional risk or objection to note"
        },
        {
            "persona": "Busy Parent",
            "gender": "Male",
            "age_range": "40-49",
            "race_ethnicity": "Latino",
            "location": "US Suburban",
            "reaction": "Detailed reaction",
            "engagement_level": "High/Medium/Low",
            "likely_action": "What they would do after viewing",
            "fit": "LOW",
            "key_concern": "Optional risk or objection to note"
        },
        {
            "persona": "Retired Senior",
            "gender": "Female",
            "age_range": "65+",
            "race_ethnicity": "Filipino",
            "location": "Metro Manila",
            "reaction": "Detailed reaction",
            "engagement_level": "High/Medium/Low",
            "likely_action": "What they would do after viewing",
            "fit": "MEDIUM",
            "key_concern": "Optional risk or objection to note"
        },
        {
            "persona": "Gen Z Student",
            "gender": "Non-binary",
            "age_range": "18-24",
            "race_ethnicity": "Mixed heritage",
            "location": "Global / Digital",
            "reaction": "Detailed reaction",
            "engagement_level": "High/Medium/Low",
            "likely_action": "What they would do after viewing",
            "fit": "MEDIUM",
            "key_concern": "Optional risk or objection to note"
        }
    ],
    
    "summary": "Comprehensive summary of the video's strengths, weaknesses, and overall effectiveness. Start by clearly stating what is being advertised.",
    
    "one_sentence_summary": "Punchy, executive-ready summary in one sentence."
}

Ensure each `green_highlights`, `yellow_highlights`, and `soft_risks` item includes `evidence_text` quoting the script or supers so humans can verify the claim. Ensure `audience_reactions` contains exactly four personas: (1) a HIGH-fit advocate describing why the ad resonates, (2) a LOW-fit skeptic explaining why it does not, and (3-4) two varied personas with neutral/mixed opinions. Each entry must include gender, age_range, race_ethnicity, location, fit, reaction, likely action, and key_concern (especially for LOW fit).

Analyze the video frames thoroughly. MOST IMPORTANTLY: Identify exactly what product, service, or brand is being advertised. Look for:
- Brand logos and names
- Product shots and packaging
- Service demonstrations
- Company branding elements

If your identification confidence is below 70%, include at least two plausible alternative ads/brands in `possible_alternatives` with a short note why they might fit. Flag any soft risks (messaging confusion, tonal mismatches, compliance concerns) with impact and mitigation guidance. Finish with a single-sentence executive summary.
Be specific and actionable in your recommendations."""
        
        return prompt
    
    def _parse_response(
        self,
        response_text: str,
        script_text: Optional[str] = None,
        supers_texts: Optional[List[str]] = None,
        audience_country: Optional[str] = None,
    ) -> Dict:
        """Parse the AI response into structured format"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                parsed = json.loads(json_str)
                parsed, breakdown_missing = self._ensure_breakdown_defaults(parsed)
                parsed, response_missing = self._ensure_response_defaults(
                    parsed,
                    script_text=script_text,
                )
                if audience_country:
                    parsed.setdefault("audience_context", {})["airing_country"] = audience_country
                missing_fields = breakdown_missing + response_missing
                if missing_fields:
                    logger.warning(f"AI breakdown missing fields: {', '.join(sorted(set(missing_fields)))}")
                return parsed
            else:
                # Fallback: create structured response from text
                return self._create_fallback_response(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return self._create_fallback_response(response_text)
    
    def _ensure_breakdown_defaults(self, parsed: Dict) -> Tuple[Dict, List[str]]:
        """Ensure new breakdown metadata fields are always present."""
        missing_fields: List[str] = []
        breakdown = parsed.setdefault("breakdown", {})
        
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
        
        return parsed, missing_fields
    
    def _ensure_response_defaults(
        self,
        parsed: Dict,
        script_text: Optional[str] = None,
    ) -> Tuple[Dict, List[str]]:
        """Ensure non-breakdown sections exist with safe defaults."""
        missing_fields: List[str] = []
        
        outcome = parsed.get("estimated_outcome")
        if not isinstance(outcome, dict):
            outcome = {
                "primary_goal": "Unknown",
                "effectiveness_score": 0,
                "reasoning": "No structured rationale provided",
                "expected_metrics": {
                    "engagement_rate": "Unknown",
                    "conversion_potential": "Unknown",
                    "shareability": "Unknown",
                    "memorability": "Unknown"
                }
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
            if not isinstance(outcome.get("expected_metrics"), dict):
                outcome["expected_metrics"] = {
                    "engagement_rate": "Unknown",
                    "conversion_potential": "Unknown",
                    "shareability": "Unknown",
                    "memorability": "Unknown"
                }
                missing_fields.append("estimated_outcome.expected_metrics")
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
        
        if not isinstance(parsed.get("one_sentence_summary"), str):
            parsed["one_sentence_summary"] = ""
            missing_fields.append("one_sentence_summary")
        
        if not isinstance(parsed.get("summary"), str):
            parsed["summary"] = ""
            missing_fields.append("summary")
        
        return parsed, missing_fields

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
            existing_priority = self._priority_rank(existing.get("priority"))
            incoming_priority = self._priority_rank(entry.get("priority"))
            if incoming_priority > existing_priority:
                existing["priority"] = entry.get("priority")
        return list(deduped.values()) + extras

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
                persona = str(
                    reaction.get("persona")
                    or reaction.get("profile")
                    or "Audience Persona"
                ).strip()
                gender = reaction.get("gender") or "Not specified"
                age_range = reaction.get("age_range") or "Unknown"
                race_ethnicity = reaction.get("race_ethnicity") or "Not specified"
                location = reaction.get("location") or "Not specified"
                engagement = reaction.get("engagement_level") or "Unknown"
                fit = str(reaction.get("fit") or "MEDIUM").upper()
                if fit not in {"HIGH", "MEDIUM", "LOW"}:
                    fit = "MEDIUM"
                normalized.append(
                    {
                        "persona": persona or "Audience Persona",
                        "profile": persona or "Audience Persona",
                        "gender": gender,
                        "age_range": age_range,
                        "race_ethnicity": race_ethnicity,
                        "location": location,
                        "reaction": reaction.get("reaction") or "",
                        "engagement_level": engagement,
                        "likely_action": reaction.get("likely_action") or "No predicted action",
                        "key_concern": reaction.get("key_concern") or "",
                        "fit": fit,
                    }
                )
        normalized = self._ensure_persona_mix(normalized, script_text=script_text)
        return normalized[:4]

    def _ensure_persona_mix(
        self,
        reactions: List[Dict[str, Any]],
        script_text: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not reactions:
            reactions = []
        has_high = any(r.get("fit") == "HIGH" for r in reactions)
        has_low = any(r.get("fit") == "LOW" for r in reactions)
        if not has_high:
            reactions.insert(0, self._build_template_persona("HIGH", script_text))
        if not has_low:
            reactions.append(self._build_template_persona("LOW", script_text))
        while len(reactions) < 4:
            reactions.append(
                self._build_template_persona(
                    "MEDIUM",
                    script_text,
                    variant=len(reactions),
                )
            )
        return reactions

    def _build_template_persona(
        self,
        fit: str,
        script_text: Optional[str] = None,
        variant: int = 0,
    ) -> Dict[str, Any]:
        script_hint = ""
        if script_text:
            snippet = script_text.strip().split(".")[0][:120]
            if snippet:
                script_hint = f" referencing lines like “{snippet}”"
        templates = {
            "HIGH": {
                "persona": "High-Signal Brand Enthusiast",
                "gender": "Female",
                "age_range": "25-34",
                "race_ethnicity": "Black British",
                "location": "London",
                "reaction": f"Loves the storytelling{script_hint} and feels the benefits speak directly to her lifestyle.",
                "likely_action": "Share the ad with friends and look for the product online.",
                "key_concern": "",
            },
            "LOW": {
                "persona": "Skeptical Viewer",
                "gender": "Male",
                "age_range": "45-54",
                "race_ethnicity": "White",
                "location": "Midwest US",
                "reaction": f"Does not connect with the tone{script_hint} and questions whether the promises are realistic.",
                "likely_action": "Ignore the ad and stick with trusted brands.",
                "key_concern": "Feels the creative overlooks practical proof.",
            },
            "MEDIUM": {
                "persona": "Curious Explorer",
                "gender": "Non-binary",
                "age_range": "30-39",
                "race_ethnicity": "Latino",
                "location": "Barcelona",
                "reaction": f"Enjoys the visuals{script_hint} but wants more concrete details.",
                "likely_action": "Research reviews before deciding.",
                "key_concern": "Needs clearer value proposition.",
            },
        }
        base = templates["MEDIUM"] if fit not in templates else templates[fit]
        persona = dict(base)
        persona["fit"] = fit
        persona["engagement_level"] = "High" if fit == "HIGH" else ("Low" if fit == "LOW" else "Medium")
        persona["profile"] = persona["persona"]
        # Slightly vary persona names for extra entries
        if variant and fit == "MEDIUM":
            persona["persona"] = f"Trend Seeker #{variant}"
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
                "score_rationale": [],
                "expected_metrics": {
                    "engagement_rate": "Unknown",
                    "conversion_potential": "Unknown",
                    "shareability": "Unknown",
                    "memorability": "Unknown"
                }
            },
            "green_highlights": [],
            "yellow_highlights": [],
            "audience_reactions": [],
            "summary": text[:500] if text else "Analysis failed to produce structured output"
        } 