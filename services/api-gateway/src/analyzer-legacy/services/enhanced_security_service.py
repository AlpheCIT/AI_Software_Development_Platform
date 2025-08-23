from typing import Dict, List, Any, Optional
import re
import json
import hashlib
from datetime import datetime
from api.app import BedrockAIService
import logging

logger = logging.getLogger(__name__)

class EnhancedSecurityService:
    """Enhanced security analysis with AI-powered context understanding."""
    
    def __init__(self):
        self.bedrock_service = BedrockAIService()
        
        # Comprehensive security pattern database
        self.security_patterns = {
            'injection': {
                'sql_injection': {
                    'patterns': [
                        r'query\s*=.*?\+.*?(?:request|input|params)',
                        r'execute\s*\(.*?\+.*?(?:user|input|form)',
                        r'SELECT.*?\+.*?(?:user|input|request)',
                        r'INSERT.*?\+.*?(?:user|input|request)',
                        r'UPDATE.*?\+.*?(?:user|input|request)',
                        r'DELETE.*?\+.*?(?:user|input|request)',
                        r'cursor\.execute\s*\(.*?\%.*?\)',
                        r'db\.query\s*\(.*?\+.*?\)'
                    ],
                    'severity': 'critical',
                    'cwe': 'CWE-89',
                    'description': 'SQL Injection vulnerability detected'
                },
                'command_injection': {
                    'patterns': [
                        r'subprocess\.call.*?shell=True',
                        r'os\.system\s*\(',
                        r'os\.popen\s*\(',
                        r'subprocess\.run.*?shell=True',
                        r'exec\s*\(',
                        r'eval\s*\(',
                        r'execfile\s*\(',
                        r'compile\s*\(.*?exec'
                    ],
                    'severity': 'critical',
                    'cwe': 'CWE-78',
                    'description': 'Command injection vulnerability detected'
                },
                'ldap_injection': {
                    'patterns': [
                        r'ldap.*?search.*?\+.*?input',
                        r'ldap.*?filter.*?\+.*?user'
                    ],
                    'severity': 'high',
                    'cwe': 'CWE-90',
                    'description': 'LDAP injection vulnerability detected'
                }
            },
            'authentication': {
                'weak_passwords': {
                    'patterns': [
                        r'password\s*=\s*["\'][^"\']{1,7}["\']',
                        r'pwd\s*=\s*["\'][^"\']{1,7}["\']',
                        r'pass\s*=\s*["\'](?:admin|password|123|test|demo)["\']',
                        r'password.*?(?:admin|password|123456|test)',
                    ],
                    'severity': 'medium',
                    'cwe': 'CWE-521',
                    'description': 'Weak or default password detected'
                },
                'hardcoded_credentials': {
                    'patterns': [
                        r'api_key\s*=\s*["\'][A-Za-z0-9]{20,}["\']',
                        r'secret\s*=\s*["\'][A-Za-z0-9]{20,}["\']',
                        r'token\s*=\s*["\'][A-Za-z0-9]{30,}["\']',
                        r'private_key\s*=\s*["\'].*?["\']',
                        r'SECRET_KEY\s*=\s*["\'].*?["\']',
                        r'AWS_SECRET_ACCESS_KEY\s*=\s*["\'].*?["\']'
                    ],
                    'severity': 'critical',
                    'cwe': 'CWE-798',
                    'description': 'Hardcoded credentials detected'
                },
                'missing_authentication': {
                    'patterns': [
                        r'@app\.route.*?methods=\[.*?POST.*?\](?!.*?@login_required)',
                        r'def.*?(?:delete|update|create).*?\((?!.*?auth)',
                        r'@router\.(?:post|put|delete)(?!.*?dependencies)'
                    ],
                    'severity': 'high',
                    'cwe': 'CWE-306',
                    'description': 'Missing authentication on sensitive endpoint'
                }
            },
            'encryption': {
                'weak_crypto': {
                    'patterns': [
                        r'MD5\s*\(',
                        r'SHA1\s*\(',
                        r'DES\s*\(',
                        r'RC4\s*\(',
                        r'hashlib\.md5',
                        r'hashlib\.sha1',
                        r'Cipher\.DES',
                        r'ARC4\.new'
                    ],
                    'severity': 'high',
                    'cwe': 'CWE-327',
                    'description': 'Weak cryptographic algorithm detected'
                },
                'insecure_random': {
                    'patterns': [
                        r'Math\.random\(\)',
                        r'random\.random\(\)',
                        r'new Random\(\)',
                        r'Random\(\)\.next',
                        r'random\.randint\((?!.*?secrets)'
                    ],
                    'severity': 'medium',
                    'cwe': 'CWE-338',
                    'description': 'Insecure random number generation'
                },
                'missing_encryption': {
                    'patterns': [
                        r'http://(?!localhost|127\.0\.0\.1)',
                        r'ftp://(?!localhost)',
                        r'telnet://',
                        r'smtp://(?!.*?tls)'
                    ],
                    'severity': 'medium',
                    'cwe': 'CWE-319',
                    'description': 'Unencrypted communication detected'
                }
            },
            'xss': {
                'reflected_xss': {
                    'patterns': [
                        r'innerHTML\s*=.*?(?:request|input|params)',
                        r'document\.write\s*\(.*?(?:request|input)',
                        r'eval\s*\(.*?(?:request|input)',
                        r'setTimeout\s*\(.*?(?:request|input)',
                        r'setInterval\s*\(.*?(?:request|input)'
                    ],
                    'severity': 'high',
                    'cwe': 'CWE-79',
                    'description': 'Reflected XSS vulnerability detected'
                },
                'dom_xss': {
                    'patterns': [
                        r'location\.href\s*=.*?(?:request|input)',
                        r'window\.location\s*=.*?(?:request|input)',
                        r'document\.location\s*=.*?(?:request|input)'
                    ],
                    'severity': 'high',
                    'cwe': 'CWE-79',
                    'description': 'DOM-based XSS vulnerability detected'
                }
            },
            'csrf': {
                'missing_csrf_protection': {
                    'patterns': [
                        r'@app\.route.*?methods=\[.*?POST.*?\](?!.*?csrf)',
                        r'@router\.post(?!.*?csrf_protect)',
                        r'form.*?method=["\']post["\'](?!.*?csrf)'
                    ],
                    'severity': 'medium',
                    'cwe': 'CWE-352',
                    'description': 'Missing CSRF protection detected'
                }
            },
            'configuration': {
                'debug_enabled': {
                    'patterns': [
                        r'DEBUG\s*=\s*True',
                        r'debug\s*=\s*True',
                        r'app\.debug\s*=\s*True',
                        r'app\.run\s*\(.*?debug=True'
                    ],
                    'severity': 'medium',
                    'cwe': 'CWE-489',
                    'description': 'Debug mode enabled in production'
                },
                'insecure_permissions': {
                    'patterns': [
                        r'chmod\s*\(\s*0o777',
                        r'chmod\s*\(\s*777',
                        r'os\.chmod.*?0o777',
                        r'subprocess.*?chmod.*?777'
                    ],
                    'severity': 'high',
                    'cwe': 'CWE-732',
                    'description': 'Insecure file permissions detected'
                }
            }
        }
    
    async def comprehensive_security_analysis(self, 
                                            repository_id: str, 
                                            file_contents: Dict[str, str],
                                            enable_ai_analysis: bool = True) -> Dict[str, Any]:
        """Perform comprehensive security analysis with AI enhancement."""
        
        logger.info(f"Starting comprehensive security analysis for repository: {repository_id}")
        
        # Step 1: Pattern-based detection
        pattern_vulnerabilities = self._detect_pattern_vulnerabilities(file_contents)
        
        # Step 2: AI-enhanced analysis (if enabled)
        ai_analysis = {}
        if enable_ai_analysis and pattern_vulnerabilities:
            ai_analysis = await self._ai_enhanced_security_analysis(
                pattern_vulnerabilities, file_contents
            )
        
        # Step 3: Risk scoring and prioritization
        prioritized_vulnerabilities = self._prioritize_vulnerabilities(
            pattern_vulnerabilities, ai_analysis
        )
        
        # Step 4: Generate manager-friendly summary
        executive_summary = self._generate_executive_security_summary(
            prioritized_vulnerabilities, ai_analysis
        )
        
        # Step 5: Calculate security metrics
        security_metrics = self._calculate_security_metrics(prioritized_vulnerabilities)
        
        analysis_result = {
            'repository_id': repository_id,
            'analysis_timestamp': datetime.now().isoformat(),
            'security_score': security_metrics['overall_score'],
            'vulnerability_count': len(prioritized_vulnerabilities),
            'critical_count': security_metrics['critical_count'],
            'high_count': security_metrics['high_count'],
            'medium_count': security_metrics['medium_count'],
            'low_count': security_metrics['low_count'],
            'executive_summary': executive_summary,
            'vulnerabilities': prioritized_vulnerabilities,
            'ai_insights': ai_analysis,
            'security_metrics': security_metrics,
            'compliance_assessment': self._assess_compliance(prioritized_vulnerabilities),
            'recommended_actions': self._generate_recommended_actions(prioritized_vulnerabilities)
        }
        
        logger.info(f"Security analysis completed. Found {len(prioritized_vulnerabilities)} issues.")
        return analysis_result
    
    def _detect_pattern_vulnerabilities(self, file_contents: Dict[str, str]) -> List[Dict[str, Any]]:
        """Detect vulnerabilities using pattern matching."""
        
        vulnerabilities = []
        
        for file_path, content in file_contents.items():
            for category, subcategories in self.security_patterns.items():
                for vulnerability_type, config in subcategories.items():
                    for pattern in config['patterns']:
                        matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
                        
                        for match in matches:
                            line_number = content[:match.start()].count('\n') + 1
                            
                            vulnerability = {
                                'id': hashlib.md5(f"{file_path}:{line_number}:{pattern}".encode()).hexdigest()[:12],
                                'category': category,
                                'type': vulnerability_type,
                                'severity': config['severity'],
                                'cwe': config.get('cwe', 'Unknown'),
                                'description': config['description'],
                                'file_path': file_path,
                                'line_number': line_number,
                                'matched_pattern': pattern,
                                'matched_text': match.group(0),
                                'context': self._extract_context(content, match.start(), match.end()),
                                'discovered_at': datetime.now().isoformat()
                            }
                            
                            vulnerabilities.append(vulnerability)
        
        return vulnerabilities
    
    async def _ai_enhanced_security_analysis(self, 
                                           vulnerabilities: List[Dict[str, Any]], 
                                           file_contents: Dict[str, str]) -> Dict[str, Any]:
        """Use AI to enhance security analysis with context and business impact."""
        
        # Limit to top 10 most critical vulnerabilities for AI analysis
        critical_vulns = sorted(
            vulnerabilities, 
            key=lambda x: {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}.get(x['severity'], 0),
            reverse=True
        )[:10]
        
        prompt = f"""
        Analyze the following security vulnerabilities found in a software repository:

        Vulnerabilities:
        {json.dumps(critical_vulns, indent=2)}

        For each vulnerability, provide:
        1. **Business Impact**: How this could affect the business if exploited
        2. **Exploitability**: How likely and easy it is to exploit (Low/Medium/High)
        3. **Remediation Priority**: Recommended priority (1-5 scale)
        4. **Remediation Effort**: Estimated hours to fix
        5. **Remediation Steps**: Specific technical steps to resolve
        6. **Testing Requirements**: How to verify the fix
        7. **Prevention Measures**: How to prevent similar issues

        Also provide:
        - **Executive Summary**: 2-3 sentence summary for managers
        - **Overall Risk Assessment**: Overall security posture (Low/Medium/High/Critical)
        - **Immediate Actions**: Top 3 actions that should be taken immediately
        - **Long-term Recommendations**: Strategic security improvements
        - **Compliance Impact**: How these issues affect regulatory compliance

        Format response as JSON with structured recommendations.
        """
        
        try:
            ai_response = await self.bedrock_service.invoke_model(prompt)
            return json.loads(ai_response)
        except Exception as e:
            logger.error(f"AI security analysis failed: {e}")
            return {
                'executive_summary': 'AI analysis unavailable - manual review required',
                'overall_risk_assessment': 'Unknown',
                'immediate_actions': ['Manual security review required'],
                'error': str(e)
            }
    
    def _prioritize_vulnerabilities(self, 
                                  vulnerabilities: List[Dict[str, Any]], 
                                  ai_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Prioritize vulnerabilities based on severity and AI insights."""
        
        severity_weights = {'critical': 100, 'high': 75, 'medium': 50, 'low': 25}
        
        for vuln in vulnerabilities:
            base_score = severity_weights.get(vuln['severity'], 25)
            
            # Enhance with AI insights if available
            ai_insights = ai_analysis.get('vulnerability_insights', {})
            vuln_ai_data = ai_insights.get(vuln['id'], {})
            
            if vuln_ai_data:
                exploitability = vuln_ai_data.get('exploitability', 'medium').lower()
                business_impact = vuln_ai_data.get('business_impact_level', 'medium').lower()
                
                exploitability_multiplier = {'low': 0.8, 'medium': 1.0, 'high': 1.3}.get(exploitability, 1.0)
                business_impact_multiplier = {'low': 0.9, 'medium': 1.0, 'high': 1.2}.get(business_impact, 1.0)
                
                vuln['priority_score'] = base_score * exploitability_multiplier * business_impact_multiplier
                vuln['ai_insights'] = vuln_ai_data
            else:
                vuln['priority_score'] = base_score
                vuln['ai_insights'] = {}
        
        # Sort by priority score
        return sorted(vulnerabilities, key=lambda x: x['priority_score'], reverse=True)
    
    def _generate_executive_security_summary(self, 
                                           vulnerabilities: List[Dict[str, Any]], 
                                           ai_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate manager-friendly security summary."""
        
        total_vulns = len(vulnerabilities)
        critical_count = len([v for v in vulnerabilities if v['severity'] == 'critical'])
        high_count = len([v for v in vulnerabilities if v['severity'] == 'high'])
        
        risk_level = 'Low'
        if critical_count > 0:
            risk_level = 'Critical'
        elif high_count > 5:
            risk_level = 'High'
        elif high_count > 0:
            risk_level = 'Medium'
        
        return {
            'overall_risk_level': risk_level,
            'total_vulnerabilities': total_vulns,
            'critical_issues': critical_count,
            'high_priority_issues': high_count,
            'requires_immediate_attention': critical_count > 0 or high_count > 3,
            'estimated_remediation_hours': sum([
                v.get('ai_insights', {}).get('remediation_effort', 4) 
                for v in vulnerabilities[:10]  # Top 10 issues
            ]),
            'business_impact_summary': ai_analysis.get('executive_summary', 
                'Security analysis completed. Please review detailed findings.'),
            'top_categories': self._get_top_vulnerability_categories(vulnerabilities),
            'compliance_risk': self._assess_compliance_risk(vulnerabilities)
        }
    
    def _calculate_security_metrics(self, vulnerabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate comprehensive security metrics."""
        
        total_vulns = len(vulnerabilities)
        critical_count = len([v for v in vulnerabilities if v['severity'] == 'critical'])
        high_count = len([v for v in vulnerabilities if v['severity'] == 'high'])
        medium_count = len([v for v in vulnerabilities if v['severity'] == 'medium'])
        low_count = len([v for v in vulnerabilities if v['severity'] == 'low'])
        
        # Calculate overall security score (0-100, higher is better)
        if total_vulns == 0:
            overall_score = 100
        else:
            # Weighted penalty based on severity
            penalty = (critical_count * 20) + (high_count * 10) + (medium_count * 5) + (low_count * 2)
            overall_score = max(0, 100 - penalty)
        
        return {
            'overall_score': overall_score,
            'total_vulnerabilities': total_vulns,
            'critical_count': critical_count,
            'high_count': high_count,
            'medium_count': medium_count,
            'low_count': low_count,
            'security_grade': self._calculate_security_grade(overall_score),
            'category_breakdown': self._get_category_breakdown(vulnerabilities),
            'trend_indicator': 'stable'  # Would be calculated from historical data
        }
    
    def _extract_context(self, content: str, start: int, end: int, context_lines: int = 3) -> str:
        """Extract context around a vulnerability match."""
        
        lines = content.split('\n')
        match_line = content[:start].count('\n')
        
        start_line = max(0, match_line - context_lines)
        end_line = min(len(lines), match_line + context_lines + 1)
        
        context_lines_list = []
        for i in range(start_line, end_line):
            prefix = ">>> " if i == match_line else "    "
            context_lines_list.append(f"{prefix}{i+1}: {lines[i]}")
        
        return '\n'.join(context_lines_list)
    
    def _get_top_vulnerability_categories(self, vulnerabilities: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
        """Get top vulnerability categories by count."""
        
        category_counts = {}
        for vuln in vulnerabilities:
            category = vuln['category']
            if category not in category_counts:
                category_counts[category] = {'count': 0, 'critical': 0, 'high': 0}
            
            category_counts[category]['count'] += 1
            if vuln['severity'] == 'critical':
                category_counts[category]['critical'] += 1
            elif vuln['severity'] == 'high':
                category_counts[category]['high'] += 1
        
        sorted_categories = sorted(
            category_counts.items(), 
            key=lambda x: x[1]['count'], 
            reverse=True
        )
        
        return [
            {
                'category': cat,
                'count': data['count'],
                'critical_count': data['critical'],
                'high_count': data['high']
            }
            for cat, data in sorted_categories[:top_n]
        ]
    
    def _assess_compliance_risk(self, vulnerabilities: List[Dict[str, Any]]) -> str:
        """Assess compliance risk based on vulnerability types."""
        
        compliance_critical_types = ['sql_injection', 'command_injection', 'hardcoded_credentials']
        critical_compliance_issues = [
            v for v in vulnerabilities 
            if v['type'] in compliance_critical_types and v['severity'] in ['critical', 'high']
        ]
        
        if len(critical_compliance_issues) > 0:
            return 'High'
        elif len([v for v in vulnerabilities if v['severity'] == 'high']) > 5:
            return 'Medium'
        else:
            return 'Low'
    
    def _calculate_security_grade(self, score: int) -> str:
        """Calculate letter grade from security score."""
        
        if score >= 90:
            return 'A'
        elif score >= 80:
            return 'B'
        elif score >= 70:
            return 'C'
        elif score >= 60:
            return 'D'
        else:
            return 'F'
    
    def _get_category_breakdown(self, vulnerabilities: List[Dict[str, Any]]) -> Dict[str, int]:
        """Get breakdown of vulnerabilities by category."""
        
        breakdown = {}
        for vuln in vulnerabilities:
            category = vuln['category']
            breakdown[category] = breakdown.get(category, 0) + 1
        
        return breakdown
    
    def _assess_compliance(self, vulnerabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess compliance status based on vulnerabilities."""
        
        # Compliance frameworks and their critical requirements
        compliance_requirements = {
            'OWASP_Top_10': {
                'injection': ['sql_injection', 'command_injection'],
                'authentication': ['hardcoded_credentials', 'weak_passwords'],
                'encryption': ['weak_crypto', 'missing_encryption'],
                'xss': ['reflected_xss', 'dom_xss']
            },
            'GDPR': {
                'encryption': ['weak_crypto', 'missing_encryption'],
                'authentication': ['hardcoded_credentials']
            },
            'PCI_DSS': {
                'encryption': ['weak_crypto'],
                'authentication': ['hardcoded_credentials', 'weak_passwords']
            }
        }
        
        compliance_status = {}
        
        for framework, requirements in compliance_requirements.items():
            violations = []
            for category, vuln_types in requirements.items():
                for vuln in vulnerabilities:
                    if vuln['category'] == category and vuln['type'] in vuln_types:
                        if vuln['severity'] in ['critical', 'high']:
                            violations.append(vuln)
            
            if len(violations) == 0:
                status = 'Compliant'
            elif len(violations) <= 2:
                status = 'Minor Issues'
            else:
                status = 'Non-Compliant'
            
            compliance_status[framework] = {
                'status': status,
                'violation_count': len(violations),
                'critical_violations': len([v for v in violations if v['severity'] == 'critical'])
            }
        
        return compliance_status
    
    def _generate_recommended_actions(self, vulnerabilities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate recommended actions based on vulnerabilities."""
        
        actions = []
        
        # Group vulnerabilities by type for bulk recommendations
        vuln_by_type = {}
        for vuln in vulnerabilities:
            vuln_type = vuln['type']
            if vuln_type not in vuln_by_type:
                vuln_by_type[vuln_type] = []
            vuln_by_type[vuln_type].append(vuln)
        
        action_templates = {
            'sql_injection': {
                'title': 'Implement SQL Injection Protection',
                'description': 'Use parameterized queries and input validation',
                'priority': 'Critical',
                'estimated_hours': 8
            },
            'command_injection': {
                'title': 'Secure Command Execution',
                'description': 'Validate input and avoid shell=True in subprocess calls',
                'priority': 'Critical',
                'estimated_hours': 6
            },
            'hardcoded_credentials': {
                'title': 'Remove Hardcoded Credentials',
                'description': 'Move credentials to environment variables or secure vaults',
                'priority': 'Critical',
                'estimated_hours': 4
            },
            'weak_crypto': {
                'title': 'Upgrade Cryptographic Algorithms',
                'description': 'Replace weak algorithms with secure alternatives',
                'priority': 'High',
                'estimated_hours': 6
            }
        }
        
        for vuln_type, vulns in vuln_by_type.items():
            if vuln_type in action_templates:
                template = action_templates[vuln_type]
                action = {
                    **template,
                    'affected_files': list(set([v['file_path'] for v in vulns])),
                    'vulnerability_count': len(vulns),
                    'estimated_hours': template['estimated_hours'] * len(vulns)
                }
                actions.append(action)
        
        return sorted(actions, key=lambda x: x['estimated_hours'], reverse=True)
