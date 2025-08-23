import asyncio
import uuid
from datetime import datetime
from typing import Dict, Optional, List, Any
from enum import Enum
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class BackgroundJob(BaseModel):
    id: str
    repository_url: str
    status: JobStatus
    progress: int = 0
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, BackgroundJob] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}

    def create_job(self, repository_url: str) -> str:
        job_id = str(uuid.uuid4())
        job = BackgroundJob(
            id=job_id,
            repository_url=repository_url,
            status=JobStatus.PENDING,
            created_at=datetime.utcnow()
        )
        self.jobs[job_id] = job
        return job_id

    def get_job(self, job_id: str) -> Optional[BackgroundJob]:
        return self.jobs.get(job_id)

    def get_jobs_by_status(self, status: JobStatus) -> List[BackgroundJob]:
        return [job for job in self.jobs.values() if job.status == status]

    def get_all_jobs(self) -> List[BackgroundJob]:
        return list(self.jobs.values())

    async def start_job(self, job_id: str, analysis_func):
        if job_id not in self.jobs:
            return False
        
        job = self.jobs[job_id]
        if job.status != JobStatus.PENDING:
            return False

        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        
        # Create and store the task
        task = asyncio.create_task(self._run_analysis(job_id, analysis_func))
        self.running_tasks[job_id] = task
        
        return True

    async def _run_analysis(self, job_id: str, analysis_func):
        job = self.jobs[job_id]
        try:
            logger.info(f"Starting analysis for job {job_id}")
            
            # Simulate progress updates
            for progress in [10, 30, 50, 70, 90]:
                await asyncio.sleep(1)  # Simulate work
                job.progress = progress
                logger.info(f"Job {job_id} progress: {progress}%")
            
            # Run the actual analysis
            result = await analysis_func(job.repository_url)
            
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.progress = 100
            job.result = result
            
            logger.info(f"Job {job_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {str(e)}")
            job.status = JobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
        
        finally:
            # Clean up the task
            if job_id in self.running_tasks:
                del self.running_tasks[job_id]

    def cancel_job(self, job_id: str) -> bool:
        if job_id in self.running_tasks:
            task = self.running_tasks[job_id]
            task.cancel()
            del self.running_tasks[job_id]
            
            job = self.jobs[job_id]
            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            return True
        return False

    def delete_job(self, job_id: str) -> bool:
        if job_id in self.jobs:
            # Cancel if running
            self.cancel_job(job_id)
            del self.jobs[job_id]
            return True
        return False

# Global job manager instance
job_manager = JobManager()
