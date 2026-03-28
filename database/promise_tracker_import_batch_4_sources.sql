-- Source import draft for approved mission-aligned Promise Tracker batch 4
-- Status: PREVIEW ONLY. Do not run until reviewed and approved.
--
-- Scope:
--   - Reuses existing source rows where available.
--   - Inserts missing source rows needed for the 5 batch 4 promises.
--   - Creates promise_sources, promise_action_sources, and promise_outcome_sources joins.
--   - Does NOT change schema.
--
-- Important schema note:
--   The current `sources` table still requires `policy_id`.
--   For source rows that do not naturally belong to a dedicated Promise Tracker policy,
--   this draft attaches them to the closest related existing policy record so they can be
--   joined under the current schema.
--
-- Policy mapping used in this draft:
--   - 17 = Ku Klux Klan Act of 1871
--   - 6  = Voting Rights Act of 1965
--   - 7  = Fair Housing Act of 1968
--   - 29 = George Floyd Justice in Policing Act
--   - 70 = McCleskey v. Kemp

USE black_policy_tracker;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_source_import_batch_4;
CREATE TEMPORARY TABLE tmp_source_import_batch_4 (
  policy_id int(11) NOT NULL,
  source_title varchar(255) NOT NULL,
  source_url text NOT NULL,
  source_type varchar(50) NOT NULL,
  publisher varchar(255) DEFAULT NULL,
  published_date date DEFAULT NULL,
  notes text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_source_import_batch_4 (
  policy_id,
  source_title,
  source_url,
  source_type,
  publisher,
  published_date,
  notes
) VALUES
(
  17,
  'Special Message',
  'https://www.presidency.ucsb.edu/documents/special-message-2176',
  'Archive',
  'The American Presidency Project',
  '1871-03-23',
  'Promise Tracker batch 4 source import. Attached to policy_id 17 under current schema because this source supports Grant''s anti-Klan enforcement promise and related action trail.'
),
(
  17,
  'Proclamation 201—Suspending the Writ of Habeas Corpus in Certain Counties of South Carolina',
  'https://www.presidency.ucsb.edu/documents/proclamation-201-suspending-the-writ-habeas-corpus-certain-counties-south-carolina',
  'Archive',
  'The American Presidency Project',
  '1871-10-17',
  'Promise Tracker batch 4 source import. Attached to policy_id 17 under current schema because this source documents Grant''s direct anti-Klan enforcement action.'
),
(
  17,
  'Protecting Life and Property: Passing the Ku Klux Klan Act',
  'https://www.nps.gov/articles/000/protecting-life-and-property-passing-the-ku-klux-klan-act.htm',
  'Government',
  'U.S. National Park Service',
  NULL,
  'Promise Tracker batch 4 source import. Attached to policy_id 17 under current schema because this source summarizes the law and its role in suppressing racial terror tied to Black disenfranchisement.'
),
(
  6,
  'Special Message to the Congress: The American Promise',
  'https://www.presidency.ucsb.edu/documents/special-message-the-congress-the-american-promise',
  'Archive',
  'The American Presidency Project',
  '1965-03-15',
  'Promise Tracker batch 4 source import. Attached to policy_id 6 under current schema because this source is the core Johnson voting-rights promise speech.'
),
(
  7,
  'Letter to the Speaker of the House Urging Enactment of the Fair Housing Bill',
  'https://www.presidency.ucsb.edu/documents/letter-the-speaker-the-house-urging-enactment-the-fair-housing-bill',
  'Archive',
  'The American Presidency Project',
  '1968-04-05',
  'Promise Tracker batch 4 source import. Attached to policy_id 7 under current schema because this source is the core Johnson fair-housing promise statement.'
),
(
  7,
  'H.R.2516 - 90th Congress (1967-1968): An Act to prescribe penalties for certain acts of violence or intimidation, and for other purposes',
  'https://www.congress.gov/bill/90th-congress/house-bill/2516',
  'Government',
  'Congress.gov',
  '1968-04-11',
  'Promise Tracker batch 4 source import. Attached to policy_id 7 under current schema because this is the legislative vehicle for the Civil Rights Act of 1968 including the Fair Housing Act.'
),
(
  29,
  'Ban racial profiling by federal law enforcement agencies',
  'https://www.politifact.com/truth-o-meter/promises/obameter/promise/303/ban-racial-profiling-by-federal-law-enforcement-ag/',
  'News',
  'PolitiFact',
  NULL,
  'Promise Tracker batch 4 source import. Attached to policy_id 29 as the closest existing policing-accountability policy anchor under the current schema.'
),
(
  29,
  'Attorney General Holder Announces Federal Law Enforcement Agencies To Adopt Stricter Policies To Curb Profiling',
  'https://www.justice.gov/opa/pr/attorney-general-holder-announces-federal-law-enforcement-agencies-adopt-stricter-policies-0',
  'Government',
  'U.S. Department of Justice',
  '2014-12-08',
  'Promise Tracker batch 4 source import. Attached to policy_id 29 as the closest existing policing-accountability policy anchor under the current schema.'
),
(
  29,
  'Final Report of the President''s Task Force on 21st Century Policing',
  'https://www.ojp.gov/library/publications/final-report-presidents-task-force-21st-century-policing',
  'Government',
  'Office of Justice Programs',
  '2015-05-01',
  'Promise Tracker batch 4 source import. Attached to policy_id 29 as the closest existing policing-accountability policy anchor under the current schema.'
),
(
  29,
  'Without a new law, Justice Department updates racial profiling guidelines',
  'https://www.politifact.com/truth-o-meter/promises/obameter/promise/303/ban-racial-profiling-by-federal-law-enforcement-ag/article/2190/',
  'News',
  'PolitiFact',
  '2016-12-08',
  'Promise Tracker batch 4 source import. Attached to policy_id 29 as the closest existing policing-accountability policy anchor under the current schema.'
),
(
  70,
  'Eliminate the federal death penalty',
  'https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1530/eliminate-federal-death-penalty/',
  'News',
  'PolitiFact',
  NULL,
  'Promise Tracker batch 4 source import. Attached to policy_id 70 as the closest existing death-penalty-related policy anchor under the current schema.'
),
(
  70,
  'Attorney General Merrick B. Garland Imposes a Moratorium on Federal Executions; Orders Review of Policies and Procedures',
  'https://www.justice.gov/archives/opa/pr/attorney-general-merrick-b-garland-imposes-moratorium-federal-executions-orders-review',
  'Government',
  'U.S. Department of Justice',
  '2021-07-01',
  'Promise Tracker batch 4 source import. Attached to policy_id 70 as the closest existing death-penalty-related policy anchor under the current schema.'
),
(
  70,
  'Biden commutes sentences of all but three convicts on federal death row',
  'https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1530/eliminate-federal-death-penalty/article/3045/',
  'News',
  'PolitiFact',
  '2025-01-08',
  'Promise Tracker batch 4 source import. Attached to policy_id 70 as the closest existing death-penalty-related policy anchor under the current schema.'
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
FROM tmp_source_import_batch_4 t
WHERE NOT EXISTS (
  SELECT 1
  FROM sources s
  WHERE s.source_url = t.source_url
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_source_join_batch_4;
CREATE TEMPORARY TABLE tmp_promise_source_join_batch_4 (
  promise_slug varchar(255) NOT NULL,
  source_url text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_source_join_batch_4 (
  promise_slug,
  source_url
) VALUES
(
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'https://www.presidency.ucsb.edu/documents/special-message-2176'
),
(
  'johnson-pass-voting-rights-act-after-selma',
  'https://www.presidency.ucsb.edu/documents/special-message-the-congress-the-american-promise'
),
(
  'johnson-pass-fair-housing-act',
  'https://www.presidency.ucsb.edu/documents/letter-the-speaker-the-house-urging-enactment-the-fair-housing-bill'
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  'https://www.politifact.com/truth-o-meter/promises/obameter/promise/303/ban-racial-profiling-by-federal-law-enforcement-ag/'
),
(
  'biden-eliminate-federal-death-penalty',
  'https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1530/eliminate-federal-death-penalty/'
);

INSERT INTO promise_sources (
  promise_id,
  source_id
)
SELECT
  p.id,
  s.id
FROM tmp_promise_source_join_batch_4 t
JOIN promises p ON p.slug = t.promise_slug
JOIN sources s ON s.source_url = t.source_url
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_sources ps
  WHERE ps.promise_id = p.id
    AND ps.source_id = s.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_source_join_batch_4;
CREATE TEMPORARY TABLE tmp_promise_action_source_join_batch_4 (
  promise_slug varchar(255) NOT NULL,
  action_title varchar(255) NOT NULL,
  source_url text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_action_source_join_batch_4 (
  promise_slug,
  action_title,
  source_url
) VALUES
(
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'Grant uses federal enforcement powers in South Carolina',
  'https://www.presidency.ucsb.edu/documents/proclamation-201-suspending-the-writ-habeas-corpus-certain-counties-south-carolina'
),
(
  'johnson-pass-voting-rights-act-after-selma',
  'Johnson signs the Voting Rights Act of 1965',
  'https://www.congress.gov/bill/89th-congress/house-bill/6400'
),
(
  'johnson-pass-fair-housing-act',
  'Johnson signs the Fair Housing Act',
  'https://www.congress.gov/bill/90th-congress/house-bill/2516'
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  'Justice Department revises federal profiling guidance',
  'https://www.justice.gov/opa/pr/attorney-general-holder-announces-federal-law-enforcement-agencies-adopt-stricter-policies-0'
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  '21st Century Policing framework reinforces anti-bias standards',
  'https://www.ojp.gov/library/publications/final-report-presidents-task-force-21st-century-policing'
),
(
  'biden-eliminate-federal-death-penalty',
  'Attorney General pauses federal executions',
  'https://www.justice.gov/archives/opa/pr/attorney-general-merrick-b-garland-imposes-moratorium-federal-executions-orders-review'
);

INSERT INTO promise_action_sources (
  promise_action_id,
  source_id
)
SELECT
  pa.id,
  s.id
FROM tmp_promise_action_source_join_batch_4 t
JOIN promises p ON p.slug = t.promise_slug
JOIN promise_actions pa ON pa.promise_id = p.id AND pa.title = t.action_title
JOIN sources s ON s.source_url = t.source_url
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_action_sources pas
  WHERE pas.promise_action_id = pa.id
    AND pas.source_id = s.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_source_join_batch_4;
CREATE TEMPORARY TABLE tmp_promise_outcome_source_join_batch_4 (
  promise_slug varchar(255) NOT NULL,
  outcome_summary text NOT NULL,
  source_url text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tmp_promise_outcome_source_join_batch_4 (
  promise_slug,
  outcome_summary,
  source_url
) VALUES
(
  'grant-protect-black-voting-rights-from-ku-klux-klan-terror',
  'Grant used expanded federal enforcement powers against Ku Klux Klan violence, producing a concrete period of federal protection for Black voting rights during Reconstruction.',
  'https://www.nps.gov/articles/000/protecting-life-and-property-passing-the-ku-klux-klan-act.htm'
),
(
  'johnson-pass-voting-rights-act-after-selma',
  'Johnson delivered the central promise by helping secure and sign the Voting Rights Act of 1965.',
  'https://www.archives.gov/milestone-documents/voting-rights-act'
),
(
  'johnson-pass-fair-housing-act',
  'Johnson delivered federal fair-housing protections through enactment of the Fair Housing Act in 1968.',
  'https://www.justice.gov/crt/fair-housing-act-1'
),
(
  'obama-ban-racial-profiling-federal-law-enforcement',
  'The Obama administration narrowed some federal profiling practices, but it did not deliver a complete or fully durable federal ban matching the campaign promise.',
  'https://www.politifact.com/truth-o-meter/promises/obameter/promise/303/ban-racial-profiling-by-federal-law-enforcement-ag/article/2190/'
),
(
  'biden-eliminate-federal-death-penalty',
  'Biden paused federal executions and later commuted most federal death-row sentences, but he did not abolish the federal death penalty.',
  'https://www.politifact.com/truth-o-meter/promises/biden-promise-tracker/promise/1530/eliminate-federal-death-penalty/article/3045/'
);

INSERT INTO promise_outcome_sources (
  promise_outcome_id,
  source_id
)
SELECT
  po.id,
  s.id
FROM tmp_promise_outcome_source_join_batch_4 t
JOIN promises p ON p.slug = t.promise_slug
JOIN promise_outcomes po ON po.promise_id = p.id AND po.outcome_summary = t.outcome_summary
JOIN sources s ON s.source_url = t.source_url
WHERE NOT EXISTS (
  SELECT 1
  FROM promise_outcome_sources pos
  WHERE pos.promise_outcome_id = po.id
    AND pos.source_id = s.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_source_import_batch_4;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_source_join_batch_4;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_action_source_join_batch_4;
DROP TEMPORARY TABLE IF EXISTS tmp_promise_outcome_source_join_batch_4;

COMMIT;
