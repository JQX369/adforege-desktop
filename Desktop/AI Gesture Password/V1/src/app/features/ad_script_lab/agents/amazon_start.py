"""
Amazon Start Agent - Generates "Working Backwards" press release.

Uses the Amazon methodology of writing the press release first
to clarify the vision and success criteria.
"""

import logging
import json
from typing import TYPE_CHECKING

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout

if TYPE_CHECKING:
    from ..types import AdScriptRun
    from ..config import CreativeModeConfig

from ..config import AGENT_CONFIGS

logger = logging.getLogger(__name__)


AMAZON_START_PROMPT = """You are a senior creative strategist using Amazon's "Working Backwards" methodology.

Write a press release for this TV advertising campaign AS IF it has already been completed and won awards.
This document will guide the creative development by clarifying the vision and success criteria.

## Brief:
- Brand: {brand_name}
- Product/Service: {product_service}
- Campaign Objective: {objective}
- Target Audience: {target_audience}
- Single-Minded Proposition: {single_minded_proposition}
- Tone of Voice: {tone_of_voice}
- Ad Length: {length_seconds} seconds
- Budget Range: {budget_range}
{mandatories_section}

## Brand Context:
{brand_context}

## Reference Ads (from archive):
{reference_ads}

---

Write a compelling press release that includes:
1. **Headline**: Award-winning announcement headline
2. **Subheading**: The campaign's key achievement
3. **Opening Paragraph**: The news hook - what made this campaign remarkable
4. **Problem Statement**: What consumer/market challenge did this address?
5. **Solution**: How the campaign solved it in a fresh, memorable way
6. **Key Creative Elements**: The standout creative choices (without scripting the ad)
7. **The Old Way (The Enemy)**: Identify the specific manual, tedious, or frustrating process the customer currently endures. Use visceral language (e.g., 'drowning in paper,' 'shouting into the void,' 'wrestling with spreadsheets,' 'trapped in endless queues'). This defines the 'Pain' that creative agents will later exaggerate into a visual metaphor. Be specific about the physical, emotional, and time costs of the old way.
8. **Results**: The imagined effectiveness metrics and awards
9. **Quote from ECD**: A fictional quote from the Executive Creative Director
10. **Quote from Client**: A fictional quote from the brand's CMO

Keep the tone confident but grounded. This should feel like a real trade press announcement.

Respond with ONLY the press release text (no JSON wrapper).
"""


async def run_amazon_start(
    run: "AdScriptRun",
    config: "CreativeModeConfig"
) -> None:
    """
    Generate the "Working Backwards" press release.
    
    This document sets the creative vision before ideation begins.
    """
    brief = run.brief
    
    # Format mandatories section
    mandatories_section = ""
    if brief.mandatories:
        mandatories_section = f"- Mandatories: {', '.join(brief.mandatories)}"
    
    # Format reference ads
    reference_ads = ""
    if run.retrieval.neighbors:
        ads_list = []
        for i, neighbor in enumerate(run.retrieval.neighbors[:5], 1):
            ads_list.append(
                f"{i}. \"{neighbor.title}\" ({neighbor.brand}, {neighbor.year or 'year unknown'}): "
                f"{neighbor.description[:200]}..."
            )
        reference_ads = "\n".join(ads_list)
    else:
        reference_ads = "No reference ads available."
    
    # Build prompt
    prompt = AMAZON_START_PROMPT.format(
        brand_name=brief.brand_name or "[Brand]",
        product_service=brief.product_service or "[Product/Service]",
        objective=brief.objective,
        target_audience=brief.target_audience,
        single_minded_proposition=brief.single_minded_proposition,
        tone_of_voice=brief.tone_of_voice,
        length_seconds=brief.length_seconds,
        budget_range=brief.budget_range,
        mandatories_section=mandatories_section,
        brand_context=brief.brand_context or "No additional context provided.",
        reference_ads=reference_ads
    )
    
    # Call Gemini
    try:
        model = create_gemini_model('pro')
        if not model:
            logger.warning("No Gemini model available, using placeholder press release")
            run.artifacts.press_release = _generate_placeholder_press_release(brief)
            return
        
        generation_config = genai.GenerationConfig(
            temperature=0.8,
            max_output_tokens=2000,
        )
        
        # Use timeout-wrapped async call to prevent indefinite hangs
        timeout = AGENT_CONFIGS["amazon_start"]["timeout_seconds"]
        text = await generate_with_timeout(model, prompt, generation_config, timeout)
        
        if text:
            run.artifacts.press_release = text
            logger.info("Generated press release (%d chars)", len(run.artifacts.press_release))
        else:
            logger.warning("Empty or blocked response from Gemini, using placeholder")
            run.artifacts.press_release = _generate_placeholder_press_release(brief)
            
    except Exception as e:
        logger.error("Failed to generate press release: %s", str(e))
        run.artifacts.press_release = _generate_placeholder_press_release(brief)


def _generate_placeholder_press_release(brief) -> str:
    """Generate a placeholder press release when Gemini is unavailable."""
    return f"""# {brief.brand_name or 'Brand'} Launches Award-Winning "{brief.asset_name}" Campaign

**{brief.product_service or 'Product'} campaign resonates with {brief.target_audience}**

[PLACEHOLDER - Gemini API unavailable]

## Problem Statement
This campaign successfully communicated: "{brief.single_minded_proposition}"

## Solution
The {brief.length_seconds}-second spot captured attention through its {brief.tone_of_voice} approach,
driving exceptional results for the brand.

## The Old Way (The Enemy)
Before {brief.brand_name or 'the brand'}, customers were trapped in an endless cycle of frustration - 
wrestling with outdated processes, drowning in complexity, and losing precious time to tasks that 
should have been effortless. The old way demanded patience, persistence, and an almost masochistic 
tolerance for inefficiency.

---
Note: This is a placeholder. The full press release will be generated when the Gemini API is available.
"""



