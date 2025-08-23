# Frontend-API Endpoint Mapping Table - Enhanced Version with Implementation Status

## Overview
This document maintains a comprehensive mapping between frontend pages/components and the backend API endpoints they consume. It serves as a reference for understanding data flow, dependencies, and integration points across the application.

**⚠️ IMPORTANT NOTICE:** This document has been updated to reflect the current implementation status of endpoints in `real_backend.py`. Many endpoints shown below are **NOT YET IMPLEMENTED** in the actual backend.

**Last Updated:** January 2025  
**Version:** 2.1 - Added Implementation Status Column  
**Backend Status:** Partial implementation - many endpoints missing

---

## 🚨 Implementation Status Legend
- ✅ **IMPLEMENTED** - Endpoint exists and working in real_backend.py
- 🔄 **PARTIAL** - Basic functionality exists but incomplete
- ❌ **NOT IMPLEMENTED** - Endpoint missing from backend
- 🚧 **PLANNED** - In development roadmap

---

## Core Dashboard & System Status

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes | Status |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|--------|
| /dashboard (Dashboard.tsx) | GET | /api/v1/system/status | System health and status | ❌ | `{ status, uptime_seconds, memory_usage, ... }` | Refreshes every 30s | ✅ **IMPLEMENTED** |
| /dashboard (Dashboard.tsx) | GET | /api/v1/embeddings/info | Embedding service details | ❌ | `{ model, dimensions, performance }` | Shows service capabilities | ❌ **NOT IMPLEMENTED** |
| /dashboard (Dashboard.tsx) | GET | /api/v1/repositories | Repository list and stats | ❌ | `{ repositories[], total_count }` | Main repository data | 🔄 **PARTIAL** (Basic GET only) |
| /dashboard (Dashboard.tsx) | POST | /api/v1/embeddings/test | Test embedding service | ❌ | `{ success, data: { dimensions, cached } }` | Health check functionality | ❌ **NOT IMPLEMENTED** |
| /advanced-dashboard (AdvancedDashboard.tsx) | GET | /api/v1/system/status | Enhanced system metrics | ❌ | `{ database, uptime, active_jobs }` | Real-time updates every 5s | ✅ **IMPLEMENTED** |
| /system-status (SystemStatus.tsx) | GET | /api/v1/system/metrics | Detailed performance metrics | ❌ | `{ cpu_usage, memory_usage, disk_usage }` | Updates every 10s | ❌ **NOT IMPLEMENTED** |
| **NEW** /dashboard | GET | /api/v1/system/alerts | Active system alerts | ❌ | `{ alerts[], severity_counts }` | Critical system notifications | ❌ **NOT IMPLEMENTED** |
| **NEW** /dashboard | GET | /api/v1/system/health-check | Comprehensive health check | ❌ | `{ services[], overall_health }` | All service dependencies | ❌ **NOT IMPLEMENTED** |
| **NEW** /dashboard | GET | /api/v1/analytics/summary | Dashboard analytics summary | ❌ | `{ user_activity, popular_features }` | Usage metrics | ❌ **NOT IMPLEMENTED** |

---

## Repository Management

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes | Status |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|--------|
| /repositories (RepositoryManagement.tsx) | GET | /api/v1/repositories | List all repositories | ❌ | `{ repositories[], total_count }` | Real-time updates every 15s | 🔄 **PARTIAL** (Basic GET only) |
| /repositories (RepositoryManagement.tsx) | POST | /api/v1/repositories | Add new repository | ❌ | `{ success, data: repository }` | Includes auto-analyze option | ❌ **NOT IMPLEMENTED** |
| /repositories (RepositoryManagement.tsx) | DELETE | /api/v1/repositories/{id} | Delete repository | ❌ | `{ success, message }` | Cascade deletes related data | ❌ **NOT IMPLEMENTED** |
| /repositories (RepositoryManagement.tsx) | POST | /api/v1/analysis/analyze | Start repository analysis | ❌ | `{ job_id, status }` | Triggers async processing | ❌ **NOT IMPLEMENTED** |
| /analysis (RepositoryAnalysis.tsx) | POST | /api/v1/analysis/analyze | Analyze repository | ❌ | `{ job_id, status, progress }` | Returns job tracking info | ❌ **NOT IMPLEMENTED** |
| /analysis (RepositoryAnalysis.tsx) | GET | /api/v1/analysis/jobs | Get analysis jobs status | ❌ | `{ jobs[] }` | Real-time job monitoring | ❌ **NOT IMPLEMENTED** |
| **NEW** /repositories | PUT | /api/v1/repositories/{id} | Update repository settings | ❌ | `{ success, updated_repository }` | Configuration updates | ❌ **NOT IMPLEMENTED** |
| **NEW** /repositories | GET | /api/v1/repositories/{id}/stats | Detailed repository statistics | ❌ | `{ files, languages, complexity }` | Enhanced RepositoryStats component | ❌ **NOT IMPLEMENTED** |
| **NEW** /repositories | POST | /api/v1/repositories/{id}/clone | Clone/refresh repository | ❌ | `{ job_id, clone_status }` | Git operations | ❌ **NOT IMPLEMENTED** |
| **NEW** /repositories | GET | /api/v1/repositories/{id}/branches | List repository branches | ❌ | `{ branches[], active_branch }` | Branch management | ❌ **NOT IMPLEMENTED** |
| **NEW** /repositories | POST | /api/v1/repositories/batch-analyze | Analyze multiple repositories | ❌ | `{ batch_job_id, queued_count }` | Bulk operations | ❌ **NOT IMPLEMENTED** |

---

---

## 🎯 ACTUAL WORKING ENDPOINTS (real_backend.py)

Based on current implementation analysis, here are the **ONLY** endpoints that are actually working:

### ✅ Implemented & Working:
1. `GET /api/health` - Basic health check (database connectivity)
2. `GET /api/system/status` - System status with database info
3. `GET /api/stories` - Jira stories listing (with optional pagination)
4. `GET /api/repositories` - Basic repository listing (minimal implementation)
5. `GET /api/ai-analysis/history` - AI analysis history retrieval
6. `GET /api/embedding/info` - Basic embedding service info (placeholder)

### 🔄 Partially Working:
- `/api/repositories` - Only GET method works, no POST/PUT/DELETE
- Stories endpoints - Limited functionality, no Jira connection active

### ❌ Major Missing Categories:
- **All advanced search endpoints** (semantic, hybrid, analytics)
- **Repository CRUD operations** (create, update, delete)
- **Analysis job management** (analyze, job status, progress tracking)
- **Embedding test operations** 
- **System metrics and alerting**
- **User management and analytics**
- **Security and vulnerability scanning**

### 🚨 Impact Assessment:
- **Frontend compatibility**: ~85% of expected endpoints are missing
- **Critical features broken**: Repository management, code search, analysis workflows
- **Working features**: Basic dashboard, health checks, story viewing
- **Immediate fixes needed**: Implement missing CRUD operations or modify frontend expectations

---

## Code Search & Intelligence

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes | Status |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|--------|
| /search (CodeSearch.tsx) | GET | /api/v1/search/simple | Simple text-based search | ❌ | `{ status, results[], count }` | Fast search for names/content | ❌ **NOT IMPLEMENTED** |
| /search (CodeSearch.tsx) | POST | /api/v1/search/unified | Advanced hybrid search | ❌ | `{ results[], total_results, execution_time_ms }` | HybridGraphRAG search |
| /search (CodeSearch.tsx) | POST | /api/v1/search/performance | Performance-optimized search | ❌ | `{ results[], analytics, execution_time_ms }` | Smart routing & optimization |
| /search (CodeSearch.tsx) | GET | /api/v1/search/analytics | Search system analytics | ❌ | `{ total_codeunits, breakdown_by_type[] }` | Database statistics |
| **NEW** /search | POST | /api/v1/search/semantic | Pure semantic search | ❌ | `{ results[], similarity_scores[] }` | Vector-based search only |
| **NEW** /search | POST | /api/v1/search/structural | Pure structural search | ❌ | `{ results[], graph_paths[] }` | Graph-based search only |
| **NEW** /search | GET | /api/v1/search/history | User search history | ✅ | `{ searches[], popular_queries[] }` | Personalized search |
| **NEW** /search | POST | /api/v1/search/save | Save search query | ✅ | `{ saved_search_id }` | Bookmark functionality |
| **NEW** /search | POST | /api/v1/search/suggest | Search suggestions | ❌ | `{ suggestions[], completions[] }` | Auto-complete support |
| **NEW** /advanced-search | POST | /api/v1/search/filters | Apply advanced filters | ❌ | `{ filtered_results[], filter_counts }` | SearchControls component |

---

## AI-Powered Features

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| /ai-refactoring (AIRefactoringDashboard.tsx) | GET | /api/v1/refactoring/system-status | AI system availability | ❌ | `{ ai_refactoring_available, components }` | Service health check |
| /ai-refactoring (AIRefactoringDashboard.tsx) | GET | /api/v1/refactoring/duplicates | Find duplicate code | ❌ | `{ duplicate_groups[], success }` | Code similarity analysis |
| /ai-refactoring (AIRefactoringDashboard.tsx) | GET | /api/v1/refactoring/architectural-inconsistencies | Architecture analysis | ❌ | `{ inconsistencies[] }` | Pattern violations |
| /ai-refactoring (AIRefactoringDashboard.tsx) | POST | /api/v1/similarity/analyze | Similarity analysis | ❌ | `{ similar_items[] }` | Multi-dimensional similarity |
| /ai-refactoring (AIRefactoringDashboard.tsx) | POST | /api/v1/code/purpose-analysis | Code purpose analysis | ❌ | `{ analysis_results[] }` | Semantic understanding |
| ModernSimilarityDashboard.tsx | GET | /api/ai-analysis/history | AI analysis history | ❌ | `{ results[], message }` | Bedrock AI integration |
| ModernSimilarityDashboard.tsx | POST | /api/ast/enhance-similarity-analysis | Enhanced AI analysis | ❌ | `{ success, enhanced_analysis }` | Code pattern analysis |
| **NEW** /ai-refactoring | POST | /api/v1/ai/code-review | AI code review | ✅ | `{ suggestions[], quality_score }` | Automated code review |
| **NEW** /ai-refactoring | POST | /api/v1/ai/refactor-suggestions | Get refactoring suggestions | ❌ | `{ refactoring_options[], complexity_reduction }` | AI-driven refactoring |
| **NEW** /ai-refactoring | POST | /api/v1/ai/generate-tests | Generate test cases | ❌ | `{ test_cases[], coverage_analysis }` | Test generation |
| **NEW** /ai-refactoring | POST | /api/v1/ai/documentation | Generate documentation | ❌ | `{ documentation, comments[] }` | Auto-documentation |
| **NEW** VulnerabilityChat.tsx | POST | /api/security/vulnerability-chat | AI vulnerability assistant | ❌ | `{ response, suggestions[], action_performed }` | Interactive AI chat |

---

## Security Management & Vulnerability Analysis

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| SecurityDashboard.tsx | GET | /api/security/vulnerabilities | List vulnerabilities | ❌ | `{ vulnerabilities[], total }` | Filtered results |
| SecurityDashboard.tsx | POST | /api/security/analyze-current-repo | Run security analysis | ❌ | `{ success, security_analysis }` | Comprehensive scan |
| SecurityDashboard.tsx | GET | /api/security/manager-dashboard | Executive security metrics | ❌ | `{ dashboard_data, executive_metrics }` | Manager overview |
| SecurityDashboard.tsx | POST | /api/security/create-tickets | Create security tickets | ❌ | `{ success, tickets_created }` | JIRA integration |
| SecurityDashboard.tsx | GET | /api/security/file-content/{path} | Get vulnerable file content | ❌ | `{ success, context, lines }` | Code context viewer |
| SecurityDashboard.tsx | POST | /api/security/ai-enhanced-analysis | AI vulnerability analysis | ❌ | `{ success, ai_analysis }` | Detailed AI insights |
| **NEW** SecurityDashboard.tsx | GET | /api/security/compliance-frameworks | Compliance framework status | ❌ | `{ frameworks[], coverage_scores }` | OWASP, SOC2, ISO27001 |
| **NEW** SecurityDashboard.tsx | POST | /api/security/scan-schedule | Schedule security scans | ✅ | `{ schedule_id, next_run }` | Automated scanning |
| **NEW** SecurityDashboard.tsx | GET | /api/security/trends | Security trends analysis | ❌ | `{ trend_data[], vulnerability_lifecycle }` | Historical analysis |
| **NEW** SecurityDashboard.tsx | POST | /api/security/risk-assessment | Risk assessment analysis | ❌ | `{ risk_score, risk_factors[] }` | Business impact analysis |
| **NEW** SecurityDashboard.tsx | GET | /api/security/threat-intelligence | Threat intelligence feed | ❌ | `{ threats[], cve_updates[] }` | External threat data |
| **NEW** SecurityDashboard.tsx | POST | /api/security/remediation-plan | Generate remediation plan | ❌ | `{ plan[], priorities[], timeline }` | Action planning |

---

## Project & Team Management

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| /projects (EnhancedProjectManagement.tsx) | GET | /api/stories | Get user stories | ❌ | `{ stories[], project_info }` | Agile management |
| /projects (EnhancedProjectManagement.tsx) | GET | /api/jira/board-config | Get board configuration | ❌ | `{ columns[], project_key }` | Dynamic board setup |
| /projects (EnhancedProjectManagement.tsx) | POST | /api/stories/status | Update story status | ❌ | `{ success, updated_story }` | Kanban operations |
| SprintBoard.tsx | GET | /api/sprints | List sprints | ❌ | `{ sprints[], current_sprint }` | Sprint management |
| SprintBoard.tsx | POST | /api/sprints/create | Create new sprint | ✅ | `{ sprint_id, success }` | Sprint planning |
| SprintBoard.tsx | POST | /api/sprints/{id}/start | Start sprint | ✅ | `{ success, started_sprint }` | Sprint activation |
| SprintBoard.tsx | POST | /api/sprints/{id}/complete | Complete sprint | ✅ | `{ success, completion_summary }` | Sprint closure |
| TeamCollaboration.tsx | GET | /api/collaboration/sessions | Active collaboration sessions | ❌ | `{ sessions[], participants }` | Real-time features |
| **NEW** /projects | GET | /api/projects/{id}/metrics | Project health metrics | ❌ | `{ velocity, burndown, quality_metrics }` | Project analytics |
| **NEW** /projects | POST | /api/projects/create | Create new project | ✅ | `{ project_id, initial_setup }` | Project initialization |
| **NEW** SprintBoard.tsx | GET | /api/sprints/{id}/burndown | Sprint burndown data | ❌ | `{ burndown_data[], predictions[] }` | Sprint progress tracking |
| **NEW** SprintBoard.tsx | POST | /api/stories/estimate | Estimate story points | ❌ | `{ estimated_points, confidence }` | AI-assisted estimation |
| **NEW** TeamCollaboration.tsx | POST | /api/collaboration/share-analysis | Share analysis results | ✅ | `{ share_id, recipients[] }` | Knowledge sharing |
| **NEW** TeamCollaboration.tsx | GET | /api/team/performance | Team performance metrics | ✅ | `{ individual_metrics[], team_health }` | Team analytics |

---

## Technical Debt & Code Quality

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| TechnicalDebtDashboard.tsx | GET | /api/technical-debt/analysis | Get debt analysis | ❌ | `{ summary, hotspots[], recommendations[] }` | SCRUM-49 implementation |
| TechnicalDebtDashboard.tsx | GET | /api/technical-debt/trends | Debt trends analysis | ❌ | `{ trends[], projection }` | Historical tracking |
| **NEW** TechnicalDebtDashboard.tsx | POST | /api/technical-debt/threshold | Update debt thresholds | ✅ | `{ updated_thresholds, affected_items }` | Configuration management |
| **NEW** TechnicalDebtDashboard.tsx | GET | /api/technical-debt/team-allocation | Team debt allocation | ❌ | `{ team_assignments[], workload_balance }` | Resource planning |
| **NEW** TechnicalDebtDashboard.tsx | POST | /api/technical-debt/remediation-plan | Create remediation plan | ❌ | `{ plan[], estimated_effort, priorities[] }` | Action planning |
| **NEW** /code-quality | GET | /api/quality/metrics | Code quality metrics | ❌ | `{ complexity, maintainability, test_coverage }` | Quality dashboard |
| **NEW** /code-quality | GET | /api/quality/trends | Quality trends over time | ❌ | `{ quality_timeline[], improvement_areas }` | Quality tracking |
| **NEW** /code-quality | POST | /api/quality/standards | Apply quality standards | ✅ | `{ violations[], compliance_score }` | Standards enforcement |

---

## AST Graph & Code Analysis

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| /ast-graph (ASTGraphDashboard.tsx) | GET | /api/ast/schema-status | AST schema status | ❌ | `{ success, schema_status }` | ArangoDB graph schema |
| /ast-graph (ASTGraphDashboard.tsx) | POST | /api/ast/setup-schema | Initialize AST schema | ❌ | `{ success, message }` | Database setup |
| /ast-graph (ASTGraphDashboard.tsx) | POST | /api/ast/populate-sample-data | Add sample AST data | ❌ | `{ success, message }` | Development data |
| /ast-graph (ASTGraphDashboard.tsx) | GET | /api/ast/dead-code | Find unused functions | ❌ | `{ success, dead_code[], count }` | Code quality analysis |
| /ast-graph (ASTGraphDashboard.tsx) | GET | /api/ast/coupling-metrics | Analyze code coupling | ❌ | `{ success, coupling_metrics[] }` | Architecture analysis |
| /ast-graph (ASTGraphDashboard.tsx) | GET | /api/ast/function-dependencies/{id} | Function dependency tree | ❌ | `{ success, dependencies[] }` | Dependency analysis |
| **NEW** /ast-graph | GET | /api/ast/call-graph | Generate call graph | ❌ | `{ nodes[], edges[], entry_points[] }` | Visual code navigation |
| **NEW** /ast-graph | GET | /api/ast/cyclic-dependencies | Find circular dependencies | ❌ | `{ cycles[], severity_levels[] }` | Architecture issues |
| **NEW** /ast-graph | POST | /api/ast/impact-analysis | Analyze change impact | ❌ | `{ affected_components[], risk_assessment }` | Change management |
| **NEW** /ast-graph | GET | /api/ast/complexity-hotspots | Find complexity hotspots | ❌ | `{ hotspots[], complexity_metrics[] }` | Refactoring candidates |

---

## Advanced Analytics & Intelligence

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| /advanced-analytics (AdvancedAnalytics.tsx) | GET | /api/v1/repositories | Repository selection data | ❌ | `{ repositories[] }` | For analytics scope |
| RepositoryIntelligence.tsx | GET | /api/repositories/{id}/intelligence | Repository intelligence | ❌ | `{ insights, metrics, recommendations }` | AI-powered analysis |
| RepositoryIntelligence.tsx | GET | /api/repositories/{id}/quality-metrics | Quality metrics analysis | ❌ | `{ quality_data, trends }` | Quality assessment |
| RepositoryIntelligence.tsx | GET | /api/repositories/{id}/security-analysis | Security analysis | ❌ | `{ vulnerabilities[], compliance_score }` | Security dashboard data |
| RepositoryIntelligence.tsx | GET | /api/repositories/{id}/architecture-analysis | Architecture analysis | ❌ | `{ architecture_score, patterns[] }` | Architectural insights |
| **NEW** /advanced-analytics | GET | /api/analytics/cross-repository | Cross-repository analysis | ❌ | `{ shared_patterns[], reuse_opportunities[] }` | Multi-repo insights |
| **NEW** /advanced-analytics | GET | /api/analytics/developer-productivity | Developer productivity metrics | ✅ | `{ productivity_scores[], bottlenecks[] }` | Team performance |
| **NEW** /advanced-analytics | GET | /api/analytics/technology-trends | Technology usage trends | ❌ | `{ language_trends[], framework_adoption[] }` | Tech stack analysis |
| **NEW** /advanced-analytics | POST | /api/analytics/custom-report | Generate custom reports | ✅ | `{ report_data, export_formats[] }` | Business intelligence |

---

## System Administration & Configuration

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| SetupGuideCard.tsx | GET | /api/setup/guide | Setup guide steps | ❌ | `{ setup_steps[], progress }` | Initial configuration |
| NextStepsCard.tsx | GET | /api/implementation/status | Implementation status | ❌ | `{ completion_summary, areas }` | Development tracking |
| **NEW** /admin | GET | /api/admin/users | User management | ✅ | `{ users[], roles[], permissions[] }` | User administration |
| **NEW** /admin | POST | /api/admin/configuration | Update system config | ✅ | `{ updated_config, restart_required }` | System configuration |
| **NEW** /admin | GET | /api/admin/audit-logs | System audit logs | ✅ | `{ logs[], log_levels[], filters }` | Activity monitoring |
| **NEW** /admin | GET | /api/admin/backup-status | Backup system status | ✅ | `{ last_backup, schedule, health }` | Data protection |
| **NEW** /admin | POST | /api/admin/maintenance | Trigger maintenance tasks | ✅ | `{ task_id, estimated_duration }` | System maintenance |

---

## Notification & Communication

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| NotificationSystem.tsx | GET | /api/notifications | Get user notifications | ✅ | `{ notifications[], unread_count }` | Real-time notifications |
| NotificationSystem.tsx | PUT | /api/notifications/{id}/read | Mark notification as read | ✅ | `{ success }` | Notification management |
| NotificationSystem.tsx | POST | /api/notifications/preferences | Update notification preferences | ✅ | `{ updated_preferences }` | User preferences |
| **NEW** NotificationSystem.tsx | POST | /api/notifications/subscribe | Subscribe to notifications | ✅ | `{ subscription_id }` | Push notifications |
| **NEW** NotificationSystem.tsx | GET | /api/notifications/templates | Get notification templates | ✅ | `{ templates[], categories[] }` | Template management |

---

## Integration Endpoints

| Frontend Page/Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------------|-------------|----------|-------------|---------------|-----------------|-------|
| /integrations (IntegrationsPage.tsx) | GET | /api/v1/integrations/status | Integration service status | ❌ | `{ github, jira, webhooks }` | Service health overview |
| /integrations (IntegrationsPage.tsx) | POST | /api/v1/integrations/github/test | Test GitHub connection | ❌ | `{ status, message }` | Connectivity verification |
| /integrations (IntegrationsPage.tsx) | POST | /api/v1/integrations/jira/test | Test Jira connection | ❌ | `{ status, message }` | Authentication check |
| /integrations (IntegrationsPage.tsx) | GET | /api/github/repositories | GitHub repository list | ❌ | `{ repositories[] }` | External GitHub API proxy |
| /integrations (IntegrationsPage.tsx) | GET | /api/v1/integrations/jira/projects | Jira project list | ❌ | `{ projects[] }` | Available Jira projects |
| JiraSyncManager.tsx | POST | /api/jira/import-stories | Import stories to JIRA | ❌ | `{ success, imported_count }` | Bulk import |
| JiraSyncManager.tsx | POST | /api/sync/database | Sync to ArangoDB | ❌ | `{ success, created, updated }` | Database sync |
| JiraSyncManager.tsx | POST | /api/sync/jira-status | Sync from JIRA | ❌ | `{ success, synced_count }` | Status sync |
| JiraSyncManager.tsx | GET | /api/jira/issue/{key} | Get specific JIRA issue | ❌ | `{ success, issue, story }` | Individual issue |
| **NEW** /integrations | POST | /api/integrations/slack/connect | Connect Slack workspace | ✅ | `{ success, webhook_url }` | Slack integration |
| **NEW** /integrations | GET | /api/integrations/webhooks | List active webhooks | ✅ | `{ webhooks[], event_types[] }` | Webhook management |
| **NEW** /integrations | POST | /api/integrations/gitlab/connect | Connect GitLab instance | ✅ | `{ success, connection_details }` | GitLab integration |
| **NEW** /integrations | GET | /api/integrations/cicd-providers | Available CI/CD providers | ❌ | `{ providers[], supported_features[] }` | CI/CD integration options |

---

## Real-time Updates & WebSocket Connections

| Frontend Component | Connection Type | Endpoint/Channel | Description | Auth Required | Data Format | Notes |
|-------------------|-----------------|------------------|-------------|---------------|-------------|-------|
| useRealTimeRepositories | Polling | /api/v1/repositories | Repository updates | ❌ | `{ repositories[] }` | 15-30s intervals |
| useRealTimeAnalysisJobs | Polling | /api/v1/analysis/jobs | Job status updates | ❌ | `{ jobs[] }` | 3-5s intervals |
| useRealTimeSystemStatus | Polling | /api/v1/system/status | System health | ❌ | `{ status, metrics }` | 5-10s intervals |
| useRealTimeSystemMetrics | Polling | /api/v1/system/metrics | Performance data | ❌ | `{ cpu_usage, memory_usage }` | 10s intervals |
| **NEW** useRealTimeSecurityAlerts | WebSocket | /ws/security-alerts | Real-time security alerts | ✅ | `{ alert, severity, affected_assets }` | Immediate security notifications |
| **NEW** useRealTimeCollaboration | WebSocket | /ws/collaboration/{session_id} | Team collaboration | ✅ | `{ user_action, shared_state }` | Live collaboration features |
| **NEW** useRealTimeBuildStatus | WebSocket | /ws/builds/{project_id} | CI/CD pipeline updates | ✅ | `{ build_status, progress, logs }` | Live build monitoring |
| **NEW** useRealTimeNotifications | WebSocket | /ws/notifications/{user_id} | User notifications | ✅ | `{ notification, type, priority }` | Push notifications |

---

## Mock Data & Development Endpoints

| Frontend Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------|-------------|----------|-------------|---------------|-----------------|-------|
| MockDataWarning.tsx | GET | /api/dev/mock-status | Mock data status | ❌ | `{ is_mock_data, components[] }` | Development mode indicator |
| **NEW** /dev-tools | GET | /api/dev/sample-data | Generate sample data | ❌ | `{ generated_items[], categories[] }` | Development utilities |
| **NEW** /dev-tools | POST | /api/dev/reset-database | Reset to clean state | ❌ | `{ success, reset_items[] }` | Development reset |
| **NEW** /dev-tools | GET | /api/dev/api-docs | API documentation | ❌ | `{ endpoints[], schemas[] }` | Auto-generated docs |

---

## Export & Reporting

| Frontend Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------|-------------|----------|-------------|---------------|-----------------|-------|
| **NEW** /reports | GET | /api/reports/available | Available report types | ✅ | `{ report_types[], formats[] }` | Report catalog |
| **NEW** /reports | POST | /api/reports/generate | Generate custom report | ✅ | `{ report_id, download_url }` | Report generation |
| **NEW** /reports | GET | /api/reports/{id}/download | Download report | ✅ | `Binary/PDF/Excel` | File download |
| **NEW** /export | POST | /api/export/data | Export system data | ✅ | `{ export_id, file_size }` | Data export |
| **NEW** /export | GET | /api/export/templates | Export templates | ✅ | `{ templates[], custom_fields[] }` | Export configuration |

---

## API Response Patterns

### Success Response Format
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message": "Operation completed successfully",
  "timestamp": "2025-01-15T10:30:00Z",
  "request_id": "req_123456789"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error description",
  "error_code": "ERR_001",
  "details": { /* additional error context */ },
  "timestamp": "2025-01-15T10:30:00Z",
  "request_id": "req_123456789"
}
```

### Pagination Format (where applicable)
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 100,
    "pages": 5,
    "has_next": true,
    "has_previous": false
  },
  "sorting": {
    "field": "created_at",
    "direction": "desc"
  }
}
```

---

## Enhanced Error Handling Patterns

### Security Components
- **Pattern:** Toast notifications for scan results, modal dialogs for detailed analysis
- **Error Recovery:** Graceful degradation with mock data when security API unavailable
- **Retry Logic:** Exponential backoff for AI analysis requests (Bedrock)
- **New:** Circuit breaker pattern for external security APIs

### Project Management Components
- **Pattern:** Inline alerts for sync conflicts, progressive disclosure for complex data
- **Error Recovery:** Local state preservation during JIRA sync failures
- **Retry Logic:** Manual retry buttons with loading states
- **New:** Optimistic updates with rollback capability

### Search Components
- **Pattern:** Search-as-you-type with debouncing, progressive result loading
- **Error Recovery:** Fallback to simple search when advanced features fail
- **Retry Logic:** Auto-retry for similarity analysis, manual retry for code context
- **New:** Search cache with stale-while-revalidate strategy

---

## Performance Optimization Notes

### Caching Strategy by Component
- **Security data:** 5-minute cache (vulnerability lists)
- **Project data:** 30-second cache (stories, board config)
- **Search results:** Client-side cache with TTL
- **AST data:** Long-term cache (static analysis results)
- **System metrics:** No cache (real-time monitoring)
- **New:** Redis distributed caching for multi-user scenarios

### Bundle Optimization
- **Code splitting:** Separate bundles for heavy components (Monaco, Chart.js)
- **Lazy loading:** AST Graph and Security dashboards loaded on demand
- **Tree shaking:** Unused Chart.js components excluded
- **New:** Dynamic imports for AI analysis components

---

## Authentication & Security

### Current State
- Most endpoints are public (no authentication required)
- JWT tokens for sensitive operations
- Role-based access control for admin functions

### Enhanced Security (New)
- **API Rate Limiting:** Configurable per endpoint and user role
- **OAuth 2.0 Integration:** GitHub, Google, Microsoft SSO
- **Multi-Factor Authentication:** TOTP and SMS verification
- **API Key Management:** Scoped API keys for integrations
- **Audit Logging:** Comprehensive activity tracking
- **Data Encryption:** End-to-end encryption for sensitive data

### Security Headers & Middleware
```typescript
// Required security headers for all API responses
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

---

## Advanced Feature Endpoints

### Code Intelligence & Analysis

| Frontend Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------|-------------|----------|-------------|---------------|-----------------|-------|
| **NEW** /code-intelligence | GET | /api/intelligence/code-patterns | Detect code patterns | ❌ | `{ patterns[], anti_patterns[], recommendations[] }` | Advanced pattern detection |
| **NEW** /code-intelligence | POST | /api/intelligence/code-similarity-bulk | Bulk similarity analysis | ❌ | `{ similarity_matrix[], clusters[] }` | Large-scale similarity |
| **NEW** /code-intelligence | GET | /api/intelligence/dependency-graph | Complete dependency graph | ❌ | `{ nodes[], edges[], clusters[], critical_paths[] }` | Full dependency visualization |
| **NEW** /code-intelligence | POST | /api/intelligence/refactoring-opportunities | Find refactoring opportunities | ❌ | `{ opportunities[], effort_estimates[], benefits[] }` | Automated refactoring suggestions |
| **NEW** /code-intelligence | GET | /api/intelligence/code-smells | Detect code smells | ❌ | `{ smells[], severity[], remediation_steps[] }` | Code quality issues |
| **NEW** /code-intelligence | POST | /api/intelligence/architecture-validation | Validate architecture rules | ❌ | `{ violations[], compliance_score, recommendations[] }` | Architecture compliance |

### Advanced Security Features

| Frontend Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------|-------------|----------|-------------|---------------|-----------------|-------|
| **NEW** /security-advanced | GET | /api/security/threat-modeling | Generate threat models | ✅ | `{ threat_model, attack_vectors[], mitigations[] }` | Automated threat modeling |
| **NEW** /security-advanced | POST | /api/security/penetration-test | Run automated pen tests | ✅ | `{ test_results[], vulnerabilities[], recommendations[] }` | Security testing |
| **NEW** /security-advanced | GET | /api/security/compliance-audit | Compliance audit results | ✅ | `{ audit_results[], frameworks[], gaps[] }` | Regulatory compliance |
| **NEW** /security-advanced | POST | /api/security/secure-coding-analysis | Secure coding analysis | ❌ | `{ secure_patterns[], violations[], training_recommendations[] }` | Secure development |
| **NEW** /security-advanced | GET | /api/security/incident-response | Security incident tracking | ✅ | `{ incidents[], status[], response_plans[] }` | Incident management |
| **NEW** /security-advanced | POST | /api/security/vulnerability-prioritization | Prioritize vulnerabilities | ❌ | `{ prioritized_list[], risk_scores[], business_impact[] }` | Risk-based prioritization |

### Machine Learning & AI Features

| Frontend Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------|-------------|----------|-------------|---------------|-----------------|-------|
| **NEW** /ml-insights | POST | /api/ml/code-prediction | Predict code issues | ❌ | `{ predictions[], confidence_scores[], recommendations[] }` | Predictive analytics |
| **NEW** /ml-insights | GET | /api/ml/developer-insights | Developer behavior insights | ✅ | `{ productivity_patterns[], improvement_areas[] }` | Behavioral analytics |
| **NEW** /ml-insights | POST | /api/ml/anomaly-detection | Detect code anomalies | ❌ | `{ anomalies[], severity[], suggested_actions[] }` | Anomaly detection |
| **NEW** /ml-insights | GET | /api/ml/trend-analysis | Code trend analysis | ❌ | `{ trends[], forecasts[], recommendations[] }` | Predictive trends |
| **NEW** /ml-insights | POST | /api/ml/auto-classification | Auto-classify code issues | ❌ | `{ classifications[], confidence[], suggested_labels[] }` | Automated categorization |
| **NEW** /ml-insights | GET | /api/ml/quality-prediction | Predict code quality | ❌ | `{ quality_scores[], risk_areas[], improvement_suggestions[] }` | Quality forecasting |

### DevOps & CI/CD Integration

| Frontend Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------|-------------|----------|-------------|---------------|-----------------|-------|
| **NEW** /cicd-dashboard | GET | /api/cicd/pipelines | CI/CD pipeline status | ✅ | `{ pipelines[], builds[], deployments[] }` | Pipeline monitoring |
| **NEW** /cicd-dashboard | POST | /api/cicd/trigger-build | Trigger build pipeline | ✅ | `{ build_id, status, estimated_duration }` | Build automation |
| **NEW** /cicd-dashboard | GET | /api/cicd/deployment-history | Deployment history | ✅ | `{ deployments[], success_rate, rollback_info[] }` | Release tracking |
| **NEW** /cicd-dashboard | POST | /api/cicd/quality-gates | Configure quality gates | ✅ | `{ gate_config, thresholds[], enforcement_rules[] }` | Quality control |
| **NEW** /cicd-dashboard | GET | /api/cicd/metrics | CI/CD metrics dashboard | ✅ | `{ lead_time, deployment_frequency, mttr, change_failure_rate }` | DORA metrics |
| **NEW** /cicd-dashboard | POST | /api/cicd/rollback | Initiate rollback | ✅ | `{ rollback_id, target_version, affected_services[] }` | Release management |

### Business Intelligence & Reporting

| Frontend Component | HTTP Method | Endpoint | Description | Auth Required | Response Schema | Notes |
|-------------------|-------------|----------|-------------|---------------|-----------------|-------|
| **NEW** /business-intelligence | GET | /api/bi/executive-dashboard | Executive dashboard data | ✅ | `{ kpis[], trends[], strategic_insights[] }` | C-level reporting |
| **NEW** /business-intelligence | POST | /api/bi/custom-metrics | Define custom metrics | ✅ | `{ metric_id, calculation_rules[], visualization_config }` | Custom KPIs |
| **NEW** /business-intelligence | GET | /api/bi/roi-analysis | ROI analysis reports | ✅ | `{ roi_calculations[], cost_benefits[], projections[] }` | Financial impact |
| **NEW** /business-intelligence | POST | /api/bi/benchmark-analysis | Industry benchmarking | ✅ | `{ benchmark_data[], peer_comparison[], recommendations[] }` | Competitive analysis |
| **NEW** /business-intelligence | GET | /api/bi/predictive-analytics | Predictive business analytics | ✅ | `{ forecasts[], scenarios[], risk_assessments[] }` | Business forecasting |

---

## WebSocket Real-time Endpoints (Enhanced)

### Real-time Collaboration
| WebSocket Channel | Description | Auth Required | Event Types | Data Format |
|------------------|-------------|---------------|-------------|-------------|
| `/ws/collaboration/code-review/{review_id}` | Live code review sessions | ✅ | `comment_added`, `approval_given`, `changes_requested` | `{ user, action, content, timestamp }` |
| `/ws/collaboration/pair-programming/{session_id}` | Pair programming sessions | ✅ | `cursor_move`, `code_change`, `voice_activity` | `{ user, position, changes, audio_status }` |
| `/ws/collaboration/whiteboard/{board_id}` | Collaborative whiteboarding | ✅ | `draw_stroke`, `shape_added`, `text_updated` | `{ user, drawing_data, coordinates }` |

### System Monitoring
| WebSocket Channel | Description | Auth Required | Event Types | Data Format |
|------------------|-------------|---------------|-------------|-------------|
| `/ws/monitoring/system-health` | Real-time system health | ✅ | `metric_update`, `alert_triggered`, `service_status_change` | `{ metric, value, threshold, timestamp }` |
| `/ws/monitoring/security-events` | Security event stream | ✅ | `vulnerability_found`, `attack_detected`, `compliance_violation` | `{ event_type, severity, details, affected_assets }` |
| `/ws/monitoring/build-pipeline/{pipeline_id}` | Live build monitoring | ✅ | `stage_started`, `stage_completed`, `test_results`, `deployment_status` | `{ stage, status, logs, metrics }` |

### Development Workflow
| WebSocket Channel | Description | Auth Required | Event Types | Data Format |
|------------------|-------------|---------------|-------------|-------------|
| `/ws/development/code-analysis/{repo_id}` | Live code analysis | ❌ | `analysis_started`, `issue_found`, `analysis_completed` | `{ analysis_type, progress, findings }` |
| `/ws/development/sprint/{sprint_id}` | Sprint progress updates | ✅ | `story_moved`, `points_updated`, `sprint_metrics_changed` | `{ story, old_status, new_status, metrics }` |
| `/ws/development/repository/{repo_id}` | Repository activity feed | ❌ | `commit_pushed`, `pr_created`, `issue_opened` | `{ event, author, changes, metadata }` |

---

## API Rate Limiting & Quotas

### Rate Limiting Tiers
| User Role | Requests/Hour | Burst Limit | Heavy Operations/Day | WebSocket Connections |
|-----------|---------------|-------------|----------------------|-----------------------|
| **Anonymous** | 1,000 | 50/min | 10 | 2 |
| **Developer** | 10,000 | 200/min | 100 | 10 |
| **Team Lead** | 25,000 | 500/min | 500 | 25 |
| **Admin** | 100,000 | 1000/min | Unlimited | 100 |
| **Enterprise** | Unlimited | Custom | Unlimited | Unlimited |

### Heavy Operations (Special Limits)
- AI-powered code analysis
- Bulk similarity analysis
- Security vulnerability scans
- Large repository analysis
- Machine learning model training
- Comprehensive audit reports

---

## Data Export & Integration APIs

### Export Formats
| Frontend Component | Export Type | Endpoint | Format Options | Auth Required |
|-------------------|-------------|----------|----------------|---------------|
| **NEW** /export | Security Report | `/api/export/security-report` | PDF, Excel, JSON, CSV | ✅ |
| **NEW** /export | Code Quality Report | `/api/export/quality-report` | PDF, HTML, JSON | ✅ |
| **NEW** /export | Project Analytics | `/api/export/project-analytics` | Excel, CSV, JSON | ✅ |
| **NEW** /export | Team Performance | `/api/export/team-performance` | PDF, Excel, JSON | ✅ |
| **NEW** /export | Technical Debt | `/api/export/technical-debt` | PDF, CSV, JSON | ✅ |
| **NEW** /export | Architecture Analysis | `/api/export/architecture-analysis` | PDF, SVG, JSON | ✅ |

### Third-party Integrations
| Integration | Endpoint | Description | Auth Required | Data Sync |
|-------------|----------|-------------|---------------|-----------|
| **Slack** | `/api/integrations/slack/webhook` | Notifications and alerts | ✅ | Real-time |
| **Microsoft Teams** | `/api/integrations/teams/webhook` | Collaboration updates | ✅ | Real-time |
| **Jira Cloud** | `/api/integrations/jira/sync` | Issue synchronization | ✅ | Bi-directional |
| **GitHub Enterprise** | `/api/integrations/github/enterprise` | Repository management | ✅ | Real-time |
| **GitLab** | `/api/integrations/gitlab/sync` | Repository and CI/CD | ✅ | Real-time |
| **Azure DevOps** | `/api/integrations/azure-devops/sync` | Work items and builds | ✅ | Real-time |
| **Splunk** | `/api/integrations/splunk/logs` | Log aggregation | ✅ | Stream |
| **DataDog** | `/api/integrations/datadog/metrics` | Performance monitoring | ✅ | Real-time |

---

## Mobile & Progressive Web App APIs

### Mobile-Optimized Endpoints
| Frontend Component | HTTP Method | Endpoint | Description | Response Size | Caching |
|-------------------|-------------|----------|-------------|---------------|---------|
| **NEW** /mobile | GET | `/api/mobile/dashboard-summary` | Condensed dashboard data | < 50KB | 5 min |
| **NEW** /mobile | GET | `/api/mobile/notifications-digest` | Mobile notification digest | < 10KB | 1 min |
| **NEW** /mobile | GET | `/api/mobile/quick-actions` | Available quick actions | < 5KB | 15 min |
| **NEW** /mobile | POST | `/api/mobile/voice-command` | Voice command processing | Variable | No cache |
| **NEW** /mobile | GET | `/api/mobile/offline-sync` | Offline data synchronization | < 100KB | No cache |

### Progressive Web App Features
| Feature | Endpoint | Description | Browser Support | Offline Support |
|---------|----------|-------------|-----------------|-----------------|
| **Push Notifications** | `/api/pwa/push-subscription` | Push notification setup | Modern browsers | ❌ |
| **Background Sync** | `/api/pwa/background-sync` | Background data sync | Chrome, Edge | ✅ |
| **Offline Storage** | `/api/pwa/cache-manifest` | Cache configuration | All modern | ✅ |
| **Install Prompt** | `/api/pwa/app-manifest` | PWA manifest data | All modern | ✅ |

---

## Advanced Search & Query APIs

### Elasticsearch Integration
| Search Type | Endpoint | Query Capabilities | Performance | Use Case |
|-------------|----------|-------------------|-------------|----------|
| **Full-text Search** | `/api/search/elasticsearch/fulltext` | Fuzzy, proximity, boosting | < 100ms | Documentation, comments |
| **Code Search** | `/api/search/elasticsearch/code` | Language-aware, syntax highlighting | < 200ms | Code snippets, functions |
| **Faceted Search** | `/api/search/elasticsearch/faceted` | Multi-dimensional filtering | < 150ms | Advanced filtering |
| **Autocomplete** | `/api/search/elasticsearch/suggest` | Real-time suggestions | < 50ms | Search-as-you-type |

### Graph Database Queries
| Query Type | Endpoint | Graph Operations | Complexity | Use Case |
|------------|----------|------------------|------------|----------|
| **Traversal** | `/api/graph/traverse` | Multi-hop, pattern matching | O(n²) | Dependency analysis |
| **Shortest Path** | `/api/graph/shortest-path` | Dijkstra, A* algorithms | O(n log n) | Impact analysis |
| **Community Detection** | `/api/graph/communities` | Clustering, modularity | O(n³) | Code modularity |
| **Centrality Analysis** | `/api/graph/centrality` | Betweenness, PageRank | O(n³) | Critical component identification |

---

## Microservices Architecture APIs

### Service Discovery
| Service | Health Endpoint | Status Endpoint | Metrics Endpoint | Dependencies |
|---------|----------------|-----------------|------------------|--------------|
| **Code Analysis Service** | `/health/code-analysis` | `/status/code-analysis` | `/metrics/code-analysis` | ArangoDB, Ollama |
| **Security Scanner Service** | `/health/security` | `/status/security` | `/metrics/security` | External CVE APIs |
| **AI Service** | `/health/ai` | `/status/ai` | `/metrics/ai` | Bedrock, OpenAI |
| **Integration Service** | `/health/integrations` | `/status/integrations` | `/metrics/integrations` | GitHub, Jira APIs |
| **Notification Service** | `/health/notifications` | `/status/notifications` | `/metrics/notifications` | SMTP, Slack, Teams |

### Circuit Breaker Patterns
```typescript
// Circuit breaker configuration for external services
{
  "github_api": {
    "failure_threshold": 5,
    "timeout": 10000,
    "reset_timeout": 60000,
    "fallback": "cache"
  },
  "ai_analysis": {
    "failure_threshold": 3,
    "timeout": 30000,
    "reset_timeout": 120000,
    "fallback": "mock_data"
  }
}
```

---

## API Documentation & Testing

### Interactive API Documentation
| Tool | Endpoint | Description | Features |
|------|----------|-------------|----------|
| **Swagger UI** | `/api-docs/swagger` | Interactive API documentation | Try-it-out, schema validation |
| **Redoc** | `/api-docs/redoc` | Clean API documentation | Responsive, search, examples |
| **Postman Collection** | `/api-docs/postman` | Postman collection export | Environment variables, tests |

### API Testing Endpoints
| Test Type | Endpoint | Description | Auth Required |
|-----------|----------|-------------|---------------|
| **Health Check** | `/api/health` | Overall system health | ❌ |
| **Load Test** | `/api/test/load` | Load testing endpoint | ✅ |
| **Performance Benchmark** | `/api/test/benchmark` | Performance benchmarking | ✅ |
| **Mock Data Generator** | `/api/test/mock-data` | Generate test data | ✅ |

---

## Compliance & Audit APIs

### Regulatory Compliance
| Framework | Endpoint | Requirements | Reporting |
|-----------|----------|--------------|-----------|
| **SOX** | `/api/compliance/sox` | Financial controls | Quarterly reports |
| **GDPR** | `/api/compliance/gdpr` | Data privacy | Data mapping, consent |
| **HIPAA** | `/api/compliance/hipaa` | Healthcare data | Risk assessments |
| **PCI DSS** | `/api/compliance/pci` | Payment data | Security scans |

### Audit Trail
| Event Type | Endpoint | Data Retention | Access Control |
|------------|----------|----------------|----------------|
| **User Actions** | `/api/audit/user-actions` | 7 years | Admin only |
| **Data Changes** | `/api/audit/data-changes` | 7 years | Admin only |
| **System Events** | `/api/audit/system-events` | 1 year | Admin only |
| **Security Events** | `/api/audit/security-events` | 10 years | Security team |

---

## Future API Roadmap

### Planned Enhancements (Q2 2025)
- **GraphQL Gateway:** Single endpoint for complex queries
- **gRPC Services:** High-performance internal communication
- **Event Streaming:** Apache Kafka integration for real-time events
- **Multi-tenant Support:** Tenant isolation and resource management
- **API Versioning Strategy:** Backward compatibility and deprecation

### Experimental Features (Q3 2025)
- **Natural Language Queries:** Convert natural language to API calls
- **Predictive Caching:** ML-driven cache preloading
- **Auto-scaling APIs:** Dynamic scaling based on usage patterns
- **Blockchain Integration:** Immutable audit logs and verification

---

## Development Best Practices

### API Design Principles
1. **RESTful Design:** Follow REST conventions consistently
2. **Consistent Naming:** Use noun-based URLs, consistent casing
3. **HTTP Status Codes:** Appropriate status codes for all responses
4. **Error Handling:** Structured error responses with actionable messages
5. **Versioning:** Clear versioning strategy with deprecation notices
6. **Documentation:** Comprehensive, up-to-date API documentation
7. **Security:** Authentication, authorization, and input validation
8. **Performance:** Optimized queries, caching, and rate limiting

### Code Quality Standards
- **TypeScript:** Strong typing for API contracts
- **OpenAPI Specification:** Machine-readable API definitions
- **Unit Testing:** Comprehensive test coverage
- **Integration Testing:** End-to-end API testing
- **Performance Testing:** Load and stress testing
- **Security Testing:** Vulnerability scanning and penetration testing

---

---

## React Hooks & Custom Utilities

### Core Analysis Hooks

| Hook/Utility | API Endpoints Used | Description | Return Type | Notes |
|--------------|-------------------|-------------|-------------|-------|
| **useAnalysis.ts** | Multiple analysis endpoints | Repository analysis management | `UseAnalysisState & UseAnalysisActions` | Polling-based job tracking |
| `useRepositoryAnalysis()` | `/api/repositories/analyze`, `/repositories/analysis/{jobId}` | Single repository analysis with real-time updates | `{ status, isLoading, error, progress, analyze, reset, refetch }` | Auto-polling every 1s during analysis |
| `useAnalysisList()` | `/api/repositories/jobs` | List all analysis jobs | `{ jobs, isLoading, error, refresh }` | Loads jobs on mount |
| **useCodeSearch.ts** | Code search endpoints | Search functionality with debouncing | `UseCodeSearchState & UseCodeSearchActions` | Includes debounced search variant |
| `useCodeSearch()` | `/api/code/search` | Basic code search | `{ results, isSearching, error, query, totalResults, search, clearResults, setQuery }` | Manual search trigger |
| `useDebouncedSearch()` | `/api/code/search` | Auto-search with debouncing | Same as `useCodeSearch` + `{ inputQuery, setInputQuery, debouncedQuery }` | 300ms default delay |
| **useDebounce.ts** | N/A | Generic debouncing utility | `T` (debounced value) | Reusable across components |
| **useHybridSearch.ts** | HybridGraphRAG endpoints | Advanced multi-modal search | `HybridSearchResult[]` + search methods | Semantic, structural, textual search |

### HybridGraphRAG Search System

| Method | Endpoint | Search Type | Response Schema | Use Case |
|--------|----------|-------------|-----------------|----------|
| `search()` | `/api/v1/search/hybrid` | Combined hybrid search | `SearchResponse` | Main search interface |
| `searchSemantic()` | `/api/v1/search/semantic` | Vector similarity search | `HybridSearchResult[]` | Natural language queries |
| `searchStructural()` | `/api/v1/search/structural` | Graph traversal search | `HybridSearchResult[]` | Code relationships |
| `searchTextual()` | `/api/v1/search/textual` | Full-text search | `HybridSearchResult[]` | Keyword matching |
| `exploreRelationships()` | `/api/v1/search/relationships` | Relationship exploration | `RelationshipData` | Code dependency analysis |
| `getSuggestions()` | `/api/v1/search/suggestions` | Query auto-completion | `string[]` | Search assistance |
| `getAnalytics()` | `/api/v1/search/analytics` | Search system analytics | `SearchAnalytics` | System insights |

### Real-time Data Hooks

| Hook/Component | Endpoints | Polling Interval | Description | Auto-cleanup |
|----------------|-----------|------------------|-------------|--------------|
| **useRealTime.ts** | Multiple endpoints | Configurable | Generic polling manager | ✅ |
| `useRealTimeSystemStatus()` | `/api/v1/system/status` | 5 seconds | Live system health | ✅ |
| `useRealTimeAnalysisJobs()` | `/api/v1/analysis/jobs` | 5 seconds | Job monitoring | ✅ |
| `useRealTimeRepositories()` | `/api/v1/repositories` | 30 seconds | Repository updates | ✅ |
| `useRealTimeSystemMetrics()` | `/api/v1/system/metrics` | 10 seconds | Performance metrics | ✅ |
| `useRealTimeJobStatus()` | `/api/v1/analysis/jobs/{id}` | 2 seconds | Individual job tracking | ✅ Auto-stops on completion |

### Notification & UI Hooks

| Hook | Dependencies | Description | Integration | Notes |
|------|-------------|-------------|-------------|-------|
| **useNotification.ts** | Chakra UI Toast | Notification management | Toast system | Success, error, warning, info variants |
| `useNotification()` | `useToast()` | Basic notifications | Chakra UI | 5s default duration |
| `formatApiError()` | N/A | API error formatting | Error handling | Standardized error messages |

---

## Core Services & API Layer

### API Service Architecture

| Service File | Base URL | Description | Authentication | Error Handling |
|--------------|----------|-------------|----------------|----------------|
| **api.ts** | `VITE_API_URL` or `localhost:8002` | Main API service layer | Header-based | Comprehensive error wrapping |
| `ApiService` class | Configurable | Singleton service instance | JWT headers | Structured error responses |

### Repository Management APIs

| Method | Endpoint | HTTP Method | Description | Response Type |
|--------|----------|-------------|-------------|---------------|
| `analyzeRepository()` | `/api/repositories/analyze` | POST | Start repository analysis | `{ job_id, status }` |
| `getAnalysisStatus()` | `/repositories/analysis/{jobId}` | GET | Get analysis job status | `AnalysisStatus` |
| `listAnalysisJobs()` | `/api/repositories/jobs` | GET | List all analysis jobs | `{ jobs[], total }` |
| `getRepositoryStats()` | `/api/repositories/{id}/stats` | GET | Repository statistics | Detailed stats object |
| `listRepositories()` | `/api/repositories` | GET | List all repositories | `{ repositories[], total_count }` |
| `addRepository()` | `/api/repositories` | POST | Add new repository | Repository object |
| `updateRepository()` | `/api/repositories/{id}` | PUT | Update repository | Updated repository |
| `deleteRepository()` | `/api/repositories/{id}` | DELETE | Delete repository | Success confirmation |
| `getRepository()` | `/api/repositories/{id}` | GET | Get single repository | Repository details |

### Search & Intelligence APIs

| Method | Endpoint | HTTP Method | Search Type | Response Schema |
|--------|----------|-------------|-------------|-----------------|
| `searchCode()` | `/api/code/search` | POST | Basic code search | `{ query, results[], total_results }` |
| `getEmbeddingInfo()` | `/api/embedding/info` | GET | Embedding service status | Service details + performance |
| `testEmbedding()` | `/api/embedding/test` | POST | Test embedding generation | `{ text, embedding[], dimensions, cached }` |

### Integration Service APIs

| Integration | Method Prefix | Description | Configuration | Status Check |
|-------------|---------------|-------------|---------------|--------------|
| **Jira** | `jira*` methods | Issue management | `JiraConfig` | `/api/jira/health` |
| **GitHub** | `github*` methods | Repository integration | `GitHubConfig` | `/api/github/health` |
| **General** | `get*Status()` | Service health checks | Various configs | Multiple endpoints |

### Project Management APIs

| Method | Endpoint | HTTP Method | Description | Data Model |
|--------|----------|-------------|-------------|------------|
| `getStories()` | `/api/stories` | GET | Get user stories | Stories + metadata |
| `getJiraBoardConfig()` | `/api/jira/board-config` | GET | Board configuration | `JiraBoardConfig` |
| `getSprints()` | `/api/sprints` | GET | List sprints | Sprint array |
| `createSprint()` | `/api/sprints/create` | POST | Create new sprint | Sprint creation data |
| `startSprint()` | `/api/sprints/{id}/start` | PUT | Activate sprint | Sprint status |
| `completeSprint()` | `/api/sprints/{id}/complete` | PUT | Complete sprint | Completion summary |
| `moveStoryBetweenSprints()` | `/api/sprints/move-story` | POST | Move story | Story update |

---

## Application Architecture & State Management

### App Configuration Files

| File | Purpose | Framework Integration | Configuration |
|------|---------|----------------------|---------------|
| **App.tsx** | Main application router | React Router v6 | Full feature set |
| **AppClean.tsx** | Simplified version | Basic routing | Minimal features |
| **AppMinimal.tsx** | Minimal fallback | Basic Chakra UI | Loading state only |
| **AppStable.tsx** | Stable core features | No sidebar layout | Simple navigation |
| **AppWorking.tsx** | Working baseline | Layout component | Core functionality |

### State Management Architecture

| Store/Context | File | Description | Persistence | Selectors |
|---------------|------|-------------|-------------|-----------|
| **appStore.ts** | Zustand store | Global application state | LocalStorage | Multiple selectors |
| `useAuth()` | Derived selector | Authentication state | ✅ | User, login status |
| `useUI()` | Derived selector | UI state management | Partial | Sidebar, loading, errors |
| `useRepositories()` | Derived selector | Repository management | ❌ | CRUD operations |
| `useJobs()` | Derived selector | Background job tracking | ❌ | Job lifecycle |
| `useNotifications()` | Derived selector | Notification system | ❌ | Message management |
| `useSearch()` | Derived selector | Search history & saved searches | ✅ | Query management |

### App Store State Schema

```typescript
interface AppState {
  // User & Auth
  user: User | null;
  isAuthenticated: boolean;
  
  // UI State
  sidebarCollapsed: boolean;
  loading: boolean;
  error: string | null;
  
  // Feature State
  searchHistory: string[];
  savedSearches: SavedSearch[];
  repositories: RepositoryAnalysis[];
  currentRepository: RepositoryAnalysis | null;
  analysisJobs: BackgroundJob[];
  systemStatus: SystemStatus | null;
  notifications: Notification[];
}
```

### Theme & Styling

| File | Framework | Purpose | Customization |
|------|-----------|---------|---------------|
| **theme.ts** | Chakra UI | Design system configuration | Brand colors, fonts, components |
| **index.css** | CSS | Global styles | Typography, resets |
| Color Schemes | Chakra UI | Brand: Blue-based | `brand.50` to `brand.900` |
| Component Variants | Chakra UI | Custom button, card styles | Hover effects, shadows |

---

## Error Handling & Resilience Patterns

### API Error Handling

| Layer | Implementation | Error Types | Recovery Strategy |
|-------|----------------|-------------|------------------|
| **API Service** | Try-catch with structured responses | Network, HTTP, JSON parsing | Graceful degradation |
| **React Hooks** | Error state management | API errors, validation | User feedback + retry |
| **Component Level** | Error boundaries | Render errors, state errors | Fallback UI |
| **Global Store** | Error state tracking | Cross-component errors | Centralized error display |

### Resilience Patterns

| Pattern | Implementation | Use Case | Configuration |
|---------|----------------|----------|---------------|
| **Polling with Cleanup** | `useRealTime*` hooks | Live data updates | Configurable intervals |
| **Automatic Retry** | API service layer | Transient failures | Exponential backoff |
| **Circuit Breaker** | Service-level | External API failures | Planned implementation |
| **Graceful Degradation** | Component-level | Service unavailability | Mock data fallback |
| **Optimistic Updates** | Store actions | User interactions | Rollback on failure |

---

## Performance Optimization Strategies

### Code Splitting & Lazy Loading

| Component Type | Loading Strategy | Bundle Impact | User Experience |
|----------------|------------------|---------------|-----------------|
| **Heavy Components** | `React.lazy()` | Separate chunks | Progressive loading |
| **Route-based** | Router-level splitting | Per-page bundles | Faster initial load |
| **Feature-based** | Conditional imports | Feature bundles | On-demand loading |

### Caching & Data Management

| Data Type | Caching Strategy | TTL | Invalidation |
|-----------|------------------|-----|--------------|
| **Search Results** | React Query + local | 5 minutes | Manual + automatic |
| **Repository Data** | Store + React Query | 30 seconds | Real-time polling |
| **System Status** | React Query | 5 seconds | Continuous polling |
| **User Preferences** | LocalStorage | Persistent | Manual updates |

### Memory Management

| Resource | Management Strategy | Cleanup | Monitoring |
|----------|-------------------|---------|------------|
| **Polling Intervals** | `useEffect` cleanup | Automatic | Hook dependencies |
| **Event Listeners** | Cleanup functions | On unmount | Custom hooks |
| **Large Data Sets** | Pagination + virtualization | Automatic | Performance metrics |
| **WebSocket Connections** | Connection pooling | On disconnect | Health checks |

---

## Development & Debugging Tools

### Development Utilities

| Tool | Integration | Purpose | Environment |
|------|-------------|---------|-------------|
| **React Query DevTools** | Built-in | Cache inspection | Development only |
| **Zustand DevTools** | Store integration | State debugging | Development + production |
| **Error Boundaries** | Component-level | Error isolation | All environments |
| **Loading States** | Hook-based | User feedback | All environments |

### API Testing & Documentation

| Tool | Usage | Integration | Output |
|------|-------|-------------|--------|
| **TypeScript** | Type safety | API contracts | Compile-time validation |
| **API Response Types** | Interface definitions | Runtime validation | Type-safe responses |
| **Mock Data Patterns** | Development mode | Service unavailability | Consistent testing |

---

## Security & Data Protection

### Authentication Flow

| Component | Role | Implementation | Security Level |
|-----------|------|----------------|----------------|
| **App Store** | Session management | Persistent user state | Client-side |
| **API Service** | Request headers | JWT token handling | Transport security |
| **Route Protection** | Access control | Planned implementation | Application-level |

### Data Sanitization

| Input Type | Sanitization | Validation | Protection |
|------------|--------------|------------|------------|
| **Search Queries** | HTML encoding | Length limits | XSS prevention |
| **User Input** | Input validation | Type checking | Injection prevention |
| **API Responses** | Response validation | Schema checking | Data integrity |

---

## Testing Strategy

### Unit Testing

| Component Type | Test Coverage | Tools | Focus Areas |
|----------------|---------------|-------|-------------|
| **Custom Hooks** | High priority | React Testing Library | State management, side effects |
| **API Service** | Critical | Jest + MSW | Network handling, error cases |
| **Utilities** | Complete | Jest | Pure function testing |

### Integration Testing

| Integration Point | Test Scope | Mock Strategy | Validation |
|------------------|------------|---------------|------------|
| **API Endpoints** | End-to-end | MSW handlers | Response formats |
| **Real-time Features** | Polling behavior | Mocked timers | Update cycles |
| **Error Handling** | Failure scenarios | Simulated failures | Recovery patterns |

---

## Deployment & Environment Configuration

### Environment Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `VITE_API_URL` | Backend API endpoint | `http://localhost:8002` | Development |
| `VITE_ENABLE_DEVTOOLS` | Development tools | `true` | Development |
| `VITE_MOCK_DATA` | Mock data mode | `false` | Testing |

### Build Optimization

| Optimization | Implementation | Impact | Monitoring |
|--------------|----------------|--------|------------|
| **Tree Shaking** | Vite configuration | Bundle size reduction | Build analysis |
| **Code Splitting** | Dynamic imports | Improved loading | Performance metrics |
| **Asset Optimization** | Vite plugins | Resource efficiency | Load time tracking |

---

This enhanced API mapping provides a comprehensive foundation for scaling your code analysis platform with advanced features, robust security, and enterprise-grade capabilities. The additional sections cover the complete application architecture, from custom hooks and state management to deployment strategies and testing approaches.