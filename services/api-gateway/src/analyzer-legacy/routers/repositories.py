"""
Repository Management Router
Integrates the unified repository processor with frontend API expectations.
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field

# Import our unified repository processor
import sys
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

try:
    from core.repository_processor import UnifiedRepositoryProcessor
    from core.database_manager import DatabaseManager
    UNIFIED_PROCESSOR_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Unified repository processor not available: {e}")
    UNIFIED_PROCESSOR_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/repositories", tags=["repositories"])

# Pydantic models matching frontend expectations
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

# Global repository storage (in production, this would be in database)
repositories_db: Dict[str, Repository] = {}
analysis_jobs: Dict[str, Dict[str, Any]] = {}

def get_database_manager():
    """Get database manager instance"""
    if not UNIFIED_PROCESSOR_AVAILABLE:
        return None
    try:
        return DatabaseManager()
    except Exception as e:
        logger.error(f"Failed to initialize database manager: {e}")
        return None

def get_unified_processor():
    """Get unified repository processor instance"""
    if not UNIFIED_PROCESSOR_AVAILABLE:
        return None
    try:
        return UnifiedRepositoryProcessor()
    except Exception as e:
        logger.error(f"Failed to initialize unified processor: {e}")
        return None

@router.get("/", response_model=Dict[str, Any])
async def list_repositories():
    """List all repositories."""
    db_manager = get_database_manager()
    repositories = []
    
    if db_manager:
        try:
            # Query actual repositories from database
            db_repos = await db_manager.query_repository_data()
            for repo_data in db_repos:
                repo = Repository(
                    id=repo_data.get('_key', repo_data.get('id', '')),
                    name=repo_data.get('name', 'Unknown'),
                    url=repo_data.get('url', ''),
                    description=repo_data.get('description'),
                    language=repo_data.get('primary_language', 'Unknown'),
                    last_analyzed=repo_data.get('last_analyzed'),
                    status=repo_data.get('status', 'completed'),
                    files_count=repo_data.get('total_files', 0),
                    lines_of_code=repo_data.get('total_lines', 0),
                    branch=repo_data.get('branch', 'main'),
                    created_at=repo_data.get('created_at', datetime.now()),
                    updated_at=repo_data.get('updated_at', datetime.now())
                )
                repositories.append(repo.dict())
        except Exception as e:
            logger.error(f"Failed to query repositories from database: {e}")
            # Fall back to in-memory storage
            repositories = [repo.dict() for repo in repositories_db.values()]
    else:
        # Use in-memory storage
        repositories = [repo.dict() for repo in repositories_db.values()]
    
    return {
        "repositories": repositories,
        "total": len(repositories)
    }

@router.post("/", response_model=Repository)
async def create_repository(request: CreateRepositoryRequest):
    """Create a new repository entry."""
    import uuid
    
    repo_id = str(uuid.uuid4())
    repository = Repository(
        id=repo_id,
        name=request.name,
        url=request.url,
        description=request.description,
        branch=request.branch,
        status="pending"
    )
    
    # Store in memory (in production, store in database)
    repositories_db[repo_id] = repository
    
    db_manager = get_database_manager()
    if db_manager:
        try:
            # Also store in database
            await db_manager.store_repository({
                '_key': repo_id,
                'name': request.name,
                'url': request.url,
                'description': request.description,
                'branch': request.branch,
                'status': 'pending',
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            })
        except Exception as e:
            logger.error(f"Failed to store repository in database: {e}")
    
    return repository

@router.get("/{repository_id}", response_model=Repository)
async def get_repository(repository_id: str):
    """Get a specific repository."""
    db_manager = get_database_manager()
    
    if db_manager:
        try:
            # Query from database first
            repo_data = await db_manager.get_repository(repository_id)
            if repo_data:
                return Repository(
                    id=repo_data.get('_key', repository_id),
                    name=repo_data.get('name', 'Unknown'),
                    url=repo_data.get('url', ''),
                    description=repo_data.get('description'),
                    language=repo_data.get('primary_language', 'Unknown'),
                    last_analyzed=repo_data.get('last_analyzed'),
                    status=repo_data.get('status', 'pending'),
                    files_count=repo_data.get('total_files', 0),
                    lines_of_code=repo_data.get('total_lines', 0),
                    branch=repo_data.get('branch', 'main'),
                    created_at=repo_data.get('created_at', datetime.now()),
                    updated_at=repo_data.get('updated_at', datetime.now())
                )
        except Exception as e:
            logger.error(f"Failed to query repository from database: {e}")
    
    # Fall back to in-memory storage
    if repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    return repositories_db[repository_id]

@router.put("/{repository_id}", response_model=Repository)
async def update_repository(repository_id: str, request: UpdateRepositoryRequest):
    """Update a repository."""
    if repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    repository = repositories_db[repository_id]
    
    # Update fields if provided
    if request.name is not None:
        repository.name = request.name
    if request.description is not None:
        repository.description = request.description
    if request.branch is not None:
        repository.branch = request.branch
    
    repository.updated_at = datetime.now()
    
    db_manager = get_database_manager()
    if db_manager:
        try:
            # Update in database
            await db_manager.update_repository(repository_id, {
                'name': repository.name,
                'description': repository.description,
                'branch': repository.branch,
                'updated_at': repository.updated_at
            })
        except Exception as e:
            logger.error(f"Failed to update repository in database: {e}")
    
    return repository

@router.delete("/{repository_id}")
async def delete_repository(repository_id: str):
    """Delete a repository."""
    if repository_id not in repositories_db:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    del repositories_db[repository_id]
    
    db_manager = get_database_manager()
    if db_manager:
        try:
            # Delete from database
            await db_manager.delete_repository(repository_id)
        except Exception as e:
            logger.error(f"Failed to delete repository from database: {e}")
    
    return {"message": "Repository deleted successfully"}

@router.post("/analyze", response_model=Dict[str, Any])
async def analyze_repository(request: AnalyzeRepositoryRequest, background_tasks: BackgroundTasks):
    """Trigger repository analysis using unified processor."""
    
    # Check if repository exists
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
    
    # Check if already analyzed and not forcing reanalysis
    if repository.status == "completed" and not request.force_reanalysis:
        return {
            "message": "Repository already analyzed. Use force_reanalysis=true to reanalyze",
            "repository_id": request.repository_id,
            "status": "completed",
            "last_analyzed": repository.last_analyzed
        }
    
    # Start analysis in background
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
    
    # Add background task
    background_tasks.add_task(
        run_repository_analysis,
        job_id,
        repository.url,
        request.repository_id
    )
    
    return {
        "message": "Repository analysis started",
        "job_id": job_id,
        "repository_id": request.repository_id,
        "status": "analyzing"
    }

async def run_repository_analysis(job_id: str, repo_url: str, repository_id: str):
    """Run repository analysis in background using unified processor."""
    processor = get_unified_processor()
    
    if not processor:
        analysis_jobs[job_id]["status"] = "error"
        analysis_jobs[job_id]["error"] = "Unified processor not available"
        repositories_db[repository_id].status = "error"
        return
    
    try:
        analysis_jobs[job_id]["status"] = "analyzing"
        analysis_jobs[job_id]["progress"] = 10
        
        # Run unified analysis
        logger.info(f"Starting unified analysis for {repo_url}")
        result = await processor.analyze_repository(repo_url)
        
        analysis_jobs[job_id]["progress"] = 90
        
        # Update repository with results
        repository = repositories_db[repository_id]
        repository.status = "completed"
        repository.last_analyzed = datetime.now()
        repository.files_count = result.get('total_files', 0)
        repository.lines_of_code = result.get('total_lines', 0)
        repository.language = result.get('primary_language', 'Unknown')
        repository.updated_at = datetime.now()
        
        analysis_jobs[job_id]["status"] = "completed"
        analysis_jobs[job_id]["progress"] = 100
        analysis_jobs[job_id]["completed_at"] = datetime.now()
        analysis_jobs[job_id]["result"] = result
        
        logger.info(f"Completed unified analysis for {repo_url}")
        
    except Exception as e:
        logger.error(f"Analysis failed for {repo_url}: {e}")
        analysis_jobs[job_id]["status"] = "error"
        analysis_jobs[job_id]["error"] = str(e)
        repositories_db[repository_id].status = "error"

@router.get("/{repository_id}/stats", response_model=RepositoryStats)
async def get_repository_stats(repository_id: str):
    """Get repository statistics."""
    db_manager = get_database_manager()
    
    if db_manager:
        try:
            # Get comprehensive stats from database
            stats = await db_manager.get_repository_stats(repository_id)
            if stats:
                return RepositoryStats(**stats)
        except Exception as e:
            logger.error(f"Failed to get repository stats from database: {e}")
    
    # Fallback to basic stats from repository data
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
            "high_complexity_files": 0,
            "technical_debt_hours": 0.0
        },
        quality_metrics={
            "code_coverage": 0.0,
            "duplication_percentage": 0.0,
            "maintainability_index": 100.0
        },
        analysis_date=repository.last_analyzed or datetime.now()
    )

@router.get("/jobs/{job_id}")
async def get_analysis_job(job_id: str):
    """Get analysis job status."""
    if job_id not in analysis_jobs:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    
    return analysis_jobs[job_id]

@router.get("/", response_model=Dict[str, Any])
async def get_all_analysis_jobs():
    """Get all analysis jobs."""
    return {
        "jobs": list(analysis_jobs.values()),
        "total": len(analysis_jobs)
    }
