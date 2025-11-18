# Apply Summary

- Approval: Recorded via .reports/APPROVED (plan green-lit on 2025-11-15)
- Code moves: Entire pp/ package relocated to src/app/ with imports/tests updated
- Docs: Created docs/guides/ hierarchy; moved docs/custom_stories_pdf_layout.md into docs/guides/; kept activity log/template per workflow rules
- Reports refreshed: tree-before/after snapshots, md-actions.csv, moves-map.csv, dead-code.txt (clean), pipreqs.txt
- Artifacts archived: _archive/2025-11-15/ contains previous uild/ output + legacy env/; fresh venv bootstrapped for CI/tests
- Dependencies: slimmed requirements (removed matplotlib/pandas/seaborn/pydirectinput/numba/tkinter-tooltip/dotenv/tf-keras), added explicit openai + pytest
- Dead code: Removed unused imports/params, tied emotion threshold to config, reran vulture (clean)
- Validation: python -m compileall src, python -c "from app.main import main", and pytest -m (49 passed, existing warnings only)
- Next steps: review .reports/commands-dry-run.sh if further file moves needed; run pip install -r requirements.txt after checkout to sync new deps
