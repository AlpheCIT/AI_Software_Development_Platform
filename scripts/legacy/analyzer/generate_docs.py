#!/usr/bin/env python3
"""
Dynamic Documentation Generator - Usage Examples and CLI Interface
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from core.dynamic_documentation_generator import (
    DynamicRepositoryDocumentationGenerator,
    DocumentationConfig
)
from core.database_manager import UnifiedDatabaseManager

async def generate_repository_documentation(
    repository_id: str, 
    output_file: Optional[str] = None,
    config: Optional[DocumentationConfig] = None
) -> str:
    """
    Generate complete documentation for a repository
    
    Args:
        repository_id: The repository ID to analyze
        output_file: Optional output file path
        config: Documentation configuration
    
    Returns:
        Generated documentation content
    """
    
    # Initialize database manager
    db_manager = UnifiedDatabaseManager()
    await db_manager.initialize()
    
    try:
        # Create documentation generator
        doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
        
        # Use provided config or create default
        if config is None:
            config = DocumentationConfig(
                include_api_endpoints=True,
                include_service_architecture=True,
                include_code_structure=True,
                include_embeddings_analysis=True,
                include_purpose_analysis=True,
                include_complexity_metrics=True,
                output_format="markdown",
                detail_level="comprehensive"
            )
        
        # Generate documentation
        print(f"🔍 Generating documentation for repository: {repository_id}")
        documentation = await doc_generator.generate_complete_documentation(
            repository_id, config
        )
        
        if isinstance(documentation, dict) and not documentation.get('success', True):
            print(f"❌ Documentation generation failed: {documentation.get('error', 'Unknown error')}")
            return ""
        
        # Handle output
        if isinstance(documentation, str):  # Markdown format
            if output_file:
                output_path = Path(output_file)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(documentation)
                print(f"📄 Documentation saved to: {output_path}")
            else:
                print(documentation)
            return documentation
        else:
            # JSON format
            json_content = json.dumps(documentation, indent=2, ensure_ascii=False)
            if output_file:
                output_path = Path(output_file)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(json_content)
                print(f"📄 Documentation saved to: {output_path}")
            else:
                print(json_content)
            return json_content
    
    finally:
        await db_manager.close()

async def generate_api_documentation_only(repository_id: str, output_file: Optional[str] = None) -> str:
    """Generate API documentation only"""
    
    config = DocumentationConfig(
        include_api_endpoints=True,
        include_service_architecture=False,
        include_code_structure=False,
        include_embeddings_analysis=False,
        include_purpose_analysis=False,
        include_complexity_metrics=False,
        output_format="markdown",
        detail_level="detailed"
    )
    
    return await generate_repository_documentation(repository_id, output_file, config)

async def generate_service_architecture_documentation(repository_id: str, output_file: Optional[str] = None) -> str:
    """Generate service architecture documentation only"""
    
    config = DocumentationConfig(
        include_api_endpoints=False,
        include_service_architecture=True,
        include_code_structure=True,
        include_embeddings_analysis=False,
        include_purpose_analysis=False,
        include_complexity_metrics=True,
        output_format="markdown",
        detail_level="comprehensive"
    )
    
    return await generate_repository_documentation(repository_id, output_file, config)

async def generate_embeddings_analysis(repository_id: str, output_file: Optional[str] = None) -> str:
    """Generate embeddings and semantic analysis documentation"""
    
    config = DocumentationConfig(
        include_api_endpoints=False,
        include_service_architecture=False,
        include_code_structure=False,
        include_embeddings_analysis=True,
        include_purpose_analysis=True,
        include_complexity_metrics=False,
        output_format="markdown",
        detail_level="comprehensive",
        similarity_threshold=0.8
    )
    
    return await generate_repository_documentation(repository_id, output_file, config)

async def generate_json_documentation(repository_id: str, output_file: Optional[str] = None) -> str:
    """Generate complete documentation in JSON format"""
    
    config = DocumentationConfig(
        include_api_endpoints=True,
        include_service_architecture=True,
        include_code_structure=True,
        include_embeddings_analysis=True,
        include_purpose_analysis=True,
        include_complexity_metrics=True,
        output_format="json",
        detail_level="comprehensive"
    )
    
    return await generate_repository_documentation(repository_id, output_file, config)

async def list_available_repositories() -> None:
    """List all available repositories in the database"""
    
    db_manager = UnifiedDatabaseManager()
    await db_manager.initialize()
    
    try:
        # Query all repositories
        query = "FOR repo IN repositories RETURN {id: repo._key, url: repo.url, name: repo.name, analysis_timestamp: repo.analysis_timestamp}"
        cursor = db_manager.db.aql.execute(query)
        repositories = list(cursor)
        
        if repositories:
            print("📁 Available repositories:")
            print(f"{'ID':<20} {'Name':<30} {'URL':<50} {'Last Analysis'}")
            print("-" * 120)
            
            for repo in repositories:
                repo_id = repo.get('id', 'N/A')[:19]
                name = repo.get('name', 'N/A')[:29]
                url = repo.get('url', 'N/A')[:49]
                timestamp = repo.get('analysis_timestamp', 'N/A')[:19]
                print(f"{repo_id:<20} {name:<30} {url:<50} {timestamp}")
        else:
            print("❌ No repositories found in the database")
    
    finally:
        await db_manager.close()

def create_argument_parser() -> argparse.ArgumentParser:
    """Create command line argument parser"""
    
    parser = argparse.ArgumentParser(
        description="Dynamic Documentation Generator for Code Repositories",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate complete documentation
  python generate_docs.py repo-123 --output docs/repo-123.md
  
  # Generate API documentation only
  python generate_docs.py repo-123 --api-only --output api-docs.md
  
  # Generate service architecture documentation
  python generate_docs.py repo-123 --services-only --output architecture.md
  
  # Generate embeddings analysis
  python generate_docs.py repo-123 --embeddings-only --output embeddings.md
  
  # Generate JSON format
  python generate_docs.py repo-123 --json --output repo-data.json
  
  # List available repositories
  python generate_docs.py --list-repos
        """
    )
    
    parser.add_argument(
        'repository_id',
        nargs='?',
        help='Repository ID to generate documentation for'
    )
    
    parser.add_argument(
        '--output', '-o',
        help='Output file path (default: stdout)'
    )
    
    parser.add_argument(
        '--api-only',
        action='store_true',
        help='Generate API endpoints documentation only'
    )
    
    parser.add_argument(
        '--services-only',
        action='store_true',
        help='Generate service architecture documentation only'
    )
    
    parser.add_argument(
        '--embeddings-only',
        action='store_true',
        help='Generate embeddings and semantic analysis only'
    )
    
    parser.add_argument(
        '--json',
        action='store_true',
        help='Generate documentation in JSON format'
    )
    
    parser.add_argument(
        '--list-repos',
        action='store_true',
        help='List all available repositories'
    )
    
    parser.add_argument(
        '--detail-level',
        choices=['basic', 'detailed', 'comprehensive'],
        default='comprehensive',
        help='Level of detail in documentation (default: comprehensive)'
    )
    
    parser.add_argument(
        '--similarity-threshold',
        type=float,
        default=0.8,
        help='Similarity threshold for embeddings analysis (default: 0.8)'
    )
    
    parser.add_argument(
        '--include-code-samples',
        action='store_true',
        help='Include code samples in documentation'
    )
    
    return parser

async def main():
    """Main CLI interface"""
    
    parser = create_argument_parser()
    args = parser.parse_args()
    
    if args.list_repos:
        await list_available_repositories()
        return
    
    if not args.repository_id:
        parser.error("repository_id is required unless using --list-repos")
    
    try:
        if args.api_only:
            await generate_api_documentation_only(args.repository_id, args.output)
        elif args.services_only:
            await generate_service_architecture_documentation(args.repository_id, args.output)
        elif args.embeddings_only:
            await generate_embeddings_analysis(args.repository_id, args.output)
        elif args.json:
            await generate_json_documentation(args.repository_id, args.output)
        else:
            # Generate complete documentation with custom config
            config = DocumentationConfig(
                include_api_endpoints=True,
                include_service_architecture=True,
                include_code_structure=True,
                include_embeddings_analysis=True,
                include_purpose_analysis=True,
                include_complexity_metrics=True,
                output_format="json" if args.json else "markdown",
                detail_level=args.detail_level,
                similarity_threshold=args.similarity_threshold,
                include_code_samples=args.include_code_samples
            )
            await generate_repository_documentation(args.repository_id, args.output, config)
        
        print("✅ Documentation generation completed successfully!")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
