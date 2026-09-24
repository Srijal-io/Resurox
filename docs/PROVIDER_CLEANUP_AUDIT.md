# Provider Cleanup Audit & Dependency Analysis

**Date:** September 25, 2026  
**Task:** Audit and removal of unused built-in provider entries (`openrouter-free`, `gemini-free`, `gemini-paid`, `openai-paid`, `anonymous-local`).

---

## 1. Audit Findings Per Entry

### A. `openrouter-free`
- **Source references:** Listed in `DEFAULT_PROVIDER_REGISTRY` (`config/ai-providers.ts`), fallback handling in `lib/config.ts` (`getProviderApiKey`), and `resolveApiKey` default parameter in `lib/env.ts`.
- **Test references:** Used in `tests/phase4b.test.ts` for testing startup refusal on `hasPlaceholder=true` and reasoning model `finish_reason=length`.
- **Docs/Configs:** Mentioned in `.env.example`, `docs/PROVIDERS.md`, `README.md`, `app/privacy/page.tsx`, and `app/terms/page.tsx`.
- **Decision:** **SAFE TO REMOVE**. Replace in `DEFAULT_PROVIDER_REGISTRY` with clean single-provider setup (`groq-free` + `mock`).

### B. `gemini-free`
- **Source references:** Listed in `DEFAULT_PROVIDER_REGISTRY`, fallback handling in `lib/config.ts` (`getProviderApiKey`).
- **Test references:** Used extensively across `tests/phase4b.test.ts` for quota/cooldown tests and `acceptsPersonalData` refusal tests.
- **Docs/Configs:** Mentioned in `.env.example`, `docs/PROVIDERS.md`, `README.md`, `app/privacy/page.tsx`, and `app/terms/page.tsx`.
- **Decision:** **SAFE TO REMOVE**. Retarget `tests/phase4b.test.ts` to `mock` or `groq-free`-shaped test objects.

### C. `gemini-paid`
- **Source references:** Listed in `DEFAULT_PROVIDER_REGISTRY`, fallback handling in `lib/config.ts` (`getProviderApiKey`).
- **Test references:** None.
- **Docs/Configs:** None.
- **Decision:** **SAFE TO REMOVE**. Unused example entry.

### D. `openai-paid`
- **Source references:** Listed in `DEFAULT_PROVIDER_REGISTRY`, fallback handling in `lib/config.ts` (`getProviderApiKey`).
- **Test references:** None.
- **Docs/Configs:** Mentioned in `README.md`, `app/privacy/page.tsx`, `app/terms/page.tsx`.
- **Decision:** **SAFE TO REMOVE**. Unused example entry.

### E. `anonymous-local`
- **Source references:** Listed in `DEFAULT_PROVIDER_REGISTRY`.
- **Test references:** Used in `tests/phase4b.test.ts` for non-https baseUrl production refusal and anonymous header tests.
- **Docs/Configs:** None.
- **Decision:** **SAFE TO REMOVE**. Retarget test cases to a dynamic mock/anonymous test object in `tests/phase4b.test.ts`.

---

## 2. API Key Environment Variable References

- `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`:
  - `lib/config.ts`: Defined in `envSchema` and fallback helper `getProviderApiKey`.
  - `lib/env.ts`: Default parameter in `resolveApiKey`.
  - `tests/phase1.test.ts`: Used to test server key isolation.
  - `.env.example`: Listed under provider API keys.
  - `README.md`: Mentioned in setup instructions.

**Decision on Env Vars:** Remove from `envSchema` in `lib/config.ts`, `.env.example`, and `README.md`. Keep `getProviderApiKey` flexible so it dynamically resolves any `apiKeyEnv` name specified on active registry entries. Retarget `tests/phase1.test.ts` to `GROQ_API_KEY` or `MOCK_API_KEY`.

---

## 3. Startup & Dependency Audit Answers

1. **Startup Validation & Default Behavior:**
   - Previously, if `AI_PROVIDER_ORDER` was unset, `lib/config.ts` fell back to `rawConfig.AI_PRIMARY_PROVIDER || 'mock'`.
   - **New Requirement:** The app MUST require an explicit `AI_PROVIDER_ORDER` (or role orders) with **no silent default provider**. If unset, startup fails with:
     `[Config Error] AI_PROVIDER_ORDER (or role-specific orders) must be explicitly configured. No default provider is assumed.`

2. **Adapters & Dependencies (@google/genai):**
   - The native Gemini adapter (`lib/ai/providers/gemini.ts`) and `@google/genai` dependency remain intact for future Gemini model additions.
   - Size/Usage Impact: `@google/genai` is only loaded if a entry with `type: 'gemini'` is included in `DEFAULT_PROVIDER_REGISTRY` and executed. Leaving the adapter in place causes 0 runtime bundle overhead for Next.js app routes when using OpenAI-compatible providers (`groq-free`).

3. **User-Facing Privacy & Terms Text:**
   - User-facing text in `app/privacy/page.tsx` and `app/terms/page.tsx` updated to generic terms ("third-party AI providers that can change over time") without explicitly naming removed providers (`OpenRouter`, `Gemini`, `OpenAI`).

---

## 4. Test Retargeting Plan

| Test File & Name | Previous Entry | Retargeted Entry / Setup | Preserved Assertion |
|---|---|---|---|
| `tests/phase1.test.ts` (key resolution) | `OPENROUTER_API_KEY` / `GEMINI_API_KEY` | `GROQ_API_KEY` / `MOCK_API_KEY` | Server key ownership & refusal of client keys |
| `tests/phase4b.test.ts` (Missing key error) | `gemini-free` | `groq-free` | Refuses startup when listed provider key is missing |
| `tests/phase4b.test.ts` (Non-https baseUrl) | `anonymous-local` | Dynamic test entry with `baseUrl: http://...` | Refuses non-https baseUrl in production |
| `tests/phase4b.test.ts` (Duplicate provider) | `gemini-free,gemini-free` | `groq-free,groq-free` | Refuses duplicate provider IDs in order |
| `tests/phase4b.test.ts` (Free in prod without flag) | `gemini-free` | `groq-free` | Refuses free provider in prod without `ALLOW_FREE_PROVIDERS=true` |
| `tests/phase4b.test.ts` (Unfilled placeholders) | `openrouter-free` | `groq-free` | Refuses listed provider with `hasPlaceholder=true` |
| `tests/phase4b.test.ts` (Exhausted providers 503) | `gemini-free` | `groq-free` | Returns 503 `SERVICE_BUSY` with `Retry-After` header |
| `tests/phase4b.test.ts` (Per-role refusal) | `anonymous-local` | `groq-free` | Refuses RESUME role when `acceptsPersonalData=false` |

---

## 5. Decision Summary

- **Removed Entries:** `openrouter-free`, `gemini-free`, `gemini-paid`, `openai-paid`, `anonymous-local`.
- **Kept Entries:** `mock`, `groq-free`, and commented examples `ovh-free` & `mistral-free`.
- **Safety Status:** **VERIFIED SAFE**. Removal simplifies the registry, eliminates unverified data terms, and enforces explicit server configuration.
