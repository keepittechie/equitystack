USE black_policy_tracker;

START TRANSACTION;

-- Historical demographic-impact seed for an existing mixed-impact policy anchor.
-- This file is additive and idempotent under the current schema.
--
-- Candidate policy:
--   G.I. Bill (Servicemen's Readjustment Act)
-- The evidence layer here is intentionally narrow and nuanced. It captures the
-- law's substantial educational upside for some Black veterans alongside the
-- documented access barriers faced by Black veterans constrained to the
-- segregated South.

SET @gi_policy_title := 'G.I. Bill (Servicemen''s Readjustment Act)';
SET @gi_policy_year := 1944;

SET @gi_archives_source_url := 'https://www.archives.gov/milestone-documents/servicemens-readjustment-act';
SET @gi_nber_digest_source_url := 'https://www.nber.org/digest/dec02/gi-bill-world-war-ii-and-education-black-americans';
SET @gi_nber_working_paper_source_url := 'https://www.nber.org/papers/w9044';

SET @gi_policy_match_count := (
  SELECT COUNT(*)
  FROM policies
  WHERE title = @gi_policy_title
    AND year_enacted = @gi_policy_year
);

SET @gi_policy_id := (
  SELECT id
  FROM policies
  WHERE title = @gi_policy_title
    AND year_enacted = @gi_policy_year
    AND @gi_policy_match_count = 1
  LIMIT 1
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
  @gi_policy_id,
  'Servicemen''s Readjustment Act (1944)',
  @gi_archives_source_url,
  'Government',
  'National Archives',
  '1944-06-22',
  'National Archives milestone document page for the G.I. Bill. Used here as the canonical enactment and policy-scope source.'
WHERE @gi_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @gi_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @gi_archives_source_url
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
  @gi_policy_id,
  'The G.I. Bill, World War II, and the Education of Black Americans',
  @gi_nber_digest_source_url,
  'Academic',
  'National Bureau of Economic Research',
  '2002-12-01',
  'Non-technical NBER summary of research on how the World War II G.I. Bill affected Black educational outcomes differently inside and outside the segregated South.'
WHERE @gi_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @gi_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @gi_nber_digest_source_url
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
  @gi_policy_id,
  'Closing the Gap or Widening the Divide: The Effects of the G.I. Bill and World War II on the Educational Outcomes of Black Americans',
  @gi_nber_working_paper_source_url,
  'Academic',
  'National Bureau of Economic Research',
  '2002-07-01',
  'NBER working paper with race- and geography-specific evidence on the G.I. Bill''s uneven educational effects for Black veterans.'
WHERE @gi_policy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id = @gi_policy_id
      AND s.source_url COLLATE utf8mb4_general_ci = @gi_nber_working_paper_source_url
  );

DROP TEMPORARY TABLE IF EXISTS tmp_gi_bill_impacts;
CREATE TEMPORARY TABLE tmp_gi_bill_impacts (
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

INSERT INTO tmp_gi_bill_impacts (
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
  'Black veterans',
  'Estimated increase in college attainment for Black veterans outside the South under the G.I. Bill',
  0,
  0.4,
  NULL,
  'years of college',
  'Non-Southern United States',
  1944,
  1950,
  0.7600,
  'Direct mixed-impact outcome row. An NBER summary of Turner and Bound''s research reports that the combination of World War II service and the availability of G.I. Bill educational benefits increased educational attainment by about 0.4 years of college for Black men born outside the South. This is the strongest direct positive estimate in the evidence base, but it reflects the combined effect of wartime service and the G.I. Bill rather than the law in isolation.'
),
(
  'Black veterans',
  'Supporting evidence - Black share of collegiate-level G.I. Bill training participants',
  NULL,
  12.0,
  28.0,
  'percent',
  'United States',
  1944,
  1950,
  0.7000,
  'Supporting uneven-access row. Turner and Bound report Survey of Veterans data showing that more than 28 percent of white veterans in the 1923-28 birth cohorts enrolled in collegiate-level training, while less than 12 percent of returning Black veterans chose this option. This documents a substantial racial gap in collegiate use of G.I. educational benefits even though the statute was race-neutral on its face.'
),
(
  'Black veterans',
  'Supporting evidence - Black share of on-the-job G.I. Bill trainees in 12 southern states',
  NULL,
  7.5,
  33.3,
  'percent',
  'Twelve Southern States',
  1947,
  1947,
  0.6600,
  'Supporting exclusion row. Turner and Bound cite a contemporary report stating that of 102,200 veterans receiving on-the-job training in 12 southern states, only 7,700 were Black, even though about one in three veterans in the area were Black. This reflects a major implementation gap in southern access to G.I. Bill training opportunities.'
),
(
  'Black veterans',
  'Supporting evidence - Black veteran applicants turned away from 21 southern Black colleges',
  NULL,
  55.0,
  28.0,
  'percent',
  'Southern United States',
  1945,
  1946,
  0.6800,
  'Supporting capacity-constraint row. Turner and Bound report that a survey of 21 southern Black colleges found that 55 percent of veteran applicants were turned away for lack of space, compared with about 28 percent for all colleges and universities. This shows why many Black veterans in the segregated South were unable to convert formal G.I. Bill eligibility into actual collegiate access.'
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
  @gi_policy_id,
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
FROM tmp_gi_bill_impacts t
WHERE @gi_policy_id IS NOT NULL
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

DROP TEMPORARY TABLE IF EXISTS tmp_gi_bill_impact_sources;
CREATE TEMPORARY TABLE tmp_gi_bill_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_gi_bill_impact_sources (
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
  'Black veterans',
  'Estimated increase in college attainment for Black veterans outside the South under the G.I. Bill',
  'Non-Southern United States',
  1944,
  1950,
  @gi_nber_digest_source_url,
  'primary',
  'NBER digest reports that Black men born outside the South gained about 0.4 years of college from World War II service and G.I. Bill benefits.'
),
(
  'Black veterans',
  'Estimated increase in college attainment for Black veterans outside the South under the G.I. Bill',
  'Non-Southern United States',
  1944,
  1950,
  @gi_nber_working_paper_source_url,
  'methodology',
  'Turner and Bound provide the underlying research design for the education-effect estimate and explain that it reflects the joint effect of service and G.I. benefits.'
),
(
  'Black veterans',
  'Supporting evidence - Black share of collegiate-level G.I. Bill training participants',
  'United States',
  1944,
  1950,
  @gi_nber_working_paper_source_url,
  'supporting',
  'Working paper reports that more than 28 percent of white veterans in the relevant cohorts enrolled in collegiate-level training, compared with less than 12 percent of returning Black veterans.'
),
(
  'Black veterans',
  'Supporting evidence - Black share of collegiate-level G.I. Bill training participants',
  'United States',
  1944,
  1950,
  @gi_archives_source_url,
  'context',
  'National Archives milestone page documents the G.I. Bill''s education and housing benefits while noting that Black veterans often could not access those benefits on equal terms.'
),
(
  'Black veterans',
  'Supporting evidence - Black share of on-the-job G.I. Bill trainees in 12 southern states',
  'Twelve Southern States',
  1947,
  1947,
  @gi_nber_working_paper_source_url,
  'supporting',
  'Working paper cites a contemporaneous report showing only 7,700 Black trainees among 102,200 veterans in southern on-the-job training despite Black veterans making up about one-third of veterans in the area.'
),
(
  'Black veterans',
  'Supporting evidence - Black share of on-the-job G.I. Bill trainees in 12 southern states',
  'Twelve Southern States',
  1947,
  1947,
  @gi_archives_source_url,
  'context',
  'National Archives milestone page notes that Black veterans often faced discrimination in access to core G.I. Bill benefits.'
),
(
  'Black veterans',
  'Supporting evidence - Black veteran applicants turned away from 21 southern Black colleges',
  'Southern United States',
  1945,
  1946,
  @gi_nber_working_paper_source_url,
  'supporting',
  'Working paper reports that 55 percent of veteran applicants were turned away from a surveyed set of 21 southern Black colleges for lack of space, compared with about 28 percent for all colleges and universities.'
),
(
  'Black veterans',
  'Supporting evidence - Black veteran applicants turned away from 21 southern Black colleges',
  'Southern United States',
  1945,
  1946,
  @gi_archives_source_url,
  'context',
  'National Archives milestone page provides the overall legislative anchor and notes the unequal practical access Black veterans faced.'
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
FROM tmp_gi_bill_impact_sources t
JOIN entity_demographic_impacts edi
  ON edi.entity_type = 'policy'
 AND edi.entity_id = @gi_policy_id
 AND edi.demographic_group = t.demographic_group
 AND edi.metric_name = t.metric_name
 AND edi.geography = t.geography
 AND edi.year_before = t.year_before
 AND edi.year_after = t.year_after
JOIN (
  SELECT
    MIN(id) AS id,
    policy_id,
    source_url
  FROM sources
  GROUP BY policy_id, source_url
) s
  ON s.policy_id = @gi_policy_id
 AND s.source_url = t.source_url COLLATE utf8mb4_general_ci
WHERE @gi_policy_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source_role = VALUES(source_role),
  citation_note = VALUES(citation_note),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
