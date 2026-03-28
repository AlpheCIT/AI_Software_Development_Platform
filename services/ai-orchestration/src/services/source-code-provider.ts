import { Database } from 'arangojs';

// Use console-based logger consistent with the rest of ai-orchestration service
const logger = {
  error: (msg: string, ...args: any[]) => console.error(`[SourceCodeProvider] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[SourceCodeProvider] ${msg}`, ...args),
  info: (msg: string, ...args: any[]) => console.log(`[SourceCodeProvider] ${msg}`, ...args),
};

/**
 * SourceCodeProvider retrieves actual source code for agent analysis.
 * Agents use this to read real files instead of relying on sparse metadata.
 */
export class SourceCodeProvider {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Get the content of a specific file in a repository
   */
  async getFileContent(repoId: string, filePath: string): Promise<string | null> {
    try {
      // Strategy 1: code_files collection (stored during ingestion)
      const cursor = await this.db.query(`
        FOR f IN code_files
          FILTER f.repositoryId == @repoId AND f.path == @filePath
          LIMIT 1
          RETURN f.content
      `, { repoId, filePath });

      const results = await cursor.all();
      if (results.length > 0 && results[0]) {
        return results[0];
      }

      // Strategy 2: code_entities with source_code field (legacy)
      const entityCursor = await this.db.query(`
        FOR e IN code_entities
          FILTER (e.repositoryId == @repoId OR e.repository_id == @repoId)
            AND e.file_path == @filePath
            AND e.source_code != null
          LIMIT 1
          RETURN e.source_code
      `, { repoId, filePath });

      const entityResults = await entityCursor.all();
      if (entityResults.length > 0 && entityResults[0]) {
        return entityResults[0];
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get file content for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get all source files for a repository
   */
  async getAllFilesForRepo(repoId: string): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      const cursor = await this.db.query(`
        FOR f IN code_files
          FILTER f.repositoryId == @repoId
          RETURN { path: f.path, content: f.content }
      `, { repoId });

      const results = await cursor.all();
      for (const file of results) {
        if (file.path && file.content) {
          files.set(file.path, file.content);
        }
      }
    } catch (error) {
      logger.error(`Failed to get files for repo ${repoId}:`, error);
    }

    return files;
  }

  /**
   * Get source files associated with a specific code entity
   */
  async getFilesForEntity(repoId: string, entityKey: string): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      // Find the entity's file path
      const entityCursor = await this.db.query(`
        FOR e IN code_entities
          FILTER e._key == @entityKey
          RETURN { filePath: e.file_path || e.filePath, repoId: e.repositoryId || e.repository_id }
      `, { entityKey });

      const entities = await entityCursor.all();
      if (entities.length > 0 && entities[0].filePath) {
        const content = await this.getFileContent(repoId, entities[0].filePath);
        if (content) {
          files.set(entities[0].filePath, content);
        }
      }
    } catch (error) {
      logger.error(`Failed to get files for entity ${entityKey}:`, error);
    }

    return files;
  }

  /**
   * Get a specific line range from a file
   */
  async getFileLines(repoId: string, filePath: string, startLine: number, endLine: number): Promise<string | null> {
    const content = await this.getFileContent(repoId, filePath);
    if (!content) return null;

    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Check if a specific pattern exists at a claimed location
   * Used by challenger agents to verify findings
   */
  async verifyPatternAtLocation(
    repoId: string,
    filePath: string,
    lineNumber: number,
    pattern: RegExp,
    contextLines: number = 5
  ): Promise<{ found: boolean; actualCode: string; context: string }> {
    const content = await this.getFileContent(repoId, filePath);
    if (!content) {
      return { found: false, actualCode: '', context: 'File not found in repository' };
    }

    const lines = content.split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) {
      return { found: false, actualCode: '', context: `Line ${lineNumber} out of range (file has ${lines.length} lines)` };
    }

    const targetLine = lines[lineNumber - 1];
    const startCtx = Math.max(0, lineNumber - 1 - contextLines);
    const endCtx = Math.min(lines.length, lineNumber + contextLines);
    const contextCode = lines.slice(startCtx, endCtx).join('\n');

    return {
      found: pattern.test(targetLine),
      actualCode: targetLine,
      context: contextCode
    };
  }

  /**
   * Search for global middleware patterns in a file
   * Used by security challenger to check for global mitigations
   */
  async findGlobalMiddleware(repoId: string): Promise<string[]> {
    const middleware: string[] = [];

    try {
      // Look for common middleware patterns across all files
      const cursor = await this.db.query(`
        FOR f IN code_files
          FILTER f.repositoryId == @repoId
          FILTER CONTAINS(f.content, "app.use") OR CONTAINS(f.content, "fastify.register")
          RETURN { path: f.path, content: f.content }
      `, { repoId });

      const results = await cursor.all();
      for (const file of results) {
        const lines = file.content.split('\n');
        for (const line of lines) {
          // Detect common security middleware
          if (/app\.use\s*\(\s*(helmet|cors|rateLimit|express-rate-limit|passport)/i.test(line)) {
            middleware.push(line.trim());
          }
          if (/fastify\.register\s*\(\s*(fastifyHelmet|fastifyCors|fastifyRateLimit)/i.test(line)) {
            middleware.push(line.trim());
          }
        }
      }
    } catch (error) {
      logger.error('Failed to search for global middleware:', error);
    }

    return middleware;
  }
}
