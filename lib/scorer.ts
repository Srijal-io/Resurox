import { ResumeData, JobDescriptionData, ScoreBreakdown, SkillMatchItem } from './types';
import { finalScoreResultSchema } from './scoring/schema';

function normalizeSkill(skill: string): string {
  return (skill || '')
    .toLowerCase()
    .trim()
    .replace(/[\.\-_]/g, '')
    .replace(/js$/, '')
    .replace(/javascript$/, 'js')
    .replace(/typescript$/, 'ts')
    .replace(/reactjs$/, 'react')
    .replace(/nextjs$/, 'next')
    .replace(/nodejs$/, 'node')
    .replace(/vuejs$/, 'vue');
}

export function computeSkillsMatch(
  resumeSkills: string[] = [],
  jdRequiredSkills: string[] = [],
  jdPreferredSkills: string[] = []
): { score: number; matrix: SkillMatchItem[] } {
  const safeResumeSkills = Array.isArray(resumeSkills) ? resumeSkills : [];
  const safeJdRequired = Array.isArray(jdRequiredSkills) ? jdRequiredSkills : [];
  const safeJdPreferred = Array.isArray(jdPreferredSkills) ? jdPreferredSkills : [];

  if (!safeJdRequired.length && !safeJdPreferred.length) {
    return { score: 70, matrix: [] };
  }

  const normalizedResumeSkills = safeResumeSkills.map((s) => normalizeSkill(s || ''));
  const rawResumeTextSkills = safeResumeSkills.map((s) => (s || '').toLowerCase());

  const matrix: SkillMatchItem[] = [];
  let reqMatchedCount = 0;
  let reqPartialCount = 0;

  for (const reqSkill of safeJdRequired) {
    if (!reqSkill) continue;
    const normReq = normalizeSkill(reqSkill);
    const lowReq = reqSkill.toLowerCase();

    const isExact = normalizedResumeSkills.some((rs) => rs === normReq);
    if (isExact) {
      reqMatchedCount++;
      matrix.push({ skill: reqSkill, status: 'matched', reason: 'Found exact skill match' });
      continue;
    }

    const isPartial = rawResumeTextSkills.some((rs) => rs.includes(lowReq) || lowReq.includes(rs));
    if (isPartial) {
      reqPartialCount++;
      matrix.push({ skill: reqSkill, status: 'partial', reason: 'Found related/partial skill mention' });
      continue;
    }

    matrix.push({ skill: reqSkill, status: 'missing', reason: 'Skill not found in resume' });
  }

  let prefMatchedCount = 0;
  for (const prefSkill of safeJdPreferred) {
    if (!prefSkill) continue;
    const normPref = normalizeSkill(prefSkill);
    if (normalizedResumeSkills.some((rs) => rs === normPref)) {
      prefMatchedCount++;
      matrix.push({ skill: `${prefSkill} (Preferred)`, status: 'matched', reason: 'Preferred skill matched' });
    }
  }

  const totalReq = safeJdRequired.length || 1;
  const baseReqScore = ((reqMatchedCount * 1.0 + reqPartialCount * 0.5) / totalReq) * 100;
  const prefBonus = Math.min(15, prefMatchedCount * 5);

  const finalScore = Math.max(0, Math.min(100, Math.round(baseReqScore + prefBonus)));
  return { score: finalScore, matrix };
}

export function computeExperienceMatch(
  resumeYears: number = 0,
  requiredYears: number = 0
): { score: number; applicable: boolean } {
  const safeResumeYears = typeof resumeYears === 'number' && Number.isFinite(resumeYears) ? Math.max(0, resumeYears) : 0;
  const safeReqYears = typeof requiredYears === 'number' && Number.isFinite(requiredYears) ? Math.max(0, requiredYears) : 0;

  // SC-04: If required years is 0 or unspecified, experience is not applicable (neither rewards nor penalizes)
  if (safeReqYears <= 0) {
    return { score: 100, applicable: false };
  }

  if (safeResumeYears >= safeReqYears) {
    const extraYears = safeResumeYears - safeReqYears;
    const score = Math.min(100, 90 + extraYears * 2);
    return { score, applicable: true };
  }

  const ratio = safeResumeYears / safeReqYears;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 85)));
  return { score, applicable: true };
}

function degreeLevel(deg: string = ''): number {
  const d = (deg || '').toLowerCase();
  if (d.includes('phd') || d.includes('doctorate')) return 4;
  if (d.includes('master') || d.includes('ms') || d.includes('mba') || d.includes('m.s')) return 3;
  if (d.includes('bachelor') || d.includes('bs') || d.includes('ba') || d.includes('b.s') || d.includes('b.a') || d.includes('degree')) return 2;
  if (d.includes('associate') || d.includes('diploma')) return 1;
  return 0;
}

export function computeEducationMatch(
  resumeEdu: Array<{ degree: string }> = [],
  requiredEduStr: string = ''
): { score: number; applicable: boolean } {
  const safeEdu = Array.isArray(resumeEdu) ? resumeEdu : [];
  const reqStr = (requiredEduStr || '').trim().toLowerCase();

  // SC-04: If education requirement is absent/none/any/unspecified, education is not applicable
  if (!reqStr || reqStr === 'not specified' || reqStr.includes('any') || reqStr.includes('none')) {
    return { score: 100, applicable: false };
  }

  const reqLevel = degreeLevel(reqStr);
  if (reqLevel === 0) {
    // Unrecognized or generic degree text (e.g. "degree in related field")
    return { score: 90, applicable: true };
  }

  const highestResumeLevel = safeEdu.reduce((max, ed) => Math.max(max, degreeLevel(ed?.degree || '')), 0);

  if (highestResumeLevel >= reqLevel) return { score: 100, applicable: true };
  if (highestResumeLevel === reqLevel - 1) return { score: 75, applicable: true };
  if (highestResumeLevel > 0) return { score: 50, applicable: true };
  return { score: 30, applicable: true };
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (!Number.isFinite(denominator) || denominator === 0) return 0;
  const similarity = dotProduct / denominator;
  // Map normalized similarity [-1, 1] to [0, 100]
  return Math.max(0, Math.min(100, Math.round(((similarity + 1) / 2) * 100)));
}

/**
 * Computes classic 4-part overall score with proportional re-weighting when components are not applicable (SC-04).
 * Base weights (when all applicable): Skills: 0.40, Experience: 0.25, Education: 0.15, Semantic: 0.20
 */
export function computeOverallScore(
  skills: number,
  experience: number,
  education: number,
  semantic: number,
  applicability: { skills?: boolean; experience?: boolean; education?: boolean; semantic?: boolean } = {}
): number {
  const appSkills = applicability.skills ?? true;
  const appExp = applicability.experience ?? true;
  const appEdu = applicability.education ?? true;
  const appSem = applicability.semantic ?? true;

  const baseWeights = {
    skills: appSkills ? 0.40 : 0,
    experience: appExp ? 0.25 : 0,
    education: appEdu ? 0.15 : 0,
    semantic: appSem ? 0.20 : 0,
  };

  const totalApplicableWeight = baseWeights.skills + baseWeights.experience + baseWeights.education + baseWeights.semantic;

  if (totalApplicableWeight <= 0) {
    return 0;
  }

  // Proportional re-weighting
  const finalSkillsWeight = baseWeights.skills / totalApplicableWeight;
  const finalExpWeight = baseWeights.experience / totalApplicableWeight;
  const finalEduWeight = baseWeights.education / totalApplicableWeight;
  const finalSemWeight = baseWeights.semantic / totalApplicableWeight;

  const rawScore =
    skills * finalSkillsWeight +
    experience * finalExpWeight +
    education * finalEduWeight +
    semantic * finalSemWeight;

  const clamped = Math.max(0, Math.min(100, Math.round(rawScore)));
  return Number.isFinite(clamped) ? clamped : 0;
}

export function computeScores(
  resume: ResumeData,
  jd: JobDescriptionData,
  semanticSimScore: number
): ScoreBreakdown {
  const { score: skillsScore, matrix } = computeSkillsMatch(
    resume.skills,
    jd.requiredSkills,
    jd.preferredSkills
  );

  const expResult = computeExperienceMatch(
    resume.totalExperienceYears,
    jd.experienceRequiredYears
  );

  const eduResult = computeEducationMatch(
    resume.education,
    jd.educationRequired
  );

  const applicability = {
    skills: true,
    experience: expResult.applicable,
    education: eduResult.applicable,
    semantic: true,
  };

  const overallScore = computeOverallScore(
    skillsScore,
    expResult.score,
    eduResult.score,
    semanticSimScore,
    applicability
  );

  let matchLabel: ScoreBreakdown['matchLabel'] = 'Low Match';
  if (overallScore >= 85) matchLabel = 'Exceptional Match';
  else if (overallScore >= 75) matchLabel = 'Strong Match';
  else if (overallScore >= 60) matchLabel = 'Good Match';
  else if (overallScore >= 45) matchLabel = 'Moderate Match';

  const rawResult: ScoreBreakdown = {
    overallScore,
    matchLabel,
    subScores: {
      skillsMatch: skillsScore,
      experienceMatch: expResult.score,
      educationMatch: eduResult.score,
      semanticMatch: semanticSimScore,
    },
    applicability,
    skillsMatrix: matrix,
  };

  // Validate output through strict Zod schema (SC-03)
  return finalScoreResultSchema.parse(rawResult);
}
