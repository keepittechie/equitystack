#!/usr/bin/env bash

current_admin_batches_dir() {
  printf '%s/data/current_admin_batches\n' "$EQUITYSTACK_PYTHON_DIR"
}

current_admin_default_decision_template_path() {
  local batch_name="$1"
  printf '%s/%s.decision-template.json\n' "$(current_admin_reports_dir)" "$batch_name"
}

current_admin_total_discovery_candidates() {
  local discovery_path="$1"

  CURRENT_ADMIN_DISCOVERY_PATH="$discovery_path" "$VENV_PYTHON" - <<'PY'
import json
import os
from pathlib import Path

path = Path(os.environ["CURRENT_ADMIN_DISCOVERY_PATH"])
payload = json.loads(path.read_text())
total = 0
for key in ("update_candidates", "new_action_candidates", "new_promise_candidates"):
    values = payload.get(key)
    if isinstance(values, list):
        total += len(values)
print(total)
PY
}

current_admin_generate_auto_batch_name() {
  local discovery_path="$1"

  CURRENT_ADMIN_DISCOVERY_PATH="$discovery_path" "$VENV_PYTHON" - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

path = Path(os.environ["CURRENT_ADMIN_DISCOVERY_PATH"])
payload = json.loads(path.read_text())
president_slug = payload.get("president_slug") or "current-admin"
timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ").lower()
print(f"{president_slug}-discovery-{timestamp}")
PY
}

resolve_current_admin_review_target() {
  local input_path="${1:-}"
  local batch_name="${2:-}"
  local -a context_lines=()

  mapfile -t context_lines < <(
    EQUITYSTACK_PYTHON_DIR="$EQUITYSTACK_PYTHON_DIR" \
    CURRENT_ADMIN_INPUT="$input_path" \
    CURRENT_ADMIN_BATCH_NAME="$batch_name" \
    "$VENV_PYTHON" - <<'PY'
import json
import os
from pathlib import Path

python_dir = Path(os.environ["EQUITYSTACK_PYTHON_DIR"]).resolve()
reports_dir = python_dir / "reports" / "current_admin"
input_arg = os.environ.get("CURRENT_ADMIN_INPUT", "").strip()
batch_name_arg = os.environ.get("CURRENT_ADMIN_BATCH_NAME", "").strip()


def resolve_cli_input_path(raw_value: str) -> Path:
    candidate = Path(raw_value)
    if candidate.is_absolute():
        return candidate.resolve()
    candidates = [
        (python_dir / candidate).resolve(),
        (python_dir.parent / candidate).resolve(),
    ]
    for resolved in candidates:
        if resolved.exists():
            return resolved
    return candidates[0]


def latest_for_batch(name: str) -> Path | None:
    candidate = reports_dir / f"{name}.ai-review.json"
    if candidate.is_file():
        return candidate
    return None


def newest(paths):
    files = [path for path in paths if path.is_file()]
    if not files:
        return None
    return max(files, key=lambda path: path.stat().st_mtime)


if input_arg:
    review_path = resolve_cli_input_path(input_arg)
    if not review_path.exists():
        raise SystemExit(f"Review artifact not found: {review_path}")
elif batch_name_arg:
    review_path = latest_for_batch(batch_name_arg)
    if review_path is None:
        raise SystemExit(f"Could not find a review artifact for batch_name={batch_name_arg}")
else:
    review_paths = sorted(path for path in reports_dir.glob("*.ai-review.json") if path.is_file())
    if not review_paths:
        raise SystemExit("No current-admin review artifacts were found under reports/current_admin/")

    precommit_missing = []
    decision_missing = []
    for path in review_paths:
        batch = path.name.removesuffix(".ai-review.json")
        precommit_path = reports_dir / f"{batch}.pre-commit-review.json"
        decision_matches = list((reports_dir / "review_decisions").glob(f"{batch}*.decision-log.json"))
        if not precommit_path.exists():
            precommit_missing.append(path)
        if not decision_matches:
            decision_missing.append(path)

    if len(precommit_missing) == 1:
        review_path = precommit_missing[0]
    elif len(decision_missing) == 1:
        review_path = decision_missing[0]
    elif len(review_paths) == 1:
        review_path = review_paths[0]
    else:
        candidates = [path.name for path in precommit_missing or decision_missing or review_paths]
        raise SystemExit(
            "Ambiguous current-admin review artifact inference. "
            "Provide --input or --batch-name. Candidates: " + ", ".join(candidates[:10])
        )

payload = json.loads(review_path.read_text())
batch_name = payload.get("batch_name")
if not isinstance(batch_name, str) or not batch_name.strip():
    raise SystemExit(f"Review artifact missing batch_name: {review_path}")
batch_name = batch_name.strip()
print(review_path.resolve())
print(batch_name)
print((reports_dir / f"{batch_name}.decision-template.json").resolve())
print((reports_dir / f"{batch_name}.manual-review-queue.json").resolve())
PY
  )

  if [ "${#context_lines[@]}" -lt 4 ]; then
    echo "Failed to resolve current-admin review target." >&2
    exit 1
  fi

  CURRENT_ADMIN_REVIEW_TARGET_PATH="${context_lines[0]}"
  CURRENT_ADMIN_REVIEW_TARGET_BATCH_NAME="${context_lines[1]}"
  CURRENT_ADMIN_REVIEW_TARGET_DECISION_TEMPLATE="${context_lines[2]}"
  CURRENT_ADMIN_REVIEW_TARGET_QUEUE_PATH="${context_lines[3]}"
}

resolve_current_admin_apply_target() {
  local input_path="${1:-}"
  local batch_name="${2:-}"
  local -a context_lines=()

  mapfile -t context_lines < <(
    EQUITYSTACK_PYTHON_DIR="$EQUITYSTACK_PYTHON_DIR" \
    CURRENT_ADMIN_INPUT="$input_path" \
    CURRENT_ADMIN_BATCH_NAME="$batch_name" \
    "$VENV_PYTHON" - <<'PY'
import json
import os
from pathlib import Path

python_dir = Path(os.environ["EQUITYSTACK_PYTHON_DIR"]).resolve()
reports_dir = python_dir / "reports" / "current_admin"
input_arg = os.environ.get("CURRENT_ADMIN_INPUT", "").strip()
batch_name_arg = os.environ.get("CURRENT_ADMIN_BATCH_NAME", "").strip()


def resolve_cli_input_path(raw_value: str) -> Path:
    candidate = Path(raw_value)
    if candidate.is_absolute():
        return candidate.resolve()
    candidates = [
        (python_dir / candidate).resolve(),
        (python_dir.parent / candidate).resolve(),
    ]
    for resolved in candidates:
        if resolved.exists():
            return resolved
    return candidates[0]


def queue_for_batch(name: str) -> Path | None:
    candidate = reports_dir / f"{name}.manual-review-queue.json"
    if candidate.is_file():
        return candidate
    return None


if input_arg:
    queue_path = resolve_cli_input_path(input_arg)
    if not queue_path.exists():
        raise SystemExit(f"Manual review queue not found: {queue_path}")
elif batch_name_arg:
    queue_path = queue_for_batch(batch_name_arg)
    if queue_path is None:
        raise SystemExit(f"Could not find a manual review queue for batch_name={batch_name_arg}")
else:
    queue_paths = sorted(path for path in reports_dir.glob("*.manual-review-queue.json") if path.is_file())
    if not queue_paths:
        raise SystemExit("No current-admin manual review queue artifacts were found under reports/current_admin/")

    active = []
    pending_validation = []
    for path in queue_paths:
        batch = path.name.removesuffix(".manual-review-queue.json")
        apply_path = reports_dir / f"{batch}.import-apply.json"
        validation_path = reports_dir / f"{batch}.import-validation.json"
        if not apply_path.exists():
            active.append(path)
        elif not validation_path.exists():
            pending_validation.append(path)

    if len(active) == 1:
        queue_path = active[0]
    elif len(queue_paths) == 1:
        queue_path = queue_paths[0]
    else:
        candidates = [path.name for path in active or pending_validation or queue_paths]
        raise SystemExit(
            "Ambiguous current-admin apply target inference. "
            "Provide --input or --batch-name. Candidates: " + ", ".join(candidates[:10])
        )

payload = json.loads(queue_path.read_text())
batch_name = payload.get("batch_name")
if not isinstance(batch_name, str) or not batch_name.strip():
    raise SystemExit(f"Queue artifact missing batch_name: {queue_path}")
batch_name = batch_name.strip()
print(queue_path.resolve())
print(batch_name)
print((reports_dir / f"{batch_name}.pre-commit-review.json").resolve())
print((reports_dir / f"{batch_name}.import-dry-run.json").resolve())
print((reports_dir / f"{batch_name}.import-apply.json").resolve())
print((reports_dir / f"{batch_name}.import-validation.json").resolve())
PY
  )

  if [ "${#context_lines[@]}" -lt 6 ]; then
    echo "Failed to resolve current-admin apply target." >&2
    exit 1
  fi

  CURRENT_ADMIN_APPLY_QUEUE_PATH="${context_lines[0]}"
  CURRENT_ADMIN_APPLY_BATCH_NAME="${context_lines[1]}"
  CURRENT_ADMIN_APPLY_PRECOMMIT_PATH="${context_lines[2]}"
  CURRENT_ADMIN_APPLY_DRY_RUN_PATH="${context_lines[3]}"
  CURRENT_ADMIN_APPLY_IMPORT_APPLY_PATH="${context_lines[4]}"
  CURRENT_ADMIN_APPLY_VALIDATION_PATH="${context_lines[5]}"
}

current_admin_decision_file_status() {
  local review_path="$1"
  local decision_file="$2"

  CURRENT_ADMIN_REVIEW_PATH="$review_path" CURRENT_ADMIN_DECISION_FILE="$decision_file" "$VENV_PYTHON" - <<'PY'
import json
import os
from pathlib import Path

VALID_OPERATOR_ACTIONS = {
    "approve_as_is",
    "approve_with_changes",
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
}

review_path = Path(os.environ["CURRENT_ADMIN_REVIEW_PATH"]).resolve()
decision_file = Path(os.environ["CURRENT_ADMIN_DECISION_FILE"]).resolve()

if not decision_file.exists():
    print("missing")
    raise SystemExit(0)

payload = json.loads(decision_file.read_text())
source_review = payload.get("source_review_file")
if isinstance(source_review, str) and source_review.strip():
    try:
        if Path(source_review).resolve() != review_path:
            print("mismatch")
            raise SystemExit(0)
    except OSError:
        print("mismatch")
        raise SystemExit(0)

items = None
if isinstance(payload.get("items"), list):
    items = payload["items"]
elif isinstance(payload.get("decisions"), dict):
    items = list(payload["decisions"].values())
else:
    print("invalid")
    raise SystemExit(0)

if not items:
    print("invalid")
    raise SystemExit(0)

invalid = 0
counts = {
    "approve_as_is": 0,
    "approve_with_changes": 0,
    "manual_review_required": 0,
    "needs_more_sources": 0,
    "defer": 0,
    "reject": 0,
    "escalate": 0,
}
for item in items:
    if not isinstance(item, dict):
        invalid += 1
        continue
    action = str(item.get("operator_action") or "").strip()
    if action not in VALID_OPERATOR_ACTIONS:
        invalid += 1
        continue
    counts[action] += 1

if invalid:
    print("invalid")
    raise SystemExit(0)

print("ready")
print(sum(counts.values()))
for key in (
    "approve_as_is",
    "approve_with_changes",
    "manual_review_required",
    "needs_more_sources",
    "defer",
    "reject",
    "escalate",
):
    print(f"{key}={counts[key]}")
PY
}

print_current_admin_run_summary() {
  local batch_path="$1"
  local discovery_path="${2:-}"

  EQUITYSTACK_PYTHON_DIR="$EQUITYSTACK_PYTHON_DIR" \
  CURRENT_ADMIN_BATCH_PATH="$batch_path" \
  CURRENT_ADMIN_DISCOVERY_PATH="$discovery_path" \
  "$VENV_PYTHON" - <<'PY'
import json
import os
from pathlib import Path

python_dir = Path(os.environ["EQUITYSTACK_PYTHON_DIR"]).resolve()
repo_root = python_dir.parent
batch_path = Path(os.environ["CURRENT_ADMIN_BATCH_PATH"]).resolve()
discovery_value = os.environ.get("CURRENT_ADMIN_DISCOVERY_PATH", "").strip()
discovery_path = Path(discovery_value).resolve() if discovery_value else None


def repo_relative(path: Path | None) -> str:
    if path is None:
        return "n/a"
    try:
        return str(path.relative_to(repo_root))
    except ValueError:
        try:
            return str(path.relative_to(python_dir))
        except ValueError:
            return str(path)


batch_payload = json.loads(batch_path.read_text())
batch_name = batch_payload.get("batch_name") or batch_path.stem
reports_dir = python_dir / "reports" / "current_admin"
normalized_path = reports_dir / f"{batch_name}.normalized.json"
review_path = reports_dir / f"{batch_name}.ai-review.json"
queue_path = reports_dir / f"{batch_name}.manual-review-queue.json"

discovered_count = None
if discovery_path and discovery_path.exists():
    discovery_payload = json.loads(discovery_path.read_text())
    discovered_count = sum(
        len(discovery_payload.get(key) or [])
        for key in ("update_candidates", "new_action_candidates", "new_promise_candidates")
    )

queue_count = None
pending_count = None
if queue_path.exists():
    queue_payload = json.loads(queue_path.read_text())
    items = queue_payload.get("items") or []
    queue_count = len(items)
    pending_count = sum(1 for item in items if isinstance(item, dict) and item.get("operator_status") == "pending")

print()
print("OPERATOR SUMMARY")
print(f"BATCH: {batch_name}")
print(f"BATCH FILE: {repo_relative(batch_path)}")
if discovered_count is not None:
    print(f"DISCOVERED ITEMS: {discovered_count}")
if queue_count is not None:
    print(f"QUEUED ITEMS: {queue_count}")
if pending_count is not None:
    print(f"MANUAL REVIEW ITEMS: {pending_count}")
print("ARTIFACTS:")
print(f"  - {repo_relative(normalized_path)}")
print(f"  - {repo_relative(review_path)}")
print(f"  - {repo_relative(queue_path)}")
print("CURRENT STATE: REVIEW_READY")
print(f"RECOMMENDED COMMAND: ./bin/equitystack current-admin review --input {repo_relative(review_path)}")
PY
}

print_current_admin_review_summary() {
  local review_path="$1"
  local decision_file="$2"
  local decision_log="$3"
  local finalized="${4:-false}"

  EQUITYSTACK_PYTHON_DIR="$EQUITYSTACK_PYTHON_DIR" \
  CURRENT_ADMIN_REVIEW_PATH="$review_path" \
  CURRENT_ADMIN_DECISION_FILE="$decision_file" \
  CURRENT_ADMIN_DECISION_LOG="$decision_log" \
  CURRENT_ADMIN_FINALIZED="$finalized" \
  "$VENV_PYTHON" - <<'PY'
import json
import os
from pathlib import Path

python_dir = Path(os.environ["EQUITYSTACK_PYTHON_DIR"]).resolve()
repo_root = python_dir.parent
review_path = Path(os.environ["CURRENT_ADMIN_REVIEW_PATH"]).resolve()
decision_file = Path(os.environ["CURRENT_ADMIN_DECISION_FILE"]).resolve()
decision_log = Path(os.environ["CURRENT_ADMIN_DECISION_LOG"]).resolve()
finalized = os.environ.get("CURRENT_ADMIN_FINALIZED") == "true"


def repo_relative(path: Path) -> str:
    try:
        return str(path.relative_to(repo_root))
    except ValueError:
        try:
            return str(path.relative_to(python_dir))
        except ValueError:
            return str(path)


review_payload = json.loads(review_path.read_text())
batch_name = review_payload.get("batch_name") or review_path.name.removesuffix(".ai-review.json")
queue_path = python_dir / "reports" / "current_admin" / f"{batch_name}.manual-review-queue.json"

print()
print("OPERATOR SUMMARY")
print(f"REVIEW ARTIFACT: {repo_relative(review_path)}")
print(f"DECISION FILE: {repo_relative(decision_file)}")

if finalized and decision_log.exists():
    payload = json.loads(decision_log.read_text())
    counts = {}
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        action = str(item.get("operator_action") or "").strip()
        if not action:
            continue
        counts[action] = int(counts.get(action) or 0) + 1
    approved = int(counts.get("approve_as_is") or 0) + int(counts.get("approve_with_changes") or 0)
    rejected = int(counts.get("reject") or 0)
    deferred = int(counts.get("defer") or 0)
    print(f"DECISION LOG: {repo_relative(decision_log)}")
    print(f"APPROVED: {approved}")
    print(f"REJECTED: {rejected}")
    print(f"DEFERRED: {deferred}")
    print("CURRENT STATE: PRECOMMIT_READY")
    print(f"RECOMMENDED COMMAND: ./bin/equitystack current-admin apply --input {repo_relative(queue_path)}")
else:
    print("CURRENT STATE: REVIEW_READY")
    print("NEXT STEP: Fill explicit operator_action values in the decision file, then rerun current-admin review.")
    print(f"RECOMMENDED COMMAND: ./bin/equitystack current-admin review --input {repo_relative(review_path)} --decision-file {repo_relative(decision_file)}")
PY
}

print_current_admin_apply_summary() {
  local queue_path="$1"
  local precommit_path="$2"
  local dry_run_path="$3"
  local apply_path="$4"
  local validation_path="$5"
  local apply_ran="${6:-false}"

  EQUITYSTACK_PYTHON_DIR="$EQUITYSTACK_PYTHON_DIR" \
  CURRENT_ADMIN_QUEUE_PATH="$queue_path" \
  CURRENT_ADMIN_PRECOMMIT_PATH="$precommit_path" \
  CURRENT_ADMIN_DRY_RUN_PATH="$dry_run_path" \
  CURRENT_ADMIN_IMPORT_APPLY_PATH="$apply_path" \
  CURRENT_ADMIN_VALIDATION_PATH="$validation_path" \
  CURRENT_ADMIN_APPLY_RAN="$apply_ran" \
  "$VENV_PYTHON" - <<'PY'
import json
import os
from pathlib import Path

python_dir = Path(os.environ["EQUITYSTACK_PYTHON_DIR"]).resolve()
repo_root = python_dir.parent
queue_path = Path(os.environ["CURRENT_ADMIN_QUEUE_PATH"]).resolve()
precommit_path = Path(os.environ["CURRENT_ADMIN_PRECOMMIT_PATH"]).resolve()
dry_run_path = Path(os.environ["CURRENT_ADMIN_DRY_RUN_PATH"]).resolve()
apply_path = Path(os.environ["CURRENT_ADMIN_IMPORT_APPLY_PATH"]).resolve()
validation_path = Path(os.environ["CURRENT_ADMIN_VALIDATION_PATH"]).resolve()
apply_ran = os.environ.get("CURRENT_ADMIN_APPLY_RAN") == "true"


def repo_relative(path: Path | None) -> str:
    if path is None:
        return "n/a"
    try:
        return str(path.relative_to(repo_root))
    except ValueError:
        try:
            return str(path.relative_to(python_dir))
        except ValueError:
            return str(path)


queue_payload = json.loads(queue_path.read_text())
batch_name = queue_payload.get("batch_name") or queue_path.name.removesuffix(".manual-review-queue.json")
precommit_payload = json.loads(precommit_path.read_text()) if precommit_path.exists() else {}
precommit_status = precommit_payload.get("readiness_status") or "missing"

print()
print("OPERATOR SUMMARY")
print(f"BATCH: {batch_name}")
print(f"QUEUE: {repo_relative(queue_path)}")
print(f"PRE-COMMIT STATUS: {precommit_status}")
print(f"PRE-COMMIT ARTIFACT: {repo_relative(precommit_path)}")

if precommit_status == "blocked":
    print("CURRENT STATE: BLOCKED")
    print("NEXT STEP: Resolve the blocking issues in the pre-commit artifact, then rerun current-admin apply.")
    print(f"RECOMMENDED COMMAND: ./bin/equitystack current-admin apply --input {repo_relative(queue_path)}")
    raise SystemExit(0)

if dry_run_path.exists():
    print(f"DRY-RUN ARTIFACT: {repo_relative(dry_run_path)}")

if apply_ran and apply_path.exists():
    print(f"APPLY ARTIFACT: {repo_relative(apply_path)}")
if apply_ran and validation_path.exists():
    print(f"VALIDATION ARTIFACT: {repo_relative(validation_path)}")

if apply_ran:
    print("CURRENT STATE: COMPLETE")
    print("RECOMMENDED COMMAND: ./bin/equitystack current-admin run")
else:
    print("CURRENT STATE: PRECOMMIT_READY")
    print(f"RECOMMENDED COMMAND: ./bin/equitystack current-admin apply --input {repo_relative(queue_path)} --apply --yes")
PY
}
