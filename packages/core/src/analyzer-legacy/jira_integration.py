"""
Jira Integration Service for the Code Analyzer platform.
Handles Jira API interactions, issue management, and project tracking.
"""

import os
import logging
import asyncio
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import httpx
import base64
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

class JiraIntegrationService:
    """Service for handling Jira API operations and integrations"""
    
    def __init__(self, server_url: Optional[str] = None, username: Optional[str] = None, 
                 api_token: Optional[str] = None):
        """
        Initialize Jira integration service
        
        Args:
            server_url: Jira server URL (e.g., https://company.atlassian.net)
            username: Jira username/email
            api_token: Jira API token
        """
        self.server_url = server_url or os.getenv("JIRA_SERVER_URL")
        self.username = username or os.getenv("JIRA_USERNAME")
        self.api_token = api_token or os.getenv("JIRA_API_TOKEN")
        
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        if self.username and self.api_token:
            # Create basic auth header
            auth_string = f"{self.username}:{self.api_token}"
            auth_bytes = base64.b64encode(auth_string.encode()).decode()
            self.headers["Authorization"] = f"Basic {auth_bytes}"
    
    def _get_api_url(self, endpoint: str) -> str:
        """Get full API URL for endpoint"""
        return f"{self.server_url}/rest/api/2/{endpoint}"
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to Jira"""
        try:
            # First try getting user info
            user_url = self._get_api_url("myself")
            async with httpx.AsyncClient() as client:
                user_response = await client.get(user_url, headers=self.headers)
                
                if user_response.status_code != 200:
                    return {
                        "status": "failed",
                        "error": f"Authentication failed: {user_response.status_code} - {user_response.text}"
                    }
                
                user_data = user_response.json()
                
                # Then try getting list of projects to verify permissions
                projects_url = self._get_api_url("project")
                projects_response = await client.get(projects_url, headers=self.headers)
                
                if projects_response.status_code != 200:
                    return {
                        "status": "partial_success",
                        "user": user_data.get("displayName", "Unknown"),
                        "email": user_data.get("emailAddress", "Unknown"),
                        "error": f"Cannot access projects: {projects_response.status_code} - {projects_response.text}"
                    }
                
                projects_data = projects_response.json()
                project_names = [proj.get('name', 'Unknown') for proj in projects_data[:3]]
                
                return {
                    "status": "success", 
                    "user": user_data.get("displayName", "Unknown"),
                    "email": user_data.get("emailAddress", "Unknown"),
                    "projects_count": len(projects_data),
                    "sample_projects": project_names
                }
                
        except httpx.HTTPStatusError as e:
            return {
                "status": "failed",
                "error": f"HTTP Error: {str(e)}"
            }
        except Exception as e:
            return {
                "status": "failed", 
                "error": str(e)
            }
    
    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get all available Jira projects"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._get_api_url("project"),
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get Jira projects: {str(e)}")
            raise
    
    async def get_project(self, project_key: str) -> Dict[str, Any]:
        """Get specific project details"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._get_api_url(f"project/{project_key}"),
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get Jira project {project_key}: {str(e)}")
            raise
    
    async def get_issue_types(self, project_key: str) -> List[Dict[str, Any]]:
        """Get available issue types for a project"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._get_api_url(f"project/{project_key}/issuetype"),
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get issue types for {project_key}: {str(e)}")
            raise
    
    async def get_user_info(self) -> Dict[str, Any]:
        """Get current user information from Jira"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._get_api_url("myself"),
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get user info: {str(e)}")
            raise
    
    async def create_issue(self, project_key: str, issue_type: str, summary: str, 
                          description: str, priority: str = "Medium", 
                          assignee: Optional[str] = None, labels: Optional[List[str]] = None,
                          components: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create a new Jira issue"""
        try:
            issue_data = {
                "fields": {
                    "project": {"key": project_key},
                    "issuetype": {"name": issue_type},
                    "summary": summary,
                    "description": description
                }
            }
            
            # Only add priority if the project supports it (commented out for now)
            # if priority:
            #     issue_data["fields"]["priority"] = {"name": priority}
            
            if assignee:
                issue_data["fields"]["assignee"] = {"accountId": assignee}
            
            if labels:
                issue_data["fields"]["labels"] = labels
            
            if components:
                issue_data["fields"]["components"] = [{"name": comp} for comp in components]
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self._get_api_url("issue"),
                    headers=self.headers,
                    json=issue_data
                )
                if response.status_code != 201:
                    error_detail = response.text
                    logger.error(f"Jira API error: {response.status_code} - {error_detail}")
                    return {
                        "success": False,
                        "error": f"Jira API returned {response.status_code}: {error_detail}"
                    }
                
                result = response.json()
                return {
                    "success": True,
                    "key": result.get("key"),
                    "id": result.get("id"),
                    "self": result.get("self")
                }
        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating Jira issue: {str(e)}")
            return {
                "success": False,
                "error": f"HTTP error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Failed to create Jira issue: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_issue(self, issue_key: str) -> Dict[str, Any]:
        """Get specific issue details"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._get_api_url(f"issue/{issue_key}"),
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get Jira issue {issue_key}: {str(e)}")
            raise
    
    async def search_issues(self, jql: str, max_results: int = 50, 
                           start_at: int = 0) -> Dict[str, Any]:
        """Search for issues using JQL"""
        try:
            search_data = {
                "jql": jql,
                "maxResults": max_results,
                "startAt": start_at
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._get_api_url("search"),
                    headers=self.headers,
                    json=search_data
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to search Jira issues: {str(e)}")
            raise
    
    async def add_comment(self, issue_key: str, comment: str) -> Dict[str, Any]:
        """Add a comment to an issue"""
        try:
            comment_data = {
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": comment
                                }
                            ]
                        }
                    ]
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._get_api_url(f"issue/{issue_key}/comment"),
                    headers=self.headers,
                    json=comment_data
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to add comment to {issue_key}: {str(e)}")
            raise
    
    async def transition_issue(self, issue_key: str, transition_id: str, 
                              comment: Optional[str] = None) -> bool:
        """Transition an issue to a new status"""
        try:
            transition_data = {
                "transition": {
                    "id": transition_id
                }
            }
            
            if comment:
                transition_data["update"] = {
                    "comment": [
                        {
                            "add": {
                                "body": {
                                    "type": "doc",
                                    "version": 1,
                                    "content": [
                                        {
                                            "type": "paragraph",
                                            "content": [
                                                {
                                                    "type": "text",
                                                    "text": comment
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._get_api_url(f"issue/{issue_key}/transitions"),
                    headers=self.headers,
                    json=transition_data
                )
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Failed to transition issue {issue_key}: {str(e)}")
            return False
    
    async def get_transitions(self, issue_key: str) -> List[Dict[str, Any]]:
        """Get available transitions for an issue"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._get_api_url(f"issue/{issue_key}/transitions"),
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json().get("transitions", [])
        except Exception as e:
            logger.error(f"Failed to get transitions for {issue_key}: {str(e)}")
            raise
    
    async def create_security_issue(self, project_key: str, vulnerability: Dict[str, Any], 
                                   repository: str) -> Dict[str, Any]:
        """Create a security issue from vulnerability data"""
        try:
            severity = vulnerability.get("severity", "Medium").title()
            summary = f"Security: {vulnerability['title']} in {repository}"
            
            description = f"""
## Security Vulnerability Detected

**Repository:** {repository}
**File:** {vulnerability.get('file', 'Unknown')}
**Line:** {vulnerability.get('line', 'Unknown')}
**Severity:** {severity}

## Description
{vulnerability.get('description', 'No description provided')}

## Recommendation
Please review and address this security vulnerability as soon as possible.

---
*This issue was automatically created by the Code Analyzer system.*
            """.strip()
            
            return await self.create_issue(
                project_key=project_key,
                issue_type="Security Issue",
                summary=summary,
                description=description,
                priority=severity,
                labels=["security", "automated", repository.replace("/", "-")]
            )
        except Exception as e:
            logger.error(f"Failed to create security issue: {str(e)}")
            raise
    
    async def create_quality_issue(self, project_key: str, quality_data: Dict[str, Any], 
                                  repository: str) -> Dict[str, Any]:
        """Create a quality gate failure issue"""
        try:
            summary = f"Quality Gate Failed: {repository}"
            
            description = f"""
## Quality Gate Failure

**Repository:** {repository}
**Quality Score:** {quality_data.get('score', 'Unknown')}%
**Technical Debt:** {quality_data.get('technical_debt', 'Unknown')}
**Code Smells:** {quality_data.get('code_smells', 'Unknown')}

## Issues to Address
- Maintainability: {quality_data.get('maintainability', 'Unknown')}%
- Reliability: {quality_data.get('reliability', 'Unknown')}%
- Duplicated Lines: {quality_data.get('duplicated_lines', 'Unknown')}%

## Action Required
Please review and improve the code quality before merging to main branch.

---
*This issue was automatically created by the Code Analyzer system.*
            """.strip()
            
            return await self.create_issue(
                project_key=project_key,
                issue_type="Task",
                summary=summary,
                description=description,
                priority="High",
                labels=["quality", "automated", repository.replace("/", "-")]
            )
        except Exception as e:
            logger.error(f"Failed to create quality issue: {str(e)}")
            raise
    
    async def get_project_statistics(self, project_key: str, days: int = 30) -> Dict[str, Any]:
        """Get project statistics for the last N days"""
        try:
            since_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            
            # Search for various issue types
            jql_queries = {
                "total_issues": f"project = {project_key} AND created >= {since_date}",
                "open_issues": f"project = {project_key} AND status in (Open, 'In Progress', 'To Do') AND created >= {since_date}",
                "resolved_issues": f"project = {project_key} AND status in (Done, Resolved, Closed) AND resolved >= {since_date}",
                "security_issues": f"project = {project_key} AND labels = security AND created >= {since_date}",
                "quality_issues": f"project = {project_key} AND labels = quality AND created >= {since_date}"
            }
            
            statistics = {"period_days": days}
            
            for stat_name, jql in jql_queries.items():
                try:
                    result = await self.search_issues(jql, max_results=0)  # Just get count
                    statistics[stat_name] = result.get("total", 0)
                except Exception as e:
                    logger.warning(f"Failed to get {stat_name} for {project_key}: {str(e)}")
                    statistics[stat_name] = 0
            
            return statistics
            
        except Exception as e:
            logger.error(f"Failed to get project statistics for {project_key}: {str(e)}")
            raise

    async def bulk_create_issues(self, issues: List[Dict[str, Any]], project_key: str) -> Dict[str, Any]:
        """
        Create multiple issues in bulk
        
        Args:
            issues: List of issue data dictionaries
            project_key: Jira project key
            
        Returns:
            Dictionary with creation results
        """
        try:
            if not issues:
                return {"success": True, "created": 0, "errors": []}
            
            # Validate project exists
            project_info = await self.get_project_info(project_key)
            if not project_info:
                raise ValueError(f"Project {project_key} not found")
            
            # Prepare bulk create payload
            bulk_payload = {
                "issueUpdates": [
                    {
                        "fields": issue.get("fields", {})
                    }
                    for issue in issues
                ]
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self._get_api_url("issue/bulk"),
                    headers=self.headers,
                    json=bulk_payload
                )
                
                if response.status_code == 201:
                    result = response.json()
                    created_issues = result.get("issues", [])
                    errors = result.get("errors", [])
                    
                    logger.info(f"Successfully created {len(created_issues)} issues in project {project_key}")
                    
                    return {
                        "success": True,
                        "created": len(created_issues),
                        "issues": created_issues,
                        "errors": errors,
                        "project_key": project_key
                    }
                elif response.status_code == 400:
                    error_data = response.json()
                    logger.error(f"Bulk create validation errors: {error_data}")
                    return {
                        "success": False,
                        "created": 0,
                        "errors": error_data.get("errors", []),
                        "error_messages": error_data.get("errorMessages", [])
                    }
                else:
                    logger.error(f"Bulk create failed with status {response.status_code}: {response.text}")
                    return {
                        "success": False,
                        "created": 0,
                        "errors": [f"HTTP {response.status_code}: {response.text}"]
                    }
                    
        except Exception as e:
            logger.error(f"Failed to bulk create issues in {project_key}: {str(e)}")
            return {
                "success": False,
                "created": 0,
                "errors": [str(e)]
            }
    
    async def update_issue(self, issue_key: str, fields: Dict[str, Any]) -> bool:
        """Update a Jira issue with new field values including enhanced fields"""
        try:
            # Prepare update data based on field mappings
            update_data = {"fields": {}}
            
            for field, value in fields.items():
                if field == "summary":
                    update_data["fields"]["summary"] = value
                elif field == "description":
                    # Enhanced description with all documentation fields
                    if isinstance(value, dict) and "enhanced_description" in value:
                        # Use the enhanced description that includes all fields
                        update_data["fields"]["description"] = {
                            "type": "doc",
                            "version": 1,
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": str(value["enhanced_description"])
                                        }
                                    ]
                                }
                            ]
                        }
                    else:
                        update_data["fields"]["description"] = {
                            "type": "doc",
                            "version": 1,
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": str(value)
                                        }
                                    ]
                                }
                            ]
                        }
                elif field == "priority":
                    update_data["fields"]["priority"] = {"name": value}
                elif field == "assignee":
                    if value:
                        # Note: This would need proper user lookup in real implementation
                        update_data["fields"]["assignee"] = {"displayName": value}
                    else:
                        update_data["fields"]["assignee"] = None
                elif field == "labels":
                    update_data["fields"]["labels"] = value if isinstance(value, list) else [value]
                elif field == "story_points":
                    # Story points custom field
                    update_data["fields"]["customfield_10016"] = value
                elif field == "enhanced_labels":
                    # Enhanced labels including metadata
                    enhanced_labels = value if isinstance(value, list) else []
                    update_data["fields"]["labels"] = enhanced_labels
                # Note: Enhanced fields like user_persona, testing_notes, etc. are stored in description
                # or could be mapped to custom fields if available in Jira instance
                # Custom field mapping would be configured per Jira instance
            
            if not update_data["fields"]:
                logger.warning(f"No valid fields to update for issue {issue_key}")
                return True
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    self._get_api_url(f"issue/{issue_key}"),
                    headers=self.headers,
                    json=update_data
                )
                response.raise_for_status()
                logger.info(f"Successfully updated Jira issue {issue_key} with fields: {list(fields.keys())}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to update issue {issue_key}: {str(e)}")
            return False
    
    async def get_board_configuration(self, project_key: str) -> Dict[str, Any]:
        """Get board configuration including columns, issue types, and priorities"""
        try:
            # Get project info first
            project_info = await self.get_project(project_key)
            
            # Get available issue types for the project
            issue_types = []
            try:
                types_data = await self.get_issue_types(project_key)
                for issue_type in types_data:
                    issue_types.append({
                        "id": issue_type.get("id"),
                        "name": issue_type.get("name"),
                        "icon": self._get_issue_type_icon(issue_type.get("name", ""))
                    })
            except Exception as e:
                logger.warning(f"Could not get issue types for {project_key}: {e}")
            
            # Get available priorities
            priorities = []
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        self._get_api_url("priority"),
                        headers=self.headers
                    )
                    if response.status_code == 200:
                        priorities_data = response.json()
                        for priority in priorities_data:
                            priorities.append({
                                "id": priority.get("id"),
                                "name": priority.get("name"),
                                "color": self._get_priority_color(priority.get("name", ""))
                            })
            except Exception as e:
                logger.warning(f"Could not get priorities: {e}")
            
            # Get board columns/statuses by searching for existing issues
            columns = []
            try:
                # Search for some recent issues to discover statuses
                search_result = await self.search_issues(f"project = {project_key}", max_results=100)
                status_set = set()
                
                for issue in search_result.get("issues", []):
                    status_name = issue.get("fields", {}).get("status", {}).get("name")
                    if status_name:
                        status_set.add(status_name)
                
                # Convert to ordered columns
                status_order = ["To Do", "In Progress", "In Review", "Review", "Testing", "Done", "Closed"]
                ordered_statuses = []
                remaining_statuses = list(status_set)
                
                # Add known statuses in order
                for status in status_order:
                    if status in remaining_statuses:
                        ordered_statuses.append(status)
                        remaining_statuses.remove(status)
                
                # Add any remaining statuses
                ordered_statuses.extend(sorted(remaining_statuses))
                
                # Create column configuration
                for i, status in enumerate(ordered_statuses):
                    columns.append({
                        "id": status.lower().replace(" ", "-"),
                        "name": status,
                        "color": self._get_status_color(status),
                        "order": i + 1,
                        "wip_limit": self._get_wip_limit(status)
                    })
                    
            except Exception as e:
                logger.warning(f"Could not get board columns for {project_key}: {e}")
            
            return {
                "success": True,
                "project_key": project_key,
                "project_name": project_info.get("name", project_key),
                "board_id": "real",
                "columns": columns,
                "issue_types": issue_types,
                "priorities": priorities,
                "is_mock": False
            }
            
        except Exception as e:
            logger.error(f"Failed to get board configuration for {project_key}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "is_mock": False
            }
    
    def _get_issue_type_icon(self, issue_type: str) -> str:
        """Get emoji icon for issue type"""
        icon_mapping = {
            "Story": "📋",
            "Task": "✅", 
            "Bug": "🐛",
            "Epic": "🎯",
            "Sub-task": "📝",
            "Feature": "🚀",
            "Improvement": "⬆️",
            "New Feature": "✨"
        }
        return icon_mapping.get(issue_type, "📄")
    
    def _get_priority_color(self, priority: str) -> str:
        """Get color for priority"""
        color_mapping = {
            "Highest": "red",
            "Critical": "red",
            "High": "orange", 
            "Medium": "yellow",
            "Low": "green",
            "Lowest": "gray"
        }
        return color_mapping.get(priority, "gray")
    
    def _get_status_color(self, status: str) -> str:
        """Get color for status"""
        color_mapping = {
            "To Do": "gray",
            "Open": "gray",
            "Backlog": "gray",
            "In Progress": "blue",
            "In Review": "purple",
            "Review": "purple",
            "Testing": "orange",
            "Done": "green",
            "Closed": "green",
            "Resolved": "green"
        }
        return color_mapping.get(status, "gray")
    
    def _get_wip_limit(self, status: str) -> Optional[int]:
        """Get work in progress limit for status"""
        wip_limits = {
            "In Progress": 3,
            "In Review": 2,
            "Review": 2,
            "Testing": 2
        }
        return wip_limits.get(status)
    
    async def get_project_info(self, project_key: str) -> Optional[Dict[str, Any]]:
        """Get basic project information with error handling"""
        try:
            return await self.get_project(project_key)
        except Exception as e:
            logger.error(f"Failed to get project info for {project_key}: {str(e)}")
            return None

# Global Jira service instance
jira_service = JiraIntegrationService()
