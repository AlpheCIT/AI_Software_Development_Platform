#!/usr/bin/env python3
"""
Dynamic Documentation Generator - CLI Interface
"""

import asyncio
import argparse
import json
import sys
import os
from pathlib import Path
from typing import Optional

# Add the parent directories to Python path to import our modules
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

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
    
    print(f"🔍 Generating documentation for repository: {repository_id}")
    
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
        
        print(f"📊 Configuration: {config.output_format} format, {config.detail_level} detail level")
        
        # Generate documentation
        documentation = await doc_generator.generate_complete_documentation(
            repository_id, 
            config
        )
        
        if isinstance(documentation, dict) and not documentation.get('success', True):
            print(f"❌ Documentation generation failed: {documentation.get('error', 'Unknown error')}")
            return ""
        
        # Get content based on format
        if config.output_format == "markdown":
            content = documentation if isinstance(documentation, str) else str(documentation)
        else:
            content = json.dumps(documentation, indent=2, default=str)
        
        # Save to file if specified
        if output_file:
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✅ Documentation saved to: {output_path}")
            print(f"📏 File size: {len(content):,} characters")
        else:
            print("📄 Generated documentation:")
            print(content)
        
        return content
        
    except Exception as e:
        print(f"❌ Error generating documentation: {str(e)}")
        import traceback
        traceback.print_exc()
        return ""
    
    finally:
        await db_manager.close()

def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure argument parser"""
    
    parser = argparse.ArgumentParser(
        description="Generate dynamic documentation for code repositories",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate markdown documentation for a repository
  python generate_docs.py --repository-id 2649150 --output-format markdown
  
  # Save documentation to file
  python generate_docs.py --repository-id 2649150 --output docs/repo_analysis.md
  
  # Generate JSON format with detailed analysis
  python generate_docs.py --repository-id 2649150 --output-format json --detail-level comprehensive
  
  # Generate only API endpoints documentation
  python generate_docs.py --repository-id 2649150 --sections api_endpoints
        """
    )
    
    parser.add_argument(
        '--repository-id', 
        type=str, 
        required=True,
        help='Repository ID to generate documentation for'
    )
    
    parser.add_argument(
        '--output-format', 
        choices=['markdown', 'json', 'html'],
        default='markdown',
        help='Output format (default: markdown)'
    )
    
    parser.add_argument(
        '--detail-level',
        choices=['basic', 'detailed', 'comprehensive'], 
        default='comprehensive',
        help='Level of detail in documentation (default: comprehensive)'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        help='Output file path (if not specified, prints to stdout)'
    )
    
    parser.add_argument(
        '--sections',
        nargs='+',
        choices=['api_endpoints', 'service_architecture', 'code_structure', 
                'embeddings_analysis', 'purpose_analysis', 'complexity_metrics'],
        help='Specific sections to include (default: all sections)'
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
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    return parser

def main():
    """Main CLI entry point"""
    
    parser = create_argument_parser()
    args = parser.parse_args()
    
    if args.verbose:
        print(f"🚀 Starting documentation generation with arguments: {vars(args)}")
    
    # Create configuration from arguments
    config = DocumentationConfig(
        include_api_endpoints='api_endpoints' in (args.sections or ['api_endpoints']),
        include_service_architecture='service_architecture' in (args.sections or ['service_architecture']),
        include_code_structure='code_structure' in (args.sections or ['code_structure']),
        include_embeddings_analysis='embeddings_analysis' in (args.sections or ['embeddings_analysis']),
        include_purpose_analysis='purpose_analysis' in (args.sections or ['purpose_analysis']),
        include_complexity_metrics='complexity_metrics' in (args.sections or ['complexity_metrics']),
        output_format=args.output_format,
        detail_level=args.detail_level,
        similarity_threshold=args.similarity_threshold,
        include_code_samples=args.include_code_samples
    )
    
    # If sections were specified, only include those
    if args.sections:
        all_sections = ['api_endpoints', 'service_architecture', 'code_structure', 
                       'embeddings_analysis', 'purpose_analysis', 'complexity_metrics']
        
        for section in all_sections:
            if section not in args.sections:
                setattr(config, f'include_{section}', False)
    
    # Run the async documentation generation
    try:
        result = asyncio.run(generate_repository_documentation(
            repository_id=args.repository_id,
            output_file=args.output,
            config=config
        ))
        
        if result:
            print("✅ Documentation generation completed successfully!")
            sys.exit(0)
        else:
            print("❌ Documentation generation failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Documentation generation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
