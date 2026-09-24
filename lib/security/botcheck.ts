import { getServerConfig } from '../config';

/**
 * Cloudflare Turnstile Bot Protection (SEC-15, PRD §6).
 * 
 * Deliberate Header Architecture:
 * Reads `X-Bot-Token` header directly on the incoming request, allowing early rejection
 * BEFORE parsing or buffering any multipart upload payload.
 */

export interface BotVerificationResult {
  success: boolean;
  errorCode?: string;
}

export async function verifyBotToken(
  token: string | null,
  remoteIp?: string
): Promise<BotVerificationResult> {
  const config = getServerConfig();

  // If bot protection is turned off, immediately pass
  if (config.BOT_PROTECTION === 'off') {
    return { success: true };
  }

  // If token is missing when bot protection is active
  if (!token || !token.trim()) {
    return { success: false, errorCode: 'missing_token' };
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] TURNSTILE_SECRET_KEY is missing in production with BOT_PROTECTION=turnstile');
      return { success: false, errorCode: 'server_misconfigured' };
    }
    // Allow in test/dev if dummy test token passed
    if (token === 'mock_valid_turnstile_token') {
      return { success: true };
    }
    return { success: false, errorCode: 'missing_secret' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return { success: false, errorCode: `upstream_http_${res.status}` };
    }

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }

    return { success: false, errorCode: data['error-codes']?.[0] || 'invalid_token' };
  } catch (err) {
    console.warn('[SECURITY] Turnstile verification network error:', err);
    // Fail closed in production (SEC-15)
    return { success: false, errorCode: 'verification_timeout' };
  }
}
