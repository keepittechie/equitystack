#!/usr/bin/env python3
import argparse
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from current_admin_common import derive_csv_path, normalize_nullable_text, print_json, write_csv_rows, write_json_file
from discover_current_admin_updates import DEFAULT_PRESIDENT_SLUG, fetch_default_live_source_items, sort_and_limit_feed_items


DEFAULT_SOURCE_CONFIG = Path(__file__).resolve().parents[1] / "config" / "judicial_impact_sources.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scaffold judicial-impact candidate discovery without writes or scoring activation.")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "reports" / "judicial_impact_candidates.json")
    parser.add_argument("--source-config", type=Path, default=DEFAULT_SOURCE_CONFIG)
    parser.add_argument("--disable-default-sources", action="store_true")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--max-feed-items", type=int, default=20)
    parser.add_argument(
        "--csv",
        nargs="?",
        const="",
        help="Optionally write a CSV summary. Pass a path or omit the value to derive one from --output.",
    )
    return parser.parse_args()


def current_timestamp() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def build_csv_rows(items: list[dict]) -> list[dict]:
    return [
        {
            "candidate_id": item.get("candidate_id"),
            "title": item.get("title"),
            "published_at": item.get("published_at"),
            "source_name": item.get("source_name"),
            "source_url": item.get("source_url"),
            "legal_status": item.get("legal_status"),
            "court_or_agency": item.get("court_or_agency"),
            "docket_number": item.get("docket_number"),
            "attribution_ready": item.get("attribution_ready"),
        }
        for item in items
    ]


def main() -> None:
    args = parse_args()
    fetch_args = SimpleNamespace(
        disable_default_sources=args.disable_default_sources,
        source_config=args.source_config.resolve(),
        president_slug=DEFAULT_PRESIDENT_SLUG,
        max_feed_items=args.max_feed_items,
        timeout=args.timeout,
    )
    feed_items, feed_errors, source_results = fetch_default_live_source_items(fetch_args)
    feed_items = sort_and_limit_feed_items(feed_items, args.max_feed_items)

    items = []
    for index, feed_item in enumerate(feed_items, start=1):
        items.append(
            {
                "candidate_id": f"judicial:{index}",
                "title": normalize_nullable_text(feed_item.get("title")),
                "published_at": normalize_nullable_text(feed_item.get("published_at")),
                "source_name": normalize_nullable_text(feed_item.get("source_name")),
                "source_url": normalize_nullable_text(feed_item.get("url")),
                "summary": normalize_nullable_text(feed_item.get("summary")),
                "legal_status": normalize_nullable_text(feed_item.get("legal_status")) or "unknown",
                "court_or_agency": normalize_nullable_text(feed_item.get("court_or_agency")),
                "docket_number": normalize_nullable_text(feed_item.get("docket_number")),
                "court_level": "Supreme Court" if "supreme court" in (normalize_nullable_text(feed_item.get("court_or_agency")) or "").lower() else None,
                "majority_justices": [],
                "appointing_presidents": [],
                "judicial_attribution": [],
                "judicial_weight": None,
                "attribution_ready": False,
                "activation_status": "scaffold_only",
                "required_metadata_before_activation": [
                    "linked_policy_id_or_slug",
                    "majority_justices",
                    "appointing_presidents",
                    "judicial_attribution",
                ],
            }
        )

    output = {
        "artifact_version": 1,
        "generated_at": current_timestamp(),
        "workflow": "judicial_impact_candidate_discovery",
        "activation_status": "scaffold_only",
        "source_config": str(args.source_config.resolve()),
        "summary": {
            "candidate_count": len(items),
            "feed_errors": len(feed_errors),
        },
        "source_results": source_results,
        "feed_errors": feed_errors,
        "items": items,
        "operator_guidance": "Judicial impact remains scaffold-only. No scoring or writes are enabled until attribution metadata is complete.",
    }
    output_path = args.output.resolve()
    write_json_file(output_path, output)
    csv_path = derive_csv_path(args.csv, output_path)
    if csv_path:
        write_csv_rows(csv_path, build_csv_rows(items))
    print_json(output)


if __name__ == "__main__":
    main()
