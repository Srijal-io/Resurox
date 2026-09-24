# Security Policy & Vulnerability Reporting

Resurox takes application security and user privacy seriously. As a privacy-first AI resume analyzer that processes untrusted files, we maintain strict isolation and security controls.

---

## 1. Supported Versions

| Version | Supported |
| :--- | :--- |
| `1.0.x` | ✅ Active security updates |
| `< 1.0.0` | ❌ End of life |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability or abuse loophole in Resurox, please report it privately:

- **Contact:** Open a confidential advisory on GitHub or email security maintainers: `security@resurox.app` *(or repository owner contact)*.
- **Please Include:**
  - Description of the vulnerability (e.g., SSRF, bypass of rate limiting, PII leak, denial of service).
  - Steps to reproduce or proof-of-concept payload.
  - Potential impact.

**Please do NOT open public GitHub issues for security vulnerabilities.**

---

## 3. Scope & Defenses
- **Keyless Architecture:** Server-managed API keys; client keys are rejected.
- **Upload Hardening:** In-memory magic byte inspection, ZIP-bomb pre-scans, macro detection, and zero filesystem persistence.
- **Privacy Minimization:** Client PII (emails, phone numbers, addresses) is scrubbed on the server before dispatching payloads to AI providers.
- **SSRF Controls:** Strict hostname whitelist (`api.github.com` only), disabled redirects, and regex-validated usernames.
- **Fail-Closed Abuse Controls:** Multi-tier rate limiting, Cloudflare Turnstile token validation, and daily budget circuit breakers.
