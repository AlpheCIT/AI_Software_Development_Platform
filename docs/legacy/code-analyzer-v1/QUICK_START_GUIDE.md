# 🚀 Quick Start Guide - Dynamic Code Analysis Implementation

## Overview

This guide helps developers quickly get started with implementing the dynamic code analysis features outlined in the project Kanban board.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Streamlit Frontend                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Repository      │  │ Metrics         │  │ Project         │  │
│  │ Analysis        │  │ Dashboard       │  │ Management      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Multi-Language  │  │ Metrics         │  │ Analysis        │  │
│  │ Parser          │  │ Calculator      │  │ Pipeline        │  │
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
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Development Environment Setup

### Prerequisites
```bash
# Required software
- Python 3.9+
- Node.js 16+
- Docker & Docker Compose
- Git
```

### Setup Steps

1. **Clone and Setup Repository**
```bash
git clone <repository-url>
cd Streamlit_Code_Analyzer
```

2. **Start ArangoDB**
```bash
docker-compose up -d arangodb
```

3. **Install Python Dependencies**
```bash
pip install -r requirements.txt
pip install streamlit pandas plotly arangojs babel
```

4. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

5. **Initialize Database**
```bash
python -c "
from backend.database import ArangoDBService
from backend.config import load_config
config = load_config()
db = ArangoDBService(config)
print('Database initialized!')
"
```

6. **Start Development Server**
```bash
streamlit run app.py
```

## 📋 Current Implementation Status

### ✅ Already Implemented
- Basic Streamlit app structure
- ArangoDB connection and basic collections
- Repository cloning and basic analysis
- Code search functionality
- Jira integration
- System status monitoring

### 🚧 In Development
- Project Kanban board (just added!)
- Multi-language AST parsing
- Advanced metrics calculation
- Graph-based analysis

### 📝 To Be Implemented
- Dead code detection
- Security risk assessment
- Interactive visualizations
- Real-time analysis updates

## 🎯 Sprint 1 Priorities (Current)

### INFRA-001: Multi-Language AST Parser
**Owner:** Backend Developer  
**Priority:** Critical

**Files to Create/Modify:**
```
backend/parsers/
├── __init__.py
├── base_parser.py
├── javascript_parser.py
├── typescript_parser.py
├── python_parser.py
└── unified_ast.py
```

**Key Implementation:**
```python
# backend/parsers/base_parser.py
from abc import ABC, abstractmethod
from typing import Dict, List, Any

class BaseParser(ABC):
    @abstractmethod
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Parse file content and return unified AST structure."""
        pass
    
    @abstractmethod
    def extract_nodes_and_edges(self, ast: Any) -> Dict[str, List]:
        """Extract nodes and relationships from AST."""
        pass
```

### INFRA-002: Database Schema Enhancement
**Owner:** Data Engineer  
**Priority:** Critical

**Schema Updates:**
```python
# backend/database.py - Add new collections
def setup_enhanced_collections(self):
    """Setup collections for AST-based analysis."""
    
    # AST Nodes Collection
    if not self.db.has_collection('ast_nodes'):
        self.db.create_collection('ast_nodes')
        
    # Relationships Collection  
    if not self.db.has_collection('relationships'):
        self.db.create_collection('relationships', edge=True)
        
    # Create graph
    if not self.db.has_graph('code_graph'):
        self.db.create_graph('code_graph', [
            {
                'edge_collection': 'relationships',
                'from_vertex_collections': ['ast_nodes'],
                'to_vertex_collections': ['ast_nodes']
            }
        ])
```

## 📊 Key Metrics to Implement

### Dead Code Detection
```python
# Example AQL query for orphaned functions
orphaned_functions_query = """
FOR node IN ast_nodes
  FILTER node.type == "FunctionDeclaration"
  LET incoming = (
    FOR v IN 1..10 INBOUND node relationships 
    RETURN v
  )
  FILTER LENGTH(incoming) == 0 AND node.name != "main"
  RETURN {
    name: node.name,
    file: node.file_path,
    line: node.line_start
  }
"""
```

### Complexity Analysis
```python
# Cyclomatic complexity calculation
complexity_query = """
FOR node IN ast_nodes
  FILTER node.type == "FunctionDeclaration"
  LET decision_points = (
    FOR v IN 1..10 OUTBOUND node relationships
      FILTER v.type IN ["IfStatement", "WhileLoop", "ForLoop", 
                       "SwitchStatement", "ConditionalExpression"]
      RETURN 1
  )
  LET complexity = LENGTH(decision_points) + 1
  RETURN {
    function: node.name,
    complexity: complexity,
    risk: complexity > 15 ? "high" : "low"
  }
"""
```

## 🎨 Dashboard Implementation

### Current Structure
```
app.py (main Streamlit app)
├── Repository Analysis (existing)
├── Code Search (existing) 
├── Jira Integration (existing)
├── Project Management (✨ new!)
└── System Status (existing)
```

### Adding New Metrics Pages

1. **Create metrics module:**
```python
# backend/metrics/
├── __init__.py
├── dead_code.py
├── complexity.py
├── coupling.py
├── security.py
└── performance.py
```

2. **Add to main app:**
```python
# app.py
elif page == "Advanced Metrics":
    from backend.metrics import render_metrics_dashboard
    render_metrics_dashboard(db_service)
```

## 🧪 Testing Strategy

### Unit Tests
```python
# tests/test_parsers.py
def test_javascript_parser():
    parser = JavaScriptParser()
    content = "function hello() { return 'world'; }"
    result = parser.parse_file("test.js", content)
    assert result['nodes'][0]['type'] == 'FunctionDeclaration'
    assert result['nodes'][0]['name'] == 'hello'
```

### Integration Tests
```python
# tests/test_integration.py
def test_full_analysis_pipeline():
    # Test complete flow from repo URL to metrics
    analyzer = RepositoryAnalyzer(db_service)
    result = analyzer.analyze_repository("https://github.com/test/repo")
    assert result['metrics']['dead_code_percentage'] >= 0
```

## 📈 Performance Monitoring

### Key Metrics to Track
- **Parse Time:** < 30 seconds for 500 files
- **Query Performance:** < 100ms for metric calculations  
- **Memory Usage:** < 2GB for large repositories
- **Dashboard Load:** < 2 seconds

### Monitoring Code
```python
# backend/monitoring.py
import time
import psutil
from functools import wraps

def monitor_performance(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss
        
        result = func(*args, **kwargs)
        
        duration = time.time() - start_time
        memory_used = psutil.Process().memory_info().rss - start_memory
        
        logger.info(f"{func.__name__}: {duration:.2f}s, {memory_used/1024/1024:.1f}MB")
        return result
    return wrapper
```

## 🚨 Common Issues & Solutions

### Parser Issues
```python
# Handle parsing errors gracefully
try:
    ast = parser.parse(content)
except SyntaxError as e:
    logger.warning(f"Parse error in {file_path}: {e}")
    return {"nodes": [], "edges": [], "errors": [str(e)]}
```

### Database Connection Issues
```python
# Retry logic for database operations
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def execute_query(query: str):
    return db.aql.execute(query)
```

### Memory Management
```python
# Process large repositories in batches
def process_repository_batched(files: List[str], batch_size: int = 50):
    for i in range(0, len(files), batch_size):
        batch = files[i:i + batch_size]
        process_batch(batch)
        gc.collect()  # Force garbage collection
```

## 🎯 Development Workflow

### Daily Standup Checklist
- [ ] Check Kanban board for assigned stories
- [ ] Pull latest changes from main branch
- [ ] Run tests before starting development
- [ ] Update story status as work progresses
- [ ] Create pull request when story is complete

### Code Review Checklist
- [ ] Unit tests included and passing
- [ ] Performance monitoring added
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] Integration tests passing

### Story Completion Definition
- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Tests passing (unit + integration)
- [ ] Documentation updated
- [ ] Deployed to staging environment
- [ ] Story moved to "Done" column

## 📚 Useful Resources

### Documentation
- [ArangoDB AQL Tutorial](https://www.arangodb.com/docs/stable/aql/)
- [Babel Parser Options](https://babeljs.io/docs/en/babel-parser)
- [Streamlit Components](https://docs.streamlit.io/)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)

### Code Examples
- Check `analysis.txt` for detailed implementation examples
- Review existing `backend/` modules for patterns
- Look at `fastapi-backend/` for API design patterns

## 🤝 Getting Help

### Team Communication
- **Slack:** #code-analysis-dev
- **Daily Standups:** 9:00 AM EST
- **Sprint Planning:** Mondays 2:00 PM EST
- **Code Reviews:** GitHub PR reviews

### Escalation Path
1. Check documentation and examples
2. Ask team member with relevant expertise
3. Post in team Slack channel
4. Escalate to project manager if blocked

---

**Happy Coding!** 🚀

**Document Version:** 1.0  
**Last Updated:** August 1, 2025
