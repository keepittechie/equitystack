# Promise Tracker Sourcing Batch 1

## Scope
This batch is a research starter for ingesting real presidential promises into the Promise Tracker schema.

Included in this batch:
- 10 Barack Obama promises
- 10 Donald Trump promises
- 10 Joe Biden promises

Not included yet:
- George W. Bush

Reason:
- PolitiFact has formal promise trackers for Obama, Trump, and Biden.
- PolitiFact does not provide a comparable Bush tracker, so Bush should be sourced separately from campaign archives, White House archives, Congress, and major news coverage.

## Status Mapping
Suggested PolitiFact-to-EquityStack status mapping:
- `Promise Kept` -> `Delivered`
- `Compromise` -> `Partial`
- `Promise Broken` -> `Failed`
- `Stalled` -> `Blocked`
- `In the Works` or `Not Yet Rated` -> `In Progress`

## Obama

### 1. Close Guantanamo Bay
- `title`: Close Guantanamo Bay detention facility
- `promise_text`: "As president, Barack Obama will close the detention facility at Guantanamo."
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: National Security / Human Rights
- `initial_status`: Failed
- `likely_actions`:
  - Executive order to close Guantanamo
  - detainee review and transfer process
  - repeated closure proposals blocked by Congress
- `likely_outcomes`:
  - prison population reduced significantly
  - facility remained open at the end of Obama’s term
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/obameter/promise/177/close-the-guantanamo-bay-detention-center/
  - White House archive: https://obamawhitehouse.archives.gov/the-press-office/remarks-president-signing-executive-orders-closing-guantanamo-detention-center-and-re

### 2. Withdraw combat brigades from Iraq
- `title`: End combat-brigade deployment in Iraq
- `promise_text`: "Barack Obama will work with military commanders on the ground in Iraq and in consultation with the Iraqi government to end the war safely and responsibly within 16 months."
- `president`: Barack Obama
- `approximate_date`: 2008-07-14
- `topic`: Foreign Policy / Military
- `initial_status`: Partial
- `likely_actions`:
  - troop drawdown timetable
  - end of formal U.S. combat mission
  - residual presence and later renewed U.S. military involvement
- `likely_outcomes`:
  - combat brigades removed
  - broader conflict did not fully end
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/obameter/promise/126/begin-removing-combat-brigades-from-iraq/
  - White House archive: https://obamawhitehouse.archives.gov/the-press-office/2011/10/21/remarks-president-ending-war-iraq

### 3. Repeal Don’t Ask, Don’t Tell
- `title`: Repeal Don’t Ask, Don’t Tell
- `promise_text`: "Repeal 'Don't Ask, Don't Tell' policy in the military."
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: LGBTQ Rights / Military
- `initial_status`: Delivered
- `likely_actions`:
  - legislative repeal
  - Defense Department implementation and certification
- `likely_outcomes`:
  - gay and lesbian service members allowed to serve openly
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/obameter/promise/293/call-for-repeal-of-dont-ask-dont-tell-policy/
  - Congress: https://www.congress.gov/bill/111th-congress/house-bill/2965
  - AP/KPBS: https://www.kpbs.org/news/military/2010/12/22/obama-signs-dont-ask-dont-tell-repeal

### 4. Require insurance companies to cover pre-existing conditions
- `title`: Ban pre-existing-condition exclusions
- `promise_text`: "Require insurance companies to cover pre-existing conditions so all Americans, regardless of their health status or history, can get comprehensive benefits at fair and stable premiums."
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: Health Care
- `initial_status`: Delivered
- `likely_actions`:
  - Affordable Care Act
  - HHS implementation of insurance-market rules
- `likely_outcomes`:
  - federal protection against pre-existing-condition exclusions in ACA markets
- `sources`:
  - PolitiFact subject page: https://www.politifact.com/truth-o-meter/promises/subjects/health-care/
  - Congress: https://www.congress.gov/bill/111th-congress/house-bill/3590
  - White House archive: https://obamawhitehouse.archives.gov/healthreform

### 5. Create a credit card bill of rights
- `title`: Enact a credit card bill of rights
- `promise_text`: "The credit card bill of rights would ban unilateral changes ... apply interest rate increases only to future debt ... prohibit interest on fees ..."
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: Consumer Protection / Financial Regulation
- `initial_status`: Delivered
- `likely_actions`:
  - Credit CARD Act of 2009
  - CFPB and regulator implementation
- `likely_outcomes`:
  - tighter rules on rate hikes and billing practices
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/obameter/promise/54/establish-a-credit-card-bill-of-rights/
  - Congress: https://www.congress.gov/bill/111th-congress/house-bill/627

### 6. Sign the Lilly Ledbetter Fair Pay Act
- `title`: Restore the ability to challenge pay discrimination
- `promise_text`: Obama pledged to support legislation overturning the Ledbetter pay-discrimination ruling.
- `president`: Barack Obama
- `approximate_date`: 2008-08-01
- `topic`: Workers / Gender Equity
- `initial_status`: Delivered
- `likely_actions`:
  - Lilly Ledbetter Fair Pay Act
- `likely_outcomes`:
  - filing period reset with each discriminatory paycheck
- `sources`:
  - PolitiFact reference page: https://www.politifact.com/truth-o-meter/promises/obameter/
  - Congress: https://www.congress.gov/bill/111th-congress/senate-bill/181
  - White House archive: https://obamawhitehouse.archives.gov/realitycheck/node/4308

### 7. Create a tax credit for workers
- `title`: Enact a worker tax credit
- `promise_text`: "Enact a Making Work Pay tax credit that would equal 6.2 percent of up to $8,100 of earnings (yielding a maximum credit of approximately $500). Indexed for inflation."
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: Taxes / Economy
- `initial_status`: Partial
- `likely_actions`:
  - Making Work Pay tax credit in stimulus legislation
  - later payroll-tax reduction replacing the original design
- `likely_outcomes`:
  - worker tax relief delivered, but not in the exact promised form or duration
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/obameter/promise/32/create-a-tax-credit-for-workers/
  - Congress: https://www.congress.gov/bill/111th-congress/house-bill/1

### 8. Expand SCHIP
- `title`: Expand children’s health insurance coverage
- `promise_text`: Obama pledged to expand eligibility for Medicaid and SCHIP.
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: Health Care / Children
- `initial_status`: Delivered
- `likely_actions`:
  - CHIP reauthorization and expansion
- `likely_outcomes`:
  - broader coverage for children
- `sources`:
  - PolitiFact subject page: https://www.politifact.com/truth-o-meter/promises/subjects/health-care/
  - Congress: https://www.congress.gov/bill/111th-congress/house-bill/2

### 9. Lift Bush-era restrictions on embryonic stem cell research
- `title`: Ease federal restrictions on embryonic stem cell research
- `promise_text`: Obama pledged to remove barriers to responsible stem cell research.
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: Science / Health
- `initial_status`: Delivered
- `likely_actions`:
  - executive order reversing earlier policy limits
- `likely_outcomes`:
  - wider federally supported research access within legal limits
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/obameter/
  - White House archive: https://obamawhitehouse.archives.gov/the-press-office/removing-barriers-responsible-scientific-research-involving-human-stem-cells

### 10. Repeal Bush tax cuts for higher incomes
- `title`: Roll back Bush tax cuts for upper-income households
- `promise_text`: "Repeal the Bush tax cuts for those making more than $250,000 (couples) or $200,000 (single)."
- `president`: Barack Obama
- `approximate_date`: 2008-01-01
- `topic`: Taxes / Economy
- `initial_status`: Partial
- `likely_actions`:
  - fiscal-cliff tax legislation
- `likely_outcomes`:
  - higher rates restored for top earners, but through negotiated compromise
- `sources`:
  - PolitiFact subject page: https://www.politifact.com/truth-o-meter/promises/subjects/taxes/
  - Congress: https://www.congress.gov/bill/112th-congress/house-bill/8

## Trump

### 1. Withdraw from the Trans-Pacific Partnership
- `title`: Withdraw the United States from TPP
- `promise_text`: Trump pledged to "issue our notification of intent to withdraw from the Trans-Pacific Partnership, a potential disaster for our country."
- `president`: Donald Trump
- `approximate_date`: 2016-06-28
- `topic`: Trade
- `initial_status`: Delivered
- `likely_actions`:
  - presidential memorandum withdrawing from TPP
- `likely_outcomes`:
  - U.S. withdrew from the trade pact
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/trumpometer/promise/1409/stop-tpp/
  - White House archive: https://trumpwhitehouse.archives.gov/presidential-actions/presidential-memorandum-regarding-withdrawal-united-states-trans-pacific-partnership-negotiations-agreement/

### 2. Build the wall and make Mexico pay for it
- `title`: Build a southern border wall and make Mexico pay
- `promise_text`: "I will build a great, great wall on our southern border. And I will have Mexico pay for that wall."
- `president`: Donald Trump
- `approximate_date`: 2015-06-16
- `topic`: Immigration / Border Security
- `initial_status`: Failed
- `likely_actions`:
  - border wall executive order
  - appropriations fights and emergency declarations
  - barrier replacement and limited new construction
- `likely_outcomes`:
  - barriers expanded or replaced
  - Mexico did not pay
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/trumpometer/promise/1397/build-wall-and-make-mexico-pay-it/
  - White House archive: https://trumpwhitehouse.archives.gov/presidential-actions/executive-order-border-security-immigration-enforcement-improvements/

### 3. Withdraw from the Paris climate accord
- `title`: Exit the Paris climate agreement
- `promise_text`: Trump said he would "cancel" the Paris climate agreement.
- `president`: Donald Trump
- `approximate_date`: 2016-05-26
- `topic`: Climate / Energy
- `initial_status`: Delivered
- `likely_actions`:
  - formal withdrawal announcement
  - State Department notification to the U.N.
- `likely_outcomes`:
  - U.S. formally exited during Trump’s term
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - State Department archive: https://2017-2021.state.gov/on-the-u-s-withdrawal-from-the-paris-agreement/

### 4. Move the U.S. Embassy in Israel to Jerusalem
- `title`: Move the U.S. embassy in Israel to Jerusalem
- `promise_text`: Trump pledged to move the U.S. embassy from Tel Aviv to Jerusalem.
- `president`: Donald Trump
- `approximate_date`: 2016-03-21
- `topic`: Foreign Policy / Middle East
- `initial_status`: Delivered
- `likely_actions`:
  - recognition of Jerusalem as Israel’s capital
  - embassy relocation
- `likely_outcomes`:
  - embassy moved to Jerusalem
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - White House archive: https://trumpwhitehouse.archives.gov/briefings-statements/statement-president-trump-jerusalem/

### 5. Renegotiate or replace NAFTA
- `title`: Replace NAFTA with a new trade deal
- `promise_text`: Trump promised to renegotiate NAFTA or withdraw.
- `president`: Donald Trump
- `approximate_date`: 2016-06-28
- `topic`: Trade / Manufacturing
- `initial_status`: Delivered
- `likely_actions`:
  - trilateral renegotiation
  - USMCA approval
- `likely_outcomes`:
  - NAFTA replaced by USMCA
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - Congress: https://www.congress.gov/bill/116th-congress/house-bill/5430

### 6. Appoint conservative Supreme Court justices
- `title`: Appoint conservative Supreme Court justices
- `promise_text`: Trump pledged to nominate Supreme Court justices in the mold of Antonin Scalia.
- `president`: Donald Trump
- `approximate_date`: 2016-05-18
- `topic`: Courts / Judiciary
- `initial_status`: Delivered
- `likely_actions`:
  - nominations of Neil Gorsuch, Brett Kavanaugh, and Amy Coney Barrett
- `likely_outcomes`:
  - conservative majority strengthened on the Court
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - White House archive: https://trumpwhitehouse.archives.gov/briefings-statements/president-donald-j-trump-announces-nominee-united-states-supreme-court/

### 7. Repeal and replace the Affordable Care Act
- `title`: Repeal and replace the Affordable Care Act
- `promise_text`: Trump repeatedly pledged to "repeal and replace Obamacare."
- `president`: Donald Trump
- `approximate_date`: 2015-06-16
- `topic`: Health Care
- `initial_status`: Failed
- `likely_actions`:
  - House ACA repeal effort
  - Senate repeal votes
  - administrative weakening of ACA elements
- `likely_outcomes`:
  - ACA not repealed
  - some regulatory and tax changes enacted
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - Congress: https://www.congress.gov/bill/115th-congress/house-bill/1628

### 8. Ban travel from several Muslim-majority countries
- `title`: Impose a travel ban on targeted countries
- `promise_text`: Trump called for "a total and complete shutdown of Muslims entering the United States" and later pursued country-based travel restrictions.
- `president`: Donald Trump
- `approximate_date`: 2015-12-07
- `topic`: Immigration / National Security
- `initial_status`: Partial
- `likely_actions`:
  - Executive Order 13769
  - revised travel bans after court challenges
- `likely_outcomes`:
  - narrower country-based bans took effect
  - original blanket formulation not implemented as stated
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - White House archive: https://trumpwhitehouse.archives.gov/presidential-actions/executive-order-protecting-nation-foreign-terrorist-entry-united-states/

### 9. Cut taxes
- `title`: Deliver a large federal tax cut
- `promise_text`: Trump campaigned on a major tax cut for individuals and businesses.
- `president`: Donald Trump
- `approximate_date`: 2016-08-08
- `topic`: Taxes / Economy
- `initial_status`: Delivered
- `likely_actions`:
  - Tax Cuts and Jobs Act
- `likely_outcomes`:
  - corporate tax rate cut
  - broad individual tax changes enacted
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - Congress: https://www.congress.gov/bill/115th-congress/house-bill/1

### 10. Sign criminal justice reform
- `title`: Pass federal criminal justice reform
- `promise_text`: Trump pledged reforms including prison and sentencing changes.
- `president`: Donald Trump
- `approximate_date`: 2018-01-30
- `topic`: Criminal Justice
- `initial_status`: Delivered
- `likely_actions`:
  - First Step Act
- `likely_outcomes`:
  - sentencing and prison reforms enacted
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/trumpometer/
  - Congress: https://www.congress.gov/bill/115th-congress/senate-bill/756

## Biden

### 1. Rejoin the Paris climate agreement
- `title`: Rejoin the Paris climate accord
- `promise_text`: Biden promised to rejoin the Paris Agreement on climate change.
- `president`: Joe Biden
- `approximate_date`: 2020-07-14
- `topic`: Climate
- `initial_status`: Delivered
- `likely_actions`:
  - executive action and U.N. reentry process
- `likely_outcomes`:
  - U.S. rejoined early in Biden’s term
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1544/rejoin-paris-climate-agreement/
  - White House: https://www.whitehouse.gov/briefing-room/statements-releases/2021/01/20/paris-climate-agreement/

### 2. Cancel the Keystone XL pipeline
- `title`: Revoke Keystone XL pipeline permit
- `promise_text`: Biden promised to cancel the Keystone XL pipeline.
- `president`: Joe Biden
- `approximate_date`: 2020-05-14
- `topic`: Climate / Energy
- `initial_status`: Delivered
- `likely_actions`:
  - revocation of presidential permit on day one
- `likely_outcomes`:
  - project terminated
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/
  - White House: https://www.whitehouse.gov/briefing-room/presidential-actions/2021/01/20/executive-order-protecting-public-health-and-the-environment-and-restoring-science-to-tackle-the-climate-crisis/

### 3. Nominate the first Black woman to the Supreme Court
- `title`: Nominate the first Black woman to the Supreme Court
- `promise_text`: Biden pledged to nominate the first Black woman to the U.S. Supreme Court.
- `president`: Joe Biden
- `approximate_date`: 2020-02-25
- `topic`: Courts / Representation
- `initial_status`: Delivered
- `likely_actions`:
  - nomination of Ketanji Brown Jackson
  - Senate confirmation
- `likely_outcomes`:
  - Jackson confirmed and seated on the Court
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1540/nominate-first-black-woman-us-supreme-court/
  - White House: https://www.whitehouse.gov/briefing-room/speeches-remarks/2022/02/25/remarks-by-president-biden-on-the-nomination-of-judge-ketanji-brown-jackson-to-the-supreme-court/

### 4. Forgive student debt from public colleges and universities
- `title`: Forgive tuition-related federal student debt for many public-college borrowers
- `promise_text`: Biden proposed forgiving undergraduate tuition-related federal student debt from public colleges and universities for borrowers earning up to $125,000.
- `president`: Joe Biden
- `approximate_date`: 2020-03-15
- `topic`: Education / Student Debt
- `initial_status`: Partial
- `likely_actions`:
  - 2022 mass-relief plan
  - SAVE plan and targeted debt cancellation
  - court defense and alternative relief channels
- `likely_outcomes`:
  - substantial debt relief delivered
  - full campaign promise not achieved
- `sources`:
  - PolitiFact: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1595/forgive-student-loan-debt-public-colleges-and-univ/
  - White House: https://www.whitehouse.gov/briefing-room/statements-releases/2022/08/24/fact-sheet-president-biden-announces-student-loan-relief-for-borrowers-who-need-it-most/
  - SCOTUSblog: https://www.scotusblog.com/2023/06/supreme-court-strikes-down-biden-student-loan-forgiveness-program/

### 5. Advance racial equity across the federal government
- `title`: Advance racial equity across the federal government
- `promise_text`: Biden pledged to advance racial equity and address barriers facing underserved communities.
- `president`: Joe Biden
- `approximate_date`: 2020-07-28
- `topic`: Government Equity / Racial Justice
- `initial_status`: Partial
- `likely_actions`:
  - executive order on advancing racial equity
  - agency equity assessments and plans
- `likely_outcomes`:
  - broad administrative framework established
  - implementation uneven and vulnerable to reversal
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/
  - White House: https://www.whitehouse.gov/briefing-room/presidential-actions/2021/01/20/executive-order-advancing-racial-equity-and-support-for-underserved-communities-through-the-federal-government/

### 6. Deliver a major infrastructure law
- `title`: Pass a bipartisan infrastructure package
- `promise_text`: Biden campaigned on major infrastructure investment.
- `president`: Joe Biden
- `approximate_date`: 2020-07-14
- `topic`: Infrastructure / Economy
- `initial_status`: Delivered
- `likely_actions`:
  - Infrastructure Investment and Jobs Act
- `likely_outcomes`:
  - large federal infrastructure funding enacted
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/
  - Congress: https://www.congress.gov/bill/117th-congress/house-bill/3684
  - White House: https://www.whitehouse.gov/briefing-room/statements-releases/2021/11/15/remarks-by-president-biden-at-signing-of-h-r-3684-the-infrastructure-investment-and-jobs-act/

### 7. Restore transgender military service
- `title`: Reverse the ban on transgender military service
- `promise_text`: Biden pledged to allow transgender Americans to serve openly in the military.
- `president`: Joe Biden
- `approximate_date`: 2019-07-28
- `topic`: LGBTQ Rights / Military
- `initial_status`: Delivered
- `likely_actions`:
  - executive order revoking Trump-era restrictions
  - Pentagon implementation
- `likely_outcomes`:
  - transgender service restored
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/
  - White House: https://www.whitehouse.gov/briefing-room/presidential-actions/2021/01/25/executive-order-on-enabling-all-qualified-americans-to-serve-their-country-in-uniform/

### 8. Reach 100 million COVID-19 shots in the first 100 days
- `title`: Deliver 100 million COVID-19 vaccine shots in the first 100 days
- `promise_text`: Biden pledged 100 million shots in his first 100 days in office.
- `president`: Joe Biden
- `approximate_date`: 2020-12-08
- `topic`: Public Health / COVID-19
- `initial_status`: Delivered
- `likely_actions`:
  - federal vaccination campaign
  - mass-vaccination sites and supply coordination
- `likely_outcomes`:
  - target met and later doubled
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/
  - White House: https://www.whitehouse.gov/briefing-room/statements-releases/2021/03/25/fact-sheet-president-biden-announces-historic-200-million-shot-goal-in-the-first-100-days/

### 9. Raise the federal minimum wage to $15
- `title`: Raise the federal minimum wage to $15
- `promise_text`: Biden promised to raise the federal minimum wage to $15 per hour.
- `president`: Joe Biden
- `approximate_date`: 2019-04-25
- `topic`: Workers / Wages
- `initial_status`: Failed
- `likely_actions`:
  - inclusion attempt in early legislative package
  - support for separate minimum-wage legislation
- `likely_outcomes`:
  - no federal $15 minimum wage enacted
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/
  - Congress: https://www.congress.gov/bill/117th-congress/house-bill/603

### 10. Nominate and confirm pro-labor NLRB leadership and worker-friendly labor policy
- `title`: Strengthen federal labor protections
- `promise_text`: Biden campaigned as the most pro-union president and promised stronger labor protections.
- `president`: Joe Biden
- `approximate_date`: 2020-09-07
- `topic`: Labor / Workers
- `initial_status`: Partial
- `likely_actions`:
  - pro-labor NLRB appointments
  - executive support for organizing rights
  - failed PRO Act legislation
- `likely_outcomes`:
  - administrative shift toward labor
  - major statutory reform not enacted
- `sources`:
  - PolitiFact tracker: https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/
  - White House: https://www.whitehouse.gov/briefing-room/statements-releases/2021/04/26/statement-by-president-joe-biden-on-amazon-workers-in-bessemer-alabama/

## Notes for Ingestion
- Several entries above are strong candidates for `promises` rows immediately.
- Promises with a clear law or executive order are good first imports because they have cleaner action chains.
- Recommended first import group:
  - Obama: Guantanamo, Iraq, DADT, pre-existing conditions, worker tax credit
  - Trump: TPP, border wall, Paris withdrawal, USMCA, ACA repeal
  - Biden: Paris reentry, Keystone XL, KBJ nomination, student debt, racial equity

## Next Batch
- George W. Bush archival batch
- additional source hardening for each row using Reuters/AP/NYT/Washington Post where helpful
- direct conversion of this research doc into JSON or SQL seed inserts for the Promise Tracker tables
