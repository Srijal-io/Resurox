import { z } from 'zod';
import { DEFAULT_PROVIDER_REGISTRY, ProviderRegistryEntry, resolveProviderBaseUrl } from '../config/ai-providers';

/**
 * Server Configuration & Validation (PRD §6, §7, Phase 4b §1, §4, §5 & Addendum A-F).
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Dynamic Provider Selection & Order (Per-role Addendum A)
  AI_PROVIDER_ORDER: z.string().optional(),
  AI_PROVIDER_ORDER_RESUME: z.string().optional(),
  AI_PROVIDER_ORDER_JOB: z.string().optional(),
  AI_PROVIDER_ORDER_EXPLAIN: z.string().optional(),

  AI_PRIMARY_PROVIDER: z.string().default('mock'),
  ALLOW_FREE_PROVIDERS: z.string().optional().transform((v) => v === 'true'),
  ALLOW_FREE_MODELS: z.string().optional().transform((v) => v === 'true'), // Alias for backward compat

  // AI Pipeline Execution Options
  AI_EXPLANATION_MODE: z.enum(['llm', 'template']).default('llm'),

  // Numeric Limits & Timeouts
  MAX_REQUEST_BYTES: z.coerce.number().default(6291456),
  MAX_RESUME_BYTES: z.coerce.number().default(5242880),
  MAX_PDF_PAGES: z.coerce.number().default(10),
  MIN_RESUME_CHARS: z.coerce.number().default(50),
  MAX_RESUME_CHARS: z.coerce.number().default(100000),
  MIN_JD_CHARS: z.coerce.number().default(50),
  MAX_JD_CHARS: z.coerce.number().default(50000),
  AI_MAX_OUTPUT_TOKENS_RESUME: z.coerce.number().default(3000),
  AI_MAX_OUTPUT_TOKENS_JOB: z.coerce.number().default(1500),
  AI_MAX_OUTPUT_TOKENS_EXPLAIN: z.coerce.number().default(1200),
  AI_CALL_TIMEOUT_MS: z.coerce.number().default(25000),
  PIPELINE_DEADLINE_MS: z.coerce.number().default(55000),
  AI_MAX_RETRIES: z.coerce.number().default(1),
  MAX_CONCURRENT_ANALYSES: z.coerce.number().default(4),

  // Abuse & Rate Limiting
  RATE_LIMIT_STORE: z.enum(['memory', 'upstash']).default('memory'),
  ALLOW_MEMORY_RATE_LIMIT_IN_PROD: z.string().optional().transform((v) => v === 'true'),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  TRUSTED_IP_HEADER: z.string().optional(),
  IP_HASH_SALT: z.string().default('resurox_dev_salt'),
  RL_BURST_PER_MIN: z.coerce.number().default(3),
  RL_PER_DAY: z.coerce.number().default(20),
  RL_GLOBAL_PER_MIN: z.coerce.number().default(60),
  DAILY_AI_BUDGET_USD: z.coerce.number().default(10.0),
  BUDGET_WARN_RATIO: z.coerce.number().default(0.8),
  KILL_SWITCH: z.string().optional().transform((v) => v === 'on' || v === 'true'),

  // Bot Protection
  BOT_PROTECTION: z.enum(['off', 'turnstile']).default('off'),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

  // Origin & Networking
  ALLOWED_ORIGINS: z.string().optional(),

  // Features & Debug
  ENABLE_GITHUB_ENRICHMENT: z.string().optional().transform((v) => v !== 'false'),
  GITHUB_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEBUG_AI_PAYLOADS: z.string().optional().transform((v) => v === 'true'),
});

export type ServerConfig = z.infer<typeof envSchema> & {
  resolvedProviderOrder: ProviderRegistryEntry[];
  resolvedRoleOrders: {
    resume: ProviderRegistryEntry[];
    job: ProviderRegistryEntry[];
    explain: ProviderRegistryEntry[];
  };
};

let _config: ServerConfig | null = null;

export function resetServerConfigForTesting(): void {
  _config = null;
}

export function getServerConfig(): ServerConfig {
  if (_config) return _config;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errorIssues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`[Config Error] Invalid server environment configuration: ${errorIssues}`);
  }

  const rawConfig = parsed.data;

  // Resolve base order string: MUST be explicitly set via AI_PROVIDER_ORDER or AI_PRIMARY_PROVIDER
  const rawOrderStr = rawConfig.AI_PROVIDER_ORDER || rawConfig.AI_PRIMARY_PROVIDER;
  if (!rawOrderStr && process.env.NODE_ENV !== 'test') {
    throw new Error(
      '[Config Error] AI_PROVIDER_ORDER (or role-specific orders) must be explicitly configured. No default provider is assumed.'
    );
  }
  const baseOrderString = rawOrderStr || 'mock';

  const parseOrderString = (orderStr: string, roleName: 'resume' | 'job' | 'explain' | 'general'): ProviderRegistryEntry[] => {
    const orderIds = orderStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (orderIds.length === 0) {
      throw new Error(`[Config Error] Provider order for ${roleName} must contain at least one provider id.`);
    }

    const seenIds = new Set<string>();
    const resolved: ProviderRegistryEntry[] = [];

    for (const id of orderIds) {
      if (seenIds.has(id)) {
        throw new Error(`[Config Error] Duplicate provider id "${id}" in provider order for ${roleName}.`);
      }
      seenIds.add(id);

      const entry = DEFAULT_PROVIDER_REGISTRY[id];
      if (!entry) {
        throw new Error(
          `[Config Error] Unknown provider id "${id}" in provider order for ${roleName}. Available ids: ${Object.keys(
            DEFAULT_PROVIDER_REGISTRY
          ).join(', ')}`
        );
      }

      // Part 1 §6: Refuse provider with unfilled owner placeholders
      if (entry.hasPlaceholder) {
        throw new Error(`[Config Error] Provider "${id}" contains unfilled TODO_OWNER placeholders (hasPlaceholder=true). Owner must verify and update config before enabling.`);
      }

      // Addendum B: acceptsPersonalData check (bypassed for mock in dev/test)
      const isMockInDevTest = (id === 'mock' || entry.type === 'mock') && rawConfig.NODE_ENV !== 'production';
      if (roleName === 'resume' && !entry.acceptsPersonalData && !isMockInDevTest) {
        throw new Error(`[Config Error] Provider "${id}" does not have acceptsPersonalData=true, required for RESUME role.`);
      }
      if (roleName === 'explain' && rawConfig.AI_EXPLANATION_MODE === 'llm' && !entry.acceptsPersonalData && !isMockInDevTest) {
        throw new Error(`[Config Error] Provider "${id}" does not have acceptsPersonalData=true, required for EXPLAIN role in LLM mode.`);
      }

      // Addendum C: apiKeyEnv null check
      if (entry.apiKeyEnv !== null) {
        const apiKey = process.env[entry.apiKeyEnv]?.trim();
        if (!apiKey && id !== 'mock') {
          throw new Error(`[Config Error] Provider "${id}" listed in order but missing required environment variable "${entry.apiKeyEnv}".`);
        }
      }

      // Mock provider forbidden in production (AI-13, A11)
      if (rawConfig.NODE_ENV === 'production' && (id === 'mock' || entry.type === 'mock')) {
        throw new Error('[Config Error] Mock AI provider is prohibited in production environment.');
      }

      // Addendum D: baseUrl placeholder resolution and HTTPS validation
      const resolvedUrl = resolveProviderBaseUrl(entry);

      // BaseURL security: must be HTTPS in production
      if (rawConfig.NODE_ENV === 'production' && !resolvedUrl.startsWith('https://')) {
        throw new Error(`[Config Error] Provider "${id}" must use HTTPS baseUrl in production.`);
      }

      resolved.push(entry);
    }
    return resolved;
  };

  const resolvedProviderOrder = parseOrderString(baseOrderString, 'general');
  const resumeOrderStr = rawConfig.AI_PROVIDER_ORDER_RESUME || baseOrderString;
  const jobOrderStr = rawConfig.AI_PROVIDER_ORDER_JOB || baseOrderString;
  const explainOrderStr = rawConfig.AI_PROVIDER_ORDER_EXPLAIN || baseOrderString;

  const resolvedRoleOrders = {
    resume: parseOrderString(resumeOrderStr, 'resume'),
    job: parseOrderString(jobOrderStr, 'job'),
    explain: parseOrderString(explainOrderStr, 'explain'),
  };

  const config: ServerConfig = {
    ...rawConfig,
    resolvedProviderOrder,
    resolvedRoleOrders,
  };

  // Strict Production Validations (AI-14, D-10, SEC-13, SEC-14, SEC-15, SEC-20, SEC-24)
  if (config.NODE_ENV === 'production') {
    if (config.DEBUG_AI_PAYLOADS) {
      throw new Error('[Config Error] DEBUG_AI_PAYLOADS must be false in production.');
    }
    const allowFree = config.ALLOW_FREE_PROVIDERS || config.ALLOW_FREE_MODELS;
    const hasFree = resolvedProviderOrder.some((p) => p.free);
    if (hasFree && !allowFree) {
      throw new Error(
        '[Config Error] Free AI providers are not allowed in production without ALLOW_FREE_PROVIDERS=true.'
      );
    }
    if (config.DAILY_AI_BUDGET_USD === undefined || config.DAILY_AI_BUDGET_USD < 0) {
      throw new Error('[Config Error] DAILY_AI_BUDGET_USD is required and must be >= 0 in production.');
    }
    if (config.RATE_LIMIT_STORE === 'memory' && !config.ALLOW_MEMORY_RATE_LIMIT_IN_PROD) {
      throw new Error(
        '[Config Error] RATE_LIMIT_STORE=memory is prohibited in production unless ALLOW_MEMORY_RATE_LIMIT_IN_PROD=true is set.'
      );
    }
    if (
      config.RATE_LIMIT_STORE === 'upstash' &&
      (!config.UPSTASH_REDIS_REST_URL || !config.UPSTASH_REDIS_REST_TOKEN)
    ) {
      throw new Error(
        '[Config Error] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required when RATE_LIMIT_STORE=upstash in production.'
      );
    }
    if (config.BOT_PROTECTION === 'turnstile' && !config.TURNSTILE_SECRET_KEY) {
      throw new Error('[Config Error] TURNSTILE_SECRET_KEY is required when BOT_PROTECTION=turnstile in production.');
    }
    if (!config.TRUSTED_IP_HEADER) {
      throw new Error('[Config Error] TRUSTED_IP_HEADER must be explicitly configured in production.');
    }
    if (!config.IP_HASH_SALT || config.IP_HASH_SALT === 'resurox_dev_salt') {
      throw new Error('[Config Error] IP_HASH_SALT must be configured with a production secret in production.');
    }
  }

  _config = config;
  return _config;
}

/**
 * Returns API key for a requested provider from server environment only.
 */
export function getProviderApiKey(providerOrEnvName: string): string {
  if (process.env[providerOrEnvName]) {
    return process.env[providerOrEnvName]!.trim();
  }
  const registryEntry = DEFAULT_PROVIDER_REGISTRY[providerOrEnvName];
  if (registryEntry?.apiKeyEnv && process.env[registryEntry.apiKeyEnv]) {
    return process.env[registryEntry.apiKeyEnv]!.trim();
  }
  throw new Error(`API key for provider or env "${providerOrEnvName}" is not configured on the server.`);
}

export function getEnvVar(key: string, defaultValue: string = ''): string {
  return process.env[key]?.trim() || defaultValue;
}
