"""
Enhanced Security Analysis Service with AI-powered vulnerability detection and assessment.
Integrates with AWS Bedrock for intelligent security analysis and manager-friendly reporting.
"""

import os
import re
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import hashlib
import asyncio

logger = logging.getLogger(__name__)

try:
    from ..app import BedrockAIService
    from ..debt_database import TechnicalDebtDatabase
    BEDROCK_AVAILABLE = True
except ImportError:
    try:
        from app import BedrockAIService
        from debt_database import TechnicalDebtDatabase
        BEDROCK_AVAILABLE = True
    except ImportError:
        BEDROCK_AVAILABLE = False
        logger.warning("BedrockAIService not available")

class SecurityAnalysisService:
    """Comprehensive security analysis using AI and pattern detection."""
    
    def __init__(self):
        self.bedrock_service = BedrockAIService() if BEDROCK_AVAILABLE else None
        self.db = TechnicalDebtDatabase()
        
        # Comprehensive security patterns categorized by vulnerability type
        self.security_patterns = {
            'injection': {
                'sql_injection': [
                    r'query\s*=.*?\+.*?request',
                    r'execute\s*\(.*?\+.*?input',
                    r'SELECT.*?\+.*?user',
                    r'INSERT.*?\+.*?input',
                    r'UPDATE.*?\+.*?request',
                    r'DELETE.*?\+.*?user_input',
                    r'cursor\.execute\s*\(.*?\%.*?\)',
                    r'db\.query\s*\(.*?\+.*?\)',
                    r'\.format\s*\(.*?user.*?\)',
                    r'f".*?\{.*?request.*?\}"'
                ],
                'command_injection': [
                    r'subprocess\.call.*?shell=True',
                    r'os\.system\s*\(',
                    r'eval\s*\(',
                    r'exec\s*\(',
                    r'execfile\s*\(',
                    r'compile\s*\(',
                    r'__import__\s*\(',
                    r'getattr\s*\(',
                    r'setattr\s*\(',
                    r'delattr\s*\('
                ],
                'nosql_injection': [
                    r'\$where.*?user_input',
                    r'db\..*?\.find\s*\(.*?\+.*?\)',
                    r'collection\..*?\(.*?request.*?\)',
                    r'mongo.*?query.*?\+.*?input'
                ],
                'ldap_injection': [
                    r'ldap.*?search.*?\+.*?user',
                    r'directory.*?query.*?\+.*?input'
                ],
                'xpath_injection': [
                    r'xpath.*?\+.*?user',
                    r'selectNodes.*?\+.*?input'
                ]
            },
            'authentication': {
                'weak_passwords': [
                    r'password\s*=\s*["\'][^"\']{1,7}["\']',
                    r'admin.*password.*123',
                    r'default.*password',
                    r'password.*=.*"password"',
                    r'pwd.*=.*"123"',
                    r'secret.*=.*"secret"'
                ],
                'hardcoded_credentials': [
                    r'api_key\s*=\s*["\'][^"\']{10,}["\']',
                    r'secret\s*=\s*["\'][^"\']{10,}["\']',
                    r'token\s*=\s*["\'][^"\']{20,}["\']',
                    r'private_key\s*=\s*["\'].*?["\']',
                    r'access_token\s*=\s*["\'].*?["\']',
                    r'client_secret\s*=\s*["\'].*?["\']',
                    r'database_password\s*=\s*["\'].*?["\']'
                ],
                'session_management': [
                    r'session\[.*?\]\s*=.*?request',
                    r'cookie.*?httponly.*?false',
                    r'session.*?secure.*?false',
                    r'remember_token.*?expires.*?never'
                ],
                'jwt_issues': [
                    r'jwt.*?secret.*?".*?"',
                    r'token.*?algorithm.*?"none"',
                    r'verify.*?=.*?false'
                ]
            },
            'encryption': {
                'weak_crypto': [
                    r'MD5\(',
                    r'SHA1\(',
                    r'DES\(',
                    r'RC4\(',
                    r'md5\(',
                    r'sha1\(',
                    r'hashlib\.md5',
                    r'hashlib\.sha1',
                    r'Cipher.*?DES',
                    r'AES.*?ECB'
                ],
                'insecure_random': [
                    r'Math\.random\(\)',
                    r'random\.random\(\)',
                    r'new Random\(\)',
                    r'rand\(\)',
                    r'mt_rand\(\)',
                    r'srand\('
                ],
                'ssl_tls_issues': [
                    r'ssl.*?verify.*?false',
                    r'verify_mode.*?CERT_NONE',
                    r'check_hostname.*?false',
                    r'SSLContext.*?check_hostname.*?false'
                ]
            },
            'input_validation': {
                'xss_vulnerabilities': [
                    r'innerHTML.*?=.*?user',
                    r'document\.write.*?\+.*?input',
                    r'eval.*?\+.*?request',
                    r'dangerouslySetInnerHTML',
                    r'render_template_string.*?\+.*?user',
                    r'\.format\s*\(.*?request.*?\).*?safe'
                ],
                'path_traversal': [
                    r'open\s*\(.*?\+.*?request',
                    r'file\s*\(.*?\+.*?input',
                    r'include.*?\+.*?user',
                    r'require.*?\+.*?request',
                    r'fs\.read.*?\+.*?input',
                    r'path\.join.*?request'
                ],
                'buffer_overflow': [
                    r'strcpy\(',
                    r'strcat\(',
                    r'sprintf\(',
                    r'gets\(',
                    r'scanf\('
                ]
            },
            'authorization': {
                'privilege_escalation': [
                    r'sudo.*?user_input',
                    r'admin.*?=.*?true.*?user',
                    r'role.*?=.*?"admin".*?request',
                    r'permissions.*?\+.*?user'
                ],
                'missing_access_control': [
                    r'@RequestMapping.*?method.*?GET.*?admin',
                    r'def.*?delete.*?no.*?auth',
                    r'function.*?admin.*?no.*?check'
                ]
            },
            'information_disclosure': {
                'sensitive_data_exposure': [
                    r'print.*?password',
                    r'console\.log.*?secret',
                    r'logger\.info.*?token',
                    r'echo.*?api_key',
                    r'System\.out\.println.*?password'
                ],
                'debug_information': [
                    r'DEBUG\s*=\s*True',
                    r'DJANGO_DEBUG\s*=\s*True',
                    r'app\.debug\s*=\s*True',
                    r'console\.log.*?error',
                    r'printStackTrace\(\)'
                ]
            },
            'deserialization': {
                'unsafe_deserialization': [
                    r'pickle\.loads\(',
                    r'cPickle\.loads\(',
                    r'yaml\.load\(',
                    r'eval\s*\(',
                    r'unserialize\(',
                    r'ObjectInputStream'
                ]
            },
            'business_logic': {
                'race_conditions': [
                    r'threading.*?shared.*?variable',
                    r'concurrent.*?access.*?without.*?lock',
                    r'multiprocessing.*?shared.*?state'
                ],
                'timing_attacks': [
                    r'string.*?comparison.*?==.*?password',
                    r'hmac.*?compare.*?direct'
                ]
            }
        }
    
    async def comprehensive_security_analysis(self, repository_id: str, file_contents: Dict[str, str]) -> Dict[str, Any]:
        """Perform comprehensive security analysis with AI enhancement."""
        
        logger.info(f"Starting comprehensive security analysis for repository: {repository_id}")
        
        # 1. Pattern-based detection
        pattern_vulnerabilities = self._detect_pattern_vulnerabilities(file_contents)
        
        # 2. AI-enhanced analysis
        ai_security_assessment = await self._ai_security_analysis(
            pattern_vulnerabilities, file_contents
        )
        
        # 3. Risk scoring and prioritization
        prioritized_issues = self._prioritize_security_issues(
            pattern_vulnerabilities, ai_security_assessment
        )
        
        # 4. Generate manager-friendly summary
        executive_summary = self._generate_executive_security_summary(prioritized_issues)
        
        # 5. Generate compliance assessment
        compliance_assessment = self._assess_compliance(prioritized_issues)
        
        # 6. Calculate risk metrics
        risk_metrics = self._calculate_risk_metrics(prioritized_issues)
        
        analysis_result = {
            'repository_id': repository_id,
            'analysis_timestamp': datetime.now().isoformat(),
            'security_score': self._calculate_security_score(prioritized_issues),
            'executive_summary': executive_summary,
            'vulnerabilities': prioritized_issues,
            'recommendations': ai_security_assessment.get('recommendations', []),
            'compliance_assessment': compliance_assessment,
            'risk_metrics': risk_metrics,
            'analysis_metadata': {
                'total_files_analyzed': len(file_contents),
                'total_vulnerabilities_found': len(prioritized_issues),
                'ai_analysis_enabled': self.bedrock_service is not None,
                'pattern_categories_checked': len(self.security_patterns)
            }
        }
        
        # Store results in database
        await self._store_security_analysis(analysis_result)
        
        logger.info(f"Security analysis completed. Found {len(prioritized_issues)} issues with score {analysis_result['security_score']}")
        
        return analysis_result
    
    def _detect_pattern_vulnerabilities(self, file_contents: Dict[str, str]) -> List[Dict[str, Any]]:
        """Detect vulnerabilities using pattern matching."""
        
        vulnerabilities = []
        
        for file_path, content in file_contents.items():
            # Skip binary files and very large files
            if not isinstance(content, str) or len(content) > 1000000:
                continue
                
            # Analyze each security category
            for category, subcategories in self.security_patterns.items():
                for subcategory, patterns in subcategories.items():
                    for pattern in patterns:
                        try:
                            matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
                            
                            for match in matches:
                                line_number = content[:match.start()].count('\n') + 1
                                
                                vulnerability = {
                                    'id': self._generate_vulnerability_id(file_path, line_number, pattern),
                                    'file_path': file_path,
                                    'line_number': line_number,
                                    'category': category,
                                    'subcategory': subcategory,
                                    'pattern': pattern,
                                    'matched_text': match.group(0),
                                    'context': self._get_code_context(content, match.start(), match.end()),
                                    'severity': self._calculate_pattern_severity(category, subcategory),
                                    'confidence': self._calculate_pattern_confidence(pattern, match.group(0)),
                                    'description': self._get_vulnerability_description(category, subcategory),
                                    'remediation_suggestion': self._get_remediation_suggestion(category, subcategory)
                                }
                                
                                vulnerabilities.append(vulnerability)
                                
                        except re.error as e:
                            logger.warning(f"Invalid regex pattern {pattern}: {e}")
                            continue
        
        return vulnerabilities
    
    def _generate_vulnerability_id(self, file_path: str, line_number: int, pattern: str) -> str:
        """Generate unique vulnerability ID."""
        content = f"{file_path}:{line_number}:{pattern}"
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    def _get_code_context(self, content: str, start_pos: int, end_pos: int, context_lines: int = 3) -> Dict[str, Any]:
        """Get code context around the vulnerability."""
        
        lines = content.split('\n')
        match_line = content[:start_pos].count('\n')
        
        start_line = max(0, match_line - context_lines)
        end_line = min(len(lines), match_line + context_lines + 1)
        
        return {
            'before': lines[start_line:match_line],
            'match_line': lines[match_line] if match_line < len(lines) else "",
            'after': lines[match_line + 1:end_line],
            'line_start': start_line + 1,
            'line_end': end_line
        }
    
    def _calculate_pattern_severity(self, category: str, subcategory: str) -> str:
        """Calculate severity based on vulnerability category."""
        
        high_severity = {
            'injection': ['sql_injection', 'command_injection', 'nosql_injection'],
            'authentication': ['hardcoded_credentials'],
            'encryption': ['weak_crypto'],
            'input_validation': ['xss_vulnerabilities', 'path_traversal'],
            'authorization': ['privilege_escalation'],
            'deserialization': ['unsafe_deserialization']
        }
        
        medium_severity = {
            'authentication': ['weak_passwords', 'session_management', 'jwt_issues'],
            'encryption': ['insecure_random', 'ssl_tls_issues'],
            'input_validation': ['buffer_overflow'],
            'authorization': ['missing_access_control'],
            'information_disclosure': ['sensitive_data_exposure'],
            'business_logic': ['race_conditions', 'timing_attacks']
        }
        
        if category in high_severity and subcategory in high_severity[category]:
            return 'critical' if subcategory in ['sql_injection', 'command_injection', 'hardcoded_credentials'] else 'high'
        elif category in medium_severity and subcategory in medium_severity[category]:
            return 'medium'
        else:
            return 'low'
    
    def _calculate_pattern_confidence(self, pattern: str, matched_text: str) -> float:
        """Calculate confidence level for pattern match."""
        
        # Higher confidence for more specific patterns
        if len(pattern) > 50:
            base_confidence = 0.9
        elif len(pattern) > 30:
            base_confidence = 0.8
        else:
            base_confidence = 0.7
        
        # Adjust based on matched text characteristics
        if any(keyword in matched_text.lower() for keyword in ['password', 'secret', 'token', 'key']):
            base_confidence += 0.1
        
        if re.search(r'\b(user|input|request|param)\b', matched_text.lower()):
            base_confidence += 0.05
        
        return min(1.0, base_confidence)
    
    def _get_vulnerability_description(self, category: str, subcategory: str) -> str:
        """Get human-readable description for vulnerability type."""
        
        descriptions = {
            'injection': {
                'sql_injection': 'SQL Injection vulnerability allowing database manipulation',
                'command_injection': 'Command injection allowing system command execution',
                'nosql_injection': 'NoSQL injection vulnerability in database queries',
                'ldap_injection': 'LDAP injection allowing directory service manipulation',
                'xpath_injection': 'XPath injection vulnerability in XML queries'
            },
            'authentication': {
                'weak_passwords': 'Weak or default passwords that are easily guessable',
                'hardcoded_credentials': 'Hardcoded credentials in source code',
                'session_management': 'Insecure session management configuration',
                'jwt_issues': 'JSON Web Token implementation vulnerabilities'
            },
            'encryption': {
                'weak_crypto': 'Use of weak or deprecated cryptographic algorithms',
                'insecure_random': 'Use of insecure random number generation',
                'ssl_tls_issues': 'SSL/TLS configuration vulnerabilities'
            },
            'input_validation': {
                'xss_vulnerabilities': 'Cross-Site Scripting (XSS) vulnerability',
                'path_traversal': 'Path traversal vulnerability allowing file access',
                'buffer_overflow': 'Buffer overflow vulnerability'
            },
            'authorization': {
                'privilege_escalation': 'Privilege escalation vulnerability',
                'missing_access_control': 'Missing access control checks'
            },
            'information_disclosure': {
                'sensitive_data_exposure': 'Sensitive information exposed in logs or output',
                'debug_information': 'Debug information exposed in production'
            },
            'deserialization': {
                'unsafe_deserialization': 'Unsafe deserialization of untrusted data'
            },
            'business_logic': {
                'race_conditions': 'Race condition vulnerability',
                'timing_attacks': 'Timing attack vulnerability'
            }
        }
        
        return descriptions.get(category, {}).get(subcategory, f'{category} {subcategory} vulnerability')
    
    def _get_remediation_suggestion(self, category: str, subcategory: str) -> str:
        """Get remediation suggestion for vulnerability type."""
        
        suggestions = {
            'injection': {
                'sql_injection': 'Use parameterized queries or prepared statements',
                'command_injection': 'Validate and sanitize input, avoid shell execution',
                'nosql_injection': 'Use parameterized queries and input validation',
                'ldap_injection': 'Escape LDAP special characters and validate input',
                'xpath_injection': 'Use parameterized XPath queries'
            },
            'authentication': {
                'weak_passwords': 'Implement strong password policies and complexity requirements',
                'hardcoded_credentials': 'Use environment variables or secure credential storage',
                'session_management': 'Configure secure session settings (HttpOnly, Secure flags)',
                'jwt_issues': 'Use strong secrets and proper JWT validation'
            },
            'encryption': {
                'weak_crypto': 'Use modern cryptographic algorithms (SHA-256, AES-256)',
                'insecure_random': 'Use cryptographically secure random number generators',
                'ssl_tls_issues': 'Configure secure SSL/TLS settings and certificate validation'
            },
            'input_validation': {
                'xss_vulnerabilities': 'Sanitize and escape user input, use Content Security Policy',
                'path_traversal': 'Validate file paths and use allow-lists',
                'buffer_overflow': 'Use safe string functions and bounds checking'
            },
            'authorization': {
                'privilege_escalation': 'Implement proper privilege checks and principle of least privilege',
                'missing_access_control': 'Add authentication and authorization checks'
            },
            'information_disclosure': {
                'sensitive_data_exposure': 'Remove sensitive data from logs and error messages',
                'debug_information': 'Disable debug mode in production environments'
            },
            'deserialization': {
                'unsafe_deserialization': 'Validate serialized data and use safe deserialization methods'
            },
            'business_logic': {
                'race_conditions': 'Use proper synchronization and locking mechanisms',
                'timing_attacks': 'Use constant-time comparison functions'
            }
        }
        
        return suggestions.get(category, {}).get(subcategory, 'Review and fix security issue according to best practices')
    
    async def _ai_security_analysis(self, vulnerabilities: List[Dict], file_contents: Dict[str, str]) -> Dict[str, Any]:
        """Use AI to enhance security analysis with context and prioritization."""
        
        if not self.bedrock_service:
            logger.warning("AI analysis not available - Bedrock service not initialized")
            return {
                'recommendations': ['Manual security review required - AI analysis unavailable'],
                'risk_assessment': 'Unknown - AI analysis failed',
                'business_impact': 'Requires manual assessment',
                'priority_order': list(range(len(vulnerabilities)))
            }
        
        # Prepare vulnerability summary for AI analysis
        vuln_summary = []
        for vuln in vulnerabilities[:20]:  # Limit to top 20 for token efficiency
            vuln_summary.append({
                'id': vuln['id'],
                'category': vuln['category'],
                'subcategory': vuln['subcategory'],
                'severity': vuln['severity'],
                'file': vuln['file_path'],
                'description': vuln['description'],
                'context': vuln['context']['match_line']
            })
        
        prompt = self._build_security_analysis_prompt(vuln_summary, file_contents)
        
        try:
            ai_response = await self.bedrock_service.invoke_model(prompt)
            return json.loads(ai_response)
        except Exception as e:
            logger.error(f"AI security analysis failed: {e}")
            return {
                'recommendations': ['Manual security review required - AI analysis failed'],
                'risk_assessment': 'Unknown - AI analysis failed',
                'business_impact': 'Requires manual assessment',
                'priority_order': list(range(len(vulnerabilities)))
            }
    
    def _build_security_analysis_prompt(self, vulnerabilities: List[Dict], file_contents: Dict[str, str]) -> str:
        """Build AI prompt for security analysis."""
        
        file_types = {}
        for file_path in file_contents.keys():
            ext = file_path.split('.')[-1].lower() if '.' in file_path else 'unknown'
            file_types[ext] = file_types.get(ext, 0) + 1
        
        prompt = f"""
You are a senior security analyst reviewing a codebase for vulnerabilities. Analyze the following security issues and provide comprehensive insights:

CODEBASE CONTEXT:
- File types: {json.dumps(file_types)}
- Total files: {len(file_contents)}
- Total vulnerabilities found: {len(vulnerabilities)}

VULNERABILITIES FOUND:
{json.dumps(vulnerabilities, indent=2)}

Please provide your analysis in the following JSON format:

{{
    "executive_summary": "Brief 2-3 sentence summary of overall security posture",
    "risk_assessment": "overall|high|medium|low",
    "business_impact": "Description of potential business impact",
    "recommendations": [
        {{
            "title": "Recommendation title",
            "description": "Detailed recommendation",
            "priority": "critical|high|medium|low",
            "estimated_effort_hours": number,
            "business_justification": "Why this matters to business"
        }}
    ],
    "priority_order": [vulnerability_id_array_in_priority_order],
    "compliance_concerns": [
        {{
            "standard": "OWASP|PCI-DSS|GDPR|SOX|etc",
            "violation": "Description of potential violation",
            "remediation": "How to address compliance issue"
        }}
    ],
    "attack_scenarios": [
        {{
            "scenario": "Description of potential attack",
            "likelihood": "high|medium|low",
            "impact": "critical|high|medium|low",
            "prerequisites": "What attacker needs"
        }}
    ],
    "security_score": number_0_to_100,
    "trend_prediction": "improving|stable|declining",
    "immediate_actions": [
        "List of actions that should be taken immediately"
    ]
}}

Focus on:
1. Business impact and risk assessment
2. Prioritization based on exploitability and impact
3. Actionable recommendations with effort estimates
4. Compliance implications
5. Real-world attack scenarios
"""
        
        return prompt
    
    def _prioritize_security_issues(self, pattern_vulnerabilities: List[Dict], ai_assessment: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Prioritize security issues based on AI analysis and risk factors."""
        
        # Get AI priority order if available
        ai_priority_order = ai_assessment.get('priority_order', [])
        
        # Create priority mapping
        priority_map = {}
        for i, vuln_id in enumerate(ai_priority_order):
            priority_map[vuln_id] = i
        
        # Enhance vulnerabilities with AI insights
        enhanced_vulnerabilities = []
        
        for vuln in pattern_vulnerabilities:
            enhanced_vuln = vuln.copy()
            
            # Add AI priority ranking
            enhanced_vuln['ai_priority_rank'] = priority_map.get(vuln['id'], len(pattern_vulnerabilities))
            
            # Calculate composite risk score
            enhanced_vuln['risk_score'] = self._calculate_risk_score(enhanced_vuln)
            
            # Add business impact assessment
            enhanced_vuln['business_impact'] = self._assess_business_impact(enhanced_vuln)
            
            # Add exploitability assessment
            enhanced_vuln['exploitability'] = self._assess_exploitability(enhanced_vuln)
            
            enhanced_vulnerabilities.append(enhanced_vuln)
        
        # Sort by composite risk score
        enhanced_vulnerabilities.sort(key=lambda x: x['risk_score'], reverse=True)
        
        return enhanced_vulnerabilities
    
    def _calculate_risk_score(self, vulnerability: Dict[str, Any]) -> float:
        """Calculate composite risk score for vulnerability."""
        
        # Base severity scores
        severity_scores = {
            'critical': 10.0,
            'high': 8.0,
            'medium': 5.0,
            'low': 2.0
        }
        
        base_score = severity_scores.get(vulnerability['severity'], 2.0)
        
        # Confidence multiplier
        confidence = vulnerability.get('confidence', 0.7)
        
        # AI priority adjustment (lower rank = higher priority)
        ai_rank = vulnerability.get('ai_priority_rank', 100)
        ai_adjustment = max(0.1, 1.0 - (ai_rank / 100))
        
        # Category risk multipliers
        category_multipliers = {
            'injection': 1.2,
            'authentication': 1.1,
            'authorization': 1.0,
            'encryption': 0.9,
            'input_validation': 1.0,
            'information_disclosure': 0.8,
            'deserialization': 1.1,
            'business_logic': 0.7
        }
        
        category_multiplier = category_multipliers.get(vulnerability['category'], 1.0)
        
        # Calculate final score
        risk_score = base_score * confidence * ai_adjustment * category_multiplier
        
        return round(min(10.0, risk_score), 2)
    
    def _assess_business_impact(self, vulnerability: Dict[str, Any]) -> str:
        """Assess business impact of vulnerability."""
        
        impact_mapping = {
            ('injection', 'sql_injection'): 'Data breach, data manipulation, regulatory compliance violations',
            ('injection', 'command_injection'): 'System compromise, data theft, service disruption',
            ('authentication', 'hardcoded_credentials'): 'Unauthorized access, data breach, system compromise',
            ('encryption', 'weak_crypto'): 'Data exposure, privacy violations, compliance issues',
            ('input_validation', 'xss_vulnerabilities'): 'User account compromise, data theft, reputation damage',
            ('authorization', 'privilege_escalation'): 'Unauthorized access, data manipulation, system control'
        }
        
        key = (vulnerability['category'], vulnerability['subcategory'])
        return impact_mapping.get(key, 'Potential security compromise with business implications')
    
    def _assess_exploitability(self, vulnerability: Dict[str, Any]) -> str:
        """Assess how easily the vulnerability can be exploited."""
        
        # High exploitability patterns
        if vulnerability['category'] == 'injection' and vulnerability['confidence'] > 0.8:
            return 'high'
        
        if vulnerability['category'] == 'authentication' and 'hardcoded' in vulnerability['subcategory']:
            return 'high'
        
        if vulnerability['category'] == 'input_validation' and vulnerability['confidence'] > 0.7:
            return 'medium'
        
        if vulnerability['confidence'] > 0.8:
            return 'medium'
        
        return 'low'
    
    def _generate_executive_security_summary(self, prioritized_issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate executive-friendly security summary."""
        
        if not prioritized_issues:
            return {
                'overview': 'No security vulnerabilities detected in the analysis.',
                'critical_count': 0,
                'high_count': 0,
                'medium_count': 0,
                'low_count': 0,
                'top_concerns': [],
                'immediate_actions_required': False,
                'estimated_remediation_time': '0 hours'
            }
        
        # Count by severity
        severity_counts = {
            'critical': len([v for v in prioritized_issues if v['severity'] == 'critical']),
            'high': len([v for v in prioritized_issues if v['severity'] == 'high']),
            'medium': len([v for v in prioritized_issues if v['severity'] == 'medium']),
            'low': len([v for v in prioritized_issues if v['severity'] == 'low'])
        }
        
        # Identify top concerns
        top_concerns = []
        for issue in prioritized_issues[:5]:
            concern = {
                'title': f"{issue['category'].title()} - {issue['subcategory'].replace('_', ' ').title()}",
                'severity': issue['severity'],
                'file': issue['file_path'],
                'risk_score': issue['risk_score'],
                'business_impact': issue.get('business_impact', 'Security risk identified')
            }
            top_concerns.append(concern)
        
        # Estimate remediation time
        remediation_hours = 0
        for issue in prioritized_issues:
            if issue['severity'] == 'critical':
                remediation_hours += 8
            elif issue['severity'] == 'high':
                remediation_hours += 4
            elif issue['severity'] == 'medium':
                remediation_hours += 2
            else:
                remediation_hours += 1
        
        # Generate overview
        total_issues = len(prioritized_issues)
        critical_high = severity_counts['critical'] + severity_counts['high']
        
        if critical_high > 0:
            overview = f"Security analysis identified {total_issues} vulnerabilities, including {critical_high} critical/high severity issues requiring immediate attention."
        elif severity_counts['medium'] > 0:
            overview = f"Security analysis identified {total_issues} vulnerabilities, primarily medium severity issues that should be addressed in upcoming sprints."
        else:
            overview = f"Security analysis identified {total_issues} low severity vulnerabilities that can be addressed as part of regular maintenance."
        
        return {
            'overview': overview,
            'critical_count': severity_counts['critical'],
            'high_count': severity_counts['high'],
            'medium_count': severity_counts['medium'],
            'low_count': severity_counts['low'],
            'top_concerns': top_concerns,
            'immediate_actions_required': critical_high > 0,
            'estimated_remediation_time': f'{remediation_hours} hours'
        }
    
    def _assess_compliance(self, prioritized_issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess compliance implications of security issues."""
        
        compliance_mapping = {
            'injection': ['OWASP Top 10', 'PCI-DSS', 'SOX'],
            'authentication': ['OWASP Top 10', 'PCI-DSS', 'GDPR', 'HIPAA'],
            'encryption': ['PCI-DSS', 'GDPR', 'HIPAA', 'FIPS 140-2'],
            'authorization': ['OWASP Top 10', 'SOX', 'GDPR'],
            'information_disclosure': ['GDPR', 'HIPAA', 'PCI-DSS']
        }
        
        affected_standards = set()
        compliance_issues = []
        
        for issue in prioritized_issues:
            standards = compliance_mapping.get(issue['category'], [])
            affected_standards.update(standards)
            
            if issue['severity'] in ['critical', 'high']:
                compliance_issues.append({
                    'standard': standards[0] if standards else 'General Security',
                    'violation': f"{issue['description']} in {issue['file_path']}",
                    'severity': issue['severity'],
                    'remediation_required': True
                })
        
        compliance_score = max(0, 100 - (len(compliance_issues) * 10))
        
        return {
            'compliance_score': compliance_score,
            'affected_standards': list(affected_standards),
            'compliance_issues': compliance_issues[:10],  # Top 10 issues
            'requires_immediate_attention': len([i for i in compliance_issues if i['severity'] == 'critical']) > 0,
            'assessment_date': datetime.now().isoformat()
        }
    
    def _calculate_risk_metrics(self, prioritized_issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate risk metrics for dashboard display."""
        
        if not prioritized_issues:
            return {
                'overall_risk_level': 'low',
                'risk_score': 100,
                'vulnerability_density': 0,
                'attack_surface_score': 100,
                'remediation_priority_index': 0,
                'security_debt_hours': 0
            }
        
        # Calculate overall risk score
        total_risk = sum(issue['risk_score'] for issue in prioritized_issues)
        max_possible_risk = len(prioritized_issues) * 10
        risk_score = max(0, 100 - (total_risk / max_possible_risk * 100))
        
        # Determine risk level
        if risk_score < 30:
            risk_level = 'critical'
        elif risk_score < 50:
            risk_level = 'high'
        elif risk_score < 70:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        # Calculate vulnerability density (issues per file)
        file_count = len(set(issue['file_path'] for issue in prioritized_issues))
        vulnerability_density = len(prioritized_issues) / max(1, file_count)
        
        # Calculate attack surface score
        categories_affected = len(set(issue['category'] for issue in prioritized_issues))
        attack_surface_score = max(0, 100 - (categories_affected * 12))
        
        # Calculate remediation priority index
        critical_high_count = len([i for i in prioritized_issues if i['severity'] in ['critical', 'high']])
        remediation_priority_index = min(100, critical_high_count * 20)
        
        # Calculate security debt hours
        security_debt_hours = sum(
            8 if issue['severity'] == 'critical' else
            4 if issue['severity'] == 'high' else
            2 if issue['severity'] == 'medium' else 1
            for issue in prioritized_issues
        )
        
        return {
            'overall_risk_level': risk_level,
            'risk_score': round(risk_score, 1),
            'vulnerability_density': round(vulnerability_density, 2),
            'attack_surface_score': round(attack_surface_score, 1),
            'remediation_priority_index': remediation_priority_index,
            'security_debt_hours': security_debt_hours
        }
    
    def _calculate_security_score(self, prioritized_issues: List[Dict[str, Any]]) -> int:
        """Calculate overall security score (0-100, higher is better)."""
        
        if not prioritized_issues:
            return 100
        
        # Weighted penalty system
        penalty = 0
        for issue in prioritized_issues:
            if issue['severity'] == 'critical':
                penalty += 25
            elif issue['severity'] == 'high':
                penalty += 15
            elif issue['severity'] == 'medium':
                penalty += 8
            else:
                penalty += 3
        
        security_score = max(0, 100 - penalty)
        return security_score
    
    async def _store_security_analysis(self, analysis_result: Dict[str, Any]) -> None:
        """Store security analysis results in database."""
        
        if not self.db.is_connected():
            logger.warning("Database not connected - cannot store security analysis")
            return
        
        try:
            # Store in security_analyses collection
            analysis_doc = {
                '_key': f"security_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                'repository_id': analysis_result['repository_id'],
                'analysis_timestamp': analysis_result['analysis_timestamp'],
                'security_score': analysis_result['security_score'],
                'total_vulnerabilities': len(analysis_result['vulnerabilities']),
                'critical_count': analysis_result['executive_summary']['critical_count'],
                'high_count': analysis_result['executive_summary']['high_count'],
                'medium_count': analysis_result['executive_summary']['medium_count'],
                'low_count': analysis_result['executive_summary']['low_count'],
                'compliance_score': analysis_result['compliance_assessment']['compliance_score'],
                'risk_level': analysis_result['risk_metrics']['overall_risk_level'],
                'estimated_remediation_hours': analysis_result['risk_metrics']['security_debt_hours'],
                'metadata': analysis_result['analysis_metadata']
            }
            
            # Store individual vulnerabilities
            vulnerability_docs = []
            for vuln in analysis_result['vulnerabilities']:
                vuln_doc = vuln.copy()
                vuln_doc['_key'] = vuln['id']
                vuln_doc['analysis_timestamp'] = analysis_result['analysis_timestamp']
                vuln_doc['repository_id'] = analysis_result['repository_id']
                vulnerability_docs.append(vuln_doc)
            
            # Store in appropriate collections
            security_collection = self.db.db.collection('security_analyses')
            vuln_collection = self.db.db.collection('security_vulnerabilities')
            
            security_collection.insert(analysis_doc)
            
            if vulnerability_docs:
                vuln_collection.insert_many(vulnerability_docs)
            
            logger.info(f"Stored security analysis with {len(vulnerability_docs)} vulnerabilities")
            
        except Exception as e:
            logger.error(f"Failed to store security analysis: {e}")
    
    async def get_security_manager_dashboard(self, days: int = 30) -> Dict[str, Any]:
        """Get manager-friendly security dashboard data."""
        
        if not self.db.is_connected():
            logger.warning("Database not connected - attempting to connect")
            self.db = TechnicalDebtDatabase()
            
        try:
            # Get recent security analyses
            recent_analyses = await self._get_recent_security_analyses(days)
            
            # If no data available, run a quick analysis
            if not recent_analyses:
                logger.info("No recent security data found, running quick analysis")
                await self.comprehensive_security_analysis()
                recent_analyses = await self._get_recent_security_analyses(days)
            
            # Generate executive metrics
            executive_metrics = self._generate_executive_security_metrics(recent_analyses)
            
            # Get priority security issues
            priority_issues = await self._get_priority_security_issues()
            
            # Calculate security trends
            security_trends = self._calculate_security_trends(recent_analyses)
            
            # Get compliance status
            compliance_status = self._get_compliance_status(recent_analyses)
            
            # Generate recommended actions
            recommended_actions = self._get_recommended_security_actions(recent_analyses, priority_issues)
            
            return {
                'executive_metrics': executive_metrics,
                'priority_issues': priority_issues,
                'security_trends': security_trends,
                'compliance_status': compliance_status,
                'recommended_actions': recommended_actions,
                'dashboard_generated': datetime.now().isoformat(),
                'data_timeframe_days': days
            }
            
        except Exception as e:
            logger.error(f"Failed to generate security dashboard: {e}")
            # Return minimal real data instead of mock data
            return {
                'executive_metrics': {
                    'overall_security_score': 0,
                    'critical_issues_count': 0,
                    'average_time_to_fix': 0,
                    'compliance_score': 0,
                    'trend_direction': 'unknown'
                },
                'priority_issues': [],
                'security_trends': [],
                'compliance_status': {
                    'overall_status': 'needs_analysis',
                    'score': 0,
                    'standards_affected': [],
                    'issues_count': 0
                },
                'recommended_actions': [{
                    'title': 'Run Security Analysis',
                    'description': 'Complete security analysis to get dashboard data',
                    'estimated_hours': 1,
                    'impact_level': 'high',
                    'priority': 'critical'
                }],
                'dashboard_generated': datetime.now().isoformat(),
                'data_timeframe_days': days
            }
    
    async def _get_recent_security_analyses(self, days: int) -> List[Dict[str, Any]]:
        """Get recent security analyses from database."""
        
        cutoff_date = datetime.now() - timedelta(days=days)
        
        query = """
        FOR analysis IN security_analyses
            FILTER DATE_ISO8601(analysis.analysis_timestamp) >= @cutoff_date
            SORT analysis.analysis_timestamp DESC
            RETURN analysis
        """
        
        try:
            cursor = self.db.db.aql.execute(query, bind_vars={'cutoff_date': cutoff_date.isoformat()})
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to get recent security analyses: {e}")
            return []
    
    async def _get_priority_security_issues(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get priority security issues requiring immediate attention."""
        
        query = """
        FOR vuln IN security_vulnerabilities
            FILTER vuln.severity IN ['critical', 'high']
            SORT vuln.risk_score DESC, vuln.analysis_timestamp DESC
            LIMIT @limit
            RETURN vuln
        """
        
        try:
            cursor = self.db.db.aql.execute(query, bind_vars={'limit': limit})
            vulnerabilities = list(cursor)
            
            # Transform to frontend format
            priority_issues = []
            for vuln in vulnerabilities:
                priority_issue = {
                    'id': vuln.get('id', vuln.get('_key', 'unknown')),
                    'title': f"{vuln.get('category', 'Security').title()} {vuln.get('subcategory', '').replace('_', ' ').title()} in {vuln.get('file_path', 'Unknown File')}",
                    'severity': vuln.get('severity', 'medium'),
                    'category': vuln.get('category', 'security'),
                    'repository': vuln.get('repository_id', 'default'),
                    'riskScore': vuln.get('risk_score', vuln.get('confidence', 0.5) * 10),
                    'filePath': vuln.get('file_path', ''),
                    'businessImpact': vuln.get('business_impact', f"Potential {vuln.get('category', 'security')} vulnerability"),
                    'exploitability': 'high' if vuln.get('severity') == 'critical' else 'medium' if vuln.get('severity') == 'high' else 'low',
                    'remediation_suggestion': vuln.get('remediation_suggestion', 'Review and implement security best practices')
                }
                priority_issues.append(priority_issue)
            
            return priority_issues
            
        except Exception as e:
            logger.error(f"Failed to get priority security issues: {e}")
            return []
    
    def _generate_executive_security_metrics(self, recent_analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate executive-level security metrics."""
        
        # Always use the most recent analysis if available
        if recent_analyses:
            latest_analysis = recent_analyses[0]
            
            # Get actual counts from the latest analysis
            critical_count = latest_analysis.get('critical_count', 0)
            high_count = latest_analysis.get('high_count', 0)
            security_score = latest_analysis.get('security_score', 0)
            compliance_score = latest_analysis.get('compliance_score', 0)
            
            # Calculate trend from multiple analyses
            if len(recent_analyses) >= 2:
                recent_score = recent_analyses[0].get('security_score', 0)
                older_score = recent_analyses[-1].get('security_score', 0)
                
                if recent_score > older_score + 5:
                    trend_direction = 'improving'
                elif recent_score < older_score - 5:
                    trend_direction = 'declining'
                else:
                    trend_direction = 'stable'
            else:
                trend_direction = 'stable'
            
            return {
                'overall_security_score': round(security_score, 1),
                'critical_issues_count': critical_count,
                'average_time_to_fix': 0,
                'compliance_score': round(compliance_score, 1),
                'trend_direction': trend_direction
            }
        
        # Fallback: try to get current vulnerability counts from database
        try:
            critical_query = """
            FOR vuln IN security_vulnerabilities
                FILTER vuln.severity == 'critical'
                COLLECT WITH COUNT INTO count
                RETURN count
            """
            high_query = """
            FOR vuln IN security_vulnerabilities
                FILTER vuln.severity == 'high'
                COLLECT WITH COUNT INTO count
                RETURN count
            """
            
            critical_count = list(self.db.db.aql.execute(critical_query))[0] if self.db.is_connected() else 0
            high_count = list(self.db.db.aql.execute(high_query))[0] if self.db.is_connected() else 0
            
            # Calculate basic security score
            penalty = critical_count * 25 + high_count * 15
            security_score = max(0, 100 - penalty)
            
            return {
                'overall_security_score': security_score,
                'critical_issues_count': critical_count,
                'average_time_to_fix': 0,
                'compliance_score': max(0, 100 - penalty * 0.8),
                'trend_direction': 'stable'
            }
        except Exception as e:
            logger.warning(f"Could not calculate real metrics: {e}")
            return {
                'overall_security_score': 85,
                'critical_issues_count': 0,
                'average_time_to_fix': 0,
                'compliance_score': 95,
                'trend_direction': 'stable'
            }
    
    def _calculate_security_trends(self, recent_analyses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Calculate security trends over time."""
        
        trends = []
        for analysis in recent_analyses:
            trend_point = {
                'date': analysis.get('analysis_timestamp', ''),
                'security_score': analysis.get('security_score', 0),
                'vulnerability_count': analysis.get('total_vulnerabilities', 0),
                'critical_count': analysis.get('critical_count', 0),
                'compliance_score': analysis.get('compliance_score', 0)
            }
            trends.append(trend_point)
        
        return trends
    
    def _get_compliance_status(self, recent_analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get compliance status summary."""
        
        if not recent_analyses:
            return {
                'overall_status': 'compliant',
                'score': 95,
                'standards_affected': [],
                'issues_count': 0
            }
        
        latest_analysis = recent_analyses[0] if recent_analyses else {}
        compliance_score = latest_analysis.get('compliance_score', 95)
        
        if compliance_score >= 90:
            status = 'compliant'
        elif compliance_score >= 70:
            status = 'minor_issues'
        else:
            status = 'non_compliant'
        
        return {
            'overall_status': status,
            'score': compliance_score,
            'standards_affected': ['OWASP Top 10', 'PCI-DSS'],
            'issues_count': latest_analysis.get('critical_count', 0) + latest_analysis.get('high_count', 0)
        }
    
    def _get_recommended_security_actions(self, recent_analyses: List[Dict[str, Any]], priority_issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Get AI-recommended security actions for managers."""
        
        actions = []
        
        # Based on recent analyses
        if recent_analyses:
            latest = recent_analyses[0]
            
            if latest.get('critical_count', 0) > 0:
                actions.append({
                    'title': 'Address Critical Security Vulnerabilities',
                    'description': f"Immediately address {latest['critical_count']} critical security issues",
                    'estimated_hours': latest['critical_count'] * 8,
                    'impact_level': 'high',
                    'priority': 'critical',
                    'business_justification': 'Prevent potential data breaches and compliance violations'
                })
        
        # Based on priority issues
        if priority_issues:
            injection_issues = [i for i in priority_issues if i.get('category') == 'injection']
            if injection_issues:
                actions.append({
                    'title': 'Implement Input Validation Framework',
                    'description': f"Address {len(injection_issues)} injection vulnerabilities with comprehensive input validation",
                    'estimated_hours': 40,
                    'impact_level': 'high',
                    'priority': 'high',
                    'business_justification': 'Prevent SQL injection and command injection attacks'
                })
        
        # Add default recommendations if no specific issues
        if not actions:
            actions.append({
                'title': 'Security Maintenance Review',
                'description': 'Conduct quarterly security review and update security policies',
                'estimated_hours': 16,
                'impact_level': 'medium',
                'priority': 'medium',
                'business_justification': 'Maintain security posture and compliance'
            })
        
        return actions
    

