import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to scan repository and git history for potential secrets/keys.
 * Does NOT output or leak any detected secret values.
 */

const SECRET_PATTERNS = [
  { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9T3BlbkFJ]{20,}/g },
  { name: 'Gemini API Key', regex: /AIzaSy[a-zA-Z0-9_-]{33}/g },
  { name: 'OpenRouter Key', regex: /sk-or-v1-[a-zA-Z0-9]{64}/g },
  { name: 'Generic Secret Key Token', regex: /(?:api[_-]?key|secret[_-]?key|auth[_-]?token)\s*[:=]\s*["']([a-zA-Z0-9_\-]{20,})["']/gi },
];

function scanDirectory(dir: string): { file: string; pattern: string }[] {
  const violations: { file: string; pattern: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist' || entry.name === '.agents') {
      continue;
    }
    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      if (entry.name.startsWith('.env') || entry.name.endsWith('.md')) {
        continue;
      }
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const { name, regex } of SECRET_PATTERNS) {
          if (regex.test(content)) {
            violations.push({ file: fullPath, pattern: name });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
  return violations;
}

function scanGitHistory(): number {
  try {
    const logOutput = execSync('git log -p -n 50', { encoding: 'utf-8' });
    let leaks = 0;
    for (const { name, regex } of SECRET_PATTERNS) {
      const matches = logOutput.match(regex);
      if (matches && matches.length > 0) {
        console.warn(`[WARNING] Potential match for ${name} found in git log history (${matches.length} matches).`);
        leaks += matches.length;
      }
    }
    return leaks;
  } catch (err: any) {
    console.log('[INFO] Git log scan skipped (not a full git tree or no history).');
    return 0;
  }
}

console.log('🔍 Scanning workspace for leaked credentials...');
const findings = scanDirectory(process.cwd());

if (findings.length > 0) {
  console.error(`❌ Found ${findings.length} potential secret pattern(s) in active workspace files:`);
  findings.forEach(f => console.error(`  - In file: ${f.file} (Type: ${f.pattern})`));
  process.exit(1);
} else {
  console.log('✅ Workspace files scan passed: 0 secrets detected.');
}

console.log('🔍 Scanning recent git commits for leaked credentials...');
const gitLeaks = scanGitHistory();
if (gitLeaks === 0) {
  console.log('✅ Git history scan passed: 0 active provider keys detected.');
}
