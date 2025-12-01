# Repository Structure

Last updated: 2025-11-26

> **Note**: The desktop app (CustomTkinter GUI) has been archived. Ad-Forge is now web-only.

## Root Layout

| Directory | Purpose |
|-----------|---------|
| `_archive/` | Timestamped snapshots of archived code (desktop app, old builds) |
| `.reports/` | Auto-generated analysis reports |
| `.cursor/` | Cursor IDE agent workspace |
| `data/` | Runtime data (users, sessions) |
| `docs/` | Product and engineering documentation |
| `public/` | Static assets |
| `scripts/` | Developer tooling and automation |
| `src/` | Application source (API, Python modules, web client) |
| `templates/` | Document templates |
| `tests/` | Python test suite |
| `video_analyses/` | Runtime storage for video analyses (gitignored) |

## `src/` Breakdown

```
src/
├── api/                # FastAPI backend
│   └── main.py         # Application entry point
│
├── app/                # Python modules
│   ├── core/           # Shared infrastructure
│   │   ├── config.py
│   │   ├── storage.py
│   │   ├── video_storage.py
│   │   ├── video_processor.py  # Broadcast format conversion
│   │   ├── job_queue.py
│   │   ├── legal_geometry.py
│   │   ├── frame_analyzer.py
│   │   ├── error_handler.py
│   │   └── ...
│   │
│   ├── features/       # Domain modules
│   │   ├── clearcast/        # UK broadcast compliance
│   │   ├── ai_breakdown/     # Gemini video analysis
│   │   ├── analytics/        # Reaction processing
│   │   ├── reporting/        # PDF generation
│   │   └── ad_script_lab/    # Script generation
│   │
│   └── __init__.py
│
└── web/                # React/Vite frontend
    ├── src/
    │   ├── app/           # Routing, layout, providers
    │   ├── features/      # Page components
    │   ├── shared/        # Reusable UI components
    │   └── lib/           # API client, utilities
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

## Documentation

```
docs/
├── README.md              # Documentation index
├── repo-structure.md      # This file
├── activity-log.md        # Session activity log
│
├── clearcast/             # Compliance documentation
│   ├── README.md
│   ├── bcap-codes.md
│   ├── industry-profiles.md
│   ├── supers-rules.md
│   ├── knowledge-base.md
│   └── compliance-workflow.md
│
├── guides/                # How-to guides
├── decisions/             # Architecture Decision Records
├── references/            # External resources (PDFs, specs)
└── changelog/             # Version history
```

## Scripts

```
scripts/
├── README.md
├── start_web_dev.ps1     # Start Vite dev server
├── start_dev.bat         # Start API + web dev
├── backfill_playback.py  # Migrate legacy videos
├── debug_playback.py     # Video debugging
├── verify_api.py         # API smoke tests
├── verify_transcode.py   # Transcode verification
└── ...
```

## Tests

```
tests/
├── conftest.py           # Shared fixtures
├── README.md             # Test documentation
│
├── test_clearcast*.py    # Compliance tests
├── test_reactions.py     # Reaction pipeline
├── test_job_queue.py     # Background jobs
├── test_legal_geometry.py
└── ...
```

## Key Files

| File | Purpose |
|------|---------|
| `requirements.txt` | Python dependencies |
| `pytest.ini` | Test configuration |
| `.gitignore` | Git exclusions |
| `.env.example` | Environment template |

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Python modules | `snake_case` | `clearcast_checker.py` |
| Python classes | `PascalCase` | `ClearcastChecker` |
| Web features | `kebab-case` | `reaction-recorder/` |
| React components | `PascalCase` | `ProjectView.tsx` |
| Test files | `test_*.py` | `test_clearcast.py` |

## Import Patterns

**Python:**
```python
from app.core.storage import VideoAnalysisStorage
from app.features.clearcast import ClearcastChecker
```

**TypeScript:**
```typescript
import { api } from '@/lib/services/api';
import { GlassCard } from '@/shared/components/GlassCard';
```

## Archived Code

The following has been moved to `_archive/2025-11-26/desktop-removal/`:
- Desktop GUI (`src/app/desktop/`)
- Gesture recognition (`src/app/recognizers/`)
- Desktop icons (`public/desktop-icons/`)
- PyInstaller specs (`GuerillaScope.spec`)
- Desktop scripts (`build_app.bat`, etc.)

---

This structure is optimized for:
1. **AI readability** - Clear module boundaries, comprehensive READMEs
2. **Feature isolation** - Each feature in its own folder
3. **Web-first architecture** - API + React with shared Python core
4. **Expansion readiness** - Easy to add new features and modules
