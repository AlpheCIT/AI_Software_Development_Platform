"""
Sample data management for the Code Analyzer application.
This module provides sample data for demonstrations and testing.
"""

from datetime import datetime, timedelta
import random
import re
from typing import Dict, List, Any

class SampleDataProvider:
    """Provides sample data for demonstrations and testing."""
    
    def __init__(self):
        self.languages = ['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C++']
        self.file_extensions = {
            'Python': '.py',
            'JavaScript': '.js',
            'TypeScript': '.ts',
            'Java': '.java',
            'Go': '.go',
            'Rust': '.rs',
            'C++': '.cpp'
        }
    
    def generate_sample_embedding_vector(self, dimensions: int = 768) -> List[float]:
        """Generate a realistic sample embedding vector."""
        # Use a more realistic distribution for embeddings
        # Most values should be close to 0, with some larger positive/negative values
        vector = []
        for _ in range(dimensions):
            # Use normal distribution centered at 0 with std dev of 0.3
            # This mimics real embedding distributions
            value = random.gauss(0, 0.3)
            # Clip extreme values
            value = max(-1.0, min(1.0, value))
            vector.append(value)
        return vector
    
    def generate_repository_stats(self, repository_name: str) -> Dict[str, Any]:
        """Generate sample repository statistics."""
        # Generate language distribution
        num_languages = random.randint(2, 5)
        selected_languages = random.sample(self.languages, num_languages)
        
        total_lines = random.randint(5000, 50000)
        language_distribution = {}
        remaining_lines = total_lines
        
        for i, lang in enumerate(selected_languages):
            if i == len(selected_languages) - 1:
                # Last language gets remaining lines
                lines = remaining_lines
            else:
                # Random percentage of remaining lines
                percentage = random.uniform(0.1, 0.6)
                lines = int(remaining_lines * percentage)
                remaining_lines -= lines
            
            language_distribution[lang] = lines
        
        # Generate file type distribution
        file_types = {}
        for lang, lines in language_distribution.items():
            ext = self.file_extensions[lang]
            # Estimate files based on average lines per file (100-200)
            num_files = max(1, lines // random.randint(100, 200))
            file_types[ext] = num_files
        
        # Add some common file types
        file_types['.md'] = random.randint(1, 10)
        file_types['.json'] = random.randint(1, 5)
        file_types['.yml'] = random.randint(0, 3)
        
        # Generate commit activity (last 30 days)
        commit_activity = []
        base_date = datetime.now() - timedelta(days=30)
        
        for i in range(30):
            date = base_date + timedelta(days=i)
            commits = random.randint(0, 10)
            commit_activity.append({
                'date': date.strftime('%Y-%m-%d'),
                'commits': commits
            })
        
        # Generate complexity metrics
        complexity = {
            'average': round(random.uniform(2.0, 8.0), 1),
            'max': random.randint(8, 25),
            'distribution': {
                'low': random.randint(60, 90),
                'medium': random.randint(5, 25),
                'high': random.randint(0, 15)
            }
        }
        
        return {
            'languages': language_distribution,
            'fileTypes': file_types,
            'commitActivity': commit_activity,
            'contributors': random.randint(1, 15),
            'complexity': complexity,
            'totalFiles': sum(file_types.values()),
            'totalLines': total_lines,
            'lastAnalysis': datetime.now().isoformat(),
            'codeQuality': {
                'score': round(random.uniform(6.5, 9.5), 1),
                'issues': random.randint(0, 25),
                'coverage': round(random.uniform(60, 95), 1)
            }
        }
    
    def _calculate_similarity_score(self, query: str, code: str) -> float:
        """Calculate a realistic similarity score based on query and code content."""
        query_lower = query.lower()
        code_lower = code.lower()
        
        # Base score
        base_score = 0.3
        
        # Exact word matches
        query_words = set(re.findall(r'\w+', query_lower))
        code_words = set(re.findall(r'\w+', code_lower))
        word_matches = len(query_words.intersection(code_words))
        word_score = min(0.4, word_matches * 0.1)
        
        # Function/class name matches
        if any(word in code_lower for word in ['def ', 'function ', 'class ', 'func ']):
            if any(word in query_lower for word in ['function', 'class', 'method']):
                word_score += 0.2
        
        # Concept matches
        concepts = {
            'auth': ['login', 'authenticate', 'token', 'password', 'user'],
            'database': ['db', 'query', 'collection', 'insert', 'save'],
            'api': ['endpoint', 'route', 'request', 'response', 'http'],
            'error': ['try', 'catch', 'except', 'error', 'exception'],
            'async': ['async', 'await', 'promise', 'future']
        }
        
        for concept, keywords in concepts.items():
            if concept in query_lower:
                concept_matches = sum(1 for kw in keywords if kw in code_lower)
                word_score += min(0.15, concept_matches * 0.03)
        
        total_score = base_score + word_score
        return min(0.95, max(0.1, total_score + random.uniform(-0.05, 0.05)))
    
    def generate_search_results(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Generate sample code search results with realistic similarity scoring."""
        results = []
        
        # Sample code patterns with matching file extensions and languages
        code_samples = [
            {
                'code': '''def analyze_repository(repo_path: str) -> Dict[str, Any]:
    """Analyze code structure and metrics for a repository."""
    ast_parser = ASTParser()
    nodes = ast_parser.parse_directory(repo_path)
    
    metrics = {
        'total_files': len(nodes),
        'complexity': calculate_complexity(nodes),
        'dependencies': extract_dependencies(nodes)
    }
    
    return metrics''',
                'file_path': 'src/analyzer/core.py',
                'language': 'python'
            },
            {
                'code': '''async function fetchRepositoryData(repoId: string): Promise<RepositoryData> {
    // Fetch repository metadata and analysis results
    try {
        const response = await api.get(`/repositories/${repoId}`);
        const data = response.data;
        
        return {
            name: data.name,
            metrics: data.analysis_results,
            lastAnalyzed: new Date(data.updated_at)
        };
    } catch (error) {
        console.error('Failed to fetch repository data:', error);
        throw error;
    }
}''',
                'file_path': 'src/services/api.ts',
                'language': 'typescript'
            },
            {
                'code': '''func ProcessCodebase(repoPath string) (*AnalysisResult, error) {
    // Walk through all files in the repository
    var files []string
    
    err := filepath.Walk(repoPath, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }
        
        if !info.IsDir() && isCodeFile(path) {
            files = append(files, path)
        }
        return nil
    })
    
    if err != nil {
        return nil, fmt.Errorf("failed to walk directory: %w", err)
    }
    
    return analyzeFiles(files), nil
}''',
                'file_path': 'cmd/analyzer/main.go',
                'language': 'go'
            },
            {
                'code': '''class CodeAnalyzer:
    """Main class for analyzing code repositories."""
    
    def __init__(self, config: Config):
        self.config = config
        self.parser = ASTParser()
        self.embedding_service = EmbeddingService()
        self.database = DatabaseService()
    
    def analyze_repository(self, repo_url: str) -> AnalysisResult:
        """Perform complete repository analysis."""
        repo = self._clone_repository(repo_url)
        nodes = self._extract_code_nodes(repo)
        embeddings = self._generate_embeddings(nodes)
        
        return AnalysisResult(
            nodes=nodes,
            embeddings=embeddings,
            metrics=self._calculate_metrics(nodes)
        )''',
                'file_path': 'src/analyzer/core.py',
                'language': 'python'
            },
            {
                'code': '''class RepositoryProcessor {
    constructor(config: Config) {
        this.config = config;
        this.gitService = new GitService();
        this.astParser = new ASTParser();
        this.metrics = new MetricsCalculator();
    }
    
    async processRepository(repoUrl: string, branch = 'main'): Promise<AnalysisResult> {
        const tempDir = await this.gitService.clone(repoUrl, branch);
        
        try {
            const files = await this.scanFiles(tempDir);
            const analysis = await this.analyzeFiles(files);
            
            return {
                repository: repoUrl,
                branch: branch,
                results: analysis,
                timestamp: new Date()
            };
        } finally {
            await fs.rmdir(tempDir, { recursive: true });
        }
    }
}''',
                'file_path': 'src/processors/repository.ts',
                'language': 'typescript'
            },
            {
                'code': '''public class DatabaseService {
    private final ArangoDatabase database;
    private final ObjectMapper mapper;
    
    public DatabaseService(DatabaseConfig config) {
        this.database = new ArangoDB.Builder()
            .host(config.getHost())
            .port(config.getPort())
            .user(config.getUsername())
            .password(config.getPassword())
            .build()
            .db(config.getDatabase());
        this.mapper = new ObjectMapper();
    }
    
    public void saveCodeNode(CodeNode node) {
        try {
            String json = mapper.writeValueAsString(node);
            database.collection("codeNodes").insertDocument(json);
        } catch (Exception e) {
            logger.error("Failed to save code node", e);
            throw new DatabaseException("Save operation failed", e);
        }
    }
}''',
                'file_path': 'src/services/DatabaseService.java',
                'language': 'java'
            },
            {
                'code': '''@app.route('/api/auth/login', methods=['POST'])
def login():
    """Handle user authentication."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = User.authenticate(username, password)
    if user:
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'token': token,
            'user': user.to_dict()
        })
    
    return jsonify({'error': 'Invalid credentials'}), 401''',
                'file_path': 'src/auth/routes.py',
                'language': 'python'
            },
            {
                'code': '''const authenticateUser = async (credentials: LoginCredentials): Promise<AuthResult> => {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
        throw new Error('Authentication failed');
    }
    
    const data = await response.json();
    
    // Store token in localStorage
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
};''',
                'file_path': 'src/auth/service.ts',
                'language': 'typescript'
            },
            {
                'code': '''try:
    with open(file_path, 'r') as f:
        content = f.read()
    
    result = parse_code(content)
    return result
    
except FileNotFoundError:
    logger.error(f"File not found: {file_path}")
    raise CodeAnalysisError(f"Source file not found: {file_path}")
except SyntaxError as e:
    logger.warning(f"Syntax error in {file_path}: {e}")
    return None
except Exception as e:
    logger.error(f"Unexpected error processing {file_path}: {e}")
    raise''',
                'file_path': 'src/parsers/base.py',
                'language': 'python'
            },
            {
                'code': '''try {
    const result = await processCodebase(repoPath);
    
    if (!result.success) {
        throw new Error(`Analysis failed: ${result.error}`);
    }
    
    await saveResults(result.data);
    return result.data;
    
} catch (error) {
    if (error instanceof ValidationError) {
        logger.warn('Validation failed:', error.message);
        throw new BadRequestError(error.message);
    }
    
    logger.error('Unexpected error during analysis:', error);
    throw new InternalServerError('Analysis failed');
}''',
                'file_path': 'src/handlers/analysis.ts',
                'language': 'typescript'
            }
        ]
        
        # Generate results with realistic similarity scoring
        for sample in code_samples:
            score = self._calculate_similarity_score(query, sample['code'])
            line_number = random.randint(1, 500)
            
            # Generate embedding vector
            embedding_vector = self.generate_sample_embedding_vector()
            
            results.append({
                'file_path': sample['file_path'],
                'line_number': line_number,
                'content': sample['code'],
                'score': score,
                'language': sample['language'],
                'context': {
                    'before': '    # Previous code context',
                    'after': '    # Following code context'
                },
                'embedding': {
                    'model': 'nomic-embed-text',
                    'dimensions': 768,
                    'vector': embedding_vector,
                    'similarity_method': 'cosine'
                }
            })
        
        # Add some additional random variations
        additional_samples = random.sample(code_samples, min(3, len(code_samples)))
        for sample in additional_samples:
            # Slightly modify the file path
            modified_path = sample['file_path'].replace('src/', 'tests/').replace('.py', '_test.py').replace('.ts', '.test.ts')
            score = self._calculate_similarity_score(query, sample['code']) * 0.8  # Lower score for test files
            
            # Generate embedding vector
            embedding_vector = self.generate_sample_embedding_vector()
            
            results.append({
                'file_path': modified_path,
                'line_number': random.randint(1, 200),
                'content': sample['code'][:200] + '...',  # Truncated content
                'score': score,
                'language': sample['language'],
                'context': {
                    'before': '    # Test setup',
                    'after': '    # Test assertions'
                },
                'embedding': {
                    'model': 'nomic-embed-text',
                    'dimensions': 768,
                    'vector': embedding_vector,
                    'similarity_method': 'cosine'
                }
            })
        
        # Sort by score (descending)
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return results[:limit]
    
    def generate_system_metrics(self) -> Dict[str, Any]:
        """Generate sample system performance metrics."""
        return {
            'api_requests': {
                'total': random.randint(1000, 10000),
                'per_minute': random.randint(5, 50),
                'success_rate': round(random.uniform(95, 99.9), 1)
            },
            'database': {
                'connections': random.randint(1, 10),
                'query_time_avg': round(random.uniform(10, 100), 1),
                'collections': ['repositories', 'codeNodes', 'edges', 'embeddings']
            },
            'analysis_jobs': {
                'completed_today': random.randint(0, 25),
                'average_duration': random.randint(30, 300),
                'success_rate': round(random.uniform(90, 99), 1)
            },
            'embedding_service': {
                'model': 'nomic-embed-text',
                'provider': 'Ollama',
                'dimensions': 768,
                'requests_today': random.randint(100, 5000),
                'avg_response_time': round(random.uniform(50, 300), 1)
            }
        }

# Global instance
sample_data = SampleDataProvider()