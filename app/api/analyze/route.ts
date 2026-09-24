import { NextRequest, NextResponse } from 'next/server';
import { runAnalysisPipeline } from '@/lib/pipeline/analyze';
import { PipelineError } from '@/lib/pipeline/errors';
import { extractAndHashClientIp } from '@/lib/security/ip';
import { checkSecurityRateLimits } from '@/lib/security/ratelimit';
import { checkAndReserveDailyBudget, reconcileBudgetSpend, releaseBudgetReservation, isKillSwitchActive } from '@/lib/security/budget';
import { tryAcquireConcurrencySlot, releaseConcurrencySlot } from '@/lib/security/concurrency';
import { verifyBotToken } from '@/lib/security/botcheck';
import {
  validateRequestMethod,
  validateRequestOrigin,
  validateContentLengthHeader,
  validateForbiddenCredentialHeaders,
  validateMultipartFieldAllowList,
} from '@/lib/security/validation';
import { securityLogger } from '@/lib/security/logger';

export const maxDuration = 60; // 60s timeout limit

/**
 * Thin Hardened Analysis API Controller (PRD §5.1, §6, Phase 4).
 * Enforces cheapest-to-most-expensive security pipeline before invoking AI.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const standardHeaders = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId,
  };

  // 1. Kill Switch Check (SEC-21)
  if (await isKillSwitchActive()) {
    securityLogger.warn('Request rejected: Kill switch is active', { requestId, status: 'REJECTED', errorCode: 'SERVICE_BUSY' });
    return NextResponse.json(
      {
        error: {
          code: 'SERVICE_BUSY',
          message: 'Resurox is temporarily unavailable for maintenance. Please check back shortly.',
          requestId,
          retryAfterSec: 60,
        },
      },
      { status: 503, headers: { ...standardHeaders, 'Retry-After': '60' } }
    );
  }

  // 2. Method Validation (SEC-17)
  const methodCheck = validateRequestMethod(req);
  if (!methodCheck.valid) {
    return NextResponse.json(
      { error: { code: methodCheck.errorCode, message: methodCheck.errorMessage, requestId } },
      { status: methodCheck.httpStatus || 405, headers: { ...standardHeaders, ...(methodCheck.headers || {}) } }
    );
  }

  // 3. Origin Validation (SEC-17)
  const originCheck = validateRequestOrigin(req);
  if (!originCheck.valid) {
    securityLogger.warn('Request rejected: Disallowed Origin', { requestId, status: 'REJECTED', errorCode: originCheck.errorCode });
    return NextResponse.json(
      { error: { code: originCheck.errorCode, message: originCheck.errorMessage, requestId } },
      { status: originCheck.httpStatus || 403, headers: standardHeaders }
    );
  }

  // 4. Forbidden Client Credentials Header Check (SEC-02)
  const credsCheck = validateForbiddenCredentialHeaders(req);
  if (!credsCheck.valid) {
    securityLogger.warn('Request rejected: Prohibited credential header present', { requestId, status: 'REJECTED' });
    return NextResponse.json(
      { error: { code: credsCheck.errorCode, message: credsCheck.errorMessage, requestId } },
      { status: credsCheck.httpStatus || 400, headers: standardHeaders }
    );
  }

  // 5. Content-Length Pre-Check (SEC-04)
  const lengthCheck = validateContentLengthHeader(req);
  if (!lengthCheck.valid) {
    return NextResponse.json(
      { error: { code: lengthCheck.errorCode, message: lengthCheck.errorMessage, requestId } },
      { status: lengthCheck.httpStatus || 400, headers: standardHeaders }
    );
  }

  // 6. Trusted Client IP & Rate Limiting (SEC-13, SEC-14)
  const { hashedIp, hashedPrefix } = extractAndHashClientIp(req.headers);
  const rateLimit = await checkSecurityRateLimits(hashedIp);
  if (!rateLimit.allowed) {
    securityLogger.warn('Request rate limited', { requestId, hashedIpPrefix: hashedPrefix, status: 'REJECTED', errorCode: 'RATE_LIMITED' });
    const retrySec = rateLimit.retryAfterSec || 60;
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: "You've reached the usage limit for now. Please try again later.",
          requestId,
          retryAfterSec: retrySec,
        },
      },
      {
        status: 429,
        headers: {
          ...standardHeaders,
          'Retry-After': String(retrySec),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // 7. Early Bot Verification via X-Bot-Token Header (SEC-15)
  const botToken = req.headers.get('x-bot-token');
  const botCheck = await verifyBotToken(botToken, req.headers.get('cf-connecting-ip') || undefined);
  if (!botCheck.success) {
    securityLogger.warn('Request rejected: Bot verification failed', { requestId, hashedIpPrefix: hashedPrefix, status: 'REJECTED', errorCode: 'BOT_CHECK_FAILED' });
    return NextResponse.json(
      {
        error: {
          code: 'BOT_CHECK_FAILED',
          message: "We couldn't verify this request. Please refresh and try again.",
          requestId,
        },
      },
      { status: 403, headers: standardHeaders }
    );
  }

  // 8. Concurrency Semaphore (SEC-29)
  const concurrency = tryAcquireConcurrencySlot();
  if (!concurrency.acquired) {
    securityLogger.warn('Request rejected: Concurrency limit reached', { requestId, status: 'REJECTED', errorCode: 'SERVICE_BUSY' });
    return NextResponse.json(
      {
        error: {
          code: 'SERVICE_BUSY',
          message: 'Resurox is busy right now. Please try again in a moment.',
          requestId,
          retryAfterSec: 5,
        },
      },
      { status: 503, headers: { ...standardHeaders, 'Retry-After': '5' } }
    );
  }

  // 9. Daily AI Budget Check & Reservation (SEC-20)
  const budgetReservation = await checkAndReserveDailyBudget();
  if (!budgetReservation.allowed) {
    releaseConcurrencySlot();
    securityLogger.warn('Request rejected: Daily budget reached or kill switch active', { requestId, status: 'REJECTED', errorCode: 'SERVICE_BUSY' });
    return NextResponse.json(
      {
        error: {
          code: 'SERVICE_BUSY',
          message: 'Resurox has reached its daily processing capacity. Please check back tomorrow.',
          requestId,
          retryAfterSec: 3600,
        },
      },
      { status: 503, headers: { ...standardHeaders, 'Retry-After': '3600' } }
    );
  }

  let actualCostMicroDollars = 0;
  let pipelineSucceeded = false;

  try {
    // 10. Parse Multipart Body & Validate Field Allow-List (SEC-02, SEC-04)
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formErr) {
      throw new PipelineError('INVALID_REQUEST', 'Failed to parse multipart form payload.');
    }

    const fieldValidation = validateMultipartFieldAllowList(formData);
    if (!fieldValidation.valid || !fieldValidation.file || !fieldValidation.jobDescription) {
      throw new PipelineError(
        fieldValidation.errorCode as any || 'INVALID_REQUEST',
        fieldValidation.errorMessage || 'Invalid form submission.'
      );
    }

    // 11. Run Centralized Pipeline Orchestrator (FR-02, Phase 2–4)
    const pipelineResponse = await runAnalysisPipeline({
      file: fieldValidation.file,
      jobDescriptionText: fieldValidation.jobDescription,
      requestId,
      signal: req.signal,
      clientIpPrefix: hashedPrefix,
    });

    pipelineSucceeded = true;
    actualCostMicroDollars = pipelineResponse.estimatedCostMicroDollars || 0;

    securityLogger.info('Analysis request completed successfully', {
      requestId,
      durationMs: Date.now() - startTime,
      status: 'SUCCESS',
      httpStatus: 200,
      hashedIpPrefix: hashedPrefix,
    });

    return NextResponse.json(pipelineResponse, {
      status: 200,
      headers: standardHeaders,
    });
  } catch (error: unknown) {
    if (error instanceof PipelineError) {
      securityLogger.warn(`Pipeline error: ${error.code}`, {
        requestId,
        durationMs: Date.now() - startTime,
        status: 'WARNING',
        errorCode: error.code,
        httpStatus: error.httpStatus,
        hashedIpPrefix: hashedPrefix,
      });

      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.userMessage,
            requestId,
            ...(error.retryAfterSec ? { retryAfterSec: error.retryAfterSec } : {}),
          },
        },
        {
          status: error.httpStatus,
          headers: {
            ...standardHeaders,
            ...(error.retryAfterSec ? { 'Retry-After': String(error.retryAfterSec) } : {}),
          },
        }
      );
    }

    const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred during analysis.';
    securityLogger.error('Unhandled analysis failure', {
      requestId,
      durationMs: Date.now() - startTime,
      status: 'FAILED',
      errorCode: 'ANALYSIS_FAILED',
      httpStatus: 500,
      hashedIpPrefix: hashedPrefix,
    });

    return NextResponse.json(
      {
        error: {
          code: 'ANALYSIS_FAILED',
          message: errorMsg,
          requestId,
        },
      },
      {
        status: 500,
        headers: standardHeaders,
      }
    );
  } finally {
    // 12. Release Concurrency Slot and Reconcile / Release Budget Reservation
    releaseConcurrencySlot();
    if (pipelineSucceeded) {
      await reconcileBudgetSpend(actualCostMicroDollars);
    } else {
      await releaseBudgetReservation();
    }
  }
}

// SEC-17: Explicit 405 for all other HTTP methods
export async function GET() {
  return NextResponse.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, { status: 405, headers: { Allow: 'POST' } });
}
export async function PUT() {
  return NextResponse.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, { status: 405, headers: { Allow: 'POST' } });
}
export async function DELETE() {
  return NextResponse.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, { status: 405, headers: { Allow: 'POST' } });
}
export async function OPTIONS() {
  return NextResponse.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, { status: 405, headers: { Allow: 'POST' } });
}
