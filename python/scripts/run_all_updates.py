#!/usr/bin/env python3
import sys
from pathlib import Path

from audit_future_bill_links import run_audit
from import_legislators_from_tracked_bills import run_import
from import_tracked_bills import run_sync


DEFAULT_AUDIT_PATH = Path(__file__).resolve().parents[1] / "reports" / "future_bill_link_audit.json"


def parse_args(argv: list[str]) -> tuple[str, Path | None]:
    seed_arg = "--backfill-existing"
    audit_output = DEFAULT_AUDIT_PATH

    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--skip-audit":
            audit_output = None
        elif arg == "--seed":
            if i + 1 >= len(argv):
                raise ValueError("Missing value after --seed")
            seed_arg = argv[i + 1]
            i += 1
        elif arg == "--audit-json":
            if i + 1 >= len(argv):
                raise ValueError("Missing value after --audit-json")
            audit_output = Path(argv[i + 1]).resolve()
            i += 1
        else:
            raise ValueError(f"Unknown argument: {arg}")
        i += 1

    return seed_arg, audit_output


def main() -> None:
    try:
        seed_arg, audit_output = parse_args(sys.argv[1:])
    except ValueError as error:
        print(f"Argument error: {error}", file=sys.stderr)
        print(
            "Usage: python3 scripts/run_all_updates.py "
            "[--seed data/tracked_bills_seed.json] [--audit-json reports/future_bill_link_audit.json] [--skip-audit]",
            file=sys.stderr,
        )
        sys.exit(1)

    if audit_output:
        audit_output.parent.mkdir(parents=True, exist_ok=True)

    print("Step 1 of 3: syncing tracked bills")
    tracked_rows = run_sync(seed_arg)
    print(f"Tracked bill sync complete. Rows synced: {tracked_rows}")

    print("\nStep 2 of 3: syncing legislators and scorecard snapshots")
    import_results = run_import()
    print(
        "Legislator sync complete. "
        f"Legislators touched: {import_results['legislators_touched']} | "
        f"Roles inserted: {import_results['tracked_bill_roles_inserted']} | "
        f"Future positions inserted: {import_results['future_bill_positions_inserted']} | "
        f"Snapshots inserted: {import_results['scorecard_snapshots_inserted']}"
    )

    if audit_output is not None:
        print("\nStep 3 of 3: auditing future-bill link quality")
        audited_rows = run_audit(audit_output)
        high_risk = sum(1 for row in audited_rows if row["risk_level"] == "high")
        medium_risk = sum(1 for row in audited_rows if row["risk_level"] == "medium")
        print(
            f"Audit complete. Total links: {len(audited_rows)} | "
            f"High risk: {high_risk} | Medium risk: {medium_risk}"
        )
        print(f"Audit report written to {audit_output}")
    else:
        print("\nStep 3 of 3: audit skipped")

    print("\nAll update steps completed.")


if __name__ == "__main__":
    main()
