# Technical Debt Database Storage

## Overview

The technical debt analysis system now stores historical data in ArangoDB for real trend tracking and analysis over time.

## Database Collections

### 1. `technical_debt_analyses`
Stores complete analysis results for each run.

**Example Document:**
```json
{
  "_key": "analysis_20250802_213358",
  "project_id": "Code_Management_Analyzer",
  "analysis_date": "2025-08-02T21:33:58.000Z",
  "total_files_analyzed": 50,
  "average_debt_score": 46.17,
  "maximum_debt_score": 100,
  "total_hotspots": 10,
  "total_remediation_hours": 55.7,
  "severity_distribution": {
    "low": 0,
    "medium": 3,
    "high": 0,
    "critical": 7
  },
  "team_allocations": [...],
  "recommendations": [...]
}
```

### 2. `debt_hotspots`
Stores individual file analysis results linked to analysis runs.

**Example Document:**
```json
{
  "_key": "hotspot_analysis_20250802_213358_001",
  "analysis_id": "analysis_20250802_213358",
  "analysis_date": "2025-08-02T21:33:58.000Z",
  "file_path": "real_backend.py",
  "debt_score": 100,
  "severity": "critical",
  "primary_issues": ["High Complexity", "Code Duplication", "Low Test Coverage"],
  "estimated_hours": 4.5,
  "last_modified": "2025-08-02T19:10:35.065Z",
  "change_frequency": 21,
  "metrics": {...}
}
```

### 3. `debt_trends`
Stores daily aggregated trend data for charts and historical analysis.

**Example Document:**
```json
{
  "_key": "trend_Code_Management_Analyzer_20250802",
  "project_id": "Code_Management_Analyzer",
  "date": "2025-08-02",
  "total_debt_score": 46.17,
  "file_count": 50,
  "resolved_debt": 0,
  "new_debt": 0,
  "hotspots_count": 10,
  "critical_issues": 7,
  "high_issues": 0,
  "medium_issues": 3,
  "low_issues": 0,
  "total_remediation_hours": 55.7
}
```

### 4. `debt_recommendations`
Stores actionable recommendations with tracking status.

## API Endpoints with Database Integration

### Analysis Storage
- **`GET /api/debt/analysis`** - Now automatically stores results in database
- Returns `analysis_id` when successfully stored

### Historical Trends
- **`GET /api/debt/trends`** - Uses real database data when available
- Falls back to simulated data if no historical data exists
- Returns `data_source: "database"` or `data_source: "simulated"`

### Database Status
- **`GET /api/debt/database-status`** - Check connection and statistics
- Shows recent analysis and trend counts

### File History
- **`GET /api/debt/file-history/{file_path}`** - Get debt score history for specific files

## Configuration

### Environment Variables
```bash
ARANGO_HOST=localhost          # ArangoDB server host
ARANGO_PORT=8529              # ArangoDB server port  
ARANGO_USER=root          # Database username
ARANGO_PASSWORD=<your-arango-password> # Database password (required)
ARANGO_DATABASE=ARANGO_AISDP_DB # Database name
```

### Database Initialization
```bash
# Initialize database collections and indexes
python scripts/init_debt_database.py
```

## Benefits

### ✅ Real Historical Tracking
- Track actual debt score changes over time
- Monitor improvement/degradation trends
- Identify patterns in code quality

### ✅ File-Level History
- See how individual files' debt scores evolve
- Track remediation efforts effectiveness
- Identify persistent problem files

### ✅ Team Performance Metrics
- Measure team effectiveness at reducing technical debt
- Track remediation velocity
- Plan future debt reduction sprints

### ✅ Accurate Trend Analysis
- Real data instead of simulated projections
- Detect actual improvement or degradation
- Evidence-based decision making

## Usage Example

1. **Run Analysis** (automatically stores):
   ```bash
   curl -X GET "http://localhost:8002/api/debt/analysis"
   ```

2. **Check Trends** (uses real data):
   ```bash
   curl -X GET "http://localhost:8002/api/debt/trends?days=30"
   ```

3. **File History**:
   ```bash
   curl -X GET "http://localhost:8002/api/debt/file-history/real_backend.py"
   ```

4. **Database Status**:
   ```bash
   curl -X GET "http://localhost:8002/api/debt/database-status"
   ```

## Data Retention

- Analysis results: Stored indefinitely
- Trend data: Daily aggregation, stored indefinitely  
- Hotspots: Linked to analysis runs, stored indefinitely
- Recommendations: Tracked until resolved

The system provides both immediate insights and long-term trend analysis for effective technical debt management.
