import crypto from 'crypto';

export interface WrappedDocument {
  wrappedText: string;
  nonce: string;
}

/**
 * Wraps user-submitted text in a random per-request delimiter nonce (A2).
 * Neutralizes any existing delimiter-like patterns in user text to prevent delimiter collision.
 */
export function wrapUntrustedDocument(rawText: string, docLabel: string = 'DOC'): WrappedDocument {
  const nonce = crypto.randomBytes(8).toString('hex');
  
  // Neutralize any delimiter lookalikes in the user-supplied text
  const sanitized = rawText
    .replace(/<<<\s*DOC-[^>]+>>>/gi, '[DELIMITER_REMOVED]')
    .replace(/<<<\s*END-[^>]+>>>/gi, '[DELIMITER_REMOVED]')
    .replace(/<<<|>>>/g, '---');

  const wrappedText = `<<<${docLabel}-${nonce}>>>\n${sanitized}\n<<<END-${nonce}>>>`;

  return {
    wrappedText,
    nonce,
  };
}
