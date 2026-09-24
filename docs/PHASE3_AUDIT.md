# Phase 3 Audit: Scoring Integrity & Determinism

**Date:** 2026-09-24  
**Scope:** `lib/scoring/`, `lib/scorer.ts`, `lib/matching/`, `lib/evidence/`, `lib/normalization/`, `lib/ai.ts`, `lib/heuristic/`, and their relationships to the pipeline and UI components.  
**PRD Alignment:** §8 (SC-01..SC-10), §12 (TST-02, TST-06), §13.2 PT-L.

---

## 1. Headline Score Ownership & Component Relationships

### 1.1 Single Headline Score Owner
- **Owner Function:** `computeMultiDimensionalScores` in [`lib/scoring/rubric.ts`](file:///c:/Users/SHAN%20KUMAR/Desktop/AI-Resume-analyzer/lib/scoring/rubric.ts).
- **Owner Field:** `multiDimensionalScores.overallEvaluation` (range: `0` to `100`, clamped, integer).
- **Pipeline Assignment:** In [`lib/pipeline/analyze.ts`](file:///c:/Users/SHAN%20KUMAR/Desktop/AI-Resume-analyzer/lib/pipeline/analyze.ts#L230-L232):
  ```ts
  const headlineScore = multiDimensionalScores.overallEvaluation;
  ```
- **UI Read Surface:**
  - [`components/ScoreStamp.tsx`](file:///c:/Users/SHAN%20KUMAR/Desktop/AI-Resume-analyzer/src/components/ScoreStamp.tsx): Reads `result.headlineScore ?? result.multiDimensionalScores?.overallEvaluation ?? result.scores?.overallScore`.
  - [`components/ScoreDashboard.tsx`](file:///c:/Users/SHAN%20KUMAR/Desktop/AI-Resume-analyzer/src/components/ScoreDashboard.tsx): Renders `headlineScore` as the authoritative badge and hero score, while displaying multi-dimensional sub-scores and classic sub-scores alongside.
  - [`components/ResumeDocument.tsx`](file:///c:/Users/SHAN%20KUMAR/Desktop/AI-Resume-analyzer/src/components/ResumeDocument.tsx): Displays `headlineScore` on the evaluation stamp.

### 1.2 Relationship Between Scores
1. **Classic 4-part Score (`lib/scorer.ts:computeScores`):**
   - Formula: `(skillsMatch * 0.40) + (experienceMatch * 0.25) + (educationMatch * 0.15) + (semanticMatch * 0.20)`.
   - `subScores.skillsMatch`: Lexical overlap between extracted candidate skills and JD required/preferred skills.
   - `subScores.experienceMatch`: Ratio of candidate years to required years (with bonus if exceeding).
   - `subScores.educationMatch`: Tiered degree hierarchy match (PhD = 4, Master = 3, Bachelor = 2, Associate = 1).
   - `subScores.semanticMatch`: Lexical TF-IDF cosine similarity between resume text and JD text (`lib/ai.ts:computeTextSimilarityScore`).
2. **Multi-Dimensional Rubric (`lib/scoring/rubric.ts:computeMultiDimensionalScores`):**
   - Incorporates `requirementMatches` (weighted by criticality: Required=1.0, Preferred=0.5, Bonus=0.3) and `evidenceList` (overall evidence strength: Strongly Supported=0.95, Supported=0.85, Claimed Only=0.3).
   - Weighted sum with weights: `jobMatch: 0.30`, `technicalCap: 0.20`, `experience: 0.15`, `evidence: 0.10`, `education: 0.05`, `resumeQuality: 0.10`, `atsCompatibility: 0.10`.
   - Produces `overallEvaluation` which is the official `headlineScore`.

---

## 2. Missing and Zero Input Behavior Audit

| Component & Scenario | Current Implementation Behavior | Target Phase 3 Deterministic Rule (SC-04) |
|---|---|---|
| **Required years absent or 0** (`experienceRequiredYears = 0`) | Returns `100` in `computeExperienceMatch` (`lib/scorer.ts:80`). Artificially inflates candidates when no experience is asked. | Mark experience as `applicable: false`. Re-weight remaining applicable components proportionally so absence neither rewards nor penalizes. |
| **Required education absent/none/any** (`educationRequired = ''` or 'None') | Returns `100` in `computeEducationMatch` (`lib/scorer.ts:104`). | Mark education as `applicable: false`. Re-weight remaining applicable components proportionally. |
| **Empty requirement list in JD** | In AI path, could result in `requirements: []`. `rubric.ts` defaulted `jobMatchScore = skillsMatchScore`. In heuristic path, throws `JOB_DESCRIPTION_INVALID`. | Pipeline must never score an empty requirement list; throw `JOB_DESCRIPTION_INVALID` typed error. |
| **Empty candidate skills** (`skills: []`) | `computeSkillsMatch` returns `0` for base score, `evidenceList` is empty, `evidenceStrengthScore = 0`. | Defined low output score (not NaN or fallback constant). |
| **Skills listed with no supporting bullets/experience** | Evidence resolver marks skills as `CLAIMED` (`strength: 0.3`). Requirement matching gives `status: CLAIMED_ONLY` (`matchScore: 50`). | Stays `CLAIMED_ONLY` with lower evidence weight; stuffed skills without bullets score substantially lower than evidenced skills (SC-08). |
| **No dates in resume experience** | Heuristic parser produces `totalExperienceYears = 0`. AI parser might return estimate `totalExperienceYears`. | Calculate total years in pure TypeScript from date ranges. If no usable dates exist, fall back to extracted estimate and flag it as `isEstimate: true` (SC-05). |

---

## 3. Super-Linear & ReDoS Loop / Regex Audit

### 3.1 Regular Expressions Audit
1. **`lib/normalization/skills.ts`:**
   - `new RegExp(`(?:^|[\\s,;()/\\[\\]])${escapeRegex(...)}...`, 'i')` inside a loop over `CANONICAL_SKILL_DICTIONARY` (~70 items).
   - *Analysis:* The regex has non-capturing character classes and escaped literal terms. No nested quantifiers `(a+)+`. Linear in text length $O(N)$.
   - *Safety Enhancement:* Add input character cap (e.g. 50,000 chars) and pre-clean string length.
2. **`lib/heuristic/resume.ts`:**
   - `text.matchAll(/\b(20\d{2})\s*(?:-|–|to)\s*(20\d{2}|present|current)\b/gi)`
   - *Analysis:* Deterministic word-boundary year matcher. No catastrophic backtracking.
   - *Safety Enhancement:* Expand to support `Jan 2020 – Present`, `03/2018 – 06/2020`, `2019–2021` in a dedicated pure module [`lib/scoring/experience.ts`](file:///c:/Users/SHAN%20KUMAR/Desktop/AI-Resume-analyzer/lib/scoring/experience.ts).
3. **`lib/ai.ts` & `lib/scoring/semantic.ts`:**
   - `text.match(/\b[a-z0-9+#.]{2,}\b/g)`
   - *Analysis:* Single non-nested quantifier with character class. $O(N)$ linear.
   - *Safety Enhancement:* Bounded token length, frequency count capping to prevent keyword stuffing (SC-08).

### 3.2 Loops & Nested Iteration Audit
1. **`lib/evidence/resolver.ts`:**
   - Loops over candidate experience items, then over `claimMap.entries()`, doing `fullExpText.includes()`.
   - *Complexity:* $O(\text{expItems} \times \text{skills})$. Given caps $\text{skills} \le 200$ and $\text{expItems} \le 50$, total iterations $\le 10,000$, well within 1ms execution budget.
2. **`lib/matching/requirements.ts`:**
   - Uses `Map.get()` ($O(1)$) for exact matches, falls back to `find()` ($O(M)$) for partial matches.
   - *Complexity:* $O(N_{\text{req}} \times N_{\text{evidence}})$. With $N \le 100$, max iterations $\le 10,000$.

---

## 4. Purity, Clock, I/O & Environment Audit

### 4.1 Clock Usage (`Date.now()`, `new Date()`)
- `lib/heuristic/resume.ts:82`: Uses `new Date().getFullYear()`.
  - *Phase 3 Fix:* Inject `now: Date` parameter into heuristic parser and date-range calculator. Default to `new Date()` only at pipeline layer.
- `lib/scoring/rubric.ts`, `lib/scorer.ts`, `lib/matching/requirements.ts`, `lib/normalization/skills.ts`:
  - **100% Pure:** Zero clock reads, zero I/O, zero network calls.

### 4.2 I/O, Network, and Environment Isolation
- `lib/scoring/*`, `lib/matching/*`, `lib/evidence/*`, `lib/normalization/*` contain:
  - **No `fs`** imports
  - **No `net`** / **`http`** / **`https`** / **`child_process`** imports
  - **No `fetch`** calls
  - **No `process.env`** references
  - **No imports from `lib/ai/*`** (enforced by ESLint `no-restricted-imports`).
- Add strict automated test `tests/purity.test.ts` scanning AST and imports to guarantee zero I/O and zero environment access.

---

## 5. Phase 3 Action Plan

1. **Step 1:** Create pure `lib/scoring/experience.ts` for date-range parsing, overlap merging, future clamping, and cap at 60 years with injected `now: Date`.
2. **Step 2:** Update `lib/scoring/rubric.ts` and `lib/scorer.ts` to implement proportional re-weighting with `applicable: false` for missing/0 experience and education.
3. **Step 3:** Implement keyword-frequency capping in `lib/scoring/semantic.ts` (anti-gaming, SC-08).
4. **Step 4:** Add `fast-check` for SC-09 property tests (monotonicity, bounds [0, 100], order invariance, mutation sanity test).
5. **Step 5:** Create synthetic regression fixtures for TST-06 / SC-10 and stability tests (SC-06).
6. **Step 6:** Run full validation suite (`typecheck`, `lint`, `test`, `build`) and produce the Phase 3 checkpoint report.
