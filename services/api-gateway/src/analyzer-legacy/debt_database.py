"""
Database service for technical debt analysis data storage and retrieval.
Handles ArangoDB operations for storing historical technical debt data.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json

logger = logging.getLogger(__name__)

try:
    from arango import ArangoClient
    ARANGO_AVAILABLE = True
except ImportError:
    ARANGO_AVAILABLE = False
    logger.warning("ArangoDB package not available")

class TechnicalDebtDatabase:
    """Database service for technical debt analysis data"""
    
    def __init__(self):
        self.client = None
        self.db = None
        self.connected = False
        
        if ARANGO_AVAILABLE:
            self._connect()
        else:
            logger.warning("ArangoDB not available - data will not be persisted")
    
    def _connect(self):
        """Connect to ArangoDB and initialize collections"""
        try:
            # Get connection details from environment
            host = os.getenv('ARANGO_HOST', 'localhost')
            port = int(os.getenv('ARANGO_PORT', '8529'))
            username = os.getenv('ARANGO_USER', 'root')
            password = os.getenv('ARANGO_PASSWORD', '')
            database_name = os.getenv('ARANGO_DATABASE', 'code_management')
            
            # Create client and connect
            self.client = ArangoClient(hosts=f'http://{host}:{port}')
            self.db = self.client.db(database_name, username=username, password=password)
            
            # Initialize collections if they don't exist
            self._initialize_collections()
            
            self.connected = True
            logger.info(f"Connected to ArangoDB at {host}:{port}/{database_name}")
            
        except Exception as e:
            logger.error(f"Failed to connect to ArangoDB: {str(e)}")
            self.connected = False
    
    def _initialize_collections(self):
        """Initialize required collections and indexes"""
        collections = [
            'technical_debt_analyses',
            'debt_hotspots', 
            'debt_trends',
            'debt_recommendations',
            'security_analyses',
            'security_vulnerabilities'
        ]
        
        for collection_name in collections:
            try:
                if not self.db.has_collection(collection_name):
                    collection = self.db.create_collection(collection_name)
                    logger.info(f"Created collection: {collection_name}")
                else:
                    collection = self.db.collection(collection_name)
                
                # Create indexes based on collection type
                self._create_indexes(collection, collection_name)
                
            except Exception as e:
                logger.error(f"Error initializing collection {collection_name}: {str(e)}")
    
    def _create_indexes(self, collection, collection_name: str):
        """Create indexes for a collection"""
        try:
            if collection_name == 'technical_debt_analyses':
                collection.add_persistent_index(['analysis_date'], unique=False)
                collection.add_persistent_index(['project_id', 'analysis_date'], unique=True)
                
            elif collection_name == 'debt_hotspots':
                collection.add_persistent_index(['analysis_id'], unique=False)
                collection.add_persistent_index(['file_path'], unique=False)
                collection.add_persistent_index(['debt_score'], unique=False)
                collection.add_persistent_index(['analysis_date'], unique=False)
                
            elif collection_name == 'debt_trends':
                collection.add_persistent_index(['date'], unique=False)
                collection.add_persistent_index(['project_id', 'date'], unique=True)
                
            elif collection_name == 'debt_recommendations':
                collection.add_persistent_index(['analysis_id'], unique=False)
                collection.add_persistent_index(['status'], unique=False)
                collection.add_persistent_index(['priority'], unique=False)
                
            elif collection_name == 'security_analyses':
                collection.add_persistent_index(['analysis_timestamp'], unique=False)
                collection.add_persistent_index(['repository_id', 'analysis_timestamp'], unique=True)
                collection.add_persistent_index(['security_score'], unique=False)
                collection.add_persistent_index(['risk_level'], unique=False)
                
            elif collection_name == 'security_vulnerabilities':
                collection.add_persistent_index(['analysis_timestamp'], unique=False)
                collection.add_persistent_index(['repository_id'], unique=False)
                collection.add_persistent_index(['severity'], unique=False)
                collection.add_persistent_index(['category'], unique=False)
                collection.add_persistent_index(['risk_score'], unique=False)
                collection.add_persistent_index(['file_path'], unique=False)
                
        except Exception as e:
            logger.debug(f"Index creation for {collection_name}: {str(e)}")  # Indexes might already exist
    
    def is_connected(self) -> bool:
        """Check if database is connected"""
        return self.connected and ARANGO_AVAILABLE
    
    def store_analysis(self, analysis_data: Dict[str, Any], project_id: str = "default") -> Optional[str]:
        """
        Store a complete technical debt analysis result
        
        Args:
            analysis_data: The complete analysis data from debt service
            project_id: Project identifier
            
        Returns:
            The document key if stored successfully, None otherwise
        """
        if not self.is_connected():
            logger.warning("Database not connected - cannot store analysis")
            return None
            
        try:
            analysis_date = datetime.now()
            analysis_key = f"analysis_{analysis_date.strftime('%Y%m%d_%H%M%S')}"
            
            document = {
                '_key': analysis_key,
                'project_id': project_id,
                'analysis_date': analysis_date.isoformat(),
                'total_files_analyzed': analysis_data.get('summary', {}).get('total_files_analyzed', 0),
                'average_debt_score': analysis_data.get('summary', {}).get('average_debt_score', 0),
                'maximum_debt_score': analysis_data.get('summary', {}).get('maximum_debt_score', 0),
                'total_hotspots': analysis_data.get('summary', {}).get('total_hotspots', 0),
                'total_remediation_hours': analysis_data.get('summary', {}).get('total_remediation_hours', 0),
                'severity_distribution': analysis_data.get('severity_distribution', {}),
                'team_allocations': analysis_data.get('team_allocations', []),
                'recommendations': analysis_data.get('recommendations', []),
                'metadata': {
                    'analysis_version': '1.0.0',
                    'created_timestamp': analysis_date.isoformat()
                }
            }
            
            collection = self.db.collection('technical_debt_analyses')
            result = collection.insert(document)
            
            logger.info(f"Stored analysis with key: {analysis_key}")
            return analysis_key
            
        except Exception as e:
            logger.error(f"Failed to store analysis: {str(e)}")
            return None
    
    def store_hotspots(self, hotspots_data: List[Dict[str, Any]], analysis_id: str) -> int:
        """
        Store debt hotspots for an analysis
        
        Args:
            hotspots_data: List of hotspot data
            analysis_id: The analysis ID these hotspots belong to
            
        Returns:
            Number of hotspots stored successfully
        """
        if not self.is_connected():
            logger.warning("Database not connected - cannot store hotspots")
            return 0
            
        try:
            collection = self.db.collection('debt_hotspots')
            stored_count = 0
            analysis_date = datetime.now()
            
            for i, hotspot in enumerate(hotspots_data):
                try:
                    hotspot_key = f"hotspot_{analysis_id}_{i:03d}"
                    
                    document = {
                        '_key': hotspot_key,
                        'analysis_id': analysis_id,
                        'analysis_date': analysis_date.isoformat(),
                        'file_path': hotspot.get('file_path', ''),
                        'debt_score': hotspot.get('debt_score', 0),
                        'severity': hotspot.get('severity', 'low'),
                        'primary_issues': hotspot.get('primary_issues', []),
                        'estimated_hours': hotspot.get('estimated_hours', 0),
                        'last_modified': hotspot.get('last_modified', analysis_date.isoformat()),
                        'change_frequency': hotspot.get('change_frequency', 0),
                        'metrics': hotspot.get('metrics', {})
                    }
                    
                    collection.insert(document)
                    stored_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to store hotspot {i}: {str(e)}")
            
            logger.info(f"Stored {stored_count} hotspots for analysis {analysis_id}")
            return stored_count
            
        except Exception as e:
            logger.error(f"Failed to store hotspots: {str(e)}")
            return 0
    
    def store_daily_trend(self, trend_data: Dict[str, Any], project_id: str = "default") -> bool:
        """
        Store daily aggregated trend data
        
        Args:
            trend_data: Daily trend aggregation data
            project_id: Project identifier
            
        Returns:
            True if stored successfully, False otherwise
        """
        if not self.is_connected():
            logger.warning("Database not connected - cannot store trend")
            return False
            
        try:
            date_str = datetime.now().strftime('%Y-%m-%d')
            trend_key = f"trend_{project_id}_{date_str.replace('-', '')}"
            
            document = {
                '_key': trend_key,
                'project_id': project_id,
                'date': date_str,
                'total_debt_score': trend_data.get('total_debt_score', 0),
                'file_count': trend_data.get('file_count', 0),
                'resolved_debt': trend_data.get('resolved_debt', 0),
                'new_debt': trend_data.get('new_debt', 0),
                'hotspots_count': trend_data.get('hotspots_count', 0),
                'critical_issues': trend_data.get('critical_issues', 0),
                'high_issues': trend_data.get('high_issues', 0),
                'medium_issues': trend_data.get('medium_issues', 0),
                'low_issues': trend_data.get('low_issues', 0),
                'total_remediation_hours': trend_data.get('total_remediation_hours', 0),
                'created_timestamp': datetime.now().isoformat()
            }
            
            collection = self.db.collection('debt_trends')
            # Use upsert to replace existing data for the same date
            collection.insert(document, overwrite=True)
            
            logger.info(f"Stored daily trend for {date_str}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store daily trend: {str(e)}")
            return False
    
    def get_historical_trends(self, days: int = 30, project_id: str = "default") -> List[Dict[str, Any]]:
        """
        Retrieve historical trend data
        
        Args:
            days: Number of days to retrieve
            project_id: Project identifier
            
        Returns:
            List of historical trend data
        """
        if not self.is_connected():
            logger.warning("Database not connected - returning empty trends")
            return []
            
        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # AQL query to get trends
            aql = """
            FOR trend IN debt_trends
                FILTER trend.project_id == @project_id
                FILTER trend.date >= @start_date
                FILTER trend.date <= @end_date
                SORT trend.date ASC
                RETURN trend
            """
            
            bind_vars = {
                'project_id': project_id,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d')
            }
            
            cursor = self.db.aql.execute(aql, bind_vars=bind_vars)
            trends = [doc for doc in cursor]
            
            logger.info(f"Retrieved {len(trends)} historical trends")
            return trends
            
        except Exception as e:
            logger.error(f"Failed to retrieve historical trends: {str(e)}")
            return []
    
    def get_analysis_history(self, days: int = 30, project_id: str = "default") -> List[Dict[str, Any]]:
        """
        Retrieve analysis history
        
        Args:
            days: Number of days to look back
            project_id: Project identifier
            
        Returns:
            List of historical analysis data
        """
        if not self.is_connected():
            logger.warning("Database not connected - returning empty history")
            return []
            
        try:
            # Calculate date range
            start_date = datetime.now() - timedelta(days=days)
            
            # AQL query to get analysis history
            aql = """
            FOR analysis IN technical_debt_analyses
                FILTER analysis.project_id == @project_id
                FILTER DATE_ISO8601(analysis.analysis_date) >= @start_date
                SORT analysis.analysis_date DESC
                RETURN analysis
            """
            
            bind_vars = {
                'project_id': project_id,
                'start_date': start_date.isoformat()
            }
            
            cursor = self.db.aql.execute(aql, bind_vars=bind_vars)
            history = [doc for doc in cursor]
            
            logger.info(f"Retrieved {len(history)} analysis records")
            return history
            
        except Exception as e:
            logger.error(f"Failed to retrieve analysis history: {str(e)}")
            return []
    
    def get_file_debt_history(self, file_path: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get debt score history for a specific file
        
        Args:
            file_path: Path to the file
            days: Number of days to look back
            
        Returns:
            List of debt scores for the file over time
        """
        if not self.is_connected():
            logger.warning("Database not connected - returning empty file history")
            return []
            
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            aql = """
            FOR hotspot IN debt_hotspots
                FILTER hotspot.file_path == @file_path
                FILTER DATE_ISO8601(hotspot.analysis_date) >= @start_date
                SORT hotspot.analysis_date ASC
                RETURN {
                    analysis_date: hotspot.analysis_date,
                    debt_score: hotspot.debt_score,
                    severity: hotspot.severity,
                    estimated_hours: hotspot.estimated_hours,
                    metrics: hotspot.metrics
                }
            """
            
            bind_vars = {
                'file_path': file_path,
                'start_date': start_date.isoformat()
            }
            
            cursor = self.db.aql.execute(aql, bind_vars=bind_vars)
            history = [doc for doc in cursor]
            
            logger.info(f"Retrieved {len(history)} debt records for {file_path}")
            return history
            
        except Exception as e:
            logger.error(f"Failed to retrieve file debt history: {str(e)}")
            return []

# Global instance
debt_db = TechnicalDebtDatabase()

# Export DATABASE_AVAILABLE for other modules
DATABASE_AVAILABLE = ARANGO_AVAILABLE
