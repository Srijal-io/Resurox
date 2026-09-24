import { ExplanationFeedback } from '../types/analysis';

export interface TemplateExplanationInput {
  lockedOverallScore: number;
  jobMatchScore: number;
  evidenceStrengthScore: number;
  matchedRequirements: string[];
  claimedOnlyRequirements: string[];
  missingRequirements: string[];
}

/**
 * Deterministic Template Explanation Fallback (D-14, A12, §15).
 * Generates factual explanation using only actual analysis facts and locked scores.
 */
export function generateTemplateExplanation(data: TemplateExplanationInput): ExplanationFeedback {
  const verdict = data.lockedOverallScore >= 80
    ? 'STRONG MATCH — REVIEW RECOMMENDED'
    : data.lockedOverallScore >= 60
    ? 'MODERATE MATCH — REVIEW GAPS'
    : 'LOW MATCH — SIGNIFICANT GAPS IDENTIFIED';

  const strengths = data.matchedRequirements.length > 0
    ? data.matchedRequirements.slice(0, 4).map((r) => `Demonstrated evidence supporting requirement: ${r}`)
    : ['Candidate profile submitted with preliminary qualifications'];

  const criticalGaps = data.missingRequirements.length > 0
    ? data.missingRequirements.slice(0, 4).map((r) => `Missing required qualification: ${r}`)
    : [];

  const areasToImprove = data.claimedOnlyRequirements.length > 0
    ? data.claimedOnlyRequirements.slice(0, 4).map((r) => `Skill listed without supporting experience/project evidence: ${r}`)
    : ['Quantify project metrics and specify concrete impact in previous roles'];

  const recommendations: string[] = [];
  if (data.claimedOnlyRequirements.length > 0) {
    recommendations.push(`Add concrete project descriptions detailing hands-on work with: ${data.claimedOnlyRequirements.slice(0, 3).join(', ')}`);
  }
  if (data.missingRequirements.length > 0) {
    recommendations.push(`Highlight any related exposure to key missing requirements: ${data.missingRequirements.slice(0, 2).join(', ')}`);
  }
  recommendations.push('Ensure achievements are quantified with measurable outcomes (e.g., % improvement, scale).');

  return {
    executiveSummary: `Candidate achieved an overall evaluation score of ${data.lockedOverallScore}% (Job Match: ${data.jobMatchScore}%, Evidence Strength: ${data.evidenceStrengthScore}%).`,
    strengths,
    criticalGaps,
    areasToImprove,
    recommendations,
    recruiterVerdict: verdict,
  };
}
