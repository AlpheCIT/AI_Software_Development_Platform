// =====================================================
// AI LEARNINGS SERVICE - Pattern Extraction & Trend Analysis
// =====================================================
// Extracts learning patterns from analysis runs, tracks recurring issues,
// and identifies improvement/regression trends across repositories.

import { Database } from 'arangojs';
import { aql } from 'arangojs/aql.js';
import { AnalysisRunRecord, AnalysisFindingRecord } from './run-persistence-service.js';

// ---------------------
// Interfaces
// ---------------------

export interface LearningRecord {
  _key: string;
  repositoryId: string;
  domain: string;
  pattern: string;         // e.g., 'sql_injection', 'n_plus_one_query', 'missing_auth'
  description: string;
  frequency: number;       // how many times this pattern has appeared
  firstSeen: string;       // ISO date
  lastSeen: string;        // ISO date
  trend: 'improving' | 'worsening' | 'stable';
  relatedFiles: string[];
  severityHistory: string[];  // track how severity changes over time
  runIds: string[];           // which runs detected this
  updatedAt: string;
}

export interface LearningsSummary {
  improving: number;
  worsening: number;
  stable: number;
  topPatterns: Array<{
    pattern: string;
    domain: string;
    frequency: number;
    trend: string;
    lastSeen: string;
  }>;
}

// ---------------------
// Service
// ---------------------

export class AILearningsService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // ---------------------
  // Learning Extraction
  // ---------------------

  async extractLearnings(
    run: AnalysisRunRecord,
    findings: AnalysisFindingRecord[]
  ): Promise<void> {
    if (findings.length === 0) return;

    const now = new Date().toISOString();
    const col = this.db.collection('ai_learnings');

    // Group findings by pattern key (domain + type)
    const patternGroups = new Map<string, AnalysisFindingRecord[]>();
    for (const f of findings) {
      const patternKey = `${run.repositoryId}::${f.domain}::${f.type}`;
      const group = patternGroups.get(patternKey) || [];
      group.push(f);
      patternGroups.set(patternKey, group);
    }

    for (const [patternKey, groupFindings] of patternGroups) {
      const [repoId, domain, pattern] = patternKey.split('::');

      // Generate a stable document key from the pattern
      const docKey = this.makeKey(patternKey);

      // Check if learning already exists
      try {
        const cursor = await this.db.query(aql`
          FOR l IN ai_learnings
            FILTER l._key == ${docKey}
            RETURN l
        `);
        const existing = await cursor.all();

        const relatedFiles = [...new Set(groupFindings.map(f => f.file).filter(Boolean))] as string[];
        const severities = groupFindings.map(f => f.severity);

        if (existing.length > 0) {
          // Update existing learning
          const prev = existing[0] as LearningRecord;
          const newFrequency = prev.frequency + groupFindings.length;
          const trend = this.calculateTrend(prev, groupFindings);
          const mergedFiles = [...new Set([...prev.relatedFiles, ...relatedFiles])].slice(0, 20);
          const mergedRunIds = [...new Set([...prev.runIds, run._key])].slice(-50);
          const mergedSeverityHistory = [...prev.severityHistory, ...severities].slice(-100);

          await col.update(docKey, {
            frequency: newFrequency,
            lastSeen: now,
            trend,
            relatedFiles: mergedFiles,
            severityHistory: mergedSeverityHistory,
            runIds: mergedRunIds,
            updatedAt: now
          });
        } else {
          // Create new learning
          const learning: LearningRecord = {
            _key: docKey,
            repositoryId: repoId,
            domain,
            pattern,
            description: this.generateDescription(domain, pattern, groupFindings),
            frequency: groupFindings.length,
            firstSeen: now,
            lastSeen: now,
            trend: 'stable',
            relatedFiles,
            severityHistory: severities,
            runIds: [run._key],
            updatedAt: now
          };
          await col.save(learning);
        }
      } catch (error: any) {
        console.warn(`Failed to extract learning for ${patternKey}:`, error.message);
      }
    }

    // Check for resolved patterns (patterns from previous runs not in this run)
    await this.markResolvedPatterns(run, findings, now);

    console.log(`Extracted learnings from ${patternGroups.size} patterns for run ${run._key}`);
  }

  // ---------------------
  // Query Learnings
  // ---------------------

  async getLearnings(repositoryId?: string): Promise<LearningRecord[]> {
    try {
      let cursor;
      if (repositoryId) {
        cursor = await this.db.query(aql`
          FOR l IN ai_learnings
            FILTER l.repositoryId == ${repositoryId}
            SORT l.frequency DESC, l.lastSeen DESC
            RETURN l
        `);
      } else {
        cursor = await this.db.query(aql`
          FOR l IN ai_learnings
            SORT l.frequency DESC, l.lastSeen DESC
            LIMIT 200
            RETURN l
        `);
      }

      return await cursor.all() as LearningRecord[];
    } catch (error: any) {
      console.error('Failed to get learnings:', error.message);
      return [];
    }
  }

  async getLearningsSummary(repositoryId: string): Promise<LearningsSummary> {
    try {
      const cursor = await this.db.query(aql`
        LET learnings = (
          FOR l IN ai_learnings
            FILTER l.repositoryId == ${repositoryId}
            RETURN l
        )
        LET improving = LENGTH(FOR l IN learnings FILTER l.trend == 'improving' RETURN 1)
        LET worsening = LENGTH(FOR l IN learnings FILTER l.trend == 'worsening' RETURN 1)
        LET stable = LENGTH(FOR l IN learnings FILTER l.trend == 'stable' RETURN 1)
        LET topPatterns = (
          FOR l IN learnings
            SORT l.frequency DESC
            LIMIT 10
            RETURN {
              pattern: l.pattern,
              domain: l.domain,
              frequency: l.frequency,
              trend: l.trend,
              lastSeen: l.lastSeen
            }
        )
        RETURN {
          improving,
          worsening,
          stable,
          topPatterns
        }
      `);

      const results = await cursor.all();
      if (results.length > 0) {
        return results[0] as LearningsSummary;
      }

      return { improving: 0, worsening: 0, stable: 0, topPatterns: [] };
    } catch (error: any) {
      console.error('Failed to get learnings summary:', error.message);
      return { improving: 0, worsening: 0, stable: 0, topPatterns: [] };
    }
  }

  // ---------------------
  // Helpers
  // ---------------------

  private calculateTrend(
    prev: LearningRecord,
    currentFindings: AnalysisFindingRecord[]
  ): 'improving' | 'worsening' | 'stable' {
    // Compare severity distribution: if current findings have lower severity on average, improving
    const severityScore = (s: string): number => {
      switch (s) {
        case 'critical': return 5;
        case 'high': return 4;
        case 'medium': return 3;
        case 'low': return 2;
        case 'info': return 1;
        default: return 0;
      }
    };

    const prevAvg = prev.severityHistory.length > 0
      ? prev.severityHistory.reduce((sum, s) => sum + severityScore(s), 0) / prev.severityHistory.length
      : 3;

    const currentAvg = currentFindings.length > 0
      ? currentFindings.reduce((sum, f) => sum + severityScore(f.severity), 0) / currentFindings.length
      : 0;

    // If current findings count is lower, or severity dropped, it's improving
    if (currentFindings.length === 0) return 'improving';
    if (currentAvg < prevAvg - 0.5) return 'improving';
    if (currentAvg > prevAvg + 0.5) return 'worsening';
    return 'stable';
  }

  private async markResolvedPatterns(
    run: AnalysisRunRecord,
    currentFindings: AnalysisFindingRecord[],
    now: string
  ): Promise<void> {
    // Get patterns from previous runs for this repo that are NOT in the current run
    const currentPatterns = new Set(
      currentFindings.map(f => this.makeKey(`${run.repositoryId}::${f.domain}::${f.type}`))
    );

    try {
      const cursor = await this.db.query(aql`
        FOR l IN ai_learnings
          FILTER l.repositoryId == ${run.repositoryId}
            AND l.trend != 'improving'
          RETURN l
      `);

      const allLearnings = await cursor.all() as LearningRecord[];
      const col = this.db.collection('ai_learnings');

      for (const learning of allLearnings) {
        if (!currentPatterns.has(learning._key)) {
          // Pattern was not found in this run -- mark as improving
          try {
            await col.update(learning._key, {
              trend: 'improving' as const,
              updatedAt: now
            });
          } catch {
            // Ignore update errors for individual learnings
          }
        }
      }
    } catch (error: any) {
      // Not critical -- skip
      console.warn('Failed to mark resolved patterns:', error.message);
    }
  }

  private generateDescription(
    domain: string,
    pattern: string,
    findings: AnalysisFindingRecord[]
  ): string {
    const count = findings.length;
    const files = [...new Set(findings.map(f => f.file).filter(Boolean))];
    const fileStr = files.length > 0 ? ` in ${files.slice(0, 3).join(', ')}` : '';
    return `Recurring ${domain} pattern "${pattern}" detected ${count} time(s)${fileStr}`;
  }

  private makeKey(input: string): string {
    // ArangoDB keys: only alphanumeric, underscore, dash, colon
    return input
      .replace(/[^a-zA-Z0-9_:-]/g, '_')
      .replace(/__+/g, '_')
      .slice(0, 254);
  }
}
