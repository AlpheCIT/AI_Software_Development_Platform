import { Database } from '@ai-code-management/database';
import { WebSocketService } from './websocket-service';
import { GitService } from '../utils/git-service';
import { LanguageParserFactory } from '../parsers/language-parser-factory';
import { EntityExtractor } from '../extractors/entity-extractor';
import { RelationshipExtractor } from '../extractors/relationship-extractor';
import { GraphBuilder } from '../builders/graph-builder';
import { EmbeddingService } from '../utils/embedding-service';
import { DependencyExtractor, ExtractedDependency } from '../extractors/dependency-extractor';
import { EndpointExtractor } from '../extractors/endpoint-extractor';
import { FrameworkDetector } from '../analyzers/framework-detector';
import { DocCoverageAnalyzer } from '../analyzers/doc-coverage-analyzer';
import { SecretScanner } from '../analyzers/secret-scanner';
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
  private dependencyExtractor: DependencyExtractor;
  private endpointExtractor: EndpointExtractor;
  private frameworkDetector: FrameworkDetector;
  private docCoverageAnalyzer: DocCoverageAnalyzer;
  private secretScanner: SecretScanner;

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
    this.dependencyExtractor = new DependencyExtractor();
    this.endpointExtractor = new EndpointExtractor();
    this.frameworkDetector = new FrameworkDetector();
    this.docCoverageAnalyzer = new DocCoverageAnalyzer();
    this.secretScanner = new SecretScanner();
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
    this.updateJobStatus(jobId, 'running', undefined, 5, 'Analyzing directory structure');
    
    // Verify directory exists
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`Directory does not exist: ${directoryPath}`);
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

    // === SECRET SCANNING (runs first -- highest priority) ===
    this.updateJobStatus(jobId, 'running', undefined, 16, 'Scanning for exposed secrets');
    let secretsFound = 0;
    try {
      const secretResult = await this.secretScanner.scan(directoryPath, repositoryId);
      secretsFound = secretResult.summary.totalSecretsFound;
      if (secretResult.secrets.length > 0) {
        const secretsCollection = this.db.collection('security_findings');
        try { await secretsCollection.create(); } catch (e) { /* already exists */ }
        for (const secret of secretResult.secrets) {
          try {
            await secretsCollection.save({
              ...secret,
              type: 'exposed_secret',
              category: secret.type,
              source: 'secret_scanner'
            });
          } catch (e) { /* skip duplicates */ }
        }
      }
      if (secretsFound > 0) {
        logger.warn(`SECRET SCANNER: Found ${secretsFound} exposed secrets in repository (${secretResult.summary.bySeverity.critical} critical)`);
      } else {
        logger.info('Secret scan: No exposed secrets found');
      }
    } catch (error) {
      logger.error('Secret scanning failed:', error);
    }

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

    // Verify graph population
    this.updateJobStatus(jobId, 'running', undefined, 85, 'Verifying graph edge collections');
    try {
      const graphMetrics = await this.graphBuilder.verifyGraphPopulation(repositoryId);
      logger.info(`Graph verification complete: ${JSON.stringify(graphMetrics)}`);
    } catch (error) {
      logger.error('Graph verification failed:', error);
    }

    // Generate embeddings
    this.updateJobStatus(jobId, 'running', undefined, 90, 'Generating embeddings');
    await this.generateEmbeddings(repositoryId);

    // === NEW: Dependency Extraction ===
    this.updateJobStatus(jobId, 'running', undefined, 91, 'Extracting dependencies');
    let dependencies: ExtractedDependency[] = [];
    try {
      dependencies = await this.dependencyExtractor.extract(directoryPath, repositoryId);
      if (dependencies.length > 0) {
        const depCollection = this.db.collection('external_dependencies');
        // Ensure collection exists, create if not
        try { await depCollection.create(); } catch (e) { /* already exists */ }
        for (const dep of dependencies) {
          try { await depCollection.save(dep); } catch (e) { logger.warn(`Failed to save dependency: ${dep.packageName}`); }
        }
      }
      logger.info(`Extracted ${dependencies.length} dependencies`);
    } catch (error) {
      logger.error('Dependency extraction failed:', error);
    }

    // === NEW: Framework & Middleware Detection ===
    this.updateJobStatus(jobId, 'running', undefined, 93, 'Detecting frameworks and middleware');
    let detectedFrameworks: any[] = [];
    try {
      const frameworkResult = await this.frameworkDetector.detect(directoryPath, repositoryId, dependencies);
      detectedFrameworks = frameworkResult.frameworks;

      if (frameworkResult.frameworks.length > 0) {
        const fwCollection = this.db.collection('framework_usage');
        try { await fwCollection.create(); } catch (e) { /* already exists */ }
        for (const fw of frameworkResult.frameworks) {
          try { await fwCollection.save(fw); } catch (e) { logger.warn(`Failed to save framework: ${fw.framework}`); }
        }
      }

      if (frameworkResult.middleware.length > 0) {
        const mwCollection = this.db.collection('middleware_chains');
        try { await mwCollection.create(); } catch (e) { /* already exists */ }
        for (const mw of frameworkResult.middleware) {
          try { await mwCollection.save(mw); } catch (e) { logger.warn(`Failed to save middleware: ${mw.name}`); }
        }
      }

      logger.info(`Detected ${frameworkResult.frameworks.length} frameworks, ${frameworkResult.middleware.length} middleware`);
    } catch (error) {
      logger.error('Framework detection failed:', error);
    }

    // === NEW: API Endpoint Extraction ===
    this.updateJobStatus(jobId, 'running', undefined, 95, 'Extracting API endpoints');
    try {
      const endpoints = await this.endpointExtractor.extract(directoryPath, repositoryId, detectedFrameworks);
      if (endpoints.length > 0) {
        const epCollection = this.db.collection('api_endpoints');
        try { await epCollection.create(); } catch (e) { /* already exists */ }
        for (const ep of endpoints) {
          try { await epCollection.save(ep); } catch (e) { logger.warn(`Failed to save endpoint: ${ep.method} ${ep.path}`); }
        }
      }
      logger.info(`Extracted ${endpoints.length} API endpoints`);
    } catch (error) {
      logger.error('Endpoint extraction failed:', error);
    }

    // === NEW: Documentation Coverage Analysis ===
    this.updateJobStatus(jobId, 'running', undefined, 97, 'Analyzing documentation coverage');
    try {
      const docResult = await this.docCoverageAnalyzer.analyze(directoryPath, repositoryId);
      if (docResult.files.length > 0) {
        const docCollection = this.db.collection('documentation_coverage');
        try { await docCollection.create(); } catch (e) { /* already exists */ }
        for (const fileCov of docResult.files) {
          try { await docCollection.save(fileCov); } catch (e) { logger.warn(`Failed to save doc coverage: ${fileCov.filePath}`); }
        }
      }
      logger.info(`Analyzed documentation coverage: ${docResult.summary.overallCoveragePercent.toFixed(1)}% across ${docResult.summary.analyzedFiles} files`);
    } catch (error) {
      logger.error('Documentation coverage analysis failed:', error);
    }

    // === NEW: Git History Persistence ===
    this.updateJobStatus(jobId, 'running', undefined, 98, 'Storing git history');
    try {
      // Get commit history
      const commitHistory = await this.gitService.getCommitHistory(directoryPath, { maxCount: 500 });
      if (commitHistory && commitHistory.length > 0) {
        const commitsCollection = this.db.collection('git_commits');
        try { await commitsCollection.create(); } catch (e) { /* already exists */ }

        for (const commit of commitHistory) {
          try {
            await commitsCollection.save({
              _key: commit.hash?.substring(0, 12) || uuidv4(),
              hash: commit.hash,
              message: commit.message,
              author: commit.author,
              authorEmail: commit.email,
              date: commit.date,
              repositoryId: repositoryId,
              refs: commit.refs
            });
          } catch (e) { /* duplicate or error, skip */ }
        }
        logger.info(`Stored ${commitHistory.length} commits`);
      }

      // Get branches
      const branches = await this.gitService.getBranches(directoryPath);
      if (branches) {
        const branchCollection = this.db.collection('git_branches');
        try { await branchCollection.create(); } catch (e) { /* already exists */ }

        for (const branchName of branches.all) {
          try {
            await branchCollection.save({
              _key: `${repositoryId}-${branchName.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
              name: branchName,
              repositoryId: repositoryId,
              isCurrent: branchName === branches.current,
              isRemote: branchName.startsWith('remotes/'),
              status: 'active',
              trackedAt: new Date()
            });
          } catch (e) { /* duplicate or error, skip */ }
        }
        logger.info(`Stored ${branches.all.length} branches`);
      }
    } catch (error) {
      logger.error('Git history persistence failed:', error);
    }

    // Update repository status
    await this.db.collection('repositories').update(repositoryId, {
      status: 'completed',
      completionDate: new Date(),
      stats: {
        filesProcessed: processedFiles,
        entitiesExtracted: totalEntities,
        relationshipsCreated: totalRelationships,
        dependenciesFound: dependencies.length,
        frameworksDetected: detectedFrameworks.length,
        secretsFound,
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
    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;

    // Skip binary files and very large files (>500KB)
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib', '.bin', '.pdf', '.mp3', '.mp4', '.wav', '.avi'];
    const ext = path.extname(filePath).toLowerCase();
    if (binaryExtensions.includes(ext)) {
      return { entities: 0, relationships: 0 };
    }

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
      lastModified: stat.mtime,
      processed: true
    };

    await this.db.collection('files').save(fileRecord);

    // Store actual source code for agent analysis (skip files > 500KB)
    if (fileSize <= 500 * 1024) {
      try {
        const codeFilesCollection = this.db.collection('code_files');
        try { await codeFilesCollection.create(); } catch (e) { /* already exists */ }
        const sanitizedFileId = filePath.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '_');
        await codeFilesCollection.save({
          _key: sanitizedFileId,
          repositoryId,
          path: filePath,
          content: content,
          language: language,
          linesOfCode: content.split('\n').length,
          sizeBytes: Buffer.byteLength(content, 'utf8'),
          storedAt: new Date().toISOString()
        }, { overwriteMode: 'replace' });
      } catch (e: any) {
        // Non-fatal - analysis can still work from other sources
        logger.warn(`Failed to store source code for ${filePath}: ${e.message}`);
      }
    }

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

    // Extract relationships -- save to generic AND typed edge collections
    const relationships = await this.relationshipExtractor.extract(ast, fileId, repositoryId, entities);
    let relationshipCount = 0;

    for (const relationship of relationships) {
      // Save to generic relationships collection
      await this.db.collection('relationships').save(relationship);
      relationshipCount++;

      // Also save to the typed edge collection with _from/_to
      const edgeCollectionName = RelationshipExtractor.getEdgeCollectionName(relationship.type);
      if (edgeCollectionName) {
        try {
          // Determine source/target collections based on relationship type
          const sourceCol = relationship.type === 'contains' ? 'files' : 'entities';
          const targetCol = 'entities';

          const edgeDoc = {
            _key: relationship._key + '_edge',
            _from: `${sourceCol}/${relationship.sourceEntityId}`,
            _to: `${targetCol}/${relationship.targetEntityId}`,
            repositoryId: relationship.repositoryId,
            type: relationship.type,
            sourceEntity: relationship.sourceEntity,
            targetEntity: relationship.targetEntity,
            strength: relationship.strength,
            metadata: relationship.metadata,
            createdAt: relationship.createdAt,
          };

          // Ensure edge collection exists (type 3)
          try { await this.db.collection(edgeCollectionName).create({ type: 3 }); } catch (e) { /* exists */ }
          await this.db.collection(edgeCollectionName).save(edgeDoc);
        } catch (e: any) {
          logger.debug(`Failed to save edge to ${edgeCollectionName}: ${e.message}`);
        }
      }
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
