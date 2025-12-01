"""
Ideate Agent - Generates initial TV ad concepts.

Creates 5-10 distinct concepts based on the brief and reference ads.
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


def _extract_manual_enemy(press_release: str) -> str:
    """
    Extract the 'Old Way (The Enemy)' section from press release.
    
    This defines the manual, tedious process that the Jumper Algorithm
    will later exaggerate into a visual metaphor.
    """
    if not press_release:
        return "No manual enemy defined - infer from the brief's pain points."
    
    # Try multiple patterns to find the "Old Way" section
    patterns = [
        r"The Old Way.*?[:\n](.*?)(?=\n\n|\n[0-9]+\.|\n##|\Z)",
        r"Old Way.*?[:\n](.*?)(?=\n\n|\n[0-9]+\.|\n##|\Z)",
        r"The Enemy.*?[:\n](.*?)(?=\n\n|\n[0-9]+\.|\n##|\Z)",
        r"Problem Statement.*?[:\n](.*?)(?=\n\n|\n[0-9]+\.|\n##|\Z)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, press_release, re.IGNORECASE | re.DOTALL)
        if match:
            extracted = match.group(1).strip()
            if len(extracted) > 20:  # Ensure we got meaningful content
                return extracted
    
    # Fallback: Try to extract any paragraph mentioning frustration/pain
    frustration_patterns = [
        r"[^.]*(?:frustrat|tedious|painful|struggle|drowning|trapped|endless)[^.]*\.",
        r"[^.]*(?:manual|old way|before|used to)[^.]*\.",
    ]
    
    for pattern in frustration_patterns:
        match = re.search(pattern, press_release, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    
    return "No manual enemy defined - infer from the brief's pain points."


IDEATE_PROMPT = """You are a senior creative team engineering Visual Metaphors for TV ads.

## Brief:
- Asset Name: {asset_name}
- Brand: {brand_name}
- Product/Service: {product_service}
- Campaign Objective: {objective}
- Target Audience: {target_audience}
- Single-Minded Proposition: {single_minded_proposition}
- Tone of Voice: {tone_of_voice}
- Ad Length: {length_seconds} seconds
- Budget Range: {budget_range}
{mandatories_section}

## Vision Document (Working Backwards):
{press_release_excerpt}

## The Manual Enemy (from Vision Doc):
{manual_enemy}

## Reference Ads for Inspiration:
### Structure References (steal the format, not the category):
{structure_references}

### Emotion References (ads that evoke similar pain/frustration):
{emotion_references}

### Analogue Suggestions (physical tasks associated with the core emotion):
{analogue_suggestions}

---

## Creative Framework: The 'Jumper' Algorithm

You are not just writing scripts; you are engineering Visual Metaphors. For every concept, follow this strict 4-step logic:

### 1. The Anchor (The Manual Analogue)
- Look at the 'Manual Enemy' defined above
- Find a physical, real-world analogue for this task that is universally understood as tedious
- Examples: cutting grass with scissors, painting a bridge with a toothbrush, digging a tunnel with a spoon
- CONSTRAINT: Do NOT show the literal business task (e.g., typing on a laptop) unless physically exaggerated (e.g., laptop made of stone)

### 2. The Setup (Hyperbolic Struggle)
- The protagonist must be performing this 'Anchor' task
- The struggle must be absurd and visual
- The audience should feel the exhaustion immediately

### 3. The Intervention (The Low-Effort Catalyst)
- The Brand/Mascot enters
- CRITICAL: The Mascot must NOT work hard
- Use a "Low-Effort Action": a snap, a wink, a blow, a button press
- This contrasts the difficulty of the problem with the ease of the solution (AI/Tech)

### 4. The Jumper (The Impossible Result)
- The solution must defy physics
- The grass doesn't just get cut; it vanishes
- The door doesn't just unlock; it dissolves
- This creates the "Creative Leap" - showing the audience the new way is effectively magic

Generate {ideas_count} DISTINCT concepts following this framework.

RESPOND WITH VALID JSON ONLY - an array of concept objects:
```json
[
  {{
    "title": "Concept Title",
    "anchor": "The tedious manual analogue - what physical task represents the old way? (2-3 sentences)",
    "setup": "The hyperbolic struggle scene - how do we show the absurd exhaustion? (2-3 sentences)",
    "intervention": "The low-effort catalyst moment - what simple action does the brand/mascot perform? (1-2 sentences)",
    "jumper": "The physics-defying magical result - what impossible transformation occurs? (2-3 sentences)",
    "hook": "The opening moment summary (1 sentence)",
    "narrative": "Full story arc from anchor to jumper (3-5 sentences)",
    "key_moments": ["Visual moment 1", "Moment 2", "Moment 3"],
    "cta": "Call to action or closing message",
    "rationale": "Why this metaphor works for the brief and the SMP",
    "inspired_by": ["ref-001"]
  }}
]
```

Generate exactly {ideas_count} concepts, each with a substantially different ANCHOR metaphor.
"""


async def run_ideate(
    run: "AdScriptRun",
    config: "CreativeModeConfig"
) -> None:
    """
    Generate initial ad concepts using the Jumper Algorithm.
    
    The number of concepts is determined by the creative mode.
    Uses Cross-Pollinator lateral retrieval for inspiration.
    """
    brief = run.brief
    
    # Format mandatories
    mandatories_section = ""
    if brief.mandatories:
        mandatories_section = f"- Mandatories: {', '.join(brief.mandatories)}"
    
    # Extract the Manual Enemy from the press release
    manual_enemy = _extract_manual_enemy(run.artifacts.press_release)
    
    # Format Structure References (cross-industry ads with strong visual metaphor structure)
    structure_references = ""
    if run.retrieval.structure_references:
        refs_list = []
        for neighbor in run.retrieval.structure_references[:4]:
            refs_list.append(
                f"- ID: {neighbor.id} | \"{neighbor.title}\" ({neighbor.brand}, {neighbor.category}): "
                f"{neighbor.description[:150]}... "
                f"[Steal the STRUCTURE, not the category]"
            )
        structure_references = "\n".join(refs_list)
    else:
        # Fall back to regular neighbors if no structure refs
        if run.retrieval.neighbors:
            refs_list = []
            for neighbor in run.retrieval.neighbors[:4]:
                refs_list.append(
                    f"- ID: {neighbor.id} | \"{neighbor.title}\" ({neighbor.brand}): "
                    f"{neighbor.description[:150]}..."
                )
            structure_references = "\n".join(refs_list)
        else:
            structure_references = "No structure references available."
    
    # Format Emotion References (ads that evoke similar pain/frustration)
    emotion_references = ""
    if run.retrieval.emotion_references:
        refs_list = []
        for neighbor in run.retrieval.emotion_references[:4]:
            refs_list.append(
                f"- ID: {neighbor.id} | \"{neighbor.title}\" ({neighbor.brand}): "
                f"{neighbor.description[:150]}... "
                f"[Core emotion: {run.retrieval.core_emotion}]"
            )
        emotion_references = "\n".join(refs_list)
    else:
        emotion_references = "No emotion references available - infer from the brief's pain points."
    
    # Format Analogue Suggestions (physical tasks associated with the core emotion)
    analogue_suggestions = ""
    if run.retrieval.analogue_suggestions:
        analogue_suggestions = "\n".join(f"- {s}" for s in run.retrieval.analogue_suggestions)
    else:
        # Default analogues based on common frustrations
        analogue_suggestions = """- Untangling a massive knot of Christmas lights
- Searching for a single needle in a haystack
- Filling out endless paper forms in triplicate
- Waiting in an infinite queue that never moves
- Pushing a boulder up a hill only for it to roll back down"""
    
    # Press release excerpt
    press_release_excerpt = run.artifacts.press_release[:1000] if run.artifacts.press_release else "No vision document available."
    
    # Build prompt
    prompt = IDEATE_PROMPT.format(
        asset_name=brief.asset_name,
        brand_name=brief.brand_name or "[Brand]",
        product_service=brief.product_service or "[Product/Service]",
        objective=brief.objective,
        target_audience=brief.target_audience,
        single_minded_proposition=brief.single_minded_proposition,
        tone_of_voice=brief.tone_of_voice,
        length_seconds=brief.length_seconds,
        budget_range=brief.budget_range,
        mandatories_section=mandatories_section,
        press_release_excerpt=press_release_excerpt,
        manual_enemy=manual_enemy,
        structure_references=structure_references,
        emotion_references=emotion_references,
        analogue_suggestions=analogue_suggestions,
        ideas_count=config.ideas_count
    )
    
    # Call Gemini
    try:
        model = create_gemini_model('pro')
        if not model:
            logger.warning("No Gemini model available, using placeholder ideas")
            run.artifacts.ideas_10 = _generate_placeholder_ideas(brief, config.ideas_count)
            return
        
        generation_config = genai.GenerationConfig(
            temperature=config.temperature_ideation,
            max_output_tokens=4000,
        )
        
        # Use timeout-wrapped async call to prevent indefinite hangs
        timeout = AGENT_CONFIGS["ideate"]["timeout_seconds"]
        text = await generate_with_timeout(model, prompt, generation_config, timeout)
        
        if text:
            ideas = _parse_ideas_response(text, brief)
            run.artifacts.ideas_10 = ideas
            
            # Generate research insights based on ideas
            run.brief.research_insights = _generate_research_insights(brief, ideas)
            
            logger.info("Generated %d ideas", len(ideas))
        else:
            logger.warning("Empty or blocked response from Gemini, using placeholder ideas")
            run.artifacts.ideas_10 = _generate_placeholder_ideas(brief, config.ideas_count)
            
    except Exception as e:
        logger.error("Failed to generate ideas: %s", str(e))
        run.artifacts.ideas_10 = _generate_placeholder_ideas(brief, config.ideas_count)


def _parse_ideas_response(response_text: str, brief) -> List[ScriptIdea]:
    """Parse the JSON response from Gemini into ScriptIdea objects with Jumper fields."""
    ideas = []
    
    try:
        # Try to extract JSON from the response
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            json_str = json_match.group()
            data = json.loads(json_str)
            
            for item in data:
                idea = ScriptIdea(
                    title=item.get("title", "Untitled Concept"),
                    # Jumper Framework fields
                    anchor=item.get("anchor", ""),
                    setup=item.get("setup", ""),
                    intervention=item.get("intervention", ""),
                    jumper=item.get("jumper", ""),
                    # Legacy fields
                    hook=item.get("hook", ""),
                    narrative=item.get("narrative", ""),
                    key_moments=item.get("key_moments", []),
                    cta=item.get("cta", ""),
                    rationale=item.get("rationale", ""),
                    inspired_by=item.get("inspired_by", [])
                )
                ideas.append(idea)
                
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse ideas JSON: %s", str(e))
        # Create a single idea from the raw text
        ideas.append(ScriptIdea(
            title="Generated Concept",
            anchor="See narrative for details",
            setup="",
            intervention="",
            jumper="",
            hook="See narrative for details",
            narrative=response_text[:500],
            key_moments=[],
            cta="",
            rationale="Auto-generated from raw response"
        ))
    
    return ideas


def _generate_placeholder_ideas(brief, count: int) -> List[ScriptIdea]:
    """Generate placeholder ideas using the Jumper framework when Gemini is unavailable."""
    ideas = []
    
    # Jumper-style placeholder concepts with anchor/setup/intervention/jumper
    jumper_concepts = [
        {
            "title": "The Scissors vs The Lawn",
            "anchor": "A person on their knees, cutting an enormous lawn with tiny nail scissors. Each blade of grass takes a separate snip.",
            "setup": "The protagonist has been at it for days. Their hands are cramped, their knees are raw. A progress bar overlay shows they're 0.3% complete.",
            "intervention": "The brand mascot walks in, yawns, and casually blows a dandelion.",
            "jumper": "The entire lawn transforms into a perfect striped pattern instantly. The scissors dissolve into confetti.",
            "approach": "Sisyphean Task"
        },
        {
            "title": "The Filing Cabinet Mountain",
            "anchor": "An office worker stands before a mountain of filing cabinets that reaches into the clouds, each drawer overflowing with paper.",
            "setup": "They're climbing the cabinet mountain with a single document, sweating. Signs point to different floors: 'TPS Reports - Floor 847'. An elevator sign says 'Out of Order Since 1987'.",
            "intervention": "The brand icon appears and simply taps the side of the mountain with one finger.",
            "jumper": "All cabinets fold into origami birds and fly away, leaving a single glowing screen showing 'Complete'.",
            "approach": "Bureaucratic Nightmare"
        },
        {
            "title": "The Brick Phone Call",
            "anchor": "A person tries to make a call using two tin cans connected by a string that stretches across the entire city.",
            "setup": "They're shouting into the can while running across rooftops, through traffic, across rivers, trying to keep the string taut. The other person hears only static.",
            "intervention": "The brand character walks by and snaps their fingers.",
            "jumper": "The string transforms into a beam of light. Suddenly both people are having a crystal-clear holographic conversation.",
            "approach": "Stone Age Communication"
        },
        {
            "title": "The Maze of Terms & Conditions",
            "anchor": "A person stands at the entrance to a hedge maze. The hedges are made entirely of tiny legal text. Signs warn: 'Reading time: 47 years'.",
            "setup": "They venture in, getting lost, tripping over footnotes, attacked by aggressive asterisks. A skeleton nearby holds a scroll that reads 'I almost finished'.",
            "intervention": "The brand mascot appears floating above the maze and simply winks.",
            "jumper": "The entire maze flattens into a single 'Got it' button. The customer strolls across triumphantly.",
            "approach": "Legal Labyrinth"
        },
        {
            "title": "The Manual Assembly",
            "anchor": "A person sits surrounded by 10,000 numbered parts and an instruction manual the size of a phone book, all in a language that doesn't exist.",
            "setup": "Sweat drips. They've been at it for 72 hours. They've built something, but it's clearly wrong - it looks like abstract art. The manual page reads 'Step 1 of 847,000'.",
            "intervention": "The brand logo bounces into frame and simply presses a single button.",
            "jumper": "All parts levitate and assemble themselves into a perfect product in seconds. The manual bursts into celebration confetti.",
            "approach": "IKEA Nightmare"
        },
    ]
    
    for i, concept in enumerate(jumper_concepts[:count]):
        ideas.append(ScriptIdea(
            title=f"{concept['title']} - {brief.asset_name}",
            anchor=concept["anchor"],
            setup=concept["setup"],
            intervention=concept["intervention"],
            jumper=concept["jumper"],
            hook=f"Opening on the absurd struggle of the {concept['approach']}",
            narrative=f"The ad opens with the protagonist trapped in a {concept['approach']}. The struggle is visual and absurd. {brief.brand_name or 'The brand'} enters with effortless ease and transforms everything with a simple gesture, demonstrating that {brief.single_minded_proposition}.",
            key_moments=[
                f"The {concept['approach']} struggle reveal",
                "The exhaustion and frustration peak",
                "The brand's effortless intervention",
                "The magical transformation"
            ],
            cta=f"{brief.brand_name or 'We'} make it effortless",
            rationale=f"This {concept['approach']} metaphor visually demonstrates the contrast between the old way and the new way, making {brief.single_minded_proposition} instantly understandable through {brief.tone_of_voice} storytelling."
        ))
    
    return ideas


def _generate_research_insights(brief, ideas: List[ScriptIdea]) -> str:
    """Generate research insights summary based on the brief and ideas."""
    insights = [
        f"Target audience ({brief.target_audience}) analysis:",
        f"- Primary motivations: Achievement of '{brief.single_minded_proposition}'",
        f"- Media consumption: Multi-screen, TV-engaged during prime time",
        f"- Category perceptions: Open to brands that demonstrate {brief.tone_of_voice} communication",
        "",
        f"Creative approach alignment:",
    ]
    
    for idea in ideas[:3]:
        insights.append(f"- '{idea.title}' connects through {idea.rationale[:100]}...")
    
    return "\n".join(insights)



