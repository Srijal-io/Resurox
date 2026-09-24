import { ProviderRegistryEntry } from '../../config/ai-providers';
import { SecurityStore, getSecurityStore } from './store';
import { CircuitBreaker } from '../ai/breaker';
import { securityLogger } from './logger';

/**
 * Per-Provider Quota & Cooldown Tracker (Phase 4b §3, §4 & Addendum F).
 * Enforces dynamic quota (RPM, RPD, TPM, TPD), cooldown on 429 Retry-After, and circuit breaker.
 */

// In-memory circuit breakers keyed by provider id
const providerBreakers: Map<string, CircuitBreaker> = new Map();

export function getProviderCircuitBreaker(providerId: string): CircuitBreaker {
  let breaker = providerBreakers.get(providerId);
  if (!breaker) {
    breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 30000 });
    providerBreakers.set(providerId, breaker);
  }
  return breaker;
}

export interface ProviderQuotaReservation {
  providerId: string;
  minuteKey: string;
  dayKey: string;
  tpmKey?: string;
  tpdKey?: string;
  reservedRequests: number;
  estimatedTokens: number;
}

/**
 * Checks whether a provider is eligible to receive a call (RPM, RPD, TPM, TPD).
 */
export async function canProviderAcceptCall(
  provider: ProviderRegistryEntry,
  store: SecurityStore = getSecurityStore()
): Promise<{ allowed: boolean; reason?: string; retryAfterSec?: number }> {
  const providerId = provider.id;

  // 1. Check Circuit Breaker
  const breaker = getProviderCircuitBreaker(providerId);
  if (!breaker.canExecute()) {
    return { allowed: false, reason: `Circuit breaker OPEN for provider '${providerId}'`, retryAfterSec: 30 };
  }

  // 2. Check Cooldown (set on 429)
  const cooldownKey = `provider:${providerId}:cooldown_until`;
  const cooldownVal = await store.get(cooldownKey);
  if (cooldownVal) {
    const cooldownUntil = parseInt(cooldownVal, 10) || 0;
    const now = Date.now();
    if (now < cooldownUntil) {
      const waitSec = Math.ceil((cooldownUntil - now) / 1000);
      return { allowed: false, reason: `Provider in cooldown`, retryAfterSec: waitSec };
    }
  }

  // 3. Safety Margin (80% of limit)
  const safetyMargin = 0.8;
  const maxRpm = Math.max(1, Math.floor(provider.limits.rpm * safetyMargin));
  const maxRpd = Math.max(1, Math.floor(provider.limits.rpd * safetyMargin));

  const currentMinute = Math.floor(Date.now() / 60000);
  const utcDateKey = new Date().toISOString().split('T')[0];

  const minuteKey = `provider:${providerId}:rpm:${currentMinute}`;
  const dayKey = `provider:${providerId}:rpd:${utcDateKey}`;

  // Check current RPM
  const currentRpmVal = await store.get(minuteKey);
  const currentRpm = currentRpmVal ? parseInt(currentRpmVal, 10) || 0 : 0;
  if (currentRpm >= maxRpm) {
    return { allowed: false, reason: `RPM limit reached (${currentRpm}/${maxRpm})`, retryAfterSec: 60 };
  }

  // Check current RPD
  const currentRpdVal = await store.get(dayKey);
  const currentRpd = currentRpdVal ? parseInt(currentRpdVal, 10) || 0 : 0;
  if (currentRpd >= maxRpd) {
    return { allowed: false, reason: `Daily limit reached (${currentRpd}/${maxRpd})`, retryAfterSec: 3600 };
  }

  // Addendum F: Check TPM if configured
  if (provider.limits.tpm) {
    const maxTpm = Math.max(100, Math.floor(provider.limits.tpm * safetyMargin));
    const tpmKey = `provider:${providerId}:tpm:${currentMinute}`;
    const currentTpmVal = await store.get(tpmKey);
    const currentTpm = currentTpmVal ? parseInt(currentTpmVal, 10) || 0 : 0;
    if (currentTpm >= maxTpm) {
      return { allowed: false, reason: `TPM limit reached (${currentTpm}/${maxTpm})`, retryAfterSec: 60 };
    }
  }

  // Addendum F: Check TPD if configured
  if (provider.limits.tpd) {
    const maxTpd = Math.max(1000, Math.floor(provider.limits.tpd * safetyMargin));
    const tpdKey = `provider:${providerId}:tpd:${utcDateKey}`;
    const currentTpdVal = await store.get(tpdKey);
    const currentTpd = currentTpdVal ? parseInt(currentTpdVal, 10) || 0 : 0;
    if (currentTpd >= maxTpd) {
      return { allowed: false, reason: `TPD limit reached (${currentTpd}/${maxTpd})`, retryAfterSec: 3600 };
    }
  }

  return { allowed: true };
}

/**
 * Atomically reserves request and estimated token slots for a provider (Addendum F).
 */
export async function reserveProviderSlot(
  provider: ProviderRegistryEntry,
  estimatedTokens: number = 3000,
  store: SecurityStore = getSecurityStore()
): Promise<ProviderQuotaReservation | null> {
  const providerId = provider.id;
  const safetyMargin = 0.8;
  const maxRpm = Math.max(1, Math.floor(provider.limits.rpm * safetyMargin));
  const maxRpd = Math.max(1, Math.floor(provider.limits.rpd * safetyMargin));

  const currentMinute = Math.floor(Date.now() / 60000);
  const utcDateKey = new Date().toISOString().split('T')[0];

  const minuteKey = `provider:${providerId}:rpm:${currentMinute}`;
  const dayKey = `provider:${providerId}:rpd:${utcDateKey}`;
  const tpmKey = `provider:${providerId}:tpm:${currentMinute}`;
  const tpdKey = `provider:${providerId}:tpd:${utcDateKey}`;

  // Atomic RPM increment
  const rpmRes = await store.increment(minuteKey, 120);
  if (rpmRes.count > maxRpm) {
    await store.incrementBy(minuteKey, -1, 120);
    return null;
  }

  // Atomic RPD increment
  const rpdRes = await store.increment(dayKey, 86400 * 2);
  if (rpdRes.count > maxRpd) {
    await store.incrementBy(minuteKey, -1, 120);
    await store.incrementBy(dayKey, -1, 86400 * 2);
    return null;
  }

  // Addendum F: Reserve TPM if configured
  if (provider.limits.tpm) {
    const maxTpm = Math.max(100, Math.floor(provider.limits.tpm * safetyMargin));
    const tpmRes = await store.incrementBy(tpmKey, estimatedTokens, 120);
    if (tpmRes.total > maxTpm) {
      await store.incrementBy(minuteKey, -1, 120);
      await store.incrementBy(dayKey, -1, 86400 * 2);
      await store.incrementBy(tpmKey, -estimatedTokens, 120);
      return null;
    }
  }

  // Addendum F: Reserve TPD if configured
  if (provider.limits.tpd) {
    const maxTpd = Math.max(1000, Math.floor(provider.limits.tpd * safetyMargin));
    const tpdRes = await store.incrementBy(tpdKey, estimatedTokens, 86400 * 2);
    if (tpdRes.total > maxTpd) {
      await store.incrementBy(minuteKey, -1, 120);
      await store.incrementBy(dayKey, -1, 86400 * 2);
      if (provider.limits.tpm) await store.incrementBy(tpmKey, -estimatedTokens, 120);
      await store.incrementBy(tpdKey, -estimatedTokens, 86400 * 2);
      return null;
    }
  }

  return {
    providerId,
    minuteKey,
    dayKey,
    tpmKey: provider.limits.tpm ? tpmKey : undefined,
    tpdKey: provider.limits.tpd ? tpdKey : undefined,
    reservedRequests: 1,
    estimatedTokens,
  };
}

/**
 * Releases a reserved slot on cancellation or aborted failure (Addendum F).
 */
export async function releaseProviderSlot(
  reservation: ProviderQuotaReservation,
  store: SecurityStore = getSecurityStore()
): Promise<void> {
  try {
    await store.incrementBy(reservation.minuteKey, -reservation.reservedRequests, 120);
    await store.incrementBy(reservation.dayKey, -reservation.reservedRequests, 86400 * 2);
    if (reservation.tpmKey) {
      await store.incrementBy(reservation.tpmKey, -reservation.estimatedTokens, 120);
    }
    if (reservation.tpdKey) {
      await store.incrementBy(reservation.tpdKey, -reservation.estimatedTokens, 86400 * 2);
    }
  } catch {
    securityLogger.warn('Failed to release provider quota reservation', { requestId: 'internal' });
  }
}

/**
 * Records a 429 signal to put the provider in cooldown for Retry-After seconds.
 */
export async function recordProviderRateLimit(
  providerId: string,
  retryAfterSec: number = 30,
  store: SecurityStore = getSecurityStore()
): Promise<void> {
  const cooldownUntil = Date.now() + Math.max(10, retryAfterSec) * 1000;
  const cooldownKey = `provider:${providerId}:cooldown_until`;
  await store.set(cooldownKey, String(cooldownUntil), Math.max(60, retryAfterSec + 30));
  getProviderCircuitBreaker(providerId).recordFailure();
}
