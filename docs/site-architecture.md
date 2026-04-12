# EquityStack Site Architecture

This document describes the public-side architecture after the SEO, trust, and discovery pass.

## Public Page Types

### Core data hubs

- `/presidents`
- `/policies`
- `/promises`
- `/bills`
- `/reports`
- `/explainers`
- `/narratives`

These are the main index pages that route users into the record layer.

### Detail pages

- `/presidents/[slug]`
- `/policies/[slug]`
- `/promises/[slug]`
- `/bills/[slug]`
- `/future-bills/[slug]`
- `/reports/[slug]`
- `/explainers/[slug]`

These are the evidence-bearing or context-bearing destinations where users should be able to read a summary, inspect supporting context, and continue into related records.

### Thematic analysis pages

Routes live under `/analysis/*`.

Current live pages:

- `presidents-and-black-americans`
- `presidential-impact-on-black-americans`
- `civil-rights-laws-by-president`
- `campaign-promises-to-black-americans`
- `how-presidents-shaped-black-opportunity`
- `presidential-records-on-black-opportunity`
- `black-progress-under-presidents`

These pages are editorial entry hubs. They should not replace the underlying record layer.

### Trust and orientation pages

- `/research`
- `/start`
- `/methodology`
- `/glossary`
- `/sources`
- `/about`

These pages explain how to use the site, how terms differ, how records are interpreted, and where evidence comes from.

### Supporting discovery pages

- `/timeline`
- `/activity`
- `/administrations`
- `/compare`
- `/scorecards`
- `/current-administration`

These are supporting exploration routes, not the main trust or search hubs.

## Routing Structure

### Entry hierarchy

1. Homepage
2. Research Hub / Key Questions / core hubs
3. Thematic analysis pages and flagship reports
4. Record pages and explainers
5. Methodology / Sources / Glossary for verification

### Navigation model

- Primary nav keeps the core high-frequency hubs:
  - Dashboard
  - Policies
  - Bills
  - Presidents
  - Promises
  - Reports
- `Research` groups:
  - Research Hub
  - Impact Analysis pages
  - Civil-Rights Timeline
- Footer carries the fuller discovery and trust system:
  - Research / Explore
  - Guides / Understanding
  - Impact Analysis
  - Reference Paths
  - Sources & Code

## SEO / Discovery Structure

### Homepage

Owns:

- broad site understanding
- `Key Questions`
- strongest entry points for first-time visitors
- reference-page surfacing

### Thematic pages

Own broad search intents and route users into:

- presidents
- policies
- promises
- bills
- reports
- explainers
- methodology

The cluster role map lives in [lib/thematic-pages.js](/home/josh/Documents/GitHub/equitystack/lib/thematic-pages.js).

### Reports

Reports are the synthesis layer between the raw record layer and the thematic guides.

### Explainers

Explainers provide historical, legal, and conceptual context. They should route into records rather than act like blog posts.

## Structured Data Model

Primary JSON-LD helpers live in [lib/structured-data.js](/home/josh/Documents/GitHub/equitystack/lib/structured-data.js).

Common types in use:

- `Organization`
- `WebSite`
- `BreadcrumbList`
- `CollectionPage`
- `Dataset`
- `ProfilePage`
- `Report`
- `Article`
- `Legislation`
- `WebPage`
- `AboutPage`
- `ItemList`

## Current Architectural Principle

EquityStack should feel like one connected research system:

- thematic pages frame the question
- reports summarize patterns
- explainers provide context
- record pages provide evidence-bearing detail
- trust pages explain how to read and verify the site

No single page type should try to do all five jobs at once.
