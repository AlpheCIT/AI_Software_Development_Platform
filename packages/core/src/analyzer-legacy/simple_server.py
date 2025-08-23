#!/usr/bin/env python3
"""
Simple FastAPI server to serve story data from JSON file.
This avoids the module conflicts in the main app.py.
"""

import json
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Create FastAPI app
app = FastAPI(
    title="Code Management Analyzer API",
    description="Simple API server for story data",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        #"http://localhost:3000",
        #"http://localhost:3001", 
        "http://localhost:3002",
        #"http://localhost:3003",
        #"http://localhost:3004",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to the JSON data file
JSON_DATA_PATH = Path(__file__).parent.parent / "frontend" / "public" / "Code_To_Implement" / "user_stories_data.json"

def load_project_data():
    """Load project data from JSON file."""
    try:
        with open(JSON_DATA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading project data: {e}")
        return None

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "simple-backend"}

@app.get("/api/stories")
async def get_stories():
    """Get all stories from JSON data."""
    data = load_project_data()
    if data is None:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to load project data"}
        )
    return data

@app.put("/api/stories/{story_id}/move")
async def move_story(story_id: str, move_data: dict):
    """Move a story to a different status."""
    # For now, just return success
    # In a real implementation, this would update the data
    return {"success": True, "message": f"Story {story_id} moved to {move_data.get('status')}"}

@app.get("/api/jira/sync-conflicts")
async def get_sync_conflicts():
    """Get sync conflicts from stories data."""
    data = load_project_data()
    if data is None:
        return {"conflicts": []}
    
    conflicts = []
    for story in data.get("stories", []):
        if story.get("sync_conflicts"):
            conflicts.extend(story["sync_conflicts"])
    
    return {"conflicts": conflicts}

@app.post("/api/jira/resolve-conflict")
async def resolve_sync_conflict(conflict_data: dict):
    """Resolve a sync conflict."""
    # For now, just return success
    # In a real implementation, this would update the data
    return {"success": True, "message": "Conflict resolved"}

@app.get("/api/jira/board-config")
async def get_jira_board_config():
    """Get Jira board configuration."""
    # Return a default board config
    return {
        "columns": [
            {"id": "backlog", "name": "Backlog", "color": "gray", "order": 0},
            {"id": "todo", "name": "To Do", "color": "blue", "order": 1},
            {"id": "inprogress", "name": "In Progress", "color": "yellow", "order": 2},
            {"id": "review", "name": "Review", "color": "orange", "order": 3},
            {"id": "done", "name": "Done", "color": "green", "order": 4}
        ]
    }

@app.get("/api/jira/health")
async def jira_health():
    """Jira integration health check."""
    return {"status": "healthy", "service": "jira"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
