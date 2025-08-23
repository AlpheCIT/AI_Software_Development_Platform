# backend/ai-processing/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
import uvicorn

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis client setup
redis_client = redis.Redis(host='pubsub', port=6379, decode_responses=True)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AI Processing Service is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)