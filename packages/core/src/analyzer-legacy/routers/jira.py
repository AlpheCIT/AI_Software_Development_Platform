"""
Jira integration API routes for FastAPI backend.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

try:
    from backend.jira_integration import JiraService
    from backend.story_generator import StoryGenerator
    JIRA_AVAILABLE = True
except ImportError:
    JIRA_AVAILABLE = False

from ..dependencies import get_db_service, get_repo_processor

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/jira", tags=["jira"])

# Pydantic models
class JiraConfig(BaseModel):
    server_url: str
    username: str
    api_token: str
    project_key: str

class StoryRequest(BaseModel):
    repository_url: str
    branch: str = "main"
    jira_config: JiraConfig
    story_types: List[str] = Field(
        default=["architecture", "security", "performance", "maintainability"],
        description="Types of stories to generate"
    )

class JiraStory(BaseModel):
    summary: str
    description: str
    labels: List[str]
    priority: str
    story_points: int
    acceptance_criteria: List[str]

class CreateStoriesResponse(BaseModel):
    created_stories: List[Dict[str, Any]]
    total_created: int
    errors: List[str]

# Global Jira service instance
jira_service: Optional[Any] = None

def get_jira_service(config: JiraConfig):
    """Get or create Jira service instance."""
    global jira_service
    
    if not JIRA_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Jira integration not available"
        )
    
    try:
        if jira_service is None:
            jira_service = JiraService({
                "jira": {
                    "server_url": config.server_url,
                    "username": config.username,
                    "api_token": config.api_token,
                    "project_key": config.project_key
                }
            })
        return jira_service
    except Exception as e:
        logger.error(f"Failed to initialize Jira service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to Jira: {str(e)}"
        )

@router.get("/")
async def jira_status():
    """Check Jira integration availability."""
    return {
        "available": JIRA_AVAILABLE,
        "message": "Jira integration is available" if JIRA_AVAILABLE else "Jira integration not available"
    }

@router.post("/test-connection")
async def test_jira_connection(config: JiraConfig):
    """Test Jira connection with provided credentials."""
    try:
        jira = get_jira_service(config)
        
        # Test connection by getting project info
        project_info = jira.get_project_info(config.project_key)
        
        return {
            "status": "success",
            "message": "Successfully connected to Jira",
            "project_info": project_info
        }
    except Exception as e:
        logger.error(f"Jira connection test failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to Jira: {str(e)}"
        )

@router.post("/generate-stories")
async def generate_stories(
    request: StoryRequest,
    db_service=Depends(get_db_service),
    repo_processor=Depends(get_repo_processor)
):
    """Generate Jira stories from repository analysis."""
    try:
        # Get repository analysis results
        # First check if repository is already analyzed
        stats_query = """
        FOR node IN codeNodes
        FILTER node.repository == @repo AND node.branch == @branch
        LIMIT 1
        RETURN node
        """
        
        cursor = db_service.db.aql.execute(
            stats_query,
            bind_vars={"repo": request.repository_url, "branch": request.branch}
        )
        
        analysis_exists = len(list(cursor)) > 0
        
        if not analysis_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Repository {request.repository_url} (branch: {request.branch}) has not been analyzed yet"
            )
        
        # Get analysis results for story generation
        analysis_results = await _get_analysis_results(
            request.repository_url,
            request.branch,
            db_service
        )
        
        # Initialize story generator
        story_generator = StoryGenerator({
            "story_generation": {
                "max_stories_per_type": 5,
                "min_severity": "medium"
            }
        })
        
        # Generate stories based on analysis
        generated_stories = story_generator.generate_stories_from_analysis(analysis_results)
        
        # Filter by requested story types
        filtered_stories = [
            story for story in generated_stories
            if any(story_type in story.get("labels", []) for story_type in request.story_types)
        ]
        
        return {
            "repository": request.repository_url,
            "branch": request.branch,
            "generated_stories": filtered_stories,
            "total_generated": len(filtered_stories),
            "story_types": request.story_types
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating stories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating stories: {str(e)}"
        )

@router.post("/create-stories", response_model=CreateStoriesResponse)
async def create_jira_stories(
    request: StoryRequest,
    db_service=Depends(get_db_service),
    repo_processor=Depends(get_repo_processor)
):
    """Generate and create Jira stories from repository analysis."""
    try:
        # Initialize Jira service
        jira = get_jira_service(request.jira_config)
        
        # Generate stories first
        stories_response = await generate_stories(request, db_service, repo_processor)
        generated_stories = stories_response["generated_stories"]
        
        if not generated_stories:
            return CreateStoriesResponse(
                created_stories=[],
                total_created=0,
                errors=["No stories generated from analysis"]
            )
        
        # Create stories in Jira
        created_stories = []
        errors = []
        
        for story in generated_stories:
            try:
                # Create story in Jira
                jira_story = jira.create_story(
                    project_key=request.jira_config.project_key,
                    summary=story["summary"],
                    description=story["description"],
                    labels=story.get("labels", []),
                    priority=story.get("priority", "Medium"),
                    story_points=story.get("story_points", 3)
                )
                
                created_stories.append({
                    "jira_key": jira_story["key"],
                    "jira_url": f"{request.jira_config.server_url}/browse/{jira_story['key']}",
                    "summary": story["summary"],
                    "priority": story.get("priority", "Medium"),
                    "story_points": story.get("story_points", 3)
                })
                
            except Exception as e:
                error_msg = f"Failed to create story '{story['summary']}': {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        return CreateStoriesResponse(
            created_stories=created_stories,
            total_created=len(created_stories),
            errors=errors
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Jira stories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating Jira stories: {str(e)}"
        )

@router.get("/projects/{project_key}")
async def get_project_info(project_key: str, config: JiraConfig):
    """Get information about a Jira project."""
    try:
        jira = get_jira_service(config)
        project_info = jira.get_project_info(project_key)
        
        return {
            "project_key": project_key,
            "project_info": project_info
        }
    except Exception as e:
        logger.error(f"Error getting project info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found or access denied: {str(e)}"
        )

# Helper functions
async def _get_analysis_results(repository_url: str, branch: str, db_service) -> Dict[str, Any]:
    """Get analysis results for a repository."""
    
    # Get repository metadata
    repo_query = """
    FOR repo IN repositories
    FILTER repo.url == @repo
    RETURN repo
    """
    
    repo_cursor = db_service.db.aql.execute(
        repo_query,
        bind_vars={"repo": repository_url}
    )
    repo_data = list(repo_cursor)
    
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
    
    # Analyze the data for story generation
    analysis_results = {
        "repository_metadata": repo_data[0] if repo_data else {},
        "architectural_analysis": _analyze_architecture(nodes_data, edges_data),
        "security_analysis": _analyze_security(nodes_data),
        "performance_analysis": _analyze_performance(nodes_data),
        "maintainability_analysis": _analyze_maintainability(nodes_data),
        "documentation_analysis": _analyze_documentation(nodes_data)
    }
    
    return analysis_results

def _analyze_architecture(nodes: List[Dict], edges: List[Dict]) -> Dict[str, Any]:
    """Analyze architectural issues."""
    large_files = [
        node for node in nodes
        if node.get("type") == "file" and len(node.get("code", "").split("\n")) > 500
    ]
    
    # Simple circular dependency detection
    # (In a real implementation, this would be more sophisticated)
    circular_deps = []
    
    return {
        "large_files": large_files[:5],  # Limit to top 5
        "circular_dependencies": circular_deps,
        "dead_code": []  # Would need more analysis
    }

def _analyze_security(nodes: List[Dict]) -> Dict[str, Any]:
    """Analyze security issues."""
    secret_patterns = ["password", "secret", "token", "key", "api_key"]
    potential_secrets = []
    
    for node in nodes:
        code = node.get("code", "").lower()
        for pattern in secret_patterns:
            if pattern in code and "=" in code:
                potential_secrets.append({
                    "file": node.get("file"),
                    "type": pattern,
                    "line": node.get("lineno", 0)
                })
    
    return {
        "potential_secrets": potential_secrets[:10],  # Limit results
        "vulnerable_dependencies": [],  # Would need dependency analysis
        "insecure_configurations": []
    }

def _analyze_performance(nodes: List[Dict]) -> Dict[str, Any]:
    """Analyze performance issues."""
    # Simple heuristics for performance issues
    large_loops = []
    inefficient_queries = []
    
    for node in nodes:
        code = node.get("code", "")
        if "for" in code and "for" in code:  # Nested loops
            large_loops.append(node)
    
    return {
        "large_loops": large_loops[:5],
        "inefficient_queries": inefficient_queries,
        "memory_issues": []
    }

def _analyze_maintainability(nodes: List[Dict]) -> Dict[str, Any]:
    """Analyze maintainability issues."""
    complex_functions = []
    code_duplication = []
    
    # Find large functions (simple heuristic)
    for node in nodes:
        if node.get("type") in ["function", "method"]:
            code_lines = len(node.get("code", "").split("\n"))
            if code_lines > 50:
                complex_functions.append(node)
    
    return {
        "complex_functions": complex_functions[:5],
        "code_duplication": code_duplication,
        "technical_debt": []
    }

def _analyze_documentation(nodes: List[Dict]) -> Dict[str, Any]:
    """Analyze documentation issues."""
    has_readme = any(
        "readme" in node.get("file", "").lower()
        for node in nodes
        if node.get("type") == "file"
    )
    
    functions_without_docs = [
        node for node in nodes
        if node.get("type") in ["function", "method"]
        and not node.get("metadata", {}).get("docstring")
    ]
    
    return {
        "has_readme": has_readme,
        "has_api_docs": False,  # Would need more analysis
        "functions_without_docs": len(functions_without_docs),
        "coverage_percentage": 0.0
    }
