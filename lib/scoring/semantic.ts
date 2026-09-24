/**
 * Lexical Semantic Scoring & Cosine Similarity (SC-07, SC-08, PRD §8).
 * 
 * NOTE: The semantic component is strictly LEXICAL (term-frequency cosine similarity).
 * No external embedding models are called.
 * 
 * Anti-Gaming Protections:
 * - Sub-linear term-frequency scaling / saturation cap (max term weight = 3.0) to neutralize keyword-stuffing attacks.
 * - Repeated keyword 100x cannot artificially dominate the vocabulary vector.
 * - Robust guards against zero-vector division: returns 0 (finite, clamped to [0, 100]).
 */

export const MAX_TERM_FREQUENCY_CAP = 3;

/**
 * Extracts normalized tokens from text with safe length limits.
 */
export function tokenizeLexicalText(text: string, maxTokens: number = 5000): string[] {
  if (!text || typeof text !== 'string') return [];
  // Tokenize words of length 2 to 30
  const matches = text.toLowerCase().match(/\b[a-z0-9+#.]{2,30}\b/g) || [];
  return matches.slice(0, maxTokens);
}

/**
 * Computes capped term frequencies to prevent keyword-stuffing gaming.
 */
export function computeCappedTermFrequencyMap(tokens: string[]): Map<string, number> {
  const rawFreq = new Map<string, number>();
  for (const token of tokens) {
    rawFreq.set(token, (rawFreq.get(token) || 0) + 1);
  }

  const cappedFreq = new Map<string, number>();
  for (const [token, count] of rawFreq.entries()) {
    // Sub-linear damping: 1 + ln(count), capped at MAX_TERM_FREQUENCY_CAP
    const damped = Math.min(MAX_TERM_FREQUENCY_CAP, 1 + Math.log(count));
    cappedFreq.set(token, damped);
  }

  return cappedFreq;
}

/**
 * Computes pure lexical cosine similarity with anti-gaming frequency caps.
 * Returns finite number strictly in [0, 100].
 */
export function computeLexicalCosineSimilarity(textA: string, textB: string): number {
  const tokensA = tokenizeLexicalText(textA);
  const tokensB = tokenizeLexicalText(textB);

  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const freqMapA = computeCappedTermFrequencyMap(tokensA);
  const freqMapB = computeCappedTermFrequencyMap(tokensB);

  // Combine unique vocabulary
  const vocab = new Set<string>([...freqMapA.keys(), ...freqMapB.keys()]);
  if (vocab.size === 0) return 0;

  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (const term of vocab) {
    const valA = freqMapA.get(term) || 0;
    const valB = freqMapB.get(term) || 0;

    dotProduct += valA * valB;
    normASq += valA * valA;
    normBSq += valB * valB;
  }

  if (normASq === 0 || normBSq === 0) return 0;

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (!Number.isFinite(denominator) || denominator === 0) return 0;

  const rawCosine = dotProduct / denominator;
  // Raw cosine is in [0, 1]. Map to [0, 100]
  const score = Math.round(rawCosine * 100);

  // Guarantee finite clamped output in [0, 100]
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}
