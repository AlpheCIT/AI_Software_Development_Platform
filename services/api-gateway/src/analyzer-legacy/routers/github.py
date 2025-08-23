"""
GitHub integration API routes for FastAPI backend.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
import requests
import os

from ..dependencies import get_db_service, get_repo_processor

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/github", tags=["github"])

# Pydantic models
class GitHubConfig(BaseModel):
    token: str
    username: Optional[str] = None
    organization: Optional[str] = None

class RepositoryInfo(BaseModel):
    name: str
    full_name: str
    description: Optional[str]
    html_url: str
    clone_url: str
    default_branch: str
    language: Optional[str]
    size: int
    stargazers_count: int
    forks_count: int
    created_at: str
    updated_at: str

class GitHubIssue(BaseModel):
    title: str
    body: str
    labels: List[str] = []
    assignees: List[str] = []

class CreateIssueResponse(BaseModel):
    issue_number: int
    html_url: str
    title: str
    state: str

@router.get("/")
async def github_status():
    """Check GitHub integration status."""
    return {
        "available": True,
        "message": "GitHub integration is available"
    }

@router.post("/test-connection")
async def test_github_connection(config: GitHubConfig):
    """Test GitHub connection with provided token."""
    try:
        headers = {
            "Authorization": f"token {config.token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # Test connection by getting user info
        response = requests.get(
            "https://api.github.com/user",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            user_data = response.json()
            return {
                "status": "success",
                "message": "Successfully connected to GitHub",
                "user_info": {
                    "login": user_data.get("login"),
                    "name": user_data.get("name"),
                    "public_repos": user_data.get("public_repos"),
                    "followers": user_data.get("followers")
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"GitHub authentication failed: {response.text}"
            )
            
    except requests.RequestException as e:
        logger.error(f"GitHub connection test failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect to GitHub: {str(e)}"
        )

@router.get("/repositories")
async def list_repositories(
    config: GitHubConfig,
    per_page: int = 30,
    page: int = 1
):
    """List GitHub repositories for the authenticated user."""
    try:
        headers = {
            "Authorization": f"token {config.token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # Determine endpoint based on organization
        if config.organization:
            url = f"https://api.github.com/orgs/{config.organization}/repos"
        else:
            url = "https://api.github.com/user/repos"
        
        params = {
            "per_page": min(per_page, 100),
            "page": page,
            "sort": "updated",
            "direction": "desc"
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=10)
        
        if response.status_code == 200:
            repos_data = response.json()
            repositories = [
                RepositoryInfo(
                    name=repo["name"],
                    full_name=repo["full_name"],
                    description=repo["description"],
                    html_url=repo["html_url"],
                    clone_url=repo["clone_url"],
                    default_branch=repo["default_branch"],
                    language=repo["language"],
                    size=repo["size"],
                    stargazers_count=repo["stargazers_count"],
                    forks_count=repo["forks_count"],
                    created_at=repo["created_at"],
                    updated_at=repo["updated_at"]
                )
                for repo in repos_data
            ]
            
            return {
                "repositories": repositories,
                "total": len(repositories),
                "page": page,
                "per_page": per_page
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"GitHub API error: {response.text}"
            )
            
    except requests.RequestException as e:
        logger.error(f"Error listing repositories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list repositories: {str(e)}"
        )

@router.get("/repositories/{owner}/{repo}")
async def get_repository_info(
    owner: str,
    repo: str,
    config: GitHubConfig
):
    """Get detailed information about a specific repository."""
    try:
        headers = {
            "Authorization": f"token {config.token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        response = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            repo_data = response.json()
            return RepositoryInfo(
                name=repo_data["name"],
                full_name=repo_data["full_name"],
                description=repo_data["description"],
                html_url=repo_data["html_url"],
                clone_url=repo_data["clone_url"],
                default_branch=repo_data["default_branch"],
                language=repo_data["language"],
                size=repo_data["size"],
                stargazers_count=repo_data["stargazers_count"],
                forks_count=repo_data["forks_count"],
                created_at=repo_data["created_at"],
                updated_at=repo_data["updated_at"]
            )
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Repository not found: {response.text}"
            )
            
    except requests.RequestException as e:
        logger.error(f"Error getting repository info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get repository info: {str(e)}"
        )

@router.post("/repositories/{owner}/{repo}/issues", response_model=CreateIssueResponse)
async def create_issue(
    owner: str,
    repo: str,
    issue: GitHubIssue,
    config: GitHubConfig
):
    """Create a new issue in a GitHub repository."""
    try:
        headers = {
            "Authorization": f"token {config.token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
        
        issue_data = {
            "title": issue.title,
            "body": issue.body,
            "labels": issue.labels,
            "assignees": issue.assignees
        }
        
        response = requests.post(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers=headers,
            json=issue_data,
            timeout=10
        )
        
        if response.status_code == 201:
            created_issue = response.json()
            return CreateIssueResponse(
                issue_number=created_issue["number"],
                html_url=created_issue["html_url"],
                title=created_issue["title"],
                state=created_issue["state"]
            )
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to create issue: {response.text}"
            )
            
    except requests.RequestException as e:
        logger.error(f"Error creating issue: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create issue: {str(e)}"
        )

@router.get("/repositories/{owner}/{repo}/issues")
async def list_issues(
    owner: str,
    repo: str,
    config: GitHubConfig,
    state: str = "open",
    per_page: int = 30,
    page: int = 1
):
    """List issues for a GitHub repository."""
    try:
        headers = {
            "Authorization": f"token {config.token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        params = {
            "state": state,
            "per_page": min(per_page, 100),
            "page": page,
            "sort": "updated",
            "direction": "desc"
        }
        
        response = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers=headers,
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            issues_data = response.json()
            
            issues = [
                {
                    "number": issue["number"],
                    "title": issue["title"],
                    "body": issue["body"],
                    "state": issue["state"],
                    "html_url": issue["html_url"],
                    "created_at": issue["created_at"],
                    "updated_at": issue["updated_at"],
                    "labels": [label["name"] for label in issue["labels"]],
                    "assignees": [assignee["login"] for assignee in issue["assignees"]]
                }
                for issue in issues_data
            ]
            
            return {
                "issues": issues,
                "total": len(issues),
                "page": page,
                "per_page": per_page,
                "state": state
            }
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"GitHub API error: {response.text}"
            )
            
    except requests.RequestException as e:
        logger.error(f"Error listing issues: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list issues: {str(e)}"
        )

@router.post("/repositories/{owner}/{repo}/analyze-and-create-issues")
async def analyze_and_create_issues(
    owner: str,
    repo: str,
    config: GitHubConfig,
    repository_url: Optional[str] = None,
    branch: str = "main",
    db_service=Depends(get_db_service)
):
    """Analyze repository and create GitHub issues based on findings."""
    try:
        # Use provided URL or construct from owner/repo
        if not repository_url:
            repository_url = f"https://github.com/{owner}/{repo}.git"
        
        # Check if repository is analyzed
        stats_query = """
        FOR node IN codeNodes
        FILTER node.repository == @repo AND node.branch == @branch
        LIMIT 1
        RETURN node
        """
        
        cursor = db_service.db.aql.execute(
            stats_query,
            bind_vars={"repo": repository_url, "branch": branch}
        )
        
        analysis_exists = len(list(cursor)) > 0
        
        if not analysis_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Repository {repository_url} (branch: {branch}) has not been analyzed yet"
            )
        
        # Get analysis results
        analysis_results = await _get_analysis_results_for_issues(
            repository_url,
            branch,
            db_service
        )
        
        # Generate issues based on analysis
        issues_to_create = _generate_github_issues(analysis_results)
        
        # Create issues in GitHub
        created_issues = []
        errors = []
        
        for issue_data in issues_to_create:
            try:
                issue = GitHubIssue(**issue_data)
                created_issue = await create_issue(owner, repo, issue, config)
                created_issues.append(created_issue)
            except Exception as e:
                error_msg = f"Failed to create issue '{issue_data['title']}': {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        return {
            "created_issues": created_issues,
            "total_created": len(created_issues),
            "errors": errors,
            "repository": f"{owner}/{repo}",
            "analysis_url": repository_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing and creating issues: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing and creating issues: {str(e)}"
        )

# Helper functions
async def _get_analysis_results_for_issues(repository_url: str, branch: str, db_service) -> Dict[str, Any]:
    """Get analysis results for GitHub issue generation."""
    # Similar to Jira analysis but focused on GitHub issues
    
    # Get code analysis data
    nodes_query = """
    FOR node IN codeNodes
    FILTER node.repository == @repo AND node.branch == @branch
    RETURN node
    """
    
    nodes_cursor = db_service.db.aql.execute(
        nodes_query,
        bind_vars={"repo": repository_url, "branch": branch}
    )
    nodes_data = list(nodes_cursor)
    
    # Get relationships
    edges_query = """
    FOR edge IN codeRelations
    FILTER edge.repository == @repo AND edge.branch == @branch
    RETURN edge
    """
    
    edges_cursor = db_service.db.aql.execute(
        edges_query,
        bind_vars={"repo": repository_url, "branch": branch}
    )
    edges_data = list(edges_cursor)
    
    return {
        "nodes": nodes_data,
        "edges": edges_data,
        "repository": repository_url,
        "branch": branch
    }

def _generate_github_issues(analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate GitHub issues based on analysis results."""
    issues = []
    nodes = analysis_results["nodes"]
    
    # Security issues
    security_issues = _find_security_issues(nodes)
    for issue in security_issues:
        issues.append({
            "title": f"Security: {issue['title']}",
            "body": f"**Security Issue Detected**\n\n{issue['description']}\n\n**File:** {issue['file']}\n**Line:** {issue.get('line', 'N/A')}\n\n**Recommendation:** {issue['recommendation']}",
            "labels": ["security", "bug"],
            "assignees": []
        })
    
    # Performance issues
    performance_issues = _find_performance_issues(nodes)
    for issue in performance_issues:
        issues.append({
            "title": f"Performance: {issue['title']}",
            "body": f"**Performance Issue Detected**\n\n{issue['description']}\n\n**File:** {issue['file']}\n\n**Impact:** {issue['impact']}\n\n**Suggestion:** {issue['suggestion']}",
            "labels": ["performance", "enhancement"],
            "assignees": []
        })
    
    # Code quality issues
    quality_issues = _find_code_quality_issues(nodes)
    for issue in quality_issues:
        issues.append({
            "title": f"Code Quality: {issue['title']}",
            "body": f"**Code Quality Issue**\n\n{issue['description']}\n\n**File:** {issue['file']}\n\n**Suggestion:** {issue['suggestion']}",
            "labels": ["code-quality", "refactoring"],
            "assignees": []
        })
    
    return issues[:10]  # Limit to 10 issues to avoid spam

def _find_security_issues(nodes: List[Dict]) -> List[Dict[str, Any]]:
    """Find potential security issues in code."""
    issues = []
    secret_patterns = ["password", "secret", "token", "key"]
    
    for node in nodes:
        code = node.get("code", "").lower()
        for pattern in secret_patterns:
            if pattern in code and "=" in code:
                issues.append({
                    "title": f"Potential hardcoded {pattern} detected",
                    "description": f"Found potential hardcoded {pattern} in the codebase.",
                    "file": node.get("file", "unknown"),
                    "line": node.get("lineno", 0),
                    "recommendation": f"Move {pattern} to environment variables or secure configuration."
                })
    
    return issues[:5]  # Limit results

def _find_performance_issues(nodes: List[Dict]) -> List[Dict[str, Any]]:
    """Find potential performance issues in code."""
    issues = []
    
    for node in nodes:
        if node.get("type") in ["function", "method"]:
            code = node.get("code", "")
            code_lines = len(code.split("\n"))
            
            # Check for large functions
            if code_lines > 100:
                issues.append({
                    "title": f"Large function detected: {node.get('name', 'unknown')}",
                    "description": f"Function '{node.get('name', 'unknown')}' has {code_lines} lines, which may impact performance and maintainability.",
                    "file": node.get("file", "unknown"),
                    "impact": "May slow down code execution and make debugging difficult",
                    "suggestion": "Consider breaking this function into smaller, more focused functions."
                })
    
    return issues[:3]  # Limit results

def _find_code_quality_issues(nodes: List[Dict]) -> List[Dict[str, Any]]:
    """Find code quality issues."""
    issues = []
    
    # Find functions without documentation
    undocumented_functions = [
        node for node in nodes
        if node.get("type") in ["function", "method"]
        and not node.get("metadata", {}).get("docstring")
    ]
    
    if len(undocumented_functions) > 10:
        issues.append({
            "title": f"Missing documentation for {len(undocumented_functions)} functions",
            "description": f"Found {len(undocumented_functions)} functions/methods without documentation.",
            "file": "Multiple files",
            "suggestion": "Add docstrings to improve code maintainability and developer experience."
        })
    
    return issues[:2]  # Limit results
