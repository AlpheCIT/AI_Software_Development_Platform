"""
Minimal FastAPI backend for repository management
Temporary solution to test frontend-backend integration
"""

import os
import logging
import asyncio
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env" 
    load_dotenv(dotenv_path=env_path)
    logger.info(f"✅ Loaded environment variables from: {env_path}")
except ImportError:
    logger.warning("⚠️  python-dotenv not available")

# FastAPI app
app = FastAPI(
    title="Code Management Analyzer API",
    description="Repository analysis and management system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Pydantic models
class Repository(BaseModel):
    id: str
    name: str
    url: str
    description: Optional[str] = None
    language: str = "Unknown"
    last_analyzed: Optional[datetime] = None
    status: str = "pending"  # pending, analyzing, completed, error
    files_count: int = 0
    lines_of_code: int = 0
    branch: str = "main"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class CreateRepositoryRequest(BaseModel):
    name: str
    url: str
    description: Optional[str] = None
    branch: str = "main"

class UpdateRepositoryRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    branch: Optional[str] = None

class AnalyzeRepositoryRequest(BaseModel):
    repository_id: str
    force_reanalysis: bool = False

class RepositoryStats(BaseModel):
    repository_id: str
    total_files: int
    lines_of_code: int
    languages: Dict[str, int]
    complexity_metrics: Dict[str, float]
    quality_metrics: Dict[str, float]
    analysis_date: datetime

# In-memory storage (for demo purposes)
repositories_db: Dict[str, Repository] = {}
analysis_jobs: Dict[str, Dict[str, Any]] = {}

# Initialize with sample data
sample_repo = Repository(
    id="sample-1",
    name="Sample Repository",
    url="https://github.com/example/sample-repo",
    description="A sample repository for testing",
    language="Python",
    status="completed",
    files_count=42,
    lines_of_code=1250,
    last_analyzed=datetime.now()
)
repositories_db["sample-1"] = sample_repo

# Health check
@app.get("/")
async def root():
    return {"message": "Code Management Analyzer API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

# Repository endpoints
@app.get("/api/repositories")
async def list_repositories():
    """List all repositories."""
    repositories = [repo.dict() for repo in repositories_db.values()]
    return {
        "repositories": repositories,
        "total": len(repositories)
    }

@app.post("/api/repositories", response_model=Repository)
async def create_repository(request: CreateRepositoryRequest):
    """Create a new repository entry."""
    repo_id = str(uuid.uuid4())
    repository = Repository(
        id=repo_id,
        name=request.name,
        url=request.url,
        description=request.description,
        branch=request.branch,
        status="pending"
    )
    
    repositories_db[repo_id] = repository
    logger.info(f"Created repository: {repo_id}")
    return repository

@app.get("/api/repositories/{repository_id}", response_model=Repository)
async def get_repository(repository_id: str):
    """Get a specific repository."""
    if repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repositories_db[repository_id]

@app.put("/api/repositories/{repository_id}", response_model=Repository)
async def update_repository(repository_id: str, request: UpdateRepositoryRequest):
    """Update a repository."""
    if repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    repository = repositories_db[repository_id]
    
    if request.name is not None:
        repository.name = request.name
    if request.description is not None:
        repository.description = request.description
    if request.branch is not None:
        repository.branch = request.branch
    
    repository.updated_at = datetime.now()
    logger.info(f"Updated repository: {repository_id}")
    return repository

@app.delete("/api/repositories/{repository_id}")
async def delete_repository(repository_id: str):
    """Delete a repository."""
    if repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    del repositories_db[repository_id]
    logger.info(f"Deleted repository: {repository_id}")
    return {"message": "Repository deleted successfully"}

@app.post("/api/repositories/analyze")
async def analyze_repository(request: AnalyzeRepositoryRequest, background_tasks: BackgroundTasks):
    """Trigger repository analysis."""
    
    if request.repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    repository = repositories_db[request.repository_id]
    
    # Check if already analyzing
    if repository.status == "analyzing":
        return {
            "message": "Repository analysis already in progress",
            "repository_id": request.repository_id,
            "status": "analyzing"
        }
    
    # Start analysis simulation
    job_id = f"analysis_{request.repository_id}_{datetime.now().timestamp()}"
    analysis_jobs[job_id] = {
        "repository_id": request.repository_id,
        "status": "starting",
        "started_at": datetime.now(),
        "progress": 0
    }
    
    # Update repository status
    repository.status = "analyzing"
    repository.updated_at = datetime.now()
    
    # Add background task for simulation
    background_tasks.add_task(simulate_analysis, job_id, repository_id=request.repository_id)
    
    logger.info(f"Started analysis for repository: {request.repository_id}")
    return {
        "message": "Repository analysis started",
        "job_id": job_id,
        "repository_id": request.repository_id,
        "status": "analyzing"
    }

async def simulate_analysis(job_id: str, repository_id: str):
    """Simulate repository analysis."""
    try:
        # Simulate analysis progress
        for progress in [10, 30, 60, 80, 100]:
            await asyncio.sleep(2)  # Simulate work
            analysis_jobs[job_id]["progress"] = progress
            analysis_jobs[job_id]["status"] = "analyzing" if progress < 100 else "completed"
        
        # Update repository with mock results
        repository = repositories_db[repository_id]
        repository.status = "completed"
        repository.last_analyzed = datetime.now()
        repository.files_count = 47  # Mock data
        repository.lines_of_code = 1580  # Mock data
        repository.language = "Python"  # Mock data
        
        analysis_jobs[job_id]["completed_at"] = datetime.now()
        logger.info(f"Completed analysis simulation for: {repository_id}")
        
    except Exception as e:
        logger.error(f"Analysis simulation failed: {e}")
        analysis_jobs[job_id]["status"] = "error"
        analysis_jobs[job_id]["error"] = str(e)
        repositories_db[repository_id].status = "error"

@app.get("/api/repositories/{repository_id}/stats", response_model=RepositoryStats)
async def get_repository_stats(repository_id: str):
    """Get repository statistics."""
    if repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    repository = repositories_db[repository_id]
    
    return RepositoryStats(
        repository_id=repository_id,
        total_files=repository.files_count,
        lines_of_code=repository.lines_of_code,
        languages={repository.language: repository.lines_of_code},
        complexity_metrics={
            "average_complexity": 2.4,
            "high_complexity_files": 3,
            "technical_debt_hours": 12.5
        },
        quality_metrics={
            "code_coverage": 78.5,
            "duplication_percentage": 5.2,
            "maintainability_index": 82.1
        },
        analysis_date=repository.last_analyzed or datetime.now()
    )

@app.get("/api/repositories/jobs/{job_id}")
async def get_analysis_job(job_id: str):
    """Get analysis job status."""
    if job_id not in analysis_jobs:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return analysis_jobs[job_id]

@app.get("/api/repositories/jobs")
async def get_all_analysis_jobs():
    """Get all analysis jobs."""
    return {
        "jobs": list(analysis_jobs.values()),
        "total": len(analysis_jobs)
    }

if __name__ == "__main__":
    port = int(os.getenv('API_PORT', 8002))
    uvicorn.run("minimal_app:app", host="0.0.0.0", port=port, reload=True)
