import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { DetectedFramework } from '../analyzers/framework-detector';

export interface ExtractedEndpoint {
  _key: string;
  repositoryId: string;
  method: string;   // GET, POST, PUT, DELETE, PATCH, ALL
  path: string;
  handlerName?: string;
  filePath: string;  // relative to repo root
  lineNumber: number;
  framework: string;
  hasSwaggerDoc: boolean;
  parameters?: Array<{ name: string; in: 'path' | 'query' | 'body'; type?: string }>;
  extractedAt: Date;
}

/* ------------------------------------------------------------------ */
/*  Pattern definitions per framework                                  */
/* ------------------------------------------------------------------ */

interface FrameworkPatterns {
  fileGlobs: string[];
  linePatterns: RegExp[];
}

const FRAMEWORK_PATTERNS: Record<string, FrameworkPatterns> = {
  express: {
    fileGlobs: ['**/*.js', '**/*.ts', '**/*.mjs'],
    linePatterns: [
      // app.get('/path', handler)  or  router.post('/path', handler)
      /(?:app|router)\.(get|post|put|delete|patch|all|options|head)\s*\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*(\w+))?/i,
    ],
  },
  fastify: {
    fileGlobs: ['**/*.js', '**/*.ts', '**/*.mjs'],
    linePatterns: [
      /(?:fastify|server|app|instance)\.(get|post|put|delete|patch|all|options|head)\s*\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*(?:\{[^}]*\}\s*,\s*)?(\w+))?/i,
    ],
  },
  flask: {
    fileGlobs: ['**/*.py'],
    linePatterns: [
      // @app.route('/path', methods=['GET'])  or  @blueprint.route('/path')
      /@(?:app|blueprint|\w+_bp|\w+_blueprint)\.route\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*methods\s*=\s*\[([^\]]+)\])?/i,
    ],
  },
  fastapi: {
    fileGlobs: ['**/*.py'],
    linePatterns: [
      // @app.get("/path")  or  @router.post("/path")
      /@(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/i,
    ],
  },
  django: {
    fileGlobs: ['**/urls.py', '**/urls/*.py'],
    linePatterns: [
      // path('url/', view_name)  or  re_path(r'^pattern$', view_name)
      /(?:path|re_path)\s*\(\s*(?:r)?['"]([^'"]+)['"]\s*,\s*(\w[\w.]*)/i,
    ],
  },
  'spring-boot': {
    fileGlobs: ['**/*.java'],
    linePatterns: [
      // @GetMapping("/path")  @PostMapping  @RequestMapping
      /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]/i,
    ],
  },
};

/* Files whose presence means the repo has Swagger / OpenAPI docs */
const SWAGGER_GLOBS = [
  '**/swagger.json',
  '**/swagger.yaml',
  '**/swagger.yml',
  '**/openapi.json',
  '**/openapi.yaml',
  '**/openapi.yml',
];

/* ------------------------------------------------------------------ */
/*  EndpointExtractor                                                  */
/* ------------------------------------------------------------------ */

export class EndpointExtractor {
  /**
   * Scan a cloned repository for API endpoint definitions.
   *
   * @param directoryPath  Absolute path to the repo root on disk
   * @param repositoryId   Owning repository id stored in ArangoDB
   * @param frameworks     Frameworks already detected for this repo
   * @returns              Array of extracted endpoint documents
   */
  async extract(
    directoryPath: string,
    repositoryId: string,
    frameworks: DetectedFramework[],
  ): Promise<ExtractedEndpoint[]> {
    const timer = logger.startTimer('endpoint-extraction');
    const endpoints: ExtractedEndpoint[] = [];

    try {
      // Determine once whether swagger/openapi docs are present
      const hasSwaggerDoc = await this.detectSwaggerDocs(directoryPath);

      for (const fw of frameworks) {
        const fwKey = fw.framework.toLowerCase().replace(/\s+/g, '-');
        const patternDef = FRAMEWORK_PATTERNS[fwKey];
        if (!patternDef) {
          logger.debug(`No endpoint patterns defined for framework "${fw.framework}", skipping`);
          continue;
        }

        const files = await this.resolveFiles(directoryPath, patternDef.fileGlobs);
        logger.debug(`Scanning ${files.length} files for ${fw.framework} endpoints`);

        for (const filePath of files) {
          const relPath = path.relative(directoryPath, filePath).replace(/\\/g, '/');
          try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              for (const pattern of patternDef.linePatterns) {
                const match = pattern.exec(line);
                if (!match) continue;

                const endpoint = this.buildEndpoint(
                  match,
                  fwKey,
                  fw.framework,
                  relPath,
                  i + 1,
                  repositoryId,
                  hasSwaggerDoc,
                );
                if (endpoint) {
                  endpoints.push(endpoint);
                }
              }
            }
          } catch (readErr: any) {
            logger.warn(`Could not read file ${relPath}: ${readErr.message}`);
          }
        }
      }

      logger.info(`Extracted ${endpoints.length} endpoints from repository ${repositoryId}`);
    } catch (error) {
      logger.error('Endpoint extraction failed', error);
      throw error;
    } finally {
      timer();
    }

    return endpoints;
  }

  /* ---------------------------------------------------------------- */
  /*  Private helpers                                                   */
  /* ---------------------------------------------------------------- */

  private async resolveFiles(root: string, globs: string[]): Promise<string[]> {
    const allFiles = new Set<string>();
    for (const pattern of globs) {
      const matches = await glob(pattern, {
        cwd: root,
        absolute: true,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/__pycache__/**', '**/venv/**', '**/.venv/**'],
      });
      for (const m of matches) {
        allFiles.add(m);
      }
    }
    return Array.from(allFiles);
  }

  private async detectSwaggerDocs(root: string): Promise<boolean> {
    for (const pattern of SWAGGER_GLOBS) {
      const matches = await glob(pattern, {
        cwd: root,
        absolute: true,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });
      if (matches.length > 0) return true;
    }
    return false;
  }

  /**
   * Turn a regex match into an ExtractedEndpoint.
   * Returns `null` when the match is not meaningful.
   */
  private buildEndpoint(
    match: RegExpExecArray,
    fwKey: string,
    frameworkLabel: string,
    relPath: string,
    lineNumber: number,
    repositoryId: string,
    hasSwaggerDoc: boolean,
  ): ExtractedEndpoint | null {
    let method: string;
    let routePath: string;
    let handlerName: string | undefined;

    switch (fwKey) {
      case 'express':
      case 'fastify': {
        // Groups: (1) method, (2) path, (3) optional handler name
        method = (match[1] ?? 'ALL').toUpperCase();
        routePath = match[2] ?? '/';
        handlerName = match[3] || undefined;
        break;
      }

      case 'flask': {
        // Groups: (1) path, (2) comma-separated methods like 'GET', 'POST'
        routePath = match[1] ?? '/';
        const rawMethods = match[2];
        if (rawMethods) {
          const methods = rawMethods.replace(/['" ]/g, '').split(',');
          method = methods.map((m) => m.trim().toUpperCase()).join(',');
        } else {
          method = 'GET';
        }
        break;
      }

      case 'fastapi': {
        // Groups: (1) method, (2) path
        method = (match[1] ?? 'GET').toUpperCase();
        routePath = match[2] ?? '/';
        break;
      }

      case 'django': {
        // Groups: (1) url pattern, (2) view name
        routePath = match[1] ?? '/';
        handlerName = match[2] || undefined;
        method = 'ALL'; // Django urls.py doesn't specify HTTP method
        break;
      }

      case 'spring-boot': {
        // Groups: (1) annotation prefix (Get/Post/…), (2) path
        const annotation = (match[1] ?? 'Request').toLowerCase();
        method = annotation === 'request' ? 'ALL' : annotation.toUpperCase();
        routePath = match[2] ?? '/';
        break;
      }

      default:
        return null;
    }

    // Extract path parameters
    const parameters = this.extractPathParams(routePath);

    return {
      _key: uuidv4(),
      repositoryId,
      method,
      path: routePath,
      handlerName,
      filePath: relPath,
      lineNumber,
      framework: frameworkLabel,
      hasSwaggerDoc,
      parameters: parameters.length > 0 ? parameters : undefined,
      extractedAt: new Date(),
    };
  }

  /**
   * Pull named path parameters from a route string.
   * Handles Express-style `:id`, FastAPI-style `{id}`, and Django `<int:id>`.
   */
  private extractPathParams(
    routePath: string,
  ): Array<{ name: string; in: 'path'; type?: string }> {
    const params: Array<{ name: string; in: 'path'; type?: string }> = [];
    const seen = new Set<string>();

    // Express / Flask  :paramName
    const colonParams = routePath.matchAll(/:(\w+)/g);
    for (const m of colonParams) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        params.push({ name: m[1], in: 'path' });
      }
    }

    // FastAPI / OpenAPI  {paramName}
    const braceParams = routePath.matchAll(/\{(\w+)\}/g);
    for (const m of braceParams) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        params.push({ name: m[1], in: 'path' });
      }
    }

    // Django  <type:paramName> or <paramName>
    const angleParams = routePath.matchAll(/<(?:(\w+):)?(\w+)>/g);
    for (const m of angleParams) {
      const paramType = m[1] || undefined;
      const paramName = m[2];
      if (!seen.has(paramName)) {
        seen.add(paramName);
        params.push({ name: paramName, in: 'path', type: paramType });
      }
    }

    return params;
  }
}
