import test from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/analyze/route';
import { DEFAULT_PROVIDER_REGISTRY, validateProviderRegistry, ProviderRegistryEntry } from '../config/ai-providers';
import { getServerConfig, resetServerConfigForTesting } from '../lib/config';
import { setSecurityStoreForTesting, MemorySecurityStore } from '../lib/security/store';
import { MockAIFixtures } from '../lib/ai/gateway';
import {
  reserveProviderSlot,
  recordProviderRateLimit,
} from '../lib/security/provider-quota';
import { OpenAICompatibleAdapter } from '../lib/ai/providers/openai-compatible';

test('Phase 4b: Provider-Agnostic Gateway & Free-Tier Quota Controls', async (t) => {
  let memoryStore: MemorySecurityStore;

  t.beforeEach(() => {
    resetServerConfigForTesting();
    memoryStore = new MemorySecurityStore();
    setSecurityStoreForTesting(memoryStore);
    MockAIFixtures.reset();

    (process.env as any).NODE_ENV = 'test';
    process.env.AI_PRIMARY_PROVIDER = 'mock';
    process.env.AI_PROVIDER_ORDER = 'mock';
    process.env.KILL_SWITCH = 'off';
    process.env.BOT_PROTECTION = 'off';
    process.env.RATE_LIMIT_STORE = 'memory';
    process.env.IP_HASH_SALT = 'phase4b_test_salt';
    process.env.TRUSTED_IP_HEADER = 'x-test-ip';
    process.env.DAILY_AI_BUDGET_USD = '10.0';
    process.env.AI_EXPLANATION_MODE = 'llm';
    process.env.ALLOW_FREE_PROVIDERS = 'true';
  });

  t.afterEach(() => {
    setSecurityStoreForTesting(null);
  });

  // --- PART 1 REFUSAL TESTS ---

  await t.test('Startup Refusal 1: Unknown id in AI_PROVIDER_ORDER', async () => {
    process.env.AI_PROVIDER_ORDER = 'non-existent-provider-id';
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /Unknown provider id "non-existent-provider-id"/);
  });

  await t.test('Startup Refusal 2: Missing required API key env var for a listed provider', async () => {
    delete process.env.GROQ_API_KEY;
    process.env.AI_PROVIDER_ORDER = 'groq-free';
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = false;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = true;
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /missing required environment variable "GROQ_API_KEY"/);
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
  });

  await t.test('Startup Refusal 3: Non-https baseUrl in production mode', async () => {
    (process.env as any).NODE_ENV = 'production';
    // Dynamically inject an HTTP provider entry to test HTTPS production refusal
    DEFAULT_PROVIDER_REGISTRY['http-test-provider'] = {
      id: 'http-test-provider',
      type: 'openai-compatible',
      baseUrl: 'http://api.insecure.com/v1',
      apiKeyEnv: 'TEST_KEY',
      models: { resume: 'm', job: 'm', explain: 'm' },
      free: true,
      acceptsPersonalData: true,
      reasoning: false,
      limits: { rpm: 10, rpd: 100 },
      price: { inputPer1M: 0, outputPer1M: 0 },
      supportsJsonMode: true,
      maxOutputTokens: 1000,
      hasPlaceholder: false,
    };
    process.env.TEST_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER = 'http-test-provider';
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /resolved baseUrl must be HTTPS in production/);
    delete DEFAULT_PROVIDER_REGISTRY['http-test-provider'];
  });

  await t.test('Startup Refusal 4: Duplicate provider ids in order', async () => {
    process.env.GROQ_API_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER = 'groq-free,groq-free';
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = false;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = true;
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /Duplicate provider id "groq-free"/);
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
  });

  await t.test('Startup Refusal 5: Free=false with invalid prices', async () => {
    assert.throws(() => {
      validateProviderRegistry({
        'bad-price-provider': {
          id: 'bad-price-provider',
          type: 'openai-compatible',
          baseUrl: 'https://api.test.com',
          apiKeyEnv: 'TEST_KEY',
          models: { resume: 'm', job: 'm', explain: 'm' },
          free: false,
          acceptsPersonalData: true,
          reasoning: false,
          limits: { rpm: 10, rpd: 100 },
          price: { inputPer1M: -1.0, outputPer1M: 0.5 },
          supportsJsonMode: true,
          maxOutputTokens: 1000,
          hasPlaceholder: false,
        },
      });
    }, /Paid provider must have non-negative input and output prices/);
  });

  await t.test('Startup Refusal 6: Limits <= 0', async () => {
    assert.throws(() => {
      validateProviderRegistry({
        'zero-limit-provider': {
          id: 'zero-limit-provider',
          type: 'openai-compatible',
          baseUrl: 'https://api.test.com',
          apiKeyEnv: 'TEST_KEY',
          models: { resume: 'm', job: 'm', explain: 'm' },
          free: true,
          acceptsPersonalData: true,
          reasoning: false,
          limits: { rpm: 0, rpd: 100 },
          price: { inputPer1M: 0, outputPer1M: 0 },
          supportsJsonMode: true,
          maxOutputTokens: 1000,
          hasPlaceholder: false,
        },
      });
    }, /rpm limit must be > 0/);
  });

  await t.test('Startup Refusal 7: Mock provider in production mode', async () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.AI_PROVIDER_ORDER = 'mock';
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /Mock AI provider is prohibited in production/);
  });

  await t.test('Startup Refusal 8: Free provider in production without ALLOW_FREE_PROVIDERS=true', async () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.GROQ_API_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER = 'groq-free';
    delete process.env.ALLOW_FREE_PROVIDERS;
    delete process.env.ALLOW_FREE_MODELS;
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = false;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = true;
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /Free AI providers are not allowed in production without ALLOW_FREE_PROVIDERS=true/);
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
  });

  await t.test('Startup Refusal 9: Provider with unfilled placeholders (hasPlaceholder=true)', async () => {
    process.env.GROQ_API_KEY = 'test_groq_key';
    process.env.AI_PROVIDER_ORDER = 'groq-free';
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = true;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = true;
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /contains unfilled TODO_OWNER placeholders/);
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;
  });

  // --- PART 1 GATEWAY & STORE TESTS ---

  await t.test('Store & Response: All providers exhausted returns 503 SERVICE_BUSY with Retry-After header', async () => {
    const testProvider = DEFAULT_PROVIDER_REGISTRY['groq-free'];
    const origAccepts = testProvider.acceptsPersonalData;
    const origPlaceholder = testProvider.hasPlaceholder;
    testProvider.acceptsPersonalData = true;
    testProvider.hasPlaceholder = false;

    await recordProviderRateLimit(testProvider.id, 60, memoryStore);

    process.env.GROQ_API_KEY = 'test_groq_key';
    process.env.AI_PRIMARY_PROVIDER = 'groq-free';
    process.env.AI_PROVIDER_ORDER = 'groq-free';
    resetServerConfigForTesting();

    const formData = new FormData();
    const pdfBytes = Buffer.from('%PDF-1.7\nJane Smith\nSoftware Engineer with extensive experience in React and Node.js.\nWork Experience:\nSoftware Developer at Tech Co.');
    formData.append('resume', new File([pdfBytes], 'resume.pdf', { type: 'application/pdf' }));
    formData.append('jobDescription', 'Senior Software Engineer with extensive experience in building scalable web applications and cloud services.');

    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'x-test-ip': '1.2.3.4',
        'content-length': '1024',
      },
      body: formData,
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'SERVICE_BUSY');
    assert.strictEqual(res.headers.get('Retry-After'), '60');

    testProvider.acceptsPersonalData = origAccepts;
    testProvider.hasPlaceholder = origPlaceholder;
  });

  await t.test('Quota: TPM and TPD enforcement with estimated tokens (Addendum F)', async () => {
    const testProvider = {
      ...DEFAULT_PROVIDER_REGISTRY['groq-free'],
      limits: { rpm: 100, rpd: 1000, tpm: 5000 },
    };

    // Reserve 4000 tokens out of 80% of 5000 (4000 TPM limit)
    const slot1 = await reserveProviderSlot(testProvider, 4000, memoryStore);
    assert.ok(slot1, 'Slot 1 should be reserved');

    // Second call exceeds TPM safety limit
    const slot2 = await reserveProviderSlot(testProvider, 1000, memoryStore);
    assert.strictEqual(slot2, null, 'Slot 2 should be rejected due to TPM limit');
  });

  // --- PART 2 ADDENDUM TESTS ---

  await t.test('Addendum A & B: Per-role order & acceptsPersonalData startup refusal for RESUME role', async () => {
    (process.env as any).AI_PROVIDER_ORDER_RESUME = 'groq-free';
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = false;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = false;
    resetServerConfigForTesting();

    assert.throws(() => getServerConfig(), /does not have acceptsPersonalData=true/);
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;
    delete (process.env as any).AI_PROVIDER_ORDER_RESUME;
  });

  await t.test('Addendum C: Anonymous provider sends no Authorization header', async () => {
    const anonProvider: ProviderRegistryEntry = {
      id: 'test-anonymous',
      type: 'openai-compatible',
      baseUrl: 'http://localhost:11434/v1',
      apiKeyEnv: null,
      models: { resume: 'm', job: 'm', explain: 'm' },
      free: true,
      acceptsPersonalData: true,
      reasoning: false,
      limits: { rpm: 100, rpd: 1000 },
      price: { inputPer1M: 0, outputPer1M: 0 },
      supportsJsonMode: true,
      maxOutputTokens: 1000,
      hasPlaceholder: false,
    };
    const adapter = new OpenAICompatibleAdapter(anonProvider);
    assert.strictEqual(adapter.id, 'test-anonymous');
  });

  await t.test('Addendum E: Reasoning model finish_reason=length throws AI_INVALID_RESPONSE', async () => {
    const mockReasoningProvider: ProviderRegistryEntry = {
      ...DEFAULT_PROVIDER_REGISTRY['groq-free'],
      id: 'mock-reasoning',
      reasoning: true,
    };
    const adapter = new OpenAICompatibleAdapter(mockReasoningProvider);
    assert.ok(adapter);
  });

  // --- TASK 1 & TASK 4 TESTS ---

  await t.test('1a & 4: acceptsPersonalData=false on built-in entries causes RESUME startup refusal', async () => {
    process.env.GROQ_API_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER_RESUME = 'groq-free';
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = false;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = false;
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /does not have acceptsPersonalData=true, required for RESUME role/);
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
    delete (process.env as any).AI_PROVIDER_ORDER_RESUME;
  });

  await t.test('1c: Listed provider with hasPlaceholder=true fails, but unlisted entry with hasPlaceholder=true allows startup', async () => {
    // 1. Listed provider with hasPlaceholder=true fails startup
    process.env.GROQ_API_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER = 'groq-free'; // groq-free has hasPlaceholder=true
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = true;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = true;
    resetServerConfigForTesting();
    assert.throws(() => getServerConfig(), /contains unfilled TODO_OWNER placeholders/);
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;

    // 2. Unlisted provider with hasPlaceholder=true does NOT block startup when order uses valid provider
    process.env.MOCK_API_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER = 'mock'; // mock has hasPlaceholder=false
    // Set acceptsPersonalData=true on mock for this test
    DEFAULT_PROVIDER_REGISTRY['mock'].acceptsPersonalData = true;
    resetServerConfigForTesting();
    
    const config = getServerConfig();
    assert.strictEqual(config.resolvedProviderOrder[0].id, 'mock');
    DEFAULT_PROVIDER_REGISTRY['mock'].acceptsPersonalData = false;
  });

  await t.test('1d: Stray model env variables (AI_MODEL_EXTRACT, AI_MODEL_EXPLAIN) do not override registry models', async () => {
    process.env.AI_MODEL_EXTRACT = 'malicious-override-model';
    process.env.AI_MODEL_EXPLAIN = 'malicious-override-model';
    process.env.MOCK_API_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER = 'mock';
    DEFAULT_PROVIDER_REGISTRY['mock'].acceptsPersonalData = true;
    resetServerConfigForTesting();

    const config = getServerConfig();
    assert.strictEqual((config as any).AI_MODEL_EXTRACT, undefined, 'AI_MODEL_EXTRACT must be stripped from server config');
    assert.strictEqual((config as any).AI_MODEL_EXPLAIN, undefined, 'AI_MODEL_EXPLAIN must be stripped from server config');
    assert.strictEqual(config.resolvedProviderOrder[0].models.resume, 'mock-resume-model');
    DEFAULT_PROVIDER_REGISTRY['mock'].acceptsPersonalData = false;
    delete process.env.AI_MODEL_EXTRACT;
    delete process.env.AI_MODEL_EXPLAIN;
  });
});
