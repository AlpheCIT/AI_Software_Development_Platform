"""
Technical Debt Scoring Service (SCRUM-49)
Implements comprehensive technical debt calculation based on multiple quality metrics.
"""

import logging
import math
import os
import ast
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

# Import database service
try:
    from api.debt_database import debt_db
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False
    debt_db = None
    logger.warning("Database service not available")

class DebtSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class DebtHotspot:
    """Represents a technical debt hotspot in the codebase"""
    file_path: str
    debt_score: float
    severity: DebtSeverity
    primary_issues: List[str]
    estimated_hours: float
    last_modified: datetime
    change_frequency: int
    
@dataclass
class TeamDebtAllocation:
    """Technical debt allocation per team/developer"""
    team_id: str
    team_name: str
    total_debt_score: float
    file_count: int
    estimated_hours: float
    top_issues: List[str]
    
@dataclass
class DebtTrend:
    """Historical technical debt trend data"""
    date: datetime
    total_debt_score: float
    file_count: int
    resolved_debt: float
    new_debt: float

class TechnicalDebtService:
    """Service for calculating and analyzing technical debt"""
    
    def __init__(self, project_root: str = None):
        # Weights for different debt factors (configurable)
        self.weights = {
            'complexity': 0.25,
            'duplication': 0.20,
            'code_smells': 0.15,
            'security_issues': 0.20,
            'test_coverage': 0.10,
            'documentation': 0.05,
            'performance': 0.05
        }
        
        # Multipliers based on file importance/change frequency
        self.importance_multipliers = {
            'critical': 2.0,   # Core business logic
            'high': 1.5,       # Important components
            'medium': 1.0,     # Regular code
            'low': 0.7         # Rarely changed code
        }
        
        # Set project root directory
        if project_root is None:
            # Default to parent directory of the api folder
            self.project_root = Path(__file__).parent.parent
        else:
            self.project_root = Path(project_root)
            
        logger.info(f"Technical Debt Service initialized with project root: {self.project_root}")
    
    def analyze_file_metrics(self, file_path: Path) -> Dict[str, Any]:
        """
        Analyze a single file to extract quality metrics.
        
        Args:
            file_path: Path to the file to analyze
            
        Returns:
            Dict containing extracted metrics
        """
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            metrics = {
                'cyclomatic_complexity': self._calculate_complexity(content, file_path.suffix),
                'duplication_percentage': self._detect_duplication(content),
                'code_smells': self._count_code_smells(content, file_path.suffix),
                'security_issues': self._detect_security_issues(content, file_path.suffix),
                'test_coverage': self._estimate_test_coverage(file_path, content),
                'documentation_coverage': self._calculate_documentation_coverage(content, file_path.suffix),
                'performance_issues': self._detect_performance_issues(content, file_path.suffix),
                'importance_level': self._determine_importance_level(file_path, content)
            }
            
            return metrics
            
        except Exception as e:
            logger.warning(f"Error analyzing file {file_path}: {str(e)}")
            return self._get_default_metrics()
    
    def _calculate_complexity(self, content: str, file_ext: str) -> int:
        """Calculate cyclomatic complexity approximation."""
        if file_ext in ['.py']:
            # Python complexity
            complexity_patterns = [
                r'\bif\b', r'\belif\b', r'\bwhile\b', r'\bfor\b', 
                r'\btry\b', r'\bexcept\b', r'\band\b', r'\bor\b',
                r'\?', r'&&', r'\|\|'
            ]
        elif file_ext in ['.js', '.ts', '.jsx', '.tsx']:
            # JavaScript/TypeScript complexity
            complexity_patterns = [
                r'\bif\b', r'\belse\s+if\b', r'\bwhile\b', r'\bfor\b',
                r'\btry\b', r'\bcatch\b', r'\bswitch\b', r'\bcase\b',
                r'\?', r'&&', r'\|\|'
            ]
        else:
            # Generic patterns
            complexity_patterns = [r'\bif\b', r'\bfor\b', r'\bwhile\b', r'\btry\b']
        
        complexity = 1  # Base complexity
        for pattern in complexity_patterns:
            complexity += len(re.findall(pattern, content, re.IGNORECASE))
        
        return min(complexity, 50)  # Cap at 50
    
    def _detect_duplication(self, content: str) -> float:
        """Detect code duplication percentage."""
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        if len(lines) < 10:
            return 0.0
            
        line_counts = {}
        for line in lines:
            if len(line) > 20:  # Only consider substantial lines
                line_counts[line] = line_counts.get(line, 0) + 1
        
        duplicated_lines = sum(count - 1 for count in line_counts.values() if count > 1)
        return min((duplicated_lines / len(lines)) * 100, 50.0)
    
    def _count_code_smells(self, content: str, file_ext: str) -> int:
        """Count code smells and anti-patterns."""
        smells = 0
        
        # Long methods/functions (over 50 lines)
        if file_ext in ['.py']:
            function_pattern = r'def\s+\w+.*?:\s*\n(.*?)(?=\ndef|\nclass|\Z)'
        elif file_ext in ['.js', '.ts', '.jsx', '.tsx']:
            function_pattern = r'function\s+\w+.*?\{(.*?)(?=\nfunction|\nclass|\Z)'
        else:
            function_pattern = r'function.*?\{(.*?)\}'
            
        functions = re.findall(function_pattern, content, re.DOTALL | re.IGNORECASE)
        for func in functions:
            if len(func.split('\n')) > 50:
                smells += 1
        
        # Long parameter lists
        smells += len(re.findall(r'\([^)]{100,}\)', content))
        
        # Deep nesting (more than 4 levels)
        max_nesting = 0
        current_nesting = 0
        for char in content:
            if char in '{(':
                current_nesting += 1
                max_nesting = max(max_nesting, current_nesting)
            elif char in '}(':
                current_nesting = max(0, current_nesting - 1)
        
        if max_nesting > 4:
            smells += max_nesting - 4
            
        # TODO comments (technical debt indicators)
        smells += len(re.findall(r'#\s*TODO|//\s*TODO|/\*.*?TODO.*?\*/', content, re.IGNORECASE | re.DOTALL))
        
        # Magic numbers
        smells += len(re.findall(r'\b\d{3,}\b', content))
        
        return min(smells, 20)
    
    def _detect_security_issues(self, content: str, file_ext: str) -> Dict[str, int]:
        """Detect potential security issues."""
        issues = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        
        # SQL injection patterns
        sql_patterns = [
            r'query\s*=.*?\+.*?request',
            r'execute\s*\(.*?\+.*?input',
            r'SELECT.*?\+.*?user'
        ]
        for pattern in sql_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                issues['high'] += 1
        
        # XSS patterns
        xss_patterns = [
            r'innerHTML\s*=.*?user',
            r'document\.write\s*\(.*?request',
            r'eval\s*\('
        ]
        for pattern in xss_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                issues['high'] += 1
        
        # Hardcoded credentials
        if re.search(r'password\s*=\s*["\'][^"\']{3,}["\']', content, re.IGNORECASE):
            issues['critical'] += 1
        if re.search(r'api_key\s*=\s*["\'][^"\']{10,}["\']', content, re.IGNORECASE):
            issues['high'] += 1
        
        # Insecure random
        if re.search(r'Math\.random\(\)|random\.random\(\)', content):
            issues['medium'] += 1
        
        # HTTP instead of HTTPS
        if re.search(r'http://(?!localhost|127\.0\.0\.1)', content):
            issues['medium'] += 1
            
        # Unsafe imports or requires
        unsafe_patterns = [
            r'import\s+pickle',
            r'eval\s*\(',
            r'exec\s*\(',
            r'subprocess\.call'
        ]
        for pattern in unsafe_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                issues['medium'] += 1
        
        return issues
    
    def _estimate_test_coverage(self, file_path: Path, content: str) -> float:
        """Estimate test coverage by looking for corresponding test files."""
        # Check if this is already a test file
        if any(test_indicator in str(file_path).lower() for test_indicator in ['test', 'spec', '__tests__']):
            return 100.0
        
        # Look for corresponding test files
        possible_test_paths = [
            file_path.parent / f"test_{file_path.name}",
            file_path.parent / f"{file_path.stem}.test{file_path.suffix}",
            file_path.parent / f"{file_path.stem}.spec{file_path.suffix}",
            file_path.parent / "__tests__" / file_path.name,
            file_path.parent.parent / "tests" / file_path.name,
        ]
        
        test_exists = any(test_path.exists() for test_path in possible_test_paths)
        
        if test_exists:
            # If test file exists, estimate coverage based on function count vs test count
            function_count = len(re.findall(r'def\s+\w+|function\s+\w+|const\s+\w+\s*=.*?=>', content))
            if function_count == 0:
                return 80.0
            
            # Try to read test file and count tests
            for test_path in possible_test_paths:
                if test_path.exists():
                    try:
                        with open(test_path, 'r', encoding='utf-8', errors='ignore') as f:
                            test_content = f.read()
                        test_count = len(re.findall(r'def\s+test_|it\s*\(|test\s*\(|describe\s*\(', test_content))
                        coverage = min((test_count / function_count) * 100, 100)
                        return max(coverage, 30)  # Minimum 30% if test file exists
                    except:
                        pass
            
            return 60.0  # Default if test file exists but can't read it
        else:
            return 10.0  # Low coverage if no test file found
    
    def _calculate_documentation_coverage(self, content: str, file_ext: str) -> float:
        """Calculate documentation coverage percentage."""
        if file_ext in ['.py']:
            # Python docstrings
            docstring_count = len(re.findall(r'""".*?"""', content, re.DOTALL))
            docstring_count += len(re.findall(r"'''.*?'''", content, re.DOTALL))
            function_count = len(re.findall(r'def\s+\w+', content))
            class_count = len(re.findall(r'class\s+\w+', content))
        elif file_ext in ['.js', '.ts', '.jsx', '.tsx']:
            # JSDoc comments
            docstring_count = len(re.findall(r'/\*\*.*?\*/', content, re.DOTALL))
            function_count = len(re.findall(r'function\s+\w+|const\s+\w+\s*=.*?=>', content))
            class_count = len(re.findall(r'class\s+\w+', content))
        else:
            # Generic comment counting
            docstring_count = len(re.findall(r'/\*.*?\*/|#.*?$', content, re.MULTILINE | re.DOTALL))
            function_count = 1
            class_count = 0
        
        total_definitions = function_count + class_count
        if total_definitions == 0:
            return 50.0  # Default for files without functions/classes
        
        return min((docstring_count / total_definitions) * 100, 100)
    
    def _detect_performance_issues(self, content: str, file_ext: str) -> int:
        """Detect potential performance issues."""
        issues = 0
        
        # Nested loops
        if file_ext in ['.py']:
            nested_loops = len(re.findall(r'for.*?:\s*.*?for.*?:', content, re.DOTALL))
        else:
            nested_loops = len(re.findall(r'for\s*\(.*?\).*?for\s*\(', content, re.DOTALL))
        issues += nested_loops
        
        # Large object creation in loops
        issues += len(re.findall(r'for.*?{.*?new\s+\w+', content, re.DOTALL | re.IGNORECASE))
        
        # Synchronous operations that should be async
        sync_patterns = [
            r'\.join\s*\(\)',
            r'time\.sleep',
            r'requests\.get',
            r'fs\.readFileSync'
        ]
        for pattern in sync_patterns:
            issues += len(re.findall(pattern, content, re.IGNORECASE))
        
        # Large data structures
        issues += len(re.findall(r'\[.*?\]', content)) // 20  # Rough approximation
        
        return min(issues, 10)
    
    def _determine_importance_level(self, file_path: Path, content: str) -> str:
        """Determine the importance level of a file."""
        path_str = str(file_path).lower()
        
        # Critical files
        if any(keyword in path_str for keyword in ['main', 'index', 'app', 'core', 'auth', 'security']):
            return 'critical'
        
        # High importance
        if any(keyword in path_str for keyword in ['api', 'service', 'controller', 'model', 'database']):
            return 'high'
        
        # Low importance
        if any(keyword in path_str for keyword in ['test', 'spec', 'example', 'demo', 'legacy']):
            return 'low'
        
        # Check file size and complexity for importance
        lines = len(content.split('\n'))
        if lines > 500:
            return 'high'
        elif lines < 50:
            return 'low'
        
        return 'medium'
    
    def _get_default_metrics(self) -> Dict[str, Any]:
        """Return default metrics when file analysis fails."""
        return {
            'cyclomatic_complexity': 1,
            'duplication_percentage': 0,
            'code_smells': 0,
            'security_issues': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0},
            'test_coverage': 50,
            'documentation_coverage': 50,
            'performance_issues': 0,
            'importance_level': 'medium'
        }
    
    def scan_project_files(self, max_files: int = 100) -> List[Dict[str, Any]]:
        """
        Scan project files to create analysis results.
        
        Args:
            max_files: Maximum number of files to analyze
            
        Returns:
            List of analysis results for each file
        """
        analysis_results = []
        
        # File patterns to include
        include_patterns = ['*.py', '*.js', '*.ts', '*.jsx', '*.tsx', '*.java', '*.cpp', '*.c', '*.php']
        
        # Directories to exclude
        exclude_dirs = {'.git', '__pycache__', 'node_modules', '.venv', 'venv', 'dist', 'build', '.next'}
        
        files_analyzed = 0
        
        for pattern in include_patterns:
            if files_analyzed >= max_files:
                break
                
            for file_path in self.project_root.rglob(pattern):
                if files_analyzed >= max_files:
                    break
                    
                # Skip files in excluded directories
                if any(excluded in file_path.parts for excluded in exclude_dirs):
                    continue
                
                # Skip very large files (> 10MB)
                try:
                    if file_path.stat().st_size > 10 * 1024 * 1024:
                        continue
                except:
                    continue
                
                # Analyze the file
                metrics = self.analyze_file_metrics(file_path)
                
                # Get file statistics
                try:
                    stat = file_path.stat()
                    last_modified = datetime.fromtimestamp(stat.st_mtime)
                    lines_of_code = len([line for line in file_path.read_text(encoding='utf-8', errors='ignore').split('\n') if line.strip()])
                except:
                    last_modified = datetime.now()
                    lines_of_code = 100
                
                # Estimate change frequency (mock for now - in production you'd use git history)
                relative_path = str(file_path.relative_to(self.project_root))
                change_frequency = hash(relative_path) % 30  # Pseudo-random based on path
                
                analysis_result = {
                    "file_path": relative_path,
                    "lines_of_code": lines_of_code,
                    "last_modified": last_modified.isoformat(),
                    "change_frequency": change_frequency,
                    "metrics": metrics
                }
                
                analysis_results.append(analysis_result)
                files_analyzed += 1
                
                logger.debug(f"Analyzed file: {relative_path} (debt score: {self.calculate_weighted_debt_score(metrics):.1f})")
        
        logger.info(f"Analyzed {files_analyzed} files from project")
        return analysis_results
    
    def store_analysis_results(self, debt_report: Dict[str, Any], hotspots: List[DebtHotspot] = None) -> Optional[str]:
        """
        Store analysis results in the database for historical tracking
        
        Args:
            debt_report: Complete debt analysis report
            hotspots: List of debt hotspots (optional)
            
        Returns:
            Analysis ID if stored successfully, None otherwise
        """
        if not DATABASE_AVAILABLE or not debt_db or not debt_db.is_connected():
            logger.warning("Database not available - analysis results not stored")
            return None
        
        try:
            # Store main analysis
            analysis_id = debt_db.store_analysis(debt_report)
            
            if analysis_id and hotspots:
                # Convert hotspots to dictionaries for storage
                hotspots_data = []
                for hotspot in hotspots:
                    hotspot_data = {
                        'file_path': hotspot.file_path,
                        'debt_score': hotspot.debt_score,
                        'severity': hotspot.severity.value,
                        'primary_issues': hotspot.primary_issues,
                        'estimated_hours': hotspot.estimated_hours,
                        'last_modified': hotspot.last_modified.isoformat(),
                        'change_frequency': hotspot.change_frequency,
                        'metrics': {}  # Could store detailed metrics here if needed
                    }
                    hotspots_data.append(hotspot_data)
                
                # Store hotspots
                debt_db.store_hotspots(hotspots_data, analysis_id)
            
            # Store daily trend summary
            if analysis_id:
                trend_data = {
                    'total_debt_score': debt_report.get('summary', {}).get('average_debt_score', 0),
                    'file_count': debt_report.get('summary', {}).get('total_files_analyzed', 0),
                    'resolved_debt': 0,  # Would need comparison with previous day
                    'new_debt': 0,      # Would need comparison with previous day
                    'hotspots_count': debt_report.get('summary', {}).get('total_hotspots', 0),
                    'critical_issues': debt_report.get('severity_distribution', {}).get('critical', 0),
                    'high_issues': debt_report.get('severity_distribution', {}).get('high', 0),
                    'medium_issues': debt_report.get('severity_distribution', {}).get('medium', 0),
                    'low_issues': debt_report.get('severity_distribution', {}).get('low', 0),
                    'total_remediation_hours': debt_report.get('summary', {}).get('total_remediation_hours', 0)
                }
                debt_db.store_daily_trend(trend_data)
            
            logger.info(f"Stored analysis results with ID: {analysis_id}")
            return analysis_id
            
        except Exception as e:
            logger.error(f"Failed to store analysis results: {str(e)}")
            return None
    
    def get_historical_trends_from_db(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Retrieve historical trends from database instead of generating mock data
        
        Args:
            days: Number of days to retrieve
            
        Returns:
            List of historical trend data
        """
        if not DATABASE_AVAILABLE or not debt_db or not debt_db.is_connected():
            logger.warning("Database not available - returning empty trends")
            return []
        
        try:
            trends = debt_db.get_historical_trends(days)
            
            # Convert to the format expected by analyze_debt_trends
            historical_data = []
            for trend in trends:
                historical_data.append({
                    "analysis_date": f"{trend['date']}T12:00:00",
                    "metrics": {
                        "total_debt_score": trend.get('total_debt_score', 0),
                        "file_count": trend.get('file_count', 0),
                        "resolved_debt": trend.get('resolved_debt', 0),
                        "new_debt": trend.get('new_debt', 0)
                    }
                })
            
            return historical_data
            
        except Exception as e:
            logger.error(f"Failed to retrieve historical trends: {str(e)}")
            return []
    
    def calculate_weighted_debt_score(self, metrics: Dict[str, Any]) -> float:
        """
        Calculate weighted technical debt score based on multiple metrics.
        
        Args:
            metrics: Dictionary containing various code quality metrics
            
        Returns:
            float: Weighted debt score (0-100 scale)
        """
        total_score = 0.0
        
        # Complexity scoring (higher complexity = more debt)
        complexity_score = min(metrics.get('cyclomatic_complexity', 0) * 2, 100)
        total_score += complexity_score * self.weights['complexity']
        
        # Code duplication (percentage of duplicated lines)
        duplication_score = min(metrics.get('duplication_percentage', 0) * 10, 100)
        total_score += duplication_score * self.weights['duplication']
        
        # Code smells count
        code_smells = metrics.get('code_smells', 0)
        smell_score = min(code_smells * 5, 100)
        total_score += smell_score * self.weights['code_smells']
        
        # Security issues (weighted by severity)
        security_issues = metrics.get('security_issues', {})
        security_score = (
            security_issues.get('critical', 0) * 20 +
            security_issues.get('high', 0) * 10 +
            security_issues.get('medium', 0) * 5 +
            security_issues.get('low', 0) * 2
        )
        security_score = min(security_score, 100)
        total_score += security_score * self.weights['security_issues']
        
        # Test coverage (inverse: low coverage = high debt)
        test_coverage = metrics.get('test_coverage', 100)
        coverage_score = max(0, 100 - test_coverage)
        total_score += coverage_score * self.weights['test_coverage']
        
        # Documentation coverage (inverse: low docs = high debt)
        doc_coverage = metrics.get('documentation_coverage', 100)
        doc_score = max(0, 100 - doc_coverage)
        total_score += doc_score * self.weights['documentation']
        
        # Performance issues
        performance_issues = metrics.get('performance_issues', 0)
        perf_score = min(performance_issues * 10, 100)
        total_score += perf_score * self.weights['performance']
        
        # Apply importance multiplier
        importance = metrics.get('importance_level', 'medium')
        multiplier = self.importance_multipliers.get(importance, 1.0)
        
        return min(total_score * multiplier, 100)
    
    def calculate_remediation_effort(self, debt_score: float, file_size: int, 
                                   complexity: int) -> float:
        """
        Estimate effort (in hours) required to remediate technical debt.
        
        Args:
            debt_score: Technical debt score (0-100)
            file_size: Number of lines of code
            complexity: Cyclomatic complexity
            
        Returns:
            float: Estimated hours for remediation
        """
        # Base effort calculation
        base_effort = (debt_score / 100) * (file_size / 100) * 0.5
        
        # Complexity factor
        complexity_factor = math.log(complexity + 1) / 2
        
        # Size factor (larger files take more time)
        size_factor = math.log(file_size + 1) / 100
        
        total_effort = base_effort + complexity_factor + size_factor
        
        # Minimum 0.5 hours, maximum 40 hours per file
        return max(0.5, min(total_effort, 40.0))
    
    def identify_debt_hotspots(self, analysis_results: List[Dict[str, Any]], 
                              threshold: float = 60.0) -> List[DebtHotspot]:
        """
        Identify technical debt hotspots based on analysis results.
        
        Args:
            analysis_results: List of file analysis results
            threshold: Minimum debt score to be considered a hotspot
            
        Returns:
            List[DebtHotspot]: Sorted list of debt hotspots
        """
        hotspots = []
        
        for result in analysis_results:
            debt_score = self.calculate_weighted_debt_score(result.get('metrics', {}))
            
            if debt_score >= threshold:
                # Determine severity
                if debt_score >= 90:
                    severity = DebtSeverity.CRITICAL
                elif debt_score >= 75:
                    severity = DebtSeverity.HIGH
                elif debt_score >= 60:
                    severity = DebtSeverity.MEDIUM
                else:
                    severity = DebtSeverity.LOW
                
                # Extract primary issues
                primary_issues = []
                metrics = result.get('metrics', {})
                
                if metrics.get('cyclomatic_complexity', 0) > 10:
                    primary_issues.append("High Complexity")
                if metrics.get('duplication_percentage', 0) > 5:
                    primary_issues.append("Code Duplication")
                if metrics.get('security_issues', {}).get('high', 0) > 0:
                    primary_issues.append("Security Vulnerabilities")
                if metrics.get('test_coverage', 100) < 50:
                    primary_issues.append("Low Test Coverage")
                
                # Calculate remediation effort
                file_size = result.get('lines_of_code', 100)
                complexity = metrics.get('cyclomatic_complexity', 1)
                estimated_hours = self.calculate_remediation_effort(
                    debt_score, file_size, complexity
                )
                
                hotspot = DebtHotspot(
                    file_path=result.get('file_path', 'unknown'),
                    debt_score=debt_score,
                    severity=severity,
                    primary_issues=primary_issues,
                    estimated_hours=estimated_hours,
                    last_modified=datetime.fromisoformat(
                        result.get('last_modified', datetime.now().isoformat())
                    ),
                    change_frequency=result.get('change_frequency', 0)
                )
                
                hotspots.append(hotspot)
        
        # Sort by debt score (highest first)
        hotspots.sort(key=lambda x: x.debt_score, reverse=True)
        return hotspots
    
    def calculate_team_debt_allocation(self, hotspots: List[DebtHotspot], 
                                     team_assignments: Dict[str, List[str]]) -> List[TeamDebtAllocation]:
        """
        Allocate technical debt to teams based on file ownership.
        
        Args:
            hotspots: List of identified debt hotspots
            team_assignments: Dictionary mapping team IDs to file patterns/paths
            
        Returns:
            List[TeamDebtAllocation]: Team debt allocation data
        """
        team_allocations = {}
        
        for team_id, file_patterns in team_assignments.items():
            team_hotspots = []
            
            for hotspot in hotspots:
                # Check if hotspot file matches team's patterns
                for pattern in file_patterns:
                    if pattern in hotspot.file_path:
                        team_hotspots.append(hotspot)
                        break
            
            if team_hotspots:
                total_debt = sum(h.debt_score for h in team_hotspots)
                total_hours = sum(h.estimated_hours for h in team_hotspots)
                
                # Extract top issues
                all_issues = []
                for h in team_hotspots:
                    all_issues.extend(h.primary_issues)
                
                issue_counts = {}
                for issue in all_issues:
                    issue_counts[issue] = issue_counts.get(issue, 0) + 1
                
                top_issues = sorted(issue_counts.keys(), 
                                  key=lambda x: issue_counts[x], reverse=True)[:3]
                
                allocation = TeamDebtAllocation(
                    team_id=team_id,
                    team_name=team_assignments.get(f"{team_id}_name", team_id),
                    total_debt_score=total_debt,
                    file_count=len(team_hotspots),
                    estimated_hours=total_hours,
                    top_issues=top_issues
                )
                
                team_allocations[team_id] = allocation
        
        return list(team_allocations.values())
    
    def analyze_debt_trends(self, historical_data: List[Dict[str, Any]], 
                           days: int = 30) -> List[DebtTrend]:
        """
        Analyze historical technical debt trends.
        
        Args:
            historical_data: List of historical analysis results
            days: Number of days to analyze
            
        Returns:
            List[DebtTrend]: Historical debt trend data
        """
        trends = []
        
        # Group data by date
        date_groups = {}
        for data_point in historical_data:
            date_str = data_point.get('analysis_date', datetime.now().date().isoformat())
            date = datetime.fromisoformat(date_str).date()
            
            if date not in date_groups:
                date_groups[date] = []
            date_groups[date].append(data_point)
        
        # Calculate trends for each date
        sorted_dates = sorted(date_groups.keys())
        
        for i, date in enumerate(sorted_dates):
            daily_data = date_groups[date]
            
            # Calculate total debt score for the day
            total_debt = sum(
                self.calculate_weighted_debt_score(item.get('metrics', {}))
                for item in daily_data
            )
            
            file_count = len(daily_data)
            
            # Calculate resolved/new debt (compared to previous day)
            resolved_debt = 0.0
            new_debt = 0.0
            
            if i > 0:
                prev_date = sorted_dates[i-1]
                prev_data = date_groups[prev_date]
                prev_total = sum(
                    self.calculate_weighted_debt_score(item.get('metrics', {}))
                    for item in prev_data
                )
                
                if total_debt < prev_total:
                    resolved_debt = prev_total - total_debt
                else:
                    new_debt = total_debt - prev_total
            
            trend = DebtTrend(
                date=datetime.combine(date, datetime.min.time()),
                total_debt_score=total_debt,
                file_count=file_count,
                resolved_debt=resolved_debt,
                new_debt=new_debt
            )
            
            trends.append(trend)
        
        return trends[-days:] if len(trends) > days else trends
    
    def generate_debt_report(self, analysis_results: List[Dict[str, Any]], 
                           team_assignments: Dict[str, List[str]] = None) -> Dict[str, Any]:
        """
        Generate comprehensive technical debt report.
        
        Args:
            analysis_results: List of code analysis results
            team_assignments: Optional team file assignments
            
        Returns:
            Dict: Comprehensive debt report
        """
        # Calculate overall metrics
        total_files = len(analysis_results)
        
        debt_scores = [
            self.calculate_weighted_debt_score(result.get('metrics', {}))
            for result in analysis_results
        ]
        
        avg_debt_score = sum(debt_scores) / len(debt_scores) if debt_scores else 0
        max_debt_score = max(debt_scores) if debt_scores else 0
        
        # Identify hotspots
        hotspots = self.identify_debt_hotspots(analysis_results)
        
        # Calculate total remediation effort
        total_effort_hours = sum(h.estimated_hours for h in hotspots)
        
        # Team allocations (if provided)
        team_allocations = []
        if team_assignments:
            team_allocations = self.calculate_team_debt_allocation(hotspots, team_assignments)
        
        # Severity distribution
        severity_counts = {severity.value: 0 for severity in DebtSeverity}
        for hotspot in hotspots:
            severity_counts[hotspot.severity.value] += 1
        
        return {
            'summary': {
                'total_files_analyzed': total_files,
                'average_debt_score': round(avg_debt_score, 2),
                'maximum_debt_score': round(max_debt_score, 2),
                'total_hotspots': len(hotspots),
                'total_remediation_hours': round(total_effort_hours, 1),
                'analysis_date': datetime.now().isoformat()
            },
            'severity_distribution': severity_counts,
            'top_hotspots': [
                {
                    'file_path': h.file_path,
                    'debt_score': round(h.debt_score, 2),
                    'severity': h.severity.value,
                    'primary_issues': h.primary_issues,
                    'estimated_hours': round(h.estimated_hours, 1)
                }
                for h in hotspots[:10]  # Top 10 hotspots
            ],
            'team_allocations': [
                {
                    'team_id': ta.team_id,
                    'team_name': ta.team_name,
                    'total_debt_score': round(ta.total_debt_score, 2),
                    'file_count': ta.file_count,
                    'estimated_hours': round(ta.estimated_hours, 1),
                    'top_issues': ta.top_issues
                }
                for ta in team_allocations
            ],
            'recommendations': self._generate_recommendations(hotspots, avg_debt_score)
        }
    
    def _generate_recommendations(self, hotspots: List[DebtHotspot], 
                                avg_debt_score: float) -> List[str]:
        """Generate actionable recommendations based on debt analysis"""
        recommendations = []
        
        if avg_debt_score > 70:
            recommendations.append("Critical: Average debt score is very high. Consider dedicating 20% of sprint capacity to debt reduction.")
        elif avg_debt_score > 50:
            recommendations.append("Warning: Technical debt is accumulating. Allocate time for refactoring in upcoming sprints.")
        
        # Analyze common issues
        all_issues = []
        for hotspot in hotspots:
            all_issues.extend(hotspot.primary_issues)
        
        issue_counts = {}
        for issue in all_issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        if issue_counts.get("High Complexity", 0) > len(hotspots) * 0.3:
            recommendations.append("Consider breaking down complex functions and classes to improve maintainability.")
        
        if issue_counts.get("Code Duplication", 0) > len(hotspots) * 0.2:
            recommendations.append("Extract common functionality into reusable modules to reduce duplication.")
        
        if issue_counts.get("Low Test Coverage", 0) > len(hotspots) * 0.4:
            recommendations.append("Increase test coverage, especially for high-risk components.")
        
        if issue_counts.get("Security Vulnerabilities", 0) > 0:
            recommendations.append("Prioritize security issue remediation - these pose immediate risk.")
        
        return recommendations
