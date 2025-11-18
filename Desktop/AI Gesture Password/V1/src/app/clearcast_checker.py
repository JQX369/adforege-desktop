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

from app.clearcast_classifier import (
    ClearcastClassificationResult,
    classification_to_dict,
    classify_clearcast_context,
)
from app.clearcast_audio import AudioNormalizationReport, ClearcastAudioAnalyzer
from app.clearcast_prompt_builder import PromptContext, build_clearcast_prompt

logger = logging.getLogger(__name__)

# Configure Gemini API
try:
    from app.config_secure import GOOGLE_API_KEY
except ImportError:
    from app.config import GOOGLE_API_KEY
    
if GOOGLE_API_KEY and GOOGLE_API_KEY != "DEMO_KEY_GET_YOUR_OWN":
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    logger.warning("Google API key not configured - Clearcast features will be limited")

class ClearcastChecker:
    """Check videos for Clearcast compliance using Gemini Pro"""
    
    def __init__(self):
        """Initialize the Clearcast checker"""
        # Initialize Gemini model using utility function with automatic fallback
        from app.gemini_utils import create_gemini_model
        self.model = create_gemini_model('pro', GOOGLE_API_KEY, fallback_to_pro=True)
        
        if not self.model:
            logger.warning("Failed to initialize Gemini model for Clearcast checker")
        
        # Load Clearcast PDF path
        self.clearcast_pdf_path = self._get_clearcast_pdf_path()
        
        # Load PDF content once
        self.pdf_content = self._load_pdf_content()
        
        # Load structured rules snapshot if available
        try:
            from app.clearcast_rules import load_default_snapshot
            self.rules_snapshot = load_default_snapshot()
        except Exception as snapshot_error:
            logger.warning(f"Unable to load Clearcast rules snapshot: {snapshot_error}")
            self.rules_snapshot = None
        self.audio_analyzer = ClearcastAudioAnalyzer()
        
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
        verbose_reasoning: bool = False,
    ) -> Dict:
        """
        Check video for Clearcast compliance
        
        Args:
            video_path: Path to video file
            
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
            frames = self._extract_key_frames(video_path, num_frames=8)
            
            if not frames:
                return {
                    "error": "Could not extract frames from video",
                    "compliance_status": "ERROR",
                    "overall_risk": "UNKNOWN",
                    "red_flags": [],
                    "yellow_flags": [],
                    "summary": "Failed to extract video frames for analysis"
                }
            
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
"""
            
            # Prepare frames for Gemini
            frame_parts = []
            for i, frame_base64 in enumerate(frames):
                frame_parts.append(f"\n[Frame {i+1} of {len(frames)}]")
                frame_parts.append({
                    "mime_type": "image/jpeg",
                    "data": frame_base64
                })
            
            # Generate content with frames
            logger.info("Generating Clearcast analysis from frames...")
            response = self.model.generate_content([prompt] + frame_parts)
            
            # Parse the response
            result = self._parse_compliance_response(response.text)
            
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

            result.setdefault("delivery_metadata", {})

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
                    }
                )

            if self.rules_snapshot:
                result["rules_snapshot"] = {
                    "version_id": getattr(self.rules_snapshot, "version_id", ""),
                    "last_checked": getattr(self.rules_snapshot, "last_checked", ""),
                }
            else:
                result.setdefault("rules_snapshot", {})

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
    
    def _extract_key_frames(self, video_path: str, num_frames: int = 5) -> List[str]:
        """Extract key frames from video for analysis"""
        frames = []
        try:
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            # Extract frames at regular intervals
            for i in range(num_frames):
                frame_pos = int((i / (num_frames - 1)) * (total_frames - 1))
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)
                ret, frame = cap.read()
                
                if ret:
                    # Convert frame to base64
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    frames.append(frame_base64)
            
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