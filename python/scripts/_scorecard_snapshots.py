from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

SNAPSHOT_LABEL = "Current"

ROLE_WEIGHTS = {
    "Primary Sponsor": 1.0,
    "Cosponsor": 0.4,
    "Committee Chair": 0.75,
    "Committee Member": 0.5,
}

PRIORITY_POINTS = {
    "Critical": 5.0,
    "High": 4.0,
    "Medium": 3.0,
    "Low": 2.0,
}

STATUS_MULTIPLIERS = {
    "Enacted": 1.5,
    "Signed into law": 1.5,
    "Became law": 1.5,
    "Passed House": 1.25,
    "Passed Senate": 1.25,
    "Passed Congress": 1.35,
    "To President": 1.3,
    "Reported": 1.15,
    "Ordered Reported": 1.15,
    "Committee": 1.1,
    "Referred": 1.05,
    "Introduced": 1.0,
}

BLOCKED_STATUS_KEYWORDS = (
    "failed",
    "veto",
    "tabled",
    "rejected",
    "not passed",
    "withdrawn",
    "dead",
)


def normalize_status_multiplier(status: str | None) -> float:
    text = (status or "").strip()
    if not text:
        return 1.0

    if text in STATUS_MULTIPLIERS:
        return STATUS_MULTIPLIERS[text]

    lowered = text.lower()
    for keyword, multiplier in (
        ("enacted", 1.5),
        ("signed", 1.5),
        ("became law", 1.5),
        ("passed", 1.25),
        ("reported", 1.15),
        ("committee", 1.1),
        ("referred", 1.05),
        ("introduced", 1.0),
    ):
        if keyword in lowered:
            return multiplier

    return 1.0


def is_blocked_status(status: str | None) -> bool:
    lowered = (status or "").lower()
    return any(keyword in lowered for keyword in BLOCKED_STATUS_KEYWORDS)


@dataclass
class BillScoreRecord:
    tracked_bill_id: int
    role: str | None
    bill_status: str | None
    introduced_date: date | None
    latest_action_date: date | None
    future_bill_ids: set[int] = field(default_factory=set)
    priority_levels: set[str] = field(default_factory=set)

    def compute_score(self) -> float:
        role_weight = ROLE_WEIGHTS.get(self.role or "", 0.3)
        priority_points = max(
            (PRIORITY_POINTS.get(level, 2.5) for level in self.priority_levels),
            default=2.5,
        )
        status_multiplier = normalize_status_multiplier(self.bill_status)
        return round(priority_points * role_weight * status_multiplier * 4, 2)


def build_bill_score_rows(cursor):
    cursor.execute(
        """
        SELECT
          ltr.legislator_id,
          ltr.tracked_bill_id,
          ltr.role,
          tb.bill_status,
          tb.introduced_date,
          tb.latest_action_date,
          fbl.future_bill_id,
          fb.priority_level
        FROM legislator_tracked_bill_roles ltr
        JOIN tracked_bills tb
          ON tb.id = ltr.tracked_bill_id
        LEFT JOIN future_bill_links fbl
          ON fbl.tracked_bill_id = tb.id
        LEFT JOIN future_bills fb
          ON fb.id = fbl.future_bill_id
        ORDER BY ltr.legislator_id ASC, ltr.tracked_bill_id ASC
        """
    )
    rows = cursor.fetchall()

    grouped: dict[int, dict[int, BillScoreRecord]] = defaultdict(dict)

    for row in rows:
        legislator_bucket = grouped[row["legislator_id"]]
        tracked_bill_id = int(row["tracked_bill_id"])

        if tracked_bill_id not in legislator_bucket:
            legislator_bucket[tracked_bill_id] = BillScoreRecord(
                tracked_bill_id=tracked_bill_id,
                role=row.get("role"),
                bill_status=row.get("bill_status"),
                introduced_date=row.get("introduced_date"),
                latest_action_date=row.get("latest_action_date"),
            )

        bill_record = legislator_bucket[tracked_bill_id]

        if row.get("future_bill_id"):
            bill_record.future_bill_ids.add(int(row["future_bill_id"]))
        if row.get("priority_level"):
            bill_record.priority_levels.add(row["priority_level"])

    return grouped


def replace_snapshots(cursor) -> int:
    grouped_rows = build_bill_score_rows(cursor)

    cursor.execute(
        "DELETE FROM legislator_scorecard_snapshots WHERE snapshot_label = %s",
        (SNAPSHOT_LABEL,),
    )

    inserted = 0

    for legislator_id, bill_rows in grouped_rows.items():
        bill_values = list(bill_rows.values())
        total_tracked_bills = len(bill_values)
        sponsored_bill_count = sum(1 for bill in bill_values if bill.role == "Primary Sponsor")
        cosponsored_bill_count = sum(1 for bill in bill_values if bill.role == "Cosponsor")
        positive_bill_count = total_tracked_bills
        negative_bill_count = 0
        mixed_bill_count = 0
        blocked_bill_count = sum(
            1 for bill in bill_values if is_blocked_status(bill.bill_status)
        )
        direct_black_impact_bill_count = sum(
            1 for bill in bill_values if bill.future_bill_ids
        )

        bill_scores = [bill.compute_score() for bill in bill_values]
        avg_policy_impact_score = (
            round(sum(bill_scores) / len(bill_scores), 2) if bill_scores else None
        )
        net_weighted_impact = round(sum(bill_scores), 2) if bill_scores else None

        introduced_dates = [bill.introduced_date for bill in bill_values if bill.introduced_date]
        latest_dates = [bill.latest_action_date for bill in bill_values if bill.latest_action_date]
        scoring_window_start = min(introduced_dates) if introduced_dates else None
        scoring_window_end = max(latest_dates) if latest_dates else None

        score_notes = (
            "Current snapshot uses tracked reform bills only. "
            "Scores weight primary sponsorship more than cosponsorship, "
            "increase with higher-priority future-bill matches, and give "
            "additional credit to bills that advanced beyond introduction."
        )

        cursor.execute(
            """
            INSERT INTO legislator_scorecard_snapshots (
              legislator_id,
              snapshot_label,
              scoring_window_start,
              scoring_window_end,
              total_tracked_bills,
              sponsored_bill_count,
              cosponsored_bill_count,
              positive_bill_count,
              negative_bill_count,
              mixed_bill_count,
              blocked_bill_count,
              direct_black_impact_bill_count,
              avg_policy_impact_score,
              net_weighted_impact,
              score_notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                legislator_id,
                SNAPSHOT_LABEL,
                scoring_window_start,
                scoring_window_end,
                total_tracked_bills,
                sponsored_bill_count,
                cosponsored_bill_count,
                positive_bill_count,
                negative_bill_count,
                mixed_bill_count,
                blocked_bill_count,
                direct_black_impact_bill_count,
                avg_policy_impact_score,
                net_weighted_impact,
                score_notes,
            ),
        )
        inserted += 1

    return inserted
