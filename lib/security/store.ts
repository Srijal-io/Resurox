/**
 * Shared Security & Rate Limit Store (SEC-13, SEC-20, PRD §6).
 * 
 * Supports:
 * - 'memory': In-memory ephemeral counters for local dev, test suites, and single-server deployments.
 * - 'upstash': Upstash Redis REST API over HTTPS for serverless / multi-instance setups.
 */

export interface IncrementResult {
  count: number;
  ttlSeconds: number;
}

export interface SecurityStore {
  increment(key: string, ttlSeconds: number): Promise<IncrementResult>;
  incrementBy(key: string, amount: number, ttlSeconds: number): Promise<{ total: number; ttlSeconds: number }>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

interface MemoryEntry {
  value: string;
  numValue?: number;
  expiresAt: number; // ms timestamp
}

export class MemorySecurityStore implements SecurityStore {
  private data = new Map<string, MemoryEntry>();

  constructor() {
    // Periodic cleanup of expired keys in long-lived environments
    if (typeof setInterval !== 'undefined') {
      const interval = setInterval(() => {
        const now = Date.now();
        for (const [k, v] of this.data.entries()) {
          if (v.expiresAt <= now) {
            this.data.delete(k);
          }
        }
      }, 60000);
      if (typeof interval.unref === 'function') {
        interval.unref();
      }
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<IncrementResult> {
    return this.incrementBy(key, 1, ttlSeconds).then(res => ({
      count: res.total,
      ttlSeconds: res.ttlSeconds,
    }));
  }

  async incrementBy(key: string, amount: number, ttlSeconds: number): Promise<{ total: number; ttlSeconds: number }> {
    const now = Date.now();
    const existing = this.data.get(key);

    if (!existing || existing.expiresAt <= now) {
      const newTotal = amount;
      const expiresAt = now + ttlSeconds * 1000;
      this.data.set(key, {
        value: String(newTotal),
        numValue: newTotal,
        expiresAt,
      });
      return { total: newTotal, ttlSeconds };
    }

    const currentNum = existing.numValue !== undefined ? existing.numValue : parseInt(existing.value, 10) || 0;
    const newTotal = currentNum + amount;
    existing.numValue = newTotal;
    existing.value = String(newTotal);

    const remainingTtl = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
    return { total: newTotal, ttlSeconds: remainingTtl };
  }

  async get(key: string): Promise<string | null> {
    const now = Date.now();
    const existing = this.data.get(key);
    if (!existing || existing.expiresAt <= now) {
      if (existing) this.data.delete(key);
      return null;
    }
    return existing.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const now = Date.now();
    const expiresAt = ttlSeconds ? now + ttlSeconds * 1000 : now + 86400 * 1000 * 365;
    this.data.set(key, {
      value,
      expiresAt,
    });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

export class UpstashSecurityStore implements SecurityStore {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
  }

  async increment(key: string, ttlSeconds: number): Promise<IncrementResult> {
    const res = await this.incrementBy(key, 1, ttlSeconds);
    return { count: res.total, ttlSeconds: res.ttlSeconds };
  }

  async incrementBy(key: string, amount: number, ttlSeconds: number): Promise<{ total: number; ttlSeconds: number }> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCRBY', key, amount],
        ['EXPIRE', key, ttlSeconds, 'NX'],
        ['TTL', key],
      ]),
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      throw new Error(`Upstash Redis request failed with status: ${res.status}`);
    }

    const json = await res.json();
    const total = Number(json[0]?.result || amount);
    const ttl = Number(json[2]?.result || ttlSeconds);
    return { total, ttlSeconds: Math.max(1, ttl) };
  }

  async get(key: string): Promise<string | null> {
    const res = await fetch(`${this.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      throw new Error(`Upstash Redis get failed with status: ${res.status}`);
    }
    const json = await res.json();
    return json.result ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const endpoint = ttlSeconds
      ? `${this.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?ex=${ttlSeconds}`
      : `${this.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      throw new Error(`Upstash Redis set failed with status: ${res.status}`);
    }
  }

  async del(key: string): Promise<void> {
    await fetch(`${this.url}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(2000),
    });
  }
}

// Global store singleton
let defaultStore: SecurityStore | null = null;

export function getSecurityStore(): SecurityStore {
  if (defaultStore) return defaultStore;

  const storeType = process.env.RATE_LIMIT_STORE || 'memory';

  if (storeType === 'upstash') {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required when RATE_LIMIT_STORE=upstash');
      }
      console.warn('[SECURITY] Upstash credentials missing; falling back to in-memory store in non-production mode.');
      defaultStore = new MemorySecurityStore();
      return defaultStore;
    }
    defaultStore = new UpstashSecurityStore(url, token);
    return defaultStore;
  }

  // Memory store
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MEMORY_RATE_LIMIT_IN_PROD !== 'true') {
    throw new Error(
      'RATE_LIMIT_STORE=memory is prohibited in production unless ALLOW_MEMORY_RATE_LIMIT_IN_PROD=true is explicitly configured.'
    );
  }

  defaultStore = new MemorySecurityStore();
  return defaultStore;
}

export function setSecurityStoreForTesting(store: SecurityStore | null): void {
  defaultStore = store;
}
