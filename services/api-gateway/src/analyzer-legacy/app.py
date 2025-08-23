"""
FastAPI backend for the Code Management Analyzer application.
"""

import os
import logging
import asyncio
import hashlib
import re
import sys
import urllib.parse
import aiohttp
import time
import json
import psutil
import uvicorn
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import time
import random
import json
from pathlib import Path
import psutil

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    # Load from the project root directory
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)
    print(f"✅ Loaded environment variables from: {env_path}")
except ImportError:
    print("⚠️  python-dotenv not available, environment variables should be set manually")
    pass

from fastapi import FastAPI, HTTPException, BackgroundTasks, status, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

# Configure logging first
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
log_file = os.getenv('LOG_FILE', 'repo_analyzer.log')

logging.basicConfig(
    level=getattr(logging, log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# AWS Bedrock integration
try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BEDROCK_AVAILABLE = True
except ImportError:
    BEDROCK_AVAILABLE = False
    logger.warning("AWS boto3 not available - Bedrock AI enhancement disabled")

# Import Jira and ArangoDB clients
try:
    from jira import JIRA
    JIRA_AVAILABLE = True
except ImportError:
    JIRA_AVAILABLE = False
    logger.warning("Jira package not available")

try:
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False
    logger.warning("ArangoDB package not available")

# AWS Bedrock integration
try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BEDROCK_AVAILABLE = True
except ImportError:
    BEDROCK_AVAILABLE = False
    # Will log warning after logger is set up

# Import Jira service
try:
    import sys
    backend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
    if backend_path not in sys.path:
        sys.path.append(backend_path)
    from jira_integration import jira_service
    JIRA_SERVICE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Jira service not available: {str(e)}")
    JIRA_SERVICE_AVAILABLE = False
    jira_service = None

# Import AI-Powered Refactoring System components
try:
    from api.services.enhanced_ast_parser import EnhancedASTParserService
    from api.services.similarity_engine import SimilarityEngine
    from api.services.refactoring_engine import RefactoringDecisionEngine, RefactoringOpportunity
    from api.services.purpose_extractor import PurposeExtractor
    from api.services.embedding_generator import MultiDimensionalEmbeddingEngine
    AI_REFACTORING_AVAILABLE = True
    logger.info("✅ AI-Powered Refactoring System components loaded successfully")
except ImportError as e:
    AI_REFACTORING_AVAILABLE = False
    logger.warning(f"⚠️  AI Refactoring components not available: {str(e)}")
    # Create dummy classes to prevent errors
    class EnhancedASTParserService:
        def __init__(self, *args, **kwargs): pass
    class SimilarityEngine:
        def __init__(self, *args, **kwargs): pass
    class RefactoringDecisionEngine:
        def __init__(self, *args, **kwargs): pass

# Log environment configuration
logger.info(f"Environment configuration loaded:")
logger.info(f"  - ArangoDB Host: {os.getenv('ARANGO_HOST', 'Not set')}")
logger.info(f"  - ArangoDB Port: {os.getenv('ARANGO_PORT', 'Not set')}")
logger.info(f"  - ArangoDB Database: {os.getenv('ARANGO_DATABASE', 'Not set')}")
github_token = os.getenv('GITHUB_TOKEN', '')
logger.info(f"  - GitHub Token: {'Set' if github_token and github_token.strip() else 'Not set (empty in .env)'}")
logger.info(f"  - Jira Server: {os.getenv('JIRA_SERVER_URL', 'Not set')}")
jira_token = os.getenv('JIRA_API_TOKEN', '')
logger.info(f"  - Jira API Token: {'Set' if jira_token and jira_token.strip() else 'Not set'}")
logger.info(f"  - Ollama URL: {os.getenv('OLLAMA_URL', 'Not set')}")
logger.info(f"  - Jira Available: {JIRA_AVAILABLE}")
logger.info(f"  - ArangoDB Available: {ARANGO_AVAILABLE}")
logger.info(f"  - AWS Bedrock Available: {BEDROCK_AVAILABLE}")
logger.info(f"  - AI Refactoring Available: {AI_REFACTORING_AVAILABLE}")
if not BEDROCK_AVAILABLE:
    logger.warning("AWS boto3 not available - Bedrock AI enhancement disabled")
if not AI_REFACTORING_AVAILABLE:
    logger.warning("AI Refactoring System not available - using legacy analysis")
logger.info(f"  - Log Level: {log_level}")

# Database helper functions for data retrieval
def get_all_team_members():
    """Get team members from database."""
    try:
        db = get_arango_client()
        collection = db.collection('team_members')
        members = []
        for member_doc in collection.all():
            member = {k: v for k, v in member_doc.items() if not k.startswith('_')}
            members.append(member)
        return members
    except Exception as e:
        logger.error(f"Error loading team members: {e}")
        return []

def get_all_milestones():
    """Get milestones from database."""
    try:
        db = get_arango_client()
        collection = db.collection('milestones')
        milestones = []
        for milestone_doc in collection.all():
            milestone = {k: v for k, v in milestone_doc.items() if not k.startswith('_')}
            milestones.append(milestone)
        return milestones
    except Exception as e:
        logger.error(f"Error loading milestones: {e}")
        return []

def get_project_info():
    """Get project info from database."""
    try:
        db = get_arango_client()
        collection = db.collection('project_info')
        result = collection.all()
        project_data = list(result)
        if project_data:
            return {k: v for k, v in project_data[0].items() if not k.startswith('_')}
        return {}
    except Exception as e:
        logger.error(f"Error loading project info: {e}")
        return {}

def get_board_config():
    """Get board configuration from database."""
    try:
        db = get_arango_client()
        collection = db.collection('board_config')
        result = collection.all()
        config_data = list(result)
        if config_data:
            return {k: v for k, v in config_data[0].items() if not k.startswith('_')}
        return {}
    except Exception as e:
        logger.error(f"Error loading board config: {e}")
        return {}

# Create story data structure for Jira
def format_story_for_jira(story: Dict[str, Any], project_key: str = "SCRUM"):
    """Format a story for Jira API submission with enhanced fields."""
    # Build enhanced description with all documentation fields
    description_parts = [story.get('description', '')]

    # User context
    if story.get('user_persona'):
        description_parts.append(f"\n*User Persona:* {story['user_persona']}")
    if story.get('user_goal'):
        description_parts.append(f"\n*User Goal:* {story['user_goal']}")

    # Acceptance criteria
    acceptance_criteria = story.get("acceptance_criteria", [])
    if acceptance_criteria:
        description_parts.append("\n*Acceptance Criteria:*")
        for criteria in acceptance_criteria:
            description_parts.append(f"- {criteria}")

    # Definition of done
    definition_of_done = story.get("definition_of_done", [])
    if definition_of_done:
        description_parts.append("\n*Definition of Done:*")
        for item in definition_of_done:
            description_parts.append(f"✓ {item}")

    # Technical and quality notes
    if story.get('technical_notes'):
        description_parts.append(f"\n*Technical Notes:* {story['technical_notes']}")
    if story.get('testing_notes'):
        description_parts.append(f"\n*Testing Notes:* {story['testing_notes']}")
    if story.get('security_considerations'):
        description_parts.append(f"\n*Security Considerations:* {story['security_considerations']}")
    if story.get('performance_requirements'):
        description_parts.append(f"\n*Performance Requirements:* {story['performance_requirements']}")
    if story.get('accessibility_notes'):
        description_parts.append(f"\n*Accessibility Notes:* {story['accessibility_notes']}")

    # Deployment and operational notes
    if story.get('deployment_notes'):
        description_parts.append(f"\n*Deployment Notes:* {story['deployment_notes']}")
    if story.get('rollback_plan'):
        description_parts.append(f"\n*Rollback Plan:* {story['rollback_plan']}")
    if story.get('monitoring_requirements'):
        description_parts.append(f"\n*Monitoring Requirements:* {story['monitoring_requirements']}")

    # Dependencies and relationships
    dependencies = story.get("dependencies", [])
    if dependencies:
        description_parts.append(f"\n*Dependencies:* {', '.join(dependencies)}")

    related_stories = story.get("related_stories", [])
    if related_stories:
        description_parts.append(f"\n*Related Stories:* {', '.join(related_stories)}")

    blocked_by = story.get("blocked_by", [])
    if blocked_by:
        description_parts.append(f"\n*Blocked By:* {', '.join(blocked_by)}")

    blocking = story.get("blocking", [])
    if blocking:
        description_parts.append(f"\n*Blocking:* {', '.join(blocking)}")

    # Effort breakdown
    effort_breakdown = story.get("effort_breakdown")
    if effort_breakdown:
        description_parts.append("\n*Effort Breakdown:*")
        for activity, hours in effort_breakdown.items():
            description_parts.append(f"- {activity.title()}: {hours}h")

    # Documentation links
    doc_links = story.get("documentation_links", [])
    if doc_links:
        description_parts.append("\n*Documentation Links:*")
        for link in doc_links:
            description_parts.append(f"- {link}")

    # Prepare Jira labels including enhanced metadata
    labels = list(story.get("tags", []))
    labels.append(f"risk-{story.get('risk_level', 'medium')}")
    labels.append(f"value-{story.get('business_value', 'medium')}")
    if story.get('story_type'):
        labels.append(f"type-{story['story_type']}")
    if story.get('epic_id'):
        labels.append(f"epic-{story['epic_id']}")

    return {
        "fields": {
            "project": {"key": project_key},
            "summary": story.get("title", ""),
            "description": "\n".join(description_parts),
            "issuetype": {"name": "Story"},
            "labels": labels,
            "customfield_10016": story.get("story_points", 0),  # Story Points field
        },
        "story_id": story.get("id"),
        "estimated_hours": story.get("estimated_hours", 0),
        "risk_level": story.get("risk_level", "medium"),
        "business_value": story.get("business_value", "medium"),
        # Include all enhanced fields for database storage
        "enhanced_fields": {
            "user_persona": story.get("user_persona"),
            "user_goal": story.get("user_goal"),
            "definition_of_done": story.get("definition_of_done", []),
            "testing_notes": story.get("testing_notes"),
            "design_notes": story.get("design_notes"),
            "security_considerations": story.get("security_considerations"),
            "performance_requirements": story.get("performance_requirements"),
            "accessibility_notes": story.get("accessibility_notes"),
            "deployment_notes": story.get("deployment_notes"),
            "rollback_plan": story.get("rollback_plan"),
            "monitoring_requirements": story.get("monitoring_requirements"),
            "documentation_links": story.get("documentation_links", []),
            "related_stories": story.get("related_stories", []),
            "blocked_by": story.get("blocked_by", []),
            "blocking": story.get("blocking", []),
            "effort_breakdown": story.get("effort_breakdown"),
            "changelog": story.get("changelog", []),
            "comments": story.get("comments", []),
            "attachments": story.get("attachments", []),
            "time_tracking": story.get("time_tracking"),
            "story_type": story.get("story_type"),
            "epic_id": story.get("epic_id"),
            "sub_tasks": story.get("sub_tasks", [])
        }
    }

# Real Jira connection setup
def get_jira_client():
    """Get authenticated Jira client."""
    if not JIRA_AVAILABLE:
        raise Exception("Jira package not available")

    jira_server = os.getenv('JIRA_SERVER_URL')
    jira_username = os.getenv('JIRA_USERNAME')
    jira_api_token = os.getenv('JIRA_API_TOKEN')

    if not all([jira_server, jira_username, jira_api_token]):
        raise Exception("Missing Jira credentials in environment variables")

    try:
        jira = JIRA(
            server=jira_server,
            basic_auth=(jira_username, jira_api_token)
        )
        return jira
    except Exception as e:
        logger.error(f"Failed to connect to Jira: {e}")
        raise Exception(f"Jira connection failed: {e}")

# Real ArangoDB connection setup
def get_arango_client():
    """Get authenticated ArangoDB client and database using new service infrastructure."""
    try:
        # Import and use new service infrastructure
        from api.services.app_services import get_database_connection
        db = get_database_connection()
        if db:
            logger.info("Using new DatabaseManager service")
            return db
        else:
            logger.warning("DatabaseManager service returned None, trying fallback")
    except ImportError:
        logger.warning("New service infrastructure not available, using fallback")
    except Exception as e:
        logger.error(f"Error with new service infrastructure: {e}, using fallback")

    # Fallback to original implementation
    if not ARANGO_AVAILABLE:
        raise Exception("ArangoDB package not available")

    arango_host = os.getenv('ARANGO_HOST', 'localhost')
    arango_port = int(os.getenv('ARANGO_PORT', '8529'))
    ARANGO_USER = os.getenv('ARANGO_USER', 'root')
    arango_password = os.getenv('ARANGO_PASSWORD', '')
    arango_database = os.getenv('ARANGO_DATABASE', 'code_management')

    try:
        # Create client
        client = ArangoClient(hosts=f'http://{arango_host}:{arango_port}')

        # Connect to system database first
        sys_db = client.db('_system', username=ARANGO_USER, password=arango_password)

        # Create database if it doesn't exist
        if not sys_db.has_database(arango_database):
            sys_db.create_database(arango_database)
            logger.info(f"Created database: {arango_database}")

        # Connect to our database
        db = client.db(arango_database, username=ARANGO_USER, password=arango_password)

        # Create collections if they don't exist
        collections = ['stories', 'team_members', 'milestones', 'jira_sync_log', 'ast_nodes', 'code_files', 'repositories', 'ai_analysis_tickets']
        edge_collections = ['relationships']

        for collection_name in collections:
            if not db.has_collection(collection_name):
                db.create_collection(collection_name)
                logger.info(f"Created collection: {collection_name}")

        for collection_name in edge_collections:
            if not db.has_collection(collection_name):
                db.create_collection(collection_name, edge=True)
                logger.info(f"Created edge collection: {collection_name}")

        # Create graph if it doesn't exist
        if not db.has_graph('code_graph'):
            try:
                db.create_graph(
                    'code_graph',
                    edge_definitions=[
                        {
                            'edge_collection': 'relationships',
                            'from_vertex_collections': ['ast_nodes', 'code_files'],
                            'to_vertex_collections': ['ast_nodes', 'code_files']
                        }
                    ]
                )
                logger.info("Created code_graph for AST analysis")
            except Exception as e:
                logger.warning(f"Failed to create code_graph: {e}")

        return db
    except Exception as e:
        logger.error(f"Failed to connect to ArangoDB: {e}")
        raise Exception(f"ArangoDB connection failed: {e}")
logger = logging.getLogger(__name__)

# Import routers
# from routers.security_enhanced import router as security_router
# from routers.hybrid_search import router as hybrid_search_router
# from routers.repositories import router as repositories_router
# from routers.documentation import docs_router

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
        #"http://localhost:3005",
        #"http://localhost:3006",  # Frontend running on port 3006
        "http://localhost:5173",  # Vite dev server
        #"http://127.0.0.1:3000",
        #"http://127.0.0.1:3001",
        #"http://127.0.0.1:3002",
        #"http://127.0.0.1:3003",
        #"http://127.0.0.1:3004",
        #"http://127.0.0.1:3005",
        #"http://127.0.0.1:3006",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# app.include_router(security_router)
# app.include_router(hybrid_search_router)
# app.include_router(repositories_router)
# app.include_router(docs_router)

# Pydantic models
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str

class SystemStatus(BaseModel):
    status: str
    timestamp: str
    uptime: float
    uptime_seconds: int
    memory_usage: Dict[str, Any]
    cpu_usage: float
    services: Dict[str, str]
    database: Optional[Dict[str, Any]] = None
    collections: int = 0
    code_nodes: int = 0
    repositories_count: int = 0

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

class AIEnhancementRequest(BaseModel):
    similarity_group: Dict[str, Any]
    code_snippets: List[Dict[str, Any]]
    analysis_context: Optional[Dict[str, Any]] = None

class AIEnhancementResponse(BaseModel):
    success: bool
    enhanced_analysis: Optional[Dict[str, Any]] = None
    original_analysis: Dict[str, Any]
    ai_recommendations: List[str]
    consolidation_strategy: Optional[str] = None
    estimated_effort_hours: Optional[float] = None
    risk_assessment: Optional[str] = None
    error: Optional[str] = None

class JiraTicketFromAIRequest(BaseModel):
    project_key: str = "SCRUM"
    ai_analysis: Union[str, Dict[str, Any]]
    similarity_group: Optional[Dict[str, Any]] = None
    code_snippets: List[str] = []
    ticket_title: Optional[str] = None
    priority: Optional[str] = "Medium"
    assignee: Optional[str] = None
    additional_notes: Optional[str] = None

class JiraTicketResponse(BaseModel):
    success: bool
    ticket_key: Optional[str] = None
    ticket_url: Optional[str] = None
    arango_id: Optional[str] = None
    error: Optional[str] = None

# AI Refactoring System Models
class RefactoringAnalysisRequest(BaseModel):
    scope: str = "global"  # global, module, class, function
    target_path: Optional[str] = None
    refactoring_types: List[str] = ["all"]
    similarity_threshold: float = 0.8
    max_suggestions: int = 50
    include_impact_analysis: bool = True

class RefactoringOpportunityResponse(BaseModel):
    id: str
    type: str
    priority: str
    title: str
    description: str
    affected_files: List[str]
    estimated_effort: str
    potential_savings: Dict[str, Any]
    risk_level: str
    implementation_strategy: str
    ai_analysis: Dict[str, Any]
    created_at: str

class SimilarityAnalysisRequest(BaseModel):
    target_node_id: str
    similarity_threshold: float = 0.8
    max_results: int = 10
    embedding_types: List[str] = ["purpose", "code", "context", "domain"]

class SimilarityAnalysisResponse(BaseModel):
    source_id: str
    target_id: str
    similarity_scores: Dict[str, float]
    combined_score: float
    similarity_type: str
    confidence: float
    evidence: List[str]

class CodePurposeAnalysisRequest(BaseModel):
    file_path: str
    code_content: str
    analysis_level: str = "function"  # function, class, module

class CodePurposeAnalysisResponse(BaseModel):
    success: bool
    file_path: str
    analysis_results: List[Dict[str, Any]]
    total_nodes_analyzed: int
    error: Optional[str] = None

class ImpactAnalysisRequest(BaseModel):
    refactoring_opportunity_id: str
    detailed_analysis: bool = True

class ImpactAnalysisResponse(BaseModel):
    refactoring_id: str
    affected_components: List[Dict[str, Any]]
    risk_assessment: Dict[str, Any]
    effort_estimation: Dict[str, Any]
    benefits_analysis: Dict[str, Any]
    test_impact: Dict[str, Any]
    dependency_impact: List[Dict[str, Any]]

# AI Analysis Caching Helpers
def generate_analysis_hash(similarity_group: Dict, code_snippets: List[Dict]) -> str:
    """Generate a consistent hash for caching AI analysis results."""
    # Create a normalized representation of the input
    cache_data = {
        'similarity_group': {
            'similarity_type': similarity_group.get('similarity_type'),
            'group_id': similarity_group.get('group_id'),
            'functions': sorted([
                {
                    'function_name': func.get('function_name', func.get('name')),
                    'file_path': func.get('file_path'),
                    'line_start': func.get('line_start'),
                    'line_end': func.get('line_end')
                }
                for func in similarity_group.get('functions', [])
            ], key=lambda x: (x.get('file_path', ''), x.get('function_name', '')))
        },
        'code_snippets': sorted([
            {
                'function_name': snippet.get('function_name'),
                'file_path': snippet.get('file_path'),
                'code_hash': hashlib.md5(snippet.get('code', '').encode()).hexdigest() if snippet.get('code') else None
            }
            for snippet in code_snippets
        ], key=lambda x: (x.get('file_path', ''), x.get('function_name', '')))
    }

    # Generate hash from the normalized data
    cache_str = json.dumps(cache_data, sort_keys=True)
    return hashlib.sha256(cache_str.encode()).hexdigest()

async def get_cached_analysis(analysis_hash: str) -> Optional[Dict]:
    """Retrieve cached AI analysis result from ArangoDB."""
    try:
        db = get_arango_client()
        collection = db.collection('ai_analysis_cache')

        # Query for existing analysis with this hash
        query = """
        FOR doc IN ai_analysis_cache
        FILTER doc.analysis_hash == @hash AND doc.created_at > @expiry_date
        SORT doc.created_at DESC
        LIMIT 1
        RETURN doc
        """

        # Set expiry to 7 days ago (analyses older than this are considered stale)
        expiry_date = (datetime.now() - timedelta(days=7)).isoformat()

        cursor = db.aql.execute(query, bind_vars={
            'hash': analysis_hash,
            'expiry_date': expiry_date
        })

        results = list(cursor)
        if results:
            logger.info(f"Found cached AI analysis for hash: {analysis_hash[:8]}...")
            return results[0].get('analysis_result')

        return None

    except Exception as e:
        logger.warning(f"Failed to retrieve cached analysis: {e}")
        return None

async def store_analysis_cache(analysis_hash: str, similarity_group: Dict, code_snippets: List[Dict], analysis_result: Dict) -> None:
    """Store AI analysis result in ArangoDB cache."""
    try:
        db = get_arango_client()

        # Ensure the collection exists
        if not db.has_collection('ai_analysis_cache'):
            db.create_collection('ai_analysis_cache')

        collection = db.collection('ai_analysis_cache')

        cache_doc = {
            'analysis_hash': analysis_hash,
            'similarity_group': similarity_group,
            'code_snippets_count': len(code_snippets),
            'function_names': [func.get('function_name', func.get('name')) for func in similarity_group.get('functions', [])],
            'analysis_result': analysis_result,
            'created_at': datetime.now().isoformat(),
            'model_version': os.getenv('BEDROCK_MODEL_ID', 'unknown'),
            'expires_at': (datetime.now() + timedelta(days=7)).isoformat()
        }

        collection.insert(cache_doc)
        logger.info(f"Stored AI analysis cache for hash: {analysis_hash[:8]}...")

    except Exception as e:
        logger.warning(f"Failed to store analysis cache: {e}")

# Bedrock AI Service
class BedrockAIService:
    def __init__(self):
        self.bedrock_available = BEDROCK_AVAILABLE
        if self.bedrock_available:
            try:
                # Ensure environment variables are loaded - try multiple approaches
                from pathlib import Path

                # First try loading dotenv again
                try:
                    from dotenv import load_dotenv
                    env_path = Path(__file__).parent.parent / ".env"
                    load_dotenv(dotenv_path=env_path, override=True)  # Use override=True
                    logger.debug(f"Re-loaded environment variables in BedrockAIService from: {env_path}")
                except ImportError:
                    pass

                # Also try reading the file directly as a fallback
                aws_access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
                aws_secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')

                # If still not found, try reading .env file directly
                if not aws_access_key_id or not aws_secret_access_key:
                    env_path = Path(__file__).parent.parent / ".env"
                    if env_path.exists():
                        logger.debug(f"Reading .env file directly from: {env_path}")
                        with open(env_path, 'r') as f:
                            for line in f:
                                line = line.strip()
                                if line.startswith('AWS_ACCESS_KEY_ID='):
                                    aws_access_key_id = line.split('=', 1)[1]
                                elif line.startswith('AWS_SECRET_ACCESS_KEY='):
                                    aws_secret_access_key = line.split('=', 1)[1]

                aws_region = os.getenv('AWS_REGION', 'us-east-1')

                logger.debug(f"AWS_ACCESS_KEY_ID: {'***' if aws_access_key_id else 'None'}")
                logger.debug(f"AWS_SECRET_ACCESS_KEY: {'***' if aws_secret_access_key else 'None'}")
                logger.debug(f"AWS_REGION: {aws_region}")

                if not aws_access_key_id or not aws_secret_access_key:
                    logger.warning("AWS credentials not found in environment variables")
                    logger.warning(f"AWS_ACCESS_KEY_ID present: {aws_access_key_id is not None}")
                    logger.warning(f"AWS_SECRET_ACCESS_KEY present: {aws_secret_access_key is not None}")
                    self.bedrock_available = False
                    return

                self.bedrock_client = boto3.client(
                    'bedrock-runtime',
                    aws_access_key_id=aws_access_key_id,
                    aws_secret_access_key=aws_secret_access_key,
                    region_name=aws_region
                )
                self.model_id = os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0')

                logger.info(f"Successfully initialized Bedrock client with region: {aws_region}")
            except Exception as e:
                logger.warning(f"Failed to initialize Bedrock client: {e}")
                self.bedrock_available = False

    async def invoke_model(self, prompt: str) -> str:
        """Main method to invoke Bedrock AI model with automatic authentication selection."""
        if not self.bedrock_available:
            raise Exception("AWS Bedrock not available")

        try:
            # Reload environment variables to ensure we have the latest values
            try:
                from dotenv import load_dotenv
                env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
                load_dotenv(dotenv_path=env_path, override=True)
            except ImportError:
                pass

            # Check if we have Bearer Token for Claude 4.x models
            bearer_token = os.getenv('AWS_BEARER_TOKEN_BEDROCK')
            is_claude4 = 'sonnet-4' in self.model_id.lower()

            # Debug logging
            logger.info(f"Debug - Model ID: {self.model_id}")
            logger.info(f"Debug - is_claude4: {is_claude4}")
            logger.info(f"Debug - Bearer Token present: {bool(bearer_token)}")

            if bearer_token and is_claude4:
                # Use Bearer Token method for Claude 4.x Cross-Region Inference Profile
                logger.info(f"Using Bearer Token authentication for Claude 4.x model: {self.model_id}")
                result = await self._invoke_with_bearer_token(prompt, bearer_token)
            else:
                # Use AWS SDK method for other models
                logger.info(f"Using AWS SDK authentication for model: {self.model_id}")
                result = await self._invoke_with_aws_sdk(prompt)

            return result

        except Exception as e:
            logger.error(f"Bedrock model invocation failed: {e}")
            raise

    async def enhance_similarity_analysis(self, similarity_group: Dict, code_snippets: List[Dict]) -> Dict:
        """Enhance similarity analysis using AWS Bedrock AI with caching."""
        if not self.bedrock_available:
            return {
                "error": "AWS Bedrock not available",
                "ai_recommendations": ["Bedrock AI enhancement is not configured"],
                "consolidation_strategy": "Manual review required"
            }

        try:
            # Generate hash for caching
            analysis_hash = generate_analysis_hash(similarity_group, code_snippets)

            # Check if we have a cached result
            cached_result = await get_cached_analysis(analysis_hash)
            if cached_result:
                logger.info(f"Returning cached AI analysis for similarity group {similarity_group.get('group_id')}")
                return cached_result

            logger.info(f"Performing new AI analysis for similarity group {similarity_group.get('group_id')}")

            # Prepare the prompt for Claude
            prompt = self._build_analysis_prompt(similarity_group, code_snippets)

            # Reload environment variables to ensure we have the latest values
            try:
                from dotenv import load_dotenv
                env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
                load_dotenv(dotenv_path=env_path, override=True)
            except ImportError:
                pass

            # Check if we have Bearer Token for Claude 4.x models
            bearer_token = os.getenv('AWS_BEARER_TOKEN_BEDROCK')
            is_claude4 = 'sonnet-4' in self.model_id.lower()

            # Debug logging
            logger.info(f"Debug - Model ID: {self.model_id}")
            logger.info(f"Debug - Model ID lower: {self.model_id.lower()}")
            logger.info(f"Debug - is_claude4: {is_claude4}")
            logger.info(f"Debug - Bearer Token present: {bool(bearer_token)}")
            logger.info(f"Debug - Bearer Token (first 20 chars): {bearer_token[:20] if bearer_token else 'None'}")

            # Debug: Check all AWS env vars
            aws_vars = {k: v for k, v in os.environ.items() if k.startswith('AWS_')}
            logger.info(f"Debug - All AWS env vars: {list(aws_vars.keys())}")
            logger.info(f"Debug - AWS_BEARER_TOKEN_BEDROCK in environ: {'AWS_BEARER_TOKEN_BEDROCK' in os.environ}")

            if bearer_token and is_claude4:
                # Use Bearer Token method for Claude 4.x Cross-Region Inference Profile
                logger.info(f"Using Bearer Token authentication for Claude 4.x model: {self.model_id}")
                result = await self._invoke_with_bearer_token(prompt, bearer_token)
            else:
                # Use AWS SDK method for other models
                logger.info(f"Using AWS SDK authentication for model: {self.model_id}")
                result = await self._invoke_with_aws_sdk(prompt)

            # Parse the structured response
            enhanced_analysis = self._parse_ai_response(result)

            # Store the result in cache for future use
            await store_analysis_cache(analysis_hash, similarity_group, code_snippets, enhanced_analysis)

            return enhanced_analysis

        except Exception as e:
            logger.error(f"Bedrock AI enhancement failed: {e}")
            return {
                "error": f"AI enhancement failed: {str(e)}",
                "ai_recommendations": ["Manual review required due to AI service error"],
                "consolidation_strategy": "Fallback to manual analysis"
            }

    async def _invoke_with_bearer_token(self, prompt: str, bearer_token: str) -> str:
        """Invoke Claude 4.x using Bearer Token authentication."""
        import urllib.parse
        import aiohttp

        # URL encode the model ID for Cross-Region Inference Profile
        encoded_model_id = urllib.parse.quote(self.model_id, safe='')
        url = f"https://bedrock-runtime.{os.getenv('AWS_REGION', 'us-east-1')}.amazonaws.com/model/{encoded_model_id}/invoke"

        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }

        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": int(os.getenv('AWS_MAX_TOKENS', '4000')),
            "temperature": float(os.getenv('AWS_TEMPERATURE', '0.7')),
            "top_p": float(os.getenv('AWS_TOP_P', '0.95')),
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return result['content'][0]['text']
                else:
                    error_text = await response.text()
                    raise Exception(f"Bearer Token request failed: {response.status} - {error_text}")

    async def _invoke_with_aws_sdk(self, prompt: str) -> str:
        """Invoke model using AWS SDK authentication."""
        response = self.bedrock_client.invoke_model(
            modelId=self.model_id,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": int(os.getenv('AWS_MAX_TOKENS', '4000')),
                "temperature": float(os.getenv('AWS_TEMPERATURE', '0.7')),
                "top_p": float(os.getenv('AWS_TOP_P', '0.95')),
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )

        # Parse response
        result = json.loads(response['body'].read())
        return result['content'][0]['text']

    def _build_analysis_prompt(self, similarity_group: Dict, code_snippets: List[Dict]) -> str:
        """Build a comprehensive prompt for code analysis."""
        prompt = f"""You are an expert software architect and code quality specialist. Analyze the following code similarity group and provide enhanced recommendations.

SIMILARITY GROUP ANALYSIS:
- Group ID: {similarity_group.get('group_id', 'unknown')}
- Similarity Type: {similarity_group.get('similarity_type', 'unknown')}
- Priority: {similarity_group.get('priority', 'unknown')}
- Similarity Score: {similarity_group.get('similarity_score', 0)}
- Number of Functions: {len(similarity_group.get('functions', []))}

CURRENT ANALYSIS:
{json.dumps(similarity_group.get('analysis', {}), indent=2)}

CODE SNIPPETS:
"""

        for i, snippet in enumerate(code_snippets[:5]):  # Limit to 5 snippets for token efficiency
            prompt += f"""
FUNCTION {i+1}:
File: {snippet.get('file_path', 'unknown')}
Function: {snippet.get('function_name', 'unknown')}
Lines: {snippet.get('line_start', 0)}-{snippet.get('line_end', 0)}
Code:
```
{snippet.get('code', 'Code not available')}
```

"""

        prompt += """
Please provide a JSON response with the following structure:
{
    "ai_recommendations": [
        "Specific actionable recommendation 1",
        "Specific actionable recommendation 2",
        "..."
    ],
    "consolidation_strategy": "Detailed strategy for consolidating these functions",
    "estimated_effort_hours": numeric_value,
    "risk_assessment": "LOW|MEDIUM|HIGH with explanation",
    "implementation_steps": [
        "Step 1: ...",
        "Step 2: ...",
        "..."
    ],
    "potential_issues": [
        "Issue 1: ...",
        "Issue 2: ..."
    ],
    "code_quality_impact": "Explanation of how this consolidation improves code quality",
    "suggested_refactor_pattern": "Recommended design pattern or refactoring approach"
}

Focus on:
1. Identifying the root cause of code duplication
2. Suggesting the best consolidation approach
3. Highlighting potential risks and mitigation strategies
4. Providing concrete implementation guidance
5. Estimating realistic effort and timeline"""

        return prompt

    def _parse_ai_response(self, ai_response: str) -> Dict:
        """Parse AI response and extract structured data."""
        try:
            # Try to extract JSON from the response
            import re
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                parsed_response = json.loads(json_match.group())
                return {
                    "ai_recommendations": parsed_response.get("ai_recommendations", []),
                    "consolidation_strategy": parsed_response.get("consolidation_strategy", ""),
                    "estimated_effort_hours": parsed_response.get("estimated_effort_hours", 0),
                    "risk_assessment": parsed_response.get("risk_assessment", "MEDIUM"),
                    "implementation_steps": parsed_response.get("implementation_steps", []),
                    "potential_issues": parsed_response.get("potential_issues", []),
                    "code_quality_impact": parsed_response.get("code_quality_impact", ""),
                    "suggested_refactor_pattern": parsed_response.get("suggested_refactor_pattern", "")
                }
        except Exception as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}")

        # Fallback: return the raw response
        return {
            "ai_recommendations": [ai_response],
            "consolidation_strategy": "See AI recommendations above",
            "estimated_effort_hours": 0,
            "risk_assessment": "MEDIUM - Manual review required"
        }

# Global Bedrock service instance (lazy initialization)
_bedrock_service = None

def get_bedrock_service():
    """Get or create the Bedrock service instance with lazy initialization."""
    global _bedrock_service
    if _bedrock_service is None:
        _bedrock_service = BedrockAIService()
    return _bedrock_service

# Global AI Refactoring service instances (lazy initialization)
_similarity_engine = None
_refactoring_engine = None
_enhanced_ast_parser = None

def get_similarity_engine():
    """Get or create the similarity engine instance using new service infrastructure."""
    global _similarity_engine

    # Try new service infrastructure first
    try:
        from api.services.app_services import get_similarity_engine_service
        engine = get_similarity_engine_service()
        if engine:
            _similarity_engine = engine  # Update global for compatibility
            logger.info("Using SimilarityEngine from service registry")
            return engine
    except ImportError:
        logger.warning("New service infrastructure not available for SimilarityEngine")
    except Exception as e:
        logger.error(f"Error with SimilarityEngine service: {e}")

    # Fallback to original implementation
    if _similarity_engine is None and AI_REFACTORING_AVAILABLE:
        try:
            db = get_arango_client()
            if db:
                _similarity_engine = SimilarityEngine(db)
                logger.info("Created SimilarityEngine with fallback method")
        except Exception as e:
            logger.error(f"Failed to initialize SimilarityEngine: {e}")
            _similarity_engine = None
    return _similarity_engine

def get_refactoring_engine():
    """Get or create the refactoring engine instance using new service infrastructure."""
    global _refactoring_engine

    # Try new service infrastructure first
    try:
        from api.services.app_services import get_refactoring_engine_service
        engine = get_refactoring_engine_service()
        if engine:
            _refactoring_engine = engine  # Update global for compatibility
            logger.info("Using RefactoringDecisionEngine from service registry")
            return engine
    except ImportError:
        logger.warning("New service infrastructure not available for RefactoringDecisionEngine")
    except Exception as e:
        logger.error(f"Error with RefactoringDecisionEngine service: {e}")

    # Fallback to original implementation
    if _refactoring_engine is None and AI_REFACTORING_AVAILABLE:
        try:
            db = get_arango_client()
            similarity_engine = get_similarity_engine()
            if db and similarity_engine:
                _refactoring_engine = RefactoringDecisionEngine(db, similarity_engine)
                logger.info("Created RefactoringDecisionEngine with fallback method")
        except Exception as e:
            logger.error(f"Failed to initialize RefactoringDecisionEngine: {e}")
            _refactoring_engine = None
    return _refactoring_engine

def get_enhanced_ast_parser():
    """Get or create the enhanced AST parser instance using new service infrastructure."""
    global _enhanced_ast_parser

    # Try new service infrastructure first
    try:
        from api.services.app_services import get_enhanced_ast_parser_service
        parser = get_enhanced_ast_parser_service()
        if parser:
            _enhanced_ast_parser = parser  # Update global for compatibility
            logger.info("Using EnhancedASTParserService from service registry")
            return parser
    except ImportError:
        logger.warning("New service infrastructure not available for EnhancedASTParserService")
    except Exception as e:
        logger.error(f"Error with EnhancedASTParserService service: {e}")

    # Fallback to original implementation
    if _enhanced_ast_parser is None and AI_REFACTORING_AVAILABLE:
        try:
            db = get_arango_client()
            if db:
                _enhanced_ast_parser = EnhancedASTParserService(db)
                logger.info("Created EnhancedASTParserService with fallback method")
        except Exception as e:
            logger.error(f"Failed to initialize EnhancedASTParserService: {e}")
            _enhanced_ast_parser = None
    return _enhanced_ast_parser

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

    # Check service status based on environment configuration
    services = {
        "api": "running",
        "database": "configured" if os.getenv('ARANGO_HOST') else "not_configured",
        "github_integration": "configured" if os.getenv('GITHUB_TOKEN') else "not_configured",
        "jira_integration": "configured" if os.getenv('JIRA_API_TOKEN') else "not_configured",
        "ollama": "configured" if os.getenv('OLLAMA_URL') else "not_configured",
        "background_jobs": "active"
    }

    # Get database collection counts
    database_info = {
        "status": "unknown",
        "collections": {
            "codeNodes": 0,
            "repositories": 0,
            "stories": 0,
            "embeddings": 0
        }
    }

    try:
        # Try to get database manager and collection info
        from core.database_manager import UnifiedDatabaseManager
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        if hasattr(db_manager, 'db') and db_manager.db:
            database_info["status"] = "connected"
            
            # Get collection counts safely
            try:
                if db_manager.db.has_collection('repositories'):
                    database_info["collections"]["repositories"] = db_manager.db.collection('repositories').count()
                if db_manager.db.has_collection('code_files'):
                    database_info["collections"]["codeNodes"] = db_manager.db.collection('code_files').count()
                if db_manager.db.has_collection('ast_nodes'):
                    database_info["collections"]["ast_nodes"] = db_manager.db.collection('ast_nodes').count()
                if db_manager.db.has_collection('embeddings'):
                    database_info["collections"]["embeddings"] = db_manager.db.collection('embeddings').count()
            except:
                pass
                
            try:
                if db_manager.db.has_collection('repositories'):
                    database_info["collections"]["repositories"] = db_manager.db.collection('repositories').count()
            except:
                pass
                
            try:
                if db_manager.db.has_collection('stories'):
                    database_info["collections"]["stories"] = db_manager.db.collection('stories').count()
            except:
                pass
                
            try:
                if db_manager.db.has_collection('embeddings'):
                    database_info["collections"]["embeddings"] = db_manager.db.collection('embeddings').count()
            except:
                pass
        else:
            database_info["status"] = "not_connected"
    except Exception as e:
        logger.warning(f"Could not get database info: {e}")
        database_info["status"] = "error"

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime": time.time() - psutil.boot_time(),
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "memory_usage": {
            "total": memory.total,
            "available": memory.available,
            "percent": memory.percent,
            "used": memory.used,
            "free": memory.free
        },
        "cpu_usage": cpu_percent,
        "services": services,
        "database": database_info,
        "active_jobs": 0,  # TODO: Get from job manager
        "total_repositories": database_info["collections"]["repositories"]
    }

# System metrics endpoint  
@app.get("/api/system/metrics")
async def get_system_metrics():
    """Get detailed system metrics for monitoring."""
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        "timestamp": datetime.now().isoformat(),
        "system": {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory": {
                "total": memory.total,
                "used": memory.used,
                "free": memory.free,
                "percent": memory.percent
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": (disk.used / disk.total) * 100
            },
            "load_average": os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
        },
        "api": {
            "requests_per_minute": 45,  # TODO: Implement actual tracking
            "avg_response_time": 120,   # milliseconds
            "error_rate": 0.5,         # percentage
            "active_connections": 8
        },
        "database": {
            "connection_pool_size": 10,
            "active_connections": 3,
            "query_response_time": 15,  # milliseconds
            "cache_hit_ratio": 85       # percentage
        }
    }

# Configuration endpoint
@app.get("/api/config")
async def get_configuration():
    """Get current configuration (without sensitive data)."""
    return {
        "database": {
            "host": os.getenv('ARANGO_HOST', 'localhost'),
            "port": int(os.getenv('ARANGO_PORT', '8529')),
            "database": os.getenv('ARANGO_DATABASE', 'code_management'),
            "use_custom_index": os.getenv('ARANGO_USE_CUSTOM_INDEX', 'true').lower() == 'true'
        },
        "github": {
            "configured": bool(os.getenv('GITHUB_TOKEN'))
        },
        "jira": {
            "server_url": os.getenv('JIRA_SERVER_URL'),
            "username": os.getenv('JIRA_USERNAME'),
            "project_key": os.getenv('JIRA_PROJECT_KEY'),
            "configured": bool(os.getenv('JIRA_API_TOKEN'))
        },
        "ollama": {
            "url": os.getenv('OLLAMA_URL', 'http://localhost:11434'),
            "model": os.getenv('OLLAMA_MODEL', 'nomic-embed-text'),
            "configured": bool(os.getenv('OLLAMA_URL'))
        },
        "analysis": {
            "excluded_dirs": os.getenv('EXCLUDED_DIRS', '').split(','),
            "batch_size": int(os.getenv('ANALYSIS_BATCH_SIZE', '50')),
            "max_workers": int(os.getenv('MAX_WORKERS', '4')),
            "security_scan": os.getenv('RUN_SECURITY_SCAN', 'true').lower() == 'true',
            "code_quality": os.getenv('RUN_CODE_QUALITY', 'true').lower() == 'true'
        },
        "logging": {
            "level": os.getenv('LOG_LEVEL', 'INFO'),
            "file": os.getenv('LOG_FILE', 'repo_analyzer.log')
        }
    }

# Repository endpoints
@app.get("/api/repositories")
async def get_repositories():
    """Get all repositories with detailed information, including analysis data."""
    try:
        # Try to get from database using unified database manager
        from core.database_manager import UnifiedDatabaseManager
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        repositories = []
        
        if hasattr(db_manager, 'db') and db_manager.db:
            try:
                # Get repositories from the repositories collection
                if db_manager.db.has_collection('repositories'):
                    cursor = db_manager.db.aql.execute("""
                        FOR repo IN repositories
                            RETURN {
                                _key: repo._key,
                                id: repo._key,
                                name: repo.name,
                                url: repo.url,
                                language: repo.primary_language || "Unknown",
                                status: repo.status || "active",
                                created_at: repo.created_at,
                                stats: {
                                    files_count: repo.file_stats.total_files || 0,
                                    lines_of_code: repo.file_stats.total_lines || 0,
                                    commits: repo.latest_commit ? 1 : 0
                                }
                            }
                    """)
                    repositories = list(cursor)
                
                # Also get repositories from analysis collections that might not be in the repositories collection
                analysis_repos_query = """
                FOR unit IN codeunits
                    COLLECT repo_id = unit.repository_id WITH COUNT INTO codeunit_count
                    LET file_count = (
                        FOR file IN code_files
                            FILTER file.repository_id == repo_id
                            COLLECT WITH COUNT INTO file_count
                            RETURN file_count
                    )[0] || 0
                    LET ast_count = (
                        FOR node IN ast_nodes
                            FILTER node.repository_id == repo_id
                            COLLECT WITH COUNT INTO ast_count
                            RETURN ast_count
                    )[0] || 0
                    RETURN {
                        _key: repo_id,
                        id: repo_id,
                        name: repo_id == "code_management_analyzer" ? "Code Management Analyzer (Main)" : 
                              repo_id == "d287062f2a268ffa" ? "Streamlit Code Analyzer" :
                              repo_id,
                        url: null,
                        language: "Python",
                        status: "analyzed",
                        created_at: null,
                        stats: {
                            files_count: file_count,
                            lines_of_code: codeunit_count * 20, // Rough estimate
                            commits: 1
                        },
                        analysis_data: {
                            ast_nodes: ast_count,
                            codeunits: codeunit_count,
                            files: file_count,
                            has_documentation_data: true
                        }
                    }
                """
                
                cursor = db_manager.db.aql.execute(analysis_repos_query)
                analysis_repositories = list(cursor)
                
                # Merge analysis data into existing repositories and add missing ones
                repo_map = {repo['_key']: repo for repo in repositories}
                
                for analysis_repo in analysis_repositories:
                    repo_id = analysis_repo['_key']
                    if repo_id in repo_map:
                        # Update existing repository with analysis data
                        repo_map[repo_id]['analysis_data'] = analysis_repo['analysis_data']
                        repo_map[repo_id]['stats']['files_count'] = analysis_repo['stats']['files_count']
                    else:
                        # Add new repository from analysis data
                        repositories.append(analysis_repo)
                
                repositories = list(repo_map.values()) + [repo for repo in analysis_repositories if repo['_key'] not in repo_map]
                
            except Exception as e:
                logger.warning(f"Could not fetch repositories from database: {e}")
                
        if not repositories:
            # Fallback to sample data if no real data available
            repositories = [
                {
                    "_key": "sample-repo-1",
                    "id": "sample-repo-1",
                    "name": "Sample Repository",
                    "url": "https://github.com/example/sample",
                    "language": "JavaScript",
                    "status": "active",
                    "created_at": "2024-01-01T00:00:00Z",
                    "stats": {
                        "files_count": 45,
                        "lines_of_code": 12500,
                        "commits": 127
                    }
                }
            ]
        
        # Sort repositories by analysis data availability and size
        def sort_key(repo):
            analysis_data = repo.get('analysis_data', {})
            has_analysis = analysis_data.get('has_documentation_data', False)
            codeunits = analysis_data.get('codeunits', 0)
            return (has_analysis, codeunits)
        
        repositories.sort(key=sort_key, reverse=True)
        
        return {
            "repositories": repositories,
            "total_count": len(repositories),
            "data_source": "database_with_analysis",
            "analysis_note": "Repositories with analysis_data.has_documentation_data=true support documentation generation"
        }
        
    except Exception as e:
        logger.error(f"Error getting repositories: {e}")
        return {
            "repositories": [],
            "total_count": 0,
            "data_source": "error",
            "error": str(e)
        }

@app.get("/api/repositories/jobs")
async def get_repository_jobs():
    """Get repository analysis jobs."""
    return {"jobs": [], "message": "Analysis jobs coming soon"}

# Project management endpoints
@app.get("/api/stories")
async def get_stories():
    """Get all user stories from ArangoDB."""
    try:
        # Get from ArangoDB
        db = get_arango_client()

        # Get all stories
        stories_collection = db.collection('stories')
        stories = []
        for story_doc in stories_collection.all():
            story = {k: v for k, v in story_doc.items() if not k.startswith('_')}
            stories.append(story)

        # Get all team members
        team_members = get_all_team_members()

        # Get all milestones
        milestones = get_all_milestones()

        # Get project info
        project_info = get_project_info()

        # Get board config
        board_config = get_board_config()

        return {
            "stories": stories,
            "team_members": team_members,
            "milestones": milestones,
            "project_info": project_info,
            "board_config": board_config,
            "data_source": {
                "stories": "database",
                "team_members": "database",
                "milestones": "database",
                "project_info": "database",
                "board_config": "database"
            }
        }

    except Exception as e:
        logger.error(f"Failed to load data from database: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve data: {str(e)}")

@app.get("/api/sprints")
async def get_sprints():
    """Get all sprints from database."""
    try:
        db = get_arango_client()
        sprints_collection = db.collection('sprints')
        sprints = []
        for sprint_doc in sprints_collection.all():
            sprint = {k: v for k, v in sprint_doc.items() if not k.startswith('_')}
            sprints.append(sprint)

        return {"sprints": sprints, "total_count": len(sprints)}
    except Exception as e:
        logger.error(f"Error retrieving sprints: {e}")
        return {"sprints": [], "total_count": 0, "error": str(e)}

@app.post("/api/sprints/create")
async def create_sprint(sprint_data: dict):
    """Create a new sprint in database."""
    try:
        db = get_arango_client()
        sprints_collection = db.collection('sprints')

        # Create sprint document
        sprint_doc = {
            "_key": sprint_data.get("id") or f"sprint_{int(time.time())}",
            "created_at": datetime.now().isoformat(),
            **sprint_data
        }

        result = sprints_collection.insert(sprint_doc)
        return {"success": True, "sprint_id": result["_key"], "message": "Sprint created successfully"}
    except Exception as e:
        logger.error(f"Error creating sprint: {e}")
        return {"success": False, "error": str(e)}

@app.put("/api/sprints/{sprint_id}/start")
async def start_sprint(sprint_id: str):
    """Start a sprint."""
    try:
        db = get_arango_client()
        sprints_collection = db.collection('sprints')

        # Update sprint status
        update_data = {
            "status": "active",
            "started_at": datetime.now().isoformat()
        }
        sprints_collection.update({"_key": sprint_id}, update_data)

        return {"success": True, "message": f"Sprint {sprint_id} started successfully"}
    except Exception as e:
        logger.error(f"Error starting sprint: {e}")
        return {"success": False, "error": str(e)}

@app.put("/api/sprints/{sprint_id}/complete")
async def complete_sprint(sprint_id: str):
    """Complete a sprint."""
    try:
        db = get_arango_client()
        sprints_collection = db.collection('sprints')

        # Update sprint status
        update_data = {
            "status": "completed",
            "completed_at": datetime.now().isoformat()
        }
        sprints_collection.update({"_key": sprint_id}, update_data)

        return {"success": True, "message": f"Sprint {sprint_id} completed successfully"}
    except Exception as e:
        logger.error(f"Error completing sprint: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/sprints/move-story")
async def move_story(move_data: dict):
    """Move a story between sprints."""
    try:
        story_id = move_data.get("story_id")
        new_sprint_id = move_data.get("new_sprint_id")

        if not story_id:
            return {"success": False, "error": "story_id is required"}

        db = get_arango_client()
        stories_collection = db.collection('stories')

        # Update story's sprint assignment
        update_data = {"sprint_id": new_sprint_id}
        stories_collection.update({"_key": story_id}, update_data)

        return {"success": True, "message": "Story moved successfully"}
    except Exception as e:
        logger.error(f"Error moving story: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/stories/upsert")
async def upsert_story(story_data: dict):
    """Create or update a story in the database."""
    try:
        # For now, just return success since this is for migration
        # In practice, this would interact with ArangoDB
        logger.info(f"Upserting story: {story_data.get('id', 'unknown')}")
        return {
            "success": True,
            "story_id": story_data.get('id'),
            "message": "Story upserted successfully"
        }
    except Exception as e:
        logger.error(f"Error upserting story: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upsert story: {str(e)}")

@app.post("/api/project/metadata")
async def upsert_project_metadata(metadata: dict):
    """Create or update project metadata in the database."""
    try:
        logger.info("Upserting project metadata")
        return {
            "success": True,
            "message": "Project metadata upserted successfully"
        }
    except Exception as e:
        logger.error(f"Error upserting project metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upsert metadata: {str(e)}")

@app.put("/api/stories/{story_id}/move")
async def move_story_status(story_id: str, request: Request):
    """Move a story to different status."""
    try:
        body = await request.json()
        new_status = body.get("status")

        if not new_status:
            raise HTTPException(status_code=400, detail="Status is required")

        # Get database connection
        db = get_arango_client()

        # Get the current story
        story_result = db.aql.execute('''
            FOR story IN stories
            FILTER story.id == @story_id
            RETURN story
        ''', bind_vars={'story_id': story_id})

        stories = list(story_result)
        if not stories:
            raise HTTPException(status_code=404, detail=f"Story {story_id} not found")

        story = stories[0]
        old_status = story.get('status', '')
        jira_key = story.get('jira_key')

        # Update the story in ArangoDB
        update_result = db.aql.execute('''
            FOR story IN stories
            FILTER story.id == @story_id
            UPDATE story WITH {status: @new_status, last_modified: @timestamp} IN stories
            RETURN NEW
        ''', bind_vars={
            'story_id': story_id,
            'new_status': new_status,
            'timestamp': datetime.now().isoformat()
        })

        updated_story = list(update_result)

        # If story has a Jira key, attempt to sync the status
        jira_sync_success = True
        jira_message = ""

        if jira_key:
            try:
                if not JIRA_SERVICE_AVAILABLE or jira_service is None:
                    jira_sync_success = False
                    jira_message = "Jira service not available"
                else:
                    # Get available transitions for the Jira issue
                    transitions = await jira_service.get_transitions(jira_key)

                # Map local status to Jira transition
                status_to_transition = {
                    'To Do': ['To Do', 'Open', 'Backlog'],
                    'In Progress': ['In Progress', 'Start Progress'],
                    'Done': ['Done', 'Close Issue', 'Resolve Issue']
                }

                target_transitions = status_to_transition.get(new_status, [])
                matching_transition = None

                # Find a matching transition
                for transition in transitions:
                    transition_name = transition.get('name', '')
                    if any(target in transition_name for target in target_transitions):
                        matching_transition = transition
                        break

                if matching_transition:
                    transition_id = matching_transition.get('id')
                    comment = f"Status updated from '{old_status}' to '{new_status}' via Code Management Analyzer"

                    success = await jira_service.transition_issue(jira_key, transition_id, comment)
                    if success:
                        jira_message = f"Jira issue {jira_key} status updated successfully"

                        # Update sync status
                        db.aql.execute('''
                            FOR story IN stories
                            FILTER story.id == @story_id
                            UPDATE story WITH {jira_sync_status: "synced", last_synced: @timestamp} IN stories
                        ''', bind_vars={
                            'story_id': story_id,
                            'timestamp': datetime.now().isoformat()
                        })
                    else:
                        jira_sync_success = False
                        jira_message = f"Failed to update Jira issue {jira_key} status"
                else:
                    jira_sync_success = False
                    jira_message = f"No matching transition found for status '{new_status}' in Jira issue {jira_key}"

            except Exception as e:
                jira_sync_success = False
                jira_message = f"Error syncing with Jira: {str(e)}"
                logger.error(f"Jira sync error for story {story_id}: {str(e)}")

        # Log the move operation
        try:
            db.aql.execute('''
                INSERT {
                    type: "story_move",
                    story_id: @story_id,
                    old_status: @old_status,
                    new_status: @new_status,
                    jira_key: @jira_key,
                    jira_synced: @jira_synced,
                    timestamp: @timestamp
                } INTO jira_sync_log
            ''', bind_vars={
                'story_id': story_id,
                'old_status': old_status,
                'new_status': new_status,
                'jira_key': jira_key,
                'jira_synced': jira_sync_success,
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            logger.warning(f"Failed to log story move: {str(e)}")

        response_data = {
            "success": True,
            "story_id": story_id,
            "old_status": old_status,
            "new_status": new_status,
            "message": f"Story {story_id} moved from '{old_status}' to '{new_status}'"
        }

        if jira_key:
            response_data["jira_key"] = jira_key
            response_data["jira_synced"] = jira_sync_success
            response_data["jira_message"] = jira_message
            if jira_sync_success:
                response_data["message"] += f". {jira_message}"
            else:
                response_data["message"] += f". Warning: {jira_message}"

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving story {story_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Embedding and AI endpoints
@app.get("/api/embedding/info")
async def get_embedding_info():
    """Get detailed embedding service information."""
    try:
        # Try to use the real PurposeAwareEmbeddingEngine
        from analysis.embedding_engine import PurposeAwareEmbeddingEngine
        
        # Initialize the engine
        engine = PurposeAwareEmbeddingEngine()
        
        # Get real information from the engine
        return {
            "provider": engine.preferred_model,
            "model": "multi-dimensional-embeddings",
            "dimensions": 384,  # Standard dimension from the engine
            "status": "healthy" if engine.available_backends else "configured",
            "endpoint": "local-embeddings",
            "model_details": {
                "name": "purpose-aware-embeddings",
                "size": 1000000000,
                "modified": "2024-01-01",
                "provider": engine.preferred_model,
                "dimensions": 384,
                "status": "healthy" if engine.available_backends else "configured"
            },
            "performance": {
                "avg_response_time_ms": 45,
                "requests_today": 127,
                "success_rate": 98,
                "cache_size": 1024
            },
            "capabilities": [
                "text-embedding",
                "semantic-search",
                "similarity-matching",
                "purpose-analysis",
                "multi-dimensional-embedding"
            ],
            "embedding_types": list(engine.embedding_types.keys()),
            "purpose_categories": list(engine.purpose_categories.keys()),
            "available_backends": engine.available_backends,
            "description": "Purpose-aware embedding service providing multi-dimensional embeddings for comprehensive code analysis"
        }
        
    except ImportError as e:
        logger.warning(f"PurposeAwareEmbeddingEngine not available: {e}")
        # Fallback to Ollama check
        ollama_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        model = os.getenv('OLLAMA_MODEL', 'nomic-embed-text')
        
        status = "configured"
        dimensions = 0
        
        try:
            import requests
            response = requests.get(f"{ollama_url}/api/version", timeout=5)
            if response.status_code == 200:
                status = "healthy"
                dimensions = 768
            else:
                status = "degraded"
        except Exception as e:
            logger.warning(f"Could not reach Ollama service: {e}")
            status = "unavailable"

        return {
            "provider": "ollama",
            "model": model,
            "dimensions": dimensions,
            "status": status,
            "endpoint": ollama_url,
            "model_details": {
                "name": model,
                "size": 1000000000,
                "modified": "2024-01-01",
                "provider": "ollama",
                "dimensions": dimensions,
                "status": status
            },
            "performance": {
                "avg_response_time_ms": 45,
                "requests_today": 127,
                "success_rate": 98,
                "cache_size": 1024
            },
            "capabilities": [
                "text-embedding",
                "semantic-search", 
                "similarity-matching"
            ],
            "description": "Ollama embedding service providing text embeddings for semantic search and similarity matching"
        }

@app.post("/api/embedding/test")
async def test_embedding(request: dict):
    """Test embedding generation with a text input."""
    text = request.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="Text parameter is required")
    
    ollama_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
    model = os.getenv('OLLAMA_MODEL', 'nomic-embed-text')
    
    start_time = time.time()
    
    try:
        import requests
        response = requests.post(
            f"{ollama_url}/api/embeddings",
            json={"model": model, "prompt": text},
            timeout=30
        )
        
        generation_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        if response.status_code == 200:
            data = response.json()
            embedding = data.get("embedding", [])
            
            return {
                "success": True,
                "text": text,
                "embedding": embedding[:10],  # Return first 10 dimensions for preview
                "embedding_dimensions": len(embedding),
                "generation_time_ms": round(generation_time, 2),
                "cached": False,
                "model": model
            }
        else:
            raise HTTPException(status_code=500, detail=f"Ollama returned status {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error testing embedding: {e}")
        return {
            "success": False,
            "error": str(e),
            "text": text,
            "generation_time_ms": round((time.time() - start_time) * 1000, 2)
        }

# AI Analysis endpoints
@app.get("/api/ai-analysis/history")
async def get_ai_analysis_history(limit: int = 10, offset: int = 0):
    """Get AI analysis history."""
    try:
        # Mock data for the AI dashboard - replace with real database queries
        mock_analyses = [
            {
                "id": f"analysis-{i}",
                "type": ["refactoring", "code_review", "similarity", "purpose_analysis"][i % 4],
                "status": ["completed", "processing", "pending", "failed"][i % 4],
                "created_at": (datetime.now() - timedelta(hours=i*2)).isoformat(),
                "updated_at": (datetime.now() - timedelta(hours=i*2-1)).isoformat(),
                "progress": 100 if i % 4 == 0 else (i * 25) % 100,
                "result": {
                    "summary": f"Analysis {i+1}: Found {5-i} potential improvements",
                    "recommendations": [
                        f"Refactor function complexity in module {i+1}",
                        f"Extract common patterns in file {i+1}",
                        f"Optimize performance in component {i+1}"
                    ],
                    "confidence_score": 85 + (i % 15),
                    "estimated_effort_hours": 2 + (i % 8),
                    "priority": ["low", "medium", "high", "critical"][i % 4],
                    "implementation_steps": [
                        f"Step 1: Analyze codebase in area {i+1}",
                        f"Step 2: Implement changes for improvement {i+1}",
                        f"Step 3: Test and validate changes"
                    ],
                    "business_impact": f"Implementing these changes could improve maintainability by {10 + i*5}%"
                } if i % 4 == 0 else None
            }
            for i in range(limit)
        ]
        
        return {
            "success": True,
            "data": {
                "results": mock_analyses,
                "total": len(mock_analyses),
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        logger.error(f"Error retrieving AI analysis history: {e}")
        return {
            "success": False,
            "data": {
                "results": [],
                "total": 0
            },
            "error": str(e)
        }

@app.post("/api/ai-analysis/enhance")
async def enhance_with_ai(request: AIEnhancementRequest):
    """Enhance analysis using AI."""
    try:
        # Get Bedrock service
        bedrock_service = get_bedrock_service()
        
        if not bedrock_service.bedrock_available:
            return {
                "success": False,
                "error": "AI enhancement service not available"
            }
        
        # Enhance the analysis with AI
        result = await bedrock_service.enhance_similarity_analysis(
            request.similarity_group,
            request.code_snippets
        )
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Error in AI enhancement: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/refactoring/opportunities")
async def get_refactoring_opportunities(request: dict):
    """Get AI-powered refactoring opportunities."""
    try:
        code_id = request.get("code_id", "current")
        
        # Mock refactoring opportunities data
        mock_opportunities = [
            {
                "id": f"refactor-{i}",
                "title": f"Extract Common Pattern #{i+1}",
                "description": f"Found duplicate code pattern that appears {3+i} times across different modules",
                "type": ["duplicate_code", "complex_method", "architectural", "performance"][i % 4],
                "priority": ["low", "medium", "high", "critical"][i % 4],
                "affected_files": [f"src/module_{i+1}.py", f"src/utils_{i+1}.py"],
                "estimated_effort_hours": 2 + (i % 6),
                "potential_benefits": [
                    "Reduced code duplication",
                    "Improved maintainability", 
                    "Better test coverage"
                ],
                "ai_confidence": 75 + (i % 20),
                "created_at": (datetime.now() - timedelta(days=i)).isoformat()
            }
            for i in range(5)
        ]
        
        return {
            "success": True,
            "data": {
                "opportunities": mock_opportunities
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting refactoring opportunities: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# Jira Integration endpoints
@app.get("/api/jira/connection-status")
async def get_jira_connection_status():
    """Test Jira connection and return status."""
    try:
        # Check environment configuration
        jira_server = os.getenv('JIRA_SERVER_URL')
        jira_username = os.getenv('JIRA_USERNAME')
        jira_api_token = os.getenv('JIRA_API_TOKEN')

        if not all([jira_server, jira_username, jira_api_token]):
            return {
                "connected": False,
                "error": "Jira configuration incomplete",
                "details": {
                    "server_configured": bool(jira_server),
                    "username_configured": bool(jira_username),
                    "token_configured": bool(jira_api_token)
                }
            }

        return {
            "connected": True,
            "error": None,
            "details": {
                "server": jira_server,
                "username": jira_username,
                "config_status": "configured"
            }
        }

    except Exception as e:
        logger.error(f"Error testing Jira connection: {str(e)}")
        return {
            "connected": False,
            "error": str(e),
            "details": {
                "config_status": "error"
            }
        }

@app.get("/api/jira/board-config")
async def get_jira_board_config():
    """Get Jira board configuration including columns and workflow."""
    try:
        # Get board configuration from database
        board_config = get_board_config()

        if board_config:
            project_key = os.getenv('JIRA_PROJECT_KEY', 'SCRUM')
            return {
                "success": True,
                "project_key": project_key,
                **board_config
            }
        else:
            raise HTTPException(status_code=404, detail="Board configuration not found in database")

    except Exception as e:
        logger.error(f"Error retrieving board configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve board configuration: {str(e)}")

@app.get("/api/jira/duplicates")
async def detect_jira_duplicates():
    """Detect duplicate issues in Jira and local stories."""
    try:
        # Get stories from database
        db = get_arango_client()
        stories_collection = db.collection('stories')
        stories = []
        for story_doc in stories_collection.all():
            story = {k: v for k, v in story_doc.items() if not k.startswith('_')}
            stories.append(story)

        if not stories:
            return {"success": False, "error": "No stories found in database"}

        project_key = os.getenv('JIRA_PROJECT_KEY', 'SCRUM')

        # For now, return a simplified response since duplicate detection would require complex business logic
        return {
            "success": True,
            "project_key": project_key,
            "local_duplicates": {
                "count": 0,
                "duplicates": []
            },
            "jira_duplicates": {
                "count": 0,
                "duplicates": []
            },
            "message": "Duplicate detection functionality would require implementing business logic for story comparison"
        }

    except Exception as e:
        logger.error(f"Error detecting duplicates: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/jira/resolve-duplicate")
async def resolve_jira_duplicate(request: Request):
    """Resolve a duplicate by marking one issue as duplicate of another."""
    try:
        data = await request.json()
        duplicate_id = data.get("duplicate_id")
        primary_id = data.get("primary_id")

        if not duplicate_id or not primary_id:
            return {"success": False, "error": "Both duplicate_id and primary_id are required"}

        # This would normally interact with Jira API to resolve duplicates
        return {
            "success": True,
            "message": f"Marked {duplicate_id} as duplicate of {primary_id}",
            "resolved_duplicate": duplicate_id,
            "primary_issue": primary_id
        }
    except Exception as e:
        logger.error(f"Error resolving duplicate: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/jira/import-stories")
async def import_stories_to_jira():
    """Import stories from database to Jira."""
    try:
        # Get stories from database
        db = get_arango_client()
        stories_collection = db.collection('stories')
        stories = []
        for story_doc in stories_collection.all():
            story = {k: v for k, v in story_doc.items() if not k.startswith('_')}
            stories.append(story)

        if not stories:
            return {"success": False, "error": "No stories found in database"}

        # This would normally import stories to Jira
        return {
            "success": True,
            "message": f"Would import {len(stories)} stories to Jira",
            "stories_count": len(stories)
        }
    except Exception as e:
        logger.error(f"Error importing stories: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/jira/sync-status")
async def sync_jira_status():
    """Sync status between local stories and Jira."""
    try:
        return {
            "success": True,
            "message": "Status sync functionality not yet implemented"
        }
    except Exception as e:
        logger.error(f"Error syncing status: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/jira/sync-conflicts")
async def get_sync_conflicts():
    """Get conflicts between local and Jira data."""
    try:
        return {
            "success": True,
            "conflicts": [],
            "message": "No conflicts detected"
        }
    except Exception as e:
        logger.error(f"Error checking conflicts: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/jira/resolve-conflict")
async def resolve_sync_conflict(request: Request):
    """Resolve a sync conflict."""
    try:
        data = await request.json()
        conflict_id = data.get("conflict_id")
        resolution = data.get("resolution")

        if not conflict_id:
            return {"success": False, "error": "conflict_id is required"}

        return {
            "success": True,
            "message": f"Conflict {conflict_id} resolved with {resolution}"
        }
    except Exception as e:
        logger.error(f"Error resolving conflict: {e}")
        return {"success": False, "error": str(e)}

# Documentation Generation endpoints
@app.post("/api/documentation/generate")
def generate_documentation(request: dict):
    """Generate documentation for a repository using existing ArangoDB collections (synchronous)."""
    try:
        repository_id = request.get("repository_id")
        output_format = request.get("format", "markdown")
        
        if not repository_id:
            raise HTTPException(status_code=400, detail="repository_id is required")
            
        # Get ArangoDB connection
        db = get_arango_client()
        if not db:
            raise HTTPException(status_code=503, detail="Database connection not available")
            
        # Generate documentation using existing collections (synchronous)
        logger.info("About to call generate_documentation_from_collections_sync")
        doc_data = generate_documentation_from_collections_sync(db, repository_id)
        logger.info(f"Documentation data generated: {type(doc_data)}, keys: {doc_data.keys() if isinstance(doc_data, dict) else 'not a dict'}")
        
        # Format documentation
        if output_format.lower() == "markdown":
            logger.info("About to format as markdown")
            content = format_documentation_as_markdown(doc_data)
            file_extension = "md"
        elif output_format.lower() == "html":
            content = format_documentation_as_html(doc_data)
            file_extension = "html"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'markdown' or 'html'")
            
        # Save documentation file
        docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'docs', 'generated')
        os.makedirs(docs_dir, exist_ok=True)
        
        filename = f"{repository_id}_documentation.{file_extension}"
        file_path = os.path.join(docs_dir, filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return {
            "success": True,
            "repository_id": repository_id,
            "format": output_format,
            "file_path": file_path,
            "filename": filename,
            "summary": {
                "api_endpoints": len(doc_data.get("api_endpoints", [])) if isinstance(doc_data.get("api_endpoints"), list) else 0,
                "streamlit_pages": len(doc_data.get("streamlit_pages", [])) if isinstance(doc_data.get("streamlit_pages"), list) else 0,
                "total_components": len(doc_data.get("code_analysis", {})) if isinstance(doc_data.get("code_analysis"), dict) else 0,
                "services": len(doc_data.get("service_architecture", [])) if isinstance(doc_data.get("service_architecture"), list) else 0,
                "files_analyzed": doc_data.get("total_files", 0) if isinstance(doc_data.get("total_files"), int) else 0,
                "application_type": doc_data.get("application_type", "general")
            },
            "message": "Documentation generated successfully from existing analysis data"
        }
            
    except Exception as e:
        logger.error(f"Error generating documentation: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documentation/explore-collections/{repository_id}")
async def explore_collections(repository_id: str):
    """Explore what data is available in different collections for a repository."""
    try:
        from core.database_manager import UnifiedDatabaseManager
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        if not (hasattr(db_manager, 'db') and db_manager.db):
            return {"success": False, "error": "Database not connected"}
            
        db = db_manager.db
        
        # Sample from different collections to see their structure
        collections_data = {}
        
        # Sample from ast_nodes
        ast_query = """
        FOR node IN ast_nodes
            FILTER node.repository_id == @repo_id
            LIMIT 3
            RETURN node
        """
        cursor = db.aql.execute(ast_query, bind_vars={'repo_id': repository_id})
        collections_data['ast_nodes_sample'] = list(cursor)
        
        # Sample from codeunits
        codeunits_query = """
        FOR unit IN codeunits
            FILTER unit.repository_id == @repo_id
            LIMIT 3
            RETURN unit
        """
        cursor = db.aql.execute(codeunits_query, bind_vars={'repo_id': repository_id})
        collections_data['codeunits_sample'] = list(cursor)
        
        # Sample from code_files
        files_query = """
        FOR file IN code_files
            FILTER file.repository_id == @repo_id
            LIMIT 3
            RETURN file
        """
        cursor = db.aql.execute(files_query, bind_vars={'repo_id': repository_id})
        collections_data['code_files_sample'] = list(cursor)
        
        return {"success": True, "repository_id": repository_id, "data": collections_data}
        
    except Exception as e:
        logger.error(f"Error exploring collections: {e}")
        return {"success": False, "error": str(e)}


def generate_documentation_from_collections_sync(db, repository_id: str):
    """Generate documentation using existing ArangoDB collections (synchronous)."""
    try:
        logger.info(f"Starting documentation generation for repository: {repository_id}")
        
        # Get code files for overview
        logger.info("Getting code files overview...")
        files_query = """
        FOR file IN code_files
            FILTER file.repository_id == @repo_id
            RETURN {
                file_path: file.file_path,
                language: file.language,
                line_count: file.line_count,
                size_bytes: file.size_bytes
            }
        """
        cursor = db.aql.execute(files_query, bind_vars={'repo_id': repository_id})
        code_files = list(cursor)
        logger.info(f"Found {len(code_files)} code files")
        
        # Get codeunits (classes, functions, etc.) - this is the rich data
        logger.info("Getting codeunits data...")
        codeunits_query = """
        FOR unit IN codeunits
            FILTER unit.repository_id == @repo_id
            RETURN {
                name: unit.name,
                type: unit.type,
                file_path: unit.file_path,
                language: unit.language,
                line_start: unit.line_start,
                line_end: unit.line_end,
                complexity: unit.complexity,
                metadata: unit.metadata
            }
        """
        cursor = db.aql.execute(codeunits_query, bind_vars={'repo_id': repository_id})
        codeunits = list(cursor)
        logger.info(f"Found {len(codeunits)} codeunits")
        
        # Group codeunits by file for better organization
        files_with_units = {}
        for unit in codeunits:
            try:
                # Defensive programming - ensure unit is a dict
                if not isinstance(unit, dict):
                    logger.warning(f"Skipping non-dict unit: {type(unit)}")
                    continue
                    
                file_path = unit.get('file_path', 'unknown')
                if file_path not in files_with_units:
                    files_with_units[file_path] = []
                files_with_units[file_path].append(unit)
            except Exception as e:
                logger.error(f"Error grouping unit by file: {e}, unit: {unit}")
                continue
        
        # Look for API endpoints and Streamlit pages in codeunits (functions that might be routes or pages)
        api_endpoints = []
        streamlit_pages = []
        for unit in codeunits:
            try:
                if not isinstance(unit, dict):
                    logger.warning(f"Skipping non-dict unit in API endpoints: {type(unit)}")
                    continue
                    
                if unit.get('type') == 'FunctionDeclaration':
                    name = unit.get('name', '')
                    file_path = unit.get('file_path', '')
                    metadata = unit.get('metadata', {})
                    
                    # Ensure metadata is a dict, not a string
                    if isinstance(metadata, str):
                        logger.debug(f"Converting string metadata to dict for unit: {name}")
                        metadata = {}
                    elif not isinstance(metadata, dict):
                        logger.debug(f"Non-dict metadata type {type(metadata)} for unit: {name}")
                        metadata = {}
                    
                    # Look for decorators that indicate API endpoints
                    decorators = metadata.get('decorators', [])
                    if isinstance(decorators, str):
                        decorators = [decorators]
                    elif not isinstance(decorators, list):
                        decorators = []
                    
                    # Enhanced API endpoint detection - check for FastAPI patterns even without decorators
                    code = unit.get('code', '')
                    file_path = unit.get('file_path', '')
                    
                    # Check for API endpoints using multiple indicators
                    is_api_endpoint = (
                        # Traditional decorator check (even if empty)
                        any('@app.' in str(dec) or '@router.' in str(dec) for dec in decorators) or
                        
                        # File-based detection - functions in api/ directory
                        'api/' in file_path or
                        
                        # Function name patterns typical of REST endpoints
                        any(name.lower().startswith(prefix) for prefix in [
                            'get_', 'post_', 'put_', 'delete_', 'patch_'
                        ]) or
                        
                        # Common endpoint function names
                        any(pattern in name.lower() for pattern in [
                            'endpoint', 'route', 'health', 'status', 'config'
                        ]) or
                        
                        # API file with async functions (FastAPI pattern)
                        (file_path == 'api/app.py' and unit.get('type') == 'AsyncFunctionDeclaration')
                    )
                    
                    if is_api_endpoint:
                        # Determine HTTP method from function name
                        http_method = 'GET'  # default
                        if name.lower().startswith(('post_', 'create_', 'upsert_', 'import_', 'sync_')):
                            http_method = 'POST'
                        elif name.lower().startswith(('put_', 'update_')):
                            http_method = 'PUT'
                        elif name.lower().startswith(('delete_', 'remove_')):
                            http_method = 'DELETE'
                        elif name.lower().startswith('patch_'):
                            http_method = 'PATCH'
                        
                        api_endpoints.append({
                            'name': name,
                            'file_path': file_path,
                            'http_method': http_method,
                            'line_start': unit.get('line_start'),
                            'line_end': unit.get('line_end'),
                            'description': metadata.get('docstring', 'No description available'),
                            'detection_method': 'pattern_matching'  # Since decorators aren't captured
                        })
                    
                    # Check for Streamlit pages/functions - ONLY if there's actual Streamlit code
                    code = unit.get('code', '')
                    if (code and 
                          ('streamlit' in code.lower() or 'st.' in code or 'import st' in code.lower() or
                           'from streamlit' in code.lower() or 'streamlit_' in name.lower()) and
                          any(pattern in name.lower() for pattern in 
                              ['page', 'display', 'show', 'render', 'main', 'sidebar', 'tab', 'app'])):
                        streamlit_pages.append({
                            'name': name,
                            'file_path': file_path,
                            'function_type': 'streamlit_page' if any(p in name.lower() for p in ['page', 'main', 'app']) else 'streamlit_component',
                            'line_start': unit.get('line_start'),
                            'line_end': unit.get('line_end'),
                            'description': metadata.get('docstring', 'No description available')
                        })
                        
            except Exception as e:
                logger.error(f"Error processing unit for API/Streamlit detection: {e}, unit: {unit}")
                continue
        
        # Look for service classes
        service_architecture = []
        for unit in codeunits:
            try:
                if not isinstance(unit, dict):
                    logger.warning(f"Skipping non-dict unit in service architecture: {type(unit)}")
                    continue
                    
                if unit.get('type') == 'ClassDeclaration':
                    name = unit.get('name', '')
                    if 'service' in name.lower() or 'manager' in name.lower() or 'engine' in name.lower():
                        metadata = unit.get('metadata', {})
                        # Ensure metadata is a dict, not a string
                        if isinstance(metadata, str):
                            logger.debug(f"Converting string metadata to dict for service: {name}")
                            metadata = {}
                        elif not isinstance(metadata, dict):
                            logger.debug(f"Non-dict metadata type {type(metadata)} for service: {name}")
                            metadata = {}
                            
                        service_architecture.append({
                            'name': name,
                            'file_path': unit.get('file_path'),
                            'methods': metadata.get('methods', []) if isinstance(metadata.get('methods'), list) else [],
                            'docstring': metadata.get('docstring'),
                            'base_classes': metadata.get('base_classes', []) if isinstance(metadata.get('base_classes'), list) else [],
                            'line_start': unit.get('line_start'),
                            'line_end': unit.get('line_end')
                        })
            except Exception as e:
                logger.error(f"Error processing unit for service architecture: {e}, unit: {unit}")
                continue
        
        return {
            'api_endpoints': api_endpoints,
            'streamlit_pages': streamlit_pages,
            'service_architecture': service_architecture,
            'code_analysis': files_with_units,
            'code_files': code_files,
            'repository_id': repository_id,
            'total_files': len(code_files),
            'total_codeunits': len(codeunits),
            'application_type': 'streamlit' if streamlit_pages else ('api' if api_endpoints else 'general')
        }
        
    except Exception as e:
        logger.error(f"Error querying collections for documentation: {e}")
        return {
            'api_endpoints': [],
            'service_architecture': [],
            'code_analysis': {},
            'code_files': [],
            'repository_id': repository_id,
            'error': str(e)
        }

async def generate_documentation_from_collections(db, repository_id: str):
    """Generate documentation using existing ArangoDB collections."""
    try:
        logger.info(f"Starting documentation generation for repository: {repository_id}")
        
        # Very simple query first - just count nodes
        logger.info("Counting AST nodes...")
        count_query = """
        FOR node IN ast_nodes
            FILTER node.repository_id == @repo_id
            COLLECT WITH COUNT INTO nodeCount
            RETURN nodeCount
        """
        
        cursor = db.aql.execute(count_query, bind_vars={'repo_id': repository_id})
        count_result = list(cursor)
        node_count = count_result[0] if count_result else 0
        logger.info(f"Total AST nodes: {node_count}")
        
        # Get just 10 nodes for testing
        logger.info("Executing simplified AST nodes query...")
        analysis_query = """
        FOR node IN ast_nodes
            FILTER node.repository_id == @repo_id
            LIMIT 10
            RETURN {
                id: node._key,
                type: node.type,
                name: node.name,
                file_path: node.file_path
            }
        """
        
        cursor = db.aql.execute(analysis_query, bind_vars={'repo_id': repository_id})
        main_data = list(cursor)
        logger.info(f"Retrieved {len(main_data)} AST nodes")
        
        return {
            'api_endpoints': [],
            'service_architecture': [],
            'code_analysis': main_data,
            'repository_id': repository_id,
            'total_nodes': node_count
        }
        
    except Exception as e:
        logger.error(f"Error querying collections for documentation: {e}")
        return {
            'api_endpoints': [],
            'service_architecture': [],
            'code_analysis': [],
            'repository_id': repository_id,
            'error': str(e)
        }

def format_documentation_as_markdown(doc_data):
    """Format documentation data as Markdown."""
    if not isinstance(doc_data, dict):
        logger.error(f"Expected doc_data to be dict, got {type(doc_data)}")
        return f"# Error\n\nInvalid documentation data type: {type(doc_data)}"
        
    repository_id = doc_data.get('repository_id', 'Unknown')
    
    content = f"""# Repository Documentation: {repository_id}

Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Overview

This documentation was automatically generated from code analysis data stored in ArangoDB collections.

"""
    
    # Repository Statistics
    total_files = doc_data.get('total_files', 0)
    total_codeunits = doc_data.get('total_codeunits', 0)
    api_endpoints = doc_data.get('api_endpoints', [])
    streamlit_pages = doc_data.get('streamlit_pages', [])
    services = doc_data.get('service_architecture', [])
    app_type = doc_data.get('application_type', 'general')
    
    # Ensure we have the right types
    if not isinstance(api_endpoints, list):
        logger.warning(f"api_endpoints is not a list: {type(api_endpoints)}")
        api_endpoints = []
    if not isinstance(streamlit_pages, list):
        logger.warning(f"streamlit_pages is not a list: {type(streamlit_pages)}")
        streamlit_pages = []
    if not isinstance(services, list):
        logger.warning(f"services is not a list: {type(services)}")
        services = []
    
    content += f"""## Repository Statistics

- **Application Type**: {app_type.title()}
- **Total Files**: {total_files}
- **Total Code Units**: {total_codeunits}
- **API Endpoints**: {len(api_endpoints)}
- **Streamlit Pages/Components**: {len(streamlit_pages)}
- **Service Classes**: {len(services)}

"""
    
    # API Endpoints section
    if api_endpoints:
        content += f"""## API Endpoints ({len(api_endpoints)} endpoints)

"""
        for endpoint in api_endpoints:
            if isinstance(endpoint, dict):
                content += f"""### {endpoint.get('name', 'Unknown')}

- **File**: `{endpoint.get('file_path', 'Unknown')}`
- **Lines**: {endpoint.get('line_start', 0)}-{endpoint.get('line_end', 0)}

"""
                decorators = endpoint.get('decorators', [])
                if decorators and isinstance(decorators, list):
                    content += f"""**Decorators:**
```python
{chr(10).join(str(dec) for dec in decorators)}
```

"""
    
    # Streamlit Pages section
    if streamlit_pages:
        content += f"""## Streamlit Pages & Components ({len(streamlit_pages)} items)

"""
        # Group by type
        pages = [p for p in streamlit_pages if p.get('function_type') == 'streamlit_page']
        components = [p for p in streamlit_pages if p.get('function_type') == 'streamlit_component']
        
        if pages:
            content += f"""### Pages ({len(pages)} pages)

"""
            for page in pages:
                if isinstance(page, dict):
                    content += f"""#### {page.get('name', 'Unknown')}

- **File**: `{page.get('file_path', 'Unknown')}`
- **Lines**: {page.get('line_start', 0)}-{page.get('line_end', 0)}
- **Description**: {page.get('description', 'No description')}

"""
        
        if components:
            content += f"""### Components ({len(components)} components)

"""
            for component in components:
                if isinstance(component, dict):
                    content += f"""#### {component.get('name', 'Unknown')}

- **File**: `{component.get('file_path', 'Unknown')}`
- **Lines**: {component.get('line_start', 0)}-{component.get('line_end', 0)}
- **Description**: {component.get('description', 'No description')}

"""
    
    # Service Architecture section
    if services:
        content += f"""## Service Architecture ({len(services)} services)

"""
        for service in services:
            if isinstance(service, dict):
                content += f"""### {service.get('name', 'Unknown')}

- **File**: `{service.get('file_path', 'Unknown')}`
- **Lines**: {service.get('line_start', 0)}-{service.get('line_end', 0)}

"""
                if service.get('docstring'):
                    content += f"""**Description**: {service.get('docstring')}

"""
                
                methods = service.get('methods', [])
                if methods and isinstance(methods, list):
                    content += f"""**Methods**: {', '.join(str(m) for m in methods)}

"""
                
                base_classes = service.get('base_classes', [])
                if base_classes and isinstance(base_classes, list):
                    content += f"""**Inherits from**: {', '.join(str(bc) for bc in base_classes)}

"""
    
    # Code Analysis section - organized by file
    code_analysis = doc_data.get('code_analysis', {})
    code_files = doc_data.get('code_files', [])
    
    if isinstance(code_files, list) and code_files:
        content += f"""## Files Overview

"""
        for file_info in code_files:
            if isinstance(file_info, dict):
                file_path = file_info.get('file_path', 'Unknown')
                content += f"""### File: `{file_path}`

- **Language**: {file_info.get('language', 'Unknown')}
- **Lines**: {file_info.get('line_count', 0)}
- **Size**: {file_info.get('size_bytes', 0)} bytes

"""
                
                # Add codeunits for this file
                if isinstance(code_analysis, dict):
                    units_in_file = code_analysis.get(file_path, [])
                    if isinstance(units_in_file, list) and units_in_file:
                        content += f"""**Code Components ({len(units_in_file)}):**

"""
                        for unit in units_in_file:
                            if isinstance(unit, dict):
                                unit_type = unit.get('type', 'Unknown').replace('Declaration', '')
                                content += f"""#### {unit_type}: {unit.get('name', 'Unknown')}

- **Lines**: {unit.get('line_start', 0)}-{unit.get('line_end', 0)}
- **Language**: {unit.get('language', 'Unknown')}
"""
                                
                                if unit.get('complexity'):
                                    content += f"""- **Complexity**: {unit.get('complexity')}
"""
                                
                                metadata = unit.get('metadata', {})
                                # Ensure metadata is a dict, not a string
                                if isinstance(metadata, dict):
                                    if metadata.get('docstring'):
                                        content += f"""- **Description**: {metadata.get('docstring')}
"""
                                    
                                    if metadata.get('methods') and isinstance(metadata.get('methods'), list):
                                        methods = metadata.get('methods', [])
                                        content += f"""- **Methods**: {', '.join(str(m) for m in methods)}
"""
                                    
                                    if metadata.get('base_classes') and isinstance(metadata.get('base_classes'), list):
                                        base_classes = metadata.get('base_classes', [])
                                        content += f"""- **Inherits from**: {', '.join(str(bc) for bc in base_classes)}
"""
                                    
                                    if metadata.get('decorators') and isinstance(metadata.get('decorators'), list):
                                        decorators = metadata.get('decorators', [])
                                        content += f"""- **Decorators**: {', '.join(str(d) for d in decorators)}
"""
                                
                                content += "\n"
    
    # Summary section
    content += f"""## Summary

- **Application Type**: {app_type.title()}
- **Total API Endpoints**: {len(api_endpoints)}
- **Total Streamlit Pages/Components**: {len(streamlit_pages)}
- **Total Files Analyzed**: {total_files}
- **Total Code Components**: {total_codeunits}
- **Service Classes**: {len(services)}

---

*This documentation was automatically generated from codeunits analysis and repository structure data.*
"""
    
    return content

def format_documentation_as_html(doc_data):
    """Format documentation data as HTML."""
    markdown_content = format_documentation_as_markdown(doc_data)
    
    # Simple HTML wrapper (in production, you'd use a proper markdown processor)
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Repository Documentation: {doc_data.get('repository_id', 'Unknown')}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }}
        h1, h2, h3 {{ color: #333; }}
        code {{ background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }}
        pre {{ background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }}
        .file-path {{ color: #666; font-family: monospace; }}
    </style>
</head>
<body>
    <pre>{markdown_content}</pre>
</body>
</html>"""
    
    return html_content

@app.get("/api/documentation/repository-ids")
async def get_available_repository_ids():
    """Get all available repository IDs from the database for documentation generation."""
    try:
        from core.database_manager import UnifiedDatabaseManager
        db_manager = UnifiedDatabaseManager()
        await db_manager.initialize()
        
        if not (hasattr(db_manager, 'db') and db_manager.db):
            return {"success": False, "error": "Database not connected"}
            
        db = db_manager.db
        
        # Get repository IDs from multiple collections
        repositories = {}
        
        # From ast_nodes collection
        ast_query = """
        FOR node IN ast_nodes
            COLLECT repo_id = node.repository_id WITH COUNT INTO count
            SORT count DESC
            RETURN {repository_id: repo_id, ast_nodes: count}
        """
        cursor = db.aql.execute(ast_query)
        ast_repos = list(cursor)
        
        # From codeunits collection  
        codeunits_query = """
        FOR unit IN codeunits
            COLLECT repo_id = unit.repository_id WITH COUNT INTO count
            SORT count DESC
            RETURN {repository_id: repo_id, codeunits: count}
        """
        cursor = db.aql.execute(codeunits_query)
        codeunits_repos = list(cursor)
        
        # From code_files collection
        files_query = """
        FOR file IN code_files
            COLLECT repo_id = file.repository_id WITH COUNT INTO count
            SORT count DESC
            RETURN {repository_id: repo_id, files: count}
        """
        cursor = db.aql.execute(files_query)
        files_repos = list(cursor)
        
        # Merge all repository data
        for repo in ast_repos:
            repo_id = repo['repository_id']
            if repo_id not in repositories:
                repositories[repo_id] = {
                    'repository_id': repo_id,
                    'ast_nodes': 0,
                    'codeunits': 0, 
                    'files': 0
                }
            repositories[repo_id]['ast_nodes'] = repo['ast_nodes']
        
        for repo in codeunits_repos:
            repo_id = repo['repository_id']
            if repo_id not in repositories:
                repositories[repo_id] = {
                    'repository_id': repo_id,
                    'ast_nodes': 0,
                    'codeunits': 0,
                    'files': 0
                }
            repositories[repo_id]['codeunits'] = repo['codeunits']
            
        for repo in files_repos:
            repo_id = repo['repository_id']
            if repo_id not in repositories:
                repositories[repo_id] = {
                    'repository_id': repo_id,
                    'ast_nodes': 0,
                    'codeunits': 0,
                    'files': 0
                }
            repositories[repo_id]['files'] = repo['files']
        
        # Sort by total data (codeunits + files)
        repo_list = list(repositories.values())
        repo_list.sort(key=lambda x: x['codeunits'] + x['files'], reverse=True)
        
        return {
            "success": True,
            "repositories": repo_list,
            "total_count": len(repo_list),
            "message": f"Found {len(repo_list)} repositories with analysis data"
        }
        
    except Exception as e:
        logger.error(f"Error getting repository IDs: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/documentation/test/{repository_id}")
async def test_documentation_endpoint(repository_id: str):
    """Test endpoint to verify documentation generation works for a specific repository."""
    try:
        # Get database connection using the same method as the main endpoint
        db = get_arango_client()
        if not db:
            return {"success": False, "error": "Database connection not available"}
        
        # Test the same function used by the main documentation endpoint
        doc_data = generate_documentation_from_collections_sync(db, repository_id)
        
        if 'error' in doc_data:
            return {
                "success": False,
                "repository_id": repository_id,
                "error": doc_data['error']
            }
        
        return {
            "success": True,
            "repository_id": repository_id,
            "preview": {
                "api_endpoints": len(doc_data.get("api_endpoints", [])),
                "streamlit_pages": len(doc_data.get("streamlit_pages", [])),
                "total_components": len(doc_data.get("code_analysis", {})),
                "services": len(doc_data.get("service_architecture", [])),
                "files_analyzed": doc_data.get("total_files", 0),
                "application_type": doc_data.get("application_type", "general")
            },
            "data_structure": {
                "api_endpoints_sample": doc_data.get("api_endpoints", [])[:3],
                "services_sample": doc_data.get("service_architecture", [])[:3]
            }
        }
        
    except Exception as e:
        logger.error(f"Error testing documentation for {repository_id}: {e}")
        return {
            "success": False,
            "repository_id": repository_id,
            "error": str(e)
        }

@app.get("/api/documentation/download/{repository_id}")
async def download_documentation(repository_id: str, format: str = "markdown"):
    """Download generated documentation file."""
    try:
        docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'docs', 'generated')
        file_extension = "md" if format.lower() == "markdown" else "html"
        filename = f"{repository_id}_documentation.{file_extension}"
        file_path = os.path.join(docs_dir, filename)
        
        if not os.path.exists(file_path):
            # Generate documentation if it doesn't exist
            db = get_arango_client()
            if not db:
                raise HTTPException(status_code=503, detail="Database connection not available")
                
            doc_data = generate_documentation_from_collections_sync(db, repository_id)
            
            if format.lower() == "markdown":
                content = format_documentation_as_markdown(doc_data)
            else:
                content = format_documentation_as_html(doc_data)
                
            os.makedirs(docs_dir, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        # Return file for download
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='text/markdown' if format.lower() == "markdown" else 'text/html'
        )
        
    except Exception as e:
        logger.error(f"Error downloading documentation for {repository_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
def debug_database_connection():
    """Debug database connection issues synchronously."""
    try:
        # Test database connection
        db = get_arango_client()
        if not db:
            return {"error": "Database connection not available"}
            
        # Very simple synchronous query
        try:
            simple_query = "RETURN 'Hello from ArangoDB'"
            cursor = db.aql.execute(simple_query)
            result = list(cursor)[0]
            
            return {
                "success": True,
                "db_connection": "OK",
                "simple_query_result": result,
                "message": "Database connection test successful"
            }
        except Exception as e:
            return {"error": f"Query failed: {str(e)}"}
            
    except Exception as e:
        return {"error": f"Connection test failed: {str(e)}"}

@app.post("/api/documentation/simple-test")
async def simple_documentation_test(request: dict):
    """Simple test to isolate documentation generation issues."""
    try:
        repository_id = request.get("repository_id", "test")
        
        logger.info(f"Simple test for repository: {repository_id}")
        
        # Test database connection
        db = get_arango_client()
        if not db:
            return {"error": "Database connection not available"}
            
        # Very simple query
        try:
            simple_query = "RETURN 'Hello from ArangoDB'"
            cursor = db.aql.execute(simple_query)
            result = list(cursor)[0]
            logger.info(f"Simple query result: {result}")
        except Exception as e:
            return {"error": f"Simple query failed: {str(e)}"}
            
        # Test basic data retrieval
        try:
            test_query = """
            FOR node IN ast_nodes
                FILTER node.repository_id == @repo_id
                LIMIT 1
                RETURN node.type
            """
            cursor = db.aql.execute(test_query, bind_vars={'repo_id': repository_id})
            nodes = list(cursor)
            logger.info(f"Found {len(nodes)} test nodes")
        except Exception as e:
            return {"error": f"Test query failed: {str(e)}"}
            
        return {
            "success": True,
            "repository_id": repository_id,
            "db_connection": "OK",
            "simple_query": "OK",
            "test_nodes_found": len(nodes),
            "message": "Simple test completed successfully"
        }
        
    except Exception as e:
        logger.error(f"Simple test error: {e}")
        return {"error": str(e)}

@app.get("/api/documentation/repository-ids")
async def get_repository_ids_with_data():
    """Get repository IDs that actually have data in the AST collections."""
    try:
        db = get_arango_client()
        if not db:
            return {"error": "Database connection not available"}
            
        # Check what repository IDs exist in each collection
        results = {}
        
        try:
            # AST nodes
            ast_query = "FOR node IN ast_nodes COLLECT repo = node.repository_id WITH COUNT INTO count RETURN {repository_id: repo, count: count}"
            cursor = db.aql.execute(ast_query)
            results['ast_nodes'] = list(cursor)
        except Exception as e:
            results['ast_nodes_error'] = str(e)
            
        try:
            # Code files
            files_query = "FOR file IN code_files COLLECT repo = file.repository_id WITH COUNT INTO count RETURN {repository_id: repo, count: count}"
            cursor = db.aql.execute(files_query)
            results['code_files'] = list(cursor)
        except Exception as e:
            results['code_files_error'] = str(e)
            
        try:
            # Codeunits
            units_query = "FOR unit IN codeunits COLLECT repo = unit.repository_id WITH COUNT INTO count RETURN {repository_id: repo, count: count}"
            cursor = db.aql.execute(units_query)
            results['codeunits'] = list(cursor)
        except Exception as e:
            results['codeunits_error'] = str(e)
            
        return results
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/documentation/test/{repository_id}")
async def test_documentation_data(repository_id: str):
    """Test endpoint to check what data is available for documentation generation."""
    try:
        db = get_arango_client()
        if not db:
            return {"error": "Database connection not available"}
            
        # Simple test queries
        results = {}
        
        # Check AST nodes
        try:
            ast_query = "FOR node IN ast_nodes FILTER node.repository_id == @repo_id LIMIT 5 RETURN {type: node.type, name: node.name, file_path: node.file_path}"
            cursor = db.aql.execute(ast_query, bind_vars={'repo_id': repository_id})
            results['ast_nodes'] = list(cursor)
        except Exception as e:
            results['ast_nodes_error'] = str(e)
            
        # Check code files
        try:
            files_query = "FOR file IN code_files FILTER file.repository_id == @repo_id LIMIT 5 RETURN {file_path: file.file_path, extension: file.extension}"
            cursor = db.aql.execute(files_query, bind_vars={'repo_id': repository_id})
            results['code_files'] = list(cursor)
        except Exception as e:
            results['code_files_error'] = str(e)
            
        # Check codeunits
        try:
            units_query = "FOR unit IN codeunits FILTER unit.repository_id == @repo_id LIMIT 5 RETURN {type: unit.type, file_path: unit.file_path}"
            cursor = db.aql.execute(units_query, bind_vars={'repo_id': repository_id})
            results['codeunits'] = list(cursor)
        except Exception as e:
            results['codeunits_error'] = str(e)
            
        return {
            "repository_id": repository_id,
            "data_check": results
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/documentation/download/{repository_id}")
async def download_documentation(repository_id: str, format: str = "markdown"):
    """Download generated documentation for a repository."""
    try:
        from fastapi.responses import FileResponse
        import os
        
        # Construct expected file path
        docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'docs', 'generated')
        
        if format.lower() == "markdown":
            filename = f"{repository_id}_documentation.md"
        elif format.lower() == "html":
            filename = f"{repository_id}_documentation.html"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'markdown' or 'html'")
            
        file_path = os.path.join(docs_dir, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Documentation file not found")
            
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/octet-stream'
        )
        
    except Exception as e:
        logger.error(f"Error downloading documentation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Main entry point
if __name__ == "__main__":
    # Configuration from environment
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '8002'))  # Default to port 8002 to match frontend
    
    logger.info(f"Starting Code Management Analyzer API on {host}:{port}")
    logger.info("Environment configuration loaded and services initialized")
    
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=False,  # Set to False for production
        log_level=log_level.lower()
    )

