"""
Retriever Agent - Cross-Pollinator Lateral Retrieval.

Instead of "Literal Retrieval" (find similar ads in same category),
this performs "Lateral Retrieval" to find cross-industry inspiration:

1. Structure References: Award-winning ads from DIFFERENT industries with strong visual metaphors
2. Emotion References: Ads that evoke the core emotion (frustration, struggle)
3. Analogue Suggestions: Physical tasks associated with the core emotion

The goal: "Here are the ingredients, cook something new."
"""

import logging
from datetime import datetime
from typing import TYPE_CHECKING, List, Tuple

if TYPE_CHECKING:
    from ..types import AdScriptRun, RagNeighbor
    from ..config import CreativeModeConfig
    from ..rag_client import BaseTvAdsRagClient

logger = logging.getLogger(__name__)


# Emotion to physical analogue mappings for the Jumper framework
EMOTION_ANALOGUES = {
    "frustration": [
        "Untangling a massive knot of Christmas lights",
        "Trying to fold a fitted sheet perfectly",
        "Searching for a matching sock in an infinite pile",
        "Filling out the same form for the hundredth time",
        "Waiting on hold with elevator music that never ends",
    ],
    "overwhelm": [
        "Drowning in an ocean of paper",
        "Being buried under an avalanche of emails",
        "Trying to drink from a fire hose",
        "Juggling a hundred spinning plates",
        "Standing at the base of an infinite staircase",
    ],
    "tedium": [
        "Counting grains of sand on a beach",
        "Cutting a lawn with nail scissors",
        "Painting the Golden Gate Bridge with a toothbrush",
        "Digging a tunnel with a teaspoon",
        "Emptying the ocean with a thimble",
    ],
    "confusion": [
        "Navigating a hedge maze blindfolded",
        "Assembling IKEA furniture with instructions in hieroglyphics",
        "Finding your way through a hall of mirrors",
        "Solving a Rubik's cube in the dark",
        "Reading a map that's in a different dimension",
    ],
    "waiting": [
        "Watching paint dry in slow motion",
        "Waiting for a glacier to cross the room",
        "Standing in a queue that wraps around the earth",
        "Watching a snail race across a continent",
        "Waiting for toast to pop while time stands still",
    ],
    "complexity": [
        "Solving a thousand-piece jigsaw puzzle of white",
        "Threading a needle while wearing boxing gloves",
        "Operating a control panel with 10,000 identical buttons",
        "Reading Terms & Conditions carved into a mountainside",
        "Filling out a form that requires forms to fill out the form",
    ],
}


def _extract_core_emotion(brief) -> str:
    """Extract the core emotion/pain point from the brief."""
    text = f"{brief.objective} {brief.single_minded_proposition} {brief.target_audience}".lower()
    
    # Map common keywords to emotions
    emotion_keywords = {
        "frustration": ["frustrat", "annoying", "painful", "hate", "struggle"],
        "overwhelm": ["overwhelm", "drown", "buried", "too much", "endless"],
        "tedium": ["tedious", "boring", "repetitive", "manual", "time-consuming"],
        "confusion": ["confus", "complex", "complicated", "unclear", "lost"],
        "waiting": ["wait", "slow", "delay", "patient", "time"],
        "complexity": ["complex", "difficult", "hard", "challeng", "multiple"],
    }
    
    for emotion, keywords in emotion_keywords.items():
        if any(kw in text for kw in keywords):
            return emotion
    
    return "frustration"  # Default


def _get_analogue_suggestions(emotion: str) -> List[str]:
    """Get physical analogue suggestions for an emotion."""
    return EMOTION_ANALOGUES.get(emotion, EMOTION_ANALOGUES["frustration"])


def _determine_structural_goal(brief) -> str:
    """Determine the structural/creative goal from the brief."""
    tone = brief.tone_of_voice.lower() if brief.tone_of_voice else ""
    
    if any(w in tone for w in ["humor", "funny", "comedy", "witty"]):
        return "comedic visual metaphor"
    elif any(w in tone for w in ["dramatic", "epic", "powerful"]):
        return "dramatic visual transformation"
    elif any(w in tone for w in ["warm", "emotional", "heart"]):
        return "emotional contrast"
    else:
        return "hyperbolic visual metaphor"


async def run_retriever(
    run: "AdScriptRun",
    rag_client: "BaseTvAdsRagClient",
    config: "CreativeModeConfig"
) -> None:
    """
    Cross-Pollinator Lateral Retrieval.
    
    Performs 3 types of queries:
    1. Structure Query: "Award-winning ads using [structural goal] from [different industries]"
    2. Emotion Query: "Ads that evoke [core emotion] regardless of category"
    3. Standard Query: Direct brief-matching for baseline context
    
    This enables the Ideate agent to "cook something new" from disparate ingredients.
    """
    brief = run.brief
    start_time = datetime.utcnow()
    
    # Extract core emotion and structural goal from brief
    core_emotion = _extract_core_emotion(brief)
    structural_goal = _determine_structural_goal(brief)
    
    logger.info(
        "Cross-Pollinator analysis: core_emotion=%s, structural_goal=%s",
        core_emotion, structural_goal
    )
    
    # Store in retrieval result
    run.retrieval.core_emotion = core_emotion
    run.retrieval.structural_goal = structural_goal
    run.retrieval.analogue_suggestions = _get_analogue_suggestions(core_emotion)
    
    # Query 1: Structure References (cross-industry, visual metaphor focus)
    # "Find me a Beer ad structure to sell Software"
    structure_query = (
        f"Award-winning TV advertisement with strong visual metaphor, {structural_goal}, "
        f"transformation story, before/after contrast, unexpected reveal, "
        f"NOT {brief.product_service or 'this category'}"
    )
    
    structure_refs = await rag_client.retrieve(
        query=structure_query,
        limit=config.neighbors // 2,
        min_similarity=config.min_similarity_score * 0.8,  # Slightly lower threshold for cross-industry
        filters=None  # No category filter - we want different industries
    )
    
    # Query 2: Emotion References (ads that evoke the core pain/frustration)
    emotion_query = (
        f"TV advertisement showing {core_emotion}, struggle, pain point, problem, "
        f"customer journey, relatable moment, empathy, before state"
    )
    
    emotion_refs = await rag_client.retrieve(
        query=emotion_query,
        limit=config.neighbors // 2,
        min_similarity=config.min_similarity_score * 0.8,
        filters=None
    )
    
    # Query 3: Standard query for baseline context (industry-specific)
    standard_query = (
        f"TV advertisement for {brief.brand_name or 'brand'} {brief.product_service or 'product'} "
        f"Objective: {brief.objective} "
        f"Target audience: {brief.target_audience} "
        f"Tone: {brief.tone_of_voice} "
        f"Message: {brief.single_minded_proposition}"
    )
    
    # Build filters from brief
    filters = {}
    if brief.mandatories:
        category_hints = []
        for mandatory in brief.mandatories:
            mandatory_lower = mandatory.lower()
            if "alcohol" in mandatory_lower:
                category_hints.append("alcohol")
            elif "food" in mandatory_lower:
                category_hints.append("food")
            elif "finance" in mandatory_lower or "bank" in mandatory_lower:
                category_hints.append("finance")
        if category_hints:
            filters["categories"] = category_hints
    
    standard_refs = await rag_client.retrieve(
        query=standard_query,
        limit=config.neighbors,
        min_similarity=config.min_similarity_score,
        filters=filters if filters else None
    )
    
    retrieval_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
    
    # Update run state with Cross-Pollinator results
    run.retrieval.neighbors = standard_refs  # Standard refs go in neighbors (backwards compatible)
    run.retrieval.structure_references = structure_refs
    run.retrieval.emotion_references = emotion_refs
    run.retrieval.retrieval_time_ms = retrieval_time_ms
    
    # Collect unique tags from all sources
    all_tags = []
    for neighbor in standard_refs + structure_refs + emotion_refs:
        all_tags.extend(neighbor.tags)
    run.retrieval.tags_used = list(set(all_tags))[:30]
    
    logger.info(
        "Cross-Pollinator retrieved: %d standard, %d structure, %d emotion refs in %.0fms",
        len(standard_refs),
        len(structure_refs),
        len(emotion_refs),
        retrieval_time_ms
    )
    logger.info(
        "Analogue suggestions for '%s': %s",
        core_emotion,
        run.retrieval.analogue_suggestions[:3]
    )








