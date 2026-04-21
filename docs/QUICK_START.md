# EquityStack Quick Start

If you forgot everything, start here.

## One-Command Weekly Check

From the repo root. On the production frontend host (`10.10.0.13`), that root is:

```bash
cd /opt/equitystack-frontend
./python/bin/equitystack weekly-run
```

Live production topology for these checks:

- frontend host: `10.10.0.13`
- live frontend app: `equitystack-frontend`
- MariaDB host: `10.10.0.15`
- database: `black_policy_tracker`

This runs the safe weekly loop:

- production certification audit
- policy outcome integrity validation
- impact evaluation
- impact promotion dry-run with `--approve-safe`
- source gap audit
- policy intent gap audit
- final Black Impact Score report

It writes a machine-readable artifact to:

```text
python/reports/operator/weekly-run.latest.json
```

Read the terminal summary first. It tells you whether anything broke, what needs attention, and what can wait.

## One-Command Review Queue

If `weekly-run` says there are manual tasks, run:

```bash
./python/bin/equitystack review
```

This shows only the highest-value manual work:

- top unsourced outcomes
- top unclassified policy intent records
- integrity warnings worth monitoring

It writes:

```text
python/reports/operator/review.latest.json
```

## What Warnings Mean

- `PASS WITH WARNINGS`: the system runs, but coverage still needs operator curation.
- `WARN` from integrity validation: no hard violation was found, but there are known data gaps such as missing sources or low outcome coverage.
- `missing_sources`: attach official sources when you have time.
- `low_president_coverage`: some presidents have too few outcomes for strong interpretation.
- `policy_type_imbalance`: the dataset is still heavier in one outcome family, usually current-admin.
- `directional_imbalance`: one policy type is dominated by one direction, usually legislative `Blocked` rows.

## What Not To Worry About

- `legislative` outcomes are expected to be excluded from per-president scoring until deterministic president attribution exists.
- `judicial_impact` may be zero until curated judicial rows are added.
- `WARN` is acceptable when the issue is coverage, not integrity failure.
- You do not need to run every individual audit command unless `weekly-run` or `review` tells you to.

## Manual Fix Commands

Attach a verified source:

```bash
./python/bin/equitystack impact curate-sources \
  --only-policy-outcome-id <ID> \
  --source-title "<Official Title>" \
  --source-url "https://..." \
  --source-type Government \
  --apply --yes
```

Classify policy intent:

```bash
./python/bin/equitystack impact curate-policy-intent \
  --only-policy-id <ID> \
  --category <equity_expanding|equity_restricting|neutral_administrative> \
  --summary "Short factual description of intent" \
  --source-reference "Official source or historical reference" \
  --apply --yes
```

Repair stale legislative bundle state when review/apply is stuck:

```bash
./python/bin/equitystack legislative repair --dry-run
./python/bin/equitystack legislative repair --apply --yes
```

Use this when:

- `legislative review` shows no real pending work
- `legislative apply` still complains about an approved `remove_direct_link`
- the admin legislative tracker is stuck on `Manual Review Queue` or `REVIEW_READY`

This repairs canonical artifact state only. It does not invent approvals or create direct admin-side DB writes around the workflow.

## Deeper Commands

Use these only when you need detail:

```bash
./python/bin/equitystack impact certify-production-data
./python/bin/equitystack impact validate-integrity
./python/bin/equitystack impact audit-outcome-source-gaps --limit 25
./python/bin/equitystack impact audit-policy-intent-gaps
./python/bin/equitystack impact report-final-black-impact-score
```

For the full command-to-script map, see [`PYTHON_WORKFLOWS.md`](PYTHON_WORKFLOWS.md).

## Do Nothing Safely

If the weekly report says:

```text
No urgent action needed this week.
```

you can stop. The system is telling you that there is no immediate operator work.
