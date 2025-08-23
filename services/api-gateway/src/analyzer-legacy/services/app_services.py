#!/usr/bin/env python3
"""
Service initialization and configuration for the Code Management Analyzer API
Updates the main FastAPI app to use the new service registry and database manager
"""

import logging
from typing import Optional, Any

from api.services.database_manager import DatabaseManager, get_database
from api.services.service_registry import ServiceRegistry, get_service_registry

logger = logging.getLogger(__name__)


def initialize_app_services() -> bool:
    """
    Initialize all application services using the service registry
    
    Returns:
        bool: True if initialization successful, False otherwise
    """
    try:
        logger.info("Initializing application services...")
        
        # Get service registry
        registry = get_service_registry()
        
        # Register core services
        registry.register_singleton(DatabaseManager)
        
        # Import and register AI services if available
        try:
            from api.services.similarity_engine import SimilarityEngine
            from api.services.refactoring_engine import RefactoringDecisionEngine
            from api.services.enhanced_ast_parser import EnhancedASTParserService
            from api.services.purpose_extractor import PurposeExtractor
            from api.services.embedding_generator import MultiDimensionalEmbeddingEngine
            
            # Register AI services with proper dependencies
            registry.register_singleton(
                SimilarityEngine,
                dependencies=[DatabaseManager]
            )
            
            registry.register_singleton(
                RefactoringDecisionEngine,
                dependencies=[DatabaseManager, SimilarityEngine]
            )
            
            registry.register_singleton(
                EnhancedASTParserService,
                dependencies=[DatabaseManager]
            )
            
            registry.register_singleton(
                PurposeExtractor
            )
            
            registry.register_singleton(
                MultiDimensionalEmbeddingEngine
            )
            
            logger.info("✅ AI Refactoring services registered successfully")
            
        except ImportError as e:
            logger.warning(f"⚠️  AI Refactoring services not available: {e}")
        
        # Validate service dependencies
        dependency_issues = registry.validate_dependencies()
        if dependency_issues:
            logger.warning(f"Service dependency issues found: {dependency_issues}")
        
        logger.info("✅ Application services initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize application services: {e}")
        return False


def get_database_connection() -> Optional[Any]:
    """
    Get database connection through the service registry
    
    Returns:
        Database connection or None if not available
    """
    try:
        registry = get_service_registry()
        db_manager = registry.get_service(DatabaseManager)
        
        if db_manager:
            return db_manager.get_db()
        else:
            logger.error("DatabaseManager service not available")
            return None
            
    except Exception as e:
        logger.error(f"Error getting database connection: {e}")
        return None


def get_similarity_engine_service():
    """Get SimilarityEngine service through the registry"""
    try:
        registry = get_service_registry()
        return registry.get_service('api.services.similarity_engine.SimilarityEngine')
    except Exception as e:
        logger.error(f"Error getting SimilarityEngine service: {e}")
        return None


def get_refactoring_engine_service():
    """Get RefactoringDecisionEngine service through the registry"""
    try:
        registry = get_service_registry()
        return registry.get_service('services.refactoring_engine.RefactoringDecisionEngine')
    except Exception as e:
        logger.error(f"Error getting RefactoringDecisionEngine service: {e}")
        return None


def get_enhanced_ast_parser_service():
    """Get EnhancedASTParserService through the registry"""
    try:
        registry = get_service_registry()
        return registry.get_service('services.enhanced_ast_parser.EnhancedASTParserService')
    except Exception as e:
        logger.error(f"Error getting EnhancedASTParserService: {e}")
        return None


def get_service_status() -> dict:
    """
    Get comprehensive status of all services
    
    Returns:
        dict: Service status information
    """
    try:
        registry = get_service_registry()
        
        # Get database status
        db_manager = registry.get_service(DatabaseManager)
        db_status = db_manager.get_status() if db_manager else {
            'status': 'not_available',
            'connected': False
        }
        
        # Get registry status
        registry_status = registry.get_all_services_status()
        
        # Get database collection validation
        db_validation = db_manager.validate_collections() if db_manager else {
            'all_present': False,
            'error': 'DatabaseManager not available'
        }
        
        return {
            'database': db_status,
            'services': registry_status,
            'collections': db_validation,
            'overall_health': _calculate_overall_health(db_status, registry_status, db_validation)
        }
        
    except Exception as e:
        logger.error(f"Error getting service status: {e}")
        return {
            'error': str(e),
            'overall_health': 'error'
        }


def _calculate_overall_health(db_status: dict, registry_status: dict, db_validation: dict) -> str:
    """Calculate overall system health based on service statuses"""
    
    # Check database health
    if not db_status.get('connected', False):
        return 'unhealthy'
    
    # Check collections
    if not db_validation.get('all_present', False):
        return 'degraded'
    
    # Check service availability
    critical_services = [
        'api.services.database_manager.DatabaseManager',
        'api.services.similarity_engine.SimilarityEngine',
        'api.services.refactoring_engine.RefactoringDecisionEngine'
    ]
    
    for service_name in critical_services:
        service_info = registry_status.get(service_name, {})
        if service_info.get('status') != 'ready':
            return 'degraded'
    
    return 'healthy'


def reset_all_services():
    """Reset all services (useful for testing or recovery)"""
    try:
        logger.info("Resetting all services...")
        
        # Reset service registry
        registry = get_service_registry()
        registry.reset()
        
        # Reinitialize services
        return initialize_app_services()
        
    except Exception as e:
        logger.error(f"Error resetting services: {e}")
        return False


# Auto-initialize on import
logger.info("🚀 Starting service initialization...")
_initialization_success = initialize_app_services()

if _initialization_success:
    logger.info("✅ Service initialization completed successfully")
else:
    logger.error("❌ Service initialization failed")
