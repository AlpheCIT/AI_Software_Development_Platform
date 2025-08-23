"""
Technical Debt Scoring Service (SCRUM-49)
Implements comprehensive technical debt calculation based on multiple quality metrics.
"""

import logging
import math
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

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
    
    def __init__(self):
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
