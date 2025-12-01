"""
Selector Agent - Narrows concepts to top 3.

Evaluates all ideas against the brief and selects the most viable.
"""

import logging
import json
import re
from typing import TYPE_CHECKING, List

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout

if TYPE_CHECKING:
    from ..types import AdScriptRun, ScriptIdea
    from ..config import CreativeModeConfig

from ..types import ScriptIdea
from ..config import AGENT_CONFIGS

logger = logging.getLogger(__name__)


SELECTOR_PROMPT = """You are an Executive Creative Director reviewing TV ad concepts using the Jumper/Hyperbolic Contrast framework.

## Brief Requirements:
- Brand: {brand_name}
- Objective: {objective}
- Target Audience: {target_audience}
- SMP: {single_minded_proposition}
- Tone: {tone_of_voice}
- Length: {length_seconds}s
- Budget: {budget_range}
{mandatories_section}

## Concepts to Evaluate:
{concepts_list}

---

Evaluate each concept against these criteria:
1. **Brand Fit** (0-10): How well does it represent the brand?
2. **Creative Ambition** (0-10): Is it fresh and memorable?
3. **Brief Alignment** (0-10): Does it deliver the SMP to the target audience?
4. **Producibility** (0-10): Can it be made within the budget and time?
5. **Effectiveness Potential** (0-10): Will it drive the objective?
6. **Creative Leap Score** (0-10): Does this concept rely on a surprising visual metaphor?
   - 1-3: Literal product demo (showing the UI, typing on laptop)
   - 4-6: Standard narrative (happy person using product, slice-of-life)
   - 7-10: High-concept metaphor (e.g., Gorilla blowing open a vault, scissors vs. lawn)

**PRIORITIZE concepts with creative_leap_score >= 8.**

The best Jumper ads have:
- A clear ANCHOR (the tedious manual task)
- An absurd SETUP (hyperbolic struggle)
- A low-effort INTERVENTION (snap, wink, button press)
- A physics-defying JUMPER (magical transformation)

Select the TOP 3 concepts that best balance all criteria, with heavy weight on Creative Leap Score.

RESPOND WITH VALID JSON ONLY:
```json
{{
  "selected_ids": ["id1", "id2", "id3"],
  "evaluations": [
    {{
      "id": "concept_id",
      "brand_fit": 8,
      "creative_ambition": 7,
      "brief_alignment": 9,
      "producibility": 8,
      "effectiveness": 7,
      "creative_leap_score": 9,
      "total": 48,
      "rationale": "Brief explanation of selection/rejection, noting strength of the Anchor-to-Jumper metaphor"
    }}
  ],
  "selection_rationale": "Overall reasoning for the top 3 selection, emphasizing why these metaphors create the strongest Creative Leap"
}}
```
"""


async def run_selector(
    run: "AdScriptRun",
    config: "CreativeModeConfig"
) -> None:
    """
    Select the top 3 concepts from the ideation output.
    """
    brief = run.brief
    ideas = run.artifacts.ideas_10
    
    if not ideas:
        logger.warning("No ideas to select from")
        return
    
    # Format mandatories
    mandatories_section = ""
    if brief.mandatories:
        mandatories_section = f"- Mandatories: {', '.join(brief.mandatories)}"
    
    # Format concepts list with Jumper framework fields
    concepts_list = []
    for idea in ideas:
        # Build concept card with Jumper fields if available
        concept_card = f"**ID: {idea.id}** - \"{idea.title}\"\n"
        
        # Include Jumper framework fields if present
        if idea.anchor:
            concept_card += f"ANCHOR (Manual Task): {idea.anchor}\n"
        if idea.setup:
            concept_card += f"SETUP (Struggle): {idea.setup}\n"
        if idea.intervention:
            concept_card += f"INTERVENTION (Low-Effort Catalyst): {idea.intervention}\n"
        if idea.jumper:
            concept_card += f"JUMPER (Magical Result): {idea.jumper}\n"
        
        # Legacy fields
        concept_card += f"Hook: {idea.hook}\n"
        concept_card += f"Narrative: {idea.narrative}\n"
        concept_card += f"Key Moments: {', '.join(idea.key_moments)}\n"
        concept_card += f"CTA: {idea.cta}\n"
        concept_card += f"Rationale: {idea.rationale}\n"
        
        concepts_list.append(concept_card)
    
    # Build prompt
    prompt = SELECTOR_PROMPT.format(
        brand_name=brief.brand_name or "[Brand]",
        objective=brief.objective,
        target_audience=brief.target_audience,
        single_minded_proposition=brief.single_minded_proposition,
        tone_of_voice=brief.tone_of_voice,
        length_seconds=brief.length_seconds,
        budget_range=brief.budget_range,
        mandatories_section=mandatories_section,
        concepts_list="\n---\n".join(concepts_list)
    )
    
    # Call Gemini
    try:
        model = create_gemini_model('pro')
        if not model:
            logger.warning("No Gemini model available, selecting first 3 ideas")
            run.artifacts.viable_3 = ideas[:3]
            return
        
        generation_config = genai.GenerationConfig(
            temperature=config.temperature_analysis,
            max_output_tokens=2000,
        )
        
        # Use timeout-wrapped async call to prevent indefinite hangs
        timeout = AGENT_CONFIGS["selector"]["timeout_seconds"]
        text = await generate_with_timeout(model, prompt, generation_config, timeout)
        
        if text:
            selected = _parse_selector_response(text, ideas)
            run.artifacts.viable_3 = selected
            logger.info("Selected %d concepts", len(selected))
        else:
            logger.warning("Empty or blocked response from Gemini, selecting first 3")
            run.artifacts.viable_3 = ideas[:3]
            
    except Exception as e:
        logger.error("Failed to select concepts: %s", str(e))
        run.artifacts.viable_3 = ideas[:3]


def _parse_selector_response(response_text: str, ideas: List[ScriptIdea]) -> List[ScriptIdea]:
    """Parse the selection response and return selected ideas."""
    selected = []
    
    try:
        # Extract JSON
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())
            selected_ids = data.get("selected_ids", [])
            
            # Build ID lookup
            ideas_by_id = {idea.id: idea for idea in ideas}
            
            for sid in selected_ids[:3]:
                if sid in ideas_by_id:
                    selected.append(ideas_by_id[sid])
                else:
                    # Try to find by partial match
                    for idea in ideas:
                        if sid in idea.id or idea.id in sid:
                            selected.append(idea)
                            break
            
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse selector JSON: %s", str(e))
    
    # Fallback: return first 3 if parsing failed
    if len(selected) < 3:
        for idea in ideas:
            if idea not in selected:
                selected.append(idea)
            if len(selected) >= 3:
                break
    
    return selected[:3]



