# Source Code Structure

This directory contains all application source code for Ad-Forge.

## Directory Map

```
src/
├── api/          # FastAPI backend server
├── app/          # Python modules (core logic, features)
├── web/          # React/Vite frontend
└── video_analyses/  # Runtime video storage (gitignored)
```

## api/

**FastAPI backend server** serving the web frontend.

| File | Purpose |
|------|---------|
| `main.py` | Application entry point, routes, middleware |

**Start server:**
```bash
uvicorn src.api.main:app --reload --port 8000
```

**Key endpoints:**
- `POST /analyze` - Upload and analyze video
- `GET /analyses` - List all analyses
- `POST /clearcast/check` - Run compliance check
- `POST /clearcast/polish` - Auto-fix technical issues
- `POST /reactions/{id}` - Upload viewer reaction
- `GET /queue/jobs` - Check job status

## app/

**Python modules** shared between API and potential CLI tools.

```
app/
├── core/           # Shared infrastructure
│   ├── config.py         # App configuration
│   ├── storage.py        # Analysis persistence
│   ├── video_storage.py  # Video file management
│   ├── video_processor.py # Broadcast format conversion
│   ├── job_queue.py      # Background job processing
│   ├── legal_geometry.py # Supers height/duration
│   ├── frame_analyzer.py # Frame extraction
│   └── error_handler.py  # Standardized errors
│
├── features/       # Domain-specific modules
│   ├── clearcast/        # UK broadcast compliance
│   ├── ai_breakdown/     # Gemini video analysis
│   ├── analytics/        # Viewer reaction processing
│   ├── reporting/        # PDF generation
│   └── ad_script_lab/    # Script generation (new)
│
└── __init__.py
```

See `app/features/README.md` for feature details.

## web/

**React/Vite frontend** for the web application.

```
web/
├── src/
│   ├── app/           # Routing, layout, providers
│   ├── features/      # Page components
│   ├── shared/        # Reusable UI components
│   └── lib/           # API client, utilities
├── package.json
├── vite.config.ts
└── tsconfig.json
```

**Start dev server:**
```bash
cd src/web
pnpm install
pnpm dev
```

**Build for production:**
```bash
cd src/web
pnpm build
```

## Development Workflow

1. **Start API server:**
   ```bash
   # From repo root
   python -m uvicorn src.api.main:app --reload
   ```

2. **Start web dev server:**
   ```bash
   cd src/web && pnpm dev
   ```

3. **Run tests:**
   ```bash
   # Python
   pytest

   # TypeScript (if available)
   cd src/web && pnpm test
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








