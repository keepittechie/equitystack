-- Targeted import for approved mission-aligned Promise Tracker batch 3
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Inserts 6 new promises only if their slugs do not already exist.
--   - Inserts related promise_actions and promise_outcomes only if matching rows do not already exist.
--   - Does NOT create source rows or source join-table rows.

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_import_batch_3;
CREATE TEMPORARY TABLE tmp_promise_import_batch_3 (
  president_name varchar(255) NOT NULL,
  slug varchar(255) NOT NULL,
  title varchar(255) NOT NULL,
  promise_text text NOT NULL,
  promise_date date DEFAULT NULL,
  promise_type varchar(100) NOT NULL,
  campaign_or_official varchar(50) NOT NULL,
  topic varchar(150) DEFAULT NULL,
  impacted_group varchar(255) DEFAULT NULL,
  status varchar(50) NOT NULL,
  summary text DEFAULT NULL,
  notes text DEFAULT NULL,
  is_demo tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_import_batch_3 (
  president_name,
  slug,
  title,
  promise_text,
  promise_date,
  promise_type,
  campaign_or_official,
  topic,
  impacted_group,
  status,
  summary,
  notes,
  is_demo
) VALUES
(
  'Barack Obama',
  'obama-sign-employee-free-choice-act',
  'Make it easier for workers to unionize',
  'Obama supports the Employee Free Choice Act to make it easier for workers to organize unions and bargain collectively.',
  '2008-08-01',
  'Campaign Promise',
  'Campaign',
  'Labor / Workers',
  'Black workers, unionizing workers, and households affected by wage inequality and weak bargaining power',
  'Blocked',
  'Obama backed labor-law reform that would have made union organizing easier, but the Employee Free Choice Act did not become law.',
  'Approved mission-aligned Promise Tracker import. Focused on Black-worker bargaining power, wage equity, and labor-rights outcomes. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Donald J. Trump',
  'trump-make-no-cuts-medicaid',
  'Make no cuts to Medicaid',
  'Save Medicare, Medicaid and Social Security without cuts. Have to do it.',
  '2015-05-21',
  'Campaign Promise',
  'Campaign',
  'Health Care / Medicaid',
  'Black Medicaid recipients, low-income households, disabled people, and families dependent on public health coverage',
  'Failed',
  'Trump repeatedly said Medicaid would be protected, but repeal efforts and later budget proposals put major pressure on the program instead.',
  'Approved mission-aligned Promise Tracker import. Focused on Black health-care access and Medicaid coverage stability. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Joseph R. Biden Jr.',
  'biden-offer-public-option-health-plan',
  'Offer a public option health insurance plan',
  'Biden will give Americans a new choice, a public health insurance option like Medicare.',
  '2020-07-21',
  'Campaign Promise',
  'Campaign',
  'Health Care',
  'Black uninsured and underinsured households, workers without stable employer coverage, and communities facing persistent care-access gaps',
  'Failed',
  'Biden proposed a public option, but no such national plan was enacted during his presidency.',
  'Approved mission-aligned Promise Tracker import. Focused on Black health-insurance access, affordability, and coverage disparities. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Joseph R. Biden Jr.',
  'biden-end-private-prisons-detention-centers',
  'End the federal use of private prisons and detention centers',
  'The Biden Administration will end the federal government''s use of private prisons.',
  '2020-06-01',
  'Campaign Promise',
  'Campaign',
  'Criminal Justice / DOJ Enforcement',
  'Black communities affected by incarceration policy, detention conditions, and private prison incentives',
  'Partial',
  'Biden moved to phase out private prisons in the federal criminal system, but the broader detention footprint, especially in immigration detention, remained in place.',
  'Approved mission-aligned Promise Tracker import. Focused on incarceration conditions, DOJ authority, and racially unequal exposure to detention systems. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Joseph R. Biden Jr.',
  'biden-eliminate-cash-bail',
  'Eliminate cash bail',
  'Biden will end cash bail so that no one is incarcerated because they cannot afford to post bail.',
  '2020-07-28',
  'Campaign Promise',
  'Campaign',
  'Criminal Justice / Pretrial Detention',
  'Black defendants, low-income households, and communities facing unequal pretrial incarceration',
  'Failed',
  'Biden endorsed ending cash bail, but no national federal policy matching that promise was enacted during his presidency.',
  'Approved mission-aligned Promise Tracker import. Focused on pretrial detention, racial disparity, and coercive cash-bail effects. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Joseph R. Biden Jr.',
  'biden-justice40-disadvantaged-communities',
  'Direct 40 percent of key clean-energy benefits to disadvantaged communities',
  'Direct 40 percent of the overall benefits from federal investments in clean energy and infrastructure to disadvantaged communities.',
  '2020-07-14',
  'Campaign Promise',
  'Campaign',
  'Environmental Justice',
  'Black communities facing pollution burdens, infrastructure underinvestment, climate risk, and environmental health disparities',
  'Partial',
  'Biden created the Justice40 framework and tied it to major federal investment programs, but implementation was uneven and the full benefit standard remained difficult to verify in practice.',
  'Approved mission-aligned Promise Tracker import. Focused on environmental justice, neighborhood investment, and climate-related Black-community outcomes. Sources are tracked separately in a manual manifest.',
  0
);

INSERT INTO promises (
  president_id,
  slug,
  title,
  promise_text,
  promise_date,
  promise_type,
  campaign_or_official,
  topic,
  impacted_group,
  status,
  summary,
  notes,
  is_demo
)
SELECT
  pr.id,
  t.slug,
  t.title,
  t.promise_text,
  t.promise_date,
  t.promise_type,
  t.campaign_or_official,
  t.topic,
  t.impacted_group,
  t.status,
  t.summary,
  t.notes,
  t.is_demo
FROM tmp_promise_import_batch_3 t
JOIN presidents pr ON pr.full_name = t.president_name
WHERE NOT EXISTS (
  SELECT 1
  FROM promises p
  WHERE p.slug = t.slug
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_import_batch_3;
CREATE TEMPORARY TABLE tmp_promise_action_import_batch_3 (
  promise_slug varchar(255) NOT NULL,
  action_type varchar(100) NOT NULL,
  action_date date DEFAULT NULL,
  title varchar(255) NOT NULL,
  description text DEFAULT NULL,
  related_policy_id int(11) DEFAULT NULL,
  related_explainer_id int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_action_import_batch_3 (
  promise_slug,
  action_type,
  action_date,
  title,
  description,
  related_policy_id,
  related_explainer_id
) VALUES
(
  'obama-sign-employee-free-choice-act',
  'Bill',
  '2009-03-10',
  'Employee Free Choice Act is reintroduced in Congress',
  'Congressional Democrats reintroduced the Employee Free Choice Act as the main legislative vehicle for labor-law reform backed by Obama and organized labor.',
  NULL,
  NULL
),
(
  'obama-sign-employee-free-choice-act',
  'Statement',
  '2009-03-11',
  'Obama publicly backs labor-law reform',
  'Obama signaled support for changing labor law to make worker organizing easier, but the administration did not secure Senate passage.',
  NULL,
  NULL
),
(
  'obama-sign-employee-free-choice-act',
  'Bill',
  '2010-12-22',
  'Employee Free Choice Act fails to reach enactment',
  'The bill never cleared the Senate and the central union-organizing reform promise was left unrealized.',
  NULL,
  NULL
),
(
  'trump-make-no-cuts-medicaid',
  'Bill',
  '2017-05-04',
  'House passes ACA repeal bill with major Medicaid changes',
  'The House approved repeal legislation that would have changed ACA coverage rules and significantly cut projected federal Medicaid spending.',
  NULL,
  NULL
),
(
  'trump-make-no-cuts-medicaid',
  'Statement',
  '2017-07-19',
  'Trump urges Senate Republicans to keep pursuing repeal',
  'Trump continued pressing for repeal legislation even as analyses showed large Medicaid coverage and funding consequences.',
  NULL,
  NULL
),
(
  'trump-make-no-cuts-medicaid',
  'Agency Action',
  '2018-02-12',
  'Administration budget again proposes deep Medicaid reductions',
  'Trump budget proposals continued to back major long-term Medicaid cuts despite prior campaign assurances.',
  NULL,
  NULL
),
(
  'biden-offer-public-option-health-plan',
  'Bill',
  '2021-03-23',
  'House Democrats reintroduce a federal public option bill',
  'Congressional Democrats reintroduced public-option legislation, but the administration did not move a national public option across the line.',
  NULL,
  NULL
),
(
  'biden-offer-public-option-health-plan',
  'Statement',
  '2021-08-10',
  'Biden administration continues defending ACA expansion without enacting public option',
  'The administration pursued ACA strengthening and subsidy expansion but did not deliver the promised new public plan.',
  NULL,
  NULL
),
(
  'biden-end-private-prisons-detention-centers',
  'Executive Order',
  '2021-01-26',
  'Biden orders the Justice Department to phase out private criminal prisons',
  'Biden directed the Attorney General not to renew Justice Department contracts with privately operated criminal detention facilities.',
  NULL,
  NULL
),
(
  'biden-end-private-prisons-detention-centers',
  'Agency Action',
  '2021-12-31',
  'Justice Department reduces federal private-prison footprint',
  'The federal criminal-justice side moved away from several private-prison contracts, reflecting partial progress on the promise.',
  NULL,
  NULL
),
(
  'biden-end-private-prisons-detention-centers',
  'Agency Action',
  '2024-12-06',
  'Private immigration detention remains in use',
  'The administration did not extend the phaseout promise across the broader federal detention system, especially immigration detention.',
  NULL,
  NULL
),
(
  'biden-eliminate-cash-bail',
  'Statement',
  '2020-07-28',
  'Biden campaign endorses ending cash bail',
  'The campaign called for ending cash bail and shifting away from pretrial detention based on ability to pay.',
  NULL,
  NULL
),
(
  'biden-eliminate-cash-bail',
  'Statement',
  '2021-01-20',
  'No early federal action creates a national cash-bail replacement framework',
  'The administration did not launch a federal executive or legislative path matching the campaign promise at the start of the term.',
  NULL,
  NULL
),
(
  'biden-eliminate-cash-bail',
  'Bill',
  '2024-12-31',
  'No federal law ending cash bail is enacted during Biden presidency',
  'By the end of the term, no national federal policy had been enacted to eliminate cash bail in the way promised.',
  NULL,
  NULL
),
(
  'biden-justice40-disadvantaged-communities',
  'Executive Order',
  '2021-01-27',
  'Biden launches Justice40 through climate and equity orders',
  'Biden directed agencies to develop an initiative targeting 40 percent of certain federal investment benefits toward disadvantaged communities.',
  NULL,
  NULL
),
(
  'biden-justice40-disadvantaged-communities',
  'Bill',
  '2021-11-15',
  'Infrastructure law creates major programs linked to Justice40 implementation',
  'The bipartisan infrastructure law created large funding streams that the administration tied to Justice40 benefit-tracking.',
  NULL,
  NULL
),
(
  'biden-justice40-disadvantaged-communities',
  'Bill',
  '2022-08-16',
  'Inflation Reduction Act expands Justice40-linked investment opportunities',
  'The Inflation Reduction Act added major clean-energy and environmental-investment programs that the administration folded into the Justice40 framework.',
  NULL,
  NULL
);

INSERT INTO promise_actions (
  promise_id,
  action_type,
  action_date,
  title,
  description,
  related_policy_id,
  related_explainer_id
)
SELECT
  p.id,
  t.action_type,
  t.action_date,
  t.title,
  t.description,
  t.related_policy_id,
  t.related_explainer_id
FROM tmp_promise_action_import_batch_3 t
JOIN promises p ON p.slug = t.promise_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_actions pa
  WHERE pa.promise_id = p.id
    AND pa.title = t.title
    AND COALESCE(pa.action_date, '1000-01-01') = COALESCE(t.action_date, '1000-01-01')
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_import_batch_3;
CREATE TEMPORARY TABLE tmp_promise_outcome_import_batch_3 (
  promise_slug varchar(255) NOT NULL,
  outcome_summary text NOT NULL,
  outcome_type varchar(100) NOT NULL,
  measurable_impact text DEFAULT NULL,
  impact_direction varchar(50) DEFAULT NULL,
  black_community_impact_note text DEFAULT NULL,
  evidence_strength varchar(50) DEFAULT NULL,
  status_override varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_outcome_import_batch_3 (
  promise_slug,
  outcome_summary,
  outcome_type,
  measurable_impact,
  impact_direction,
  black_community_impact_note,
  evidence_strength,
  status_override
) VALUES
(
  'obama-sign-employee-free-choice-act',
  'The labor-law reform promised through the Employee Free Choice Act did not become federal law.',
  'Legislative Outcome',
  'The bill failed to clear the Senate, leaving the existing union-election and employer-resistance framework in place.',
  'Blocked',
  'This mattered to Black communities because easier union formation could have strengthened wage growth, workplace protections, and bargaining power for Black workers concentrated in lower-paid and more vulnerable sectors.',
  'Strong',
  'Blocked'
),
(
  'trump-make-no-cuts-medicaid',
  'Trump did not keep the promise to avoid Medicaid cuts, as repeal efforts and budget proposals repeatedly put the program at risk.',
  'Legislative Outcome',
  'The most visible repeal drive failed, but the administration backed policy paths that would have sharply reduced Medicaid coverage or funding over time.',
  'Negative',
  'This was highly relevant to Black communities because Medicaid is a major source of health coverage and care access for Black children, adults, disabled people, and families with low incomes.',
  'Strong',
  'Failed'
),
(
  'biden-offer-public-option-health-plan',
  'No national public-option health plan was enacted during Biden''s presidency.',
  'Legislative Outcome',
  'The administration expanded ACA subsidies and defended existing coverage gains, but it did not deliver the promised new public insurance option.',
  'Blocked',
  'This mattered to Black communities because a public option was framed as a path toward more affordable coverage and lower barriers to care in the face of persistent racial coverage gaps.',
  'Strong',
  'Failed'
),
(
  'biden-end-private-prisons-detention-centers',
  'Biden partially reduced the federal use of private prisons, but the broader federal detention system did not fully exit private detention contracts.',
  'Administrative Outcome',
  'The Justice Department narrowed private-prison use in the federal criminal system, while private immigration detention remained a major unresolved exception.',
  'Mixed',
  'This was highly relevant to Black communities because detention conditions, private incarceration incentives, and racial disparities in incarceration all shape Black-community exposure to state confinement systems.',
  'Strong',
  'Partial'
),
(
  'biden-eliminate-cash-bail',
  'No national federal policy eliminating cash bail was enacted during Biden''s presidency.',
  'Legal Outcome',
  'The administration expressed support for ending cash bail, but it did not deliver a federal executive or legislative result matching the promise.',
  'Blocked',
  'This mattered to Black communities because cash bail contributes to racially unequal pretrial detention, coerced pleas, employment loss, and family instability.',
  'Strong',
  'Failed'
),
(
  'biden-justice40-disadvantaged-communities',
  'Biden created the Justice40 framework and linked it to major federal investment programs, but implementation quality and measurable benefit delivery remained uneven.',
  'Administrative Outcome',
  'Justice40 changed how agencies described and tracked disadvantaged-community benefits, yet the full 40 percent benefit standard remained difficult to verify consistently across programs.',
  'Mixed',
  'This mattered to Black communities because environmental justice, infrastructure neglect, pollution exposure, and climate risk have long been distributed unequally across Black neighborhoods.',
  'Strong',
  'Partial'
);

INSERT INTO promise_outcomes (
  promise_id,
  outcome_summary,
  outcome_type,
  measurable_impact,
  impact_direction,
  black_community_impact_note,
  evidence_strength,
  status_override
)
SELECT
  p.id,
  t.outcome_summary,
  t.outcome_type,
  t.measurable_impact,
  t.impact_direction,
  t.black_community_impact_note,
  t.evidence_strength,
  t.status_override
FROM tmp_promise_outcome_import_batch_3 t
JOIN promises p ON p.slug = t.promise_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_outcomes po
  WHERE po.promise_id = p.id
    AND po.outcome_summary = t.outcome_summary
);

COMMIT;
