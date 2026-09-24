import test from 'node:test';
import assert from 'node:assert';
import { computeLexicalCosineSimilarity } from '../lib/scoring/semantic';
import { resolveCandidateEvidence } from '../lib/evidence/resolver';
import { matchRequirements } from '../lib/matching/requirements';
import { computeMultiDimensionalScores } from '../lib/scoring/rubric';
import { extractSkillsFromText, normalizeSkillName } from '../lib/normalization/skills';
import { JobRequirementModel } from '../lib/types/job';
import { CandidateProfile } from '../lib/types/resume';

test('SC-07 & SC-08: Anti-Gaming, Keyword-Stuffing & ReDoS Safety Tests', async (t) => {
  const baseJdText = 'Looking for a Senior TypeScript and React engineer with PostgreSQL experience.';

  await t.test('SC-08: Repeating a keyword 100x does not artificially inflate lexical score beyond cap', () => {
    const cleanResumeText = 'Senior Software Engineer with TypeScript, React, and PostgreSQL background.';
    // Adversarial resume repeating 'TypeScript' 100 times
    const stuffedResumeText = `Senior Software Engineer. ${Array(100).fill('TypeScript').join(' ')} PostgreSQL`;

    const cleanScore = computeLexicalCosineSimilarity(cleanResumeText, baseJdText);
    const stuffedScore = computeLexicalCosineSimilarity(stuffedResumeText, baseJdText);

    // Stuffed score must remain bounded and not dominate clean matching
    assert.ok(Number.isFinite(stuffedScore));
    assert.ok(stuffedScore <= 100);
    // Due to damping and vocabulary dilution, 100x stuffing does not exceed clean match by an abusive margin
    assert.ok(stuffedScore <= cleanScore + 10, `Stuffed score (${stuffedScore}) should not vastly exceed clean (${cleanScore})`);
  });

  await t.test('SC-08: A stuffed skills list without bullets scores lower than the same list with supporting bullets', () => {
    const jd: JobRequirementModel = {
      jobTitle: 'Fullstack Engineer',
      experienceRequiredYears: 3,
      educationRequired: "Bachelor's Degree",
      requiredSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      preferredSkills: ['Docker', 'AWS'],
      keywords: ['TypeScript', 'React'],
      requirements: [
        { id: 'req_1', text: 'TypeScript', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'TypeScript' },
        { id: 'req_2', text: 'React', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'React' },
        { id: 'req_3', text: 'Node.js', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Node.js' },
        { id: 'req_4', text: 'PostgreSQL', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'PostgreSQL' },
      ],
    };

    // Candidate A: Skills listed in skills section ONLY, zero experience bullets
    const candidateA_ClaimedOnly: CandidateProfile = {
      basics: { name: 'Claimed Only' },
      summary: '',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      totalExperienceYears: 3,
      education: [{ degree: "Bachelor's Degree" }],
      experience: [], // No bullets!
      projects: [],
    };

    // Candidate B: Same skills backed by actual work experience bullets
    const candidateB_Evidenced: CandidateProfile = {
      basics: { name: 'Evidenced' },
      summary: '',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      totalExperienceYears: 3,
      education: [{ degree: "Bachelor's Degree" }],
      experience: [
        {
          company: 'Acme Corp',
          title: 'Senior Developer',
          startDate: '2021',
          endDate: '2024',
          responsibilities: [
            'Built responsive web interfaces with TypeScript and React',
            'Developed high-throughput backend APIs with Node.js and PostgreSQL',
          ],
        },
      ],
      projects: [],
    };

    const evidenceA = resolveCandidateEvidence(candidateA_ClaimedOnly);
    const matchesA = matchRequirements(jd, evidenceA);
    const scoreA = computeMultiDimensionalScores(matchesA, evidenceA, 100, 90, 100);

    const evidenceB = resolveCandidateEvidence(candidateB_Evidenced);
    const matchesB = matchRequirements(jd, evidenceB);
    const scoreB = computeMultiDimensionalScores(matchesB, evidenceB, 100, 90, 100);

    // Stuffed skills list without bullets stays CLAIMED_ONLY and scores strictly lower than evidenced
    assert.strictEqual(matchesA.every(m => m.status === 'CLAIMED_ONLY'), true);
    assert.strictEqual(matchesB.every(m => m.status === 'MATCHED'), true);
    assert.ok(
      scoreB.scores.overallEvaluation > scoreA.scores.overallEvaluation,
      `Evidenced score (${scoreB.scores.overallEvaluation}) must beat claimed-only score (${scoreA.scores.overallEvaluation})`
    );
    assert.ok(scoreB.scores.overallEvaluation - scoreA.scores.overallEvaluation >= 15, 'Margin should be at least 15 points');
  });

  await t.test('SC-07: ReDoS resilience against 100k character adversarial input', () => {
    // Construct adversarial string with repeating patterns
    const adversarial100k = 'a'.repeat(100000) + ' TypeScript ' + 'b'.repeat(100000);
    const startTime = Date.now();

    const extracted = extractSkillsFromText(adversarial100k);
    const duration = Date.now() - startTime;

    assert.ok(extracted.includes('TypeScript'));
    assert.ok(duration < 500, `Execution took ${duration}ms, must be < 500ms (no catastrophic backtracking)`);
  });

  await t.test('SC-07: Array safety with 10,000 skills input', () => {
    const hugeSkillsArray = Array.from({ length: 10000 }, (_, i) => `Skill_${i}`);
    const candidate: CandidateProfile = {
      basics: { name: 'Stress Test' },
      summary: '',
      skills: hugeSkillsArray,
      totalExperienceYears: 2,
      education: [],
      experience: [],
      projects: [],
    };

    const startTime = Date.now();
    const evidence = resolveCandidateEvidence(candidate);
    const duration = Date.now() - startTime;

    assert.strictEqual(evidence.length, 10000);
    assert.ok(duration < 1000, `Massive array evidence resolution took ${duration}ms, must be < 1000ms`);
  });
});
