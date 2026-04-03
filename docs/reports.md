# Reports System

EquityStack's reports are not a single dashboard. They are a small system of curated public views built on top of Promise Tracker data.

## Product Role

The report layer exists to help users move from record-level evidence to summary, comparison, and historical interpretation.

The intended progression is:

1. `/` homepage
2. `Promise Tracker`
3. `Black Impact Score`
4. `Timeline` or `Compare` views when deeper analysis is needed

## Black Impact Score as a System

`/reports/black-impact-score` is the main accountability report surface. It reuses Promise Tracker records and presents them as president-level score views.

Primary modes:

- `Standard Report`
  - Default accountability summary
- `Timeline`
  - Chronological and causal reading of scored records
- `Topic Comparison`
  - Comparison of presidents within a selected policy domain
- `Share Report`
  - Public-facing share state with evidence and verification context

Advanced tools:

- `Debate`
- `President comparison`
- `Snapshots`
- `Print / Save PDF`
- `Permalinks`

These advanced tools remain available, but they should be treated as secondary to the primary report modes above.

## Public Transparency

The report layer should help readers answer three public questions quickly:

1. What records are visible in this view?
2. How are those records scored at a high level?
3. Where do I go to verify the evidence?

Black Impact Score now exposes that publicly through:

- visible evidence panels that link back to Promise Tracker
- a plain-language scoring explanation
- `Build` and `Verify` sections with visible record, outcome, and source-reference totals
- share links that preserve the current public report state without exposing internal review data

## Scoring-Ready View

Black Impact Score includes an optional `scoring-ready` view filter.

This filter is public and advisory. It shows only records that already have:

- at least one visible outcome
- an explicit impact direction on each scored outcome
- a visible outcome summary
- at least one linked source for each scored outcome

Important:

- this filter does not change score logic
- this filter does not silently replace the default view
- non-ready records remain visible by default for context
- staging, admin review, and unpublished records are never part of this public filter

## Reports Landing Page

`/reports` should act as a curated entry point first.

The internal hierarchy is:

1. `Featured Accountability Reports`
2. `Black Impact Score` curated entry points
3. `Additional Analytics and Supporting Tools`

The analytics dashboard is intentionally secondary. It supports the main report paths rather than replacing them.
