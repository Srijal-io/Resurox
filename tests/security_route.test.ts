import test from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { POST, GET, PUT, DELETE } from '../app/api/analyze/route';
import { setSecurityStoreForTesting, MemorySecurityStore } from '../lib/security/store';
import { instanceSemaphore } from '../lib/security/concurrency';
import { resetServerConfigForTesting } from '../lib/config';
import { DEFAULT_PROVIDER_REGISTRY } from '../config/ai-providers';

test('TST-05: API Security, Abuse Controls & Request Order Pipeline', async (t) => {
  let memoryStore: MemorySecurityStore;

  t.beforeEach(() => {
    resetServerConfigForTesting();
    memoryStore = new MemorySecurityStore();
    setSecurityStoreForTesting(memoryStore);
    instanceSemaphore.reset();
    (process.env as any).NODE_ENV = 'test';
    process.env.AI_PRIMARY_PROVIDER = 'mock';
    process.env.AI_PROVIDER_ORDER = 'mock';
    process.env.KILL_SWITCH = 'off';
    process.env.BOT_PROTECTION = 'off';
    process.env.RATE_LIMIT_STORE = 'memory';
    process.env.IP_HASH_SALT = 'test_secret_salt_123';
    process.env.TRUSTED_IP_HEADER = 'x-test-ip';
    process.env.RL_BURST_PER_MIN = '3';
    process.env.RL_PER_DAY = '20';
    process.env.DAILY_AI_BUDGET_USD = '10.0';
  });

  t.afterEach(() => {
    setSecurityStoreForTesting(null);
  });

  await t.test('SEC-21: Kill switch returns 503 SERVICE_BUSY before reading body or calling AI', async () => {
    process.env.KILL_SWITCH = 'on';
    resetServerConfigForTesting();

    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '100',
        'x-test-ip': '1.2.3.4',
      },
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'SERVICE_BUSY');
    assert.strictEqual(res.headers.get('Retry-After'), '60');
  });

  await t.test('SEC-17: Method allow-list returns 405 with Allow: POST for non-POST methods', async () => {
    const resGet = await GET();
    assert.strictEqual(resGet.status, 405);
    assert.strictEqual(resGet.headers.get('Allow'), 'POST');

    const resPut = await PUT();
    assert.strictEqual(resPut.status, 405);
    assert.strictEqual(resPut.headers.get('Allow'), 'POST');

    const resDel = await DELETE();
    assert.strictEqual(resDel.status, 405);
  });

  await t.test('SEC-17: Disallowed Origin is rejected with 403 INVALID_REQUEST', async () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.GROQ_API_KEY = 'test_key';
    process.env.AI_PROVIDER_ORDER = 'groq-free';
    process.env.IP_HASH_SALT = 'prod_test_salt_secret_123';
    process.env.TRUSTED_IP_HEADER = 'x-test-ip';
    process.env.ALLOWED_ORIGINS = 'https://resurox.app';
    process.env.ALLOW_MEMORY_RATE_LIMIT_IN_PROD = 'true';
    process.env.ALLOW_FREE_PROVIDERS = 'true';
    
    // Temporarily allow groq-free for origin security unit test in production mode
    const origAccepts = DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData;
    const origPlaceholder = DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = true;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = false;
    resetServerConfigForTesting();

    const req = new NextRequest('https://resurox.app/api/analyze', {
      method: 'POST',
      headers: {
        'origin': 'https://evil-attacker.com',
        'content-length': '100',
        'x-test-ip': '1.2.3.4',
      },
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INVALID_REQUEST');

    DEFAULT_PROVIDER_REGISTRY['groq-free'].acceptsPersonalData = origAccepts;
    DEFAULT_PROVIDER_REGISTRY['groq-free'].hasPlaceholder = origPlaceholder;
  });

  await t.test('SEC-02: Prohibited client credential headers are rejected with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'x-api-key': 'sk-test-secret',
        'content-length': '100',
        'x-test-ip': '1.2.3.4',
      },
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INVALID_REQUEST');
  });

  await t.test('SEC-04: Missing Content-Length header is rejected with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'x-test-ip': '1.2.3.4',
      },
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INVALID_REQUEST');
  });

  await t.test('SEC-04: Oversized declared Content-Length is rejected with 413 DOCUMENT_TOO_LARGE', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '10000000', // 10MB > 6MB cap
        'x-test-ip': '1.2.3.4',
      },
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 413);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'DOCUMENT_TOO_LARGE');
  });

  await t.test('SEC-13 & SEC-14: Rate limiting burst cap triggers 429 with Retry-After', async () => {
    process.env.RL_BURST_PER_MIN = '2';
    resetServerConfigForTesting();

    const makeReq = () => new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '100',
        'x-test-ip': '192.168.1.50',
      },
    });

    // Request 1: Burst count 1
    const res1 = await POST(makeReq());
    assert.notStrictEqual(res1.status, 429);

    // Request 2: Burst count 2
    const res2 = await POST(makeReq());
    assert.notStrictEqual(res2.status, 429);

    // Request 3: Burst exceeded (> 2)
    const res3 = await POST(makeReq());
    assert.strictEqual(res3.status, 429);
    const body3 = await res3.json();
    assert.strictEqual(body3.error.code, 'RATE_LIMITED');
    assert.ok(res3.headers.get('Retry-After'));
  });

  await t.test('SEC-14: Spoofed X-Forwarded-For does not bypass trusted header limit', async () => {
    process.env.RL_BURST_PER_MIN = '1';
    resetServerConfigForTesting();

    // Attacker tries to bypass by rotating X-Forwarded-For, but trusted header is x-test-ip
    const req1 = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '100',
        'x-test-ip': '10.0.0.1',
        'x-forwarded-for': '1.1.1.1',
      },
    });
    const res1 = await POST(req1);
    assert.notStrictEqual(res1.status, 429);

    const req2 = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '100',
        'x-test-ip': '10.0.0.1', // Same trusted IP!
        'x-forwarded-for': '2.2.2.2', // Spoofed header
      },
    });
    const res2 = await POST(req2);
    assert.strictEqual(res2.status, 429, 'Spoofed X-Forwarded-For must not bypass rate limit');
  });

  await t.test('SEC-15: Bot check rejects missing or invalid X-Bot-Token when Turnstile active', async () => {
    process.env.BOT_PROTECTION = 'turnstile';
    process.env.TURNSTILE_SECRET_KEY = 'test_secret_key';
    resetServerConfigForTesting();

    // Missing X-Bot-Token header
    const reqMissing = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '100',
        'x-test-ip': '1.2.3.4',
      },
    });
    const resMissing = await POST(reqMissing);
    assert.strictEqual(resMissing.status, 403);
    const bodyMissing = await resMissing.json();
    assert.strictEqual(bodyMissing.error.code, 'BOT_CHECK_FAILED');
  });

  await t.test('SEC-29: Concurrency semaphore returns 503 SERVICE_BUSY when at capacity', async () => {
    process.env.MAX_CONCURRENT_ANALYSES = '1';
    resetServerConfigForTesting();

    // Artificially saturate instance semaphore
    instanceSemaphore.acquire(1);

    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '100',
        'x-test-ip': '1.2.3.4',
      },
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'SERVICE_BUSY');
    assert.strictEqual(res.headers.get('Retry-After'), '5');
  });

  await t.test('SEC-02: Strict multipart field allow-list rejects unexpected or duplicate fields', async () => {
    const formData = new FormData();
    formData.append('resume', new File(['Dummy resume text with experience and education'], 'resume.pdf', { type: 'application/pdf' }));
    formData.append('jobDescription', 'Looking for software engineer with TypeScript and React.');
    formData.append('apiKey', 'sk-hacker-key'); // Prohibited field!

    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'content-length': '500',
        'x-test-ip': '1.2.3.4',
      },
      body: formData,
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INVALID_REQUEST');
  });
});
