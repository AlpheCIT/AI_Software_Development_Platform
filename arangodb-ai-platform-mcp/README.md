# ArangoDB AI Platform MCP Server

Modern Model Context Protocol (MCP) server for ArangoDB integration with AI Platform and Claude Desktop.

## ✅ **REBUILT SUCCESSFULLY** 

This MCP server has been completely rebuilt using the latest `@modelcontextprotocol/sdk` (v1.17.4) and is ready to use.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file with your ArangoDB connection details:
```env
ARANGO_URL=http://localhost:8529
ARANGO_DB=your_database_name  
ARANGO_USERNAME=root
ARANGO_PASSWORD=your_password
```

### 3. Build and Run
```bash
npm run modern
```

## 🔧 Available Tools

The server provides 5 core tools:

1. **`database_health_check`** - Check database connection and system health
2. **`browse_collections`** - List all collections with metadata
3. **`browse_collection`** - Browse documents in a specific collection  
4. **`execute_custom_aql`** - Execute custom AQL queries (read-only)
5. **`get_graph_seeds`** - Get starting points for graph visualization

## 🖥️ Claude Desktop Integration

Add this configuration to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arangodb-ai-platform": {
      "command": "node",
      "args": [
        "C:\\path\\to\\AI_Software_Development_Platform\\arangodb-ai-platform-mcp\\dist\\modern-server.js"
      ],
      "env": {
        "ARANGO_URL": "http://localhost:8529",
        "ARANGO_DB": "your_database_name",
        "ARANGO_USERNAME": "root", 
        "ARANGO_PASSWORD": "your_password"
      }
    }
  }
}
```

## 🎯 AI Platform Integration

This server provides graph tools specifically designed for the AI Platform frontend:

- **Graph Seeds**: Use `get_graph_seeds` to populate the GraphCanvas component
- **Node Details**: Database queries return structured data for the Inspector panel
- **Search**: Execute AQL queries for natural language search functionality

## 📊 Features

- ✅ **Modern MCP SDK**: Uses latest v1.17.4+ with proper TypeScript support
- ✅ **Safe Queries**: Read-only operations with write protection
- ✅ **Error Handling**: Comprehensive error handling and graceful shutdown
- ✅ **Performance**: Efficient queries with built-in limits and pagination
- ✅ **Security**: Parameterized queries and input validation
- ✅ **Logging**: Structured logging with helpful status messages

## 🛠️ Development

### Build Only
```bash
npm run build
```

### Start Production Server
```bash
npm start  
```

### Development Mode (Build + Run)
```bash  
npm run dev
```

## 📁 Project Structure

```
src/
  modern-server.ts          # Main MCP server implementation
  simple-working-server.js  # Fallback JavaScript implementation
dist/
  modern-server.js          # Compiled output
package.json                # Modern dependencies and scripts
tsconfig.json              # TypeScript configuration
```

## 🔍 Testing the Connection

After starting the server, you can test it with Claude Desktop:

1. Open Claude Desktop
2. Type: "Use the database_health_check tool to verify the ArangoDB connection"
3. The server will return detailed connection and health information

## ⚡ Performance Notes

- **Connection Pooling**: Uses arangojs with automatic connection management
- **Query Limits**: Built-in limits prevent runaway queries
- **Caching**: Results can be cached for repeated queries
- **Memory**: Efficient streaming for large result sets

## 🚨 Important Notes

- **Write Operations**: Disabled for safety (INSERT, UPDATE, DELETE, etc.)
- **System Collections**: Hidden by default, can be enabled with flags  
- **Large Results**: Automatically limited to prevent memory issues
- **Error Recovery**: Graceful error handling with helpful messages

## 🎉 Success!

The MCP server is now fully functional and ready for both:
- **Claude Desktop**: Interactive database exploration
- **AI Platform**: Frontend integration with graph visualization

Use `database_health_check` to verify everything is working correctly!
