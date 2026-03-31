/**
 * Calibrated scoring system for QA agent reports.
 * Replaces arbitrary "100 - issues * 5" with weighted, evidence-based scores.
 */

export interface ScoredFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence?: number;  // 0-1
  verified?: boolean;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 15,
  high: 10,
  medium: 5,
  low: 2,
  info: 0
};

/**
 * Calculate a calibrated health score based on findings and repo size.
 * Larger repos naturally have more issues — normalize for that.
 */
export function calculateCalibratedScore(
  findings: ScoredFinding[],
  totalFiles: number
): { score: number; grade: string; gradeDescription: string } {
  if (findings.length === 0) {
    return { score: 70, grade: 'C', gradeDescription: 'No verified issues found — limited analysis' };
  }

  let deductions = 0;
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const weight = SEVERITY_WEIGHTS[f.severity] || 0;
    const confidence = f.confidence || 0.5;
    const verifiedMultiplier = f.verified === false ? 0.3 : 1.0;

    // Cap per-finding deduction to prevent single finding from dominating
    const rawDeduction = weight * confidence * verifiedMultiplier;
    const cappedDeduction = Math.min(rawDeduction, 15);

    // Diminishing returns: after 10 findings, each additional one has less impact
    // Prevents score crash when LLM reports many similar findings
    const diminishingFactor = i < 10 ? 1.0 : Math.max(0.3, 1.0 - (i - 10) * 0.07);

    deductions += cappedDeduction * diminishingFactor;
  }

  // Normalize by repo size (log scale)
  // Floor at 0.7 to prevent small repos from being unfairly penalized
  const sizeNormalizer = Math.max(Math.log10(totalFiles + 10) / Math.log10(200), 0.7);
  const normalizedDeductions = deductions / sizeNormalizer;

  // Floor at 20 — no agent should score below 20/100 (even severely problematic code has SOME merit)
  const score = Math.max(20, Math.min(100, Math.round(100 - normalizedDeductions)));
  const { grade, gradeDescription } = getGrade(score);

  return { score, grade, gradeDescription };
}

function getGrade(score: number): { grade: string; gradeDescription: string } {
  if (score >= 90) return { grade: 'A', gradeDescription: 'Production-ready, minimal issues' };
  if (score >= 75) return { grade: 'B', gradeDescription: 'Good quality, minor improvements needed' };
  if (score >= 60) return { grade: 'C', gradeDescription: 'Acceptable, several improvements recommended' };
  if (score >= 40) return { grade: 'D', gradeDescription: 'Below average, significant issues' };
  return { grade: 'F', gradeDescription: 'Critical issues requiring immediate attention' };
}

/**
 * Compute a single unified health score from all agent results.
 * Each agent contributes a weighted score; agents that failed or didn't run are excluded
 * and remaining weights are re-normalized.
 */
export function computeUnifiedHealthScore(
  agentResults: Record<string, any>
): { score: number; grade: string; breakdown: Record<string, { score: number; weight: number }> } {
  const WEIGHTS: Record<string, number> = {
    'code-quality': 0.25,
    'self-healer': 0.20,
    'api-validator': 0.20,
    'coverage-auditor': 0.15,
    'ui-ux-analyst': 0.10,
    'mutation': 0.10,
  };

  const SCORE_EXTRACTORS: Record<string, (data: any) => number | null> = {
    'code-quality': (d) => d?.overallHealth?.score ?? null,
    'self-healer': (d) => d?.healthScore ?? null,
    'api-validator': (d) => d?.apiHealthScore ?? null,
    'coverage-auditor': (d) => d?.coverageScore ?? null,
    'ui-ux-analyst': (d) => {
      const a11y = d?.accessibilityScore ?? 0;
      const ux = d?.uxScore ?? 0;
      return (a11y || ux) ? Math.round((a11y + ux) / 2) : null;
    },
  };

  let totalWeight = 0;
  let weightedSum = 0;
  const breakdown: Record<string, { score: number; weight: number }> = {};

  for (const [agentId, weight] of Object.entries(WEIGHTS)) {
    const result = agentResults[agentId];
    if (!result || result.__failed) continue;

    const extractor = SCORE_EXTRACTORS[agentId];
    const score = extractor ? extractor(result) : null;
    if (score !== null && score !== undefined) {
      weightedSum += score * weight;
      totalWeight += weight;
      breakdown[agentId] = { score, weight };
    }
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const grade = finalScore >= 90 ? 'A' : finalScore >= 80 ? 'B' : finalScore >= 60 ? 'C' : finalScore >= 40 ? 'D' : 'F';

  return { score: finalScore, grade, breakdown };
}

/**
 * Enrich findings with blast radius information.
 */
export function enrichFindingsWithBlastRadius(
  findings: Array<{ file?: string; location?: { file?: string }; blastRadius?: any; [key: string]: any }>,
  dependentGraph: Map<string, string[]>
): void {
  for (const finding of findings) {
    const filePath = finding.file || finding.location?.file;
    if (!filePath || !dependentGraph.has(filePath)) continue;

    const dependents = dependentGraph.get(filePath) || [];
    if (dependents.length > 0) {
      finding.blastRadius = {
        directDependents: dependents.length,
        files: dependents.slice(0, 5),
        note: dependents.length > 5 ? `...and ${dependents.length - 5} more` : undefined
      };
    }
  }
}
