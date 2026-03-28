import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface FileDocCoverage {
  _key: string;
  repositoryId: string;
  filePath: string;
  language: string;
  hasFileLevelDoc: boolean;
  totalFunctions: number;
  documentedFunctions: number;
  coveragePercent: number;
  undocumentedItems: string[];  // names of undocumented functions/classes
  docStyle: 'jsdoc' | 'docstring' | 'javadoc' | 'none';
  analyzedAt: Date;
}

export interface RepoDocSummary {
  repositoryId: string;
  totalFiles: number;
  analyzedFiles: number;
  overallCoveragePercent: number;
  byLanguage: Record<string, { files: number; coverage: number }>;
  topUndocumented: Array<{ file: string; coverage: number }>;
}

/* ------------------------------------------------------------------ */
/*  Language-specific helpers                                           */
/* ------------------------------------------------------------------ */

/** Regex that matches export declarations in JS/TS source code. */
const JS_EXPORTED_RE =
  /^[ \t]*export\s+(?:default\s+)?(?:async\s+)?(?:function\s+|class\s+|const\s+|let\s+|var\s+|interface\s+|type\s+|enum\s+)(\w+)/;

/** Regex that matches Python def / class lines. */
const PY_DEF_RE = /^[ \t]*(?:async\s+)?(?:def|class)\s+(\w+)/;

/** Regex that matches Java public method / class lines. */
const JAVA_PUBLIC_RE =
  /^[ \t]*public\s+(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:\w+\s+)?(?:class|interface|enum|\w+)\s+(\w+)/;

/** Check if a line is inside a JSDoc / Javadoc block-ending line. */
const BLOCK_COMMENT_END = /\*\//;
const BLOCK_COMMENT_START = /\/\*\*/;

/* ------------------------------------------------------------------ */
/*  DocCoverageAnalyzer                                                */
/* ------------------------------------------------------------------ */

export class DocCoverageAnalyzer {
  /**
   * Analyze documentation coverage across an entire repository.
   *
   * @param directoryPath  Absolute path to the cloned repo on disk.
   * @param repositoryId   The repository id stored in ArangoDB.
   */
  async analyze(
    directoryPath: string,
    repositoryId: string,
  ): Promise<{ files: FileDocCoverage[]; summary: RepoDocSummary }> {
    const timer = logger.startTimer('doc-coverage-analysis');
    const fileCoverages: FileDocCoverage[] = [];

    try {
      const allSourceFiles = await this.discoverSourceFiles(directoryPath);
      logger.info(`Found ${allSourceFiles.length} source files to analyze for doc coverage`);

      for (const absPath of allSourceFiles) {
        const relPath = path.relative(directoryPath, absPath).replace(/\\/g, '/');
        try {
          const content = await fs.promises.readFile(absPath, 'utf-8');
          const coverage = this.analyzeFile(content, relPath, repositoryId);
          if (coverage) {
            fileCoverages.push(coverage);
          }
        } catch (readErr: any) {
          logger.warn(`Could not read file ${relPath}: ${readErr.message}`);
        }
      }

      const summary = this.buildSummary(fileCoverages, allSourceFiles.length, repositoryId);
      logger.info(
        `Doc coverage analysis complete: ${summary.overallCoveragePercent.toFixed(1)}% across ${summary.analyzedFiles} files`,
      );

      return { files: fileCoverages, summary };
    } catch (error) {
      logger.error('Doc coverage analysis failed', error);
      throw error;
    } finally {
      timer();
    }
  }

  /* ---------------------------------------------------------------- */
  /*  File discovery                                                    */
  /* ---------------------------------------------------------------- */

  private async discoverSourceFiles(root: string): Promise<string[]> {
    const patterns = [
      '**/*.js',
      '**/*.jsx',
      '**/*.ts',
      '**/*.tsx',
      '**/*.py',
      '**/*.java',
    ];

    const allFiles = new Set<string>();
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: root,
        absolute: true,
        nodir: true,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/__pycache__/**',
          '**/venv/**',
          '**/.venv/**',
          '**/vendor/**',
          '**/*.min.js',
          '**/*.d.ts',
          '**/*.test.*',
          '**/*.spec.*',
        ],
      });
      for (const m of matches) {
        allFiles.add(m);
      }
    }
    return Array.from(allFiles);
  }

  /* ---------------------------------------------------------------- */
  /*  Per-file analysis (dispatch by extension)                        */
  /* ---------------------------------------------------------------- */

  private analyzeFile(
    content: string,
    relPath: string,
    repositoryId: string,
  ): FileDocCoverage | null {
    const ext = path.extname(relPath).toLowerCase();

    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      return this.analyzeJavaScriptFile(content, relPath, repositoryId);
    }
    if (ext === '.py') {
      return this.analyzePythonFile(content, relPath, repositoryId);
    }
    if (ext === '.java') {
      return this.analyzeJavaFile(content, relPath, repositoryId);
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  JavaScript / TypeScript analysis                                  */
  /* ---------------------------------------------------------------- */

  private analyzeJavaScriptFile(
    content: string,
    relPath: string,
    repositoryId: string,
  ): FileDocCoverage {
    const lines = content.split('\n');
    const undocumented: string[] = [];
    let totalFunctions = 0;
    let documentedFunctions = 0;

    // File-level doc: first non-empty content is a JSDoc block
    const hasFileLevelDoc = this.hasJsFileLevelDoc(lines);

    for (let i = 0; i < lines.length; i++) {
      const match = JS_EXPORTED_RE.exec(lines[i]);
      if (!match) continue;

      const name = match[1];
      totalFunctions++;

      if (this.precedingJsDoc(lines, i)) {
        documentedFunctions++;
      } else {
        undocumented.push(name);
      }
    }

    const coveragePercent = totalFunctions > 0
      ? (documentedFunctions / totalFunctions) * 100
      : 100; // no exports means "nothing to document"

    return {
      _key: uuidv4(),
      repositoryId,
      filePath: relPath,
      language: 'javascript',
      hasFileLevelDoc,
      totalFunctions,
      documentedFunctions,
      coveragePercent: Math.round(coveragePercent * 100) / 100,
      undocumentedItems: undocumented,
      docStyle: totalFunctions > 0 ? 'jsdoc' : 'none',
      analyzedAt: new Date(),
    };
  }

  /** True when the first meaningful content in the file is a JSDoc block. */
  private hasJsFileLevelDoc(lines: string[]): boolean {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#!')) continue; // skip blank / shebang
      return BLOCK_COMMENT_START.test(trimmed);
    }
    return false;
  }

  /** Walk backwards from `lineIndex` to see if there is a JSDoc comment. */
  private precedingJsDoc(lines: string[], lineIndex: number): boolean {
    let j = lineIndex - 1;
    // skip blank lines
    while (j >= 0 && lines[j].trim() === '') j--;
    if (j < 0) return false;

    // The line immediately before the declaration should end with */
    if (!BLOCK_COMMENT_END.test(lines[j])) return false;

    // Walk further up to find the opening /**
    while (j >= 0) {
      if (BLOCK_COMMENT_START.test(lines[j])) return true;
      j--;
    }
    return false;
  }

  /* ---------------------------------------------------------------- */
  /*  Python analysis                                                   */
  /* ---------------------------------------------------------------- */

  private analyzePythonFile(
    content: string,
    relPath: string,
    repositoryId: string,
  ): FileDocCoverage {
    const lines = content.split('\n');
    const undocumented: string[] = [];
    let totalFunctions = 0;
    let documentedFunctions = 0;

    // Module-level docstring: first non-comment, non-blank content is a triple-quote
    const hasFileLevelDoc = this.hasPyModuleDocstring(lines);

    for (let i = 0; i < lines.length; i++) {
      const match = PY_DEF_RE.exec(lines[i]);
      if (!match) continue;

      const name = match[1];
      totalFunctions++;

      if (this.followingPyDocstring(lines, i)) {
        documentedFunctions++;
      } else {
        undocumented.push(name);
      }
    }

    const coveragePercent = totalFunctions > 0
      ? (documentedFunctions / totalFunctions) * 100
      : 100;

    return {
      _key: uuidv4(),
      repositoryId,
      filePath: relPath,
      language: 'python',
      hasFileLevelDoc,
      totalFunctions,
      documentedFunctions,
      coveragePercent: Math.round(coveragePercent * 100) / 100,
      undocumentedItems: undocumented,
      docStyle: totalFunctions > 0 ? 'docstring' : 'none',
      analyzedAt: new Date(),
    };
  }

  private hasPyModuleDocstring(lines: string[]): boolean {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      return trimmed.startsWith('"""') || trimmed.startsWith("'''");
    }
    return false;
  }

  /** Check if the line immediately following a def/class is a docstring. */
  private followingPyDocstring(lines: string[], defLine: number): boolean {
    // The body starts after the colon. May be on the same line or the next.
    // Walk forward to find the first non-blank, non-comment line after defLine.
    for (let j = defLine + 1; j < Math.min(defLine + 5, lines.length); j++) {
      const trimmed = lines[j].trim();
      if (trimmed === '') continue;
      return trimmed.startsWith('"""') || trimmed.startsWith("'''");
    }
    return false;
  }

  /* ---------------------------------------------------------------- */
  /*  Java analysis                                                     */
  /* ---------------------------------------------------------------- */

  private analyzeJavaFile(
    content: string,
    relPath: string,
    repositoryId: string,
  ): FileDocCoverage {
    const lines = content.split('\n');
    const undocumented: string[] = [];
    let totalFunctions = 0;
    let documentedFunctions = 0;

    // File-level Javadoc: first non-blank, non-package, non-import line is /**
    const hasFileLevelDoc = this.hasJavaFileLevelDoc(lines);

    for (let i = 0; i < lines.length; i++) {
      const match = JAVA_PUBLIC_RE.exec(lines[i]);
      if (!match) continue;

      const name = match[1];
      totalFunctions++;

      if (this.precedingJavadoc(lines, i)) {
        documentedFunctions++;
      } else {
        undocumented.push(name);
      }
    }

    const coveragePercent = totalFunctions > 0
      ? (documentedFunctions / totalFunctions) * 100
      : 100;

    return {
      _key: uuidv4(),
      repositoryId,
      filePath: relPath,
      language: 'java',
      hasFileLevelDoc,
      totalFunctions,
      documentedFunctions,
      coveragePercent: Math.round(coveragePercent * 100) / 100,
      undocumentedItems: undocumented,
      docStyle: totalFunctions > 0 ? 'javadoc' : 'none',
      analyzedAt: new Date(),
    };
  }

  private hasJavaFileLevelDoc(lines: string[]): boolean {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('package') || trimmed.startsWith('import')) continue;
      return BLOCK_COMMENT_START.test(trimmed);
    }
    return false;
  }

  /** Walk backwards from `lineIndex` to find a Javadoc comment. */
  private precedingJavadoc(lines: string[], lineIndex: number): boolean {
    let j = lineIndex - 1;
    // skip annotations like @Override
    while (j >= 0 && /^\s*@\w+/.test(lines[j])) j--;
    // skip blank lines
    while (j >= 0 && lines[j].trim() === '') j--;
    if (j < 0) return false;

    if (!BLOCK_COMMENT_END.test(lines[j])) return false;

    while (j >= 0) {
      if (BLOCK_COMMENT_START.test(lines[j])) return true;
      j--;
    }
    return false;
  }

  /* ---------------------------------------------------------------- */
  /*  Summary builder                                                   */
  /* ---------------------------------------------------------------- */

  private buildSummary(
    coverages: FileDocCoverage[],
    totalFileCount: number,
    repositoryId: string,
  ): RepoDocSummary {
    const byLanguage: Record<string, { files: number; coverageSum: number }> = {};
    let totalDocumented = 0;
    let totalFunctions = 0;

    for (const fc of coverages) {
      totalDocumented += fc.documentedFunctions;
      totalFunctions += fc.totalFunctions;

      if (!byLanguage[fc.language]) {
        byLanguage[fc.language] = { files: 0, coverageSum: 0 };
      }
      byLanguage[fc.language].files++;
      byLanguage[fc.language].coverageSum += fc.coveragePercent;
    }

    const byLangFinal: Record<string, { files: number; coverage: number }> = {};
    for (const [lang, data] of Object.entries(byLanguage)) {
      byLangFinal[lang] = {
        files: data.files,
        coverage: data.files > 0
          ? Math.round((data.coverageSum / data.files) * 100) / 100
          : 0,
      };
    }

    // Top undocumented: files with lowest coverage that actually have functions
    const topUndocumented = coverages
      .filter((c) => c.totalFunctions > 0)
      .sort((a, b) => a.coveragePercent - b.coveragePercent)
      .slice(0, 20)
      .map((c) => ({ file: c.filePath, coverage: c.coveragePercent }));

    const overallCoveragePercent = totalFunctions > 0
      ? Math.round((totalDocumented / totalFunctions) * 10000) / 100
      : 100;

    return {
      repositoryId,
      totalFiles: totalFileCount,
      analyzedFiles: coverages.length,
      overallCoveragePercent,
      byLanguage: byLangFinal,
      topUndocumented,
    };
  }
}
