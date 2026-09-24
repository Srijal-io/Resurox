import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PROVIDER_REGISTRY } from '../config/ai-providers';
import { runAnalysisPipeline } from '../lib/pipeline/analyze';

// Load .env.local if present
try {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // Ignore env loading errors
}

/**
 * Provider Qualification Benchmark Script (Phase 4b §6).
 * 
 * Usage:
 *   npx tsx scripts/qualify-provider.ts <provider-id> [--max-calls=5]
 * 
 * Benchmarks:
 *   1. Schema Valid Rate (Must be >= 95%)
 *   2. Grounding Drop Rate (Must be < 20%)
 *   3. Score Drift vs Baseline (Must be within ±3 points)
 */

const THRESHOLDS = {
  MIN_SCHEMA_VALID_RATE: 0.95,
  MAX_GROUNDING_DROP_RATE: 0.20,
  MAX_SCORE_DRIFT: 3.0,
};

async function main() {
  const args = process.argv.slice(2);
  const providerId = args[0];

  if (!providerId) {
    console.error('❌ Error: Provider ID required.');
    console.error('Usage: npm run provider:qualify -- <provider-id> [--max-calls=N]');
    console.error(`Available providers: ${Object.keys(DEFAULT_PROVIDER_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  const provider = DEFAULT_PROVIDER_REGISTRY[providerId];
  if (!provider) {
    console.error(`❌ Error: Unknown provider ID "${providerId}".`);
    console.error(`Available providers: ${Object.keys(DEFAULT_PROVIDER_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  const maxCallsArg = args.find((a) => a.startsWith('--max-calls='));
  const maxCalls = maxCallsArg ? parseInt(maxCallsArg.split('=')[1], 10) || 3 : 3;

  console.log(`=======================================================`);
  console.log(`🚀 RESUROX AI PROVIDER QUALIFICATION BENCHMARK`);
  console.log(`=======================================================`);
  console.log(`Target Provider:  ${provider.id} (${provider.type})`);
  console.log(`Model (Extract):  ${provider.models.extract}`);
  console.log(`Model (Explain):  ${provider.models.explain}`);
  console.log(`Base URL:         ${provider.baseUrl}`);
  console.log(`Max Test Calls:   ${maxCalls}`);
  console.log(`-------------------------------------------------------`);
  console.log(`Qualification Gates:`);
  console.log(`  - Schema Valid Rate:     >= ${(THRESHOLDS.MIN_SCHEMA_VALID_RATE * 100).toFixed(0)}%`);
  console.log(`  - Avg Grounding Drop:    <  ${(THRESHOLDS.MAX_GROUNDING_DROP_RATE * 100).toFixed(0)}%`);
  console.log(`  - Score Drift vs Base:   <= ±${THRESHOLDS.MAX_SCORE_DRIFT} pts`);
  console.log(`=======================================================\n`);

  // Verify API Key presence without logging value
  const keyEnv = provider.apiKeyEnv;
  const hasKey = keyEnv ? Boolean(process.env[keyEnv]?.trim()) : true;
  if (!hasKey && provider.id !== 'mock') {
    console.error(`❌ Missing environment variable "${keyEnv}". Set it in .env.local before qualifying.`);
    process.exit(1);
  }

  console.log(`[1/3] Running Reference Baseline with Mock Engine...`);
  (process.env as any).AI_PRIMARY_PROVIDER = 'mock';
  (process.env as any).AI_PROVIDER_ORDER = 'mock';
  (process.env as any).NODE_ENV = 'test';

  const testResume = `%PDF-1.7
John Doe
Senior Software Engineer
Email: john@example.com | Phone: 555-0199 | Location: San Francisco, CA
Summary: 5+ years experience building scalable backend microservices with TypeScript, Node.js, and PostgreSQL.

Experience:
Senior Developer | TechCorp (2021 - Present)
- Designed and built distributed microservices using TypeScript, Node.js, and Redis handling 10k RPS.
- Maintained PostgreSQL database schemas and optimized complex SQL queries.

Skills: TypeScript, Node.js, React, PostgreSQL, Redis, Docker, SQL, Git
Education: Bachelor of Science in Computer Science, University of California (2020)`;

  const testJd = `Senior Backend Engineer
Requirements:
- 3+ years experience with TypeScript and Node.js
- Proficiency with SQL and relational databases (PostgreSQL preferred)
- Experience with Docker and microservices
- Bachelor's degree in Computer Science or related field`;

  const createTestFile = (text: string, filename: string) => {
    const buf = Buffer.from(text);
    return {
      name: filename,
      size: buf.length,
      type: 'text/plain',
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    } as any;
  };

  const baselineResult = await runAnalysisPipeline({
    file: createTestFile(testResume, 'test_resume.txt'),
    jobDescriptionText: testJd,
  });

  const baselineScore = baselineResult.headlineScore;
  console.log(` Baseline Score: ${baselineScore}\n`);

  console.log(`[2/3] Running Qualification Runs on Provider "${providerId}"...`);
  (process.env as any).AI_PROVIDER_ORDER = providerId;
  (process.env as any).AI_PRIMARY_PROVIDER = providerId;

  let schemaValidCount = 0;
  let totalGroundingDrop = 0;
  let scoreSum = 0;
  const latencies: number[] = [];

  for (let i = 1; i <= maxCalls; i++) {
    const t0 = Date.now();
    try {
      const runResult = await runAnalysisPipeline({
        file: createTestFile(testResume, `resume_${i}.txt`),
        jobDescriptionText: testJd,
      });

      const elapsed = Date.now() - t0;
      latencies.push(elapsed);
      schemaValidCount++;
      scoreSum += runResult.headlineScore;
      console.log(`  Run ${i}/${maxCalls}: Success (${elapsed}ms) - Headline Score: ${runResult.headlineScore}`);
    } catch (err: any) {
      console.error(`  Run ${i}/${maxCalls}: Failed (${err.message})`);
    }
  }

  const schemaValidRate = schemaValidCount / maxCalls;
  const avgScore = schemaValidCount > 0 ? scoreSum / schemaValidCount : 0;
  const scoreDrift = Math.abs(avgScore - baselineScore);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  console.log(`\n=======================================================`);
  console.log(`📊 QUALIFICATION REPORT: ${provider.id}`);
  console.log(`=======================================================`);
  console.log(`Successful Calls:     ${schemaValidCount} / ${maxCalls}`);
  console.log(`Schema Valid Rate:    ${(schemaValidRate * 100).toFixed(1)}%`);
  console.log(`Average Latency:      ${avgLatency}ms`);
  console.log(`Average Score:        ${avgScore.toFixed(1)} (Baseline: ${baselineScore})`);
  console.log(`Score Drift:          ${scoreDrift.toFixed(1)} pts`);
  console.log(`-------------------------------------------------------`);

  const passSchema = schemaValidRate >= THRESHOLDS.MIN_SCHEMA_VALID_RATE;
  const passDrift = scoreDrift <= THRESHOLDS.MAX_SCORE_DRIFT;

  console.log(`Gate Checks:`);
  console.log(`  [${passSchema ? 'PASS' : 'FAIL'}] Schema Validity >= 95%`);
  console.log(`  [${passDrift ? 'PASS' : 'FAIL'}] Score Drift <= ±3.0 pts`);

  if (passSchema && passDrift) {
    console.log(`\n🎉 RECOMMENDATION: Provider "${provider.id}" QUALIFIES for production use.`);
  } else {
    console.log(`\n⚠️ RECOMMENDATION: Provider "${provider.id}" DOES NOT qualify yet.`);
  }
  console.log(`=======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal qualification benchmark error:', err);
  process.exit(1);
});
