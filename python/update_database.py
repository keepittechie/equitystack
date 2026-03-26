#!/usr/bin/env python3
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from import_audit import import_file as import_enrichment_file
from import_policies import import_file as import_policy_file
from run_all_updates import main as run_legislative_refresh


def print_usage() -> None:
    print(
        "Usage:\n"
        "  python3 update_database.py\n"
        "  python3 update_database.py refresh [--seed data/tracked_bills_seed.json] [--skip-audit]\n"
        "  python3 update_database.py import-policy-pack data/policies/file.json\n"
        "  python3 update_database.py import-enrichment data/policies/file.json\n"
        "  python3 update_database.py help"
    )


def resolve_input_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        path = (Path(__file__).resolve().parent / path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    return path


def main() -> None:
    if len(sys.argv) == 1:
        run_legislative_refresh()
        return

    command = sys.argv[1].strip().lower()

    if command in {"help", "-h", "--help"}:
        print_usage()
        return

    if command == "refresh":
        sys.argv = [sys.argv[0], *sys.argv[2:]]
        run_legislative_refresh()
        return

    if command == "import-policy-pack":
        if len(sys.argv) != 3:
            print_usage()
            sys.exit(1)
        file_path = resolve_input_path(sys.argv[2])
        import_policy_file(file_path)
        return

    if command == "import-enrichment":
        if len(sys.argv) != 3:
            print_usage()
            sys.exit(1)
        file_path = resolve_input_path(sys.argv[2])
        import_enrichment_file(file_path)
        return

    print(f"Unknown command: {command}", file=sys.stderr)
    print_usage()
    sys.exit(1)


if __name__ == "__main__":
    main()
