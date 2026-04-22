USE black_policy_tracker;

START TRANSACTION;

-- Intended run order:
--   1. Import python/data/policies/current_admin_budget_pack_1.json
--   2. Run this SQL file to attach the canonical budget source and the first
--      structured demographic impact rows to that policy anchor.

SET @fy2027_budget_policy_title := 'President''s Budget, Fiscal Year 2027';
SET @fy2027_budget_policy_year := 2026;
SET @fy2027_budget_source_url := 'https://www.whitehouse.gov/wp-content/uploads/2026/04/budget_fy2027.pdf';
SET @fy2027_mbda_census_source_url := 'https://www.census.gov/newsroom/press-releases/2024/employer-businesses.html';
SET @fy2027_mbda_methodology_source_url := 'https://www.mbda.gov/about/whoweserve';
SET @fy2027_liheap_profile_source_url := 'https://stage.liheappm.acf.hhs.gov/sites/default/files/private/congress/profiles/2024/FY2024_AllStates(National)_Profile.pdf';
SET @fy2027_liheap_methodology_source_url := 'https://stage.liheappm.acf.hhs.gov/sites/default/files/private/webinars/2024/FY2024%20Household%20Report%20Short%20Form%20Webinar%20-%2010.31.24-1.pdf';
SET @fy2027_cdbg_supporting_source_url := 'https://www.hud.gov/sites/documents/presentacion_cdbg.pdf';
SET @fy2027_job_corps_supporting_source_url := 'https://www.dol.gov/sites/dolgov/files/ETA/Performance/pdfs/WSR-Accessible-05-28-2024.pdf';

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

DROP TEMPORARY TABLE IF EXISTS tmp_fy2027_budget_supporting_sources;
CREATE TEMPORARY TABLE tmp_fy2027_budget_supporting_sources (
  source_title VARCHAR(255) NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  publisher VARCHAR(255) NOT NULL,
  published_date DATE NULL,
  notes TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_fy2027_budget_supporting_sources (
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes
) VALUES
(
  'Characteristics of Employer Businesses, 2023 Annual Business Survey',
  @fy2027_mbda_census_source_url,
  'Government',
  'U.S. Census Bureau',
  '2024-12-19',
  'Commerce source used as supporting population context for MBDA. The release reports 2022 employer-business ownership counts, including Black or African American-owned firms.'
),
(
  'Who We Serve | Minority Business Development Agency',
  @fy2027_mbda_methodology_source_url,
  'Government',
  'Minority Business Development Agency',
  NULL,
  'Methodology/context source describing MBDA''s target population and program mission.'
),
(
  'Low Income Home Energy Assistance - FY2024 National Profile (All States)',
  @fy2027_liheap_profile_source_url,
  'Government',
  'U.S. Department of Health and Human Services, Administration for Children and Families',
  '2025-05-30',
  'National LIHEAP profile used as supporting scale context. The PDF reports 5,876,646 total households served by state programs in FY2024.'
),
(
  'Completing the FY2024 Household Report - Short Form Webinar',
  @fy2027_liheap_methodology_source_url,
  'Government',
  'U.S. Department of Health and Human Services, Administration for Children and Families',
  '2024-10-31',
  'Methodology source documenting that race and ethnicity reporting for assisted household members became required in FY2024 Household Report submissions.'
),
(
  'CDBG Community Development Block Grant Performance Profile / Program Year 2005 Accomplishments',
  @fy2027_cdbg_supporting_source_url,
  'Government',
  'U.S. Department of Housing and Urban Development',
  NULL,
  'Older HUD accomplishments source used as contextual beneficiary-pattern evidence for CDBG. The cited table is labeled Program Year 2005 Accomplishments.'
),
(
  'Workforce System Results, Program Year 2023 Quarter 2',
  @fy2027_job_corps_supporting_source_url,
  'Government',
  'U.S. Department of Labor, Employment and Training Administration',
  '2024-05-28',
  'ETA workforce-system results PDF used as supporting demographic context for Job Corps participation.'
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
  t.source_title,
  t.source_url,
  t.source_type,
  t.publisher,
  t.published_date,
  t.notes
FROM tmp_fy2027_budget_supporting_sources t
WHERE @fy2027_budget_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.source_url COLLATE utf8mb4_general_ci = t.source_url
  );

DROP TEMPORARY TABLE IF EXISTS tmp_fy2027_budget_supporting_impacts;
CREATE TEMPORARY TABLE tmp_fy2027_budget_supporting_impacts (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  before_value DECIMAL(14,4) NULL,
  after_value DECIMAL(14,4) NULL,
  comparison_value DECIMAL(14,4) NULL,
  unit VARCHAR(64) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL,
  methodology_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_fy2027_budget_supporting_impacts (
  demographic_group,
  metric_name,
  before_value,
  after_value,
  comparison_value,
  unit,
  geography,
  year_before,
  year_after,
  confidence_score,
  methodology_note
) VALUES
(
  'Black-owned businesses',
  'Supporting evidence - Black-owned employer businesses in 2022 - MBDA',
  NULL,
  194585,
  5900000,
  'businesses',
  'United States',
  2022,
  2022,
  0.7000,
  'Supporting context row. The U.S. Census Bureau''s 2023 Annual Business Survey release reported 194,585 Black- or African American-owned employer businesses out of roughly 5.9 million U.S. employer firms. This is target-population context for MBDA, not a count of MBDA clients or a causal loss estimate.'
),
(
  'Black households',
  'Supporting evidence - FY2024 assisted-household race reporting requirement - LIHEAP',
  NULL,
  100,
  NULL,
  'percent',
  'United States',
  2024,
  2024,
  0.3000,
  'Methodology-support row. HHS made race and ethnicity reporting for assisted household members a required part of FY2024 LIHEAP household reporting, and the FY2024 national profile reports 5,876,646 households served. This row does not estimate a Black recipient share; it is included to document public demographic-reporting coverage and national program scale without overstating precision.'
),
(
  'Black communities',
  'Supporting evidence - Black share of direct-benefit beneficiaries in HUD accomplishments reporting - CDBG',
  NULL,
  27.45,
  NULL,
  'percent',
  'United States',
  2005,
  2005,
  0.3500,
  'Supporting context row drawn from HUD''s Program Year 2005 accomplishments reporting. HUD reported 27.45% of direct-benefit CDBG beneficiaries as Black. Because this is an older national accomplishments snapshot, it should be treated as contextual beneficiary-pattern evidence rather than a current annual baseline.'
),
(
  'Black young adults',
  'Supporting evidence - Black/African American participant share in Q2 PY2023 - Job Corps',
  NULL,
  18.3,
  NULL,
  'percent',
  'United States',
  2023,
  2023,
  0.6500,
  'Supporting context row based on the Employment and Training Administration''s Workforce System Results report. The cited DOL report shows 18.3% of Job Corps participants identified as Black/African American in Q2 of Program Year 2023. This is a participation snapshot, not a causal outcome estimate.'
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
  t.comparison_value,
  t.unit,
  t.geography,
  NULL,
  NULL,
  t.year_before,
  t.year_after,
  NULL,
  t.confidence_score,
  t.methodology_note
FROM tmp_fy2027_budget_supporting_impacts t
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

DROP TEMPORARY TABLE IF EXISTS tmp_fy2027_budget_supporting_impact_sources;
CREATE TEMPORARY TABLE tmp_fy2027_budget_supporting_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_fy2027_budget_supporting_impact_sources (
  demographic_group,
  metric_name,
  geography,
  year_before,
  year_after,
  source_url,
  source_role,
  citation_note
) VALUES
(
  'Black-owned businesses',
  'Supporting evidence - Black-owned employer businesses in 2022 - MBDA',
  'United States',
  2022,
  2022,
  @fy2027_mbda_census_source_url,
  'supporting',
  'The Census Bureau''s 2023 Annual Business Survey release reports 194,585 Black- or African American-owned employer firms out of approximately 5.9 million U.S. employer firms.'
),
(
  'Black-owned businesses',
  'Supporting evidence - Black-owned employer businesses in 2022 - MBDA',
  'United States',
  2022,
  2022,
  @fy2027_mbda_methodology_source_url,
  'methodology',
  'MBDA describes its mission and the minority-business population it is designed to serve.'
),
(
  'Black households',
  'Supporting evidence - FY2024 assisted-household race reporting requirement - LIHEAP',
  'United States',
  2024,
  2024,
  @fy2027_liheap_profile_source_url,
  'supporting',
  'The FY2024 national LIHEAP profile reports 5,876,646 households served by state programs, establishing current national program scale.'
),
(
  'Black households',
  'Supporting evidence - FY2024 assisted-household race reporting requirement - LIHEAP',
  'United States',
  2024,
  2024,
  @fy2027_liheap_methodology_source_url,
  'methodology',
  'HHS states that race and ethnicity reporting for assisted household members became a required section in FY2024 Household Report submissions.'
),
(
  'Black communities',
  'Supporting evidence - Black share of direct-benefit beneficiaries in HUD accomplishments reporting - CDBG',
  'United States',
  2005,
  2005,
  @fy2027_cdbg_supporting_source_url,
  'supporting',
  'HUD''s Program Year 2005 accomplishments table reports 27.45% of direct-benefit CDBG beneficiaries as Black.'
),
(
  'Black young adults',
  'Supporting evidence - Black/African American participant share in Q2 PY2023 - Job Corps',
  'United States',
  2023,
  2023,
  @fy2027_job_corps_supporting_source_url,
  'supporting',
  'ETA''s Workforce System Results report shows 18.3% of Job Corps participants identified as Black/African American in Q2 of Program Year 2023.'
);

INSERT INTO entity_demographic_impact_sources (
  impact_id,
  source_id,
  source_role,
  citation_note
) SELECT
  edi.id,
  s.id,
  t.source_role,
  t.citation_note
FROM tmp_fy2027_budget_supporting_impact_sources t
JOIN entity_demographic_impacts edi
  ON edi.entity_type = 'policy'
 AND edi.entity_id = @fy2027_budget_policy_id
 AND edi.demographic_group = t.demographic_group
 AND edi.metric_name = t.metric_name
 AND edi.geography = t.geography
 AND edi.year_before = t.year_before
 AND edi.year_after = t.year_after
JOIN sources s
  ON s.source_url = t.source_url COLLATE utf8mb4_general_ci
WHERE @fy2027_budget_policy_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source_role = VALUES(source_role),
  citation_note = VALUES(citation_note),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
