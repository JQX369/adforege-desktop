"""
Type definitions for Ad Script Lab.

Defines the schema for briefs, runs, and all intermediate artifacts
in the multi-agent ad script generation protocol.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, TypedDict
from pydantic import BaseModel, Field
import uuid


class CreativeMode(str, Enum):
    """
    Controls the depth of creative exploration.
    
    - light_think: Fast, fewer passes, lower cost
    - standard_think: Default balanced mode
    - deep_think: Maximum depth, more iterations
    """
    LIGHT = "light_think"
    STANDARD = "standard_think"
    DEEP = "deep_think"


class AdScriptBrief(BaseModel):
    """
    Input brief for TV ad script generation.
    
    Contains both required user inputs and optional context fields.
    """
    # Required inputs (from user)
    objective: str = Field(..., description="Campaign objective")
    target_audience: str = Field(..., description="Target audience description")
    single_minded_proposition: str = Field(..., description="Key message / SMP")
    tone_of_voice: str = Field(..., description="Tone / style")
    asset_name: str = Field(..., description="Name for the asset")
    
    # Optional inputs (from user)
    length_seconds: int = Field(default=30, description="Ad length in seconds")
    mandatories: List[str] = Field(default_factory=list, description="Mandatory requirements")
    parent_id: Optional[str] = Field(default=None, description="For iterations of a previous run")
    creative_mode: CreativeMode = Field(default=CreativeMode.STANDARD, description="Creative depth setting")
    
    # New input improvement fields
    market: str = Field(default="uk", description="Target market/jurisdiction (uk, usa, eu)")
    visual_style: Optional[str] = Field(default=None, description="Preferred visual style")
    briefing_context: Optional[str] = Field(default=None, description="Context from uploaded briefing documents")
    
    # Context fields (manually input since no auto-populate)
    brand_name: str = Field(default="", description="Brand name")
    product_service: str = Field(default="", description="Product or service name")
    budget_range: str = Field(default="£100k-250k", description="Production budget range")
    comms_style: str = Field(default="", description="Communication style")
    brand_colors: List[str] = Field(default_factory=list, description="Brand color palette")
    
    # Generated context fields (populated by buildBriefContext)
    brand_context: str = Field(default="", description="Brand/category context summary")
    research_insights: str = Field(default="", description="Generated audience research insights")
    compliance_requirements: str = Field(default="compliance categories: none explicitly specified", 
                                         description="Extracted compliance requirements")

    class Config:
        use_enum_values = True


class RagNeighbor(BaseModel):
    """A retrieved TV ad from the RAG archive."""
    id: str = Field(..., description="Unique identifier of the ad")
    title: str = Field(default="", description="Ad title/name")
    brand: str = Field(default="", description="Brand name")
    category: str = Field(default="", description="Product category")
    year: Optional[int] = Field(default=None, description="Year of release")
    description: str = Field(default="", description="Ad description/synopsis")
    script_excerpt: str = Field(default="", description="Script excerpt if available")
    video_url: Optional[str] = Field(default=None, description="URL to the video file")
    effectiveness_score: Optional[float] = Field(default=None, description="Effectiveness metric")
    awards: List[str] = Field(default_factory=list, description="Awards won")
    similarity_score: float = Field(default=0.0, description="RAG similarity score")
    tags: List[str] = Field(default_factory=list, description="Content tags")


class RetrievalResult(BaseModel):
    """Results from RAG retrieval step with Cross-Pollinator lateral retrieval."""
    neighbors: List[RagNeighbor] = Field(default_factory=list)
    query_embedding_id: Optional[str] = Field(default=None)
    retrieval_time_ms: float = Field(default=0.0)
    tags_used: List[str] = Field(default_factory=list)
    
    # Cross-Pollinator Lateral Retrieval fields
    structure_references: List[RagNeighbor] = Field(
        default_factory=list, 
        description="Ads from different industries with strong visual metaphor structure"
    )
    emotion_references: List[RagNeighbor] = Field(
        default_factory=list,
        description="Ads that evoke the core emotion (pain/frustration) of the brief"
    )
    analogue_suggestions: List[str] = Field(
        default_factory=list,
        description="Real-world physical tasks associated with the core emotion"
    )
    core_emotion: str = Field(default="", description="Extracted core emotion from brief")
    structural_goal: str = Field(default="", description="Extracted structural goal (e.g., visual metaphor)")


class ScriptIdea(BaseModel):
    """A single script concept/idea using Jumper framework."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str = Field(..., description="Concept title")
    
    # Jumper Framework fields (Creative Leap Architecture)
    anchor: str = Field(default="", description="The manual analogue - tedious real-world task")
    setup: str = Field(default="", description="The hyperbolic struggle scene")
    intervention: str = Field(default="", description="The low-effort catalyst moment")
    jumper: str = Field(default="", description="The physics-defying magical result")
    
    # Legacy/summary fields
    hook: str = Field(default="", description="Opening hook/premise")
    narrative: str = Field(default="", description="Story arc summary")
    key_moments: List[str] = Field(default_factory=list, description="Key visual/emotional moments")
    cta: str = Field(default="", description="Call to action")
    rationale: str = Field(default="", description="Why this concept works")
    inspired_by: List[str] = Field(default_factory=list, description="RAG neighbor IDs that inspired this")


class PolishedScript(BaseModel):
    """A fully developed script with timing, production notes, and per-script scoring."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str
    concept_id: str = Field(..., description="ID of the source ScriptIdea")

    # Script content
    opening: str = Field(default="", description="Opening scene/beat (0-5s)")
    development: str = Field(default="", description="Story development (5-20s)")
    climax: str = Field(default="", description="Climax/key moment (20-25s)")
    resolution: str = Field(default="", description="Resolution and CTA (25-30s)")

    # Full script
    full_script: str = Field(default="", description="Complete script with timing markers")

    # Production notes
    visual_style: str = Field(default="", description="Visual direction notes")
    audio_notes: str = Field(default="", description="Music/SFX/VO notes")
    talent_notes: str = Field(default="", description="Casting/performance notes")
    production_considerations: str = Field(default="", description="Budget/logistics notes")

    # Metadata
    estimated_duration_seconds: int = Field(default=30)
    is_winner: bool = Field(default=False, description="Whether this is the selected winning script")

    # Per-script scoring (populated after braintrust evaluation)
    # Note: These are forward references, resolved at runtime
    scores: Optional["ScriptScores"] = Field(default=None, description="Quality scores for this script")

    # Per-script braintrust feedback (3 personas evaluate each script)
    braintrust_feedback: List["BraintrustCritique"] = Field(
        default_factory=list,
        description="Critiques from each persona for this specific script"
    )

    # Per-script compliance result (after auto-fix applied)
    compliance_result: Optional["ComplianceResult"] = Field(
        default=None,
        description="Compliance check with solutions applied"
    )

    @property
    def overall_score(self) -> Optional[float]:
        """Convenience property for overall score."""
        return self.scores.overall if self.scores else None

    @property
    def braintrust_average_rating(self) -> Optional[float]:
        """Average rating from all braintrust personas."""
        if not self.braintrust_feedback:
            return None
        ratings = [fb.overall_rating for fb in self.braintrust_feedback]
        return sum(ratings) / len(ratings) if ratings else None

    @property
    def braintrust_approval_count(self) -> int:
        """Count of personas who would approve this script."""
        return sum(1 for fb in self.braintrust_feedback if fb.would_approve)


class BraintrustCritique(BaseModel):
    """Critique from the Braintrust agent (simulated creative directors)."""
    script_id: str = Field(default="", description="ID of the script being critiqued")
    critic_persona: str = Field(..., description="The persona giving feedback")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    overall_rating: float = Field(default=0.0, ge=0, le=10)
    would_approve: bool = Field(default=False)
    critique: str = Field(default="", description="Full critique text summary")


class ComplianceIssue(BaseModel):
    """A single compliance issue found during checking."""
    category: str = Field(..., description="BCAP code or regulation category")
    severity: Literal["high", "medium", "low"] = Field(default="medium")
    description: str = Field(..., description="What the issue is")
    location: str = Field(default="", description="Scene/timestamp where issue occurs")
    recommendation: str = Field(default="", description="How to fix it")
    evidence_required: Optional[str] = Field(default=None, description="Substantiation needed")


class ComplianceSolution(BaseModel):
    """A compliance issue that was automatically fixed."""
    original_issue: str = Field(..., description="The original compliance concern")
    category: str = Field(..., description="BCAP code or regulation category")
    fix_applied: str = Field(..., description="What was changed to resolve it")
    location: str = Field(default="", description="Scene/timestamp where fix was applied")
    confidence: Literal["high", "medium"] = Field(default="high", description="Confidence in the fix")
    original_text: str = Field(default="", description="Original script text before fix")
    fixed_text: str = Field(default="", description="Fixed script text after change")


class ComplianceResult(BaseModel):
    """Final compliance result after auto-fix (shown to user)."""
    all_clear: bool = Field(default=True, description="No unresolved issues remaining")
    solutions_applied: List[ComplianceSolution] = Field(default_factory=list, description="Fixes that were applied")
    categories_checked: List[str] = Field(default_factory=list, description="Regulations audited")
    notes: str = Field(default="", description="Additional clearance notes")
    market: str = Field(default="uk", description="Market/jurisdiction checked")


class ComplianceCheck(BaseModel):
    """Compliance check results (Clearcast-style) - used internally before auto-fix."""
    passed: bool = Field(default=True)
    risk_level: Literal["low", "medium", "high"] = Field(default="low")
    issues: List[ComplianceIssue] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    categories_checked: List[str] = Field(default_factory=list)
    clearcast_notes: str = Field(default="")


class ScriptScores(BaseModel):
    """
    Scoring metrics for scripts - aligned with AI Video Analyzer metrics.

    Uses 8 core dimensions (0-10 scale) plus reasoning for each.
    """
    # Core impact metrics (from AI analyzer)
    overall_impact: float = Field(default=0.0, ge=0, le=10, description="Overall ad effectiveness and strength")
    hook_power: float = Field(default=0.0, ge=0, le=10, description="Opening hook strength (first 3s)")
    emotional_resonance: float = Field(default=0.0, ge=0, le=10, description="Emotional depth and connection")
    clarity_score: float = Field(default=0.0, ge=0, le=10, description="Message clarity and CTA strength")
    distinctiveness: float = Field(default=0.0, ge=0, le=10, description="Creative uniqueness vs competitors")
    brand_integration: float = Field(default=0.0, ge=0, le=10, description="How well brand is woven into narrative")
    pulse_score: float = Field(default=0.0, ge=0, le=10, description="Immediate engagement potential")
    echo_score: float = Field(default=0.0, ge=0, le=10, description="Memorability and recall potential")

    # Weighted overall score
    overall: float = Field(default=0.0, ge=0, le=10, description="Weighted overall score")

    # Per-metric reasoning explanations
    reasoning: Optional[Dict[str, str]] = Field(default=None, description="Explanation for each score")

    # Legacy field mappings (for backward compatibility)
    @property
    def tv_native(self) -> float:
        """Alias for overall_impact."""
        return self.overall_impact

    @property
    def clarity(self) -> float:
        """Alias for clarity_score."""
        return self.clarity_score

    @property
    def emotional_impact(self) -> float:
        """Alias for emotional_resonance."""
        return self.emotional_resonance

    @property
    def brand_fit(self) -> float:
        """Alias for brand_integration."""
        return self.brand_integration

    @property
    def memorability(self) -> float:
        """Alias for echo_score."""
        return self.echo_score

    @property
    def originality(self) -> float:
        """Alias for distinctiveness."""
        return self.distinctiveness


class Citation(BaseModel):
    """Citation linking generated content to RAG sources."""
    neighbor_id: str
    neighbor_title: str
    influence_type: str = Field(default="inspiration", description="How this source influenced the output")
    specific_element: str = Field(default="", description="What specific element was influenced")


class Artifacts(BaseModel):
    """All generated artifacts from the protocol."""
    press_release: str = Field(default="", description="Amazon-style working backwards doc")
    ideas_10: List[ScriptIdea] = Field(default_factory=list, description="Initial 5-10 ideas")
    viable_3: List[ScriptIdea] = Field(default_factory=list, description="Top 3 selected ideas")
    polished_3: List[PolishedScript] = Field(default_factory=list, description="Polished versions of top 3")
    braintrust_feedback: List[BraintrustCritique] = Field(default_factory=list)
    compliance_checks: List[ComplianceCheck] = Field(default_factory=list)
    final_script: Optional[PolishedScript] = Field(default=None, description="The winning script")
    final_rationale: str = Field(default="", description="Why this script was selected")
    production_notes: str = Field(default="", description="Final production guidance")


class RunStatus(str, Enum):
    """Status of an ad script generation run."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AdScriptRun(BaseModel):
    """
    Complete state envelope for an ad script generation run.
    
    This is the main data structure passed between agents and
    returned to the client.
    """
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: RunStatus = Field(default=RunStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Input
    brief: AdScriptBrief
    
    # Pipeline results
    retrieval: RetrievalResult = Field(default_factory=RetrievalResult)
    artifacts: Artifacts = Field(default_factory=Artifacts)
    scores: ScriptScores = Field(default_factory=ScriptScores)
    citations: List[Citation] = Field(default_factory=list)
    
    # Execution metadata
    current_stage: str = Field(default="", description="Current pipeline stage")
    stage_history: List[Dict[str, Any]] = Field(default_factory=list, description="Stage execution log")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    
    class Config:
        use_enum_values = True
    
    def update_stage(self, stage: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Update current stage and log to history."""
        self.current_stage = stage
        self.updated_at = datetime.utcnow()
        self.stage_history.append({
            "stage": stage,
            "timestamp": self.updated_at.isoformat(),
            "details": details or {}
        })


# Request/Response models for API
class AdScriptGenerateRequest(BaseModel):
    """API request to generate a new ad script."""
    # Website URL for brand discovery (optional but recommended)
    website_url: Optional[str] = None
    
    # Required fields
    objective: str
    target_audience: str
    single_minded_proposition: str
    tone_of_voice: str
    asset_name: str = ""  # Now optional - auto-generated if empty
    
    # Optional fields
    length_seconds: int = 30
    mandatories: List[str] = Field(default_factory=list)
    parent_id: Optional[str] = None
    creative_mode: str = "standard_think"
    
    # New fields for input improvements
    market: str = Field(default="uk", description="Target market/jurisdiction (uk, usa, eu)")
    visual_style: Optional[str] = Field(default=None, description="Preferred visual style for the ad")
    briefing_context: Optional[str] = Field(default=None, description="Extracted context from uploaded briefing documents")
    
    # Context fields (can be auto-filled from brand discovery)
    brand_name: str = ""
    product_service: str = ""
    budget_range: str = "£100k-250k"
    comms_style: str = ""
    brand_colors: List[str] = Field(default_factory=list)


class AdScriptRunResponse(BaseModel):
    """API response for an ad script run."""
    run_id: str
    status: str
    created_at: str
    updated_at: str
    current_stage: str
    brief: AdScriptBrief
    retrieval: Optional[RetrievalResult] = None
    artifacts: Optional[Artifacts] = None
    scores: Optional[ScriptScores] = None
    citations: List[Citation] = Field(default_factory=list)
    error: Optional[str] = None
    
    @classmethod
    def from_run(cls, run: AdScriptRun) -> "AdScriptRunResponse":
        """Convert an AdScriptRun to API response format."""
        return cls(
            run_id=run.run_id,
            status=run.status if isinstance(run.status, str) else run.status.value,
            created_at=run.created_at.isoformat(),
            updated_at=run.updated_at.isoformat(),
            current_stage=run.current_stage,
            brief=run.brief,
            retrieval=run.retrieval if run.retrieval.neighbors else None,
            artifacts=run.artifacts if run.artifacts.ideas_10 else None,
            scores=run.scores if run.scores.overall > 0 else None,
            citations=run.citations,
            error=run.error
        )


# Resolve forward references for Pydantic models
PolishedScript.model_rebuild()
