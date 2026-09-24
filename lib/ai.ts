import { ResumeData, JobDescriptionData, ExplanationFeedback, ScoreBreakdown } from './types';
import { extractResumeHeuristically } from './heuristic/resume';
import { extractJobHeuristically } from './heuristic/job';
import { generateTemplateExplanation } from './heuristic/explanation';
import { computeLexicalCosineSimilarity } from './scoring/semantic';

export async function parseResumeWithLLM(resumeText: string): Promise<ResumeData> {
  return extractResumeHeuristically(resumeText);
}

export async function parseJobDescriptionWithLLM(jdText: string): Promise<JobDescriptionData> {
  return extractJobHeuristically(jdText);
}

/**
 * Computes semantic similarity score using pure lexical term-frequency cosine similarity (SC-08).
 * Note: Lexical cosine similarity with anti-gaming saturation cap; no external embeddings.
 */
export function computeTextSimilarityScore(textA: string, textB: string): number {
  return computeLexicalCosineSimilarity(textA, textB);
}

export async function generateExplanationLayer(
  _resume: ResumeData,
  _jd: JobDescriptionData,
  scores: ScoreBreakdown
): Promise<ExplanationFeedback> {
  const matchedSkills = scores.skillsMatrix.filter((s) => s.status === 'matched').map((s) => s.skill);
  const missingSkills = scores.skillsMatrix.filter((s) => s.status === 'missing').map((s) => s.skill);

  return generateTemplateExplanation({
    lockedOverallScore: scores.overallScore,
    jobMatchScore: scores.subScores.skillsMatch,
    evidenceStrengthScore: scores.subScores.experienceMatch,
    matchedRequirements: matchedSkills,
    claimedOnlyRequirements: [],
    missingRequirements: missingSkills,
  });
}
