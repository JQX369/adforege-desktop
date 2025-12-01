# Test Suite

Python test suite for Ad-Forge backend modules.

## Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_clearcast.py

# Run specific test
pytest tests/test_clearcast.py::test_compliance_check

# Run with coverage
pytest --cov=src/app --cov-report=html
```

## Test Organization

```
tests/
├── conftest.py           # Shared fixtures
├── __init__.py
│
├── # Clearcast/Compliance
├── test_clearcast.py                 # Main compliance checker
├── test_clearcast_audio.py           # Audio normalization
├── test_clearcast_autofix.py         # Auto-remediation
├── test_clearcast_classifier.py      # Flag classification
├── test_clearcast_end_to_end.py      # Integration tests
├── test_clearcast_fix.py             # Fix application
├── test_clearcast_prompt_builder.py  # Prompt construction
├── test_clearcast_response_parser.py # Response parsing
├── test_clearcast_rules_snapshot.py  # Rule consistency
├── test_clearcast_updater_snapshot.py
├── test_legal_geometry.py            # Supers height/duration
├── test_audit_fixes.py               # Audit trail
│
├── # AI Analysis
├── test_ai_video_breakdown_prompt.py # Gemini prompts
├── test_effectiveness_benchmarks.py  # Scoring
├── test_substantiation.py            # Claims verification
├── test_gemini_2_5.py                # Gemini 2.5 tests
├── test_gemini_3_pro.py              # Gemini 3 tests
│
├── # Analytics/Reactions
├── test_reactions.py                 # Reaction pipeline
├── test_blink.py                     # Blink detection
├── test_gaze.py                      # Gaze tracking
├── test_pulse.py                     # Pulse estimation
├── test_saliency.py                  # Visual attention
│
├── # Video Processing
├── test_polish_video.py              # Video polishing
├── test_polish_endpoint.py           # Polish API
├── test_video_playback_formats.py    # Format handling
├── test_analysis_pipeline_formats.py # Multi-format
├── test_silence.py                   # Audio silence
├── test_bright_export.py             # Web export
├── test_technical_qc.py              # Technical checks
│
├── # Infrastructure
├── test_job_queue.py                 # Background jobs
├── test_baseline.py                  # Baseline sanity
├── test_setup.py                     # Setup verification
├── test_rag.py                       # RAG retrieval
│
├── # PDF/Reporting
├── test_pdf_generator_utils.py       # PDF utilities
├── test_pdf_layout.py                # Layout tests
├── verify_pdf_frames.py              # Frame extraction
├── verify_timestamps.py              # Timestamp accuracy
│
└── # Ad Script Lab
    └── test_ad_script_lab.py         # Script generation
```

## Key Test Files

### test_clearcast.py

Tests the main compliance checking flow:
- Industry auto-detection
- BCAP code mapping
- Flag classification
- Recommendation generation

### test_reactions.py

Tests viewer reaction pipeline:
- Upload handling
- Emotion tracking
- Job queue integration
- Fallback processing

### test_job_queue.py

Tests background job infrastructure:
- Worker lifecycle
- Job persistence
- Retry logic
- Error handling

### test_legal_geometry.py

Tests supers requirements:
- Height verification (30 HD lines)
- Duration calculation (0.2s/word + delay)
- Borderline cases

## Fixtures (conftest.py)

Common fixtures available:

```python
@pytest.fixture
def sample_video_path():
    """Path to test video file"""
    
@pytest.fixture
def mock_gemini_response():
    """Mocked Gemini API response"""

@pytest.fixture
def storage(tmp_path):
    """Temporary storage instance"""
```

## Dependencies

Some tests require optional dependencies:

```bash
# For video tests
pip install opencv-python moviepy

# For emotion tests
pip install fer deepface  # Optional

# For PDF tests
pip install reportlab pypdf
```

## Environment

```bash
# Required for Gemini tests
export GOOGLE_API_KEY=your_key

# For Supabase RAG tests
export SUPABASE_URL=...
export SUPABASE_KEY=...
```

## Conventions

1. **Test files**: Named `test_*.py`
2. **Test functions**: Named `test_*`
3. **Fixtures**: Defined in `conftest.py` or test file
4. **Mocking**: Use `unittest.mock` or `pytest-mock`
5. **Assertions**: Use plain `assert` statements

## Writing New Tests

```python
# tests/test_new_feature.py
import pytest
from app.features.new_feature import NewFeature

class TestNewFeature:
    def test_basic_functionality(self):
        feature = NewFeature()
        result = feature.process("input")
        assert result.success is True
        
    def test_edge_case(self):
        feature = NewFeature()
        with pytest.raises(ValueError):
            feature.process(None)
```

## CI Integration

Tests run automatically on:
- Pull requests
- Main branch commits

Expected runtime: ~2-5 minutes (without video processing)








