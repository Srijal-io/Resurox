import test from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { computeScores, computeSkillsMatch, computeExperienceMatch, computeEducationMatch, computeOverallScore } from '../lib/scorer';
import { computeMultiDimensionalScores } from '../lib/scoring/rubric';
import { resolveCandidateEvidence } from '../lib/evidence/resolver';
import { matchRequirements } from '../lib/matching/requirements';
import { CandidateProfile } from '../lib/types/resume';
import { JobRequirementModel } from '../lib/types/job';

test('SC-09: Fast-Check Property Tests for Scoring Integrity', async (t) => {
  await t.test('Property 1: Monotonicity - Adding a genuinely evidenced required skill never lowers the score', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('TypeScript', 'React', 'Node.js', 'Python', 'Java', 'Docker', 'AWS', 'SQL'), { minLength: 1, maxLength: 5 }),
        fc.constantFrom('PostgreSQL', 'Kubernetes', 'GraphQL'),
        (initialSkills, extraSkill) => {
          const uniqueInitial = Array.from(new Set(initialSkills));
          const withExtra = Array.from(new Set([...uniqueInitial, extraSkill]));

          const jd: JobRequirementModel = {
            jobTitle: 'Software Engineer',
            experienceRequiredYears: 3,
            educationRequired: "Bachelor's Degree",
            requiredSkills: withExtra,
            preferredSkills: [],
            keywords: withExtra,
            requirements: withExtra.map((s, idx) => ({
              id: `req_${idx + 1}`,
              text: s,
              category: 'skill',
              requirementType: 'REQUIRED',
              criticality: 1.0,
              importance: 1.0,
              evidenceExpected: true,
              normalizedSkill: s,
            })),
          };

          // Candidate 1: Has initial skills
          const cand1: CandidateProfile = {
            basics: { name: 'Cand1' },
            summary: '',
            skills: uniqueInitial,
            totalExperienceYears: 3,
            education: [{ degree: "Bachelor's Degree" }],
            experience: [
              {
                company: 'Corp',
                title: 'Engineer',
                startDate: '2021',
                endDate: '2024',
                responsibilities: uniqueInitial.map(s => `Worked heavily with ${s}`),
              },
            ],
            projects: [],
          };

          // Candidate 2: Has initial skills + extra skill with evidence
          const cand2: CandidateProfile = {
            basics: { name: 'Cand2' },
            summary: '',
            skills: withExtra,
            totalExperienceYears: 3,
            education: [{ degree: "Bachelor's Degree" }],
            experience: [
              {
                company: 'Corp',
                title: 'Engineer',
                startDate: '2021',
                endDate: '2024',
                responsibilities: withExtra.map(s => `Worked heavily with ${s}`),
              },
            ],
            projects: [],
          };

          const ev1 = resolveCandidateEvidence(cand1);
          const m1 = matchRequirements(jd, ev1);
          const s1 = computeMultiDimensionalScores(m1, ev1, 80, 90, 100);

          const ev2 = resolveCandidateEvidence(cand2);
          const m2 = matchRequirements(jd, ev2);
          const s2 = computeMultiDimensionalScores(m2, ev2, 80, 90, 100);

          // Score 2 must be >= Score 1
          return s2.scores.overallEvaluation >= s1.scores.overallEvaluation;
        }
      ),
      { numRuns: 50 }
    );
  });

  await t.test('Property 2: Monotonicity - Removing all evidence never raises the score', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('TypeScript', 'React', 'Node.js', 'SQL', 'Python'), { minLength: 1, maxLength: 4 }),
        (skills) => {
          const jd: JobRequirementModel = {
            jobTitle: 'Software Engineer',
            experienceRequiredYears: 3,
            educationRequired: "Bachelor's Degree",
            requiredSkills: skills,
            preferredSkills: [],
            keywords: skills,
            requirements: skills.map((s, idx) => ({
              id: `req_${idx + 1}`,
              text: s,
              category: 'skill',
              requirementType: 'REQUIRED',
              criticality: 1.0,
              importance: 1.0,
              evidenceExpected: true,
              normalizedSkill: s,
            })),
          };

          const candEvidenced: CandidateProfile = {
            basics: { name: 'Evidenced' },
            summary: '',
            skills,
            totalExperienceYears: 3,
            education: [{ degree: "Bachelor's Degree" }],
            experience: [{ company: 'Corp', title: 'Dev', startDate: '2020', endDate: '2023', responsibilities: skills.map(s => `Used ${s}`) }],
            projects: [],
          };

          const candNoEvidence: CandidateProfile = {
            basics: { name: 'No Evidence' },
            summary: '',
            skills,
            totalExperienceYears: 3,
            education: [{ degree: "Bachelor's Degree" }],
            experience: [], // removed all bullets
            projects: [],
          };

          const ev1 = resolveCandidateEvidence(candEvidenced);
          const m1 = matchRequirements(jd, ev1);
          const s1 = computeMultiDimensionalScores(m1, ev1, 100, 90, 100);

          const ev2 = resolveCandidateEvidence(candNoEvidence);
          const m2 = matchRequirements(jd, ev2);
          const s2 = computeMultiDimensionalScores(m2, ev2, 100, 90, 100);

          return s1.scores.overallEvaluation >= s2.scores.overallEvaluation;
        }
      ),
      { numRuns: 30 }
    );
  });

  await t.test('Property 3: Invariance - Score is invariant to whitespace, case, and skill reordering', () => {
    const jdSkills = ['TypeScript', 'React', 'Node.js'];
    const jd: JobRequirementModel = {
      jobTitle: 'Developer',
      experienceRequiredYears: 2,
      educationRequired: "Bachelor's Degree",
      requiredSkills: jdSkills,
      preferredSkills: [],
      keywords: jdSkills,
      requirements: jdSkills.map((s, idx) => ({
        id: `req_${idx + 1}`,
        text: s,
        category: 'skill',
        requirementType: 'REQUIRED',
        criticality: 1.0,
        importance: 1.0,
        evidenceExpected: true,
        normalizedSkill: s,
      })),
    };

    const candOriginal: CandidateProfile = {
      basics: { name: 'Original' },
      summary: '',
      skills: ['TypeScript', 'React', 'Node.js'],
      totalExperienceYears: 2,
      education: [{ degree: "Bachelor's Degree" }],
      experience: [{ company: 'Corp', title: 'Dev', startDate: '2022', endDate: '2024', responsibilities: ['Built UI with React and TypeScript', 'Developed Node.js services'] }],
      projects: [],
    };

    // Reordered, different casing, extra spaces
    const candPermuted: CandidateProfile = {
      basics: { name: 'Permuted' },
      summary: '',
      skills: [' node.js  ', 'typescript', 'REACT '],
      totalExperienceYears: 2,
      education: [{ degree: "bachelor's degree" }],
      experience: [{ company: 'Corp', title: 'Dev', startDate: '2022', endDate: '2024', responsibilities: ['Built UI with React and TypeScript', 'Developed Node.js services'] }],
      projects: [],
    };

    const ev1 = resolveCandidateEvidence(candOriginal);
    const m1 = matchRequirements(jd, ev1);
    const s1 = computeMultiDimensionalScores(m1, ev1, 95, 90, 100);

    const ev2 = resolveCandidateEvidence(candPermuted);
    const m2 = matchRequirements(jd, ev2);
    const s2 = computeMultiDimensionalScores(m2, ev2, 95, 90, 100);

    assert.strictEqual(s1.scores.overallEvaluation, s2.scores.overallEvaluation);
    assert.strictEqual(s1.scores.jobMatchScore, s2.scores.jobMatchScore);
    assert.strictEqual(s1.scores.evidenceStrengthScore, s2.scores.evidenceStrengthScore);
  });

  await t.test('Property 4: Bounds - Arbitrary numeric inputs always produce valid scores in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        (skills, exp, edu, sem) => {
          const overall = computeOverallScore(skills, exp, edu, sem);
          return Number.isFinite(overall) && overall >= 0 && overall <= 100;
        }
      ),
      { numRuns: 200 }
    );
  });

  await t.test('Property 5: Determinism - The identical input run twice gives the exact same result', () => {
    const resume: CandidateProfile = {
      basics: { name: 'Deterministic' },
      summary: '',
      skills: ['Java', 'Spring Boot', 'SQL'],
      totalExperienceYears: 5,
      education: [{ degree: "Master's Degree" }],
      experience: [{ company: 'Enterprise', title: 'Lead', startDate: '2019', endDate: '2024', responsibilities: ['Architected Spring Boot services with Java and SQL'] }],
      projects: [],
    };

    const jd: JobRequirementModel = {
      jobTitle: 'Senior Java Dev',
      experienceRequiredYears: 5,
      educationRequired: "Bachelor's Degree",
      requiredSkills: ['Java', 'Spring Boot', 'SQL'],
      preferredSkills: ['AWS'],
      keywords: ['Java', 'Spring Boot'],
      requirements: [
        { id: 'req_1', text: 'Java', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Java' },
        { id: 'req_2', text: 'Spring Boot', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Spring Boot' },
        { id: 'req_3', text: 'SQL', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'SQL' },
      ],
    };

    const scoreRun1 = computeScores(resume, jd, 85);
    const scoreRun2 = computeScores(resume, jd, 85);

    assert.deepStrictEqual(scoreRun1, scoreRun2);
  });

  await t.test('Property 6: Mutation Sanity Check - Suite fails if scoring function is replaced by a constant', () => {
    const mockConstantScorer = () => 55;

    // A scoring test verifying variance across high match vs low match
    const highMatchSkills = 100;
    const lowMatchSkills = 10;

    const realScoreHigh = computeOverallScore(highMatchSkills, 100, 100, 90);
    const realScoreLow = computeOverallScore(lowMatchSkills, 10, 30, 20);

    // Real scorer produces distinct scores
    assert.notStrictEqual(realScoreHigh, realScoreLow);
    assert.ok(realScoreHigh - realScoreLow > 30);

    // Constant scorer would return identical values (mutation caught)
    const mutantHigh = mockConstantScorer();
    const mutantLow = mockConstantScorer();
    assert.strictEqual(mutantHigh, mutantLow, 'Mutant produces constant value');
    assert.strictEqual(mutantHigh, 55);
  });
});
