# Policy Outcome Time Dimension

EquityStack now has an additive time-dimension design for unified `policy_outcomes`.
This supports future trend analysis without changing existing impact scores.

## Schema Additions

Apply only when ready:

```bash
mysql < database/policy_outcomes_time_dimension.sql
```

The migration adds nullable columns:

```text
impact_start_date DATE NULL
impact_end_date DATE NULL
impact_duration_estimate VARCHAR(64) NULL
```

The base schema in `database/policy_outcomes.sql` also includes these columns for fresh installs.

## Backfill Rules

Use conservative timing:

- Prefer explicit real-world outcome/effective dates.
- Use date ranges when the available evidence supports a range but not a single precise date.
- Leave dates `NULL` when no trustworthy date exists.
- Do not use `created_at` or `updated_at` as real-world impact timing.
- If both dates are present, `impact_end_date` must be greater than or equal to `impact_start_date`.
- `impact_duration_estimate` is descriptive and should not imply more precision than the dates support.

Recommended duration labels:

```text
short_term
medium_term
long_term
ongoing_or_unknown_end
unknown
```

## Helpers

`lib/policyOutcomeTime.js` exposes:

- `isActiveDuring(outcome, dateRange)`
- `getOutcomeDuration(outcome)`

These helpers are for filtering and reporting only. They do not change scoring formulas.

## Read-Only Report

Generate the report:

```bash
./python/bin/equitystack impact report-outcome-time
```

It reports:

- outcomes grouped by year
- outcomes grouped by decade
- impact duration distribution
- invalid date ranges
- undated outcome samples
- impact density per administration for `current_admin` outcomes

If the migration has not been applied yet, the report still runs and marks the missing time columns.

## Scoring Policy

This does not change score values. Time should first be used for transparency, filtering, and trend views.
Only after enough outcome dates are sourced should time weighting or period-specific scoring be considered.

## Workflow Validation

The unified-outcome writers validate date ranges after policy outcomes are created. If both `impact_start_date` and `impact_end_date` are present, `impact_end_date` must be greater than or equal to `impact_start_date`.

Current canonical writers:

```bash
./python/bin/equitystack impact sync-current-admin-outcomes
./python/bin/equitystack legislative materialize-outcomes
./python/bin/equitystack impact promote
```

These workflows preserve the time dimension while enforcing the broader `policy_outcomes` integrity rules documented in [`workflow-hardening.md`](workflow-hardening.md).
