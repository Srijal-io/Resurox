import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { computeScores, computeOverallScore, computeExperienceMatch, computeEducationMatch, computeSkillsMatch } from '../lib/scorer';
import { computeMultiDimensionalScores } from '../lib/scoring/rubric';
import { computeLexicalCosineSimilarity } from '../lib/scoring/semantic';
import { calculateExperienceFromDates } from '../lib/scoring/experience';

test('SC-01 & SC-03: Purity, Determinism and Sandboxing of Scoring Modules', async (t) => {
  await t.test('SC-01: Scoring and matching files do not import fs, net, http, child_process or access process.env', () => {
    const pureDirs = [
      path.join(process.cwd(), 'lib', 'scoring'),
      path.join(process.cwd(), 'lib', 'matching'),
      path.join(process.cwd(), 'lib', 'evidence'),
      path.join(process.cwd(), 'lib', 'normalization'),
    ];

    const forbiddenImports = ['fs', 'node:fs', 'net', 'node:net', 'http', 'node:http', 'https', 'node:https', 'child_process', 'node:child_process'];

    for (const dir of pureDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        for (const forbidden of forbiddenImports) {
          const importRegex = new RegExp(`(?:import|require)\\s*\\(?['"\`]${forbidden}['"\`]\\)?`, 'g');
          assert.strictEqual(
            importRegex.test(content),
            false,
            `File ${file} in pure directory violates SC-01 by importing '${forbidden}'`
          );
        }

        // Must not call process.env directly inside pure scoring/matching modules
        assert.strictEqual(
          content.includes('process.env'),
          false,
          `File ${file} in pure directory violates SC-01 by accessing process.env`
        );

        // Must not call global fetch
        assert.strictEqual(
          /\bfetch\s*\(/.test(content),
          false,
          `File ${file} in pure directory violates SC-01 by calling fetch()`
        );
      }
    }
  });

  await t.test('SC-03: NaN / Infinity / negative numbers are impossible in computeScores and computeOverallScore', () => {
    // Malicious or extreme inputs with NaN, Infinity, negative values
    const extremeScores = [
      computeOverallScore(NaN, 50, 50, 50),
      computeOverallScore(100, Infinity, 50, 50),
      computeOverallScore(100, -50, -100, 50),
      computeOverallScore(-Infinity, NaN, 150, -20),
    ];

    for (const score of extremeScores) {
      assert.ok(Number.isFinite(score), `Score ${score} must be finite`);
      assert.ok(!Number.isNaN(score), `Score ${score} must not be NaN`);
      assert.ok(score >= 0 && score <= 100, `Score ${score} must be clamped to [0, 100]`);
    }

    const expNaN = computeExperienceMatch(NaN as any, NaN as any);
    assert.ok(Number.isFinite(expNaN.score));
    assert.ok(expNaN.score >= 0 && expNaN.score <= 100);

    const expInf = computeExperienceMatch(Infinity, -5);
    assert.ok(Number.isFinite(expInf.score));
    assert.ok(expInf.score >= 0 && expInf.score <= 100);

    const eduNull = computeEducationMatch(null as any, undefined as any);
    assert.ok(Number.isFinite(eduNull.score));
  });

  await t.test('SC-03: computeMultiDimensionalScores guarantees finite clamped integers', () => {
    const result = computeMultiDimensionalScores(
      [
        {
          requirementId: 'req_1',
          requirement: { id: 'req_1', text: 'TypeScript', category: 'skill', requirementType: 'REQUIRED', criticality: NaN as any, importance: 1, evidenceExpected: true },
          status: 'MATCHED',
          matchScore: Infinity as any,
          confidence: -5,
          evidence: [],
          reason: 'test',
        },
      ],
      [
        {
          skill: 'TypeScript',
          normalizedSkill: 'TypeScript',
          status: 'STRONGLY_SUPPORTED',
          evidenceItems: [],
          overallStrength: NaN as any,
        },
      ],
      NaN,
      -100,
      200
    );

    assert.ok(Number.isFinite(result.scores.overallEvaluation));
    assert.ok(result.scores.overallEvaluation >= 0 && result.scores.overallEvaluation <= 100);
    assert.ok(Number.isFinite(result.scores.jobMatchScore));
    assert.ok(Number.isFinite(result.scores.evidenceStrengthScore));
    assert.ok(Number.isFinite(result.scores.resumeQualityScore));
    assert.ok(Number.isFinite(result.scores.atsCompatibilityScore));
    assert.ok(result.evidenceCoverage >= 0 && result.evidenceCoverage <= 1);
  });
});
