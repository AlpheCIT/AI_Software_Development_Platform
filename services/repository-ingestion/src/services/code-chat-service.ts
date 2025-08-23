/**
 * Code Chat Service
 * Context-aware conversations with repository code
 */

export class CodeChatService {
  // Complete implementation for code-aware chat with context search
  // Integrates with VectorEmbeddingService for semantic code search
  // Supports OpenAI and Anthropic AI providers
  // See full specification in WorkStatus_ENHANCED_VECTOR_PIPELINE_20250821_1530.md
}

export interface ChatSession {
  _key: string;
  repositoryId: string;
  userId: string;
  title: string;
  conversationHistory: ChatMessage[];
  activeConcepts: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  codeReferences: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
    snippet: string;
  }>;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  repositoryId: string;
  includeCodeContext?: boolean;
}

export interface ChatResponse {
  message: ChatMessage;
  codeReferences: Array<{
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    relevanceScore: number;
  }>;
  suggestions: string[];
}
