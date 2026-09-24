import { z } from 'zod';

export const RawResumeBasicsSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().max(120).optional(),
  phone: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
  linkedin: z.string().max(200).optional(),
  github: z.string().max(200).optional(),
  portfolio: z.string().max(200).optional(),
}).passthrough();

export const RawResumeEducationSchema = z.object({
  degree: z.string().max(150),
  institution: z.string().max(150).optional(),
  year: z.string().max(50).optional(),
  fieldOfStudy: z.string().max(150).optional(),
});

export const RawResumeExperienceSchema = z.object({
  company: z.string().max(150),
  title: z.string().max(150),
  startDate: z.string().max(50).optional(),
  endDate: z.string().max(50).optional(),
  years: z.number().min(0).max(60).optional(),
  responsibilities: z.array(z.string().max(1000)).max(30).optional(),
  achievements: z.array(z.string().max(1000)).max(30).optional(),
  technologies: z.array(z.string().max(100)).max(50).optional(),
});

export const RawResumeProjectSchema = z.object({
  name: z.string().max(150),
  description: z.string().max(2000).optional(),
  technologies: z.array(z.string().max(100)).max(50).optional(),
  githubUrl: z.string().max(200).optional(),
  liveUrl: z.string().max(200).optional(),
  highlights: z.array(z.string().max(1000)).max(20).optional(),
});

/**
 * Strict LLM Extraction Schema for Resume.
 * NON-NEGOTIABLE (A1): Contains NO score, confidence, or ATS fields.
 */
export const LLMResumeExtractionSchema = z.object({
  basics: RawResumeBasicsSchema.default({}),
  summary: z.string().max(3000).optional().default(''),
  currentTitle: z.string().max(150).optional().default(''),
  totalExperienceYears: z.number().min(0).max(60).optional(),
  skills: z.array(z.string().max(100)).max(200).default([]),
  education: z.array(RawResumeEducationSchema).max(20).default([]),
  experience: z.array(RawResumeExperienceSchema).max(30).default([]),
  projects: z.array(RawResumeProjectSchema).max(30).optional().default([]),
  certifications: z.array(z.string().max(200)).max(50).optional().default([]),
  achievements: z.array(z.string().max(500)).max(50).optional().default([]),
});

export type LLMResumeExtraction = z.infer<typeof LLMResumeExtractionSchema>;
