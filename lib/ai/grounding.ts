import { normalizeSkillName } from '../normalization/skills';

/**
 * Escapes regex special characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a specific term or skill exists in the original source text using whole-token matching.
 * Handles tricky edge cases per A8:
 * - "Java" must NOT match "JavaScript"
 * - "C" must NOT match "C++" or "C#"
 * - "Go" and "R" must match whole isolated tokens and not substrings of "Google", "React", "Rails", etc.
 */
export function isTermGroundedInText(term: string, sourceText: string): boolean {
  if (!term || !sourceText) return false;

  const rawTerm = term.trim();
  if (rawTerm.length === 0) return false;

  const lowerSource = ` ${sourceText.toLowerCase()} `;
  const lowerTerm = rawTerm.toLowerCase();

  // 1. Language edge cases (A8)
  if (lowerTerm === 'c') {
    // Isolated single letter C, not C++ or C#
    const cRegex = /(?:^|[\s,;()/[\]{}'"`:–—])c(?=[\s,;()/[\]{}'"`:–—]|$)/i;
    return cRegex.test(lowerSource);
  }

  if (lowerTerm === 'c++' || lowerTerm === 'cpp') {
    const cppRegex = /(?:^|[\s,;()/[\]{}'"`:–—])(?:c\+\+|cpp)(?=[\s,;()/[\]{}'"`:–—]|$)/i;
    return cppRegex.test(lowerSource);
  }

  if (lowerTerm === 'c#' || lowerTerm === 'csharp') {
    const csRegex = /(?:^|[\s,;()/[\]{}'"`:–—])(?:c#|csharp)(?=[\s,;()/[\]{}'"`:–—]|$)/i;
    return csRegex.test(lowerSource);
  }

  if (lowerTerm === 'go' || lowerTerm === 'golang') {
    // Match "golang" or whole-word "go", but not "google", "good", "going", "django"
    if (/golang/i.test(lowerSource)) return true;
    const goRegex = /(?:^|[\s,;()/[\]{}'"`:–—])go(?=[\s,;()/[\]{}'"`:–—]|$)/i;
    return goRegex.test(lowerSource);
  }

  if (lowerTerm === 'r') {
    // Isolated letter R (statistical programming language)
    const rRegex = /(?:^|[\s,;()/[\]{}'"`:–—])r(?=[\s,;()/[\]{}'"`:–—]|$)/i;
    return rRegex.test(lowerSource);
  }

  if (lowerTerm === 'java') {
    // Whole token Java, specifically excluding JavaScript / Javascript.js
    const javaRegex = /(?:^|[\s,;()/[\]{}'"`:–—])java(?=[\s,;()/[\]{}'"`:–—]|$)/i;
    return javaRegex.test(lowerSource);
  }

  if (lowerTerm === 'javascript' || lowerTerm === 'js') {
    const jsRegex = /(?:^|[\s,;()/[\]{}'"`:–—])(?:javascript|js|ecmascript|es6)(?=[\s,;()/[\]{}'"`:–—]|$)/i;
    return jsRegex.test(lowerSource);
  }

  // 2. Exact word boundary match for general multi-character tokens
  const escaped = escapeRegex(lowerTerm);
  const boundaryRegex = new RegExp(`(?:^|[\\s,;()/[\\]{}'"\`:\u2013\u2014-])${escaped}(?=[\\s,;()/[\\]{}'"\`:\u2013\u2014-]|$)`, 'i');
  if (boundaryRegex.test(lowerSource)) {
    return true;
  }

  // 3. Fallback: check canonical aliases if canonicalized
  const canonical = normalizeSkillName(rawTerm);
  if (canonical && canonical.toLowerCase() !== lowerTerm) {
    const canonicalEscaped = escapeRegex(canonical.toLowerCase());
    const canonicalRegex = new RegExp(`(?:^|[\\s,;()/[\\]{}'"\`:\u2013\u2014-])${canonicalEscaped}(?=[\\s,;()/[\\]{}'"\`:\u2013\u2014-]|$)`, 'i');
    if (canonicalRegex.test(lowerSource)) {
      return true;
    }
  }

  return false;
}

export interface GroundingResult {
  groundedSkills: string[];
  droppedSkills: string[];
  totalChecked: number;
  dropRate: number; // 0.0 to 1.0
  isGroundingValid: boolean; // false if dropRate > 0.50
}

/**
 * Validates a list of skills against the original unnormalized resume text.
 * Filters out hallucinated skills.
 */
export function groundSkillsAgainstText(skills: string[], originalResumeText: string): GroundingResult {
  const groundedSkills: string[] = [];
  const droppedSkills: string[] = [];

  const uniqueSkills = Array.from(new Set(skills.map(s => s.trim()).filter(Boolean)));
  const totalChecked = uniqueSkills.length;

  if (totalChecked === 0) {
    return {
      groundedSkills: [],
      droppedSkills: [],
      totalChecked: 0,
      dropRate: 0,
      isGroundingValid: true,
    };
  }

  for (const skill of uniqueSkills) {
    if (isTermGroundedInText(skill, originalResumeText)) {
      groundedSkills.push(skill);
    } else {
      droppedSkills.push(skill);
    }
  }

  const dropRate = droppedSkills.length / totalChecked;
  // A3: If grounding drops >50% of items, treat extraction as invalid
  const isGroundingValid = dropRate <= 0.50;

  return {
    groundedSkills,
    droppedSkills,
    totalChecked,
    dropRate,
    isGroundingValid,
  };
}
