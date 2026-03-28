-- Targeted import for approved mission-aligned Promise Tracker batch 5
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Inserts 5 new promises only if their slugs do not already exist.
--   - Does NOT create promise_actions, promise_outcomes, source rows, or source join-table rows.
--
-- Editorial note:
--   - The two Franklin D. Roosevelt records are framed so later outcomes can use
--     impact_direction = 'Mixed' to reflect major economic gains alongside exclusionary limits.

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_import_batch_5;
CREATE TEMPORARY TABLE tmp_promise_import_batch_5 (
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

INSERT INTO tmp_promise_import_batch_5 (
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
  'Lyndon B. Johnson',
  'johnson-appoint-thurgood-marshall-supreme-court',
  'Appoint Thurgood Marshall to the Supreme Court',
  'Johnson committed to appointing judges who would enforce constitutional equality and in 1967 nominated Thurgood Marshall to the Supreme Court, making the appointment itself a clear public civil-rights commitment.',
  '1967-06-13',
  'Official Promise',
  'Official',
  'Courts / Civil Rights / Representation',
  'Black communities, civil-rights litigants, and constituencies affected by Supreme Court doctrine and judicial representation',
  'Delivered',
  'Johnson nominated and secured confirmation of Thurgood Marshall, creating a major Supreme Court appointment with direct Black civil-rights significance.',
  'Approved mission-aligned Promise Tracker import. Focused on courts, civil-rights jurisprudence, and historical Black representation in national institutions. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Joseph R. Biden Jr.',
  'biden-expand-child-tax-credit',
  'Expand the Child Tax Credit and make it fully refundable',
  'Biden proposed expanding the Child Tax Credit, increasing its value, and making it fully refundable so lower-income families could receive the full benefit.',
  '2020-07-21',
  'Campaign Promise',
  'Campaign',
  'Economic Policy / Anti-Poverty Tax Credits',
  'Black children, Black families, and households facing income volatility, poverty risk, and uneven access to tax-based support',
  'Partial',
  'Biden enacted a large temporary Child Tax Credit expansion through the American Rescue Plan, but the broader refundable expansion was not made permanent.',
  'Approved mission-aligned Promise Tracker import. Focused on Black child poverty, household income support, and anti-poverty tax policy. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Richard Nixon',
  'nixon-expand-affirmative-action-federal-contracting',
  'Expand affirmative-action requirements in federal contracting',
  'Nixon backed stronger affirmative-action requirements in federally connected employment, including the use of goals and timetables to address racial exclusion in major contracting sectors.',
  '1969-06-27',
  'Official Promise',
  'Official',
  'Economic Policy / Labor / Employment Access',
  'Black workers and Black jobseekers affected by exclusion from unionized trades, federally linked construction work, and higher-wage employment pathways',
  'Delivered',
  'Nixon administration policy helped establish the Philadelphia Plan framework, expanding affirmative-action enforcement in federal contracting and opening new access points in employment markets that had excluded Black workers.',
  'Approved mission-aligned Promise Tracker import. Focused on employment access, federal contracting, and Black worker opportunity under civil-rights enforcement. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Franklin D. Roosevelt',
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'Establish a federal minimum wage and maximum-hours standard',
  'Roosevelt pressed for national labor standards including a federal wage floor and maximum-hours rules to stabilize employment conditions during the Depression.',
  '1938-06-16',
  'Official Promise',
  'Official',
  'Workers / Wages / Economic Security',
  'Black workers, low-wage workers, and households affected by labor-market exploitation, wage instability, and weak workplace protections',
  'Delivered',
  'Roosevelt signed the Fair Labor Standards Act, creating a federal minimum wage and maximum-hours framework even though important exclusions limited the law''s reach for many Black workers at the time.',
  'Approved mission-aligned Promise Tracker import. Focused on worker protections, wage standards, and Black economic security with attention to exclusionary implementation limits. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Franklin D. Roosevelt',
  'roosevelt-create-social-security-old-age-unemployment-system',
  'Create old-age insurance and unemployment protections through Social Security',
  'Roosevelt called for a federal system of old-age insurance and unemployment protections to reduce economic insecurity and provide a national baseline of social insurance.',
  '1935-01-17',
  'Official Promise',
  'Official',
  'Economic Policy / Social Insurance',
  'Black workers, Black elders, and households facing economic insecurity, job loss, and uneven access to retirement and unemployment protection',
  'Delivered',
  'Roosevelt signed the Social Security Act, establishing a foundational federal social-insurance structure even though major exclusions initially left many Black workers outside full coverage.',
  'Approved mission-aligned Promise Tracker import. Focused on social insurance, household economic stability, and Black-community effects shaped by both coverage gains and exclusionary design. Sources are tracked separately in a manual manifest.',
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
FROM tmp_promise_import_batch_5 t
JOIN presidents pr ON pr.full_name = t.president_name
WHERE NOT EXISTS (
  SELECT 1
  FROM promises p
  WHERE p.slug = t.slug
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_import_batch_5;

COMMIT;
