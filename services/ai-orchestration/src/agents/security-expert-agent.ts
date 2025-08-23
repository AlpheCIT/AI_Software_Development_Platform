// 🛡️ Security Expert Agent - Inspired by CCI Framework
// Advanced security analysis capabilities for code intelligence

import { Database } from 'arangojs';

export interface SecurityAnalysisResult {
  vulnerability_assessment: {
    critical_vulnerabilities: SecurityVulnerability[];
    medium_vulnerabilities: SecurityVulnerability[];
    low_vulnerabilities: SecurityVulnerability[];
    overall_risk_score: number;
  };
  threat_analysis: {
    threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    attack_vectors: string[];
    exploitability_score: number;
    business_impact: string;
  };
  security_recommendations: SecurityRecommendation[];
  compliance_assessment: {
    frameworks: string[];
    violations: ComplianceViolation[];
    compliance_score: number;
  };
}

export interface SecurityVulnerability {
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cwe_id?: string;
  cvss_score?: number;
  file_path: string;
  line_number?: number;
  evidence: string;
  remediation: string;
}

export interface SecurityRecommendation {
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  implementation_effort: 'LOW' | 'MEDIUM' | 'HIGH';
  business_justification: string;
}

export interface ComplianceViolation {
  framework: string;
  rule_id: string;
  description: string;
  severity: string;
  remediation_guidance: string;
}

export class SecurityExpertAgent {
  private db: Database;
  private agentId: string;
  private expertise: string[];
  private confidence: number = 0.0;

  constructor(database: Database) {
    this.db = database;
    this.agentId = 'security_expert_001';
    this.expertise = [
      'vulnerability_analysis',
      'threat_modeling',
      'security_patterns',
      'compliance_assessment',
      'secure_coding_practices',
      'authentication_security',
      'data_protection',
      'cryptographic_analysis'
    ];
  }

  // ===== CORE SECURITY ANALYSIS METHODS =====

  async analyzeSecurityVulnerabilities(entityId: string): Promise<SecurityAnalysisResult> {
    console.log(`🛡️ Security Expert Agent analyzing entity: ${entityId}`);

    try {
      // Get entity and related code
      const entity = await this.getEntityDetails(entityId);
      if (!entity) {
        throw new Error(`Entity ${entityId} not found`);
      }

      // Perform comprehensive security analysis
      const vulnerabilityAssessment = await this.performVulnerabilityAssessment(entity);
      const threatAnalysis = await this.performThreatAnalysis(entity);
      const securityRecommendations = await this.generateSecurityRecommendations(entity, vulnerabilityAssessment);
      const complianceAssessment = await this.assessCompliance(entity);

      const result: SecurityAnalysisResult = {
        vulnerability_assessment: vulnerabilityAssessment,
        threat_analysis: threatAnalysis,
        security_recommendations: securityRecommendations,
        compliance_assessment: complianceAssessment
      };

      // Store analysis results
      await this.storeAnalysisResults(entityId, result);

      console.log(`✅ Security analysis completed for ${entityId}`);
      return result;

    } catch (error) {
      console.error(`❌ Security analysis failed for ${entityId}:`, error);
      throw error;
    }
  }

  async assessThreatLevel(entityId: string): Promise<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> {
    console.log(`🎯 Assessing threat level for entity: ${entityId}`);

    try {
      const entity = await this.getEntityDetails(entityId);
      if (!entity) return 'LOW';

      let threatScore = 0;

      // Check for high-risk patterns
      threatScore += this.analyzeDangerousPatterns(entity);
      threatScore += this.analyzeDataExposure(entity);
      threatScore += this.analyzeAuthenticationIssues(entity);
      threatScore += this.analyzeInputValidation(entity);
      threatScore += this.analyzeCryptographicUsage(entity);

      // Determine threat level based on score
      if (threatScore >= 80) return 'CRITICAL';
      if (threatScore >= 60) return 'HIGH';
      if (threatScore >= 30) return 'MEDIUM';
      return 'LOW';

    } catch (error) {
      console.error(`❌ Threat level assessment failed:`, error);
      return 'LOW';
    }
  }

  async generateSecurityRecommendations(
    entity: any, 
    vulnerabilityAssessment?: any
  ): Promise<SecurityRecommendation[]> {
    console.log(`📋 Generating security recommendations for entity`);

    const recommendations: SecurityRecommendation[] = [];

    try {
      // Analyze code patterns for security recommendations
      const codeContent = entity.source_code || '';
      const entityName = entity.name || '';
      const filePath = entity.file_path || '';

      // Authentication & Authorization
      if (this.hasAuthenticationCode(codeContent, entityName)) {
        recommendations.push({
          category: 'Authentication',
          priority: 'HIGH',
          title: 'Implement Multi-Factor Authentication',
          description: 'Consider implementing MFA for enhanced security',
          implementation_effort: 'MEDIUM',
          business_justification: 'Reduces account takeover risks by 99.9%'
        });
      }

      // Input Validation
      if (this.hasUserInput(codeContent)) {
        recommendations.push({
          category: 'Input Validation',
          priority: 'HIGH',
          title: 'Enhance Input Validation',
          description: 'Implement comprehensive input sanitization and validation',
          implementation_effort: 'MEDIUM',
          business_justification: 'Prevents injection attacks and data corruption'
        });
      }

      // Data Protection
      if (this.handlesSensitiveData(codeContent, entityName)) {
        recommendations.push({
          category: 'Data Protection',
          priority: 'CRITICAL',
          title: 'Implement Data Encryption',
          description: 'Encrypt sensitive data at rest and in transit',
          implementation_effort: 'HIGH',
          business_justification: 'Ensures compliance and protects customer data'
        });
      }

      // Logging & Monitoring
      if (this.lacksSecurityLogging(codeContent)) {
        recommendations.push({
          category: 'Monitoring',
          priority: 'MEDIUM',
          title: 'Add Security Event Logging',
          description: 'Implement comprehensive security event logging',
          implementation_effort: 'LOW',
          business_justification: 'Enables threat detection and compliance auditing'
        });
      }

      // Error Handling
      if (this.hasInsecureErrorHandling(codeContent)) {
        recommendations.push({
          category: 'Error Handling',
          priority: 'MEDIUM',
          title: 'Secure Error Handling',
          description: 'Implement secure error handling without information disclosure',
          implementation_effort: 'LOW',
          business_justification: 'Prevents information leakage to attackers'
        });
      }

      console.log(`✅ Generated ${recommendations.length} security recommendations`);
      return recommendations;

    } catch (error) {
      console.error(`❌ Failed to generate security recommendations:`, error);
      return [];
    }
  }

  // ===== VULNERABILITY ASSESSMENT METHODS =====

  private async performVulnerabilityAssessment(entity: any): Promise<any> {
    const vulnerabilities = {
      critical_vulnerabilities: [],
      medium_vulnerabilities: [],
      low_vulnerabilities: [],
      overall_risk_score: 0
    };

    const codeContent = entity.source_code || '';
    const filePath = entity.file_path || '';

    // SQL Injection Detection
    if (this.hasSQLInjectionRisk(codeContent)) {
      vulnerabilities.critical_vulnerabilities.push({
        type: 'SQL Injection',
        description: 'Potential SQL injection vulnerability detected',
        severity: 'CRITICAL' as const,
        cwe_id: 'CWE-89',
        cvss_score: 9.8,
        file_path: filePath,
        evidence: 'Dynamic SQL construction without parameterization',
        remediation: 'Use parameterized queries or ORM with proper escaping'
      });
    }

    // XSS Detection
    if (this.hasXSSRisk(codeContent)) {
      vulnerabilities.medium_vulnerabilities.push({
        type: 'Cross-Site Scripting (XSS)',
        description: 'Potential XSS vulnerability in user input handling',
        severity: 'MEDIUM' as const,
        cwe_id: 'CWE-79',
        cvss_score: 6.1,
        file_path: filePath,
        evidence: 'User input rendered without proper encoding',
        remediation: 'Implement proper output encoding and Content Security Policy'
      });
    }

    // Hardcoded Credentials
    if (this.hasHardcodedCredentials(codeContent)) {
      vulnerabilities.critical_vulnerabilities.push({
        type: 'Hardcoded Credentials',
        description: 'Hardcoded credentials or API keys detected',
        severity: 'CRITICAL' as const,
        cwe_id: 'CWE-798',
        cvss_score: 9.8,
        file_path: filePath,
        evidence: 'Potential credentials found in source code',
        remediation: 'Move credentials to secure configuration or environment variables'
      });
    }

    // Calculate overall risk score
    const criticalCount = vulnerabilities.critical_vulnerabilities.length;
    const mediumCount = vulnerabilities.medium_vulnerabilities.length;
    const lowCount = vulnerabilities.low_vulnerabilities.length;
    
    vulnerabilities.overall_risk_score = (criticalCount * 10) + (mediumCount * 5) + (lowCount * 1);

    return vulnerabilities;
  }

  private async performThreatAnalysis(entity: any): Promise<any> {
    const codeContent = entity.source_code || '';
    const entityName = entity.name || '';

    const attackVectors = [];
    let exploitabilityScore = 0;
    let businessImpact = 'Low';

    // Identify attack vectors
    if (this.hasNetworkExposure(codeContent, entityName)) {
      attackVectors.push('Network-based attacks');
      exploitabilityScore += 30;
    }

    if (this.hasUserInput(codeContent)) {
      attackVectors.push('Input-based attacks');
      exploitabilityScore += 25;
    }

    if (this.hasFileOperations(codeContent)) {
      attackVectors.push('File system attacks');
      exploitabilityScore += 20;
    }

    if (this.hasAuthenticationCode(codeContent, entityName)) {
      attackVectors.push('Authentication bypass');
      exploitabilityScore += 35;
      businessImpact = 'High';
    }

    // Determine threat level
    let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (exploitabilityScore >= 80) threatLevel = 'CRITICAL';
    else if (exploitabilityScore >= 60) threatLevel = 'HIGH';
    else if (exploitabilityScore >= 30) threatLevel = 'MEDIUM';

    return {
      threat_level: threatLevel,
      attack_vectors: attackVectors,
      exploitability_score: exploitabilityScore,
      business_impact: businessImpact
    };
  }

  private async assessCompliance(entity: any): Promise<any> {
    const frameworks = ['OWASP', 'CWE', 'NIST'];
    const violations = [];
    let complianceScore = 100;

    const codeContent = entity.source_code || '';

    // OWASP Top 10 checks
    if (this.hasSQLInjectionRisk(codeContent)) {
      violations.push({
        framework: 'OWASP',
        rule_id: 'A03:2021',
        description: 'Injection vulnerability detected',
        severity: 'HIGH',
        remediation_guidance: 'Implement parameterized queries and input validation'
      });
      complianceScore -= 20;
    }

    if (this.hasInsecureAuthentication(codeContent)) {
      violations.push({
        framework: 'OWASP',
        rule_id: 'A07:2021',
        description: 'Identification and Authentication Failures',
        severity: 'HIGH',
        remediation_guidance: 'Implement strong authentication mechanisms'
      });
      complianceScore -= 15;
    }

    return {
      frameworks: frameworks,
      violations: violations,
      compliance_score: Math.max(0, complianceScore)
    };
  }

  // ===== SECURITY PATTERN DETECTION METHODS =====

  private hasSQLInjectionRisk(code: string): boolean {
    const sqlInjectionPatterns = [
      /query\s*\+\s*['"]/i,
      /execute\s*\([^)]*\+[^)]*\)/i,
      /\$\{.*\}.*SELECT/i,
      /string\s*\+.*WHERE/i,
      /concat\s*\(.*SELECT/i
    ];
    
    return sqlInjectionPatterns.some(pattern => pattern.test(code));
  }

  private hasXSSRisk(code: string): boolean {
    const xssPatterns = [
      /innerHTML\s*=\s*[^;]*\+/i,
      /document\.write\s*\([^)]*\+/i,
      /\$\{.*\}.*html/i,
      /dangerouslySetInnerHTML/i,
      /eval\s*\(/i
    ];
    
    return xssPatterns.some(pattern => pattern.test(code));
  }

  private hasHardcodedCredentials(code: string): boolean {
    const credentialPatterns = [
      /password\s*=\s*['"]/i,
      /api[_-]?key\s*=\s*['"]/i,
      /secret\s*=\s*['"]/i,
      /token\s*=\s*['"][^'"]{10,}/i,
      /auth[_-]?token\s*=\s*['"]/i
    ];
    
    return credentialPatterns.some(pattern => pattern.test(code));
  }

  private hasAuthenticationCode(code: string, name: string): boolean {
    const authPatterns = [
      /login|auth|signin|authenticate/i,
      /password|credential|token/i,
      /session|cookie|jwt/i
    ];
    
    return authPatterns.some(pattern => 
      pattern.test(code) || pattern.test(name)
    );
  }

  private hasUserInput(code: string): boolean {
    const inputPatterns = [
      /request\.|req\./i,
      /input|form|params/i,
      /query|body|headers/i,
      /\$_GET|\$_POST/i,
      /req\.body|req\.query|req\.params/i
    ];
    
    return inputPatterns.some(pattern => pattern.test(code));
  }

  private handlesSensitiveData(code: string, name: string): boolean {
    const sensitivePatterns = [
      /ssn|social.security/i,
      /credit.card|payment|billing/i,
      /personal|pii|sensitive/i,
      /health|medical|hipaa/i,
      /financial|bank|account/i
    ];
    
    return sensitivePatterns.some(pattern => 
      pattern.test(code) || pattern.test(name)
    );
  }

  private lacksSecurityLogging(code: string): boolean {
    const loggingPatterns = [
      /log|audit|monitor/i,
      /console\.|logger\./i,
      /winston|bunyan|pino/i
    ];
    
    const hasAuthCode = this.hasAuthenticationCode(code, '');
    const hasLogging = loggingPatterns.some(pattern => pattern.test(code));
    
    return hasAuthCode && !hasLogging;
  }

  private hasInsecureErrorHandling(code: string): boolean {
    const insecureErrorPatterns = [
      /catch\s*\([^)]*\)\s*\{[^}]*throw/i,
      /error\s*\.\s*message/i,
      /stack\s*trace/i,
      /console\.error\([^)]*error\)/i
    ];
    
    return insecureErrorPatterns.some(pattern => pattern.test(code));
  }

  private hasNetworkExposure(code: string, name: string): boolean {
    const networkPatterns = [
      /http|https|api|endpoint/i,
      /server|express|fastify/i,
      /route|middleware/i,
      /cors|origin/i
    ];
    
    return networkPatterns.some(pattern => 
      pattern.test(code) || pattern.test(name)
    );
  }

  private hasFileOperations(code: string): boolean {
    const filePatterns = [
      /fs\.|file|read|write/i,
      /upload|download|path/i,
      /readFile|writeFile|createStream/i
    ];
    
    return filePatterns.some(pattern => pattern.test(code));
  }

  private hasInsecureAuthentication(code: string): boolean {
    const insecureAuthPatterns = [
      /password.*==.*['"][^'"]*['"]/i,
      /auth.*===.*['"]admin['"]/i,
      /if.*user.*==.*['"]root['"]/i,
      /authenticate.*return.*true/i
    ];
    
    return insecureAuthPatterns.some(pattern => pattern.test(code));
  }

  // ===== THREAT SCORING METHODS =====

  private analyzeDangerousPatterns(entity: any): number {
    const code = entity.source_code || '';
    let score = 0;

    if (this.hasSQLInjectionRisk(code)) score += 25;
    if (this.hasXSSRisk(code)) score += 20;
    if (this.hasHardcodedCredentials(code)) score += 30;
    if (this.hasInsecureAuthentication(code)) score += 25;

    return score;
  }

  private analyzeDataExposure(entity: any): number {
    const code = entity.source_code || '';
    const name = entity.name || '';
    let score = 0;

    if (this.handlesSensitiveData(code, name)) score += 20;
    if (this.hasInsecureErrorHandling(code)) score += 15;
    if (this.lacksSecurityLogging(code)) score += 10;

    return score;
  }

  private analyzeAuthenticationIssues(entity: any): number {
    const code = entity.source_code || '';
    const name = entity.name || '';
    let score = 0;

    if (this.hasAuthenticationCode(code, name)) {
      if (this.hasInsecureAuthentication(code)) score += 30;
      if (this.hasHardcodedCredentials(code)) score += 25;
    }

    return score;
  }

  private analyzeInputValidation(entity: any): number {
    const code = entity.source_code || '';
    let score = 0;

    if (this.hasUserInput(code)) {
      if (this.hasSQLInjectionRisk(code)) score += 20;
      if (this.hasXSSRisk(code)) score += 15;
    }

    return score;
  }

  private analyzeCryptographicUsage(entity: any): number {
    const code = entity.source_code || '';
    let score = 0;

    const weakCryptoPatterns = [
      /md5|sha1/i,
      /des|rc4/i,
      /Math\.random/i
    ];

    if (weakCryptoPatterns.some(pattern => pattern.test(code))) {
      score += 15;
    }

    return score;
  }

  // ===== DATABASE OPERATIONS =====

  private async getEntityDetails(entityId: string): Promise<any> {
    try {
      const query = `
        FOR entity IN code_entities
          FILTER entity._key == @entityId
          RETURN entity
      `;
      
      const result = await this.db.query(query, { entityId });
      return await result.next();
    } catch (error) {
      console.error(`❌ Failed to get entity details:`, error);
      return null;
    }
  }

  private async storeAnalysisResults(entityId: string, results: SecurityAnalysisResult): Promise<void> {
    try {
      const analysisDoc = {
        entity_id: entityId,
        agent_id: this.agentId,
        analysis_type: 'security_analysis',
        results: results,
        confidence_score: this.confidence,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      await this.db.collection('doc_agent_analyses').save(analysisDoc);
      console.log(`✅ Security analysis results stored for entity ${entityId}`);
    } catch (error) {
      console.error(`❌ Failed to store analysis results:`, error);
    }
  }

  // ===== AGENT INTERFACE METHODS (CCI Framework Compatibility) =====

  getId(): string {
    return this.agentId;
  }

  getExpertise(): string[] {
    return this.expertise;
  }

  getConfidence(): number {
    return this.confidence;
  }

  async initialize(): Promise<void> {
    console.log(`🛡️ Initializing Security Expert Agent ${this.agentId}...`);
    this.confidence = 0.85; // High confidence in security analysis
    console.log(`✅ Security Expert Agent initialized with confidence: ${this.confidence}`);
  }

  async processEntity(entityId: string): Promise<any> {
    return await this.analyzeSecurityVulnerabilities(entityId);
  }

  getCapabilities(): string[] {
    return [
      'vulnerability_assessment',
      'threat_level_analysis',
      'security_recommendations',
      'compliance_assessment',
      'security_pattern_detection',
      'risk_scoring'
    ];
  }
}

export default SecurityExpertAgent;
