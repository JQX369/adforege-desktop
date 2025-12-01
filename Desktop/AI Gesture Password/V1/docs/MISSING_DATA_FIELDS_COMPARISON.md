# Missing Data Fields Comparison

## Overview
This document compares the TellyAds ingestion format (example: `TA10081_Xbox_360_complete.json`) with what's currently being collected in the system.

## Currently Collected Fields (from AI Breakdown)

Based on `ai_video_breakdown.py` and `video_storage.py`, the system currently collects:

### Basic Metadata
- `brand_name`
- `product_name` (mapped from `specific_product`)
- `product_category`
- `product_subcategory`
- `country`
- `language`
- `year`
- `duration_seconds` (from video analysis)

### Creative Profile (partial)
- `format_type`
- `editing_pace`
- `colour_mood`
- `music_style`
- `overall_structure`
- `objective`
- `funnel_stage`
- `primary_kpi`

### Content Indicators (partial)
- `has_voiceover`
- `has_dialogue`
- `has_on_screen_text`
- `has_supers`
- `has_price_claims`
- `has_risk_disclaimer`
- `has_celeb`
- `has_ugc_style`

### Impact Scores
- `overall_impact`
- `pulse_score`
- `echo_score`
- `hook_power`
- `brand_integration`
- `emotional_resonance`
- `clarity_score`
- `distinctiveness`

### Breakdown Data
- `what_is_advertised`
- `target_audience`
- `call_to_action`
- `key_elements`
- `key_messages`
- `narrative_structure`
- `cta_clarity`
- `suggested_improved_cta`

---

## MISSING FIELDS from TellyAds Format

### 1. Video Technical Metadata
- ❌ `external_id` - External identifier (e.g., "TA10081")
- ❌ `s3_key` - S3 storage key for video file
- ❌ `width` - Video width in pixels
- ❌ `height` - Video height in pixels
- ❌ `aspect_ratio` - Aspect ratio string (e.g., "400:300")
- ❌ `fps` - Frames per second
- ❌ `video_url` - Public URL to video file (CloudFront URL)
- ❌ `region` - Geographic region (currently only `country`)

### 2. Campaign Strategy Fields
- ❌ `primary_setting` - Primary setting/location type (e.g., "mixed", "urban", "studio")
- ❌ `regulator_sensitive` - Boolean flag for regulatory sensitivity

### 3. Performance Metrics
- ❌ `performance_metrics` object:
  - `views` - View count
  - `date_collected` - Date metrics were collected
  - `latest_ads_path` - Path reference
  - `legacy_record_id` - Legacy system ID

### 4. Hero Analysis (Deep Creative Analysis)
- ❌ `hero_analysis` object:
  - `audio_profile`:
    - `music_mood` - Detailed mood description
    - `music_style` - Specific style (e.g., "orchestral_cinematic")
    - `vocal_profile` - Detailed voiceover analysis
    - `music_brand_fit` - How music fits brand
    - `notable_sound_design` - Array of notable sound effects
  - `emotional_arc` - Array of emotional moments with:
    - `emotion` - Emotion name
    - `time_window` - Time range (e.g., "0-5s")
    - `tension_curve` - Tension progression
    - `emotional_hook` - Description of emotional moment
  - `overall_score` - Overall hero analysis score
  - `cinematography`:
    - `colour_palette` - Array of dominant colors
    - `lighting_style` - Detailed lighting description
    - `shot_breakdown` - Array of shot-by-shot analysis with:
      - `pacing` - Shot pacing
      - `composition` - Composition description
      - `time_window` - Time range
      - `transitions` - Array of transition types
      - `camera_moves` - Array of camera movement types
    - `production_quality` - Quality assessment
    - `notable_transitions` - Array of notable transitions
  - `visual_patterns`:
    - `packshots` - Array of packshot moments
    - `logo_usage` - Logo usage style
    - `recurring_motifs` - Array of visual motifs
    - `hero_product_framing` - Product framing style
    - `distinctive_visual_style` - Style description
  - `creative_tactics`:
    - `hook_type` - Hook classification
    - `cta_framing` - CTA framing style
    - `pattern_breaks` - Array of pattern-breaking moments
    - `brand_reveal_style` - Brand reveal approach
    - `persuasion_techniques` - Array of techniques used
    - `humour_or_drama_devices` - Array of devices
  - `effectiveness_drivers`:
    - `brand_linkage` - Linkage strength
    - `primary_strength` - Main strength description
    - `memorable_moments` - Array of memorable moments
    - `target_audience_fit` - Audience fit description

### 5. Raw Transcript Structure
- ❌ `raw_transcript` object:
  - `text` - Full transcript text
  - `segments` - Array with:
    - `start` - Start time
    - `end` - End time
    - `text` - Segment text

### 6. Analysis JSON (Comprehensive Analysis)
- ❌ `analysis_json` object containing:
  - `claims` - Array of claims with:
    - `text` - Claim text
    - `delivery` - Delivery method (spoken/written)
    - `claim_type` - Type of claim
    - `risk_level` - Risk assessment
    - `timestamp_s` - Timestamp
    - `is_comparative` - Comparative flag
    - `is_superlative` - Superlative flag
    - `suggested_qualifier` - Suggested qualifier text
    - `likely_needs_substantiation` - Substantiation flag
  - `supers` - Array of super text elements
  - `raw_data`:
    - `full_transcript` - Full transcript string
    - `all_on_screen_text` - Array of on-screen text
    - `frame_descriptions` - Array of frame descriptions
  - `segments` - AIDA segments with:
    - `segment_index` - Index number
    - `segment_type` - Type (hook/setup/cta)
    - `aida_stage` - AIDA stage
    - `start_s` - Start time
    - `end_s` - End time
    - `duration_s` - Duration
    - `purpose` - Purpose description
    - `visual_summary` - Visual summary
    - `dominant_emotion` - Dominant emotion
    - `transcript_excerpt` - Transcript excerpt
  - `cta_offer`:
    - `has_cta` - CTA present flag
    - `cta_text` - CTA text
    - `cta_type` - CTA type
    - `has_offer` - Offer present flag
    - `price_shown` - Price information
    - `urgency_type` - Urgency type
    - `offer_summary` - Offer summary
    - `terms_visible` - Terms visibility
    - `cta_duration_s` - CTA duration
    - `cta_prominence` - CTA prominence
    - `cta_timestamp_s` - CTA timestamp
    - `endcard_present` - Endcard flag
    - `endcard_start_s` - Endcard start time
    - `urgency_present` - Urgency flag
    - `endcard_elements` - Array of endcard elements
    - `deadline_mentioned` - Deadline mention
    - `endcard_duration_s` - Endcard duration
  - `characters` - Array of character descriptions
  - `storyboard` - Array of storyboard shots with:
    - `shot_index` - Shot index
    - `start_s` - Start time
    - `end_s` - End time
    - `duration_s` - Duration
    - `action` - Action description
    - `location` - Location
    - `shot_type` - Shot type
    - `key_subjects` - Array of subjects
    - `audio_element` - Audio element type
    - `on_screen_text` - On-screen text
    - `transition_out` - Transition type
    - `camera_movement` - Camera movement
    - `mood` - Mood description
    - `lighting` - Lighting description
  - `creative_dna`:
    - `archetype` - Creative archetype
    - `hook_type` - Hook type
    - `pacing_notes` - Pacing description
    - `persuasion_devices` - Array of devices
    - `narrative_structure` - Structure type
    - `distinctive_creative_choices` - Array of choices
  - `memorability`:
    - `memorable_elements` - Array with:
      - `element` - Element description
      - `brand_linked` - Brand linkage flag
      - `memorability_score` - Score
    - `predicted_recall_7d` - 7-day recall prediction
    - `predicted_recall_24h` - 24-hour recall prediction
    - `overall_memorability_score` - Overall score
    - `distinctiveness_vs_category` - Distinctiveness score
    - `potential_for_cultural_impact` - Impact potential
    - `forgettable_elements` - Array of forgettable elements
  - `brain_balance`:
    - `balance_type` - Balance type
    - `rational_elements` - Object with boolean flags
    - `emotional_elements` - Object with boolean flags
    - `rational_appeal_score` - Rational score
    - `emotional_appeal_score` - Emotional score
  - `core_metadata` - Duplicate of top-level metadata
  - `impact_scores` - Expanded impact scores with:
    - `confidence` - Confidence level
    - `evidence` - Evidence text
    - `description` - Score description
    - `main_message` - Main message (for clarity_score)
    - `hook_technique` - Hook technique (for hook_power)
    - `distinctive_elements` - Array (for distinctiveness)
    - `integration_style` - Integration style (for brand_integration)
    - `primary_emotion` - Primary emotion (for emotional_resonance)
    - `emotional_authenticity` - Authenticity score
    - `rationale` - Rationale text (for overall_impact)
  - `brand_presence`:
    - `mentions` - Array of brand mentions with:
      - `t_s` - Timestamp
      - `type` - Mention type
      - `context` - Context description
      - `prominence` - Prominence level
    - `late_reveal` - Late reveal flag
    - `tagline_used` - Tagline text
    - `logo_appearances` - Array of logo appearances
    - `first_appearance_s` - First appearance time
    - `tagline_timestamp_s` - Tagline timestamp
    - `brand_frequency_score` - Frequency score
    - `first_appearance_type` - First appearance type
    - `total_screen_time_pct` - Screen time percentage
    - `sonic_branding_present` - Sonic branding flag
    - `brand_integration_naturalness` - Naturalness score
  - `creative_flags` - Expanded flags:
    - `uses_nostalgia` - Nostalgia flag
    - `uses_cultural_moment` - Cultural moment flag
    - `has_music_with_lyrics` - Music with lyrics flag
    - `regulator_categories` - Array of regulator categories
  - `audio_fingerprint`:
    - `sfx`:
      - `present` - SFX present flag
      - `notable_sounds` - Array of sounds
    - `music`:
      - `type` - Music type (licensed/original)
      - `genre` - Genre description
      - `present` - Music present flag
      - `has_lyrics` - Lyrics flag
      - `bpm_estimate` - BPM estimate
      - `energy_curve` - Energy curve description
      - `emotional_fit` - Emotional fit score
    - `dialogue`:
      - `style` - Dialogue style
      - `present` - Dialogue present flag
      - `key_lines` - Array of key lines
    - `voiceover`:
      - `pace` - Voiceover pace
      - `tone` - Voiceover tone
      - `accent` - Accent description
      - `energy` - Energy level
      - `gender` - Gender
      - `present` - Voiceover present flag
      - `age_vibe` - Age vibe
    - `silence_moments` - Array of silence moments
    - `audio_quality_score` - Quality score
  - `campaign_strategy` - Duplicate of top-level strategy fields
  - `attention_dynamics`:
    - `cognitive_load` - Cognitive load level
    - `attention_peaks` - Array of attention peaks with:
      - `t_s` - Timestamp
      - `trigger` - Trigger description
    - `skip_risk_zones` - Array of skip risk zones with:
      - `t_start_s` - Start time
      - `t_end_s` - End time
      - `risk_level` - Risk level
      - `reason` - Reason description
    - `pacing_assessment` - Pacing assessment
    - `predicted_completion_rate` - Completion rate prediction
  - `confidence_overall` - Overall confidence score
  - `distinctive_assets` - Array of distinctive assets with:
    - `asset_type` - Asset type
    - `is_ownable` - Ownability flag
    - `description` - Description
    - `appearances_s` - Array of appearance timestamps
    - `brand_linkage` - Brand linkage score
    - `recognition_potential` - Recognition potential score
  - `emotional_timeline`:
    - `readings` - Array of emotional readings with:
      - `t_s` - Timestamp
      - `arousal` - Arousal level
      - `valence` - Valence level
      - `intensity` - Intensity level
      - `dominant_emotion` - Dominant emotion
    - `arc_shape` - Arc shape description
    - `peak_emotion` - Peak emotion
    - `peak_moment_s` - Peak moment timestamp
    - `positive_ratio` - Positive ratio
    - `average_intensity` - Average intensity
  - `extraction_version` - Version string
  - `competitive_context`:
    - `differentiation_strategy` - Strategy description
    - `share_of_voice_potential` - Potential level
    - `competitive_vulnerability` - Vulnerability description
    - `category_conventions_broken` - Array of broken conventions
    - `category_conventions_followed` - Array of followed conventions
  - `creative_attributes` - Duplicate of creative profile fields
  - `extraction_timestamp` - Timestamp of extraction
  - `compliance_assessment`:
    - `overall_risk` - Risk level
    - `clearcast_notes` - Clearcast notes
    - `potential_issues` - Array of issues
    - `clearcast_readiness` - Readiness score
    - `required_disclaimers` - Array of disclaimers with:
      - `disclaimer_type` - Type
      - `present` - Present flag
      - `adequate` - Adequacy flag
      - `suggested_text` - Suggested text
    - `regulated_category_flags` - Array of category flags
  - `effectiveness_drivers`:
    - `strengths` - Array of strengths with:
      - `driver` - Driver description
      - `impact` - Impact level
      - `evidence` - Evidence text
      - `recommendation` - Recommendation text
    - `weaknesses` - Array of weaknesses with:
      - `driver` - Driver description
      - `impact` - Impact level
      - `evidence` - Evidence text
      - `fix_difficulty` - Fix difficulty
      - `fix_suggestion` - Fix suggestion
    - `ab_test_suggestions` - Array of A/B test suggestions
    - `optimization_opportunities` - Array of optimization opportunities

### 7. Top-Level Duplicate Fields
- ❌ `cta_offer` - Duplicate of analysis_json.cta_offer
- ❌ `brand_asset_timeline` - Duplicate of analysis_json.brand_presence
- ❌ `audio_fingerprint` - Duplicate of analysis_json.audio_fingerprint
- ❌ `creative_dna` - Duplicate of analysis_json.creative_dna
- ❌ `claims_compliance` - Duplicate of analysis_json.compliance_assessment
- ❌ `impact_scores` - Expanded version with more metadata
- ❌ `emotional_metrics`:
  - `brain_balance` - Duplicate
  - `attention_dynamics` - Duplicate
  - `emotional_timeline` - Duplicate
- ❌ `effectiveness`:
  - `memorability` - Duplicate
  - `competitive_context` - Duplicate
  - `effectiveness_drivers` - Duplicate

### 8. Database Structure Fields
- ❌ `chunks` - Array of embedding chunks (for RAG)
- ❌ `segments` - Array of segment records with:
  - `id` - Segment UUID
  - `ad_id` - Ad UUID
  - `segment_type` - Type
  - `aida_stage` - AIDA stage
  - `emotion_focus` - Emotion focus
  - `start_time` - Start time
  - `end_time` - End time
  - `transcript_text` - Transcript text
  - `summary` - Summary text
- ❌ `storyboards` - Array of storyboard records with:
  - `id` - Storyboard UUID
  - `ad_id` - Ad UUID
  - `shot_index` - Shot index
  - `start_time` - Start time
  - `end_time` - End time
  - `shot_label` - Shot label
  - `description` - Description
  - `camera_style` - Camera style
  - `location_hint` - Location hint
  - `key_objects` - Array of objects
  - `on_screen_text` - On-screen text
  - `mood` - Mood
  - `created_at` - Creation timestamp
- ❌ `claims` - Array of claim records with:
  - `id` - Claim UUID
  - `ad_id` - Ad UUID
  - `text` - Claim text
  - `claim_type` - Type
  - `is_comparative` - Comparative flag
  - `likely_needs_substantiation` - Substantiation flag
- ❌ `supers` - Array of super records
- ❌ `embeddings_summary` - Array of embedding items with:
  - `id` - Embedding UUID
  - `item_type` - Item type (claim/storyboard_shot/etc.)
  - `text` - Text content
  - `meta` - Metadata object

### 9. Processing Metadata
- ❌ `processing_notes` - Processing notes
- ❌ `extraction_version` - Version string (e.g., "2.0")
- ❌ `created_at` - Creation timestamp
- ❌ `updated_at` - Update timestamp

---

## Summary

### Major Missing Categories:

1. **Video Technical Metadata** - Dimensions, FPS, aspect ratio, S3 keys, video URLs
2. **Hero Analysis** - Deep creative analysis (cinematography, visual patterns, creative tactics)
3. **Comprehensive Transcript Analysis** - Structured segments, claims analysis, AIDA mapping
4. **Audio Fingerprint** - Detailed audio analysis (music, SFX, voiceover characteristics)
5. **Brand Presence Timeline** - Detailed brand mention tracking
6. **Storyboard Data** - Shot-by-shot breakdown with timestamps
7. **Memorability Analysis** - Recall predictions, memorable elements
8. **Attention Dynamics** - Skip risk zones, attention peaks, completion predictions
9. **Emotional Timeline** - Detailed emotional arc with arousal/valence/intensity
10. **Competitive Context** - Differentiation strategy, category conventions
11. **Effectiveness Drivers** - Strengths/weaknesses with recommendations
12. **Compliance Assessment** - Detailed compliance analysis beyond basic flags
13. **Database Structure** - Separate tables for segments, storyboards, claims, embeddings
14. **Performance Metrics** - View counts, collection dates

### Fields Partially Collected (Need Expansion):

- Impact scores (collected but missing confidence, evidence, descriptions)
- Creative flags (collected but missing some flags like nostalgia, cultural moments)
- CTA analysis (basic but missing detailed CTA/offer structure)

---

## Recommendations

1. **Priority 1**: Add video technical metadata (dimensions, FPS, aspect ratio)
2. **Priority 2**: Expand transcript analysis to include AIDA segments and claims
3. **Priority 3**: Add hero analysis section (cinematography, visual patterns)
4. **Priority 4**: Implement audio fingerprint analysis
5. **Priority 5**: Add storyboard generation with shot-by-shot breakdown
6. **Priority 6**: Expand impact scores with confidence and evidence
7. **Priority 7**: Add memorability and attention dynamics analysis
8. **Priority 8**: Implement database structure for segments/storyboards/claims


