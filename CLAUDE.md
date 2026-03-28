# AI Software Development Platform

## Architecture Overview
A multi-service platform that ingests GitHub repositories, performs AI-powered code analysis using multiple coordinating agents, stores results in an ArangoDB graph database, and displays insights via a React frontend. Services communicate via REST APIs and WebSockets. The AI agent system uses a custom A2A (Agent-to-Agent) protocol and CCI (Code Context Intelligence) framework for multi-agent collaboration.

## Services & Ports
| Service | Port | Framework | Description |
|---------|------|-----------|-------------|
| Frontend | 3000 | Vite + React 18 | Web dashboard with graph visualization, Kanban board, search |
| API Gateway | 8000 | Fastify + Mercurius (GraphQL) | Main API gateway with REST and GraphQL endpoints |
| Repository Ingestion | 8002 | Fastify | Code ingestion pipeline using tree-sitter, Babel, ts-morph |
| AI Orchestration | 8003 | Fastify | Multi-agent AI analysis with A2A protocol |
| Jira Integration | 3005 | Fastify | Bidirectional Jira sync with webhooks |
| Vector Search | 8005 | Express | Semantic code search and GraphRAG |
| WebSocket | 4001 | Express + Socket.IO | Real-time event broadcasting |
| ArangoDB | 8529 | - | Graph database |
| Redis | 6379 | - | Caching and pub/sub |
| ArangoDB MCP Server | stdio | MCP SDK | Claude Desktop integration for direct DB access |

## Key Directories
- `apps/frontend/` - React/TypeScript frontend (Vite, Chakra UI, Zustand, @antv/g6, React Query)
- `services/api-gateway/` - Main API gateway (Fastify, Mercurius GraphQL, Redis caching)
- `services/ai-orchestration/` - Multi-agent AI analysis system (Fastify, A2A protocol)
- `services/repository-ingestion/` - Code ingestion pipeline (Fastify, tree-sitter, Babel, ts-morph, simple-git)
- `services/vector-search/` - Semantic code search and GraphRAG (Express, arangojs)
- `services/jira-integration/` - Bidirectional Jira sync (Fastify, node-cron, axios)
- `services/websocket/` - Real-time updates (Express, Socket.IO, Redis pub/sub)
- `arangodb-ai-platform-mcp/` - ArangoDB MCP server for Claude integration (@modelcontextprotocol/sdk)
- `packages/core/src/analysis/` - Python analysis pipeline (repository_processor, schema_manager, database_manager)
- `scripts/` - Utility and setup scripts
- `tests/` - Test directory (mostly empty)

## Database
- **ArangoDB** (connection via env vars: `ARANGO_URL`, `ARANGO_DB`/`ARANGO_DATABASE`, `ARANGO_USERNAME`, `ARANGO_PASSWORD`)
- Default DB name: `ARANGO_AISDP_DB`
- ~170 collections (135 document, 35 edge)
- Named graph: `knowledge_graph`
- Key edge collections: `depends_on`, `imports`, `calls`, `relationships`, `dependencies`

## Agent System
- Base class: `services/ai-orchestration/src/agents/enhanced-base-agent.ts`
- Protocol: `services/ai-orchestration/src/communication/a2a-protocol.ts`
- Communication bus: `services/ai-orchestration/src/communication/a2a-communication-bus.ts`
- Domains: SECURITY, PERFORMANCE, ARCHITECTURE, COORDINATION, NAVIGATION, DEPENDENCY, QUALITY, BUSINESS
- Agents: enhanced-security-agent, enhanced-performance-agent, security-expert-agent, performance-expert-agent, code-navigation-agent, agent-collaboration-manager

## Development Setup
1. Ensure ArangoDB is running (default port 8529, configured via `.env`)
2. Ensure Redis is running (default port 6379)
3. `npm install` in root and each service directory
4. Start services individually with `npm run dev` in each service directory, or use `docker-compose up`
5. Frontend dev server: `cd apps/frontend && npm run dev` (port 3000)

## Common Commands
- `npm run dev` - Start any service in watch mode (per-service)
- `npm run build` - Build TypeScript (per-service)
- `docker-compose up` - Start all infrastructure (ArangoDB, Redis, API Gateway, WebSocket, Vector Search, Frontend)
- `node enhance-repository-data.js` - Enrich repository data in ArangoDB
- `node verify-database-data.js` - Verify database contents

## Known Gaps (as of March 2026)
- Ingestion pipeline does not extract dependencies from package.json/requirements.txt
- No framework/middleware detection during ingestion
- No API endpoint extraction during ingestion
- Git commit history extracted but not stored in ArangoDB
- Documentation coverage not measured during ingestion
- Graph edge collections mostly empty -- need population via ingestion
- 20+ backend endpoints not exposed to frontend (AI Orchestration, Vector Search)
- `WhatIfSimulation.tsx` is 100% mocked
- No test suite (only 1 test file exists)
- No CI/CD pipeline
