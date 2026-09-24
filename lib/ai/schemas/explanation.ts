import { z } from 'zod';

/**
 * Strict LLM Explanation Schema.
 * NON-NEGOTIABLE (A1 & A12): Contains NO numerical score fields.
 * Text must not invent scores out of bounds.
 */
export const LLMExplanationSchema = z.object({
  executiveSummary: z.string().max(2000).optional(),
  strengths: z.array(z.string().max(500)).max(20).default([]),
  criticalGaps: z.array(z.string().max(500)).max(20).optional().default([]),
  areasToImprove: z.array(z.string().max(500)).max(20).default([]),
  recommendations: z.array(z.string().max(500)).max(20).default([]),
  recruiterVerdict: z.string().max(300).optional(),
});

export type LLMExplanation = z.infer<typeof LLMExplanationSchema>;
