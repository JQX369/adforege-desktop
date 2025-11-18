import json
from pathlib import Path
from types import SimpleNamespace

from app.clearcast_checker import ClearcastChecker
from app.clearcast_classifier import (
    BrandProfile,
    ClearcastClassificationResult,
    FocusArea,
    ProductProfile,
    ScriptProfile,
)
from app.clearcast_audio import AudioNormalizationReport


class _FakeModel:
    def __init__(self, payload: dict):
        self._payload = payload

    def generate_content(self, prompt_parts):
        class Response:
            text = json.dumps(self._payload)

        return Response()


def _fake_response():
    return {
        "compliance_status": "REVIEW_NEEDED",
        "overall_risk": "MEDIUM",
        "summary": "Children targeted without adult framing.",
        "risks": [
            {
                "issue": "Children directly encouraged to buy",
                "risk_level": "HIGH",
                "guideline_code": "BCAP 5.2",
                "guideline_title": "Children: pressure to purchase",
                "category": "Children",
                "timestamp": "00:05-00:10",
                "required_action": "Ensure adult decision maker is shown",
                "citations": ["BCAP 5.2"],
            }
        ],
        "technical_checks": [
            {
                "issue": "Frame rate is 30fps instead of 25fps",
                "risk_level": "MEDIUM",
                "category": "Format Standards",
                "timestamp": "Full video",
                "fix_required": True,
            }
        ],
        "recommendations": ["Add adult supervision disclaimer"],
    }


def _fake_classification():
    return ClearcastClassificationResult(
        script=ScriptProfile(
            primary_claims=["Collect the full set"],
            tone="Playful",
            target_audience="Families with kids",
            sensitive_topics=["Children"],
            overall_risk="MEDIUM",
        ),
        product=ProductProfile(
            sector="Food & Drink",
            subcategory="Snacks",
            inherent_risk="Nutrition claims",
            regulatory_flags=["High sugar"],
        ),
        brand=BrandProfile(
            name="FunSnacks",
            industry="CPG",
            tone="Playful",
            clearcast_history="No prior issues",
        ),
        priority_focus_areas=[FocusArea(label="Children", reason="Kids addressed directly")],
        disclaimers_required=["Include nutrition disclaimer"],
    )


def test_clearcast_checker_end_to_end(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.gemini_utils.create_gemini_model",
        lambda *args, **kwargs: _FakeModel(_fake_response()),
    )
    monkeypatch.setattr(
        "app.clearcast_checker.classify_clearcast_context",
        lambda *args, **kwargs: _fake_classification(),
    )
    monkeypatch.setattr(
        "app.clearcast_checker.ClearcastAudioAnalyzer.analyze",
        lambda self, path: AudioNormalizationReport(
            status="needs_normalization",
            recommendation="Normalize to -23 LUFS.",
            integrated_lufs=-19.5,
            true_peak=-0.5,
            loudness_range=8.0,
        ),
    )
    monkeypatch.setattr(
        ClearcastChecker,
        "_extract_key_frames",
        lambda self, video_path, num_frames=5: ["frame1", "frame2"],
    )

    video_path = tmp_path / "fake.mp4"
    video_path.write_bytes(b"\x00\x00")

    checker = ClearcastChecker()
    checker.rules_snapshot = SimpleNamespace(
        version_id="test-snapshot", last_checked="now", rules=[]
    )
    result = checker.check_video_compliance(
        str(video_path),
        script_excerpt="Kids ask parents for snacks",
        product_notes={"sector": "Food & Drink"},
        brand_notes={"brand_name": "FunSnacks"},
    )

    assert result["compliance_status"] == "REVIEW_NEEDED"
    assert result["classification"]["script"]["primary_claims"][0] == "Collect the full set"
    assert result["classification_focus"][0]["label"] == "Children"
    assert result["audio_normalization"]["status"] == "needs_normalization"
    assert any(
        "Audio loudness" in flag.get("issue", "") for flag in result["blue_flags"]
    )
    assert result["rules_snapshot"]

