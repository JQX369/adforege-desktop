from app.features.ai_breakdown.ai_video_breakdown import AIVideoBreakdown, EXTRACTION_VERSION


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
    # expected_metrics has been removed from schema (deprecated)
    # Now we just check that estimated_outcome exists with core fields
    assert "estimated_outcome" in response
    assert response["estimated_outcome"]["effectiveness_score"] == 0
    assert response["estimated_outcome"]["reasoning"] == "No structured rationale provided"
    # expected_metrics should NOT be present (was deprecated)
    assert "expected_metrics" not in response["estimated_outcome"]
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
    # The system now ensures 12 diverse personas (3 HIGH, 3 LOW, 6 MEDIUM)
    assert len(audience) == 12
    assert any(persona["persona"] == "Gen Z Student" for persona in audience)
    assert any(persona["fit"] == "HIGH" for persona in audience)
    assert any(persona["fit"] == "LOW" for persona in audience)
    assert any(persona["fit"] == "MEDIUM" for persona in audience)


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


def test_prompt_includes_transcript_text_when_provided():
    """Verify that transcript text is injected into the prompt when available."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    # Create a prompt with transcript text
    transcript = "Welcome to our brand new product. Get 50% off today only!"
    prompt = analyzer._create_analysis_prompt(
        video_duration=30,
        script_text=transcript,
    )
    
    # The prompt should include the SCRIPT EXCERPT section with the transcript
    assert "SCRIPT EXCERPT" in prompt
    assert "Welcome to our brand new product" in prompt
    assert "50% off" in prompt


def test_prompt_excludes_script_section_when_no_transcript():
    """Verify that SCRIPT EXCERPT section is absent when no transcript provided."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    # Create a prompt without transcript text
    prompt = analyzer._create_analysis_prompt(
        video_duration=30,
        script_text=None,
    )
    
    # The prompt should NOT include the SCRIPT EXCERPT section
    assert "SCRIPT EXCERPT" not in prompt


def test_prompt_includes_transcript_with_supers_and_country():
    """Verify transcript, supers, and country are all included together."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    prompt = analyzer._create_analysis_prompt(
        video_duration=60,
        script_text="Try our amazing new coffee blend today.",
        supers_texts=["TERMS AND CONDITIONS APPLY", "£4.99 PER MONTH"],
        audience_country="United Kingdom",
    )
    
    # All sections should be present
    assert "SCRIPT EXCERPT" in prompt
    assert "Try our amazing new coffee blend" in prompt
    assert "ON-SCREEN SUPERS" in prompt
    assert "TERMS AND CONDITIONS APPLY" in prompt
    assert "£4.99 PER MONTH" in prompt
    assert "PRIMARY AIRING MARKET: United Kingdom" in prompt


# --- TellyAds schema alignment tests ---

def test_ensure_breakdown_defaults_adds_tellyads_fields():
    """Verify TellyAds-aligned fields are added to breakdown."""
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response(
        """
        {
            "breakdown": {
                "what_is_advertised": "Coffee Machine"
            }
        }
        """
    )
    breakdown = response["breakdown"]
    
    # TellyAds core_metadata fields should be present
    assert "brand_name" in breakdown
    assert "product_name" in breakdown
    assert "product_category" in breakdown
    assert "product_subcategory" in breakdown
    assert "country" in breakdown
    assert "language" in breakdown
    assert "year" in breakdown
    assert isinstance(breakdown["year"], int)


def test_ensure_response_defaults_adds_creative_profile():
    """Verify creative_profile is normalised with TellyAds-aligned fields."""
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response("{}")
    
    creative_profile = response.get("creative_profile")
    assert creative_profile is not None
    assert "format_type" in creative_profile
    assert "objective" in creative_profile
    assert "funnel_stage" in creative_profile
    assert "primary_kpi" in creative_profile
    assert "editing_pace" in creative_profile
    assert "colour_mood" in creative_profile
    assert "music_style" in creative_profile
    assert "overall_structure" in creative_profile


def test_ensure_response_defaults_adds_content_indicators():
    """Verify content_indicators are normalised with TellyAds creative_flags."""
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response("{}")
    
    content_indicators = response.get("content_indicators")
    assert content_indicators is not None
    assert isinstance(content_indicators.get("has_voiceover"), bool)
    assert isinstance(content_indicators.get("has_dialogue"), bool)
    assert isinstance(content_indicators.get("has_on_screen_text"), bool)
    assert isinstance(content_indicators.get("has_supers"), bool)
    assert isinstance(content_indicators.get("has_price_claims"), bool)
    assert isinstance(content_indicators.get("has_risk_disclaimer"), bool)
    assert isinstance(content_indicators.get("has_celeb"), bool)
    assert isinstance(content_indicators.get("has_ugc_style"), bool)


def test_ensure_response_defaults_adds_expanded_impact_scores():
    """Verify impact_scores includes all TellyAds metrics."""
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response("{}")
    
    impact_scores = response.get("impact_scores")
    assert impact_scores is not None
    
    # All 8 TellyAds-aligned metrics should be present
    expected_metrics = [
        "overall_impact", "pulse_score", "echo_score", "hook_power",
        "brand_integration", "emotional_resonance", "clarity_score", "distinctiveness"
    ]
    for metric in expected_metrics:
        assert metric in impact_scores, f"Missing impact metric: {metric}"
        assert isinstance(impact_scores[metric], float), f"{metric} should be a float"
        assert 0.0 <= impact_scores[metric] <= 10.0, f"{metric} should be in 0-10 range"
    
    # Reasoning dict should exist
    assert "reasoning" in impact_scores
    assert isinstance(impact_scores["reasoning"], dict)


def test_ensure_response_defaults_adds_effectiveness_drivers():
    """Verify effectiveness_drivers section is added."""
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response("{}")
    
    effectiveness = response.get("effectiveness_drivers")
    assert effectiveness is not None
    assert "strengths" in effectiveness
    assert "weaknesses" in effectiveness
    assert isinstance(effectiveness["strengths"], list)
    assert isinstance(effectiveness["weaknesses"], list)


def test_ensure_response_defaults_adds_memorable_elements():
    """Verify memorable_elements section is normalised."""
    analyzer = AIVideoBreakdown(api_key="fake")
    response = analyzer._parse_response("{}")
    
    memorable = response.get("memorable_elements")
    assert memorable is not None
    assert "hook" in memorable
    assert "hook_strength" in memorable
    assert "distinctive_assets" in memorable
    assert "emotional_peaks" in memorable
    assert "cta_memorability" in memorable
    assert isinstance(memorable["distinctive_assets"], list)
    assert isinstance(memorable["emotional_peaks"], list)


def test_prompt_includes_expanded_impact_scores_schema():
    """Verify the prompt requests all expanded impact score metrics."""
    analyzer = AIVideoBreakdown(api_key="fake")
    prompt = analyzer._create_analysis_prompt(video_duration=30)
    
    # Check for new TellyAds-aligned impact metrics in the prompt
    assert "hook_power" in prompt
    assert "brand_integration" in prompt
    assert "emotional_resonance" in prompt
    assert "clarity_score" in prompt
    assert "distinctiveness" in prompt


def test_prompt_includes_effectiveness_drivers_schema():
    """Verify the prompt requests effectiveness_drivers section."""
    analyzer = AIVideoBreakdown(api_key="fake")
    prompt = analyzer._create_analysis_prompt(video_duration=30)
    
    assert "effectiveness_drivers" in prompt
    assert "strengths" in prompt
    assert "weaknesses" in prompt


# --- Content indicator heuristics tests ---

def test_heuristics_detects_price_claims_from_transcript():
    """Verify price patterns in transcript trigger has_price_claims."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    # Parse a response without price claims flag
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_price_claims": false
            }
        }
        """,
        script_text="Get our amazing product for only £9.99 per month!",
    )
    
    # Heuristics should have set has_price_claims to True
    assert response["content_indicators"]["has_price_claims"] is True


def test_heuristics_detects_risk_disclaimer_from_transcript():
    """Verify risk/disclaimer patterns trigger has_risk_disclaimer."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_risk_disclaimer": false
            }
        }
        """,
        script_text="Terms and conditions apply. Your home may be at risk.",
    )
    
    assert response["content_indicators"]["has_risk_disclaimer"] is True
    # Should also add a soft risk
    assert len(response["soft_risks"]) > 0


def test_heuristics_detects_supers_from_uppercase_ocr():
    """Verify uppercase OCR text triggers has_supers."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_supers": false
            }
        }
        """,
        supers_texts=["TERMS AND CONDITIONS APPLY SEE WEBSITE FOR DETAILS"],
    )
    
    assert response["content_indicators"]["has_supers"] is True


def test_heuristics_detects_voiceover_from_transcript():
    """Verify transcript presence triggers has_voiceover."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_voiceover": false,
                "has_dialogue": false
            }
        }
        """,
        script_text="Welcome to our brand new product. It's designed to make your life easier. Try it today and see the difference for yourself.",
    )
    
    assert response["content_indicators"]["has_voiceover"] is True


def test_heuristics_detects_on_screen_text_from_supers():
    """Verify OCR supers presence triggers has_on_screen_text."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_on_screen_text": false
            }
        }
        """,
        supers_texts=["Visit our website"],
    )
    
    assert response["content_indicators"]["has_on_screen_text"] is True


def test_heuristics_preserves_existing_true_flags():
    """Verify heuristics don't override already-true flags."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_price_claims": true,
                "has_supers": true,
                "has_voiceover": true
            }
        }
        """,
        script_text="No prices here",
        supers_texts=[],
    )
    
    # Should preserve the true values even without matching patterns
    assert response["content_indicators"]["has_price_claims"] is True
    assert response["content_indicators"]["has_supers"] is True
    assert response["content_indicators"]["has_voiceover"] is True


def test_heuristics_detects_percentage_discount():
    """Verify percentage discount patterns trigger has_price_claims."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_price_claims": false
            }
        }
        """,
        script_text="Save 50% off your first order today!",
    )
    
    assert response["content_indicators"]["has_price_claims"] is True


def test_heuristics_detects_gambling_disclaimer():
    """Verify gambling disclaimer patterns trigger has_risk_disclaimer."""
    analyzer = AIVideoBreakdown(api_key="fake")
    
    response = analyzer._parse_response(
        """
        {
            "content_indicators": {
                "has_risk_disclaimer": false
            }
        }
        """,
        script_text="18+ only. Please gamble responsibly.",
    )
    
    assert response["content_indicators"]["has_risk_disclaimer"] is True


# --- Extraction version tests ---

def test_extraction_version_constant_exists():
    """Verify EXTRACTION_VERSION constant is defined and follows semver format."""
    assert EXTRACTION_VERSION is not None
    assert isinstance(EXTRACTION_VERSION, str)
    # Should be semver-like: X.Y.Z
    parts = EXTRACTION_VERSION.split(".")
    assert len(parts) >= 2, "Version should have at least major.minor"
    assert all(part.isdigit() for part in parts), "Version parts should be numeric"