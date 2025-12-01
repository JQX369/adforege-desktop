"""
Shared Analysis Types

Defines consistent dataclasses for flags, highlights, and analysis results
used by both ClearcastChecker and AIVideoBreakdown.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum


class Severity(str, Enum):
    """Flag severity levels."""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class FlagCategory(str, Enum):
    """Standard flag categories."""
    # Compliance categories
    MISLEADING_CLAIMS = "Misleading Claims"
    HEALTH_SAFETY = "Health & Safety"
    PROHIBITED_CONTENT = "Prohibited Content"
    CHILDREN = "Children"
    ALCOHOL = "Alcohol"
    GAMBLING = "Gambling"
    FINANCIAL = "Financial"
    ENVIRONMENTAL = "Environmental"
    
    # Technical categories
    VIDEO_TECHNICAL = "Video Technical"
    AUDIO_TECHNICAL = "Audio Technical"
    DELIVERY_SPECS = "Delivery Specs"
    LEGAL_TEXT = "Technical/Legibility"
    PSE = "Photosensitive Epilepsy"
    
    # AI Breakdown categories
    BRANDING = "Branding"
    MESSAGING = "Messaging"
    CTA = "Call to Action"
    PRODUCTION = "Production Quality"
    AUDIENCE_FIT = "Audience Fit"
    EFFECTIVENESS = "Effectiveness"
    
    # General
    COMPLIANCE_ISSUE = "Compliance Issue"
    OTHER = "Other"


@dataclass
class AnalysisFlag:
    """
    Unified flag structure for compliance issues, technical problems, and AI insights.
    
    Used by both ClearcastChecker (red/yellow/blue flags) and AIVideoBreakdown (highlights).
    """
    issue: str
    severity: str = "MEDIUM"  # HIGH, MEDIUM, LOW, INFO
    timestamp: str = ""
    category: str = "Other"
    
    # Frame references
    frame_indices: List[int] = field(default_factory=list)
    frame_timestamps: List[str] = field(default_factory=list)
    
    # Fix guidance (for technical issues)
    fix_guidance: Optional[str] = None
    fix_required: bool = False
    
    # Evidence
    evidence_text: Optional[str] = None
    evidence_source: Optional[str] = None
    
    # Compliance-specific
    guideline_code: Optional[str] = None
    guideline_title: Optional[str] = None
    guideline_reference: Optional[str] = None
    citations: List[str] = field(default_factory=list)
    
    # Actions
    required_action: Optional[str] = None
    suggested_action: Optional[str] = None
    
    # Subjective/interpretation-dependent
    subjective: bool = False
    
    # Additional context
    impact: Optional[str] = None
    
    # For technical checks
    height_check: Optional[Dict[str, Any]] = None
    duration_check: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "issue": self.issue,
            "severity": self.severity,
            "timestamp": self.timestamp,
            "category": self.category,
        }
        
        if self.frame_indices:
            result["frame_indices"] = self.frame_indices
        if self.frame_timestamps:
            result["frame_timestamps"] = self.frame_timestamps
        if self.fix_guidance:
            result["fix_guidance"] = self.fix_guidance
        if self.fix_required:
            result["fix_required"] = self.fix_required
        if self.evidence_text:
            result["evidence_text"] = self.evidence_text
        if self.evidence_source:
            result["evidence_source"] = self.evidence_source
        if self.guideline_code:
            result["guideline_code"] = self.guideline_code
        if self.guideline_title:
            result["guideline_title"] = self.guideline_title
        if self.guideline_reference:
            result["guideline_reference"] = self.guideline_reference
        if self.citations:
            result["citations"] = self.citations
        if self.required_action:
            result["required_action"] = self.required_action
        if self.suggested_action:
            result["suggested_action"] = self.suggested_action
        if self.subjective:
            result["subjective"] = self.subjective
        if self.impact:
            result["impact"] = self.impact
        if self.height_check:
            result["height_check"] = self.height_check
        if self.duration_check:
            result["duration_check"] = self.duration_check
        
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AnalysisFlag":
        """Create from dictionary."""
        return cls(
            issue=data.get("issue", ""),
            severity=data.get("severity", "MEDIUM"),
            timestamp=data.get("timestamp", ""),
            category=data.get("category", "Other"),
            frame_indices=data.get("frame_indices", []),
            frame_timestamps=data.get("frame_timestamps", []),
            fix_guidance=data.get("fix_guidance"),
            fix_required=data.get("fix_required", False),
            evidence_text=data.get("evidence_text"),
            evidence_source=data.get("evidence_source"),
            guideline_code=data.get("guideline_code"),
            guideline_title=data.get("guideline_title"),
            guideline_reference=data.get("guideline_reference"),
            citations=data.get("citations", []),
            required_action=data.get("required_action"),
            suggested_action=data.get("suggested_action"),
            subjective=data.get("subjective", False),
            impact=data.get("impact"),
            height_check=data.get("height_check"),
            duration_check=data.get("duration_check"),
        )


@dataclass
class AIHighlight:
    """
    AI Breakdown highlight (green or yellow).
    
    For positive aspects (green) or improvement areas (yellow).
    """
    aspect: str
    explanation: Optional[str] = None
    suggestion: Optional[str] = None
    fix_guidance: Optional[str] = None
    priority: str = "Medium"  # High, Medium, Low
    impact: str = "Medium"  # High, Medium, Low
    evidence_text: Optional[str] = None
    frame_indices: List[int] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "aspect": self.aspect,
            "priority": self.priority,
            "impact": self.impact,
        }
        
        if self.explanation:
            result["explanation"] = self.explanation
        if self.suggestion:
            result["suggestion"] = self.suggestion
        if self.fix_guidance:
            result["fix_guidance"] = self.fix_guidance
        if self.evidence_text:
            result["evidence_text"] = self.evidence_text
        if self.frame_indices:
            result["frame_indices"] = self.frame_indices
        
        return result


@dataclass
class SoftRisk:
    """
    AI-identified soft risk (not a compliance issue, but a potential problem).
    """
    risk: str
    impact: str = "Medium"  # High, Medium, Low
    mitigation: Optional[str] = None
    evidence_text: Optional[str] = None
    frame_indices: List[int] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "risk": self.risk,
            "impact": self.impact,
        }
        
        if self.mitigation:
            result["mitigation"] = self.mitigation
        if self.evidence_text:
            result["evidence_text"] = self.evidence_text
        if self.frame_indices:
            result["frame_indices"] = self.frame_indices
        
        return result


@dataclass
class AudienceReaction:
    """
    Simulated audience persona reaction from AI breakdown.
    """
    persona: str
    gender: str
    age_range: str
    race_ethnicity: str
    location: str
    reaction: str
    engagement_level: str  # High, Medium, Low
    likely_action: str
    fit: str  # HIGH, MEDIUM, LOW
    key_concern: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "persona": self.persona,
            "gender": self.gender,
            "age_range": self.age_range,
            "race_ethnicity": self.race_ethnicity,
            "location": self.location,
            "reaction": self.reaction,
            "engagement_level": self.engagement_level,
            "likely_action": self.likely_action,
            "fit": self.fit,
        }
        
        if self.key_concern:
            result["key_concern"] = self.key_concern
        
        return result


@dataclass
class AnalysisError:
    """
    Unified error response structure.
    """
    error: str
    error_code: str = "ANALYSIS_FAILED"  # QUOTA_EXCEEDED, API_KEY_INVALID, etc.
    retry_after: Optional[int] = None  # Seconds until retry is allowed
    partial_results: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "error": self.error,
            "error_code": self.error_code,
        }
        
        if self.retry_after is not None:
            result["retry_after"] = self.retry_after
        if self.partial_results:
            result["partial_results"] = self.partial_results
        
        return result


__all__ = [
    "Severity",
    "FlagCategory",
    "AnalysisFlag",
    "AIHighlight",
    "SoftRisk",
    "AudienceReaction",
    "AnalysisError",
]








