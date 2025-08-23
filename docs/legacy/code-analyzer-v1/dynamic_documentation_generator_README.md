# Dynamic Documentation Generator

A comprehensive system for automatically generating documentation from analyzed code repositories stored in ArangoDB. This system leverages AST nodes, embeddings, and natural language descriptions to create detailed, accurate documentation.

## Features

- **🔍 API Endpoint Discovery**: Automatically detects and documents REST API endpoints
- **🏗️ Service Architecture Analysis**: Maps service dependencies and architecture patterns
- **📊 Code Structure Documentation**: Analyzes file organization and component relationships
- **🧠 Semantic Analysis**: Uses embeddings to find similar code patterns and purposes
- **⚡ Complexity Metrics**: Identifies code complexity hotspots and technical debt
- **📝 Multiple Output Formats**: Supports Markdown, JSON, and HTML output
- **🎯 Customizable Configuration**: Fine-tune what gets documented and how
- **🔗 API Integration**: RESTful endpoints for web application integration

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │◄──►│  FastAPI Backend │◄──►│   ArangoDB      │
│   React App     │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Documentation    │
                       │ Generator        │
                       │                  │
                       │ • AST Analysis   │
                       │ • Embeddings     │
                       │ • NL Descriptions│
                       └──────────────────┘
```

## Installation & Setup

### Prerequisites

- Python 3.8+
- ArangoDB with analyzed repositories
- FastAPI backend (existing Code Management Analyzer)

### Installation

1. **Copy the core files to your project**:
   ```bash
   # Copy the documentation generator
   cp core/dynamic_documentation_generator.py /your/project/core/
   
   # Copy the API router
   cp api/routers/documentation.py /your/project/api/routers/
   
   # Copy utility scripts
   cp scripts/generate_docs.py /your/project/scripts/
   cp scripts/documentation_examples.py /your/project/scripts/
   ```

2. **Install dependencies** (if not already installed):
   ```bash
   pip install fastapi pydantic python-arango pathlib
   ```

3. **Add to your FastAPI app**:
   ```python
   # In your main FastAPI app file (e.g., api/app.py)
   from api.routers.documentation import docs_router
   
   app.include_router(docs_router)
   ```

## Usage

### 1. Command Line Interface

#### Basic Documentation Generation
```bash
# Generate complete documentation for a repository
python scripts/generate_docs.py repo-123 --output docs/repo-123.md

# Generate API documentation only
python scripts/generate_docs.py repo-123 --api-only --output api-docs.md

# Generate service architecture documentation
python scripts/generate_docs.py repo-123 --services-only --output architecture.md

# Generate embeddings analysis
python scripts/generate_docs.py repo-123 --embeddings-only --output embeddings.md

# Generate JSON format
python scripts/generate_docs.py repo-123 --json --output repo-data.json

# List available repositories
python scripts/generate_docs.py --list-repos
```

#### Advanced Options
```bash
# Custom detail level and similarity threshold
python scripts/generate_docs.py repo-123 \
  --detail-level comprehensive \
  --similarity-threshold 0.75 \
  --include-code-samples \
  --output detailed-docs.md
```

### 2. Python API

#### Basic Usage
```python
import asyncio
from core.dynamic_documentation_generator import (
    DynamicRepositoryDocumentationGenerator,
    DocumentationConfig
)
from core.database_manager import UnifiedDatabaseManager

async def generate_docs():
    # Initialize
    db_manager = UnifiedDatabaseManager()
    await db_manager.initialize()
    
    doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
    
    # Generate documentation
    config = DocumentationConfig(
        include_api_endpoints=True,
        include_service_architecture=True,
        output_format="markdown"
    )
    
    docs = await doc_generator.generate_complete_documentation(
        "your-repo-id", config
    )
    
    # Save to file
    with open("documentation.md", "w") as f:
        f.write(docs)
    
    await db_manager.close()

asyncio.run(generate_docs())
```

#### Custom Configuration Examples
```python
# API-only documentation
api_config = DocumentationConfig(
    include_api_endpoints=True,
    include_service_architecture=False,
    include_code_structure=False,
    output_format="markdown",
    detail_level="detailed"
)

# Service architecture focus
architecture_config = DocumentationConfig(
    include_service_architecture=True,
    include_complexity_metrics=True,
    include_code_structure=True,
    output_format="json",
    detail_level="comprehensive"
)

# Embeddings analysis
embeddings_config = DocumentationConfig(
    include_embeddings_analysis=True,
    include_purpose_analysis=True,
    similarity_threshold=0.8,
    output_format="markdown"
)
```

### 3. REST API Endpoints

#### Generate Complete Documentation
```bash
curl -X POST "http://localhost:8002/api/v1/documentation/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": "repo-123",
    "include_api_endpoints": true,
    "include_service_architecture": true,
    "output_format": "markdown",
    "detail_level": "comprehensive"
  }'
```

#### Get Markdown Documentation (Simple)
```bash
curl "http://localhost:8002/api/v1/documentation/generate/repo-123?include_api=true&include_services=true" \
  -H "Accept: text/markdown"
```

#### List Available Repositories
```bash
curl "http://localhost:8002/api/v1/documentation/repositories"
```

#### Specialized Documentation
```bash
# API endpoints only
curl "http://localhost:8002/api/v1/documentation/api-endpoints/repo-123?format=json"

# Service architecture only
curl "http://localhost:8002/api/v1/documentation/service-architecture/repo-123?format=markdown"

# Embeddings analysis
curl "http://localhost:8002/api/v1/documentation/embeddings-analysis/repo-123?similarity_threshold=0.8"

# Complexity analysis
curl "http://localhost:8002/api/v1/documentation/complexity-analysis/repo-123"
```

## Configuration Options

### DocumentationConfig Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_api_endpoints` | bool | True | Include API endpoint analysis |
| `include_service_architecture` | bool | True | Include service architecture mapping |
| `include_code_structure` | bool | True | Include code structure analysis |
| `include_embeddings_analysis` | bool | True | Include semantic similarity analysis |
| `include_purpose_analysis` | bool | True | Include code purpose analysis |
| `include_complexity_metrics` | bool | True | Include complexity and hotspot analysis |
| `output_format` | str | "markdown" | Output format: "markdown", "json", "html" |
| `detail_level` | str | "comprehensive" | Detail level: "basic", "detailed", "comprehensive" |
| `similarity_threshold` | float | 0.8 | Similarity threshold for embeddings analysis |
| `include_code_samples` | bool | False | Include code samples in documentation |

## Output Examples

### API Endpoints Documentation

```markdown
## API Endpoints

**Total Endpoints:** 15
**Frameworks Detected:** FastAPI

### Security Analysis
- **Authenticated Endpoints:** 10
- **Public Endpoints:** 5
- **Security Score:** High

### Endpoint Details

| Endpoint | Method | Route | Description | Auth | Complexity | File | Lines |
|----------|--------|-------|-------------|------|------------|------|-------|
| `get_repositories` | GET | `/api/repositories` | List all repositories | ❌ | 2 | `api.py` | 45-67 |
| `create_repository` | POST | `/api/repositories` | Create new repository | ✅ | 4 | `api.py` | 69-95 |
```

### Service Architecture Documentation

```markdown
## Service Architecture

**Total Services:** 6

### Technology Stack
- **Frameworks:** FastAPI, React
- **Databases:** ArangoDB, PostgreSQL
- **Libraries:** SentenceTransformers, OpenAI

### Service Breakdown

| Service Type | Files | Components | Complexity | Description |
|--------------|-------|------------|------------|-------------|
| API Service | 8 | 25 | 45 | Service containing 15 classes, 10 functions with medium complexity |
| Database Service | 4 | 12 | 28 | Service containing 8 classes, 4 functions with low complexity |
```

### Embeddings Analysis

```markdown
## Embeddings & Semantic Analysis

**Total Embeddings:** 1,247

### Embedding Types
- **function**: 456 embeddings
- **class**: 234 embeddings
- **method**: 557 embeddings

### Similarity Groups

| Group Type | Count | Similarity | Sample Files |
|------------|-------|------------|-------------|
| function_.py | 23 | 0.87 | utils.py, helpers.py, tools.py |
| class_.py | 15 | 0.82 | models.py, schemas.py, entities.py |
```

## Examples and Demonstrations

Run the comprehensive examples:

```bash
# Run all examples
python scripts/documentation_examples.py

# Run specific example
python scripts/documentation_examples.py 1 repo-123

# Available examples:
# 1. Complete documentation
# 2. API documentation only
# 3. Service architecture analysis
# 4. Embeddings similarity analysis
# 5. Complexity hotspots analysis
# 6. Custom minimal documentation
# 7. HTML output format
# 8. Repository comparison
```

## Integration with Your Application

### Frontend Integration

Add these components to your React frontend:

```jsx
// Documentation generator component
const DocumentationGenerator = ({ repositoryId }) => {
  const [config, setConfig] = useState({
    include_api_endpoints: true,
    include_service_architecture: true,
    output_format: "markdown"
  });
  
  const generateDocs = async () => {
    const response = await fetch('/api/v1/documentation/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repository_id: repositoryId,
        ...config
      })
    });
    
    const result = await response.json();
    // Handle documentation result
  };
  
  return (
    <div>
      {/* Configuration UI */}
      {/* Generate button */}
      {/* Documentation display */}
    </div>
  );
};
```

### Backend Service Integration

```python
# Add to your existing FastAPI app
from api.routers.documentation import docs_router

app.include_router(docs_router)

# Or integrate directly into existing routes
@app.post("/api/repositories/{repository_id}/docs")
async def generate_repo_docs(repository_id: str):
    doc_generator = DynamicRepositoryDocumentationGenerator(db_manager)
    return await doc_generator.generate_complete_documentation(repository_id)
```

## Database Requirements

The documentation generator expects these ArangoDB collections:

- **repositories**: Repository metadata
- **ast_nodes**: AST analysis results with embeddings
- **code_files**: File information
- **embedding_metadata**: Embedding vectors and metadata
- **codeunits**: Enhanced code analysis results
- **relationships**: Code relationship mappings

## Troubleshooting

### Common Issues

1. **"Repository not found" error**:
   ```bash
   # List available repositories first
   python scripts/generate_docs.py --list-repos
   ```

2. **Missing AST data**:
   - Ensure repository has been analyzed with your AST parser
   - Check that ast_nodes collection has data for the repository

3. **Empty embeddings analysis**:
   - Verify embedding_metadata collection has data
   - Check that embeddings were generated during analysis

4. **API endpoints not detected**:
   - Ensure your code uses standard API framework patterns
   - Check function decorators and naming conventions

### Debug Mode

Enable detailed logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# The generator will output detailed analysis information
```

## Contributing

To extend the documentation generator:

1. **Add new analysis types**: Extend the `_generate_*_documentation` methods
2. **Support new frameworks**: Update the `api_patterns` and `service_patterns` dictionaries
3. **Custom output formats**: Implement new `_format_as_*` methods
4. **Enhanced detectors**: Improve the `_is_api_endpoint` and classification methods

## Performance Notes

- **Large repositories**: Use `detail_level="basic"` for faster generation
- **Memory usage**: Adjust similarity thresholds to reduce memory consumption
- **Database queries**: The generator uses optimized AQL queries with proper indexing
- **Caching**: Consider caching documentation for frequently accessed repositories

## License

This dynamic documentation generator is part of the Code Management Analyzer project and follows the same licensing terms.
