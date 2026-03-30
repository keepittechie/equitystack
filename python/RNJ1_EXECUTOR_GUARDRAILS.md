# rnj-1 Executor Guardrails

`rnj-1:latest` is the EquityStack executor model.

Approved use:

- batch preprocessing
- summarizing logs and artifacts
- MCP tool execution
- running approved wrapper commands
- assisting with supervised pipeline runs

Not approved:

- auto-approving imports
- auto-inserting records without explicit approved input
- overriding AI review outcomes
- bypassing `workflow finalize`
- bypassing decision logs
- bypassing `pre-commit`
- bypassing dry-run import
- bypassing `--apply --yes`

Execution boundary:

- `rnj-1` may execute `./bin/equitystack` commands that the operator has explicitly approved.
- `rnj-1` may execute admin-triggered wrapper actions only when the admin route is enforcing the same canonical state checks as the CLI.
- `rnj-1` may summarize admin-visible artifacts and logs after a supervised run.
- `rnj-1` may run wrapped legislative apply/import commands only after the operator has saved approval decisions and the admin readiness gates allow the next step.
- `rnj-1` is an executor, not the final reviewer.
- Import safety still depends on the 27B review path, operator decisions, pre-commit review, and explicit apply confirmation.
