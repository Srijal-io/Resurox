import { CandidateProfile } from '../types/resume';
import { SkillClaimEvidence } from '../types/evidence';
import { normalizeSkillName } from '../normalization/skills';

export function resolveCandidateEvidence(
  candidate: CandidateProfile,
  githubRepos?: Array<{ name: string; description?: string; languages?: string[] }>
): SkillClaimEvidence[] {
  const claimMap: Map<string, SkillClaimEvidence> = new Map();

  const getOrCreateClaim = (skillName: string): SkillClaimEvidence => {
    const norm = normalizeSkillName(skillName);
    if (!claimMap.has(norm)) {
      claimMap.set(norm, {
        skill: skillName,
        normalizedSkill: norm,
        status: 'CLAIMED',
        evidenceItems: [],
        overallStrength: 0.3,
      });
    }
    return claimMap.get(norm)!;
  };

  // 1. Skills listed in skills section -> CLAIMED (strength: 0.3)
  for (const skill of candidate.skills || []) {
    const claim = getOrCreateClaim(skill);
    claim.evidenceItems.push({
      id: `ev_sec_${claim.evidenceItems.length + 1}`,
      claimId: claim.normalizedSkill,
      source: 'RESUME',
      sourceType: 'skills_section',
      text: `Listed in skills section: ${skill}`,
      strength: 0.3,
      confidence: 0.95,
    });
  }

  // 2. Experience responsibilities & achievements -> SUPPORTED (strength: 0.8)
  for (const exp of candidate.experience || []) {
    const fullExpText = [
      exp.title,
      ...(exp.responsibilities || []),
      ...(exp.achievements || []),
      ...(exp.technologies || []),
    ].join(' ');

    for (const [norm, claim] of claimMap.entries()) {
      if (fullExpText.toLowerCase().includes(norm.toLowerCase()) || fullExpText.toLowerCase().includes(claim.skill.toLowerCase())) {
        claim.status = 'SUPPORTED';
        claim.overallStrength = Math.max(claim.overallStrength, 0.8);
        claim.evidenceItems.push({
          id: `ev_exp_${claim.evidenceItems.length + 1}`,
          claimId: norm,
          source: 'RESUME',
          sourceType: 'experience',
          text: `Demonstrated at ${exp.company} as ${exp.title}`,
          strength: 0.8,
          confidence: 0.9,
        });
      }
    }
  }

  // 3. Projects -> SUPPORTED / STRONGLY_SUPPORTED (strength: 0.85)
  for (const proj of candidate.projects || []) {
    const projText = [proj.name, proj.description || '', ...(proj.technologies || [])].join(' ');

    for (const [norm, claim] of claimMap.entries()) {
      if (projText.toLowerCase().includes(norm.toLowerCase()) || projText.toLowerCase().includes(claim.skill.toLowerCase())) {
        if (claim.status === 'SUPPORTED') {
          claim.status = 'STRONGLY_SUPPORTED';
          claim.overallStrength = 0.95;
        } else {
          claim.status = 'SUPPORTED';
          claim.overallStrength = Math.max(claim.overallStrength, 0.85);
        }
        claim.evidenceItems.push({
          id: `ev_proj_${claim.evidenceItems.length + 1}`,
          claimId: norm,
          source: 'RESUME',
          sourceType: 'project',
          text: `Implemented in project: ${proj.name}`,
          strength: 0.85,
          confidence: 0.9,
        });
      }
    }
  }

  // 4. GitHub Evidence -> STRONGLY_SUPPORTED (strength: 0.95)
  if (githubRepos && githubRepos.length > 0) {
    for (const repo of githubRepos) {
      const repoText = [repo.name, repo.description || '', ...(repo.languages || [])].join(' ');

      for (const [norm, claim] of claimMap.entries()) {
        if (repoText.toLowerCase().includes(norm.toLowerCase())) {
          claim.status = 'STRONGLY_SUPPORTED';
          claim.overallStrength = 0.98;
          claim.evidenceItems.push({
            id: `ev_gh_${claim.evidenceItems.length + 1}`,
            claimId: norm,
            source: 'GITHUB',
            sourceType: 'github_repo',
            text: `Public GitHub Repository: ${repo.name}`,
            strength: 0.95,
            confidence: 0.98,
          });
        }
      }
    }
  }

  return Array.from(claimMap.values());
}
