# EquityStack

**Track what politicians promise. Verify what actually happens. See who it impacts.**

A public-interest civic data platform for tracking policy promises, presidential records, and measurable Black community impact.

EquityStack helps users explore how policy decisions, campaign promises, legislation, and presidential actions connect to real-world outcomes.

EquityStack exists to make civic accountability measurable, inspectable, and grounded in evidence instead of narratives.

🌐 **Live Site:** https://equitystack.org

![Next.js](https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwindcss&logoColor=white)
![Status](https://img.shields.io/badge/status-active-brightgreen)

---

## What EquityStack Does

EquityStack connects:

- presidential promises  
- governing actions (executive, legislative, judicial)  
- implementation evidence  
- measurable outcomes  
- source-backed documentation  
- Black Impact Score analysis  

The goal is not to tell users what to think, but to make the public record easier to inspect.

**Core model:**

> Promises → Actions → Implementation → Outcomes → Measured Impact

---

## Why This Matters

Public policy discussions are often driven by narratives instead of verifiable outcomes.

EquityStack gives you a way to check the receipts.

It connects what was said, what was done, and what actually changed so claims can be evaluated against evidence.

---

## Screenshots

*A quick look at how EquityStack works in practice:*

![Narrative Accountability](./public/images/readme/eq1.png)  
*Track public claims, review evidence, and see how narratives are evaluated.*

![Narrative Patterns](./public/images/readme/eq2.png)  
*See how recurring narratives appear across multiple public figures.*

![Policy Tracking](./public/images/readme/eq3.png)  
*Follow policies from promise to real-world outcomes.*

![Explainers](./public/images/readme/eq4.png)  
*Understand the historical and policy context behind each claim.*

---

## Key Features

- President-by-president policy and promise profiles  
- Black Impact Score with public methodology  
- Promise Tracker linking commitments to outcomes  
- Policy and legislation records with source-backed evidence  
- Narrative accountability pages for evaluating public claims  
- Research hub, explainers, and contextual analysis  
- Searchable civic accountability data  
- Responsive UI built for readability and inspection  

---

## Product Overview

EquityStack is built around connected public record pages rather than isolated summaries.

- **President pages** combine administration context, linked records, and score summaries  
- **Promise pages** connect commitments to actions, status, and outcomes  
- **Policy pages** organize evidence so readers can compare impact and context  
- **Reports and explainers** provide structured context and methodology  

---

## Product Model

EquityStack treats public record pages as the core product.

Policy and promise pages include:

- impact direction and scoring summaries  
- evidence coverage and source linkage  
- demographic impact breakdowns  
- contextual links across related records  

Comparison flows (like `/compare/policies`) allow side-by-side evaluation of:

- score  
- direction  
- evidence strength  
- population impact  

---

## Narrative Accountability Model

EquityStack includes a structured system for evaluating public claims.

- Profiles represent public figures or commentators  
- Statements preserve exact quotes, context, and date  
- Claims are classified (historical, legal, economic, policy, statistical, etc.)  
- Evaluations include structured rebuttals and source-backed receipts  
- Source quality is labeled (primary vs commentary)  
- Harm summaries explain impact without speculating on intent  

Public pages follow this rule:

> “This page evaluates public claims and documented positions. It does not assert private intent.”

Only reviewed and published profiles appear on public routes.

---

## Current Administration Model

EquityStack separates six layers:

- `promises` → stated intent  
- `governing_actions` → real government mechanisms  
- implementation evidence → proof of execution  
- outcome evidence → measurable effects  
- scoring readiness → review state  
- scored outcomes → final impact layer  

Key rules:

- slogans are not scored  
- promises can be tracked but not scored  
- actions can exist without outcome evidence  
- scoring requires measurable population impact  

---

## Black Impact Score

Black Impact Score is the structured scoring layer for policy outcomes.

It combines:

- direct outcome impact  
- evidence confidence  
- policy intent modifiers  
- systemic impact weighting  

Public rankings include:

- `raw_average_score`  
- `coverage_adjusted_score`  
- `overall_ranking_score`  

This ensures incomplete records do not outperform well-documented ones.

Methodology:  
`/research/how-black-impact-score-works`

---

## Public Routes

- `/` → homepage  
- `/policies` → policy records  
- `/promises` → promise tracking  
- `/compare/policies` → side-by-side comparison  
- `/how-it-works` → methodology guide  
- `/reports` → curated reports  
- `/reports/black-impact-score` → scoring system  
- `/reports/civil-rights-timeline` → historical timeline  
- `/narrative-accountability` → claim evaluation  

---

## Project Structure

Two main components:

- Next.js public website (repo root)  
- Python data pipeline (`python/`)  

Key directories:

- `app/` → routes and UI  
- `lib/` → data services  
- `public/` → assets  
- `database/` → schema  
- `docs/` → architecture and workflows  

---

## Getting Started

```bash
git clone https://github.com/keepittechie/equitystack.git
cd equitystack-public
npm install
cp .env.example .env.local
npm run dev

Visit:

```text
http://localhost:3000
```

---

## Contributing

Contributions, corrections, and source suggestions are welcome.

Helpful contributions include:

- Fixing source links
- Improving policy summaries
- Adding missing historical context
- Reporting data issues
- Improving accessibility or UI clarity

---

## Data Note

This project uses demo and publicly sourced data only. No sensitive or private user data is stored in this repository.

---

## License

EquityStack is released under the [MIT License](LICENSE).
