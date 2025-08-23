"""
Database schema setup for enhanced security analysis.
Creates collections and indexes for storing security analysis results.
"""

import logging
from arango import ArangoClient
from typing import Dict, Any

logger = logging.getLogger(__name__)

class SecurityDatabaseSetup:
    """Setup database collections and indexes for security analysis."""
    
    def __init__(self, db_url: str = "http://localhost:8529", db_name: str = "technical_debt_db"):
        self.client = ArangoClient(hosts=db_url)
        self.db_name = db_name
        
    def get_database_connection(self):
        """Get database connection."""
        try:
            # Try to connect to existing database
            db = self.client.db(self.db_name, username='root', password='')
            return db
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def setup_security_collections(self) -> bool:
        """Create security analysis collections and indexes."""
        
        try:
            db = self.get_database_connection()
            
            # Collection definitions
            collections_config = {
                'security_analyses': {
                    'description': 'Security analysis results',
                    'indexes': [
                        {
                            'type': 'persistent',
                            'fields': ['repository_id'],
                            'name': 'repository_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['analysis_timestamp'],
                            'name': 'timestamp_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['security_score'],
                            'name': 'security_score_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['analysis_type'],
                            'name': 'analysis_type_index'
                        }
                    ]
                },
                'security_vulnerabilities': {
                    'description': 'Individual security vulnerabilities',
                    'indexes': [
                        {
                            'type': 'persistent',
                            'fields': ['analysis_id'],
                            'name': 'analysis_id_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['repository_id'],
                            'name': 'repo_vulnerability_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['severity'],
                            'name': 'severity_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['category'],
                            'name': 'category_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['type'],
                            'name': 'type_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['priority_score'],
                            'name': 'priority_score_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['file_path'],
                            'name': 'file_path_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['discovered_at'],
                            'name': 'discovered_at_index'
                        }
                    ]
                },
                'security_tickets': {
                    'description': 'Security tickets created from vulnerabilities',
                    'indexes': [
                        {
                            'type': 'persistent',
                            'fields': ['analysis_id'],
                            'name': 'ticket_analysis_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['jira_ticket_key'],
                            'name': 'jira_key_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['vulnerability_id'],
                            'name': 'vulnerability_ticket_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['created_at'],
                            'name': 'ticket_created_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['status'],
                            'name': 'ticket_status_index'
                        }
                    ]
                },
                'security_compliance_history': {
                    'description': 'Historical compliance assessment data',
                    'indexes': [
                        {
                            'type': 'persistent',
                            'fields': ['repository_id'],
                            'name': 'compliance_repo_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['framework'],
                            'name': 'compliance_framework_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['assessment_date'],
                            'name': 'compliance_date_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['status'],
                            'name': 'compliance_status_index'
                        }
                    ]
                },
                'security_metrics_history': {
                    'description': 'Historical security metrics for trend analysis',
                    'indexes': [
                        {
                            'type': 'persistent',
                            'fields': ['repository_id'],
                            'name': 'metrics_repo_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['metric_date'],
                            'name': 'metrics_date_index'
                        },
                        {
                            'type': 'persistent',
                            'fields': ['metric_type'],
                            'name': 'metrics_type_index'
                        }
                    ]
                }
            }
            
            # Create collections and indexes
            for collection_name, config in collections_config.items():
                self._create_collection_with_indexes(db, collection_name, config)
            
            logger.info("Successfully set up security analysis database schema")
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup security collections: {e}")
            return False
    
    def _create_collection_with_indexes(self, db, collection_name: str, config: Dict[str, Any]):
        """Create a collection with its indexes."""
        
        try:
            # Create collection if it doesn't exist
            if not db.has_collection(collection_name):
                collection = db.create_collection(collection_name)
                logger.info(f"Created collection: {collection_name}")
            else:
                collection = db.collection(collection_name)
                logger.info(f"Collection already exists: {collection_name}")
            
            # Create indexes
            for index_config in config.get('indexes', []):
                try:
                    # Check if index already exists
                    existing_indexes = collection.indexes()
                    index_exists = any(
                        idx.get('name') == index_config['name'] 
                        for idx in existing_indexes
                    )
                    
                    if not index_exists:
                        collection.add_index(index_config)
                        logger.info(f"Created index '{index_config['name']}' on {collection_name}")
                    else:
                        logger.info(f"Index '{index_config['name']}' already exists on {collection_name}")
                        
                except Exception as e:
                    logger.warning(f"Failed to create index '{index_config['name']}' on {collection_name}: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to create collection {collection_name}: {e}")
            raise
    
    def create_sample_data(self) -> bool:
        """Create sample security data for testing."""
        
        try:
            db = self.get_database_connection()
            
            # Sample security analysis
            sample_analysis = {
                '_key': 'sample_security_analysis_001',
                'repository_id': 'default',
                'analysis_timestamp': '2025-08-04T12:00:00Z',
                'security_score': 75,
                'vulnerability_count': 3,
                'critical_count': 0,
                'high_count': 1,
                'medium_count': 2,
                'low_count': 0,
                'analysis_type': 'comprehensive_security',
                'executive_summary': {
                    'overall_risk_level': 'Medium',
                    'total_vulnerabilities': 3,
                    'critical_issues': 0,
                    'high_priority_issues': 1,
                    'requires_immediate_attention': False,
                    'estimated_remediation_hours': 12,
                    'business_impact_summary': 'Security analysis identified potential vulnerabilities requiring attention.',
                    'top_categories': [
                        {'category': 'authentication', 'count': 1, 'critical_count': 0, 'high_count': 1},
                        {'category': 'configuration', 'count': 2, 'critical_count': 0, 'high_count': 0}
                    ],
                    'compliance_risk': 'Low'
                },
                'security_metrics': {
                    'overall_score': 75,
                    'total_vulnerabilities': 3,
                    'critical_count': 0,
                    'high_count': 1,
                    'medium_count': 2,
                    'low_count': 0,
                    'security_grade': 'C',
                    'category_breakdown': {
                        'authentication': 1,
                        'configuration': 2
                    },
                    'trend_indicator': 'stable'
                }
            }
            
            # Sample vulnerabilities
            sample_vulnerabilities = [
                {
                    '_key': 'vuln_001',
                    'id': 'vuln_001',
                    'analysis_id': 'sample_security_analysis_001',
                    'repository_id': 'default',
                    'category': 'authentication',
                    'type': 'missing_authentication',
                    'severity': 'high',
                    'cwe': 'CWE-306',
                    'description': 'Missing authentication on sensitive endpoint',
                    'file_path': 'api/app.py',
                    'line_number': 123,
                    'matched_pattern': '@app.route.*?methods=\\[.*?POST.*?\\](?!.*?@login_required)',
                    'matched_text': '@app.route("/api/sensitive", methods=["POST"])',
                    'context': '>>> 123: @app.route("/api/sensitive", methods=["POST"])\n    124: def sensitive_endpoint():\n    125:     return {"data": "sensitive"}',
                    'discovered_at': '2025-08-04T12:00:00Z',
                    'priority_score': 85.5,
                    'ai_insights': {
                        'business_impact': 'High - Unauthenticated access to sensitive data',
                        'exploitability': 'high',
                        'remediation_effort': 4,
                        'remediation_steps': 'Add authentication decorator to the endpoint'
                    }
                },
                {
                    '_key': 'vuln_002',
                    'id': 'vuln_002',
                    'analysis_id': 'sample_security_analysis_001',
                    'repository_id': 'default',
                    'category': 'configuration',
                    'type': 'debug_enabled',
                    'severity': 'medium',
                    'cwe': 'CWE-489',
                    'description': 'Debug mode enabled in production',
                    'file_path': 'api/app.py',
                    'line_number': 45,
                    'matched_pattern': 'DEBUG\\s*=\\s*True',
                    'matched_text': 'DEBUG = True',
                    'context': '    43: # Configuration\n    44: API_HOST = "0.0.0.0"\n>>> 45: DEBUG = True\n    46: LOG_LEVEL = "INFO"\n    47: API_PORT = 8002',
                    'discovered_at': '2025-08-04T12:00:00Z',
                    'priority_score': 65.0,
                    'ai_insights': {
                        'business_impact': 'Medium - Information disclosure risk',
                        'exploitability': 'medium',
                        'remediation_effort': 2,
                        'remediation_steps': 'Set DEBUG = False for production deployment'
                    }
                }
            ]
            
            # Insert sample data
            analyses_collection = db.collection('security_analyses')
            analyses_collection.insert(sample_analysis)
            
            vulnerabilities_collection = db.collection('security_vulnerabilities')
            for vuln in sample_vulnerabilities:
                vulnerabilities_collection.insert(vuln)
            
            logger.info("Created sample security data")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create sample data: {e}")
            return False
    
    def verify_setup(self) -> Dict[str, Any]:
        """Verify the security database setup."""
        
        try:
            db = self.get_database_connection()
            
            required_collections = [
                'security_analyses',
                'security_vulnerabilities', 
                'security_tickets',
                'security_compliance_history',
                'security_metrics_history'
            ]
            
            setup_status = {
                'database_connected': True,
                'collections_created': {},
                'indexes_created': {},
                'sample_data_exists': False,
                'errors': []
            }
            
            # Check collections
            for collection_name in required_collections:
                if db.has_collection(collection_name):
                    collection = db.collection(collection_name)
                    setup_status['collections_created'][collection_name] = True
                    
                    # Check indexes
                    indexes = collection.indexes()
                    setup_status['indexes_created'][collection_name] = len(indexes)
                else:
                    setup_status['collections_created'][collection_name] = False
                    setup_status['errors'].append(f"Collection {collection_name} not found")
            
            # Check for sample data
            if db.has_collection('security_analyses'):
                analyses_collection = db.collection('security_analyses')
                count = analyses_collection.count()
                setup_status['sample_data_exists'] = count > 0
            
            return setup_status
            
        except Exception as e:
            return {
                'database_connected': False,
                'error': str(e)
            }

def setup_security_database():
    """Main function to setup security database schema."""
    
    print("🔧 Setting up security analysis database schema...")
    
    setup = SecurityDatabaseSetup()
    
    # Setup collections and indexes
    success = setup.setup_security_collections()
    
    if success:
        print("✅ Security collections and indexes created successfully")
        
        # Create sample data
        sample_success = setup.create_sample_data()
        if sample_success:
            print("✅ Sample security data created successfully")
        
        # Verify setup
        verification = setup.verify_setup()
        print("\n📊 Setup Verification:")
        print(f"Database Connected: {verification.get('database_connected', False)}")
        
        if 'collections_created' in verification:
            for collection, created in verification['collections_created'].items():
                status = "✅" if created else "❌"
                print(f"{status} Collection '{collection}': {created}")
        
        if 'indexes_created' in verification:
            for collection, index_count in verification['indexes_created'].items():
                print(f"📇 Collection '{collection}': {index_count} indexes")
        
        print(f"📁 Sample Data: {'✅' if verification.get('sample_data_exists', False) else '❌'}")
        
        if verification.get('errors'):
            print("\n⚠️  Errors:")
            for error in verification['errors']:
                print(f"   - {error}")
        
        print("\n🎉 Security database setup completed!")
        
    else:
        print("❌ Failed to setup security database schema")

if __name__ == "__main__":
    setup_security_database()
