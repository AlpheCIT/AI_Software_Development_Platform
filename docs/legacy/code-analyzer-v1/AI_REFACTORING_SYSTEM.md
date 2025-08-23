# AI-Powered Code Refactoring System

## Overview

The AI-Powered Code Refactoring System is an advanced code analysis and refactoring recommendation engine that uses multi-dimensional embeddings and semantic analysis to identify refactoring opportunities. This system goes beyond simple pattern matching to understand the **purpose** and **intent** behind code, enabling intelligent suggestions for consolidation, extraction, and architectural improvements.

## Architecture

### Core Components

1. **Purpose Extractor** (`services/purpose_extractor.py`)
   - Analyzes code to understand its semantic purpose and business intent
   - Uses pattern matching to classify code into operations like validation, transformation, persistence, etc.
   - Provides confidence scores and evidence for classifications

2. **Multi-Dimensional Embedding Generator** (`services/embedding_generator.py`)
   - Generates four types of embeddings for each code unit:
     - **Purpose embeddings**: Based on semantic intent using sentence transformers
     - **Code structure embeddings**: Based on AST patterns and complexity metrics
     - **Context embeddings**: Based on usage patterns and dependencies
     - **Domain embeddings**: Based on business domain classification

3. **Enhanced AST Parser** (`services/enhanced_ast_parser.py`)
   - Extends basic AST parsing with AI-powered analysis
   - Integrates purpose extraction and embedding generation
   - Calculates enhanced metrics and relationships

4. **Similarity Engine** (`services/similarity_engine.py`)
   - Computes multi-dimensional similarity between code units
   - Identifies duplicate logic and refactoring candidates
   - Finds architectural inconsistencies

5. **Refactoring Decision Engine** (`services/refactoring_engine.py`)
   - Makes intelligent refactoring recommendations
   - Provides impact analysis and effort estimation
   - Prioritizes opportunities based on potential value

### Database Schema

The system extends the existing ArangoDB schema with:

- **Enhanced `codeunits` collection**: Includes embeddings, purpose analysis, and enhanced metrics
- **`similarity_cache`**: Caches similarity computation results
- **`refactoring_opportunities`**: Stores identified refactoring opportunities
- **`similarity_groups`**: Groups of similar code units
- **`purpose_patterns`**: Learned patterns for purpose extraction
- **Enhanced graphs**: For similarity and refactoring analysis

## Key Features

### 1. Purpose-Based Analysis

The system understands **why** code exists, not just **what** it does:

```python
# Example: Both functions have similar purpose (validation) despite different implementation
def validate_email(email):
    return "@" in email and "." in email

def check_user_input(input_str):
    if not input_str or len(input_str) < 3:
        return False
    return True
```

### 2. Multi-Dimensional Similarity

Combines multiple similarity dimensions:
- **Purpose similarity**: Do they solve the same business problem?
- **Code similarity**: Do they have similar structure and complexity?
- **Context similarity**: Are they used in similar ways?
- **Domain similarity**: Do they belong to the same business domain?

### 3. Intelligent Refactoring Strategies

- **Extract Function**: For small groups with high similarity
- **Consolidate Duplicates**: For nearly identical implementations
- **Extract Class**: For larger groups in the same domain
- **Introduce Interface**: For architectural inconsistencies

### 4. Risk Assessment and Impact Analysis

Each refactoring opportunity includes:
- Risk level assessment (low, medium, high)
- Effort estimation (hours breakdown)
- Potential savings (LOC reduction, complexity improvement)
- Mitigation strategies

## API Endpoints

### Refactoring Analysis

#### `POST /api/v1/refactoring/analyze`
Analyze code for refactoring opportunities.

**Request:**
```json
{
  "scope": "global",
  "target_path": "/path/to/specific/module",
  "refactoring_types": ["extract_function", "consolidate_duplicates"],
  "similarity_threshold": 0.8,
  "max_suggestions": 50,
  "include_impact_analysis": true
}
```

**Response:**
```json
[
  {
    "id": "extract_func_abc123",
    "type": "extract_function",
    "priority": "high",
    "title": "Extract common validation logic from 4 functions",
    "description": "Extract shared validation logic from 4 functions with 87% similarity",
    "affected_files": ["validators.py", "forms.py"],
    "estimated_effort": "low",
    "potential_savings": {
      "lines_of_code_reduction": 45,
      "complexity_reduction": 1.2,
      "maintenance_burden_reduction": 1.6
    },
    "risk_level": "low",
    "implementation_strategy": "1. Analyze common patterns...",
    "ai_analysis": {
      "similarity_type": "purpose_based",
      "confidence": 0.87,
      "evidence": ["validation_naming", "early_return_pattern"]
    }
  }
]
```

#### `POST /api/v1/refactoring/impact-analysis`
Get detailed impact analysis for a specific refactoring opportunity.

### Similarity Analysis

#### `POST /api/v1/similarity/analyze`
Find code units similar to a specific target.

**Request:**
```json
{
  "target_node_id": "function_validate_email_abc123",
  "similarity_threshold": 0.8,
  "max_results": 10,
  "embedding_types": ["purpose", "code", "context", "domain"]
}
```

### Code Analysis

#### `POST /api/v1/code/purpose-analysis`
Analyze the semantic purpose of code.

**Request:**
```json
{
  "file_path": "/path/to/file.py",
  "code_content": "def validate_email(email): ...",
  "analysis_level": "function"
}
```

### Utility Endpoints

#### `GET /api/v1/refactoring/duplicates`
Find duplicate code across the codebase.

#### `GET /api/v1/refactoring/architectural-inconsistencies`
Find architectural inconsistencies.

#### `GET /api/v1/refactoring/system-status`
Get system health and component status.

## Configuration

The system is highly configurable through environment variables:

### Embedding Configuration
```bash
# Purpose embeddings
PURPOSE_EMBEDDING_MODEL=all-MiniLM-L6-v2
PURPOSE_EMBEDDING_DIM=384
CACHE_PURPOSE_EMBEDDINGS=true

# Code structure embeddings
CODE_EMBEDDING_DIM=256
CODE_FEATURE_ENGINEERING=true

# Context embeddings
CONTEXT_EMBEDDING_DIM=256
INCLUDE_FILE_METRICS=true

# Domain embeddings
DOMAIN_EMBEDDING_DIM=128
```

### Similarity Analysis
```bash
# Thresholds
SIMILARITY_PURPOSE_THRESHOLD=0.85
SIMILARITY_CODE_THRESHOLD=0.7
SIMILARITY_COMBINED_THRESHOLD=0.75

# Weights (must sum to 1.0)
SIMILARITY_PURPOSE_WEIGHT=0.4
SIMILARITY_CODE_WEIGHT=0.3
SIMILARITY_CONTEXT_WEIGHT=0.2
SIMILARITY_DOMAIN_WEIGHT=0.1
```

### Performance Settings
```bash
ENABLE_PARALLEL_PROCESSING=true
MAX_WORKERS=4
ANALYSIS_BATCH_SIZE=10
MEMORY_LIMIT_MB=2048
```

## Installation and Setup

### 1. Install Dependencies

```bash
# Core AI libraries
pip install sentence-transformers scikit-learn numpy torch

# Optional: GPU support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Or install from requirements file
pip install -r api/requirements-ai-refactoring.txt
```

### 2. Database Setup

```python
from database.enhanced_ast_graph_schema import EnhancedASTGraphSchemaManager

# Initialize enhanced schema
schema_manager = EnhancedASTGraphSchemaManager()
result = schema_manager.setup_enhanced_schema()
print(f"Schema setup: {'success' if result['success'] else 'failed'}")
```

### 3. Environment Configuration

```bash
# Copy example configuration
cp .env.example .env

# Add AI refactoring settings
echo "# AI Refactoring System" >> .env
echo "PURPOSE_EMBEDDING_MODEL=all-MiniLM-L6-v2" >> .env
echo "SIMILARITY_PURPOSE_THRESHOLD=0.85" >> .env
# ... add other settings
```

### 4. Verify Installation

```bash
curl http://localhost:8002/api/v1/refactoring/system-status
```

Expected response:
```json
{
  "ai_refactoring_available": true,
  "components": {
    "similarity_engine": true,
    "refactoring_engine": true,
    "enhanced_ast_parser": true
  },
  "database_status": "connected"
}
```

## Usage Examples

### 1. Analyze Repository for Refactoring Opportunities

```python
import requests

response = requests.post(
    "http://localhost:8002/api/v1/refactoring/analyze",
    json={
        "scope": "global",
        "similarity_threshold": 0.8,
        "max_suggestions": 20
    }
)

opportunities = response.json()
for opp in opportunities:
    print(f"{opp['priority']}: {opp['title']}")
    print(f"  Files: {', '.join(opp['affected_files'])}")
    print(f"  Effort: {opp['estimated_effort']}")
    print(f"  Risk: {opp['risk_level']}")
    print()
```

### 2. Find Similar Functions

```python
response = requests.post(
    "http://localhost:8002/api/v1/similarity/analyze",
    json={
        "target_node_id": "function_validate_user_input_abc123",
        "similarity_threshold": 0.7
    }
)

similar_functions = response.json()
for func in similar_functions:
    print(f"Similarity: {func['combined_score']:.2f}")
    print(f"  Purpose: {func['similarity_scores']['purpose']:.2f}")
    print(f"  Code: {func['similarity_scores']['code']:.2f}")
    print(f"  Evidence: {', '.join(func['evidence'])}")
```

### 3. Analyze Code Purpose

```python
code_content = """
def validate_email(email):
    if not email or '@' not in email:
        raise ValueError("Invalid email format")
    return True
"""

response = requests.post(
    "http://localhost:8002/api/v1/code/purpose-analysis",
    json={
        "file_path": "validators.py",
        "code_content": code_content
    }
)

analysis = response.json()
for result in analysis['analysis_results']:
    purpose = result['purpose_analysis']
    print(f"Function: {result['node_name']}")
    print(f"Intent: {purpose['intent']}")
    print(f"Operation: {purpose['operation_type']}")
    print(f"Domain: {purpose['domain']}")
    print(f"Confidence: {purpose['confidence_score']:.2f}")
```

## Performance Considerations

### Memory Usage
- Purpose embeddings: ~1.5KB per function (384-dim)
- Code embeddings: ~1KB per function (256-dim)
- Total: ~3KB per function for all embeddings

### Processing Speed
- Purpose extraction: ~10ms per function
- Embedding generation: ~5ms per function
- Similarity computation: ~1ms per comparison (cached)

### Scaling Recommendations
- For large codebases (>10K functions):
  - Enable parallel processing
  - Use embedding caching
  - Consider incremental analysis
  - Monitor memory usage

## Troubleshooting

### Common Issues

1. **ImportError: sentence_transformers not found**
   ```bash
   pip install sentence-transformers
   ```

2. **Out of memory during embedding generation**
   - Reduce batch size: `ANALYSIS_BATCH_SIZE=5`
   - Increase memory limit: `MEMORY_LIMIT_MB=4096`
   - Enable caching: `CACHE_PURPOSE_EMBEDDINGS=true`

3. **Slow similarity computation**
   - Enable parallel processing: `ENABLE_PARALLEL_PROCESSING=true`
   - Increase similarity cache TTL: `SIMILARITY_CACHE_TTL=48`

4. **Poor refactoring suggestions**
   - Adjust similarity thresholds
   - Check purpose extraction confidence scores
   - Verify domain keyword mappings

### Debug Mode

Enable debug mode for detailed logging:
```bash
AI_REFACTORING_DEBUG=true
SAVE_INTERMEDIATE_RESULTS=true
DEBUG_OUTPUT_DIR=./debug_output
```

### Performance Profiling

```bash
PROFILE_PERFORMANCE=true
ENABLE_AI_METRICS=true
METRICS_INTERVAL_SECONDS=30
```

## Extending the System

### Adding New Purpose Patterns

```python
class CustomPatternMatcher(PatternMatcher):
    def match(self, ast_node: ast.AST, context: Dict[str, Any]) -> float:
        # Custom pattern matching logic
        return confidence_score
    
    def get_evidence(self) -> List[str]:
        return ["custom_evidence"]

# Register with purpose extractor
purpose_extractor.intent_classifiers['custom'] = CustomPatternMatcher()
```

### Adding New Refactoring Strategies

```python
class CustomRefactoringStrategy(RefactoringStrategy):
    def can_apply(self, opportunity_data: Dict[str, Any]) -> bool:
        # Check if strategy applies
        return True
    
    def create_opportunity(self, data: Dict[str, Any]) -> RefactoringOpportunity:
        # Create refactoring opportunity
        return opportunity

# Register with strategy registry
strategy_registry.strategies[RefactoringType.CUSTOM] = CustomRefactoringStrategy()
```

### Custom Domain Classification

```python
# Add to ai_refactoring_config.py
def _get_domain_keywords(self) -> Dict[str, List[str]]:
    keywords = super()._get_domain_keywords()
    keywords['custom_domain'] = ['keyword1', 'keyword2', 'keyword3']
    return keywords
```

## Contributing

1. **Code Style**: Follow existing patterns and include type hints
2. **Testing**: Add tests for new pattern matchers and strategies
3. **Documentation**: Update this README and add docstrings
4. **Performance**: Consider memory and CPU impact of changes

## License

This AI-Powered Code Refactoring System is part of the Code Management Analyzer project and follows the same license terms.
