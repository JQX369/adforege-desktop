from app.ai_video_breakdown import AIVideoBreakdown


def test_prompt_includes_identification_confidence_fields():
    analyzer = AIVideoBreakdown(api_key="fake")
    prompt = analyzer._create_analysis_prompt(video_duration=30)
    assert '"identification_confidence"' in prompt
    assert '"possible_alternatives"' in prompt
    assert '"score_rationale"' in prompt
    assert '"cta_clarity"' in prompt
    assert '"soft_risks"' in prompt
    assert '"one_sentence_summary"' in prompt
    assert '"gender"' in prompt
    assert '"race_ethnicity"' in prompt
    assert '"fit": "HIGH"' in prompt


def test_parse_response_adds_confidence_defaults_when_missing():
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response(
        """
        {
            "breakdown": {
                "what_is_advertised": "Coffee Pods"
            }
        }
        """
    )
    breakdown = response["breakdown"]
    assert breakdown["identification_confidence"] == 0
    assert breakdown["possible_alternatives"] == []
    assert breakdown["cta_clarity"] == "Unknown"
    assert breakdown["suggested_improved_cta"] == ""
    assert response["soft_risks"] == []
    assert response["one_sentence_summary"] == ""
    assert response["estimated_outcome"]["score_rationale"] == []


def test_parse_response_injects_other_defaults(caplog):
    analyzer = AIVideoBreakdown(api_key="fake")
    with caplog.at_level("WARNING"):
        response = analyzer._parse_response("{}")
    assert response["estimated_outcome"]["expected_metrics"]["engagement_rate"] == "Unknown"
    assert response["green_highlights"] == []
    assert "AI breakdown missing fields" in caplog.text


def test_parse_response_normalises_audience_reactions():
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response(
        """
        {
            "audience_reactions": [
                {
                    "persona": "Gen Z Student",
                    "reaction": "Feels authentic."
                }
            ]
        }
        """
    )
    audience = response["audience_reactions"]
    assert len(audience) == 4
    assert any(persona["persona"] == "Gen Z Student" for persona in audience)
    assert any(persona["fit"] == "HIGH" for persona in audience)
    assert any(persona["fit"] == "LOW" for persona in audience)


def test_prompt_includes_script_and_supers_sections():
    analyzer = AIVideoBreakdown(api_key="fake")
    prompt = analyzer._create_analysis_prompt(
        video_duration=45,
        script_text="This is the opening line. Bold promise here.",
        supers_texts=["NO PURCHASE NECESSARY", "Terms apply"],
        audience_country="Spain",
    )
    assert "SCRIPT EXCERPT" in prompt
    assert "ON-SCREEN SUPERS" in prompt
    assert "PRIMARY AIRING MARKET: Spain" in prompt


def test_parse_response_dedupes_yellow_highlights():
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response(
        """
        {
            "yellow_highlights": [
                {
                    "aspect": "Call to Action",
                    "suggestion": "Improve CTA copy"
                },
                {
                    "aspect": "call to action",
                    "suggestion": "Add stronger urgency"
                }
            ]
        }
        """
    )
    highlights = response["yellow_highlights"]
    assert len(highlights) == 1
    assert highlights[0]["aspect"].lower() == "call to action"

