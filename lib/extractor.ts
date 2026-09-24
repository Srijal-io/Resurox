import { inspectDocumentBinary, extractTextFromPDFBufferHardened, extractTextFromDocxBufferHardened } from './security/upload';
import { normalizeExtractedText } from './security/redact';

/**
 * Hardened Document Text Extractor (SEC-05..SEC-09, PRD §6).
 */
export async function extractTextFromFile(file: File, signal?: AbortSignal): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 1. Inspect Magic Bytes and ZIP structure
  const inspection = inspectDocumentBinary(buffer);
  if (!inspection.isValid) {
    throw new Error(inspection.error || 'Invalid or corrupted document format.');
  }

  // 2. Perform hardened extraction under timeouts and resource bounds
  let rawText = '';
  if (inspection.fileType === 'pdf') {
    rawText = await extractTextFromPDFBufferHardened(buffer, signal);
  } else if (inspection.fileType === 'docx') {
    rawText = await extractTextFromDocxBufferHardened(buffer, signal);
  } else {
    throw new Error('Unsupported document format. Please upload a PDF (.pdf) or Word document (.docx).');
  }

  // 3. Normalize extracted text (SEC-09: strip zero-width, bidi, control chars)
  return normalizeExtractedText(rawText);
}
