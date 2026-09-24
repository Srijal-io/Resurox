import { NextRequest } from 'next/server';
import { getServerConfig } from '../config';

/**
 * Early Request & Input Validations (SEC-01, SEC-02, SEC-04, SEC-17, PRD §6).
 */

export interface ValidationCheckResult {
  valid: boolean;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  headers?: Record<string, string>;
}

export function validateRequestMethod(req: NextRequest): ValidationCheckResult {
  if (req.method !== 'POST') {
    return {
      valid: false,
      httpStatus: 405,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: `Method '${req.method}' is not allowed. Use POST.`,
      headers: {
        Allow: 'POST',
      },
    };
  }
  return { valid: true };
}

export function validateRequestOrigin(req: NextRequest): ValidationCheckResult {
  const origin = req.headers.get('origin');
  const secFetchSite = req.headers.get('sec-fetch-site');

  // If browser sent same-origin marker, accept
  if (secFetchSite === 'same-origin') {
    return { valid: true };
  }

  // If no origin header is sent (e.g. standard same-site navigation or server-side curl)
  if (!origin) {
    return { valid: true };
  }

  const config = getServerConfig();
  const allowed = (config.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  const cleanOrigin = origin.toLowerCase().trim();

  // In non-production, permit localhost/127.0.0.1
  if (process.env.NODE_ENV !== 'production') {
    if (cleanOrigin.includes('localhost') || cleanOrigin.includes('127.0.0.1')) {
      return { valid: true };
    }
  }

  if (allowed.length > 0 && !allowed.includes(cleanOrigin)) {
    return {
      valid: false,
      httpStatus: 403,
      errorCode: 'INVALID_REQUEST',
      errorMessage: 'Cross-origin analysis requests are not permitted.',
    };
  }

  return { valid: true };
}

export function validateContentLengthHeader(req: NextRequest): ValidationCheckResult {
  const contentLength = req.headers.get('content-length');
  const transferEncoding = req.headers.get('transfer-encoding');
  const config = getServerConfig();

  if (!contentLength && transferEncoding !== 'chunked') {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'INVALID_REQUEST',
      errorMessage: 'Missing Content-Length header on analysis request.',
    };
  }

  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    if (isNaN(bytes) || bytes < 0) {
      return {
        valid: false,
        httpStatus: 400,
        errorCode: 'INVALID_REQUEST',
        errorMessage: 'Invalid Content-Length header.',
      };
    }
    if (bytes > config.MAX_REQUEST_BYTES) {
      return {
        valid: false,
        httpStatus: 413,
        errorCode: 'DOCUMENT_TOO_LARGE',
        errorMessage: `Request payload exceeds maximum allowed size (${config.MAX_REQUEST_BYTES / (1024 * 1024)}MB).`,
      };
    }
  }

  return { valid: true };
}

export function validateForbiddenCredentialHeaders(req: NextRequest): ValidationCheckResult {
  const forbiddenHeaders = [
    'x-api-key',
    'apikey',
    'x-provider',
    'authorization',
    'x-openai-key',
    'x-gemini-key',
    'x-openrouter-key',
  ];

  for (const h of forbiddenHeaders) {
    if (req.headers.get(h)) {
      return {
        valid: false,
        httpStatus: 400,
        errorCode: 'INVALID_REQUEST',
        errorMessage: 'Client-supplied credentials and headers are prohibited. Resurox uses server-managed AI.',
      };
    }
  }

  return { valid: true };
}

/**
 * Validates multipart form fields against strict allow-list: ONLY `resume` and `jobDescription`.
 */
export function validateMultipartFieldAllowList(formData: FormData): {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  file?: File;
  jobDescription?: string;
} {
  const ALLOWED_FIELDS = new Set(['resume', 'jobDescription']);
  const seenFields = new Set<string>();

  for (const [key] of formData.entries()) {
    if (!ALLOWED_FIELDS.has(key)) {
      return {
        valid: false,
        errorCode: 'INVALID_REQUEST',
        errorMessage: `Prohibited or unexpected field '${key}' in upload. Client-supplied parameters are not allowed.`,
      };
    }
    if (seenFields.has(key)) {
      return {
        valid: false,
        errorCode: 'INVALID_REQUEST',
        errorMessage: `Duplicate field '${key}' detected in request body.`,
      };
    }
    seenFields.add(key);
  }

  const file = formData.get('resume') as File | null;
  const jdText = formData.get('jobDescription') as string | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return {
      valid: false,
      errorCode: 'INVALID_REQUEST',
      errorMessage: 'Please upload a valid resume document (PDF or DOCX).',
    };
  }

  if (!jdText || typeof jdText !== 'string' || !jdText.trim()) {
    return {
      valid: false,
      errorCode: 'JOB_DESCRIPTION_INVALID',
      errorMessage: 'Please provide a job description.',
    };
  }

  return {
    valid: true,
    file,
    jobDescription: jdText.trim(),
  };
}
