/**
 * Programmatic verification helpers for QA agent findings.
 * These functions check LLM-generated findings against actual code,
 * filtering out false positives caused by hallucination or truncated context.
 */

import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GlobalMiddleware {
  hasRateLimiting: boolean;
  hasAuth: boolean;
  hasCors: boolean;
  hasHelmet: boolean;
  hasRouterAuth: boolean;
  details: string[];
}

export interface RouteInfo {
  method: string;
  path: string;
  file: string;
  line?: number;
  hasAuth: boolean;
  hasErrorHandling: boolean;
}

type CodeFile = { path: string; content?: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePath(p: string): string {
  return (p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
}

function resolvePath(fromDir: string, importPath: string): string {
  const parts = fromDir.split('/').filter(Boolean);
  const importParts = importPath.split('/');

  for (const seg of importParts) {
    if (seg === '..') {
      parts.pop();
    } else if (seg !== '.') {
      parts.push(seg);
    }
  }
  return parts.join('/');
}

function buildPathIndex(codeFiles: CodeFile[]): Set<string> {
  const index = new Set<string>();
  for (const f of codeFiles) {
    if (f.path) index.add(normalizePath(f.path));
  }
  return index;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if an imported file actually exists in the codeFiles array.
 * Resolves relative paths and tries multiple extensions.
 */
export function fileExistsInCodeFiles(
  codeFiles: CodeFile[],
  importPath: string,
  fromFile: string
): boolean {
  if (!importPath || !codeFiles?.length) return false;

  // Skip node_modules / bare specifiers (non-relative imports)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    // Bare import like 'react' or '@chakra-ui/react' — not a local file
    return true; // assume external packages exist (checked separately via packageExistsInManifests)
  }

  const pathIndex = buildPathIndex(codeFiles);
  const fromDir = dirname(fromFile);
  const resolved = resolvePath(fromDir, importPath);

  const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json'];
  const indexFiles = ['/index.js', '/index.jsx', '/index.ts', '/index.tsx'];

  // Try direct path with extensions
  for (const ext of extensions) {
    if (pathIndex.has(resolved + ext)) return true;
  }

  // Try as directory with index file
  for (const idx of indexFiles) {
    if (pathIndex.has(resolved + idx)) return true;
  }

  // Also try stripping existing extension and re-trying
  const withoutExt = resolved.replace(/\.(js|jsx|ts|tsx)$/, '');
  if (withoutExt !== resolved) {
    for (const ext of extensions) {
      if (pathIndex.has(withoutExt + ext)) return true;
    }
  }

  return false;
}

/**
 * Check if a named export exists in a file.
 */
export function exportExistsInFile(
  codeFiles: CodeFile[],
  filePath: string,
  exportName: string
): boolean {
  if (!filePath || !exportName || !codeFiles?.length) return false;

  const normalizedTarget = normalizePath(filePath);
  const file = codeFiles.find(f => {
    const n = normalizePath(f.path);
    return n === normalizedTarget || n.endsWith(normalizedTarget) || normalizedTarget.endsWith(n);
  });

  if (!file?.content) return false;

  const content = file.content;

  // Check various export patterns
  const patterns = [
    // export const/let/var/function/class NAME
    new RegExp(`export\\s+(const|let|var|function|class|enum|type|interface)\\s+${escapeRegex(exportName)}\\b`),
    // export { NAME } or export { something as NAME }
    new RegExp(`export\\s*\\{[^}]*\\b${escapeRegex(exportName)}\\b[^}]*\\}`),
    // export default NAME or export default function NAME
    ...(exportName === 'default' ? [/export\s+default\b/] : []),
    // module.exports.NAME or module.exports = { NAME }
    new RegExp(`module\\.exports\\.${escapeRegex(exportName)}\\b`),
    new RegExp(`module\\.exports\\s*=\\s*\\{[^}]*\\b${escapeRegex(exportName)}\\b`),
  ];

  return patterns.some(p => p.test(content));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a package exists in ANY package.json in the codebase.
 */
export function packageExistsInManifests(
  codeFiles: CodeFile[],
  packageName: string
): boolean {
  if (!packageName || !codeFiles?.length) return false;

  const packageFiles = codeFiles.filter(f => normalizePath(f.path).endsWith('package.json'));

  for (const pf of packageFiles) {
    if (!pf.content) continue;
    try {
      const parsed = JSON.parse(pf.content);
      const depSections = [
        parsed.dependencies,
        parsed.devDependencies,
        parsed.peerDependencies,
        parsed.optionalDependencies,
      ];
      for (const section of depSections) {
        if (section && typeof section === 'object' && packageName in section) {
          return true;
        }
      }
    } catch {
      // Malformed package.json — try simple string search as fallback
      if (pf.content.includes(`"${packageName}"`)) return true;
    }
  }

  return false;
}

/**
 * Detect global middleware applied to all routes.
 * Scans server entry files for app.use() patterns.
 */
export function detectGlobalMiddleware(
  codeFiles: CodeFile[]
): GlobalMiddleware {
  const result: GlobalMiddleware = {
    hasRateLimiting: false,
    hasAuth: false,
    hasCors: false,
    hasHelmet: false,
    hasRouterAuth: false,
    details: [],
  };

  if (!codeFiles?.length) return result;

  // Find server entry files and middleware files
  const entryFiles = codeFiles.filter(f => {
    const p = normalizePath(f.path);
    return (
      (p.match(/(^|\/)((server|app|index|main)\.(ts|js))$/) ||
       p.match(/src\/(server|app|index|main)\.(ts|js)$/)) &&
      f.content
    );
  });

  // Also check dedicated middleware files
  const middlewareFiles = codeFiles.filter(f =>
    normalizePath(f.path).match(/middleware/i) && f.content
  );

  const allFiles = [...entryFiles, ...middlewareFiles];

  for (const file of allFiles) {
    const content = file.content || '';

    // Rate limiting — detect all patterns including path-prefixed app.use('/api', limiter)
    if (/app\.use\s*\(\s*rateLimit/i.test(content) ||
        /app\.use\s*\(\s*limiter/i.test(content) ||
        /app\.use\s*\(\s*slowDown/i.test(content) ||
        /app\.use\s*\(\s*['"][^'"]*['"]\s*,\s*(rateLimit|limiter|rateLimiter)/i.test(content) ||
        /const\s+(limiter|rateLimiter|rateLimit)\s*=\s*require\s*\(\s*['"]express-rate-limit['"]\s*\)/i.test(content) ||
        /require\s*\(\s*['"]express-rate-limit['"]\s*\)/.test(content) ||
        /from\s+['"]express-rate-limit['"]/.test(content) ||
        /from\s+['"]rate-limiter-flexible['"]/.test(content) ||
        /rateLimit\s*\(\s*\{/.test(content) ||
        /new\s+RateLimiterMemory/.test(content)) {
      result.hasRateLimiting = true;
      result.details.push(`- Global rate limiting detected in ${file.path}`);
    }

    // Helmet
    if (/app\.use\s*\(\s*helmet/i.test(content) ||
        /require\s*\(\s*['"]helmet['"]\s*\)/.test(content) ||
        /from\s+['"]helmet['"]/.test(content)) {
      result.hasHelmet = true;
      result.details.push(`- Helmet security headers detected in ${file.path}`);
    }

    // CORS
    if (/app\.use\s*\(\s*cors/i.test(content) ||
        /require\s*\(\s*['"]cors['"]\s*\)/.test(content) ||
        /from\s+['"]cors['"]/.test(content)) {
      result.hasCors = true;
      result.details.push(`- CORS middleware detected in ${file.path}`);
    }

    // Auth middleware
    if (/app\.use\s*\(\s*(requireAuth|authenticate|passport\.authenticate|authMiddleware|verifyToken|isAuthenticated)/i.test(content) ||
        /app\.use\s*\(\s*['"]\/api['"],?\s*(requireAuth|authenticate|authMiddleware)/i.test(content)) {
      result.hasAuth = true;
      result.details.push(`- Global authentication middleware detected in ${file.path}`);
    }

    // Router-level auth
    if (/router\.use\s*\(\s*(requireAuth|requireRole|authenticate|authMiddleware|verifyToken)/i.test(content)) {
      result.hasRouterAuth = true;
      result.details.push(`- Router-level authentication detected in ${file.path}`);
    }
  }

  // Also check if packages are installed
  if (!result.hasRateLimiting && packageExistsInManifests(codeFiles, 'express-rate-limit')) {
    result.hasRateLimiting = true;
    result.details.push('- express-rate-limit package is installed (may be used globally)');
  }
  if (!result.hasHelmet && packageExistsInManifests(codeFiles, 'helmet')) {
    result.hasHelmet = true;
    result.details.push('- helmet package is installed (may be used globally)');
  }
  if (!result.hasCors && packageExistsInManifests(codeFiles, 'cors')) {
    result.hasCors = true;
    result.details.push('- cors package is installed (may be used globally)');
  }

  return result;
}

/**
 * Extract ALL backend routes from ALL files.
 * Understands router mounting (app.use('/prefix', router)).
 */
export function extractAllRoutes(
  codeFiles: CodeFile[]
): RouteInfo[] {
  const routes: RouteInfo[] = [];
  if (!codeFiles?.length) return routes;

  // First pass: find router mount prefixes
  const routerMounts = new Map<string, string>(); // filename -> prefix
  for (const file of codeFiles) {
    if (!file.content || !file.path) continue;
    const content = file.content;
    const p = normalizePath(file.path);

    // app.use('/api/prefix', someRouter) or app.use('/api/prefix', require('./routes/x'))
    const mountRegex = /app\.use\s*\(\s*['"]([^'"]+)['"]\s*,\s*(?:require\s*\(\s*['"]([^'"]+)['"]\s*\)|(\w+))/g;
    let match;
    while ((match = mountRegex.exec(content)) !== null) {
      const prefix = match[1];
      const routerFile = match[2] || match[3];
      if (routerFile) {
        // Resolve relative path
        if (routerFile.startsWith('.')) {
          const resolved = resolvePath(dirname(p), routerFile);
          routerMounts.set(resolved, prefix);
          // Also try with extensions
          for (const ext of ['.js', '.ts']) {
            routerMounts.set(resolved + ext, prefix);
          }
        } else {
          routerMounts.set(routerFile, prefix);
        }
      }
    }
  }

  // Second pass: extract routes
  for (const file of codeFiles) {
    if (!file.content || !file.path) continue;
    const content = file.content;
    const filePath = normalizePath(file.path);

    // Determine prefix for this file
    let prefix = '';
    for (const [mountFile, mountPrefix] of Array.from(routerMounts.entries())) {
      if (filePath.includes(mountFile) || filePath.endsWith(mountFile)) {
        prefix = mountPrefix;
        break;
      }
    }

    // Match route definitions: router.get('/path', ...) or app.post('/path', ...)
    const routeRegex = /(?:router|app|server)\.(get|post|put|delete|patch|options|head|all)\s*\(\s*['"]([^'"]+)['"]/gi;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const fullPath = prefix + routePath;

      // Check if this route handler has auth middleware in the same line/call
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index + match[0].length);
      const fullLine = content.substring(lineStart, lineEnd > 0 ? lineEnd : match.index + 200);
      const hasAuth = /requireAuth|authenticate|isAuthenticated|verifyToken|authMiddleware|requireRole/i.test(fullLine);

      // Check for try/catch in the handler
      const handlerStart = match.index;
      const handlerEnd = Math.min(handlerStart + 500, content.length);
      const handlerBlock = content.substring(handlerStart, handlerEnd);
      const hasErrorHandling = /try\s*\{/.test(handlerBlock) || /\.catch\s*\(/.test(handlerBlock);

      // Get line number
      const lineNumber = content.substring(0, match.index).split('\n').length;

      routes.push({
        method,
        path: fullPath,
        file: file.path,
        line: lineNumber,
        hasAuth,
        hasErrorHandling,
      });
    }

    // Also match Fastify-style: fastify.get('/path', ...)
    const fastifyRegex = /(?:fastify|server|instance)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
    while ((match = fastifyRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const fullPath = prefix + routePath;
      const lineNumber = content.substring(0, match.index).split('\n').length;

      routes.push({
        method,
        path: fullPath,
        file: file.path,
        line: lineNumber,
        hasAuth: false,
        hasErrorHandling: false,
      });
    }
  }

  return routes;
}

/**
 * Check if a route handler has try/catch error handling.
 */
export function routeHasErrorHandling(
  codeFiles: CodeFile[],
  filePath: string,
  routePath: string
): boolean {
  if (!filePath || !routePath || !codeFiles?.length) return false;

  const normalizedTarget = normalizePath(filePath);
  const file = codeFiles.find(f => {
    const n = normalizePath(f.path);
    return n === normalizedTarget || n.endsWith(normalizedTarget) || normalizedTarget.endsWith(n);
  });

  if (!file?.content) return false;

  const content = file.content;

  // Strip method prefix from routePath if present
  const cleanPath = routePath.replace(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+/i, '');

  // Find the route definition
  const escapedPath = escapeRegex(cleanPath);
  const routeRegex = new RegExp(`\\.(get|post|put|delete|patch)\\s*\\(\\s*['"]${escapedPath}['"]`, 'i');
  const routeMatch = routeRegex.exec(content);

  if (!routeMatch) {
    // Route not found by exact path — try fuzzy: check if file has any try/catch at all
    // Many Express apps wrap ALL handlers in try/catch
    const hasTryCatch = /try\s*\{/.test(content);
    const hasGlobalErrorHandler = /app\.use\s*\(\s*\(\s*(err|error)\s*,\s*req\s*,\s*res/.test(content) ||
      /sendError\s*\(/.test(content) ||
      /errorHandler/.test(content);
    if (hasTryCatch || hasGlobalErrorHandler) return true;
    return false;
  }

  // Extract ~800 chars after the route definition to find the handler body
  const handlerBlock = content.substring(routeMatch.index, Math.min(routeMatch.index + 800, content.length));

  // Check for try/catch, .catch(), or async error wrapper
  return /try\s*\{/.test(handlerBlock) ||
         /\.catch\s*\(/.test(handlerBlock) ||
         /asyncHandler\s*\(/.test(handlerBlock) ||
         /catchAsync\s*\(/.test(handlerBlock) ||
         /wrapAsync\s*\(/.test(handlerBlock) ||
         /sendError\s*\(/.test(handlerBlock);
}

/**
 * Check if a route has input validation/sanitization.
 */
export function routeHasInputValidation(
  codeFiles: CodeFile[],
  filePath: string,
  routePath: string
): boolean {
  if (!filePath || !routePath || !codeFiles?.length) return false;

  const normalizedTarget = normalizePath(filePath);
  const file = codeFiles.find(f => {
    const n = normalizePath(f.path);
    return n === normalizedTarget || n.endsWith(normalizedTarget) || normalizedTarget.endsWith(n);
  });

  if (!file?.content) return false;

  const content = file.content;

  // Check file-level imports for validation libraries
  const hasValidationLibrary =
    /require\s*\(\s*['"](@hapi\/)?joi['"]\s*\)/.test(content) ||
    /from\s+['"](@hapi\/)?joi['"]/.test(content) ||
    /from\s+['"]yup['"]/.test(content) ||
    /from\s+['"]zod['"]/.test(content) ||
    /from\s+['"]express-validator['"]/.test(content) ||
    /from\s+['"]class-validator['"]/.test(content) ||
    /from\s+['"]ajv['"]/.test(content) ||
    /from\s+['"]superstruct['"]/.test(content);

  if (hasValidationLibrary) return true;

  // Check for Fastify schema validation (schema: { body: ... })
  const cleanPath = routePath.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '');
  const escapedPath = escapeRegex(cleanPath);
  const routeRegex = new RegExp(`['"]${escapedPath}['"]`, 'i');
  const routeMatch = routeRegex.exec(content);

  if (routeMatch) {
    const handlerBlock = content.substring(
      Math.max(0, routeMatch.index - 100),
      Math.min(routeMatch.index + 600, content.length)
    );

    // Fastify schema validation
    if (/schema\s*:\s*\{/.test(handlerBlock)) return true;

    // Manual validation patterns
    if (/\.validate\s*\(/.test(handlerBlock)) return true;
    if (/\.parse\s*\(/.test(handlerBlock)) return true;  // zod .parse()
    if (/validationResult\s*\(/.test(handlerBlock)) return true;

    // Whitelist/sanitize checks
    if (/sanitize|whitelist|allowlist|allowedTables|validTables|approved/i.test(handlerBlock)) return true;

    // Array/Set inclusion check (e.g., validTables.includes(req.params.table))
    if (/\.(includes|has)\s*\(\s*req\.(params|body|query)/.test(handlerBlock)) return true;
    if (/\.\s*includes\s*\(\s*\w+\s*\)/.test(handlerBlock) && /req\.(params|body|query)/.test(handlerBlock)) return true;

    // Type checking
    if (/typeof\s+req\.(body|params|query)/.test(handlerBlock)) return true;

    // Object.keys check or switch statement on param
    if (/switch\s*\(\s*req\.(params|body|query)/.test(handlerBlock)) return true;
    if (/if\s*\(\s*!\s*\[/.test(handlerBlock)) return true; // if (!['a','b'].includes(...))
    if (/if\s*\(\s*!\s*\w+\s*\.\s*includes/.test(handlerBlock)) return true;
  }

  return false;
}

/**
 * Check if a vite config port difference is a standard proxy setup.
 */
export function isStandardDevProxy(
  codeFiles: CodeFile[]
): boolean {
  if (!codeFiles?.length) return false;

  const viteConfigs = codeFiles.filter(f =>
    normalizePath(f.path).match(/vite\.config\.(ts|js|mjs)$/)
  );

  for (const config of viteConfigs) {
    if (!config.content) continue;
    // Check for proxy configuration — this is a normal dev setup
    if (/proxy\s*:\s*\{/.test(config.content) ||
        /server\s*:\s*\{[\s\S]*?proxy/.test(config.content)) {
      return true;
    }
  }

  return false;
}
