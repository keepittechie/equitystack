# MCP Executor Guardrails

`MCP_MODEL` configures the EquityStack executor/MCP model.

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

- The configured MCP executor model may execute `./bin/equitystack` commands that the operator has explicitly approved.
- The configured MCP executor model may execute admin-triggered wrapper actions only when the admin route is enforcing the same canonical state checks as the CLI.
- The configured MCP executor model may summarize admin-visible artifacts and logs after a supervised run.
- The configured MCP executor model may run wrapped legislative apply/import commands only after the operator has saved approval decisions and the admin readiness gates allow the next step.
- The configured MCP executor model is an executor, not the final reviewer.
- Import safety still depends on the canonical review path, operator decisions, pre-commit review, and explicit apply confirmation.
