"""
Security Analysis API Router
Provides endpoints for comprehensive security analysis and manager dashboard functionality.
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from ..services.security_analysis_service import SecurityAnalysisService
from ..repository_analyzer import RepositoryAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/security", tags=["security"])

# Request/Response Models
class SecurityAnalysisRequest(BaseModel):
    repository_id: str = Field(..., description="Repository identifier")
    analysis_type: str = Field(default="comprehensive", description="Type of analysis to perform")
    include_ai_analysis: bool = Field(default=True, description="Whether to include AI-enhanced analysis")

class SecurityAnalysisResponse(BaseModel):
    success: bool
    analysis_id: str
    security_analysis: Dict[str, Any]
    message: str

class ManagerDashboardResponse(BaseModel):
    success: bool
    dashboard_data: Dict[str, Any]
    generated_at: str

class JiraTicketRequest(BaseModel):
    vulnerability_id: str
    priority: str = Field(default="High", description="Ticket priority")
    assignee: Optional[str] = Field(default=None, description="Ticket assignee")
    additional_context: Optional[str] = Field(default=None, description="Additional context for ticket")

# Initialize service
security_service = SecurityAnalysisService()

@router.post("/comprehensive-analysis", response_model=SecurityAnalysisResponse)
async def comprehensive_security_analysis(request: SecurityAnalysisRequest, background_tasks: BackgroundTasks):
    """
    Perform comprehensive security analysis with AI enhancement.
    
    This endpoint analyzes a repository for security vulnerabilities using pattern matching
    and AI-enhanced analysis to provide manager-friendly insights and recommendations.
    """
    try:
        logger.info(f"Starting comprehensive security analysis for repository: {request.repository_id}")
        
        # Get repository files for analysis
        file_contents = await _get_repository_files(request.repository_id)
        
        if not file_contents:
            raise HTTPException(
                status_code=400, 
                detail=f"No files found for repository: {request.repository_id}"
            )
        
        # Perform comprehensive analysis
        analysis_result = await security_service.comprehensive_security_analysis(
            request.repository_id, file_contents
        )
        
        # Generate unique analysis ID
        analysis_id = f"security_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Schedule background tasks for Jira ticket creation if critical issues found
        critical_issues = [
            vuln for vuln in analysis_result['vulnerabilities'] 
            if vuln['severity'] == 'critical'
        ]
        
        if critical_issues and len(critical_issues) <= 5:  # Auto-create tickets for <= 5 critical issues
            background_tasks.add_task(
                _auto_create_security_tickets, 
                critical_issues, 
                request.repository_id
            )
        
        return SecurityAnalysisResponse(
            success=True,
            analysis_id=analysis_id,
            security_analysis=analysis_result,
            message=f"Security analysis completed. Found {len(analysis_result['vulnerabilities'])} vulnerabilities with security score {analysis_result['security_score']}"
        )
        
    except Exception as e:
        logger.error(f"Security analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Security analysis failed: {str(e)}")

@router.get("/manager-dashboard", response_model=ManagerDashboardResponse)
async def get_security_manager_dashboard(days: int = 30):
    """
    Get manager-friendly security dashboard data.
    
    Provides executive-level security metrics, priority issues, trends,
    and recommended actions for the specified timeframe.
    """
    try:
        logger.info(f"Generating security manager dashboard for last {days} days")
        
        # Get dashboard data
        dashboard_data = await security_service.get_security_manager_dashboard(days)
        
        return ManagerDashboardResponse(
            success=True,
            dashboard_data=dashboard_data,
            generated_at=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to generate security dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Dashboard generation failed: {str(e)}")

@router.post("/create-jira-ticket")
async def create_security_jira_ticket(request: JiraTicketRequest):
    """
    Create a Jira ticket for a specific security vulnerability.
    
    Creates a comprehensive Jira ticket with vulnerability details,
    remediation steps, and business impact assessment.
    """
    try:
        logger.info(f"Creating Jira ticket for vulnerability: {request.vulnerability_id}")
        
        # Get vulnerability details
        vulnerability = await _get_vulnerability_details(request.vulnerability_id)
        
        if not vulnerability:
            raise HTTPException(
                status_code=404, 
                detail=f"Vulnerability not found: {request.vulnerability_id}"
            )
        
        # Create Jira ticket
        ticket_result = await _create_security_jira_ticket(
            vulnerability, 
            request.priority, 
            request.assignee,
            request.additional_context
        )
        
        return {
            "success": True,
            "ticket_key": ticket_result.get("key"),
            "ticket_url": ticket_result.get("url"),
            "message": f"Jira ticket created successfully for vulnerability {request.vulnerability_id}"
        }
        
    except Exception as e:
        logger.error(f"Failed to create Jira ticket: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Jira ticket creation failed: {str(e)}")

@router.get("/vulnerability/{vulnerability_id}")
async def get_vulnerability_details(vulnerability_id: str):
    """
    Get detailed information about a specific vulnerability.
    
    Returns comprehensive vulnerability information including context,
    remediation suggestions, and business impact assessment.
    """
    try:
        vulnerability = await _get_vulnerability_details(vulnerability_id)
        
        if not vulnerability:
            raise HTTPException(
                status_code=404, 
                detail=f"Vulnerability not found: {vulnerability_id}"
            )
        
        return {
            "success": True,
            "vulnerability": vulnerability
        }
        
    except Exception as e:
        logger.error(f"Failed to get vulnerability details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve vulnerability: {str(e)}")

@router.get("/trends")
async def get_security_trends(days: int = 90):
    """
    Get security trends and historical analysis data.
    
    Returns trend data for security scores, vulnerability counts,
    and compliance metrics over the specified timeframe.
    """
    try:
        logger.info(f"Getting security trends for last {days} days")
        
        # Get recent analyses for trend calculation
        recent_analyses = await security_service._get_recent_security_analyses(days)
        
        # Calculate trends
        trends = security_service._calculate_security_trends(recent_analyses)
        
        return {
            "success": True,
            "trends": trends,
            "timeframe_days": days,
            "data_points": len(trends)
        }
        
    except Exception as e:
        logger.error(f"Failed to get security trends: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Trend analysis failed: {str(e)}")

@router.post("/trigger-analysis/{repository_id}")
async def trigger_security_analysis(repository_id: str, background_tasks: BackgroundTasks):
    """
    Trigger a security analysis for a specific repository.
    
    Initiates a comprehensive security analysis in the background
    and returns immediately with a task ID for tracking.
    """
    try:
        logger.info(f"Triggering security analysis for repository: {repository_id}")
        
        # Add background task
        task_id = f"security_task_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        background_tasks.add_task(
            _background_security_analysis,
            repository_id,
            task_id
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "message": f"Security analysis started for repository {repository_id}",
            "status": "running"
        }
        
    except Exception as e:
        logger.error(f"Failed to trigger security analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis trigger failed: {str(e)}")

# Helper Functions
async def _get_repository_files(repository_id: str) -> Dict[str, str]:
    """Get repository files for analysis."""
    
    try:
        # Use existing repository analyzer to get files
        analyzer = RepositoryAnalyzer()
        
        # For now, analyze current repository - in production this would
        # fetch files from the specified repository
        repo_path = "/home/rhelmsjr/Documents/Code/Code_Management_Analyzer"
        
        analysis_result = await analyzer.analyze_repository(repo_path)
        
        # Extract file contents from analysis result
        file_contents = {}
        
        if 'files' in analysis_result:
            for file_info in analysis_result['files']:
                file_path = file_info.get('path', '')
                
                # Read file content if it's a text file
                if file_path and _is_text_file(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            relative_path = file_path.replace(repo_path, '').lstrip('/')
                            file_contents[relative_path] = content
                    except Exception as e:
                        logger.warning(f"Could not read file {file_path}: {e}")
                        continue
        
        return file_contents
        
    except Exception as e:
        logger.error(f"Failed to get repository files: {e}")
        return {}

def _is_text_file(file_path: str) -> bool:
    """Check if file is a text file that should be analyzed."""
    
    text_extensions = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.h', '.hpp',
        '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala', '.clj',
        '.sql', '.html', '.htm', '.css', '.scss', '.less', '.xml', '.json',
        '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.properties',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
    }
    
    # Check file extension
    for ext in text_extensions:
        if file_path.lower().endswith(ext):
            return True
    
    # Check for files without extensions that are typically text
    filename = file_path.split('/')[-1].lower()
    text_files = {
        'dockerfile', 'makefile', 'readme', 'license', 'changelog',
        'contributing', 'authors', 'todo', 'notes'
    }
    
    return filename in text_files

async def _get_vulnerability_details(vulnerability_id: str) -> Optional[Dict[str, Any]]:
    """Get vulnerability details from database."""
    
    if not security_service.db.is_connected():
        return None
    
    try:
        query = """
        FOR vuln IN security_vulnerabilities
            FILTER vuln._key == @vuln_id
            RETURN vuln
        """
        
        cursor = security_service.db.db.aql.execute(query, bind_vars={'vuln_id': vulnerability_id})
        results = list(cursor)
        
        return results[0] if results else None
        
    except Exception as e:
        logger.error(f"Failed to get vulnerability details: {e}")
        return None

async def _create_security_jira_ticket(
    vulnerability: Dict[str, Any], 
    priority: str, 
    assignee: Optional[str],
    additional_context: Optional[str]
) -> Dict[str, Any]:
    """Create a Jira ticket for a security vulnerability."""
    
    try:
        # Import Jira service
        from ..main import jira_service
        
        # Build ticket description
        description = f"""
*Security Vulnerability Report*

*Category:* {vulnerability['category'].title()} - {vulnerability['subcategory'].replace('_', ' ').title()}
*Severity:* {vulnerability['severity'].upper()}
*Risk Score:* {vulnerability.get('risk_score', 'Unknown')}
*File:* {vulnerability['file_path']}
*Line:* {vulnerability['line_number']}

*Description:*
{vulnerability['description']}

*Business Impact:*
{vulnerability.get('business_impact', 'Security vulnerability requiring attention')}

*Code Context:*
{{{code}}}
{vulnerability.get('context', {}).get('match_line', '')}
{{{code}}}

*Remediation Suggestion:*
{vulnerability['remediation_suggestion']}

*Additional Context:*
{additional_context or 'Created automatically from security analysis'}

*Exploitability:* {vulnerability.get('exploitability', 'Unknown')}
*Confidence:* {vulnerability.get('confidence', 0.0):.2f}
"""
        
        # Create ticket
        ticket_data = {
            'summary': f"Security: {vulnerability['description'][:100]}...",
            'description': description,
            'priority': priority,
            'labels': ['security', 'vulnerability', vulnerability['category'], vulnerability['severity']],
            'components': ['Security'],
            'assignee': assignee
        }
        
        result = await jira_service.create_issue(ticket_data)
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to create security Jira ticket: {e}")
        raise

async def _auto_create_security_tickets(critical_issues: List[Dict[str, Any]], repository_id: str):
    """Automatically create Jira tickets for critical security issues."""
    
    try:
        logger.info(f"Auto-creating {len(critical_issues)} security tickets for repository {repository_id}")
        
        for issue in critical_issues:
            try:
                await _create_security_jira_ticket(
                    issue, 
                    "Critical", 
                    None,  # No specific assignee for auto-created tickets
                    f"Automatically created from security analysis of {repository_id}"
                )
                
                logger.info(f"Created ticket for vulnerability {issue['id']}")
                
            except Exception as e:
                logger.error(f"Failed to create ticket for vulnerability {issue['id']}: {e}")
                continue
        
        logger.info(f"Completed auto-creation of security tickets for {repository_id}")
        
    except Exception as e:
        logger.error(f"Auto ticket creation failed: {e}")

async def _background_security_analysis(repository_id: str, task_id: str):
    """Run security analysis in background."""
    
    try:
        logger.info(f"Starting background security analysis {task_id} for repository {repository_id}")
        
        # Get repository files
        file_contents = await _get_repository_files(repository_id)
        
        if file_contents:
            # Perform analysis
            analysis_result = await security_service.comprehensive_security_analysis(
                repository_id, file_contents
            )
            
            logger.info(f"Background analysis {task_id} completed with score {analysis_result['security_score']}")
        else:
            logger.warning(f"No files found for background analysis {task_id}")
        
    except Exception as e:
        logger.error(f"Background security analysis {task_id} failed: {e}")
