# backend/vector-search/main.py  
from fastapi import FastAPI  
from fastapi.middleware.cors import CORSMiddleware  
from arango import ArangoClient  
import uvicorn  
  
app = FastAPI()  
  
app.add_middleware(  
    CORSMiddleware,  
    allow_origins=["*"],  
    allow_credentials=True,  
    allow_methods=["*"],  
    allow_headers=["*"],  
)  
  
client = ArangoClient(hosts='http://graph-db:8529')  
  
@app.get("/health")  
async def health_check():  
    return {"status": "ok", "message": "Vector Search Service is running"}  
  
if __name__ == "__main__":  
    uvicorn.run(app, host="0.0.0.0", port=8000)  