// ArangoDB AST Graph Schema Enhancement
// This script implements the enhanced database schema for AST nodes and semantic relationships
// Supporting INFRA-002: ArangoDB Graph Schema Enhancement

const collections = [
  {
    name: 'ast_nodes',
    type: 'document',
    description: 'Stores AST nodes from parsed code files with semantic information'
  },
  {
    name: 'relationships', 
    type: 'edge',
    description: 'Stores semantic relationships between AST nodes (calls, imports, contains, etc.)'
  },
  {
    name: 'code_files',
    type: 'document',
    description: 'Stores file metadata and analysis results'
  },
  {
    name: 'repositories',
    type: 'document', 
    description: 'Stores repository information and analysis metadata'
  }
];

const indexes = [
  // AST Nodes indexes for fast queries
  {
    collection: 'ast_nodes',
    fields: ['type'],
    type: 'persistent',
    name: 'idx_ast_node_type'
  },
  {
    collection: 'ast_nodes', 
    fields: ['file_path'],
    type: 'persistent',
    name: 'idx_ast_node_file'
  },
  {
    collection: 'ast_nodes',
    fields: ['name'],
    type: 'fulltext',
    name: 'idx_ast_node_name_fulltext'
  },
  {
    collection: 'ast_nodes',
    fields: ['repository_id', 'file_path'],
    type: 'persistent',
    name: 'idx_ast_node_repo_file'
  },
  {
    collection: 'ast_nodes',
    fields: ['language', 'type'],
    type: 'persistent',
    name: 'idx_ast_node_lang_type'
  },
  
  // Relationships indexes for graph traversal
  {
    collection: 'relationships',
    fields: ['relationship_type'],
    type: 'persistent',
    name: 'idx_relationship_type'
  },
  {
    collection: 'relationships',
    fields: ['_from', 'relationship_type'],
    type: 'persistent',
    name: 'idx_relationship_from_type'
  },
  {
    collection: 'relationships',
    fields: ['_to', 'relationship_type'],
    type: 'persistent',
    name: 'idx_relationship_to_type'
  },
  {
    collection: 'relationships',
    fields: ['source_file', 'target_file'],
    type: 'persistent',
    name: 'idx_relationship_files'
  },
  
  // Code Files indexes
  {
    collection: 'code_files',
    fields: ['file_path'],
    type: 'persistent',
    unique: true,
    name: 'idx_code_file_path'
  },
  {
    collection: 'code_files',
    fields: ['repository_id', 'file_path'],
    type: 'persistent',
    name: 'idx_code_file_repo_path'
  },
  {
    collection: 'code_files',
    fields: ['language'],
    type: 'persistent',
    name: 'idx_code_file_language'
  },
  {
    collection: 'code_files',
    fields: ['last_analyzed'],
    type: 'persistent',
    name: 'idx_code_file_analyzed'
  },
  
  // Repositories indexes
  {
    collection: 'repositories',
    fields: ['url'],
    type: 'persistent',
    unique: true,
    name: 'idx_repository_url'
  },
  {
    collection: 'repositories',
    fields: ['name'],
    type: 'persistent',
    name: 'idx_repository_name'
  }
];

// Graph definition for code analysis
const graphs = [
  {
    name: 'code_graph',
    edge_definitions: [
      {
        collection: 'relationships',
        from: ['ast_nodes', 'code_files'],
        to: ['ast_nodes', 'code_files']
      }
    ]
  }
];

// Example AST node document structure
const exampleAstNode = {
  _key: "func_calculateMetrics_main_py_42",
  type: "FunctionDeclaration",
  name: "calculateMetrics",
  file_path: "src/main.py",
  repository_id: "repo-001",
  language: "python",
  line_start: 42,
  line_end: 67,
  column_start: 0,
  column_end: 4,
  complexity: {
    cyclomatic: 8,
    cognitive: 12,
    nesting_depth: 3
  },
  metadata: {
    docstring: "Calculate code metrics for the given file",
    parameters: ["file_path", "options"],
    return_type: "dict",
    is_async: false,
    is_exported: true,
    decorators: ["@cache"],
    calls_external_apis: true
  },
  semantic_info: {
    imports_used: ["os", "json", "pathlib"],
    functions_called: ["parse_file", "analyze_complexity"],
    variables_defined: ["metrics", "result"],
    scope: "module"
  },
  analysis_timestamp: "2025-08-03T10:00:00Z"
};

// Example relationship document structure
const exampleRelationship = {
  _from: "ast_nodes/func_calculateMetrics_main_py_42",
  _to: "ast_nodes/func_parse_file_utils_py_15",
  relationship_type: "calls",
  source_file: "src/main.py",
  target_file: "src/utils.py", 
  call_count: 3,
  confidence: 0.95,
  metadata: {
    call_line_numbers: [45, 52, 61],
    parameters_passed: ["file_path"],
    context: "data processing"
  },
  analysis_timestamp: "2025-08-03T10:00:00Z"
};

// Example code file document structure  
const exampleCodeFile = {
  _key: "file_src_main_py",
  file_path: "src/main.py",
  repository_id: "repo-001",
  language: "python",
  size_bytes: 2048,
  lines_of_code: 87,
  last_modified: "2025-08-02T15:30:00Z",
  last_analyzed: "2025-08-03T10:00:00Z",
  analysis_version: "1.0.0",
  metrics: {
    complexity: {
      cyclomatic_total: 25,
      cognitive_total: 32,
      average_per_function: 8.3
    },
    quality: {
      test_coverage: 85.5,
      documentation_coverage: 92.0,
      code_duplication: 3.2
    },
    maintainability: {
      maintainability_index: 78.5,
      technical_debt_ratio: 0.15
    }
  },
  ast_nodes_count: 15,
  security_issues: [],
  performance_issues: [
    {
      type: "N+1 query",
      line: 45,
      severity: "medium"
    }
  ]
};

// Example repository document structure
const exampleRepository = {
  _key: "repo_001",
  name: "code-analyzer",
  url: "https://github.com/company/code-analyzer.git",
  branch: "main",
  last_commit_hash: "abc123def456",
  last_analyzed: "2025-08-03T09:00:00Z",
  analysis_status: "completed",
  total_files: 156,
  total_lines_of_code: 25890,
  languages: {
    "python": 78.5,
    "javascript": 15.2,
    "typescript": 6.3
  },
  metrics: {
    overall_complexity: 7.2,
    test_coverage: 82.1,
    technical_debt_hours: 24.5
  }
};

// Common AQL queries for graph traversal
const commonQueries = {
  // Find all functions called by a specific function
  findFunctionCalls: `
    FOR node IN ast_nodes
    FILTER node._key == @functionKey
    FOR v, e IN 1..1 OUTBOUND node relationships
    FILTER e.relationship_type == "calls" AND v.type == "FunctionDeclaration"
    RETURN {
      function: v.name,
      file: v.file_path,
      calls: e.call_count
    }
  `,
  
  // Find dead code (functions not called by anyone)
  findDeadCode: `
    FOR node IN ast_nodes
    FILTER node.type == "FunctionDeclaration"
    LET callers = (FOR v, e IN 1..1 INBOUND node relationships
                   FILTER e.relationship_type == "calls"
                   RETURN 1)
    FILTER LENGTH(callers) == 0 AND node.name != "main"
    RETURN {
      function: node.name,
      file: node.file_path,
      lines: {start: node.line_start, end: node.line_end}
    }
  `,
  
  // Find circular dependencies between files
  findCircularDependencies: `
    FOR file1 IN code_files
    FOR file2 IN 2..5 OUTBOUND file1 relationships
    FILTER file1._key == file2._key
    LET path = (FOR v IN 2..5 OUTBOUND file1 relationships
                FILTER v._key == file1._key
                RETURN v.file_path)
    RETURN {
      cycle: path,
      files_involved: LENGTH(path)
    }
  `,
  
  // Find highly coupled modules (high fan-in/fan-out)
  findHighCoupling: `
    FOR node IN ast_nodes
    FILTER node.type IN ["FunctionDeclaration", "ClassDeclaration"]
    LET fan_in = LENGTH(FOR v, e IN 1..1 INBOUND node relationships
                        FILTER e.relationship_type IN ["calls", "imports", "extends"]
                        RETURN 1)
    LET fan_out = LENGTH(FOR v, e IN 1..1 OUTBOUND node relationships  
                         FILTER e.relationship_type IN ["calls", "imports", "extends"]
                         RETURN 1)
    LET coupling = fan_in + fan_out
    FILTER coupling > @threshold
    SORT coupling DESC
    RETURN {
      name: node.name,
      file: node.file_path,
      fan_in: fan_in,
      fan_out: fan_out,
      coupling_score: coupling
    }
  `
};

module.exports = {
  collections,
  indexes,
  graphs,
  examples: {
    ast_node: exampleAstNode,
    relationship: exampleRelationship,
    code_file: exampleCodeFile,
    repository: exampleRepository
  },
  queries: commonQueries
};
