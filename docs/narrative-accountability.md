# Narrative Accountability

`/narrative-accountability` is a public-facing structure for documenting claims made by commentators or other public figures and evaluating those claims against evidence.

This phase is public-structure-first, with publication gating for any real profile drafts:

- public listings can remain empty even while unpublished real-profile drafts exist internally
- no accusations
- sourced statements only
- unpublished profiles stay off the public listing and return `notFound()` by slug

## Record Shape

Each profile includes:

- `published`
- `display_name`
- `platform_or_role`
- optional `primary_platform`
- optional `public_role_type`
- optional `public_claim_caution`
- optional portrait fields
- `short_summary`
- `narrative_pattern_summary`
- `claim_categories`
- `review_notes`
- `last_reviewed_at`
- optional `related_profiles`
- optional `related_explainers`
- optional `publicly_reported_ethics_concerns`
- `statements`

Each statement includes:

- `claim_type`
- `exact_quote` shown under the UI label `Claim summary / quoted material`
- optional `statement_sources`
- `claim_being_made`
- `context_summary`
- `historical_rebuttal`
- `data_rebuttal`
- `receipts`
- `harm_summary`
- `severity`
- `verification_status`
- optional `narrative_tags`
- optional `statement_date`
- optional `statement_visibility` such as `editorial_hold`

Each receipt includes:

- title
- URL
- publisher/source
- `source_quality`
- note

Profile-level ethics-context items may also carry their own receipts when the summary needs direct sourcing.

Allowed `claim_type` values:

- `Historical claim`
- `Legal claim`
- `Economic claim`
- `Policy claim`
- `Statistical claim`
- `Characterization claim`

Allowed `source_quality` values:

- `Primary`
- `Court record`
- `Government data`
- `Government report`
- `Academic`
- `Research analysis`
- `Investigative reporting`
- `News reporting`
- `Commentary`

## Pattern Layer

Narrative Accountability now includes public pattern routes in addition to profile pages:

- `/narrative-accountability/patterns`
- `/narrative-accountability/patterns/[tag]`

These routes connect:

- canonical narrative patterns
- published profiles
- visible sourced statements
- related explainers

Canonical tags live in:

- [lib/narrative-accountability/narrative-tags.js](/home/josh/Documents/GitHub/equitystack/lib/narrative-accountability/narrative-tags.js)

Pattern analytics live in:

- [lib/narrative-accountability/patternAnalytics.js](/home/josh/Documents/GitHub/equitystack/lib/narrative-accountability/patternAnalytics.js)

Current public helpers include:

- `getPublishedNarrativeStatementsByTag(tagId)`
- `getNarrativeIndex()`
- `getNarrativePatternHeatmap()`
- `getNarrativePatternSummaryStats()`
- `getNarrativeConcentration(tagId)`
- `getNarrativeCoverage(tagId)`
- `getNarrativeTimeline(tagId)`
- `getNarrativeTimelineByProfile(tagId)`

Pattern pages must use:

- published profiles only
- visible statements only
- canonical tags only

Pattern pages must exclude:

- unpublished profiles
- `statement_visibility: "editorial_hold"`

## Pattern Page Features

`/narrative-accountability/patterns` currently includes:

- a caution note
- summary stat cards
- a pattern heatmap
- evidence-strength summaries on pattern cards

`/narrative-accountability/patterns/[tag]` currently includes:

- tag intro and caution
- timeline density view
- narrative-versus-evidence panel
- evidence-strength metrics
- concentration view, `Who drives this narrative`
- grouped evidence by profile

Coverage and timeline metrics are intentionally conservative:

- lower counts may reflect stricter sourcing requirements, not absence of the narrative
- timelines only use verified `statement_date`
- coverage uses visible statements, visible profiles, and source diversity by unique domains

## Public Reading Rules

- Focus on the claim, not the speaker's private intent.
- Preserve the quoted statement or clearly labeled sourced paraphrase that is being evaluated.
- Keep rebuttals evidence-oriented and non-theatrical.
- Keep receipts close to the rebuttal so readers can verify the evaluation path.
- Public pages should carry the caution note: `This page evaluates public claims and documented positions. It does not assert private intent.`
- Unpublished profiles should not be visible on `/narrative-accountability`.
- Avoid legal conclusions, criminal accusations, and intent claims. Attribute reporting, oversight findings, and expert analysis clearly.
- Do not publish any profile unless each visible statement has source context and receipts.
- For commentator-style profiles, describe the public claim pattern rather than using unsupported personal labels or motive claims.

## Current Implementation

The initial implementation lives in:

- [lib/narrative-accountability/data.js](/home/josh/Documents/GitHub/equitystack/lib/narrative-accountability/data.js)
- [lib/narrative-accountability/narrative-tags.js](/home/josh/Documents/GitHub/equitystack/lib/narrative-accountability/narrative-tags.js)
- [lib/narrative-accountability/patternAnalytics.js](/home/josh/Documents/GitHub/equitystack/lib/narrative-accountability/patternAnalytics.js)
- [app/narrative-accountability/page.js](/home/josh/Documents/GitHub/equitystack/app/narrative-accountability/page.js)
- [app/narrative-accountability/[slug]/page.js](</home/josh/Documents/GitHub/equitystack/app/narrative-accountability/[slug]/page.js>)
- [app/narrative-accountability/patterns/page.js](/home/josh/Documents/GitHub/equitystack/app/narrative-accountability/patterns/page.js)
- [app/narrative-accountability/patterns/[tag]/page.js](</home/josh/Documents/GitHub/equitystack/app/narrative-accountability/patterns/[tag]/page.js>)

The placeholder route exists to validate:

- route shape
- card rendering
- quote / evaluation / receipts sections
- severity and verification badges
- publication gating
- canonical pattern tagging
- heatmap rendering
- concentration metrics
- evidence-strength summaries
- timeline density rendering
- optional ethics-concerns section
- mobile-safe section stacking

## Future Sourcing Standard

When real entries are added later:

- every quote must be tied to a traceable public source
- every visible statement should carry `statement_sources`
- every rebuttal must cite receipts
- every harm summary must stay grounded in public consequence rather than speculation
- `narrative_tags` should be added when the fit is clear and source-bound
- `statement_date` should be added only when the source gives a clear attributable date
- unsupported entries should remain unpublished rather than partially asserted
- `review_notes` should explain what still blocks publication
- real-profile drafts should use neutral, attributed phrasing such as "publicly reported" or "the committee said," rather than asserting legal liability
- stronger-but-unverified statements should stay on `editorial_hold`
- unpublished real-profile drafts may exist internally, but they should stay off the public route until manual review is complete
