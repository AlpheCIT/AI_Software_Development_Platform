# AST Graph Schema Enhancement - Quick Start Guide

## 🚀 Overview

The AST Graph Schema Enhancement provides a powerful graph-based approach to code analysis using ArangoDB. This system enables advanced code quality analysis through semantic relationships between code elements.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Dashboard                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Schema Status   │  │ Dead Code       │  │ Coupling        │  │
│  │ Management      │  │ Analysis        │  │ Analysis        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Schema Manager  │  │ Graph Analyzer  │  │ AST Parser      │  │
│  │ API Endpoints   │  │ Utilities       │  │ Integration     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ArangoDB Graph                            │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │   ast_nodes     │◄─────────►│  relationships  │              │
│  │   collection    │           │   collection    │              │
│  └─────────────────┘           └─────────────────┘              │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │   code_files    │           │  repositories   │              │
│  │   collection    │           │   collection    │              │
│  └─────────────────┘           └─────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Setup Instructions

### 1. Database Migration (For Existing Installations)

```bash
# Navigate to the database directory
cd /home/rhelmsjr/Documents/Code/Code_Management_Analyzer/database

# Run the migration script
python migrations/migrate_ast_graph_schema.py
```

### 2. New Installation Setup

```bash
# The schema will be automatically created when the API starts
# OR manually setup via API
curl -X POST http://localhost:8002/api/ast/setup-schema
```

### 3. Verify Installation

```bash
# Check schema status
curl http://localhost:8002/api/ast/schema-status
```

## 📊 Features

### 🔍 Dead Code Detection
Identifies potentially unused functions and classes:
- Functions with no incoming calls
- Unused imports and variables
- Orphaned code blocks

### 📈 Coupling Analysis
Measures code coupling through:
- **Fan-in**: Number of dependencies on a component
- **Fan-out**: Number of dependencies from a component  
- **Coupling Score**: Combined metric for maintainability

### 🕸️ Dependency Tracking
Maps function and module dependencies:
- Direct function calls
- Import relationships
- Cross-file dependencies

## 🎛️ Dashboard Usage

### Accessing the Dashboard
1. Navigate to `http://localhost:3002/ast-graph`
2. Click "Setup Schema" if first time
3. Use the analysis tabs for different insights

### Schema Status Tab
- View database connection status
- Check collection and index counts
- Monitor graph health

### Dead Code Analysis
1. Optionally filter by repository
2. Click "Find Dead Code"
3. Review unused functions with complexity scores

### Coupling Metrics
1. Set coupling threshold (default: 5)
2. Click "Analyze Coupling" 
3. Identify highly coupled components

### Function Dependencies
1. Enter a function key (e.g., `func_calculateMetrics_main_py_42`)
2. Click "Analyze Dependencies"
3. Explore the dependency tree

## 🔌 API Reference

### Schema Management
```bash
# Setup enhanced schema
POST /api/ast/setup-schema

# Get schema status
GET /api/ast/schema-status
```

### Analysis Endpoints
```bash
# Find dead code
GET /api/ast/dead-code?repository_id=optional

# Get coupling metrics
GET /api/ast/coupling-metrics?threshold=5

# Get function dependencies
GET /api/ast/function-dependencies/{function_key}?max_depth=3
```

### Data Management
```bash
# Create AST node
POST /api/ast/nodes
Content-Type: application/json
{
  "type": "FunctionDeclaration",
  "name": "myFunction",
  "file_path": "src/main.py",
  "repository_id": "repo-001",
  "language": "python"
}

# Create relationship
POST /api/ast/relationships
Content-Type: application/json
{
  "_from": "ast_nodes/func1",
  "_to": "ast_nodes/func2", 
  "relationship_type": "calls"
}
```

## 📈 Performance Optimization

### Query Performance
- All graph traversals optimized for < 100ms response
- 18 specialized indexes for different query patterns
- Efficient AQL queries for complex analysis

### Scalability
- Handles repositories with 10,000+ functions
- Supports multi-language codebases
- Incremental analysis capabilities

## 🧪 Example Queries

### Find All Functions Called by Main
```aql
FOR node IN ast_nodes
FILTER node.name == "main" AND node.type == "FunctionDeclaration"
FOR v, e IN 1..3 OUTBOUND node relationships
FILTER e.relationship_type == "calls"
RETURN v.name
```

### Identify High-Risk Refactoring Targets
```aql
FOR node IN ast_nodes
FILTER node.type == "FunctionDeclaration"
LET complexity = node.complexity.cyclomatic
LET coupling = LENGTH(FOR v, e IN 1..1 ANY node relationships RETURN 1)
FILTER complexity > 10 AND coupling > 8
RETURN {function: node.name, complexity, coupling, risk: "high"}
```

### Find Circular Dependencies
```aql
FOR file1 IN code_files
FOR file2 IN 2..5 OUTBOUND file1 relationships
FILTER file1._key == file2._key
RETURN {cycle: file1.file_path, depth: LENGTH(path)}
```

## 🐛 Troubleshooting

### Common Issues

**Schema Not Found**
```bash
# Ensure ArangoDB is running
docker ps | grep arangodb

# Run setup manually
curl -X POST http://localhost:8002/api/ast/setup-schema
```

**No Analysis Data**
- AST nodes are populated during repository analysis
- Run a repository analysis first to generate data
- Check `/repositories` page to trigger analysis

**Slow Queries**
- Verify indexes are created: Check schema status
- Monitor query patterns in ArangoDB web interface
- Consider adjusting query depth limits

### Logging
```bash
# Check API logs for schema operations
tail -f /var/log/code-analyzer/api.log | grep "ast"

# Monitor ArangoDB logs
tail -f /var/log/arangodb/arangodb.log
```

## 🔗 Integration Points

### Repository Analysis Pipeline
- AST data populated during code analysis
- Automatic relationship detection
- Multi-language parser integration

### Technical Debt Scoring
- Coupling metrics feed into debt calculations
- Dead code detection reduces false positives
- Dependency complexity affects maintainability scores

### Code Search Enhancement
- Semantic relationships improve search relevance
- Function call graphs enable better code discovery
- Cross-reference analysis for impact assessment

## 📚 Further Reading

- [ArangoDB Graph Traversal Documentation](https://www.arangodb.com/docs/stable/aql/graphs.html)
- [AST Analysis Best Practices](../docs/ast-analysis-guide.md)
- [Performance Tuning Guide](../docs/performance-optimization.md)
