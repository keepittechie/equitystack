-- Targeted import for approved mission-aligned Promise Tracker batch 6
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Inserts promise_actions and one promise_outcome per batch 6 promise.
--   - Assumes the batch 6 promises already exist in `promises`.
--   - Does NOT create sources or source join-table rows.
--
-- Safety:
--   - Joins promises by slug.
--   - Skips duplicate actions by (promise_id, title).
--   - Skips duplicate outcomes by promise_id.

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_import_batch_6;
CREATE TEMPORARY TABLE tmp_promise_action_import_batch_6 (
  promise_slug varchar(255) NOT NULL,
  action_type varchar(50) NOT NULL,
  action_date date DEFAULT NULL,
  title varchar(255) NOT NULL,
  description text DEFAULT NULL,
  related_policy_title varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_action_import_batch_6 (
  promise_slug,
  action_type,
  action_date,
  title,
  description,
  related_policy_title
) VALUES
(
  'truman-desegregate-armed-forces',
  'Statement',
  '1948-02-02',
  'Truman asks Congress for a stronger civil-rights program',
  'Truman called for federal action on civil rights and equal treatment, helping set the broader administrative and political stage for desegregation measures affecting Black Americans.',
  NULL
),
(
  'truman-desegregate-armed-forces',
  'Executive Order',
  '1948-07-26',
  'Truman issues Executive Order 9981',
  'Truman ordered equality of treatment and opportunity in the armed services, creating the formal federal desegregation commitment in military service.',
  'Executive Order 9981'
),
(
  'truman-desegregate-armed-forces',
  'Agency Action',
  '1948-07-26',
  'Administration creates the committee to implement military equality policy',
  'The administration established the President''s Committee on Equality of Treatment and Opportunity in the Armed Services to push implementation of the new anti-segregation directive across the military.',
  NULL
),
(
  'kennedy-executive-order-10925-equal-employment',
  'Executive Order',
  '1961-03-06',
  'Kennedy issues Executive Order 10925',
  'Kennedy created the President''s Committee on Equal Employment Opportunity and required government contractors to take affirmative action against discrimination.',
  'Executive Order 10925'
),
(
  'kennedy-executive-order-10925-equal-employment',
  'Agency Action',
  '1961-04-18',
  'President''s Committee on Equal Employment Opportunity begins federal enforcement work',
  'The new federal committee began coordinating contractor compliance and equal-employment oversight, creating an administrative bridge to later civil-rights enforcement structures.',
  NULL
),
(
  'kennedy-executive-order-11063-fair-housing',
  'Executive Order',
  '1962-11-20',
  'Kennedy issues Executive Order 11063',
  'Kennedy directed federal agencies to prevent discrimination in federally assisted housing, creating an early federal fair-housing enforcement framework before the 1968 act.',
  'Executive Order 11063'
),
(
  'kennedy-executive-order-11063-fair-housing',
  'Agency Action',
  '1962-11-20',
  'Federal agencies begin implementing equal-opportunity rules in federally assisted housing',
  'Housing-related federal agencies were directed to build nondiscrimination requirements into federally assisted housing administration and oversight.',
  NULL
),
(
  'carter-sign-community-reinvestment-act',
  'Statement',
  '1977-05-05',
  'Carter administration backs anti-redlining and community-credit reform',
  'The administration supported legislation aimed at pushing banks to serve neighborhoods facing disinvestment and exclusion from credit markets, including many Black communities.',
  NULL
),
(
  'carter-sign-community-reinvestment-act',
  'Bill',
  '1977-10-12',
  'Carter signs the Community Reinvestment Act',
  'Carter signed the Community Reinvestment Act, directing federal banking regulators to push insured institutions to help meet the credit needs of the communities they serve.',
  'Community Reinvestment Act of 1977'
),
(
  'carter-sign-community-reinvestment-act',
  'Agency Action',
  '1978-06-30',
  'Federal banking regulators begin implementing Community Reinvestment Act compliance',
  'Federal regulators began building CRA examination and compliance expectations into supervision, creating a continuing anti-redlining oversight framework.',
  NULL
),
(
  'bush-sign-voting-rights-act-reauthorization-2006',
  'Statement',
  '2006-07-20',
  'Bush administration supports Voting Rights Act renewal',
  'The administration publicly backed renewal of major Voting Rights Act protections as Congress moved the reauthorization bill toward final passage.',
  NULL
),
(
  'bush-sign-voting-rights-act-reauthorization-2006',
  'Bill',
  '2006-07-27',
  'Bush signs the Voting Rights Act Reauthorization of 2006',
  'Bush signed bipartisan legislation reauthorizing major Voting Rights Act provisions, preserving preclearance and related federal voting-rights enforcement tools.',
  'Voting Rights Act Reauthorization of 2006'
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
  pol.id,
  NULL
FROM tmp_promise_action_import_batch_6 t
JOIN promises p
  ON p.slug = t.promise_slug
LEFT JOIN policies pol
  ON pol.title = t.related_policy_title
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_actions pa
  WHERE pa.promise_id = p.id
    AND pa.title = t.title
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_import_batch_6;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_import_batch_6;
CREATE TEMPORARY TABLE tmp_promise_outcome_import_batch_6 (
  promise_slug varchar(255) NOT NULL,
  outcome_summary text NOT NULL,
  outcome_type varchar(50) NOT NULL,
  measurable_impact text DEFAULT NULL,
  impact_direction varchar(20) DEFAULT NULL,
  black_community_impact_note text DEFAULT NULL,
  evidence_strength varchar(20) DEFAULT NULL,
  status_override varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_outcome_import_batch_6 (
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
  'truman-desegregate-armed-forces',
  'Truman formally committed the federal government to ending segregation in the armed services and began a consequential process of military desegregation.',
  'Administrative Outcome',
  'Executive Order 9981 created the federal equality directive and implementation machinery that pushed the armed services away from formal racial segregation.',
  'Positive',
  'This mattered to Black communities because it marked one of the clearest postwar federal re-entries into formal desegregation and equal treatment in a major national institution.',
  'Strong',
  'Delivered'
),
(
  'kennedy-executive-order-10925-equal-employment',
  'Kennedy created an early modern equal-employment enforcement framework in federal contracting, requiring proactive action against discrimination.',
  'Administrative Outcome',
  'Executive Order 10925 established the President''s Committee on Equal Employment Opportunity and helped build the contractor-enforcement architecture later strengthened under Johnson and Nixon.',
  'Positive',
  'This mattered to Black communities because federal contracting rules could widen access to jobs and start confronting racial exclusion in employment markets tied to federal spending.',
  'Strong',
  'Delivered'
),
(
  'kennedy-executive-order-11063-fair-housing',
  'Kennedy created a federal nondiscrimination framework for federally assisted housing before the Fair Housing Act of 1968.',
  'Housing Outcome',
  'Executive Order 11063 directed federal housing administration away from explicit discrimination in federally assisted housing, though coverage and enforcement remained incomplete.',
  'Positive',
  'This mattered to Black communities because federally assisted housing had been part of the larger architecture of segregation and unequal access to stable housing opportunity.',
  'Strong',
  'Delivered'
),
(
  'carter-sign-community-reinvestment-act',
  'Carter signed a major anti-redlining law that created a durable federal framework for pushing banks to serve neglected communities more fairly.',
  'Housing Outcome',
  'The Community Reinvestment Act gave federal regulators an ongoing basis for reviewing whether insured institutions were helping meet local credit needs, including in disinvested Black neighborhoods.',
  'Positive',
  'This mattered to Black communities because redlining and unequal credit access were central barriers to homeownership, neighborhood investment, and wealth-building.',
  'Strong',
  'Delivered'
),
(
  'bush-sign-voting-rights-act-reauthorization-2006',
  'Bush preserved major Voting Rights Act protections by signing the 2006 reauthorization, extending federal voting-rights enforcement before later judicial rollback.',
  'Voting Outcome',
  'The reauthorization extended core protections including the preclearance framework, maintaining one of the federal government''s strongest anti-discrimination voting tools until Shelby County v. Holder later weakened it.',
  'Positive',
  'This mattered to Black communities because federal preclearance and related protections remained important safeguards against racially discriminatory election changes.',
  'Strong',
  'Delivered'
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
FROM tmp_promise_outcome_import_batch_6 t
JOIN promises p
  ON p.slug = t.promise_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_outcomes po
  WHERE po.promise_id = p.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_import_batch_6;

COMMIT;
