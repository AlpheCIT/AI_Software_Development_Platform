// ─── JSON Schemas for Structured LLM Outputs ───────────────────────────────
// These schemas are passed to the LLM to constrain output format.
// Each domain (Security, Performance, Documentation, Dependency) has three
// schemas: Analyzer output, Challenger verification, and Synthesizer report.

// ─── Security Domain ────────────────────────────────────────────────────────

export const SecurityAnalysisSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'sql_injection', 'xss', 'hardcoded_secret', 'missing_auth',
              'missing_rate_limit', 'path_traversal', 'command_injection',
              'insecure_dependency', 'missing_input_validation',
              'information_disclosure', 'csrf', 'ssrf', 'other',
            ],
          },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          title: { type: 'string' },
          description: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          evidence: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          cwe_id: { type: 'string' },
          remediation: { type: 'string' },
        },
        required: ['type', 'severity', 'title', 'file', 'line', 'evidence', 'confidence'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
} as const;

export const SecurityChallengerSchema = {
  type: 'object',
  properties: {
    verifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          findingId: { type: 'string' },
          verdict: { type: 'string', enum: ['verified', 'false_positive', 'needs_more_context'] },
          adjustedSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          adjustedConfidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string' },
          mitigationsFound: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
        },
        required: ['findingId', 'verdict', 'adjustedConfidence', 'evidence', 'reasoning'],
      },
    },
  },
  required: ['verifications'],
} as const;

// ─── Performance Domain ─────────────────────────────────────────────────────

export const PerformanceAnalysisSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'n_plus_one', 'synchronous_io', 'memory_leak', 'excessive_complexity',
              'missing_index', 'unbounded_query', 'blocking_event_loop',
              'unnecessary_computation', 'missing_caching', 'inefficient_algorithm',
              'resource_exhaustion', 'other',
            ],
          },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          title: { type: 'string' },
          description: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          evidence: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          estimatedImpact: { type: 'string' },
          remediation: { type: 'string' },
        },
        required: ['type', 'severity', 'title', 'file', 'line', 'evidence', 'confidence'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
} as const;

export const PerformanceChallengerSchema = {
  type: 'object',
  properties: {
    verifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          findingId: { type: 'string' },
          verdict: { type: 'string', enum: ['verified', 'false_positive', 'needs_more_context'] },
          adjustedSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          adjustedConfidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string' },
          mitigationsFound: { type: 'array', items: { type: 'string' } },
          contextualFactors: { type: 'string' },
          reasoning: { type: 'string' },
        },
        required: ['findingId', 'verdict', 'adjustedConfidence', 'evidence', 'reasoning'],
      },
    },
  },
  required: ['verifications'],
} as const;

// ─── Documentation Domain ───────────────────────────────────────────────────

export const DocumentationAnalysisSchema = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['missing', 'incomplete', 'outdated', 'adequate', 'good', 'excellent'] },
          completeness: { type: 'number', minimum: 0, maximum: 1 },
          accuracy: { type: 'number', minimum: 0, maximum: 1 },
          description: { type: 'string' },
          issues: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'status', 'completeness', 'accuracy'],
      },
    },
    coverage: {
      type: 'object',
      properties: {
        publicApis: { type: 'number', minimum: 0, maximum: 1 },
        inlineComments: { type: 'number', minimum: 0, maximum: 1 },
        readme: { type: 'number', minimum: 0, maximum: 1 },
        examples: { type: 'number', minimum: 0, maximum: 1 },
        changelog: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    summary: { type: 'string' },
  },
  required: ['sections', 'coverage', 'summary'],
} as const;

export const DocumentationChallengerSchema = {
  type: 'object',
  properties: {
    verifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectionName: { type: 'string' },
          verdict: { type: 'string', enum: ['accurate', 'overly_critical', 'overly_generous', 'needs_revision'] },
          adjustedCompleteness: { type: 'number', minimum: 0, maximum: 1 },
          adjustedAccuracy: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string' },
          reasoning: { type: 'string' },
        },
        required: ['sectionName', 'verdict', 'evidence', 'reasoning'],
      },
    },
  },
  required: ['verifications'],
} as const;

// ─── Dependency Domain ──────────────────────────────────────────────────────

export const DependencyAnalysisSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'outdated', 'vulnerable', 'license_risk', 'deprecated',
              'unmaintained', 'excessive_transitive', 'duplicate',
              'missing_lockfile', 'pinning_issue', 'other',
            ],
          },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          title: { type: 'string' },
          package: { type: 'string' },
          currentVersion: { type: 'string' },
          latestVersion: { type: 'string' },
          description: { type: 'string' },
          evidence: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          cve_ids: { type: 'array', items: { type: 'string' } },
          license: { type: 'string' },
          remediation: { type: 'string' },
        },
        required: ['type', 'severity', 'title', 'package', 'evidence', 'confidence'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
} as const;

export const DependencyChallengerSchema = {
  type: 'object',
  properties: {
    verifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          findingId: { type: 'string' },
          verdict: { type: 'string', enum: ['verified', 'false_positive', 'needs_more_context'] },
          adjustedSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          adjustedConfidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string' },
          mitigationsFound: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
        },
        required: ['findingId', 'verdict', 'adjustedConfidence', 'evidence', 'reasoning'],
      },
    },
  },
  required: ['verifications'],
} as const;

// ─── Documentation Drafter Domain ──────────────────────────────────────────

export const DocumentationDrafterSchema = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectionName: { type: 'string', enum: ['Getting Started', 'API Reference', 'Architecture Overview', 'Configuration Guide'] },
          content: { type: 'string' },
          completeness: { type: 'number', minimum: 0, maximum: 1 },
          sourceEvidence: { type: 'array', items: { type: 'string' } },
        },
        required: ['sectionName', 'content', 'completeness'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['sections', 'summary'],
} as const;

export const DocumentationVerificationSchema = {
  type: 'object',
  properties: {
    verifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectionName: { type: 'string' },
          verified: { type: 'boolean' },
          accuracy: { type: 'number', minimum: 0, maximum: 1 },
          issues: { type: 'array', items: { type: 'string' } },
          missingFeatures: { type: 'array', items: { type: 'string' } },
          incorrectClaims: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
        },
        required: ['sectionName', 'verified', 'accuracy', 'reasoning'],
      },
    },
    overallAccuracy: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string' },
  },
  required: ['verifications', 'overallAccuracy', 'summary'],
} as const;

export const DocumentationPolishSchema = {
  type: 'object',
  properties: {
    polishedDocument: { type: 'string' },
    sectionsImproved: { type: 'number' },
    changesApplied: { type: 'array', items: { type: 'string' } },
    qualityScore: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['polishedDocument', 'sectionsImproved', 'qualityScore'],
} as const;

// ─── Synthesizer Report (Cross-Domain) ──────────────────────────────────────

export const SynthesizerReportSchema = {
  type: 'object',
  properties: {
    executiveSummary: { type: 'string' },
    overallGrade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
    domain: { type: 'string' },
    rankedFindings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rank: { type: 'number' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          file: { type: 'string' },
          line: { type: 'number' },
          description: { type: 'string' },
          remediation: { type: 'string' },
          estimatedEffort: { type: 'string', enum: ['trivial', 'small', 'medium', 'large', 'epic'] },
          category: { type: 'string' },
        },
        required: ['rank', 'title', 'severity', 'confidence', 'description', 'remediation'],
      },
    },
    quickWins: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          effort: { type: 'string' },
          impact: { type: 'string' },
        },
        required: ['title', 'description', 'effort', 'impact'],
      },
    },
    remediationPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phase: { type: 'number' },
          title: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['immediate', 'short_term', 'medium_term', 'long_term'] },
        },
        required: ['phase', 'title', 'actions', 'priority'],
      },
    },
    stats: {
      type: 'object',
      properties: {
        totalFindings: { type: 'number' },
        criticalCount: { type: 'number' },
        highCount: { type: 'number' },
        mediumCount: { type: 'number' },
        lowCount: { type: 'number' },
        falsePositiveRate: { type: 'number' },
      },
    },
  },
  required: ['executiveSummary', 'overallGrade', 'domain', 'rankedFindings', 'quickWins', 'remediationPlan'],
} as const;
