# Environmental Justice / Infrastructure Harm Ingestion Plan

Status: planning only. Do not ingest, merge, or mutate production data from this document without a separate reviewed import pack and dry-run.

## Scope

Environmental Justice / Infrastructure Harm should cover policies, agency actions, court/enforcement events, and major public failures where environmental or infrastructure decisions produced racially uneven exposure, displacement, health burden, or remedy access for Black communities.

Primary subdomains:

- Water contamination and drinking-water governance, including Flint-like failures, lead service lines, PFAS, and Safe Drinking Water Act enforcement.
- Hazardous waste siting and cleanup, including RCRA/CERCLA/Superfund and landmark environmental-justice siting controversies.
- Highway displacement, urban renewal, and federally funded transportation barriers.
- Lead exposure from paint, dust, soil, drinking water, and older housing stock.
- Sanitation, utilities, and public infrastructure access.
- Disaster response inequities and uneven recovery after major disasters.
- Industrial zoning, refinery corridor exposure, air toxics, and fence-line community enforcement.

This category should not become a generic environment bucket. Records should be included only when they clarify Black policy impact, federal/state policy responsibility, measurable exposure/remedy, or historical interpretation.

## Existing Model Fit

Use the current historical policy model first:

- `policies`: one row per law, executive order, agency rule/action, court case, or historically important policy event.
- `policy_categories`: use existing categories for now, typically `Civil Rights`, `Healthcare`, `Housing`, `Business and Economics`, `Social Welfare`, and `Constitutional Rights`.
- `policy_scores`: score directness/material/evidence/durability/equity/harm using the existing rubric. Do not create a new formula.
- `sources`: attach at least one official source plus one contextual source when the official source does not establish racialized impact.
- `eras`: use current era mapping. Do not create a new era for environmental justice.
- `metrics`: add only when there is a defensible, sourced numeric measure, such as pollutant level, homes affected, lead service lines replaced, cleanup status, or grant/remedy funding.

Recommended minimal model additions, not automatic:

- Add `Environmental Justice` as a `policy_categories` value.
- Consider `Infrastructure` or `Transportation Infrastructure` only if highway/urban renewal records become large enough to distort `Housing` and `Business and Economics`.
- Add metric naming conventions:
  - `exposure_level`
  - `affected_population`
  - `cleanup_or_remedy_funding`
  - `housing_units_or_households_affected`
  - `lead_service_lines_replaced`
  - `community_connectivity_barrier_removed_or_mitigated`

## Seed Records

These are candidate records for reviewed ingestion or canonicalization. Verify each source before import. If a record already exists locally, update via enrichment/canonicalization, not duplicate insertion.

| Priority | Candidate record | Type | Era | Initial categories | Why it matters | Best source anchors | Ingestion action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Federal-Aid Highway Act of 1956 and highway displacement | Law / infrastructure program | Civil Rights Era | Housing, Civil Rights, Business and Economics | Explains how federally funded infrastructure cut through Black neighborhoods and created long-tail wealth, mobility, health, and land-use harms. | DOT/FHWA history, Reconnecting Communities materials, academic urban history, local archive examples | New record or family record with careful event framing |
| 2 | Housing Act of 1949 / urban renewal and slum clearance | Law | Civil Rights Era | Housing, Business and Economics, Civil Rights | Anchors displacement before highway expansion and explains how redevelopment policy affected Black neighborhoods. | Congress/statutory records, HUD history, urban renewal scholarship | Review existing Housing Act variants before new insert |
| 3 | National Environmental Policy Act | Law | Contemporary Era | Civil Rights, Business and Economics | Creates environmental review process for major federal actions, including highways and public facilities; important for public participation and infrastructure review. | EPA NEPA summary, CEQ NEPA guide | New record |
| 4 | Clean Air Act of 1970 | Law | Civil Rights Era | Healthcare, Civil Rights, Business and Economics | Foundational air-pollution control law; needed baseline for fence-line air toxics and refinery-corridor records. | EPA Clean Air Act overview/history | New record unless already present under another title |
| 5 | Lead-Based Paint Poisoning Prevention Act | Law | Civil Rights Era | Healthcare, Housing, Civil Rights | Existing local record. Should be recategorized/enriched as environmental justice because lead exposure links housing, public health, and environmental harm. | Congress.gov, EPA/CDC lead guidance | Enrich existing record, do not duplicate |
| 6 | Clean Water Act of 1972 | Law | Civil Rights Era | Healthcare, Civil Rights, Business and Economics | Foundational water-pollution law for surface-water discharge, wastewater, and community exposure analysis. | EPA Clean Water Act summary | New record |
| 7 | Safe Drinking Water Act of 1974 | Law | Post Civil Rights Era | Healthcare, Civil Rights | Core drinking-water governance record needed for Flint, lead service lines, PFAS, and public water system accountability. | EPA SDWA summary/overview | New record |
| 8 | Resource Conservation and Recovery Act | Law | Post Civil Rights Era | Healthcare, Civil Rights, Business and Economics | Establishes hazardous waste cradle-to-grave framework; critical for hazardous siting and disposal harms. | EPA RCRA summary/overview | New record |
| 9 | CERCLA / Superfund | Law | Post Civil Rights Era | Healthcare, Civil Rights, Business and Economics | Establishes federal cleanup authority for hazardous sites; critical to cleanup/remedy comparisons. | EPA Superfund/CERCLA overview/history | New record |
| 10 | Warren County PCB landfill controversy | Policy event / hazardous waste siting | Post Civil Rights Era | Civil Rights, Healthcare, Business and Economics | Landmark environmental-justice siting conflict; useful for explaining how the movement became tied to race and hazardous waste siting. | EPA Superfund site profile, state archives, academic EJ history | Manual-review event record |
| 11 | Residential Lead-Based Paint Hazard Reduction Act / Title X | Law | Contemporary Era | Housing, Healthcare, Civil Rights | Strengthens lead-hazard disclosure and abatement framework; complements the 1971 lead law without duplicating it. | EPA Title X page, statute text | New record |
| 12 | Executive Order 12898 | Executive Order | Contemporary Era | Civil Rights, Healthcare, Business and Economics | Existing local record. Foundational federal environmental-justice framework requiring agencies to address minority and low-income environmental health effects. | EPA EO 12898 summary, Title VI/EJ materials | Enrich existing record, add proposed category later |
| 13 | Hurricane Katrina federal response and Post-Katrina Emergency Management Reform Act | Disaster response / law | Contemporary Era | Civil Rights, Healthcare, Housing, Social Welfare | Tests whether disaster governance protected Black communities equitably; important for infrastructure, evacuation, housing, and recovery claims. | Congress Katrina report, FEMA/White House lessons-learned materials | Split into event plus reform-law record if needed |
| 14 | Flint water crisis and EPA Safe Drinking Water Act emergency order | Policy failure / enforcement event | Contemporary Era | Healthcare, Civil Rights, Housing | High-salience water governance failure involving lead exposure, public trust, and infrastructure remedy in a majority-Black city. | EPA Flint page/documents, Michigan official records, court/settlement records | Manual-review event record |
| 15 | Reconnecting Communities Pilot Program / Infrastructure Investment and Jobs Act | Law / grant program | Contemporary Era | Civil Rights, Housing, Business and Economics | Remedy-side counterpart to highway displacement; tracks federal recognition of past transportation infrastructure harms. | DOT Reconnecting Communities program and FAQ | New record |

## Second Wave

Prioritize after the starter set stabilizes:

- EPA/DOJ Denka chloroprene enforcement in St. John the Baptist Parish, Louisiana, and the 2024 chloroprene/ethylene oxide air toxics final rule. This is the strongest industrial corridor / refinery corridor candidate.
- EPA PFAS National Primary Drinking Water Regulation. Add after SDWA is present so it can be interpreted as a modern drinking-water contaminant rule.
- Justice40 / Executive Order 14008 environmental-justice implementation. Add only with clear distinction between aspiration, grant targeting, and measurable outcomes.
- Brownfields Revitalization and Environmental Restoration Act. Useful for remediation and redevelopment, but less directly Black-impact-specific without local/community source grounding.
- Lead and Copper Rule Revisions / lead service line replacement funding. Add as a modern water-infrastructure remedy record after Flint/SDWA are represented.

## Deeper Expansion

Use these when the category has enough foundational context:

- Cancer Alley / petrochemical corridor enforcement and permitting history beyond Denka.
- Wastewater and sanitation failures in majority-Black rural communities, including Lowndes County, Alabama.
- Flood control, levee, and drainage policy affecting Black neighborhoods.
- Port, freight, railyard, and diesel-emission exposure in Black communities.
- Coal ash disposal and cleanup siting.
- School and child-care environmental hazards, including lead, air toxics, and siting near industrial facilities.

## Source Strategy

Minimum source standard per ingested record:

- One official legal or agency source proving the policy/action/event exists.
- One source establishing Black community relevance or disproportionate burden when the official legal source is race-neutral.
- One outcome/remedy source when claiming measurable impact.

Preferred source types:

- EPA law summaries, program pages, enforcement releases, Superfund site profiles, EJSCREEN materials, and rule pages.
- DOT/FHWA materials for highway and reconnection policy.
- HUD records for urban renewal, housing clearance, and lead hazard programs.
- DOJ civil-rights/environmental enforcement releases for Title VI or Clean Air Act actions.
- Congress.gov, GPO, and committee reports for laws and disaster-response investigations.
- CDC/ATSDR for health impact and exposure context.
- Peer-reviewed scholarship or major government reports for racialized burden when official records are too neutral.
- Local government and archive sources only as secondary grounding, not sole proof for national policy records.

Useful official source anchors:

- EPA EO 12898 summary: https://19january2021snapshot.epa.gov/laws-regulations/summary-executive-order-12898-federal-actions-address-environmental-justice
- EPA NEPA summary: https://www.epa.gov/laws-regulations/summary-national-environmental-policy-act
- EPA Clean Air Act overview: https://www.epa.gov/clean-air-act-overview
- EPA Clean Water Act summary: https://www.epa.gov/laws-regulations/summary-clean-water-act
- EPA Safe Drinking Water Act summary: https://www.epa.gov/laws-regulations/summary-safe-drinking-water-act
- EPA RCRA summary: https://www.epa.gov/laws-regulations/summary-resource-conservation-and-recovery-act
- EPA CERCLA overview: https://www.epa.gov/superfund/superfund-cercla-overview
- EPA lead laws/regulations: https://www.epa.gov/lead/lead-laws-and-regulations
- EPA Residential Lead-Based Paint Hazard Reduction Act: https://www.epa.gov/lead/residential-lead-based-paint-hazard-reduction-act-1992-title-x
- EPA Flint page: https://www.epa.gov/flint
- DOT Reconnecting Communities: https://www.transportation.gov/reconnecting
- DOT Reconnecting Communities FAQ: https://www.transportation.gov/grants/reconnecting-communities/reconnecting-communities-faqs
- EPA/DOJ Denka complaint release: https://www.epa.gov/newsreleases/epa-and-justice-department-file-complaint-alleging-public-health-endangerment-caused
- EPA 2024 chloroprene/EtO final rule: https://www.epa.gov/hazardous-air-pollutants-ethylene-oxide/final-rule-strengthen-standards-synthetic-organic-chemical
- EPA PFAS drinking water rule page: https://www.epa.gov/sdwa/and-polyfluoroalkyl-substances-pfas
- Congress Katrina report: https://www.congress.gov/committee-report/109th-congress/house-report/377

## Staged Ingestion Order

Starter set:

1. Canonicalize/enrich existing `Lead-Based Paint Poisoning Prevention Act`.
2. Canonicalize/enrich existing `Executive Order 12898`.
3. Add `Federal-Aid Highway Act of 1956`.
4. Add `Housing Act of 1949 / urban renewal`.
5. Add `Safe Drinking Water Act`.
6. Add `Flint water crisis / EPA SDWA emergency order`.
7. Add `Reconnecting Communities Pilot Program`.

Second wave:

1. Add NEPA.
2. Add Clean Air Act.
3. Add Clean Water Act.
4. Add RCRA.
5. Add CERCLA/Superfund.
6. Add Title X / Residential Lead-Based Paint Hazard Reduction Act.
7. Add Hurricane Katrina response and Post-Katrina reform.
8. Add Denka/chloroprene enforcement and 2024 air toxics rule.

Deeper expansion:

1. Warren County PCB landfill controversy.
2. PFAS drinking-water regulation.
3. Justice40 / EO 14008 implementation.
4. Brownfields law and cleanup funding.
5. Rural sanitation and wastewater inequity.
6. Port/freight/railyard diesel exposure.
7. Coal ash and industrial waste cleanup siting.

## Ingestion Guardrails

- Run duplicate audit before inserting any seed whose title overlaps existing `Housing Act`, `Lead`, `Executive Order 12898`, `Clean Air`, or `Civil Rights` records.
- Use `impact_direction=Mixed` for broad environmental statutes where benefits are real but enforcement gaps or uneven implementation are central.
- Use `impact_direction=Negative` only for policy failures or harmful siting/displacement events, not for the existence of a remedial law.
- Keep policy events separate from laws when a later remedial law does not fully represent the harm event.
- Do not score highly on directness when the statute is race-neutral and Black impact comes mainly through implementation context.
- Prefer metrics only when the source supplies comparable numbers; otherwise leave `metrics: []`.

## Minimal Import Scaffolding

Recommended first pack name:

```text
python/data/policies/environmental_justice_infrastructure_harm_pack_1.json
```

Recommended first-pack contents:

- Existing-record enrichment notes for Lead-Based Paint Poisoning Prevention Act and EO 12898.
- New records for Federal-Aid Highway Act of 1956, Housing Act of 1949, Safe Drinking Water Act, Flint water crisis / EPA emergency order, and Reconnecting Communities Pilot Program.

Do not import the pack until:

- The historical duplicate audit has been reviewed.
- Each record has at least one official source and one Black-impact context source where needed.
- `Environmental Justice` category creation has been explicitly approved or the records are mapped to existing categories only.
