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
    return { score: 95, grade: 'A', gradeDescription: 'Excellent — no issues found' };
  }

  let deductions = 0;
  for (const f of findings) {
    const weight = SEVERITY_WEIGHTS[f.severity] || 0;
    const confidence = f.confidence || 0.5;
    const verifiedMultiplier = f.verified === false ? 0.3 : 1.0; // unverified findings count less
    deductions += weight * confidence * verifiedMultiplier;
  }

  // Normalize by repo size (log scale — a 200-file repo shouldn't be penalized 10x vs a 20-file repo)
  const sizeNormalizer = Math.max(Math.log10(totalFiles + 1) / Math.log10(200), 0.5);
  const normalizedDeductions = deductions / sizeNormalizer;

  const score = Math.max(0, Math.min(100, Math.round(100 - normalizedDeductions)));
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
