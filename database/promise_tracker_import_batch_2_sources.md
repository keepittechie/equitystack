# Promise Tracker Import Batch 2 Source Review

This file is a manual source-review manifest for the approved Promise Tracker batch 2 records.

Scope:
- `obama-homeowner-foreclosure-prevention-fund`
- `obama-voter-intimidation-deceptive-practices-act`
- `trump-ensure-long-term-hbcu-funding`
- `biden-increase-access-affordable-housing`
- `biden-hbcu-msi-affordability`
- `biden-restore-voting-rights-after-felony-sentences`

This manifest does not insert or join any source rows. It exists so promise-level, action-level, and outcome-level sources can be reconciled manually later under the current schema.

## Obama: homeowner foreclosure prevention

| Promise slug | Source level | Proposed source title | Source URL | Source type | Publisher | Published date | Why it belongs here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `obama-homeowner-foreclosure-prevention-fund` | promise-level | Create a foreclosure prevention fund for homeowners | https://www.politifact.com/truth-o-meter/promises/obameter/promise/15/create-a-foreclosure-prevention-fund-for-homeowner/ | News | PolitiFact |  | Primary tracker record for the original campaign promise and its later evaluation. |
| `obama-homeowner-foreclosure-prevention-fund` | action-level | Homeowner Affordability and Stability Plan Executive Summary | https://home.treasury.gov/news/press-releases/tg33 | Government | U.S. Department of the Treasury | 2009-02-18 | Direct source for the administration action launching the homeowner stabilization and refinancing effort. |
| `obama-homeowner-foreclosure-prevention-fund` | action-level | Relief for Responsible Homeowners: Treasury Announces Requirements for the Making Home Affordable Program | https://home.treasury.gov/news/press-releases/200934145912322 | Government | U.S. Department of the Treasury | 2009-03-04 | Direct source for implementation details of the mortgage modification and refinancing program. |

## Obama: deceptive practices and voter intimidation

| Promise slug | Source level | Proposed source title | Source URL | Source type | Publisher | Published date | Why it belongs here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `obama-voter-intimidation-deceptive-practices-act` | promise-level | Sign the Deceptive Practices and Voter Intimidation Prevention Act into law | https://www.politifact.com/truth-o-meter/promises/obameter/promise/296/sign-the-deceptive-practices-and-voter-intimidatio/ | News | PolitiFact |  | Primary tracker reference for the promise language and promise framing. |
| `obama-voter-intimidation-deceptive-practices-act` | action-level | H.R.97 - Deceptive Practices and Voter Intimidation Prevention Act of 2009 | https://www.congress.gov/bill/111th-congress/house-bill/97 | Government | Congress.gov | 2009-01-06 | Legislative source documenting the bill used as the main federal vehicle tied to the promise. |
| `obama-voter-intimidation-deceptive-practices-act` | outcome-level | Sign the Deceptive Practices and Voter Intimidation Prevention Act into law: Bill pending in Congress | https://www.politifact.com/truth-o-meter/promises/obameter/promise/296/sign-the-deceptive-practices-and-voter-intimidatio/article/260/ | News | PolitiFact | 2009-11-02 | Status update supporting the blocked outcome because the legislation stalled without enactment. |

## Trump: long-term HBCU funding

| Promise slug | Source level | Proposed source title | Source URL | Source type | Publisher | Published date | Why it belongs here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `trump-ensure-long-term-hbcu-funding` | promise-level | Ensure funding for historic black colleges | https://www.politifact.com/truth-o-meter/promises/trumpometer/promise/1366/ensure-funding-historic-black-colleges/ | News | PolitiFact |  | Primary tracker record for the original promise and its delivery assessment. |
| `trump-ensure-long-term-hbcu-funding` | action-level | Presidential Executive Order on The White House Initiative to Promote Excellence and Innovation at Historically Black Colleges and Universities | https://trumpwhitehouse.archives.gov/presidential-actions/presidential-executive-order-white-house-initiative-promote-excellence-innovation-historically-black-colleges-universities/ | Government | Trump White House Archive | 2017-02-28 | Official White House action establishing the HBCU initiative structure under the administration. |
| `trump-ensure-long-term-hbcu-funding` | action-level | H.R.5363 - FUTURE Act | https://www.congress.gov/bill/116th-congress/house-bill/5363 | Government | Congress.gov | 2019-12-19 | Legislative source for the law that locked in long-term federal support relevant to HBCUs and other MSIs. |

## Biden: affordable housing access

| Promise slug | Source level | Proposed source title | Source URL | Source type | Publisher | Published date | Why it belongs here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `biden-increase-access-affordable-housing` | promise-level | Increase access to affordable housing | https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1541/increase-access-affordable-housing/ | News | PolitiFact |  | Primary tracker reference for the campaign housing promise and later rating. |
| `biden-increase-access-affordable-housing` | action-level | President Biden Signs the American Rescue Plan | https://www.whitehouse.gov/briefing-room/statements-releases/2021/03/11/president-biden-signs-the-american-rescue-plan/ | Government | The White House | 2021-03-11 | Official enactment source for major housing, rental, homeowner, and homelessness assistance. |
| `biden-increase-access-affordable-housing` | action-level | President Biden Announces New Actions to Ease the Burden of Housing Costs | https://www.whitehouse.gov/briefing-room/statements-releases/2022/05/16/president-biden-announces-new-actions-to-ease-the-burden-of-housing-costs/ | Government | The White House | 2022-05-16 | Official source for the Housing Supply Action Plan and related administrative steps. |

## Biden: HBCU and MSI affordability

| Promise slug | Source level | Proposed source title | Source URL | Source type | Publisher | Published date | Why it belongs here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `biden-hbcu-msi-affordability` | promise-level | Make HBCUs, TCUs, and under-resourced MSIs more affordable for their students | https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1599/make-hbcus-tcus-and-under-resourced-msis-more-affo/ | News | PolitiFact |  | Primary tracker reference for the campaign promise and later assessment. |
| `biden-hbcu-msi-affordability` | action-level | Allocations Under the American Rescue Plan Act of 2021 for HBCUs | https://www.ed.gov/sites/ed/files/about/offices/list/ope/arpa2hbcuallocationtable.pdf | Government | U.S. Department of Education | 2021-05-11 | Department of Education source showing HBCU-specific funding allocations under ARPA. |
| `biden-hbcu-msi-affordability` | action-level | FACT SHEET: Biden-Harris Administration Announces Record Over $16 Billion in Support for Historically Black Colleges and Universities (HBCUs) | https://www.presidency.ucsb.edu/documents/fact-sheet-biden-harris-administration-announces-record-over-16-billion-support-for | Archive | The American Presidency Project | 2024-05-16 | Archived White House fact sheet summarizing multi-year federal support levels for HBCUs. |

## Biden: voting rights restoration after felony sentences

| Promise slug | Source level | Proposed source title | Source URL | Source type | Publisher | Published date | Why it belongs here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `biden-restore-voting-rights-after-felony-sentences` | promise-level | Incentivize states to restore voting rights to convicted felons | https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1532/incentivize-states-restore-voting-rights-convicted/ | News | PolitiFact |  | Primary tracker record for the promise itself. |
| `biden-restore-voting-rights-after-felony-sentences` | action-level | Statement of Administration Policy: H.R. 1 – For the People Act of 2021 | https://www.whitehouse.gov/wp-content/uploads/2021/03/SAP_HR-1.pdf | Government | Executive Office of the President | 2021-03-01 | Administration policy statement backing the main federal voting-rights vehicle tied to the promise area. |
| `biden-restore-voting-rights-after-felony-sentences` | action-level | H.R.1 - For the People Act of 2021 | https://www.congress.gov/bill/117th-congress/house-bill/1 | Government | Congress.gov | 2021-03-01 | Legislative record for the bill that carried relevant federal voting-rights restoration language. |
| `biden-restore-voting-rights-after-felony-sentences` | outcome-level | Broken promise: Biden makes no effort to incentivize states to restore voting rights after felony | https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1532/incentivize-states-restore-voting-rights-convicted/article/2979/ | News | PolitiFact | 2024-06-13 | Outcome-level source supporting the failed or unrealized result. |
