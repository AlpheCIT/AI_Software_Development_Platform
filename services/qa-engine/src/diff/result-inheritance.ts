/**
 * Result inheritance — carries forward agent results from previous runs
 * when the agent's scope hasn't changed.
 */

/** Collection mapping: agent ID → ArangoDB collection + key prefix */
const AGENT_COLLECTIONS: Record<string, { collection: string; keyPrefix: string }> = {
  'self-healer':       { collection: 'qa_self_healing_reports',   keyPrefix: 'selfheal_' },
  'api-validator':     { collection: 'qa_api_validation_reports', keyPrefix: 'apivalidation_' },
  'coverage-auditor':  { collection: 'qa_coverage_audit_reports', keyPrefix: 'coverage_' },
  'ui-ux-analyst':     { collection: 'qa_ui_audit_reports',       keyPrefix: 'uiaudit_' },
  'code-quality-architect': { collection: 'qa_code_quality_reports', keyPrefix: 'quality_' },
  'behavioral-analyst': { collection: 'qa_behavioral_specs',      keyPrefix: 'behavioral_' },
  'change-tracker':    { collection: 'qa_behavior_changes',       keyPrefix: 'changes_' },
  'fullstack-auditor': { collection: 'qa_fullstack_audit_reports', keyPrefix: 'fullstack_' },
  'product-manager':   { collection: 'qa_product_roadmaps',       keyPrefix: 'roadmap_' },
  'research-assistant': { collection: 'qa_research_insights',     keyPrefix: 'research_' },
};

export interface InheritedResult {
  agentId: string;
  collection: string;
  documentKey: string;
  inherited: boolean;
  inheritedFrom: string;  // Previous run ID
  success: boolean;
  error?: string;
}

/**
 * Copy agent results from a previous run to the current run.
 * Marks each copied document with `inherited: true`.
 */
export async function inheritResults(
  dbClient: any,
  previousRunId: string,
  currentRunId: string,
  agentsToInherit: string[]
): Promise<InheritedResult[]> {
  const results: InheritedResult[] = [];

  for (const agentId of agentsToInherit) {
    const mapping = AGENT_COLLECTIONS[agentId];
    if (!mapping) {
      console.log(`[ResultInheritance] No collection mapping for agent: ${agentId} — skipping`);
      results.push({
        agentId,
        collection: 'unknown',
        documentKey: '',
        inherited: false,
        inheritedFrom: previousRunId,
        success: false,
        error: 'No collection mapping',
      });
      continue;
    }

    const previousKey = `${mapping.keyPrefix}${previousRunId}`;
    const newKey = `${mapping.keyPrefix}${currentRunId}`;

    try {
      // Fetch previous result
      const previousDoc = await dbClient.getDocument(mapping.collection, previousKey);
      if (!previousDoc) {
        console.log(`[ResultInheritance] No previous result for ${agentId} (key: ${previousKey})`);
        results.push({
          agentId,
          collection: mapping.collection,
          documentKey: newKey,
          inherited: false,
          inheritedFrom: previousRunId,
          success: false,
          error: 'No previous result found',
        });
        continue;
      }

      // Copy with inheritance metadata
      const inheritedDoc = {
        ...previousDoc,
        _key: newKey,
        _id: undefined,
        _rev: undefined,
        inherited: true,
        inheritedFrom: previousRunId,
        inheritedAt: new Date().toISOString(),
        originalCreatedAt: previousDoc.createdAt || previousDoc.timestamp,
      };

      delete inheritedDoc._id;
      delete inheritedDoc._rev;

      await dbClient.upsertDocument(mapping.collection, inheritedDoc);

      console.log(`[ResultInheritance] ✅ Inherited ${agentId} from run ${previousRunId}`);
      results.push({
        agentId,
        collection: mapping.collection,
        documentKey: newKey,
        inherited: true,
        inheritedFrom: previousRunId,
        success: true,
      });
    } catch (err: any) {
      console.error(`[ResultInheritance] Failed to inherit ${agentId}:`, err.message);
      results.push({
        agentId,
        collection: mapping.collection,
        documentKey: newKey,
        inherited: false,
        inheritedFrom: previousRunId,
        success: false,
        error: err.message,
      });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  console.log(`[ResultInheritance] ${succeeded}/${agentsToInherit.length} results inherited successfully`);

  return results;
}
