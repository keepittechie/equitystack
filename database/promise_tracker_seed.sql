-- Demo seed data for Promise Tracker v1
-- This file assumes database/promise_tracker_migration.sql has already been applied.
-- It links promises to existing source rows without modifying the sources table itself.

USE black_policy_tracker;

START TRANSACTION;

INSERT IGNORE INTO `promises` (`id`,`president_id`,`title`,`slug`,`promise_text`,`promise_date`,`promise_type`,`campaign_or_official`,`topic`,`impacted_group`,`status`,`summary`,`notes`,`is_demo`) VALUES
(1,6,'Reduce the federal crack-powder sentencing disparity','obama-crack-sentencing-disparity','Barack Obama campaigned on reducing the federal crack and powder cocaine sentencing disparity, which had produced sharply unequal criminal penalties with disproportionate effects on Black communities.','2008-11-04','Campaign Promise','Campaign','Criminal Justice','Black communities affected by federal drug sentencing','Delivered','Tracked as delivered because the Fair Sentencing Act reduced the statutory disparity from 100-to-1 to 18-to-1, producing a clear legal change even though it did not eliminate the gap entirely.','Demo seed record for Promise Tracker v1. Included for testing and editorial review.',1),
(2,8,'Advance racial equity across federal agencies','biden-advance-racial-equity','Joseph R. Biden Jr. publicly committed to advancing racial equity across the federal government and directing agencies to review barriers affecting Black communities and other underserved groups.','2021-01-20','Official Promise','Official','Government Equity','Black communities and other underserved groups','Partial','Tracked as partial because the administration established a government-wide equity framework, but implementation depended on uneven agency follow-through and remained vulnerable to reversal.','Demo seed record for Promise Tracker v1. Included for testing and editorial review.',1),
(3,8,'Restore stronger federal voting-rights protections','biden-voting-rights-restoration','Joseph R. Biden Jr. pledged support for restoring and strengthening federal voting-rights protections after Shelby County v. Holder and later restrictions that disproportionately affected Black voters.','2021-07-30','Official Promise','Official','Voting Rights','Black voters and communities facing racially discriminatory election rules','Blocked','Tracked as blocked because major voting-rights legislation advanced in the House but did not clear the Senate, leaving the central federal promise unmet.','Demo seed record for Promise Tracker v1. Included for testing and editorial review.',1),
(4,7,'Deliver stronger anti-redlining and Black homeownership gains','trump-black-homeownership-anti-redlining','Donald J. Trump and campaign allies made public promises about improving economic outcomes for Black Americans, including rhetoric tied to housing and wealth-building, but no durable anti-redlining delivery framework followed.','2020-09-25','Campaign Promise','Campaign','Housing','Black homebuyers and homeowners','Failed','Tracked as failed because the public promise language was not matched by a durable fair-housing or anti-redlining policy framework, while key housing guardrails were weakened instead.','Demo seed record for Promise Tracker v1. Included for testing and editorial review.',1),
(5,8,'Increase federal policing accountability standards','biden-policing-accountability','Joseph R. Biden Jr. pledged stronger federal policing accountability standards after nationwide protests over racial injustice and police violence.','2021-03-01','Official Promise','Official','Policing','Black communities affected by police violence and over-policing','In Progress','Tracked as in progress because the administration backed reform efforts and took some executive and agency steps, but no durable federal legislative settlement was completed.','Demo seed record for Promise Tracker v1. Included for testing and editorial review.',1);

INSERT IGNORE INTO `promise_actions` (`id`,`promise_id`,`action_type`,`action_date`,`title`,`description`,`related_policy_id`,`related_explainer_id`) VALUES
(1,1,'Bill','2010-08-03','Fair Sentencing Act enacted','Congress enacted the Fair Sentencing Act, reducing the crack-to-powder cocaine sentencing disparity in federal law.',26,6),
(2,1,'Statement','2010-08-03','Administration frames the law as a concrete sentencing reform step','The White House and allied reform advocates treated enactment as a meaningful move toward reducing racially skewed sentencing outcomes.',NULL,NULL),
(3,2,'Executive Order','2021-01-20','Executive order on advancing racial equity signed','The administration issued an executive order directing agencies to assess whether federal programs created barriers for underserved communities.',27,4),
(4,2,'Agency Action','2021-06-25','Agencies begin equity assessment and implementation work','Departments and agencies began publishing equity-related assessments, implementation plans, and internal review processes.',NULL,NULL),
(5,3,'Bill','2021-08-17','House passes the John R. Lewis Voting Rights Advancement Act','The House advanced legislation intended to restore and modernize key Voting Rights Act protections after Shelby County v. Holder.',28,5),
(6,3,'Court-Related Action','2021-07-01','Brnovich narrows Section 2 protections','A Supreme Court ruling adopted a narrower interpretation of Section 2, increasing the difficulty of challenging restrictive voting rules.',55,5),
(7,4,'Public Reversal','2020-07-23','HUD terminates the 2015 AFFH rule','HUD terminated the 2015 Affirmatively Furthering Fair Housing rule, weakening a key fair-housing planning framework while Black homeownership gaps persisted.',125,2),
(8,5,'Bill','2021-03-03','George Floyd Justice in Policing Act advances in Congress','Congressional Democrats advanced a policing reform bill focused on accountability, misconduct standards, and federal reforms after the 2020 protests.',29,NULL),
(9,5,'Agency Action','2022-05-25','Federal agencies continue police accountability guidance and executive follow-through','The administration continued non-statutory policing and accountability work through agency guidance, executive branch coordination, and federal grant-related standards.',NULL,NULL);

INSERT IGNORE INTO `promise_outcomes` (`id`,`promise_id`,`outcome_summary`,`outcome_type`,`measurable_impact`,`impact_direction`,`black_community_impact_note`,`evidence_strength`,`status_override`) VALUES
(1,1,'Federal law reduced the crack-to-powder cocaine sentencing disparity from 100-to-1 to 18-to-1.','Legal Outcome','The measurable legal shift was the reduction of the disparity ratio, with downstream effects on sentencing exposure and later retroactive relief debates.','Positive','The reform directly addressed one of the best-documented federal sentencing disparities that had disproportionately harmed Black communities.','Strong',NULL),
(2,2,'The federal government created an equity review framework, but implementation remained uneven across agencies and over time.','Administrative Outcome','The promise produced executive guidance, review processes, and agency-level assessments rather than a single durable statutory change.','Mixed','The framework mattered for Black communities because it created a formal administrative basis for reviewing racial barriers, but it remained vulnerable to political reversal.','Moderate',NULL),
(3,3,'No federal voting-rights restoration law was enacted despite high-profile legislative pushes.','Voting Outcome','The House passed major legislation, but the Senate did not deliver enactment, leaving weakened federal protections in place.','Blocked','Black voters remained exposed to a post-Shelby legal environment without restored preclearance or comparable new statutory protections.','Strong','Blocked'),
(4,4,'No durable anti-redlining or Black homeownership enforcement framework matching the public promise was delivered.','Housing Outcome','The most concrete high-profile federal housing move in this lane was the rollback of the 2015 AFFH framework rather than a stronger fair-housing intervention.','Negative','The gap between rhetoric and delivery is especially important for Black households because housing discrimination, appraisal bias, and fair-housing enforcement remain central equity issues.','Moderate',NULL),
(5,5,'Federal policing reform remained active as a national policy priority, but Congress did not complete a durable statutory settlement.','Legislative Outcome','Negotiations, House passage, and executive branch actions kept the issue alive, but no final law reset the national accountability framework.','Mixed','For Black communities, the partial movement mattered because police violence and accountability remain central equity and civil-rights concerns.','Moderate','In Progress');

INSERT IGNORE INTO `promise_sources` (`id`,`promise_id`,`source_id`) VALUES
(1,1,160),
(2,2,19),
(3,3,20),
(4,4,271),
(5,5,21);

INSERT IGNORE INTO `promise_action_sources` (`id`,`promise_action_id`,`source_id`) VALUES
(1,1,18),
(2,3,19),
(3,5,20),
(4,6,44),
(5,7,271),
(6,8,21);

INSERT IGNORE INTO `promise_outcome_sources` (`id`,`promise_outcome_id`,`source_id`) VALUES
(1,1,161),
(2,2,19),
(3,3,44),
(4,4,271),
(5,5,21);

COMMIT;
