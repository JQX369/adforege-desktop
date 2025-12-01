"""
Ad Q&A Service

Provides GPT-5.1 powered question-answering capabilities for ad analysis.
Integrates with RAG to provide context from similar ads.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Try to import OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

# Import RAG client
from app.features.ad_script_lab.rag_client import get_rag_client, BaseTvAdsRagClient


@dataclass
class QARequest:
    """Request model for ad Q&A."""
    question: str
    mode: str = "general"  # general, compare, improve, brainstorm
    include_similar_ads: bool = True
    max_similar_ads: int = 3


@dataclass
class QAResponse:
    """Response model for ad Q&A."""
    answer: str
    sources: List[Dict[str, Any]] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    similar_ads_referenced: List[Dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.8
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "answer": self.answer,
            "sources": self.sources,
            "suggestions": self.suggestions,
            "similar_ads_referenced": self.similar_ads_referenced,
            "confidence": self.confidence,
        }


# Suggested questions by mode
SUGGESTED_QUESTIONS = {
    "general": [
        "What is the main strength of this ad?",
        "Who is the target audience for this ad?",
        "What emotions does this ad evoke?",
        "How effective is the call-to-action?",
        "What is the overall message of this ad?",
    ],
    "compare": [
        "How does this ad compare to similar ads in the category?",
        "What do successful ads in this category do differently?",
        "How does the emotional arc compare to top-performing ads?",
        "What benchmarks should this ad aim for?",
    ],
    "improve": [
        "What are the top 3 things that could improve this ad?",
        "How could the hook be made more engaging?",
        "What changes would improve the emotional impact?",
        "How could the brand integration be strengthened?",
        "What would make the CTA more compelling?",
    ],
    "brainstorm": [
        "What A/B tests would you recommend?",
        "How could this concept be extended to other formats?",
        "What creative variations could be tested?",
        "How could this ad be adapted for different audiences?",
        "What complementary campaigns could support this ad?",
    ],
}


class AdQAService:
    """
    Service for answering questions about ads using GPT-5.1 and RAG.
    
    Features:
    - Full ad analysis context
    - Similar ads from RAG database
    - Industry benchmarks
    - Multiple Q&A modes (general, compare, improve, brainstorm)
    """
    
    # GPT-5 mini model ID (faster than full gpt-5)
    MODEL = "gpt-5-mini"
    FALLBACK_MODEL = "gpt-4o"  # Fallback if GPT-5 mini not available
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Q&A service."""
        self.api_key = api_key
        self._openai: Optional[OpenAI] = None
        self._rag_client: Optional[BaseTvAdsRagClient] = None
        
        if not OPENAI_AVAILABLE:
            logger.warning("OpenAI package not available. Q&A features will be limited.")
    
    def _ensure_openai(self) -> Optional[OpenAI]:
        """Lazy initialization of OpenAI client."""
        if self._openai is None and OPENAI_AVAILABLE:
            # Use getter function which always checks environment fresh
            from app.core.config import get_openai_api_key
            api_key = self.api_key or get_openai_api_key()
            if api_key and api_key.strip():
                # Strip any quotes that might have been included
                clean_key = api_key.strip().strip("'\"")
                self._openai = OpenAI(api_key=clean_key)
                logger.info("OpenAI client initialized successfully for Q&A")
            else:
                logger.warning("OPENAI_API_KEY not set. Q&A features will be limited.")
        return self._openai
    
    def _ensure_rag_client(self) -> BaseTvAdsRagClient:
        """Lazy initialization of RAG client."""
        if self._rag_client is None:
            self._rag_client = get_rag_client()
        return self._rag_client
    
    def _build_system_prompt(
        self,
        ad_analysis: Dict[str, Any],
        similar_ads: List[Dict[str, Any]],
        mode: str,
    ) -> str:
        """Build the system prompt with full context."""
        
        # Extract key information from ad analysis
        breakdown = ad_analysis.get("breakdown", {})
        impact_scores = ad_analysis.get("impact_scores", {})
        emotional_timeline = ad_analysis.get("emotional_timeline", {})
        hero_analysis = ad_analysis.get("hero_analysis", {})
        effectiveness_drivers = ad_analysis.get("effectiveness_drivers", {})
        
        # Build ad summary
        ad_summary = f"""
## Ad Being Analyzed

**Brand:** {breakdown.get('brand_name', 'Unknown')}
**Product:** {breakdown.get('product_name', breakdown.get('what_is_advertised', 'Unknown'))}
**Category:** {breakdown.get('product_category', 'Unknown')}
**Duration:** {ad_analysis.get('duration_seconds', 'Unknown')}s

### Summary
{ad_analysis.get('one_sentence_summary', ad_analysis.get('summary', 'No summary available.'))}

### Impact Scores (0-10)
- Overall Impact: {impact_scores.get('overall_impact', 'N/A')}
- Pulse Score: {impact_scores.get('pulse_score', 'N/A')}
- Echo Score: {impact_scores.get('echo_score', 'N/A')}
- Hook Power: {impact_scores.get('hook_power', 'N/A')}
- Brand Integration: {impact_scores.get('brand_integration', 'N/A')}
- Emotional Resonance: {impact_scores.get('emotional_resonance', 'N/A')}
- Clarity Score: {impact_scores.get('clarity_score', 'N/A')}
- Distinctiveness: {impact_scores.get('distinctiveness', 'N/A')}

### Effectiveness Drivers
**Strengths:**
{self._format_list(effectiveness_drivers.get('strengths', []), 'factor')}

**Weaknesses:**
{self._format_list(effectiveness_drivers.get('weaknesses', []), 'factor')}
"""

        # Add emotional analysis if available
        if emotional_timeline:
            metrics = emotional_timeline.get('emotional_metrics', {})
            ad_summary += f"""
### Emotional Analysis
- Arc Shape: {metrics.get('arc_shape', 'Unknown')}
- Peak Emotion: {metrics.get('peak_emotion', 'Unknown')} at {metrics.get('peak_moment_s', 0)}s
- Final Viewer State: {metrics.get('final_viewer_state', 'Unknown')}
- Emotional Range: {metrics.get('emotional_range', 0) * 100:.0f}%
- Positive Ratio: {metrics.get('positive_ratio', 0) * 100:.0f}%
"""

        # Add hero analysis if available
        if hero_analysis:
            audio = hero_analysis.get('audio_profile', {})
            cinematography = hero_analysis.get('cinematography', {})
            tactics = hero_analysis.get('creative_tactics', {})
            
            ad_summary += f"""
### Creative Analysis
- Music Style: {audio.get('music_style', 'Unknown')}
- Hook Type: {tactics.get('hook_type', 'Unknown')}
- Brand Reveal: {tactics.get('brand_reveal_style', 'Unknown')}
- Production Quality: {cinematography.get('production_quality', 'Unknown')}
"""

        # Build similar ads context
        similar_ads_context = ""
        if similar_ads:
            similar_ads_context = "\n## Similar Ads in Database\n\n"
            for i, ad in enumerate(similar_ads, 1):
                similar_ads_context += f"""
### {i}. {ad.get('title', 'Unknown')} ({ad.get('brand', 'Unknown')})
- Category: {ad.get('category', 'Unknown')}
- Year: {ad.get('year', 'Unknown')}
- Effectiveness: {ad.get('effectiveness_score', 'N/A')}/10
- Description: {ad.get('description', 'No description')[:200]}...
"""

        # Mode-specific instructions
        mode_instructions = {
            "general": """
Answer questions about this ad comprehensively. Be specific and cite evidence from the analysis.
When relevant, compare to similar ads in the database.
""",
            "compare": """
Focus on comparing this ad to similar ads in the database. 
Highlight differences in approach, effectiveness, and creative choices.
Identify what the similar ads do well that this ad could learn from.
""",
            "improve": """
Focus on actionable improvements. For each suggestion:
1. Identify the specific issue
2. Explain why it matters
3. Provide a concrete recommendation
4. Estimate the potential impact
""",
            "brainstorm": """
Be creative and exploratory. Generate novel ideas that:
1. Build on the ad's existing strengths
2. Address identified weaknesses
3. Could be tested as variations
4. Might appeal to different audience segments
""",
        }

        system_prompt = f"""You are an expert TV advertising analyst with deep knowledge of advertising effectiveness, creative strategy, and audience psychology.

You have access to complete analysis data for an advertisement and a database of similar ads for comparison.

{ad_summary}
{similar_ads_context}

## Your Role

{mode_instructions.get(mode, mode_instructions['general'])}

## Response Guidelines

1. Be specific and evidence-based - cite specific elements from the analysis
2. Use industry terminology appropriately
3. Provide actionable insights when possible
4. Reference similar ads when relevant for comparison
5. Be concise but comprehensive
6. If you're uncertain about something, say so

When referencing data from the analysis, be precise about what you're citing.
"""

        return system_prompt
    
    def _format_list(self, items: List[Dict], key: str = 'factor') -> str:
        """Format a list of items for display."""
        if not items:
            return "- None identified"
        
        formatted = []
        for item in items[:5]:  # Limit to 5 items
            if isinstance(item, dict):
                formatted.append(f"- {item.get(key, item.get('driver', str(item)))}")
            else:
                formatted.append(f"- {str(item)}")
        
        return "\n".join(formatted)
    
    async def ask(
        self,
        ad_analysis: Dict[str, Any],
        request: QARequest,
    ) -> QAResponse:
        """
        Answer a question about an ad using GPT-5.1 and RAG context.
        
        Args:
            ad_analysis: Complete ad analysis data
            request: The Q&A request with question and options
            
        Returns:
            QAResponse with answer and metadata
        """
        client = self._ensure_openai()
        
        if not client:
            return QAResponse(
                answer="OpenAI API not available. Please configure OPENAI_API_KEY.",
                confidence=0.0,
            )
        
        # RAG for similar ads disabled - use only extracted ad data
        # The full ad_analysis object contains all breakdown data for context
        similar_ads = []
        
        # Build system prompt
        system_prompt = self._build_system_prompt(
            ad_analysis,
            similar_ads,
            request.mode,
        )
        
        # Make API call
        try:
            # Try GPT-5.1 first, fallback to GPT-4o
            # Note: GPT-5+ doesn't support custom temperature - uses default (1.0)
            model = self.MODEL
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.question},
                    ],
                    max_completion_tokens=2000,
                )
            except Exception as model_error:
                error_str = str(model_error).lower()
                if "model" in error_str or "max_tokens" in error_str or "temperature" in error_str or "unsupported" in error_str:
                    logger.warning(f"GPT-5.1 not available or incompatible, falling back to {self.FALLBACK_MODEL}")
                    model = self.FALLBACK_MODEL
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": request.question},
                        ],
                        temperature=0.7,
                        max_tokens=2000,
                    )
                else:
                    raise model_error
            
            answer = response.choices[0].message.content
            if not answer or not answer.strip():
                answer = "I couldn't generate a response for that question. Please try rephrasing or asking something else."

            # Generate follow-up suggestions based on mode
            suggestions = self._generate_suggestions(request.mode, ad_analysis)
            
            return QAResponse(
                answer=answer,
                sources=[{"type": "ai_analysis", "data": "ad_breakdown"}],
                suggestions=suggestions,
                similar_ads_referenced=similar_ads,
                confidence=0.85,
            )
            
        except Exception as e:
            logger.error(f"Q&A request failed: {e}")
            return QAResponse(
                answer=f"Error processing question: {str(e)}",
                confidence=0.0,
            )
    
    def _generate_suggestions(
        self,
        mode: str,
        ad_analysis: Dict[str, Any],
    ) -> List[str]:
        """Generate follow-up question suggestions based on mode and analysis."""
        base_suggestions = SUGGESTED_QUESTIONS.get(mode, SUGGESTED_QUESTIONS["general"])
        
        # Add context-specific suggestions based on analysis
        context_suggestions = []
        
        effectiveness_drivers = ad_analysis.get("effectiveness_drivers", {})
        weaknesses = effectiveness_drivers.get("weaknesses", [])
        
        if weaknesses:
            first_weakness = weaknesses[0]
            if isinstance(first_weakness, dict):
                factor = first_weakness.get("factor", first_weakness.get("driver", ""))
                if factor:
                    context_suggestions.append(f"How can we address the issue with {factor.lower()}?")
        
        impact_scores = ad_analysis.get("impact_scores", {})
        lowest_score = min(
            (k, v) for k, v in impact_scores.items() 
            if isinstance(v, (int, float)) and k != "reasoning"
        ) if impact_scores else None
        
        if lowest_score and lowest_score[1] < 6:
            metric_name = lowest_score[0].replace("_", " ").title()
            context_suggestions.append(f"Why is the {metric_name} score low and how can it be improved?")
        
        # Combine and limit suggestions
        all_suggestions = context_suggestions + base_suggestions[:3]
        return all_suggestions[:5]
    
    def get_suggested_questions(self, mode: str = "general") -> List[str]:
        """Get suggested questions for a given mode."""
        return SUGGESTED_QUESTIONS.get(mode, SUGGESTED_QUESTIONS["general"])


# Singleton instance
_qa_service: Optional[AdQAService] = None


def get_qa_service() -> AdQAService:
    """Get or create the Q&A service singleton."""
    global _qa_service
    if _qa_service is None:
        _qa_service = AdQAService()
    return _qa_service


__all__ = ["AdQAService", "QARequest", "QAResponse", "get_qa_service", "SUGGESTED_QUESTIONS"]

