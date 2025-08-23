#!/usr/bin/env python3
"""
Code Management Analyzer - FastAPI Backend Entry Point
"""

import uvicorn
from api.app import app

if __name__ == "__main__":
    uvicorn.run(
        "api.app:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )
