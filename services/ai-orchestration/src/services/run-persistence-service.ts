// =====================================================
// RUN PERSISTENCE SERVICE - Analysis Run & Findings Storage
// =====================================================
// Persists analysis runs and findings to ArangoDB for history, comparison, and learning.

import { Database } from 'arangojs';
import { aql } from 'arangojs/aql.js';

// ---------------------
// Interfaces
// ---------------------

export interface AnalysisRunRecord {
  _key: string;           // coordination ID
  repositoryId: string;
  repositoryUrl?: string;
  branch?: string;
  commitHash?: string;
  analysisType: string;   // 'security', 'performance', 'comprehensive', 'documentation'
  coordinationType: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;      // ISO
  endTime?: string;
  duration?: number;      // ms
  domains: string[];
  participantAgents: string[];
  debateMetrics?: {
    rounds: number;
    convergenceScore: number;
    falsePositivesEliminated: number;
    totalProposed: number;
    totalVerified: number;
  };
  findingsCount: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    falsePositives: number;
  };
  llmUsage?: {
    totalCalls: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export interface AnalysisFindingRecord {
  _key: string;
  runId: string;
  repositoryId: string;
  domain: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  evidence?: string;
  confidence: number;
  verificationStatus: string;
  verificationMethod?: string;
  challengerNotes?: string;
  remediation?: string;
  createdAt: string;
}

// ---------------------
// Service
// ---------------------

export class RunPersistenceService {
  private db: Database;
  private initialized: boolean = false;

  constructor(db: Database) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const collections = [
      'analysis_runs',
      'analysis_findings',
      'analysis_recommendations',
      'ai_learnings'
    ];

    for (const name of collections) {
      try {
        const col = this.db.collection(name);
        const exists = await col.exists();
        if (!exists) {
          await this.db.createCollection(name);
          console.log(`Created collection: ${name}`);
        }
      } catch (e: any) {
        // Collection may already exist - ignore duplicate errors
        if (e.errorNum !== 1207) {
          console.warn(`Warning creating collection ${name}:`, e.message);
        }
      }
    }

    this.initialized = true;
    console.log('RunPersistenceService initialized');
  }

  // ---------------------
  // Run CRUD
  // ---------------------

  async saveRun(run: AnalysisRunRecord): Promise<string> {
    await this.ensureInitialized();
    const col = this.db.collection('analysis_runs');

    try {
      const doc = await col.save(run, { overwriteMode: 'replace' });
      console.log(`Saved analysis run: ${run._key}`);
      return doc._key;
    } catch (error: any) {
      console.error(`Failed to save run ${run._key}:`, error.message);
      throw error;
    }
  }

  async updateRun(runId: string, updates: Partial<AnalysisRunRecord>): Promise<void> {
    await this.ensureInitialized();
    const col = this.db.collection('analysis_runs');

    try {
      await col.update(runId, updates);
      console.log(`Updated analysis run: ${runId}`);
    } catch (error: any) {
      console.error(`Failed to update run ${runId}:`, error.message);
      throw error;
    }
  }

  async getRunById(runId: string): Promise<AnalysisRunRecord | null> {
    await this.ensureInitialized();

    try {
      const cursor = await this.db.query(aql`
        FOR run IN analysis_runs
          FILTER run._key == ${runId}
          RETURN run
      `);
      const results = await cursor.all();
      return results.length > 0 ? results[0] as AnalysisRunRecord : null;
    } catch (error: any) {
      console.error(`Failed to get run ${runId}:`, error.message);
      return null;
    }
  }

  async getRuns(options?: {
    repositoryId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AnalysisRunRecord[]> {
    await this.ensureInitialized();

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    try {
      let cursor;
      if (options?.repositoryId) {
        cursor = await this.db.query(aql`
          FOR run IN analysis_runs
            FILTER run.repositoryId == ${options.repositoryId}
            SORT run.startTime DESC
            LIMIT ${offset}, ${limit}
            RETURN run
        `);
      } else {
        cursor = await this.db.query(aql`
          FOR run IN analysis_runs
            SORT run.startTime DESC
            LIMIT ${offset}, ${limit}
            RETURN run
        `);
      }

      return await cursor.all() as AnalysisRunRecord[];
    } catch (error: any) {
      console.error('Failed to get runs:', error.message);
      return [];
    }
  }

  // ---------------------
  // Findings CRUD
  // ---------------------

  async saveFindings(findings: AnalysisFindingRecord[]): Promise<void> {
    await this.ensureInitialized();

    if (findings.length === 0) return;

    const col = this.db.collection('analysis_findings');

    try {
      // Bulk insert using AQL for better performance
      await this.db.query(aql`
        FOR finding IN ${findings}
          INSERT finding INTO analysis_findings
          OPTIONS { overwriteMode: "replace" }
      `);
      console.log(`Saved ${findings.length} findings`);
    } catch (error: any) {
      console.error('Failed to save findings:', error.message);
      // Fallback: insert one by one
      let saved = 0;
      for (const finding of findings) {
        try {
          await col.save(finding, { overwriteMode: 'replace' });
          saved++;
        } catch (e: any) {
          console.warn(`Failed to save finding ${finding._key}:`, e.message);
        }
      }
      console.log(`Saved ${saved}/${findings.length} findings (with errors)`);
    }
  }

  async getRunFindings(runId: string, options?: {
    severity?: string;
  }): Promise<AnalysisFindingRecord[]> {
    await this.ensureInitialized();

    try {
      let cursor;
      if (options?.severity) {
        cursor = await this.db.query(aql`
          FOR f IN analysis_findings
            FILTER f.runId == ${runId} AND f.severity == ${options.severity}
            SORT f.severity == 'critical' ? 0 :
                 f.severity == 'high' ? 1 :
                 f.severity == 'medium' ? 2 :
                 f.severity == 'low' ? 3 : 4 ASC,
                 f.confidence DESC
            RETURN f
        `);
      } else {
        cursor = await this.db.query(aql`
          FOR f IN analysis_findings
            FILTER f.runId == ${runId}
            SORT f.severity == 'critical' ? 0 :
                 f.severity == 'high' ? 1 :
                 f.severity == 'medium' ? 2 :
                 f.severity == 'low' ? 3 : 4 ASC,
                 f.confidence DESC
            RETURN f
        `);
      }

      return await cursor.all() as AnalysisFindingRecord[];
    } catch (error: any) {
      console.error(`Failed to get findings for run ${runId}:`, error.message);
      return [];
    }
  }

  // ---------------------
  // Run Comparison
  // ---------------------

  async compareRuns(
    runId1: string,
    runId2: string
  ): Promise<{
    newFindings: AnalysisFindingRecord[];
    resolvedFindings: AnalysisFindingRecord[];
    changedFindings: Array<{
      previous: AnalysisFindingRecord;
      current: AnalysisFindingRecord;
      changes: string[];
    }>;
  }> {
    await this.ensureInitialized();

    try {
      // Get findings for both runs
      const [findings1, findings2] = await Promise.all([
        this.getRunFindings(runId1),
        this.getRunFindings(runId2)
      ]);

      // Build fingerprint maps: match by (file + type + line proximity)
      const fingerprint = (f: AnalysisFindingRecord): string =>
        `${f.file || ''}::${f.type}::${Math.floor((f.line || 0) / 5)}`;

      const map1 = new Map<string, AnalysisFindingRecord>();
      for (const f of findings1) {
        map1.set(fingerprint(f), f);
      }

      const map2 = new Map<string, AnalysisFindingRecord>();
      for (const f of findings2) {
        map2.set(fingerprint(f), f);
      }

      // New findings: in run2 but not in run1
      const newFindings: AnalysisFindingRecord[] = [];
      // Resolved findings: in run1 but not in run2
      const resolvedFindings: AnalysisFindingRecord[] = [];
      // Changed findings: in both but with different severity/confidence
      const changedFindings: Array<{
        previous: AnalysisFindingRecord;
        current: AnalysisFindingRecord;
        changes: string[];
      }> = [];

      for (const [fp, f2] of map2) {
        const f1 = map1.get(fp);
        if (!f1) {
          newFindings.push(f2);
        } else {
          // Check for changes
          const changes: string[] = [];
          if (f1.severity !== f2.severity) {
            changes.push(`severity: ${f1.severity} -> ${f2.severity}`);
          }
          if (Math.abs(f1.confidence - f2.confidence) > 0.05) {
            changes.push(`confidence: ${f1.confidence.toFixed(2)} -> ${f2.confidence.toFixed(2)}`);
          }
          if (f1.verificationStatus !== f2.verificationStatus) {
            changes.push(`verification: ${f1.verificationStatus} -> ${f2.verificationStatus}`);
          }
          if (changes.length > 0) {
            changedFindings.push({ previous: f1, current: f2, changes });
          }
        }
      }

      for (const [fp, f1] of map1) {
        if (!map2.has(fp)) {
          resolvedFindings.push(f1);
        }
      }

      return { newFindings, resolvedFindings, changedFindings };
    } catch (error: any) {
      console.error(`Failed to compare runs ${runId1} vs ${runId2}:`, error.message);
      return { newFindings: [], resolvedFindings: [], changedFindings: [] };
    }
  }

  // ---------------------
  // Helpers
  // ---------------------

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
