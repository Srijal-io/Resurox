import { CandidateProfile } from '../types/resume';
import { extractResumeHeuristically } from '../heuristic/resume';

export { extractResumeHeuristically as parseResumeHeuristically };

/**
 * Backward compatible parser delegating to safe heuristic extraction.
 * Canonical extraction in the pipeline goes through lib/ai/gateway.ts.
 */
export async function parseResume(resumeText: string): Promise<CandidateProfile> {
  return extractResumeHeuristically(resumeText);
}
