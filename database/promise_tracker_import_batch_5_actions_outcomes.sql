-- Companion draft for approved mission-aligned Promise Tracker batch 5
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Inserts 1 to 3 promise_actions for each of the 5 already approved batch 5 promise slugs.
--   - Inserts 1 promise_outcome for each of the 5 already approved batch 5 promise slugs.
--   - Does NOT create source rows or source join-table rows.
--   - Assumes the corresponding promises from promise_tracker_import_batch_5.sql exist before execution.
--
-- Editorial note:
--   - The two Franklin D. Roosevelt outcomes are intentionally drafted with
--     impact_direction = 'Mixed' to reflect major federal gains alongside important exclusions.

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_import_batch_5;
CREATE TEMPORARY TABLE tmp_promise_action_import_batch_5 (
  promise_slug varchar(255) NOT NULL,
  action_type varchar(100) NOT NULL,
  action_date date DEFAULT NULL,
  title varchar(255) NOT NULL,
  description text DEFAULT NULL,
  related_policy_id int(11) DEFAULT NULL,
  related_explainer_id int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_action_import_batch_5 (
  promise_slug,
  action_type,
  action_date,
  title,
  description,
  related_policy_id,
  related_explainer_id
) VALUES
(
  'johnson-appoint-thurgood-marshall-supreme-court',
  'Agency Action',
  '1967-06-13',
  'Johnson nominates Thurgood Marshall to the Supreme Court',
  'Johnson selected Thurgood Marshall for the Supreme Court, making good on a major civil-rights-era judicial appointment with direct Black institutional significance.',
  NULL,
  NULL
),
(
  'johnson-appoint-thurgood-marshall-supreme-court',
  'Court-Related Action',
  '1967-08-30',
  'Senate confirms Thurgood Marshall',
  'The Senate confirmed Marshall, allowing him to become the first Black justice to serve on the Supreme Court.',
  NULL,
  NULL
),
(
  'biden-expand-child-tax-credit',
  'Statement',
  '2020-07-21',
  'Biden campaign backs larger fully refundable Child Tax Credit',
  'Biden proposed increasing the Child Tax Credit and making it fully refundable so low-income households could receive the full benefit.',
  NULL,
  NULL
),
(
  'biden-expand-child-tax-credit',
  'Bill',
  '2021-03-11',
  'American Rescue Plan creates temporary Child Tax Credit expansion',
  'Biden signed the American Rescue Plan, which expanded the Child Tax Credit, increased refundability, and broadened access for lower-income families.',
  12,
  4
),
(
  'biden-expand-child-tax-credit',
  'Bill',
  '2021-12-31',
  'Expanded Child Tax Credit expires without permanent extension',
  'The one-year expansion ended after Congress did not make the larger fully refundable credit permanent.',
  NULL,
  NULL
),
(
  'nixon-expand-affirmative-action-federal-contracting',
  'Policy',
  '1969-06-27',
  'Nixon administration backs stronger affirmative-action enforcement in federal contracting',
  'The administration endorsed a stronger use of affirmative-action tools in federally connected employment to address long-standing racial exclusion in key industries.',
  NULL,
  NULL
),
(
  'nixon-expand-affirmative-action-federal-contracting',
  'Agency Action',
  '1969-09-23',
  'Labor Department issues revised Philadelphia Plan requirements',
  'The Labor Department moved ahead with the revised Philadelphia Plan, using goals and timetables in federal contracting to push open construction employment to Black workers and other excluded groups.',
  NULL,
  NULL
),
(
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'Statement',
  '1937-05-24',
  'Roosevelt urges Congress to pass national wages and hours legislation',
  'Roosevelt publicly pressed for federal labor standards including a wage floor and limits on working hours as part of Depression-era economic reform.',
  NULL,
  NULL
),
(
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'Bill',
  '1938-06-25',
  'Roosevelt signs the Fair Labor Standards Act',
  'Roosevelt signed the Fair Labor Standards Act, creating a federal minimum wage and maximum-hours framework.',
  87,
  8
),
(
  'roosevelt-create-social-security-old-age-unemployment-system',
  'Statement',
  '1935-01-17',
  'Roosevelt asks Congress for economic security legislation',
  'Roosevelt sent Congress a message calling for federal old-age insurance and unemployment protections to reduce economic insecurity.',
  NULL,
  NULL
),
(
  'roosevelt-create-social-security-old-age-unemployment-system',
  'Bill',
  '1935-08-14',
  'Roosevelt signs the Social Security Act',
  'Roosevelt signed the Social Security Act, establishing old-age insurance and unemployment protections at the federal level.',
  117,
  4
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
FROM tmp_promise_action_import_batch_5 t
JOIN promises p ON p.slug = t.promise_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_actions pa
  WHERE pa.promise_id = p.id
    AND pa.title = t.title
    AND COALESCE(pa.action_date, '1000-01-01') = COALESCE(t.action_date, '1000-01-01')
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_import_batch_5;
CREATE TEMPORARY TABLE tmp_promise_outcome_import_batch_5 (
  promise_slug varchar(255) NOT NULL,
  outcome_summary text NOT NULL,
  outcome_type varchar(100) NOT NULL,
  measurable_impact text DEFAULT NULL,
  impact_direction varchar(50) DEFAULT NULL,
  black_community_impact_note text DEFAULT NULL,
  evidence_strength varchar(50) DEFAULT NULL,
  status_override varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_outcome_import_batch_5 (
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
  'johnson-appoint-thurgood-marshall-supreme-court',
  'Johnson delivered the appointment by nominating and securing confirmation of Thurgood Marshall to the Supreme Court.',
  'Legal Outcome',
  'The Court''s membership changed through Marshall''s confirmation, making him the first Black justice and adding a major civil-rights figure to the Court.',
  'Positive',
  'This mattered directly to Black communities because Marshall''s appointment had both representational significance and long-term implications for civil-rights jurisprudence and constitutional equality.',
  'Strong',
  'Delivered'
),
(
  'biden-expand-child-tax-credit',
  'Biden delivered a large temporary Child Tax Credit expansion, but he did not make the fuller refundable expansion permanent.',
  'Economic Outcome',
  'The American Rescue Plan increased the credit and expanded refundability for one year, but the larger design expired without permanent enactment.',
  'Positive',
  'This was highly relevant to Black communities because the temporary expansion reduced poverty risk, raised disposable income, and reached many Black families who are often underserved by less refundable tax benefits.',
  'Strong',
  'Partial'
),
(
  'nixon-expand-affirmative-action-federal-contracting',
  'Nixon administration policy expanded affirmative-action enforcement in federal contracting through the Philadelphia Plan framework.',
  'Economic Outcome',
  'Federal contracting rules moved toward goals and timetables that pressured major employers and unions to open access to jobs previously closed to many Black workers.',
  'Positive',
  'This mattered to Black communities because construction, trade access, and federal contracting pathways had long excluded Black workers from higher-wage employment and wealth-building opportunities.',
  'Strong',
  'Delivered'
),
(
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'Roosevelt delivered national wage and hour standards, but the original framework excluded many occupations in which Black workers were heavily concentrated.',
  'Economic Outcome',
  'The Fair Labor Standards Act created a federal minimum wage and maximum-hours baseline, while leaving major exclusions that limited immediate coverage for many domestic and agricultural workers.',
  'Mixed',
  'This was highly relevant to Black communities because a federal wage floor and hour protections strengthened labor standards overall, but exclusionary design reduced early benefits for many Black workers.',
  'Strong',
  'Delivered'
),
(
  'roosevelt-create-social-security-old-age-unemployment-system',
  'Roosevelt delivered a foundational federal social-insurance system, but the original law excluded many workers in sectors where Black Americans were disproportionately employed.',
  'Economic Outcome',
  'The Social Security Act created national old-age insurance and unemployment protections, while important occupational exclusions sharply limited early Black access to full coverage.',
  'Mixed',
  'This mattered to Black communities because federal social insurance improved long-term economic security, but exclusionary design left many Black workers and families outside the law''s earliest protections.',
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
FROM tmp_promise_outcome_import_batch_5 t
JOIN promises p ON p.slug = t.promise_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_outcomes po
  WHERE po.promise_id = p.id
    AND po.outcome_summary = t.outcome_summary
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_import_batch_5;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_import_batch_5;

COMMIT;
