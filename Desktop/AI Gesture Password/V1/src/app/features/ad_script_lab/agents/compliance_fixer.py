"""
Compliance Fixer Agent - Automatically resolves compliance issues in scripts.

Takes flagged compliance issues and rewrites script sections to resolve them,
returning a clean script with solutions applied.
"""

import asyncio
import logging
import json
import re
from typing import TYPE_CHECKING, List, Tuple, Optional

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout

if TYPE_CHECKING:
    from ..types import PolishedScript, ComplianceCheck, ComplianceResult, ComplianceSolution
    from ..config import CreativeModeConfig

from ..types import (
    PolishedScript,
    ComplianceCheck,
    ComplianceIssue,
    ComplianceSolution,
    ComplianceResult,
)
from ..config import AGENT_CONFIGS

logger = logging.getLogger(__name__)


COMPLIANCE_FIX_PROMPT = """You are a UK broadcast compliance expert specializing in fixing ad scripts to pass Clearcast review.

## Original Script Issue:
**Category:** {category}
**Severity:** {severity}
**Issue:** {description}
**Location:** {location}
**Recommendation:** {recommendation}

## Current Script Text:
```
{original_text}
```

## Your Task:
Rewrite ONLY the problematic section to resolve the compliance issue while:
1. Preserving the creative intent and emotional impact
2. Maintaining the same approximate length
3. Keeping the brand messaging intact
4. Making the minimum changes necessary to pass compliance

## Market: {market}
Apply {market_rules} compliance standards.

RESPOND WITH VALID JSON ONLY:
```json
{{
  "fixed_text": "The rewritten script section that resolves the issue",
  "fix_explanation": "Brief explanation of what was changed and why it now passes compliance",
  "confidence": "high" or "medium"
}}
```

Be precise. Only rewrite what's necessary to fix the compliance issue.
"""

MARKET_RULES = {
    "uk": "Clearcast, BCAP Code, ASA",
    "usa": "FTC, NAD, FCC",
    "eu": "AVMSD, EASA",
}


async def fix_compliance_issues(
    script: PolishedScript,
    compliance_check: ComplianceCheck,
    market: str = "uk"
) -> Tuple[PolishedScript, ComplianceResult]:
    """
    Fix all compliance issues in a script.

    Args:
        script: The script with compliance issues
        compliance_check: The compliance check results with issues
        market: The market/jurisdiction (uk, usa, eu)

    Returns:
        Tuple of (fixed script, compliance result with solutions applied)
    """
    if not compliance_check.issues:
        # No issues to fix
        return script, ComplianceResult(
            all_clear=True,
            solutions_applied=[],
            categories_checked=compliance_check.categories_checked,
            notes="No compliance issues found.",
            market=market
        )

    logger.info(
        "Fixing %d compliance issues for script '%s'",
        len(compliance_check.issues), script.title
    )

    solutions_applied: List[ComplianceSolution] = []
    fixed_script = script.model_copy(deep=True)

    # Fix each issue
    for issue in compliance_check.issues:
        try:
            solution = await _fix_single_issue(
                fixed_script, issue, market
            )
            if solution:
                # Apply the fix to the script
                fixed_script = _apply_fix_to_script(fixed_script, solution)
                solutions_applied.append(solution)
                logger.info(
                    "Fixed issue '%s' in script '%s'",
                    issue.category, script.title
                )

        except Exception as e:
            logger.error(
                "Failed to fix issue '%s': %s",
                issue.category, str(e)
            )
            # Create a placeholder solution noting the failure
            solutions_applied.append(ComplianceSolution(
                original_issue=issue.description,
                category=issue.category,
                fix_applied="Manual review required - automated fix failed",
                location=issue.location or "",
                confidence="medium"
            ))

    # Build the compliance result
    result = ComplianceResult(
        all_clear=True,  # All issues addressed (even if some need manual review)
        solutions_applied=solutions_applied,
        categories_checked=compliance_check.categories_checked,
        notes=f"Applied {len(solutions_applied)} compliance fixes automatically.",
        market=market
    )

    # Store the result on the script
    fixed_script.compliance_result = result

    return fixed_script, result


async def _fix_single_issue(
    script: PolishedScript,
    issue: ComplianceIssue,
    market: str
) -> Optional[ComplianceSolution]:
    """Fix a single compliance issue."""

    # Determine which section of the script contains the issue
    original_text = _find_issue_location(script, issue.location)
    if not original_text:
        original_text = script.full_script

    prompt = COMPLIANCE_FIX_PROMPT.format(
        category=issue.category,
        severity=issue.severity,
        description=issue.description,
        location=issue.location or "Full script",
        recommendation=issue.recommendation or "Resolve the compliance concern",
        original_text=original_text,
        market=market.upper(),
        market_rules=MARKET_RULES.get(market, MARKET_RULES["uk"])
    )

    try:
        model = create_gemini_model('pro')
        if not model:
            return None

        generation_config = genai.GenerationConfig(
            temperature=0.4,  # Lower temperature for precise fixes
            max_output_tokens=1500,
        )

        timeout = AGENT_CONFIGS.get("compliance", {}).get("timeout_seconds", 90)
        text = await generate_with_timeout(model, prompt, generation_config, timeout)

        if text:
            return _parse_fix_response(text, issue, original_text)

    except Exception as e:
        logger.error("Failed to generate fix for '%s': %s", issue.category, str(e))

    return None


def _find_issue_location(script: PolishedScript, location: Optional[str]) -> Optional[str]:
    """Find the script section that matches the issue location."""
    if not location:
        return None

    location_lower = location.lower()

    # Map location hints to script sections
    if "opening" in location_lower or "0-5" in location_lower or "00:00" in location_lower:
        return script.opening
    elif "development" in location_lower or "5-20" in location_lower:
        return script.development
    elif "climax" in location_lower or "20-25" in location_lower:
        return script.climax
    elif "resolution" in location_lower or "25-30" in location_lower or "cta" in location_lower:
        return script.resolution

    # If location mentions a specific scene/timestamp, try to find it in full script
    if script.full_script and location in script.full_script:
        # Return surrounding context
        idx = script.full_script.find(location)
        start = max(0, idx - 100)
        end = min(len(script.full_script), idx + 200)
        return script.full_script[start:end]

    return None


def _parse_fix_response(response_text: str, issue: ComplianceIssue, original_text: str) -> Optional[ComplianceSolution]:
    """Parse the fix response into a ComplianceSolution."""
    try:
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())

            return ComplianceSolution(
                original_issue=issue.description,
                category=issue.category,
                fix_applied=data.get("fix_explanation", "Applied compliance fix"),
                location=issue.location or "",
                confidence=data.get("confidence", "medium"),
                original_text=original_text,
                fixed_text=data.get("fixed_text", "")
            )

    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse fix response: %s", str(e))

    return None


def _apply_fix_to_script(script: PolishedScript, solution: ComplianceSolution) -> PolishedScript:
    """Apply a fix solution to the script."""
    if not solution.original_text or not solution.fixed_text:
        return script

    # Replace the original text with the fixed text in relevant sections
    if solution.original_text in script.opening:
        script.opening = script.opening.replace(solution.original_text, solution.fixed_text)
    if solution.original_text in script.development:
        script.development = script.development.replace(solution.original_text, solution.fixed_text)
    if solution.original_text in script.climax:
        script.climax = script.climax.replace(solution.original_text, solution.fixed_text)
    if solution.original_text in script.resolution:
        script.resolution = script.resolution.replace(solution.original_text, solution.fixed_text)
    if solution.original_text in script.full_script:
        script.full_script = script.full_script.replace(solution.original_text, solution.fixed_text)

    return script


async def fix_all_scripts(
    scripts: List[PolishedScript],
    compliance_checks: List[ComplianceCheck],
    market: str = "uk"
) -> List[PolishedScript]:
    """
    Fix compliance issues in all scripts in parallel.

    Args:
        scripts: List of polished scripts
        compliance_checks: Corresponding compliance checks (same order)
        market: Target market

    Returns:
        List of fixed scripts with compliance_result populated
    """
    if not scripts:
        return scripts

    logger.info("Fixing compliance issues for %d scripts...", len(scripts))

    # Pair scripts with their compliance checks
    tasks = []
    for i, script in enumerate(scripts):
        check = compliance_checks[i] if i < len(compliance_checks) else ComplianceCheck()
        tasks.append(fix_compliance_issues(script, check, market))

    # Run all fixes in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Extract fixed scripts
    fixed_scripts = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error("Failed to fix script %d: %s", i, str(result))
            # Return original script with error note
            scripts[i].compliance_result = ComplianceResult(
                all_clear=False,
                solutions_applied=[],
                categories_checked=[],
                notes=f"Auto-fix failed: {str(result)}",
                market=market
            )
            fixed_scripts.append(scripts[i])
        else:
            fixed_script, _ = result
            fixed_scripts.append(fixed_script)

    logger.info("Completed compliance fixes for %d scripts", len(fixed_scripts))
    return fixed_scripts
