# Phase 4b Audit: Provider-Agnostic Gateway & Free-Tier Quota Control

## 1. How Providers Are Hardcoded Today

### Enum & Switch References
- **`lib/ai/client.ts`**:
  - `export type AIProvider = 'openrouter' | 'gemini' | 'openai' | 'mock';`
  - Hardcoded switch branch for `gemini` using Google GenAI SDK `@google/genai`.
  - Hardcoded switch branch for `openai` hitting `https://api.openai.com/v1/chat/completions`.
  - OpenRouter is not even an explicit branch in `callAIClient`; it relies on Gemini/OpenAI SDK branches or mock.
- **`lib/ai/gateway.ts`**:
  - `const providerBreakers: Record<string, CircuitBreaker> = { openrouter: ..., gemini: ..., openai: ..., mock: ... };`
  - Breaker state and retry handling assume single static provider `AI_PRIMARY_PROVIDER`.
- **`lib/config.ts`**:
  - `AI_PRIMARY_PROVIDER: z.enum(['openrouter', 'gemini', 'openai', 'mock']).default('openrouter')`
  - `getProviderApiKey(provider: 'openrouter' | 'gemini' | 'openai')` uses hardcoded if-checks for `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`.

### The `:free` Model Detection
- **`lib/config.ts:L90`**:
  - `!config.ALLOW_FREE_MODELS && (config.AI_MODEL_EXTRACT.includes(':free') || config.AI_MODEL_EXPLAIN.includes(':free'))`
  - Relies on string sniffing `includes(':free')` which is specific to OpenRouter model naming conventions.

### Price Table, Breaker, and Budget Code
- **`lib/security/budget.ts`**:
  - `DEFAULT_PRICE_TABLE`: Hardcodes models `'google/gemini-2.5-flash'`, `'openai/gpt-4o-mini'`, `'mock'`, etc.
  - Spend tracking treats the dollar budget as the sole metric, reserving worst-case $0.02 USD per request across all providers indiscriminately.
  - Does not track requests-per-minute (RPM) or requests-per-day (RPD) quotas for free providers or individual providers.
  - Does not place providers into dynamic cooldown upon receiving HTTP 429 (`Retry-After`).

---

## 2. How Configuration is Validated

- **`lib/config.ts`**:
  - Validates `envSchema` via Zod.
  - Enforces production checks:
    - Rejects `AI_PRIMARY_PROVIDER === 'mock'` in production.
    - Rejects `RATE_LIMIT_STORE === 'memory'` unless `ALLOW_MEMORY_RATE_LIMIT_IN_PROD === 'true'`.
    - Requires `DAILY_AI_BUDGET_USD > 0` in production.
  - Lacks dynamic validation for custom provider order, unknown provider IDs, base URLs, or missing env variable keys defined by a dynamic registry.

---

## 3. Where Provider Names and IDs Appear Across the Repository

- **Application Code**:
  - `lib/ai/client.ts`: `openrouter`, `gemini`, `openai`, `mock`
  - `lib/ai/gateway.ts`: `openrouter`, `gemini`, `openai`, `mock`
  - `lib/config.ts`: `openrouter`, `gemini`, `openai`, `mock`
  - `lib/security/budget.ts`: Model names in `DEFAULT_PRICE_TABLE`
  - `lib/types/analysis.ts` / `lib/pipeline/errors.ts`: Generalized error codes without leaking provider names.
- **Tests**:
  - `tests/phase1.test.ts`, `tests/phase2.test.ts`, `tests/security_route.test.ts`, `tests/security_privacy.test.ts`: Set `process.env.AI_PRIMARY_PROVIDER = 'mock'`.
- **Environment & Documentation**:
  - `.env.example`: Lists `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `AI_PRIMARY_PROVIDER`, `AI_MODEL_EXTRACT`.
  - `docs/PRD_KEYLESS_AI.md`: Documents OpenRouter / Gemini fallback sequence.

---

## 4. Required Phase 4b Architecture & Plan

1. **`config/ai-providers.ts`**:
   - Provider Registry with Zod schema (`id`, `type`, `baseUrl`, `apiKeyEnv`, `models`, `free`, `limits`, `price`, `supportsJsonMode`, `maxOutputTokens`, `notes`).
   - Built-in presets: `openrouter-free`, `gemini-free`, `gemini-paid`, `openrouter-paid`, `openai-paid`, `mock`.
   - Parsing `AI_PROVIDER_ORDER` to establish fallback chain.
2. **Generic OpenAI-Compatible Adapter (`lib/ai/providers/openai-compatible.ts`) + Native Gemini Adapter (`lib/ai/providers/gemini.ts`)**:
   - Standardized interface `AIProviderAdapter`.
   - Native Gemini adapter using `@google/genai`.
   - OpenAI-compatible adapter using standard `fetch` with `AbortSignal`, JSON mode / markdown extraction fallback, and HTTP status mapping (429 $\to$ `AI_RATE_LIMITED` with `Retry-After`, 401/403 $\to$ `AI_AUTH_FAILED`, 5xx $\to$ transient).
3. **Per-Provider Quota & Cooldown Tracking (`lib/security/provider-quota.ts`)**:
   - RPM and RPD atomic counters in `SecurityStore`.
   - Cooldown timestamp tracking upon 429 (`Retry-After`).
   - Pre-call quota reservation and post-call reconciliation.
   - Circuit breaker integration per provider.
4. **Dollar Accounting for Paid Providers Only**:
   - Free providers bypass dollar budget tracking (only RPM/RPD counted).
   - Paid providers check `DAILY_AI_BUDGET_USD` (if 0, paid providers skipped).
   - `ALLOW_FREE_PROVIDERS` flag (with backward compatibility for `ALLOW_FREE_MODELS`).
5. **Calls Optimization (`AI_EXPLANATION_MODE=llm|template`)**:
   - In `template` mode, zero LLM calls for explanation (100% deterministic template fallback, not marked as degraded).
   - Startup log reporting exact analysis capacity per day based on registry limits and calls-per-analysis.
6. **Qualification Script (`scripts/qualify-provider.ts`)**:
   - `npm run provider:qualify -- <provider-id> [--max-calls=5]` to benchmark real provider schema validity, grounding drop rate, and score drift.
7. **Documentation**:
   - `docs/PROVIDERS.md` and `SECURITY.md`.
