# Feature Modules

Domain-specific functionality organized by capability area.

## Module Index

| Module | Path | Purpose |
|--------|------|---------|
| [Clearcast](#clearcast) | `clearcast/` | UK broadcast compliance checking |
| [AI Breakdown](#ai-breakdown) | `ai_breakdown/` | Gemini-powered video analysis |
| [Analytics](#analytics) | `analytics/` | Viewer reaction processing |
| [Reporting](#reporting) | `reporting/` | PDF report generation |
| [Ad Script Lab](#ad-script-lab) | `ad_script_lab/` | Multi-agent script generation |

---

## Clearcast

**Path:** `src/app/features/clearcast/`

UK broadcast compliance checking against BCAP codes and Clearcast guidelines.

| File | Purpose |
|------|---------|
| `clearcast_checker.py` | Main orchestrator |
| `clearcast_rules.py` | Industry profiles, BCAP mappings |
| `clearcast_knowledge_base.py` | PDF RAG retrieval |
| `clearcast_prompt_builder.py` | Gemini prompt construction |
| `clearcast_classifier.py` | Flag severity classification |
| `clearcast_audio.py` | EBU R128 audio analysis |
| `clearcast_autofix.py` | Automatic issue remediation |
| `clearcast_updater.py` | Rule update management |

**Documentation:** `docs/clearcast/`

---

## AI Breakdown

**Path:** `src/app/features/ai_breakdown/`

Gemini-powered analysis of video content, messaging, and effectiveness.

| File | Purpose |
|------|---------|
| `ai_video_breakdown.py` | Main analysis orchestrator |
| `effectiveness_benchmarks.py` | Performance scoring |
| `enhanced_transcript_analyzer.py` | Dialogue analysis |
| `saliency_engine.py` | Visual attention mapping |
| `substantiation_generator.py` | Claims verification |

**Key outputs:**
- Brand/product detection
- Key messages extraction
- Yellow highlights (concerns)
- Fix guidance
- Competitive context
- A/B test suggestions

---

## Analytics

**Path:** `src/app/features/analytics/`

Viewer reaction capture and emotion analysis.

| File | Purpose |
|------|---------|
| `reaction_processing.py` | Pipeline orchestrator |
| `reaction_video_analyzer.py` | Webcam analysis (OpenCV) |
| `enhanced_emotion_tracker.py` | Advanced emotion detection |
| `enhanced_reaction_analyzer.py` | Multi-signal aggregation |
| `gaze_tracker.py` | Eye movement tracking |
| `blink_detector.py` | Attention indicators |
| `pulse_estimator.py` | Heart rate from video |
| `emotion_colors.py` | Visualization palette |
| `emotion_optimization.py` | Scoring algorithms |

---

## Reporting

**Path:** `src/app/features/reporting/`

PDF report generation for analysis results.

| File | Purpose |
|------|---------|
| `pdf_generator.py` | Report composition and rendering |

**Outputs:**
- Compliance summary PDFs
- Frame thumbnail grids
- Technical specification sheets

---

## Ad Script Lab

**Path:** `src/app/features/ad_script_lab/`

Multi-agent system for UK TV ad script generation.

| File | Purpose |
|------|---------|
| `types.py` | Pydantic models (AdScriptBrief, AdScriptRun) |
| `config.py` | Creative mode configurations |
| `orchestrator.py` | 8-stage pipeline coordinator |
| `rag_client.py` | Supabase TV ads retrieval |

**Agents (in `agents/`):**
| Agent | Stage | Role |
|-------|-------|------|
| `retriever.py` | 1 | Fetch relevant ad examples |
| `amazon_start.py` | 2 | Working Backwards brief |
| `ideate.py` | 3 | Generate 5-10 concepts |
| `selector.py` | 4 | Pick top 3 concepts |
| `polish.py` | 5 | Write full scripts |
| `braintrust.py` | 6 | Creative director critique |
| `compliance.py` | 7 | Clearcast-style check |
| `finalize.py` | 8 | Select winner |

---

## Adding New Features

1. Create folder: `src/app/features/your_feature/`
2. Add `__init__.py` with `__all__` exports
3. Add entry to this README
4. Wire endpoints in `src/api/main.py`
5. Add tests in `tests/test_your_feature.py`

## Import Pattern

```python
from app.features.clearcast import ClearcastChecker
from app.features.ai_breakdown import AIVideoBreakdown
from app.features.analytics import ReactionProcessingPipeline
```








