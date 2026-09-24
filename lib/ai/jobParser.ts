import { JobRequirementModel } from '../types/job';
import { extractJobHeuristically } from '../heuristic/job';

export { extractJobHeuristically as parseJobDescriptionHeuristically };

/**
 * Backward compatible parser delegating to safe heuristic extraction.
 * Canonical extraction in the pipeline goes through lib/ai/gateway.ts.
 */
export async function parseJobDescription(jdText: string): Promise<JobRequirementModel> {
  return extractJobHeuristically(jdText);
}
