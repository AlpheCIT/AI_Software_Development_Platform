#!/usr/bin/env python3
"""
Dynamic Documentation Generator - Comprehensive Examples
Demonstrates all features and usage patterns
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, Any

from core.dynamic_documentation_generator import (
    DynamicRepositoryDocumentationGenerator,
    DocumentationConfig
)
from core.database_manager import UnifiedDatabaseManager

class DocumentationExamples:
    """Collection of examples for using the dynamic documentation generator"""
    
    def __init__(self):
        self.db_manager = None
        self.doc_generator = None
    
    async def initialize(self):
        """Initialize database connection and documentation generator"""
        self.db_manager = UnifiedDatabaseManager()
        await self.db_manager.initialize()
        self.doc_generator = DynamicRepositoryDocumentationGenerator(self.db_manager)
        print("✅ Documentation generator initialized")
    
    async def cleanup(self):
        """Clean up database connections"""
        if self.db_manager:
            await self.db_manager.close()
        print("✅ Cleanup completed")
    
    async def example_1_complete_documentation(self, repository_id: str):
        """
        Example 1: Generate complete comprehensive documentation
        """
        print("\n🔍 Example 1: Complete Documentation Generation")
        print("=" * 60)
        
        config = DocumentationConfig(
            include_api_endpoints=True,
            include_service_architecture=True,
            include_code_structure=True,
            include_embeddings_analysis=True,
            include_purpose_analysis=True,
            include_complexity_metrics=True,
            output_format="markdown",
            detail_level="comprehensive",
            similarity_threshold=0.8,
            include_code_samples=True
        )
        
        documentation = await self.doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, str):
            # Save to file
            output_file = f"docs/complete_documentation_{repository_id}.md"
            Path("docs").mkdir(exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(documentation)
            
            print(f"📄 Complete documentation saved to: {output_file}")
            print(f"📊 Documentation length: {len(documentation)} characters")
        else:
            print(f"❌ Documentation generation failed: {documentation.get('error', 'Unknown error')}")
        
        return documentation
    
    async def example_2_api_only_documentation(self, repository_id: str):
        """
        Example 2: Generate API endpoints documentation only
        """
        print("\n🔍 Example 2: API Endpoints Documentation Only")
        print("=" * 60)
        
        config = DocumentationConfig(
            include_api_endpoints=True,
            include_service_architecture=False,
            include_code_structure=False,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=False,
            output_format="markdown",
            detail_level="detailed",
            include_code_samples=True
        )
        
        documentation = await self.doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, str):
            output_file = f"docs/api_documentation_{repository_id}.md"
            Path("docs").mkdir(exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(documentation)
            
            print(f"📄 API documentation saved to: {output_file}")
            
            # Extract and display API endpoint count
            api_count = documentation.count("| `") - 1  # Rough count of API endpoints
            print(f"🔗 Detected approximately {api_count} API endpoints")
        
        return documentation
    
    async def example_3_service_architecture_analysis(self, repository_id: str):
        """
        Example 3: Service architecture and dependency analysis
        """
        print("\n🔍 Example 3: Service Architecture Analysis")
        print("=" * 60)
        
        config = DocumentationConfig(
            include_api_endpoints=False,
            include_service_architecture=True,
            include_code_structure=True,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=True,
            output_format="json",
            detail_level="comprehensive"
        )
        
        documentation = await self.doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, dict) and documentation.get('success', True):
            output_file = f"docs/service_architecture_{repository_id}.json"
            Path("docs").mkdir(exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(documentation, f, indent=2, ensure_ascii=False)
            
            print(f"📄 Service architecture saved to: {output_file}")
            
            # Display summary
            sections = documentation.get('sections', {})
            if 'service_architecture' in sections:
                service_data = sections['service_architecture']
                print(f"🏗️  Detected {service_data.get('service_count', 0)} services")
                
                for service in service_data.get('services', [])[:5]:
                    service_type = service.get('type', 'unknown').replace('_', ' ').title()
                    file_count = service.get('file_count', 0)
                    complexity = service.get('complexity_total', 0)
                    print(f"   - {service_type}: {file_count} files, complexity: {complexity}")
        
        return documentation
    
    async def example_4_embeddings_similarity_analysis(self, repository_id: str):
        """
        Example 4: Embeddings and semantic similarity analysis
        """
        print("\n🔍 Example 4: Embeddings & Semantic Similarity Analysis")
        print("=" * 60)
        
        config = DocumentationConfig(
            include_api_endpoints=False,
            include_service_architecture=False,
            include_code_structure=False,
            include_embeddings_analysis=True,
            include_purpose_analysis=True,
            include_complexity_metrics=False,
            output_format="markdown",
            detail_level="comprehensive",
            similarity_threshold=0.75  # Lower threshold for more matches
        )
        
        documentation = await self.doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, str):
            output_file = f"docs/embeddings_analysis_{repository_id}.md"
            Path("docs").mkdir(exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(documentation)
            
            print(f"📄 Embeddings analysis saved to: {output_file}")
            
            # Extract key metrics
            if "Total Embeddings:" in documentation:
                embedding_line = [line for line in documentation.split('\n') if 'Total Embeddings:' in line][0]
                print(f"📊 {embedding_line.strip()}")
        
        return documentation
    
    async def example_5_complexity_hotspots_analysis(self, repository_id: str):
        """
        Example 5: Code complexity and hotspot identification
        """
        print("\n🔍 Example 5: Complexity Hotspots Analysis")
        print("=" * 60)
        
        config = DocumentationConfig(
            include_api_endpoints=False,
            include_service_architecture=False,
            include_code_structure=True,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=True,
            output_format="json",
            detail_level="comprehensive"
        )
        
        documentation = await self.doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, dict) and documentation.get('success', True):
            output_file = f"docs/complexity_analysis_{repository_id}.json"
            Path("docs").mkdir(exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(documentation, f, indent=2, ensure_ascii=False)
            
            print(f"📄 Complexity analysis saved to: {output_file}")
            
            # Display complexity summary
            sections = documentation.get('sections', {})
            if 'complexity_analysis' in sections:
                complexity_data = sections['complexity_analysis'].get('analysis', {})
                total_complexity = complexity_data.get('total_complexity', 0)
                avg_complexity = complexity_data.get('average_complexity', 0)
                hotspots = complexity_data.get('complexity_hotspots', [])
                
                print(f"🔥 Total Complexity Score: {total_complexity}")
                print(f"📊 Average Complexity: {avg_complexity:.2f}")
                print(f"⚠️  Complexity Hotspots: {len(hotspots)}")
                
                if hotspots:
                    print("   Top 3 hotspots:")
                    for hotspot in hotspots[:3]:
                        name = hotspot.get('name', 'unknown')
                        complexity = hotspot.get('complexity', 0)
                        file_name = Path(hotspot.get('file_path', '')).name
                        print(f"   - {name} (complexity: {complexity}) in {file_name}")
        
        return documentation
    
    async def example_6_custom_minimal_documentation(self, repository_id: str):
        """
        Example 6: Custom minimal documentation for quick overview
        """
        print("\n🔍 Example 6: Custom Minimal Documentation")
        print("=" * 60)
        
        config = DocumentationConfig(
            include_api_endpoints=True,
            include_service_architecture=True,
            include_code_structure=True,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=False,
            output_format="markdown",
            detail_level="basic",
            include_code_samples=False
        )
        
        documentation = await self.doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, str):
            output_file = f"docs/minimal_overview_{repository_id}.md"
            Path("docs").mkdir(exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(documentation)
            
            print(f"📄 Minimal overview saved to: {output_file}")
            print(f"📏 Document size: {len(documentation)} characters (compact)")
        
        return documentation
    
    async def example_7_html_output_format(self, repository_id: str):
        """
        Example 7: Generate HTML documentation format
        """
        print("\n🔍 Example 7: HTML Documentation Format")
        print("=" * 60)
        
        config = DocumentationConfig(
            include_api_endpoints=True,
            include_service_architecture=True,
            include_code_structure=False,
            include_embeddings_analysis=False,
            include_purpose_analysis=False,
            include_complexity_metrics=False,
            output_format="html",
            detail_level="detailed"
        )
        
        documentation = await self.doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, str):
            output_file = f"docs/documentation_{repository_id}.html"
            Path("docs").mkdir(exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(documentation)
            
            print(f"📄 HTML documentation saved to: {output_file}")
            print("🌐 HTML format is suitable for web viewing and sharing")
        
        return documentation
    
    async def example_8_compare_repositories(self, repo_ids: list):
        """
        Example 8: Compare multiple repositories
        """
        print("\n🔍 Example 8: Repository Comparison")
        print("=" * 60)
        
        comparison_data = {}
        
        for repo_id in repo_ids:
            print(f"Analyzing repository: {repo_id}")
            
            config = DocumentationConfig(
                include_api_endpoints=True,
                include_service_architecture=True,
                include_code_structure=True,
                include_embeddings_analysis=False,
                include_purpose_analysis=False,
                include_complexity_metrics=True,
                output_format="json",
                detail_level="basic"
            )
            
            documentation = await self.doc_generator.generate_complete_documentation(
                repo_id, config
            )
            
            if isinstance(documentation, dict) and documentation.get('success', True):
                metadata = documentation.get('metadata', {})
                comparison_data[repo_id] = {
                    'total_files': metadata.get('total_files', 0),
                    'total_nodes': metadata.get('total_nodes', 0),
                    'frameworks': metadata.get('frameworks_detected', []),
                    'languages': metadata.get('languages_detected', [])
                }
                
                # Extract API count
                sections = documentation.get('sections', {})
                if 'api_endpoints' in sections:
                    api_data = sections['api_endpoints']
                    comparison_data[repo_id]['api_endpoints'] = api_data.get('total_endpoints', 0)
                
                # Extract service count
                if 'service_architecture' in sections:
                    service_data = sections['service_architecture']
                    comparison_data[repo_id]['services'] = service_data.get('service_count', 0)
        
        # Save comparison
        output_file = "docs/repository_comparison.json"
        Path("docs").mkdir(exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(comparison_data, f, indent=2, ensure_ascii=False)
        
        print(f"📄 Repository comparison saved to: {output_file}")
        
        # Display comparison summary
        print("\n📊 Repository Comparison Summary:")
        print("Repository ID | Files | Nodes | APIs | Services | Languages")
        print("-" * 65)
        
        for repo_id, data in comparison_data.items():
            files = data.get('total_files', 0)
            nodes = data.get('total_nodes', 0)
            apis = data.get('api_endpoints', 0)
            services = data.get('services', 0)
            languages = ', '.join(data.get('languages', [])[:3])
            
            print(f"{repo_id:<12} | {files:>5} | {nodes:>5} | {apis:>4} | {services:>8} | {languages}")
        
        return comparison_data
    
    async def list_available_repositories(self):
        """List all repositories available for documentation"""
        print("\n📁 Available Repositories for Documentation")
        print("=" * 60)
        
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
            FILTER node_count > 0
            RETURN {
                id: repo._key,
                name: repo.name,
                url: repo.url,
                analysis_timestamp: repo.analysis_timestamp,
                node_count: node_count,
                embedding_count: embedding_count
            }
        """
        
        cursor = self.db_manager.db.aql.execute(query)
        repositories = list(cursor)
        
        if repositories:
            print(f"Found {len(repositories)} analyzed repositories:")
            print(f"{'ID':<15} {'Name':<25} {'Nodes':<8} {'Embeddings':<12} {'Last Analysis'}")
            print("-" * 80)
            
            for repo in repositories:
                repo_id = repo.get('id', 'N/A')[:14]
                name = repo.get('name', 'N/A')[:24]
                nodes = repo.get('node_count', 0)
                embeddings = repo.get('embedding_count', 0)
                timestamp = repo.get('analysis_timestamp', 'N/A')[:19] if repo.get('analysis_timestamp') else 'N/A'
                
                print(f"{repo_id:<15} {name:<25} {nodes:<8} {embeddings:<12} {timestamp}")
            
            return [repo.get('id') for repo in repositories]
        else:
            print("❌ No analyzed repositories found")
            return []

async def run_all_examples():
    """Run all documentation generation examples"""
    
    examples = DocumentationExamples()
    await examples.initialize()
    
    try:
        # List available repositories
        repo_ids = await examples.list_available_repositories()
        
        if not repo_ids:
            print("❌ No repositories available for documentation. Please analyze some repositories first.")
            return
        
        # Use the first repository for examples
        repository_id = repo_ids[0]
        print(f"\n🎯 Using repository '{repository_id}' for examples")
        
        # Run all examples
        await examples.example_1_complete_documentation(repository_id)
        await examples.example_2_api_only_documentation(repository_id)
        await examples.example_3_service_architecture_analysis(repository_id)
        await examples.example_4_embeddings_similarity_analysis(repository_id)
        await examples.example_5_complexity_hotspots_analysis(repository_id)
        await examples.example_6_custom_minimal_documentation(repository_id)
        await examples.example_7_html_output_format(repository_id)
        
        # If multiple repositories available, compare them
        if len(repo_ids) > 1:
            await examples.example_8_compare_repositories(repo_ids[:3])  # Compare first 3
        
        print("\n✅ All documentation generation examples completed!")
        print("📁 Check the 'docs/' directory for generated files")
    
    finally:
        await examples.cleanup()

async def run_specific_example(example_number: int, repository_id: str = None):
    """Run a specific example"""
    
    examples = DocumentationExamples()
    await examples.initialize()
    
    try:
        if repository_id is None:
            repo_ids = await examples.list_available_repositories()
            if repo_ids:
                repository_id = repo_ids[0]
            else:
                print("❌ No repositories available")
                return
        
        example_methods = {
            1: examples.example_1_complete_documentation,
            2: examples.example_2_api_only_documentation,
            3: examples.example_3_service_architecture_analysis,
            4: examples.example_4_embeddings_similarity_analysis,
            5: examples.example_5_complexity_hotspots_analysis,
            6: examples.example_6_custom_minimal_documentation,
            7: examples.example_7_html_output_format
        }
        
        if example_number in example_methods:
            await example_methods[example_number](repository_id)
        elif example_number == 8:
            repo_ids = await examples.list_available_repositories()
            await examples.example_8_compare_repositories(repo_ids[:3])
        else:
            print(f"❌ Example {example_number} not found")
    
    finally:
        await examples.cleanup()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        try:
            example_num = int(sys.argv[1])
            repo_id = sys.argv[2] if len(sys.argv) > 2 else None
            asyncio.run(run_specific_example(example_num, repo_id))
        except ValueError:
            print("Usage: python documentation_examples.py [example_number] [repository_id]")
            print("Examples: 1-8")
    else:
        asyncio.run(run_all_examples())
