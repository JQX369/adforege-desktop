# Documentation Index

Welcome to the Ad-Forge documentation. This guide helps you navigate the available resources.

## Quick Links

| Topic | Location | Description |
|-------|----------|-------------|
| Repository Structure | [repo-structure.md](./repo-structure.md) | Folder layout and conventions |
| Clearcast Compliance | [clearcast/](./clearcast/) | UK broadcast compliance system |
| Reaction Pipeline | [guides/reaction-pipeline.md](./guides/reaction-pipeline.md) | Viewer reaction processing |
| Job Queue | [guides/job-queue.md](./guides/job-queue.md) | Background job processing |
| PDF Layout | [guides/custom_stories_pdf_layout.md](./guides/custom_stories_pdf_layout.md) | Report generation |

## Documentation Structure

```
docs/
├── README.md              # This file
├── repo-structure.md      # Target layout blueprint
├── activity-log.md        # Session activity log
│
├── clearcast/             # Compliance documentation
│   ├── README.md          # Overview
│   ├── bcap-codes.md      # BCAP reference
│   ├── industry-profiles.md
│   ├── supers-rules.md
│   ├── knowledge-base.md
│   └── compliance-workflow.md
│
├── guides/                # How-to guides
│   ├── reaction-pipeline.md
│   ├── job-queue.md
│   └── custom_stories_pdf_layout.md
│
├── decisions/             # Architecture Decision Records
│   └── (ADRs go here)
│
├── references/            # External resources
│   ├── clearcast-guidance.pdf
│   └── DIST_README.txt
│
└── changelog/             # Version history
    └── (release notes)
```

## By Role

### For Developers

- [Repository Structure](./repo-structure.md) - Understand the codebase layout
- [Source README](../src/README.md) - API/app/web structure
- [Features README](../src/app/features/README.md) - Module documentation
- [Tests README](../tests/README.md) - Testing guide

### For AI Agents

- Start with [repo-structure.md](./repo-structure.md) for layout
- Check [clearcast/README.md](./clearcast/README.md) for compliance logic
- Review [guides/](./guides/) for specific workflows

### For Product/QA

- [Clearcast Compliance](./clearcast/) - Understand compliance rules
- [Industry Profiles](./clearcast/industry-profiles.md) - Category-specific requirements

## Key Concepts

### Analysis Pipeline

```
Upload → Transcode → AI Breakdown → Clearcast Check → Report
                 ↓
           Reaction Capture → Emotion Analysis → Metrics
```

### Flag Types

| Color | Severity | Meaning |
|-------|----------|---------|
| Red | Critical | Likely fails Clearcast |
| Amber | Warning | May need justification |
| Blue | Info | Technical notes |
| Yellow | Subjective | Interpretation-dependent |

### Job Queue

Background tasks for video processing:
- `video_analysis` - AI breakdown
- `video_transcode` - Playback optimization
- `reaction` - Viewer emotion analysis

## External Resources

- **Clearcast Portal**: https://www.clearcast.co.uk/
- **BCAP Code**: https://www.asa.org.uk/codes-and-rulings/advertising-codes/broadcast-code.html
- **EBU R128**: https://tech.ebu.ch/loudness

## Contributing to Docs

1. Use Markdown with clear headings
2. Include code examples where relevant
3. Keep technical details in source code READMEs
4. Add cross-references to related docs
5. Update this index when adding new docs








