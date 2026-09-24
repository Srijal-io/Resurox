import { SecurityStore, getSecurityStore } from './store';
import { getServerConfig } from '../config';

/**
 * Budget Circuit Breaker & Kill Switch (SEC-20, SEC-21, PRD §6, Phase 4b §4).
 * 
 * Tracks AI spend in integer micro-dollars ($1 USD = 1,000,000 micro-dollars).
 * Free providers do not incur dollar spend.
 * Paid providers enforce DAILY_AI_BUDGET_USD.
 */

// Model Pricing per million tokens in USD: { input: $/1M, output: $/1M }
export interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

export const DEFAULT_PRICE_TABLE: Record<string, ModelPrice> = {
  'google/gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'google/gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'openai/gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'openai/gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'anthropic/claude-3-5-haiku': { inputPer1M: 0.80, outputPer1M: 4.00 },
  'meta-llama/llama-3.3-70b-instruct': { inputPer1M: 0.40, outputPer1M: 0.80 },
  'mock': { inputPer1M: 0.00, outputPer1M: 0.00 },
};

// Conservative default price for unlisted models ($2.00 / $8.00 per 1M)
export const UNLISTED_MODEL_FALLBACK_PRICE: ModelPrice = {
  inputPer1M: 2.00,
  outputPer1M: 8.00,
};

// Worst-case estimated reservation per full analysis (approx. $0.02 USD = 20,000 micro-dollars)
export const WORST_CASE_RESERVATION_MICRO_DOLLARS = 20000;

export function calculateCallCostMicroDollars(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const config = getServerConfig();
  // If model is from a free provider or named :free, cost is 0
  if (model.includes(':free') || model.startsWith('mock')) {
    return 0;
  }
  const isAllFree = config.resolvedProviderOrder.every((p) => p.free);
  if (isAllFree) {
    return 0;
  }

  const price = DEFAULT_PRICE_TABLE[model] || UNLISTED_MODEL_FALLBACK_PRICE;
  const inputCostUsd = (promptTokens / 1_000_000) * price.inputPer1M;
  const outputCostUsd = (completionTokens / 1_000_000) * price.outputPer1M;
  const totalCostUsd = inputCostUsd + outputCostUsd;
  return Math.round(totalCostUsd * 1_000_000);
}

export async function isKillSwitchActive(store: SecurityStore = getSecurityStore()): Promise<boolean> {
  // 1. Check environment variable
  if (process.env.KILL_SWITCH === 'on' || process.env.KILL_SWITCH === 'true') {
    return true;
  }

  // 2. Check store flag
  try {
    const flag = await store.get('admin:kill_switch');
    return flag === 'on' || flag === 'true';
  } catch {
    return false;
  }
}

export async function checkAndReserveDailyBudget(
  store: SecurityStore = getSecurityStore()
): Promise<{ allowed: boolean; reason?: 'budget_exhausted' | 'kill_switch'; currentSpendMicroDollars?: number }> {
  // 1. Kill switch check
  if (await isKillSwitchActive(store)) {
    return { allowed: false, reason: 'kill_switch' };
  }

  const config = getServerConfig();
  const hasPaidProviders = config.resolvedProviderOrder.some((p) => !p.free);

  // If running purely free providers, bypass dollar reservation
  if (!hasPaidProviders) {
    return { allowed: true, currentSpendMicroDollars: 0 };
  }

  const dailyBudgetUsd = config.DAILY_AI_BUDGET_USD;
  const maxBudgetMicroDollars = Math.round(dailyBudgetUsd * 1_000_000);

  const utcDateKey = new Date().toISOString().split('T')[0];
  const spendKey = `budget:spend:${utcDateKey}`;

  try {
    // Check current spend
    const currentVal = await store.get(spendKey);
    const currentSpend = currentVal ? parseInt(currentVal, 10) || 0 : 0;

    if (currentSpend + WORST_CASE_RESERVATION_MICRO_DOLLARS > maxBudgetMicroDollars) {
      return {
        allowed: false,
        reason: 'budget_exhausted',
        currentSpendMicroDollars: currentSpend,
      };
    }

    // Reserve worst-case amount atomically
    const incRes = await store.incrementBy(spendKey, WORST_CASE_RESERVATION_MICRO_DOLLARS, 86400 * 2);
    if (incRes.total > maxBudgetMicroDollars) {
      // Revert reservation if it pushed over limit
      await store.incrementBy(spendKey, -WORST_CASE_RESERVATION_MICRO_DOLLARS, 86400 * 2);
      return {
        allowed: false,
        reason: 'budget_exhausted',
        currentSpendMicroDollars: incRes.total - WORST_CASE_RESERVATION_MICRO_DOLLARS,
      };
    }

    return { allowed: true, currentSpendMicroDollars: incRes.total };
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, reason: 'budget_exhausted' };
    }
    return { allowed: true, currentSpendMicroDollars: 0 };
  }
}

export async function reconcileBudgetSpend(
  actualCostMicroDollars: number,
  store: SecurityStore = getSecurityStore()
): Promise<void> {
  const config = getServerConfig();
  const hasPaidProviders = config.resolvedProviderOrder.some((p) => !p.free);
  if (!hasPaidProviders) return;

  const utcDateKey = new Date().toISOString().split('T')[0];
  const spendKey = `budget:spend:${utcDateKey}`;

  // Adjustment = actual cost minus initial worst-case reservation
  const adjustment = actualCostMicroDollars - WORST_CASE_RESERVATION_MICRO_DOLLARS;

  try {
    await store.incrementBy(spendKey, adjustment, 86400 * 2);
  } catch (err) {
    console.warn('[BUDGET] Failed to reconcile budget adjustment:', err);
  }
}

export async function releaseBudgetReservation(
  store: SecurityStore = getSecurityStore()
): Promise<void> {
  const config = getServerConfig();
  const hasPaidProviders = config.resolvedProviderOrder.some((p) => !p.free);
  if (!hasPaidProviders) return;

  const utcDateKey = new Date().toISOString().split('T')[0];
  const spendKey = `budget:spend:${utcDateKey}`;

  try {
    await store.incrementBy(spendKey, -WORST_CASE_RESERVATION_MICRO_DOLLARS, 86400 * 2);
  } catch (err) {
    console.warn('[BUDGET] Failed to release reservation:', err);
  }
}
