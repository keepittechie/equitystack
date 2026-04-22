USE black_policy_tracker;

START TRANSACTION;

-- Intended run order:
--   1. Import python/data/policies/current_admin_budget_pack_1.json
--   2. Run this SQL file to attach the canonical budget source and the first
--      structured demographic impact rows to that policy anchor.

SET @fy2027_budget_policy_title := 'President''s Budget, Fiscal Year 2027';
SET @fy2027_budget_policy_year := 2026;
SET @fy2027_budget_source_url := 'https://www.whitehouse.gov/wp-content/uploads/2026/04/budget_fy2027.pdf';

SET @fy2027_budget_policy_id := (
  SELECT id
  FROM policies
  WHERE title = @fy2027_budget_policy_title
    AND year_enacted = @fy2027_budget_policy_year
  LIMIT 1
);

DROP TEMPORARY TABLE IF EXISTS tmp_fy2027_budget_impacts;
CREATE TEMPORARY TABLE tmp_fy2027_budget_impacts (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  before_value DECIMAL(14,4) NULL,
  after_value DECIMAL(14,4) NULL,
  unit VARCHAR(64) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL,
  methodology_note TEXT NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_fy2027_budget_impacts (
  demographic_group,
  metric_name,
  before_value,
  after_value,
  unit,
  geography,
  year_before,
  year_after,
  confidence_score,
  methodology_note,
  citation_note
) VALUES
(
  'Black-owned businesses',
  'Proposed FY2027 funding level - MBDA',
  47000000,
  0,
  'USD',
  'United States',
  2026,
  2027,
  0.5500,
  'Proposed FY2027 funding-change row based on the White House FY2027 budget PDF. This captures a direct proposed reduction to the Minority Business Development Agency, not a measured downstream loss estimate for Black-owned businesses.',
  'Budget PDF program-cuts section states that the FY2027 budget would eliminate MBDA and lists a $47 million reduction.'
),
(
  'Black households',
  'Proposed FY2027 funding level - LIHEAP',
  4000000000,
  0,
  'USD',
  'United States',
  2026,
  2027,
  0.4500,
  'Proposed FY2027 funding-change row based on the White House FY2027 budget PDF. The document states that LIHEAP would be eliminated, but it does not quantify the Black recipient share, so this should be read as a proposed risk channel rather than a measured disparate-impact estimate.',
  'Budget PDF program-cuts section states that the FY2027 budget would eliminate LIHEAP and lists a $4 billion reduction.'
),
(
  'Black communities',
  'Proposed FY2027 funding level - CDBG',
  3300000000,
  0,
  'USD',
  'United States',
  2026,
  2027,
  0.5000,
  'Proposed FY2027 funding-change row based on the White House FY2027 budget PDF. This captures proposed risk to community-development capacity that may affect Black communities, but the budget PDF alone does not provide a quantified Black beneficiary count.',
  'Budget PDF program-cuts section states that the FY2027 budget would eliminate CDBG and lists a $3.3 billion reduction.'
),
(
  'Black young adults',
  'Proposed FY2027 funding level - Job Corps',
  1600000000,
  0,
  'USD',
  'United States',
  2026,
  2027,
  0.4500,
  'Proposed FY2027 funding-change row based on the White House FY2027 budget PDF. The document states that Job Corps would be eliminated, but it does not provide a Black participant count or downstream earnings estimate, so this should be treated as a program-risk row rather than a measured outcome claim.',
  'Budget PDF program-cuts section states that the FY2027 budget would eliminate Job Corps and lists a $1.6 billion reduction.'
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
  @fy2027_budget_policy_id,
  'Budget of the U.S. Government, Fiscal Year 2027',
  @fy2027_budget_source_url,
  'Government',
  'U.S. Office of Management and Budget',
  '2026-04-03',
  'Primary White House-hosted OMB FY2027 budget PDF. Local repo mirror: research/budgets/budget-2027/proposed-budget_fy2027.pdf.'
WHERE @fy2027_budget_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.source_url = @fy2027_budget_source_url
  );

SET @fy2027_budget_source_id := (
  SELECT id
  FROM sources
  WHERE source_url = @fy2027_budget_source_url
  LIMIT 1
);

INSERT INTO entity_demographic_impacts (
  entity_type,
  entity_id,
  demographic_group,
  metric_name,
  before_value,
  after_value,
  comparison_value,
  unit,
  geography,
  period_start,
  period_end,
  year_before,
  year_after,
  disparity_ratio,
  confidence_score,
  methodology_note
) SELECT
  'policy',
  @fy2027_budget_policy_id,
  t.demographic_group,
  t.metric_name,
  t.before_value,
  t.after_value,
  NULL,
  t.unit,
  t.geography,
  NULL,
  NULL,
  t.year_before,
  t.year_after,
  NULL,
  t.confidence_score,
  t.methodology_note
FROM tmp_fy2027_budget_impacts t
WHERE @fy2027_budget_policy_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  before_value = VALUES(before_value),
  after_value = VALUES(after_value),
  comparison_value = VALUES(comparison_value),
  unit = VALUES(unit),
  geography = VALUES(geography),
  period_start = VALUES(period_start),
  period_end = VALUES(period_end),
  disparity_ratio = VALUES(disparity_ratio),
  confidence_score = VALUES(confidence_score),
  methodology_note = VALUES(methodology_note),
  updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO entity_demographic_impact_sources (
  impact_id,
  source_id,
  source_role,
  citation_note
) SELECT
  edi.id,
  @fy2027_budget_source_id,
  'primary',
  t.citation_note
FROM tmp_fy2027_budget_impacts t
JOIN entity_demographic_impacts edi
  ON edi.entity_type = 'policy'
 AND edi.entity_id = @fy2027_budget_policy_id
 AND edi.demographic_group = t.demographic_group
 AND edi.metric_name = t.metric_name
 AND edi.geography = t.geography
 AND edi.year_before = t.year_before
 AND edi.year_after = t.year_after
WHERE @fy2027_budget_policy_id IS NOT NULL
  AND @fy2027_budget_source_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source_role = VALUES(source_role),
  citation_note = VALUES(citation_note),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
