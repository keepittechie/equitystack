# EquityStack Python Workflows

This directory contains the operator-facing Python workflows for EquityStack.

Work from:

```bash
cd python
```

Main CLI:

```bash
./bin/equitystack --help
```

Path handling:

- When you run `./bin/equitystack` from `python/`, use paths like `data/...` and `reports/...`.
- The installed `~/bin/equitystack` wrapper also accepts repo-rooted current-admin paths like `python/data/...` and `python/reports/...`.

## Local Python Bootstrap

Recommended local setup from the repo root:

```bash
cd python
./bin/bootstrap-python-env
```

That script:

- rebuilds `python/venv` in place with a local path
- upgrades `pip`
- installs `requirements-local.txt`

Manual equivalent:

```bash
cd python
python3 -m venv --clear venv
./venv/bin/python -m pip install --upgrade pip
./venv/bin/python -m pip install -r requirements-local.txt
```

## Verified Environment Rules

- The CLI is self-locating. It resolves the Python workspace from `python/bin/equitystack`.
- LLM execution uses the configured provider endpoint from `config/llm.json` or `EQUITYSTACK_LLM_ENDPOINT`.
- Senior review and decision steps use the wrapper defaults shown by `./bin/equitystack --help`.
- Verifier, draft, and fallback review steps use the same configured provider/model family unless explicitly overridden.
- Scheduled LLM review stages now default to a 240 second timeout.
- `MCP_MODEL` configures the executor/MCP model for preprocessing, summaries, and approved command execution.
- DB-backed scripts read `.env.local`, but legislative helpers now also honor runtime env overrides such as `DB_HOST=10.10.0.15`.
- `python/venv` is the preferred local-dev interpreter after bootstrap.
- If local `python/venv` is unavailable, you can point the wrapper at another interpreter with `EQUITYSTACK_PYTHON_BIN=/path/to/python`.

## Production Runtime Topology

- frontend host: `10.10.0.13`
- deployed repo root on the frontend host: `/opt/equitystack-frontend`
- live PM2 app: `equitystack-frontend`
- separate PM2 app on the same host: `watchdog-frontend`
- MariaDB host: `10.10.0.15`
- production database: `black_policy_tracker`

Example production-style local verification:

```bash
EQUITYSTACK_PYTHON_BIN=/path/to/python \
DB_HOST=10.10.0.15 \
./bin/equitystack current-admin status
```

## Workflows

- Low-touch weekly operation
- Legislative / future bills
- Current-administration Promise Tracker
- Unified outcome / impact certification
- Manual source and policy-intent curation

Read these next:

- `../docs/QUICK_START.md`
- `../docs/PYTHON_WORKFLOWS.md`
- `CURRENT_ADMIN_DAILY.md`
- `CURRENT_ADMIN_PIPELINE.md`
- `LEGISLATIVE_PIPELINE.md`
- `OPERATIONS.md`
- `RNJ1_EXECUTOR_GUARDRAILS.md`
- `../docs/admin-operator-system.md`
- `../docs/workflow-hardening.md`

## Low-Touch Operator Path

From the repo root:

```bash
./python/bin/equitystack weekly-run
./python/bin/equitystack review
```

From `python/`:

```bash
./bin/equitystack weekly-run
./bin/equitystack review
```

Use this first when returning after time away. `weekly-run` runs the safe checks and reports what needs attention; `review` shows only the compact manual queue.

## Current-Admin Safe Path

From `python/`:

```bash
./bin/equitystack current-admin run
./bin/equitystack current-admin review
./bin/equitystack current-admin apply
./bin/equitystack current-admin apply --apply --yes
```

From the repo root with `~/bin/equitystack`, both of these are valid:

```bash
equitystack current-admin run --input data/current_admin_batches/<batch-file>.json
equitystack current-admin run --input python/data/current_admin_batches/<batch-file>.json
```

Important:

- `current-admin run` discovers and generates the next batch by default, or starts directly from `--input`.
- `current-admin run` writes the canonical AI-first queue artifact at `reports/current_admin/<batch-name>.manual-review-queue.json`.
- that queue artifact now splits records into `items` for borderline manual review, `auto_approved_items` for import candidates, and `auto_rejected_items` for off-mission or unsupported rows.
- `current-admin outcome-evidence` is available as an optional read-only collector for implementation and downstream outcome evidence. It writes `<batch>.outcome-evidence.json` and optional CSV sidecars, but it does not change the current-admin workflow or write to the DB.
- `current-admin review` refreshes the canonical decision template for the manual-review slice and finalizes explicit operator decisions or overrides only where they are still needed.
- `current-admin deep-review` is the explicit deeper paired AI review path for ambiguous batches or rows flagged for additional AI scrutiny.
- `current-admin apply` uses the AI-approved plus manually approved import candidates, and always reruns pre-commit and import dry-run before any mutating apply.
- database writes only happen with `--apply --yes`.
- `current-admin status` prints the current state machine and next step.
- `/admin`, `/admin/workflows/[sessionId]`, and `/admin/current-admin-review` now expose the same guided current-admin step tracker and queue split.
- review artifacts stamp requested model, effective model, backend, fallback status, and fallback reason.
- supporting commands remain available: `discover`, `gen-batch`, `normalize`, `ai-review`, `deep-review`, `pre-commit`, `import`, `validate`, `status`.

Controlled rollout status:

- Phase 1 implementation/execution evidence is active through the discovery layer and preserved in batch context.
- Phase 2 outcome-evidence collection is active, but read-only and artifact-first.
- Phase 3 impact maturation integration is dry-run only via `impact evaluate --outcome-evidence ...`; `impact promote --apply --yes` blocks transitions that depend on supplemental outcome-evidence recommendations.
- Phase 4 current-admin unified outcome enrichment is report-only through `impact preview-current-admin-outcome-enrichment`.
- Phase 5 judicial impact is scaffold-only through `impact discover-judicial-candidates`, `impact import-judicial-batch`, and `impact materialize-judicial-outcomes`.
- Phase 6 UI work is intentionally inactive unless read surfaces later choose to render these optional fields.

## Legislative Safe Path

From `python/`:

```bash
./bin/equitystack legislative run
./bin/equitystack legislative review
./bin/equitystack legislative apply
```

Important:

- `legislative run` executes verifier-assisted suggestion/discovery, senior audit review, auto-triages safe bundle actions, then rebuilds the review bundle.
- the legislative manual-review queue now keeps only AI-uncertain rows that still need human inspection.
- `legislative review` and `/admin/legislative-workflow` now focus on human bundle decisions only; AI-approved bundle actions are shown separately as apply-preview-ready work.
- review models default to the wrapper defaults shown by `./bin/equitystack --help`; current production defaults resolve to OpenAI-style models such as `gpt-4.1-mini`.
- pipeline review stages now use the OpenAI provider path directly; wrapper defaults resolve to OpenAI-style models such as `gpt-4.1-mini`.
- the daily review path uses 240 second senior/verifier timeouts by default.
- `legislative import` is dry-run unless `--apply --yes` is passed through the wrapper or underlying script.

## Unified Outcome Integrity

The workflows that write unified `policy_outcomes` are hardened to preserve the production scoring baseline:

```bash
./bin/equitystack impact sync-current-admin-outcomes
./bin/equitystack legislative materialize-outcomes
./bin/equitystack impact promote
```

They must populate `impact_score` at insert time and validate:

- valid `impact_direction`
- bounded non-null `impact_score`
- non-negative `source_count`
- valid `policy_type`
- no duplicate `(policy_type, policy_id, outcome_summary_hash)` rows

Use these read-only checks after new imports or deployments:

```bash
./bin/equitystack impact report-final-black-impact-score
./bin/equitystack impact certify-production-data
./bin/equitystack impact validate-integrity
```

Legislative outcomes are materialized into `policy_outcomes`, but are explicitly excluded from president scoring until a deterministic president attribution model exists. See `../docs/workflow-hardening.md`.

The final score report now reads:

- canonical outcome evidence from `policy_outcome_sources`
- policy intent from `policies.policy_intent_category`
- policy systemic metadata from `policies.systemic_impact_category` and `policies.systemic_impact_summary`

For current-admin rows, intent and systemic metadata should resolve through canonical `promise_actions.related_policy_id` links. Read-side exact-title fallback still exists for a small number of legacy rows, but operators should treat those as cleanup work surfaced on `/admin/systemic-linkage`, not as the preferred linkage model.

Optional controlled-rollout evidence commands:

```bash
./bin/equitystack current-admin outcome-evidence \
  --input reports/current_admin/<batch>.manual-review-queue.json

./bin/equitystack impact evaluate \
  --input reports/current_admin/<batch>.manual-review-queue.json \
  --outcome-evidence reports/current_admin/<batch>.outcome-evidence.json

./bin/equitystack impact preview-current-admin-outcome-enrichment \
  --input reports/current_admin/<batch>.manual-review-queue.json \
  --outcome-evidence reports/current_admin/<batch>.outcome-evidence.json
```

These commands do not change scoring or write `policy_outcomes` in this rollout.

## Manual Curation Path

When `weekly-run` or `review` reports coverage gaps:

```bash
./bin/equitystack impact audit-outcome-source-gaps --limit 10
./bin/equitystack impact curate-sources --only-policy-outcome-id <ID> --source-title "..." --source-url "https://..." --source-type Government --apply --yes

./bin/equitystack impact audit-policy-intent-gaps
./bin/equitystack impact curate-policy-intent --only-policy-id <ID> --category <category> --summary "..." --source-reference "..." --apply --yes
```

Source and intent curation are manual by design. They do not auto-generate sources or infer policy intent without operator input.

## Operator Maintenance

Stale workflow sessions can be hidden from the operator console without deleting
their audit history:

```bash
./bin/equitystack operator cleanup-stale-workflows --dry-run
./bin/equitystack operator cleanup-stale-workflows --apply --yes
```

The cleanup command marks selected workflow session artifacts inactive and adds
`archivedAt`, `archivedReason`, `archivedBy`, and `cleanupMetadata`. It never
deletes session files.

Default cleanup candidates are:

- obvious test sessions
- older duplicate active sessions with the same workflow id
- older blocked or failed sessions

Use explicit targeting when you want to archive one known session:

```bash
./bin/equitystack operator cleanup-stale-workflows \
  --session-id current-admin:current-admin-wrapper-test \
  --apply --yes
```

Use `--exclude-session <id>` to keep a session even if it matches a default
cleanup rule. Run `--dry-run` first in production and confirm the candidate list
before applying.

## Directory Notes

- `bin/equitystack`: main operator entrypoint
- `data/current_admin_batches/`: curated current-admin batches and discovery exports
- `reports/current_admin/`: durable current-admin artifacts
- `reports/`: legislative pipeline artifacts
- `scripts/`: lower-level Python entrypoints
