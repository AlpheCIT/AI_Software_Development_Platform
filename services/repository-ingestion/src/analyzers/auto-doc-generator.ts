// =====================================================
// AUTO-DOC GENERATOR
// =====================================================
// After ingestion, detects project type and determines which
// documentation tools could be invoked. Also measures inline
// documentation coverage (JSDoc/docstrings) across all source files.

// =====================================================
// INTERFACES
// =====================================================

export interface AutoDocResult {
  tool: string;           // 'typedoc' | 'jsdoc' | 'sphinx' | 'openapi' | 'storybook'
  projectType: string;    // 'typescript' | 'javascript' | 'python' | 'api' | 'react'
  configDetected: boolean;
  outputFormat: string;   // 'html' | 'markdown' | 'json'
  command: string;        // the command that WOULD be run
  available: boolean;     // whether the tool is installed
}

export interface DocCoverageReport {
  overallCoverage: number;  // 0-100 percentage
  grade: string;            // A/B/C/D/F
  totalExports: number;
  documentedExports: number;
  perFile: Array<{
    file: string;
    coverage: number;
    totalItems: number;
    documentedItems: number;
    undocumentedItems: Array<{ name: string; line: number; type: string }>;
  }>;
  byLanguage: Record<string, { coverage: number; total: number; documented: number }>;
  recommendations: string[];
}

// =====================================================
// REGEX PATTERNS
// =====================================================

/** Matches exported declarations in JS/TS */
const JS_EXPORT_RE = /^[ \t]*export\s+(?:default\s+)?(?:async\s+)?(?:function\s+|class\s+|const\s+|let\s+|var\s+|interface\s+|type\s+|enum\s+)(\w+)/gm;

/** Matches Python def/class definitions */
const PY_DEF_RE = /^[ \t]*(?:async\s+)?(?:def|class)\s+(\w+)/gm;

/** JSDoc block comment start */
const JSDOC_START = /\/\*\*/;
/** Block comment end */
const BLOCK_END = /\*\//;

/** Python triple-quote docstring */
const PY_DOCSTRING = /^[ \t]*("""|''')/;

// =====================================================
// AUTO-DOC GENERATOR CLASS
// =====================================================

export class AutoDocGenerator {
  /**
   * Detect which documentation tools could be used for this project.
   *
   * @param files   Map of relative file paths to their contents
   * @param dependencies  Array of dependency objects (at minimum: { name: string })
   */
  async detectDocTools(
    files: Map<string, string>,
    dependencies: Array<{ name: string; [key: string]: any }>
  ): Promise<AutoDocResult[]> {
    const results: AutoDocResult[] = [];
    const depNames = new Set(dependencies.map(d => d.name));

    // Check for TypeScript (tsconfig.json present)
    if (this.hasFile(files, 'tsconfig.json')) {
      results.push({
        tool: 'typedoc',
        projectType: 'typescript',
        configDetected: true,
        outputFormat: 'html',
        command: 'npx typedoc --entryPointStrategy packages --out docs/api',
        available: depNames.has('typedoc')
      });
    }

    // Check for JavaScript with JSDoc comments
    const hasJsFiles = this.hasFileMatching(files, /\.(js|jsx)$/);
    if (hasJsFiles && !this.hasFile(files, 'tsconfig.json')) {
      results.push({
        tool: 'jsdoc',
        projectType: 'javascript',
        configDetected: this.hasFile(files, '.jsdoc.json') || this.hasFile(files, 'jsdoc.json'),
        outputFormat: 'html',
        command: 'npx jsdoc -c jsdoc.json -d docs/api',
        available: depNames.has('jsdoc')
      });
    }

    // Check for Python (requirements.txt, setup.py, pyproject.toml)
    const hasPython = this.hasFile(files, 'requirements.txt')
      || this.hasFile(files, 'setup.py')
      || this.hasFile(files, 'pyproject.toml');
    if (hasPython) {
      results.push({
        tool: 'sphinx',
        projectType: 'python',
        configDetected: this.hasFile(files, 'docs/conf.py') || this.hasFile(files, 'conf.py'),
        outputFormat: 'html',
        command: 'sphinx-build -b html docs/source docs/build',
        available: false // Cannot reliably check Python tools from Node
      });
    }

    // Check for API endpoints -> OpenAPI spec generation
    const hasExpressRoutes = this.containsPattern(files, /app\.(get|post|put|delete|patch)\s*\(/);
    const hasFastifyRoutes = this.containsPattern(files, /fastify\.(get|post|put|delete|patch)\s*\(/);
    const hasOpenApiConfig = this.hasFile(files, 'openapi.json')
      || this.hasFile(files, 'openapi.yaml')
      || this.hasFile(files, 'swagger.json')
      || this.hasFile(files, 'swagger.yaml');

    if (hasExpressRoutes || hasFastifyRoutes || hasOpenApiConfig) {
      results.push({
        tool: 'openapi',
        projectType: 'api',
        configDetected: hasOpenApiConfig,
        outputFormat: 'json',
        command: hasExpressRoutes
          ? 'npx swagger-jsdoc -d swaggerDef.js -o docs/openapi.json'
          : 'npx fastify-swagger --output docs/openapi.json',
        available: depNames.has('swagger-jsdoc') || depNames.has('@fastify/swagger')
      });
    }

    // Check for React -> Storybook
    const hasReact = depNames.has('react') || depNames.has('react-dom');
    if (hasReact) {
      results.push({
        tool: 'storybook',
        projectType: 'react',
        configDetected: this.hasFileMatching(files, /\.storybook\//),
        outputFormat: 'html',
        command: 'npx storybook build -o docs/storybook',
        available: depNames.has('@storybook/react') || depNames.has('storybook')
      });
    }

    return results;
  }

  /**
   * Measure inline documentation quality across all source files.
   *
   * For each file, counts total exported/public items and checks if
   * they have JSDoc (JS/TS) or docstring (Python) comments.
   */
  measureInlineDocCoverage(files: Map<string, string>): DocCoverageReport {
    const perFile: DocCoverageReport['perFile'] = [];
    const byLanguage: Record<string, { coverage: number; total: number; documented: number }> = {};

    let totalExports = 0;
    let documentedExports = 0;

    for (const [filePath, content] of files.entries()) {
      // Skip non-source files, node_modules, dist, etc.
      if (this.shouldSkipFile(filePath)) continue;

      const ext = this.getExtension(filePath);
      let fileResult: { totalItems: number; documentedItems: number; undocumentedItems: Array<{ name: string; line: number; type: string }> } | null = null;
      let language = '';

      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        language = ext === '.ts' || ext === '.tsx' ? 'typescript' : 'javascript';
        fileResult = this.analyzeJsTsFile(content);
      } else if (ext === '.py') {
        language = 'python';
        fileResult = this.analyzePythonFile(content);
      }

      if (!fileResult || fileResult.totalItems === 0) continue;

      const coverage = fileResult.totalItems > 0
        ? Math.round((fileResult.documentedItems / fileResult.totalItems) * 10000) / 100
        : 100;

      perFile.push({
        file: filePath,
        coverage,
        totalItems: fileResult.totalItems,
        documentedItems: fileResult.documentedItems,
        undocumentedItems: fileResult.undocumentedItems
      });

      totalExports += fileResult.totalItems;
      documentedExports += fileResult.documentedItems;

      // Aggregate by language
      if (!byLanguage[language]) {
        byLanguage[language] = { coverage: 0, total: 0, documented: 0 };
      }
      byLanguage[language].total += fileResult.totalItems;
      byLanguage[language].documented += fileResult.documentedItems;
    }

    // Calculate language-level coverage percentages
    for (const lang of Object.keys(byLanguage)) {
      const data = byLanguage[lang];
      data.coverage = data.total > 0
        ? Math.round((data.documented / data.total) * 10000) / 100
        : 100;
    }

    const overallCoverage = totalExports > 0
      ? Math.round((documentedExports / totalExports) * 10000) / 100
      : 100;

    const grade = this.coverageToGrade(overallCoverage);
    const recommendations = this.generateRecommendations(perFile, overallCoverage, byLanguage);

    return {
      overallCoverage,
      grade,
      totalExports,
      documentedExports,
      perFile: perFile.sort((a, b) => a.coverage - b.coverage), // Worst coverage first
      byLanguage,
      recommendations
    };
  }

  // =====================================================
  // JS/TS FILE ANALYSIS
  // =====================================================

  private analyzeJsTsFile(content: string): {
    totalItems: number;
    documentedItems: number;
    undocumentedItems: Array<{ name: string; line: number; type: string }>;
  } {
    const lines = content.split('\n');
    const undocumented: Array<{ name: string; line: number; type: string }> = [];
    let totalItems = 0;
    let documentedItems = 0;

    // Reset regex
    JS_EXPORT_RE.lastIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      // Check each line against the export regex
      JS_EXPORT_RE.lastIndex = 0;
      const match = JS_EXPORT_RE.exec(lines[i]);
      if (!match) continue;

      const name = match[1];
      const type = this.detectExportType(lines[i]);
      totalItems++;

      if (this.hasPrecedingJsDoc(lines, i)) {
        documentedItems++;
      } else {
        undocumented.push({ name, line: i + 1, type });
      }
    }

    return { totalItems, documentedItems, undocumentedItems: undocumented };
  }

  private detectExportType(line: string): string {
    if (/\bfunction\b/.test(line)) return 'function';
    if (/\bclass\b/.test(line)) return 'class';
    if (/\binterface\b/.test(line)) return 'interface';
    if (/\btype\b/.test(line)) return 'type';
    if (/\benum\b/.test(line)) return 'enum';
    if (/\bconst\b/.test(line)) return 'constant';
    return 'export';
  }

  /**
   * Walk backwards from lineIndex to check for a JSDoc comment.
   * Allows up to 3 blank lines between the JSDoc and the declaration.
   */
  private hasPrecedingJsDoc(lines: string[], lineIndex: number): boolean {
    let j = lineIndex - 1;
    let blankCount = 0;

    // Skip blank lines (max 3)
    while (j >= 0 && lines[j].trim() === '') {
      j--;
      blankCount++;
      if (blankCount > 3) return false;
    }
    if (j < 0) return false;

    // Check if the line ends with */
    if (!BLOCK_END.test(lines[j])) return false;

    // Walk further up to find the opening /**
    while (j >= 0) {
      if (JSDOC_START.test(lines[j])) return true;
      j--;
    }
    return false;
  }

  // =====================================================
  // PYTHON FILE ANALYSIS
  // =====================================================

  private analyzePythonFile(content: string): {
    totalItems: number;
    documentedItems: number;
    undocumentedItems: Array<{ name: string; line: number; type: string }>;
  } {
    const lines = content.split('\n');
    const undocumented: Array<{ name: string; line: number; type: string }> = [];
    let totalItems = 0;
    let documentedItems = 0;

    for (let i = 0; i < lines.length; i++) {
      PY_DEF_RE.lastIndex = 0;
      const match = PY_DEF_RE.exec(lines[i]);
      if (!match) continue;

      const name = match[1];
      // Skip private/dunder methods except __init__
      if (name.startsWith('_') && name !== '__init__') continue;

      const type = /\bclass\b/.test(lines[i]) ? 'class' : 'function';
      totalItems++;

      if (this.hasFollowingDocstring(lines, i)) {
        documentedItems++;
      } else {
        undocumented.push({ name, line: i + 1, type });
      }
    }

    return { totalItems, documentedItems, undocumentedItems: undocumented };
  }

  /**
   * Check if the line(s) following a def/class contain a docstring.
   */
  private hasFollowingDocstring(lines: string[], defLine: number): boolean {
    for (let j = defLine + 1; j < Math.min(defLine + 5, lines.length); j++) {
      const trimmed = lines[j].trim();
      if (trimmed === '') continue;
      return PY_DOCSTRING.test(lines[j]);
    }
    return false;
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  private hasFile(files: Map<string, string>, name: string): boolean {
    for (const key of files.keys()) {
      if (key === name || key.endsWith('/' + name)) return true;
    }
    return false;
  }

  private hasFileMatching(files: Map<string, string>, pattern: RegExp): boolean {
    for (const key of files.keys()) {
      if (pattern.test(key)) return true;
    }
    return false;
  }

  private containsPattern(files: Map<string, string>, pattern: RegExp): boolean {
    for (const [filePath, content] of files.entries()) {
      if (this.shouldSkipFile(filePath)) continue;
      if (pattern.test(content)) return true;
    }
    return false;
  }

  private shouldSkipFile(filePath: string): boolean {
    return /node_modules|\.git\/|dist\/|build\/|__pycache__|\.min\.|\.d\.ts$|\.test\.|\.spec\./.test(filePath);
  }

  private getExtension(filePath: string): string {
    const match = filePath.match(/(\.[^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  private coverageToGrade(coverage: number): string {
    if (coverage >= 90) return 'A';
    if (coverage >= 80) return 'B';
    if (coverage >= 60) return 'C';
    if (coverage >= 40) return 'D';
    return 'F';
  }

  private generateRecommendations(
    perFile: DocCoverageReport['perFile'],
    overallCoverage: number,
    byLanguage: Record<string, { coverage: number; total: number; documented: number }>
  ): string[] {
    const recommendations: string[] = [];

    if (overallCoverage < 40) {
      recommendations.push('Critical: Documentation coverage is very low. Prioritize documenting all public APIs.');
    } else if (overallCoverage < 60) {
      recommendations.push('Documentation coverage needs improvement. Focus on exported functions and classes.');
    } else if (overallCoverage < 80) {
      recommendations.push('Documentation coverage is fair. Fill remaining gaps for a more maintainable codebase.');
    }

    // Find worst files
    const worstFiles = perFile.filter(f => f.coverage < 50 && f.totalItems > 2);
    if (worstFiles.length > 0) {
      const top3 = worstFiles.slice(0, 3);
      recommendations.push(
        `Focus on these files with lowest coverage: ${top3.map(f => f.file).join(', ')}`
      );
    }

    // Language-specific recommendations
    for (const [lang, data] of Object.entries(byLanguage)) {
      if (data.coverage < 50 && data.total > 5) {
        recommendations.push(
          `${lang} files have only ${data.coverage}% coverage (${data.documented}/${data.total} items). ` +
          `Add ${lang === 'python' ? 'docstrings' : 'JSDoc comments'} to public APIs.`
        );
      }
    }

    // Count most common undocumented types
    const typeCounts: Record<string, number> = {};
    for (const f of perFile) {
      for (const item of f.undocumentedItems) {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
      }
    }
    const mostCommonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommonType && mostCommonType[1] > 3) {
      recommendations.push(
        `${mostCommonType[1]} undocumented ${mostCommonType[0]}s found. Consider a documentation sprint targeting this type.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Documentation coverage is excellent. Keep it up!');
    }

    return recommendations;
  }
}
