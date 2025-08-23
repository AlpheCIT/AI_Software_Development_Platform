# Data Relationship Structure - What You Should See

## 🔗 Database Schema Relationships

### **1. repositories → codeNodes** 
```javascript
// repositories collection (3 docs)
{
  "_key": "0a42f7ecd3973c12",  // Streamlit_Code_Analyzer
  "name": "Streamlit_Code_Analyzer",
  "url": "https://github.com/AlpheCIT/Streamlit_Code_Analyzer.git",
  "file_stats": {
    "total_files": 20,
    "total_lines": 3670,
    "by_language": {"Python": 16, "YAML": 1, ...}
  }
}

// codeNodes (ast_nodes) collection (589+ docs)
{
  "_key": "abc123...",
  "type": "FunctionDeclaration", 
  "name": "analyze_repository",
  "file_path": "/path/to/file.py",
  "repository_id": "0a42f7ecd3973c12",  // 👈 Links back to repository!
  "language": "python",
  "line_start": 45,
  "complexity": {"cyclomatic": 5}
}
```

### **2. codeNodes ↔ codeNodes (relationships)**
```javascript
// relationships collection (681+ docs)
{
  "_from": "ast_nodes/func_123",
  "_to": "ast_nodes/func_456", 
  "relationship_type": "calls",
  "source_function": "main",
  "target_function": "helper_function"
}
```

### **3. code_files → repositories**
```javascript
// code_files collection (16+ docs) 
{
  "_key": "file_abc123",
  "file_path": "/tmp/.../app.py",
  "repository_id": "0a42f7ecd3973c12",  // 👈 Links back to repository!
  "language": "python",
  "size_bytes": 5432,
  "line_count": 150
}
```

## 🧠 **Embeddings Storage Strategy**

### **Option 1: Store embeddings IN codeNodes** ✅ Recommended
```javascript
{
  "_key": "func_abc123",
  "type": "FunctionDeclaration",
  "name": "calculate_metrics", 
  "repository_id": "0a42f7ecd3973c12",
  "embedding": [0.1, -0.3, 0.7, ...],  // 👈 Directly in AST node
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "embedding_generated_at": "2025-08-03T12:00:00Z"
}
```

### **Option 2: Separate embeddings collection** (if needed for performance)
```javascript
// embeddings collection
{
  "_key": "embed_abc123",
  "node_id": "func_abc123",           // Links to ast_nodes
  "repository_id": "0a42f7ecd3973c12", // Direct repo link
  "embedding": [0.1, -0.3, 0.7, ...],
  "model": "sentence-transformers/all-MiniLM-L6-v2"
}
```

## 🎯 **What You Should See in ArangoDB Interface**

### **Repository 906** (Streamlit_Code_Analyzer)
- **Document**: Repository metadata with stats
- **Connected**: 589 AST nodes + 16 code files + 681 relationships

### **AST Nodes Query Example**
```aql
FOR node IN ast_nodes
  FILTER node.repository_id == "0a42f7ecd3973c12"
  RETURN {
    name: node.name,
    type: node.type,
    file: node.file_path,
    complexity: node.complexity
  }
```

### **Function Dependencies Query**
```aql
FOR rel IN relationships
  FILTER rel.relationship_type == "calls"
  LET source = DOCUMENT(rel._from)
  LET target = DOCUMENT(rel._to)
  RETURN {
    from: source.name,
    to: target.name,
    type: rel.relationship_type
  }
```

## 🚀 **Expected Analysis Results**

### **Dead Code Detection**
Should find functions with no incoming relationships:
```aql
FOR node IN ast_nodes
  FILTER node.type == "FunctionDeclaration"
  LET incoming = (
    FOR rel IN relationships
      FILTER rel._to == CONCAT("ast_nodes/", node._key)
      RETURN 1
  )
  FILTER LENGTH(incoming) == 0
  RETURN node.name
```

### **Coupling Analysis** 
Should show functions with high fan-out (many outgoing calls):
```aql
FOR node IN ast_nodes
  FILTER node.type == "FunctionDeclaration"
  LET outgoing = (
    FOR rel IN relationships
      FILTER rel._from == CONCAT("ast_nodes/", node._key)
      RETURN 1
  )
  RETURN {
    function: node.name,
    coupling_score: LENGTH(outgoing)
  }
```

## 🔧 **Why You're Seeing Empty Results**

The analysis found **589 AST nodes** and **681 relationships** from the Streamlit repo, but you might not see them in the UI because:

1. **Authorization Issue**: The script couldn't write to ArangoDB due to permissions
2. **Database Connection**: Need to use the same credentials as your web interface
3. **Collection Sync**: Data might be processed but not committed to database

Let's fix the database connection and try again! 🚀
