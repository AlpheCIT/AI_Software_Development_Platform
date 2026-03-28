import { v4 as uuidv4 } from 'uuid';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

// ─── Dependency input type ───────────────────────────────────────────────────
// Matches the shape produced by the dependency extractor.
// Defined here so callers that only need the detector don't have to pull in
// the full extractor module.
export interface ExtractedDependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer' | 'optional';
  source: string;         // e.g. "package.json", "requirements.txt"
  language?: string;
}

// ─── Output interfaces ──────────────────────────────────────────────────────

export interface DetectedFramework {
  _key: string;
  repositoryId: string;
  framework: string;
  version: string;
  language: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'build';
  confidence: number; // 0-1
  evidence: string[];
  detectedAt: Date;
}

export interface DetectedMiddleware {
  _key: string;
  repositoryId: string;
  name: string;
  packageName: string;
  version: string;
  category: 'security' | 'auth' | 'logging' | 'performance' | 'parsing' | 'other';
  framework?: string;  // which framework it's associated with
  detectedAt: Date;
}

// ─── Signature maps ─────────────────────────────────────────────────────────

const FRAMEWORK_SIGNATURES: Record<string, { framework: string; language: string; category: string }> = {
  // JavaScript / TypeScript
  'express':         { framework: 'Express',        language: 'javascript',  category: 'backend'   },
  'fastify':         { framework: 'Fastify',        language: 'javascript',  category: 'backend'   },
  'koa':             { framework: 'Koa',            language: 'javascript',  category: 'backend'   },
  'hapi':            { framework: 'Hapi',           language: 'javascript',  category: 'backend'   },
  'nestjs':          { framework: 'NestJS',         language: 'javascript',  category: 'backend'   },
  '@nestjs/core':    { framework: 'NestJS',         language: 'javascript',  category: 'backend'   },
  'next':            { framework: 'Next.js',        language: 'javascript',  category: 'fullstack' },
  'react':           { framework: 'React',          language: 'javascript',  category: 'frontend'  },
  'vue':             { framework: 'Vue.js',         language: 'javascript',  category: 'frontend'  },
  'angular':         { framework: 'Angular',        language: 'typescript',  category: 'frontend'  },
  '@angular/core':   { framework: 'Angular',        language: 'typescript',  category: 'frontend'  },
  'svelte':          { framework: 'Svelte',         language: 'javascript',  category: 'frontend'  },
  // Python
  'django':          { framework: 'Django',         language: 'python',      category: 'backend'   },
  'flask':           { framework: 'Flask',          language: 'python',      category: 'backend'   },
  'fastapi':         { framework: 'FastAPI',        language: 'python',      category: 'backend'   },
  'tornado':         { framework: 'Tornado',        language: 'python',      category: 'backend'   },
  // Java
  'spring-boot':     { framework: 'Spring Boot',    language: 'java',        category: 'backend'   },
  // Ruby
  'rails':           { framework: 'Ruby on Rails',  language: 'ruby',        category: 'backend'   },
  // Go
  'gin':             { framework: 'Gin',            language: 'go',          category: 'backend'   },
  'echo':            { framework: 'Echo',           language: 'go',          category: 'backend'   },
};

const MIDDLEWARE_SIGNATURES: Record<string, { name: string; category: string }> = {
  'cors':                 { name: 'CORS',          category: 'security'    },
  'helmet':               { name: 'Helmet',        category: 'security'    },
  'express-rate-limit':   { name: 'Rate Limiting', category: 'security'    },
  '@fastify/rate-limit':  { name: 'Rate Limiting', category: 'security'    },
  '@fastify/cors':        { name: 'CORS',          category: 'security'    },
  '@fastify/helmet':      { name: 'Helmet',        category: 'security'    },
  'passport':             { name: 'Passport.js',   category: 'auth'        },
  'jsonwebtoken':         { name: 'JWT',           category: 'auth'        },
  'morgan':               { name: 'Morgan',        category: 'logging'     },
  'winston':              { name: 'Winston',       category: 'logging'     },
  'pino':                 { name: 'Pino',          category: 'logging'     },
  'compression':          { name: 'Compression',   category: 'performance' },
  'body-parser':          { name: 'Body Parser',   category: 'parsing'     },
};

// ─── Code-pattern definitions for Pass 2 ────────────────────────────────────

interface CodePattern {
  /** glob to select candidate files */
  fileGlob: string;
  /** regex applied to file contents */
  pattern: RegExp;
  framework: string;
  language: string;
  category: string;
  evidence: string;
}

const CODE_PATTERNS: CodePattern[] = [
  // Express middleware usage
  {
    fileGlob: '**/*.{js,ts}',
    pattern: /app\.use\s*\(/,
    framework: 'Express',
    language: 'javascript',
    category: 'backend',
    evidence: 'app.use() middleware pattern found',
  },
  // Flask route decorator
  {
    fileGlob: '**/*.py',
    pattern: /@app\.route\s*\(/,
    framework: 'Flask',
    language: 'python',
    category: 'backend',
    evidence: '@app.route decorator found',
  },
  // FastAPI decorators
  {
    fileGlob: '**/*.py',
    pattern: /@app\.(get|post|put|delete|patch)\s*\(/,
    framework: 'FastAPI',
    language: 'python',
    category: 'backend',
    evidence: '@app.<method> decorator found (FastAPI style)',
  },
  // Spring Boot / NestJS decorators
  {
    fileGlob: '**/*.{java,ts}',
    pattern: /@(Controller|Service|Injectable|Module)\b/,
    framework: 'NestJS/Spring',
    language: 'javascript',
    category: 'backend',
    evidence: '@Controller / @Service decorator found',
  },
];

// ─── Detector class ─────────────────────────────────────────────────────────

export class FrameworkDetector {
  /**
   * Run a two-pass detection:
   *  1. Dependency-based (high confidence)
   *  2. Code-pattern supplementary scan
   */
  async detect(
    directoryPath: string,
    repositoryId: string,
    dependencies: ExtractedDependency[],
  ): Promise<{ frameworks: DetectedFramework[]; middleware: DetectedMiddleware[] }> {
    const stopTimer = logger.startTimer('framework-detection');

    const frameworkMap = new Map<string, DetectedFramework>();
    const middlewareList: DetectedMiddleware[] = [];

    try {
      // ── Pass 1: dependency-based detection ──────────────────────────
      this.detectFromDependencies(dependencies, repositoryId, frameworkMap, middlewareList);

      // ── Pass 2: code-pattern scan ──────────────────────────────────
      await this.detectFromCodePatterns(directoryPath, repositoryId, frameworkMap);

      // ── Django structural check ────────────────────────────────────
      await this.detectDjangoStructure(directoryPath, repositoryId, frameworkMap);

      const frameworks = Array.from(frameworkMap.values());

      logger.info(`Framework detection complete for ${repositoryId}`, {
        frameworkCount: frameworks.length,
        middlewareCount: middlewareList.length,
      });

      return { frameworks, middleware: middlewareList };
    } catch (error) {
      logger.error('Framework detection failed', error, { repositoryId });
      throw error;
    } finally {
      stopTimer();
    }
  }

  // ── Pass 1 helpers ──────────────────────────────────────────────────────

  private detectFromDependencies(
    dependencies: ExtractedDependency[],
    repositoryId: string,
    frameworkMap: Map<string, DetectedFramework>,
    middlewareList: DetectedMiddleware[],
  ): void {
    for (const dep of dependencies) {
      const pkgName = dep.name.toLowerCase();

      // Check framework signatures
      const fwSig = FRAMEWORK_SIGNATURES[pkgName];
      if (fwSig) {
        const existing = frameworkMap.get(fwSig.framework);
        if (existing) {
          // Merge evidence
          existing.evidence.push(`Dependency: ${dep.name}@${dep.version}`);
          existing.confidence = Math.min(1, existing.confidence + 0.1);
        } else {
          frameworkMap.set(fwSig.framework, {
            _key: uuidv4(),
            repositoryId,
            framework: fwSig.framework,
            version: dep.version || 'unknown',
            language: fwSig.language,
            category: fwSig.category as DetectedFramework['category'],
            confidence: 0.9,
            evidence: [`Dependency: ${dep.name}@${dep.version}`],
            detectedAt: new Date(),
          });
        }
      }

      // Check middleware signatures
      const mwSig = MIDDLEWARE_SIGNATURES[pkgName];
      if (mwSig) {
        middlewareList.push({
          _key: uuidv4(),
          repositoryId,
          name: mwSig.name,
          packageName: dep.name,
          version: dep.version || 'unknown',
          category: mwSig.category as DetectedMiddleware['category'],
          framework: this.inferAssociatedFramework(dep.name, frameworkMap),
          detectedAt: new Date(),
        });
      }
    }
  }

  /**
   * Best-effort guess of which detected framework owns a middleware package.
   * For example, `@fastify/*` maps to Fastify when it has been detected.
   */
  private inferAssociatedFramework(
    packageName: string,
    frameworkMap: Map<string, DetectedFramework>,
  ): string | undefined {
    if (packageName.startsWith('@fastify/') && frameworkMap.has('Fastify')) return 'Fastify';
    if (packageName.startsWith('express-') && frameworkMap.has('Express')) return 'Express';
    if (
      frameworkMap.has('Express') &&
      ['cors', 'helmet', 'morgan', 'compression', 'body-parser'].includes(packageName)
    ) {
      return 'Express';
    }
    return undefined;
  }

  // ── Pass 2 helpers ──────────────────────────────────────────────────────

  private async detectFromCodePatterns(
    directoryPath: string,
    repositoryId: string,
    frameworkMap: Map<string, DetectedFramework>,
  ): Promise<void> {
    for (const cp of CODE_PATTERNS) {
      try {
        const files = await glob(cp.fileGlob, {
          cwd: directoryPath,
          nodir: true,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/vendor/**',
            '**/venv/**',
          ],
          maxDepth: 8,
        });

        // Sample a reasonable number of files to keep the scan fast
        const sampled = files.slice(0, 200);

        for (const relFile of sampled) {
          const absPath = path.join(directoryPath, relFile);
          try {
            const content = fs.readFileSync(absPath, 'utf-8');
            if (cp.pattern.test(content)) {
              this.addPatternEvidence(frameworkMap, repositoryId, cp, relFile);
              break; // one hit per pattern is enough
            }
          } catch {
            // skip unreadable files
          }
        }
      } catch (err) {
        logger.debug(`Code pattern scan failed for glob ${cp.fileGlob}`, { error: err });
      }
    }
  }

  private addPatternEvidence(
    frameworkMap: Map<string, DetectedFramework>,
    repositoryId: string,
    cp: CodePattern,
    filePath: string,
  ): void {
    const key = cp.framework;
    const existing = frameworkMap.get(key);

    if (existing) {
      existing.evidence.push(`${cp.evidence} in ${filePath}`);
      existing.confidence = Math.min(1, existing.confidence + 0.05);
    } else {
      frameworkMap.set(key, {
        _key: uuidv4(),
        repositoryId,
        framework: cp.framework,
        version: 'unknown',
        language: cp.language,
        category: cp.category as DetectedFramework['category'],
        confidence: 0.5, // lower confidence for pattern-only detection
        evidence: [`${cp.evidence} in ${filePath}`],
        detectedAt: new Date(),
      });
    }
  }

  /**
   * Django-specific structural check: urls.py + views.py in the same
   * directory is a strong signal even without requirements.txt.
   */
  private async detectDjangoStructure(
    directoryPath: string,
    repositoryId: string,
    frameworkMap: Map<string, DetectedFramework>,
  ): Promise<void> {
    try {
      const urlFiles = await glob('**/urls.py', {
        cwd: directoryPath,
        nodir: true,
        ignore: ['**/node_modules/**', '**/venv/**', '**/.git/**'],
        maxDepth: 6,
      });

      for (const urlFile of urlFiles) {
        const dir = path.dirname(path.join(directoryPath, urlFile));
        const viewsPath = path.join(dir, 'views.py');
        if (fs.existsSync(viewsPath)) {
          const existing = frameworkMap.get('Django');
          const evidence = `urls.py + views.py found in ${path.dirname(urlFile)}`;
          if (existing) {
            existing.evidence.push(evidence);
            existing.confidence = Math.min(1, existing.confidence + 0.15);
          } else {
            frameworkMap.set('Django', {
              _key: uuidv4(),
              repositoryId,
              framework: 'Django',
              version: 'unknown',
              language: 'python',
              category: 'backend',
              confidence: 0.7,
              evidence: [evidence],
              detectedAt: new Date(),
            });
          }
          break; // one match suffices
        }
      }
    } catch (err) {
      logger.debug('Django structural check failed', { error: err });
    }
  }
}
