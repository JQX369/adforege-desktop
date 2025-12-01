# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ad-Forge is a full-stack web application for video ad analysis and UK broadcast compliance checking. It analyzes ads using AI (Google Gemini), captures viewer reactions with emotion tracking, and generates compliance reports against BCAP broadcast codes.

**Stack:** Python/FastAPI backend + React 19/TypeScript/Vite frontend

## Common Commands

### Development Servers

```bash
# Start API server (from repo root)
python -m uvicorn src.api.main:app --reload --port 8000

# Start web dev server
cd src/web && pnpm dev

# Or use the Windows startup script
scripts\start_dev.bat
```

### Testing

```bash
# Run all Python tests
pytest

# Run specific test file
pytest tests/test_clearcast.py

# Run specific test
pytest tests/test_clearcast.py::test_compliance_check

# Run with coverage
pytest --cov=src/app --cov-report=html

# Frontend tests
cd src/web && pnpm test
```

### Build

```bash
# Frontend production build
cd src/web && pnpm build
```

## Architecture

### Directory Structure

```
src/
├── api/main.py              # FastAPI app - ALL endpoints here (~2700 lines)
├── app/
│   ├── core/                # Shared infrastructure
│   │   ├── storage.py       # Analysis persistence
│   │   ├── video_storage.py # Video file management
│   │   ├── job_queue.py     # Background job processing
│   │   └── ...
│   └── features/            # Domain modules
│       ├── clearcast/       # UK broadcast compliance (8 files)
│       ├── ai_breakdown/    # Gemini video analysis (7 files)
│       ├── analytics/       # Viewer emotion tracking (10 files)
│       ├── ad_script_lab/   # Multi-agent script generation
│       └── reporting/       # PDF generation
└── web/                     # React frontend
    └── src/
        ├── features/        # Page components
        ├── shared/          # Reusable UI components
        └── lib/services/api.ts  # API client
```

### Key Patterns

**Job Queue:** Background tasks (`video_analysis`, `reaction`, `video_transcode`) are processed via `JobQueue` class using asyncio. Fallback inline processing if queue fails.

**Storage:** JSON-based persistence in `VideoAnalysisStorage` and `VideoStorage` classes.

**Compliance Engine:** Rule-based with industry profiles. Flags classified as Red (critical), Amber (warning), Blue (info), Yellow (subjective).

**AI Pipeline:** Google Gemini for video analysis, with OpenAI as fallback for embeddings.

### Main Processing Flow

```
Upload → Validate → Store → Enqueue Job
                              ↓
                         Gemini AI Breakdown
                              ↓
                         Clearcast Compliance Check
                              ↓
                         PDF Report Generation
```

## Key Files

| File | Purpose |
|------|---------|
| `src/api/main.py` | All API endpoints |
| `src/app/features/ai_breakdown/ai_video_breakdown.py` | Gemini integration |
| `src/app/features/clearcast/clearcast_checker.py` | Compliance logic |
| `src/app/features/analytics/enhanced_emotion_tracker.py` | Face emotion analysis |
| `src/app/core/job_queue.py` | Background job processing |
| `src/web/src/lib/services/api.ts` | Frontend API client |

## Environment Variables

Required in `.env` (see `.env.example`):

```
SUPABASE_URL=         # Database for RAG
SUPABASE_KEY=         # Supabase API key
OPENAI_API_KEY=       # For embeddings
GOOGLE_API_KEY=       # Google Gemini API (primary AI)
```

## Import Conventions

**Python:**
```python
from app.core.storage import VideoAnalysisStorage
from app.features.clearcast.clearcast_checker import ClearcastChecker
```

**TypeScript:**
```typescript
import { api } from '@/lib/services/api';
import { GlassCard } from '@/shared/components/GlassCard';
```

## Testing Notes

- Pytest with `asyncio_mode = strict` in `pytest.ini`
- Fixtures defined in `tests/conftest.py`
- Some tests require `GOOGLE_API_KEY` for Gemini integration tests
- Video tests need `opencv-python` and `moviepy`

## Documentation

See `docs/README.md` for full documentation index:
- `docs/clearcast/` - UK broadcast compliance rules
- `docs/guides/job-queue.md` - Background processing
- `docs/guides/reaction-pipeline.md` - Viewer reaction processing
- `docs/repo-structure.md` - Detailed layout

---

# Agent OS & Workflow Authority

## 🧠 Core Identity & Modes
You act as a **Multi-Agent System Coordinator**. You must strictly adhere to the **Planner/Executor** workflow using `.cursor/scratchpad.md` as your state machine.

**1. MODE SELECTION (Mandatory Start)**
If the user does not specify a mode, ASK: "Should I proceed as Planner (Architect/Strategy) or Executor (Implementation)?"

**2. THE MODES**
- **PLANNER:**
  - **Goal:** Analyze, breakdown, and define success criteria.
  - **Action:** Update `.cursor/scratchpad.md` (Sections: Background, Key Challenges, Task Breakdown).
  - **Constraint:** Do not write code. Create small, clear, verifiable subtasks.
- **EXECUTOR:**
  - **Goal:** Complete ONE task from the Scratchpad at a time.
  - **Action:** Update `.cursor/scratchpad.md` (Sections: Status Board, Feedback, Lessons).
  - **Constraint:** Use TDD. Write tests first. Report back after every milestone.

---

## 📂 Agent OS Router & Memory
**Folder Contract:** Ensure `.cursor/agents/` exists with the required subdirectories (engineering, product, marketing, design, etc.). Create them if missing.

**MANDATORY OUTPUT FORMAT:**
Every response must begin with this block to ground the agent:

```text
AGENT-SETUP
agent: <domain>/<agent> (e.g. engineering/backend-architect)
memory.loaded:
  - .cursor/agents/_memory/product-vision.md
  - .cursor/agents/_memory/brand-voice.yml
  - .cursor/agents/_memory/glossary.yml
  - .cursor/agents/_memory/constraints.yml
  - .cursor/agents/<domain>/<agent>.memory.yml
plan:
  - confirm objective
  - surface constraints
  - execute deliverable
  - update decisions.log.md
guardrails:
  - Do not edit product-vision.md without "APPROVE: VISION CHANGE".
END
```
