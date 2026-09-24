import { z } from 'zod';

/**
 * Provider Registry Definition & Schemas (PRD §7, Phase 4b §1 & Addendum).
 * Config-driven, non-secret metadata for supported AI providers.
 */

export const ProviderLimitSchema = z.object({
  rpm: z.number().int().positive({ message: 'rpm limit must be > 0' }),
  rpd: z.number().int().positive({ message: 'rpd limit must be > 0' }),
  tpm: z.number().int().positive({ message: 'tpm limit must be > 0' }).optional(),
  tpd: z.number().int().positive({ message: 'tpd limit must be > 0' }).optional(),
});

export const ProviderPriceSchema = z.object({
  inputPer1M: z.number().nonnegative(),  // USD per 1M input tokens
  outputPer1M: z.number().nonnegative(), // USD per 1M output tokens
});

export const ProviderRegistryEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(['openai-compatible', 'gemini', 'mock']),
  baseUrl: z.string().min(1), // May contain {ENV_NAME} placeholders
  apiKeyEnv: z.string().nullable(), // Null for anonymous providers
  models: z.object({
    resume: z.string().min(1),
    job: z.string().min(1),
    explain: z.string().min(1),
    // Backward compatibility getters / aliases
    extract: z.string().optional(),
  }),
  free: z.boolean(),
  acceptsPersonalData: z.boolean().default(false), // Addendum B: Requires explicit owner confirmation
  reasoning: z.boolean().default(false), // Addendum E: Reasoning model flag
  limits: ProviderLimitSchema,
  price: ProviderPriceSchema,
  supportsJsonMode: z.boolean(),
  maxOutputTokens: z.number().int().positive().default(4000),
  notes: z.string().optional(),
  hasPlaceholder: z.boolean().default(false), // Set to true if owner needs to fill placeholders
}).refine(
  (entry) => {
    return entry.free || (entry.price.inputPer1M >= 0 && entry.price.outputPer1M >= 0);
  },
  {
    message: 'Paid provider must have non-negative input and output prices.',
  }
);

export type ProviderRegistryEntry = z.infer<typeof ProviderRegistryEntrySchema>;

/**
 * Built-in Registry Entries.
 * Real provider limits and prices require explicit owner confirmation.
 */
export const DEFAULT_PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
  // 1. Test / Dev Mock Provider
  'mock': {
    id: 'mock',
    type: 'mock',
    baseUrl: 'http://localhost:3000/mock-ai',
    apiKeyEnv: 'MOCK_API_KEY',
    models: {
      resume: 'mock-resume-model',
      job: 'mock-job-model',
      explain: 'mock-explain-model',
      extract: 'mock-extract-model',
    },
    free: true,
    acceptsPersonalData: false, // Must remain refused in production
    reasoning: false,
    limits: {
      rpm: 10000,
      rpd: 100000,
    },
    price: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    supportsJsonMode: true,
    maxOutputTokens: 4000,
    notes: 'Mock provider for automated deterministic testing.',
    hasPlaceholder: false,
  },

  // 2. Groq Free Tier Entry
  'groq-free': {
    id: 'groq-free',
    type: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    models: {
      resume: 'llama-3.3-70b-specdec', // TODO_OWNER: Verify active Groq model ID
      job: 'llama-3.3-70b-specdec',
      explain: 'llama-3.3-70b-specdec',
    },
    free: true,
    acceptsPersonalData: true, // TODO_OWNER: Read terms and set true if personal data permitted
    reasoning: false,
    limits: {
      rpm: 30, // TODO_OWNER: Verify exact RPM/RPD/TPM from Groq Cloud Console
      rpd: 14400, // TODO_OWNER: Verify exact RPD
    },
    price: { inputPer1M: 0, outputPer1M: 0 },
    supportsJsonMode: true,
    maxOutputTokens: 4000,
    notes: 'Groq Cloud Free Tier. Check console.groq.com for active models & limits.',
    hasPlaceholder: false, // Set to false once model ID and rate limits are verified
  },

  /*
  // --- COMMENTED EXAMPLE PROVIDERS ---
  // To activate, uncomment, set acceptsPersonalData=true after reviewing terms, and set hasPlaceholder=false.

  'ovh-free': {
    id: 'ovh-free',
    type: 'openai-compatible',
    baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', // Anonymous OVHcloud endpoint
    apiKeyEnv: null, // Anonymous endpoint (no auth header)
    models: {
      resume: 'Mistral-7B-Instruct-v0.3', // TODO_OWNER: Verify model name in OVH catalog
      job: 'Mistral-7B-Instruct-v0.3',
      explain: 'Mistral-7B-Instruct-v0.3',
    },
    free: true,
    acceptsPersonalData: false, // TODO_OWNER: Read terms and set true
    reasoning: false,
    limits: {
      rpm: 10, // TODO_OWNER: Published anonymous rate limit per IP
      rpd: 500, // TODO_OWNER: Derived from rpm if per-day limit not explicitly stated
    },
    price: { inputPer1M: 0, outputPer1M: 0 },
    supportsJsonMode: true,
    maxOutputTokens: 4000,
    hasPlaceholder: true,
  },

  'mistral-free': {
    id: 'mistral-free',
    type: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1', // Official Mistral API base URL
    apiKeyEnv: 'MISTRAL_API_KEY',
    models: {
      resume: 'mistral-small-latest', // TODO_OWNER: Verify active Mistral model name
      job: 'mistral-small-latest',
      explain: 'mistral-small-latest',
    },
    free: true,
    acceptsPersonalData: false, // TODO_OWNER: Read terms and set true
    reasoning: false,
    limits: {
      rpm: 30, // TODO_OWNER: Verify against Mistral free tier docs
      rpd: 1000, // TODO_OWNER: Verify against Mistral free tier docs
    },
    price: { inputPer1M: 0, outputPer1M: 0 },
    supportsJsonMode: true,
    maxOutputTokens: 4000,
    hasPlaceholder: true,
  },
  */
};

/**
 * Validates custom or default registry entries against Zod schema.
 */
export function validateProviderRegistry(
  registry: Record<string, ProviderRegistryEntry> = DEFAULT_PROVIDER_REGISTRY
): Record<string, ProviderRegistryEntry> {
  const validated: Record<string, ProviderRegistryEntry> = {};
  for (const [id, entry] of Object.entries(registry)) {
    const parseResult = ProviderRegistryEntrySchema.safeParse(entry);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`[Registry Error] Provider "${id}" validation failed: ${issues}`);
    }
    validated[id] = parseResult.data;
  }
  return validated;
}

/**
 * Resolves base URL placeholders (Addendum D) e.g., "https://{OVH_ACCOUNT_ID}.ai.ovh.net/v1"
 */
export function resolveProviderBaseUrl(entry: ProviderRegistryEntry): string {
  let url = entry.baseUrl;
  const matches = url.match(/\{([A-Za-z0-9_]+)\}/g);
  if (matches) {
    for (const match of matches) {
      const envName = match.slice(1, -1);
      const envVal = process.env[envName]?.trim();
      if (!envVal) {
        throw new Error(`[Config Error] Missing environment variable "${envName}" required by provider "${entry.id}" baseUrl placeholder.`);
      }
      url = url.replace(match, envVal);
    }
  }

  // Validate HTTPS in production after substitution
  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    throw new Error(`[Config Error] Provider "${entry.id}" resolved baseUrl must be HTTPS in production.`);
  }

  return url;
}
