# Resurox Phase 0 — Audit & Baseline Report

Date: 2026-09-24  
Status: Complete — Baseline Green  

---

## 1. Directory Tree & Architecture Audit

### Current Codebase Tree vs `PROJECT_CONTEXT.md` / PRD Target:
- **Root Layout & Pages:** Next.js 16 App Router (`app/page.tsx`, `app/app/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/contact/page.tsx`, `app/api/analyze/route.ts`).
- **Scoring & Domain Modules:**
  - `lib/scorer.ts`: Classic 4-dimension scoring (`computeOverallScore`: Skills 40%, Experience 25%, Education 15%, Semantic 20%).
  - `lib/scoring/rubric.ts`: 5-dimension multidimensional rubric (`computeMultiDimensionalScores`: overallEvaluation, jobMatchScore, evidenceStrengthScore, resumeQualityScore, atsCompatibilityScore, evidenceCoverage).
  - `lib/evidence/resolver.ts`: Resolves `MATCHED`, `CLAIMED_ONLY`, `PARTIALLY_MATCHED`, `MISSING`.
  - `lib/matching/requirements.ts`: Requirement match engine.
  - `lib/normalization/`: `skills.ts`, `synonyms.ts`.
  - `lib/enrichment/github.ts`: GitHub public repo enrichment.
  - `lib/extractor.ts`: PDF (`pdf-parse`, `pdf2json`) & DOCX (`mammoth`) text extraction.
  - `lib/ratelimit.ts`: Sliding window rate limiter with Upstash REST pipeline support + in-memory fallback.
  - `lib/env.ts`: `getEnvVar`, `resolveApiKey`.

---

## 2. BYOK Touchpoints Audit

### Frontend Touchpoints:
- `app/app/page.tsx`:
  - `provider` state (`openrouter` | `gemini` | `openai`), `apiKey`, `model`.
  - `localStorage` reading & writing: `ai_provider`, `ai_key_${provider}`, `ai_model_${provider}`.
  - UI Config Drawer (`showConfig`, Sliders button, provider selectors, API key input, Clear Key button).
  - Form submission sends `provider`, `apiKey`, `model` in FormData.

### Backend Touchpoints:
- `app/api/analyze/route.ts`:
  - Extracts `provider`, `rawApiKey`, `model` from `formData`.
  - Calls `resolveApiKey(rawApiKey, targetEnvVar)` which prioritizes client-submitted key over server env.
  - Passes client-configured `aiConfig` to `parseResume`, `parseJobDescription`, `generateUpgradedExplanation`.
- `lib/ai/client.ts`:
  - Receives `AIProviderConfig` with custom keys and models.
  - Supports fallback models on OpenRouter (including `:free` models by default).
- `lib/env.ts`:
  - `resolveApiKey` accepts `userInputKey` as first priority.

---

## 3. Fallback & Fabricated Data Audit

- `lib/ai.ts`: Hardcoded dummy skills (`['JavaScript', 'React', 'Node.js']`, `['React', 'TypeScript', 'Node.js']`) and generic scores in catch blocks (legacy module).
- `lib/ai/resumeParser.ts`: Contains `parseResumeHeuristically` (deterministic regex/section extractor from text) as catch fallback. Good baseline, but contains a default summary string fallback and dummy role dates if parsing fails.
- `lib/ai/jobParser.ts`: Contains `parseJobDescriptionHeuristically`. Has fallback generic skill list if zero skills found in 1-line text.
- `lib/ai/explanation.ts`: AI explanation generator with static template fallback.

---

## 4. Headline Score Audit (D-05)

- In `components/ResumeDocument.tsx`:
  - `ScoreStamp` displays: `multiDimensionalScores?.overallEvaluation ?? scores.overallScore`.
  - When multidimensional rubric is present, `overallEvaluation` (0–100) is the headline verdict.
- **Decision:** PRD D-05 mandates exactly one authoritative function produce `headlineScore` inside `lib/scoring`, and all UI elements read that field.

---

## 5. Security, HTML Rendering & XSS Audit

- `dangerouslySetInnerHTML`:
  - **Zero** instances in resume text, margin notes, feedback, or candidate rendering.
  - Found only in `components/JsonLd.tsx` for static schema.org JSON scripts.
- Text Rendering:
  - `ResumeDocument.tsx` splits text into tokens and renders React `<span>` / text nodes.
  - `MarginNote.tsx`, `RequirementMatrix.tsx`, `MultiScoreBreakdown.tsx` render pure text.

---

## 6. Hosting & Environment Parameters

- **Next.js Version:** `16.3.5` (Turbopack, App Router).
- **Function Timeout:** `export const maxDuration = 60;` in `route.ts`.
- **Client IP Resolution:** `lib/ratelimit.ts` currently reads `x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`.

---

## 7. EMUSER vs Resurox Branding Grep Audit

- Active branding is **Resurox**.
- `components/branding/EmuserLogo.tsx` is kept as a legacy alias for `ResuroxLogo.tsx`.
- `public/landing.html` and `SEO-AUDIT.md` have lingering EMUSER references that will be updated in docs/landing copy tasks.

---

## 8. Baseline Validation Results

- `npm test`: **PASS** (Regression suite & Scorer unit test green).
- `npm run typecheck`: **PASS** (`tsc --noEmit` exited 0).
- `npm run lint`: **0 errors**, 23 lint warnings (unused variables, explicit `any`).
- `npm run build`: **PASS** (All 15 routes compiled and static/dynamic generated successfully).

---

## 9. Next Steps for Phase 1
- Install `zod` for strict schema validation.
- Remove BYOK UI and client-side credential persistence in `app/app/page.tsx` (add localStorage purge for legacy keys).
- Secure `app/api/analyze/route.ts` and `lib/env.ts` to strictly read server environment variables and reject client-supplied credentials.
- Add startup config validation (`lib/config.ts` or `lib/ai/config.ts`).
