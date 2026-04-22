USE black_policy_tracker;

START TRANSACTION;

-- Promise-level demographic-impact seed for an existing promise anchor.
-- This file is additive and idempotent under the current schema.
--
-- Candidate promise:
--   Pass the Voting Rights Act after Selma
-- This seed mirrors the strongest existing Voting Rights Act evidence at the
-- promise layer because the promise was delivered through enactment of that law.

SET @promise_slug := 'johnson-pass-voting-rights-act-after-selma';

SET @vra_enactment_source_url := 'https://www.archives.gov/milestone-documents/voting-rights-act';
SET @vra_mississippi_outcome_source_url := 'https://www.usccr.gov/files/pubs/msdelta/ch3.htm';
SET @vra_longrun_source_url := 'https://www.usccr.gov/files/pubs/docs/060706VRAbrief524.pdf';

SET @promise_match_count := (
  SELECT COUNT(*)
  FROM promises
  WHERE slug = @promise_slug
);

SET @promise_id := (
  SELECT id
  FROM promises
  WHERE slug = @promise_slug
    AND @promise_match_count = 1
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
  NULL,
  'Voting Rights Act (1965)',
  @vra_enactment_source_url,
  'Government',
  'National Archives',
  '1965-08-06',
  'Canonical public enactment source used for promise-level demographic-impact evidence on Johnson''s Voting Rights Act pledge.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @vra_enactment_source_url
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
  NULL,
  'Chapter 3: Voting Rights in Mississippi Delta',
  @vra_mississippi_outcome_source_url,
  'Government',
  'U.S. Commission on Civil Rights',
  NULL,
  'Government civil-rights history documenting Black voter registration in Mississippi before and after enactment of the Voting Rights Act.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @vra_mississippi_outcome_source_url
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
  NULL,
  'Reauthorization of the Temporary Provisions of the Voting Rights Act: An Examination of the Act''s Section 5 Preclearance Provision',
  @vra_longrun_source_url,
  'Government',
  'U.S. Commission on Civil Rights',
  '2006-04-01',
  'USCCR briefing report with long-run race-specific registration, turnout, and representation tables used as supporting promise-level evidence.'
WHERE @promise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sources s
    WHERE s.policy_id IS NULL
      AND s.source_url COLLATE utf8mb4_general_ci = @vra_longrun_source_url
  );

UPDATE sources
SET
  source_title = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_enactment_source_url THEN 'Voting Rights Act (1965)'
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_mississippi_outcome_source_url THEN 'Chapter 3: Voting Rights in Mississippi Delta'
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_longrun_source_url THEN 'Reauthorization of the Temporary Provisions of the Voting Rights Act: An Examination of the Act''s Section 5 Preclearance Provision'
    ELSE source_title
  END,
  source_type = 'Government',
  publisher = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_enactment_source_url THEN 'National Archives'
    ELSE 'U.S. Commission on Civil Rights'
  END,
  published_date = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_enactment_source_url THEN '1965-08-06'
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_longrun_source_url THEN '2006-04-01'
    ELSE published_date
  END,
  notes = CASE
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_enactment_source_url THEN 'Canonical public enactment source used for promise-level demographic-impact evidence on Johnson''s Voting Rights Act pledge.'
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_mississippi_outcome_source_url THEN 'Government civil-rights history documenting Black voter registration in Mississippi before and after enactment of the Voting Rights Act.'
    WHEN source_url COLLATE utf8mb4_general_ci = @vra_longrun_source_url THEN 'USCCR briefing report with long-run race-specific registration, turnout, and representation tables used as supporting promise-level evidence.'
    ELSE notes
  END
WHERE policy_id IS NULL
  AND source_url COLLATE utf8mb4_general_ci IN (
    @vra_enactment_source_url,
    @vra_mississippi_outcome_source_url,
    @vra_longrun_source_url
  );

DROP TEMPORARY TABLE IF EXISTS tmp_promise_vra_impacts;
CREATE TEMPORARY TABLE tmp_promise_vra_impacts (
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

INSERT INTO tmp_promise_vra_impacts (
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
  'Black voters',
  'Black voter registration rate in Mississippi after Voting Rights Act enactment',
  6.7,
  59.8,
  NULL,
  'percent',
  'Mississippi',
  1964,
  1967,
  0.8500,
  'Direct measured outcome row. Johnson delivered this promise by helping secure and sign the Voting Rights Act of 1965. A U.S. Commission on Civil Rights history reports that only 6.7% of eligible Black Mississippians were registered to vote in 1964 and that Black registration in Mississippi rose to 59.8% by 1967. This should be read as a strong early state-level outcome tied to the promise''s legislative delivery, not as a complete national estimate.'
),
(
  'Black voters',
  'Supporting evidence - Black voter registration rate in Mississippi during extended Voting Rights Act enforcement',
  72.2,
  76.1,
  72.3,
  'percent',
  'Mississippi',
  1980,
  2004,
  0.7000,
  'Supporting context row. A 2006 U.S. Commission on Civil Rights briefing report reproduced Census-based registration tables showing Black voter registration in Mississippi at 72.2% in 1980 and 76.1% in 2004, compared with white registration at 72.3% in 2004. This documents sustained gains during the long Voting Rights Act enforcement period rather than the entire causal effect of the statute by itself.'
),
(
  'Black voters',
  'Supporting evidence - Black voter turnout rate in Mississippi during extended Voting Rights Act enforcement',
  59.5,
  66.8,
  58.9,
  'percent',
  'Mississippi',
  1980,
  2004,
  0.6500,
  'Supporting context row. A 2006 U.S. Commission on Civil Rights briefing report reproduced Census-based turnout tables showing Black turnout in Mississippi at 59.5% in 1980 and 66.8% in 2004, compared with white turnout at 58.9% in 2004. This is long-run turnout context for the promise''s voting-rights delivery path rather than a standalone causal claim.'
),
(
  'Black Mississippians',
  'Supporting evidence - Black state legislators in Mississippi',
  0,
  47,
  172,
  'legislators',
  'Mississippi',
  1964,
  2002,
  0.6000,
  'Supporting representation row. A 2006 U.S. Commission on Civil Rights briefing report reproduced a historical series showing zero Black Mississippi state legislators in 1964 and 47 by 2002, with 172 total legislative seats. This should be read as long-run representational context associated with the voting-rights era, not as single-law causal proof.'
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
  'promise',
  @promise_id,
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
FROM tmp_promise_vra_impacts t
WHERE @promise_id IS NOT NULL
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

DROP TEMPORARY TABLE IF EXISTS tmp_promise_vra_impact_sources;
CREATE TEMPORARY TABLE tmp_promise_vra_impact_sources (
  demographic_group VARCHAR(150) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  geography VARCHAR(150) NOT NULL,
  year_before SMALLINT UNSIGNED NOT NULL,
  year_after SMALLINT UNSIGNED NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_role VARCHAR(32) NOT NULL,
  citation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_promise_vra_impact_sources (
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
  'Black voters',
  'Black voter registration rate in Mississippi after Voting Rights Act enactment',
  'Mississippi',
  1964,
  1967,
  @vra_mississippi_outcome_source_url,
  'primary',
  'USCCR history states that only 6.7% of eligible Black Mississippians were registered in 1964 and that the rate rose to 59.8% by 1967 after the Voting Rights Act.'
),
(
  'Black voters',
  'Black voter registration rate in Mississippi after Voting Rights Act enactment',
  'Mississippi',
  1964,
  1967,
  @vra_enactment_source_url,
  'context',
  'Official National Archives enactment page for the law Johnson promised to pass after Selma.'
),
(
  'Black voters',
  'Supporting evidence - Black voter registration rate in Mississippi during extended Voting Rights Act enforcement',
  'Mississippi',
  1980,
  2004,
  @vra_longrun_source_url,
  'supporting',
  'USCCR briefing table shows Mississippi Black voter registration at 72.2% in 1980 and 76.1% in 2004, with white registration at 72.3% in 2004.'
),
(
  'Black voters',
  'Supporting evidence - Black voter registration rate in Mississippi during extended Voting Rights Act enforcement',
  'Mississippi',
  1980,
  2004,
  @vra_enactment_source_url,
  'context',
  'Official National Archives enactment page for the Voting Rights Act promise-delivery anchor.'
),
(
  'Black voters',
  'Supporting evidence - Black voter turnout rate in Mississippi during extended Voting Rights Act enforcement',
  'Mississippi',
  1980,
  2004,
  @vra_longrun_source_url,
  'supporting',
  'USCCR briefing table shows Mississippi Black voter turnout at 59.5% in 1980 and 66.8% in 2004, compared with white turnout at 58.9% in 2004.'
),
(
  'Black voters',
  'Supporting evidence - Black voter turnout rate in Mississippi during extended Voting Rights Act enforcement',
  'Mississippi',
  1980,
  2004,
  @vra_enactment_source_url,
  'context',
  'Official National Archives enactment page for the Voting Rights Act promise-delivery anchor.'
),
(
  'Black Mississippians',
  'Supporting evidence - Black state legislators in Mississippi',
  'Mississippi',
  1964,
  2002,
  @vra_longrun_source_url,
  'supporting',
  'USCCR briefing report reproduces a historical series with zero Black Mississippi state legislators in 1964 and 47 by 2002, with 172 total legislative seats.'
),
(
  'Black Mississippians',
  'Supporting evidence - Black state legislators in Mississippi',
  'Mississippi',
  1964,
  2002,
  @vra_enactment_source_url,
  'context',
  'Official National Archives enactment page for the Voting Rights Act promise-delivery anchor.'
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
FROM tmp_promise_vra_impact_sources t
JOIN entity_demographic_impacts edi
  ON edi.entity_type = 'promise'
 AND edi.entity_id = @promise_id
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
  ON s.policy_id IS NULL
 AND s.source_url = t.source_url COLLATE utf8mb4_general_ci
WHERE @promise_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source_role = VALUES(source_role),
  citation_note = VALUES(citation_note),
  updated_at = CURRENT_TIMESTAMP(3);

COMMIT;
