# Clearcast Supers Guardrails

## Summary

- **Height**: On-screen legal copy must be at least **30 HD scan lines** tall for a 1080p deliverable (≈30 px). Anything below 30 lines fails.
- **Duration**: Required hold time is **0.2 seconds per word** plus a recognition delay:
  - ≤9 words → **+2.0 seconds** (minimum 3.8s for 9 words)
  - ≥10 words → **+3.0 seconds** (minimum 5.0s for 10 words)

## Implementation

- All numeric defaults live in `src/app/core/legal_geometry.py` inside `ClearcastSupersRuleSet`.
  - Fields: `reference_frame_height`, `min_scan_lines_hd`, `seconds_per_word`, `recognition_delay_short`, `recognition_delay_long`, `long_delay_word_threshold`.
  - Edit these constants (and rerun tests) if Clearcast updates the spec.
- `LegalGeometryVerifier` now returns structured metadata:
  - `height_check`: actual vs required HD lines and pixel equivalents.
  - `duration_check`: required/actual seconds, recognition delay type, and threshold.
- `clearcast_checker.py` attaches the failing `height_check` / `duration_check` blocks to each blue flag so downstream consumers (UI/PDF) can show the details.
- `src/web/src/features/clearcast-report/ClearcastReport.tsx` renders a “Technical / Legibility” section that highlights supers issues using the metadata above.

## Verification

- Python: `pytest tests/test_legal_geometry.py tests/test_audit_fixes.py`
- Web: `cd src/web && npm run build`

These suites include regression cases for:
- 29 vs 30 HD-line bounding boxes.
- 9-word vs 10-word hold times (3.8s vs 5.0s).
- Metadata presence on `check_compliance()` output.

## Adjusting the Rules

1. Update `ClearcastSupersRuleSet` defaults.
2. Confirm the helper formulas in `verify_text_height()` / `verify_duration()` still match the new spec.
3. Rerun the regression commands above.
4. For UI expectations, open Clearcast Report to ensure the new copy renders correctly.


