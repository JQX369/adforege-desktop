"""
Finalize Agent - Produces the final script pack.

Scores each script individually, then selects the winning script
and prepares production documentation.
"""

import asyncio
import logging
import json
import re
from typing import TYPE_CHECKING, Optional, List

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout

if TYPE_CHECKING:
    from ..types import AdScriptRun, PolishedScript, ScriptScores, Citation, AdScriptBrief
    from ..config import CreativeModeConfig

from ..types import PolishedScript, ScriptScores, Citation
from ..config import AGENT_CONFIGS

logger = logging.getLogger(__name__)


# Prompt for scoring individual scripts (AI analyzer-aligned metrics)
SCORE_SCRIPT_PROMPT = """You are an expert TV advertising effectiveness analyst.

Score this script on 8 dimensions (0-10 scale), aligned with industry ad effectiveness metrics.

## Brief Context:
- Brand: {brand_name}
- Objective: {objective}
- Target Audience: {target_audience}
- SMP: {single_minded_proposition}
- Tone: {tone_of_voice}

## Script to Score:
**{script_title}**

{full_script}

---

## Scoring Dimensions:

1. **overall_impact** (0-10): Overall ad effectiveness and creative strength
2. **hook_power** (0-10): How effectively the opening 3 seconds grab attention
3. **emotional_resonance** (0-10): Emotional depth and audience connection
4. **clarity_score** (0-10): Message clarity and CTA strength
5. **distinctiveness** (0-10): Creative uniqueness vs competitor ads
6. **brand_integration** (0-10): How naturally the brand is woven into the narrative
7. **pulse_score** (0-10): Immediate engagement and conversion potential
8. **echo_score** (0-10): Memorability and long-term recall potential

RESPOND WITH VALID JSON ONLY:
```json
{{
  "overall_impact": 7.5,
  "hook_power": 8.0,
  "emotional_resonance": 7.0,
  "clarity_score": 8.5,
  "distinctiveness": 7.0,
  "brand_integration": 7.5,
  "pulse_score": 7.5,
  "echo_score": 7.0,
  "overall": 7.5,
  "reasoning": {{
    "overall_impact": "Brief explanation...",
    "hook_power": "Brief explanation...",
    "emotional_resonance": "Brief explanation...",
    "clarity_score": "Brief explanation...",
    "distinctiveness": "Brief explanation...",
    "brand_integration": "Brief explanation...",
    "pulse_score": "Brief explanation...",
    "echo_score": "Brief explanation..."
  }}
}}
```

Be objective and consistent in your scoring. Consider both braintrust feedback and compliance status if available.
"""


async def score_script(
    script: "PolishedScript",
    brief: "AdScriptBrief",
    config: "CreativeModeConfig"
) -> ScriptScores:
    """
    Score a single script using AI analyzer-aligned metrics.

    Returns ScriptScores with 8 dimensions plus overall.
    """
    prompt = SCORE_SCRIPT_PROMPT.format(
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

    # Add braintrust context if available
    if script.braintrust_feedback:
        avg_rating = script.braintrust_average_rating or 5.0
        approval_count = script.braintrust_approval_count
        prompt += f"\n\n## Braintrust Ratings:\n- Average rating: {avg_rating:.1f}/10\n- Approvals: {approval_count}/3"

    try:
        model = create_gemini_model('pro')
        if not model:
            return _default_scores()

        generation_config = genai.GenerationConfig(
            temperature=0.3,  # Lower temperature for consistent scoring
            max_output_tokens=1500,
        )

        timeout = AGENT_CONFIGS.get("finalize", {}).get("timeout_seconds", 120)
        text = await generate_with_timeout(model, prompt, generation_config, timeout)

        if text:
            return _parse_scores(text)

    except Exception as e:
        logger.error("Failed to score script '%s': %s", script.title, str(e))

    return _default_scores()


def _parse_scores(response_text: str) -> ScriptScores:
    """Parse scoring response into ScriptScores object."""
    try:
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())

            # Calculate overall if not provided
            metrics = ['overall_impact', 'hook_power', 'emotional_resonance',
                      'clarity_score', 'distinctiveness', 'brand_integration',
                      'pulse_score', 'echo_score']

            scores = {m: float(data.get(m, 7.0)) for m in metrics}
            overall = data.get('overall')
            if not overall:
                overall = sum(scores.values()) / len(scores)

            return ScriptScores(
                overall_impact=scores['overall_impact'],
                hook_power=scores['hook_power'],
                emotional_resonance=scores['emotional_resonance'],
                clarity_score=scores['clarity_score'],
                distinctiveness=scores['distinctiveness'],
                brand_integration=scores['brand_integration'],
                pulse_score=scores['pulse_score'],
                echo_score=scores['echo_score'],
                overall=float(overall),
                reasoning=data.get('reasoning')
            )

    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse scores JSON: %s", str(e))

    return _default_scores()


def _default_scores() -> ScriptScores:
    """Return default scores when scoring fails."""
    return ScriptScores(
        overall_impact=7.0,
        hook_power=7.0,
        emotional_resonance=7.0,
        clarity_score=7.0,
        distinctiveness=7.0,
        brand_integration=7.0,
        pulse_score=7.0,
        echo_score=7.0,
        overall=7.0,
        reasoning={"note": "Default scores - scoring failed or unavailable"}
    )


async def score_all_scripts(
    run: "AdScriptRun",
    config: "CreativeModeConfig"
) -> None:
    """
    Score ALL polished scripts in parallel.

    This runs BEFORE final selection so each script has scores.
    """
    polished = run.artifacts.polished_3
    brief = run.brief

    if not polished:
        logger.warning("No polished scripts to score")
        return

    logger.info("Scoring %d polished scripts...", len(polished))

    # Score all scripts in parallel
    tasks = [score_script(script, brief, config) for script in polished]
    scores_list = await asyncio.gather(*tasks, return_exceptions=True)

    # Assign scores to each script
    for script, scores in zip(polished, scores_list):
        if isinstance(scores, Exception):
            logger.error("Scoring failed for '%s': %s", script.title, str(scores))
            script.scores = _default_scores()
        else:
            script.scores = scores

        logger.info(
            "Script '%s' scored: overall=%.1f, hook=%.1f, clarity=%.1f",
            script.title,
            script.scores.overall,
            script.scores.hook_power,
            script.scores.clarity_score
        )


FINALIZE_PROMPT = """You are an Executive Creative Director making the final script selection.

## Brief Summary:
- Brand: {brand_name}
- Objective: {objective}
- Target: {target_audience}
- SMP: {single_minded_proposition}
- Tone: {tone_of_voice}
- Length: {length_seconds}s
- Budget: {budget_range}

## Finalist Scripts:

{scripts_summary}

## Braintrust Feedback Summary:
{braintrust_summary}

## Compliance Status:
{compliance_summary}

---

Select the WINNING script and provide:

1. **Selection Rationale**: Why this script wins
2. **Final Scores**: Rate the winning script (0-10 each)
3. **Production Notes**: Guidance for the production team
4. **Risk Mitigation**: How to address any compliance concerns

RESPOND WITH VALID JSON ONLY:
```json
{{
  "winning_script_id": "script_id",
  "selection_rationale": "Detailed explanation of why this script was chosen",
  "scores": {{
    "tv_native": 8.0,
    "clarity": 8.5,
    "emotional_impact": 9.0,
    "brand_fit": 8.0,
    "memorability": 8.5,
    "originality": 7.5,
    "overall": 8.3
  }},
  "production_notes": "Key guidance for the production team...",
  "risk_mitigation": "How to handle compliance concerns...",
  "citations": [
    {{
      "neighbor_id": "mock-001",
      "neighbor_title": "Reference Ad Title",
      "influence_type": "inspiration",
      "specific_element": "What element was influenced"
    }}
  ]
}}
```
"""


async def run_finalize(
    run: "AdScriptRun",
    config: "CreativeModeConfig"
) -> None:
    """
    Finalize the script selection and produce the final pack.

    Pipeline:
    1. Score all scripts (if not already scored)
    2. Build summary with scores for selection
    3. Select winning script
    4. Mark winner and update run.scores
    """
    brief = run.brief
    polished = run.artifacts.polished_3
    compliance = run.artifacts.compliance_checks

    if not polished:
        logger.warning("No polished scripts to finalize")
        return

    # Step 1: Ensure all scripts are scored
    needs_scoring = any(script.scores is None for script in polished)
    if needs_scoring:
        await score_all_scripts(run, config)

    # Build scripts summary WITH SCORES
    scripts_summary = []
    for i, script in enumerate(polished, 1):
        # Compliance status
        compliance_status = "Pending"
        if i <= len(compliance):
            c = compliance[i-1]
            compliance_status = f"{'Passed' if c.passed else 'Issues'} ({c.risk_level})"

        # Score summary
        score_str = "Not scored"
        if script.scores:
            score_str = f"Overall: {script.scores.overall:.1f}/10"

        # Braintrust summary for this script
        bt_str = "No feedback"
        if script.braintrust_feedback:
            avg = script.braintrust_average_rating or 0
            approvals = script.braintrust_approval_count
            bt_str = f"Avg: {avg:.1f}/10, {approvals}/3 approvals"

        scripts_summary.append(
            f"### Script {i}: {script.title} (ID: {script.id})\n"
            f"Score: {score_str}\n"
            f"Braintrust: {bt_str}\n"
            f"Compliance: {compliance_status}\n"
            f"Opening: {script.opening[:100]}...\n"
        )

    # Build braintrust summary (aggregate across all scripts)
    braintrust_summary = "Per-script feedback included above."
    all_feedback = run.artifacts.braintrust_feedback
    if all_feedback:
        # Group by script
        feedback_lines = []
        for script in polished:
            if script.braintrust_feedback:
                avg = script.braintrust_average_rating or 0
                approvals = script.braintrust_approval_count
                feedback_lines.append(
                    f"- {script.title}: {avg:.1f}/10 average, {approvals}/3 approvals"
                )
        if feedback_lines:
            braintrust_summary = "\n".join(feedback_lines)
    
    # Build compliance summary
    compliance_summary = "No compliance checks performed."
    if compliance:
        comp_lines = []
        for i, c in enumerate(compliance, 1):
            issues_count = len(c.issues)
            comp_lines.append(
                f"- Script {i}: {'Passed' if c.passed else 'Failed'} "
                f"(Risk: {c.risk_level}, {issues_count} issues)"
            )
        compliance_summary = "\n".join(comp_lines)
    
    prompt = FINALIZE_PROMPT.format(
        brand_name=brief.brand_name or "[Brand]",
        objective=brief.objective,
        target_audience=brief.target_audience,
        single_minded_proposition=brief.single_minded_proposition,
        tone_of_voice=brief.tone_of_voice,
        length_seconds=brief.length_seconds,
        budget_range=brief.budget_range,
        scripts_summary="\n".join(scripts_summary),
        braintrust_summary=braintrust_summary,
        compliance_summary=compliance_summary
    )
    
    try:
        model = create_gemini_model('pro')
        if not model:
            # Fallback: select highest-scoring script
            _finalize_fallback(run, polished)
            return
        
        generation_config = genai.GenerationConfig(
            temperature=0.4,
            max_output_tokens=2500,
        )
        
        # Use timeout-wrapped async call to prevent indefinite hangs
        timeout = AGENT_CONFIGS["finalize"]["timeout_seconds"]
        text = await generate_with_timeout(model, prompt, generation_config, timeout)
        
        if text:
            _parse_finalize_response(run, text, polished)
        else:
            _finalize_fallback(run, polished)
            
    except Exception as e:
        logger.error("Failed to finalize: %s", str(e))
        _finalize_fallback(run, polished)
    
    logger.info(
        "Finalized run with script: %s (score: %.1f)",
        run.artifacts.final_script.title if run.artifacts.final_script else "None",
        run.scores.overall
    )


def _parse_finalize_response(run, response_text: str, polished: list) -> None:
    """Parse finalize response and update run state."""
    try:
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())

            # Find winning script
            winning_id = data.get("winning_script_id", "")
            winning_script = None

            for script in polished:
                # Reset is_winner for all scripts
                script.is_winner = False
                if script.id == winning_id or winning_id in script.id:
                    winning_script = script

            if not winning_script:
                # Select highest-scoring script if ID not found
                winning_script = max(
                    polished,
                    key=lambda s: s.scores.overall if s.scores else 0
                )

            # Mark the winner
            winning_script.is_winner = True
            run.artifacts.final_script = winning_script
            run.artifacts.final_rationale = data.get("selection_rationale", "")
            run.artifacts.production_notes = data.get("production_notes", "")

            # Use the winning script's pre-calculated scores (for backward compatibility)
            if winning_script.scores:
                run.scores = winning_script.scores
            else:
                # Fallback to legacy parsing if no per-script scores
                scores_data = data.get("scores", {})
                run.scores = ScriptScores(
                    overall_impact=float(scores_data.get("overall_impact", scores_data.get("tv_native", 7.0))),
                    hook_power=float(scores_data.get("hook_power", 7.0)),
                    emotional_resonance=float(scores_data.get("emotional_resonance", scores_data.get("emotional_impact", 7.0))),
                    clarity_score=float(scores_data.get("clarity_score", scores_data.get("clarity", 7.0))),
                    distinctiveness=float(scores_data.get("distinctiveness", scores_data.get("originality", 7.0))),
                    brand_integration=float(scores_data.get("brand_integration", scores_data.get("brand_fit", 7.0))),
                    pulse_score=float(scores_data.get("pulse_score", 7.0)),
                    echo_score=float(scores_data.get("echo_score", scores_data.get("memorability", 7.0))),
                    overall=float(scores_data.get("overall", 7.0))
                )

            # Parse citations
            citations_data = data.get("citations", [])
            run.citations = [
                Citation(
                    neighbor_id=c.get("neighbor_id", ""),
                    neighbor_title=c.get("neighbor_title", ""),
                    influence_type=c.get("influence_type", "inspiration"),
                    specific_element=c.get("specific_element", "")
                )
                for c in citations_data
            ]

            return

    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse finalize JSON: %s", str(e))

    # Fallback
    _finalize_fallback(run, polished)


def _finalize_fallback(run, polished: List[PolishedScript]) -> None:
    """Fallback finalization when Gemini is unavailable."""
    # Select highest-scoring script, or first if no scores
    if polished:
        winning_script = max(
            polished,
            key=lambda s: s.scores.overall if s.scores else 0
        )
    else:
        logger.error("No scripts available for fallback finalization")
        return

    # Mark the winner
    for script in polished:
        script.is_winner = False
    winning_script.is_winner = True

    run.artifacts.final_script = winning_script
    run.artifacts.final_rationale = "Selected as the highest-scoring concept based on automated evaluation."
    run.artifacts.production_notes = "Proceed with standard production workflow."

    # Use the winning script's scores if available
    if winning_script.scores:
        run.scores = winning_script.scores
    else:
        run.scores = _default_scores()

    # Build citations from retrieval neighbors
    if run.retrieval.neighbors:
        run.citations = [
            Citation(
                neighbor_id=n.id,
                neighbor_title=n.title,
                influence_type="reference",
                specific_element="Category inspiration"
            )
            for n in run.retrieval.neighbors[:3]
        ]



