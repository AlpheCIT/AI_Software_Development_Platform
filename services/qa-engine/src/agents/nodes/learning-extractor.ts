/**
 * Learning Extractor — Extracts patterns and insights from completed runs
 * Populates qa_learnings and qa_bug_archetypes collections
 * This enables the "AI learns over time" capability
 */

import { QA_COLLECTIONS } from '../../graph/collections';

interface Learning {
  type: 'pattern' | 'insight' | 'recommendation';
  category: string;
  description: string;
  frequency: number;
  confidence: number;
  sourceAgents: string[];
  affectedFiles: string[];
  firstSeen: string;
  lastSeen: string;
}

interface BugArchetype {
  name: string;
  category: string;
  description: string;
  pattern: string;
  occurrences: number;
  severity: string;
  suggestedFix: string;
  affectedFiles: string[];
  firstSeen: string;
  lastSeen: string;
}

export async function extractLearnings(
  runId: string,
  repositoryId: string,
  state: any,
  dbClient: any
): Promise<void> {
  const now = new Date().toISOString();

  try {
    // Extract learnings from code quality findings
    const codeSmells = state.codeQuality?.codeSmells || [];
    const architectureIssues = state.codeQuality?.architectureIssues || [];
    const testResults = state.testResults || [];
    const mutationResult = state.mutationResult;
    const criticFeedback = state.criticFeedback || [];

    // Pattern 1: Recurring code smells → learnings
    const smellTypes = new Map<string, number>();
    for (const smell of codeSmells) {
      const type = smell.type || 'unknown';
      smellTypes.set(type, (smellTypes.get(type) || 0) + 1);
    }

    for (const [type, count] of smellTypes) {
      if (count >= 2) {
        const key = `learning_${repositoryId}_smell_${type}`;
        const existing = await dbClient.getDocument(QA_COLLECTIONS.LEARNINGS, key).catch(() => null);

        await dbClient.upsertDocument(QA_COLLECTIONS.LEARNINGS, {
          _key: key,
          repositoryId,
          type: 'pattern',
          category: 'code-smell',
          description: `Recurring "${type}" pattern found ${count} times across the codebase`,
          frequency: existing ? (existing.frequency || 0) + count : count,
          confidence: Math.min(1, count / 10),
          sourceAgents: ['code-quality-architect'],
          affectedFiles: codeSmells.filter((s: any) => s.type === type).map((s: any) => s.location || s.file).slice(0, 10),
          firstSeen: existing?.firstSeen || now,
          lastSeen: now,
          runCount: (existing?.runCount || 0) + 1,
        });
      }
    }

    // Pattern 2: Critic feedback patterns → learnings
    const rejectedTests = criticFeedback.filter((f: any) => !f.approved);
    if (rejectedTests.length > 0) {
      const gaps = rejectedTests.flatMap((f: any) => f.gaps || []);
      const gapTypes = new Map<string, number>();
      for (const gap of gaps) {
        const normalized = gap.toLowerCase().includes('edge case') ? 'missing-edge-cases'
          : gap.toLowerCase().includes('assertion') ? 'weak-assertions'
          : gap.toLowerCase().includes('error') ? 'missing-error-handling'
          : 'general-weakness';
        gapTypes.set(normalized, (gapTypes.get(normalized) || 0) + 1);
      }

      for (const [gapType, count] of gapTypes) {
        const key = `learning_${repositoryId}_gap_${gapType}`;
        const existing = await dbClient.getDocument(QA_COLLECTIONS.LEARNINGS, key).catch(() => null);

        await dbClient.upsertDocument(QA_COLLECTIONS.LEARNINGS, {
          _key: key,
          repositoryId,
          type: 'insight',
          category: 'test-quality',
          description: `Tests frequently rejected for: ${gapType.replace(/-/g, ' ')} (${count} instances)`,
          frequency: existing ? (existing.frequency || 0) + count : count,
          confidence: Math.min(1, count / 5),
          sourceAgents: ['critic', 'generator'],
          affectedFiles: [],
          firstSeen: existing?.firstSeen || now,
          lastSeen: now,
          runCount: (existing?.runCount || 0) + 1,
        });
      }
    }

    // Pattern 3: Mutation survivors → bug archetypes
    if (mutationResult?.survivors) {
      const mutationTypes = new Map<string, any[]>();
      for (const survivor of mutationResult.survivors) {
        const type = survivor.mutationType || 'unknown';
        if (!mutationTypes.has(type)) mutationTypes.set(type, []);
        mutationTypes.get(type)!.push(survivor);
      }

      for (const [mutType, survivors] of mutationTypes) {
        const key = `archetype_${repositoryId}_${mutType}`;
        const existing = await dbClient.getDocument(QA_COLLECTIONS.BUG_ARCHETYPES, key).catch(() => null);

        await dbClient.upsertDocument(QA_COLLECTIONS.BUG_ARCHETYPES, {
          _key: key,
          repositoryId,
          name: `${mutType} mutation survival`,
          category: mutType,
          description: `${survivors.length} ${mutType} mutations survived testing — tests don't catch ${mutType} changes`,
          pattern: survivors[0]?.originalCode ? `${survivors[0].originalCode} → ${survivors[0].mutatedCode}` : mutType,
          occurrences: existing ? (existing.occurrences || 0) + survivors.length : survivors.length,
          severity: survivors.length >= 3 ? 'high' : survivors.length >= 2 ? 'medium' : 'low',
          suggestedFix: `Add tests that specifically verify ${mutType} behavior — check boundary conditions and operator correctness`,
          affectedFiles: survivors.map((s: any) => s.file).filter(Boolean).slice(0, 10),
          firstSeen: existing?.firstSeen || now,
          lastSeen: now,
          runCount: (existing?.runCount || 0) + 1,
        });
      }
    }

    // Pattern 4: Architecture issues → learnings
    for (const issue of architectureIssues) {
      if (issue.severity === 'critical' || issue.severity === 'high') {
        const key = `learning_${repositoryId}_arch_${(issue.type || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}`;
        const existing = await dbClient.getDocument(QA_COLLECTIONS.LEARNINGS, key).catch(() => null);

        await dbClient.upsertDocument(QA_COLLECTIONS.LEARNINGS, {
          _key: key,
          repositoryId,
          type: 'recommendation',
          category: 'architecture',
          description: issue.issue || issue.description || `Architecture issue: ${issue.type}`,
          frequency: existing ? (existing.frequency || 0) + 1 : 1,
          confidence: issue.severity === 'critical' ? 0.9 : 0.7,
          sourceAgents: ['code-quality-architect'],
          affectedFiles: issue.affectedFiles || [],
          firstSeen: existing?.firstSeen || now,
          lastSeen: now,
          runCount: (existing?.runCount || 0) + 1,
        });
      }
    }

    console.log(`[LearningExtractor] Extracted learnings for ${repositoryId}: ${smellTypes.size} smell patterns, ${rejectedTests.length} test gaps, ${mutationResult?.survivors?.length || 0} mutation archetypes`);
  } catch (error: any) {
    console.warn(`[LearningExtractor] Failed to extract learnings: ${error.message}`);
  }
}
