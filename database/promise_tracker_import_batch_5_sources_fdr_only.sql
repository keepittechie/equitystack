-- Reduced source import draft for approved mission-aligned Promise Tracker batch 5
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Covers only the two Franklin D. Roosevelt batch 5 records:
--       * roosevelt-establish-federal-minimum-wage-maximum-hours
--       * roosevelt-create-social-security-old-age-unemployment-system
--   - Reuses existing source rows where available.
--   - Inserts only missing source rows with natural existing policy_id matches.
--   - Creates promise_sources, promise_action_sources, and promise_outcome_sources joins.
--   - Does NOT change schema.
--
-- Natural policy matches used:
--   - 87  = Fair Labor Standards Act
--   - 117 = Social Security Act of 1935

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_source_import_batch_5_fdr;
CREATE TEMPORARY TABLE tmp_source_import_batch_5_fdr (
  policy_id int(11) NOT NULL,
  source_title varchar(255) NOT NULL,
  source_url text NOT NULL,
  source_type varchar(50) NOT NULL,
  publisher varchar(255) DEFAULT NULL,
  published_date date DEFAULT NULL,
  notes text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_source_import_batch_5_fdr (
  policy_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes
) VALUES
(
  87,
  'Message to Congress on Establishing Minimum Wages and Maximum Hours',
  'https://www.presidency.ucsb.edu/documents/message-congress-establishing-minimum-wages-and-maximum-hours',
  'Archive',
  'The American Presidency Project',
  '1937-05-24',
  'Promise Tracker batch 5 reduced FDR source import. Direct Roosevelt promise-level source for the FLSA-related record.'
),
(
  87,
  'History of Federal Minimum Wage Rates Under the Fair Labor Standards Act, 1938 - 2009',
  'https://www.dol.gov/whd/minwage/chart.htm',
  'Government',
  'U.S. Department of Labor',
  NULL,
  'Promise Tracker batch 5 reduced FDR source import. Outcome-level source for the lasting federal wage-floor effect of the Fair Labor Standards Act.'
),
(
  87,
  'From Excluded to Essential: Tracing the Racist Exclusion of Farmworkers, Domestic Workers, and Tipped Workers from the Fair Labor Standards Act',
  'https://www.congress.gov/event/117th-congress/house-event/112535/text',
  'Government',
  'U.S. House of Representatives',
  '2021-02-26',
  'Promise Tracker batch 5 reduced FDR source import. Outcome-level source supporting the Mixed interpretation by documenting FLSA exclusions affecting agricultural and domestic workers.'
),
(
  117,
  'Message to Congress on Social Security',
  'https://www.presidency.ucsb.edu/documents/message-congress-social-security',
  'Archive',
  'The American Presidency Project',
  '1935-01-17',
  'Promise Tracker batch 5 reduced FDR source import. Direct Roosevelt promise-level source for the Social Security record.'
),
(
  117,
  'Social Security History',
  'https://www.ssa.gov/history/fdrstmts.html',
  'Government',
  'Social Security Administration',
  NULL,
  'Promise Tracker batch 5 reduced FDR source import. Action-level historical source preserving Roosevelt statements and legislative context.'
),
(
  117,
  'Social Security In America: The Factual Background of the Social Security Act as Summarized from Staff Reports to the Committee on Economic Security',
  'https://www.ssa.gov/history/reports/ces/cesbookpreface.html',
  'Government',
  'Social Security Administration',
  '1937-01-01',
  'Promise Tracker batch 5 reduced FDR source import. Outcome-level source supporting the significance of the Social Security Act as a federal social-insurance milestone.'
),
(
  117,
  'The Decision to Exclude Agricultural and Domestic Workers from the 1935 Social Security Act',
  'https://www.ssa.gov/policy/docs/ssb/v70n4/v70n4p49.html',
  'Government',
  'Social Security Administration',
  '2010-11-01',
  'Promise Tracker batch 5 reduced FDR source import. Outcome-level source supporting the Mixed interpretation by documenting original Social Security exclusions affecting agricultural and domestic workers.'
);

INSERT INTO sources (
  policy_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes
)
SELECT
  t.policy_id,
  t.source_title,
  t.source_url,
  t.source_type,
  t.publisher,
  t.published_date,
  t.notes
FROM tmp_source_import_batch_5_fdr t
WHERE NOT EXISTS (
  SELECT 1
  FROM sources s
  WHERE s.source_url = t.source_url
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_source_join_batch_5_fdr;
CREATE TEMPORARY TABLE tmp_promise_source_join_batch_5_fdr (
  promise_slug varchar(255) NOT NULL,
  source_url text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_source_join_batch_5_fdr (
  promise_slug,
  source_url
) VALUES
(
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'https://www.presidency.ucsb.edu/documents/message-congress-establishing-minimum-wages-and-maximum-hours'
),
(
  'roosevelt-create-social-security-old-age-unemployment-system',
  'https://www.presidency.ucsb.edu/documents/message-congress-social-security'
);

INSERT INTO promise_sources (
  promise_id,
  source_id
)
SELECT
  p.id,
  s.id
FROM tmp_promise_source_join_batch_5_fdr t
JOIN promises p ON p.slug = t.promise_slug
JOIN sources s ON s.source_url = t.source_url
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_sources ps
  WHERE ps.promise_id = p.id
    AND ps.source_id = s.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_source_join_batch_5_fdr;
CREATE TEMPORARY TABLE tmp_promise_action_source_join_batch_5_fdr (
  promise_slug varchar(255) NOT NULL,
  action_title varchar(255) NOT NULL,
  source_url text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_action_source_join_batch_5_fdr (
  promise_slug,
  action_title,
  source_url
) VALUES
(
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'Roosevelt signs the Fair Labor Standards Act',
  'https://www.dol.gov/general/aboutdol/history/flsa1938'
),
(
  'roosevelt-create-social-security-old-age-unemployment-system',
  'Roosevelt signs the Social Security Act',
  'https://www.ssa.gov/history/fdrstmts.html'
);

INSERT INTO promise_action_sources (
  promise_action_id,
  source_id
)
SELECT
  pa.id,
  s.id
FROM tmp_promise_action_source_join_batch_5_fdr t
JOIN promises p ON p.slug = t.promise_slug
JOIN promise_actions pa ON pa.promise_id = p.id AND pa.title = t.action_title
JOIN sources s ON s.source_url = t.source_url
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_action_sources pas
  WHERE pas.promise_action_id = pa.id
    AND pas.source_id = s.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_source_join_batch_5_fdr;
CREATE TEMPORARY TABLE tmp_promise_outcome_source_join_batch_5_fdr (
  promise_slug varchar(255) NOT NULL,
  outcome_summary text NOT NULL,
  source_url text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_outcome_source_join_batch_5_fdr (
  promise_slug,
  outcome_summary,
  source_url
) VALUES
(
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'Roosevelt delivered national wage and hour standards, but the original framework excluded many occupations in which Black workers were heavily concentrated.',
  'https://www.dol.gov/whd/minwage/chart.htm'
),
(
  'roosevelt-establish-federal-minimum-wage-maximum-hours',
  'Roosevelt delivered national wage and hour standards, but the original framework excluded many occupations in which Black workers were heavily concentrated.',
  'https://www.congress.gov/event/117th-congress/house-event/112535/text'
),
(
  'roosevelt-create-social-security-old-age-unemployment-system',
  'Roosevelt delivered a foundational federal social-insurance system, but the original law excluded many workers in sectors where Black Americans were disproportionately employed.',
  'https://www.ssa.gov/history/reports/ces/cesbookpreface.html'
),
(
  'roosevelt-create-social-security-old-age-unemployment-system',
  'Roosevelt delivered a foundational federal social-insurance system, but the original law excluded many workers in sectors where Black Americans were disproportionately employed.',
  'https://www.ssa.gov/policy/docs/ssb/v70n4/v70n4p49.html'
);

INSERT INTO promise_outcome_sources (
  promise_outcome_id,
  source_id
)
SELECT
  po.id,
  s.id
FROM tmp_promise_outcome_source_join_batch_5_fdr t
JOIN promises p ON p.slug = t.promise_slug
JOIN promise_outcomes po ON po.promise_id = p.id AND po.outcome_summary = t.outcome_summary
JOIN sources s ON s.source_url = t.source_url
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_outcome_sources pos
  WHERE pos.promise_outcome_id = po.id
    AND pos.source_id = s.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_source_import_batch_5_fdr;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_source_join_batch_5_fdr;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_source_join_batch_5_fdr;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_source_join_batch_5_fdr;

COMMIT;
