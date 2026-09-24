import { JobRequirementModel, JobRequirement } from '../types/job';
import { extractSkillsFromText, normalizeSkillName } from '../normalization/skills';
import { PipelineError } from '../pipeline/errors';

/**
 * Deterministic Heuristic Job Parser (D-08, A7).
 * Extracts requirements purely from skills dictionary and years regex.
 * If zero requirements result, throws error rather than fabricating fake jobs.
 */
export function extractJobHeuristically(jdText: string): JobRequirementModel {
  const text = jdText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let jobTitle = 'Target Role';
  for (const line of lines.slice(0, 4)) {
    if (line.length > 3 && line.length < 80 && !line.toLowerCase().startsWith('http')) {
      jobTitle = line.replace(/^(?:job\s*title|position|role)[:\s-]+/i, '').trim();
      break;
    }
  }

  const expMatch = text.match(/(\d+)\+?\s*(?:to\s*\d+\s*)?years?(?:\s*of)?\s*(?:experience|work)/i);
  const experienceRequiredYears = expMatch ? parseInt(expMatch[1], 10) : 0;

  let educationRequired = 'Not Specified';
  if (/bachelor|b\.s|b\.e|b\.tech|undergraduate/i.test(text)) {
    educationRequired = "Bachelor's Degree";
  } else if (/master|m\.s|m\.tech|graduate/i.test(text)) {
    educationRequired = "Master's Degree";
  } else if (/ph\.d|doctorate/i.test(text)) {
    educationRequired = 'Ph.D.';
  }

  const allSkills = extractSkillsFromText(text);

  // A7: If zero requirements result, fail explicitly; never score against an empty list.
  if (allSkills.length === 0) {
    throw new PipelineError(
      'JOB_DESCRIPTION_INVALID',
      'Could not extract any recognizable technical requirements from the provided job description. Please paste a more detailed job posting.'
    );
  }

  const reqSkills: string[] = [];
  const prefSkills: string[] = [];

  allSkills.forEach((skill, idx) => {
    const skillRegex = new RegExp(`(?:preferred|plus|bonus|nice to have)[^.\\n]*${skill}`, 'i');
    if (skillRegex.test(text) || idx >= Math.max(3, Math.ceil(allSkills.length * 0.7))) {
      prefSkills.push(skill);
    } else {
      reqSkills.push(skill);
    }
  });

  const requirements: JobRequirement[] = [];

  reqSkills.forEach((s, idx) => {
    requirements.push({
      id: `req_${idx + 1}`,
      text: s,
      category: 'skill',
      requirementType: 'REQUIRED',
      normalizedSkill: normalizeSkillName(s),
      criticality: 1.0,
      importance: 1.0,
      evidenceExpected: true,
    });
  });

  prefSkills.forEach((s, idx) => {
    requirements.push({
      id: `pref_${idx + 1}`,
      text: s,
      category: 'skill',
      requirementType: 'PREFERRED',
      normalizedSkill: normalizeSkillName(s),
      criticality: 0.5,
      importance: 0.5,
      evidenceExpected: true,
    });
  });

  return {
    jobTitle,
    seniorityLevel: experienceRequiredYears >= 5 ? 'Senior' : experienceRequiredYears >= 2 ? 'Mid-Level' : 'Junior',
    experienceRequiredYears,
    educationRequired,
    requiredSkills: reqSkills.map(normalizeSkillName),
    preferredSkills: prefSkills.map(normalizeSkillName),
    keywords: allSkills.slice(0, 10),
    requirements,
  };
}
