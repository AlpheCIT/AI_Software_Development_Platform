import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface ExtractedDependency {
  _key: string;
  repositoryId: string;
  packageName: string;
  currentVersion: string;
  depType: 'production' | 'dev' | 'peer' | 'optional' | 'build';
  language: string;
  manifestFile: string;
  manifestPath: string;
  extractedAt: Date;
}

const MANIFEST_FILES = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'setup.py',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'go.mod',
  'Gemfile',
  'composer.json',
];

export class DependencyExtractor {
  async extract(directoryPath: string, repositoryId: string): Promise<ExtractedDependency[]> {
    const dependencies: ExtractedDependency[] = [];

    try {
      const manifestPaths = await this.findManifestFiles(directoryPath);
      logger.info(`Found ${manifestPaths.length} manifest files in repository`, { repositoryId });

      for (const manifestPath of manifestPaths) {
        try {
          const deps = await this.parseManifest(manifestPath, directoryPath, repositoryId);
          dependencies.push(...deps);
        } catch (error) {
          logger.warn(`Failed to parse manifest: ${manifestPath}`, { error, repositoryId });
        }
      }

      logger.debug(`Extracted ${dependencies.length} dependencies from repository`, { repositoryId });
    } catch (error) {
      logger.error('Failed to extract dependencies:', error);
      throw error;
    }

    return dependencies;
  }

  private async findManifestFiles(directoryPath: string): Promise<string[]> {
    const patterns = MANIFEST_FILES.map(f => `**/${f}`);
    const results: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: directoryPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/vendor/**', '**/.git/**', '**/dist/**', '**/build/**'],
      });
      results.push(...matches);
    }

    return results;
  }

  private async parseManifest(
    manifestPath: string,
    directoryPath: string,
    repositoryId: string
  ): Promise<ExtractedDependency[]> {
    const fileName = path.basename(manifestPath);
    const relativePath = path.relative(directoryPath, manifestPath).replace(/\\/g, '/');
    const content = await fs.promises.readFile(manifestPath, 'utf-8');

    switch (fileName) {
      case 'package.json':
        return this.parsePackageJson(content, repositoryId, fileName, relativePath);
      case 'requirements.txt':
        return this.parseRequirementsTxt(content, repositoryId, fileName, relativePath);
      case 'pyproject.toml':
        return this.parsePyprojectToml(content, repositoryId, fileName, relativePath);
      case 'Cargo.toml':
        return this.parseCargoToml(content, repositoryId, fileName, relativePath);
      case 'pom.xml':
        return this.parsePomXml(content, repositoryId, fileName, relativePath);
      case 'build.gradle':
        return this.parseBuildGradle(content, repositoryId, fileName, relativePath);
      case 'go.mod':
        return this.parseGoMod(content, repositoryId, fileName, relativePath);
      case 'Gemfile':
        return this.parseGemfile(content, repositoryId, fileName, relativePath);
      case 'composer.json':
        return this.parseComposerJson(content, repositoryId, fileName, relativePath);
      case 'setup.py':
        return this.parseSetupPy(content, repositoryId, fileName, relativePath);
      default:
        return [];
    }
  }

  // ── package.json (JavaScript/TypeScript) ──────────────────────────

  private parsePackageJson(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];
    let pkg: any;

    try {
      pkg = JSON.parse(content);
    } catch {
      logger.warn(`Invalid JSON in ${manifestPath}`);
      return deps;
    }

    const sections: { field: string; depType: ExtractedDependency['depType'] }[] = [
      { field: 'dependencies', depType: 'production' },
      { field: 'devDependencies', depType: 'dev' },
      { field: 'peerDependencies', depType: 'peer' },
      { field: 'optionalDependencies', depType: 'optional' },
    ];

    for (const { field, depType } of sections) {
      const entries = pkg[field];
      if (entries && typeof entries === 'object') {
        for (const [name, version] of Object.entries(entries)) {
          deps.push(this.makeDependency({
            repositoryId,
            packageName: name,
            currentVersion: String(version),
            depType,
            language: 'javascript',
            manifestFile,
            manifestPath,
          }));
        }
      }
    }

    return deps;
  }

  // ── requirements.txt (Python) ─────────────────────────────────────

  private parseRequirementsTxt(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('-')) continue;

      const match = line.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)\s*([><=!~]+\s*\S+)?/);
      if (match) {
        deps.push(this.makeDependency({
          repositoryId,
          packageName: match[1],
          currentVersion: match[2] ? match[2].trim() : '*',
          depType: 'production',
          language: 'python',
          manifestFile,
          manifestPath,
        }));
      }
    }

    return deps;
  }

  // ── pyproject.toml (Python) ───────────────────────────────────────

  private parsePyprojectToml(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];

    // Match [project.dependencies] section
    const depsSection = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depsSection) {
      this.extractPythonDepsFromArray(depsSection[1], 'production').forEach(d => {
        deps.push(this.makeDependency({ ...d, repositoryId, language: 'python', manifestFile, manifestPath }));
      });
    }

    // Match [project.optional-dependencies] sub-sections
    const optionalMatch = content.matchAll(/\[project\.optional-dependencies\.([\w-]+)\]\s*\n([\s\S]*?)(?=\n\[|$)/g);
    for (const m of optionalMatch) {
      const arrayMatch = m[2].match(/=\s*\[([\s\S]*?)\]/);
      if (arrayMatch) {
        this.extractPythonDepsFromArray(arrayMatch[1], 'optional').forEach(d => {
          deps.push(this.makeDependency({ ...d, repositoryId, language: 'python', manifestFile, manifestPath }));
        });
      }
    }

    // Simpler form: [project.optional-dependencies] with key = [...]
    const optionalBlock = content.match(/\[project\.optional-dependencies\]\s*\n([\s\S]*?)(?=\n\[|$)/);
    if (optionalBlock) {
      const entries = optionalBlock[1].matchAll(/[\w-]+\s*=\s*\[([\s\S]*?)\]/g);
      for (const entry of entries) {
        this.extractPythonDepsFromArray(entry[1], 'optional').forEach(d => {
          deps.push(this.makeDependency({ ...d, repositoryId, language: 'python', manifestFile, manifestPath }));
        });
      }
    }

    return deps;
  }

  private extractPythonDepsFromArray(
    arrayContent: string,
    depType: ExtractedDependency['depType']
  ): Pick<ExtractedDependency, 'packageName' | 'currentVersion' | 'depType'>[] {
    const results: Pick<ExtractedDependency, 'packageName' | 'currentVersion' | 'depType'>[] = [];
    const lines = arrayContent.match(/"([^"]+)"|'([^']+)'/g) || [];

    for (const raw of lines) {
      const value = raw.replace(/['"]/g, '');
      const match = value.match(/^([A-Za-z0-9_][A-Za-z0-9._-]*)\s*(.*)?$/);
      if (match) {
        results.push({
          packageName: match[1],
          currentVersion: match[2] ? match[2].trim() : '*',
          depType,
        });
      }
    }

    return results;
  }

  // ── go.mod (Go) ───────────────────────────────────────────────────

  private parseGoMod(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];

    // Match require ( ... ) blocks
    const requireBlocks = content.matchAll(/require\s*\(([\s\S]*?)\)/g);
    for (const block of requireBlocks) {
      for (const rawLine of block[1].split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('//')) continue;

        const match = line.match(/^(\S+)\s+(v\S+)/);
        if (match) {
          deps.push(this.makeDependency({
            repositoryId,
            packageName: match[1],
            currentVersion: match[2],
            depType: 'production',
            language: 'go',
            manifestFile,
            manifestPath,
          }));
        }
      }
    }

    // Single-line require statements
    const singleRequires = content.matchAll(/^require\s+(\S+)\s+(v\S+)/gm);
    for (const match of singleRequires) {
      deps.push(this.makeDependency({
        repositoryId,
        packageName: match[1],
        currentVersion: match[2],
        depType: 'production',
        language: 'go',
        manifestFile,
        manifestPath,
      }));
    }

    return deps;
  }

  // ── Cargo.toml (Rust) ─────────────────────────────────────────────

  private parseCargoToml(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];

    const sections: { header: string; depType: ExtractedDependency['depType'] }[] = [
      { header: '[dependencies]', depType: 'production' },
      { header: '[dev-dependencies]', depType: 'dev' },
      { header: '[build-dependencies]', depType: 'build' },
    ];

    for (const { header, depType } of sections) {
      const sectionDeps = this.extractTomlSection(content, header);
      for (const [name, version] of sectionDeps) {
        deps.push(this.makeDependency({
          repositoryId,
          packageName: name,
          currentVersion: version,
          depType,
          language: 'rust',
          manifestFile,
          manifestPath,
        }));
      }
    }

    return deps;
  }

  private extractTomlSection(content: string, header: string): [string, string][] {
    const results: [string, string][] = [];
    const headerEscaped = header.replace(/[[\]]/g, '\\$&');
    const sectionMatch = content.match(new RegExp(`${headerEscaped}\\s*\\n([\\s\\S]*?)(?=\\n\\[|$)`));

    if (!sectionMatch) return results;

    for (const rawLine of sectionMatch[1].split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('[')) break;

      // name = "version"
      const simpleMatch = line.match(/^([\w-]+)\s*=\s*"([^"]+)"/);
      if (simpleMatch) {
        results.push([simpleMatch[1], simpleMatch[2]]);
        continue;
      }

      // name = { version = "1.0", ... }
      const tableMatch = line.match(/^([\w-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
      if (tableMatch) {
        results.push([tableMatch[1], tableMatch[2]]);
      }
    }

    return results;
  }

  // ── pom.xml (Java/Maven) ──────────────────────────────────────────

  private parsePomXml(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];

    const depBlocks = content.matchAll(
      /<dependency>\s*<groupId>(.*?)<\/groupId>\s*<artifactId>(.*?)<\/artifactId>(?:\s*<version>(.*?)<\/version>)?(?:\s*<scope>(.*?)<\/scope>)?[\s\S]*?<\/dependency>/g
    );

    for (const match of depBlocks) {
      const scope = match[4] || 'compile';
      let depType: ExtractedDependency['depType'] = 'production';
      if (scope === 'test') depType = 'dev';
      else if (scope === 'provided' || scope === 'runtime') depType = 'optional';

      deps.push(this.makeDependency({
        repositoryId,
        packageName: `${match[1]}:${match[2]}`,
        currentVersion: match[3] || '*',
        depType,
        language: 'java',
        manifestFile,
        manifestPath,
      }));
    }

    return deps;
  }

  // ── build.gradle (Java/Gradle) ────────────────────────────────────

  private parseBuildGradle(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];

    const configMap: Record<string, ExtractedDependency['depType']> = {
      implementation: 'production',
      api: 'production',
      compileOnly: 'production',
      runtimeOnly: 'production',
      testImplementation: 'dev',
      testRuntimeOnly: 'dev',
      testCompileOnly: 'dev',
      annotationProcessor: 'build',
    };

    // Pattern: configuration 'group:artifact:version'
    const singleQuotePattern = /(\w+)\s+['"]([^'"]+:[^'"]+:[^'"]+)['"]/g;
    for (const match of content.matchAll(singleQuotePattern)) {
      const config = match[1];
      const depType = configMap[config];
      if (!depType) continue;

      const parts = match[2].split(':');
      deps.push(this.makeDependency({
        repositoryId,
        packageName: `${parts[0]}:${parts[1]}`,
        currentVersion: parts[2] || '*',
        depType,
        language: 'java',
        manifestFile,
        manifestPath,
      }));
    }

    // Pattern: configuration group: 'g', name: 'n', version: 'v'
    const mapPattern = /(\w+)\s+group:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]\s*,\s*version:\s*['"]([^'"]+)['"]/g;
    for (const match of content.matchAll(mapPattern)) {
      const config = match[1];
      const depType = configMap[config];
      if (!depType) continue;

      deps.push(this.makeDependency({
        repositoryId,
        packageName: `${match[2]}:${match[3]}`,
        currentVersion: match[4],
        depType,
        language: 'java',
        manifestFile,
        manifestPath,
      }));
    }

    return deps;
  }

  // ── Gemfile (Ruby) ────────────────────────────────────────────────

  private parseGemfile(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];
    let currentGroup: ExtractedDependency['depType'] = 'production';

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      // Track group blocks
      if (line.match(/^group\s+:development/)) {
        currentGroup = 'dev';
        continue;
      }
      if (line.match(/^group\s+:test/)) {
        currentGroup = 'dev';
        continue;
      }
      if (line === 'end') {
        currentGroup = 'production';
        continue;
      }

      // gem 'name', 'version'  or  gem 'name'
      const gemMatch = line.match(/^\s*gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/);
      if (gemMatch) {
        deps.push(this.makeDependency({
          repositoryId,
          packageName: gemMatch[1],
          currentVersion: gemMatch[2] || '*',
          depType: currentGroup,
          language: 'ruby',
          manifestFile,
          manifestPath,
        }));
      }
    }

    return deps;
  }

  // ── composer.json (PHP) ───────────────────────────────────────────

  private parseComposerJson(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];
    let composer: any;

    try {
      composer = JSON.parse(content);
    } catch {
      logger.warn(`Invalid JSON in composer.json at ${manifestPath}`);
      return deps;
    }

    const sections: { field: string; depType: ExtractedDependency['depType'] }[] = [
      { field: 'require', depType: 'production' },
      { field: 'require-dev', depType: 'dev' },
    ];

    for (const { field, depType } of sections) {
      const entries = composer[field];
      if (entries && typeof entries === 'object') {
        for (const [name, version] of Object.entries(entries)) {
          // Skip php and extension entries
          if (name === 'php' || name.startsWith('ext-')) continue;

          deps.push(this.makeDependency({
            repositoryId,
            packageName: name,
            currentVersion: String(version),
            depType,
            language: 'php',
            manifestFile,
            manifestPath,
          }));
        }
      }
    }

    return deps;
  }

  // ── setup.py (Python) ─────────────────────────────────────────────

  private parseSetupPy(
    content: string,
    repositoryId: string,
    manifestFile: string,
    manifestPath: string
  ): ExtractedDependency[] {
    const deps: ExtractedDependency[] = [];

    // Match install_requires=[...] block
    const installMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
    if (installMatch) {
      this.extractPythonDepsFromArray(installMatch[1], 'production').forEach(d => {
        deps.push(this.makeDependency({ ...d, repositoryId, language: 'python', manifestFile, manifestPath }));
      });
    }

    // Match extras_require={...} block
    const extrasMatch = content.match(/extras_require\s*=\s*\{([\s\S]*?)\}/);
    if (extrasMatch) {
      const arrayMatches = extrasMatch[1].matchAll(/\[([\s\S]*?)\]/g);
      for (const m of arrayMatches) {
        this.extractPythonDepsFromArray(m[1], 'optional').forEach(d => {
          deps.push(this.makeDependency({ ...d, repositoryId, language: 'python', manifestFile, manifestPath }));
        });
      }
    }

    return deps;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private makeDependency(params: {
    repositoryId: string;
    packageName: string;
    currentVersion: string;
    depType: ExtractedDependency['depType'];
    language: string;
    manifestFile: string;
    manifestPath: string;
  }): ExtractedDependency {
    return {
      _key: uuidv4(),
      repositoryId: params.repositoryId,
      packageName: params.packageName,
      currentVersion: params.currentVersion,
      depType: params.depType,
      language: params.language,
      manifestFile: params.manifestFile,
      manifestPath: params.manifestPath,
      extractedAt: new Date(),
    };
  }
}
