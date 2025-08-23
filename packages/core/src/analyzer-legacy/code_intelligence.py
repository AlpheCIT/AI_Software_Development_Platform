"""
Advanced Code Intelligence Module
Provides AI-powered code analysis, quality metrics, and insights
"""

import re
import ast
import json
import hashlib
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class CodeIntelligenceEngine:
    """Advanced code analysis and intelligence engine"""
    
    def __init__(self):
        self.complexity_thresholds = {
            'low': 10,
            'medium': 20,
            'high': 30
        }
        
    def analyze_code_quality(self, code: str, language: str, file_path: str) -> Dict[str, Any]:
        """Comprehensive code quality analysis"""
        try:
            analysis = {
                'file_path': file_path,
                'language': language,
                'metrics': {},
                'issues': [],
                'suggestions': [],
                'security_findings': [],
                'maintainability_score': 0,
                'complexity_score': 0,
                'quality_grade': 'A'
            }
            
            if language.lower() == 'python':
                analysis.update(self._analyze_python_code(code))
            elif language.lower() in ['javascript', 'typescript']:
                analysis.update(self._analyze_javascript_code(code))
            else:
                analysis.update(self._analyze_generic_code(code))
                
            # Calculate overall scores
            analysis['maintainability_score'] = self._calculate_maintainability_score(analysis)
            analysis['complexity_score'] = self._calculate_complexity_score(analysis)
            analysis['quality_grade'] = self._determine_quality_grade(analysis)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing code quality: {str(e)}")
            return self._default_analysis(file_path, language)
    
    def _analyze_python_code(self, code: str) -> Dict[str, Any]:
        """Python-specific code analysis"""
        try:
            tree = ast.parse(code)
            
            metrics = {
                'lines_of_code': len([line for line in code.split('\n') if line.strip()]),
                'blank_lines': len([line for line in code.split('\n') if not line.strip()]),
                'comment_lines': len([line for line in code.split('\n') if line.strip().startswith('#')]),
                'functions': 0,
                'classes': 0,
                'imports': 0,
                'cyclomatic_complexity': 0,
                'max_function_length': 0,
                'average_function_length': 0
            }
            
            issues = []
            suggestions = []
            security_findings = []
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    metrics['functions'] += 1
                    func_lines = node.end_lineno - node.lineno if hasattr(node, 'end_lineno') else 10
                    metrics['max_function_length'] = max(metrics['max_function_length'], func_lines)
                    
                    # Check for long functions
                    if func_lines > 50:
                        issues.append({
                            'type': 'complexity',
                            'severity': 'medium',
                            'line': node.lineno,
                            'message': f"Function '{node.name}' is too long ({func_lines} lines). Consider breaking it down.",
                            'suggestion': 'Split large functions into smaller, focused functions'
                        })
                        
                elif isinstance(node, ast.ClassDef):
                    metrics['classes'] += 1
                    
                elif isinstance(node, (ast.Import, ast.ImportFrom)):
                    metrics['imports'] += 1
                    
                    # Check for potentially dangerous imports
                    if isinstance(node, ast.ImportFrom) and node.module:
                        if 'os' in node.module or 'subprocess' in node.module:
                            security_findings.append({
                                'type': 'security',
                                'severity': 'medium',
                                'line': node.lineno,
                                'message': f"Potentially dangerous import: {node.module}",
                                'recommendation': 'Review usage of system-level imports for security implications'
                            })
            
            # Calculate average function length
            if metrics['functions'] > 0:
                metrics['average_function_length'] = metrics['max_function_length'] / metrics['functions']
            
            # Add code quality suggestions
            if metrics['comment_lines'] / max(metrics['lines_of_code'], 1) < 0.1:
                suggestions.append({
                    'type': 'documentation',
                    'priority': 'medium',
                    'message': 'Consider adding more comments to improve code readability',
                    'impact': 'Improves maintainability and team collaboration'
                })
            
            if metrics['functions'] == 0 and metrics['lines_of_code'] > 20:
                suggestions.append({
                    'type': 'structure',
                    'priority': 'high',
                    'message': 'Consider organizing code into functions for better modularity',
                    'impact': 'Improves code reusability and testability'
                })
                
            return {
                'metrics': metrics,
                'issues': issues,
                'suggestions': suggestions,
                'security_findings': security_findings
            }
            
        except SyntaxError as e:
            return {
                'metrics': {'syntax_error': True},
                'issues': [{
                    'type': 'syntax',
                    'severity': 'high',
                    'line': e.lineno or 0,
                    'message': f"Syntax error: {str(e)}",
                    'suggestion': 'Fix syntax errors to enable proper analysis'
                }],
                'suggestions': [],
                'security_findings': []
            }
    
    def _analyze_javascript_code(self, code: str) -> Dict[str, Any]:
        """JavaScript/TypeScript-specific code analysis"""
        lines = code.split('\n')
        
        metrics = {
            'lines_of_code': len([line for line in lines if line.strip()]),
            'blank_lines': len([line for line in lines if not line.strip()]),
            'comment_lines': len([line for line in lines if line.strip().startswith('//')]),
            'functions': len(re.findall(r'function\s+\w+|const\s+\w+\s*=.*=>', code)),
            'classes': len(re.findall(r'class\s+\w+', code)),
            'imports': len(re.findall(r'import.*from|require\(', code)),
            'console_logs': len(re.findall(r'console\.log', code))
        }
        
        issues = []
        suggestions = []
        security_findings = []
        
        # Check for console.log statements
        if metrics['console_logs'] > 0:
            issues.append({
                'type': 'cleanup',
                'severity': 'low',
                'message': f"Found {metrics['console_logs']} console.log statements",
                'suggestion': 'Remove console.log statements before production'
            })
        
        # Check for eval usage (security risk)
        if 'eval(' in code:
            security_findings.append({
                'type': 'security',
                'severity': 'high',
                'message': 'Usage of eval() detected',
                'recommendation': 'Avoid eval() as it poses security risks'
            })
        
        return {
            'metrics': metrics,
            'issues': issues,
            'suggestions': suggestions,
            'security_findings': security_findings
        }
    
    def _analyze_generic_code(self, code: str) -> Dict[str, Any]:
        """Generic code analysis for other languages"""
        lines = code.split('\n')
        
        metrics = {
            'lines_of_code': len([line for line in lines if line.strip()]),
            'blank_lines': len([line for line in lines if not line.strip()]),
            'comment_lines': len([line for line in lines if self._is_comment_line(line)]),
            'estimated_complexity': min(len(lines) // 10, 5)
        }
        
        return {
            'metrics': metrics,
            'issues': [],
            'suggestions': [],
            'security_findings': []
        }
    
    def _is_comment_line(self, line: str) -> bool:
        """Check if a line is a comment (basic heuristic)"""
        stripped = line.strip()
        return (stripped.startswith('#') or 
                stripped.startswith('//') or 
                stripped.startswith('/*') or
                stripped.startswith('*') or
                stripped.startswith('<!--'))
    
    def _calculate_maintainability_score(self, analysis: Dict[str, Any]) -> float:
        """Calculate maintainability score (0-100)"""
        metrics = analysis.get('metrics', {})
        issues = analysis.get('issues', [])
        
        score = 100.0
        
        # Penalize for issues
        score -= len(issues) * 5
        
        # Penalize for high complexity
        if metrics.get('max_function_length', 0) > 50:
            score -= 15
        
        # Reward for good documentation
        loc = metrics.get('lines_of_code', 1)
        comment_ratio = metrics.get('comment_lines', 0) / max(loc, 1)
        if comment_ratio > 0.2:
            score += 10
        elif comment_ratio < 0.05:
            score -= 10
        
        return max(0.0, min(100.0, score))
    
    def _calculate_complexity_score(self, analysis: Dict[str, Any]) -> float:
        """Calculate complexity score (0-100, lower is better)"""
        metrics = analysis.get('metrics', {})
        
        complexity = 0
        
        # Function length complexity
        max_func_len = metrics.get('max_function_length', 0)
        if max_func_len > 100:
            complexity += 40
        elif max_func_len > 50:
            complexity += 25
        elif max_func_len > 30:
            complexity += 15
        
        # Code density complexity
        loc = metrics.get('lines_of_code', 1)
        if loc > 500:
            complexity += 20
        elif loc > 200:
            complexity += 10
        
        return min(100.0, complexity)
    
    def _determine_quality_grade(self, analysis: Dict[str, Any]) -> str:
        """Determine overall quality grade A-F"""
        maintainability = analysis.get('maintainability_score', 0)
        complexity = analysis.get('complexity_score', 100)
        security_issues = len(analysis.get('security_findings', []))
        
        # Weighted score
        overall_score = (maintainability * 0.5) + ((100 - complexity) * 0.3) + (max(0, 100 - security_issues * 20) * 0.2)
        
        if overall_score >= 90:
            return 'A'
        elif overall_score >= 80:
            return 'B'
        elif overall_score >= 70:
            return 'C'
        elif overall_score >= 60:
            return 'D'
        else:
            return 'F'
    
    def _default_analysis(self, file_path: str, language: str) -> Dict[str, Any]:
        """Default analysis when parsing fails"""
        return {
            'file_path': file_path,
            'language': language,
            'metrics': {'analysis_failed': True},
            'issues': [],
            'suggestions': [],
            'security_findings': [],
            'maintainability_score': 50.0,
            'complexity_score': 50.0,
            'quality_grade': 'C'
        }

class ArchitectureAnalyzer:
    """Analyzes code architecture and dependencies"""
    
    def analyze_repository_architecture(self, code_nodes: List[Dict]) -> Dict[str, Any]:
        """Analyze overall repository architecture"""
        
        architecture = {
            'modules': {},
            'dependencies': [],
            'patterns': [],
            'architecture_score': 0,
            'recommendations': []
        }
        
        # Analyze module structure
        for node in code_nodes:
            file_path = node.get('file', '')
            language = node.get('language', '')
            
            # Extract module information
            if '/' in file_path:
                module = file_path.split('/')[0]
                if module not in architecture['modules']:
                    architecture['modules'][module] = {
                        'files': 0,
                        'languages': set(),
                        'complexity': 0
                    }
                architecture['modules'][module]['files'] += 1
                architecture['modules'][module]['languages'].add(language)
        
        # Convert sets to lists for JSON serialization
        for module in architecture['modules']:
            architecture['modules'][module]['languages'] = list(architecture['modules'][module]['languages'])
        
        # Detect architectural patterns
        if 'backend' in architecture['modules'] and 'frontend' in architecture['modules']:
            architecture['patterns'].append('Full-Stack Architecture')
        
        if 'src' in architecture['modules']:
            architecture['patterns'].append('Source-Based Organization')
        
        if 'tests' in architecture['modules'] or 'test' in architecture['modules']:
            architecture['patterns'].append('Test-Driven Structure')
        
        # Calculate architecture score
        architecture['architecture_score'] = self._calculate_architecture_score(architecture)
        
        # Generate recommendations
        architecture['recommendations'] = self._generate_architecture_recommendations(architecture)
        
        return architecture
    
    def _calculate_architecture_score(self, architecture: Dict) -> float:
        """Calculate architecture quality score"""
        score = 70.0  # Base score
        
        # Reward for good patterns
        score += len(architecture['patterns']) * 5
        
        # Reward for modular structure
        if len(architecture['modules']) > 1:
            score += 10
        
        # Penalize for too many modules (over-complexity)
        if len(architecture['modules']) > 10:
            score -= 5
        
        return min(100.0, score)
    
    def _generate_architecture_recommendations(self, architecture: Dict) -> List[str]:
        """Generate architecture improvement recommendations"""
        recommendations = []
        
        if len(architecture['modules']) == 1:
            recommendations.append("Consider organizing code into logical modules for better maintainability")
        
        if 'tests' not in architecture['modules'] and 'test' not in architecture['modules']:
            recommendations.append("Add a dedicated testing module to improve code quality")
        
        if len(architecture['patterns']) < 2:
            recommendations.append("Consider adopting more architectural patterns for better code organization")
        
        return recommendations
