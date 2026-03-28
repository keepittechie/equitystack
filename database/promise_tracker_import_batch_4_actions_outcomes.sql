-- Companion draft for approved mission-aligned Promise Tracker batch 4
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Inserts 1 to 3 promise_actions for each of the 5 already approved batch 4 promise slugs.
--   - Inserts 1 promise_outcome for each of the 5 already approved batch 4 promise slugs.
--   - Does NOT create source rows or source join-table rows.
--   - Assumes the corresponding promises from promise_tracker_import_batch_4.sql exist before execution.

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_import_batch_4;
CREATE TEMPORARY TABLE tmp_promise_action_import_batch_4 (
  promise_slug varchar(255) NOT NULL,
  action_type varchar(100) NOT NULL,
  action_date date DEFAULT NULL,
  title varchar(255) NOT NULL,
  description text DEFAULT NULL,
  related_policy_id int(11) DEFAULT NULL,
  related_explainer_id int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_action_import_batch_4 (
  promise_slug,
  action_type,
  action_date,
  title,
  description,
  related_policy_id,
  related_explainer_id
) VALUES
(
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'Statement',
  '1871-03-23',
  'Grant calls for stronger federal action against Ku Klux Klan violence',
  'Grant urged Congress to strengthen federal authority to protect Black citizens in the South from intimidation and violence that was undermining voting rights and equal protection.',
  NULL,
  NULL
),
(
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'Bill',
  '1871-04-20',
  'Congress enacts the Ku Klux Klan Act',
  'Federal law expanded enforcement authority against conspiracies that deprived people of civil and voting rights and gave the executive branch stronger tools to respond to racial terror.',
  NULL,
  NULL
),
(
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'Agency Action',
  '1871-10-17',
  'Grant uses federal enforcement powers in South Carolina',
  'Grant suspended habeas corpus in parts of South Carolina and deployed federal enforcement against Ku Klux Klan networks tied to organized violence and voter intimidation.',
  NULL,
  NULL
),
(
  'johnson-pass-voting-rights-act-after-selma',
  'Statement',
  '1965-03-15',
  'Johnson urges Congress to pass voting-rights legislation after Selma',
  'In a nationally televised address, Johnson called for immediate federal voting-rights legislation to protect Black citizens from discriminatory barriers to registration and voting.',
  NULL,
  NULL
),
(
  'johnson-pass-voting-rights-act-after-selma',
  'Bill',
  '1965-08-06',
  'Johnson signs the Voting Rights Act of 1965',
  'Johnson signed the Voting Rights Act, creating major federal protections against racially discriminatory voting rules and practices.',
  NULL,
  NULL
),
(
  'johnson-pass-fair-housing-act',
  'Statement',
  '1968-04-05',
  'Johnson renews his call for fair-housing legislation',
  'Johnson publicly urged Congress to move immediately on federal fair-housing protections, framing housing discrimination as an unresolved civil-rights issue.',
  NULL,
  NULL
),
(
  'johnson-pass-fair-housing-act',
  'Bill',
  '1968-04-11',
  'Johnson signs the Fair Housing Act',
  'Johnson signed the Civil Rights Act of 1968, including the Fair Housing Act, which prohibited key forms of racial discrimination in the sale and rental of housing.',
  NULL,
  NULL
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  'Statement',
  '2008-08-01',
  'Obama campaign backs a ban on racial profiling',
  'Obama publicly committed to banning racial profiling and strengthening civil-rights standards for federal law-enforcement practices.',
  NULL,
  NULL
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  'Agency Action',
  '2014-12-08',
  'Justice Department revises federal profiling guidance',
  'The Justice Department expanded its profiling guidance for federal law enforcement, broadening some protections while leaving important gaps in place.',
  NULL,
  NULL
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  'Agency Action',
  '2015-05-18',
  '21st Century Policing framework reinforces anti-bias standards',
  'A federal policing reform framework backed by the administration emphasized bias reduction, trust-building, and stronger policing standards after national protests over police conduct.',
  NULL,
  NULL
),
(
  'biden-eliminate-federal-death-penalty',
  'Statement',
  '2020-06-01',
  'Biden campaign pledges to eliminate the federal death penalty',
  'Biden said he would work to end the federal death penalty and encourage states to move away from capital punishment.',
  NULL,
  NULL
),
(
  'biden-eliminate-federal-death-penalty',
  'Agency Action',
  '2021-07-01',
  'Attorney General pauses federal executions',
  'The Justice Department imposed a moratorium on federal executions while reviewing death-penalty policies and protocols.',
  NULL,
  NULL
),
(
  'biden-eliminate-federal-death-penalty',
  'Agency Action',
  '2024-12-23',
  'Biden commutes most federal death-row sentences',
  'Biden commuted the sentences of most people on federal death row, sharply reducing the number of prisoners facing execution under federal authority.',
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
FROM tmp_promise_action_import_batch_4 t
JOIN promises p ON p.slug = t.promise_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_actions pa
  WHERE pa.promise_id = p.id
    AND pa.title = t.title
    AND COALESCE(pa.action_date, '1000-01-01') = COALESCE(t.action_date, '1000-01-01')
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_import_batch_4;
CREATE TEMPORARY TABLE tmp_promise_outcome_import_batch_4 (
  promise_slug varchar(255) NOT NULL,
  outcome_summary text NOT NULL,
  outcome_type varchar(100) NOT NULL,
  measurable_impact text DEFAULT NULL,
  impact_direction varchar(50) DEFAULT NULL,
  black_community_impact_note text DEFAULT NULL,
  evidence_strength varchar(50) DEFAULT NULL,
  status_override varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_outcome_import_batch_4 (
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
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'Grant used expanded federal enforcement powers against Ku Klux Klan violence, producing a concrete period of federal protection for Black voting rights during Reconstruction.',
  'Voting Outcome',
  'The federal government enacted stronger enforcement law and carried out prosecutions and executive enforcement actions against organized racial terror tied to Black disenfranchisement.',
  'Positive',
  'This was directly relevant to Black communities because racial terror and voter intimidation were central tools used to block Black political participation after emancipation.',
  'Strong',
  'Delivered'
),
(
  'johnson-pass-voting-rights-act-after-selma',
  'Johnson delivered the central promise by helping secure and sign the Voting Rights Act of 1965.',
  'Voting Outcome',
  'The law created major federal protections against racially discriminatory voting barriers, including stronger federal oversight of election rules in covered jurisdictions.',
  'Positive',
  'This was highly relevant to Black communities because the Voting Rights Act directly targeted the legal barriers and intimidation systems used to suppress Black voting power.',
  'Strong',
  'Delivered'
),
(
  'johnson-pass-fair-housing-act',
  'Johnson delivered federal fair-housing protections through enactment of the Fair Housing Act in 1968.',
  'Housing Outcome',
  'Federal law prohibited key forms of racial discrimination in the sale and rental of housing, creating a national fair-housing enforcement framework.',
  'Positive',
  'This was highly relevant to Black communities because housing discrimination has long shaped Black segregation, neighborhood exclusion, and wealth-building barriers.',
  'Strong',
  'Delivered'
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  'The Obama administration narrowed some federal profiling practices, but it did not deliver a complete or fully durable federal ban matching the campaign promise.',
  'Administrative Outcome',
  'Federal guidance was revised and anti-bias policing standards were elevated, but important enforcement gaps and non-statutory limits remained.',
  'Mixed',
  'This mattered to Black communities because racial profiling and discriminatory policing patterns remain central drivers of unequal law-enforcement exposure.',
  'Strong',
  'Partial'
),
(
  'biden-eliminate-federal-death-penalty',
  'Biden paused federal executions and later commuted most federal death-row sentences, but he did not abolish the federal death penalty.',
  'Legal Outcome',
  'The administration sharply reduced the immediate use of federal capital punishment without securing the statutory end of the death penalty system itself.',
  'Positive',
  'This was highly relevant to Black communities because racial disparities in charging, sentencing, and capital punishment remain a longstanding criminal-justice concern.',
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
FROM tmp_promise_outcome_import_batch_4 t
JOIN promises p ON p.slug = t.promise_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_outcomes po
  WHERE po.promise_id = p.id
    AND po.outcome_summary = t.outcome_summary
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_import_batch_4;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_import_batch_4;

COMMIT;
