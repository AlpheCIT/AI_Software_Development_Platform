import { Database } from '@ai-code-management/database';
import { WebSocketService } from './websocket-service';
import { GitService } from '../utils/git-service';
import { LanguageParserFactory } from '../parsers/language-parser-factory';
import { EntityExtractor } from '../extractors/entity-extractor';
import { RelationshipExtractor } from '../extractors/relationship-extractor';
import { GraphBuilder } from '../builders/graph-builder';
import { EmbeddingService } from '../utils/embedding-service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface IngestionJob {
  id: string;
  type: 'repository' | 'directory';
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  startTime: Date;
  endTime?: Date;
  error?: string;
  result?: {
    repositoryId: string;
    filesProcessed: number;
    entitiesExtracted: number;
    relationshipsCreated: number;
  };
}

export interface IngestionOptions {
  shallow?: boolean;
  depth?: number;
  includeTests?: boolean;
  includeDocs?: boolean;
  languages?: string[];
  recursive?: boolean;
}

export class RepositoryIngestionService {
  private jobs: Map<string, IngestionJob> = new Map();
  private gitService: GitService;
  private languageParserFactory: LanguageParserFactory;
  private entityExtractor: EntityExtractor;
  private relationshipExtractor: RelationshipExtractor;
  private graphBuilder: GraphBuilder;
  private embeddingService: EmbeddingService;

  constructor(
    private db: Database,
    private wsService: WebSocketService
  ) {
    this.gitService = new GitService();
    this.languageParserFactory = new LanguageParserFactory();
    this.entityExtractor = new EntityExtractor();
    this.relationshipExtractor = new RelationshipExtractor();
    this.graphBuilder = new GraphBuilder(db);
    this.embeddingService = new EmbeddingService();
  }

  async ingestRepository(url: string, branch: string = 'main', options: IngestionOptions = {}): Promise<string> {
    const jobId = uuidv4();
    const job: IngestionJob = {
      id: jobId,
      type: 'repository',
      source: url,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing',
      startTime: new Date()
    };

    this.jobs.set(jobId, job);
    this.broadcastJobUpdate(job);

    // Start ingestion process asynchronously
    this.processRepositoryIngestion(jobId, url, branch, options).catch(error => {
      logger.error(`Repository ingestion failed for job ${jobId}:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  async ingestDirectory(directoryPath: string, options: IngestionOptions = {}): Promise<string> {
    const jobId = uuidv4();
    const job: IngestionJob = {
      id: jobId,
      type: 'directory',
      source: directoryPath,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing',
      startTime: new Date()
    };

    this.jobs.set(jobId, job);
    this.broadcastJobUpdate(job);

    // Start ingestion process asynchronously
    this.processDirectoryIngestion(jobId, directoryPath, options).catch(error => {
      logger.error(`Directory ingestion failed for job ${jobId}:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  /**
   * Ingest local repository - alias for ingestDirectory with repository-specific handling
   */
  async ingestLocalRepository(repositoryPath: string, options: IngestionOptions = {}): Promise<string> {
    // Validate that the path exists and is a git repository
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(repositoryPath)) {
      throw new Error(`Repository path does not exist: ${repositoryPath}`);
    }
    
    // Check if it's a git repository
    const gitPath = path.join(repositoryPath, '.git');
    if (!fs.existsSync(gitPath)) {
      console.warn(`Warning: ${repositoryPath} does not appear to be a Git repository (no .git directory found)`);
    }
    
    // Use the existing directory ingestion logic but mark it as a repository
    const jobId = uuidv4();
    const job: IngestionJob = {
      id: jobId,
      type: 'repository',
      source: repositoryPath,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing local repository analysis',
      startTime: new Date()
    };

    this.jobs.set(jobId, job);
    this.broadcastJobUpdate(job);

    // Start ingestion process asynchronously with repository-specific options
    const repoOptions = {
      ...options,
      recursive: true, // Always scan recursively for repositories
      includeTests: options.includeTests !== false, // Include tests by default
      includeDocs: options.includeDocs !== false // Include docs by default
    };
    
    this.processDirectoryIngestion(jobId, repositoryPath, repoOptions).catch(error => {
      logger.error(`Local repository ingestion failed for job ${jobId}:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  private async processRepositoryIngestion(jobId: string, url: string, branch: string, options: IngestionOptions): Promise<void> {
    this.updateJobStatus(jobId, 'running', undefined, 5, 'Cloning repository');

    // Clone repository
    const tempDir = await this.gitService.cloneRepository(url, branch, options);
    
    try {
      this.updateJobStatus(jobId, 'running', undefined, 10, 'Analyzing repository structure');
      
      // Process the cloned repository
      await this.processDirectory(jobId, tempDir, url, options);
      
    } finally {
      // Clean up temporary directory
      await this.gitService.cleanup(tempDir);
    }
  }

  private async processDirectoryIngestion(jobId: string, directoryPath: string, options: IngestionOptions): Promise<void> {
    const job = this.jobs.get(jobId);
    const analysisType = job?.type === 'repository' ? 'repository' : 'directory';
    
    this.updateJobStatus(jobId, 'running', undefined, 5, `Analyzing ${analysisType} structure`);
    
    // Verify directory exists
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} does not exist: ${directoryPath}`);
    }

    await this.processDirectory(jobId, directoryPath, directoryPath, options);
  }

  private async processDirectory(jobId: string, directoryPath: string, source: string, options: IngestionOptions): Promise<void> {
    // Create repository record
    const repositoryId = uuidv4();
    const repository = {
      _key: repositoryId,
      name: path.basename(source),
      source,
      type: this.jobs.get(jobId)?.type || 'directory',
      ingestionDate: new Date(),
      status: 'processing'
    };

    await this.db.collection('repositories').save(repository);
    this.updateJobStatus(jobId, 'running', undefined, 15, 'Repository record created');

    // Discover files
    const files = await this.discoverFiles(directoryPath, options);
    this.updateJobStatus(jobId, 'running', undefined, 25, `Discovered ${files.length} files`);

    let processedFiles = 0;
    let totalEntities = 0;
    let totalRelationships = 0;

    // Process files in batches
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      for (const file of batch) {
        try {
          const result = await this.processFile(repositoryId, file, directoryPath);
          totalEntities += result.entities;
          totalRelationships += result.relationships;
          processedFiles++;

          const progress = 25 + (processedFiles / files.length) * 50;
          this.updateJobStatus(
            jobId, 
            'running', 
            undefined, 
            progress, 
            `Processed ${processedFiles}/${files.length} files`
          );
        } catch (error) {
          logger.error(`Failed to process file ${file}:`, error);
          // Continue with other files
        }
      }
    }

    // Build relationships
    this.updateJobStatus(jobId, 'running', undefined, 80, 'Building entity relationships');
    const additionalRelationships = await this.buildRelationships(repositoryId);
    totalRelationships += additionalRelationships;

    // Generate embeddings
    this.updateJobStatus(jobId, 'running', undefined, 90, 'Generating embeddings');
    await this.generateEmbeddings(repositoryId);

    // Update repository status
    await this.db.collection('repositories').update(repositoryId, {
      status: 'completed',
      completionDate: new Date(),
      stats: {
        filesProcessed: processedFiles,
        entitiesExtracted: totalEntities,
        relationshipsCreated: totalRelationships
      }
    });

    // Complete the job
    this.updateJobStatus(jobId, 'completed', undefined, 100, 'Ingestion completed');
    const job = this.jobs.get(jobId)!;
    job.result = {
      repositoryId,
      filesProcessed: processedFiles,
      entitiesExtracted: totalEntities,
      relationshipsCreated: totalRelationships
    };
    this.broadcastJobUpdate(job);
  }

  private async discoverFiles(directoryPath: string, options: IngestionOptions): Promise<string[]> {
    const patterns = ['**/*'];
    const ignorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/*.log',
      '**/*.tmp'
    ];

    if (!options.includeTests) {
      ignorePatterns.push(
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*'
      );
    }

    if (!options.includeDocs) {
      ignorePatterns.push(
        '**/docs/**',
        '**/documentation/**',
        '**/*.md',
        '**/*.txt'
      );
    }

    const files = await glob(patterns, {
      cwd: directoryPath,
      ignore: ignorePatterns,
      nodir: true,
      absolute: false
    });

    // Filter by language if specified
    if (options.languages && options.languages.length > 0) {
      const languageExtensions = this.getLanguageExtensions(options.languages);
      return files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return languageExtensions.includes(ext);
      });
    }

    return files.filter(file => this.isSupportedFile(file));
  }

  private async processFile(repositoryId: string, filePath: string, basePath: string): Promise<{ entities: number; relationships: number }> {
    const fullPath = path.join(basePath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const language = this.detectLanguage(filePath);

    // Create file record
    const fileId = uuidv4();
    const fileRecord = {
      _key: fileId,
      repositoryId,
      path: filePath,
      language,
      size: content.length,
      contentHash: this.calculateHash(content),
      lastModified: fs.statSync(fullPath).mtime,
      processed: true
    };

    await this.db.collection('files').save(fileRecord);

    // Parse file content
    const parser = this.languageParserFactory.getParser(language);
    const ast = await parser.parse(content, filePath);

    // Extract entities
    const entities = await this.entityExtractor.extract(ast, fileId, repositoryId);
    let entityCount = 0;

    for (const entity of entities) {
      await this.db.collection('entities').save(entity);
      entityCount++;
    }

    // Extract relationships
    const relationships = await this.relationshipExtractor.extract(ast, fileId, repositoryId, entities);
    let relationshipCount = 0;

    for (const relationship of relationships) {
      await this.db.collection('relationships').save(relationship);
      relationshipCount++;
    }

    return { entities: entityCount, relationships: relationshipCount };
  }

  private async buildRelationships(repositoryId: string): Promise<number> {
    return await this.graphBuilder.buildCrossFileRelationships(repositoryId);
  }

  private async generateEmbeddings(repositoryId: string): Promise<void> {
    await this.embeddingService.generateRepositoryEmbeddings(repositoryId);
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.rb': 'ruby',
      '.php': 'php',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.m': 'objective-c',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    };

    return languageMap[ext] || 'text';
  }

  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.hpp',
      '.rb', '.php', '.go', '.rs', '.swift', '.kt', '.scala', '.r', '.m', '.sh', '.ps1',
      '.sql', '.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml'
    ];
    return supportedExtensions.includes(ext);
  }

  private getLanguageExtensions(languages: string[]): string[] {
    const extensionMap: Record<string, string[]> = {
      'javascript': ['.js', '.jsx'],
      'typescript': ['.ts', '.tsx'],
      'python': ['.py'],
      'java': ['.java'],
      'csharp': ['.cs'],
      'cpp': ['.cpp', '.hpp'],
      'c': ['.c', '.h'],
      'ruby': ['.rb'],
      'php': ['.php'],
      'go': ['.go'],
      'rust': ['.rs'],
      'swift': ['.swift'],
      'kotlin': ['.kt'],
      'scala': ['.scala']
    };

    return languages.flatMap(lang => extensionMap[lang] || []);
  }

  private calculateHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private updateJobStatus(jobId: string, status: IngestionJob['status'], error?: string, progress?: number, currentStep?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    if (error) job.error = error;
    if (progress !== undefined) job.progress = progress;
    if (currentStep) job.currentStep = currentStep;
    if (status === 'completed' || status === 'failed') {
      job.endTime = new Date();
    }

    this.broadcastJobUpdate(job);
  }

  private broadcastJobUpdate(job: IngestionJob): void {
    this.wsService.broadcast('ingestion:job-update', job);
  }

  // Public API methods
  async getJobStatus(jobId: string): Promise<IngestionJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getAllJobs(): Promise<IngestionJob[]> {
    return Array.from(this.jobs.values());
  }

  async deleteRepository(repositoryId: string): Promise<void> {
    // Delete all related data
    await this.db.collection('entities').removeByExample({ repositoryId });
    await this.db.collection('relationships').removeByExample({ repositoryId });
    await this.db.collection('files').removeByExample({ repositoryId });
    await this.db.collection('repositories').remove(repositoryId);
  }

  async getRepositoryEntities(repositoryId: string): Promise<any[]> {
    const cursor = await this.db.query(`
      FOR entity IN entities
      FILTER entity.repositoryId == @repositoryId
      RETURN entity
    `, { repositoryId });
    
    return cursor.all();
  }

  async getRepositoryRelationships(repositoryId: string): Promise<any[]> {
    const cursor = await this.db.query(`
      FOR relationship IN relationships
      FILTER relationship.repositoryId == @repositoryId
      RETURN relationship
    `, { repositoryId });
    
    return cursor.all();
  }

  async getRepositoryMetrics(repositoryId: string): Promise<any> {
    const [entitiesResult, relationshipsResult, filesResult] = await Promise.all([
      this.db.query(`
        FOR entity IN entities
        FILTER entity.repositoryId == @repositoryId
        COLLECT type = entity.type WITH COUNT INTO count
        RETURN { type, count }
      `, { repositoryId }),
      this.db.query(`
        FOR relationship IN relationships
        FILTER relationship.repositoryId == @repositoryId
        COLLECT type = relationship.type WITH COUNT INTO count
        RETURN { type, count }
      `, { repositoryId }),
      this.db.query(`
        FOR file IN files
        FILTER file.repositoryId == @repositoryId
        COLLECT language = file.language WITH COUNT INTO count
        RETURN { language, count }
      `, { repositoryId })
    ]);

    const [entityTypes, relationshipTypes, languages] = await Promise.all([
      entitiesResult.all(),
      relationshipsResult.all(),
      filesResult.all()
    ]);

    return {
      entityTypes,
      relationshipTypes,
      languages,
      totalEntities: entityTypes.reduce((sum: number, item: any) => sum + item.count, 0),
      totalRelationships: relationshipTypes.reduce((sum: number, item: any) => sum + item.count, 0),
      totalFiles: languages.reduce((sum: number, item: any) => sum + item.count, 0)
    };
  }

  async semanticSearch(query: string, repositoryId?: string, limit: number = 20): Promise<any[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    // Search for similar entities using vector similarity
    const searchQuery = repositoryId 
      ? `
        FOR entity IN entities
        FILTER entity.repositoryId == @repositoryId
        LET similarity = COSINE_SIMILARITY(entity.embedding, @queryEmbedding)
        FILTER similarity > 0.5
        SORT similarity DESC
        LIMIT @limit
        RETURN MERGE(entity, { similarity })
      `
      : `
        FOR entity IN entities
        LET similarity = COSINE_SIMILARITY(entity.embedding, @queryEmbedding)
        FILTER similarity > 0.5
        SORT similarity DESC
        LIMIT @limit
        RETURN MERGE(entity, { similarity })
      `;

    const cursor = await this.db.query(searchQuery, { 
      repositoryId, 
      queryEmbedding, 
      limit 
    });
    
    return cursor.all();
  }

  async searchEntities(query: string, type?: string, repositoryId?: string, limit: number = 20): Promise<any[]> {
    let searchQuery = `
      FOR entity IN entities
      FILTER CONTAINS(LOWER(entity.name), LOWER(@query))
    `;

    const params: any = { query, limit };

    if (repositoryId) {
      searchQuery += ` AND entity.repositoryId == @repositoryId`;
      params.repositoryId = repositoryId;
    }

    if (type) {
      searchQuery += ` AND entity.type == @type`;
      params.type = type;
    }

    searchQuery += `
      SORT entity.name ASC
      LIMIT @limit
      RETURN entity
    `;

    const cursor = await this.db.query(searchQuery, params);
    return cursor.all();
  }

  async searchCode(query: string, language?: string, repositoryId?: string, limit: number = 20): Promise<any[]> {
    let searchQuery = `
      FOR file IN files
      FILTER CONTAINS(LOWER(file.path), LOWER(@query))
    `;

    const params: any = { query, limit };

    if (repositoryId) {
      searchQuery += ` AND file.repositoryId == @repositoryId`;
      params.repositoryId = repositoryId;
    }

    if (language) {
      searchQuery += ` AND file.language == @language`;
      params.language = language;
    }

    searchQuery += `
      SORT file.path ASC
      LIMIT @limit
      RETURN file
    `;

    const cursor = await this.db.query(searchQuery, params);
    return cursor.all();
  }
}
