# Reports System

EquityStack's reports are not a single dashboard. They are a small system of curated public views built on top of Promise Tracker data.

## Product Role

The report layer exists to help users move from record-level evidence to summary, comparison, and historical interpretation.

The intended progression is:

1. `Start Here`
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

## Reports Landing Page

`/reports` should act as a curated entry point first.

The internal hierarchy is:

1. `Featured Accountability Reports`
2. `Black Impact Score` curated entry points
3. `Additional Analytics and Supporting Tools`

The analytics dashboard is intentionally secondary. It supports the main report paths rather than replacing them.
