# Clean Plan (Dry Run)

- Bias: minimal | Layout: src | App: python-desktop
- Steps completed: directory setup, tooling installs, vulture + dependency scans, markdown heuristics, moves-map generation
- Reports: tree-before.txt, moves-map.csv, md-actions.csv, dead-code.txt, dependencies.json, pipreqs.txt
- Next: finish plan artifacts (commands-dry-run.sh), wait for approval signal before apply
- Approval gate: create .reports/APPROVED or rerun command with approve=YES prior to apply phase
