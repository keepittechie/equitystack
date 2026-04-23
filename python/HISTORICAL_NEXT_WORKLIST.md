# Historical Next Worklist

This file turns the broader backlog in [`COVERAGE_BACKLOG.md`](./COVERAGE_BACKLOG.md) into a concrete build order based on the repo as it exists now.

Several themes named in the older backlog are no longer fully "missing":
- `reconstruction_expansion_pack_2.json` already exists
- `executive_agency_actions_pack_1.json` already exists
- `blocked_reforms_pack_1.json` already exists
- much of the early disfranchisement case line was folded into `jim_crow_housing_labor_pack_2.json`

The next passes should therefore focus on the strongest subject areas that are still materially underbuilt, not on recreating placeholder pack names that now overlap existing files.

## Immediate Build Order

### 1. `hbcu_federal_policy_pack_1.json`

Why this is first:
- HBCUs are still a thin subject area in the checked-in corpus
- the repo has a modern HBCU funding anchor (`FUTURE Act`) but not a durable historical policy line
- the federal role is clear, documentable, and spans law, executive action, and program design
- these records improve education coverage without duplicating existing civil-rights or voting packs

Target record types:
- land-grant and higher-education statutes
- executive actions directed at HBCU participation in federal programs
- long-running federal HBCU support programs

Started in this pass:
- `python/data/policies/hbcu_federal_policy_pack_1.json`

### 2. `administrative_civil_rights_enforcement_pack_1.json`

Why next:
- the site still leans too heavily on statutes and court cases
- administrative enforcement remains one of the biggest structural gaps
- this is one of the highest-value ways to deepen policy pages without inventing new schema

Likely targets:
- Title VI enforcement architecture
- school desegregation enforcement actions
- DOJ or agency civil-rights enforcement directives
- housing and education enforcement guidance and rollbacks

### 3. `structural_indirect_impact_pack_1.json`

Why next:
- the corpus still overweights direct and explicit Black-impact records
- EquityStack needs stronger examples of racially unequal outcomes produced through nominally race-neutral design

Likely targets:
- welfare and benefits design
- tax and labor structures
- zoning, finance, and federal implementation choices

### 4. `new_deal_exclusion_pack_1.json`

Why next:
- some New Deal exclusion anchors already exist, but they are spread across unrelated packs
- a dedicated pack would make this subject area easier to extend and reason about

Likely targets:
- Agricultural Adjustment Act
- domestic and agricultural labor exclusions
- federal benefit design with racially unequal access

### 5. Voting-rights / disfranchisement continuation

Do not create a duplicate pack just because the older backlog suggested one.

Instead:
- extend the existing Jim Crow and voting-rights line with missing doctrine where needed
- keep new additions in the most canonical pack rather than splitting the same theme across more files

Likely targets:
- `Terry v. Adams`
- `Gomillion v. Lightfoot`
- other missing pre-VRA doctrine only if not already represented elsewhere

## Cleanup Before Large Expansion

Before another broad import wave, clean the known title-year duplicates already noted in `COVERAGE_BACKLOG.md`.

Most important duplicates to resolve first:
- `Regents of the University of California v. Bakke`
- `Grutter v. Bollinger`
- `Shelby County v. Holder`
- `First Step Act`
- `South Carolina v. Katzenbach`

## Working Rule

For the next historical passes:
- prefer genuinely missing subject areas over duplicate pack themes
- prefer canonical placement over more pack sprawl
- use official or primary public sources whenever possible
- keep modeling disciplined when the federal role is indirect or mixed
