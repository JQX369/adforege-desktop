# Clearcast Compliance System

Ad-Forge includes a comprehensive UK broadcast compliance checking system built around Clearcast and BCAP (Broadcast Committee of Advertising Practice) guidelines.

## Overview

The compliance system automatically analyzes TV advertisements for:
- **Technical Requirements**: Video/audio specs, supers legibility, safe areas
- **Content Compliance**: Industry-specific rules, disclaimers, claims substantiation
- **Regulatory Alignment**: BCAP code adherence, Clearcast submission readiness

## Documentation Index

| Document | Description |
|----------|-------------|
| [BCAP Codes](./bcap-codes.md) | Reference for all BCAP code sections used in compliance checks |
| [Industry Profiles](./industry-profiles.md) | Pre-configured rule sets for 10 advertising categories |
| [Supers Rules](./supers-rules.md) | Height and duration requirements for on-screen legal text |
| [Knowledge Base](./knowledge-base.md) | How the RAG system retrieves Clearcast guidance |
| [Compliance Workflow](./compliance-workflow.md) | End-to-end checking flow from upload to report |

## Source Code Reference

| Module | Path | Purpose |
|--------|------|---------|
| `clearcast_checker.py` | `src/app/features/clearcast/` | Main orchestrator for compliance checks |
| `clearcast_rules.py` | `src/app/features/clearcast/` | Industry profiles and BCAP code mappings |
| `clearcast_knowledge_base.py` | `src/app/features/clearcast/` | PDF ingestion and semantic retrieval |
| `clearcast_prompt_builder.py` | `src/app/features/clearcast/` | Constructs Gemini prompts with context |
| `clearcast_classifier.py` | `src/app/features/clearcast/` | Classifies issues by severity |
| `clearcast_audio.py` | `src/app/features/clearcast/` | Audio normalization checks (EBU R128) |
| `clearcast_autofix.py` | `src/app/features/clearcast/` | Automatic issue remediation |
| `legal_geometry.py` | `src/app/core/` | Supers height/duration verification |
| `video_processor.py` | `src/app/core/` | Broadcast format conversion |

## Key Concepts

### Flag Severity Levels

| Level | Color | Meaning |
|-------|-------|---------|
| Critical | Red | Will likely fail Clearcast submission |
| Warning | Amber | May require changes or justification |
| Info | Blue | Technical compliance notes (supers, audio, format) |
| Subjective | Yellow | Interpretation-dependent (marked "May clear") |

### Industry Auto-Detection

The system automatically detects relevant industries from:
- Product/brand names in the video
- Transcript keywords
- AI breakdown categories

This enables targeted checking against the most relevant BCAP codes.

### Semantic Knowledge Retrieval

When checking claims or complex content, the system:
1. Queries the Clearcast PDF knowledge base
2. Uses embeddings for semantic similarity (when sentence-transformers is installed)
3. Retrieves the most relevant rule citations
4. Includes them in the Gemini prompt for context-aware analysis

## Quick Start

```python
from app.features.clearcast.clearcast_checker import ClearcastChecker

checker = ClearcastChecker()
result = checker.check_compliance(
    video_path="path/to/video.mp4",
    analysis=existing_analysis  # Optional prior AI breakdown
)

# result contains:
# - red_flags: Critical issues
# - amber_flags: Warnings
# - blue_flags: Technical notes
# - recommendations: Suggested fixes
# - delivery_metadata: Slate/clock detection results
```

## External References

- **Clearcast Guidance PDF**: `docs/references/clearcast-guidance.pdf`
- **BCAP Code (ASA)**: https://www.asa.org.uk/codes-and-rulings/advertising-codes/broadcast-code.html
- **Clearcast Portal**: https://www.clearcast.co.uk/








