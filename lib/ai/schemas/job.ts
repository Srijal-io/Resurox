import { z } from 'zod';

export const RequirementTypeSchema = z.enum([
  'REQUIRED',
  'PREFERRED',
  'BONUS',
  'RESPONSIBILITY',
  'CONTEXT',
]);

export const RawJobRequirementSchema = z.object({
  text: z.string().min(1).max(500),
  category: z.enum(['skill', 'experience', 'education', 'certification', 'responsibility']).default('skill'),
  requirementType: RequirementTypeSchema.default('REQUIRED'),
});

/**
 * Strict LLM Extraction Schema for Job Description.
 * NON-NEGOTIABLE (A1): Contains NO score, confidence, or match fields.
 */
export const LLMJobExtractionSchema = z.object({
  jobTitle: z.string().max(200).default('Target Role'),
  seniorityLevel: z.string().max(100).optional(),
  experienceRequiredYears: z.number().min(0).max(40).optional(),
  educationRequired: z.string().max(150).optional(),
  requiredSkills: z.array(z.string().max(100)).max(150).default([]),
  preferredSkills: z.array(z.string().max(100)).max(150).default([]),
  keywords: z.array(z.string().max(100)).max(100).default([]),
  requirements: z.array(RawJobRequirementSchema).max(100).default([]),
});

export type LLMJobExtraction = z.infer<typeof LLMJobExtractionSchema>;
