"""
Polish Agent - Develops full scripts from selected concepts.

Takes the top 3 concepts and creates production-ready scripts.
"""

import asyncio
import logging
import json
import re
from typing import TYPE_CHECKING, List

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout

if TYPE_CHECKING:
    from ..types import AdScriptRun, PolishedScript
    from ..config import CreativeModeConfig

from ..types import PolishedScript
from ..config import AGENT_CONFIGS

logger = logging.getLogger(__name__)


POLISH_PROMPT = """You are a senior TV commercial scriptwriter and director developing a PRODUCTION-READY script. Write at the level of detail needed for a director to shoot this ad tomorrow.

## Brief:
- Brand: {brand_name}
- Product/Service: {product_service}
- Objective: {objective}
- Target Audience: {target_audience}
- SMP: {single_minded_proposition}
- Tone: {tone_of_voice}
- Length: {length_seconds} seconds
- Budget: {budget_range}
- Visual Style: {visual_style}

## Concept to Develop:
**{concept_title}**
- Hook: {concept_hook}
- Narrative: {concept_narrative}
- Key Moments: {concept_key_moments}
- CTA: {concept_cta}

---

## DETAILED SCRIPT REQUIREMENTS

Create an exceptionally detailed, shoot-ready script. Every scene must include:

### For Each Scene:
1. **TIMING**: Precise timecodes [00:00 - 00:05]
2. **LOCATION/SET**: Specific setting description (interior/exterior, lighting, atmosphere)
3. **CAMERA**: Shot type (CU, WS, MS, etc.), camera movement (pan, dolly, handheld, drone)
4. **ACTION**: Exactly what happens on screen, beat by beat
5. **DIALOGUE/VO**: Complete spoken lines with delivery direction (tone, pace, emphasis)
6. **SUPERS/GRAPHICS**: Any on-screen text with font style, position, animation
7. **SFX**: Specific sound effects with timing
8. **MUSIC**: Cues for score changes, builds, cuts

### Script Structure:
- **Opening (0-5s)**: The hook that stops the scroll. MUST capture attention in first 2 seconds.
- **Development (5-20s)**: Story progression, brand integration, emotional build
- **Climax (20-25s)**: The payoff moment - emotional peak or surprising twist
- **Resolution (25-{length_seconds}s)**: CTA, brand lockup, and lasting impression

### Production Notes Must Include:
- **Visual Style**: Reference films/ads, color palette (specific hex codes if possible), aspect ratio, grain/texture
- **Audio Notes**: Music genre, tempo (BPM range), reference tracks, VO casting specs (gender, age, accent)
- **Talent Notes**: Specific casting brief for each character (age range, look, wardrobe, personality)
- **Production Considerations**: Location requirements, props list, VFX needs, crew size, estimated shoot days

## QUALITY STANDARDS
- Full script must be MINIMUM 400 words
- Each scene section must be MINIMUM 80 words
- Include at least 5 specific camera directions
- Include at least 3 sound design elements
- Dialogue/VO must be fully written out, not summarized

RESPOND WITH VALID JSON ONLY:
```json
{{
  "title": "Script Title",
  "opening": "[00:00 - 00:05] DETAILED scene with camera, action, dialogue, SFX. MINIMUM 80 words.",
  "development": "[00:05 - 00:20] DETAILED middle section with all production elements. MINIMUM 100 words.",
  "climax": "[00:20 - 00:25] DETAILED peak moment with precise direction. MINIMUM 80 words.",
  "resolution": "[00:25 - 00:{length_seconds:02d}] DETAILED closing with CTA direction. MINIMUM 60 words.",
  "full_script": "Complete formatted shooting script with all scenes, all elements combined. MINIMUM 400 words. Format as a professional shooting script.",
  "visual_style": "Detailed art direction: reference films, color palette, cinematography style, lighting approach. MINIMUM 100 words.",
  "audio_notes": "Complete audio design: music references, VO specs, SFX list with timing. MINIMUM 80 words.",
  "talent_notes": "Detailed casting briefs for all on-screen talent. MINIMUM 60 words.",
  "production_considerations": "Locations, props, VFX, crew, timeline, budget allocation. MINIMUM 80 words.",
  "estimated_duration_seconds": {length_seconds}
}}
```

Write like you're briefing a director who has never seen this concept before - they should be able to shoot this script from your description alone.
"""


async def run_polish(
    run: "AdScriptRun",
    config: "CreativeModeConfig"
) -> None:
    """
    Polish the top 3 concepts into full scripts.
    
    Scripts are polished in parallel for better performance.
    """
    brief = run.brief
    viable_concepts = run.artifacts.viable_3
    
    if not viable_concepts:
        logger.warning("No viable concepts to polish")
        return
    
    # Run all polish tasks in parallel for better performance
    async def _safe_polish(concept):
        """Wrapper to catch exceptions per-concept."""
        try:
            return await _polish_single_concept(brief, concept, config)
        except Exception as e:
            logger.error("Failed to polish concept '%s': %s", concept.title, str(e))
            return _create_placeholder_script(brief, concept)
    
    tasks = [_safe_polish(concept) for concept in viable_concepts]
    polished_scripts = await asyncio.gather(*tasks)
    
    run.artifacts.polished_3 = list(polished_scripts)
    logger.info("Polished %d scripts in parallel", len(polished_scripts))


async def _polish_single_concept(brief, concept, config, retry_count: int = 0) -> PolishedScript:
    """Polish a single concept into a full script with validation and retry."""
    MAX_RETRIES = 2

    prompt = POLISH_PROMPT.format(
        brand_name=brief.brand_name or "[Brand]",
        product_service=brief.product_service or "[Product/Service]",
        objective=brief.objective,
        target_audience=brief.target_audience,
        single_minded_proposition=brief.single_minded_proposition,
        tone_of_voice=brief.tone_of_voice,
        length_seconds=brief.length_seconds,
        budget_range=brief.budget_range,
        visual_style=getattr(brief, 'visual_style', '') or "Not specified - use professional judgment",
        concept_title=concept.title,
        concept_hook=concept.hook,
        concept_narrative=concept.narrative,
        concept_key_moments=", ".join(concept.key_moments),
        concept_cta=concept.cta
    )

    model = create_gemini_model('pro')
    if not model:
        return _create_placeholder_script(brief, concept)

    generation_config = genai.GenerationConfig(
        temperature=0.7,
        max_output_tokens=5000,  # Increased for detailed scripts
    )

    # Use timeout-wrapped async call to prevent indefinite hangs
    timeout = AGENT_CONFIGS["polish"]["per_script_timeout_seconds"]
    text = await generate_with_timeout(model, prompt, generation_config, timeout)

    if text:
        script = _parse_polish_response(text, concept)

        # Validate output meets minimum requirements
        validation_result = _validate_script_detail(script)
        if not validation_result["valid"] and retry_count < MAX_RETRIES:
            logger.warning(
                "Script '%s' failed validation: %s. Retrying (%d/%d)...",
                concept.title, validation_result["reason"], retry_count + 1, MAX_RETRIES
            )
            return await _polish_single_concept(brief, concept, config, retry_count + 1)

        return script

    return _create_placeholder_script(brief, concept)


def _validate_script_detail(script: PolishedScript) -> dict:
    """Validate that a polished script meets minimum detail requirements."""
    MIN_FULL_SCRIPT_WORDS = 300
    MIN_SECTION_WORDS = 40

    full_script_words = len(script.full_script.split()) if script.full_script else 0
    opening_words = len(script.opening.split()) if script.opening else 0
    development_words = len(script.development.split()) if script.development else 0
    climax_words = len(script.climax.split()) if script.climax else 0

    if full_script_words < MIN_FULL_SCRIPT_WORDS:
        return {
            "valid": False,
            "reason": f"full_script too short ({full_script_words}/{MIN_FULL_SCRIPT_WORDS} words)"
        }

    if opening_words < MIN_SECTION_WORDS:
        return {
            "valid": False,
            "reason": f"opening too short ({opening_words}/{MIN_SECTION_WORDS} words)"
        }

    if development_words < MIN_SECTION_WORDS:
        return {
            "valid": False,
            "reason": f"development too short ({development_words}/{MIN_SECTION_WORDS} words)"
        }

    if climax_words < MIN_SECTION_WORDS:
        return {
            "valid": False,
            "reason": f"climax too short ({climax_words}/{MIN_SECTION_WORDS} words)"
        }

    # Check for timing markers
    has_timing = "[00:" in script.full_script or "00:" in script.full_script
    if not has_timing:
        return {
            "valid": False,
            "reason": "missing timing markers"
        }

    return {"valid": True, "reason": None}


def _parse_polish_response(response_text: str, concept) -> PolishedScript:
    """Parse the polish response into a PolishedScript object."""
    try:
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())
            
            return PolishedScript(
                title=data.get("title", concept.title),
                concept_id=concept.id,
                opening=data.get("opening", ""),
                development=data.get("development", ""),
                climax=data.get("climax", ""),
                resolution=data.get("resolution", ""),
                full_script=data.get("full_script", ""),
                visual_style=data.get("visual_style", ""),
                audio_notes=data.get("audio_notes", ""),
                talent_notes=data.get("talent_notes", ""),
                production_considerations=data.get("production_considerations", ""),
                estimated_duration_seconds=data.get("estimated_duration_seconds", 30)
            )
            
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse polish JSON: %s", str(e))
    
    # Return with raw text as full_script
    return PolishedScript(
        title=concept.title,
        concept_id=concept.id,
        full_script=response_text[:2000],
        estimated_duration_seconds=30
    )


def _create_placeholder_script(brief, concept) -> PolishedScript:
    """Create a placeholder script when Gemini is unavailable."""
    return PolishedScript(
        title=concept.title,
        concept_id=concept.id,
        opening=f"[00:00] OPEN on {concept.hook}",
        development=f"[00:05] {concept.narrative}",
        climax=f"[00:20] Key moment: {concept.key_moments[0] if concept.key_moments else 'Emotional peak'}",
        resolution=f"[00:25] {concept.cta}. Logo lockup.",
        full_script=f"""
# {concept.title}
## {brief.length_seconds}-second TV Commercial

### Scene 1: Opening [00:00 - 00:05]
{concept.hook}

### Scene 2: Development [00:05 - 00:20]
{concept.narrative}

### Scene 3: Climax [00:20 - 00:25]
Key moments:
{chr(10).join(f'- {m}' for m in concept.key_moments)}

### Scene 4: Resolution [00:25 - 00:{brief.length_seconds:02d}]
{concept.cta}

SUPER: {brief.brand_name or 'Brand'} logo
        """.strip(),
        visual_style=f"Match {brief.tone_of_voice} tone with premium cinematography",
        audio_notes="Original score or licensed track TBD. VO talent to be cast.",
        talent_notes="Cast to represent {brief.target_audience}",
        production_considerations=f"Budget range: {brief.budget_range}. 1-2 day shoot.",
        estimated_duration_seconds=brief.length_seconds
    )



