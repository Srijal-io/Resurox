import { SecurityStore, getSecurityStore } from './store';
import { getServerConfig } from '../config';

/**
 * Rate Limiting Engine (SEC-13, PRD §6).
 * 
 * Enforces 3 distinct tiers:
 * 1. IP Burst Limit (default 3 / minute)
 * 2. IP Daily Quota (default 20 / day)
 * 3. Global Service Limit (default 60 / minute)
 */

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'burst_exceeded' | 'daily_exceeded' | 'global_exceeded' | 'store_unavailable';
  retryAfterSec?: number;
  remainingBurst?: number;
  remainingDaily?: number;
}

export async function checkSecurityRateLimits(
  hashedIp: string,
  store: SecurityStore = getSecurityStore()
): Promise<RateLimitCheckResult> {
  const config = getServerConfig();
  const burstLimit = config.RL_BURST_PER_MIN;
  const dailyLimit = config.RL_PER_DAY;
  const globalLimit = config.RL_GLOBAL_PER_MIN;

  const now = new Date();
  const utcDateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

  const burstKey = `rl:burst:${hashedIp}`;
  const dailyKey = `rl:daily:${hashedIp}:${utcDateKey}`;
  const globalKey = `rl:global:${Math.floor(now.getTime() / 60000)}`;

  try {
    // 1. Global per-minute rate limit check
    const globalRes = await store.increment(globalKey, 60);
    if (globalRes.count > globalLimit) {
      return {
        allowed: false,
        reason: 'global_exceeded',
        retryAfterSec: Math.max(1, globalRes.ttlSeconds),
      };
    }

    // 2. IP burst limit check (60-second sliding window)
    const burstRes = await store.increment(burstKey, 60);
    if (burstRes.count > burstLimit) {
      return {
        allowed: false,
        reason: 'burst_exceeded',
        retryAfterSec: Math.max(1, burstRes.ttlSeconds),
        remainingBurst: 0,
      };
    }

    // 3. IP daily quota check (24-hour UTC window)
    const dailyRes = await store.increment(dailyKey, 86400);
    if (dailyRes.count > dailyLimit) {
      return {
        allowed: false,
        reason: 'daily_exceeded',
        retryAfterSec: Math.max(1, dailyRes.ttlSeconds),
        remainingDaily: 0,
      };
    }

    return {
      allowed: true,
      remainingBurst: Math.max(0, burstLimit - burstRes.count),
      remainingDaily: Math.max(0, dailyLimit - dailyRes.count),
    };
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      // In production, fail closed on store failure for AI-spending requests (SEC-13)
      return {
        allowed: false,
        reason: 'store_unavailable',
        retryAfterSec: 30,
      };
    }
    // In dev/test, warn and allow fallback
    console.warn('[RATELIMIT] Store check failed in dev/test, failing open:', err);
    return {
      allowed: true,
      remainingBurst: 1,
      remainingDaily: 1,
    };
  }
}
