"""Prompt construction helpers for Clearcast analysis."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .clearcast_rules import ClearcastRulesSnapshot


@dataclass
class PromptContext:
    """Metadata we can feed into the Clearcast prompt."""

    script_excerpt: Optional[str] = None
    product_notes: Dict[str, str] = field(default_factory=dict)
    brand_notes: Dict[str, str] = field(default_factory=dict)
    verbose_reasoning: bool = False
    extra_notes: List[str] = field(default_factory=list)


def _summarize_rules(snapshot: ClearcastRulesSnapshot, limit: int = 12) -> List[Dict[str, str]]:
    """Return a trimmed, serialisable summary of rules to feed the model."""
    summary = []
    for rule in snapshot.rules[:limit]:
        summary.append(
            {
                "code": rule.code,
                "title": rule.title,
                "category": rule.category,
                "summary": rule.summary,
                "severity": rule.severity,
                "prohibited_or_conditional": rule.prohibited_or_conditional,
                "tags": rule.tags,
            }
        )
    return summary


def build_clearcast_prompt(
    snapshot: Optional[ClearcastRulesSnapshot], context: PromptContext
) -> str:
    """Assemble the base system prompt for Clearcast analysis."""
    if snapshot:
        rules_serialised = json.dumps(
            {
                "version_id": snapshot.version_id,
                "last_checked": snapshot.last_checked,
                "rules": _summarize_rules(snapshot),
            },
            indent=2,
        )
    else:
        rules_serialised = "[]"

    meta_sections: List[str] = []
    if context.script_excerpt:
        meta_sections.append(f"Script excerpt to prioritise:\n{context.script_excerpt.strip()}")
    if context.product_notes:
        meta_sections.append(
            "Product notes:\n"
            + ", ".join(f"{k}: {v}" for k, v in context.product_notes.items() if v)
        )
    if context.brand_notes:
        meta_sections.append(
            "Brand notes:\n"
            + ", ".join(f"{k}: {v}" for k, v in context.brand_notes.items() if v)
        )

    reasoning_instructions = (
        "Include an `internal_reasoning` field containing a concise chain-of-thought justification. "
        "This reasoning is for internal debugging only. Do not include the raw reasoning in user-facing output; "
        "only cite the relevant guideline codes in the summary/recommendations."
        if context.verbose_reasoning
        else "Do **not** include any chain-of-thought text unless explicitly requested."
    )

    if context.extra_notes:
        meta_sections.extend(context.extra_notes)

    sections_block = "\n\n".join(meta_sections) if meta_sections else "Use the video frames + audio."
    reasoning_field = (
        '  "internal_reasoning": "Chain-of-thought text for debugging",\n'
        if context.verbose_reasoning
        else ""
    )

    prompt = f"""
You are Custom Stories' Clearcast compliance specialist. You understand BCAP and CAP TV rules.
You will receive key video frames separately plus optional script/product notes. Use them with
the structured rule snapshot below to produce a practical compliance report.

Structured Clearcast snapshot (JSON):
{rules_serialised}

Context for this ad:
{sections_block}

Respond ONLY with JSON in the following structure:
{{
  "compliance_status": "PASS" | "REVIEW_NEEDED" | "FAIL",
  "overall_risk": "LOW" | "MEDIUM" | "HIGH",
  "clearance_prediction": "Will likely clear" | "Needs modifications" | "Unlikely to clear",
  "summary": "2 sentence overview referencing guideline codes",
  "risks": [
    {{
      "issue": "Short description",
      "risk_level": "LOW" | "MEDIUM" | "HIGH",
      "guideline_code": "BCAP 3.1",
      "guideline_title": "Misleading advertising",
      "category": "Misleading Claims",
      "timestamp": "00:12-00:18",
      "evidence_text": "Direct quote or frame description proving the issue",
      "evidence_source": "Transcript 00:10-00:14 | Frame 3",
      "description": "Longer explanation",
      "required_action": "Specific fix to pass",
      "citations": ["BCAP 3.1"]
    }}
  ],
  "technical_checks": [
    {{
      "issue": "Audio too hot",
      "risk_level": "LOW" | "MEDIUM" | "HIGH",
      "category": "Sound Quality" | "Format Standards" | "Visual Quality",
      "timestamp": "00:00-00:30",
      "evidence_text": "Measurement (e.g., '-19 LUFS, peaks at -0.5 dBFS')",
      "evidence_source": "Audio analysis / Frame reference",
      "fix_required": true
    }}
  ],
  "compliant_elements": ["Positives worth keeping"],
  "recommendations": ["Ranked list of actions"],
{reasoning_field}  "citations": ["BCAP 3.1", "BCAP 5.2"]
}}

Requirements:
- Reference the rule snapshot codes/titles when flagging issues.
- Cite timestamps based on the provided frame labels (e.g., "00:12").
- For every risk and technical issue, include `evidence_text` quoting the exact script line, narration, or frame content plus an `evidence_source` such as "Transcript 00:10-00:14" or "Frame 3 (00:05)".
- Separate high/medium risk content issues from technical/broadcast issues.
- Provide practical fixes aligned with Clearcast expectations.
- Use probabilistic language for substantiation requirements (e.g., "Likely requires", "May need") unless the rule is absolute.
- {reasoning_instructions.strip()}

If a field has no data, return an empty list (`[]`) or omit it.
"""

    return prompt.strip()


__all__ = ["PromptContext", "build_clearcast_prompt"]

