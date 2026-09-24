import test from 'node:test';
import assert from 'node:assert';
import { resolveCandidateEvidence } from '../lib/evidence/resolver';
import { matchRequirements } from '../lib/matching/requirements';
import { computeMultiDimensionalScores } from '../lib/scoring/rubric';
import { computeScores } from '../lib/scorer';
import { computeLexicalCosineSimilarity } from '../lib/scoring/semantic';
import { CandidateProfile } from '../lib/types/resume';
import { JobRequirementModel } from '../lib/types/job';

// 10 Synthetic Fixtures (no real personal data)
const FIXTURES = {
  softwareEngineer: {
    resume: {
      basics: { name: 'Alex Rivera' },
      summary: 'Senior Software Engineer with 6 years building cloud native web systems.',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
      totalExperienceYears: 6,
      education: [{ degree: "Bachelor's Degree", fieldOfStudy: 'Computer Science' }],
      experience: [
        {
          company: 'TechFlow',
          title: 'Senior Software Engineer',
          startDate: '2020',
          endDate: '2026',
          responsibilities: [
            'Architected microservices using Node.js and TypeScript on AWS',
            'Built responsive web interfaces with React and PostgreSQL databases',
            'Containerized deployments with Docker and CI/CD pipelines',
          ],
        },
      ],
      projects: [{ name: 'CloudScale', technologies: ['TypeScript', 'Docker', 'AWS'] }],
    } as CandidateProfile,
    jd: {
      jobTitle: 'Senior Full Stack Engineer',
      experienceRequiredYears: 5,
      educationRequired: "Bachelor's Degree",
      requiredSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      preferredSkills: ['Docker', 'AWS'],
      keywords: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS'],
      requirements: [
        { id: 'req_1', text: 'TypeScript', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'TypeScript' },
        { id: 'req_2', text: 'React', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'React' },
        { id: 'req_3', text: 'Node.js', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Node.js' },
        { id: 'req_4', text: 'PostgreSQL', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'PostgreSQL' },
        { id: 'req_5', text: 'AWS', category: 'skill', requirementType: 'PREFERRED', criticality: 0.5, importance: 0.5, evidenceExpected: true, normalizedSkill: 'AWS' },
      ],
    } as JobRequirementModel,
  },

  productManager: {
    resume: {
      basics: { name: 'Jordan Taylor' },
      summary: 'Product Manager with 5 years driving agile product roadmaps.',
      skills: ['Product Roadmap', 'Agile', 'Jira', 'User Research', 'Data Analysis'],
      totalExperienceYears: 5,
      education: [{ degree: 'Master of Business Administration (MBA)' }],
      experience: [
        {
          company: 'InnoTech',
          title: 'Product Manager',
          startDate: '2021',
          endDate: '2026',
          responsibilities: [
            'Led cross-functional teams in Agile sprints and quarterly Product Roadmap planning',
            'Conducted quantitative User Research and Data Analysis to optimize conversion',
          ],
        },
      ],
      projects: [],
    } as CandidateProfile,
    jd: {
      jobTitle: 'Senior Product Manager',
      experienceRequiredYears: 4,
      educationRequired: "Bachelor's Degree",
      requiredSkills: ['Product Roadmap', 'Agile', 'User Research'],
      preferredSkills: ['Data Analysis', 'Jira'],
      keywords: ['Product Roadmap', 'Agile', 'User Research'],
      requirements: [
        { id: 'req_1', text: 'Product Roadmap', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Product Roadmap' },
        { id: 'req_2', text: 'Agile', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Agile' },
        { id: 'req_3', text: 'User Research', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'User Research' },
      ],
    } as JobRequirementModel,
  },

  cybersecurity: {
    resume: {
      basics: { name: 'Casey Morgan' },
      summary: 'Cybersecurity Analyst specializing in SIEM, Incident Response, and penetration testing.',
      skills: ['SIEM', 'Incident Response', 'Wireshark', 'Python', 'Linux'],
      totalExperienceYears: 4,
      education: [{ degree: "Bachelor's Degree" }],
      experience: [
        {
          company: 'SecureNet',
          title: 'Security Operations Analyst',
          startDate: '2022',
          endDate: '2026',
          responsibilities: [
            'Monitored SIEM alerts and executed rapid Incident Response triage',
            'Analyzed packet captures in Wireshark and automated threat scanning with Python and Linux',
          ],
        },
      ],
      projects: [],
    } as CandidateProfile,
    jd: {
      jobTitle: 'Cybersecurity Analyst',
      experienceRequiredYears: 3,
      educationRequired: "Bachelor's Degree",
      requiredSkills: ['SIEM', 'Incident Response', 'Linux'],
      preferredSkills: ['Wireshark', 'Python'],
      keywords: ['SIEM', 'Incident Response', 'Linux'],
      requirements: [
        { id: 'req_1', text: 'SIEM', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'SIEM' },
        { id: 'req_2', text: 'Incident Response', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Incident Response' },
        { id: 'req_3', text: 'Linux', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Linux' },
      ],
    } as JobRequirementModel,
  },

  dataAnalyst: {
    resume: {
      basics: { name: 'Riley Chen' },
      summary: 'Data Analyst skilled in SQL, Tableau, Python, and PowerBI.',
      skills: ['SQL', 'Python', 'Tableau', 'PowerBI', 'Pandas'],
      totalExperienceYears: 3,
      education: [{ degree: "Bachelor's Degree", fieldOfStudy: 'Statistics' }],
      experience: [
        {
          company: 'DataCorp',
          title: 'Data Analyst',
          startDate: '2023',
          endDate: '2026',
          responsibilities: [
            'Wrote complex SQL queries and built executive dashboards in Tableau',
            'Performed data cleaning and pipeline transformation using Python and Pandas',
          ],
        },
      ],
      projects: [],
    } as CandidateProfile,
    jd: {
      jobTitle: 'Data Analyst',
      experienceRequiredYears: 2,
      educationRequired: "Bachelor's Degree",
      requiredSkills: ['SQL', 'Python', 'Tableau'],
      preferredSkills: ['Pandas'],
      keywords: ['SQL', 'Python', 'Tableau'],
      requirements: [
        { id: 'req_1', text: 'SQL', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'SQL' },
        { id: 'req_2', text: 'Python', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Python' },
        { id: 'req_3', text: 'Tableau', category: 'skill', requirementType: 'REQUIRED', criticality: 1.0, importance: 1.0, evidenceExpected: true, normalizedSkill: 'Tableau' },
      ],
    } as JobRequirementModel,
  },

  freshGraduate: {
    resume: {
      basics: { name: 'Sam Green' },
      summary: 'Recent Computer Science graduate with coursework in Java and SQL.',
      skills: ['Java', 'SQL', 'Git'],
      totalExperienceYears: 0,
      education: [{ degree: "Bachelor's Degree", fieldOfStudy: 'Computer Science' }],
      experience: [],
      projects: [{ name: 'University Portal', technologies: ['Java', 'SQL'] }],
    } as CandidateProfile,
  },

  experiencedCandidate: {
    resume: {
      basics: { name: 'Dana Vance' },
      summary: 'Principal Engineer with 12+ years of distributed systems architecture.',
      skills: ['Go', 'Kubernetes', 'Docker', 'Microservices', 'PostgreSQL', 'AWS'],
      totalExperienceYears: 12,
      education: [{ degree: "Master's Degree" }],
      experience: [
        {
          company: 'HyperScale',
          title: 'Principal Architect',
          startDate: '2014',
          endDate: '2026',
          responsibilities: [
            'Engineered Go microservices orchestrating across Kubernetes clusters',
            'Managed petabyte PostgreSQL clusters in AWS cloud infrastructure',
          ],
        },
      ],
      projects: [],
    } as CandidateProfile,
  },

  noProjectsResume: {
    resume: {
      basics: { name: 'Morgan Lee' },
      summary: 'Backend Engineer with 4 years enterprise experience.',
      skills: ['Java', 'Spring Boot', 'SQL'],
      totalExperienceYears: 4,
      education: [{ degree: "Bachelor's Degree" }],
      experience: [
        {
          company: 'FinBank',
          title: 'Software Developer',
          startDate: '2022',
          endDate: '2026',
          responsibilities: ['Developed Java Spring Boot payment services with SQL storage.'],
        },
      ],
      projects: [], // No projects
    } as CandidateProfile,
  },

  skillsWithoutEvidence: {
    resume: {
      basics: { name: 'Stuffed Skills' },
      summary: '',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Kubernetes', 'AWS', 'Python', 'Java'],
      totalExperienceYears: 1,
      education: [{ degree: "Bachelor's Degree" }],
      experience: [], // No bullet evidence whatsoever!
      projects: [],
    } as CandidateProfile,
  },

  emptyOrScanned: {
    resume: {
      basics: {},
      summary: '',
      skills: [],
      totalExperienceYears: 0,
      education: [],
      experience: [],
      projects: [],
    } as CandidateProfile,
  },

  nonResumeDocument: {
    resume: {
      basics: {},
      summary: 'Chocolate Chip Cookie Recipe. Ingredients: Flour, Sugar, Butter, Chocolate chips.',
      skills: [],
      totalExperienceYears: 0,
      education: [],
      experience: [],
      projects: [],
    } as CandidateProfile,
  },
};

test('TST-06 & SC-10: Synthetic Regression Fixtures and Score Differentiation', async (t) => {
  function scorePair(cand: CandidateProfile, jd: JobRequirementModel) {
    const evidence = resolveCandidateEvidence(cand);
    const matches = matchRequirements(jd, evidence);
    const legacy = computeScores(cand, jd, 75);
    const rubric = computeMultiDimensionalScores(
      matches,
      evidence,
      legacy.subScores.skillsMatch,
      legacy.subScores.experienceMatch,
      legacy.subScores.educationMatch,
      undefined,
      {
        experience: legacy.applicability?.experience ?? true,
        education: legacy.applicability?.education ?? true,
      }
    );
    return {
      headlineScore: rubric.scores.overallEvaluation,
      jobMatchScore: rubric.scores.jobMatchScore,
      matches,
    };
  }

  await t.test('SC-10: Materially different inputs produce materially different scores', () => {
    // Strongly matching pair: Software Engineer candidate with Software Engineer JD
    const strongPair = scorePair(FIXTURES.softwareEngineer.resume, FIXTURES.softwareEngineer.jd);

    // Mismatched pair: Product Manager candidate with Software Engineer JD
    const mismatchedPair = scorePair(FIXTURES.productManager.resume, FIXTURES.softwareEngineer.jd);

    // Empty/Non-resume candidate with Software Engineer JD
    const emptyPair = scorePair(FIXTURES.emptyOrScanned.resume, FIXTURES.softwareEngineer.jd);

    assert.ok(
      strongPair.headlineScore > mismatchedPair.headlineScore + 30,
      `Strong pair score (${strongPair.headlineScore}) must exceed mismatched (${mismatchedPair.headlineScore}) by > 30 pts`
    );

    assert.ok(
      mismatchedPair.headlineScore > emptyPair.headlineScore,
      `Mismatched pair (${mismatchedPair.headlineScore}) must score above empty (${emptyPair.headlineScore})`
    );
  });

  await t.test('SC-10: Identical scores across different fixtures fail the suite', () => {
    const sweScore = scorePair(FIXTURES.softwareEngineer.resume, FIXTURES.softwareEngineer.jd).headlineScore;
    const pmScore = scorePair(FIXTURES.productManager.resume, FIXTURES.productManager.jd).headlineScore;
    const cyberScore = scorePair(FIXTURES.cybersecurity.resume, FIXTURES.cybersecurity.jd).headlineScore;
    const dataScore = scorePair(FIXTURES.dataAnalyst.resume, FIXTURES.dataAnalyst.jd).headlineScore;
    const skillsOnlyScore = scorePair(FIXTURES.skillsWithoutEvidence.resume, FIXTURES.softwareEngineer.jd).headlineScore;
    const emptyScore = scorePair(FIXTURES.emptyOrScanned.resume, FIXTURES.softwareEngineer.jd).headlineScore;

    const scores = [sweScore, pmScore, cyberScore, dataScore, skillsOnlyScore, emptyScore];
    const uniqueScores = new Set(scores);

    // All distinct fixture pairs must not collapse to a single uniform constant
    assert.ok(uniqueScores.size >= 4, `Expected distinct score distributions across fixtures, got: ${scores.join(', ')}`);
  });

  await t.test('TST-06: Human-expected requirement statuses on each fixture', () => {
    // 1. SWE match -> all MATCHED
    const sweMatches = scorePair(FIXTURES.softwareEngineer.resume, FIXTURES.softwareEngineer.jd).matches;
    assert.strictEqual(sweMatches.filter(m => m.status === 'MATCHED').length, 5);

    // 2. Skills without evidence -> all CLAIMED_ONLY
    const claimedMatches = scorePair(FIXTURES.skillsWithoutEvidence.resume, FIXTURES.softwareEngineer.jd).matches;
    assert.strictEqual(claimedMatches.filter(m => m.status === 'CLAIMED_ONLY').length >= 4, true);

    // 3. Empty resume -> all MISSING
    const emptyMatches = scorePair(FIXTURES.emptyOrScanned.resume, FIXTURES.softwareEngineer.jd).matches;
    assert.strictEqual(emptyMatches.every(m => m.status === 'MISSING'), true);
  });

  await t.test('SC-06: Extraction perturbation stability test (variance <= ±3 points)', () => {
    const baseCand = FIXTURES.softwareEngineer.resume;
    const jd = FIXTURES.softwareEngineer.jd;

    const baseResult = scorePair(baseCand, jd);
    const baseScore = baseResult.headlineScore;

    // Perturbation A: Reordered skills list
    const candReordered: CandidateProfile = {
      ...baseCand,
      skills: ['AWS', 'PostgreSQL', 'Docker', 'React', 'Node.js', 'TypeScript'],
    };
    const scoreReordered = scorePair(candReordered, jd).headlineScore;
    assert.ok(
      Math.abs(scoreReordered - baseScore) <= 3,
      `Reordering variance ${Math.abs(scoreReordered - baseScore)} must be <= 3`
    );

    // Perturbation B: Synonym swap ('js' for 'JavaScript' / 'ts' for 'TypeScript')
    const candSynonyms: CandidateProfile = {
      ...baseCand,
      skills: ['ts', 'React.js', 'NodeJS', 'Postgres', 'Docker', 'AWS'],
    };
    const scoreSynonyms = scorePair(candSynonyms, jd).headlineScore;
    assert.ok(
      Math.abs(scoreSynonyms - baseScore) <= 3,
      `Synonym swap variance ${Math.abs(scoreSynonyms - baseScore)} must be <= 3`
    );

    // Perturbation C: Extra whitespace
    const candWhitespace: CandidateProfile = {
      ...baseCand,
      skills: [' TypeScript  ', '  React  ', ' Node.js ', ' PostgreSQL ', ' Docker ', ' AWS '],
    };
    const scoreWhitespace = scorePair(candWhitespace, jd).headlineScore;
    assert.strictEqual(scoreWhitespace, baseScore, 'Whitespace variations must produce exact identical score');
  });
});
