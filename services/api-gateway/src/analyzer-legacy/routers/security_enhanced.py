from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime, timedelta

from api.services.security_analysis_service import SecurityAnalysisService
from debt_database import get_database_connection
from app import JiraIntegrationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/security", tags=["security"])

class SecurityAnalysisRequest(BaseModel):
    repository_id: str
    repository_path: Optional[str] = None
    enable_ai_analysis: bool = True
    create_tickets: bool = False
    priority_threshold: str = "high"  # critical, high, medium, low

class SecurityDashboardFilters(BaseModel):
    timeframe_days: int = 30
    severity_filter: Optional[List[str]] = None
    category_filter: Optional[List[str]] = None
    repository_filter: Optional[List[str]] = None

@router.post("/comprehensive-analysis")
async def comprehensive_security_analysis(
    request: SecurityAnalysisRequest,
    background_tasks: BackgroundTasks
):
    """Perform comprehensive security analysis with AI enhancement."""
    
    try:
        logger.info(f"Starting comprehensive security analysis for repository: {request.repository_id}")
        
        security_service = SecurityAnalysisService()
        
        # Get file contents for analysis
        file_contents = await _get_repository_files(request.repository_id, request.repository_path)
        
        if not file_contents:
            raise HTTPException(
                status_code=404, 
                detail=f"No files found for repository: {request.repository_id}"
            )
        
        # Perform comprehensive analysis
        analysis_result = await security_service.comprehensive_security_analysis(
            request.repository_id, 
            file_contents,
            request.enable_ai_analysis
        )
        
        # Store results for historical tracking
        analysis_id = await _store_security_analysis(analysis_result)
        analysis_result['analysis_id'] = analysis_id
        
        # Create Jira tickets if requested
        if request.create_tickets:
            background_tasks.add_task(
                _create_security_tickets,
                analysis_result,
                request.priority_threshold
            )
        
        logger.info(f"Security analysis completed. Analysis ID: {analysis_id}")
        
        return {
            'success': True,
            'analysis_id': analysis_id,
            'security_analysis': analysis_result,
            'tickets_requested': request.create_tickets
        }
        
    except Exception as e:
        logger.error(f"Security analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Security analysis failed: {str(e)}")

@router.get("/manager-dashboard")
async def get_security_manager_dashboard(
    timeframe_days: int = 30,
    repository_id: Optional[str] = None
):
    """Get manager-friendly security dashboard data."""
    
    try:
        logger.info(f"Generating security manager dashboard for {timeframe_days} days")
        
        # Get recent security analyses
        recent_analyses = await _get_recent_security_analyses(
            days=timeframe_days, 
            repository_id=repository_id
        )
        
        if not recent_analyses:
            return {
                'message': 'No recent security analyses found',
                'executive_metrics': _get_default_metrics(),
                'priority_issues': [],
                'security_trends': [],
                'compliance_status': {},
                'recommended_actions': []
            }
        
        # Generate executive metrics
        executive_metrics = _generate_executive_security_metrics(recent_analyses)
        
        # Get priority security issues
        priority_issues = await _get_priority_security_issues(repository_id)
        
        # Calculate security trends
        security_trends = _calculate_security_trends(recent_analyses)
        
        # Get compliance status
        compliance_status = _get_aggregated_compliance_status(recent_analyses)
        
        # Get recommended actions
        recommended_actions = _get_recommended_security_actions(recent_analyses)
        
        return {
            'timeframe_days': timeframe_days,
            'repository_count': len(set([a['repository_id'] for a in recent_analyses])),
            'last_updated': datetime.now().isoformat(),
            'executive_metrics': executive_metrics,
            'priority_issues': priority_issues,
            'security_trends': security_trends,
            'compliance_status': compliance_status,
            'recommended_actions': recommended_actions
        }
        
    except Exception as e:
        logger.error(f"Failed to generate security dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Dashboard generation failed: {str(e)}")

@router.get("/vulnerabilities")
async def get_vulnerabilities(
    repository_id: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get filtered list of security vulnerabilities."""
    
    try:
        vulnerabilities = await _get_filtered_vulnerabilities(
            repository_id=repository_id,
            severity=severity,
            category=category,
            limit=limit,
            offset=offset
        )
        
        total_count = await _get_vulnerabilities_count(
            repository_id=repository_id,
            severity=severity,
            category=category
        )
        
        return {
            'vulnerabilities': vulnerabilities,
            'total_count': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count
        }
        
    except Exception as e:
        logger.error(f"Failed to get vulnerabilities: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get vulnerabilities: {str(e)}")

@router.post("/create-tickets")
async def create_security_tickets(
    analysis_id: str,
    priority_threshold: str = "high",
    assignee: Optional[str] = None
):
    """Create Jira tickets for security vulnerabilities."""
    
    try:
        # Get analysis results
        analysis_result = await _get_security_analysis(analysis_id)
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Security analysis not found")
        
        # Create tickets
        created_tickets = await _create_security_tickets(
            analysis_result, 
            priority_threshold,
            assignee
        )
        
        return {
            'success': True,
            'tickets_created': len(created_tickets),
            'tickets': created_tickets
        }
        
    except Exception as e:
        logger.error(f"Failed to create security tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ticket creation failed: {str(e)}")

@router.get("/analysis/{analysis_id}")
async def get_security_analysis(analysis_id: str):
    """Get specific security analysis results."""
    
    try:
        analysis_result = await _get_security_analysis(analysis_id)
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Security analysis not found")
        
        return {
            'success': True,
            'analysis': analysis_result
        }
        
    except Exception as e:
        logger.error(f"Failed to get security analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get analysis: {str(e)}")

# Helper Functions

async def _get_repository_files(repository_id: str, repository_path: Optional[str] = None) -> Dict[str, str]:
    """Get file contents for security analysis."""
    
    import os
    import fnmatch
    
    # Security-relevant file patterns
    relevant_patterns = [
        '*.py', '*.js', '*.ts', '*.jsx', '*.tsx', '*.java', '*.cs', '*.php', 
        '*.rb', '*.go', '*.rs', '*.cpp', '*.c', '*.h', '*.sql', '*.yaml', '*.yml',
        '*.json', '*.xml', '*.properties', '*.conf', '*.config', '*.env'
    ]
    
    file_contents = {}
    
    if repository_path and os.path.exists(repository_path):
        base_path = repository_path
    else:
        # Use current working directory or default path
        base_path = f"/home/rhelmsjr/Documents/Code/Code_Management_Analyzer"
    
    try:
        for root, dirs, files in os.walk(base_path):
            # Skip common non-source directories
            dirs[:] = [d for d in dirs if d not in {
                '.git', '__pycache__', 'node_modules', '.pytest_cache', 
                'venv', '.venv', 'env', '.env', 'build', 'dist'
            }]
            
            for file in files:
                if any(fnmatch.fnmatch(file, pattern) for pattern in relevant_patterns):
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, base_path)
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            # Only include files with actual content and reasonable size
                            if content.strip() and len(content) < 1_000_000:  # 1MB limit
                                file_contents[relative_path] = content
                    except Exception as e:
                        logger.warning(f"Could not read file {file_path}: {e}")
                        continue
        
        logger.info(f"Loaded {len(file_contents)} files for security analysis")
        return file_contents
        
    except Exception as e:
        logger.error(f"Failed to get repository files: {e}")
        return {}

async def _store_security_analysis(analysis_result: Dict[str, Any]) -> str:
    """Store security analysis results in database."""
    
    try:
        db = get_database_connection()
        
        # Create analysis document
        analysis_doc = {
            '_key': f"security_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'repository_id': analysis_result['repository_id'],
            'analysis_timestamp': analysis_result['analysis_timestamp'],
            'security_score': analysis_result['security_score'],
            'vulnerability_count': analysis_result['vulnerability_count'],
            'critical_count': analysis_result['critical_count'],
            'high_count': analysis_result['high_count'],
            'medium_count': analysis_result['medium_count'],
            'low_count': analysis_result['low_count'],
            'executive_summary': analysis_result['executive_summary'],
            'security_metrics': analysis_result['security_metrics'],
            'compliance_assessment': analysis_result['compliance_assessment'],
            'analysis_type': 'comprehensive_security'
        }
        
        # Store main analysis
        analysis_collection = db.collection('security_analyses')
        analysis_result_doc = analysis_collection.insert(analysis_doc)
        analysis_id = analysis_result_doc['_key']
        
        # Store individual vulnerabilities
        vulnerabilities_collection = db.collection('security_vulnerabilities')
        for vuln in analysis_result['vulnerabilities']:
            vuln_doc = {
                **vuln,
                'analysis_id': analysis_id,
                'repository_id': analysis_result['repository_id'],
                'created_at': analysis_result['analysis_timestamp']
            }
            vulnerabilities_collection.insert(vuln_doc)
        
        logger.info(f"Stored security analysis with ID: {analysis_id}")
        return analysis_id
        
    except Exception as e:
        logger.error(f"Failed to store security analysis: {e}")
        raise

async def _get_recent_security_analyses(days: int, repository_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get recent security analyses from database."""
    
    try:
        db = get_database_connection()
        
        # Calculate date threshold
        threshold_date = datetime.now() - timedelta(days=days)
        threshold_iso = threshold_date.isoformat()
        
        # Build query
        if repository_id:
            aql = """
            FOR analysis IN security_analyses
                FILTER analysis.analysis_timestamp >= @threshold
                FILTER analysis.repository_id == @repo_id
                SORT analysis.analysis_timestamp DESC
                RETURN analysis
            """
            bind_vars = {'threshold': threshold_iso, 'repo_id': repository_id}
        else:
            aql = """
            FOR analysis IN security_analyses
                FILTER analysis.analysis_timestamp >= @threshold
                SORT analysis.analysis_timestamp DESC
                RETURN analysis
            """
            bind_vars = {'threshold': threshold_iso}
        
        cursor = db.aql.execute(aql, bind_vars=bind_vars)
        return list(cursor)
        
    except Exception as e:
        logger.error(f"Failed to get recent security analyses: {e}")
        return []

def _generate_executive_security_metrics(analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate executive-level security metrics."""
    
    if not analyses:
        return _get_default_metrics()
    
    latest_analysis = analyses[0]
    
    # Calculate averages and trends
    avg_security_score = sum([a.get('security_score', 0) for a in analyses]) / len(analyses)
    total_critical = sum([a.get('critical_count', 0) for a in analyses])
    total_high = sum([a.get('high_count', 0) for a in analyses])
    total_vulnerabilities = sum([a.get('vulnerability_count', 0) for a in analyses])
    
    # Calculate trend (comparing first half vs second half of period)
    mid_point = len(analyses) // 2
    if mid_point > 0:
        recent_avg = sum([a.get('security_score', 0) for a in analyses[:mid_point]]) / mid_point
        older_avg = sum([a.get('security_score', 0) for a in analyses[mid_point:]]) / (len(analyses) - mid_point)
        trend_direction = 'improving' if recent_avg > older_avg else 'declining' if recent_avg < older_avg else 'stable'
        trend_percentage = abs(recent_avg - older_avg) / older_avg * 100 if older_avg > 0 else 0
    else:
        trend_direction = 'stable'
        trend_percentage = 0
    
    return {
        'overall_security_score': round(avg_security_score, 1),
        'latest_security_score': latest_analysis.get('security_score', 0),
        'critical_issues_count': total_critical,
        'high_priority_issues_count': total_high,
        'total_vulnerabilities': total_vulnerabilities,
        'repositories_analyzed': len(set([a['repository_id'] for a in analyses])),
        'trend_direction': trend_direction,
        'trend_percentage': round(trend_percentage, 1),
        'compliance_score': _calculate_overall_compliance_score(analyses),
        'average_time_to_fix': 'N/A',  # Would need historical resolution data
        'security_grade': _get_security_grade(avg_security_score)
    }

async def _get_priority_security_issues(repository_id: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    """Get high-priority security issues for manager dashboard."""
    
    try:
        db = get_database_connection()
        
        if repository_id:
            aql = """
            FOR vuln IN security_vulnerabilities
                FILTER vuln.repository_id == @repo_id
                FILTER vuln.severity IN ['critical', 'high']
                SORT vuln.priority_score DESC
                LIMIT @limit
                RETURN vuln
            """
            bind_vars = {'repo_id': repository_id, 'limit': limit}
        else:
            aql = """
            FOR vuln IN security_vulnerabilities
                FILTER vuln.severity IN ['critical', 'high']
                SORT vuln.priority_score DESC
                LIMIT @limit
                RETURN vuln
            """
            bind_vars = {'limit': limit}
        
        cursor = db.aql.execute(aql, bind_vars=bind_vars)
        issues = list(cursor)
        
        # Format for dashboard display
        formatted_issues = []
        for issue in issues:
            formatted_issues.append({
                'id': issue.get('id', 'unknown'),
                'title': issue.get('description', 'Security Issue'),
                'category': issue.get('category', 'unknown'),
                'severity': issue.get('severity', 'medium'),
                'repository': issue.get('repository_id', 'unknown'),
                'file_path': issue.get('file_path', ''),
                'line_number': issue.get('line_number', 0),
                'risk_score': round(issue.get('priority_score', 50), 1),
                'cwe': issue.get('cwe', 'Unknown'),
                'discovered_at': issue.get('discovered_at', ''),
                'ai_insights': issue.get('ai_insights', {})
            })
        
        return formatted_issues
        
    except Exception as e:
        logger.error(f"Failed to get priority security issues: {e}")
        return []

def _calculate_security_trends(analyses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Calculate security trends over time."""
    
    if len(analyses) < 2:
        return []
    
    # Group by date and calculate daily metrics
    daily_metrics = {}
    
    for analysis in analyses:
        analysis_date = analysis['analysis_timestamp'][:10]  # YYYY-MM-DD
        
        if analysis_date not in daily_metrics:
            daily_metrics[analysis_date] = {
                'date': analysis_date,
                'security_score': [],
                'critical_count': [],
                'high_count': [],
                'total_vulnerabilities': []
            }
        
        daily_metrics[analysis_date]['security_score'].append(analysis.get('security_score', 0))
        daily_metrics[analysis_date]['critical_count'].append(analysis.get('critical_count', 0))
        daily_metrics[analysis_date]['high_count'].append(analysis.get('high_count', 0))
        daily_metrics[analysis_date]['total_vulnerabilities'].append(analysis.get('vulnerability_count', 0))
    
    # Calculate averages for each day
    trends = []
    for date, metrics in sorted(daily_metrics.items()):
        trends.append({
            'date': date,
            'security_score': round(sum(metrics['security_score']) / len(metrics['security_score']), 1),
            'critical_count': round(sum(metrics['critical_count']) / len(metrics['critical_count']), 1),
            'high_count': round(sum(metrics['high_count']) / len(metrics['high_count']), 1),
            'total_vulnerabilities': round(sum(metrics['total_vulnerabilities']) / len(metrics['total_vulnerabilities']), 1)
        })
    
    return trends

async def _create_security_tickets(
    analysis_result: Dict[str, Any], 
    priority_threshold: str = "high",
    assignee: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Create Jira tickets for high-priority security vulnerabilities."""
    
    try:
        jira_service = JiraIntegrationService()
        created_tickets = []
        
        # Filter vulnerabilities by priority threshold
        threshold_levels = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
        min_level = threshold_levels.get(priority_threshold, 3)
        
        priority_vulns = [
            v for v in analysis_result['vulnerabilities']
            if threshold_levels.get(v['severity'], 1) >= min_level
        ]
        
        # Group similar vulnerabilities
        grouped_vulns = _group_similar_vulnerabilities(priority_vulns)
        
        for group in grouped_vulns:
            ticket_data = _create_security_ticket_data(group, assignee)
            
            try:
                ticket_result = await jira_service.create_issue(ticket_data)
                
                if ticket_result and ticket_result.get('key'):
                    created_tickets.append({
                        'ticket_key': ticket_result['key'],
                        'ticket_url': ticket_result.get('self', ''),
                        'vulnerability_count': len(group['vulnerabilities']),
                        'severity': group['severity'],
                        'category': group['category'],
                        'summary': ticket_data['summary']
                    })
                    
                    logger.info(f"Created security ticket: {ticket_result['key']}")
                    
            except Exception as e:
                logger.error(f"Failed to create ticket for security group: {e}")
                continue
        
        return created_tickets
        
    except Exception as e:
        logger.error(f"Failed to create security tickets: {e}")
        return []

def _group_similar_vulnerabilities(vulnerabilities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Group similar vulnerabilities for efficient ticket creation."""
    
    groups = {}
    
    for vuln in vulnerabilities:
        # Group by category and type
        group_key = f"{vuln['category']}_{vuln['type']}"
        
        if group_key not in groups:
            groups[group_key] = {
                'category': vuln['category'],
                'type': vuln['type'],
                'severity': vuln['severity'],
                'vulnerabilities': []
            }
        
        groups[group_key]['vulnerabilities'].append(vuln)
        
        # Update severity to highest in group
        severity_order = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
        if severity_order.get(vuln['severity'], 1) > severity_order.get(groups[group_key]['severity'], 1):
            groups[group_key]['severity'] = vuln['severity']
    
    return list(groups.values())

def _create_security_ticket_data(group: Dict[str, Any], assignee: Optional[str] = None) -> Dict[str, Any]:
    """Create Jira ticket data for a group of security vulnerabilities."""
    
    vulns = group['vulnerabilities']
    category = group['category']
    vuln_type = group['type']
    severity = group['severity']
    
    # Create summary
    summary = f"Security: {category.title()} - {vuln_type.replace('_', ' ').title()} ({len(vulns)} instances)"
    
    # Create description
    description = f"""
*Security Vulnerability Report*

*Category:* {category.title()}
*Type:* {vuln_type.replace('_', ' ').title()}
*Severity:* {severity.upper()}
*Instances Found:* {len(vulns)}

*Affected Files:*
{chr(10).join([f"• {v['file_path']} (line {v['line_number']})" for v in vulns[:10]])}
{f'{chr(10)}... and {len(vulns) - 10} more files' if len(vulns) > 10 else ''}

*Description:*
{vulns[0].get('description', 'Security vulnerability detected')}

*CWE Reference:* {vulns[0].get('cwe', 'Unknown')}

*AI Insights:*
{vulns[0].get('ai_insights', {}).get('business_impact', 'Manual review required')}

*Recommended Actions:*
{vulns[0].get('ai_insights', {}).get('remediation_steps', 'Please review and implement security fixes')}

*Testing Requirements:*
{vulns[0].get('ai_insights', {}).get('testing_requirements', 'Verify fixes do not break functionality')}
"""
    
    # Map severity to Jira priority
    priority_mapping = {
        'critical': 'Highest',
        'high': 'High',
        'medium': 'Medium',
        'low': 'Low'
    }
    
    ticket_data = {
        'summary': summary,
        'description': description,
        'priority': priority_mapping.get(severity, 'Medium'),
        'labels': ['security', 'automated', category, vuln_type],
        'components': ['Security'],
        'issuetype': 'Bug'
    }
    
    if assignee:
        ticket_data['assignee'] = assignee
    
    return ticket_data

def _get_default_metrics() -> Dict[str, Any]:
    """Get default metrics when no data is available."""
    
    return {
        'overall_security_score': 0,
        'latest_security_score': 0,
        'critical_issues_count': 0,
        'high_priority_issues_count': 0,
        'total_vulnerabilities': 0,
        'repositories_analyzed': 0,
        'trend_direction': 'stable',
        'trend_percentage': 0,
        'compliance_score': 0,
        'average_time_to_fix': 'N/A',
        'security_grade': 'N/A'
    }

def _calculate_overall_compliance_score(analyses: List[Dict[str, Any]]) -> int:
    """Calculate overall compliance score from analyses."""
    
    if not analyses:
        return 0
    
    total_score = 0
    total_frameworks = 0
    
    for analysis in analyses:
        compliance = analysis.get('compliance_assessment', {})
        
        for framework, status in compliance.items():
            if isinstance(status, dict) and 'status' in status:
                if status['status'] == 'Compliant':
                    total_score += 100
                elif status['status'] == 'Minor Issues':
                    total_score += 70
                else:  # Non-Compliant
                    total_score += 30
                total_frameworks += 1
    
    return round(total_score / total_frameworks if total_frameworks > 0 else 0)

def _get_security_grade(score: float) -> str:
    """Get letter grade from security score."""
    
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

def _get_aggregated_compliance_status(analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Get aggregated compliance status across all analyses."""
    
    frameworks = {}
    
    for analysis in analyses:
        compliance = analysis.get('compliance_assessment', {})
        
        for framework, status in compliance.items():
            if framework not in frameworks:
                frameworks[framework] = {
                    'compliant_count': 0,
                    'minor_issues_count': 0,
                    'non_compliant_count': 0,
                    'total_assessments': 0
                }
            
            frameworks[framework]['total_assessments'] += 1
            
            if isinstance(status, dict) and 'status' in status:
                if status['status'] == 'Compliant':
                    frameworks[framework]['compliant_count'] += 1
                elif status['status'] == 'Minor Issues':
                    frameworks[framework]['minor_issues_count'] += 1
                else:
                    frameworks[framework]['non_compliant_count'] += 1
    
    # Calculate overall status for each framework
    for framework in frameworks:
        data = frameworks[framework]
        total = data['total_assessments']
        
        if total > 0:
            compliant_pct = (data['compliant_count'] / total) * 100
            
            if compliant_pct >= 90:
                data['overall_status'] = 'Compliant'
            elif compliant_pct >= 70:
                data['overall_status'] = 'Minor Issues'
            else:
                data['overall_status'] = 'Non-Compliant'
            
            data['compliance_percentage'] = round(compliant_pct, 1)
    
    return frameworks

def _get_recommended_security_actions(analyses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Get recommended security actions from recent analyses."""
    
    action_priorities = {}
    
    for analysis in analyses:
        for action in analysis.get('recommended_actions', []):
            action_key = action.get('title', 'Unknown Action')
            
            if action_key not in action_priorities:
                action_priorities[action_key] = {
                    'title': action_key,
                    'description': action.get('description', ''),
                    'priority': action.get('priority', 'Medium'),
                    'total_hours': 0,
                    'affected_repositories': set(),
                    'vulnerability_count': 0
                }
            
            action_priorities[action_key]['total_hours'] += action.get('estimated_hours', 0)
            action_priorities[action_key]['affected_repositories'].add(analysis['repository_id'])
            action_priorities[action_key]['vulnerability_count'] += action.get('vulnerability_count', 0)
    
    # Convert to list and format
    actions = []
    for action_data in action_priorities.values():
        actions.append({
            'title': action_data['title'],
            'description': action_data['description'],
            'priority': action_data['priority'],
            'estimated_hours': action_data['total_hours'],
            'affected_repositories': len(action_data['affected_repositories']),
            'vulnerability_count': action_data['vulnerability_count'],
            'impact_level': 'High' if action_data['vulnerability_count'] > 5 else 'Medium'
        })
    
    # Sort by priority and impact
    priority_order = {'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1}
    return sorted(
        actions, 
        key=lambda x: (priority_order.get(x['priority'], 1), x['vulnerability_count']), 
        reverse=True
    )[:10]

# Additional helper functions for database operations
async def _get_filtered_vulnerabilities(
    repository_id: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """Get filtered vulnerabilities from database."""
    
    try:
        db = get_database_connection()
        
        # Build dynamic query
        filters = []
        bind_vars = {'limit': limit, 'offset': offset}
        
        if repository_id:
            filters.append('vuln.repository_id == @repo_id')
            bind_vars['repo_id'] = repository_id
            
        if severity:
            filters.append('vuln.severity == @severity')
            bind_vars['severity'] = severity
            
        if category:
            filters.append('vuln.category == @category')
            bind_vars['category'] = category
        
        filter_clause = f"FILTER {' AND '.join(filters)}" if filters else ""
        
        aql = f"""
        FOR vuln IN security_vulnerabilities
            {filter_clause}
            SORT vuln.priority_score DESC
            LIMIT @offset, @limit
            RETURN vuln
        """
        
        cursor = db.aql.execute(aql, bind_vars=bind_vars)
        return list(cursor)
        
    except Exception as e:
        logger.error(f"Failed to get filtered vulnerabilities: {e}")
        return []

async def _get_vulnerabilities_count(
    repository_id: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None
) -> int:
    """Get count of filtered vulnerabilities."""
    
    try:
        db = get_database_connection()
        
        filters = []
        bind_vars = {}
        
        if repository_id:
            filters.append('vuln.repository_id == @repo_id')
            bind_vars['repo_id'] = repository_id
            
        if severity:
            filters.append('vuln.severity == @severity')
            bind_vars['severity'] = severity
            
        if category:
            filters.append('vuln.category == @category')
            bind_vars['category'] = category
        
        filter_clause = f"FILTER {' AND '.join(filters)}" if filters else ""
        
        aql = f"""
        FOR vuln IN security_vulnerabilities
            {filter_clause}
            COLLECT WITH COUNT INTO length
            RETURN length
        """
        
        cursor = db.aql.execute(aql, bind_vars=bind_vars)
        result = list(cursor)
        return result[0] if result else 0
        
    except Exception as e:
        logger.error(f"Failed to get vulnerabilities count: {e}")
        return 0

async def _get_security_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Get specific security analysis from database."""
    
    try:
        db = get_database_connection()
        
        # Get main analysis
        analysis_collection = db.collection('security_analyses')
        analysis_doc = analysis_collection.get(analysis_id)
        
        if not analysis_doc:
            return None
        
        # Get associated vulnerabilities
        aql = """
        FOR vuln IN security_vulnerabilities
            FILTER vuln.analysis_id == @analysis_id
            RETURN vuln
        """
        
        cursor = db.aql.execute(aql, bind_vars={'analysis_id': analysis_id})
        vulnerabilities = list(cursor)
        
        # Combine results
        result = dict(analysis_doc)
        result['vulnerabilities'] = vulnerabilities
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to get security analysis {analysis_id}: {e}")
        return None
