# Historical Coverage Backlog

This file is a working backlog for expanding EquityStack's historical corpus.
It is based on the current JSON packs under [`data/policies`](data/policies), plus the database schema and app behavior already in the repo.

It is not a claim that the database is wrong. It is a planning document for what is most likely still missing or underrepresented.

## Current Corpus Snapshot

- Full policy records in JSON packs: `77`
- Enrichment records in JSON packs: `38`
- Current year span: `1870` to `2023`
- Dominant record types:
  - `Law`: `41`
  - `Court Case`: `32`
- Thin record types:
  - `Executive Order`: `2`
  - `Amendment`: `1`
  - `Program`: `1`
  - `Agency Action`: `0`

## Main Structural Gaps

### 1. Reconstruction is too thin

Current coverage:
- `3` records
- only `1870-1871`

What is missing:
- more Reconstruction Acts and enforcement regime records
- Freedmen's Bureau and related federal administrative/programmatic actions
- 13th, 14th, and 15th Amendment implementation context
- rollback and abandonment records after Reconstruction
- education, labor, and land-policy records affecting freedpeople

Suggested next pack:
- `reconstruction_expansion_pack_2.json`

### 2. Jim Crow coverage is still selective

Current coverage:
- `11` records across `1883-1938`

What is likely missing:
- disfranchisement laws and state constitutional changes
- anti-lynching failures and blocked federal intervention efforts
- segregation in transportation, public accommodations, and education
- convict leasing, peonage, and labor exclusion policy
- New Deal and agricultural labor exclusions
- federal mortgage, appraisal, and insurance administration records beyond the current anchors

Suggested next packs:
- `jim_crow_disenfranchisement_pack_2.json`
- `new_deal_exclusion_pack_1.json`

### 3. Executive and agency action coverage is too light

Current coverage:
- `2` executive orders
- `0` agency action records

Why this matters:
- the site explicitly tracks executive actions and administrative behavior
- current corpus leans too heavily on statutes and cases

What is likely missing:
- DOJ and federal enforcement policy shifts
- HUD, FHA, VA, USDA, SSA, and Education Department actions
- civil rights enforcement guidance and rollback
- administrative desegregation and deregulation actions
- policing, sentencing, and prosecutorial policy directives

Suggested next pack:
- `executive_agency_actions_pack_1.json`

### 4. Blocked and failed reform is underrepresented

Current JSON set has very few blocked records relative to the site's stated mission.

What is likely missing:
- failed anti-lynching bills
- blocked voting-rights restoration efforts
- stalled reparations bills and commissions
- failed policing reform packages
- blocked labor and housing equity efforts

Suggested next pack:
- `blocked_reforms_pack_1.json`

### 5. Indirect structural policy is underrepresented

Every full JSON policy record currently appears to have `direct_black_impact = true`.

Why this matters:
- many of the most important policies affecting Black Americans were structurally indirect
- current corpus may understate policy areas where race-neutral design produced racially unequal outcomes

What is likely missing:
- tax, labor, welfare, housing finance, education funding, zoning, and sentencing structures
- administrative underenforcement and omission
- federal benefits design with racially unequal implementation effects

Suggested next pack:
- `structural_indirect_impact_pack_1.json`

### 6. Thin subject areas

These areas are present but not yet deep enough:

- `Healthcare`
- `Military and Veterans`
- `HBCUs`
- `Social Welfare`
- `Labor`
- `Business and Economics` beyond a few anchors

Suggested next packs:
- `healthcare_equity_pack_1.json`
- `black_veterans_policy_pack_1.json`
- `hbcu_federal_policy_pack_1.json`
- `social_welfare_exclusion_pack_1.json`

## Suspected Duplicate Records Across Packs

These title-year duplicates appear in multiple full policy packs and should be cleaned up before major expansion.

| Year | Title | Duplicate Packs |
|---|---|---|
| 1966 | South Carolina v. Katzenbach | `voting_housing_desegregation_pack_1.json`, `voting_rights_pack_1.json` |
| 1968 | Jones v. Alfred H. Mayer Co. | `supreme_economic_policy_pack3.json`, `voting_housing_desegregation_pack_1.json` |
| 1969 | Allen v. State Board of Elections | `voting_housing_desegregation_pack_1.json`, `voting_rights_pack_1.json` |
| 1977 | Community Reinvestment Act of 1977 | `housing_equity_justice_pack_1.json`, `supreme_economic_policy_pack3.json` |
| 1978 | Regents of the University of California v. Bakke | `education_affirmative_action_pack_1.json`, `supreme_economic_policy_pack3.json` |
| 1986 | Anti-Drug Abuse Act of 1986 | `criminal_justice_pack_1.json`, `modern_policy_pack_1.json` |
| 1988 | Anti-Drug Abuse Act of 1988 | `criminal_justice_pack_1.json`, `modern_policy_pack_1.json` |
| 2003 | Grutter v. Bollinger | `education_affirmative_action_pack_1.json`, `supreme_economic_policy_pack3.json` |
| 2013 | Shelby County v. Holder | `modern_policy_pack_1.json`, `voting_rights_pack_1.json` |
| 2018 | First Step Act | `criminal_justice_pack_1.json`, `modern_policy_pack_1.json` |
| 2021 | Brnovich v. Democratic National Committee | `modern_policy_pack_2.json`, `voting_rights_pack_1.json` |
| 2021 | George Floyd Justice in Policing Act | `labor_voting_justice_pack_2.json`, `modern_policy_pack_2.json` |

Recommended action:
- pick one canonical pack location for each duplicate
- remove the duplicate copy from the secondary pack
- if both copies contain useful notes or sources, merge those before deleting

## Recommended Next JSON Pack Themes

These are the highest-value next additions in order.

### Tier 1

1. `reconstruction_expansion_pack_2.json`
2. `jim_crow_disenfranchisement_pack_2.json`
3. `executive_agency_actions_pack_1.json`
4. `blocked_reforms_pack_1.json`
5. `jim_crow_housing_labor_pack_2.json`

### Tier 2

1. `new_deal_exclusion_pack_1.json`
2. `structural_indirect_impact_pack_1.json`
3. `healthcare_equity_pack_1.json`
4. `black_veterans_policy_pack_1.json`

### Tier 3

1. `hbcu_federal_policy_pack_1.json`
2. `social_welfare_exclusion_pack_1.json`
3. `labor_exclusion_and_union_access_pack_1.json`
4. `administrative_civil_rights_enforcement_pack_1.json`

## Era-by-Era Next Research Targets

### Civil War and Reconstruction

Prioritize:
- federal reconstruction architecture
- freedpeople education and labor policy
- constitutional enforcement design
- rollback and retreat from Reconstruction

### Jim Crow and Disenfranchisement

Prioritize:
- segregation doctrine and implementation
- disfranchisement mechanisms
- anti-lynching bill failures
- housing and labor exclusion design

### Civil Rights Era

Prioritize:
- more executive and enforcement actions
- federal education and housing enforcement
- labor and veterans administration gaps

### Post Civil Rights Era

Prioritize:
- policing, sentencing, and incarceration escalation
- affirmative action doctrine
- welfare and labor restructuring
- urban disinvestment and housing finance policy

### Contemporary and Modern Eras

Prioritize:
- voting rights rollback and restoration efforts
- policing and sentencing reform
- HBCU and wealth-building legislation
- administrative actions, guidance, and reversals

## Suggested Working Order

If you want the cleanest path forward, do this next:

1. Clean duplicates already in the JSON packs.
2. Build `reconstruction_expansion_pack_2.json`.
3. Build `jim_crow_disenfranchisement_pack_2.json`.
4. Build `executive_agency_actions_pack_1.json`.
5. Build `blocked_reforms_pack_1.json`.

## Important Note

The lack of direct database access in this shell means this backlog is based on the checked-in JSON packs and the schema you confirmed in the session, not a live full-table SQL audit.

If you later want a stricter audit against the actual live database rows, the best next step is:
- export the `policies` table with `title`, `year_enacted`, `policy_type`, `impact_direction`, `status`
- export category joins
- then compare the live DB against this backlog
