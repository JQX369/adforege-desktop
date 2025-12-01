# Compliance Checking Workflow

This document describes the end-to-end flow from video upload to compliance report generation.

## High-Level Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  Upload  │ ──► │  AI Analysis │ ──► │  Clearcast  │ ──► │  Report  │
│  Video   │     │  (Gemini)    │     │   Checker   │     │  Output  │
└──────────┘     └──────────────┘     └─────────────┘     └──────────┘
```

## Step-by-Step Process

### 1. Video Upload (`/analyze`)

```
User uploads video
       ↓
Validate file type (MP4/MOV/WEBM)
       ↓
Generate analysis_id (UUID)
       ↓
Store original video
       ↓
Enqueue transcoding job (playback copy)
       ↓
Enqueue analysis job
```

### 2. AI Video Breakdown (`/analyze/breakdown`)

```
Extract key frames (10-15 samples)
       ↓
Send to Gemini with structured prompt
       ↓
Parse response:
  - Brand/product detection
  - Key messages
  - Yellow highlights (concerns)
  - Transcript segments
  - Fix guidance
  - Competitive context
       ↓
Store breakdown result
```

### 3. Clearcast Compliance Check (`/clearcast/check`)

```
┌─────────────────────────────────────────────────────┐
│              Industry Detection                      │
│  Keywords → BCAP codes → High-risk areas            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Technical Analysis                      │
│  - Slate/clock detection (frame 0-5)                │
│  - Safe area verification                           │
│  - Supers height/duration (legal_geometry.py)       │
│  - Audio levels (EBU R128)                          │
│  - PSE flash detection                              │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Content Analysis (Gemini)               │
│  Prompt includes:                                    │
│  - Industry profile context                         │
│  - BCAP code requirements                           │
│  - RAG-retrieved Clearcast guidance                 │
│  - AI breakdown summary                             │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Flag Classification                     │
│  - Red: Critical (will fail submission)             │
│  - Amber: Warning (may require justification)       │
│  - Blue: Technical info (supers, format)            │
│  - Yellow: Subjective (AI breakdown concerns)       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Recommendations                         │
│  - De-duplicated fix suggestions                    │
│  - Priority ordering                                │
│  - BCAP code citations                              │
└─────────────────────────────────────────────────────┘
```

### 4. Report Generation

The compliance result contains:

```json
{
  "red_flags": [
    {
      "issue": "Missing responsible gambling messaging",
      "bcap_code": "BCAP 17.10",
      "severity": "critical",
      "fix_guidance": "Add BeGambleAware.org URL",
      "frame_indices": [120, 180]
    }
  ],
  "amber_flags": [
    {
      "issue": "Urgency messaging may be too aggressive",
      "bcap_code": "BCAP 17.6",
      "severity": "warning",
      "subjective": true
    }
  ],
  "blue_flags": [
    {
      "issue": "Legal text height: 28 lines (requires 30)",
      "height_check": {
        "actual_lines": 28,
        "required_lines": 30,
        "pixels": 28
      }
    }
  ],
  "recommendations": [
    "Add BeGambleAware.org URL as persistent super",
    "Increase legal text height to minimum 30 HD lines",
    "Consider softening 'Act now!' messaging"
  ],
  "delivery_metadata": {
    "has_slate": true,
    "clock_number": "ABC/PROD001/030",
    "detected_duration": 30
  }
}
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/analyze` | POST | Upload video, start analysis |
| `/analyze/breakdown` | POST | Get AI breakdown |
| `/clearcast/check` | POST | Run compliance check |
| `/clearcast/polish` | POST | Auto-fix technical issues |
| `/videos/{id}` | GET | Stream video (playback copy) |

## Caching & Performance

### Analysis Cache

Results are cached in SQLite (`analysis_cache.py`):

```python
# Cache key based on video hash + options
cache_key = f"{video_hash}:{analysis_type}:{options_hash}"

# TTL: 24 hours for compliance checks
# Invalidated if video is re-uploaded
```

### Frame Sampling

For performance, frame analysis uses:
- 10-15 evenly distributed samples
- Lazy loading (extract on demand)
- Thumbnail generation for UI display

## Error Handling

### Graceful Degradation

| Failure | Fallback |
|---------|----------|
| Gemini unavailable | Return technical checks only |
| PDF not loaded | Skip RAG augmentation |
| FFmpeg missing | Skip audio analysis |
| Frame extraction fails | Use fewer samples |

### Error Codes

```python
from app.core.error_handler import (
    ANALYSIS_TIMEOUT,
    GEMINI_RATE_LIMITED,
    VIDEO_CORRUPT,
    UNSUPPORTED_FORMAT
)
```

## Integration Points

### Frontend (React)

```typescript
// src/web/src/lib/services/api.ts
const result = await api.runClearcastCheck(analysisId);

// src/web/src/features/clearcast-report/ClearcastReport.tsx
// Renders flags, recommendations, and frame thumbnails
```

### Backend (FastAPI)

```python
# src/api/main.py
@app.post("/clearcast/check")
async def check_clearcast(analysis_id: str):
    checker = ClearcastChecker()
    result = checker.check_compliance(video_path, analysis)
    return result
```

## Testing

```bash
# Run compliance checker tests
pytest tests/test_clearcast*.py

# Run legal geometry tests (supers)
pytest tests/test_legal_geometry.py

# Run audio tests
pytest tests/test_clearcast_audio.py
```

## Source Files

| Module | Path |
|--------|------|
| Main checker | `src/app/features/clearcast/clearcast_checker.py` |
| Prompt builder | `src/app/features/clearcast/clearcast_prompt_builder.py` |
| Flag classifier | `src/app/features/clearcast/clearcast_classifier.py` |
| Audio analysis | `src/app/features/clearcast/clearcast_audio.py` |
| Auto-fix | `src/app/features/clearcast/clearcast_autofix.py` |
| Industry rules | `src/app/features/clearcast/clearcast_rules.py` |
| Knowledge base | `src/app/features/clearcast/clearcast_knowledge_base.py` |
| Legal geometry | `src/app/core/legal_geometry.py` |
| Video processor | `src/app/core/video_processor.py` |








