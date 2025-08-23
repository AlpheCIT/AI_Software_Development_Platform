"""
API Endpoint for Dynamic Documentation Generation
Integrates the documentation generator with your existing FastAPI backend
"""

import sys
from pathlib import Path

# Add the parent directories to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, HTTPException, Query, Path, Body
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from core.dynamic_documentation_generator import (
    DynamicRepositoryDocumentationGenerator,
    DocumentationConfig
)
from core.database_manager import UnifiedDatabaseManager

logger = logging.getLogger(__name__)

# Create router for documentation endpoints
docs_router = APIRouter(prefix="/api/documentation", tags=["Documentation"])

class DocumentationRequest(BaseModel):
    """Request model for documentation generation"""
    repository_id: str = Field(..., description="Repository ID to generate documentation for")
    include_api_endpoints: bool = Field(True, description="Include API endpoints analysis")
    include_service_architecture: bool = Field(True, description="Include service architecture")
    include_code_structure: bool = Field(True, description="Include code structure analysis")
    include_embeddings_analysis: bool = Field(True, description="Include embeddings analysis")
    include_purpose_analysis: bool = Field(True, description="Include purpose analysis")
    include_complexity_metrics: bool = Field(True, description="Include complexity metrics")
    output_format: str = Field("markdown", description="Output format: markdown, json, html")
    detail_level: str = Field("comprehensive", description="Detail level: basic, detailed, comprehensive")
    similarity_threshold: float = Field(0.8, description="Similarity threshold for embeddings")
    include_code_samples: bool = Field(False, description="Include code samples")

class DocumentationResponse(BaseModel):
    """Response model for documentation generation"""
    success: bool
    documentation: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    generated_at: str
    repository_id: str
    config: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class RepositoryListResponse(BaseModel):
    """Response model for repository listing"""
    success: bool
    repositories: List[Dict[str, Any]]
    total_count: int

@docs_router.post("/generate", response_model=DocumentationResponse)
async def generate_repository_documentation(request: DocumentationRequest):
    """
    Generate comprehensive documentation for a repository
    
    This endpoint analyzes a repository using the dynamic documentation generator
    and returns documentation in the specified format.
    """
    
    try:
        # Initialize database manager
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        # Create documentation generator
        doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
        
        # Create configuration from request
        config = DocumentationConfig(
            include_api_endpoints=request.include_api_endpoints,
            include_service_architecture=request.include_service_architecture,
            include_code_structure=request.include_code_structure,
            include_embeddings_analysis=request.include_embeddings_analysis,
            include_purpose_analysis=request.include_purpose_analysis,
            include_complexity_metrics=request.include_complexity_metrics,
            output_format=request.output_format,
            detail_level=request.detail_level,
            similarity_threshold=request.similarity_threshold,
            include_code_samples=request.include_code_samples
        )
        
        # Generate documentation
        logger.info(f"Generating documentation for repository: {request.repository_id}")
        documentation = await doc_generator.generate_complete_documentation(
            request.repository_id, config
        )
        
        await db_manager.close()
        
        # Handle different response types
        if isinstance(documentation, dict):
            if not documentation.get('success', True):
                raise HTTPException(
                    status_code=404,
                    detail=f"Documentation generation failed: {documentation.get('error', 'Unknown error')}"
                )
            
            # JSON format response
            return DocumentationResponse(
                success=True,
                documentation=None,  # JSON data is in metadata
                metadata=documentation,
                generated_at=datetime.now().isoformat(),
                repository_id=request.repository_id,
                config=config.__dict__
            )
        else:
            # String format response (markdown/html)
            return DocumentationResponse(
                success=True,
                documentation=documentation,
                metadata={"format": request.output_format},
                generated_at=datetime.now().isoformat(),
                repository_id=request.repository_id,
                config=config.__dict__
            )
    
    except Exception as e:
        logger.error(f"Documentation generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Documentation generation failed: {str(e)}"
        )

@docs_router.get("/generate/{repository_id}", response_class=PlainTextResponse)
async def generate_markdown_documentation(
    repository_id: str = Path(..., description="Repository ID"),
    include_api: bool = Query(True, description="Include API endpoints"),
    include_services: bool = Query(True, description="Include service architecture"),
    include_structure: bool = Query(True, description="Include code structure"),
    include_embeddings: bool = Query(True, description="Include embeddings analysis"),
    detail_level: str = Query("comprehensive", description="Detail level")
):
    """
    Generate markdown documentation for a repository (simple GET endpoint)
    
    Returns plain text markdown content suitable for direct viewing or file download.
    """
    
    try:
        # Create configuration
        config = DocumentationConfig(
            include_api_endpoints=include_api,
            include_service_architecture=include_services,
            include_code_structure=include_structure,
            include_embeddings_analysis=include_embeddings,
            include_purpose_analysis=True,
            include_complexity_metrics=True,
            output_format="markdown",
            detail_level=detail_level
        )
        
        # Initialize database and generator
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
        
        # Generate documentation
        documentation = await doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        await db_manager.close()
        
        if isinstance(documentation, dict) and not documentation.get('success', True):
            raise HTTPException(
                status_code=404,
                detail=f"Repository {repository_id} not found or analysis failed"
            )
        
        return documentation
    
    except Exception as e:
        logger.error(f"Markdown documentation generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Documentation generation failed: {str(e)}"
        )

@docs_router.get("/repositories", response_model=RepositoryListResponse)
async def list_analyzed_repositories():
    """
    List all repositories that have been analyzed and are available for documentation
    """
    
    try:
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        # Query all repositories with analysis data
        query = """
        FOR repo IN repositories
            LET node_count = LENGTH(
                FOR node IN ast_nodes
                    FILTER node.repository_id == repo._key
                    RETURN 1
            )
            LET embedding_count = LENGTH(
                FOR emb IN embedding_metadata
                    FILTER emb.repository_id == repo._key
                    RETURN 1
            )
            FILTER node_count > 0  // Only include repositories with analysis data
            RETURN {
                id: repo._key,
                name: repo.name,
                url: repo.url,
                analysis_timestamp: repo.analysis_timestamp,
                node_count: node_count,
                embedding_count: embedding_count,
                status: repo.status || "analyzed"
            }
        """
        
        cursor = db_manager.db.aql.execute(query)
        repositories = list(cursor)
        
        await db_manager.close()
        
        return RepositoryListResponse(
            success=True,
            repositories=repositories,
            total_count=len(repositories)
        )
    
    except Exception as e:
        logger.error(f"Repository listing failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list repositories: {str(e)}"
        )

@docs_router.get("/api-endpoints/{repository_id}")
async def get_api_endpoints_documentation(
    repository_id: str = Path(..., description="Repository ID"),
    format: str = Query("json", description="Response format: json or markdown")
):
    """
    Generate API endpoints documentation only for a repository
    """
    
    try:
        config = DocumentationConfig(
            include_api_endpoints=True,
            include_service_architecture=False,
            include_code_structure=False,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=False,
            output_format=format,
            detail_level="detailed"
        )
        
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
        
        documentation = await doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        await db_manager.close()
        
        if isinstance(documentation, dict) and not documentation.get('success', True):
            raise HTTPException(
                status_code=404,
                detail=f"Repository {repository_id} not found"
            )
        
        if format == "markdown":
            return PlainTextResponse(documentation, media_type="text/markdown")
        else:
            return documentation
    
    except Exception as e:
        logger.error(f"API documentation generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"API documentation generation failed: {str(e)}"
        )

@docs_router.get("/service-architecture/{repository_id}")
async def get_service_architecture_documentation(
    repository_id: str = Path(..., description="Repository ID"),
    format: str = Query("json", description="Response format: json or markdown")
):
    """
    Generate service architecture documentation only for a repository
    """
    
    try:
        config = DocumentationConfig(
            include_api_endpoints=False,
            include_service_architecture=True,
            include_code_structure=True,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=True,
            output_format=format,
            detail_level="comprehensive"
        )
        
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
        
        documentation = await doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        await db_manager.close()
        
        if isinstance(documentation, dict) and not documentation.get('success', True):
            raise HTTPException(
                status_code=404,
                detail=f"Repository {repository_id} not found"
            )
        
        if format == "markdown":
            return PlainTextResponse(documentation, media_type="text/markdown")
        else:
            return documentation
    
    except Exception as e:
        logger.error(f"Service architecture documentation generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Service architecture documentation generation failed: {str(e)}"
        )

@docs_router.get("/embeddings-analysis/{repository_id}")
async def get_embeddings_analysis_documentation(
    repository_id: str = Path(..., description="Repository ID"),
    similarity_threshold: float = Query(0.8, description="Similarity threshold"),
    format: str = Query("json", description="Response format: json or markdown")
):
    """
    Generate embeddings and semantic analysis documentation for a repository
    """
    
    try:
        config = DocumentationConfig(
            include_api_endpoints=False,
            include_service_architecture=False,
            include_code_structure=False,
            include_embeddings_analysis=True,
            include_purpose_analysis=True,
            include_complexity_metrics=False,
            output_format=format,
            detail_level="comprehensive",
            similarity_threshold=similarity_threshold
        )
        
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
        
        documentation = await doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        await db_manager.close()
        
        if isinstance(documentation, dict) and not documentation.get('success', True):
            raise HTTPException(
                status_code=404,
                detail=f"Repository {repository_id} not found"
            )
        
        if format == "markdown":
            return PlainTextResponse(documentation, media_type="text/markdown")
        else:
            return documentation
    
    except Exception as e:
        logger.error(f"Embeddings analysis documentation generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Embeddings analysis documentation generation failed: {str(e)}"
        )

@docs_router.get("/complexity-analysis/{repository_id}")
async def get_complexity_analysis_documentation(
    repository_id: str = Path(..., description="Repository ID"),
    format: str = Query("json", description="Response format: json or markdown")
):
    """
    Generate complexity analysis documentation for a repository
    """
    
    try:
        config = DocumentationConfig(
            include_api_endpoints=False,
            include_service_architecture=False,
            include_code_structure=True,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=True,
            output_format=format,
            detail_level="comprehensive"
        )
        
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
        
        documentation = await doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        await db_manager.close()
        
        if isinstance(documentation, dict) and not documentation.get('success', True):
            raise HTTPException(
                status_code=404,
                detail=f"Repository {repository_id} not found"
            )
        
        if format == "markdown":
            return PlainTextResponse(documentation, media_type="text/markdown")
        else:
            return documentation
    
    except Exception as e:
        logger.error(f"Complexity analysis documentation generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Complexity analysis documentation generation failed: {str(e)}"
        )

# Export the router to be included in your main FastAPI app
__all__ = ["docs_router"]
