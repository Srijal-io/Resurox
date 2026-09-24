# Phase 4 Audit: Security, Abuse Controls & Request Hardening

**Date:** 2026-09-24  
**Scope:** `app/api/analyze/route.ts`, `lib/security/*`, `lib/ratelimit.ts`, `lib/extractor.ts`, `lib/enrichment/github.ts`, `next.config.ts`, and component rendering surfaces.  
**PRD Alignment:** §6 (SEC-01..SEC-29), §9, §11, §12 (TST-05, TST-08), §13.2 (PT-C, E, F, G, I, J, K).

---

## 1. Hosting Platform & Environment Limits

- **Platform:** Standard Node.js / Vercel Serverless / Cloudflare Pages / Standalone Node.js.
- **Function Duration Limit:** Configured as `export const maxDuration = 60;` in `app/api/analyze/route.ts`. `PIPELINE_DEADLINE_MS` default is 55,000ms (55s) with `AI_CALL_TIMEOUT_MS = 25000ms`.
- **Request Body Size Limit:** Max request size `MAX_REQUEST_BYTES` is 5MB (5,242,880 bytes).
- **Client-IP Header:** In production, reads the single header designated by `TRUSTED_IP_HEADER` (`x-vercel-forwarded-for`, `cf-connecting-ip`, or `x-real-ip`). Arbitrary client `x-forwarded-for` headers are ignored. If no trusted IP header is present, falls back to a shared strict `unknown` bucket.

---

## 2. Multipart Body Parsing & Buffering Audit

- **Current Behavior in `route.ts`:**
  - Calls `await req.formData()` directly after basic rate limit and credential header check.
  - The entire request payload is buffered into memory by Next.js before individual field sizes or streamed length overruns can be caught.
- **Target Phase 4 Hardened Flow:**
  - Fast fail-closed early checks:
    1. Kill switch (`KILL_SWITCH=on` or store flag) -> `SERVICE_BUSY` (503).
    2. Method check (POST only -> 405 with `Allow: POST`).
    3. Origin check (Same-origin or allowed origin list -> 403 `INVALID_REQUEST`).
    4. `Content-Length` pre-check against `MAX_REQUEST_BYTES` (5MB). Missing or invalid `Content-Length` on non-chunked bodies -> 400.
    5. Client IP extraction via `TRUSTED_IP_HEADER` -> `HMAC-SHA256(ip, IP_HASH_SALT)` -> Rate limiting (burst, daily, global).
    6. Bot check via header `X-Bot-Token` -> Turnstile verification before reading body.
    7. Concurrency semaphore check (`MAX_CONCURRENT_ANALYSES`) -> 503 `SERVICE_BUSY`.
    8. Daily AI budget check and reservation (`DAILY_AI_BUDGET_USD`).
    9. Streamed body byte-counter reading up to `MAX_REQUEST_BYTES`, then strict multipart parsing and field allow-list (`resume`, `jobDescription`).
    10. Execute `runAnalysisPipeline()`.
    11. In `finally`: release concurrency semaphore and reconcile budget reservation.

---

## 3. Rate Limiting & Client Identification Audit

- **Current Implementation (`lib/ratelimit.ts`):**
  - Uses an in-memory `Map<string, RateLimitEntry>` and an optional Upstash Redis REST pipeline.
  - Reads `x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, and then falls back to `x-forwarded-for`.
- **Phase 4 Hardened Requirements (SEC-13, SEC-14):**
  - Create unified `RateLimitStore` interface supporting `memory` (dev/test) and `upstash` (production Redis REST).
  - In production (`NODE_ENV=production`), missing or unreachable Upstash store fails closed (`SERVICE_BUSY`), unless `ALLOW_MEMORY_RATE_LIMIT_IN_PROD=true` is set.
  - Client IP must be hashed via `crypto.createHmac('sha256', IP_HASH_SALT).update(rawIp).digest('hex')`. Raw IP is never stored.
  - Enforce three limits: Burst per minute (`RL_BURST_PER_MIN`, default 3), Daily per IP (`RL_PER_DAY`, default 20), and Global per minute (`RL_GLOBAL_PER_MIN`, default 60).
  - Return HTTP 429 with `Retry-After` header.

---

## 4. Extraction & Upload Hardening Audit

- **Current PDF/DOCX Parsing (`lib/extractor.ts`):**
  - PDF: Uses `pdf2json` in-process with a 10s timeout and 100k character cap.
  - DOCX: Uses `mammoth.extractRawText` with a 10s timeout.
- **Phase 4 Hardened Requirements (SEC-05..SEC-09):**
  - **Magic Bytes Validation:** PDF must start with `%PDF-`; DOCX must be a ZIP (`PK\x03\x04`) containing `[Content_Types].xml` and `word/document.xml`.
  - **DOCX Pre-scan:** Inspect ZIP central directory before extraction (entry count $\le 1000$, uncompressed size $\le 10\text{MB}$, compression ratio $\le 100$, no nested archives, no `../` path traversal, reject `.docm`/`vbaProject.bin` macros).
  - **PDF Parser Sandboxing:** Run `pdf2json` parsing in an isolated `worker_threads` worker with strict memory limits and a hard termination timeout so memory bombs or parsing hangs cannot stall the server.
  - **Text Normalization (SEC-09):** Strip non-printable ASCII control characters, zero-width spaces, and bidi-override characters (`\u200B-\u200D`, `\uFEFF`, `\u202A-\u202E`). Collapse redundant whitespace while preserving paragraph breaks. Enforce `MIN_RESUME_CHARS` (50) and `MAX_RESUME_CHARS` (100,000).

---

## 5. GitHub Enrichment SSRF Audit

- **Current Implementation (`lib/enrichment/github.ts`):**
  - Validates username regex `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`.
  - Fetches `https://api.github.com/users/{user}/repos` with 3s timeout.
- **Phase 4 Hardened Requirements (SEC-16):**
  - Ensure candidate username comes only from server-side regex extraction of candidate text, never from user-supplied URL params or LLM hallucinations.
  - Hardcode target host to `api.github.com` over HTTPS; disable redirects (`redirect: 'error'`).
  - Set 5s timeout, 50KB response body cap. Failure is non-fatal and sets `meta.degraded += ['github_enrichment']`.

---

## 6. Module-Level State & Concurrency Isolation Audit

- **Audit Findings:**
  - `lib/ratelimit.ts`: Contains `ipRequests = new Map()`. Holds only hashed IP keys and timestamps; no resume data.
  - `lib/ai/breaker.ts`: Contains circuit breaker status and cooldown timestamps; no request data.
  - `lib/scoring/*`, `lib/matching/*`, `lib/evidence/*`: 100% pure functions, zero mutable module-level state.
- **Verification (SEC-25, PT-K):** All request contexts are ephemeral and stack-allocated. A parallel canary isolation test will assert that concurrent requests with unique canary tokens never leak across results or logs.

---

## 7. Logging & Privacy Audit

- **Current Logger:** `lib/pipeline/analyze.ts` uses structured JSON logs with `requestId`, stage name, duration, and status.
- **Phase 4 Hardened Requirements (SEC-24):**
  - Replace stray `console.*` calls with centralized structured logger.
  - Ensure logs contain only `requestId`, `stage`, `durationMs`, `errorCode`, `tokenCounts`, and `hashedIpPrefix`.
  - Never log raw resume/JD text, extracted skills, candidate names, filenames, or raw LLM output.
  - `DEBUG_AI_PAYLOADS=true` must cause startup failure when `NODE_ENV=production`.

---

## 8. Output Safety & XSS Audit

- **Components Audit:**
  - `components/ResumeDocument.tsx`: Uses React text nodes and spans with `{word}`. No `dangerouslySetInnerHTML`.
  - `components/MarginNote.tsx`, `components/FeedbackSection.tsx`, `components/ScoreDashboard.tsx`: Render text nodes only.
  - `components/JsonLd.tsx`: Contains only static site metadata schemas (no user data).
- **Phase 4 Protection (SEC-22):** Add automated test/lint rule verifying no `dangerouslySetInnerHTML` or `innerHTML` exists on user-derived content.

---

## 9. Next.js Configuration & Security Headers Audit

- **Current `next.config.ts`:**
  - Includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, and `Content-Security-Policy-Report-Only`.
- **Phase 4 Hardened Headers (SEC-18):**
  - Enforce `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and `X-Request-Id` on `/api/analyze`.
  - Provide strict CSP without `unsafe-eval`, allow Cloudflare Turnstile challenge domain only when `BOT_PROTECTION=turnstile`.
