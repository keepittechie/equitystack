# Current-Administration Batch Files

Store curated current-administration Promise Tracker batches here.

Recommended flow:
- run discovery with `scripts/discover_current_admin_updates.py`
- optionally export selected discovery suggestions into a draft starter batch with `scripts/export_current_admin_discovery_candidates.py`
- edit draft exports into a real curated batch JSON before normalization
- edit a structured batch JSON here
- normalize it with `scripts/normalize_current_admin_batch.py`
- review it with `scripts/review_current_admin_batch_with_ollama.py`
- generate a manual review queue with `scripts/apply_current_admin_ai_review.py`
- import approved records with `scripts/import_curated_current_admin_batch.py`

Current live starter batch:
- `trump_2025_batch_01.json`

Draft exports from discovery are allowed here, but they are not import-ready until manually edited and reviewed.
