// =====================================================
// DEPENDENCY INTELLIGENCE AGENT - ArangoDB-DRIVEN ANALYSIS
// =====================================================
// Deep intelligence on individual packages: maintenance status,
// vulnerability scanning, and license compatibility analysis.
// Overlaps with the SECURITY domain for vulnerability tracking.

import {
  EnhancedBaseA2AAgent,
  AnalysisRequest,
  AnalysisResult,
  Finding,
  Recommendation,
  BusinessContext
} from './enhanced-base-agent.js';
import {
  A2AAgentDomain,
  A2ACapabilities,
  A2AContext,
  A2ACommunicationBus
} from '../communication/a2a-protocol.js';
import { Database } from 'arangojs';

// =====================================================
// DOMAIN-SPECIFIC INTERFACES
// =====================================================

interface IntelligenceFinding extends Finding {
  packageName: string;
  packageVersion?: string;
  maintenanceStatus?: 'active' | 'slow' | 'inactive' | 'deprecated' | 'unknown';
  licenseType?: string;
  licenseCompatibility?: 'compatible' | 'restrictive' | 'unknown';
  lastPublishDate?: string;
}

interface PackageIntel {
  name: string;
  version: string;
  lastPublish?: string;
  daysSincePublish: number;
  maintenanceStatus: 'active' | 'slow' | 'inactive' | 'deprecated' | 'unknown';
  vulnerabilities: number;
  highestSeverity: string;
  license: string;
  licenseCompatibility: 'compatible' | 'restrictive' | 'unknown';
  inHealthCollection: boolean;
}

// =====================================================
// LICENSE COMPATIBILITY MAP
// =====================================================

const PERMISSIVE_LICENSES = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0',
  '0BSD', 'Unlicense', 'CC0-1.0', 'Zlib', 'BlueOak-1.0.0'
]);

const RESTRICTIVE_LICENSES = new Set([
  'GPL-2.0', 'GPL-2.0-only', 'GPL-3.0', 'GPL-3.0-only',
  'AGPL-3.0', 'AGPL-3.0-only', 'LGPL-2.1', 'LGPL-3.0',
  'EUPL-1.2', 'SSPL-1.0', 'CC-BY-SA-4.0'
]);

// =====================================================
// DEPENDENCY INTELLIGENCE AGENT
// =====================================================

export class DependencyIntelligenceAgent extends EnhancedBaseA2AAgent {
  public static readonly AGENT_ID = 'dependency_intelligence_001';
  private db: Database;

  constructor(communicationBus: A2ACommunicationBus, db: Database) {
    const capabilities: A2ACapabilities = {
      methods: [
        'research_libraries',
        'scan_vulnerabilities',
        'analyze_licenses',
        'dependency_intelligence_analysis'
      ],
      domains: [A2AAgentDomain.SECURITY],
      maxConcurrentRequests: 5,
      supportedProtocolVersion: '1.0',
      features: [
        'library_research',
        'vulnerability_scanning',
        'license_analysis'
      ]
    };

    super(
      'DependencyIntelligenceAgent',
      A2AAgentDomain.SECURITY,
      capabilities,
      7,
      communicationBus
    );

    this.db = db;
    console.log('🔬 DependencyIntelligenceAgent: Initialized with ArangoDB connection');
  }

  // =====================================================
  // CORE ANALYSIS
  // =====================================================

  protected async performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    console.log(`🔬 DependencyIntelligenceAgent: Analyzing ${request.type}`);
    const startTime = Date.now();

    try {
      const repoId = request.repoId || request.entityKey;
      if (!repoId) {
        return this.createErrorResult(request, new Error('repoId or entityKey is required'));
      }

      console.log(`🔍 Performing dependency intelligence analysis for repo: ${repoId}`);

      // Phase 1: Gather intelligence on all packages
      const projectLicense = request.parameters?.projectLicense || 'MIT';
      const packageIntel = await this.gatherPackageIntelligence(repoId, projectLicense);

      // Phase 2: Produce findings
      const findings: IntelligenceFinding[] = [];
      findings.push(...this.generateMaintenanceFindings(packageIntel));
      findings.push(...this.generateVulnerabilityFindings(packageIntel));
      findings.push(...this.generateLicenseFindings(packageIntel, projectLicense));
      findings.push(...this.generateUnscannedFindings(packageIntel));

      // Phase 3: Produce recommendations
      const recommendations: Recommendation[] = [];
      recommendations.push(...this.generateRecommendations(findings, packageIntel, projectLicense));

      const intelScore = this.calculateIntelligenceScore(packageIntel);

      return {
        requestId: request.id,
        agentId: this.id,
        domain: this.domain,
        timestamp: Date.now(),
        status: 'success',
        confidence: packageIntel.length > 0 ? 0.85 : 0.5,
        findings: findings as Finding[],
        recommendations,
        metrics: {
          intelligenceScore: intelScore,
          totalPackagesAnalyzed: packageIntel.length,
          deprecatedPackages: packageIntel.filter(p => p.maintenanceStatus === 'deprecated').length,
          inactivePackages: packageIntel.filter(p => p.maintenanceStatus === 'inactive').length,
          vulnerablePackages: packageIntel.filter(p => p.vulnerabilities > 0).length,
          restrictiveLicenses: packageIntel.filter(p => p.licenseCompatibility === 'restrictive').length,
          unscannedPackages: packageIntel.filter(p => !p.inHealthCollection).length
        },
        businessImpact: this.generateBusinessImpact(findings as Finding[], request.businessContext),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ DependencyIntelligenceAgent: Analysis failed:', error);
      return this.createErrorResult(request, error);
    }
  }

  // =====================================================
  // DATA GATHERING (AQL QUERIES)
  // =====================================================

  private async gatherPackageIntelligence(
    repoId: string,
    projectLicense: string
  ): Promise<PackageIntel[]> {
    // Query 1: Get all external dependencies for the repo
    let externalDeps: any[] = [];
    try {
      const depCursor = await this.db.query(
        `FOR dep IN external_dependencies
           FILTER dep.repoId == @repoId OR dep.repository == @repoId
           RETURN dep`,
        { repoId }
      );
      externalDeps = await depCursor.all();
    } catch {
      console.warn('🔬 external_dependencies collection not available');
    }

    // Query 2: Get existing health records (already scanned)
    const healthMap = new Map<string, any>();
    try {
      const healthCursor = await this.db.query(
        `FOR h IN dependency_health
           FILTER h.repoId == @repoId OR h.repository == @repoId
           RETURN h`,
        { repoId }
      );
      const healthRecords = await healthCursor.all();
      for (const rec of healthRecords) {
        healthMap.set(rec.packageName || rec.name || rec._key, rec);
      }
    } catch {
      console.warn('🔬 dependency_health collection not available');
    }

    // Query 3: Check package_vulnerabilities collection
    const vulnMap = new Map<string, any[]>();
    try {
      const vulnCursor = await this.db.query(
        `FOR v IN package_vulnerabilities
           FILTER v.repoId == @repoId OR v.repository == @repoId
           COLLECT pkg = (v.packageName || v.name) INTO vulns = v
           RETURN { pkg, vulns }`,
        { repoId }
      );
      const vulnRecords = await vulnCursor.all();
      for (const rec of vulnRecords) {
        if (rec.pkg) vulnMap.set(rec.pkg, rec.vulns);
      }
    } catch {
      console.warn('🔬 package_vulnerabilities collection not available');
    }

    // Build intelligence for each package
    const now = Date.now();
    const intel: PackageIntel[] = [];

    for (const dep of externalDeps) {
      const name = dep.packageName || dep.name || dep._key;
      const version = dep.version || dep.currentVersion || 'unknown';
      const health = healthMap.get(name);
      const vulns = vulnMap.get(name) || [];

      // Determine last publish date and maintenance status
      const lastPublish = health?.lastPublishDate || dep.lastPublishDate || dep.lastModified;
      let daysSincePublish = Infinity;
      if (lastPublish) {
        daysSincePublish = Math.floor((now - new Date(lastPublish).getTime()) / (1000 * 60 * 60 * 24));
      }

      const maintenanceStatus = this.assessMaintenanceStatus(
        daysSincePublish,
        health?.deprecated || dep.deprecated || false
      );

      // Determine license compatibility
      const license = dep.license || health?.license || 'unknown';
      const licenseCompatibility = this.assessLicenseCompatibility(license, projectLicense);

      // Vulnerability data
      const vulnCount = vulns.length || health?.vulnerabilityCount || 0;
      const highestSev = health?.highestSeverity
        || (vulns.length > 0 ? this.getHighestSeverity(vulns) : 'none');

      intel.push({
        name,
        version,
        lastPublish,
        daysSincePublish,
        maintenanceStatus,
        vulnerabilities: vulnCount,
        highestSeverity: highestSev,
        license,
        licenseCompatibility,
        inHealthCollection: !!health
      });
    }

    return intel;
  }

  // =====================================================
  // HEURISTICS
  // =====================================================

  private assessMaintenanceStatus(
    daysSincePublish: number,
    deprecated: boolean
  ): PackageIntel['maintenanceStatus'] {
    if (deprecated) return 'deprecated';
    if (daysSincePublish === Infinity) return 'unknown';
    if (daysSincePublish <= 180) return 'active';       // published in last 6 months
    if (daysSincePublish <= 365) return 'slow';          // published in last year
    return 'inactive';                                    // over a year since last publish
  }

  private assessLicenseCompatibility(
    packageLicense: string,
    projectLicense: string
  ): PackageIntel['licenseCompatibility'] {
    if (!packageLicense || packageLicense === 'unknown') return 'unknown';

    const normalised = packageLicense.trim();

    if (PERMISSIVE_LICENSES.has(normalised)) return 'compatible';
    if (RESTRICTIVE_LICENSES.has(normalised)) {
      // GPL in an MIT/BSD project is restrictive
      if (PERMISSIVE_LICENSES.has(projectLicense)) return 'restrictive';
      return 'compatible'; // GPL project using GPL deps is fine
    }
    return 'unknown';
  }

  private getHighestSeverity(vulns: any[]): string {
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    for (const level of order) {
      if (vulns.some(v => (v.severity || '').toLowerCase() === level)) return level;
    }
    return 'unknown';
  }

  // =====================================================
  // FINDING GENERATORS
  // =====================================================

  private generateMaintenanceFindings(intel: PackageIntel[]): IntelligenceFinding[] {
    const findings: IntelligenceFinding[] = [];

    const deprecated = intel.filter(p => p.maintenanceStatus === 'deprecated');
    if (deprecated.length > 0) {
      findings.push({
        id: `intel_deprecated_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'deprecated_packages',
        severity: 'high',
        title: `${deprecated.length} deprecated packages found in dependency tree`,
        description:
          `${deprecated.length} packages are officially deprecated and should be replaced ` +
          `with maintained alternatives. Deprecated packages no longer receive security patches.`,
        location: { file: 'package.json' },
        evidence: {
          packages: deprecated.slice(0, 10).map(p => ({ name: p.name, version: p.version }))
        },
        confidence: 0.95,
        packageName: deprecated.map(p => p.name).join(', '),
        maintenanceStatus: 'deprecated'
      });
    }

    const inactive = intel.filter(p => p.maintenanceStatus === 'inactive');
    if (inactive.length > 0) {
      findings.push({
        id: `intel_inactive_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'unmaintained_packages',
        severity: 'medium',
        title: `${inactive.length} packages appear unmaintained (no publish in 12+ months)`,
        description:
          `${inactive.length} packages have not been published in over 12 months. ` +
          `While some stable packages intentionally have slow release cadences, others ` +
          `may be abandoned. Evaluate whether alternatives exist.`,
        location: { file: 'package.json' },
        evidence: {
          packages: inactive.slice(0, 10).map(p => ({
            name: p.name,
            version: p.version,
            daysSincePublish: p.daysSincePublish
          }))
        },
        confidence: 0.75,
        packageName: inactive.map(p => p.name).join(', '),
        maintenanceStatus: 'inactive'
      });
    }

    return findings;
  }

  private generateVulnerabilityFindings(intel: PackageIntel[]): IntelligenceFinding[] {
    const findings: IntelligenceFinding[] = [];

    const vulnerable = intel.filter(p => p.vulnerabilities > 0);
    if (vulnerable.length > 0) {
      const critical = vulnerable.filter(p => p.highestSeverity === 'critical');

      for (const pkg of critical.slice(0, 5)) {
        findings.push({
          id: `intel_vuln_${pkg.name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: 'critical_vulnerability',
          severity: 'critical',
          title: `${pkg.name}@${pkg.version} has critical vulnerabilities`,
          description:
            `Package ${pkg.name} at version ${pkg.version} has ${pkg.vulnerabilities} known ` +
            `vulnerabilities including at least one critical-severity issue.`,
          location: { file: 'package.json' },
          evidence: {
            package: pkg.name,
            version: pkg.version,
            vulnerabilities: pkg.vulnerabilities,
            highestSeverity: pkg.highestSeverity
          },
          confidence: 0.95,
          packageName: pkg.name,
          packageVersion: pkg.version
        });
      }
    }

    return findings;
  }

  private generateLicenseFindings(
    intel: PackageIntel[],
    projectLicense: string
  ): IntelligenceFinding[] {
    const findings: IntelligenceFinding[] = [];

    const restrictive = intel.filter(p => p.licenseCompatibility === 'restrictive');
    if (restrictive.length > 0) {
      findings.push({
        id: `intel_license_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'license_incompatibility',
        severity: 'high',
        title: `${restrictive.length} packages have restrictive licenses incompatible with ${projectLicense}`,
        description:
          `${restrictive.length} packages use copyleft or restrictive licenses (e.g. GPL, AGPL) ` +
          `while the project is licensed under ${projectLicense}. This may create legal ` +
          `obligations or distribution restrictions.`,
        location: { file: 'package.json' },
        evidence: {
          projectLicense,
          restrictivePackages: restrictive.slice(0, 10).map(p => ({
            name: p.name,
            license: p.license
          }))
        },
        confidence: 0.9,
        packageName: restrictive.map(p => p.name).join(', '),
        licenseType: restrictive.map(p => p.license).join(', '),
        licenseCompatibility: 'restrictive'
      });
    }

    const unknown = intel.filter(p => p.licenseCompatibility === 'unknown' && p.license === 'unknown');
    if (unknown.length > 0) {
      findings.push({
        id: `intel_license_unknown_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'unknown_license',
        severity: 'low',
        title: `${unknown.length} packages have no detectable license`,
        description:
          `${unknown.length} packages do not have a detectable license field. Using ` +
          `packages without a clear license can create legal uncertainty.`,
        location: { file: 'package.json' },
        evidence: {
          packages: unknown.slice(0, 10).map(p => p.name)
        },
        confidence: 0.7,
        packageName: unknown.map(p => p.name).join(', '),
        licenseCompatibility: 'unknown'
      });
    }

    return findings;
  }

  private generateUnscannedFindings(intel: PackageIntel[]): IntelligenceFinding[] {
    const findings: IntelligenceFinding[] = [];

    const unscanned = intel.filter(p => !p.inHealthCollection);
    if (unscanned.length > 0) {
      findings.push({
        id: `intel_unscanned_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'unscanned_packages',
        severity: 'info',
        title: `${unscanned.length} packages have not been health-scanned yet`,
        description:
          `${unscanned.length} packages in external_dependencies do not have corresponding ` +
          `records in the dependency_health collection. Running the health scanner will ` +
          `provide vulnerability and maintenance data for these packages.`,
        location: { file: 'package.json' },
        evidence: {
          unscannedCount: unscanned.length,
          packages: unscanned.slice(0, 15).map(p => p.name)
        },
        confidence: 0.99,
        packageName: unscanned.map(p => p.name).join(', ')
      });
    }

    return findings;
  }

  // =====================================================
  // RECOMMENDATION GENERATORS
  // =====================================================

  private generateRecommendations(
    findings: IntelligenceFinding[],
    intel: PackageIntel[],
    projectLicense: string
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const findingIds = findings.map(f => f.id);

    // Recommendation 1: Replace deprecated packages
    const deprecated = intel.filter(p => p.maintenanceStatus === 'deprecated');
    if (deprecated.length > 0) {
      recommendations.push({
        id: `intel_rec_deprecated_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'dependency_replacement',
        priority: 'high',
        title: 'Replace deprecated packages with maintained alternatives',
        description:
          `${deprecated.length} deprecated packages should be replaced before they become ` +
          `security liabilities. Check each package's deprecation notice for recommended replacements.`,
        impact: 'Eliminates risk from unmaintained code in the dependency tree',
        effort: deprecated.length > 5 ? 'high' : 'medium',
        implementation: [
          ...deprecated.slice(0, 5).map(p =>
            `Replace ${p.name}@${p.version} with its recommended successor`),
          'Check npm deprecation messages for migration guidance',
          'Run full test suite after each replacement to verify compatibility'
        ],
        relatedFindings: findingIds.filter(id => id.includes('deprecated')),
        estimatedValue: 85,
        businessJustification:
          'Deprecated packages are a ticking clock -- they stop receiving fixes but attackers keep finding exploits.'
      });
    }

    // Recommendation 2: Resolve license conflicts
    const restrictive = intel.filter(p => p.licenseCompatibility === 'restrictive');
    if (restrictive.length > 0) {
      recommendations.push({
        id: `intel_rec_license_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'license_compliance',
        priority: 'high',
        title: `Resolve license conflicts with the project's ${projectLicense} license`,
        description:
          `${restrictive.length} packages use restrictive licenses that may conflict with ` +
          `the project's ${projectLicense} license. Consult legal counsel or replace ` +
          `these packages with permissively-licensed alternatives.`,
        impact: 'Ensures legal compliance for distribution and commercial use',
        effort: 'medium',
        implementation: [
          ...restrictive.slice(0, 5).map(p =>
            `Evaluate ${p.name} (${p.license}) -- find an MIT/Apache-2.0 alternative or get legal clearance`),
          'Add a license checker to CI (e.g. license-checker, licensee, fossa)',
          'Document any accepted license exceptions in LICENSES.md'
        ],
        relatedFindings: findingIds.filter(id => id.includes('license')),
        estimatedValue: 90,
        businessJustification:
          'License non-compliance can result in forced open-sourcing of proprietary code or legal action.'
      });
    }

    // Recommendation 3: Run health scans on unscanned packages
    const unscanned = intel.filter(p => !p.inHealthCollection);
    if (unscanned.length > 0) {
      recommendations.push({
        id: `intel_rec_scan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'process_improvement',
        priority: 'medium',
        title: 'Run dependency health scanner to populate missing package data',
        description:
          `${unscanned.length} packages lack health data. Running the ingestion pipeline's ` +
          `health scanner will populate vulnerability, maintenance, and license data for ` +
          `more complete analysis.`,
        impact: 'Enables full visibility into dependency risk',
        effort: 'low',
        implementation: [
          'Trigger the dependency health scan for this repository',
          'Verify that the dependency_health collection is populated',
          'Re-run this agent after scanning completes for updated findings'
        ],
        relatedFindings: findingIds.filter(id => id.includes('unscanned')),
        estimatedValue: 70,
        businessJustification:
          'You cannot manage what you cannot measure. Full dependency visibility is the foundation of supply-chain security.'
      });
    }

    return recommendations;
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private calculateIntelligenceScore(intel: PackageIntel[]): number {
    if (intel.length === 0) return 90;

    let score = 100;

    const deprecated = intel.filter(p => p.maintenanceStatus === 'deprecated').length;
    const inactive = intel.filter(p => p.maintenanceStatus === 'inactive').length;
    const vulnerable = intel.filter(p => p.vulnerabilities > 0).length;
    const restrictive = intel.filter(p => p.licenseCompatibility === 'restrictive').length;

    score -= Math.min(deprecated * 10, 30);
    score -= Math.min(inactive * 3, 15);
    score -= Math.min(vulnerable * 8, 30);
    score -= Math.min(restrictive * 7, 20);

    return Math.max(10, Math.round(score));
  }

  private createErrorResult(request: AnalysisRequest, error: any): AnalysisResult {
    return {
      requestId: request.id,
      agentId: this.id,
      domain: this.domain,
      timestamp: Date.now(),
      status: 'failed',
      confidence: 0,
      findings: [],
      recommendations: [],
      metrics: { error: error instanceof Error ? error.message : String(error) }
    };
  }

  // =====================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // =====================================================

  protected async shouldJoinCollaboration(context: A2AContext): Promise<boolean> {
    const relevant = [
      'dependency', 'vulnerability', 'license', 'supply_chain',
      'package', 'security', 'compliance'
    ];
    const contextString = JSON.stringify(context).toLowerCase();
    return relevant.some(keyword => contextString.includes(keyword));
  }

  protected async evaluateProposal(proposal: any): Promise<boolean> {
    return proposal.securityImpact !== 'negative' && proposal.licenseImpact !== 'negative';
  }

  protected async generateVoteReasoning(proposal: any, vote: boolean): Promise<string> {
    return vote
      ? 'Dependency intelligence analysis supports this proposal as it improves supply-chain security.'
      : 'Dependency intelligence concerns identified. This proposal may introduce risky or improperly licensed dependencies.';
  }

  protected shouldAcceptKnowledge(knowledge: any, sourceAgent: string): boolean {
    const topics = [
      'vulnerability', 'license', 'dependency', 'supply_chain',
      'package', 'deprecated', 'maintenance'
    ];
    return topics.some(topic => knowledge.topic?.includes(topic));
  }
}

export { IntelligenceFinding };
