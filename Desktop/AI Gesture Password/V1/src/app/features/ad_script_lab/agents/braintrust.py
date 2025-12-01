"""
Braintrust Agent - Simulates creative director feedback.

Provides critique from multiple creative director personas.
"""

import logging
import json
import re
from typing import TYPE_CHECKING, List

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout

if TYPE_CHECKING:
    from ..types import AdScriptRun, BraintrustCritique
    from ..config import CreativeModeConfig

from ..types import BraintrustCritique
from ..config import AGENT_CONFIGS

logger = logging.getLogger(__name__)


BRAINTRUST_PROMPT = """You are {persona_name}, a renowned creative director known for your {persona_focus}.
Your critique style is {persona_style}.

## Brief Summary:
- Brand: {brand_name}
- Objective: {objective}
- Target: {target_audience}
- SMP: {single_minded_proposition}
- Tone: {tone_of_voice}

## Script to Review:
**{script_title}**

{full_script}

---

From your perspective as {persona_name}, provide honest, constructive feedback.
Be specific about what works, what doesn't, and how to improve.

RESPOND WITH VALID JSON ONLY:
```json
{{
  "strengths": [
    "Specific thing that works well",
    "Another strength"
  ],
  "weaknesses": [
    "Specific issue or concern",
    "Another weakness"
  ],
  "suggestions": [
    "Actionable improvement suggestion",
    "Another suggestion"
  ],
  "overall_rating": 7.5,
  "would_approve": true,
  "summary": "One paragraph overall assessment"
}}
```

Be brutally honest but constructive. If this isn't award-worthy yet, say so.
"""


async def run_braintrust(
    run: "AdScriptRun",
    config: "CreativeModeConfig",
    loop_number: int = 1
) -> None:
    """
    Get feedback from the Braintrust (creative director personas).

    ALWAYS reviews ALL 3 polished scripts with ALL 3 personas.
    Each script gets its own braintrust_feedback list with 3 critiques.
    """
    polished = run.artifacts.polished_3
    brief = run.brief

    if not polished:
        logger.warning("No polished scripts to review")
        return

    personas = AGENT_CONFIGS["braintrust"]["personas"]
    all_critiques = []  # For backward compatibility with run.artifacts

    # ALWAYS review ALL scripts with ALL personas
    for script in polished:
        script_critiques = []

        for persona in personas:
            try:
                critique = await _get_persona_critique(
                    brief, script, persona, config
                )
                # Set additional fields
                critique.critic_persona = persona["name"]
                critique.script_id = script.id
                script_critiques.append(critique)
                all_critiques.append(critique)

            except Exception as e:
                logger.error(
                    "Failed to get critique from %s for script %s: %s",
                    persona["name"], script.id, str(e)
                )
                # Add placeholder critique
                placeholder = BraintrustCritique(
                    script_id=script.id,
                    critic_persona=persona["name"],
                    strengths=["Unable to review - API error"],
                    weaknesses=[],
                    suggestions=["Retry review"],
                    overall_rating=5.0,
                    would_approve=False,
                    critique="Review failed due to API error"
                )
                script_critiques.append(placeholder)
                all_critiques.append(placeholder)

        # Store critiques on the script itself (per-script feedback)
        script.braintrust_feedback = script_critiques

        logger.info(
            "Script '%s' received %d critiques. Avg rating: %.1f, Approvals: %d/3",
            script.title,
            len(script_critiques),
            script.braintrust_average_rating or 0,
            script.braintrust_approval_count
        )

    # Also store in artifacts for backward compatibility
    run.artifacts.braintrust_feedback = all_critiques
    logger.info(
        "Braintrust complete: %d total critiques across %d scripts (loop %d)",
        len(all_critiques), len(polished), loop_number
    )


async def _get_persona_critique(brief, script, persona, config) -> BraintrustCritique:
    """Get critique from a single persona."""
    
    prompt = BRAINTRUST_PROMPT.format(
        persona_name=persona["name"],
        persona_focus=persona["focus"],
        persona_style=persona["style"],
        brand_name=brief.brand_name or "[Brand]",
        objective=brief.objective,
        target_audience=brief.target_audience,
        single_minded_proposition=brief.single_minded_proposition,
        tone_of_voice=brief.tone_of_voice,
        script_title=script.title,
        full_script=script.full_script or f"""
Opening: {script.opening}
Development: {script.development}
Climax: {script.climax}
Resolution: {script.resolution}
        """.strip()
    )
    
    # Add Disruptor-specific "Dot Connection Speed" instructions
    if persona["name"] == "The Disruptor":
        prompt += """

### Your Specific Focus: Dot Connection Speed

As The Disruptor, your unique focus is analyzing the CLARITY of the visual metaphor.

Analyze the metaphor (The Anchor vs. The Jumper):
- **Is it too abstract?** Will the audience get lost in the metaphor?
- **Is it too cliché?** Have we seen this exact metaphor before (e.g., another "drowning in paperwork" ad)?
- **Is the contrast clear?** Does the struggle-to-solution transformation feel earned?

**CRITICAL TEST: THE MUTE TEST**
If you mute the audio, do you STILL understand the 'Before/After' contrast?
- Can you see the struggle without hearing it explained?
- Is the intervention moment visually distinct?
- Does the transformation read as magical/effortless?

**If the mute test fails, recommend rejection or significant revision.**

Score the "Dot Connection Speed" in your overall_rating:
- 1-3: Requires explanation to understand the metaphor
- 4-6: Audience gets it after a moment of thought
- 7-10: Instantly clear visual metaphor - the "creative leap" lands immediately

In your weaknesses, specifically call out any "Dot Connection" issues.
"""
    
    model = create_gemini_model('pro')
    if not model:
        return BraintrustCritique(
            critic_persona=persona["name"],
            strengths=["Gemini unavailable - manual review needed"],
            weaknesses=[],
            suggestions=[],
            overall_rating=5.0,
            would_approve=False
        )
    
    generation_config = genai.GenerationConfig(
        temperature=0.6,
        max_output_tokens=1500,
    )
    
    # Use timeout-wrapped async call to prevent indefinite hangs
    timeout = AGENT_CONFIGS["braintrust"]["timeout_seconds"]
    text = await generate_with_timeout(model, prompt, generation_config, timeout)
    
    if text:
        return _parse_critique_response(text, persona["name"])
    
    return BraintrustCritique(
        critic_persona=persona["name"],
        strengths=["Unable to generate critique"],
        overall_rating=5.0,
        would_approve=False
    )


def _parse_critique_response(response_text: str, persona_name: str) -> BraintrustCritique:
    """Parse critique response into BraintrustCritique object."""
    try:
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())

            return BraintrustCritique(
                critic_persona=persona_name,
                strengths=data.get("strengths", []),
                weaknesses=data.get("weaknesses", []),
                suggestions=data.get("suggestions", []),
                overall_rating=float(data.get("overall_rating", 5.0)),
                would_approve=bool(data.get("would_approve", False)),
                critique=data.get("summary", "")  # Map "summary" from prompt to "critique" field
            )

    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse critique JSON: %s", str(e))

    # Fallback - use raw response as critique
    return BraintrustCritique(
        critic_persona=persona_name,
        strengths=["See raw feedback"],
        weaknesses=[response_text[:300] if len(response_text) > 300 else response_text],
        suggestions=[],
        overall_rating=5.0,
        would_approve=False,
        critique=response_text[:500] if len(response_text) > 500 else response_text
    )



