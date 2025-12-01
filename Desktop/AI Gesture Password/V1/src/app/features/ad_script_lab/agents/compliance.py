"""
Compliance Agent - Checks scripts against broadcast regulations by jurisdiction.

Performs compliance checking based on the target market:
- UK: Clearcast/BCAP/Ofcom/ASA rules
- USA: FCC/NAD/FTC guidelines  
- EU: EASA/national advertising codes
"""

import asyncio
import logging
import json
import re
from typing import TYPE_CHECKING, List, Dict

import google.generativeai as genai
from app.core.gemini_utils import create_gemini_model, generate_with_timeout

if TYPE_CHECKING:
    from ..types import AdScriptRun, ComplianceCheck
    from ..config import CreativeModeConfig

from ..types import ComplianceCheck
from ..config import AGENT_CONFIGS

logger = logging.getLogger(__name__)


# Jurisdiction-specific compliance configurations
JURISDICTION_CONFIG = {
    "uk": {
        "name": "United Kingdom",
        "bodies": ["Clearcast", "BCAP", "Ofcom", "ASA"],
        "primary_code": "BCAP Code",
        "clearance_body": "Clearcast",
        "notes_field": "clearcast_notes"
    },
    "usa": {
        "name": "United States",
        "bodies": ["FCC", "NAD", "FTC"],
        "primary_code": "FTC Guidelines",
        "clearance_body": "Network Standards & Practices",
        "notes_field": "fcc_notes"
    },
    "eu": {
        "name": "European Union",
        "bodies": ["EASA", "National ASAs"],
        "primary_code": "AVMSD / EASA Guidelines",
        "clearance_body": "National Clearance Body",
        "notes_field": "easa_notes"
    }
}


COMPLIANCE_PROMPT_UK = """You are a Clearcast compliance expert reviewing a TV ad script for UK broadcast.

## Brief Context:
- Brand: {brand_name}
- Product/Service: {product_service}
- Target Audience: {target_audience}
- Compliance Requirements: {compliance_requirements}
- Mandatories: {mandatories}

## Script to Review:
**{script_title}**

{full_script}

---

Review this script against UK TV advertising regulations:

1. **BCAP Code Compliance**: Does it meet the British Code of Advertising Practice?
2. **Clearcast Requirements**: Would this pass Clearcast pre-clearance?
3. **Ofcom Rules**: Any potential broadcast standards issues?
4. **ASA Guidelines**: Could this attract complaints to the Advertising Standards Authority?

Check specifically for:
- Misleading claims requiring substantiation
- Inappropriate content for the target audience
- Comparative advertising issues
- Health/medical claims
- Financial promotions compliance
- Alcohol/gambling restrictions (if applicable)
- Child safety (if applicable)
- Environmental claims (greenwashing)

**Evidence Requirements**: For any claims identified, specify what substantiation would be needed for Clearcast approval.

RESPOND WITH VALID JSON ONLY:
```json
{{
  "passed": true,
  "risk_level": "low",
  "issues": [
    {{
      "category": "claims",
      "severity": "medium",
      "description": "The claim 'best in class' requires substantiation",
      "location": "Scene 2, 00:08",
      "recommendation": "Add disclaimer or modify to 'one of the leading...'",
      "evidence_required": "Independent testing data or market share statistics"
    }}
  ],
  "recommendations": [
    "General recommendation for compliance",
    "Another recommendation"
  ],
  "categories_checked": ["BCAP", "Clearcast", "Ofcom", "ASA"],
  "clearcast_notes": "Summary of likely Clearcast feedback",
  "evidence_summary": "Summary of all evidence/substantiation that would be required"
}}
```

Risk levels: "low" (minor issues), "medium" (needs attention), "high" (likely rejection)
"""


COMPLIANCE_PROMPT_USA = """You are a US broadcast compliance expert reviewing a TV ad script for American television.

## Brief Context:
- Brand: {brand_name}
- Product/Service: {product_service}
- Target Audience: {target_audience}
- Compliance Requirements: {compliance_requirements}
- Mandatories: {mandatories}

## Script to Review:
**{script_title}**

{full_script}

---

Review this script against US TV advertising regulations:

1. **FTC Act Compliance**: Does it meet Federal Trade Commission advertising guidelines?
2. **NAD Guidelines**: Would this pass National Advertising Division review?
3. **FCC Rules**: Any broadcast standards issues (decency, political advertising)?
4. **Network Standards**: Would major networks (ABC, NBC, CBS, Fox) likely accept this?

Check specifically for:
- Deceptive advertising claims (FTC Section 5)
- Substantiation requirements for claims
- Testimonials and endorsements (FTC Guides)
- "Made in USA" or origin claims
- Children's advertising (COPPA, CARU)
- Health claims (FDA coordination)
- Financial services disclosures
- Alcohol/tobacco restrictions
- Comparative advertising (Lanham Act considerations)

**Evidence Requirements**: For any claims identified, specify what substantiation would be needed.

RESPOND WITH VALID JSON ONLY:
```json
{{
  "passed": true,
  "risk_level": "low",
  "issues": [
    {{
      "category": "claims",
      "severity": "medium",
      "description": "The claim 'America's favorite' requires substantiation",
      "location": "Scene 2, 00:08",
      "recommendation": "Add disclaimer or provide survey data substantiation",
      "evidence_required": "National survey data from reputable research firm"
    }}
  ],
  "recommendations": [
    "General recommendation for compliance",
    "Another recommendation"
  ],
  "categories_checked": ["FTC", "NAD", "FCC", "Network S&P"],
  "fcc_notes": "Summary of likely network standards feedback",
  "evidence_summary": "Summary of all evidence/substantiation that would be required"
}}
```

Risk levels: "low" (minor issues), "medium" (needs attention), "high" (likely rejection by networks)
"""


COMPLIANCE_PROMPT_EU = """You are an EU advertising compliance expert reviewing a TV ad script for European broadcast.

## Brief Context:
- Brand: {brand_name}
- Product/Service: {product_service}
- Target Audience: {target_audience}
- Compliance Requirements: {compliance_requirements}
- Mandatories: {mandatories}

## Script to Review:
**{script_title}**

{full_script}

---

Review this script against European TV advertising regulations:

1. **AVMSD Compliance**: Does it meet Audiovisual Media Services Directive requirements?
2. **EASA Guidelines**: European Advertising Standards Alliance best practices?
3. **National Codes**: Key considerations for major EU markets (Germany, France, Spain, Italy)?
4. **GDPR Implications**: Any data/privacy messaging concerns?

Check specifically for:
- Misleading commercial practices (Unfair Commercial Practices Directive)
- Comparative advertising (Directive 2006/114/EC)
- Health and nutrition claims (EU Regulation 1924/2006)
- Environmental claims (Green Claims Directive considerations)
- Children's advertising (various national restrictions)
- Alcohol advertising (varying by member state)
- Financial services (MiFID II, IDD considerations)
- Cross-border advertising considerations

**Evidence Requirements**: For any claims identified, specify what substantiation would be needed for EU-wide compliance.

RESPOND WITH VALID JSON ONLY:
```json
{{
  "passed": true,
  "risk_level": "low",
  "issues": [
    {{
      "category": "claims",
      "severity": "medium",
      "description": "The health claim requires EFSA authorization",
      "location": "Scene 2, 00:08",
      "recommendation": "Use only EU-authorized health claims from the register",
      "evidence_required": "EFSA authorized claim reference or clinical study data"
    }}
  ],
  "recommendations": [
    "General recommendation for compliance",
    "Another recommendation"
  ],
  "categories_checked": ["AVMSD", "EASA", "National ASAs"],
  "easa_notes": "Summary of key EU compliance considerations",
  "evidence_summary": "Summary of all evidence/substantiation that would be required",
  "country_specific_notes": {{
    "germany": "Note for German-specific rules if applicable",
    "france": "Note for French-specific rules if applicable"
  }}
}}
```

Risk levels: "low" (minor issues), "medium" (needs attention in some markets), "high" (likely rejection in major markets)
"""


def get_compliance_prompt(market: str) -> str:
    """Get the appropriate compliance prompt for the market."""
    market_lower = (market or "uk").lower()
    if market_lower == "usa":
        return COMPLIANCE_PROMPT_USA
    elif market_lower == "eu":
        return COMPLIANCE_PROMPT_EU
    else:
        return COMPLIANCE_PROMPT_UK


async def run_compliance(
    run: "AdScriptRun",
    config: "CreativeModeConfig"
) -> None:
    """
    Check polished scripts for UK broadcast compliance.
    
    Checks are run in parallel for better performance.
    """
    polished = run.artifacts.polished_3
    brief = run.brief
    
    if not polished:
        logger.warning("No polished scripts to check")
        return
    
    # Run all compliance checks in parallel for better performance
    async def _safe_check(script):
        """Wrapper to catch exceptions per-script."""
        try:
            return await _check_script_compliance(brief, script, config)
        except Exception as e:
            logger.error(
                "Failed compliance check for '%s': %s",
                script.title, str(e)
            )
            return ComplianceCheck(
                passed=False,
                risk_level="medium",
                issues=[{
                    "category": "review",
                    "severity": "medium",
                    "description": f"Automated check failed: {str(e)}",
                    "recommendation": "Manual review required"
                }],
                recommendations=["Manual compliance review needed"],
                categories_checked=["BCAP"],
                clearcast_notes="Automated review unavailable"
            )
    
    tasks = [_safe_check(script) for script in polished]
    compliance_checks = await asyncio.gather(*tasks)
    
    run.artifacts.compliance_checks = list(compliance_checks)
    logger.info("Completed %d compliance checks in parallel", len(compliance_checks))


async def _check_script_compliance(brief, script, config) -> ComplianceCheck:
    """Check a single script for compliance based on market jurisdiction."""
    
    # Get market from brief (default to UK)
    market = getattr(brief, 'market', 'uk') or 'uk'
    market_lower = market.lower()
    jurisdiction = JURISDICTION_CONFIG.get(market_lower, JURISDICTION_CONFIG["uk"])
    
    # Determine strictness based on config
    strictness = config.compliance_strictness
    
    # Get the jurisdiction-specific prompt
    prompt_template = get_compliance_prompt(market)
    
    prompt = prompt_template.format(
        brand_name=brief.brand_name or "[Brand]",
        product_service=brief.product_service or "[Product/Service]",
        target_audience=brief.target_audience,
        compliance_requirements=brief.compliance_requirements,
        mandatories=", ".join(brief.mandatories) if brief.mandatories else "None specified",
        script_title=script.title,
        full_script=script.full_script or f"""
Opening: {script.opening}
Development: {script.development}
Climax: {script.climax}
Resolution: {script.resolution}
        """.strip()
    )
    
    # Add strictness modifier
    if strictness == "strict":
        prompt += f"\n\nApply STRICT interpretation of all {jurisdiction['name']} regulations. Flag any potential issues."
    elif strictness == "lenient":
        prompt += f"\n\nApply reasonable interpretation of {jurisdiction['name']} regulations. Only flag clear violations."
    
    model = create_gemini_model('pro')
    if not model:
        return ComplianceCheck(
            passed=True,
            risk_level="medium",
            issues=[],
            recommendations=[f"Manual {jurisdiction['clearance_body']} review recommended - automated check unavailable"],
            categories_checked=jurisdiction["bodies"][:1],
            clearcast_notes=f"Gemini API unavailable for automated {jurisdiction['name']} compliance review"
        )
    
    generation_config = genai.GenerationConfig(
        temperature=config.temperature_analysis,
        max_output_tokens=2500,
    )
    
    # Use timeout-wrapped async call to prevent indefinite hangs
    timeout = AGENT_CONFIGS["compliance"]["timeout_seconds"]
    text = await generate_with_timeout(model, prompt, generation_config, timeout)
    
    if text:
        return _parse_compliance_response(text, market_lower)
    
    return ComplianceCheck(
        passed=True,
        risk_level="low",
        categories_checked=jurisdiction["bodies"],
        clearcast_notes=f"No issues detected for {jurisdiction['name']} compliance (empty or blocked response)"
    )


def _parse_compliance_response(response_text: str, market: str = "uk") -> ComplianceCheck:
    """Parse compliance response into ComplianceCheck object."""
    jurisdiction = JURISDICTION_CONFIG.get(market, JURISDICTION_CONFIG["uk"])
    default_bodies = jurisdiction["bodies"]
    notes_field = jurisdiction["notes_field"]
    
    try:
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())
            
            # Get the notes from the jurisdiction-specific field, or fall back to clearcast_notes
            notes = data.get(notes_field, data.get("clearcast_notes", ""))
            
            # Also capture evidence summary if present
            evidence_summary = data.get("evidence_summary", "")
            if evidence_summary and notes:
                notes = f"{notes}\n\n**Evidence Required:**\n{evidence_summary}"
            elif evidence_summary:
                notes = f"**Evidence Required:**\n{evidence_summary}"
            
            return ComplianceCheck(
                passed=bool(data.get("passed", True)),
                risk_level=data.get("risk_level", "low"),
                issues=data.get("issues", []),
                recommendations=data.get("recommendations", []),
                categories_checked=data.get("categories_checked", default_bodies),
                clearcast_notes=notes
            )
            
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse compliance JSON: %s", str(e))
    
    # Fallback - assume passed with notes
    return ComplianceCheck(
        passed=True,
        risk_level="low",
        issues=[],
        recommendations=[],
        categories_checked=default_bodies,
        clearcast_notes=response_text[:500]
    )



