// =====================================================
// SECRET SCANNER - Credential & Secret Detection
// =====================================================
// Runs during repository ingestion to detect exposed
// secrets, API keys, tokens, and credentials.
// This is a CRITICAL security feature.

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { logger } from '../utils/logger';

// =====================================================
// INTERFACES
// =====================================================

export interface DetectedSecret {
  _key: string;
  repositoryId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  filePath: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  matchedPattern: string;
  context: string;
  confidence: number;
  isInComment: boolean;
  isInTestFile: boolean;
  redactedValue: string;
  detectedAt: Date;
}

export interface SecretScanSummary {
  repositoryId: string;
  totalFilesScanned: number;
  totalSecretsFound: number;
  bySeverity: { critical: number; high: number; medium: number };
  byType: Record<string, number>;
  scanDuration: number;
}

// =====================================================
// SECRET PATTERNS
// =====================================================

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium';
  description: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'critical', description: 'AWS IAM access key' },
  { name: 'AWS Secret Key', pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/g, severity: 'critical', description: 'AWS secret access key' },

  // GitHub
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/g, severity: 'critical', description: 'GitHub personal access token' },
  { name: 'GitHub App Token', pattern: /ghu_[A-Za-z0-9]{36}/g, severity: 'critical', description: 'GitHub app installation token' },

  // Google
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'high', description: 'Google API key' },
  { name: 'Google OAuth', pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g, severity: 'high', description: 'Google OAuth client ID' },

  // Stripe
  { name: 'Stripe Secret Key', pattern: /sk_live_[0-9a-zA-Z]{24,}/g, severity: 'critical', description: 'Stripe live secret key' },
  { name: 'Stripe Publishable', pattern: /pk_live_[0-9a-zA-Z]{24,}/g, severity: 'high', description: 'Stripe live publishable key' },

  // Slack
  { name: 'Slack Token', pattern: /xox[bpsorta]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g, severity: 'critical', description: 'Slack API token' },
  { name: 'Slack Webhook', pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/g, severity: 'high', description: 'Slack webhook URL' },

  // Database
  { name: 'Database URL', pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/g, severity: 'critical', description: 'Database connection string with credentials' },

  // JWT
  { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, severity: 'high', description: 'JSON Web Token (may contain sensitive claims)' },

  // Private Keys
  { name: 'RSA Private Key', pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g, severity: 'critical', description: 'RSA private key' },
  { name: 'SSH Private Key', pattern: /-----BEGIN (?:DSA|EC|OPENSSH) PRIVATE KEY-----/g, severity: 'critical', description: 'SSH private key' },

  // Generic API Keys/Tokens
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"]([A-Za-z0-9\-_]{20,})['"]?/gi, severity: 'high', description: 'Generic API key assignment' },
  { name: 'Generic Secret', pattern: /(?:secret|token|password|passwd|pwd)\s*[=:]\s*['"]([A-Za-z0-9\-_!@#$%^&*]{8,})['"]?/gi, severity: 'high', description: 'Generic secret assignment' },
  { name: 'Bearer Token', pattern: /Bearer\s+[A-Za-z0-9\-_\.]{20,}/g, severity: 'high', description: 'Bearer authentication token' },

  // Atlassian (Jira/Confluence)
  { name: 'Atlassian API Token', pattern: /ATATT[A-Za-z0-9+/=]{50,}/g, severity: 'critical', description: 'Atlassian API token' },

  // Azure
  { name: 'Azure Connection String', pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/g, severity: 'critical', description: 'Azure storage connection string' },

  // Heroku
  { name: 'Heroku API Key', pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, severity: 'medium', description: 'Possible Heroku API key (UUID format)' },

  // SendGrid
  { name: 'SendGrid API Key', pattern: /SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}/g, severity: 'critical', description: 'SendGrid API key' },

  // Twilio
  { name: 'Twilio API Key', pattern: /SK[0-9a-fA-F]{32}/g, severity: 'high', description: 'Twilio API key' },

  // Mailgun
  { name: 'Mailgun API Key', pattern: /key-[0-9a-zA-Z]{32}/g, severity: 'high', description: 'Mailgun API key' },

  // npm
  { name: 'npm Token', pattern: /npm_[A-Za-z0-9]{36}/g, severity: 'critical', description: 'npm access token' },

  // PyPI
  { name: 'PyPI Token', pattern: /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}/g, severity: 'critical', description: 'PyPI API token' },
];

// =====================================================
// FILE FILTERS
// =====================================================

/** Binary / non-text extensions to skip entirely */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.avif',
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
  '.zip', '.gz', '.tar', '.rar', '.7z', '.bz2',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a', '.lib',
  '.class', '.jar', '.war',
  '.pyc', '.pyo', '.wasm',
  '.sqlite', '.db', '.mdb',
  '.DS_Store',
]);

/** Files to completely ignore (lock files, minified bundles, etc.) */
const IGNORE_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile.lock',
  'Pipfile.lock',
  'poetry.lock',
  'composer.lock',
  'Cargo.lock',
  'go.sum',
]);

/** Glob patterns to skip */
const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/.tox/**',
  '**/.venv/**',
  '**/venv/**',
];

/** Paths that indicate test/fixture/mock context */
const TEST_PATH_PATTERNS = [
  /\.(test|spec)\.[jt]sx?$/i,
  /\/__tests__\//i,
  /\/test\//i,
  /\/tests\//i,
  /\/fixtures?\//i,
  /\/mocks?\//i,
  /\/__mocks__\//i,
  /\/examples?\//i,
  /\/demo\//i,
  /\/samples?\//i,
];

/** Files where secrets are expected to be placeholders */
const EXAMPLE_FILE_PATTERNS = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
  /\.env\.defaults$/i,
];

// =====================================================
// FALSE POSITIVE HELPERS
// =====================================================

/** Variable names that indicate a placeholder / test value */
const PLACEHOLDER_VAR_NAMES = /\b(example|placeholder|dummy|test|mock|fake|sample|demo|default|template|xxx|todo|changeme|your[_-]?)\b/i;

/** Values that are clearly not real secrets */
const SAFE_VALUE_PATTERNS = [
  /^['"]?\s*['"]?$/,                          // empty string
  /^['"]?<[^>]+>['"]?$/,                      // <placeholder>
  /^['"]?process\.env\./,                      // env var reference
  /^['"]?os\.environ/,                         // python env var
  /^['"]?System\.getenv/,                      // java env var
  /^['"]?\$\{/,                                // template literal ${VAR}
  /^['"]?%[^%]+%['"]?$/,                       // Windows %VAR%
  /^['"]?None['"]?$/i,                         // Python None
  /^['"]?null['"]?$/i,                         // null
  /^['"]?undefined['"]?$/i,                    // undefined
  /^['"]?true['"]?$/i,                         // boolean
  /^['"]?false['"]?$/i,                        // boolean
  /^['"]?\*{3,}['"]?$/,                        // ***
  /^['"]?x{4,}['"]?$/i,                        // xxxx
  /^['"]?0{8,}['"]?$/,                         // 00000000
  /^['"]?1{8,}['"]?$/,                         // 11111111
  /^['"]?your[-_]?/i,                          // your_api_key
  /^['"]?INSERT[-_]/i,                         // INSERT_YOUR_KEY
  /^['"]?CHANGE[-_]?ME/i,                      // CHANGEME
];

// =====================================================
// SHANNON ENTROPY
// =====================================================

function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// =====================================================
// SECRET SCANNER CLASS
// =====================================================

export class SecretScanner {

  /**
   * Scan a directory for exposed secrets.
   * Returns detected secrets (with values REDACTED) and a summary.
   */
  async scan(
    directoryPath: string,
    repositoryId: string
  ): Promise<{ secrets: DetectedSecret[]; summary: SecretScanSummary }> {
    const startTime = Date.now();
    logger.info(`[SecretScanner] Starting scan of ${directoryPath}`);

    // 1. Discover files
    const files = await this.discoverFiles(directoryPath);
    logger.info(`[SecretScanner] Found ${files.length} files to scan`);

    // 2. Scan each file
    const allSecrets: DetectedSecret[] = [];
    for (const relPath of files) {
      try {
        const fullPath = path.join(directoryPath, relPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const fileSecrets = this.scanFileContent(content, relPath, repositoryId);
        allSecrets.push(...fileSecrets);
      } catch (err) {
        // Skip files that cannot be read (binary disguised as text, permission issues, etc.)
        logger.debug(`[SecretScanner] Skipped unreadable file: ${relPath}`);
      }
    }

    // 3. Sort by severity (critical first)
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
    allSecrets.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // 4. Build summary
    const summary: SecretScanSummary = {
      repositoryId,
      totalFilesScanned: files.length,
      totalSecretsFound: allSecrets.length,
      bySeverity: {
        critical: allSecrets.filter(s => s.severity === 'critical').length,
        high: allSecrets.filter(s => s.severity === 'high').length,
        medium: allSecrets.filter(s => s.severity === 'medium').length,
      },
      byType: {},
      scanDuration: Date.now() - startTime,
    };

    for (const secret of allSecrets) {
      summary.byType[secret.type] = (summary.byType[secret.type] || 0) + 1;
    }

    logger.info(
      `[SecretScanner] Scan complete: ${allSecrets.length} secrets found ` +
      `(${summary.bySeverity.critical} critical, ${summary.bySeverity.high} high, ${summary.bySeverity.medium} medium) ` +
      `in ${summary.scanDuration}ms`
    );

    return { secrets: allSecrets, summary };
  }

  // =====================================================
  // FILE DISCOVERY
  // =====================================================

  private async discoverFiles(directoryPath: string): Promise<string[]> {
    const files = await glob('**/*', {
      cwd: directoryPath,
      ignore: IGNORE_GLOBS,
      nodir: true,
      absolute: false,
      dot: true,
    });

    return files.filter(f => this.shouldScanFile(f));
  }

  private shouldScanFile(relPath: string): boolean {
    const basename = path.basename(relPath);
    const ext = path.extname(relPath).toLowerCase();

    // Skip binary files
    if (BINARY_EXTENSIONS.has(ext)) return false;

    // Skip lock files
    if (IGNORE_FILENAMES.has(basename)) return false;

    // Skip minified JS (heuristic: filename contains .min.)
    if (basename.includes('.min.')) return false;

    // Skip example env files (they contain intentional placeholders)
    for (const pat of EXAMPLE_FILE_PATTERNS) {
      if (pat.test(relPath)) return false;
    }

    return true;
  }

  // =====================================================
  // FILE CONTENT SCANNING
  // =====================================================

  private scanFileContent(
    content: string,
    filePath: string,
    repositoryId: string
  ): DetectedSecret[] {
    const secrets: DetectedSecret[] = [];
    const lines = content.split('\n');
    const isTestFile = this.isTestFile(filePath);

    for (const patternDef of SECRET_PATTERNS) {
      // Reset regex lastIndex (global regexes retain state)
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const matchValue = match[0];
        const matchStart = match.index;

        // Determine line number and column
        const { lineNumber, column } = this.getLineAndColumn(content, matchStart);
        const lineContent = lines[lineNumber - 1] || '';

        // --- FALSE POSITIVE FILTERS ---

        // 1. Check if in a comment
        const isInComment = this.isInComment(lineContent, column);

        // 2. Check if the value is a known safe/placeholder value
        if (this.isSafeValue(matchValue, lineContent)) continue;

        // 3. Check variable name context for placeholders
        if (this.isPlaceholderContext(lineContent)) {
          // Still flag but lower confidence
        }

        // 4. For UUID pattern (Heroku), apply extra filtering
        if (patternDef.name === 'Heroku API Key') {
          // UUIDs are very common; only flag if near a key/secret variable assignment
          if (!this.isNearSecretAssignment(lineContent)) continue;
          // Skip in test files
          if (isTestFile) continue;
        }

        // 5. For generic patterns, require higher entropy
        const isGenericPattern = patternDef.name.startsWith('Generic');
        if (isGenericPattern) {
          // Extract the captured group (the actual value) or use full match
          const capturedValue = match[1] || matchValue;
          if (shannonEntropy(capturedValue) < 3.0) continue;
        }

        // 6. Compute confidence
        let confidence = this.computeConfidence(patternDef, matchValue, lineContent, isInComment, isTestFile);

        // 7. If placeholder context, reduce confidence
        if (this.isPlaceholderContext(lineContent)) {
          confidence = Math.max(0.1, confidence - 0.4);
        }

        // Skip very low confidence matches
        if (confidence < 0.2) continue;

        // 8. Build context with REDACTED secret
        const contextLines = this.getContextLines(lines, lineNumber, matchValue);

        // 9. Redact the value
        const redacted = this.redactValue(matchValue);

        secrets.push({
          _key: uuidv4(),
          repositoryId,
          type: patternDef.name,
          severity: isTestFile && patternDef.severity !== 'critical'
            ? this.downgradeSeverity(patternDef.severity)
            : patternDef.severity,
          filePath,
          lineNumber,
          columnStart: column,
          columnEnd: column + matchValue.length,
          matchedPattern: patternDef.name,
          context: contextLines,
          confidence,
          isInComment,
          isInTestFile: isTestFile,
          redactedValue: redacted,
          detectedAt: new Date(),
        });
      }
    }

    // High-entropy string detection (catches novel token formats)
    const entropySecrets = this.detectHighEntropyStrings(content, lines, filePath, repositoryId);
    secrets.push(...entropySecrets);

    return secrets;
  }

  // =====================================================
  // HIGH-ENTROPY STRING DETECTION
  // =====================================================

  private detectHighEntropyStrings(
    content: string,
    lines: string[],
    filePath: string,
    repositoryId: string
  ): DetectedSecret[] {
    const secrets: DetectedSecret[] = [];
    const isTestFile = this.isTestFile(filePath);

    // Look for quoted strings or assignment values that look like tokens
    const highEntropyPattern = /['"]([A-Za-z0-9+/=_\-]{16,})['"]/g;
    let match: RegExpExecArray | null;

    while ((match = highEntropyPattern.exec(content)) !== null) {
      const value = match[1];

      // Must be at least 16 chars
      if (value.length < 16) continue;

      // Must have high entropy
      const entropy = shannonEntropy(value);
      if (entropy < 4.5) continue;

      // Must look like a token (mix of character types)
      if (!this.looksLikeToken(value)) continue;

      const matchStart = match.index;
      const { lineNumber, column } = this.getLineAndColumn(content, matchStart);
      const lineContent = lines[lineNumber - 1] || '';

      // Skip if already caught by pattern matching (avoid duplicates)
      if (this.isAlreadyMatchedByPatterns(value)) continue;

      // Skip safe values
      if (this.isSafeValue(value, lineContent)) continue;

      // Skip placeholder context
      if (this.isPlaceholderContext(lineContent)) continue;

      // Skip if not near a secret-like variable name
      if (!this.isNearSecretAssignment(lineContent)) continue;

      const isInComment = this.isInComment(lineContent, column);

      // Lower confidence for entropy-only matches
      let confidence = 0.6;
      if (isInComment) confidence -= 0.2;
      if (isTestFile) confidence -= 0.2;
      if (entropy > 5.0) confidence += 0.1;
      confidence = Math.max(0.2, Math.min(0.85, confidence));

      if (confidence < 0.2) continue;

      const contextLines = this.getContextLines(lines, lineNumber, value);
      const redacted = this.redactValue(value);

      secrets.push({
        _key: uuidv4(),
        repositoryId,
        type: 'High Entropy String',
        severity: 'medium',
        filePath,
        lineNumber,
        columnStart: column,
        columnEnd: column + match[0].length,
        matchedPattern: 'entropy_detection',
        context: contextLines,
        confidence,
        isInComment,
        isInTestFile: isTestFile,
        redactedValue: redacted,
        detectedAt: new Date(),
      });
    }

    return secrets;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private getLineAndColumn(content: string, offset: number): { lineNumber: number; column: number } {
    let line = 1;
    let lastNewline = -1;
    for (let i = 0; i < offset && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
        lastNewline = i;
      }
    }
    return { lineNumber: line, column: offset - lastNewline - 1 };
  }

  private isInComment(lineContent: string, column: number): boolean {
    const trimmed = lineContent.trimStart();

    // Single-line comment prefixes
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return true;
    }

    // Check if there's a // before the match position
    const beforeMatch = lineContent.substring(0, column);
    if (beforeMatch.includes('//') || beforeMatch.includes('#')) {
      return true;
    }

    return false;
  }

  private isTestFile(filePath: string): boolean {
    for (const pat of TEST_PATH_PATTERNS) {
      if (pat.test(filePath)) return true;
    }
    return false;
  }

  private isSafeValue(matchValue: string, lineContent: string): boolean {
    // Check if the line assigns the value to an env var reference
    for (const pat of SAFE_VALUE_PATTERNS) {
      if (pat.test(matchValue)) return true;
    }

    // Check if the assignment value is actually an env var lookup
    const envPatterns = [
      /process\.env\.[A-Z_]+/,
      /os\.environ\[/,
      /os\.getenv\(/,
      /System\.getenv\(/,
      /\$\{[A-Z_]+\}/,
      /config\.[a-zA-Z]+/,
    ];
    for (const pat of envPatterns) {
      // Check if the right-hand side of the assignment is an env var reference
      const assignMatch = lineContent.match(/[=:]\s*(.+)$/);
      if (assignMatch && pat.test(assignMatch[1])) return true;
    }

    return false;
  }

  private isPlaceholderContext(lineContent: string): boolean {
    return PLACEHOLDER_VAR_NAMES.test(lineContent);
  }

  private isNearSecretAssignment(lineContent: string): boolean {
    return /\b(key|secret|token|password|passwd|pwd|credential|api[_-]?key|auth|private[_-]?key|access[_-]?key)\b/i.test(lineContent);
  }

  private looksLikeToken(value: string): boolean {
    // Must contain a mix of character types (not just hex or just alpha)
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    const hasSpecial = /[+/=_\-]/.test(value);

    // At least 3 of the 4 character classes
    const classes = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    return classes >= 2;
  }

  private isAlreadyMatchedByPatterns(value: string): boolean {
    // Quick check: does this value match any of the known specific patterns?
    for (const patternDef of SECRET_PATTERNS) {
      if (patternDef.name === 'Heroku API Key') continue; // UUID too broad
      if (patternDef.name.startsWith('Generic')) continue;  // Generic too broad
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
      if (regex.test(value)) return true;
    }
    return false;
  }

  private computeConfidence(
    patternDef: SecretPattern,
    matchValue: string,
    lineContent: string,
    isInComment: boolean,
    isTestFile: boolean
  ): number {
    let confidence = 0.85; // Base confidence for pattern matches

    // Specific well-known patterns get higher confidence
    const highConfidencePatterns = [
      'AWS Access Key', 'AWS Secret Key', 'GitHub Token', 'GitHub App Token',
      'Stripe Secret Key', 'SendGrid API Key', 'npm Token', 'PyPI Token',
      'Atlassian API Token', 'RSA Private Key', 'SSH Private Key',
    ];
    if (highConfidencePatterns.includes(patternDef.name)) {
      confidence = 0.95;
    }

    // Generic patterns get lower base confidence
    if (patternDef.name.startsWith('Generic')) {
      confidence = 0.65;
      // Boost if high entropy
      const capturedValue = matchValue;
      if (shannonEntropy(capturedValue) > 4.5) confidence += 0.15;
    }

    // Adjustments
    if (isInComment) confidence -= 0.15;
    if (isTestFile) confidence -= 0.1;

    // UUID pattern (Heroku) gets low base confidence
    if (patternDef.name === 'Heroku API Key') {
      confidence = 0.45;
    }

    return Math.max(0.1, Math.min(0.99, confidence));
  }

  private getContextLines(lines: string[], lineNumber: number, secretValue: string): string {
    const start = Math.max(0, lineNumber - 3);
    const end = Math.min(lines.length, lineNumber + 2);
    const contextSlice = lines.slice(start, end);

    // Redact the secret in context
    return contextSlice
      .map((line, i) => {
        const num = start + i + 1;
        const redactedLine = line.replace(secretValue, '***REDACTED***');
        return `${num}: ${redactedLine}`;
      })
      .join('\n');
  }

  private redactValue(value: string): string {
    if (value.length <= 6) return '***';
    const first4 = value.substring(0, 4);
    const last2 = value.substring(value.length - 2);
    return `${first4}***${last2}`;
  }

  private downgradeSeverity(severity: 'critical' | 'high' | 'medium'): 'critical' | 'high' | 'medium' {
    const downgrade: Record<string, 'critical' | 'high' | 'medium'> = {
      critical: 'high',
      high: 'medium',
      medium: 'medium',
    };
    return downgrade[severity] || severity;
  }
}
