# Setup Guide

## Quick Start with Docker

```bash
# Clone and start
git clone https://github.com/AlpheCIT/Code_Management_Analyzer.git
cd Code_Management_Analyzer
docker-compose up -d
```

## Manual Setup

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Database
```bash
docker run -d --name arangodb -p 8529:8529 arangodb/arangodb
```

## Environment Variables

Copy `.env.example` to `.env` and configure:
- Database connection strings
- API keys for Jira/GitHub integration
- Frontend/backend URLs

## First Run

1. Access frontend at http://localhost:3002
2. Navigate to /projects for project management
3. Configure Jira integration in /integrations
4. Import or create your first project
