#!/usr/bin/env python3
import argparse
from collections import Counter
from pathlib import Path
from typing import Any

from current_admin_common import (
    get_db_connection,
    get_reports_dir,
    normalize_nullable_text,
    print_json,
    utc_timestamp,
    write_json_file,
)


VALID_INTENT_CATEGORIES = {
    "equity_expanding",
    "equity_restricting",
    "neutral_administrative",
    "mixed_or_competing",
    "unclear",
}

TIME_DURATION_LABEL = "action_date_only"

# These anchors resolve current-admin outcomes that have multiple structured
# action dates. Each date is an existing promise_actions.action_date anchor,
# not a newly inferred precise impact date.
TIME_ANCHOR_SEEDS = {
    "biden-advance-racial-equity": {
        "impact_start_date": "2021-01-20",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The outcome concerns creation of a federal equity framework; the structured action date for the executive order signing is the earliest direct implementation anchor.",
    },
    "biden-voting-rights-restoration": {
        "impact_start_date": "2021-07-01",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The linked sourced outcome cites Brnovich; the structured court-action date is the clearest available anchor for the blocked/rollback context.",
    },
    "biden-policing-accountability": {
        "impact_start_date": "2021-03-03",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The first structured congressional action is the clearest available anchor for the federal policing-reform effort; no durable enactment date exists.",
    },
    "obama-close-guantanamo-bay": {
        "impact_start_date": "2009-01-22",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The structured executive-order date is the direct action anchor for the closure effort; later restrictions show the long-running failure context.",
    },
    "obama-end-combat-brigade-deployment-iraq": {
        "impact_start_date": "2010-08-31",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The administration declaration ending the combat mission is the clearest structured anchor for the outcome described.",
    },
    "trump-build-border-wall-mexico-pay": {
        "impact_start_date": "2017-01-25",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The executive-order date is the direct action anchor for wall planning; the later funding action is follow-through rather than the first policy anchor.",
    },
    "trump-withdraw-paris-climate-accord": {
        "impact_start_date": "2017-06-01",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The announcement date is the direct policy anchor for the withdrawal outcome; formal withdrawal processing occurred later.",
    },
    "trump-move-embassy-jerusalem": {
        "impact_start_date": "2018-05-14",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The embassy opening is the structured action date when the central promised outcome was implemented.",
    },
    "trump-appoint-conservative-supreme-court-justices": {
        "impact_start_date": "2017-01-31",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The first Supreme Court nomination starts a multi-appointment outcome; the row should be treated as a range beginning at the first appointment action.",
    },
    "biden-forgive-public-college-student-debt": {
        "impact_start_date": "2022-08-24",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The debt-relief plan announcement is the first direct action anchor; later court action explains why the outcome remained partial.",
    },
    "biden-advance-racial-equity-federal-government": {
        "impact_start_date": "2021-01-20",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The executive-order signing is the direct federal equity-framework action anchor.",
    },
    "biden-strengthen-federal-labor-protections": {
        "impact_start_date": "2021-07-28",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The NLRB leadership action is the first structured administrative policy anchor, while the earlier worker-organizing statement is contextual.",
    },
    "obama-homeowner-foreclosure-prevention-fund": {
        "impact_start_date": "2009-02-18",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Homeowner Affordability and Stability Plan announcement is the first direct foreclosure-relief framework anchor.",
    },
    "obama-voter-intimidation-deceptive-practices-act": {
        "impact_start_date": "2009-06-12",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The subcommittee referral/stall date is the clearest structured anchor for the blocked legislative outcome.",
    },
    "trump-ensure-long-term-hbcu-funding": {
        "impact_start_date": "2019-12-19",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The FUTURE Act signing is the direct long-term funding implementation anchor for the outcome.",
    },
    "biden-increase-access-affordable-housing": {
        "impact_start_date": "2021-03-11",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The American Rescue Plan housing-assistance action is the earliest direct fiscal-policy anchor; later supply planning is follow-through.",
    },
    "biden-hbcu-msi-affordability": {
        "impact_start_date": "2021-03-11",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The American Rescue Plan institutional support date starts a multi-action HBCU/MSI support outcome; later debt relief and support totals extend the range.",
    },
    "biden-restore-voting-rights-after-felony-sentences": {
        "impact_start_date": "2021-06-22",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Senate block date is the clearest structured anchor for the blocked federal voting-rights outcome.",
    },
    "obama-sign-employee-free-choice-act": {
        "impact_start_date": "2010-12-22",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The failure-to-enact date is the structured anchor for the blocked labor-law reform outcome.",
    },
    "trump-make-no-cuts-medicaid": {
        "impact_start_date": "2017-05-04",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The House ACA repeal vote is the first direct Medicaid-risk action anchor; later statements and budgets continue the same risk pattern.",
    },
    "biden-offer-public-option-health-plan": {
        "impact_start_date": "2021-08-10",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The later action captures continued ACA expansion without enactment of a public option, the clearest structured anchor for the failed outcome.",
    },
    "biden-end-private-prisons-detention-centers": {
        "impact_start_date": "2021-01-26",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The executive order is the direct policy anchor; later detention-center facts show the partial long-running outcome.",
    },
    "biden-eliminate-cash-bail": {
        "impact_start_date": "2024-12-31",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The no-enactment marker is the structured anchor for the failed federal cash-bail outcome; earlier campaign/no-action markers are contextual.",
    },
    "biden-justice40-disadvantaged-communities": {
        "impact_start_date": "2021-01-27",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The climate/equity order launches Justice40; later infrastructure and IRA investments extend the implementation range.",
    },
    "grant-protect-black-voting-rights-from-ku-klux-klan-terror": {
        "impact_start_date": "1871-10-17",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The federal enforcement action in South Carolina is the direct protection/enforcement anchor for the outcome.",
    },
    "johnson-pass-voting-rights-act-after-selma": {
        "impact_start_date": "1965-08-06",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Voting Rights Act signing is the direct enactment anchor for the delivered outcome.",
    },
    "johnson-pass-fair-housing-act": {
        "impact_start_date": "1968-04-11",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Fair Housing Act signing is the direct enactment anchor for the delivered outcome.",
    },
    "obama-ban-racial-profiling-federal-law-enforcement": {
        "impact_start_date": "2014-12-08",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The Justice Department guidance revision is the first direct administrative implementation anchor for the partial outcome.",
    },
    "biden-eliminate-federal-death-penalty": {
        "impact_start_date": "2021-07-01",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The federal-execution pause is the first governing action anchor; the later commutations continue the partial outcome.",
    },
    "johnson-appoint-thurgood-marshall-supreme-court": {
        "impact_start_date": "1967-08-30",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "Senate confirmation is the direct appointment-completion anchor for the delivered outcome.",
    },
    "nixon-expand-affirmative-action-federal-contracting": {
        "impact_start_date": "1969-09-23",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The revised Philadelphia Plan requirements are the direct implementation anchor for the affirmative-action contracting outcome.",
    },
    "biden-expand-child-tax-credit": {
        "impact_start_date": "2021-03-11",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The American Rescue Plan temporary Child Tax Credit expansion is the direct implementation anchor; expiration explains the partial outcome.",
    },
    "roosevelt-establish-federal-minimum-wage-maximum-hours": {
        "impact_start_date": "1938-06-25",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Fair Labor Standards Act signing is the direct enactment anchor for wage and hour standards.",
    },
    "roosevelt-create-social-security-old-age-unemployment-system": {
        "impact_start_date": "1935-08-14",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Social Security Act signing is the direct enactment anchor for the social-insurance outcome.",
    },
    "grant-sign-civil-rights-act-1875": {
        "impact_start_date": "1875-03-01",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Civil Rights Act signing is the direct enactment anchor for the delivered outcome.",
    },
    "johnson-sign-civil-rights-act-1964": {
        "impact_start_date": "1964-07-02",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Civil Rights Act signing is the direct enactment anchor for the delivered outcome.",
    },
    "johnson-executive-order-11246-federal-contracting": {
        "impact_start_date": "1965-09-24",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The executive-order issuance is the direct policy anchor for contractor nondiscrimination enforcement.",
    },
    "eisenhower-enforce-little-rock-school-desegregation": {
        "impact_start_date": "1957-09-25",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "Federal troop escort is the direct enforcement anchor for the Little Rock desegregation outcome.",
    },
    "eisenhower-sign-civil-rights-act-1957": {
        "impact_start_date": "1957-09-09",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Civil Rights Act signing is the direct enactment anchor for the delivered outcome.",
    },
    "bush-sign-voting-rights-act-reauthorization-2006": {
        "impact_start_date": "2006-07-27",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The reauthorization signing is the direct enactment anchor for the delivered outcome.",
    },
    "truman-desegregate-armed-forces": {
        "impact_start_date": "1948-07-26",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The executive-order date is the direct policy anchor for military desegregation.",
    },
    "kennedy-executive-order-10925-equal-employment": {
        "impact_start_date": "1961-03-06",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The executive-order date is the direct policy anchor for the equal-employment framework.",
    },
    "carter-sign-community-reinvestment-act": {
        "impact_start_date": "1977-10-12",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Community Reinvestment Act signing is the direct enactment anchor for the delivered anti-redlining framework.",
    },
    "hayes-withdraw-federal-troops-compromise-1877": {
        "impact_start_date": "1877-04-24",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The federal troop withdrawal date is the direct action anchor for the negative Reconstruction-protection outcome.",
    },
    "grant-federal-enforcement-weakens-after-cruikshank": {
        "impact_start_date": "1876-03-27",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The Cruikshank decision date is the direct legal anchor for the weakened federal enforcement outcome.",
    },
    "arthur-retreat-from-civil-rights-enforcement": {
        "impact_start_date": "1883-10-15",
        "impact_duration_estimate": "estimated_range",
        "temporal_confidence": "medium",
        "rationale": "The Civil Rights Cases decision date is the direct legal anchor for the narrowed enforcement outcome.",
    },
    "harrison-fail-lodge-elections-bill-federal-voting-protection": {
        "impact_start_date": "1891-01-22",
        "impact_duration_estimate": "action_date_only",
        "temporal_confidence": "medium",
        "rationale": "The Senate failure date is the structured anchor for the failed federal voting-protection outcome.",
    },
}

# These are intentionally conservative exact-title mappings. They only apply
# when the production row exists and has at least one already-linked source.
INTENT_SEEDS = [
    {
        "title": "Emancipation Proclamation",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Declared freedom for enslaved people in Confederate-controlled areas "
            "as a wartime measure and shifted federal policy toward emancipation."
        ),
        "rationale": "Official proclamation text and existing historical source links document the stated emancipation purpose.",
    },
    {
        "title": "13th Amendment",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Abolished slavery and involuntary servitude except as punishment for crime.",
        "rationale": "Constitutional text directly states the slavery/involuntary-servitude prohibition.",
    },
    {
        "title": "Civil Rights Act of 1866",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Established federal civil-rights protections and citizenship-related legal rights "
            "for formerly enslaved people and other citizens."
        ),
        "rationale": "Public law and existing source link support the civil-rights protection intent.",
    },
    {
        "title": "14th Amendment",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Constitutionalized birthright citizenship, due process, and equal protection guarantees."
        ),
        "rationale": "Constitutional text directly states citizenship, due process, and equal protection provisions.",
    },
    {
        "title": "15th Amendment",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Prohibited denying or abridging voting rights based on race, color, or previous condition of servitude."
        ),
        "rationale": "Constitutional text directly states the race/color/previous-servitude voting-rights prohibition.",
    },
    {
        "title": "Enforcement Act of 1870",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Created federal enforcement tools to protect voting rights after the Fifteenth Amendment.",
        "rationale": "Existing congressional and statutory sources document post-Fifteenth-Amendment voting-rights enforcement.",
    },
    {
        "title": "Ku Klux Klan Act of 1871",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Authorized federal action against organized violence and intimidation targeting civil and voting rights."
        ),
        "rationale": "Existing Senate and historical sources document enforcement against Klan violence and rights intimidation.",
    },
    {
        "title": "Civil Rights Act of 1875",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Sought to prohibit racial discrimination in public accommodations and related civic spaces.",
        "rationale": "Existing sources identify the act as a federal public-accommodations civil-rights law.",
    },
    {
        "title": "Plessy v. Ferguson",
        "policy_intent_category": "equity_restricting",
        "policy_intent_summary": (
            "Upheld state-imposed racial segregation under the separate-but-equal doctrine."
        ),
        "rationale": "The decision and existing court/archive sources document validation of legally segregated public facilities.",
    },
    {
        "title": "Brown v. Board of Education",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Held that state-sponsored racial segregation in public schools is unconstitutional.",
        "rationale": "Existing Supreme Court/archive sources document the school desegregation holding.",
    },
    {
        "title": "Civil Rights Act of 1964",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Prohibited major forms of discrimination in public accommodations, federally funded programs, and employment."
        ),
        "rationale": "Existing congressional, archive, and DOJ sources document the act's civil-rights protections.",
    },
    {
        "title": "Voting Rights Act of 1965",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Strengthened federal protections against racial discrimination in voting and election administration."
        ),
        "rationale": "Existing archive, congressional, and DOJ sources document the voting-rights enforcement purpose.",
    },
    {
        "title": "Fair Housing Act of 1968",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Prohibited discrimination in housing transactions and created federal fair-housing enforcement authority."
        ),
        "rationale": "Existing HUD and DOJ sources document the fair-housing anti-discrimination purpose.",
    },
    {
        "title": "Civil Rights Act of 1991",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Strengthened employment-discrimination remedies and clarified civil-rights enforcement after Supreme Court limits."
        ),
        "rationale": "Existing EEOC and congressional sources document the employment-discrimination remedy and enforcement purpose.",
    },
    {
        "title": "Fair Sentencing Act of 2010",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Reduced the federal crack-to-powder cocaine sentencing disparity and related mandatory-minimum penalties."
        ),
        "rationale": "Existing Congress and DOJ sources document the sentencing-disparity reduction purpose.",
    },
    {
        "title": "FUTURE Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Provided permanent mandatory funding support for HBCUs and other minority-serving institutions."
        ),
        "rationale": "Existing Congress source documents the minority-serving institution funding purpose.",
    },
    {
        "title": "Shelby County v. Holder",
        "policy_intent_category": "equity_restricting",
        "policy_intent_summary": (
            "Held the Voting Rights Act preclearance coverage formula unconstitutional, limiting federal preclearance "
            "requirements until Congress adopted a new formula."
        ),
        "rationale": "Existing legal and historical source links document the preclearance coverage-formula holding.",
    },
    {
        "title": "South Carolina v. Katzenbach",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Upheld major Voting Rights Act enforcement provisions, including federal preclearance authority.",
        "rationale": "Existing Supreme Court source link documents the Voting Rights Act enforcement holding.",
    },
    {
        "title": "Loving v. Virginia",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Held state bans on interracial marriage unconstitutional under due process and equal protection.",
        "rationale": "Existing Supreme Court source link documents the anti-miscegenation holding.",
    },
    {
        "title": "Swann v. Charlotte-Mecklenburg Board of Education",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Approved broad equitable remedies for dismantling dual school systems after unconstitutional segregation."
        ),
        "rationale": "Existing GovInfo, Supreme Court, and archive source links document the desegregation remedy holding.",
    },
    {
        "title": "First Reconstruction Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Set federal Reconstruction requirements for former Confederate states, including new constitutions and "
            "Black male suffrage conditions for readmission."
        ),
        "rationale": "Existing House historical source links document the Reconstruction readmission and suffrage requirements.",
    },
    {
        "title": "Executive Order 11246",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Required equal employment opportunity and affirmative-action obligations for federal contractors."
        ),
        "rationale": "Existing National Archives and Labor Department source links document the contractor EEO purpose.",
    },
    {
        "title": "Equal Employment Opportunity Act of 1972",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Strengthened federal employment-discrimination enforcement authority through the EEOC.",
        "rationale": "Existing EEOC historical source link documents the enforcement-expansion purpose.",
    },
    {
        "title": "Alexander v. Holmes County Board of Education",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Required school districts to end dual school systems immediately rather than after further delay.",
        "rationale": "Existing Supreme Court and school desegregation source links document the immediate-desegregation holding.",
    },
    {
        "title": "24th Amendment",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Prohibited poll taxes in federal elections.",
        "rationale": "Existing National Archives and Constitution Annotated source links document the poll-tax prohibition.",
    },
    {
        "title": "Griggs v. Duke Power Company",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Recognized disparate-impact employment discrimination under Title VII when practices are not job-related."
        ),
        "rationale": "Existing legal source links document the Title VII disparate-impact holding.",
    },
    {
        "title": "Patient Protection and Affordable Care Act",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": (
            "Expanded health-insurance coverage, consumer protections, and health-system reforms through Medicaid, "
            "marketplaces, and coverage rules."
        ),
        "rationale": "Existing Congress and HHS source links document the coverage and health-system reform purpose.",
    },
    {
        "title": "Affordable Care Act",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": (
            "Expanded health-insurance coverage, consumer protections, and health-system reforms through Medicaid, "
            "marketplaces, and coverage rules."
        ),
        "rationale": "Existing HHS source links document the coverage and health-system reform purpose.",
    },
    {
        "title": "Freedmen's Bureau",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Established federal assistance for formerly enslaved people and refugees, including relief, education, "
            "labor support, and legal protections."
        ),
        "rationale": "Existing National Archives source links document the bureau's post-emancipation assistance role.",
    },
    {
        "title": "Jones v. Alfred H. Mayer Co.",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Held that federal civil-rights law bars private racial discrimination in property sales."
        ),
        "rationale": "Existing Supreme Court source link documents the private housing-discrimination holding.",
    },
    {
        "title": "Texas Department of Housing and Community Affairs v. Inclusive Communities Project, Inc.",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Confirmed that disparate-impact claims are cognizable under the Fair Housing Act.",
        "rationale": "Existing Supreme Court source link documents the Fair Housing Act disparate-impact holding.",
    },
    {
        "title": "Reconstruction Acts",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Set federal Reconstruction conditions for former Confederate states, including new governments and "
            "Black male suffrage requirements."
        ),
        "rationale": "Existing Library of Congress and historical source links document the Reconstruction framework.",
    },
    {
        "title": "Community Reinvestment Act of 1977",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Encouraged insured depository institutions to help meet credit needs in the communities they serve, "
            "including low- and moderate-income neighborhoods."
        ),
        "rationale": "Existing GovInfo and Federal Reserve source links document the community credit purpose.",
    },
    {
        "title": "Executive Order 9981",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Established equality of treatment and opportunity in the United States armed services.",
        "rationale": "Existing National Archives and Truman Library source links document the military desegregation purpose.",
    },
    {
        "title": "Nixon v. Herndon",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Held that excluding Black voters from a primary election violated equal protection.",
        "rationale": "Existing Supreme Court source link documents the white-primary holding.",
    },
    {
        "title": "Higher Education Act",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Expanded federal higher-education assistance, student aid, and institutional support programs.",
        "rationale": "Existing Congress source link documents the higher-education assistance framework.",
    },
    {
        "title": "Civil Rights Restoration Act of 1987",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Restored broad institution-wide coverage for federal civil-rights requirements in federally assisted programs."
        ),
        "rationale": "Existing GovInfo source link documents the civil-rights coverage restoration purpose.",
    },
    {
        "title": "Fair Housing Amendments Act of 1988",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Expanded fair-housing protections and strengthened administrative enforcement under federal housing law."
        ),
        "rationale": "Existing GovInfo source link documents the fair-housing amendment and enforcement provisions.",
    },
    {
        "title": "Equal Credit Opportunity Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Prohibited discrimination in credit transactions and supported federal fair-lending enforcement.",
        "rationale": "Existing DOJ and consumer-finance source links document the fair-lending anti-discrimination purpose.",
    },
    {
        "title": "Home Mortgage Disclosure Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Required mortgage-lending data disclosure to support fair-lending oversight and community credit analysis."
        ),
        "rationale": "Existing CFPB and FFIEC source links document the mortgage-disclosure and fair-lending oversight purpose.",
    },
    {
        "title": "Missouri ex rel. Gaines v. Canada",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": (
            "Required a state providing legal education to provide substantially equal in-state legal education to Black students."
        ),
        "rationale": "Existing Supreme Court and archive source links document the equal legal-education holding.",
    },
    {
        "title": "Executive Order 11063",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Prohibited discrimination in federally assisted housing and related property transactions.",
        "rationale": "Existing National Archives source links document the equal-opportunity housing purpose.",
    },
    {
        "title": "Food Stamp Act of 1964",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Established a permanent food-stamp program to improve nutrition support for eligible households.",
        "rationale": "Existing Congress and USDA source links document the nutrition-assistance program purpose.",
    },
    {
        "title": "Anti-Drug Abuse Act of 1986",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Expanded federal drug-control, enforcement, and penalty policy as part of national anti-drug legislation.",
        "rationale": "Existing congressional source links document the federal drug-control legislative purpose.",
    },
    {
        "title": "Anti-Drug Abuse Act of 1988",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Expanded federal drug-control, enforcement, and penalty policy as part of national anti-drug legislation.",
        "rationale": "Existing Congress source link documents the federal drug-control legislative purpose.",
    },
    {
        "title": "Social Security Act of 1935",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Created federal social-insurance and public-assistance programs for old age, unemployment, and related welfare needs.",
        "rationale": "Existing Social Security Administration and GovInfo source links document the social-insurance framework.",
    },
    {
        "title": "Executive Order 8802",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Prohibited racial discrimination in the national defense industry and created fair-employment enforcement machinery.",
        "rationale": "Existing National Archives source links document the defense-industry nondiscrimination purpose.",
    },
    {
        "title": "Grovey v. Townsend",
        "policy_intent_category": "equity_restricting",
        "policy_intent_summary": "Upheld a party rule excluding Black voters from Democratic primary participation.",
        "rationale": "Existing Supreme Court source link documents the white-primary holding.",
    },
    {
        "title": "Civil Rights Act of 1960",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Strengthened federal voting-rights record preservation, inspection, and enforcement tools.",
        "rationale": "Existing Congress, DOJ, and archive source links document the voting-rights enforcement purpose.",
    },
    {
        "title": "Civil Rights Act of 1957",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Created federal civil-rights enforcement capacity and voting-rights enforcement tools.",
        "rationale": "Existing Eisenhower Library and DOJ source links document the civil-rights enforcement purpose.",
    },
    {
        "title": "United States Housing Act of 1937",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Created federal support for low-rent public housing and slum-clearance related housing programs.",
        "rationale": "Existing GovInfo source links document the public-housing and low-rent housing program purpose.",
    },
    {
        "title": "Hospital Survey and Construction Act",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Created federal support for hospital construction and modernization through the Hill-Burton program.",
        "rationale": "Existing HRSA and historical medical source links document the hospital construction program purpose.",
    },
    {
        "title": "HUD Affirmatively Furthering Fair Housing Final Rule",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Implemented planning and assessment requirements for affirmatively furthering fair housing.",
        "rationale": "Existing HUD source link documents the fair-housing planning rule purpose.",
    },
    {
        "title": "HUD Termination of the 2015 AFFH Rule",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Terminated the 2015 AFFH planning rule and replaced it with a less prescriptive fair-housing certification approach.",
        "rationale": "Existing HUD source link documents the administrative rule termination and replacement purpose.",
    },
    {
        "title": "National Labor Relations Act",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Established federal labor-relations rights and collective-bargaining protections for covered workers.",
        "rationale": "Existing NLRB source links document the labor-relations framework.",
    },
    {
        "title": "Fair Labor Standards Act",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Established federal minimum-wage, overtime, child-labor, and covered-workplace labor standards.",
        "rationale": "Existing Labor Department and congressional source links document the labor-standards purpose.",
    },
    {
        "title": "First Step Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Reformed federal sentencing and prison programming, including sentence-credit and recidivism-reduction provisions.",
        "rationale": "Existing Congress and DOJ source links document the sentencing and prison-program reform purpose.",
    },
    {
        "title": "Brnovich v. Democratic National Committee",
        "policy_intent_category": "equity_restricting",
        "policy_intent_summary": "Upheld challenged voting rules and set guideposts that narrowed vote-denial claims under Section 2 of the Voting Rights Act.",
        "rationale": "Existing Supreme Court source link documents the Voting Rights Act Section 2 holding.",
    },
    {
        "title": "National Housing Act of 1934 (FHA Creation)",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Created federal mortgage insurance and housing-finance support through the Federal Housing Administration.",
        "rationale": "Existing housing and federal source links document the FHA mortgage-insurance purpose.",
    },
    {
        "title": "Housing Act of 1949",
        "policy_intent_category": "neutral_administrative",
        "policy_intent_summary": "Expanded federal housing, urban redevelopment, slum-clearance, and public-housing policy.",
        "rationale": "Existing housing source links document the housing and redevelopment program purpose.",
    },
    {
        "title": "Voting Rights Act Reauthorization of 2006",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Reauthorized expiring Voting Rights Act provisions to continue federal voting-rights protections.",
        "rationale": "Existing source link documents the Voting Rights Act reauthorization purpose.",
    },
    {
        "title": "George White Anti-Lynching Bill (H.R. 6963)",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed federal anti-lynching protections and penalties for racial terror violence.",
        "rationale": "Existing House historical source links document the anti-lynching legislative purpose.",
    },
    {
        "title": "Dyer Anti-Lynching Bill",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed federal anti-lynching enforcement and penalties.",
        "rationale": "Existing House historical source link documents the anti-lynching legislative purpose.",
    },
    {
        "title": "Costigan-Wagner Anti-Lynching Bill",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed federal anti-lynching enforcement and penalties.",
        "rationale": "Existing Senate historical source link documents the anti-lynching legislative purpose.",
    },
    {
        "title": "Gavagan Anti-Lynching Bill (H.R. 1507)",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed federal anti-lynching enforcement and penalties.",
        "rationale": "Existing House historical source links document the anti-lynching legislative purpose.",
    },
    {
        "title": "Commission to Study Reparation Proposals for African Americans Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed a federal commission to study and recommend reparations proposals for African Americans.",
        "rationale": "Existing Congress source link documents the reparations-study commission purpose.",
    },
    {
        "title": "Commission to Study and Develop Reparation Proposals for African Americans Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed a federal commission to study and develop reparations proposals for African Americans.",
        "rationale": "Existing Congress source link documents the reparations-study and development purpose.",
    },
    {
        "title": "Black Farmer Fairness Act of 2001",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed remedies and oversight related to discrimination against Black farmers in federal agricultural programs.",
        "rationale": "Existing Congress and Congressional Record source links document the Black farmer fairness purpose.",
    },
    {
        "title": "Justice for Black Farmers Act of 2023",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed agricultural equity, land access, and discrimination-remedy measures for Black farmers.",
        "rationale": "Existing source links document the Black farmer equity and land-access purpose.",
    },
    {
        "title": "Emmett Till Antilynching Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed federal criminal-law treatment for lynching and related civil-rights violence.",
        "rationale": "Existing Congress source link documents the anti-lynching legislative purpose.",
    },
    {
        "title": "John Lewis Voting Rights Advancement Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed restoring and updating Voting Rights Act preclearance protections.",
        "rationale": "Existing Congress source link documents the voting-rights restoration purpose.",
    },
    {
        "title": "John R. Lewis Voting Rights Advancement Act of 2021",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed restoring and updating Voting Rights Act preclearance protections.",
        "rationale": "Existing Congress source links document the voting-rights restoration purpose.",
    },
    {
        "title": "Ending Qualified Immunity Act",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed limiting or ending qualified-immunity defenses in civil actions against government officials.",
        "rationale": "Existing Congress source link documents the qualified-immunity reform purpose.",
    },
    {
        "title": "CROWN Act of 2022",
        "policy_intent_category": "equity_expanding",
        "policy_intent_summary": "Proposed prohibiting discrimination based on hair texture and protective hairstyles associated with race.",
        "rationale": "Existing Congress source links document the race-linked hair-discrimination purpose.",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill high-confidence policy outcome dates and historical policy intent metadata."
    )
    parser.add_argument("--output", type=Path, help="Backfill trace report JSON path")
    parser.add_argument("--apply", action="store_true", help="Apply safe backfills. Dry-run is default.")
    parser.add_argument("--yes", action="store_true", help="Required with --apply.")
    parser.add_argument("--limit-samples", type=int, default=25, help="Maximum sample rows per report section")
    return parser.parse_args()


def default_output_path() -> Path:
    return get_reports_dir() / "policy-time-intent-backfill-report.json"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def get_table_columns(cursor, table_name: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {str(row["Field"]) for row in cursor.fetchall() or []}


def fetch_policy_sources(cursor, policy_id: int) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT id, source_title, source_url, source_type, publisher, published_date
        FROM sources
        WHERE policy_id = %s
        ORDER BY id ASC
        """,
        (policy_id,),
    )
    return [serialize_source(row) for row in list(cursor.fetchall() or [])]


def serialize_source(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "source_title": row.get("source_title"),
        "source_url": row.get("source_url"),
        "source_type": row.get("source_type"),
        "publisher": row.get("publisher"),
        "published_date": str(row["published_date"]) if row.get("published_date") else None,
    }


def fetch_policy_by_title(cursor, title: str) -> dict[str, Any] | None:
    cursor.execute(
        """
        SELECT
          p.id,
          p.title,
          p.policy_type,
          p.year_enacted,
          p.date_enacted,
          p.impact_direction,
          p.policy_intent_summary,
          p.policy_intent_category,
          (COALESCE(ps.directness_score, 0) * 2 +
           COALESCE(ps.material_impact_score, 0) * 2 +
           COALESCE(ps.evidence_score, 0) +
           COALESCE(ps.durability_score, 0) +
           COALESCE(ps.equity_score, 0) * 2 -
           COALESCE(ps.harm_offset_score, 0)) AS policy_impact_score,
          GROUP_CONCAT(DISTINCT pc.name ORDER BY pc.name SEPARATOR ', ') AS categories
        FROM policies p
        LEFT JOIN policy_scores ps ON ps.policy_id = p.id
        LEFT JOIN policy_policy_categories ppc ON ppc.policy_id = p.id
        LEFT JOIN policy_categories pc ON pc.id = ppc.category_id
        WHERE p.title = %s
          AND COALESCE(p.is_archived, 0) = 0
        GROUP BY
          p.id,
          p.title,
          p.policy_type,
          p.year_enacted,
          p.date_enacted,
          p.impact_direction,
          p.policy_intent_summary,
          p.policy_intent_category,
          policy_impact_score
        ORDER BY p.id ASC
        LIMIT 1
        """,
        (title,),
    )
    return cursor.fetchone()


def fetch_time_candidates(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
          po.id AS policy_outcome_id,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.impact_start_date,
          po.impact_end_date,
          po.impact_duration_estimate,
          pr.title AS promise_title,
          COUNT(DISTINCT pa.action_date) AS distinct_action_date_count,
          MIN(pa.action_date) AS candidate_action_date,
          COUNT(DISTINCT pa.id) AS action_count,
          GROUP_CONCAT(
            DISTINCT CONCAT(pa.id, ': ', pa.action_date, ' | ', pa.title)
            ORDER BY pa.action_date, pa.id
            SEPARATOR ' ;; '
          ) AS action_references
        FROM policy_outcomes po
        LEFT JOIN promises pr
          ON po.policy_type = 'current_admin'
         AND pr.id = po.policy_id
        LEFT JOIN promise_actions pa
          ON pa.promise_id = po.policy_id
         AND pa.action_date IS NOT NULL
        WHERE po.policy_type = 'current_admin'
        GROUP BY
          po.id,
          po.policy_id,
          po.record_key,
          po.outcome_summary,
          po.impact_start_date,
          po.impact_end_date,
          po.impact_duration_estimate,
          pr.title
        ORDER BY po.policy_id ASC, po.id ASC
        """
    )
    return list(cursor.fetchall() or [])


def fetch_coverage(cursor) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_policy_outcomes,
          SUM(CASE WHEN impact_start_date IS NOT NULL THEN 1 ELSE 0 END) AS outcomes_with_impact_start_date,
          SUM(CASE WHEN impact_end_date IS NOT NULL THEN 1 ELSE 0 END) AS outcomes_with_impact_end_date,
          SUM(CASE WHEN impact_duration_estimate IS NOT NULL THEN 1 ELSE 0 END) AS outcomes_with_duration_estimate,
          SUM(CASE WHEN impact_start_date IS NOT NULL AND impact_end_date IS NOT NULL AND impact_end_date < impact_start_date THEN 1 ELSE 0 END) AS invalid_date_ranges
        FROM policy_outcomes
        """
    )
    time = cursor.fetchone() or {}
    cursor.execute(
        """
        SELECT
          COUNT(*) AS total_active_policies,
          SUM(CASE WHEN policy_intent_summary IS NOT NULL THEN 1 ELSE 0 END) AS policies_with_intent_summary,
          SUM(CASE WHEN policy_intent_category IS NOT NULL THEN 1 ELSE 0 END) AS policies_with_intent_category,
          SUM(CASE WHEN policy_intent_summary IS NOT NULL AND policy_intent_category IS NOT NULL THEN 1 ELSE 0 END) AS policies_with_complete_intent
        FROM policies
        WHERE COALESCE(is_archived, 0) = 0
        """
    )
    intent = cursor.fetchone() or {}
    return {
        **{key: int(value or 0) for key, value in time.items()},
        **{key: int(value or 0) for key, value in intent.items()},
    }


def pct(part: int, total: int) -> float:
    if not total:
        return 0
    return round(part / total, 4)


def add_percentages(coverage: dict[str, Any]) -> dict[str, Any]:
    total_outcomes = coverage.get("total_policy_outcomes", 0)
    total_policies = coverage.get("total_active_policies", 0)
    return {
        **coverage,
        "impact_start_date_coverage_pct": pct(coverage.get("outcomes_with_impact_start_date", 0), total_outcomes),
        "impact_end_date_coverage_pct": pct(coverage.get("outcomes_with_impact_end_date", 0), total_outcomes),
        "impact_duration_estimate_coverage_pct": pct(
            coverage.get("outcomes_with_duration_estimate", 0), total_outcomes
        ),
        "policy_intent_summary_coverage_pct": pct(coverage.get("policies_with_intent_summary", 0), total_policies),
        "policy_intent_category_coverage_pct": pct(coverage.get("policies_with_intent_category", 0), total_policies),
        "complete_policy_intent_coverage_pct": pct(coverage.get("policies_with_complete_intent", 0), total_policies),
    }


def build_intent_candidates(cursor) -> list[dict[str, Any]]:
    candidates = []
    for seed in INTENT_SEEDS:
        row = fetch_policy_by_title(cursor, seed["title"])
        if not row:
            candidates.append({"title": seed["title"], "status": "no_policy_found", "candidate": seed})
            continue

        sources = fetch_policy_sources(cursor, int(row["id"]))
        existing_summary = normalize_nullable_text(row.get("policy_intent_summary"))
        existing_category = normalize_nullable_text(row.get("policy_intent_category"))
        conflicts = []
        if existing_category and existing_category != seed["policy_intent_category"]:
            conflicts.append("existing_intent_category_differs")
        if existing_summary and existing_summary != seed["policy_intent_summary"]:
            conflicts.append("existing_intent_summary_differs")

        status = "safe_auto_update"
        if not sources:
            status = "operator_review_required"
            conflicts.append("no_existing_policy_source_link")
        elif conflicts:
            status = "preserve_existing"
        elif existing_summary and existing_category:
            status = "already_populated"

        candidates.append(
            {
                "status": status,
                "policy_id": int(row["id"]),
                "title": row["title"],
                "year_enacted": int(row["year_enacted"]) if row.get("year_enacted") is not None else None,
                "date_enacted": str(row["date_enacted"]) if row.get("date_enacted") else None,
                "policy_type": row.get("policy_type"),
                "categories": row.get("categories"),
                "impact_direction": row.get("impact_direction"),
                "policy_impact_score": int(row["policy_impact_score"] or 0),
                "existing_policy_intent_summary": existing_summary,
                "existing_policy_intent_category": existing_category,
                "recommended_policy_intent_summary": seed["policy_intent_summary"],
                "recommended_policy_intent_category": seed["policy_intent_category"],
                "rationale": seed["rationale"],
                "traceability": {
                    "source_basis": "Existing policy-linked source rows; no new source is created.",
                    "sources": sources[:5],
                    "source_count": len(sources),
                },
                "notes": conflicts,
            }
        )
    return candidates


def classify_time_candidate(row: dict[str, Any]) -> dict[str, Any]:
    notes = []
    existing_start = row.get("impact_start_date")
    existing_duration = normalize_nullable_text(row.get("impact_duration_estimate"))
    distinct_action_dates = int(row.get("distinct_action_date_count") or 0)
    candidate_date = row.get("candidate_action_date")
    action_references = row.get("action_references") or ""
    time_seed = TIME_ANCHOR_SEEDS.get(str(row.get("record_key") or ""))

    status = "safe_auto_update"
    recommended_duration = TIME_DURATION_LABEL
    temporal_confidence = "medium"
    rationale = (
        "The linked promise has exactly one distinct structured action_date; this is recorded as an action-date "
        "temporal anchor, not a precise outcome event date."
    )
    if existing_start:
        status = "already_populated"
        notes.append("impact_start_date_already_present")
    elif distinct_action_dates == 0 or not candidate_date:
        status = "no_temporal_signal"
        notes.append("no_promise_action_date")
    elif distinct_action_dates > 1:
        if time_seed:
            seeded_date = str(time_seed["impact_start_date"])
            if seeded_date in action_references:
                status = "safe_auto_update"
                candidate_date = seeded_date
                recommended_duration = time_seed.get("impact_duration_estimate", TIME_DURATION_LABEL)
                temporal_confidence = time_seed.get("temporal_confidence", "medium")
                rationale = time_seed["rationale"]
                notes.append("curated_multi_action_anchor")
            else:
                status = "operator_review_required"
                notes.append("curated_anchor_date_not_found_in_action_references")
        else:
            status = "operator_review_required"
            notes.append("multiple_promise_action_dates")
    else:
        notes.append("single_action_date_anchor")

    if status in {"operator_review_required", "no_temporal_signal"}:
        rationale = "No safe single action-date temporal anchor is available."

    return {
        "status": status,
        "policy_outcome_id": int(row["policy_outcome_id"]),
        "policy_id": int(row["policy_id"]),
        "record_key": row.get("record_key"),
        "promise_title": row.get("promise_title"),
        "outcome_summary": row.get("outcome_summary"),
        "existing_impact_start_date": str(existing_start) if existing_start else None,
        "existing_impact_end_date": str(row["impact_end_date"]) if row.get("impact_end_date") else None,
        "existing_impact_duration_estimate": existing_duration,
        "recommended_impact_start_date": str(candidate_date) if candidate_date else None,
        "recommended_impact_end_date": None,
        "recommended_impact_duration_estimate": recommended_duration,
        "candidate_date_type": "action_date",
        "temporal_confidence": temporal_confidence,
        "rationale": rationale,
        "traceability": {
            "source_basis": "promise_actions.action_date",
            "action_count": int(row.get("action_count") or 0),
            "action_references": action_references,
        },
        "notes": notes,
    }


def apply_intent_candidates(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates = []
    for candidate in candidates:
        if candidate.get("status") != "safe_auto_update":
            continue
        cursor.execute(
            """
            UPDATE policies
            SET
              policy_intent_summary = COALESCE(policy_intent_summary, %s),
              policy_intent_category = COALESCE(policy_intent_category, %s)
            WHERE id = %s
              AND (policy_intent_summary IS NULL OR policy_intent_category IS NULL)
            """,
            (
                candidate["recommended_policy_intent_summary"],
                candidate["recommended_policy_intent_category"],
                candidate["policy_id"],
            ),
        )
        if cursor.rowcount:
            updates.append(
                {
                    "table": "policies",
                    "policy_id": candidate["policy_id"],
                    "title": candidate["title"],
                    "fields": ["policy_intent_summary", "policy_intent_category"],
                    "rowcount": cursor.rowcount,
                    "traceability": candidate["traceability"],
                    "rationale": candidate["rationale"],
                }
            )
    return updates


def apply_time_candidates(cursor, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates = []
    for candidate in candidates:
        if candidate.get("status") != "safe_auto_update":
            continue
        cursor.execute(
            """
            UPDATE policy_outcomes
            SET
              impact_start_date = %s,
              impact_duration_estimate = COALESCE(impact_duration_estimate, %s)
            WHERE id = %s
              AND impact_start_date IS NULL
            """,
            (
                candidate["recommended_impact_start_date"],
                candidate["recommended_impact_duration_estimate"],
                candidate["policy_outcome_id"],
            ),
        )
        if cursor.rowcount:
            updates.append(
                {
                    "table": "policy_outcomes",
                    "policy_outcome_id": candidate["policy_outcome_id"],
                    "policy_id": candidate["policy_id"],
                    "record_key": candidate["record_key"],
                    "fields": ["impact_start_date", "impact_duration_estimate"],
                    "rowcount": cursor.rowcount,
                    "traceability": candidate["traceability"],
                    "rationale": candidate["rationale"],
                }
            )
    return updates


def count_by_status(candidates: list[dict[str, Any]]) -> dict[str, int]:
    return dict(sorted(Counter(candidate.get("status", "unknown") for candidate in candidates).items()))


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    if args.apply and not args.yes:
        raise SystemExit("--apply requires --yes")

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            required = {
                "policies": {"policy_intent_summary", "policy_intent_category"},
                "policy_outcomes": {"impact_start_date", "impact_end_date", "impact_duration_estimate"},
            }
            missing_tables = [table for table in required if not table_exists(cursor, table)]
            missing_columns = {
                table: sorted(columns - get_table_columns(cursor, table))
                for table, columns in required.items()
                if table not in missing_tables
            }
            missing_columns = {table: columns for table, columns in missing_columns.items() if columns}
            if missing_tables or missing_columns:
                raise RuntimeError(f"Missing required storage. tables={missing_tables} columns={missing_columns}")

            before_coverage = add_percentages(fetch_coverage(cursor))
            intent_candidates = build_intent_candidates(cursor)
            time_candidates = [classify_time_candidate(row) for row in fetch_time_candidates(cursor)]

            applied_updates: list[dict[str, Any]] = []
            if args.apply:
                applied_updates.extend(apply_intent_candidates(cursor, intent_candidates))
                applied_updates.extend(apply_time_candidates(cursor, time_candidates))
                connection.commit()
            else:
                connection.rollback()

            after_coverage = add_percentages(fetch_coverage(cursor))

        safe_intent_count = sum(1 for candidate in intent_candidates if candidate.get("status") == "safe_auto_update")
        safe_time_count = sum(1 for candidate in time_candidates if candidate.get("status") == "safe_auto_update")
        summary = {
            "mode": "apply" if args.apply else "dry_run",
            "intent_seed_count": len(INTENT_SEEDS),
            "safe_intent_update_count": safe_intent_count,
            "safe_time_update_count": safe_time_count,
            "applied_update_count": len(applied_updates),
            "policy_intent_updates_applied": sum(1 for update in applied_updates if update["table"] == "policies"),
            "policy_outcome_time_updates_applied": sum(1 for update in applied_updates if update["table"] == "policy_outcomes"),
            "intent_status_counts": count_by_status(intent_candidates),
            "time_status_counts": count_by_status(time_candidates),
            "invalid_date_ranges_after": after_coverage["invalid_date_ranges"],
        }

        return {
            "workflow": "policy_time_intent_backfill",
            "generated_at": utc_timestamp(),
            "summary": summary,
            "coverage_before": before_coverage,
            "coverage_after": after_coverage,
            "rules": {
                "time_backfill": [
                    "Only current_admin policy_outcomes are considered because the unified table currently stores current_admin/legislative types.",
                    "A time value is auto-filled only when the linked promise has exactly one distinct structured promise_actions.action_date.",
                    "The value is recorded as action_date_only; it is not represented as a precise outcome event date.",
                    "impact_end_date remains NULL unless a real end date exists.",
                    "Existing impact_start_date values are preserved.",
                ],
                "intent_backfill": [
                    "Only exact-title curated seed policies are considered.",
                    "A seed is auto-filled only when the active policy row exists and has existing policy-linked source rows.",
                    "Existing policy_intent_* values are preserved and conflicts are not overwritten.",
                    "The database enum uses neutral_administrative; user-facing neutral_structural concepts should be mapped deliberately before use.",
                ],
            },
            "applied_updates": applied_updates,
            "candidate_groups": {
                "intent": {
                    "safe_auto_update": [c for c in intent_candidates if c.get("status") == "safe_auto_update"][: args.limit_samples],
                    "already_populated": [c for c in intent_candidates if c.get("status") == "already_populated"][: args.limit_samples],
                    "operator_review_required": [
                        c for c in intent_candidates if c.get("status") == "operator_review_required"
                    ][: args.limit_samples],
                    "preserve_existing": [c for c in intent_candidates if c.get("status") == "preserve_existing"][
                        : args.limit_samples
                    ],
                    "no_policy_found": [c for c in intent_candidates if c.get("status") == "no_policy_found"][: args.limit_samples],
                },
                "time": {
                    "safe_auto_update": [c for c in time_candidates if c.get("status") == "safe_auto_update"][
                        : args.limit_samples
                    ],
                    "already_populated": [c for c in time_candidates if c.get("status") == "already_populated"][
                        : args.limit_samples
                    ],
                    "operator_review_required": [
                        c for c in time_candidates if c.get("status") == "operator_review_required"
                    ][: args.limit_samples],
                    "no_temporal_signal": [c for c in time_candidates if c.get("status") == "no_temporal_signal"][
                        : args.limit_samples
                    ],
                },
            },
            "remaining_gaps": {
                "policy_outcomes_without_impact_start_date": after_coverage["total_policy_outcomes"]
                - after_coverage["outcomes_with_impact_start_date"],
                "active_policies_without_complete_intent": after_coverage["total_active_policies"]
                - after_coverage["policies_with_complete_intent"],
                "notes": [
                    "Multi-action promises need operator review before choosing an impact_start_date.",
                    "Historical policies outside the curated seed list need source-backed manual intent curation.",
                    "No precise dates were created from free text.",
                ],
            },
        }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    output = (args.output or default_output_path()).resolve()
    report = build_report(args)
    write_json_file(output, report)
    print_json({"ok": True, "output": str(output), **report["summary"]})


if __name__ == "__main__":
    main()
