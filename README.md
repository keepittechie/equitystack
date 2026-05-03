# EquityStack

**A public-interest civic data platform for exploring policy, promises, public records, and measurable impact on Black Americans.**

EquityStack helps readers inspect policy history, public claims, evidence-backed explainers, and structured accountability pages without reducing the record to slogans or partisan framing.

🌐 **Live Site:** [https://equitystack.org](https://equitystack.org)

## What This Public Repository Includes

This public repository contains the EquityStack public application, methodology materials, explainers, and Narrative Accountability presentation layer.

It is intended to show:

- the public Next.js application
- public UI and route code
- public assets
- public methodology and explainer documentation
- Narrative Accountability profile and pattern presentation files

## What This Public Repository Does Not Include

Internal ingestion pipelines, private audit reports, production repair and backfill scripts, backups, logs, and operational artifacts are maintained separately and are not part of the public export.

## Public Features

- policy pages and policy comparison flows
- promise tracking and fulfillment views
- president and administration pages
- Black Impact Score presentation and methodology
- research explainers and public references
- Narrative Accountability profiles and pattern pages

## Getting Started

```bash
git clone <public-mirror-url>
cd equitystack-public-export
npm install
cp .env.example .env.local
npm run dev
```

Then visit:

```text
http://localhost:3000
```

Useful commands:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Notes

- This mirror is intentionally limited to public-safe application and methodology files.
- Some internal maintenance workflows live only in the private main repository and are not part of this export.

## License

EquityStack is released under the [MIT License](../LICENSE).
