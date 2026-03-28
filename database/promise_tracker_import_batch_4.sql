-- Targeted import for approved mission-aligned Promise Tracker batch 4
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Inserts 5 new promises only if their slugs do not already exist.
--   - Does NOT create promise_actions, promise_outcomes, source rows, or source join-table rows.

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_import_batch_4;
CREATE TEMPORARY TABLE tmp_promise_import_batch_4 (
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

INSERT INTO tmp_promise_import_batch_4 (
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
  'Ulysses S. Grant',
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'Suppress Ku Klux Klan violence and protect Black voting rights',
  'Grant called for federal action to protect Black citizens in the South from Ku Klux Klan violence and intimidation that blocked voting rights and equal protection.',
  '1871-03-23',
  'Official Promise',
  'Official',
  'Voting Rights / Reconstruction',
  'Black voters, Black officeholders, and Black communities targeted by racial terror and disenfranchisement',
  'Delivered',
  'Grant backed and used federal enforcement powers against Ku Klux Klan violence, helping produce a clear period of federal protection for Black voting rights even though later retrenchment reversed much of that progress.',
  'Approved mission-aligned Promise Tracker import. Focused on Reconstruction-era federal enforcement against racial terror and Black disenfranchisement. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Lyndon B. Johnson',
  'johnson-pass-voting-rights-act-after-selma',
  'Pass the Voting Rights Act after Selma',
  'Johnson publicly committed to passing strong federal voting-rights legislation after the Selma attacks and called on Congress to protect Black citizens from discriminatory barriers to registration and voting.',
  '1965-03-15',
  'Official Promise',
  'Official',
  'Voting Rights / Civil Rights',
  'Black voters and communities facing registration barriers, intimidation, and racially discriminatory election rules',
  'Delivered',
  'Johnson pushed for and signed the Voting Rights Act of 1965, creating a major federal civil-rights protection against Black disenfranchisement.',
  'Approved mission-aligned Promise Tracker import. Focused on federal voting-rights protection and Black political participation. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Lyndon B. Johnson',
  'johnson-pass-fair-housing-act',
  'Pass federal fair-housing protections',
  'Johnson urged Congress to pass fair-housing legislation barring racial discrimination in the sale and rental of housing and tied that goal to broader civil-rights enforcement.',
  '1968-04-05',
  'Official Promise',
  'Official',
  'Housing / Civil Rights',
  'Black renters, Black homebuyers, and Black neighborhoods affected by housing discrimination and segregation',
  'Delivered',
  'Johnson signed the Fair Housing Act in 1968, creating a major federal housing-discrimination protection with direct relevance to Black wealth-building and neighborhood access.',
  'Approved mission-aligned Promise Tracker import. Focused on fair-housing enforcement, anti-discrimination, and Black housing access. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Barack Obama',
  'obama-ban-racial-profiling-federal-law-enforcement',
  'Ban racial profiling in federal law enforcement',
  'Obama pledged to ban racial profiling by federal law enforcement and to strengthen civil-rights standards for policing and investigative practices.',
  '2008-08-01',
  'Campaign Promise',
  'Campaign',
  'Policing / DOJ Enforcement',
  'Black communities affected by racial profiling, discriminatory policing, and unequal federal law-enforcement practices',
  'Partial',
  'Obama administration guidance narrowed some federal profiling practices, but it did not produce a durable statutory ban or a complete end to profiling across law-enforcement settings.',
  'Approved mission-aligned Promise Tracker import. Focused on policing standards, DOJ guidance, and racially unequal enforcement exposure. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Joseph R. Biden Jr.',
  'biden-eliminate-federal-death-penalty',
  'Eliminate the federal death penalty',
  'Biden pledged to work to eliminate the federal death penalty and to incentivize states to follow the federal governments example.',
  '2020-06-01',
  'Campaign Promise',
  'Campaign',
  'Courts / Criminal Justice',
  'Black defendants, families affected by capital punishment, and communities facing racially unequal criminal-justice outcomes',
  'Partial',
  'Biden halted new federal executions and later issued broad commutations for most people on federal death row, but he did not secure abolition of the federal death penalty.',
  'Approved mission-aligned Promise Tracker import. Focused on racial disparity in capital punishment and federal criminal-justice reform. Sources are tracked separately in a manual manifest.',
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
FROM tmp_promise_import_batch_4 t
JOIN presidents pr ON pr.full_name = t.president_name
WHERE NOT EXISTS (
  SELECT 1
  FROM promises p
  WHERE p.slug = t.slug
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_import_batch_4;

COMMIT;
