#!/usr/bin/env python3
"""
Simple Search Service - Lightweight version for testing
"""

import logging
from typing import List, Optional, Dict, Any
from api.services.database_manager import DatabaseManager
from api.services.hybrid_search_service import SearchOptions, SearchType, CodeSearchResult

logger = logging.getLogger(__name__)


class SimpleSearchService:
    """
    Simplified search service for testing and debugging
    """
    
    def __init__(self):
        self.db_manager = DatabaseManager()
    
    async def simple_search(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """
        Simple search using basic AQL query
        """
        db = self.db_manager.get_db()
        if not db:
            raise Exception("Database connection not available")
        
        try:
            # Very simple query to test connectivity
            aql_query = """
            FOR codeunit IN codeunits
                FILTER CONTAINS(LOWER(codeunit.name), LOWER(@query))
                LIMIT @max_results
                RETURN {
                    _key: codeunit._key,
                    name: codeunit.name,
                    type: codeunit.type,
                    file_path: codeunit.file_path,
                    start_line: codeunit.start_line
                }
            """
            
            cursor = db.aql.execute(
                aql_query,
                bind_vars={
                    'query': query,
                    'max_results': max_results
                }
            )
            
            results = list(cursor)
            logger.info(f"Simple search found {len(results)} results for query: {query}")
            return results
            
        except Exception as e:
            logger.error(f"Simple search error: {e}")
            raise
    
    async def count_codeunits(self) -> int:
        """
        Count total codeunits for testing
        """
        db = self.db_manager.get_db()
        if not db:
            raise Exception("Database connection not available")
        
        try:
            cursor = db.aql.execute("RETURN LENGTH(codeunits)")
            count = list(cursor)[0]
            logger.info(f"Total codeunits: {count}")
            return count
        except Exception as e:
            logger.error(f"Count error: {e}")
            raise
