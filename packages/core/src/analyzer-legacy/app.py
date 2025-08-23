"""
FastAPI backend for the Code Management Analyzer application.
"""

import os
import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import time
import random
import json

# Try to load environment variables from .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path="../.env")
except ImportError:
    # dotenv not available, environment variables should be set manually
    pass

from fastapi import FastAPI, HTTPException, BackgroundTasks, status, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
import psutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Code Management Analyzer API",
    description="A comprehensive code analysis platform with AI-powered search and integration capabilities",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        #"http://localhost:3000",
        #"http://localhost:3001", 
        "http://localhost:3002",
        #"http://localhost:3003",
        #"http://localhost:3004",
        "http://localhost:5173",  # Vite dev server
        #"http://127.0.0.1:3000",
        #"http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str

class SystemStatus(BaseModel):
    status: str
    timestamp: str
    uptime: float
    memory_usage: Dict[str, Any]
    cpu_usage: float
    services: Dict[str, str]

class RepositoryAnalysisRequest(BaseModel):
    repo_url: str
    branch: str = "main"
    force_reanalysis: bool = False

class CodeSearchRequest(BaseModel):
    query: str
    file_types: List[str] = []
    repositories: List[str] = []
    max_results: int = 50

class CodeSearchResult(BaseModel):
    file_path: str
    content: str
    similarity_score: float
    repository: str
    language: str

# Health check endpoint
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "code-management-analyzer"
    }

# System status endpoint
@app.get("/api/system/status", response_model=SystemStatus)
async def get_system_status():
    """Get detailed system status."""
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=1)
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime": time.time() - psutil.boot_time(),
        "memory_usage": {
            "total": memory.total,
            "available": memory.available,
            "percent": memory.percent,
            "used": memory.used,
            "free": memory.free
        },
        "cpu_usage": cpu_percent,
        "services": {
            "api": "running",
            "database": "connected",
            "background_jobs": "active"
        }
    }

# System metrics endpoint
@app.get("/api/system/metrics")
async def get_system_metrics():
    """Get system performance metrics."""
    return {
        "timestamp": datetime.now().isoformat(),
        "memory_usage": psutil.virtual_memory()._asdict(),
        "cpu_usage": psutil.cpu_percent(interval=1),
        "disk_usage": psutil.disk_usage('/')._asdict(),
        "network_io": psutil.net_io_counters()._asdict(),
        "processes": len(psutil.pids())
    }

# Repository endpoints
@app.get("/api/repositories")
async def list_repositories():
    """List all analyzed repositories."""
    # Mock data for now
    return {
        "repositories": [
            {
                "id": 1,
                "name": "sample-repo",
                "url": "https://github.com/user/sample-repo",
                "language": "Python",
                "last_analyzed": "2024-01-15T10:30:00Z",
                "status": "completed",
                "files_count": 245,
                "lines_of_code": 12580
            },
            {
                "id": 2,
                "name": "web-app",
                "url": "https://github.com/user/web-app",
                "language": "TypeScript",
                "last_analyzed": "2024-01-14T15:45:00Z",
                "status": "completed",
                "files_count": 189,
                "lines_of_code": 8940
            }
        ],
        "total": 2
    }

@app.get("/api/repositories/{repo_id}/stats")
async def get_repository_stats(repo_id: int):
    """Get repository statistics."""
    return {
        "repository_id": repo_id,
        "total_files": 245,
        "lines_of_code": 12580,
        "languages": {
            "Python": 8540,
            "JavaScript": 2890,
            "TypeScript": 1150
        },
        "complexity_metrics": {
            "average_complexity": 2.4,
            "high_complexity_files": 12,
            "technical_debt_hours": 24.5
        },
        "quality_metrics": {
            "code_coverage": 78.5,
            "duplication_percentage": 5.2,
            "maintainability_index": 82.1
        }
    }

@app.post("/api/repositories/analyze")
async def analyze_repository(request: RepositoryAnalysisRequest, background_tasks: BackgroundTasks):
    """Start repository analysis."""
    job_id = f"job_{int(time.time())}_{random.randint(1000, 9999)}"
    
    # In a real implementation, this would trigger background analysis
    logger.info(f"Starting analysis for {request.repo_url} with job_id: {job_id}")
    
    return {
        "job_id": job_id,
        "status": "started",
        "repository_url": request.repo_url,
        "branch": request.branch,
        "estimated_completion": "2024-01-15T11:00:00Z"
    }

# Code search endpoints
@app.post("/api/code/search")
async def search_code(request: CodeSearchRequest):
    """Search code with advanced filters."""
    # Mock search results
    results = [
        {
            "file_path": "src/utils/helpers.py",
            "content": "def calculate_metrics(data):\n    # Calculate various code metrics\n    return metrics",
            "similarity_score": 0.92,
            "repository": "sample-repo",
            "language": "Python"
        },
        {
            "file_path": "src/components/Dashboard.tsx",
            "content": "export const Dashboard = () => {\n  // Dashboard component logic\n  return <div>Dashboard</div>;\n};",
            "similarity_score": 0.87,
            "repository": "web-app",
            "language": "TypeScript"
        }
    ]
    
    return {
        "query": request.query,
        "results": results[:request.max_results],
        "total_results": len(results),
        "search_time_ms": 145
    }

# Jira integration endpoints
@app.get("/api/jira/health")
async def jira_health():
    """Jira integration health check."""
    return {"status": "healthy", "service": "jira"}

@app.get("/api/jira/sync-conflicts")
async def get_sync_conflicts():
    """Get sync conflicts between local data and Jira."""
    # For now, return empty conflicts - this should be connected to the story service
    # TODO: Integrate with story_service.get_sync_conflicts()
    return {"conflicts": []}

@app.post("/api/jira/resolve-conflict")
async def resolve_sync_conflict(conflict_data: dict):
    """Resolve a sync conflict."""
    # TODO: Integrate with story_service.resolve_conflict()
    return {"success": True, "message": "Conflict resolved"}

@app.post("/api/jira/generate-stories")
async def generate_jira_stories():
    """Generate Jira stories from analysis."""
    return {
        "message": "Stories generated successfully",
        "stories_created": 3,
        "stories": [
            {"key": "PROJ-123", "summary": "Improve code quality in main.py"},
            {"key": "PROJ-124", "summary": "Add unit tests for helper functions"},
            {"key": "PROJ-125", "summary": "Refactor data processing module"}
        ]
    }

@app.get("/api/jira/projects")
async def get_jira_projects():
    """Get Jira projects."""
    return {
        "projects": [
            {"key": "PROJ", "name": "Sample Project", "type": "software"},
            {"key": "TEST", "name": "Test Project", "type": "business"}
        ]
    }

# GitHub integration endpoints
@app.get("/api/github/health")
async def github_health():
    """GitHub integration health check."""
    return {"status": "healthy", "service": "github"}

@app.get("/api/github/repositories")
async def list_github_repositories(
    type: str = "all",  # all, owner, member
    sort: str = "updated",  # created, updated, pushed, full_name
    per_page: int = 30,
    page: int = 1
):
    """List GitHub repositories for the authenticated user."""
    return {
        "repositories": [
            {
                "id": 123456,
                "name": "sample-repo",
                "full_name": "user/sample-repo",
                "description": "A sample repository",
                "html_url": "https://github.com/user/sample-repo",
                "clone_url": "https://github.com/user/sample-repo.git",
                "language": "Python",
                "stargazers_count": 42,
                "forks_count": 8,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-15T10:30:00Z"
            }
        ],
        "total": 1,
        "page": page,
        "per_page": per_page
    }

# Integration status endpoint
@app.get("/api/integrations/status")
async def get_integrations_status():
    """Get status of all integrations."""
    return {
        "integrations": {
            "github": {
                "status": "configured",
                "configured": True,
                "connected": True,
                "last_check": datetime.now().isoformat()
            },
            "jira": {
                "status": "configured", 
                "configured": True,
                "connected": True,
                "last_check": datetime.now().isoformat()
            },
            "webhooks": {
                "status": "active",
                "configured": True,
                "connected": True,
                "last_check": datetime.now().isoformat()
            }
        }
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "status_code": 500}
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )
