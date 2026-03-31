#!/usr/bin/env bash

resolve_equitystack_python_dir() {
  local search_dir="$1"

  while [ -n "$search_dir" ] && [ "$search_dir" != "/" ]; do
    if [ -f "$search_dir/run_equitystack_pipeline.py" ] && [ -d "$search_dir/scripts" ] && [ -d "$search_dir/bin" ]; then
      printf '%s\n' "$search_dir"
      return 0
    fi

    if [ -f "$search_dir/python/run_equitystack_pipeline.py" ] && [ -d "$search_dir/python/scripts" ] && [ -d "$search_dir/python/bin" ]; then
      printf '%s\n' "$search_dir/python"
      return 0
    fi

    search_dir="$(dirname "$search_dir")"
  done

  return 1
}

initialize_equitystack_environment() {
  local entry_script="$1"
  local entry_dir=""

  entry_dir="$(cd "$(dirname "$entry_script")" && pwd)"
  EQUITYSTACK_PYTHON_DIR="$(resolve_equitystack_python_dir "$entry_dir")" || {
    echo "Unable to locate the EquityStack python workspace from $entry_script" >&2
    exit 1
  }

  EQUITYSTACK_ROOT="$(cd "$EQUITYSTACK_PYTHON_DIR/.." && pwd)"
  EQUITYSTACK_BIN_DIR="$EQUITYSTACK_PYTHON_DIR/bin"
  if [ -n "${EQUITYSTACK_PYTHON_BIN:-}" ]; then
    if [ ! -x "$EQUITYSTACK_PYTHON_BIN" ]; then
      echo "EQUITYSTACK_PYTHON_BIN is not executable: $EQUITYSTACK_PYTHON_BIN" >&2
      exit 1
    fi
    VENV_PYTHON="$EQUITYSTACK_PYTHON_BIN"
  else
    VENV_PYTHON="$EQUITYSTACK_PYTHON_DIR/venv/bin/python3"
    if [ ! -x "$VENV_PYTHON" ]; then
      VENV_PYTHON="$(command -v python3)"
    fi
  fi

  LOG_DIR="$EQUITYSTACK_PYTHON_DIR/logs"
  mkdir -p "$LOG_DIR"
  LOG_FILE="$LOG_DIR/equitystack-$(date +%F).log"

  DEFAULT_MODEL_VERIFIER="${EQUITYSTACK_MODEL_VERIFIER:-${EQUITYSTACK_MODEL_CHEAP:-qwen3.5:9b}}"
  DEFAULT_MODEL_CHEAP="$DEFAULT_MODEL_VERIFIER"
  DEFAULT_MODEL_REVIEW="${EQUITYSTACK_MODEL_REVIEW:-qwen3.5:9b}"
  DEFAULT_MODEL_FALLBACK="${EQUITYSTACK_MODEL_FALLBACK:-$DEFAULT_MODEL_VERIFIER}"
  DEFAULT_MODEL_EXECUTOR="${EQUITYSTACK_MODEL_EXECUTOR:-rnj-1:latest}"
  DEFAULT_OLLAMA_URL="${EQUITYSTACK_OLLAMA_URL:-http://10.10.0.60:11434}"
  DEFAULT_OLLAMA_TIMEOUT="${EQUITYSTACK_OLLAMA_TIMEOUT:-240}"
  DEFAULT_OLLAMA_TIMEOUT_SENIOR="${EQUITYSTACK_OLLAMA_TIMEOUT_SENIOR:-$DEFAULT_OLLAMA_TIMEOUT}"
  DEFAULT_OLLAMA_TIMEOUT_VERIFIER="${EQUITYSTACK_OLLAMA_TIMEOUT_VERIFIER:-240}"
}

timestamp_now() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  local message="$1"
  printf '[%s] %s\n' "$(timestamp_now)" "$message" | tee -a "$LOG_FILE"
}

repo_relative_path() {
  local path_value="${1:-}"

  if [ -z "$path_value" ]; then
    printf '\n'
    return 0
  fi

  case "$path_value" in
    "$EQUITYSTACK_PYTHON_DIR"/*)
      printf '%s\n' "${path_value#$EQUITYSTACK_PYTHON_DIR/}"
      ;;
    "$EQUITYSTACK_ROOT"/*)
      printf '%s\n' "${path_value#$EQUITYSTACK_ROOT/}"
      ;;
    *)
      printf '%s\n' "$path_value"
      ;;
  esac
}

normalize_python_workspace_path() {
  local path_value="${1:-}"

  if [ -z "$path_value" ]; then
    printf '\n'
    return 0
  fi

  case "$path_value" in
    /*)
      printf '%s\n' "$path_value"
      ;;
    ./python/*)
      printf '%s\n' "${path_value#./python/}"
      ;;
    python/*)
      printf '%s\n' "${path_value#python/}"
      ;;
    *)
      printf '%s\n' "$path_value"
      ;;
  esac
}

normalize_current_admin_path_args() {
  local -n output_args_ref="$1"
  shift || true

  output_args_ref=()

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --input|--output|--report|--batch|--review|--decision-log|--decision-file|--export-worklist)
        local flag="$1"
        local value="${2:-}"
        [ -n "$value" ] || { output_args_ref+=("$1"); shift; continue; }
        output_args_ref+=("$flag" "$(normalize_python_workspace_path "$value")")
        shift 2
        ;;
      --csv|--log-decisions)
        local flag="$1"
        if [ -n "${2:-}" ] && [[ "${2:-}" != --* ]]; then
          output_args_ref+=("$flag" "$(normalize_python_workspace_path "${2:-}")")
          shift 2
        else
          output_args_ref+=("$flag")
          shift
        fi
        ;;
      --input=*|--output=*|--report=*|--batch=*|--review=*|--decision-log=*|--decision-file=*|--export-worklist=*|--csv=*|--log-decisions=*)
        local flag="${1%%=*}"
        local value="${1#*=}"
        output_args_ref+=("$flag=$(normalize_python_workspace_path "$value")")
        shift
        ;;
      *)
        output_args_ref+=("$1")
        shift
        ;;
    esac
  done
}

artifact_status_text() {
  local artifact_path="$1"

  if [ -f "$artifact_path" ]; then
    printf 'present (%s)\n' "$(repo_relative_path "$artifact_path")"
  else
    printf 'missing (%s)\n' "$(repo_relative_path "$artifact_path")"
  fi
}

print_step_header() {
  local step_id="$1"
  local step_name="$2"

  printf '\nSTEP %s: %s\n' "$step_id" "$step_name"
}

print_step_success() {
  local success_message="$1"
  shift || true

  printf 'SUCCESS: %s\n' "$success_message"
  for artifact_path in "$@"; do
    if [ -n "$artifact_path" ]; then
      printf 'OUTPUT: %s\n' "$(repo_relative_path "$artifact_path")"
    fi
  done
}

print_step_failure() {
  local step_name="$1"
  local exit_code="$2"

  printf 'FAILURE: %s exited with status %s\n' "$step_name" "$exit_code" >&2
}

run_step() {
  local step_id="$1"
  local step_name="$2"
  local success_message="$3"
  shift 3

  local -a outputs=()
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --output)
        outputs+=("${2:-}")
        shift 2
        ;;
      --output=*)
        outputs+=("${1#--output=}")
        shift
        ;;
      --)
        shift
        break
        ;;
      *)
        break
        ;;
    esac
  done

  print_step_header "$step_id" "$step_name"
  log "Running: $*"

  local exit_code=0
  set +e
  "$@" 2>&1 | tee -a "$LOG_FILE"
  exit_code=${PIPESTATUS[0]}
  set -e

  if [ "$exit_code" -ne 0 ]; then
    print_step_failure "$step_name" "$exit_code"
    return "$exit_code"
  fi

  print_step_success "$success_message" "${outputs[@]}"
}

print_system_state() {
  local state="$1"
  local next_step="$2"
  local next_command="$3"
  shift 3 || true

  printf '\nSYSTEM STATE: %s\n' "$state"
  for line in "$@"; do
    printf '%s\n' "$line"
  done
  printf '\nNEXT STEP: %s\n' "$next_step"
  printf 'RECOMMENDED COMMAND: %s\n' "$next_command"
}

command_has_flag() {
  local target_flag="$1"
  shift || true

  while [ "$#" -gt 0 ]; do
    case "$1" in
      "$target_flag"|"$target_flag"=*)
        return 0
        ;;
      *)
        shift
        ;;
    esac
  done

  return 1
}
