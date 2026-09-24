export type PipelineErrorCode =
  | 'INVALID_REQUEST'
  | 'DOCUMENT_EMPTY'
  | 'DOCUMENT_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'JOB_DESCRIPTION_INVALID'
  | 'TEXT_EXTRACTION_FAILED'
  | 'NOT_A_RESUME'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_AUTH_FAILED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_INVALID_RESPONSE'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'GROUNDING_FAILED'
  | 'PIPELINE_TIMEOUT'
  | 'CONFIGURATION_ERROR'
  | 'SERVICE_BUSY'
  | 'RATE_LIMITED'
  | 'BOT_CHECK_FAILED'
  | 'ANALYSIS_FAILED';

export interface SafeErrorMapping {
  httpStatus: number;
  userMessage: string;
}

export const ERROR_MAPPING: Record<PipelineErrorCode, SafeErrorMapping> = {
  INVALID_REQUEST: {
    httpStatus: 400,
    userMessage: 'Something was wrong with the request. Please refresh and try again.',
  },
  DOCUMENT_EMPTY: {
    httpStatus: 400,
    userMessage: 'The uploaded file is empty. Please upload a valid resume.',
  },
  DOCUMENT_TOO_LARGE: {
    httpStatus: 413,
    userMessage: 'That file is too large. Please upload a resume under 5 MB.',
  },
  UNSUPPORTED_FILE: {
    httpStatus: 415,
    userMessage: 'Please upload a PDF (.pdf) or Word (.docx) resume.',
  },
  JOB_DESCRIPTION_INVALID: {
    httpStatus: 422,
    userMessage: 'Please paste a job description of reasonable length.',
  },
  TEXT_EXTRACTION_FAILED: {
    httpStatus: 422,
    userMessage: "We couldn't read text from this file. If it's a scan, try a text-based PDF or DOCX.",
  },
  NOT_A_RESUME: {
    httpStatus: 422,
    userMessage: "This doesn't look like a resume. Please check the file and try again.",
  },
  AI_TIMEOUT: {
    httpStatus: 504,
    userMessage: 'The AI analysis request timed out. Please try again in a few moments.',
  },
  AI_RATE_LIMITED: {
    httpStatus: 429,
    userMessage: "You've reached the usage limit for now. Please try again later.",
  },
  AI_AUTH_FAILED: {
    httpStatus: 503,
    userMessage: 'Resurox AI service is temporarily unavailable. Please try again shortly.',
  },
  AI_PROVIDER_ERROR: {
    httpStatus: 503,
    userMessage: "We couldn't analyze this document right now. Please try again in a few minutes.",
  },
  AI_INVALID_RESPONSE: {
    httpStatus: 502,
    userMessage: 'Received an invalid response from the AI provider. Please try again.',
  },
  SCHEMA_VALIDATION_FAILED: {
    httpStatus: 502,
    userMessage: 'Structured data validation failed during analysis. Please try again.',
  },
  GROUNDING_FAILED: {
    httpStatus: 422,
    userMessage: 'The extracted evidence could not be verified against the source text.',
  },
  PIPELINE_TIMEOUT: {
    httpStatus: 504,
    userMessage: 'The analysis pipeline took too long to complete. Please try again.',
  },
  CONFIGURATION_ERROR: {
    httpStatus: 503,
    userMessage: 'Resurox server configuration error. Please try again later.',
  },
  SERVICE_BUSY: {
    httpStatus: 503,
    userMessage: 'Resurox is busy right now. Please try again in a few minutes.',
  },
  RATE_LIMITED: {
    httpStatus: 429,
    userMessage: "You've reached the usage limit for now. Please try again later.",
  },
  BOT_CHECK_FAILED: {
    httpStatus: 403,
    userMessage: 'Security check failed. Please verify you are human and try again.',
  },
  ANALYSIS_FAILED: {
    httpStatus: 500,
    userMessage: 'Something went wrong on our side. Please try again.',
  },
};

export class PipelineError extends Error {
  public readonly code: PipelineErrorCode;
  public readonly httpStatus: number;
  public readonly userMessage: string;
  public readonly retryAfterSec?: number;
  public readonly internalDetails?: unknown;

  constructor(
    code: PipelineErrorCode,
    customMessage?: string,
    options?: { retryAfterSec?: number; internalDetails?: unknown }
  ) {
    const mapping = ERROR_MAPPING[code] || ERROR_MAPPING.ANALYSIS_FAILED;
    super(customMessage || mapping.userMessage);
    this.name = 'PipelineError';
    this.code = code;
    this.httpStatus = mapping.httpStatus;
    this.userMessage = customMessage || mapping.userMessage;
    this.retryAfterSec = options?.retryAfterSec;
    this.internalDetails = options?.internalDetails;
  }
}
