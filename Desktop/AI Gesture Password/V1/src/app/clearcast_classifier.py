"""Classification helper for Clearcast context tagging."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from app.config_secure import GOOGLE_API_KEY
except ImportError:
    from app.config import GOOGLE_API_KEY


def _default_key() -> Optional[str]:
    if GOOGLE_API_KEY and GOOGLE_API_KEY != "DEMO_KEY_GET_YOUR_OWN":
        return GOOGLE_API_KEY
    logger.warning("Google API key not configured - Clearcast classification limited")
    return None


@dataclass(frozen=True)
class ScriptProfile:
    primary_claims: List[str] = field(default_factory=list)
    tone: str = ""
    target_audience: str = ""
    sensitive_topics: List[str] = field(default_factory=list)
    overall_risk: str = ""


@dataclass(frozen=True)
class ProductProfile:
    sector: str = ""
    subcategory: str = ""
    inherent_risk: str = ""
    regulatory_flags: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class BrandProfile:
    name: str = ""
    industry: str = ""
    tone: str = ""
    clearcast_history: str = ""


@dataclass(frozen=True)
class FocusArea:
    label: str
    reason: str = ""


@dataclass(frozen=True)
class ClearcastClassificationResult:
    script: ScriptProfile
    product: ProductProfile
    brand: BrandProfile
    priority_focus_areas: List[FocusArea] = field(default_factory=list)
    disclaimers_required: List[str] = field(default_factory=list)


def _coerce_list(value) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return [str(value)]


def build_classification_prompt(
    script_text: str,
    product_meta: Optional[Dict[str, str]] = None,
    brand_meta: Optional[Dict[str, str]] = None,
) -> str:
    """Build a structured classification prompt for Gemini."""
    script_text = (script_text or "").strip()
    product_meta = product_meta or {}
    brand_meta = brand_meta or {}

    product_line = ", ".join(f"{k}: {v}" for k, v in product_meta.items() if v) or "Unknown"
    brand_line = ", ".join(f"{k}: {v}" for k, v in brand_meta.items() if v) or "Unknown"

    return f"""
You are Custom Stories' Clearcast analyst. Classify the advertisement script to highlight
potential compliance focus areas before the full Clearcast review.

SCRIPT:
\"\"\"{script_text}\"\"\"

PRODUCT META: {product_line}
BRAND META: {brand_line}

Return **only** JSON with the following structure:
{{
  "script_profile": {{
    "primary_claims": ["claim", "..."],
    "tone": "Playful / serious / urgent",
    "target_audience": "Who is addressed",
    "sensitive_topics": ["Children", "Health", "Finance", "Alcohol", "Gambling", "Environment"],
    "overall_risk": "LOW" | "MEDIUM" | "HIGH"
  }},
  "product_profile": {{
    "sector": "Food & Drink / Finance / Alcohol / Tech / Charity / Other",
    "subcategory": "Snacks / Credit / Cosmetics / ...",
    "inherent_risk": "Alcohol / Nutrition / Financial claims / Gambling / Kids / None",
    "regulatory_flags": ["Sugar claims", "APR required"]
  }},
  "brand_profile": {{
    "name": "Brand name if known",
    "industry": "Industry/vertical",
    "tone": "Playful / premium / bold",
    "clearcast_history": "Known issues or 'No prior issues'"
  }},
  "priority_focus_areas": [
    {{
      "label": "Children / Claims substantiation / Pricing / Scheduling / Audio / Other",
      "reason": "Why this area matters"
    }}
  ],
  "disclaimers_required": ["APR", "Nutrition info", "Adult supervision"]
}}

Guidelines:
- Use the script content to infer claims, tone, and audience.
- Tie focus areas to Clearcast-relevant rules (children, claims, scheduling, etc.).
- If information is absent, return an empty list or "Unknown".
""".strip()


def classify_clearcast_context(
    script_text: str,
    product_meta: Optional[Dict[str, str]] = None,
    brand_meta: Optional[Dict[str, str]] = None,
) -> ClearcastClassificationResult:
    """Call Gemini to classify script/product/brand context for Clearcast checks."""
    api_key = _default_key()
    model = None
    if api_key:
        from app.gemini_utils import create_gemini_model

        model = create_gemini_model("flash", api_key, fallback_to_pro=True)

    if not model:
        raise RuntimeError("Gemini model unavailable for Clearcast classification.")

    prompt = build_classification_prompt(script_text, product_meta, brand_meta)
    response = model.generate_content(prompt)
    return _parse_classification_response(response.text)


def _parse_classification_response(payload: str) -> ClearcastClassificationResult:
    data = json.loads(payload)
    script_data = data.get("script_profile") or {}
    product_data = data.get("product_profile") or {}
    brand_data = data.get("brand_profile") or {}

    script_profile = ScriptProfile(
        primary_claims=_coerce_list(script_data.get("primary_claims")),
        tone=str(script_data.get("tone", "")),
        target_audience=str(script_data.get("target_audience", "")),
        sensitive_topics=_coerce_list(script_data.get("sensitive_topics")),
        overall_risk=str(script_data.get("overall_risk", "")),
    )

    product_profile = ProductProfile(
        sector=str(product_data.get("sector", "")),
        subcategory=str(product_data.get("subcategory", "")),
        inherent_risk=str(product_data.get("inherent_risk", "")),
        regulatory_flags=_coerce_list(product_data.get("regulatory_flags")),
    )

    brand_profile = BrandProfile(
        name=str(brand_data.get("name", "")),
        industry=str(brand_data.get("industry", "")),
        tone=str(brand_data.get("tone", "")),
        clearcast_history=str(brand_data.get("clearcast_history", "")),
    )

    focus_areas = [
        FocusArea(label=str(area.get("label", "")), reason=str(area.get("reason", "")))
        for area in data.get("priority_focus_areas", []) or []
        if area
    ]

    disclaimers = _coerce_list(data.get("disclaimers_required"))

    return ClearcastClassificationResult(
        script=script_profile,
        product=product_profile,
        brand=brand_profile,
        priority_focus_areas=focus_areas,
        disclaimers_required=disclaimers,
    )


def classification_to_dict(result: ClearcastClassificationResult) -> Dict[str, Any]:
    """Convert a classification result dataclass into a serialisable dict."""
    return asdict(result)


__all__ = [
    "ScriptProfile",
    "ProductProfile",
    "BrandProfile",
    "FocusArea",
    "ClearcastClassificationResult",
    "build_classification_prompt",
    "classify_clearcast_context",
    "classification_to_dict",
]

