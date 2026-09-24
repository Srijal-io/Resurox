import crypto from 'node:crypto';

/**
 * Client IP Extraction and Hashing (SEC-14, PRD §6).
 * 
 * Rules:
 * - Reads ONLY the header named by `TRUSTED_IP_HEADER` (configured per hosting environment).
 * - Never trusts an arbitrary client-supplied X-Forwarded-For.
 * - If no trusted IP can be determined, routes to a strict shared "unknown" bucket.
 * - Produces HMAC-SHA256(ip, IP_HASH_SALT). Raw IP is never stored.
 */

export interface ClientIpResult {
  hashedIp: string;
  hashedPrefix: string;
  isUnknown: boolean;
}

export function extractAndHashClientIp(
  headers: Headers,
  trustedIpHeaderName?: string,
  salt?: string
): ClientIpResult {
  const headerName = (trustedIpHeaderName || process.env.TRUSTED_IP_HEADER || '').trim().toLowerCase();
  const secretSalt = salt || process.env.IP_HASH_SALT || 'resurox_default_dev_salt_2026';

  let rawIp: string | null = null;

  if (headerName) {
    const val = headers.get(headerName);
    if (val && val.trim()) {
      // In headers like x-forwarded-for, take the first hop; in single-IP headers, take the trimmed value
      rawIp = val.split(',')[0].trim();
    }
  }

  // In non-production, if no trusted header is set, try fallback header for convenience
  if (!rawIp && process.env.NODE_ENV !== 'production') {
    const devFallback = headers.get('x-forwarded-for') || headers.get('x-real-ip');
    if (devFallback && devFallback.trim()) {
      rawIp = devFallback.split(',')[0].trim();
    }
  }

  const isUnknown = !rawIp;
  const effectiveIp = rawIp || 'unknown_client_bucket';

  const hmac = crypto.createHmac('sha256', secretSalt);
  hmac.update(effectiveIp);
  const hashedIp = hmac.digest('hex');
  const hashedPrefix = hashedIp.substring(0, 8);

  return {
    hashedIp,
    hashedPrefix,
    isUnknown,
  };
}
