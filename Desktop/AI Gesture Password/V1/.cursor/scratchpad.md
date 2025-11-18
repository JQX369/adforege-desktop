Background and Motivation
-------------------------
The project is a Windows-based Video Emotion Analyzer that captures and analyzes viewer reactions to videos using a modern CustomTkinter UI, OpenCV, MediaPipe, and Gemini 2.5 for select AI tasks. To support continuity and transparency, we maintain an Activity Log that records every user prompt and the resulting outcomes. This scratchpad coordinates planning and execution under the Planner/Executor workflow.  
- 2025-11-15: Newly generated Creative Performance PDFs cannot be opened even after the application exits, suggesting file locking or corrupted document output that we must diagnose.

- Ensure every prompt and outcome is captured with minimal friction.
- Keep the log human-readable and skimmable while remaining comprehensive.
- Avoid scope creep: changes should be minimal, contained, and production-safe.
- Align with senior-engineer execution rules: clarify scope, pinpoint insertion points, make minimal edits, double-check, deliver clearly.
- Diagnose why ReportLab is producing PDFs that Windows cannot open—possibilities include incomplete writes, lingering file handles after the `SimpleDocTemplate.build()` call, or OS-level locks from the PyInstaller bundle.
- Confirm paths/imports after the repo re-root to `src/app/**`; any scripts referencing legacy `app/` paths must be updated before further debugging.
- **Specific Issues for Local Run Fixes**:
  - **Pip Hang on Dependencies**: Strict version pins (e.g., matplotlib==3.7.2, numba==0.58.1) cause backtracking in resolver, especially with ML stacks (TensorFlow, grpcio). Transitive deps like grpcio-status loop versions; Windows network/antivirus may exacerbate.
  - **Venv State**: Existing venv may have partial/incompatible installs from prior failures; paths show Python 3.11 but potential DLL conflicts.
  - **Windows-Specific Hurdles**: PyAudio needs Microsoft Visual C++ 14.0+ (often missing); TensorFlow CPU version stable but memory-heavy (4GB+ RAM needed). Webcam/mic privacy settings in Windows can block OpenCV/MediaPipe.
  - **Configuration Gaps**: Google Generative AI requires API key in .env; absent, Clearcast features fail gracefully but log errors.
  - **Testing/Verification**: No comprehensive setup tests; manual verification needed. Antivirus may block DLLs during runtime.
  - **Scope Boundaries**: Minimal changes—focus on env/setup scripts, not refactoring code. Use TDD for any new setup tests. Assume no GPU; CPU-only TensorFlow.

### Clearcast Analysis & Fixing — Goals & Current Context
- Clearcast is a core promise of Custom Stories: agencies should be able to sanity-check UK TV ads against current Clearcast guidelines, understand *why* there are risks, and get practical suggestions or auto-fixes before submitting.
- Today, Clearcast checks exist but are relatively static, with limited linkage between the latest guidelines, the script, the product/brand context, and the actual video/audio.
- We want a more reliable, explainable, and helpful Clearcast “co-pilot” that:
  - Stays in sync with current Clearcast guidance.
  - Cross-references script, product, brand, and video together.
  - Can propose or apply safe fixes (including technical TV-delivery rules like audio level, clock number, countdown).
 - Progress to date:
   - **Tasks 1–5** (audit, snapshot schema, updater freshness/UI, prompt reasoning, classification layer) and **Task 6** (classification cross-reference + UI/PDF) are complete. Classifier outputs feed the Clearcast prompt, risk mapping, UI badges, and PDF section.
   - **Task 7 onwards** now focus on auto-fix boundaries (copy/technical), audio normalization stubs, clock/countdown hooks, and end-to-end regression coverage.

High-level Task Breakdown
-------------------------
### A. Clearcast Rules Ingestion & Prompt/Data Freshness
1) **Audit existing Clearcast data and flows**
   - Actions: Review `src/app/clearcast_checker.py`, `src/app/clearcast_updater.py`, `src/app/clearcast_updates.json`, and related tests to map how rules are stored, updated, and consumed today (including any Gemini prompts).
   - Success: Short written summary in this scratchpad describing current data model (what fields we have per rule), update cadence, and where prompts reference Clearcast.

2) **Design “Clearcast Rules Snapshot” data model**
   - Actions: Propose a minimal JSON/schema that captures the pieces we actually need for AI reasoning (e.g., code, category, prohibited/conditional, age, alcohol, claims, scheduling notes, example phrasing, last-updated date).
   - Success: Documented schema in scratchpad plus a stubbed `ClearcastRulesSnapshot` model in code or tests that can be instantiated from `clearcast_updates.json`.

3) **Improve rules updater and freshness workflow**
   - Actions: Extend or refactor `clearcast_updater.py` so we can:
     - Pull/ingest new Clearcast guidance (initially via manual paste or curated JSON, later via semi-automatic scripts).
     - Stamp rules with `last_checked` timestamps and version IDs.
     - Log when the app last refreshed rules and surface that in the UI (e.g., “Clearcast rules last updated: 2025-11-15”).
   - Success: Tests proving that updating the source JSON updates the snapshot, and the UI can display a human-readable “last updated” line.

4) **Upgrade Clearcast system prompts**
   - Actions: Refine the Gemini prompt(s) for Clearcast analysis to:
     - Explicitly reference the structured rules snapshot rather than vague text.
     - Ask for guideline codes, brief justification, and confidence.
     - Keep a stable output schema used by `test_clearcast.py` / `test_clearcast_fix.py`.
   - Success: Updated prompt text committed, tests adapted if needed, and at least one new regression test that asserts we still get well-structured outputs.

5) **Add “explain your reasoning with citations” mode**
   - Actions: Introduce a flag in the Clearcast analysis path to request a more detailed explanation (chain-of-thought style reasoning), but **only store/surface a short, user-friendly explanation and cited rules in the UI/PDF**.
   - Success: When enabled, the system logs richer reasoning (for debugging) while the UI/PDF shows a concise explanation and rule citations; tests validate structure and redaction of any internal reasoning.

### B. Script, Product & Brand Categorisation / Cross-Reference
6) **Map inputs and desired labels**
   - Actions: Define what we want to know about:
     - Script (claims, tone, audience, sensitive topics like alcohol, finance, kids).
     - Product (category, risk level, sector-specific rules).
     - Brand (industry, typical tone, existing Clearcast history if any).
   - Success: Short spec here listing the labels/tags we will infer, with examples.

7) **Design multi-step analysis prompts**
   - Actions: For Gemini, design 2–3 chained prompts or a single multi-part prompt that:
     - First classifies script, product, and brand into structured tags.
     - Then cross-references those tags against the Clearcast rules snapshot.
   - Success: Draft prompts documented (either here or in comments), and a test harness that feeds sample scripts and verifies we get back the expected tags/structure.

8) **Implement categorisation functions and models**
   - Actions: Add a small module or functions (e.g., in `clearcast_checker.py` or a new `clearcast_classifier.py`) that:
     - Takes script text + product/brand metadata.
     - Returns a typed result object with the tags defined above.
   - Success: Unit tests for these functions using mocked Gemini responses so we’re not reliant on the live API.

9) **Cross-link categorisation with Clearcast checks**
   - Actions: Update the Clearcast check pipeline so it:
     - Uses the classification output to decide which rule buckets to inspect.
     - Produces a final risk summary per area (e.g., “Alcohol content”, “Pricing / offers”, “Claims substantiation”).
   - Success: Tests that given certain tags, the checker flags expected rule codes and risk areas, using fixtures instead of live calls.

10) **Surface cross-referenced view in UI/PDF**
    - Actions: Add a “Clearcast view” section in the app/PDF that shows:
      - Key script/product/brand tags.
      - Risk areas and guideline codes.
      - A one-line explanation per risk.
    - Success: Screens/PDFs show a clear, structured table or list tying tags → risks → codes, and regression tests assert that we render the section without breaking layout.

### C. Auto-Fix Tooling & Technical TV-Delivery Checks
11) **Review current Clearcast fixing tool and tests**
    - Actions: Read `src/app/clearcast_checker.py`, `src/app/clearcast_updater.py`, `test_clearcast.py`, and `test_clearcast_fix.py` to understand how “fixes” are proposed today (wording changes, disclaimers, etc.).
    - Success: Brief summary here of current auto-fix behaviour and limitations (e.g., only textual suggestions, no technical delivery checks).

12) **Define safe auto-fix boundaries**
    - Actions: With a safety-first mindset, specify what the tool is allowed to change automatically versus what must stay as suggestions, especially:
      - Script wording vs. on-screen supers vs. VO changes.
      - Adding clarifying disclaimers.
      - Technical delivery items like audio normalisation, clock number, countdown leader.
    - Success: Written boundary list in scratchpad and acceptance criteria that we’ll test for (e.g., “never change brand name or mandatory legal copy automatically”).
     - ✅ **Boundaries (2025-11-15)**:
       - *Manual-only (suggestions only)*: voiceover/script rewrites, on-screen supers/pricing, legal disclaimers & mandated warnings. These appear as guidance text in the UI and `validate_auto_fix_plan()` blocks any attempt to auto-apply them (`tests/test_clearcast_autofix.py`).
       - *Auto-eligible technical fixes*: loudness normalization, gentle audio/video cleanup, broadcast-safe levels, resolution/FPS conversions, delivery padding/slate generation (slate still requires user metadata). All technical actions defined in `clearcast_autofix.py` with explicit categories and are the only options surfaced as checkboxes.
       - *Acceptance criteria locked*: regression tests ensure `rewrite_voiceover`/`add_disclaimer_super` cannot be auto-applied, and the UI now renders manual sections as informational blocks without toggles.

13) **Plan and stub audio normalisation**
    - Actions: Design how we’d normalise audio levels for TV (e.g., peak/RMS/LUFS targets) using the existing audio pipeline or a simple library, and create a stubbed function or CLI hook (even if we don’t fully implement yet).
    - Success: A stub implementation with tests that can be extended later, plus a log message showing what normalisation *would* do on sample audio.
    - ✅ **Implementation (2025-11-15)**:
      - Added `clearcast_audio.py` with `ClearcastAudioAnalyzer` and `AudioNormalizationReport`. Analyzer attempts FFmpeg loudnorm probe when available and falls back to “unknown/no-audio” states otherwise; `_evaluate_levels` is fully unit-tested via `tests/test_clearcast_audio.py`.
      - `clearcast_checker.py` now runs the analyzer on every compliance request, attaches `audio_normalization` metadata, and injects a blue flag when loudness needs attention. UI and PDF render an “Audio Readiness” block beneath the classification snapshot, and the Polish dialog respects the new auto-fix guardrails.
      - Regression suite (`tests/test_clearcast_audio.py` + existing prompt/response/PDF tests) locks the boundary logic.

14) **Clock number and countdown support (planning)**
    - Actions: Define how the tool should:
      - Capture or store the Clearcast clock number.
      - Validate presence of countdown and clock leader in the final file (or at least track them).
    - Success: Specification documented, plus placeholder fields/hooks in the data model or UI for clock number and countdown without breaking current workflows.

15) **Strengthen Clearcast “fix this ad” recommendations**
    - Actions: Enhance the AI-driven fix suggestions to:
      - Suggest concrete copy tweaks with Clearcast rationale.
      - Highlight which parts of the script/visuals are problematic.
      - Group fixes by risk area (e.g., “Alcohol”, “Pricing”, “Claims”).
    - Success: Updated prompt+parsing logic with tests that assert we get grouped suggestions; UI/PDF shows them in a clear, actionable format.

16) **Add regression tests and debug-friendly logging**
    - Actions: Extend `test_clearcast.py` / `test_clearcast_fix.py` (or add new tests) to:
      - Cover classification, cross-referencing, and fix suggestion flows end-to-end with fixtures.
      - Ensure logs include enough info to debug why a specific risk or fix was triggered, without leaking any sensitive data.
    - Success: New tests pass, and sample logs show guideline codes, tags, and a short reason for each flagged item.

Project Status Board
--------------------
- [x] Create `docs/ACTIVITY_LOG.md` with conventions and initial entries
- [x] Add current project snapshot to the log
- [x] Create `.cursor/scratchpad.md` with plan and tracking sections
- [ ] Continue appending new prompts/outcomes as they occur
- [x] Repo deep clean: Step 1 (.reports/ + `_archive` setup) — done
- [x] Repo deep clean: Step 2 (install analysis tooling) — done
- [x] Repo deep clean: Step 3 (run vulture dead-code scan) — done (findings logged)
- [x] Repo deep clean: Step 4 (dependency analysis via pipdeptree/pipreqs) — done
- [x] Repo deep clean: Step 5 (Markdown inventory + heuristics) — done
- [x] Repo deep clean: Step 6 (moves-map for src/app layout) — done
- [x] Repo deep clean: Step 7 (plan artifacts: tree + clean-plan + scripts) — done
- [x] Repo deep clean: Step 8 (approval gate + apply prep) — done
- [x] Repo deep clean: Step 9 (create target directories under src/docs) — done
- [x] Repo deep clean: Step 10 (git mv app → src/app) — done (manual move; git mv unavailable here)
- [x] Repo deep clean: Step 11 (update imports + sys.path for src layout) — done
- [x] Repo deep clean: Step 12 (update setup + build/run scripts) — done
- [x] Repo deep clean: Step 13 (organize markdown per md-actions) — done (kept activity log/template per mandate)
- [x] Repo deep clean: Step 14 (archive build artifacts into dated folder) — done (build + original venv moved to `_archive/2025-11-15`)
- [x] Repo deep clean: Step 15 (dependency cleanup from pipreqs/pipdeptree) — done (trimmed extras, added openai/pytest)
- [x] Repo deep clean: Step 16 (remove dead code flagged by vulture) — done (imports cleaned, thresholds hooked to config)
- [x] Repo deep clean: Step 17 (validate via lint/tests/import checks) — done (compileall + import smoke + pytest)
- [x] Repo deep clean: Step 18 (final tree-after + apply-summary reports) — done
- [ ] Reproduce PDF-open failure and capture the OS error + file metadata *(sample long-path PDF created; awaiting user confirmation)*
- [ ] Inspect ReportLab output lifecycle (buffers, file handles, page breaks) for corruption risks
- [ ] Implement fix + regression test ensuring generated PDFs open via PyPDF2
- [x] Fix polish dialog widget extraction crash (2025-11-16) — snapshot polish dialog values before destroying the window to keep background threads stable.
- [x] Clearcast upgrade — Step 1: Audit current Clearcast checker/updater flows *(done 2025-11-15)*
- [x] Clearcast upgrade — Step 2: Define ClearcastRulesSnapshot schema/loader *(done 2025-11-15; tests: `tests/test_clearcast_rules_snapshot.py`)*
- [x] Clearcast upgrade — Step 3: Enhance updater + UI freshness indicators *(done 2025-11-15; tests: `tests/test_clearcast_updater_snapshot.py`)*
- [x] Clearcast upgrade — Step 4: Revise Gemini prompts + reasoning flag *(done 2025-11-15; tests: `tests/test_clearcast_prompt_builder.py`, `tests/test_clearcast_response_parser.py`)*
- [x] Clearcast upgrade — Step 5: Define classification labels + mocked prompts *(done 2025-11-15; tests: `tests/test_clearcast_classifier.py`)*
- [x] Clearcast upgrade — Step 6: Integrate classifications into risk analysis + UI/PDF *(done 2025-11-15; tests: `tests/test_clearcast_prompt_builder.py`, `tests/test_clearcast_response_parser.py`, `tests/test_clearcast_classifier.py`)*
- [x] Clearcast upgrade — Step 7: Codify safe auto-fix boundaries *(done 2025-11-15; tests: `tests/test_clearcast_autofix.py` + UI wiring)*
- [x] Clearcast upgrade — Step 8: Stub audio normalisation analysis *(done 2025-11-15; tests: `tests/test_clearcast_audio.py` + UI/PDF integration)*
- [x] Clearcast upgrade — Step 9: Add clock/countdown metadata hooks *(done 2025-11-15; UI/PDF + storage wiring)*
- [x] Clearcast upgrade — Step 10: Add end-to-end regression coverage/logging *(done 2025-11-15; tests/test_clearcast_end_to_end.py)*

Current Status / Progress Tracking
---------------------------------
As of 2025-08-09:
- Activity Log initialized and seeded with entries for "Do we have an activity log?" and "Draft one including current status."
- Snapshot derived from repository docs reflects:
  - Single API call for demographics; 5-second baseline calibration for emotion tracking
  - Clearcast compliance checker with guideline references and risk assessment
  - Interactive transcript with word-level emotion coloring and tooltips
  - UI updates: removed Continue button and preview-after-upload; prepared AI review sections
  - Performance fixes and error hardening; verified common issues resolved
- Main entry point: `app/main.py` bootstraps `VideoAnalyzerGUI`.
- **2025-11-14**: Creative Performance PDF refreshed with AI disclaimers, tighter spacing constants, richer persona cards, updated benchmark copy, and modular keep-together logic (see `app/pdf_generator.py`, `app/effectiveness_benchmarks.py`). All related tests (`test_pdf_generator_utils.py`, `test_effectiveness_benchmarks.py`) pass.
- **2025-11-15**: Repo deep clean plan approved; executor completed Steps 1-17 (through full validation—compileall/import smoke/pytest=49 passed). Now generating final reports (`tree-after.txt`, `apply-summary.md`).
- **2025-11-15**: Reproduced PDF-open issue by saving `CustomStories_Report_A_collection_of_Christmas_ornaments_...pdf` beneath `long_path_test/Customstories/Clients/Creative/March Muses/Finished Versions/` (path length 326 chars, size ≈8.3 KB). Adobe-style “Access denied” errors are consistent with Windows’ 260-char path cap on machines without long-path support.
- **2025-11-15 — Clearcast Task 1 (audit)**:
  - `clearcast_checker.py` uses a static text summary (`clearcast_summary`) instead of structured rule data; prompts embed large JSON specification but never touch `clearcast_updates.json`.
  - `clearcast_updater.py` polls Gemini “flash” weekly, storing only metadata (`last_check`, `updates` list, `current_version`, `auto_check_enabled`) inside `clearcast_updates.json`; no rule fields or snapshots are captured.
  - Tests `tests/test_clearcast.py` and `tests/test_clearcast_fix.py` are manual/interactive smoke scripts with prints or console prompts—no assertions, fixtures, or Golden data to lock behaviour.
  - There is no connection between the updater and checker beyond shared paths; guideline PDFs are not parsed, and rule references in prompts rely on free-form model reasoning, making outputs brittle.
- **2025-11-15 — Clearcast Task 2 (snapshot schema)**:
  - Added `app/clearcast_rules.py` with typed `ClearcastRule` + `ClearcastRulesSnapshot` models, input validation, and helpers to load the bundled JSON.
  - Expanded `src/app/clearcast_updates.json` to include a `snapshot` payload (version ID, timestamps, and three representative rules) aligned with the schema.
  - Added regression coverage via `tests/test_clearcast_rules_snapshot.py` to ensure loaders validate required fields and surface meaningful errors when data is missing.
- **2025-11-15 — Clearcast Task 3 (updater + UI freshness)**:
  - `clearcast_updater.py` now supports dependency injection for `clearcast_updates.json`, guarantees a structured `snapshot` block, bumps semantic versions, and exposes helpers to load typed snapshots and human-readable timestamps.
  - Added `tests/test_clearcast_updater_snapshot.py` to verify version increments and timestamp propagation whenever `check_for_updates()` runs.
  - `video_analyzer_gui.py` now surfaces “Clearcast rules last updated …” under every compliance header via a `StringVar` bound to the updater, and refreshes automatically when background checks fire.
- **2025-11-15 — Clearcast Task 4 (prompts + reasoning)**:
  - Introduced `app/clearcast_prompt_builder.py` with a typed `PromptContext`, snapshot summariser, and consistent JSON contract; builder is covered by `tests/test_clearcast_prompt_builder.py`.
  - `clearcast_checker.py` now loads the structured snapshot, builds prompts via the new helper, accepts optional script/product/brand metadata, and supports a `verbose_reasoning` flag.
  - Parsing logic normalises new `risks`/`technical_checks`/`internal_reasoning` fields back into the legacy flag lists; regression captured in `tests/test_clearcast_response_parser.py`.
- **2025-11-15 — Clearcast Task 5 (classification labels + mocked prompts)**:
  - Created `app/clearcast_classifier.py` with dataclasses for script, product, brand, focus areas, and disclaimers plus helpers to build prompts and parse responses.
  - Classification prompt enumerates required labels (claims, tone, audience, sensitive topics, inherent risk, regulatory flags, focus areas, disclaimers) and is covered by `tests/test_clearcast_classifier.py`.
  - `classify_clearcast_context()` now accepts optional metadata, uses `create_gemini_model('flash')`, and normalises mocked Gemini JSON into stable dataclasses ready for downstream cross-referencing.
- **2025-11-15 — Clearcast Task 6 (cross-reference + UI/PDF)**:
  - `clearcast_checker.py` now runs the classifier before compliance analysis, feeds the tags into the structured prompt, stores classification output + focus summaries + disclaimers, and records rule snapshot metadata.
  - `_display_clearcast_results()` renders a new “Classification Snapshot” section (script/product/brand tags, focus areas, required disclaimers) and the PDF mirrors the same via `_add_classification_section()`.
  - Added heuristic linking between priority focus areas and flagged guidelines so UI/PDF show which classifications map to red/yellow flags; regression covered via `tests/test_clearcast_response_parser.py`.
- **2025-11-15 — Clearcast Task 7 (auto-fix boundaries)**
  - Added `clearcast_autofix.py` + UI wiring so only technical fixes appear as toggles; voiceover/disclaimer edits remain suggestion-only. `validate_auto_fix_plan()` guards the pipeline; regression tests live in `tests/test_clearcast_autofix.py`.
- **2025-11-15 — Clearcast Task 8 (audio normalization stub)**
  - Added `clearcast_audio.py` with FFmpeg-backed loudness checks and fallback states; results feed `audio_normalization` metadata, a new blue flag, and the UI/PDF “Audio Readiness” block. Regression in `tests/test_clearcast_audio.py` and existing PDF tests.
- **2025-11-15 — Clearcast Task 9 (clock & countdown hooks)**
  - Video polish workflow now builds/stores `delivery_metadata` (clock number, client/agency/product/title, padding/countdown flags, readiness) per analysis via `VideoAnalysisStorage`.
  - Clearcast UI and PDF display a “Clock & Countdown Readiness” block under the classification snapshot, surfacing the stored metadata and readiness state even before running fixes.
  - Guardrails ensure only auto-approved technical actions remain selectable, while manual slate/disclaimer actions are informational only; regression covered implicitly through `tests/test_pdf_generator_utils.py` and the updated polish dialog wiring.
- **2025-11-15 — Clearcast Task 10 (end-to-end regression + logging)**
  - Added `tests/test_clearcast_end_to_end.py` to stub Gemini/classifier/audio and assert that classification tags, focus areas, audio flags, rules snapshots, and blue flags all flow through `check_video_compliance`.
  - Improved `clearcast_checker.py` logging/robustness: focus-area labels tolerate dicts, classification/rule snapshots now overwrite defaults (instead of `setdefault`), and audio normalization status is logged for observability.
  - Suite now covers 24 tests (~2.0s) across audio, autofix, prompts, parser, classifier, PDF, and the new e2e path.
- **2025-11-15 — [ui-audit] Clearcast layout review**
  - `video_analyzer_gui.py::_display_clearcast_results()` stacks every component inside a single `results_frame` with `pack()` and narrow `wraplength` values (350–500px). This forces long paragraphs (summary, prediction, classification cards, all flag lists) into one column, producing cramped headers at page bottoms and large blank zones between sections when cards expand.
  - Flag cards only show `issue`, optional `guideline_reference`, and `required_action`; there is no slot for transcript evidence or the frame image/timestamp beyond a plain `[00:00-00:00]` label, so UI cannot display proof for “unsubstantiated superlative claim” allegations.
  - Fonts vary between “SF Pro Text” and “Arial”, and titles like “RED FLAGS”/“YELLOW FLAGS” use identical padding regardless of content height, so the visual hierarchy looks inconsistent compared to the rest of the app header/footer.
- **2025-11-15 — [flag-audit] Prompt + parser review**
  - `clearcast_prompt_builder.py` defines JSON outputs with `issue`, `risk_level`, `timestamp`, etc., but never requests a transcript quote/evidence field; Requirements only mention citing rule codes, so the model can hallucinate issues without proof.
  - `_merge_structured_sections()` in `clearcast_checker.py` drops `description` into `issue` when `issue` is missing and emits `guideline_code/guideline_title` only—UI expects `guideline_reference`, so helpful citations are often blank. No parser field persists transcript excerpts, so downstream UI/PDF cannot render evidence even if Gemini returned it.
- **2025-11-15 — [ui-layout] Clearcast UI refresh (WIP)**
  - `_display_clearcast_results()` now builds a two-column layout: overview + classification cards on the left and stacked risk/technical cards on the right, each rendered as `COLORS['card']` containers with consistent padding, so headers never dangle at the bottom of the viewport.
  - Added `_render_clearcast_overview`, `_render_flag_section`, and `_render_compliant_section` helpers to keep typography consistent (“Arial” 13/12) and ensure flag cards include timestamps, guideline references, and call-to-action text with uniform spacing. The Polish button anchors beneath the new grid to avoid overlapping content.
- **2025-11-15 — [ui-evidence] Evidence slot in flags**
  - `_render_flag_section()` now surfaces an italicized quote drawn from `flag['evidence_text']` (falling back to `description`), so once the parser supplies transcript snippets every risk card will show the actual line cited alongside the timestamp/guideline metadata.
- **2025-11-15 — [prompt-update] Evidence-required prompt**
  - `build_clearcast_prompt()` teaches Gemini to return `evidence_text` + `evidence_source` for every risk/technical issue, with explicit instructions about quoting transcript lines or frame descriptions. Updated prompt schema is covered by `tests/test_clearcast_prompt_builder.py`.
- **2025-11-15 — [parser-update] Evidence plumbing**
  - `_merge_structured_sections()` now captures `guideline_reference`, `evidence_text`, and `evidence_source` for both risk and technical items (fallbacks pull from `description`). Tests in `tests/test_clearcast_response_parser.py` assert the new metadata, and `tests/test_clearcast_end_to_end.py` confirms the end-to-end flow remains stable.
- **2025-11-15 — [pdf-layout-clearcast] Section flow improvements**
  - Clearcast PDF overview (status + summary + prediction) is wrapped in a `KeepTogether`, preventing lone headers at page bottoms.
  - Red/yellow/blue flag sections now inject their headers inside the first card and feed the combined blocks through `_ensure_keep_together`, so headers travel with their first card without forcing huge white gaps between sections.
- **2025-11-15 — [pdf-flags] Evidence surfaces in PDF**
  - Each Clearcast flag card now prints an italicized “Evidence” line assembled from `evidence_text` and `evidence_source`, matching the UI quote/timestamp and reinforcing the requirement for proof in the PDF handoff.
- **2025-11-15 — [cta-trim] CTA suggestions moved to improvements only**
  - Removed the “Suggested CTA” line from both the AI Breakdown UI and PDF content breakdown sections; when Gemini provides a CTA fix, it now appears as the first entry in the “Areas for Improvement” list (UI + PDF), optionally prefixed with the CTA clarity critique for context.
- **2025-11-15 — [audience-schema] Demographic-rich personas**
  - `ai_video_breakdown._create_analysis_prompt()` now requires each `audience_reactions` item to return gender, age_range, race_ethnicity, and location fields; `_ensure_response_defaults()` normalises incoming data so both the legacy `profile` label and the new demographic keys are always populated. Tests (`tests/test_ai_video_breakdown_prompt.py`) cover the prompt schema and sanitisation.
- **2025-11-15 — [audience-render] UI/PDF persona layout**
  - Audience cards in `video_analyzer_gui.py` now show persona name, demographic chips (gender/age/race), location pin, engagement level, reaction quote, likely action, and key concerns.
  - The AI Breakdown PDF mirrors the richer persona structure—each table now includes demographics, location, and key concerns, matching the new schema while keeping headers tied to the first card via the existing keep-together utility.
- **2025-11-15 — [pdf-spacing-ai] Effectiveness block keep-together**
  - Wrapped the “Effectiveness Score” cluster (score label, progress bar, tier summary, benchmark table) in a single `KeepTogether` so the header never dangles above a page break, removing the awkward gap between “Effectiveness Score:” and “Effectiveness Score Benchmarks.”
- **2025-11-16 — Polish dialog stability**
  - Added `_extract_polish_values()` to snapshot every CustomTkinter entry/StringVar/BooleanVar before the options dialog is destroyed, eliminating the `invalid command name "...ctkentry"` crash when the background processing thread dereferenced dead widgets.
  - `_build_delivery_metadata()` now consumes the snapshot dict (plain strings/booleans) instead of widget references, so delivery readiness metadata is populated even after the dialog closes.
- **2025-11-16 — Test coverage note**
  - `tests/test_polish_video.py` now uses `pytest.importorskip("cv2")` so environments without OpenCV skip the heavy integration script gracefully.
  - Verified unaffected parts of the suite via `pytest tests/test_effectiveness_benchmarks.py` (28 passed).
- **2025-11-16 — Ad Analyzer script/supers context**
  - `_collect_script_and_supers()` funnels transcript text (`analysis['transcription']`) plus any stored supers into `AIVideoBreakdown.analyze_video()`, and `_create_analysis_prompt()` now embeds SCRIPT/ON-SCREEN SUPER sections so Gemini cites real evidence.
  - Prompt/prompt tests updated to require `evidence_text` + demographic-rich `audience_reactions`; `_normalize_audience_reactions()` enforces one HIGH-fit advocate, one LOW-fit skeptic, and two varied personas with realistic gender/age/race/location data. PDF/UI render the expanded persona details without clipping.
- **2025-11-16 — OCR fallback for supers + highlight evidence**
  - `AIVideoBreakdown` now attempts lightweight OCR (pytesseract) on sampled frames when no supers are supplied, feeding that copy into the prompt and surfacing the lines under `results['debug']['ocr_supers']`.
  - Creative highlights/improvements/soft-risks now require `evidence_text`; the AI Breakdown UI and PDF show those quotes/visual refs directly under each card, mirroring the Clearcast evidence experience.
- **2025-11-16 — Audience QA taps**
  - Raw Gemini personas are preserved under `results['debug']['audience_reactions_raw']` before normalization so we can audit what was generated vs. the enforced HIGH/LOW/neutral mix.
- **2025-11-16 — Script summarizer guardrail**
  - `_summarize_script()` now trims long transcripts to ~1.6k chars before prompting, appending a truncated-note so we keep context without blowing the token budget.
- **2025-11-16 — PDF persona grid**
  - Audience reaction cards now capture gender/age/race/location text and auto-flow into a two-column grid when more than two personas exist, keeping spacing tight while avoiding clipped paragraphs.
- **2025-11-17 — [regen-control] Creative view refresh**
  - Added `_ai_regen_inflight` tracking plus a “Regenerate Analysis” CTA on each AI breakdown card. Button disables while regeneration threads run, and `_analyze_video_breakdown()` now supports a `regenerate` flag so we can re-run Gemini without re-uploading footage.
- **2025-11-17 — [audience-context] Airing market input**
  - Each Creative Performance card now exposes an “Airing Country” combo box (type-any with popular presets) that's persisted via `VideoAnalysisStorage.set_ai_airing_country()`. The selection flows into the Gemini prompt (`PRIMARY AIRING MARKET: …`), travels with results (`audience_context.airing_country`), and is displayed above simulated audience reactions plus in PDFs later.
- **2025-11-17 — [pdf-layout-fixes] Audience grid + benchmarks**
  - AI Breakdown PDFs now mention the primary airing market, keep persona cards inside a KeepTogether grid (two columns auto-applied when >2 personas), and lock the Effectiveness Score + benchmark table into a single block so headings never orphan and whitespace gaps vanish.
- **2025-11-17 — [improvement-dedupe] CTA uniqueness**
  - `_dedupe_highlights()` now collapses duplicate Areas for Improvement at parse-time (plus UI/PDF guards), so Gemini can't surface two CTA cards. Regression test added to `tests/test_ai_video_breakdown_prompt.py`.
- **2025-11-17 — [pdf-title/audience-fix]**
  - Report heading now renders as `Custom Stories Report — <Brand> — <Date>` using the stored `analyzed_at` timestamp, and persona cards are rendered sequentially (one per row) to prevent column overlap.

Executor's Feedback or Assistance Requests
------------------------------------------
- Latest executor cycle focused on refining Custom Stories PDF output (title format, wrapping, spacing, and section layout) in `app/pdf_generator.py` and adding `docs/guides/custom_stories_pdf_layout.md`. All related tests are passing; awaiting user visual QA for further tweaks.
- Follow-up changes added AI disclaimers, reduced whitespace, refreshed benchmark copy, and expanded simulated audience personas; smoke/regression tests re-run successfully.
- Repo deep clean applied end-to-end (see `.reports/apply-summary.md`); pytest (49) now passing with PYTHONPATH=src.
- Repo deep clean involves large-scale moves; planner requested “Push to GIT” before starting—please confirm latest main branch is backed up (cannot verify push from here).
- PDF-open failure likely tied to extremely long filenames ( >260 chars when ad titles are lengthy). Captured metadata for representative sample; awaiting user confirmation before moving to lifecycle analysis.
- Clearcast Tasks 6-10 delivered (classification, auto-fix guardrails, audio readiness, clock hooks, e2e regression). Ready to tackle any follow-up QA or new planner directives.
- Video polish regression script skips when OpenCV is absent; install `opencv-python` locally to run `tests/test_polish_video.py` instead of the skip path.

Lessons
-------
- Include info useful for debugging in program output when applicable.
- Read the file before editing.
- Always ask before using force operations in version control.
- Keep changes minimal and aligned with existing patterns.
- For ReportLab PDFs, use `Paragraph` cells (not raw strings) inside tables when HTML-like tags are present, so markup is rendered instead of printed literally.
- When running PowerShell commands, quote workspace paths (spaces!) or directories get created in the wrong location.
- `pipreqs` lacks a `__main__`; invoke `venv\\Scripts\\pipreqs.exe` instead of `python -m pipreqs`.
- `git mv` isn't usable here (repo root doesn't track this subfolder); fall back to `Move-Item` + document the limitation.
- Snapshot CustomTkinter widget values before destroying dialogs; background threads must never touch widgets after their Tcl commands disappear.

## Planner Update — Effectiveness Score Benchmark System

### Background/Goal
Currently, effectiveness scores (0-100%) are displayed without context or benchmarks, making them meaningless. Users need clear tier definitions, performance expectations, and consistent application across all metrics (effectiveness, engagement, conversion, memorability).

### Requirements
1. **5-Tier Benchmark System** (0-20, 20-40, 40-60, 60-80, 80-100)
   - Tier names: Poor / Below Average / Average / Good / Excellent
   - Each tier needs:
     - Overall effectiveness definition
     - Engagement rate estimate
     - Conversion potential estimate
     - Memorability estimate

2. **Display Requirements**
   - Tier label next to score (e.g., "75% — Good")
   - Always-visible definitions below score
   - Tooltips/hover for detailed breakdowns
   - Visual indicators (colors aligned with tiers)
   - Benchmark reference table in PDFs

3. **Consistency**
   - Apply to: Overall effectiveness score, Engagement rate, Conversion potential, Memorability
   - Same tier structure and definitions across all metrics

### Tier Definitions (Proposed)

**0-20: Poor**
- Overall: Minimal impact expected; significant improvements needed across multiple areas
- Engagement: Very Low (<5% expected engagement)
- Conversion: Minimal (<1% conversion rate)
- Memorability: Poor (unlikely to be remembered)

**20-40: Below Average**
- Overall: Limited effectiveness; multiple areas need attention before launch
- Engagement: Low (5-15% expected engagement)
- Conversion: Low (1-3% conversion rate)
- Memorability: Weak (low recall after 24 hours)

**40-60: Average**
- Overall: Moderate impact; some strengths but room for improvement
- Engagement: Moderate (15-30% expected engagement)
- Conversion: Moderate (3-7% conversion rate)
- Memorability: Fair (moderate recall, may need reinforcement)

**60-80: Good**
- Overall: Strong performance; minor optimizations could enhance results
- Engagement: High (30-50% expected engagement)
- Conversion: Good (7-12% conversion rate)
- Memorability: Strong (good recall, brand association forming)

**80-100: Excellent**
- Overall: Exceptional effectiveness; best-in-class performance
- Engagement: Very High (>50% expected engagement)
- Conversion: Excellent (>12% conversion rate)
- Memorability: Excellent (high recall, strong brand association)

### Key Challenges and Analysis
- **Centralization**: Need single source of truth for benchmark definitions
- **UI Integration**: Tooltips/hover require careful event handling in CustomTkinter
- **PDF Layout**: Benchmark table needs to fit without cluttering report
- **Metric Mapping**: Some metrics may be text-based ("High"/"Low") vs numeric; need conversion logic
- **Color Consistency**: Align existing color scheme (green/yellow/red) with 5-tier system

### High-level Task Breakdown

1. **Create Benchmark Utility Module**
   - Actions: Create `app/effectiveness_benchmarks.py` with:
     - `get_tier(score: float) -> str` - Returns tier name for score
     - `get_tier_range(score: float) -> Tuple[int, int]` - Returns min/max for tier
     - `get_tier_definition(tier: str) -> Dict` - Returns full definition dict
     - `get_tier_color(tier: str) -> str` - Returns hex color for tier
     - `get_metric_estimate(metric: str, tier: str) -> str` - Returns estimate for metric
     - Constants: `TIER_DEFINITIONS` dict with all tier data
   - Success Criteria: Module provides all tier lookups; unit tests pass

2. **Update UI Score Display**
   - Actions: Modify `_display_ai_breakdown_results()` in `video_analyzer_gui.py`:
     - Import benchmark utility
     - Show tier label next to score (e.g., "75% — Good")
     - Display always-visible tier definition below score
     - Add tooltip/hover showing detailed breakdown
     - Update progress bar color to use tier color
   - Success Criteria: Score shows tier label; definition visible; tooltip works; colors match tiers

3. **Add Benchmark Reference to PDF**
   - Actions: Modify `AIBreakdownPDFGenerator.generate_pdf()` in `pdf_generator.py`:
     - Add benchmark reference table after effectiveness score section
     - Table shows all 5 tiers with definitions
     - Include metric estimates (engagement, conversion, memorability)
   - Success Criteria: PDF includes benchmark table; table is readable and well-formatted

4. **Apply Benchmarks to All Metrics**
   - Actions: Update UI/PDF to show tier labels for:
     - Engagement rate (if numeric or convert text to numeric)
     - Conversion potential (if numeric or convert text to numeric)
     - Memorability (if numeric or convert text to numeric)
   - Success Criteria: All metrics show tier labels consistently

5. **Add Tooltip/Hover Functionality**
   - Actions: Create helper method `_create_score_tooltip()` in `video_analyzer_gui.py`:
     - Shows tier name, definition, and metric estimates
     - Uses CustomTkinter tooltip or custom hover frame
   - Success Criteria: Hovering over score shows detailed breakdown

6. **Update Color Scheme**
   - Actions: Align existing color logic with 5-tier system:
     - Poor: Red (#E74C3C)
     - Below Average: Orange (#F39C12)
     - Average: Yellow (#F1C40F)
     - Good: Light Green (#2ECC71)
     - Excellent: Dark Green (#27AE60)
   - Success Criteria: Colors match tier definitions consistently

### Exact Insertion Points
- **New File**: `app/effectiveness_benchmarks.py` - Central benchmark definitions
- **Update**: `app/video_analyzer_gui.py` - Lines ~6193-6211 (effectiveness score display)
- **Update**: `app/pdf_generator.py` - Lines ~620-637 (effectiveness score in PDF)
- **Update**: `app/video_analyzer_gui.py` - Add tooltip helper method
- **Update**: `app/pdf_generator.py` - Add benchmark reference table

### Success Criteria
- Effectiveness scores show tier labels (e.g., "75% — Good")
- Tier definitions are always visible below scores
- Tooltips show detailed breakdown on hover
- PDF includes benchmark reference table
- All metrics (engagement, conversion, memorability) show tier labels consistently
- Colors align with 5-tier system
- Unit tests verify tier lookups work correctly

### Project Status Board — Benchmark System
- [x] Create `app/effectiveness_benchmarks.py` with tier definitions and lookup functions
- [x] Write unit tests for benchmark utility
- [x] Update UI effectiveness score display with tier label and definition
- [x] Add tooltip/hover functionality for detailed breakdown
- [x] Update PDF to include benchmark reference table
- [x] Apply benchmarks to engagement/conversion/memorability metrics
- [x] Update color scheme to align with 5-tier system
- [x] Test consistency across UI and PDF displays

### Current Status / Progress Tracking — Benchmark System
- **2025-11-14**: Implementation complete! All benchmark system features implemented:
  - Created `app/effectiveness_benchmarks.py` with 5-tier system (Poor, Below Average, Average, Good, Excellent)
  - All 28 unit tests passing
  - UI now displays tier labels (e.g., "75% — Good") with always-visible definitions and hover tooltips
  - PDF includes comprehensive benchmark reference table with all tiers and metric estimates
  - Color scheme aligned with 5-tier system (red → orange → yellow → light green → dark green)
  - Expected metrics in PDF now show tier labels for text-based values
  - Consistent application across effectiveness score, engagement, conversion, and memorability metrics

### Executor's Feedback or Assistance Requests — Benchmark System
- ✅ All implementation tasks completed successfully
- ✅ No linter errors
- ✅ All unit tests passing
- Ready for user testing and feedback

## Planner Update — Quota Error Handling Improvement

### Background/Goal
The app was hitting Gemini API free tier rate limits (2 requests/minute) and immediately failing without retrying. The API provides retry delay information in error messages that should be respected.

### Issue
- Quota errors (429) were detected but immediately returned as errors
- No retry logic respecting the API's suggested retry delay
- User saw generic error messages without context about free tier limits

### Solution Implemented
- **Retry Logic**: Added `_extract_retry_delay()` to parse retry delay from API error messages
- **Smart Retries**: Quota errors now retry up to 3 times, waiting for the API-suggested delay (typically 45-60 seconds)
- **Better Error Messages**: Added `_format_quota_error()` to provide user-friendly messages explaining free tier limits and upgrade options
- **Response Validation**: Added check for None response after retries to prevent crashes

### Files Modified
- `app/ai_video_breakdown.py`: Enhanced quota error handling with retry logic and better error messages

### Current Status / Progress Tracking — Quota Handling
- **2025-11-14**: Improved quota error handling:
  - Retry delay extraction working correctly (tested with actual API error format)
  - Free tier limit detection and user-friendly messaging
  - Automatic retries with API-suggested delays
  - Prevents immediate failure on temporary quota limits

## Planner Update — PDF Open Failure Diagnosis (2025-11-15)

### Background/Goal
Creative Performance PDFs generated after the recent layout refactor (now in `src/app/pdf_generator.py`) look correct in logs but cannot be opened in Windows even after the program is closed. We must determine whether the issue stems from ReportLab formatting, file corruption, or filesystem locks.

### Requirements
1. Reproduce the failure on a fresh build and capture the exact OS/PDF viewer error message plus file metadata (size, timestamp, hash).
2. Verify whether the PDF bytes are complete/correct by attempting to parse them via `PyPDF2` or ReportLab's `PdfFileReader` utilities in an automated test.
3. Inspect the generation pipeline (including `SimpleDocTemplate`, file handles, and page break helpers) to ensure the file is closed/flushed before the app releases control.
4. Deliver a fix (code or process) plus regression test(s) so future PDFs open reliably.

### Key Challenges and Analysis
- **File locking vs corruption**: Need to distinguish between OS-level locks (e.g., viewer still running, antivirus, PyInstaller runtime) and genuinely invalid PDF bytes.
- **Large story buffers**: With `KeepTogether` and complex tables, ReportLab may throw hidden exceptions that leave partial files—must check logs for silent errors.
- **Path changes**: Now that sources live in `src/app`, any hard-coded paths in scripts (e.g., `run_video_analyzer.bat`, `GuerillaScope.spec`) must still point to the right module when rebuilding.
- **Testing coverage**: Existing smoke tests only assert file creation; we should add a structural validation (opening the bytes) to catch unreadable files automatically.

### High-level Task Breakdown
1. **Capture Repro Evidence**
   - Actions: Run the app (or CLI harness) to generate the problematic PDF, try opening it via default viewer, note the OS error, and collect file metadata (`dir`, file size, checksum).
   - Success Criteria: Have at least one sample failing PDF with documented error text and metadata for reference.
2. **Automated PDF Integrity Check**
   - Actions: Write a focused pytest in `tests/test_pdf_generator_utils.py` that builds a PDF to an in-memory buffer and attempts to read it via `PyPDF2` (or ReportLab `PdfFileReader`), failing if parsing errors occur.
   - Success Criteria: New test fails under current behaviour (if bytes invalid) and will pass once a fix is in place; ensures future regressions are caught.
3. **Inspect Generation Pipeline**
   - Actions: Review `src/app/pdf_generator.py` build path, ensuring we close file handles, avoid nested `PageBreak`s after `SimpleDocTemplate.build`, and log/report exceptions. Validate whether writing to `BytesIO` first (then atomic write) would eliminate partial files.
   - Success Criteria: Clear explanation of root cause (e.g., lingering handles, partial writes) and a concrete mitigation approach.
4. **Implement Fix & Verify**
   - Actions: Apply the decided fix (e.g., write to `BytesIO` then atomically to disk, wrap `doc.build` in try/finally, add `_doc.canv` closing), rerun new integrity test + existing suite, and confirm sample PDFs are openable.
   - Success Criteria: Tests green, manual sample opens successfully, and scratchpad/activity log updated.

### Success Criteria
- Reproduction details captured with evidence for future debugging.
- Automated PDF integrity test fails before the fix and passes after.
- Root cause documented (locking vs corruption) with minimal, contained code changes.
- Post-fix PDF opens in Windows viewer without errors.
