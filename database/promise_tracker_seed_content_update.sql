-- Content-only update for Promise Tracker demo seed records.
-- Updates the existing demo promise rows with ids 1-5 in the `promises` table.
-- This file does not modify schema, slugs, ids, or non-demo records.

USE black_policy_tracker;

START TRANSACTION;

UPDATE `promises`
SET
  `title` = 'Reduce the federal crack-powder sentencing disparity',
  `promise_text` = 'Barack Obama campaigned on reducing the federal crack and powder cocaine sentencing disparity, which had produced sharply unequal criminal penalties with disproportionate effects on Black communities.',
  `summary` = 'Tracked as delivered because the Fair Sentencing Act reduced the statutory disparity from 100-to-1 to 18-to-1, producing a clear legal change even though it did not eliminate the gap entirely.',
  `notes` = 'Demo seed record for Promise Tracker v1. Included for testing and editorial review.'
WHERE `id` = 1
  AND `slug` = 'obama-crack-sentencing-disparity'
  AND `is_demo` = 1;

UPDATE `promises`
SET
  `title` = 'Advance racial equity across federal agencies',
  `promise_text` = 'Joseph R. Biden Jr. publicly committed to advancing racial equity across the federal government and directing agencies to review barriers affecting Black communities and other underserved groups.',
  `summary` = 'Tracked as partial because the administration established a government-wide equity framework, but implementation depended on uneven agency follow-through and remained vulnerable to reversal.',
  `notes` = 'Demo seed record for Promise Tracker v1. Included for testing and editorial review.'
WHERE `id` = 2
  AND `slug` = 'biden-advance-racial-equity'
  AND `is_demo` = 1;

UPDATE `promises`
SET
  `title` = 'Restore stronger federal voting-rights protections',
  `promise_text` = 'Joseph R. Biden Jr. pledged support for restoring and strengthening federal voting-rights protections after Shelby County v. Holder and later restrictions that disproportionately affected Black voters.',
  `summary` = 'Tracked as blocked because major voting-rights legislation advanced in the House but did not clear the Senate, leaving the central federal promise unmet.',
  `notes` = 'Demo seed record for Promise Tracker v1. Included for testing and editorial review.'
WHERE `id` = 3
  AND `slug` = 'biden-voting-rights-restoration'
  AND `is_demo` = 1;

UPDATE `promises`
SET
  `title` = 'Deliver stronger anti-redlining and Black homeownership gains',
  `promise_text` = 'Donald J. Trump and campaign allies made public promises about improving economic outcomes for Black Americans, including rhetoric tied to housing and wealth-building, but no durable anti-redlining delivery framework followed.',
  `summary` = 'Tracked as failed because the public promise language was not matched by a durable fair-housing or anti-redlining policy framework, while key housing guardrails were weakened instead.',
  `notes` = 'Demo seed record for Promise Tracker v1. Included for testing and editorial review.'
WHERE `id` = 4
  AND `slug` = 'trump-black-homeownership-anti-redlining'
  AND `is_demo` = 1;

UPDATE `promises`
SET
  `title` = 'Increase federal policing accountability standards',
  `promise_text` = 'Joseph R. Biden Jr. pledged stronger federal policing accountability standards after nationwide protests over racial injustice and police violence.',
  `summary` = 'Tracked as in progress because the administration backed reform efforts and took some executive and agency steps, but no durable federal legislative settlement was completed.',
  `notes` = 'Demo seed record for Promise Tracker v1. Included for testing and editorial review.'
WHERE `id` = 5
  AND `slug` = 'biden-policing-accountability'
  AND `is_demo` = 1;

COMMIT;
