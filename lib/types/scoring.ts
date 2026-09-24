import { SkillMatchItem } from './matching';

export interface ScoreBreakdown {
  overallScore: number;
  matchLabel: 'Exceptional Match' | 'Strong Match' | 'Good Match' | 'Moderate Match' | 'Low Match';
  subScores: {
    skillsMatch: number;      // 0 - 100
    experienceMatch: number;  // 0 - 100
    educationMatch: number;   // 0 - 100
    semanticMatch: number;    // 0 - 100
  };
  applicability?: {
    skills: boolean;
    experience: boolean;
    education: boolean;
    semantic: boolean;
  };
  skillsMatrix: SkillMatchItem[];
}

export interface MultiDimensionalScores {
  overallEvaluation: number;
  jobMatchScore: number;
  evidenceStrengthScore: number;
  resumeQualityScore: number;
  atsCompatibilityScore: number;
  evidenceCoverage: number; // 0 to 1 (e.g. 0.82 = 82%)
  applicability?: {
    jobMatch: boolean;
    technicalCap: boolean;
    experience: boolean;
    evidence: boolean;
    education: boolean;
    resumeQuality: boolean;
    atsCompatibility: boolean;
  };
}
