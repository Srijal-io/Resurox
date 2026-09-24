import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getServerConfig, getProviderApiKey } from '../lib/config';
import { resolveApiKey } from '../lib/env';

describe('Phase 1 — Backend Key Ownership & Config', () => {
  it('loads valid server configuration defaults', () => {
    const config = getServerConfig();
    assert.equal(typeof config.MAX_RESUME_BYTES, 'number');
    assert.equal(typeof config.RL_BURST_PER_MIN, 'number');
    assert.equal(config.MAX_RESUME_BYTES, 5242880);
    assert.equal(config.RL_BURST_PER_MIN, 3);
  });

  it('rejects / ignores client-supplied keys in resolveApiKey', () => {
    process.env.GROQ_API_KEY = 'server_test_key_123';
    const resolved = resolveApiKey('client_forbidden_key', 'GROQ_API_KEY');
    assert.equal(resolved, 'server_test_key_123');
  });

  it('retrieves server-only provider key via getProviderApiKey', () => {
    process.env.GROQ_API_KEY = 'groq_server_key';
    const key = getProviderApiKey('groq-free');
    assert.equal(key, 'groq_server_key');
  });

  it('throws descriptive error if provider key is missing on server', () => {
    delete process.env.NON_EXISTENT_KEY;
    assert.throws(() => {
      getProviderApiKey('non_existent_key');
    }, /is not configured on the server/);
  });
});
