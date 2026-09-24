import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { minimizePiiForAiProvider, extractServerIdentifiers, normalizeExtractedText } from '../lib/security/redact';
import { fetchGitHubPublicEvidence } from '../lib/enrichment/github';
import { runAnalysisPipeline } from '../lib/pipeline/analyze';
import { setSecurityStoreForTesting, MemorySecurityStore } from '../lib/security/store';
import { resetServerConfigForTesting } from '../lib/config';

test('SEC-11, SEC-16, SEC-22, SEC-25 & PT-G, PT-K: Privacy, SSRF, Isolation & Output Safety', async (t) => {
  t.beforeEach(() => {
    resetServerConfigForTesting();
    setSecurityStoreForTesting(new MemorySecurityStore());
    (process.env as any).NODE_ENV = 'test';
    process.env.AI_PRIMARY_PROVIDER = 'mock';
    process.env.BOT_PROTECTION = 'off';
    process.env.KILL_SWITCH = 'off';
    process.env.RATE_LIMIT_STORE = 'memory';
    process.env.IP_HASH_SALT = 'privacy_test_salt';
    process.env.TRUSTED_IP_HEADER = 'x-test-ip';
  });

  t.afterEach(() => {
    setSecurityStoreForTesting(null);
  });

  await t.test('SEC-11: Pre-extracts GitHub handle and redacts emails, phones, and addresses from AI payload', () => {
    const rawResumeText = `
      Alex Rivera
      Email: alex.rivera@example.com
      Phone: (555) 234-5678
      GitHub: https://github.com/alexrivera-dev
      Address: 456 Tech Boulevard, Suite 100, San Francisco, CA
      
      Professional Experience:
      - Built microservices using Node.js v20.11.0 and Python 3.10.2
      - Managed databases with over 10,000 active users from 2020-2024
      - Increased annual revenue by $2.5M
    `;

    // 1. Pre-extraction of identifiers
    const identifiers = extractServerIdentifiers(rawResumeText);
    assert.strictEqual(identifiers.githubUsername, 'alexrivera-dev');

    // 2. PII Redaction
    const redacted = minimizePiiForAiProvider(rawResumeText);

    // Assert PII is gone
    assert.strictEqual(redacted.includes('alex.rivera@example.com'), false);
    assert.strictEqual(redacted.includes('(555) 234-5678'), false);
    assert.strictEqual(redacted.includes('456 Tech Boulevard'), false);
    assert.ok(redacted.includes('[EMAIL_REDACTED]'));
    assert.ok(redacted.includes('[PHONE_REDACTED]'));
    assert.ok(redacted.includes('[ADDRESS_REDACTED]'));

    // Assert Technical numbers / false positives are PRESERVED intact
    assert.ok(redacted.includes('20.11.0'), 'Version number 20.11.0 must not be corrupted');
    assert.ok(redacted.includes('3.10.2'), 'Version number 3.10.2 must not be corrupted');
    assert.ok(redacted.includes('10,000'), 'Metric 10,000 must not be corrupted');
    assert.ok(redacted.includes('2020-2024'), 'Date range 2020-2024 must not be corrupted');
  });

  await t.test('SEC-09: Normalization strips zero-width, bidi characters, and control characters', () => {
    const maliciousUnicodeText = 'Alex\u200B Rivera\uFEFF Senior\u202E Engineer\x00\x08';
    const normalized = normalizeExtractedText(maliciousUnicodeText);

    assert.strictEqual(normalized.includes('\u200B'), false);
    assert.strictEqual(normalized.includes('\uFEFF'), false);
    assert.strictEqual(normalized.includes('\u202E'), false);
    assert.strictEqual(normalized.includes('\x00'), false);
    assert.strictEqual(normalized, 'Alex Rivera Senior Engineer');
  });

  await t.test('SEC-16 & PT-G: GitHub Enrichment SSRF protections block malicious targets', async () => {
    const maliciousTargets = [
      'https://github.com.evil.com/attacker',
      'https://github.com@evil.com/attacker',
      'http://169.254.169.254/latest/meta-data',
      'http://localhost:3000/admin',
      'https://github.com/user/with/slashes',
      'https://github.com/user?query=injection',
    ];

    for (const target of maliciousTargets) {
      const result = await fetchGitHubPublicEvidence(target);
      assert.deepStrictEqual(result, [], `SSRF target '${target}' must be rejected and return empty list`);
    }
  });

  await t.test('SEC-25 & PT-K: Concurrency Canary Isolation between parallel requests', async () => {
    const canaryA = `CANARY_SECRET_ALPHA_${Date.now()}_A`;
    const canaryB = `CANARY_SECRET_BETA_${Date.now()}_B`;

    const resumeFileA = new File(
      [
        `%PDF-1.7\nCandidate Alpha with ${canaryA}. Work Experience: Senior Software Engineer at AlphaCorp from 2020 to 2024. Technical Skills: TypeScript, React. Education: Bachelor's Degree in Computer Science.`,
      ],
      'resume_a.pdf',
      { type: 'application/pdf' }
    );

    const resumeFileB = new File(
      [
        `%PDF-1.7\nCandidate Beta with ${canaryB}. Work Experience: Senior Data Analyst at BetaCorp from 2021 to 2024. Technical Skills: SQL, Python. Education: Master's Degree in Computer Science.`,
      ],
      'resume_b.pdf',
      { type: 'application/pdf' }
    );

    const jdText = `
      Job Title: Senior Software Engineer
      Experience Required: 3+ years of work experience
      Education: Bachelor's Degree in Computer Science
      Requirements:
      - Proficient with TypeScript, React, and Node.js
      - Experience with PostgreSQL and SQL databases
      - Strong engineering best practices
    `;

    // Run both requests concurrently in parallel
    const [resA, resB] = await Promise.all([
      runAnalysisPipeline({ file: resumeFileA, jobDescriptionText: jdText }),
      runAnalysisPipeline({ file: resumeFileB, jobDescriptionText: jdText }),
    ]);

    const strA = JSON.stringify(resA);
    const strB = JSON.stringify(resB);

    // Verify isolation: Canary A never leaks into B's result, and Canary B never leaks into A's result
    assert.strictEqual(strA.includes(canaryB), false, 'Canary B must not leak into Request A');
    assert.strictEqual(strB.includes(canaryA), false, 'Canary A must not leak into Request B');
  });

  await t.test('SEC-22 & TST-08: Component static scan guarantees zero dangerouslySetInnerHTML on user data', () => {
    const componentsDir = path.join(process.cwd(), 'components');
    const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

    for (const file of files) {
      if (file === 'JsonLd.tsx') continue; // Static JSON-LD marketing metadata is checked separately
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');

      assert.strictEqual(
        content.includes('dangerouslySetInnerHTML'),
        false,
        `Component ${file} violates SEC-22 by using dangerouslySetInnerHTML`
      );
      assert.strictEqual(
        content.includes('innerHTML'),
        false,
        `Component ${file} violates SEC-22 by using innerHTML`
      );
    }
  });
});
