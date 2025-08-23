# Security Analysis Enhancement Implementation Guide

## 🎯 Immediate Implementation: Enhanced Security Analysis

This guide provides specific implementation steps to expand your current basic security analysis into a comprehensive AI-powered security assessment system that managers can use to make informed decisions.

## 🏗️ Current Security Analysis Assessment

### ✅ **What's Already Working**
```python
# From api/technical_debt_service.py - Lines 208-249
def _detect_security_issues(self, content: str, file_ext: str) -> Dict[str, int]:
    """Detect potential security issues."""
    issues = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
    
    # SQL injection patterns
    sql_patterns = [
        r'query\s*=.*?\+.*?request',
        r'execute\s*\(.*?\+.*?input',
        r'SELECT.*?\+.*?user'
    ]
    
    # XSS patterns, hardcoded credentials, insecure random, etc.
```

### 🔄 **Enhancement Needed**
- **Limited Pattern Coverage**: Only basic patterns detected
- **No AI Context Analysis**: Patterns without context understanding
- **No Manager Dashboard**: Technical output, not business-friendly
- **No Automatic Ticket Creation**: Manual process for addressing issues
- **No Risk Prioritization**: All issues treated equally

## 🚀 Implementation Plan

### **Step 1: Enhanced Security Pattern Detection (2-3 hours)**

Create an enhanced security analysis service that extends the current implementation:

```python
# File: api/services/enhanced_security_service.py

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
```

### **Step 2: Add API Endpoints (1 hour)**

Add the new security analysis endpoints to your existing API:

```python
# Add to api/app.py

@app.post("/api/security/comprehensive-analysis")
async def comprehensive_security_analysis(
    repository_id: str = "current",
    enable_ai_analysis: bool = True
):
    """Perform comprehensive security analysis with AI enhancement."""
    
    try:
        from services.enhanced_security_service import EnhancedSecurityService
        
        security_service = EnhancedSecurityService()
        
        # Get repository files for analysis
        file_contents = {}
        
        # If analyzing current repository
        if repository_id == "current":
            import os
            from pathlib import Path
            
            project_root = Path(__file__).parent.parent
            
            # Scan relevant files
            for ext in ['.py', '.js', '.ts', '.jsx', '.tsx', '.php', '.java', '.cs']:
                for file_path in project_root.rglob(f'*{ext}'):
                    # Skip excluded directories
                    if any(excluded in str(file_path) for excluded in ['__pycache__', 'node_modules', '.git', 'venv']):
                        continue
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            file_contents[str(file_path.relative_to(project_root))] = f.read()
                    except:
                        continue
        
        # Perform comprehensive analysis
        analysis_result = await security_service.comprehensive_security_analysis(
            repository_id, file_contents, enable_ai_analysis
        )
        
        # Store results for historical tracking
        try:
            db = get_database()
            collection = db.collection('security_analyses')
            stored_result = collection.insert(analysis_result)
            analysis_result['storage_id'] = stored_result['_key']
        except Exception as e:
            logger.warning(f"Failed to store security analysis: {e}")
        
        return {
            "success": True,
            "analysis": analysis_result
        }
        
    except Exception as e:
        logger.error(f"Comprehensive security analysis failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/security/manager-dashboard")
async def get_security_manager_dashboard(days: int = 30):
    """Get manager-friendly security dashboard data."""
    
    try:
        db = get_database()
        collection = db.collection('security_analyses')
        
        # Get recent analyses
        from datetime import datetime, timedelta
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        cursor = collection.all()
        recent_analyses = [doc for doc in cursor if doc.get('analysis_timestamp', '') > cutoff_date]
        
        if not recent_analyses:
            return {
                "success": True,
                "message": "No recent security analyses found",
                "executive_metrics": {
                    "overall_security_score": 0,
                    "total_vulnerabilities": 0,
                    "critical_issues": 0,
                    "trend_direction": "unknown"
                },
                "priority_issues": [],
                "recommended_actions": []
            }
        
        # Calculate executive metrics
        latest_analysis = max(recent_analyses, key=lambda x: x.get('analysis_timestamp', ''))
        
        executive_metrics = {
            "overall_security_score": latest_analysis.get('security_score', 0),
            "total_vulnerabilities": latest_analysis.get('vulnerability_count', 0),
            "critical_issues": latest_analysis.get('critical_count', 0),
            "high_issues": latest_analysis.get('high_count', 0),
            "compliance_status": latest_analysis.get('compliance_assessment', {}),
            "trend_direction": "stable"  # Would calculate from historical data
        }
        
        # Get top priority issues
        vulnerabilities = latest_analysis.get('vulnerabilities', [])
        priority_issues = sorted(
            vulnerabilities, 
            key=lambda x: x.get('priority_score', 0), 
            reverse=True
        )[:10]
        
        return {
            "success": True,
            "executive_metrics": executive_metrics,
            "priority_issues": priority_issues,
            "ai_insights": latest_analysis.get('ai_insights', {}),
            "recommended_actions": latest_analysis.get('recommended_actions', []),
            "compliance_assessment": latest_analysis.get('compliance_assessment', {}),
            "analysis_timestamp": latest_analysis.get('analysis_timestamp')
        }
        
    except Exception as e:
        logger.error(f"Failed to get security manager dashboard: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/security/create-tickets")
async def create_security_tickets(
    analysis_id: str,
    severity_filter: List[str] = ["critical", "high"],
    max_tickets: int = 10
):
    """Automatically create Jira tickets for security vulnerabilities."""
    
    try:
        # Get security analysis
        db = get_database()
        collection = db.collection('security_analyses')
        analysis = collection.get(analysis_id)
        
        if not analysis:
            return {"success": False, "error": "Analysis not found"}
        
        vulnerabilities = analysis.get('vulnerabilities', [])
        
        # Filter vulnerabilities
        filtered_vulns = [
            v for v in vulnerabilities 
            if v.get('severity') in severity_filter
        ][:max_tickets]
        
        created_tickets = []
        
        for vuln in filtered_vulns:
            # Create Jira ticket
            ticket_data = {
                "project_key": "SCRUM",  # Your project key
                "summary": f"Security: {vuln['description']} in {vuln['file_path']}",
                "description": f"""
**Security Vulnerability Detected**

**Type**: {vuln['type']}
**Severity**: {vuln['severity'].upper()}
**CWE**: {vuln.get('cwe', 'Unknown')}
**File**: {vuln['file_path']}
**Line**: {vuln.get('line_number', 'Unknown')}

**Details**:
{vuln['description']}

**Code Context**:
```
{vuln.get('context', 'No context available')}
```

**AI Insights**:
{json.dumps(vuln.get('ai_insights', {}), indent=2)}

**Remediation Steps**:
{vuln.get('ai_insights', {}).get('remediation_steps', 'Manual review required')}

**Priority Score**: {vuln.get('priority_score', 0)}
""",
                "priority": "Critical" if vuln['severity'] == 'critical' else "High",
                "labels": ["security", "automated", vuln['category'], vuln['type']],
                "components": ["Security"]
            }
            
            # Use existing Jira integration
            jira_service = JiraIntegrationService()
            result = await jira_service.create_issue(ticket_data)
            
            if result.get('success'):
                created_tickets.append({
                    "vulnerability_id": vuln['id'],
                    "ticket_key": result['key'],
                    "ticket_url": f"https://alphavirtusai.atlassian.net/browse/{result['key']}",
                    "severity": vuln['severity']
                })
        
        return {
            "success": True,
            "created_tickets": created_tickets,
            "total_created": len(created_tickets)
        }
        
    except Exception as e:
        logger.error(f"Failed to create security tickets: {e}")
        return {
            "success": False,
            "error": str(e)
        }
```

### **Step 3: Frontend Manager Dashboard (2-3 hours)**

Create a manager-friendly security dashboard:

```tsx
// File: frontend/src/components/ManagerSecurityDashboard.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  CircularProgress,
  CircularProgressLabel,
  useToast,
  useColorModeValue,
  Icon,
  Progress,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react';
import {
  FiShield,
  FiAlertTriangle,
  FiCheckCircle,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiPlay,
  FiFileText
} from 'react-icons/fi';
import { apiService } from '../services/api';

interface SecurityVulnerability {
  id: string;
  category: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  file_path: string;
  line_number?: number;
  priority_score: number;
  ai_insights?: {
    business_impact?: string;
    exploitability?: string;
    remediation_effort?: number;
    remediation_steps?: string;
  };
}

interface SecurityDashboardData {
  executive_metrics: {
    overall_security_score: number;
    total_vulnerabilities: number;
    critical_issues: number;
    high_issues: number;
    trend_direction: 'improving' | 'declining' | 'stable';
    compliance_status: Record<string, any>;
  };
  priority_issues: SecurityVulnerability[];
  ai_insights: {
    executive_summary?: string;
    overall_risk_assessment?: string;
    immediate_actions?: string[];
  };
  recommended_actions: Array<{
    title: string;
    description: string;
    priority: string;
    estimated_hours: number;
    affected_files: string[];
  }>;
  compliance_assessment: Record<string, any>;
  analysis_timestamp?: string;
}

const ManagerSecurityDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<SecurityDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const toast = useToast();

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiService.request('/api/security/manager-dashboard');
      
      if (response.success) {
        setDashboardData(response);
      } else {
        toast({
          title: 'Warning',
          description: response.message || 'No recent security analyses found',
          status: 'warning',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error loading security dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security dashboard',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const runSecurityAnalysis = async () => {
    try {
      setAnalysisLoading(true);
      
      const response = await apiService.request('/api/security/comprehensive-analysis', {
        method: 'POST',
        body: JSON.stringify({
          repository_id: 'current',
          enable_ai_analysis: true
        })
      });

      if (response.success) {
        toast({
          title: 'Security Analysis Complete',
          description: `Found ${response.analysis.vulnerability_count} issues`,
          status: 'success',
          duration: 5000,
        });
        
        // Reload dashboard data
        await loadDashboardData();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Security analysis failed:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Security analysis encountered an error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const createSecurityTickets = async (severityFilter: string[] = ['critical', 'high']) => {
    try {
      // Would need analysis_id from the current analysis
      // This is a simplified version
      const response = await apiService.request('/api/security/create-tickets', {
        method: 'POST',
        body: JSON.stringify({
          analysis_id: 'latest', // Would use actual analysis ID
          severity_filter: severityFilter,
          max_tickets: 10
        })
      });

      if (response.success) {
        toast({
          title: 'Tickets Created',
          description: `Created ${response.total_created} security tickets`,
          status: 'success',
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        title: 'Ticket Creation Failed',
        description: 'Failed to create security tickets',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const getSecurityScoreColor = (score: number) => {
    if (score >= 80) return 'green.500';
    if (score >= 60) return 'yellow.500';
    if (score >= 40) return 'orange.500';
    return 'red.500';
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'red',
      high: 'orange',
      medium: 'yellow',
      low: 'gray'
    };
    return colors[severity] || 'gray';
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving': return FiTrendingUp;
      case 'declining': return FiTrendingDown;
      default: return FiMinus;
    }
  };

  if (loading) {
    return (
      <Box p={6} display="flex" justifyContent="center" alignItems="center" minH="400px">
        <CircularProgress isIndeterminate />
      </Box>
    );
  }

  return (
    <Box p={6}>
      <HStack justify="space-between" mb={6}>
        <VStack align="start">
          <Heading size="xl">Security Analysis Dashboard</Heading>
          <Text color="gray.500">AI-Powered Security Assessment</Text>
        </VStack>
        <HStack>
          <Button
            colorScheme="red"
            leftIcon={<FiShield />}
            onClick={runSecurityAnalysis}
            isLoading={analysisLoading}
            loadingText="Analyzing..."
          >
            Run Security Analysis
          </Button>
          {dashboardData && dashboardData.priority_issues.length > 0 && (
            <Button
              colorScheme="blue"
              leftIcon={<FiFileText />}
              onClick={() => createSecurityTickets(['critical', 'high'])}
            >
              Create Tickets
            </Button>
          )}
        </HStack>
      </HStack>

      {dashboardData ? (
        <>
          {/* Executive Summary Alert */}
          {dashboardData.ai_insights?.executive_summary && (
            <Alert 
              status={dashboardData.executive_metrics.critical_issues > 0 ? 'error' : 'info'} 
              mb={6}
            >
              <AlertIcon />
              <Box>
                <AlertTitle>AI Security Assessment</AlertTitle>
                <AlertDescription>
                  {dashboardData.ai_insights.executive_summary}
                </AlertDescription>
              </Box>
            </Alert>
          )}

          {/* Executive Metrics */}
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6} mb={8}>
            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>Security Score</StatLabel>
                  <HStack>
                    <StatNumber color={getSecurityScoreColor(dashboardData.executive_metrics.overall_security_score)}>
                      {dashboardData.executive_metrics.overall_security_score}
                    </StatNumber>
                    <Text>/100</Text>
                  </HStack>
                  <StatHelpText>
                    <Icon as={getTrendIcon(dashboardData.executive_metrics.trend_direction)} />
                    {dashboardData.executive_metrics.trend_direction}
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>Critical Issues</StatLabel>
                  <StatNumber color="red.500">
                    {dashboardData.executive_metrics.critical_issues}
                  </StatNumber>
                  <StatHelpText>Require immediate action</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>High Priority</StatLabel>
                  <StatNumber color="orange.500">
                    {dashboardData.executive_metrics.high_issues}
                  </StatNumber>
                  <StatHelpText>Need attention soon</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <Stat>
                  <StatLabel>Total Issues</StatLabel>
                  <StatNumber>
                    {dashboardData.executive_metrics.total_vulnerabilities}
                  </StatNumber>
                  <StatHelpText>All vulnerabilities</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>

          {/* Priority Issues Table */}
          {dashboardData.priority_issues.length > 0 && (
            <Card mb={8}>
              <CardHeader>
                <Heading size="md">Top Priority Security Issues</Heading>
              </CardHeader>
              <CardBody>
                <TableContainer>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Issue</Th>
                        <Th>Severity</Th>
                        <Th>File</Th>
                        <Th>Priority Score</Th>
                        <Th>AI Risk</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {dashboardData.priority_issues.slice(0, 10).map((issue) => (
                        <Tr key={issue.id}>
                          <Td>
                            <VStack align="start" spacing={1}>
                              <Text fontWeight="medium" fontSize="sm">
                                {issue.description}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {issue.category} • {issue.type}
                              </Text>
                            </VStack>
                          </Td>
                          <Td>
                            <Badge colorScheme={getSeverityColor(issue.severity)}>
                              {issue.severity.toUpperCase()}
                            </Badge>
                          </Td>
                          <Td>
                            <Text fontSize="sm">{issue.file_path}</Text>
                            {issue.line_number && (
                              <Text fontSize="xs" color="gray.500">
                                Line {issue.line_number}
                              </Text>
                            )}
                          </Td>
                          <Td>
                            <CircularProgress 
                              value={Math.min(issue.priority_score, 100)} 
                              color={getSecurityScoreColor(100 - issue.priority_score)}
                              size="40px"
                            >
                              <CircularProgressLabel fontSize="xs">
                                {Math.round(issue.priority_score)}
                              </CircularProgressLabel>
                            </CircularProgress>
                          </Td>
                          <Td>
                            {issue.ai_insights?.exploitability && (
                              <Badge colorScheme={
                                issue.ai_insights.exploitability === 'high' ? 'red' :
                                issue.ai_insights.exploitability === 'medium' ? 'orange' : 'green'
                              }>
                                {issue.ai_insights.exploitability}
                              </Badge>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          )}

          {/* Recommended Actions */}
          {dashboardData.recommended_actions.length > 0 && (
            <Card mb={8}>
              <CardHeader>
                <Heading size="md">Recommended Security Actions</Heading>
              </CardHeader>
              <CardBody>
                <VStack align="start" spacing={4}>
                  {dashboardData.recommended_actions.slice(0, 5).map((action, index) => (
                    <Box key={index} p={4} borderWidth={1} borderRadius="md" w="full">
                      <HStack justify="space-between">
                        <VStack align="start" spacing={2}>
                          <Text fontWeight="medium">{action.title}</Text>
                          <Text fontSize="sm" color="gray.600">
                            {action.description}
                          </Text>
                          <HStack>
                            <Badge colorScheme="purple">
                              {action.estimated_hours}h effort
                            </Badge>
                            <Badge colorScheme={getSeverityColor(action.priority.toLowerCase())}>
                              {action.priority} priority
                            </Badge>
                            <Badge variant="outline">
                              {action.affected_files.length} files
                            </Badge>
                          </HStack>
                        </VStack>
                        <Button size="sm" colorScheme="blue">
                          Create Ticket
                        </Button>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Compliance Status */}
          {dashboardData.compliance_assessment && Object.keys(dashboardData.compliance_assessment).length > 0 && (
            <Card>
              <CardHeader>
                <Heading size="md">Compliance Status</Heading>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  {Object.entries(dashboardData.compliance_assessment).map(([framework, status]: [string, any]) => (
                    <Box key={framework} p={4} borderWidth={1} borderRadius="md">
                      <VStack align="start" spacing={2}>
                        <Text fontWeight="medium">{framework}</Text>
                        <Badge 
                          colorScheme={
                            status.status === 'Compliant' ? 'green' :
                            status.status === 'Minor Issues' ? 'yellow' : 'red'
                          }
                        >
                          {status.status}
                        </Badge>
                        {status.violation_count > 0 && (
                          <Text fontSize="sm" color="gray.600">
                            {status.violation_count} violations ({status.critical_violations} critical)
                          </Text>
                        )}
                      </VStack>
                    </Box>
                  ))}
                </SimpleGrid>
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <Icon as={FiShield} w={12} h={12} color="gray.400" />
              <VStack spacing={2}>
                <Heading size="md" color="gray.500">No Security Analysis Data</Heading>
                <Text color="gray.500" textAlign="center">
                  Run a security analysis to get started with AI-powered security insights
                </Text>
              </VStack>
              <Button colorScheme="blue" onClick={runSecurityAnalysis}>
                Run First Analysis
              </Button>
            </VStack>
          </CardBody>
        </Card>
      )}
    </Box>
  );
};

export default ManagerSecurityDashboard;
```

### **Step 4: Add Navigation and Integration (30 minutes)**

Add the security dashboard to your navigation:

```tsx
// In your main navigation component
import ManagerSecurityDashboard from './components/ManagerSecurityDashboard';

// Add route
<Route path="/security-manager" element={<ManagerSecurityDashboard />} />

// Add to navigation menu
<NavItem to="/security-manager" icon={FiShield}>
  Security Manager
</NavItem>
```

## 🚀 Testing and Validation

### **Step 5: Test the Implementation (1 hour)**

1. **Run Security Analysis**:
   ```bash
   curl -X POST "http://localhost:8002/api/security/comprehensive-analysis" \
     -H "Content-Type: application/json" \
     -d '{"repository_id": "current", "enable_ai_analysis": true}'
   ```

2. **Check Manager Dashboard**:
   ```bash
   curl "http://localhost:8002/api/security/manager-dashboard"
   ```

3. **Test Frontend**: Navigate to `/security-manager` in your frontend

## 📊 Expected Results

After implementation, you'll have:

1. **Comprehensive Security Analysis**: 50+ security patterns detected
2. **AI-Enhanced Context**: Business impact and remediation guidance
3. **Manager-Friendly Dashboard**: Executive metrics and prioritized issues
4. **Automated Ticket Creation**: One-click Jira ticket generation
5. **Compliance Assessment**: OWASP, GDPR, PCI-DSS compliance status

## 🎯 Next Steps

Once this is working:

1. **Expand to Technical Debt AI Analysis**: Apply similar AI enhancement to technical debt
2. **Add Predictive Analytics**: Forecast security trends
3. **Implement Multi-Repository Analysis**: Compare security across projects
4. **Create Executive Dashboard**: High-level business insights

This enhanced security analysis provides immediate value for managers while laying the foundation for the comprehensive AI analysis roadmap. The system will help identify critical security issues, provide business context, and automate the creation of actionable work items for your development team.
