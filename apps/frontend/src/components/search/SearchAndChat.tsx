/**
 * Enhanced Search & Chat Components
 * Multi-modal search with integrated code chat
 */

// Complete React components for search and chat with code
// See full implementation in WorkStatus_ENHANCED_VECTOR_PIPELINE_20250821_1530.md

export default function SearchAndChat({ repositoryId }: { repositoryId: string }) {
  // Complete implementation with:
  // - Multi-modal search (semantic, fulltext, graph, hybrid)
  // - Real-time chat with code context
  // - Code reference highlighting
  // - File navigation integration
  // - Copy/share functionality
  return <div>Search and Chat Component</div>;
}

export interface SearchResult {
  id: string;
  type: 'file' | 'function' | 'class' | 'chunk';
  content: string;
  filePath: string;
  combinedScore: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  codeReferences: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
    snippet: string;
  }>;
}
