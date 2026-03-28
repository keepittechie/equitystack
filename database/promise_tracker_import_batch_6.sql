-- Targeted import for approved mission-aligned Promise Tracker batch 6
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Inserts 5 new promises only if their slugs do not already exist.
--   - Does NOT create promise_actions, promise_outcomes, source rows, or source join-table rows.
--
-- Editorial note:
--   - This batch is designed specifically to strengthen Civil Rights Timeline continuity:
--     federal re-entry, pre-1968 housing continuity, post-1969 housing continuity,
--     and voting-rights durability before later rollback.

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_promise_import_batch_6;
CREATE TEMPORARY TABLE tmp_promise_import_batch_6 (
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

INSERT INTO tmp_promise_import_batch_6 (
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
  'Harry S. Truman',
  'truman-desegregate-armed-forces',
  'Desegregate the armed forces',
  'Truman committed the federal government to equality of treatment and opportunity in the armed services and moved to end formal racial segregation in military service.',
  '1948-07-26',
  'Official Promise',
  'Official',
  'Civil Rights / Military / Federal Enforcement',
  'Black service members, Black military families, and Black communities affected by segregated military service and unequal federal treatment',
  'Delivered',
  'Truman signed Executive Order 9981, formally committing the federal government to equality of treatment and opportunity in the armed services and beginning the process of military desegregation.',
  'Approved mission-aligned Promise Tracker import. Focused on postwar federal civil-rights re-entry, military desegregation, and Black equal-treatment claims in national institutions. Sources are tracked separately in a manual manifest.',
  0
),
(
  'John F. Kennedy',
  'kennedy-executive-order-10925-equal-employment',
  'Issue Executive Order 10925 on equal employment opportunity',
  'Kennedy established a stronger federal equal-employment framework in government contracting and required proactive action against discrimination in federally connected work.',
  '1961-03-06',
  'Official Promise',
  'Official',
  'Civil Rights / Employment Access / Executive Enforcement',
  'Black workers and Black jobseekers excluded from defense work, federal contracting, and higher-wage employment markets shaped by discrimination',
  'Delivered',
  'Kennedy issued Executive Order 10925, creating an early modern federal equal-employment enforcement framework and helping establish the administrative bridge to later civil-rights enforcement.',
  'Approved mission-aligned Promise Tracker import. Focused on federal employment enforcement, contractor accountability, and Black worker access before the larger Johnson- and Nixon-era expansion. Sources are tracked separately in a manual manifest.',
  0
),
(
  'John F. Kennedy',
  'kennedy-executive-order-11063-fair-housing',
  'Issue Executive Order 11063 on nondiscrimination in federally assisted housing',
  'Kennedy directed federal agencies to prevent racial discrimination in federally assisted housing and tied housing administration more clearly to civil-rights enforcement.',
  '1962-11-20',
  'Official Promise',
  'Official',
  'Housing / Civil Rights / Executive Enforcement',
  'Black renters, Black homebuyers, and Black neighborhoods affected by federally backed housing discrimination and exclusion',
  'Delivered',
  'Kennedy issued Executive Order 11063, creating a federal administrative housing-rights precursor before the Fair Housing Act and acknowledging that federally assisted housing could not be administered on segregated terms.',
  'Approved mission-aligned Promise Tracker import. Focused on pre-1968 housing continuity, federal administrative enforcement, and Black access to fair housing opportunity. Sources are tracked separately in a manual manifest.',
  0
),
(
  'Jimmy Carter',
  'carter-sign-community-reinvestment-act',
  'Sign the Community Reinvestment Act',
  'Carter backed legislation requiring federal banking regulators to push depository institutions to serve the credit needs of the communities around them, including neighborhoods harmed by redlining and disinvestment.',
  '1977-10-12',
  'Official Promise',
  'Official',
  'Housing / Banking / Civil Rights',
  'Black homeowners, Black borrowers, and Black neighborhoods affected by redlining, disinvestment, and unequal access to credit',
  'Delivered',
  'Carter signed the Community Reinvestment Act, creating a major federal anti-redlining and community-credit framework even though enforcement strength and practical outcomes varied over time.',
  'Approved mission-aligned Promise Tracker import. Focused on post-1968 housing continuity, anti-redlining enforcement, and Black neighborhood access to credit and investment. Sources are tracked separately in a manual manifest.',
  0
),
(
  'George W. Bush',
  'bush-sign-voting-rights-act-reauthorization-2006',
  'Sign the Voting Rights Act Reauthorization of 2006',
  'Bush backed and signed the reauthorization of core Voting Rights Act protections, preserving federal voting-rights enforcement tools in the face of ongoing racial discrimination concerns.',
  '2006-07-27',
  'Official Promise',
  'Official',
  'Voting Rights / Civil Rights / Federal Enforcement',
  'Black voters and communities dependent on durable federal protection against discriminatory voting rules and practices',
  'Delivered',
  'Bush signed a bipartisan reauthorization extending major Voting Rights Act protections, preserving preclearance and related enforcement tools before later judicial rollback weakened that framework.',
  'Approved mission-aligned Promise Tracker import. Focused on voting-rights continuity, federal enforcement durability, and the historical bridge between 1965 protections and later rollback. Sources are tracked separately in a manual manifest.',
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
FROM tmp_promise_import_batch_6 t
JOIN presidents pr ON pr.full_name = t.president_name
WHERE NOT EXISTS (
  SELECT 1
  FROM promises p
  WHERE p.slug = t.slug
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_import_batch_6;

COMMIT;
