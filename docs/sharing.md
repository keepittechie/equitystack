# Sharing Model

EquityStack's report sharing is designed to feel simple at the UI level even though the system preserves a detailed report state underneath.

## Share Report

`Share Report` is the primary visible sharing action on Black Impact Score. It is the main public-facing way to share a report state.

## Permalinks

Permalinks preserve the exact report state under the hood, including filters, view mode, debate mode, and comparison state.

Users do not need to think about query-string details. The UI should treat permalinks as the underlying mechanism rather than the main product concept.

## Snapshots

Snapshots are a convenience feature for the current browser. They let users save and reopen named report states without backend persistence.

Snapshots are secondary to `Share Report`. They are meant for convenience, not as a separate public product.

## Print / Save PDF

The current export path is browser print. It reuses the current visible report state and produces a cleaner print-friendly output for saving as PDF.

This is also a secondary tool. It supports reuse and archival sharing, but it should not compete with the main share action.
