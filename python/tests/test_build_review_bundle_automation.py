import sys
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_review_bundle  # noqa: E402


def sample_manual_item(**overrides):
    item = {
        "future_bill_id": 1,
        "future_bill_link_id": 11,
        "tracked_bill_id": 50,
        "bill_number": "H.R. 1",
        "tracked_bill_title": "Sample Bill",
        "review_state": "actionable",
        "status": "pending",
        "apply_result": None,
        "final_decision": "review_manually",
        "llm_decision": "review_manually",
        "llm_confidence": 0.6,
        "problem_alignment": 1,
        "solution_alignment": 1,
        "population_alignment": 1,
        "mechanism_specificity": 1,
        "evidence_strength": 1,
        "total_score": 6,
        "heuristic_flags": {},
        "signal_conflicts": [],
        "original_link_type": "Direct",
    }
    item.update(overrides)
    return item


class BuildReviewBundleAutomationTests(unittest.TestCase):
    def test_cross_domain_mismatch_auto_dismisses(self) -> None:
        item = sample_manual_item(
            total_score=2,
            problem_alignment=0,
            population_alignment=0,
            solution_alignment=0,
            mechanism_specificity=0,
            evidence_strength=0,
            heuristic_flags={"issue_domain_mismatch": True},
        )

        result = build_review_bundle.manual_review_bucket(item)

        self.assertEqual(result["bucket"], "auto_dismiss")

    def test_gray_zone_match_stays_manual_review(self) -> None:
        item = sample_manual_item(
            total_score=6,
            problem_alignment=1,
            population_alignment=2,
            solution_alignment=0,
            mechanism_specificity=0,
            evidence_strength=0,
            llm_confidence=0.45,
        )

        result = build_review_bundle.manual_review_bucket(item)

        self.assertEqual(result["bucket"], "manual_review")

    def test_plausible_partial_becomes_auto_partial(self) -> None:
        item = sample_manual_item(
            total_score=8,
            llm_confidence=0.62,
            problem_alignment=1,
            solution_alignment=1,
            population_alignment=2,
            mechanism_specificity=1,
            evidence_strength=1,
        )

        result = build_review_bundle.manual_review_bucket(item)

        self.assertEqual(result["bucket"], "auto_partial")

    def test_strong_alignment_becomes_auto_direct(self) -> None:
        item = sample_manual_item(
            total_score=11,
            llm_confidence=0.9,
            problem_alignment=2,
            solution_alignment=2,
            population_alignment=2,
            mechanism_specificity=2,
            evidence_strength=2,
            original_link_type="Partial",
        )

        result = build_review_bundle.manual_review_bucket(item)

        self.assertEqual(result["bucket"], "auto_direct")

    def test_resolved_state_never_reenters_manual_review(self) -> None:
        item = sample_manual_item(
            review_state="already_applied",
            status="applied",
            apply_result="applied",
        )

        result = build_review_bundle.manual_review_bucket(item)

        self.assertEqual(result["bucket"], "resolved")

    def test_keyword_only_overlap_auto_dismisses(self) -> None:
        item = sample_manual_item(
            total_score=3,
            llm_confidence=0.3,
            problem_alignment=1,
            population_alignment=1,
            solution_alignment=0,
            mechanism_specificity=0,
            evidence_strength=0,
            heuristic_flags={
                "weak_title_evidence": True,
                "missing_summary_low_overlap": True,
                "weak_evidence": True,
            },
            signal_conflicts=["topic overlap without mechanism overlap"],
        )

        result = build_review_bundle.manual_review_bucket(item)

        self.assertEqual(result["bucket"], "auto_dismiss")

    def test_mixed_batch_populates_all_buckets(self) -> None:
        group = build_review_bundle.future_bill_group_template(1)
        group["current_links"] = [
            {"future_bill_link_id": 11, "tracked_bill_id": 50, "link_type": "Direct"},
            {"future_bill_link_id": 12, "tracked_bill_id": 51, "link_type": "Direct"},
            {"future_bill_link_id": 13, "tracked_bill_id": 52, "link_type": "Partial"},
            {"future_bill_link_id": 14, "tracked_bill_id": 53, "link_type": "Direct"},
        ]
        group["manual_review_queue"] = [
            sample_manual_item(
                future_bill_link_id=11,
                tracked_bill_id=50,
                total_score=2,
                problem_alignment=0,
                population_alignment=0,
                solution_alignment=0,
                mechanism_specificity=0,
                evidence_strength=0,
                heuristic_flags={"issue_domain_mismatch": True},
            ),
            sample_manual_item(
                future_bill_link_id=12,
                tracked_bill_id=51,
                total_score=8,
                llm_confidence=0.65,
                problem_alignment=1,
                solution_alignment=1,
                population_alignment=2,
                mechanism_specificity=1,
                evidence_strength=1,
            ),
            sample_manual_item(
                future_bill_link_id=13,
                tracked_bill_id=52,
                total_score=11,
                llm_confidence=0.92,
                problem_alignment=2,
                solution_alignment=2,
                population_alignment=2,
                mechanism_specificity=2,
                evidence_strength=2,
                original_link_type="Partial",
            ),
            sample_manual_item(
                future_bill_link_id=14,
                tracked_bill_id=53,
                total_score=6,
                llm_confidence=0.45,
                problem_alignment=1,
                population_alignment=2,
                solution_alignment=0,
                mechanism_specificity=0,
                evidence_strength=0,
            ),
            sample_manual_item(
                future_bill_link_id=15,
                tracked_bill_id=54,
                review_state="already_applied",
                status="applied",
                apply_result="already_applied",
            ),
        ]

        build_review_bundle.reconcile_manual_review_queue(group)

        self.assertEqual(group["automation_counts"]["auto_dismiss"], 1)
        self.assertEqual(group["automation_counts"]["auto_partial"], 1)
        self.assertEqual(group["automation_counts"]["auto_direct"], 1)
        self.assertEqual(group["automation_counts"]["manual_review"], 1)
        self.assertEqual(group["automation_counts"]["resolved"], 1)
        self.assertEqual(
            sorted(action["action_type"] for action in group["_pending_actions"]),
            ["convert_to_direct", "convert_to_partial", "remove_direct_link"],
        )
        actionable_manual_items = [
            item for item in group["manual_review_queue"] if str(item.get("review_state") or "") == "actionable"
        ]
        self.assertEqual(len(actionable_manual_items), 1)


if __name__ == "__main__":
    unittest.main()
