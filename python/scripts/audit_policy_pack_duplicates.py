#!/usr/bin/env python3
import json
import sys
from collections import defaultdict
from pathlib import Path


def get_policy_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "policies"


def load_full_pack_rows(policy_dir: Path):
    rows = []
    for path in sorted(policy_dir.glob("*.json")):
        if path.name.startswith("enrichment_"):
            continue
        data = json.loads(path.read_text())
        for record in data:
            rows.append(
                {
                    "title": str(record["title"]).strip(),
                    "year_enacted": int(record["year_enacted"]),
                    "file": path.name,
                }
            )
    return rows


def build_duplicates(rows):
    grouped = defaultdict(list)
    for row in rows:
        grouped[(row["title"], row["year_enacted"])].append(row["file"])

    duplicates = []
    for (title, year_enacted), files in sorted(grouped.items(), key=lambda item: (item[0][1], item[0][0])):
        unique_files = sorted(set(files))
        if len(unique_files) > 1:
            duplicates.append(
                {
                    "title": title,
                    "year_enacted": year_enacted,
                    "files": unique_files,
                }
            )

    return duplicates


def print_report(duplicates):
    print("Policy Pack Duplicate Audit")
    print(f"Duplicate title-year groups: {len(duplicates)}")

    if not duplicates:
        print("\nNo duplicate title-year groups found.")
        return

    print("\nDuplicate groups:")
    for row in duplicates:
        print(f"- {row['year_enacted']} | {row['title']}")
        print(f"  Files: {', '.join(row['files'])}")


def write_json_report(path: Path, duplicates):
    payload = {
        "duplicate_groups": duplicates,
        "duplicate_group_count": len(duplicates),
    }
    path.write_text(json.dumps(payload, indent=2))


def main():
    output_path = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else None

    if len(sys.argv) > 2:
        print("Usage: python3 scripts/audit_policy_pack_duplicates.py [output.json]", file=sys.stderr)
        sys.exit(1)

    duplicates = build_duplicates(load_full_pack_rows(get_policy_dir()))
    print_report(duplicates)

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        write_json_report(output_path, duplicates)
        print(f"\nWrote JSON report to {output_path}")


if __name__ == "__main__":
    main()
