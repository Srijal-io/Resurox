import { z } from 'zod';

const finiteClampedScoreSchema = z
  .number()
  .refine((val) => Number.isFinite(val), { message: 'Score must be a finite number' })
  .refine((val) => !Number.isNaN(val), { message: 'Score cannot be NaN' })
  .refine((val) => val >= 0 && val <= 100, { message: 'Score must be between 0 and 100' });

export const finalScoreResultSchema = z.object({
  overallScore: finiteClampedScoreSchema,
  matchLabel: z.enum(['Exceptional Match', 'Strong Match', 'Good Match', 'Moderate Match', 'Low Match']),
  subScores: z.object({
    skillsMatch: finiteClampedScoreSchema,
    experienceMatch: finiteClampedScoreSchema,
    educationMatch: finiteClampedScoreSchema,
    semanticMatch: finiteClampedScoreSchema,
  }),
  applicability: z
    .object({
      skills: z.boolean(),
      experience: z.boolean(),
      education: z.boolean(),
      semantic: z.boolean(),
    })
    .optional(),
  skillsMatrix: z.array(
    z.object({
      skill: z.string(),
      status: z.enum(['matched', 'partial', 'missing']),
      reason: z.string().optional(),
    })
  ),
});

export const finalMultiDimensionalScoresSchema = z.object({
  overallEvaluation: finiteClampedScoreSchema,
  jobMatchScore: finiteClampedScoreSchema,
  evidenceStrengthScore: finiteClampedScoreSchema,
  resumeQualityScore: finiteClampedScoreSchema,
  atsCompatibilityScore: finiteClampedScoreSchema,
  evidenceCoverage: z
    .number()
    .refine((val) => Number.isFinite(val) && val >= 0 && val <= 1, {
      message: 'Evidence coverage must be between 0.0 and 1.0',
    }),
  applicability: z
    .object({
      jobMatch: z.boolean(),
      technicalCap: z.boolean(),
      experience: z.boolean(),
      evidence: z.boolean(),
      education: z.boolean(),
      resumeQuality: z.boolean(),
      atsCompatibility: z.boolean(),
    })
    .optional(),
});
