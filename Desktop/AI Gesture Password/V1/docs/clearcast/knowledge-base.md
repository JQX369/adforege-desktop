# Clearcast Knowledge Base (RAG System)

The compliance checker includes a Retrieval-Augmented Generation (RAG) system that provides context-aware rule citations from the official Clearcast guidance PDF.

## Overview

When analyzing complex claims or content, the system:
1. Queries the indexed Clearcast PDF
2. Retrieves semantically relevant passages
3. Injects them into the Gemini prompt
4. Enables more accurate and cited compliance decisions

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ClearcastKnowledgeBase                │
├─────────────────────────────────────────────────────────┤
│  PDF Loading     →  Chunk Creation  →  Embedding Cache  │
│       ↓                   ↓                   ↓         │
│  pypdf extract      500-char chunks    sentence-transformers
│                     with overlap              ↓         │
│                                        Semantic Search  │
└─────────────────────────────────────────────────────────┘
```

## Features

### Dual-Mode Retrieval

| Mode | Availability | Method |
|------|-------------|--------|
| **Keyword** | Always | Simple text matching with scoring |
| **Semantic** | When `sentence-transformers` installed | Embedding similarity search |

The system automatically falls back to keyword mode if semantic search is unavailable.

### Chunk-Level Indexing

The PDF is split into overlapping chunks for precise retrieval:

```python
DEFAULT_CHUNK_SIZE = 500  # characters
DEFAULT_OVERLAP = 100     # characters

# Each chunk stores:
{
    "text": "chunk content...",
    "page": 12,
    "start_idx": 4500
}
```

### Embedding Cache

To avoid regenerating embeddings on each load:
- Embeddings are cached in `src/app/features/clearcast/_cache/`
- Cache key is based on PDF content hash
- Automatic invalidation if PDF changes

## Configuration

### PDF Location

The system searches for the PDF in these locations:

```python
SEARCH_PATHS = [
    "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf",
    "app/A Complete Guide...",
    "docs/references/clearcast-guidance.pdf",  # Preferred location
]
```

### Semantic Model

When available, uses `all-MiniLM-L6-v2` from sentence-transformers:

```python
# Automatic initialization
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
```

## Usage

### Basic Retrieval

```python
from app.features.clearcast.clearcast_knowledge_base import ClearcastKnowledgeBase

kb = ClearcastKnowledgeBase()

# Keyword search (always works)
results = kb.search("alcohol advertising under 25", top_k=5)

# Returns list of:
# {
#     "text": "matching chunk...",
#     "page": 34,
#     "score": 0.85
# }
```

### Integration with Checker

```python
from app.features.clearcast.clearcast_checker import ClearcastChecker

checker = ClearcastChecker()
# The checker automatically uses the knowledge base
# to augment Gemini prompts with relevant context
```

### Checking RAG Availability

```python
from app.features.clearcast.clearcast_knowledge_base import (
    ClearcastKnowledgeBase,
    SEMANTIC_AVAILABLE
)

print(f"Semantic search: {SEMANTIC_AVAILABLE}")

kb = ClearcastKnowledgeBase()
print(f"PDF loaded: {len(kb.full_text) > 0}")
print(f"Chunks indexed: {len(kb.chunks)}")
print(f"Embeddings ready: {kb.embeddings is not None}")
```

## Prompt Augmentation

When the checker encounters a claim requiring substantiation:

```python
# 1. Extract claim from video analysis
claim = "Clinically proven to reduce wrinkles by 50%"

# 2. Query knowledge base
context = kb.search(claim, top_k=3)

# 3. Inject into prompt
prompt = f"""
Based on the following Clearcast guidance:

{context}

Evaluate whether this claim is compliant:
"{claim}"
"""
```

## Performance Notes

| Operation | Time | Notes |
|-----------|------|-------|
| PDF loading | ~2s | One-time on init |
| Chunk creation | <1s | 500-char with overlap |
| Embedding creation | ~30s | Cached after first run |
| Semantic query | <100ms | Cosine similarity |
| Keyword query | <50ms | String matching |

## Dependencies

**Required:**
- `pypdf` - PDF text extraction

**Optional (for semantic search):**
- `sentence-transformers` - Embedding generation
- `numpy` - Vector operations

## Source Files

| File | Purpose |
|------|---------|
| `clearcast_knowledge_base.py` | Main implementation |
| `clearcast_prompt_builder.py` | Prompt construction with RAG context |
| `docs/references/clearcast-guidance.pdf` | Source PDF |
| `_cache/` | Embedding cache directory |








