import { CandidateProfile } from '../types/resume';
import { JobRequirementModel } from '../types/job';
import { AnalysisResponse, AnalysisMeta, DegradedReason } from '../types/analysis';
import { extractTextFromFile } from '../extractor';
import { extractResume, extractJob, generateExplanation, GatewayContext } from '../ai/gateway';
import { groundSkillsAgainstText } from '../ai/grounding';
import { extractResumeHeuristically } from '../heuristic/resume';
import { extractJobHeuristically } from '../heuristic/job';
import { generateTemplateExplanation } from '../heuristic/explanation';
import { normalizeSkillName } from '../normalization/skills';
import { fetchGitHubPublicEvidence } from '../enrichment/github';
import { resolveCandidateEvidence } from '../evidence/resolver';
import { matchRequirements } from '../matching/requirements';
import { computeMultiDimensionalScores } from '../scoring/rubric';
import { computeScores } from '../scorer';
import { computeTextSimilarityScore } from '../ai';
import { calculateExperienceFromDates } from '../scoring/experience';
import { extractServerIdentifiers, minimizePiiForAiProvider } from '../security/redact';
import { calculateCallCostMicroDollars } from '../security/budget';
import { getServerConfig } from '../config';
import { PipelineError } from './errors';

export interface AnalysisPipelineOptions {
  file: File;
  jobDescriptionText: string;
  requestId?: string;
  signal?: AbortSignal;
  now?: Date;
  clientIpPrefix?: string;
}

export interface PipelineLogger {
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
}

const defaultLogger: PipelineLogger = {
  info: (msg, data) => console.log(JSON.stringify({ level: 'INFO', msg, ...data })),
  warn: (msg, data) => console.warn(JSON.stringify({ level: 'WARN', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ level: 'ERROR', msg, ...data })),
};

/**
 * Main Centralized Analysis Pipeline Orchestrator (PRD §2, §4, §6, §8).
 */
export async function runAnalysisPipeline(
  options: AnalysisPipelineOptions,
  logger: PipelineLogger = defaultLogger
): Promise<AnalysisResponse & { estimatedCostMicroDollars?: number }> {
  const startTime = Date.now();
  const now = options.now || new Date();
  const requestId = options.requestId || crypto.randomUUID();
  const config = getServerConfig();
  const deadline = Date.now() + config.PIPELINE_DEADLINE_MS;
  const degradedList: DegradedReason[] = [];

  const ctx: GatewayContext = {
    requestId,
    signal: options.signal,
    deadline,
    callCounter: { count: 0, maxCalls: 6 }, // Max total provider attempts across parallel stages (A6)
  };

  logger.info('Pipeline execution initiated', {
    requestId,
    hashedIpPrefix: options.clientIpPrefix,
    fileSizeBytes: options.file?.size,
  });

  // 1. Validate inputs
  if (!options.file || options.file.size === 0) {
    throw new PipelineError('DOCUMENT_EMPTY', 'Uploaded file is empty.');
  }
  if (options.file.size > config.MAX_RESUME_BYTES) {
    throw new PipelineError('DOCUMENT_TOO_LARGE', `File size exceeds ${config.MAX_RESUME_BYTES / (1024 * 1024)}MB maximum.`);
  }

  const rawJd = (options.jobDescriptionText || '').trim();
  if (!rawJd || rawJd.length < config.MIN_JD_CHARS) {
    throw new PipelineError('JOB_DESCRIPTION_INVALID', `Job description must be at least ${config.MIN_JD_CHARS} characters.`);
  }

  // A10: Reject over-cap text instead of silently truncating
  if (rawJd.length > config.MAX_JD_CHARS) {
    throw new PipelineError('JOB_DESCRIPTION_INVALID', `Job description exceeds maximum length of ${config.MAX_JD_CHARS.toLocaleString()} characters.`);
  }

  // 2. Extract Document Text under cancellation & timeout
  const tExtractStart = Date.now();
  let rawResumeText: string;
  try {
    rawResumeText = await extractTextFromFile(options.file, options.signal);
  } catch (extractErr: any) {
    const msg = extractErr?.message || '';
    if (msg.includes('aborted')) {
      throw new PipelineError('PIPELINE_TIMEOUT', 'Analysis request was cancelled by client.');
    }
    if (msg.includes('unsupported') || msg.includes('format') || msg.includes('Legacy') || msg.includes('corrupted') || msg.includes('Macro')) {
      throw new PipelineError('UNSUPPORTED_FILE', msg);
    }
    if (msg.includes('exceeds') || msg.includes('zip bomb')) {
      throw new PipelineError('DOCUMENT_TOO_LARGE', msg);
    }
    throw new PipelineError('TEXT_EXTRACTION_FAILED', msg || 'Could not extract sufficient text from uploaded document.');
  }
  const extractDurationMs = Date.now() - tExtractStart;

  if (!rawResumeText || rawResumeText.trim().length < config.MIN_RESUME_CHARS) {
    throw new PipelineError('TEXT_EXTRACTION_FAILED', 'Could not extract sufficient text from the uploaded document.');
  }
  if (rawResumeText.length > config.MAX_RESUME_CHARS) {
    throw new PipelineError('DOCUMENT_TOO_LARGE', `Extracted resume text exceeds limit of ${config.MAX_RESUME_CHARS.toLocaleString()} characters.`);
  }

  // Resume signal validation (FR-07)
  const lowerResume = rawResumeText.toLowerCase();
  const resumeSignals = ['experience', 'education', 'skills', 'projects', 'work', 'summary', 'university', 'college', 'engineer', 'developer', '@'];
  const matchedSignals = resumeSignals.filter((s) => lowerResume.includes(s));
  if (matchedSignals.length < 2) {
    throw new PipelineError('NOT_A_RESUME', 'The uploaded file does not contain sufficient resume sections.');
  }

  logger.info('Document text extracted successfully', { requestId, textLength: rawResumeText.length, durationMs: extractDurationMs });

  // SEC-11: Pre-extract identifiers before redacting PII
  const serverIdentifiers = extractServerIdentifiers(rawResumeText);
  const piiRedactedResumeText = minimizePiiForAiProvider(rawResumeText);

  // 3. Parallel AI Parsing (Resume || Job Description) with safe fallbacks (A3, A7)
  let candidateProfile: CandidateProfile;
  let jobRequirementModel: JobRequirementModel;
  let usedResumeHeuristic = false;
  let usedJobHeuristic = false;
  let groundingDropRate = 0.0;
  let totalCostMicroDollars = 0;

  const tParseStart = Date.now();

  const [resumeResult, jobResult] = await Promise.allSettled([
    extractResume(piiRedactedResumeText, ctx),
    extractJob(rawJd, ctx),
  ]);

  // If both stage extractions fail due to infrastructure/service busy or auth errors, throw PipelineError directly
  if (resumeResult.status === 'rejected' && jobResult.status === 'rejected') {
    const err1 = resumeResult.reason;
    const err2 = jobResult.reason;
    if (err1 instanceof PipelineError && (err1.code === 'SERVICE_BUSY' || err1.code === 'AI_AUTH_FAILED')) {
      throw err1;
    }
    if (err2 instanceof PipelineError && (err2.code === 'SERVICE_BUSY' || err2.code === 'AI_AUTH_FAILED')) {
      throw err2;
    }
  }

  // Handle Resume Extraction Result
  if (resumeResult.status === 'fulfilled') {
    const rawExtraction = resumeResult.value;
    
    // A9: Grounding check on extracted skills against original normalized text
    const grounding = groundSkillsAgainstText(rawExtraction.skills, rawResumeText);
    groundingDropRate = grounding.dropRate;

    if (!grounding.isGroundingValid) {
      logger.warn('Grounding drop rate exceeded 50%, falling back to heuristic resume extraction', {
        requestId,
        dropRate: grounding.dropRate,
      });
      candidateProfile = extractResumeHeuristically(rawResumeText, now);
      usedResumeHeuristic = true;
      degradedList.push('resume_extraction');
    } else {
      // SC-05: Re-calculate candidate experience years in TypeScript from date ranges
      const dateCalculation = calculateExperienceFromDates(
        (rawExtraction.experience || []).map(e => ({ startDate: e.startDate, endDate: e.endDate })),
        rawExtraction.totalExperienceYears ?? 0,
        now
      );

      candidateProfile = {
        basics: {
          ...rawExtraction.basics,
          github: serverIdentifiers.githubUsername || rawExtraction.basics?.github,
        },
        summary: rawExtraction.summary || '',
        currentTitle: rawExtraction.currentTitle || undefined,
        totalExperienceYears: dateCalculation.totalYears,
        skills: grounding.groundedSkills.map(normalizeSkillName),
        education: rawExtraction.education || [],
        experience: rawExtraction.experience || [],
        projects: rawExtraction.projects || [],
        certifications: rawExtraction.certifications || [],
        achievements: rawExtraction.achievements || [],
      };
    }
  } else {
    logger.warn('AI Resume Extraction failed, falling back to evidence-only heuristic parser', {
      requestId,
      error: resumeResult.reason instanceof Error ? resumeResult.reason.message : String(resumeResult.reason),
    });
    candidateProfile = extractResumeHeuristically(rawResumeText, now);
    if (serverIdentifiers.githubUsername && !candidateProfile.basics?.github) {
      candidateProfile.basics = { ...candidateProfile.basics, github: serverIdentifiers.githubUsername };
    }
    usedResumeHeuristic = true;
    degradedList.push('resume_extraction');
  }

  // Handle Job Extraction Result
  if (jobResult.status === 'fulfilled') {
    const rawJob = jobResult.value;
    const requirements = (rawJob.requirements || []).map((req, idx) => ({
      id: `req_${idx + 1}`,
      text: req.text,
      category: req.category,
      requirementType: req.requirementType,
      normalizedSkill: req.category === 'skill' ? normalizeSkillName(req.text) : undefined,
      criticality: req.requirementType === 'REQUIRED' ? 1.0 : req.requirementType === 'PREFERRED' ? 0.5 : 0.3,
      importance: 1.0,
      evidenceExpected: req.requirementType === 'REQUIRED' || req.requirementType === 'PREFERRED',
    }));

    jobRequirementModel = {
      jobTitle: rawJob.jobTitle || 'Target Role',
      seniorityLevel: rawJob.seniorityLevel,
      experienceRequiredYears: rawJob.experienceRequiredYears ?? 0,
      educationRequired: rawJob.educationRequired || 'Not Specified',
      requiredSkills: (rawJob.requiredSkills || []).map(normalizeSkillName),
      preferredSkills: (rawJob.preferredSkills || []).map(normalizeSkillName),
      keywords: rawJob.keywords || [],
      requirements,
    };
  } else {
    logger.warn('AI Job Extraction failed, falling back to heuristic job parser', {
      requestId,
      error: jobResult.reason instanceof Error ? jobResult.reason.message : String(jobResult.reason),
    });
    jobRequirementModel = extractJobHeuristically(rawJd);
    usedJobHeuristic = true;
    degradedList.push('job_extraction');
  }

  // SC-04: If requirement list is completely empty, throw controlled error
  if (!jobRequirementModel.requirements || jobRequirementModel.requirements.length === 0) {
    throw new PipelineError(
      'JOB_DESCRIPTION_INVALID',
      'Could not extract any recognizable technical requirements from the provided job description.'
    );
  }

  const parseDurationMs = Date.now() - tParseStart;
  logger.info('Candidate and Job parsing complete', { requestId, parseDurationMs, usedResumeHeuristic, usedJobHeuristic });

  // 4. Optional GitHub Evidence Enrichment (SEC-16)
  let githubRepos: Array<{ name: string; description?: string; languages?: string[] }> = [];
  const targetGithub = serverIdentifiers.githubUsername || candidateProfile.basics?.github;
  if (config.ENABLE_GITHUB_ENRICHMENT && targetGithub) {
    try {
      githubRepos = await fetchGitHubPublicEvidence(targetGithub);
      logger.info('GitHub evidence enriched', { requestId, repoCount: githubRepos.length });
    } catch (ghErr) {
      logger.warn('GitHub enrichment failed non-fatally', { requestId, error: ghErr instanceof Error ? ghErr.message : String(ghErr) });
      degradedList.push('github_enrichment');
    }
  }

  // 5. Evidence Collection & Requirement Matching (Pure Deterministic TypeScript)
  const tMatchStart = Date.now();
  const evidenceList = resolveCandidateEvidence(candidateProfile, githubRepos);
  const requirementMatches = matchRequirements(jobRequirementModel, evidenceList);
  const matchDurationMs = Date.now() - tMatchStart;

  // 6. Deterministic Multi-Dimensional Scoring
  const tScoreStart = Date.now();
  const semanticSimilarity = computeTextSimilarityScore(rawResumeText, rawJd);
  const legacyScores = computeScores(candidateProfile, jobRequirementModel, semanticSimilarity);

  const { scores: multiDimensionalScores } = computeMultiDimensionalScores(
    requirementMatches,
    evidenceList,
    legacyScores.subScores.skillsMatch,
    legacyScores.subScores.experienceMatch,
    legacyScores.subScores.educationMatch,
    undefined,
    {
      experience: legacyScores.applicability?.experience ?? true,
      education: legacyScores.applicability?.education ?? true,
    }
  );
  const scoreDurationMs = Date.now() - tScoreStart;

  const headlineScore = multiDimensionalScores.overallEvaluation;

  // 7. Qualitative Explanation Layer (Locked Scores in, with Template Fallback)
  const tExplainStart = Date.now();
  const matchedReqs = requirementMatches.filter((m) => m.status === 'MATCHED').map((m) => m.requirement.text);
  const claimedOnlyReqs = requirementMatches.filter((m) => m.status === 'CLAIMED_ONLY').map((m) => m.requirement.text);
  const missingReqs = requirementMatches.filter((m) => m.status === 'MISSING').map((m) => m.requirement.text);

  let explanationFeedback;
  if (config.AI_EXPLANATION_MODE === 'template') {
    // Fulfills Phase 4b §5: template explanation chosen by config, 0 LLM calls, NOT degraded
    explanationFeedback = generateTemplateExplanation({
      lockedOverallScore: headlineScore,
      jobMatchScore: multiDimensionalScores.jobMatchScore,
      evidenceStrengthScore: multiDimensionalScores.evidenceStrengthScore,
      matchedRequirements: matchedReqs,
      claimedOnlyRequirements: claimedOnlyReqs,
      missingRequirements: missingReqs,
    });
  } else {
    try {
      const aiExplanation = await generateExplanation(
        {
          lockedOverallScore: headlineScore,
          jobMatchScore: multiDimensionalScores.jobMatchScore,
          evidenceStrengthScore: multiDimensionalScores.evidenceStrengthScore,
          matchedRequirements: matchedReqs,
          claimedOnlyRequirements: claimedOnlyReqs,
          missingRequirements: missingReqs,
        },
        ctx
      );
      explanationFeedback = aiExplanation;
    } catch (explainErr) {
      logger.warn('AI Explanation generation failed, falling back to deterministic template explanation', {
        requestId,
        error: explainErr instanceof Error ? explainErr.message : String(explainErr),
      });
      explanationFeedback = generateTemplateExplanation({
        lockedOverallScore: headlineScore,
        jobMatchScore: multiDimensionalScores.jobMatchScore,
        evidenceStrengthScore: multiDimensionalScores.evidenceStrengthScore,
        matchedRequirements: matchedReqs,
        claimedOnlyRequirements: claimedOnlyReqs,
        missingRequirements: missingReqs,
      });
      degradedList.push('explanation');
    }
  }
  const explainDurationMs = Date.now() - tExplainStart;

  // 8. Confidence computation (A3)
  let confidence: AnalysisMeta['confidence'] = 'high';
  if (usedResumeHeuristic || usedJobHeuristic) {
    confidence = 'limited';
  } else if (groundingDropRate >= 0.20) {
    confidence = 'medium';
  }

  // Calculate realistic cost based on completed calls
  const primaryProviderModel = config.resolvedProviderOrder[0]?.models.resume || 'gemini-2.5-flash';
  totalCostMicroDollars = calculateCallCostMicroDollars(
    primaryProviderModel,
    Math.round((rawResumeText.length + rawJd.length) / 4),
    400
  );

  const totalPipelineMs = Date.now() - startTime;
  logger.info('Pipeline execution finished', {
    requestId,
    totalPipelineMs,
    extractDurationMs,
    parseDurationMs,
    matchDurationMs,
    scoreDurationMs,
    explainDurationMs,
    headlineScore,
    confidence,
    degraded: degradedList,
  });

  const response: AnalysisResponse = {
    resume: candidateProfile,
    jobDescription: jobRequirementModel,
    scores: legacyScores,
    multiDimensionalScores,
    requirementMatches,
    headlineScore,
    meta: {
      requestId,
      pipelineVersion: '4.0.0',
      confidence,
      degraded: degradedList,
    },
    explanation: explanationFeedback,
    rawText: {
      resumeSnippet: rawResumeText.substring(0, 300) + '...',
      jdSnippet: rawJd.substring(0, 300) + '...',
    },
  };

  return Object.assign(response, { estimatedCostMicroDollars: totalCostMicroDollars });
}
