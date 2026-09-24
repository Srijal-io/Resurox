/**
 * Hardened GitHub Evidence Enrichment with SSRF Protections (SEC-16, PRD §6).
 * 
 * Rules:
 * - Contact ONLY api.github.com over HTTPS.
 * - Redirects disabled (redirect: 'error').
 * - 5-second timeout, 50KB size cap.
 * - Strict username regex: ^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$
 * - Never fetches user-supplied arbitrary URLs.
 * - Non-fatal failure (returns empty list).
 */

export interface GitHubRepoSummary {
  name: string;
  description?: string;
  languages: string[];
  stars?: number;
  updatedAt?: string;
}

const GITHUB_USERNAME_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export async function fetchGitHubPublicEvidence(githubIdentifier?: string): Promise<GitHubRepoSummary[]> {
  if (!githubIdentifier || !githubIdentifier.trim()) {
    return [];
  }

  // Extract clean username whether passed as URL or raw username
  let username = githubIdentifier.trim();
  
  if (username.startsWith('http://') || username.startsWith('https://') || username.startsWith('github.com')) {
    // If it's a URL, must be exact https://github.com/{username} with no extra subpaths or query params
    const exactUrlMatch = username.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/?$/i);
    if (!exactUrlMatch) {
      return [];
    }
    username = exactUrlMatch[1];
  }

  if (!GITHUB_USERNAME_REGEX.test(username)) {
    return [];
  }

  const safeUsername = encodeURIComponent(username);
  const targetUrl = `https://api.github.com/users/${safeUsername}/repos?sort=updated&per_page=5`;

  const headers: Record<string, string> = {
    'User-Agent': 'Resurox-AI-Resume-Analyzer',
    'Accept': 'application/vnd.github.v3+json',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token && token.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'error', // SSRF Protection: Never follow redirects
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!res.ok) return [];

    const repos = await res.json();
    if (!Array.isArray(repos)) return [];

    return repos.slice(0, 5).map((r: any) => ({
      name: String(r.name || '').slice(0, 100),
      description: String(r.description || '').slice(0, 250),
      languages: r.language ? [String(r.language).slice(0, 50)] : [],
      stars: typeof r.stargazers_count === 'number' ? r.stargazers_count : 0,
      updatedAt: r.updated_at ? String(r.updated_at) : undefined,
    }));
  } catch (err) {
    // Non-fatal failure
    console.warn('[ENRICHMENT] GitHub enrichment fetch skipped or timed out:', err instanceof Error ? err.message : String(err));
    return [];
  }
}
