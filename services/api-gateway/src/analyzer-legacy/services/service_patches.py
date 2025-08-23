#!/usr/bin/env python3
"""
Service Function Patches for app.py
Replaces the existing service initialization functions with ones that use the new service infrastructure
"""

import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Import the new service infrastructure
try:
    from api.services.app_services import (
        get_database_connection,
        get_similarity_engine_service,
        get_refactoring_engine_service,
        get_enhanced_ast_parser_service,
        get_service_status
    )
    from api.services.database_manager import get_database_status, validate_database_collections
    NEW_SERVICES_AVAILABLE = True
    logger.info("✅ New service infrastructure loaded successfully")
except ImportError as e:
    NEW_SERVICES_AVAILABLE = False
    logger.error(f"❌ New service infrastructure not available: {e}")


def get_arango_client():
    """
    UPDATED: Get ArangoDB client using the new DatabaseManager service
    
    This replaces the old hardcoded database connection with the new
    singleton pattern database manager with proper error handling.
    """
    if NEW_SERVICES_AVAILABLE:
        return get_database_connection()
    else:
        # Fallback to original implementation if new services not available
        logger.warning("Using fallback database connection")
        return _original_get_arango_client()


def get_similarity_engine():
    """
    UPDATED: Get similarity engine using the service registry
    
    Replaces the global variable pattern with proper dependency injection
    through the service registry.
    """
    global _similarity_engine
    
    if NEW_SERVICES_AVAILABLE:
        engine = get_similarity_engine_service()
        if engine:
            _similarity_engine = engine  # Update global for compatibility
            return engine
        else:
            logger.error("SimilarityEngine not available through service registry")
            return None
    else:
        # Fallback to original implementation
        return _original_get_similarity_engine()


def get_refactoring_engine():
    """
    UPDATED: Get refactoring engine using the service registry
    
    Replaces the global variable pattern with proper dependency injection
    through the service registry.
    """
    global _refactoring_engine
    
    if NEW_SERVICES_AVAILABLE:
        engine = get_refactoring_engine_service()
        if engine:
            _refactoring_engine = engine  # Update global for compatibility
            return engine
        else:
            logger.error("RefactoringDecisionEngine not available through service registry")
            return None
    else:
        # Fallback to original implementation
        return _original_get_refactoring_engine()


def get_enhanced_ast_parser():
    """
    UPDATED: Get enhanced AST parser using the service registry
    
    Replaces the global variable pattern with proper dependency injection
    through the service registry.
    """
    global _enhanced_ast_parser
    
    if NEW_SERVICES_AVAILABLE:
        parser = get_enhanced_ast_parser_service()
        if parser:
            _enhanced_ast_parser = parser  # Update global for compatibility
            return parser
        else:
            logger.error("EnhancedASTParserService not available through service registry")
            return None
    else:
        # Fallback to original implementation
        return _original_get_enhanced_ast_parser()


def get_system_status():
    """
    UPDATED: Get comprehensive system status using the new service infrastructure
    
    Returns detailed status information about all services, database connections,
    and system health.
    """
    if NEW_SERVICES_AVAILABLE:
        return get_service_status()
    else:
        # Fallback basic status
        return {
            'status': 'legacy_mode',
            'message': 'Running with legacy service implementation',
            'services_available': False
        }


# Fallback implementations (original code patterns)
def _original_get_arango_client():
    """Original ArangoDB client implementation (fallback)"""
    # This would contain the original get_arango_client code
    # For now, return None to indicate unavailable
    logger.warning("Original database client not implemented in patch")
    return None


def _original_get_similarity_engine():
    """Original similarity engine implementation (fallback)"""
    global _similarity_engine
    if _similarity_engine is None:
        try:
            # This would contain the original initialization code
            logger.warning("Original similarity engine initialization not implemented in patch")
        except Exception as e:
            logger.error(f"Failed to initialize SimilarityEngine (original): {e}")
            _similarity_engine = None
    return _similarity_engine


def _original_get_refactoring_engine():
    """Original refactoring engine implementation (fallback)"""
    global _refactoring_engine
    if _refactoring_engine is None:
        try:
            # This would contain the original initialization code
            logger.warning("Original refactoring engine initialization not implemented in patch")
        except Exception as e:
            logger.error(f"Failed to initialize RefactoringDecisionEngine (original): {e}")
            _refactoring_engine = None
    return _refactoring_engine


def _original_get_enhanced_ast_parser():
    """Original enhanced AST parser implementation (fallback)"""
    global _enhanced_ast_parser
    if _enhanced_ast_parser is None:
        try:
            # This would contain the original initialization code
            logger.warning("Original AST parser initialization not implemented in patch")
        except Exception as e:
            logger.error(f"Failed to initialize EnhancedASTParserService (original): {e}")
            _enhanced_ast_parser = None
    return _enhanced_ast_parser


# Global variables for backward compatibility
_similarity_engine = None
_refactoring_engine = None
_enhanced_ast_parser = None

logger.info("🔧 Service function patches loaded")
