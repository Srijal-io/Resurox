/**
 * PII Minimization & Text Normalization (SEC-09, SEC-11, PRD §6).
 * 
 * Rules:
 * - Server extracts social/developer handles (GitHub, LinkedIn) first.
 * - Redacts emails, phone numbers, and physical street addresses from the LLM prompt payload.
 * - Leaves version numbers (e.g. 3.10.2, 14.2.1), date ranges (2019–2021), and quantitative metrics ("10,000 users", "$2.5M") intact.
 * - Strips zero-width/bidi override characters and collapses excessive whitespace.
 */

export interface PreExtractionIdentifiers {
  githubUsername?: string;
  linkedinUsername?: string;
}

export function extractServerIdentifiers(text: string): PreExtractionIdentifiers {
  if (!text) return {};

  const ghMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))(?=[\s/,)\]]|$)/i);
  const liMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9_-]+)(?=[\s/,)\]]|$)/i);

  return {
    githubUsername: ghMatch ? ghMatch[1] : undefined,
    linkedinUsername: liMatch ? liMatch[1] : undefined,
  };
}

/**
 * Normalizes text to strip invisible control / bidi / zero-width characters (SEC-09).
 */
export function normalizeExtractedText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Strip zero-width spaces, BOM, and directionality overrides
    .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '')
    // Strip non-printable ASCII control characters (keep \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize newlines
    .replace(/\r\n/g, '\n')
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    // Collapse horizontal whitespace runs
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

/**
 * Redacts PII from text before passing to third-party AI providers (SEC-11).
 */
export function minimizePiiForAiProvider(text: string): string {
  if (!text) return '';

  let sanitized = normalizeExtractedText(text);

  // 1. Redact Emails: e.g. alex.rivera@example.com
  sanitized = sanitized.replace(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    '[EMAIL_REDACTED]'
  );

  // 2. Redact Phone Numbers: e.g. +1 (555) 234-5678, (555) 234-5678, 555-234-5678
  // Guarded to prevent matching version numbers (e.g. 3.14.15) or metrics ($10,000)
  sanitized = sanitized.replace(
    /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})\b/g,
    (match) => {
      // Ignore if match appears to be a version number like "1.2.3456" or date "2020-2024"
      if (/^\d{4}\s*-\s*\d{4}$/.test(match.trim())) return match;
      if (/^\d+\.\d+\.\d+/.test(match.trim())) return match;
      return '[PHONE_REDACTED]';
    }
  );

  // 3. Redact common street address patterns: e.g. "123 Main Street, Apt 4B"
  sanitized = sanitized.replace(
    /\b\d{1,5}\s+[A-Za-z0-9.\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b(?:,\s*(?:Suite|Ste|Apt|Unit)\s*[A-Za-z0-9-]+)?/gi,
    '[ADDRESS_REDACTED]'
  );

  return sanitized;
}
