# EquityStack MCP Control Layer

EquityStack exposes an MCP stdio server as a thin wrapper over existing CLI and API workflows.

Run it with:

```bash
npm run mcp:equitystack
```

Tools:

- `get_system_status` -> recent admin/operator and MCP job-run artifacts
- `run_current_admin` -> `./bin/equitystack current-admin run`
- `run_legislative_review` -> `./bin/equitystack legislative review`
- `run_impact_evaluate` -> `./bin/equitystack impact evaluate`
- `run_impact_promote` -> `./bin/equitystack impact promote`
- `generate_reports` -> existing dynamic report API endpoints, such as `/api/reports/overall-summary`
- `recalculate_president_scores` -> existing dynamic score endpoint `/api/promises/scores?model=outcome`

Safety rules:

- MCP does not reimplement workflow logic.
- MCP-triggered CLI workflows use the same CLI runner semantics and write admin command-center job log artifacts for visibility.
- Mutating promotion requires explicit `apply=true` and `yes=true`.
- `run_impact_promote` defaults to dry-run.
- Existing CLI guardrails, pre-commit checks, transition checks, and approval checks still apply.
- `get_system_status` is read-only and never executes a workflow.

Example tool arguments:

```json
{
  "limit": 5,
  "status_filter": "failed",
  "command_filter": "impact",
  "since_minutes": 1440
}
```

```json
{
  "batch_name": "trump-2025-batch-01",
  "review_dry_run": true
}
```

```json
{
  "input": "reports/impact_maturation_review.json",
  "dry_run": true,
  "approve_safe": true
}
```

Report API tools require the Next app to be reachable. By default the MCP tool uses `http://127.0.0.1:3000`; override with `base_url` or `EQUITYSTACK_BASE_URL`.
