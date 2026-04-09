import sys
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import apply_review_bundle  # noqa: E402
import repair_review_bundle  # noqa: E402


def sample_action(action_id: str, action_type: str, payload: dict, *, future_bill_id: int = 1, approved: bool = True) -> dict:
    return {
        "action_id": action_id,
        "action_type": action_type,
        "future_bill_id": future_bill_id,
        "approved": approved,
        "status": "pending",
        "review_state": "actionable",
        "payload": payload,
    }


class ApplyReviewBundleTests(unittest.TestCase):
    def test_convert_to_direct_applies_when_target_exists(self) -> None:
        action = sample_action(
            "direct:1:11",
            "convert_to_direct",
            {"future_bill_link_id": 11, "new_link_type": "Direct", "notes": "strong alignment"},
        )
        prior = {
            "id": 11,
            "future_bill_id": 1,
            "tracked_bill_id": 50,
            "link_type": "Partial",
        }

        with (
            patch.object(apply_review_bundle, "fetch_future_bill_link", return_value=prior),
            patch.object(apply_review_bundle, "update_future_bill_link") as update_mock,
            patch.object(apply_review_bundle, "insert_operator_log") as log_mock,
        ):
            result = apply_review_bundle.apply_convert_to_direct(object(), action, Path("/tmp/review-bundle.json"))

        self.assertEqual(result["result"], "applied")
        self.assertEqual(result["new_link_type"], "Direct")
        update_args, _ = update_mock.call_args
        self.assertEqual(update_args[1:], (11, "Direct", "strong alignment"))
        log_mock.assert_called_once()

    def test_remove_direct_link_applies_when_target_exists(self) -> None:
        action = sample_action("remove:1:11", "remove_direct_link", {"future_bill_link_id": 11})
        prior = {
            "id": 11,
            "future_bill_id": 1,
            "tracked_bill_id": 50,
            "link_type": "Direct",
        }

        with (
            patch.object(apply_review_bundle, "fetch_future_bill_link", return_value=prior),
            patch.object(apply_review_bundle, "delete_future_bill_link") as delete_mock,
            patch.object(apply_review_bundle, "insert_operator_log") as log_mock,
        ):
            result = apply_review_bundle.apply_remove_direct_link(object(), action, Path("/tmp/review-bundle.json"))

        self.assertEqual(result["result"], "applied")
        self.assertEqual(result["future_bill_link_id"], 11)
        delete_mock.assert_called_once()
        log_mock.assert_called_once()

    def test_remove_direct_link_skips_when_target_already_absent(self) -> None:
        action = sample_action("remove:1:11", "remove_direct_link", {"future_bill_link_id": 11})

        with (
            patch.object(apply_review_bundle, "fetch_future_bill_link", return_value=None),
            patch.object(apply_review_bundle, "delete_future_bill_link") as delete_mock,
            patch.object(apply_review_bundle, "insert_operator_log") as log_mock,
        ):
            result = apply_review_bundle.apply_remove_direct_link(object(), action, Path("/tmp/review-bundle.json"))

        self.assertEqual(result["result"], "skipped_already_absent")
        self.assertEqual(result["future_bill_link_id"], 11)
        self.assertIn("already absent", result["message"])
        delete_mock.assert_not_called()
        log_mock.assert_called_once()

    def test_mixed_actions_continue_after_stale_remove(self) -> None:
        remove_action = sample_action("remove:1:11", "remove_direct_link", {"future_bill_link_id": 11})
        create_action = sample_action(
            "create:1:77",
            "create_partial_link",
            {"future_bill_id": 1, "tracked_bill_id": 77, "notes": "repair"},
        )

        with (
            patch.object(apply_review_bundle, "fetch_future_bill_link", return_value=None),
            patch.object(apply_review_bundle, "insert_operator_log"),
            patch.object(apply_review_bundle, "find_existing_link", return_value=None),
            patch.object(apply_review_bundle, "insert_partial_link", return_value=222),
        ):
            remove_result = apply_review_bundle.apply_remove_direct_link(
                object(), remove_action, Path("/tmp/review-bundle.json")
            )
            create_result = apply_review_bundle.apply_create_partial_link(
                object(), create_action, Path("/tmp/review-bundle.json")
            )

        applied_actions = []
        skipped_actions = []
        created_links = []
        updated_links = []
        deleted_links = []

        apply_review_bundle.record_db_action_result(
            remove_action,
            remove_result,
            applied_actions=applied_actions,
            skipped_actions=skipped_actions,
            created_links=created_links,
            updated_links=updated_links,
            deleted_links=deleted_links,
        )
        apply_review_bundle.record_db_action_result(
            create_action,
            create_result,
            applied_actions=applied_actions,
            skipped_actions=skipped_actions,
            created_links=created_links,
            updated_links=updated_links,
            deleted_links=deleted_links,
        )

        self.assertEqual(len(skipped_actions), 1)
        self.assertEqual(skipped_actions[0]["result"], "skipped_already_absent")
        self.assertEqual(len(applied_actions), 1)
        self.assertEqual(applied_actions[0]["result"], "applied")
        self.assertEqual(created_links[0]["future_bill_link_id"], 222)


class RepairReviewBundleTests(unittest.TestCase):
    def test_repair_resolves_stale_remove_direct_link(self) -> None:
        bundle = {
            "generated_at": "2026-04-09T00:00:00+00:00",
            "future_bill_groups": [
                {
                    "future_bill_id": 1,
                    "manual_review_queue": [],
                    "operator_actions": [
                        sample_action("remove:1:11", "remove_direct_link", {"future_bill_link_id": 11})
                    ],
                }
            ],
            "pending_actions_index": [
                sample_action("remove:1:11", "remove_direct_link", {"future_bill_link_id": 11})
            ],
        }
        manual_queue = {
            "generated_at": "2026-04-09T00:00:00+00:00",
            "items": [],
            "manual_review_count": 0,
        }
        live_state = {
            "future_bill_ids": {1},
            "tracked_bill_ids": set(),
            "links_by_id": {},
            "links_by_pair": {},
        }

        repaired_bundle, repaired_queue, report = repair_review_bundle.repair_bundle_state(
            bundle,
            manual_queue,
            live_state,
            repair_time="2026-04-09T01:00:00+00:00",
        )

        action = repaired_bundle["future_bill_groups"][0]["operator_actions"][0]
        self.assertEqual(action["review_state"], "already_applied")
        self.assertEqual(action["status"], "applied")
        self.assertEqual(action["apply_result"], "skipped_already_absent")
        self.assertEqual(repaired_bundle["summary"]["items_requiring_operator_action"], 0)
        self.assertEqual(len(repaired_bundle["pending_actions_index"]), 0)
        self.assertTrue(report["workflow_state_changed"])
        self.assertEqual(repaired_queue["manual_review_count"], 0)

    def test_repair_mixed_valid_and_stale_actions(self) -> None:
        bundle = {
            "generated_at": "2026-04-09T00:00:00+00:00",
            "future_bill_groups": [
                {
                    "future_bill_id": 1,
                    "manual_review_queue": [],
                    "operator_actions": [
                        sample_action("remove:1:11", "remove_direct_link", {"future_bill_link_id": 11}),
                        sample_action(
                            "create:1:77",
                            "create_partial_link",
                            {"future_bill_id": 1, "tracked_bill_id": 77},
                        ),
                    ],
                }
            ],
            "pending_actions_index": [
                sample_action("remove:1:11", "remove_direct_link", {"future_bill_link_id": 11}),
                sample_action("create:1:77", "create_partial_link", {"future_bill_id": 1, "tracked_bill_id": 77}),
            ],
        }
        manual_queue = {"generated_at": "2026-04-09T00:00:00+00:00", "items": [], "manual_review_count": 0}
        live_state = {
            "future_bill_ids": {1},
            "tracked_bill_ids": {77},
            "links_by_id": {},
            "links_by_pair": {},
        }

        repaired_bundle, _, report = repair_review_bundle.repair_bundle_state(
            bundle,
            manual_queue,
            live_state,
            repair_time="2026-04-09T01:00:00+00:00",
        )

        actions = repaired_bundle["future_bill_groups"][0]["operator_actions"]
        self.assertEqual(actions[0]["review_state"], "already_applied")
        self.assertEqual(actions[1]["review_state"], "actionable")
        self.assertEqual(repaired_bundle["summary"]["items_requiring_operator_action"], 1)
        self.assertEqual(len(repaired_bundle["pending_actions_index"]), 1)
        self.assertEqual(len(report["actions_left_active"]), 1)

    def test_repair_no_stale_actions_is_idempotent(self) -> None:
        bundle = {
            "generated_at": "2026-04-09T00:00:00+00:00",
            "future_bill_groups": [
                {
                    "future_bill_id": 1,
                    "manual_review_queue": [
                        {
                            "future_bill_id": 1,
                            "future_bill_link_id": 11,
                            "review_state": "actionable",
                        }
                    ],
                    "operator_actions": [
                        sample_action("create:1:77", "create_partial_link", {"future_bill_id": 1, "tracked_bill_id": 77})
                    ],
                }
            ],
            "pending_actions_index": [
                sample_action("create:1:77", "create_partial_link", {"future_bill_id": 1, "tracked_bill_id": 77})
            ],
        }
        manual_queue = {
            "generated_at": "2026-04-09T00:00:00+00:00",
            "items": [{"future_bill_id": 1, "future_bill_link_id": 11}],
            "manual_review_count": 1,
        }
        live_state = {
            "future_bill_ids": {1},
            "tracked_bill_ids": {77},
            "links_by_id": {11: {"id": 11, "future_bill_id": 1, "tracked_bill_id": 50, "link_type": "Direct"}},
            "links_by_pair": {},
        }

        first_bundle, first_queue, first_report = repair_review_bundle.repair_bundle_state(
            bundle,
            manual_queue,
            live_state,
            repair_time="2026-04-09T01:00:00+00:00",
        )
        second_bundle, second_queue, second_report = repair_review_bundle.repair_bundle_state(
            first_bundle,
            first_queue,
            live_state,
            repair_time="2026-04-09T02:00:00+00:00",
        )

        self.assertEqual(first_report["repaired_action_count"], 0)
        self.assertEqual(second_report["repaired_action_count"], 0)
        self.assertEqual(first_bundle["summary"]["items_requiring_operator_action"], second_bundle["summary"]["items_requiring_operator_action"])
        self.assertEqual(first_queue["manual_review_count"], second_queue["manual_review_count"])

    def test_repair_removes_stale_manual_queue_items_from_workflow_state(self) -> None:
        bundle = {
            "generated_at": "2026-04-09T00:00:00+00:00",
            "future_bill_groups": [
                {
                    "future_bill_id": 1,
                    "manual_review_queue": [
                        {"future_bill_id": 1, "future_bill_link_id": 11},
                        {"future_bill_id": 1, "future_bill_link_id": 12},
                    ],
                    "operator_actions": [],
                }
            ],
            "pending_actions_index": [],
            "summary": {"manual_review_items": 2, "items_requiring_operator_action": 0},
        }
        manual_queue = {
            "generated_at": "2026-04-09T00:00:00+00:00",
            "items": [
                {"future_bill_id": 1, "future_bill_link_id": 11},
                {"future_bill_id": 1, "future_bill_link_id": 12},
            ],
            "manual_review_count": 2,
        }
        live_state = {
            "future_bill_ids": {1},
            "tracked_bill_ids": set(),
            "links_by_id": {12: {"id": 12, "future_bill_id": 1, "tracked_bill_id": 50, "link_type": "Direct"}},
            "links_by_pair": {},
        }

        repaired_bundle, repaired_queue, report = repair_review_bundle.repair_bundle_state(
            bundle,
            manual_queue,
            live_state,
            repair_time="2026-04-09T01:00:00+00:00",
        )

        self.assertEqual(repaired_queue["manual_review_count"], 1)
        self.assertEqual(len(repaired_queue["items"]), 1)
        self.assertEqual(repaired_bundle["summary"]["manual_review_items"], 1)
        self.assertTrue(report["workflow_state_changed"])


if __name__ == "__main__":
    unittest.main()
