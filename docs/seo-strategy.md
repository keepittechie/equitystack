# EquityStack SEO Strategy

This document summarizes the current public SEO strategy for EquityStack.

## Core Principle

EquityStack should rank by being:

- structurally clear
- context-rich
- internally connected
- explicit about methods and limits

The goal is discoverability for serious search intent, not volume through low-trust pages.

## Keyword / Intent Model

### Thematic pages own broad search intent

Examples:

- presidents and Black Americans
- presidential impact on Black Americans
- civil rights laws by president
- campaign promises to Black Americans
- Black progress under presidents

These pages should rank for the broad question and route users into deeper pages.

### Data pages own narrower evidence intent

Examples:

- specific president pages
- specific policy pages
- specific promise pages
- bill detail pages

These pages should rank for narrower entity-level or record-level searches.

### Explainers own context intent

Explainers should rank for:

- historical concepts
- legal background
- policy-history clarifications

### Reports own synthesis intent

Reports should rank for:

- comparisons
- score summaries
- timeline summaries
- higher-level patterns

## Internal Linking Model

### Homepage

Links into:

- Key Questions
- Research Hub
- trust/reference pages
- core hubs

### Research Hub

Links into:

- flagship thematic pages
- flagship reports
- flagship explainers
- core hubs
- methodology / sources / glossary / start

### Thematic pages

Link up and down:

- up to primary thematic hubs
- down into presidents, policies, bills, promises, reports, explainers, methodology

### Detail pages

Should always link into:

- adjacent records where available
- at least one broader thematic/report path
- at least one trust page lightly where appropriate

## Metadata Strategy

Helpers live in:

- [lib/metadata.js](/home/josh/Documents/GitHub/equitystack/lib/metadata.js)

Rules:

- use `buildPageMetadata` for static pages
- use `generateMetadata` for dynamic detail pages
- use `buildListingMetadata` for filterable hubs so filtered states can be `noindex`
- keep titles and descriptions distinct by page role

## Structured Data Strategy

Helpers live in:

- [lib/structured-data.js](/home/josh/Documents/GitHub/equitystack/lib/structured-data.js)

Rules:

- prefer minimal valid schema
- use `BreadcrumbList` on major routes
- use `Report` for report pages
- use `ProfilePage` for president profiles
- use `Legislation` for bill pages
- use `Article` for explainers
- use `CollectionPage` / `Dataset` / `ItemList` on hub pages where they fit

Avoid:

- `FAQPage` without actual FAQ content
- `Review` or ratings without real rating data
- fabricated authors or dates

## Current Cannibalization Strategy

The thematic cluster is intentionally differentiated:

- broad overview
- impact synthesis
- legislation lens
- promise lens
- opportunity lens
- records lens
- progress lens

The role map lives in:

- [lib/thematic-pages.js](/home/josh/Documents/GitHub/equitystack/lib/thematic-pages.js)

## Ongoing Priorities

1. deepen thin but high-value record pages
2. keep flagship thematic and report pages citation-ready
3. maintain strong internal paths into methodology and sources
4. expand entity-level summaries only when source-backed context exists
