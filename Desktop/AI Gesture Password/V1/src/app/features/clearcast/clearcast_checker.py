"""Clearcast compliance checker using Google Gemini Pro API"""

import os
import json
import logging
import base64
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import google.generativeai as genai
import cv2
import tempfile

from .clearcast_classifier import (
    ClearcastClassificationResult,
    classification_to_dict,
    classify_clearcast_context,
)
from .clearcast_audio import AudioNormalizationReport, ClearcastAudioAnalyzer
from .clearcast_prompt_builder import PromptContext, build_clearcast_prompt
from .clearcast_knowledge_base import get_knowledge_base
from .validation import SharedValidationEngine, ValidationMode
from app.core.legal_geometry import LegalGeometryVerifier
from app.features.ai_breakdown.substantiation_generator import SubstantiationGenerator
from app.features.ai_breakdown.saliency_engine import SaliencyEngine
from app.core.technical_qc import TechnicalVerifier
from app.core.metadata_verifier import MetadataVerifier
import numpy as np

logger = logging.getLogger(__name__)

# Configure Gemini API
try:
    from app.core.config_secure import GOOGLE_API_KEY
except ImportError:
    from app.core.config import GOOGLE_API_KEY
    
if GOOGLE_API_KEY and GOOGLE_API_KEY != "DEMO_KEY_GET_YOUR_OWN":
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    logger.warning("Google API key not configured - Clearcast features will be limited")

class ClearcastChecker:
    """Check videos for Clearcast compliance using Gemini Pro"""
    
    def __init__(self):
        """Initialize the Clearcast checker"""
        # Initialize Gemini model using utility function with automatic fallback
        from app import gemini_utils
        self.model = gemini_utils.create_gemini_model('pro', GOOGLE_API_KEY, fallback_to_pro=True)
        
        if not self.model:
            logger.warning("Failed to initialize Gemini model for Clearcast checker")
        
        # Load Clearcast PDF path
        self.clearcast_pdf_path = self._get_clearcast_pdf_path()
        
        # Load PDF content once
        self.pdf_content = self._load_pdf_content()
        
        # Load structured rules snapshot if available
        try:
            from .clearcast_rules import load_default_snapshot
            self.rules_snapshot = load_default_snapshot()
        except Exception as snapshot_error:
            logger.warning(f"Unable to load Clearcast rules snapshot: {snapshot_error}")
            self.rules_snapshot = None
        self.audio_analyzer = ClearcastAudioAnalyzer()
        self.technical_verifier = TechnicalVerifier()
        self.metadata_verifier = MetadataVerifier()
        
    def _get_clearcast_pdf_path(self) -> Path:
        """Get the path to the Clearcast PDF"""
        # Try multiple possible locations
        possible_paths = [
            Path("A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf"),
            Path("app/A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf"),
            Path(__file__).parent / "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf",
            Path(__file__).parent.parent / "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf",
            Path(r"C:\Users\Jacques Y\Desktop\AI Gesture Password\V1\A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf")
        ]
        
        for path in possible_paths:
            if path.exists():
                logger.info(f"Found Clearcast PDF at: {path}")
                return path
        
        # If not found, use the last path as default
        logger.warning(f"Clearcast PDF not found in expected locations. Using: {possible_paths[-1]}")
        return possible_paths[-1]
    
    def _load_pdf_content(self) -> Optional[str]:
        """Load and extract text from the Clearcast PDF"""
        try:
            # For now, we'll use a summary of key points
            # In production, you'd use a PDF parser like PyPDF2
            clearcast_summary = """
            CLEARCAST COMPLIANCE KEY POINTS:
            
            1. MISLEADING CLAIMS:
            - All claims must be substantiated
            - No exaggerated performance claims
            - Clear disclaimers for any conditions
            
            2. PROHIBITED CONTENT:
            - No explicit violence or gore
            - No discriminatory content
            - No dangerous behavior without warnings
            - No misleading price information
            
            3. HEALTH & SAFETY:
            - Medical claims need approval
            - Food/drink health claims must be verified
            - Safety warnings for hazardous activities
            
            4. CHILDREN:
            - No direct exhortation to buy
            - Age-appropriate content only
            - No exploitation of trust
            
            5. ALCOHOL:
            - No appeal to under 18s
            - No implication of social success
            - No therapeutic claims
            
            6. GAMBLING:
            - 18+ audience only
            - Responsible gambling message required
            - No targeting vulnerable groups
            
            7. FINANCIAL PRODUCTS:
            - Clear risk warnings
            - APR must be displayed
            - Terms and conditions visible
            
            8. ENVIRONMENTAL CLAIMS:
            - Must be verifiable
            - Life cycle consideration
            - No greenwashing
            """
            
            return clearcast_summary
            
        except Exception as e:
            logger.error(f"Failed to load PDF content: {e}")
            return None
    
    def _trim_script(self, script: Optional[str], limit: int = 800) -> Optional[str]:
        if not script:
            return None
        script = script.strip()
        if len(script) <= limit:
            return script
        return f"{script[:limit]}..."

    def _sanitize_notes(self, notes: Optional[Dict[str, str]]) -> Dict[str, str]:
        if not notes:
            return {}
        return {str(k): str(v) for k, v in notes.items() if v}
    
    def check_video_compliance(
        self,
        video_path: str,
        script_excerpt: Optional[str] = None,
        product_notes: Optional[Dict[str, str]] = None,
        brand_notes: Optional[Dict[str, str]] = None,
        delivery_metadata: Optional[Dict[str, str]] = None,
        verbose_reasoning: bool = False,
        mode: str = "web",
    ) -> Dict:
        """
        Check video for Clearcast compliance

        Args:
            video_path: Path to video file
            script_excerpt: Optional script/transcript text
            product_notes: Optional product information
            brand_notes: Optional brand guidelines
            delivery_metadata: Optional metadata including clock_number
            verbose_reasoning: Include detailed reasoning in output
            mode: Validation mode - "web" (tolerant) or "pure" (strict DPP AS-11)

        Returns:
            Dict with compliance results
        """
        try:
            # Check if model is available
            if not self.model:
                return {
                    "error": "Gemini model not available. Please check API key configuration.",
                    "compliance_status": "ERROR",
                    "overall_risk": "UNKNOWN",
                    "red_flags": [],
                    "yellow_flags": [],
                    "summary": "Clearcast check failed: Gemini model not initialized"
                }
            
            # Extract key frames from video
            logger.info(f"Extracting frames from video: {video_path}")
            # Extract 20 frames with timestamps for better accuracy
            frames_with_time = self._extract_key_frames(video_path, num_frames=20)
            
            if not frames_with_time:
                return {
                    "error": "Could not extract frames from video",
                    "compliance_status": "ERROR",
                    "overall_risk": "UNKNOWN",
                    "red_flags": [],
                    "yellow_flags": [],
                    "summary": "Failed to extract video frames for analysis"
                }
            
            normalized_frames: List[Tuple[str, str]] = []
            for idx, frame_entry in enumerate(frames_with_time):
                if isinstance(frame_entry, (tuple, list)) and len(frame_entry) >= 2:
                    normalized_frames.append((frame_entry[0], frame_entry[1]))
                else:
                    normalized_frames.append((frame_entry, f"{idx:02d}:00"))
            frames_with_time = normalized_frames
            
            trimmed_script = self._trim_script(script_excerpt)
            sanitized_product = self._sanitize_notes(product_notes)
            sanitized_brand = self._sanitize_notes(brand_notes)
            classification_result: Optional[ClearcastClassificationResult] = None
            classification_dict: Dict[str, Any] = {}
            extra_notes: List[str] = []

            if trimmed_script or sanitized_product or sanitized_brand:
                try:
                    classification_result = classify_clearcast_context(
                        trimmed_script or "",
                        sanitized_product,
                        sanitized_brand,
                    )
                    classification_dict = classification_to_dict(classification_result)
                    labels = ", ".join(
                        [
                            (area.get("label") if isinstance(area, dict) else str(area))
                            for area in classification_dict.get("priority_focus_areas", [])
                            if (isinstance(area, dict) and area.get("label"))
                        ]
                    )
                    if labels:
                        extra_notes.append(
                            f"Priority risk focus areas detected: {labels}. Cross-check these areas against the rules snapshot."
                        )
                except Exception as classify_error:
                    logger.warning(f"Failed to classify Clearcast context: {classify_error}")

            # RAG Integration: Retrieve specific rules based on classification
            rag_context = ""
            try:
                kb = get_knowledge_base()
                
                # Gather keywords from classification
                keywords = []
                if classification_dict:
                    # Add focus areas
                    for area in classification_dict.get("priority_focus_areas", []):
                        if isinstance(area, dict):
                            keywords.append(area.get("label", ""))
                        else:
                            keywords.append(str(area))
                    
                    # Add detected product/industry
                    keywords.append(classification_dict.get("industry", ""))
                    keywords.append(classification_dict.get("product_type", ""))
                
                # Add explicit notes keywords
                if sanitized_product:
                    keywords.extend(sanitized_product.values())
                
                # Clean keywords
                keywords = [k for k in keywords if k and len(k) > 2]
                
                if keywords:
                    logger.info(f"Querying Regulatory RAG with keywords: {keywords}")
                    rag_context = kb.get_relevant_rules(keywords)
                    extra_notes.append("SPECIFIC REGULATORY GUIDANCE (Cite these rules):")
                    extra_notes.append(rag_context)
                    
            except Exception as rag_error:
                logger.warning(f"Failed to retrieve RAG context: {rag_error}")

            prompt_context = PromptContext(
                script_excerpt=trimmed_script,
                product_notes=sanitized_product,
                brand_notes=sanitized_brand,
                verbose_reasoning=verbose_reasoning,
                extra_notes=extra_notes,
            )
            prompt = build_clearcast_prompt(self.rules_snapshot, prompt_context) + """

Use the provided video frames and audio to cite exact timestamps for every flagged item.
Base your analysis on actual evidence within the supplied material.

IMPORTANT: For any on-screen legal text (supers), you must provide the bounding box in the format [ymin, xmin, ymax, xmax] (0-1000 scale) and the estimated duration in seconds.
Return this in a "legal_text_check" list within the JSON, containing objects with: "text", "bbox", "duration_seconds".

IMPORTANT: Identify all specific claims made in the ad (e.g. "No. 1 in the UK", "Cheaper than X", "New Formula").
Return this in a "claims_check" list within the JSON, containing objects with: "claim_text", "claim_type" (one of: comparative, superlative, testimonial, environmental, price, new, general).

IMPORTANT: Detect whether the video contains a slate/countdown at the beginning.
Look for: countdown numbers (10, 9, 8... or 3, 2, 1), clock number text (format like "ABC/PROD001/030"), agency/client info cards, or solid color frames with metadata.
Return this in a "slate_detection" object within the JSON:
{
  "slate_detection": {
    "has_slate": true/false,
    "clock_number_detected": "ABC/PROD001/030" or null if not visible,
    "slate_frame_indices": [0, 1, 2] (1-based frame numbers where slate/countdown is visible),
    "slate_end_timestamp": "00:10" (when actual ad content begins)
  }
}

CRITICAL INSTRUCTIONS:
1. CLAIMS FILTERING:
   - EXCLUDE: Call-to-actions (e.g., "Shop now", "Visit website"), URLs/Social handles, UI navigation text (e.g. "About us", "Menu").
   - INCLUDE ONLY: Objective factual claims about the product/service performance, benefits, pricing, or status (e.g. "No. 1", "Award winning").

2. COMPLIANCE STATUS & FLAGS:
   - "RED_FLAGS" are BLOCKING issues that make the ad "Unlikely to clear" or "FAIL".
   - "YELLOW_FLAGS" are warnings, substantiation needs, or minor issues that still allow "Likely to clear".
   - If your clearance_prediction is "Will likely clear", do NOT return any RED_FLAGS. Move borderline issues to YELLOW_FLAGS.
   - If you find RED_FLAGS, the clearance_prediction must be "Unlikely to clear" or "Needs modifications".

3. SUBJECTIVE VS DEFINITIVE FLAGS:
   - Mark flags with "subjective": true if the issue depends on interpretation or Clearcast discretion (e.g., health claim wording that "may" need adjustment).
   - Mark flags with "subjective": false for definitive violations (e.g., missing mandatory disclaimer, explicit prohibited content).
   - Subjective issues should generally be YELLOW_FLAGS (warnings) unless clearly egregious.
"""
            
            # Prepare frames for Gemini
            frame_parts = []
            for i, (frame_base64, timestamp) in enumerate(frames_with_time):
                frame_parts.append(f"\n[Frame {i+1} ({timestamp}) of {len(frames_with_time)}]")
                frame_parts.append({
                    "mime_type": "image/jpeg",
                    "data": frame_base64
                })
            
            # Generate content with frames
            logger.info("Generating Clearcast analysis from frames...")
            response = self.model.generate_content([prompt] + frame_parts)
            
            # Parse the response
            result = self._parse_compliance_response(response.text)

            # Legal Geometry & Saliency Check
            if "legal_text_check" in result:
                verifier = LegalGeometryVerifier()
                saliency_engine = SaliencyEngine()
                
                # Decode frames for saliency check
                cv_frames = []
                for f_b64, _ in frames_with_time:
                    try:
                        nparr = np.frombuffer(base64.b64decode(f_b64), np.uint8)
                        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        cv_frames.append(img)
                    except Exception:
                        pass

                for idx, item in enumerate(result["legal_text_check"]):
                    # Geometry Check
                    check_res = verifier.check_compliance(item)
                    
                    # Saliency Check (Check against the first valid frame for now)
                    attention_status = "Unknown"
                    if cv_frames and item.get('bbox'):
                        # Use the middle frame as a representative sample
                        sample_frame = cv_frames[len(cv_frames)//2]
                        attention_status = saliency_engine.analyze_attention(sample_frame, item['bbox'])
                    
                    if not check_res["overall_pass"] or "Cold" in attention_status:
                        # Add technical flag
                        issue_desc = f"Legal Text Issue: {check_res['text_snippet']}"
                        if not check_res["height_check"]["passed"]:
                            issue_desc += f" {check_res['height_check']['message']}."
                        if not check_res["duration_check"]["passed"]:
                            issue_desc += f" {check_res['duration_check']['message']}."
                        
                        if "Cold" in attention_status:
                            issue_desc += f" [Attention Risk: {attention_status}]"
                        
                        # Build fix guidance based on the issue
                        fix_parts = []
                        if not check_res["height_check"]["passed"]:
                            fix_parts.append("Increase text size to meet the minimum 30 HD scan-line height requirement.")
                        if not check_res["duration_check"]["passed"]:
                            fix_parts.append("Extend the on-screen duration of the text to meet the minimum hold time requirement (0.2s per word + 2-3s buffer).")
                        if "Cold" in attention_status:
                            fix_parts.append("Improve text contrast or move it to a less busy area of the frame to improve visibility.")
                        fix_guidance = " ".join(fix_parts) if fix_parts else "Review and adjust the legal text for compliance."
                        
                        # Estimate frame index from item's frame_index if provided, or use middle frame
                        item_frame_indices = item.get("frame_indices", [len(cv_frames)//2])
                        if not isinstance(item_frame_indices, list):
                            item_frame_indices = [item_frame_indices]
                            
                        flag_payload = {
                            "issue": issue_desc,
                            "severity": "MEDIUM",
                            "timestamp": f"At {item.get('timestamp', 'Visual Check')}",
                            "category": "Technical/Legibility",
                            "impact": "Risk of rejection for illegibility or poor visibility",
                            "fix_required": True,
                            "frame_indices": item_frame_indices,
                            "fix_guidance": fix_guidance
                        }
                        if not check_res["height_check"]["passed"]:
                            flag_payload["height_check"] = check_res["height_check"]
                        if not check_res["duration_check"]["passed"]:
                            flag_payload["duration_check"] = check_res["duration_check"]
                            
                        result["blue_flags"].append(flag_payload)

            # Substantiation Pack Generation
            if "claims_check" in result:
                sub_gen = SubstantiationGenerator()
                result["substantiation_pack"] = sub_gen.generate_pack(result["claims_check"])
            else:
                result["substantiation_pack"] = []

            # Add analyzed frames to result for GUI display
            result["analyzed_frames"] = [
                {"index": i, "timestamp": ts, "image": b64} 
                for i, (b64, ts) in enumerate(frames_with_time)
            ]

            if classification_dict:
                result["classification"] = classification_dict
                result["classification_focus"] = self._build_focus_summary(
                    classification_result, result
                )
                result["disclaimers_required"] = classification_dict.get(
                    "disclaimers_required", []
                )
                logger.info(
                    "Clearcast classification focus areas: %s",
                    [entry.get("label") for entry in result["classification_focus"]],
                )
            else:
                result.setdefault("classification", {})
                result.setdefault("classification_focus", [])
                result.setdefault("disclaimers_required", [])

            # Initialize delivery_metadata with defaults
            result.setdefault("delivery_metadata", {
                "has_slate": False,
                "clock_number": None,
                "slate_frame_indices": [],
                "slate_end_timestamp": None
            })
            
            # Process AI-detected slate/clock information
            slate_detection = result.get("slate_detection", {})
            logger.info(f"Raw slate_detection from AI: {slate_detection}")
            
            if slate_detection and isinstance(slate_detection, dict):
                ai_has_slate = slate_detection.get("has_slate", False)
                ai_clock_number = slate_detection.get("clock_number_detected")
                slate_frame_indices = slate_detection.get("slate_frame_indices", [])
                slate_end_timestamp = slate_detection.get("slate_end_timestamp")
                
                # Populate delivery_metadata from AI detection
                result["delivery_metadata"]["has_slate"] = ai_has_slate
                if slate_frame_indices:
                    result["delivery_metadata"]["slate_frame_indices"] = slate_frame_indices
                if slate_end_timestamp:
                    result["delivery_metadata"]["slate_end_timestamp"] = slate_end_timestamp
                    
                # Use AI-detected clock number if none was provided in delivery_metadata
                if ai_clock_number:
                    result["delivery_metadata"]["clock_number"] = ai_clock_number
                    logger.info(f"Clock number detected from video frames: {ai_clock_number}")
                    
                # Slate detection is informational only - NOT an error
                # Having a slate is expected for approval copies
                # Only flag if slate is MISSING when it should be present
                if ai_has_slate:
                    frame_indices_0based = [idx - 1 for idx in slate_frame_indices if isinstance(idx, int)] if slate_frame_indices else [0, 1, 2]
                    # Log as INFO only, not as a flag (user requested this not be shown as an issue)
                    logger.info(f"Slate/Clock detected in file: Clock={ai_clock_number}, ends at {slate_end_timestamp}")
                    # We don't add a blue_flag for slate presence - it's expected behavior
                    
                logger.info(f"Slate detection result: has_slate={ai_has_slate}, clock={ai_clock_number}, frames={slate_frame_indices}")
            else:
                # No slate_detection object from AI
                logger.info("No slate_detection object returned by AI")
                
            # Merge user-provided delivery_metadata if present
            if delivery_metadata:
                for key, value in delivery_metadata.items():
                    if value and key not in result["delivery_metadata"]:
                        result["delivery_metadata"][key] = value

            try:
                audio_report = self.audio_analyzer.analyze(video_path)
            except Exception as audio_exc:  # pragma: no cover - safety log
                logger.warning(f"Audio analysis failed: {audio_exc}")
                audio_report = AudioNormalizationReport(
                    status="unknown",
                    recommendation="Unable to inspect audio; verify manually.",
                    details=str(audio_exc),
                )
            result["audio_normalization"] = audio_report.__dict__
            logger.info("Audio normalization status: %s", audio_report.status)
            if audio_report.status == "needs_normalization":
                result["blue_flags"].append(
                    {
                        "issue": "Audio loudness outside broadcast target",
                        "severity": "MEDIUM",
                        "timestamp": "Full audio track",
                        "category": "Sound Quality",
                        "impact": audio_report.recommendation,
                        "fix_required": True,
                        "fix_guidance": "Normalize the audio to -23 LUFS (EBU R128 standard) with a true peak of -1 dBTP or lower. Use the 'Fix Issues' button to automatically apply broadcast-standard normalization."
                    }
                )
            
            # Metadata Verification
            # Use AI-detected clock number if available, otherwise user-provided
            clock_number = result["delivery_metadata"].get("clock_number")
            if not clock_number and delivery_metadata:
                clock_number = delivery_metadata.get("clock_number")
            
            is_slated = result["delivery_metadata"].get("has_slate", False)
            
            # Clock Syntax verification
            if clock_number:
                    valid_clock, clock_msg = self.metadata_verifier.verify_clock_syntax(clock_number)
                    if not valid_clock:
                        result["blue_flags"].append({
                            "issue": f"Metadata Error: {clock_msg}",
                            "severity": "HIGH",
                            "timestamp": "Metadata",
                            "category": "Delivery Specs",
                            "impact": "Rejection by Adstream/Peach",
                            "fix_required": True,
                            "fix_guidance": "Correct the clock number to match the format AAA/BBBB123/030 (e.g. ABC/PROD001/030). The last 3 digits should match the content duration in seconds."
                        })
                    
                    # Duration Match
                    # Get video duration from technical check or audio report if available, else probe
                    # We can use audio_analyzer to get duration if needed, but let's assume we have it from frames extraction or technical check
                    # Actually technical verifier gets it. Let's re-probe or use technical verifier result if we had it.
                    # For now, let's use a quick probe or rely on what we have.
                    # We can use the audio report duration if available? No, it doesn't store it.
                    # Let's use the technical verifier's metadata if we ran it.
                    
            # Technical QC Checks (Run first to get metadata)
            # Format
            format_res = self.technical_verifier.verify_format(video_path)
            video_duration = 0.0
            if format_res["passed"]:
                # We don't have duration in metadata yet, let's add it to technical verifier or just probe here.
                # Actually, let's use the audio analyzer's duration check which we added.
                pass
                
            # Let's just use the metadata verifier's helper if we need duration, or rely on technical verifier
            # We need to know if it's a slated master for silence check.
            
            # Probe duration for metadata checks
            try:
                cap = cv2.VideoCapture(video_path)
                fps = cap.get(cv2.CAP_PROP_FPS) or 25
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                video_duration = frame_count / fps
                cap.release()
            except Exception:
                video_duration = 0.0
                
            if clock_number and video_duration > 0:
                # Duration check now handles slated masters automatically
                # verify_duration_match allows: exact match OR clock_duration + common slate durations (10s, 13s, 20s, 30s)
                valid_dur, dur_msg = self.metadata_verifier.verify_duration_match(clock_number, video_duration, allow_slate=True)
                if not valid_dur:
                    result["blue_flags"].append({
                        "issue": f"Duration Mismatch: {dur_msg}",
                        "severity": "HIGH",
                        "timestamp": "Metadata",
                        "category": "Delivery Specs",
                        "impact": "Rejection: File duration does not match Clock Number",
                        "fix_required": True,
                        "fix_guidance": "Trim or adjust the video duration to match the clock number specification. For slated masters, ensure the content duration (excluding slate) matches the clock suffix."
                    })
                
                # Check if slated
                clock_dur_int = self.metadata_verifier.extract_clock_duration(clock_number)
                is_slated = self.metadata_verifier.is_slated_master(video_duration, clock_dur_int)

            # Silence Check
            silence_res = self.audio_analyzer.check_silence_head_tail(video_path, is_slated_master=is_slated)
            if not silence_res["passed"]:
                for detail in silence_res["details"]:
                    result["blue_flags"].append({
                        "issue": f"Silence Violation: {detail}",
                        "severity": "HIGH",
                        "timestamp": "Head/Tail",
                        "category": "Audio Technical",
                        "impact": "Rejection by Clearcast/Broadcaster",
                        "fix_required": True,
                        "fix_guidance": "Ensure silent frames at the head (before content) and tail (after content) of the video. For slated masters, maintain silence during the countdown period."
                    })

            # Technical QC Checks - Use SharedValidationEngine for configurable strictness
            num_analysis_frames = len(frames_with_time)

            # Initialize validation engine based on mode
            validation_mode = ValidationMode.PURE_CLEARCAST if mode == "pure" else ValidationMode.WEB_COMPLIANCE
            validation_engine = SharedValidationEngine(mode=validation_mode)

            # Get legal text data for engine checks (if available from AI analysis)
            legal_text_data = result.get("legal_text_check", [])

            # Run validation engine
            engine_result = validation_engine.validate(
                video_path=video_path,
                delivery_metadata=delivery_metadata or {},
                legal_text_data=legal_text_data,
                num_analysis_frames=num_analysis_frames,
            )

            # Merge engine results with AI results
            # For "pure" mode, engine flags are more strict (RED severity)
            # For "web" mode, engine flags are informational (BLUE severity)
            result["red_flags"].extend(engine_result.red_flags)
            result["yellow_flags"].extend(engine_result.yellow_flags)
            result["blue_flags"].extend(engine_result.blue_flags)

            # Add validation mode to result metadata
            result["validation_mode"] = mode
            result["validation_engine_summary"] = engine_result.get_flag_count()

            logger.info(f"Validation engine ({mode} mode) completed: {engine_result.get_flag_count()}")

            if self.rules_snapshot:
                result["rules_snapshot"] = {
                    "version_id": getattr(self.rules_snapshot, "version_id", ""),
                    "last_checked": getattr(self.rules_snapshot, "last_checked", ""),
                }
            else:
                result.setdefault("rules_snapshot", {})

            # Enrich flags with frame indices by parsing timestamps
            if video_duration > 0 and len(frames_with_time) > 0:
                self._enrich_flags_with_frame_indices(result, len(frames_with_time), video_duration)

            logger.info("Clearcast analysis completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Failed to check video compliance: {e}")
            
            # Check if it's a quota error
            if "quota" in str(e).lower():
                return {
                    "error": "API quota exceeded. Please try again later or upgrade your Google AI plan.",
                    "compliance_status": "ERROR",
                    "overall_risk": "UNKNOWN",
                    "red_flags": [],
                    "yellow_flags": [],
                    "summary": "Analysis failed due to API quota limits. Please try again later."
                }
            else:
                return {
                    "error": str(e),
                    "compliance_status": "ERROR",
                    "overall_risk": "UNKNOWN",
                    "red_flags": [],
                    "yellow_flags": [],
                    "summary": f"Failed to analyze video: {str(e)}"
                }
    
    def _extract_key_frames(self, video_path: str, num_frames: int = 20) -> List[Tuple[str, str]]:
        """
        Extract key frames from video for analysis with timestamps.
        
        Returns:
            List of tuples (base64_image, timestamp_string MM:SS)
        """
        frames = []
        try:
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            if total_frames <= 0 or fps <= 0:
                logger.warning("Could not determine video properties for frame extraction")
                return []
            
            # Extract frames at regular intervals
            for i in range(num_frames):
                frame_pos = int((i / (num_frames - 1)) * (total_frames - 1))
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)
                ret, frame = cap.read()
                
                if ret:
                    # Calculate timestamp
                    timestamp_sec = frame_pos / fps
                    time_str = f"{int(timestamp_sec // 60):02d}:{int(timestamp_sec % 60):02d}"
                    
                    # Convert frame to base64
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    frames.append((frame_base64, time_str))
            
            cap.release()
            
        except Exception as e:
            logger.error(f"Failed to extract frames: {e}")
            
        return frames
    
    def _parse_compliance_response(self, response_text: str) -> Dict:
        """Parse the compliance check response"""
        try:
            # Try to extract JSON from response
            # Look for JSON block in the response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            
            if json_match:
                json_str = json_match.group(0)
                result = json.loads(json_str)
                
                # Ensure all required fields exist
                required_fields = {
                    "compliance_status": "REVIEW_NEEDED",
                    "overall_risk": "MEDIUM",
                    "red_flags": [],
                    "yellow_flags": [],
                    "blue_flags": [],
                    "compliant_elements": [],
                    "summary": "Analysis completed",
                    "recommendations": [],
                    "citations": [],
                    "internal_reasoning": "",
                    "classification": {},
                    "classification_focus": [],
                    "disclaimers_required": [],
                    "rules_snapshot": {},
                    "delivery_metadata": {},
                    "slate_detection": {},
                }
                
                for field, default in required_fields.items():
                    if field not in result:
                        result[field] = default
                
                self._merge_structured_sections(result)
                return result
            else:
                # Fallback parsing if no JSON found
                return self._parse_text_response(response_text)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return self._parse_text_response(response_text)

    def _merge_structured_sections(self, result: Dict):
        """Normalize optional 'risks'/'technical_checks' sections into legacy flags."""
        citations = list(result.get("citations") or [])
        risks = result.pop("risks", []) or []
        for risk in risks:
            level = (risk.get("risk_level") or "MEDIUM").upper()
            guideline_reference = risk.get("guideline_reference")
            if not guideline_reference:
                code = risk.get("guideline_code")
                title = risk.get("guideline_title")
                if code and title:
                    guideline_reference = f"{code} — {title}"
                else:
                    guideline_reference = code or title
            evidence_text = risk.get("evidence_text") or risk.get("description")
            normalized = {
                "issue": risk.get("issue") or risk.get("description"),
                "severity": level,
                "timestamp": risk.get("timestamp", "Full video"),
                "category": risk.get("category", "Compliance Issue"),
                "required_action": risk.get("required_action"),
                "suggested_action": risk.get("suggested_action"),
                "guideline_code": risk.get("guideline_code"),
                "guideline_title": risk.get("guideline_title"),
                "citations": risk.get("citations", []),
                "guideline_reference": guideline_reference,
                "evidence_text": evidence_text,
                "evidence_source": risk.get("evidence_source"),
            }
            if normalized["guideline_code"]:
                citations.append(normalized["guideline_code"])
            target = result["red_flags"] if level == "HIGH" else result["yellow_flags"]
            target.append(normalized)

        technical = result.pop("technical_checks", []) or []
        for issue in technical:
            tech_evidence = issue.get("evidence_text") or issue.get("description")
            normalized = {
                "issue": issue.get("issue"),
                "severity": (issue.get("risk_level") or issue.get("severity") or "LOW").upper(),
                "timestamp": issue.get("timestamp", "Full video"),
                "category": issue.get("category", "Technical"),
                "impact": issue.get("impact"),
                "fix_required": issue.get("fix_required", True),
                "evidence_text": tech_evidence,
                "evidence_source": issue.get("evidence_source"),
            }
            result["blue_flags"].append(normalized)

        if citations:
            # Preserve order while removing duplicates
            seen = set()
            deduped = []
            for code in citations:
                if code and code not in seen:
                    seen.add(code)
                    deduped.append(code)
            result["citations"] = deduped
            
        # RECLASSIFY SUBJECTIVE FLAGS:
        # Health claims and other subjective issues that may clear should be warnings, not critical
        # This runs before the clearance prediction check
        subjective_keywords = [
            "variable tolerance",
            "seek advice",
            "may need",
            "might require",
            "consider adding",
            "could be interpreted",
            "potentially",
            "advisory text",
            "discretion",
            "may clear",
            "borderline",
            "subject to interpretation",
            "additional substantiation",
            "recommend adding",
            "clearcast may request",
        ]
        
        if result.get("red_flags"):
            red_flags_to_keep = []
            downgraded_flags = []
            
            for flag in result["red_flags"]:
                issue_text = str(flag.get("issue", "")).lower()
                required_action = str(flag.get("required_action", "")).lower()
                combined_text = issue_text + " " + required_action
                
                # Check if this flag has the subjective marker from AI or contains subjective keywords
                is_subjective = flag.get("subjective", False)
                if not is_subjective:
                    is_subjective = any(kw in combined_text for kw in subjective_keywords)
                
                # Also check for specific health claim patterns that are subjective
                health_subjective_patterns = [
                    "mandatory condition of use",
                    "health claim",
                    "tolerance to lactose",
                    "variable tolerance",
                    "similar wording approved",
                ]
                if not is_subjective:
                    is_subjective = any(pattern in combined_text for pattern in health_subjective_patterns)
                
                if is_subjective:
                    # Mark as subjective and downgrade to warning
                    flag["subjective"] = True
                    flag["severity"] = "MEDIUM"
                    flag["category"] = flag.get("category", "Compliance Issue") + " (Subjective)"
                    downgraded_flags.append(flag)
                    logger.info(f"Downgraded subjective flag to warning: {issue_text[:60]}")
                else:
                    red_flags_to_keep.append(flag)
            
            result["red_flags"] = red_flags_to_keep
            if "yellow_flags" not in result:
                result["yellow_flags"] = []
            result["yellow_flags"].extend(downgraded_flags)
        
        # ENFORCE CONSISTENCY: 
        # If clearance_prediction says "likely clear", we cannot have a FAIL status or RED flags.
        # This overrides strict flag counting to match the high-level verdict.
        prediction = str(result.get("clearance_prediction", "")).lower()
        if "likely clear" in prediction or "will clear" in prediction:
            if result.get("red_flags"):
                logger.info("Downgrading Red Flags to Amber because prediction is 'Likely Clear'")
                # Move all red flags to yellow
                if "yellow_flags" not in result:
                    result["yellow_flags"] = []
                
                for flag in result["red_flags"]:
                    flag["severity"] = "MEDIUM"  # Downgrade severity
                    result["yellow_flags"].append(flag)
                
                result["red_flags"] = []
                
            # Force status update
            result["compliance_status"] = "REVIEW_NEEDED" if result["yellow_flags"] else "PASS"
            result["overall_risk"] = "MEDIUM" if result["yellow_flags"] else "LOW"
            
        # Double check: if we have red flags, status must be FAIL
        elif result.get("red_flags"):
            result["compliance_status"] = "FAIL"
            result["overall_risk"] = "HIGH"
        
        # CLEAN UP RECOMMENDATIONS:
        # 1. Remove duplicate/redundant recommendations
        # 2. Filter out incorrect slate-related recommendations
        # 3. Remove recommendations that just restate flag content
        if "recommendations" in result:
            recommendations = result.get("recommendations", []) or []
            
            # Phrases that indicate incorrect or redundant recommendations
            filter_phrases = [
                "remove the 10-second slate",
                "remove slate/countdown",
                "remove the slate before final delivery",
                "countdown before final delivery",
            ]
            
            # Collect issue text from all flags for deduplication
            all_flag_issues = set()
            for flag_list in [result.get("red_flags", []), result.get("yellow_flags", []), result.get("blue_flags", [])]:
                for flag in flag_list:
                    if isinstance(flag, dict):
                        issue = flag.get("issue", "").lower()
                        if issue:
                            all_flag_issues.add(issue)
            
            cleaned_recommendations = []
            seen_recs = set()
            
            for rec in recommendations:
                if not rec:
                    continue
                    
                rec_str = rec if isinstance(rec, str) else str(rec)
                rec_lower = rec_str.lower()
                
                # Skip if it contains filter phrases (incorrect recommendations)
                if any(phrase in rec_lower for phrase in filter_phrases):
                    logger.debug(f"Filtered out recommendation: {rec_str[:50]}")
                    continue
                
                # Skip if it's a near-duplicate of a flag issue
                is_duplicate = False
                for issue in all_flag_issues:
                    # Check for significant overlap (more than 60% of words match)
                    rec_words = set(rec_lower.split())
                    issue_words = set(issue.split())
                    if rec_words and issue_words:
                        overlap = len(rec_words & issue_words) / min(len(rec_words), len(issue_words))
                        if overlap > 0.6:
                            is_duplicate = True
                            break
                
                if is_duplicate:
                    logger.debug(f"Filtered duplicate recommendation: {rec_str[:50]}")
                    continue
                
                # Skip if we've already seen this exact recommendation
                if rec_lower in seen_recs:
                    continue
                
                seen_recs.add(rec_lower)
                cleaned_recommendations.append(rec_str)
            
            result["recommendations"] = cleaned_recommendations
            logger.info(f"Recommendations cleaned: {len(recommendations)} -> {len(cleaned_recommendations)}")

    def _build_focus_summary(
        self,
        classification_result: Optional[ClearcastClassificationResult],
        compliance_result: Dict,
    ) -> List[Dict[str, Any]]:
        """Map classification focus areas to the current flag set for cross-reference."""
        if not classification_result:
            return []

        focus_entries: List[Dict[str, Any]] = []
        red_flags = compliance_result.get("red_flags", []) or []
        yellow_flags = compliance_result.get("yellow_flags", []) or []
        all_flags = red_flags + yellow_flags
        severity_rank = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0}

        for area in classification_result.priority_focus_areas:
            label = self._get_priority_field(area, "label") or ""
            related: List[Dict[str, Any]] = []
            highest = "INFO"
            for flag in all_flags:
                if self._focus_matches_flag(label, flag):
                    flag_severity = (
                        flag.get("severity")
                        or flag.get("risk_level")
                        or ("HIGH" if flag in red_flags else "MEDIUM")
                    )
                    normalized = str(flag_severity).upper()
                    related.append(
                        {
                            "issue": flag.get("issue"),
                            "guideline_code": flag.get("guideline_code")
                            or flag.get("guideline_reference"),
                            "severity": normalized,
                        }
                    )
                    if severity_rank.get(normalized, 0) > severity_rank.get(highest, 0):
                        highest = normalized

            focus_entries.append(
                {
                    "label": label,
                    "reason": self._get_priority_field(area, "reason"),
                    "severity": highest,
                    "related_flags": related,
                }
            )

        return focus_entries

    def _focus_matches_flag(self, label: str, flag: Dict[str, Any]) -> bool:
        """Rudimentary keyword matcher for linking focus areas to flags."""
        if not label:
            return False

        label_lower = label.lower()
        needles = {label_lower}
        synonym_map = {
            "children": ["kid", "child", "youth", "under 18"],
            "claims": ["claim", "substantiation", "proof"],
            "pricing": ["price", "offer", "discount", "promotional"],
            "alcohol": ["alcohol", "drink", "beer", "wine"],
            "gambling": ["gambling", "bet", "wager"],
            "financial": ["finance", "apr", "loan", "credit"],
            "health": ["health", "medical", "wellness"],
            "audio": ["audio", "sound", "lufs", "mix"],
            "technical": ["format", "clock", "countdown", "delivery"],
        }

        for key, extras in synonym_map.items():
            if key in label_lower:
                needles.update(extras)

        haystack_parts = [
            str(flag.get("category", "")),
            str(flag.get("issue", "")),
            str(flag.get("guideline_code", "")),
            str(flag.get("guideline_title", "")),
            str(flag.get("guideline_reference", "")),
        ]
        haystack = " ".join(haystack_parts).lower()

        return any(needle in haystack for needle in needles if needle)

    @staticmethod
    def _get_priority_field(area: Any, attr: str) -> Optional[str]:
        if hasattr(area, attr):
            value = getattr(area, attr)
            return value
        if isinstance(area, dict):
            return area.get(attr)
        return None
    
    def _parse_timestamp_to_frame_index(self, timestamp_str: str, total_frames: int, video_duration: float) -> Optional[int]:
        """
        Parse a timestamp string (e.g., "00:15", "at 00:15", "0:15") and convert to frame index.
        
        Args:
            timestamp_str: Timestamp string to parse
            total_frames: Total number of frames in the video
            video_duration: Video duration in seconds
            
        Returns:
            Frame index (0-based) or None if parsing fails
        """
        if not timestamp_str or total_frames <= 0 or video_duration <= 0:
            return None
            
        import re
        # Match patterns like "00:15", "0:15", "at 00:15", "At 0:15", "00:15.5"
        patterns = [
            r'(\d{1,2}):(\d{2})(?:\.(\d+))?',  # MM:SS or M:SS with optional decimal
            r'(\d+)s',  # Just seconds like "15s"
            r'(\d+(?:\.\d+)?)\s*(?:sec|second)',  # "15 seconds"
        ]
        
        seconds = None
        for pattern in patterns:
            match = re.search(pattern, timestamp_str, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) >= 2 and groups[1] is not None:
                    # MM:SS format
                    minutes = int(groups[0])
                    secs = int(groups[1])
                    decimal = float(f"0.{groups[2]}") if len(groups) > 2 and groups[2] else 0
                    seconds = minutes * 60 + secs + decimal
                else:
                    # Just seconds
                    seconds = float(groups[0])
                break
        
        if seconds is None:
            return None
            
        # Convert seconds to frame index
        fps = total_frames / video_duration
        frame_index = int(seconds * fps)
        
        # Clamp to valid range
        frame_index = max(0, min(frame_index, total_frames - 1))
        
        return frame_index

    def _enrich_flags_with_frame_indices(self, result: Dict, total_frames: int, video_duration: float):
        """
        Enrich flags with frame_indices by parsing timestamps.
        """
        flag_lists = ['red_flags', 'yellow_flags', 'blue_flags']
        
        for flag_list_name in flag_lists:
            flags = result.get(flag_list_name, [])
            for flag in flags:
                if isinstance(flag, dict) and 'frame_indices' not in flag:
                    # Try to parse timestamp from the flag
                    timestamp = flag.get('timestamp', '')
                    if timestamp:
                        frame_idx = self._parse_timestamp_to_frame_index(timestamp, total_frames, video_duration)
                        if frame_idx is not None:
                            # Add a few surrounding frames for context
                            frame_indices = [
                                max(0, frame_idx - 1),
                                frame_idx,
                                min(total_frames - 1, frame_idx + 1)
                            ]
                            # Remove duplicates while preserving order
                            seen = set()
                            flag['frame_indices'] = [x for x in frame_indices if not (x in seen or seen.add(x))]

    def _parse_text_response(self, response_text: str) -> Dict:
        """Parse non-JSON response into structured format"""
        # Simple text parsing fallback
        result = {
            "compliance_status": "REVIEW_NEEDED",
            "overall_risk": "MEDIUM",
            "red_flags": [],
            "yellow_flags": [],
            "blue_flags": [],
            "compliant_elements": [],
            "summary": response_text[:500] if len(response_text) > 500 else response_text,
            "recommendations": [],
            "citations": [],
            "internal_reasoning": "",
            "classification": {},
            "classification_focus": [],
            "disclaimers_required": [],
            "rules_snapshot": {},
            "delivery_metadata": {},
            "audio_normalization": {},
        }
        
        # Try to identify red flags (serious issues)
        red_keywords = ["prohibited", "banned", "illegal", "must not", "violation", "breach"]
        yellow_keywords = ["should", "consider", "may need", "potentially", "unclear", "verify"]
        
        lines = response_text.split('\n')
        for line in lines:
            line_lower = line.lower()
            
            if any(keyword in line_lower for keyword in red_keywords):
                result["red_flags"].append({
                    "issue": line.strip(),
                    "severity": "HIGH",
                    "timestamp": "Full video",
                    "category": "Compliance Issue",
                    "required_action": "Review and modify"
                })
            elif any(keyword in line_lower for keyword in yellow_keywords):
                result["yellow_flags"].append({
                    "issue": line.strip(),
                    "severity": "MEDIUM",
                    "timestamp": "Full video",
                    "category": "Potential Concern",
                    "suggested_action": "Review and clarify"
                })
        
        # Set overall status based on flags
        if result["red_flags"]:
            result["compliance_status"] = "FAIL"
            result["overall_risk"] = "HIGH"
        elif result["yellow_flags"]:
            result["compliance_status"] = "REVIEW_NEEDED"
            result["overall_risk"] = "MEDIUM"
        else:
            result["compliance_status"] = "PASS"
            result["overall_risk"] = "LOW"
        
        return result 