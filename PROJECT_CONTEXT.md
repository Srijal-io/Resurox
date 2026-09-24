# AI Resume Analyzer ("Resurox") — Project Context & Architecture

Comprehensive context document designed for LLM agents and developers to quickly understand the codebase, architecture, scoring formulas, data models, and development conventions.

---

## 1. Project Overview

**AI Resume Analyzer** (also referenced as **Resurox**) is a privacy-first, single-session web application for objective, explainable resume-to-job match scoring.

### Core Value Proposition & Philosophy
- **Deterministic Math Scoring:** Prevents LLM score hallucination and bias by isolating all numerical scores to pure mathematical formulas in TypeScript (`lib/scorer.ts`, `lib/scoring/rubric.ts`).
- **Constrained LLM Role:** LLMs are strictly used for structured entity extraction (`lib/ai/resumeParser.ts`, `lib/ai/jobParser.ts`) and qualitative feedback/executive summaries (`lib/ai/explanation.ts`), never for generating arbitrary numerical scores.
- **Privacy & Single-Session:** Zero database persistence for uploaded resumes. Processing happens in-memory with optional external provider keys.
- **Editorial Manuscript UI:** Asymmetric split manuscript layout (document view with inline underlines + editorial margin callout notes + stamped physical verdict seal).

---

## 2. Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **UI / Styling:** Tailwind CSS v4, Vanilla CSS design tokens, Lucide React icons
- **Document Parsing:**
  - PDF: `pdf2json` / `pdf-parse`
  - DOCX: `mammoth`
- **AI Integrations:** Provider-agnostic gateway architecture (`lib/ai/gateway.ts`, `config/ai-providers.ts`)
  - Groq Cloud (`llama-3.3-70b-specdec` / OpenAI-compatible API)
  - Google Gemini (`@google/genai` native adapter)
  - Local / Test Mock Provider (`lib/ai/gateway.ts`)
- **Testing & Verification:** Native Node test runner (`npm test`), Fast-Check property testing, and Provider Qualification Benchmark (`scripts/qualify-provider.ts`)
- **Code Quality:** ESLint 9, TypeScript strict mode

---

## 3. Directory Structure

```plaintext
AI-Resume-analyzer/
├── app/                          # Next.js App Router
│   ├── api/analyze/route.ts      # Core POST analysis endpoint (multipart/form-data)
│   ├── layout.tsx                # Root layout (fonts, metadata, schema markup)
│   ├── page.tsx                  # Main entry point & analysis container
│   ├── landing/                  # Marketing / landing page views
│   ├── contact/, privacy/, terms/ # Static policy & legal pages
│   └── globals.css               # Global typography & Tailwind styles
├── components/                   # React UI Components
│   ├── FileUpload.tsx            # Drag-and-drop resume + job description input
│   ├── ProcessingState.tsx       # 5-stage progress indicator during analysis
│   ├── ScoreDashboard.tsx        # Multi-score metric cards & visual gauge
│   ├── MultiScoreBreakdown.tsx   # Detailed subscore breakdowns
│   ├── RequirementMatrix.tsx     # Requirement alignment table (MATCHED, CLAIMED_ONLY, MISSING)
│   ├── SkillsMatrix.tsx          # Extracted skill tags & match status
│   ├── ResumeDocument.tsx        # Manuscript view (70% column with inline match highlights)
│   ├── MarginNote.tsx            # Margin comments & missing requirements (30% column)
│   ├── ScoreStamp.tsx            # Double-strike rotated ink stamp verdict
│   └── FeedbackSection.tsx       # AI Executive summary, strengths & actionable recommendations
├── lib/                          # Core Business Logic & Algorithms
│   ├── ai/                       # AI client, prompt templates, structured parsers
│   │   ├── client.ts             # Provider router (OpenRouter, Gemini, OpenAI)
│   │   ├── resumeParser.ts       # Structured resume extraction into JSON
│   │   ├── jobParser.ts          # Structured job requirement extraction
│   │   └── explanation.ts        # Recruiter verdict & qualitative feedback generation
│   ├── scoring/                  # Multi-dimensional rubric calculation
│   │   ├── rubric.ts             # 5-dimensional scoring model (Match, Evidence, Quality, ATS)
│   │   └── weights.ts            # Scoring weight configurations
│   ├── matching/                 # Skill & requirement alignment logic
│   │   ├── requirements.ts       # Maps candidate experience/projects against requirements
│   │   └── synonyms.ts           # Technical taxonomy & synonym normalization dictionary
│   ├── evidence/                 # Evidence extraction & validation
│   │   └── resolver.ts           # Cross-references claimed skills against actual experience bullets
│   ├── enrichment/               # Optional external profile enrichment
│   │   └── github.ts             # Public GitHub stats & repo evidence verification
│   ├── normalization/            # Text & skill cleaning utilities
│   ├── types/                    # TypeScript interfaces
│   │   ├── resume.ts             # Candidate profile types
│   │   ├── job.ts                # Job description & requirement types
│   │   ├── matching.ts           # Requirement & skill match items
│   │   ├── scoring.ts            # Score breakdowns and multi-dimensional scores
│   │   └── analysis.ts           # Complete API response contracts & audit trail
│   ├── extractor.ts              # File text extraction (pdf2json + mammoth)
│   ├── scorer.ts                 # Classic deterministic 4-part scoring engine
│   ├── ratelimit.ts              # IP-based sliding window rate limiter
│   └── env.ts                    # Safe environment variable resolver
├── tests/ & __tests__/           # Test suites
│   ├── regression.test.ts        # Pipeline regression tests
│   └── scorer.test.ts            # Deterministic math unit tests
├── ARCHITECTURE.txt              # High-level architecture specification
└── PRD.md                        # Product requirements & user stories
```

---

## 4. End-to-End Pipeline Workflow

When a user submits a Resume (`.pdf`/`.docx`) and Job Description text:

```
[ Upload: File + JD ]
         │
         ▼
[ 1. Extraction & Validation ] ──► (pdf2json / mammoth, 5MB limit, 15 req/min IP rate limit)
         │
         ▼
[ 2. Structured AI Parsing ]   ──► (Extracts CandidateProfile & JobRequirementModel)
         │
         ▼
[ 3. Evidence Resolution ]     ──► (Validates claimed skills vs actual experience/projects)
         │
         ▼
[ 4. Deterministic Scoring ]   ──► (Pure TS math: Skills, Experience, Education, Semantics)
         │
         ▼
[ 5. LLM Recruiter Feedback ]  ──► (Generates executive summary, strengths & gaps from locked scores)
         │
         ▼
[ 6. Asymmetric Manuscript UI ] ─► (Document view + Margin notes + Ink stamp verdict)
```

---

## 5. Scoring Algorithms & Formulas

### A. Classic Deterministic Match (lib/scorer.ts)
$$\text{Overall Score} = (\text{Skills} \times 0.40) + (\text{Experience} \times 0.25) + (\text{Education} \times 0.15) + (\text{Semantic} \times 0.20)$$

1. **Skills Match (40%):**
   - Exact/Synonym match: $100\%$ weight
   - Partial match: $50\%$ weight
   - Preferred/bonus skills: up to $+15\%$
2. **Experience Match (25%):**
   - Ratio: $\min\left(1.0, \frac{\text{Candidate Years}}{\text{Required Years}}\right) \times 100$
3. **Education Match (15%):**
   - Degree level hierarchy: High School ($40$) < Associate ($60$) < Bachelor's ($80$) < Master's ($95$) < PhD ($100$)
4. **Semantic Similarity (20%):**
   - Term frequency cosine similarity across joint vocabulary space.

### B. Multi-Dimensional Rubric (lib/scoring/rubric.ts)
- **Job Match Score:** Raw requirement & skills alignment.
- **Evidence Strength Score:** Ratio of skills verified in real bullet points vs mere mentions.
- **Evidence Coverage:** Percentage ($0.0 - 1.0$) of requirements supported by direct evidence.
- **ATS Compatibility:** Document parseability, formatting standards, and keyword density.
- **Resume Quality:** Action verb usage, quantifiable metrics, and structure.

---

## 6. Key TypeScript Data Models

### `AnalysisResponse` (`lib/types/analysis.ts`)
```typescript
export interface AnalysisResponse {
  resume: CandidateProfile;
  jobDescription: JobRequirementModel;
  scores: ScoreBreakdown;
  multiDimensionalScores?: MultiDimensionalScores;
  requirementMatches?: RequirementMatch[];
  explanation: ExplanationFeedback;
  auditTrail?: AuditTrailStage[];
  rawText: {
    resumeSnippet: string;
    jdSnippet: string;
  };
}
```

### `RequirementMatch` (`lib/types/matching.ts`)
Status of each job requirement against candidate evidence:
- `MATCHED`: Verified with strong project/work evidence.
- `CLAIMED_ONLY`: Listed under skills section but lacking context in work history.
- `PARTIALLY_MATCHED`: Related experience or transferable skill found.
- `MISSING`: No matching experience found in resume.

---

## 7. Environment & Configuration

Environment variables (defined in `.env.local`):
```env
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key       # Optional
OPENAI_API_KEY=your_openai_api_key       # Optional
```
Users can also input their own API key directly on the frontend for zero-friction testing.

---

## 8. Common Scripts & Commands

```bash
# Start development server
npm run dev

# Run test suites
npm test

# Type check TypeScript without emitting files
npm run typecheck

# Run linter
npm run lint

# Production build
npm run build
```
