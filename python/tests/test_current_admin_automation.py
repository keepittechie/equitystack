import json
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
ROOT_DIR = Path(__file__).resolve().parents[2]
WORKFLOW_LIB = ROOT_DIR / "python" / "bin" / "lib" / "equitystack_workflow.sh"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

if "pymysql" not in sys.modules:
    sys.modules["pymysql"] = types.ModuleType("pymysql")

import apply_current_admin_outcome_enrichment as enrichment  # noqa: E402
import evaluate_impact_maturation as impact  # noqa: E402


def sample_evidence_match(**overrides) -> dict:
    item = {
        "evidence_title": "US Department of Labor apprenticeship expansion grant",
        "evidence_url": "https://www.dol.gov/newsroom/releases/eta/eta20260420",
        "evidence_date": "2026-04-20",
        "source_family": "dol_eta_news",
        "evidence_type": "grant_award",
        "evidence_kind": "implementation_evidence",
        "match_score": 95,
        "match_bucket": "strong_match",
        "recommended_next_action": "review_for_implementation_update",
        "matched_policy_id": "111",
        "matched_promise_id": "111",
        "matched_action_id": "501",
        "date_window_match": {"matched": True},
        "evidence_strength": "high",
        "confidence_score": 95,
        "match_warnings": [],
        "policy_query_hits": ["registered apprenticeship expansion"],
        "program_overlap": ["registered apprenticeship"],
        "mechanism_overlap": ["grant funding"],
        "affected_group_overlap": ["workers"],
        "source_reference": {
            "source_title": "ETA Grant Release",
            "source_url": "https://www.dol.gov/newsroom/releases/eta/eta20260420",
            "source_type": "Government",
            "publisher": "US Department of Labor",
            "published_date": "2026-04-20",
            "notes": "Official DOL ETA release",
        },
    }
    item.update(overrides)
    return item


def sample_supplemental(**overrides) -> dict:
    supplemental = {
        "matched_policy_id": "111",
        "matched_promise_id": "111",
        "matched_action_id": "501",
        "implementation_evidence_count": 1,
        "outcome_evidence_count": 0,
        "legal_context_count": 0,
        "source_quality": "high",
        "best_confidence_score": 95,
        "matched_evidence_items": [sample_evidence_match()],
    }
    supplemental.update(overrides)
    return supplemental


def sample_impact_item(**overrides) -> dict:
    item = {
        "record_key": "trump-2025-high-paying-skilled-trade-jobs",
        "slug": "trump-2025-high-paying-skilled-trade-jobs",
        "title": "Prepare Americans for high-paying skilled trade jobs",
        "previous_impact_status": "impact_pending",
        "record_type": "current_admin",
        "record": {},
    }
    item.update(overrides)
    return item


def sample_enrichment_record(**overrides) -> dict:
    record = {
        "record_key": "trump-2025-high-paying-skilled-trade-jobs",
        "slug": "trump-2025-high-paying-skilled-trade-jobs",
        "title": "Prepare Americans for high-paying skilled trade jobs",
        "impact_status": "impact_review_ready",
        "record": {
            "slug": "trump-2025-high-paying-skilled-trade-jobs",
            "outcomes": [
                {
                    "outcome_summary": "Registered apprenticeship expansion funding was announced.",
                    "impact_direction": "Positive",
                    "measurable_impact": "DOL announced new registered apprenticeship grant funding.",
                    "evidence_strength": "Strong",
                }
            ],
        },
    }
    record.update(overrides)
    return record


class CurrentAdminAutomationTests(unittest.TestCase):
    def test_strict_supplemental_validator_approves_strong_match(self) -> None:
        result = impact.validate_safe_supplemental_auto_approval(
            sample_impact_item(),
            sample_supplemental(),
            enabled=True,
        )

        self.assertTrue(result["approved"])
        self.assertEqual(result["projected_source_quality"], "high")
        self.assertEqual(result["projected_confidence_score"], 95)
        self.assertEqual(result["matched_policy_id"], "111")
        self.assertEqual(result["matched_promise_id"], "111")
        self.assertEqual(
            result["approving_evidence"]["evidence_title"],
            "US Department of Labor apprenticeship expansion grant",
        )

    def test_strict_supplemental_validator_blocks_weak_only_matches(self) -> None:
        weak_evidence = sample_evidence_match(
            match_bucket="weak_match",
            match_score=48,
            recommended_next_action="ignore_low_signal",
        )
        result = impact.validate_safe_supplemental_auto_approval(
            sample_impact_item(),
            sample_supplemental(matched_evidence_items=[weak_evidence]),
            enabled=True,
        )

        self.assertFalse(result["approved"])
        self.assertIn("no strong_match evidence item is available for approval", result["blocked_reasons"])

    def test_strict_supplemental_validator_blocks_legal_context(self) -> None:
        legal_evidence = sample_evidence_match(
            evidence_kind="legal_context",
            recommended_next_action="judicial_context_only",
            source_family="supreme_court_orders",
        )
        result = impact.validate_safe_supplemental_auto_approval(
            sample_impact_item(),
            sample_supplemental(
                legal_context_count=1,
                matched_evidence_items=[legal_evidence],
            ),
            enabled=True,
        )

        self.assertFalse(result["approved"])
        self.assertIn("supplemental evidence includes legal-context matches", result["blocked_reasons"])
        self.assertIn("legal-context evidence cannot be used for approval", result["blocked_reasons"])

    def test_supplemental_transition_needs_explicit_validator_approval(self) -> None:
        ok, reason = impact.transition_decision(
            {
                "previous_impact_status": "impact_pending",
                "recommended_impact_status": "impact_review_ready",
                "supplemental_outcome_evidence_activation_mode": impact.SAFE_SUPPLEMENTAL_AUTO_APPROVAL_MODE,
                "approved": False,
            },
            approve_safe=True,
        )

        self.assertFalse(ok)
        self.assertEqual(reason, "supplemental transition is not explicitly validator-approved")

    def test_extract_records_from_normalized_current_admin_artifact_defaults_pending(self) -> None:
        payload = {
            "records": [
                {
                    "slug": "trump-2025-high-paying-skilled-trade-jobs",
                    "title": "Prepare Americans for high-paying skilled trade jobs",
                    "promise_text": "Expand apprenticeship pathways.",
                    "actions": [],
                    "promise_sources": [],
                    "source_quality": "medium",
                }
            ]
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "normalized.json"
            path.write_text(json.dumps(payload))
            records = impact.extract_records_from_artifact(path)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["record_type"], "current_admin")
        self.assertEqual(records[0]["previous_impact_status"], "impact_pending")
        self.assertEqual(records[0]["record_key"], "trump-2025-high-paying-skilled-trade-jobs")

    def test_enrichment_validator_approves_high_quality_outcome_match(self) -> None:
        outcome_match = sample_evidence_match(
            evidence_kind="outcome_evidence",
            recommended_next_action="review_for_outcome_maturation",
            evidence_type="enforcement_outcome",
        )
        decision = enrichment.validate_record_for_enrichment(
            sample_enrichment_record(),
            sample_supplemental(
                implementation_evidence_count=0,
                outcome_evidence_count=1,
                matched_evidence_items=[outcome_match],
            ),
            {
                "previous_impact_status": "impact_review_ready",
                "recommended_impact_status": "impact_review_ready",
                "approved": True,
            },
        )

        self.assertTrue(decision["approved"])
        self.assertEqual(decision["matched_policy_id"], "111")
        self.assertEqual(decision["matched_promise_id"], "111")
        self.assertEqual(decision["eligible_evidence_count"], 1)
        self.assertEqual(len(decision["source_references"]), 1)

    def test_enrichment_validator_blocks_legal_context_only_evidence(self) -> None:
        legal_match = sample_evidence_match(
            evidence_kind="legal_context",
            recommended_next_action="judicial_context_only",
            source_family="supreme_court_orders",
        )
        decision = enrichment.validate_record_for_enrichment(
            sample_enrichment_record(),
            sample_supplemental(
                implementation_evidence_count=0,
                outcome_evidence_count=1,
                legal_context_count=1,
                matched_evidence_items=[legal_match],
            ),
            {
                "previous_impact_status": "impact_review_ready",
                "recommended_impact_status": "impact_review_ready",
                "approved": True,
            },
        )

        self.assertFalse(decision["approved"])
        self.assertIn("supplemental evidence includes legal-context matches", decision["blocked_reasons"])
        self.assertIn("no high-quality outcome-evidence match passed the enrichment validator", decision["blocked_reasons"])

    def test_impact_path_normalization_accepts_python_prefixed_paths(self) -> None:
        command = (
            f'source "{WORKFLOW_LIB}"; '
            'normalized=(); '
            'normalize_impact_path_args normalized '
            '--input python/reports/current_admin/sample.normalized.json '
            '--outcome-evidence=reports/current_admin/sample.outcome-evidence.json '
            '--csv python/reports/current_admin/sample.csv; '
            'printf "%s\\n" "${normalized[@]}"'
        )
        result = subprocess.run(
            ["bash", "-lc", command],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )

        self.assertEqual(
            result.stdout.strip().splitlines(),
            [
                "--input",
                "reports/current_admin/sample.normalized.json",
                "--outcome-evidence=reports/current_admin/sample.outcome-evidence.json",
                "--csv",
                "reports/current_admin/sample.csv",
            ],
        )


if __name__ == "__main__":
    unittest.main()
