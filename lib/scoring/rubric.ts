import { RequirementMatch } from '../types/matching';
import { SkillClaimEvidence } from '../types/evidence';
import { MultiDimensionalScores } from '../types/scoring';
import { finalMultiDimensionalScoresSchema } from './schema';

export interface RubricConfig {
  jobMatchWeight: number;      // 0.30
  technicalCapWeight: number;  // 0.20
  experienceWeight: number;    // 0.15
  evidenceWeight: number;      // 0.10
  educationWeight: number;     // 0.05
  resumeQualityWeight: number; // 0.10
  atsCompatibilityWeight: number; // 0.10
}

export const DEFAULT_RUBRIC_CONFIG: RubricConfig = {
  jobMatchWeight: 0.30,
  technicalCapWeight: 0.20,
  experienceWeight: 0.15,
  evidenceWeight: 0.10,
  educationWeight: 0.05,
  resumeQualityWeight: 0.10,
  atsCompatibilityWeight: 0.10,
};

export interface RubricApplicability {
  jobMatch?: boolean;
  technicalCap?: boolean;
  experience?: boolean;
  evidence?: boolean;
  education?: boolean;
  resumeQuality?: boolean;
  atsCompatibility?: boolean;
}

/**
 * Pure Multi-Dimensional Rubric Scorer (SC-01, SC-02, SC-03, SC-04).
 * Single authoritative owner of `headlineScore` (`overallEvaluation`).
 */
export function computeMultiDimensionalScores(
  requirementMatches: RequirementMatch[] = [],
  evidenceList: SkillClaimEvidence[] = [],
  skillsMatchScore: number = 0,
  experienceMatchScore: number = 0,
  educationMatchScore: number = 0,
  rubric: RubricConfig = DEFAULT_RUBRIC_CONFIG,
  applicability: RubricApplicability = {}
): { scores: MultiDimensionalScores; evidenceCoverage: number } {
  // 1. Calculate Requirement Match Score
  const totalReqs = requirementMatches.length;
  let jobMatchScore = 0;
  if (totalReqs > 0) {
    const matchedWeightedScore = requirementMatches.reduce((acc, m) => {
      const score = Number.isFinite(m.matchScore) ? m.matchScore : 0;
      const crit = Number.isFinite(m.requirement?.criticality) ? m.requirement.criticality : 1.0;
      return acc + (score * crit);
    }, 0);
    const maxPossibleReqScore = requirementMatches.reduce((acc, m) => {
      const crit = Number.isFinite(m.requirement?.criticality) ? m.requirement.criticality : 1.0;
      return acc + (100 * crit);
    }, 0) || 1;
    jobMatchScore = Math.max(0, Math.min(100, Math.round((matchedWeightedScore / maxPossibleReqScore) * 100)));
  } else {
    // If no explicit requirements (heuristic/edge), use computed skillsMatchScore
    jobMatchScore = Math.max(0, Math.min(100, Math.round(Number.isFinite(skillsMatchScore) ? skillsMatchScore : 0)));
  }

  // 2. Calculate Evidence Strength Score
  const totalClaims = evidenceList.length;
  let evidenceStrengthScore = 0;
  if (totalClaims > 0) {
    const totalEvidenceStrengthSum = evidenceList.reduce((acc, e) => {
      const str = Number.isFinite(e.overallStrength) ? e.overallStrength : 0;
      return acc + str;
    }, 0);
    evidenceStrengthScore = Math.max(0, Math.min(100, Math.round((totalEvidenceStrengthSum / totalClaims) * 100)));
  } else {
    evidenceStrengthScore = 0;
  }

  // 3. Calculate Evidence Coverage (0.0 to 1.0)
  const supportedReqs = requirementMatches.filter(m => m.status === 'MATCHED').length;
  const rawCoverage = totalReqs > 0 ? supportedReqs / totalReqs : 0;
  const evidenceCoverage = Math.max(0, Math.min(1, Math.round(rawCoverage * 100) / 100));

  // 4. Resume Quality & ATS Compatibility Scores
  const safeSkills = Math.max(0, Math.min(100, Number.isFinite(skillsMatchScore) ? skillsMatchScore : 0));
  const safeExp = Math.max(0, Math.min(100, Number.isFinite(experienceMatchScore) ? experienceMatchScore : 0));
  const safeEdu = Math.max(0, Math.min(100, Number.isFinite(educationMatchScore) ? educationMatchScore : 0));

  const resumeQualityScore = Math.max(0, Math.min(100, Math.round(safeSkills * 0.5 + evidenceStrengthScore * 0.5)));
  const atsCompatibilityScore = Math.max(0, Math.min(100, Math.round(jobMatchScore * 0.6 + safeSkills * 0.4)));

  // 5. Proportional Re-weighting based on Applicability (SC-04)
  const appMap = {
    jobMatch: applicability.jobMatch ?? true,
    technicalCap: applicability.technicalCap ?? true,
    experience: applicability.experience ?? true,
    evidence: applicability.evidence ?? true,
    education: applicability.education ?? true,
    resumeQuality: applicability.resumeQuality ?? true,
    atsCompatibility: applicability.atsCompatibility ?? true,
  };

  const rawWeights = {
    jobMatch: appMap.jobMatch ? rubric.jobMatchWeight : 0,
    technicalCap: appMap.technicalCap ? rubric.technicalCapWeight : 0,
    experience: appMap.experience ? rubric.experienceWeight : 0,
    evidence: appMap.evidence ? rubric.evidenceWeight : 0,
    education: appMap.education ? rubric.educationWeight : 0,
    resumeQuality: appMap.resumeQuality ? rubric.resumeQualityWeight : 0,
    atsCompatibility: appMap.atsCompatibility ? rubric.atsCompatibilityWeight : 0,
  };

  const totalWeight = Object.values(rawWeights).reduce((sum, w) => sum + w, 0);
  const normalizedWeights = totalWeight > 0
    ? {
        jobMatch: rawWeights.jobMatch / totalWeight,
        technicalCap: rawWeights.technicalCap / totalWeight,
        experience: rawWeights.experience / totalWeight,
        evidence: rawWeights.evidence / totalWeight,
        education: rawWeights.education / totalWeight,
        resumeQuality: rawWeights.resumeQuality / totalWeight,
        atsCompatibility: rawWeights.atsCompatibility / totalWeight,
      }
    : {
        jobMatch: 0,
        technicalCap: 0,
        experience: 0,
        evidence: 0,
        education: 0,
        resumeQuality: 0,
        atsCompatibility: 0,
      };

  // 6. Deterministic Headline Overall Evaluation Score
  const rawEvaluation =
    jobMatchScore * normalizedWeights.jobMatch +
    safeSkills * normalizedWeights.technicalCap +
    safeExp * normalizedWeights.experience +
    evidenceStrengthScore * normalizedWeights.evidence +
    safeEdu * normalizedWeights.education +
    resumeQualityScore * normalizedWeights.resumeQuality +
    atsCompatibilityScore * normalizedWeights.atsCompatibility;

  const overallEvaluation = Math.max(0, Math.min(100, Math.round(rawEvaluation)));

  const finalScores: MultiDimensionalScores = {
    overallEvaluation,
    jobMatchScore,
    evidenceStrengthScore,
    resumeQualityScore,
    atsCompatibilityScore,
    evidenceCoverage,
    applicability: appMap,
  };

  // Validate output against Zod schema (SC-03)
  const validated = finalMultiDimensionalScoresSchema.parse(finalScores);

  return {
    scores: validated,
    evidenceCoverage,
  };
}
