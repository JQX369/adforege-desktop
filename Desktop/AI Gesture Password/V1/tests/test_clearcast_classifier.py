import json
import pytest

from app.features.clearcast.clearcast_classifier import (
    ClearcastClassificationResult,
    build_classification_prompt,
    classify_clearcast_context,
)


def test_build_classification_prompt_mentions_all_sections():
    prompt = build_classification_prompt(
        script_text="Kids ask parents to buy a sugary snack with a prize.",
        product_meta={"sector": "Food & Drink", "claims": "sugar-free"},
        brand_meta={"name": "FunSnacks", "tone": "Playful"},
    )
    assert "script_profile" in prompt
    assert "product_profile" in prompt
    assert "brand_profile" in prompt
    assert "sensitive_topics" in prompt


def test_classify_clearcast_context_returns_normalised_result(monkeypatch):
    fake_payload = {
        "script_profile": {
            "primary_claims": ["Sugar-free", "Collectable prize"],
            "tone": "Playful",
            "target_audience": "Family / kids watched with parents",
            "sensitive_topics": ["Children", "Nutrition"],
            "overall_risk": "MEDIUM",
        },
        "product_profile": {
            "sector": "Food & Drink",
            "subcategory": "Snacks",
            "inherent_risk": "Nutrition claims",
            "regulatory_flags": ["High sugar"],
        },
        "brand_profile": {
            "name": "FunSnacks",
            "industry": "CPG",
            "tone": "Playful",
            "clearcast_history": "No prior issues",
        },
        "priority_focus_areas": [
            {"label": "Children", "reason": "Kids directly addressed"},
            {"label": "Claims substantiation", "reason": "Sugar-free statement"},
        ],
        "disclaimers_required": ["Nutrition information", "Adult supervision"],
    }

    class _FakeModel:
        def generate_content(self, prompt):
            class _Resp:
                text = json.dumps(fake_payload)

            self.prompt = prompt
            return _Resp()

    monkeypatch.setattr(
        "app.gemini_utils.create_gemini_model",
        lambda *args, **kwargs: _FakeModel(),
    )

    result = classify_clearcast_context(
        script_text="Kids ask parents to buy a sugary snack with a prize.",
        product_meta={"sector": "Food & Drink"},
        brand_meta={"name": "FunSnacks"},
    )

    assert isinstance(result, ClearcastClassificationResult)
    assert "Sugar-free" in result.script.primary_claims
    assert result.product.sector == "Food & Drink"
    assert result.brand.name == "FunSnacks"
    assert any(area.label == "Children" for area in result.priority_focus_areas)

