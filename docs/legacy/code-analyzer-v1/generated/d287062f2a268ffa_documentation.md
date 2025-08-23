# Repository Documentation: d287062f2a268ffa

Generated on: 2025-08-07 21:58:04

## Overview

This documentation was automatically generated from code analysis data stored in ArangoDB collections.

## Repository Statistics

- **Application Type**: Api
- **Total Files**: 16
- **Total Code Units**: 86
- **API Endpoints**: 14
- **Streamlit Pages/Components**: 0
- **Service Classes**: 2

## API Endpoints (14 endpoints)

### get_language_color

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/utils.py`
- **Lines**: 106-156

### get_file_extension

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/utils.py`
- **Lines**: 263-273

### get_embedding

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/embedding.py`
- **Lines**: 77-144

### get_similar_text

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/embedding.py`
- **Lines**: 201-227

### get_model_info

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/embedding.py`
- **Lines**: 229-265

### get_available_models

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/embedding.py`
- **Lines**: 267-284

### get_similar_code

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/database.py`
- **Lines**: 443-484

### load_config

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/config.py`
- **Lines**: 15-111

### get_file_hash

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/utils.py`
- **Lines**: 13-29

### get_content_hash

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/utils.py`
- **Lines**: 32-42

### get_node_key

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/utils.py`
- **Lines**: 139-154

### get_status

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/processor.py`
- **Lines**: 426-441

### get_repository_metadata

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/git.py`
- **Lines**: 98-151

### get_parser

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/parsers/factory.py`
- **Lines**: 22-43

## Service Architecture (2 services)

### EmbeddingService

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/embedding.py`
- **Lines**: 18-353

**Description**: Service for generating embeddings for code fragments.

**Methods**: __init__, _test_connection, get_embedding, generate_embeddings_batch, clear_cache, get_similar_text, get_model_info, get_available_models, is_model_available, ensure_model_available

### ArangoDBService

- **File**: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/database.py`
- **Lines**: 14-530

**Description**: Service for handling ArangoDB operations.

**Methods**: __init__, connect, setup_collections, setup_indexes, _setup_native_vector_index, _setup_custom_vector_index, _create_index, store_code_node, batch_store_nodes, store_embedding, store_code_edge, batch_store_edges, store_repository, get_similar_code, fix_vector_index

## Files Overview

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/app.py`

- **Language**: python
- **Lines**: 337
- **Size**: 15260 bytes

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/__init__.py`

- **Language**: python
- **Lines**: 16
- **Size**: 339 bytes

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/config.py`

- **Language**: python
- **Lines**: 111
- **Size**: 3348 bytes

**Code Components (1):**

#### Function: load_config

- **Lines**: 15-111
- **Language**: python
- **Complexity**: {'cyclomatic': 12, 'nesting_depth': 4}
- **Description**: Load configuration from file or use defaults.

Args:
    config_file (str, optional): Path to config file. Defaults to None.

Returns:
    dict: Configuration dictionary

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/database.py`

- **Language**: python
- **Lines**: 530
- **Size**: 20997 bytes

**Code Components (16):**

#### Class: ArangoDBService

- **Lines**: 14-530
- **Language**: python
- **Description**: Service for handling ArangoDB operations.
- **Methods**: __init__, connect, setup_collections, setup_indexes, _setup_native_vector_index, _setup_custom_vector_index, _create_index, store_code_node, batch_store_nodes, store_embedding, store_code_edge, batch_store_edges, store_repository, get_similar_code, fix_vector_index

#### Function: __init__

- **Lines**: 17-29
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Initialize the ArangoDB service.

Args:
    config: Configuration dictionary with ArangoDB settings

#### Function: connect

- **Lines**: 31-67
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 2}
- **Description**: Establish connection to ArangoDB.

#### Function: setup_collections

- **Lines**: 69-101
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 2}
- **Description**: Set up required collections in ArangoDB.

#### Function: setup_indexes

- **Lines**: 103-139
- **Language**: python
- **Complexity**: {'cyclomatic': 6, 'nesting_depth': 2}
- **Description**: Set up indexes for collections.

#### Function: _setup_native_vector_index

- **Lines**: 141-170
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 1}
- **Description**: Set up native ArangoDB vector index (ArangoDB 3.9+ Enterprise).

#### Function: _setup_custom_vector_index

- **Lines**: 172-188
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Set up custom vector index for ArangoDB compatibility.

#### Function: _create_index

- **Lines**: 190-203
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Create index if it doesn't exist.

#### Function: store_code_node

- **Lines**: 205-241
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 3}
- **Description**: Store a code node in the database.

Args:
    node: Code node data to store
    
Returns:
    Dictionary with operation result

#### Function: batch_store_nodes

- **Lines**: 243-296
- **Language**: python
- **Complexity**: {'cyclomatic': 12, 'nesting_depth': 3}
- **Description**: Store multiple code nodes in the database.

Args:
    nodes: List of code nodes to store
    
Returns:
    Dictionary with operation results

#### Function: store_embedding

- **Lines**: 298-344
- **Language**: python
- **Complexity**: {'cyclomatic': 11, 'nesting_depth': 2}
- **Description**: Store a code embedding in the database.

Args:
    embedding: Embedding data to store
    
Returns:
    Dictionary with operation result

#### Function: store_code_edge

- **Lines**: 346-367
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 1}
- **Description**: Store a code relationship edge in the database.

Args:
    edge: Edge data to store
    
Returns:
    Dictionary with operation result

#### Function: batch_store_edges

- **Lines**: 369-396
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Store multiple code relationship edges in the database.

Args:
    edges: List of edges to store
    
Returns:
    Dictionary with operation results

#### Function: store_repository

- **Lines**: 398-441
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Store repository metadata in the database.

Args:
    repo: Repository metadata to store
    
Returns:
    Dictionary with operation result

#### Function: get_similar_code

- **Lines**: 443-484
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 1}
- **Description**: Find similar code based on vector similarity.

Args:
    vector: Embedding vector to search for
    limit: Maximum number of results to return
    
Returns:
    List of similar code nodes with similarity scores

#### Function: fix_vector_index

- **Lines**: 486-530
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 3}
- **Description**: Fix vector index issues in ArangoDB for compatibility.

Returns:
    Boolean indicating success or failure

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/embedding.py`

- **Language**: python
- **Lines**: 353
- **Size**: 13975 bytes

**Code Components (11):**

#### Class: EmbeddingService

- **Lines**: 18-353
- **Language**: python
- **Description**: Service for generating embeddings for code fragments.
- **Methods**: __init__, _test_connection, get_embedding, generate_embeddings_batch, clear_cache, get_similar_text, get_model_info, get_available_models, is_model_available, ensure_model_available

#### Function: __init__

- **Lines**: 21-46
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 1}
- **Description**: Initialize the embedding service.

Args:
    config: Configuration dictionary with embedding settings

#### Function: _test_connection

- **Lines**: 48-75
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 3}
- **Description**: Test the connection to Ollama API.

Returns:
    Boolean indicating if connection was successful

#### Function: get_embedding

- **Lines**: 77-144
- **Language**: python
- **Complexity**: {'cyclomatic': 14, 'nesting_depth': 5}
- **Description**: Generate embedding for a single text string.

Args:
    text: Text to generate embedding for
    
Returns:
    List of floats representing the embedding vector

#### Function: generate_embeddings_batch

- **Lines**: 146-193
- **Language**: python
- **Complexity**: {'cyclomatic': 9, 'nesting_depth': 4}
- **Description**: Generate embeddings for a batch of code nodes.

Args:
    code_nodes: List of code nodes to generate embeddings for
    
Returns:
    List of embedding documents ready for storage

#### Function: clear_cache

- **Lines**: 195-199
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Clear the embedding cache.

#### Function: get_similar_text

- **Lines**: 201-227
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 2}
- **Description**: Find similar code nodes to the given text.

Args:
    text: Text to find similar code for
    db_service: Database service instance for querying
    limit: Maximum number of results to return
    
Returns:
    List of similar code nodes with similarity scores

#### Function: get_model_info

- **Lines**: 229-265
- **Language**: python
- **Complexity**: {'cyclomatic': 6, 'nesting_depth': 4}
- **Description**: Get information about the current embedding model.

Returns:
    Dictionary with model information

#### Function: get_available_models

- **Lines**: 267-284
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Get a list of available models in Ollama.

Returns:
    list: List of model names available in Ollama

#### Function: is_model_available

- **Lines**: 286-308
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 3}
- **Description**: Check if the configured model is available in Ollama.

Returns:
    bool: True if model is available, False otherwise

#### Function: ensure_model_available

- **Lines**: 310-353
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 4}
- **Description**: Ensure that the required model is available, attempt to pull if not.

Returns:
    bool: True if model is available or was successfully pulled, False otherwise

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/__init__.py`

- **Language**: python
- **Lines**: 9
- **Size**: 312 bytes

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/git.py`

- **Language**: python
- **Lines**: 173
- **Size**: 5124 bytes

**Code Components (4):**

#### Function: find_git_executable

- **Lines**: 15-29
- **Language**: python
- **Complexity**: {'cyclomatic': 6, 'nesting_depth': 1}

#### Function: clone_repository

- **Lines**: 41-95
- **Language**: python
- **Complexity**: {'cyclomatic': 12, 'nesting_depth': 3}
- **Description**: Clone a git repository to the specified directory.

Args:
    repo_url: URL of the repository to clone
    output_dir: Directory to clone the repository to
    branch: Branch to checkout
    
Returns:
    Path to the cloned repository

#### Function: get_repository_metadata

- **Lines**: 98-151
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 2}
- **Description**: Extract metadata from a git repository.

Args:
    repo_path: Path to the repository
    
Returns:
    Dictionary with repository metadata

#### Function: cleanup_repository

- **Lines**: 154-173
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Clean up a cloned repository.

Args:
    repo_path: Path to the repository
    
Returns:
    True if cleanup was successful, False otherwise

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/parsers/__init__.py`

- **Language**: python
- **Lines**: 18
- **Size**: 462 bytes

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/parsers/base.py`

- **Language**: python
- **Lines**: 183
- **Size**: 5774 bytes

**Code Components (6):**

#### Class: BaseCodeParser

- **Lines**: 13-183
- **Language**: python
- **Description**: Base class for language-specific code parsers.
- **Methods**: __init__, parse, create_file_node, _detect_language, _extract_indentation_block

#### Function: __init__

- **Lines**: 16-30
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Initialize the code parser.

Args:
    file_path: Path to the file to parse
    repository: Repository URL
    branch: Branch name

#### Function: parse

- **Lines**: 32-49
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Parse the file and return nodes and edges.

Returns:
    Dictionary with nodes and edges

#### Function: create_file_node

- **Lines**: 51-76
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Create a node for the file itself.

Args:
    content: File content
    
Returns:
    ID of the created node

#### Function: _detect_language

- **Lines**: 78-141
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 2}
- **Description**: Detect programming language from file extension.

Returns:
    String representing the detected language

#### Function: _extract_indentation_block

- **Lines**: 143-183
- **Language**: python
- **Complexity**: {'cyclomatic': 6, 'nesting_depth': 2}
- **Description**: Extract a block of code based on indentation level.

Args:
    content: Full file content
    start_pos: Starting position of the block
    indent_level: Indentation level to look for
    
Returns:
    Tuple of (extracted_block, end_position)

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/parsers/factory.py`

- **Language**: python
- **Lines**: 43
- **Size**: 1320 bytes

**Code Components (2):**

#### Class: CodeParserFactory

- **Lines**: 18-43
- **Language**: python
- **Description**: Factory class to create appropriate parser based on file type.
- **Methods**: get_parser

#### Function: get_parser

- **Lines**: 22-43
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 2}
- **Description**: Get the appropriate parser for the given file.

Args:
    file_path: Path to the file to parse
    repository: Repository URL
    branch: Branch name
    
Returns:
    Parser instance for the file
- **Decorators**: staticmethod

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/parsers/generic.py`

- **Language**: python
- **Lines**: 35
- **Size**: 961 bytes

**Code Components (2):**

#### Class: GenericCodeParser

- **Lines**: 14-35
- **Language**: python
- **Description**: Generic parser for other file types.
- **Methods**: parse
- **Inherits from**: BaseCodeParser

#### Function: parse

- **Lines**: 17-35
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Parse a file and return basic nodes.

Returns:
    Dictionary with nodes and edges

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/parsers/javascript.py`

- **Language**: python
- **Lines**: 408
- **Size**: 15456 bytes

**Code Components (9):**

#### Class: JavaScriptTypeScriptParser

- **Lines**: 16-408
- **Language**: python
- **Description**: Parser for JavaScript/TypeScript/React code.
- **Methods**: parse, _parse_imports, _add_import_node, _parse_classes, _parse_class_methods, _parse_functions, _add_function_node, _parse_components
- **Inherits from**: BaseCodeParser

#### Function: parse

- **Lines**: 19-44
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Parse a JavaScript/TypeScript file and return nodes and edges.

Returns:
    Dictionary with nodes and edges

#### Function: _parse_imports

- **Lines**: 46-79
- **Language**: python
- **Complexity**: {'cyclomatic': 8, 'nesting_depth': 4}
- **Description**: Parse JS/TS import statements.

#### Function: _add_import_node

- **Lines**: 81-107
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Add an import node to the graph.

#### Function: _parse_classes

- **Lines**: 109-170
- **Language**: python
- **Complexity**: {'cyclomatic': 8, 'nesting_depth': 4}
- **Description**: Parse ES6 class declarations.

#### Function: _parse_class_methods

- **Lines**: 172-233
- **Language**: python
- **Complexity**: {'cyclomatic': 9, 'nesting_depth': 4}
- **Description**: Parse methods within a class.

#### Function: _parse_functions

- **Lines**: 235-310
- **Language**: python
- **Complexity**: {'cyclomatic': 18, 'nesting_depth': 4}
- **Description**: Parse function declarations and expressions.

#### Function: _add_function_node

- **Lines**: 312-338
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Add a function node to the graph.

#### Function: _parse_components

- **Lines**: 340-408
- **Language**: python
- **Complexity**: {'cyclomatic': 10, 'nesting_depth': 5}
- **Description**: Parse React/Vue components.

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/parsers/python.py`

- **Language**: python
- **Lines**: 287
- **Size**: 11027 bytes

**Code Components (8):**

#### Class: PythonCodeParser

- **Lines**: 16-287
- **Language**: python
- **Description**: Parser for Python/Django code.
- **Methods**: parse, _parse_imports, _add_import_node, _parse_classes, _parse_methods, _parse_global_functions, _extract_docstring
- **Inherits from**: BaseCodeParser

#### Function: parse

- **Lines**: 19-43
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Parse a Python file and return nodes and edges.

Returns:
    Dictionary with nodes and edges

#### Function: _parse_imports

- **Lines**: 45-68
- **Language**: python
- **Complexity**: {'cyclomatic': 6, 'nesting_depth': 3}
- **Description**: Parse Python import statements.

#### Function: _add_import_node

- **Lines**: 70-97
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Add an import node to the graph.

#### Function: _parse_classes

- **Lines**: 99-154
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Parse Python class definitions.

#### Function: _parse_methods

- **Lines**: 156-209
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Parse methods within a class.

#### Function: _parse_global_functions

- **Lines**: 211-269
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 2}
- **Description**: Parse global function definitions.

#### Function: _extract_docstring

- **Lines**: 271-287
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 1}
- **Description**: Extract docstring from a code block.

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/processor.py`

- **Language**: python
- **Lines**: 441
- **Size**: 16382 bytes

**Code Components (10):**

#### Class: RepositoryProcessor

- **Lines**: 21-441
- **Language**: python
- **Description**: Process repositories and store code structure in database.
- **Methods**: __init__, process_repository, _store_repository_metadata, _process_files, _generate_embeddings, _process_embedding_batch, _get_file_paths, search_code, get_status

#### Function: __init__

- **Lines**: 24-50
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Initialize the repository processor.

Args:
    config: Configuration dictionary
    db_service: Database service instance
    embedding_service: Embedding service instance

#### Function: process_repository

- **Lines**: 52-122
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 2}
- **Description**: Process a repository and store all data in the database.

Args:
    repo_url: URL of the repository to process
    branch: Branch to process
    
Returns:
    Dictionary with processing results

#### Function: _store_repository_metadata

- **Lines**: 124-151
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Store repository metadata in the database.

Args:
    metadata: Repository metadata
    
Returns:
    Result of the storage operation

#### Function: _process_files

- **Lines**: 153-235
- **Language**: python
- **Complexity**: {'cyclomatic': 14, 'nesting_depth': 6}
- **Description**: Process files in the repository.

Args:
    repo_path: Path to the cloned repository
    repo_url: Repository URL
    branch: Branch name
    
Returns:
    Dictionary with processing statistics

#### Function: _generate_embeddings

- **Lines**: 237-334
- **Language**: python
- **Complexity**: {'cyclomatic': 11, 'nesting_depth': 5}
- **Description**: Generate embeddings for code nodes.

Args:
    repo_url: Repository URL
    branch: Branch name
    
Returns:
    Dictionary with embedding statistics

#### Function: _process_embedding_batch

- **Lines**: 336-377
- **Language**: python
- **Complexity**: {'cyclomatic': 10, 'nesting_depth': 4}
- **Description**: Process a batch of nodes for embedding generation.

Args:
    nodes: List of code nodes
    
Returns:
    Dictionary with processing statistics

#### Function: _get_file_paths

- **Lines**: 379-407
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 2}
- **Description**: Get list of files to process from repository.

Args:
    repo_path: Path to the repository
    
Returns:
    List of file paths to process

#### Function: search_code

- **Lines**: 409-424
- **Language**: python
- **Complexity**: {'cyclomatic': 2, 'nesting_depth': 1}
- **Description**: Search for code similar to the query.

Args:
    query: Search query
    limit: Maximum number of results to return
    
Returns:
    List of similar code nodes

#### Function: get_status

- **Lines**: 426-441
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Get the current status of the repository processor.

Returns:
    Dictionary with status information

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/repository/utils.py`

- **Language**: python
- **Lines**: 154
- **Size**: 4213 bytes

**Code Components (6):**

#### Function: get_file_hash

- **Lines**: 13-29
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 2}
- **Description**: Calculate hash for a file.

Args:
    file_path: Path to the file
    
Returns:
    SHA-256 hash of the file content

#### Function: get_content_hash

- **Lines**: 32-42
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Calculate hash for a string content.

Args:
    content: String content
    
Returns:
    SHA-256 hash of the content

#### Function: is_binary_file

- **Lines**: 45-78
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 2}
- **Description**: Check if a file is binary.

Args:
    file_path: Path to the file
    
Returns:
    True if the file is binary, False otherwise

#### Function: filter_files

- **Lines**: 81-119
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 3}
- **Description**: Filter files based on exclusion patterns and supported extensions.

Args:
    file_paths: List of file paths
    excluded_dirs: Set of directory names to exclude
    supported_extensions: Set of supported file extensions
    
Returns:
    Filtered list of file paths

#### Function: truncate_large_file

- **Lines**: 122-136
- **Language**: python
- **Complexity**: {'cyclomatic': 2, 'nesting_depth': 1}
- **Description**: Truncate large file content to avoid memory issues.

Args:
    content: File content
    max_size: Maximum allowed size in characters
    
Returns:
    Truncated content

#### Function: get_node_key

- **Lines**: 139-154
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 1}
- **Description**: Generate a consistent key for a code node.

Args:
    node_type: Type of the node (file, class, function, etc.)
    file_path: Path to the file
    name: Name of the node
    class_name: Name of the parent class (for methods)
    
Returns:
    Key string

### File: `/tmp/tmphxrlk6z6/Streamlit_Code_Analyzer/backend/utils.py`

- **Language**: python
- **Lines**: 299
- **Size**: 8145 bytes

**Code Components (11):**

#### Class: CustomEncoder

- **Lines**: 248-254
- **Language**: python
- **Methods**: default
- **Inherits from**: json.JSONEncoder

#### Function: setup_logging

- **Lines**: 13-57
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 3}
- **Description**: Set up logging configuration.

Args:
    log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    log_file: Path to log file (if None, logs to console only)

#### Function: sanitize_repository_url

- **Lines**: 60-83
- **Language**: python
- **Complexity**: {'cyclomatic': 4, 'nesting_depth': 3}
- **Description**: Sanitize repository URL to remove sensitive information.

Args:
    url: Repository URL
    
Returns:
    Sanitized URL

#### Function: format_duration

- **Lines**: 86-103
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 2}
- **Description**: Format duration in seconds to a human-readable string.

Args:
    seconds: Duration in seconds
    
Returns:
    Formatted duration string

#### Function: get_language_color

- **Lines**: 106-156
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 2}
- **Description**: Get color for a programming language (for visualization).

Args:
    language: Programming language name
    
Returns:
    Hex color code

#### Function: count_lines_of_code

- **Lines**: 159-174
- **Language**: python
- **Complexity**: {'cyclomatic': 2, 'nesting_depth': 1}
- **Description**: Count non-empty lines of code.

Args:
    code: Code string
    
Returns:
    Number of non-empty lines

#### Function: generate_summary_stats

- **Lines**: 177-234
- **Language**: python
- **Complexity**: {'cyclomatic': 7, 'nesting_depth': 2}
- **Description**: Generate summary statistics for code nodes.

Args:
    nodes: List of code nodes
    
Returns:
    Dictionary with summary statistics

#### Function: safe_json_dumps

- **Lines**: 237-260
- **Language**: python
- **Complexity**: {'cyclomatic': 5, 'nesting_depth': 1}
- **Description**: Safely convert an object to a JSON string.

Args:
    obj: Object to convert
    indent: Indentation level
    
Returns:
    JSON string

#### Function: get_file_extension

- **Lines**: 263-273
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Get the file extension from a path.

Args:
    file_path: File path
    
Returns:
    File extension (with dot, lowercase)

#### Function: is_binary_file

- **Lines**: 276-299
- **Language**: python
- **Complexity**: {'cyclomatic': 1, 'nesting_depth': 0}
- **Description**: Check if a file is binary.

Args:
    file_path: Path to the file
    
Returns:
    True if the file is binary, False otherwise

#### Function: default

- **Lines**: 249-254
- **Language**: python
- **Complexity**: {'cyclomatic': 3, 'nesting_depth': 1}

## Summary

- **Application Type**: Api
- **Total API Endpoints**: 14
- **Total Streamlit Pages/Components**: 0
- **Total Files Analyzed**: 16
- **Total Code Components**: 86
- **Service Classes**: 2

---

*This documentation was automatically generated from codeunits analysis and repository structure data.*
