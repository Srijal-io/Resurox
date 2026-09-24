/**
 * Safe Structured Security & Performance Logger (SEC-24, PRD §6).
 * 
 * Rules:
 * - Emits structured JSON events with requestId, stage, duration, status, errorCode, and hashedIpPrefix.
 * - NEVER logs raw resume/JD text, extracted entities, filenames, or raw LLM responses.
 * - Enforces fail-fast startup if DEBUG_AI_PAYLOADS=true in production.
 */

export interface StructuredLogEvent {
  requestId: string;
  stage?: string;
  durationMs?: number;
  status?: 'SUCCESS' | 'WARNING' | 'FAILED' | 'REJECTED';
  errorCode?: string;
  httpStatus?: number;
  hashedIpPrefix?: string;
  tokenCounts?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  note?: string;
}

export const securityLogger = {
  info(msg: string, event?: Partial<StructuredLogEvent>): void {
    const payload = {
      level: 'INFO',
      message: msg,
      timestamp: new Date().toISOString(),
      ...event,
    };
    console.log(JSON.stringify(payload));
  },

  warn(msg: string, event?: Partial<StructuredLogEvent>): void {
    const payload = {
      level: 'WARN',
      message: msg,
      timestamp: new Date().toISOString(),
      ...event,
    };
    console.warn(JSON.stringify(payload));
  },

  error(msg: string, event?: Partial<StructuredLogEvent>): void {
    const payload = {
      level: 'ERROR',
      message: msg,
      timestamp: new Date().toISOString(),
      ...event,
    };
    console.error(JSON.stringify(payload));
  },
};

export function validateLoggingConfiguration(): void {
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_AI_PAYLOADS === 'true') {
    throw new Error('FATAL SECURITY ERROR: DEBUG_AI_PAYLOADS must never be enabled in production.');
  }
}
