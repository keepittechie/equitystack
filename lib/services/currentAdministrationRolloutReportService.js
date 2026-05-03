import { fetchCurrentAdministrationRolloutParityReport } from "@/lib/services/promiseService";
import { findLatestCurrentAdminReportByPrefix } from "@/lib/currentAdmin/reportArtifacts";

export async function getCurrentAdministrationRolloutReports() {
  const [parity, readiness, scoringReview, eligibilityReview] = await Promise.all([
    fetchCurrentAdministrationRolloutParityReport(),
    findLatestCurrentAdminReportByPrefix("current-admin-governing-action-readiness."),
    findLatestCurrentAdminReportByPrefix("current-admin-governing-action-scoring-review."),
    findLatestCurrentAdminReportByPrefix("current-admin-governing-action-eligibility."),
  ]);

  return {
    parity_report: parity || null,
    readiness_report: readiness || null,
    scoring_review_report: scoringReview || null,
    eligibility_review_report: eligibilityReview || null,
  };
}
