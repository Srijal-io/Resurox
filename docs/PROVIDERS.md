# AI Providers & Model Registry Guide

Resurox is an open-source, privacy-first AI resume analyzer engineered with a **provider-agnostic architecture**. You can swap, reorder, or add any OpenAI-compatible or Google Gemini model without modifying application code.

---

## 1. Provider Registry Configuration & Verification Sources

Providers are defined in [`config/ai-providers.ts`](../config/ai-providers.ts). Each entry specifies models, rate limits, pricing, personal data policy, and API key environment variables.

| Provider ID | Type | Base URL | Verification Source / Date | `acceptsPersonalData` | `hasPlaceholder` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `groq-free` | `openai-compatible` | `https://api.groq.com/openai/v1` | `https://console.groq.com/docs/models` & `https://console.groq.com/docs/rate-limits` (2026-09-25) | `false` (Owner must review) | `true` (Owner must fill active model/limits) |
| `ovh-free` (commented) | `openai-compatible` | `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1` | OVHcloud AI Endpoints Catalog (2026-09-25) | `false` | `true` |
| `mistral-free` (commented) | `openai-compatible` | `https://api.mistral.ai/v1` | `https://docs.mistral.ai/platform/endpoints` (2026-09-25) | `false` | `true` |

> ⚠️ **IMPORTANT SAFETY MANDATE:** Every built-in registry entry defaults to `acceptsPersonalData=false` and `hasPlaceholder=true`. The application startup sequence **refuses any provider** listed in `AI_PROVIDER_ORDER_RESUME` or `AI_PROVIDER_ORDER_EXPLAIN` (when `AI_EXPLANATION_MODE=llm`) until the owner explicitly verifies its terms and updates `acceptsPersonalData=true` and `hasPlaceholder=false`.

---

## 2. Groq Provider Specification (`groq-free`)

- **Base URL:** `https://api.groq.com/openai/v1` (OpenAI-compatible)
- **API Key Env:** `GROQ_API_KEY`
- **Deprecated Models (DO NOT USE):** `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` (Shutdown on 2026-08-16 per Groq deprecation notice).
- **Supported Active Models:** Owner should select an active model (e.g. `llama-3.3-70b-specdec` or `mixtral-8x7b-32768`) from `console.groq.com/docs/models`.
- **Groq Free Limits:**
  - `rpm`: 30 RPM (Groq free tier default rate limit)
  - `rpd`: 14,400 RPD
- **Pricing:** `inputPer1M: 0`, `outputPer1M: 0` (`free: true`)

---

## 3. How to Add or Re-Add an AI Provider

To add a new provider or re-add a removed provider (e.g., OpenRouter, Gemini, or OpenAI):

1. **Add Registry Entry in [`config/ai-providers.ts`](../config/ai-providers.ts):**
   ```typescript
   'provider-id': {
     id: 'provider-id',
     type: 'openai-compatible', // or 'gemini'
     baseUrl: 'https://api.provider.com/v1',
     apiKeyEnv: 'PROVIDER_API_KEY',
     models: {
       resume: 'model-name',
       job: 'model-name',
       explain: 'model-name',
     },
     free: true,
     acceptsPersonalData: false, // Set to true after reviewing terms
     reasoning: false,
     limits: { rpm: 30, rpd: 1000 },
     price: { inputPer1M: 0, outputPer1M: 0 },
     supportsJsonMode: true,
     maxOutputTokens: 4000,
     hasPlaceholder: false,
   }
   ```
2. **Configure Environment Variable:** Define `PROVIDER_API_KEY` in `.env.local` or host settings.
3. **Include in Order:** Add `provider-id` to `AI_PROVIDER_ORDER` or role-specific variables (`AI_PROVIDER_ORDER_RESUME`).

---

## 4. Deployment Configuration Example (`.env.local`)

To run Resurox locally using Groq in template mode (0 LLM calls for explanation):

```bash
# Provider Order Settings
AI_PROVIDER_ORDER_RESUME=groq-free
AI_PROVIDER_ORDER_JOB=groq-free
AI_PROVIDER_ORDER_EXPLAIN=groq-free
AI_PROVIDER_ORDER=groq-free

# API Credentials
GROQ_API_KEY=gsk_your_actual_groq_api_key

# Mode & Safety Controls
AI_EXPLANATION_MODE=template
ALLOW_FREE_PROVIDERS=true
DAILY_AI_BUDGET_USD=0

# Local Security & Abuse Settings
RATE_LIMIT_STORE=memory
TRUSTED_IP_HEADER=x-forwarded-for
IP_HASH_SALT=local_dev_secret_salt_123
BOT_PROTECTION=off
```

---

## 5. Provider Qualification Benchmark

Before using a model in production, qualify it with real benchmark data using:

```bash
npm run provider:qualify -- <provider-id> --max-calls=5
```

**Qualification Standards:**
- **Schema Valid Rate:** $\ge 95\%$
- **Average Grounding Drop Rate:** $< 20\%$
- **Headline Score Drift vs Baseline:** $\le \pm 3.0\text{ points}$
