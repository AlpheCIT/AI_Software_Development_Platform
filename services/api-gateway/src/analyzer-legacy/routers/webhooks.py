"""
Advanced webhook and integration system for the Code Analyzer platform.
Handles GitHub webhooks, Jira integrations, and external service notifications.
"""

import json
import logging
import hmac
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Request, Header, BackgroundTasks, Depends
from pydantic import BaseModel, Field
import httpx
import asyncio

from database import db_connection
from github_integration import github_service
from jira_integration import jira_service

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

class GitHubWebhookEvent(BaseModel):
    """GitHub webhook event payload"""
    action: str
    repository: Dict[str, Any]
    sender: Dict[str, Any]
    pull_request: Optional[Dict[str, Any]] = None
    commits: Optional[List[Dict[str, Any]]] = None
    ref: Optional[str] = None

class JiraWebhookEvent(BaseModel):
    """Jira webhook event payload"""
    timestamp: int
    webhookEvent: str
    issue: Optional[Dict[str, Any]] = None
    user: Dict[str, Any]
    changelog: Optional[Dict[str, Any]] = None

class SlackNotification(BaseModel):
    """Slack notification payload"""
    channel: str
    text: str
    attachments: Optional[List[Dict[str, Any]]] = None
    blocks: Optional[List[Dict[str, Any]]] = None

class IntegrationConfig(BaseModel):
    """Integration configuration"""
    name: str
    type: str  # github, jira, slack, teams, discord
    enabled: bool
    settings: Dict[str, Any]
    webhook_url: Optional[str] = None
    secret: Optional[str] = None

class NotificationRule(BaseModel):
    """Notification rule configuration"""
    id: str
    name: str
    triggers: List[str]  # push, pull_request, security_issue, quality_gate_failed, etc.
    conditions: Dict[str, Any]
    actions: List[Dict[str, Any]]
    enabled: bool

class WebhookService:
    """Service for managing webhooks and integrations"""
    
    def __init__(self):
        self.integrations: Dict[str, IntegrationConfig] = {}
        self.notification_rules: List[NotificationRule] = []
        self._load_configuration()
    
    def _load_configuration(self):
        """Load integration configuration from database or config file"""
        # Mock configuration - in real app, load from database
        self.integrations = {
            "github_main": IntegrationConfig(
                name="GitHub Integration",
                type="github",
                enabled=True,
                settings={
                    "repositories": ["company/web-frontend", "company/api-backend"],
                    "events": ["push", "pull_request", "issues"]
                },
                webhook_url="https://api.github.com/repos/company/web-frontend/hooks",
                secret="github_webhook_secret_123"
            ),
            "slack_notifications": IntegrationConfig(
                name="Slack Notifications",
                type="slack",
                enabled=True,
                settings={
                    "channel": "#code-quality",
                    "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
                }
            ),
            "jira_integration": IntegrationConfig(
                name="Jira Integration", 
                type="jira",
                enabled=True,
                settings={
                    "project_key": "PROJ",
                    "server_url": "https://company.atlassian.net",
                    "auto_create_issues": True
                }
            )
        }
        
        self.notification_rules = [
            NotificationRule(
                id="security_alerts",
                name="Security Alert Notifications",
                triggers=["security_scan_completed", "vulnerability_found"],
                conditions={
                    "severity": ["critical", "high"],
                    "repository": ["all"]
                },
                actions=[
                    {"type": "slack", "config": {"urgent": True}},
                    {"type": "jira", "config": {"issue_type": "Security Issue"}},
                    {"type": "email", "config": {"recipients": ["security-team@company.com"]}}
                ],
                enabled=True
            ),
            NotificationRule(
                id="quality_gate_failures",
                name="Quality Gate Failure Alerts",
                triggers=["quality_gate_failed"],
                conditions={
                    "repository": ["all"],
                    "branch": ["main", "master", "develop"]
                },
                actions=[
                    {"type": "slack", "config": {"urgent": False}},
                    {"type": "block_deployment", "config": {}}
                ],
                enabled=True
            ),
            NotificationRule(
                id="build_notifications",
                name="Build Status Notifications",
                triggers=["build_completed"],
                conditions={
                    "status": ["failed"],
                    "branch": ["main", "master"]
                },
                actions=[
                    {"type": "slack", "config": {"urgent": True}},
                    {"type": "teams", "config": {"channel": "development"}}
                ],
                enabled=True
            )
        ]
    
    async def process_github_webhook(self, event: GitHubWebhookEvent, signature: str):
        """Process GitHub webhook event"""
        try:
            repo_name = event.repository.get("full_name")
            
            # Verify webhook signature
            if not self._verify_github_signature(json.dumps(event.dict()).encode(), signature):
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
            
            logger.info(f"Processing GitHub webhook: {event.action} for {repo_name}")
            
            # Handle different event types
            if event.action == "opened" and event.pull_request:
                await self._handle_pull_request_opened(event)
            elif event.action == "closed" and event.pull_request:
                await self._handle_pull_request_closed(event)
            elif event.action == "synchronize" and event.pull_request:
                await self._handle_pull_request_updated(event)
            elif event.ref and event.ref.startswith("refs/heads/"):
                await self._handle_push_event(event)
            
            # Trigger analysis if needed
            await self._trigger_repository_analysis(repo_name, event)
            
            return {"status": "processed", "event": event.action}
            
        except Exception as e:
            logger.error(f"Error processing GitHub webhook: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")
    
    async def process_jira_webhook(self, event: JiraWebhookEvent):
        """Process Jira webhook event"""
        try:
            logger.info(f"Processing Jira webhook: {event.webhookEvent}")
            
            if event.webhookEvent == "jira:issue_created":
                await self._handle_jira_issue_created(event)
            elif event.webhookEvent == "jira:issue_updated":
                await self._handle_jira_issue_updated(event)
            elif event.webhookEvent == "jira:issue_deleted":
                await self._handle_jira_issue_deleted(event)
            
            return {"status": "processed", "event": event.webhookEvent}
            
        except Exception as e:
            logger.error(f"Error processing Jira webhook: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Jira webhook processing failed: {str(e)}")
    
    async def _handle_pull_request_opened(self, event: GitHubWebhookEvent):
        """Handle pull request opened event"""
        pr = event.pull_request
        repo_name = event.repository.get("full_name")
        
        # Start automated analysis
        analysis_tasks = [
            self._run_security_scan(repo_name, pr["head"]["sha"]),
            self._run_quality_analysis(repo_name, pr["head"]["sha"]),
            self._check_code_coverage(repo_name, pr["head"]["sha"])
        ]
        
        await asyncio.gather(*analysis_tasks)
        
        # Send notifications
        await self._send_notification("pull_request_opened", {
            "repository": repo_name,
            "pr_number": pr["number"],
            "title": pr["title"],
            "author": pr["user"]["login"],
            "url": pr["html_url"]
        })
    
    async def _handle_pull_request_closed(self, event: GitHubWebhookEvent):
        """Handle pull request closed/merged event"""
        pr = event.pull_request
        
        if pr.get("merged"):
            # Trigger deployment pipeline if merged to main
            if pr["base"]["ref"] in ["main", "master"]:
                await self._trigger_deployment_pipeline(event.repository.get("full_name"))
        
        # Update repository statistics
        await self._update_repository_stats(event.repository.get("full_name"))
    
    async def _handle_push_event(self, event: GitHubWebhookEvent):
        """Handle push event"""
        repo_name = event.repository.get("full_name")
        branch = event.ref.replace("refs/heads/", "")
        
        # Trigger analysis for main branch pushes
        if branch in ["main", "master", "develop"]:
            await self._trigger_repository_analysis(repo_name, event)
        
        # Check for security issues in commits
        if event.commits:
            await self._scan_commits_for_secrets(event.commits, repo_name)
    
    async def _run_security_scan(self, repository: str, commit_sha: str):
        """Run security scan on repository"""
        try:
            # Simulate security scan
            logger.info(f"Running security scan for {repository}@{commit_sha}")
            
            # Mock findings
            findings = {
                "critical": 0,
                "high": 1,
                "medium": 3,
                "low": 5,
                "issues": [
                    {
                        "severity": "high",
                        "title": "Hardcoded API key detected",
                        "file": "src/config.py",
                        "line": 23,
                        "description": "API key found in source code"
                    }
                ]
            }
            
            # Store results
            await self._store_security_scan_results(repository, commit_sha, findings)
            
            # Send notifications if critical/high issues found
            if findings["critical"] > 0 or findings["high"] > 0:
                await self._send_notification("security_issue_found", {
                    "repository": repository,
                    "commit": commit_sha,
                    "findings": findings
                })
            
        except Exception as e:
            logger.error(f"Security scan failed for {repository}: {str(e)}")
    
    async def _run_quality_analysis(self, repository: str, commit_sha: str):
        """Run code quality analysis"""
        try:
            logger.info(f"Running quality analysis for {repository}@{commit_sha}")
            
            # Mock quality analysis
            quality_results = {
                "score": 87,
                "maintainability": 85,
                "reliability": 89,
                "technical_debt": "2h 30m",
                "code_smells": 12,
                "duplicated_lines": 2.3
            }
            
            # Store results
            await self._store_quality_results(repository, commit_sha, quality_results)
            
            # Check quality gate
            quality_gate_passed = await self._check_quality_gate(repository, quality_results)
            
            if not quality_gate_passed:
                await self._send_notification("quality_gate_failed", {
                    "repository": repository,
                    "commit": commit_sha,
                    "results": quality_results
                })
            
        except Exception as e:
            logger.error(f"Quality analysis failed for {repository}: {str(e)}")
    
    async def _check_code_coverage(self, repository: str, commit_sha: str):
        """Check code coverage"""
        try:
            logger.info(f"Checking code coverage for {repository}@{commit_sha}")
            
            # Mock coverage results
            coverage_results = {
                "total_coverage": 87.5,
                "new_code_coverage": 82.1,
                "changed_files": [
                    {"file": "src/auth.py", "coverage": 95.2},
                    {"file": "src/utils.py", "coverage": 78.9}
                ]
            }
            
            # Store results
            await self._store_coverage_results(repository, commit_sha, coverage_results)
            
        except Exception as e:
            logger.error(f"Coverage check failed for {repository}: {str(e)}")
    
    async def _scan_commits_for_secrets(self, commits: List[Dict], repository: str):
        """Scan commits for secrets and sensitive data"""
        try:
            for commit in commits:
                # Simple pattern matching for common secrets
                message = commit.get("message", "").lower()
                
                secret_patterns = [
                    "password", "secret", "api_key", "token", "credential"
                ]
                
                for pattern in secret_patterns:
                    if pattern in message:
                        await self._send_notification("potential_secret_exposed", {
                            "repository": repository,
                            "commit": commit["id"],
                            "message": commit["message"],
                            "author": commit["author"]["email"],
                            "pattern": pattern
                        })
                        break
        
        except Exception as e:
            logger.error(f"Secret scanning failed: {str(e)}")
    
    async def _send_notification(self, trigger: str, data: Dict[str, Any]):
        """Send notifications based on rules"""
        try:
            for rule in self.notification_rules:
                if trigger in rule.triggers and rule.enabled:
                    if self._matches_conditions(rule.conditions, data):
                        for action in rule.actions:
                            await self._execute_action(action, data, trigger)
        
        except Exception as e:
            logger.error(f"Notification sending failed: {str(e)}")
    
    def _matches_conditions(self, conditions: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """Check if event data matches rule conditions"""
        try:
            # Simple condition matching
            for key, expected_values in conditions.items():
                if key in data:
                    if isinstance(expected_values, list):
                        if "all" in expected_values or data[key] in expected_values:
                            continue
                        else:
                            return False
                    else:
                        if data[key] != expected_values:
                            return False
            return True
        except Exception:
            return False
    
    async def _execute_action(self, action: Dict[str, Any], data: Dict[str, Any], trigger: str):
        """Execute notification action"""
        try:
            action_type = action["type"]
            config = action.get("config", {})
            
            if action_type == "slack":
                await self._send_slack_notification(data, trigger, config)
            elif action_type == "jira":
                await self._create_jira_issue(data, trigger, config)
            elif action_type == "email":
                await self._send_email_notification(data, trigger, config)
            elif action_type == "teams":
                await self._send_teams_notification(data, trigger, config)
            elif action_type == "block_deployment":
                await self._block_deployment(data)
        except Exception as e:
            logger.error(f"Action execution failed: {str(e)}")
            
    async def _create_jira_issue(self, data: Dict[str, Any], trigger: str, config: Dict[str, Any]):
        """Create Jira issue"""
        try:
            jira_config = self.integrations.get("jira_integration")
            if not jira_config or not jira_config.enabled:
                return
            
            project_key = jira_config.settings.get("project_key")
            if not project_key:
                return
            
            if trigger == "security_issue_found":
                await jira_service.create_security_issue(
                    project_key=project_key,
                    vulnerability=data["findings"]["issues"][0] if data["findings"]["issues"] else {},
                    repository=data["repository"]
                )
            elif trigger == "quality_gate_failed":
                await jira_service.create_quality_issue(
                    project_key=project_key,
                    quality_data=data["results"],
                    repository=data["repository"]
                )
            else:
                # Generic issue creation
                await jira_service.create_issue(
                    project_key=project_key,
                    issue_type="Task",
                    summary=f"Code Analyzer: {trigger.replace('_', ' ').title()}",
                    description=f"Automated issue for {trigger}\n\nData: {json.dumps(data, indent=2)}",
                    labels=["automated", "code-analyzer"]
                )
                
            logger.info(f"Jira issue created for {trigger}")
            
        except Exception as e:
            logger.error(f"Jira issue creation failed: {str(e)}")
    
    async def _send_email_notification(self, data: Dict[str, Any], trigger: str, config: Dict[str, Any]):
        """Send email notification (placeholder)"""
        try:
            recipients = config.get("recipients", [])
            logger.info(f"Email notification would be sent to {recipients} for {trigger}")
            # TODO: Implement actual email sending
        except Exception as e:
            logger.error(f"Email notification failed: {str(e)}")
    
    async def _send_teams_notification(self, data: Dict[str, Any], trigger: str, config: Dict[str, Any]):
        """Send Microsoft Teams notification (placeholder)"""
        try:
            channel = config.get("channel", "general")
            logger.info(f"Teams notification would be sent to #{channel} for {trigger}")
            # TODO: Implement Teams webhook
        except Exception as e:
            logger.error(f"Teams notification failed: {str(e)}")
    
    async def _block_deployment(self, data: Dict[str, Any]):
        """Block deployment pipeline (placeholder)"""
        try:
            repository = data.get("repository")
            logger.info(f"Deployment would be blocked for {repository}")
            # TODO: Implement deployment blocking logic
        except Exception as e:
            logger.error(f"Deployment blocking failed: {str(e)}")
    
    async def _trigger_repository_analysis(self, repository: str, event: GitHubWebhookEvent):
        """Trigger repository analysis based on webhook event"""
        try:
            # Parse repository info
            repo_info = github_service.parse_repository_url(repository)
            if not repo_info:
                logger.warning(f"Could not parse repository URL: {repository}")
                return
            
            # Trigger analysis for specific events
            if event.action in ["opened", "synchronize"] and event.pull_request:
                # Analyze pull request
                logger.info(f"Triggering PR analysis for {repository}")
                # TODO: Integrate with existing analysis pipeline
            elif event.ref and event.ref in ["refs/heads/main", "refs/heads/master"]:
                # Analyze main branch push
                logger.info(f"Triggering main branch analysis for {repository}")
                # TODO: Integrate with existing analysis pipeline
            
        except Exception as e:
            logger.error(f"Failed to trigger repository analysis: {str(e)}")
    
    async def _update_repository_stats(self, repository: str):
        """Update repository statistics"""
        try:
            logger.info(f"Updating repository statistics for {repository}")
            # TODO: Update repository stats in database
        except Exception as e:
            logger.error(f"Failed to update repository stats: {str(e)}")
    
    async def _trigger_deployment_pipeline(self, repository: str):
        """Trigger deployment pipeline"""
        try:
            logger.info(f"Triggering deployment pipeline for {repository}")
            # TODO: Integrate with CI/CD system
        except Exception as e:
            logger.error(f"Failed to trigger deployment pipeline: {str(e)}")
    
    async def _handle_jira_issue_created(self, event: JiraWebhookEvent):
        """Handle Jira issue created event"""
        try:
            issue = event.issue
            if issue:
                logger.info(f"Jira issue created: {issue.get('key')}")
                # TODO: Process new Jira issue
        except Exception as e:
            logger.error(f"Failed to handle Jira issue created: {str(e)}")
    
    async def _handle_jira_issue_updated(self, event: JiraWebhookEvent):
        """Handle Jira issue updated event"""
        try:
            issue = event.issue
            if issue:
                logger.info(f"Jira issue updated: {issue.get('key')}")
                # TODO: Process Jira issue update
        except Exception as e:
            logger.error(f"Failed to handle Jira issue updated: {str(e)}")
    
    async def _handle_jira_issue_deleted(self, event: JiraWebhookEvent):
        """Handle Jira issue deleted event"""
        try:
            issue = event.issue
            if issue:
                logger.info(f"Jira issue deleted: {issue.get('key')}")
                # TODO: Process Jira issue deletion
        except Exception as e:
            logger.error(f"Failed to handle Jira issue deleted: {str(e)}")
    
    async def _check_quality_gate(self, repository: str, quality_results: Dict[str, Any]) -> bool:
        """Check if quality gate passes"""
        try:
            # Define quality gate thresholds
            thresholds = {
                "score": 80,
                "maintainability": 75,
                "reliability": 85,
                "technical_debt_hours": 8.0  # 8 hours max
            }
            
            score = quality_results.get("score", 0)
            maintainability = quality_results.get("maintainability", 0)
            reliability = quality_results.get("reliability", 0)
            
            # Parse technical debt (assumes format like "2h 30m")
            tech_debt_str = quality_results.get("technical_debt", "0h")
            tech_debt_hours = self._parse_technical_debt(tech_debt_str)
            
            # Check all thresholds
            return (
                score >= thresholds["score"] and
                maintainability >= thresholds["maintainability"] and
                reliability >= thresholds["reliability"] and
                tech_debt_hours <= thresholds["technical_debt_hours"]
            )
            
        except Exception as e:
            logger.error(f"Quality gate check failed: {str(e)}")
            return False
    
    def _parse_technical_debt(self, debt_str: str) -> float:
        """Parse technical debt string to hours"""
        try:
            total_hours = 0.0
            debt_str = debt_str.lower().strip()
            
            # Extract hours
            if "h" in debt_str:
                hours_part = debt_str.split("h")[0].strip()
                if hours_part:
                    total_hours += float(hours_part)
            
            # Extract minutes
            if "m" in debt_str:
                minutes_part = debt_str.split("h")[-1].replace("m", "").strip()
                if minutes_part:
                    total_hours += float(minutes_part) / 60.0
            
            return total_hours
        except Exception:
            return 0.0
    
    async def _send_slack_notification(self, data: Dict[str, Any], trigger: str, config: Dict[str, Any]):
        """Send Slack notification"""
        try:
            slack_config = self.integrations.get("slack_notifications")
            if not slack_config or not slack_config.enabled:
                return
            
            webhook_url = slack_config.settings.get("webhook_url")
            if not webhook_url:
                return
            
            # Format message based on trigger
            message = self._format_slack_message(trigger, data, config)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(webhook_url, json=message)
                response.raise_for_status()
                
            logger.info(f"Slack notification sent for {trigger}")
            
        except Exception as e:
            logger.error(f"Slack notification failed: {str(e)}")
    
    def _format_slack_message(self, trigger: str, data: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Format Slack message based on trigger type"""
        urgent = config.get("urgent", False)
        
        if trigger == "security_issue_found":
            return {
                "text": "🚨 Security Issue Detected" if urgent else "⚠️ Security Issue Found",
                "attachments": [
                    {
                        "color": "danger" if urgent else "warning",
                        "title": f"Security scan results for {data['repository']}",
                        "fields": [
                            {
                                "title": "Critical Issues",
                                "value": str(data["findings"]["critical"]),
                                "short": True
                            },
                            {
                                "title": "High Issues", 
                                "value": str(data["findings"]["high"]),
                                "short": True
                            },
                            {
                                "title": "Commit",
                                "value": data["commit"][:8],
                                "short": True
                            }
                        ]
                    }
                ]
            }
        elif trigger == "quality_gate_failed":
            return {
                "text": "❌ Quality Gate Failed",
                "attachments": [
                    {
                        "color": "warning",
                        "title": f"Quality gate failed for {data['repository']}",
                        "fields": [
                            {
                                "title": "Quality Score",
                                "value": f"{data['results']['score']}%",
                                "short": True
                            },
                            {
                                "title": "Technical Debt",
                                "value": data['results']['technical_debt'],
                                "short": True
                            }
                        ]
                    }
                ]
            }
        else:
            return {
                "text": f"📢 {trigger.replace('_', ' ').title()}",
                "attachments": [
                    {
                        "color": "good",
                        "text": json.dumps(data, indent=2)
                    }
                ]
            }
    
    def _verify_github_signature(self, payload: bytes, signature: str) -> bool:
        """Verify GitHub webhook signature"""
        try:
            if not signature.startswith("sha256="):
                return False
            
            secret = self.integrations.get("github_main", {}).secret or "default_secret"
            expected_signature = "sha256=" + hmac.new(
                secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(expected_signature, signature)
        except Exception:
            return False
    
    async def _store_security_scan_results(self, repository: str, commit_sha: str, findings: Dict[str, Any]):
        """Store security scan results in database"""
        try:
            # In real implementation, store in ArangoDB
            logger.info(f"Storing security results for {repository}@{commit_sha}")
        except Exception as e:
            logger.error(f"Failed to store security results: {str(e)}")
    
    async def _store_quality_results(self, repository: str, commit_sha: str, results: Dict[str, Any]):
        """Store quality analysis results"""
        try:
            # In real implementation, store in ArangoDB
            logger.info(f"Storing quality results for {repository}@{commit_sha}")
        except Exception as e:
            logger.error(f"Failed to store quality results: {str(e)}")
    
    async def _store_coverage_results(self, repository: str, commit_sha: str, results: Dict[str, Any]):
        """Store coverage results"""
        try:
            # In real implementation, store in ArangoDB
            logger.info(f"Storing coverage results for {repository}@{commit_sha}")
        except Exception as e:
            logger.error(f"Failed to store coverage results: {str(e)}")

# Global webhook service instance
webhook_service = WebhookService()

# Webhook endpoints
@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(...),
    x_hub_signature_256: str = Header(...)
):
    """Handle GitHub webhook events"""
    try:
        payload = await request.json()
        event = GitHubWebhookEvent(**payload)
        
        # Process webhook in background
        background_tasks.add_task(
            webhook_service.process_github_webhook,
            event,
            x_hub_signature_256
        )
        
        return {"status": "accepted"}
        
    except Exception as e:
        logger.error(f"GitHub webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid webhook payload: {str(e)}")

@router.post("/jira")
async def jira_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """Handle Jira webhook events"""
    try:
        payload = await request.json()
        event = JiraWebhookEvent(**payload)
        
        # Process webhook in background
        background_tasks.add_task(
            webhook_service.process_jira_webhook,
            event
        )
        
        return {"status": "accepted"}
        
    except Exception as e:
        logger.error(f"Jira webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid webhook payload: {str(e)}")

@router.get("/integrations")
async def list_integrations():
    """List all configured integrations"""
    return {
        "integrations": list(webhook_service.integrations.values()),
        "total": len(webhook_service.integrations)
    }

@router.get("/notification-rules")
async def list_notification_rules():
    """List all notification rules"""
    return {
        "rules": webhook_service.notification_rules,
        "total": len(webhook_service.notification_rules)
    }

@router.post("/test-notification")
async def test_notification(trigger: str, data: Dict[str, Any]):
    """Test notification system"""
    try:
        await webhook_service._send_notification(trigger, data)
        return {"status": "notification_sent", "trigger": trigger}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Notification test failed: {str(e)}")

@router.post("/integrations/{integration_id}/toggle")
async def toggle_integration(integration_id: str):
    """Enable/disable an integration"""
    try:
        if integration_id in webhook_service.integrations:
            integration = webhook_service.integrations[integration_id]
            integration.enabled = not integration.enabled
            return {"status": "updated", "enabled": integration.enabled}
        else:
            raise HTTPException(status_code=404, detail="Integration not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle integration: {str(e)}")
