# EquityStack Operator Checklist

1. Work from `python/`.
2. Run the pipeline: `python3 run_equitystack_pipeline.py --csv`
3. Rebuild the bundle if needed: `python3 scripts/build_review_bundle.py --csv --use-feedback`
4. Optional preview triage: `python3 scripts/auto_triage_review_bundle.py --dry-run`
5. Review actions manually: `python3 scripts/review_bundle_actions.py`
6. Dry-run apply first: `python3 scripts/apply_review_bundle.py --csv`
7. Apply approved actions: `python3 scripts/apply_review_bundle.py --apply --yes --csv`
8. Import approved tracked bills when needed: `python3 scripts/import_approved_tracked_bills.py --apply --yes --link-imported-bills --enrich-metadata --csv`
9. Rerun affected future bills: `python3 scripts/rerun_affected_future_bills.py --from-apply-report reports/equitystack_apply_report.json --csv`
10. Refresh feedback analysis: `python3 scripts/analyze_feedback.py`
11. Rebuild the review bundle after apply/import/rerun: `python3 scripts/build_review_bundle.py --csv --use-feedback`
12. Treat `README.md` as the canonical workflow and script reference.
