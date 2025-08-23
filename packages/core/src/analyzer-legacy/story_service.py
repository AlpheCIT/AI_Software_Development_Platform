"""
Story Management Service for project management and Jira synchronization.
Handles story persistence, sync operations, and conflict resolution.
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Union, Set
from datetime import datetime, timedelta
import hashlib
import json

from database import db_connection
from jira_integration import jira_service

logger = logging.getLogger(__name__)

class StoryConflict:
    """Represents a sync conflict between local and Jira stories"""
    def __init__(self, story_id: str, field: str, local_value: Any, jira_value: Any, timestamp: datetime):
        self.story_id = story_id
        self.field = field
        self.local_value = local_value
        self.jira_value = jira_value
        self.timestamp = timestamp
        self.resolution = None  # 'local', 'jira', or 'manual'

class SyncResult:
    """Result of a sync operation"""
    def __init__(self):
        self.stories_updated = 0
        self.stories_created = 0
        self.conflicts = []
        self.errors = []
        self.sync_timestamp = datetime.utcnow()

class StoryService:
    """Service for managing user stories, sprints, and Jira synchronization"""
    
    def __init__(self, db_connection, jira_service):
        """Initialize the story service"""
        self.db = db_connection
        self.jira = jira_service
        
        # Initialize collections (create if they don't exist)
        if self.db.is_connected():
            self.stories_collection = self.db.create_collection("stories")
            self.sync_states_collection = self.db.create_collection("sync_states")
            self.dependencies_collection = self.db.create_collection("story_dependencies")
            self.sprints_collection = self.db.create_collection("sprints")
            self.sprint_history_collection = self.db.create_collection("sprint_history")
        else:
            self.stories_collection = None
            self.sync_states_collection = None
            self.dependencies_collection = None
            self.sprints_collection = None
            self.sprint_history_collection = None
        
        # In-memory fallback if ArangoDB is not available
        self._fallback_stories = {}
        self._fallback_sync_states = {}
        self._fallback_sprints = {}
        self._fallback_sprint_history = {}
        self._fallback_conflicts = {}
    
    async def save_story(self, story: Dict[str, Any], project: str = "default") -> str:
        """Save a story to the database"""
        try:
            now = datetime.utcnow().isoformat()
            
            # Calculate content hash for change detection
            content_hash = self._calculate_story_hash(story)
            
            story_doc = {
                "story_id": story["id"],
                "project": project,
                "title": story["title"],
                "description": story["description"],
                "priority": story["priority"],
                "story_points": story["story_points"],
                "component": story["component"],
                "assignee": story["assignee"],
                "acceptance_criteria": story["acceptance_criteria"],
                "technical_notes": story["technical_notes"],
                "dependencies": story["dependencies"],
                "status": story.get("status", "Backlog"),
                "estimated_hours": story["estimated_hours"],
                "created": story.get("created", now),
                "last_modified": now,
                "content_hash": content_hash,
                "jira_key": story.get("jira_key"),
                "jira_sync_status": story.get("jira_sync_status", "not_synced"),
                "sync_conflicts": [],
                # Basic enhanced fields from consultant's code
                "tags": story.get("tags", []),
                "risk_level": story.get("risk_level", "low"),
                "business_value": story.get("business_value", "medium"),
                "sprint_id": story.get("sprint_id"),
                
                # Comprehensive Enhanced Documentation Fields
                "user_persona": story.get("user_persona"),
                "user_goal": story.get("user_goal"),
                "definition_of_done": story.get("definition_of_done", []),
                "testing_notes": story.get("testing_notes"),
                "design_notes": story.get("design_notes"),
                "security_considerations": story.get("security_considerations"),
                "performance_requirements": story.get("performance_requirements"),
                "accessibility_notes": story.get("accessibility_notes"),
                "deployment_notes": story.get("deployment_notes"),
                "rollback_plan": story.get("rollback_plan"),
                "monitoring_requirements": story.get("monitoring_requirements"),
                "documentation_links": story.get("documentation_links", []),
                "related_stories": story.get("related_stories", []),
                "blocked_by": story.get("blocked_by", []),
                "blocking": story.get("blocking", []),
                "effort_breakdown": story.get("effort_breakdown"),
                "changelog": story.get("changelog", []),
                "comments": story.get("comments", []),
                "attachments": story.get("attachments", []),
                "last_updated": story.get("last_updated"),
                "last_updated_by": story.get("last_updated_by"),
                "story_type": story.get("story_type"),
                "epic_id": story.get("epic_id"),
                "sub_tasks": story.get("sub_tasks", []),
                "time_tracking": story.get("time_tracking")
            }
            
            if self.stories_collection:
                # Check if story exists
                existing = list(self.stories_collection.find({"story_id": story["id"]}, limit=1))
                if existing:
                    # Update existing story
                    self.stories_collection.update({"story_id": story["id"]}, story_doc)
                    logger.info(f"Updated story: {story['id']}")
                else:
                    # Create new story
                    self.stories_collection.insert(story_doc)
                    logger.info(f"Created story: {story['id']}")
            else:
                # Fallback to in-memory storage
                project_key = f"{project}:{story['id']}"
                self._fallback_stories[project_key] = story_doc
                logger.info(f"Saved story to fallback storage: {story['id']}")
            
            return story["id"]
        
        except Exception as e:
            logger.error(f"Error saving story {story.get('id', 'unknown')}: {str(e)}")
            raise
    
    async def get_stories(self, project: str = "default", status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get stories from the database"""
        try:
            if self.stories_collection:
                query_filter = {"project": project}
                if status:
                    query_filter["status"] = status
                
                stories = list(self.stories_collection.find(query_filter))
            else:
                # Fallback to in-memory storage
                stories = []
                for key, story_doc in self._fallback_stories.items():
                    proj, story_id = key.split(":", 1)
                    if proj == project:
                        if not status or story_doc.get("status") == status:
                            stories.append(story_doc)
            
            # Convert to frontend format with all enhanced fields
            formatted_stories = []
            for story in stories:
                formatted_story = {
                    "id": story["story_id"],
                    "title": story["title"],
                    "description": story["description"],
                    "priority": story["priority"],
                    "story_points": story["story_points"],
                    "component": story["component"],
                    "assignee": story["assignee"],
                    "acceptance_criteria": story["acceptance_criteria"],
                    "technical_notes": story["technical_notes"],
                    "dependencies": story["dependencies"],
                    "status": story["status"],
                    "estimated_hours": story["estimated_hours"],
                    "created": story["created"],
                    "last_modified": story["last_modified"],
                    "jira_key": story.get("jira_key"),
                    "jira_sync_status": story.get("jira_sync_status", "not_synced"),
                    "sync_conflicts": story.get("sync_conflicts", []),
                    
                    # Basic enhanced fields
                    "tags": story.get("tags", []),
                    "risk_level": story.get("risk_level", "low"),
                    "business_value": story.get("business_value", "medium"),
                    "sprint_id": story.get("sprint_id"),
                    
                    # Comprehensive Enhanced Documentation Fields
                    "user_persona": story.get("user_persona"),
                    "user_goal": story.get("user_goal"),
                    "definition_of_done": story.get("definition_of_done", []),
                    "testing_notes": story.get("testing_notes"),
                    "design_notes": story.get("design_notes"),
                    "security_considerations": story.get("security_considerations"),
                    "performance_requirements": story.get("performance_requirements"),
                    "accessibility_notes": story.get("accessibility_notes"),
                    "deployment_notes": story.get("deployment_notes"),
                    "rollback_plan": story.get("rollback_plan"),
                    "monitoring_requirements": story.get("monitoring_requirements"),
                    "documentation_links": story.get("documentation_links", []),
                    "related_stories": story.get("related_stories", []),
                    "blocked_by": story.get("blocked_by", []),
                    "blocking": story.get("blocking", []),
                    "effort_breakdown": story.get("effort_breakdown"),
                    "changelog": story.get("changelog", []),
                    "comments": story.get("comments", []),
                    "attachments": story.get("attachments", []),
                    "last_updated": story.get("last_updated"),
                    "last_updated_by": story.get("last_updated_by"),
                    "story_type": story.get("story_type"),
                    "epic_id": story.get("epic_id"),
                    "sub_tasks": story.get("sub_tasks", []),
                    "time_tracking": story.get("time_tracking")
                }
                formatted_stories.append(formatted_story)
            
            return formatted_stories
        
        except Exception as e:
            logger.error(f"Error getting stories for project {project}: {str(e)}")
            raise
    
    async def update_story_status(self, story_id: str, new_status: str, project: str = "default") -> bool:
        """Update a story's status"""
        try:
            if self.stories_collection:
                result = self.stories_collection.update(
                    {"story_id": story_id, "project": project},
                    {
                        "status": new_status,
                        "last_modified": datetime.utcnow().isoformat()
                    }
                )
                
                if result:
                    logger.info(f"Updated story {story_id} status to {new_status}")
                    return True
                return False
            else:
                # Fallback to in-memory storage
                project_key = f"{project}:{story_id}"
                if project_key in self._fallback_stories:
                    self._fallback_stories[project_key]["status"] = new_status
                    self._fallback_stories[project_key]["last_modified"] = datetime.utcnow().isoformat()
                    logger.info(f"Updated story {story_id} status to {new_status} (fallback)")
                    return True
                return False
        
        except Exception as e:
            logger.error(f"Error updating story {story_id} status: {str(e)}")
            raise
    
    async def get_all_stories(self, project: str = "default") -> Dict[str, Any]:
        """Get all stories in the format expected by the API"""
        try:
            stories = await self.get_stories(project)
            return {
                "success": True,
                "stories": stories,
                "count": len(stories)
            }
        except Exception as e:
            logger.error(f"Error getting all stories: {str(e)}")
            return {
                "success": False,
                "stories": [],
                "count": 0,
                "error": str(e)
            }
    
    async def bulk_save_stories(self, stories: List[Dict[str, Any]], project: str = "default") -> Dict[str, Any]:
        """Save multiple stories to the database"""
        try:
            saved_count = 0
            errors = []
            
            for story in stories:
                try:
                    await self.save_story(story, project)
                    saved_count += 1
                except Exception as e:
                    errors.append({
                        "story_id": story.get("id", "unknown"),
                        "error": str(e)
                    })
            
            return {
                "saved_count": saved_count,
                "total_stories": len(stories),
                "errors": errors
            }
        
        except Exception as e:
            logger.error(f"Error in bulk save stories: {str(e)}")
            raise
    
    async def sync_with_jira(self, project_key: str, project: str = "default") -> SyncResult:
        """Synchronize stories with Jira"""
        try:
            result = SyncResult()
            
            # Get local stories
            local_stories = await self.get_stories(project)
            local_by_jira_key = {s["jira_key"]: s for s in local_stories if s.get("jira_key")}
            
            # Get Jira issues
            jira_issues = await self._get_jira_issues(project_key)
            jira_by_key = {issue["key"]: issue for issue in jira_issues}
            
            # Process local stories that have Jira keys
            for local_story in local_stories:
                if local_story.get("jira_key"):
                    jira_key = local_story["jira_key"]
                    if jira_key in jira_by_key:
                        # Compare and update
                        await self._sync_story_with_jira(local_story, jira_by_key[jira_key], result)
                    else:
                        # Jira issue was deleted or moved
                        logger.warning(f"Jira issue {jira_key} not found for story {local_story['id']}")
            
            # Process Jira issues not in local stories
            for jira_key, jira_issue in jira_by_key.items():
                if jira_key not in local_by_jira_key:
                    # Create local story from Jira issue
                    await self._create_story_from_jira(jira_issue, project, result)
            
            # Update sync timestamp
            await self._update_sync_state(project, project_key, result.sync_timestamp)
            
            return result
        
        except Exception as e:
            logger.error(f"Error syncing with Jira: {str(e)}")
            raise
    
    async def get_sync_conflicts(self, project: str = "default") -> List[StoryConflict]:
        """Get unresolved sync conflicts"""
        try:
            if self.stories_collection:
                stories = self.stories_collection.find({
                    "project": project,
                    "sync_conflicts": {"$ne": []}
                })
            else:
                # Fallback: return conflicts from in-memory storage
                return self._fallback_conflicts.get(project, [])
            
            conflicts = []
            for story in stories:
                for conflict_data in story.get("sync_conflicts", []):
                    conflict = StoryConflict(
                        story_id=story["story_id"],
                        field=conflict_data["field"],
                        local_value=conflict_data["local_value"],
                        jira_value=conflict_data["jira_value"],
                        timestamp=datetime.fromisoformat(conflict_data["timestamp"])
                    )
                    conflict.resolution = conflict_data.get("resolution")
                    conflicts.append(conflict)
            
            return conflicts
        
        except Exception as e:
            logger.error(f"Error getting sync conflicts: {str(e)}")
            # Return empty list on error
            return []
    
    async def resolve_conflict(self, story_id: str, field: str, resolution: str, project: str = "default") -> bool:
        """Resolve a sync conflict"""
        try:
            story = self.stories_collection.find_one({"story_id": story_id, "project": project})
            if not story:
                return False
            
            conflicts = story.get("sync_conflicts", [])
            updated_conflicts = []
            
            for conflict in conflicts:
                if conflict["field"] == field:
                    conflict["resolution"] = resolution
                    conflict["resolved_at"] = datetime.utcnow().isoformat()
                    
                    # Apply resolution
                    if resolution == "local":
                        # Keep local value, update Jira if needed
                        pass
                    elif resolution == "jira":
                        # Update local with Jira value
                        story[field] = conflict["jira_value"]
                
                updated_conflicts.append(conflict)
            
            # Update story
            self.stories_collection.update(
                {"story_id": story_id, "project": project},
                {
                    "sync_conflicts": updated_conflicts,
                    "last_modified": datetime.utcnow().isoformat()
                }
            )
            
            return True
        
        except Exception as e:
            logger.error(f"Error resolving conflict for story {story_id}: {str(e)}")
            raise
    
    def _calculate_story_hash(self, story: Dict[str, Any]) -> str:
        """Calculate hash of story content for change detection"""
        # Include fields that matter for sync
        content = {
            "title": story.get("title", ""),
            "description": story.get("description", ""),
            "priority": story.get("priority", ""),
            "story_points": story.get("story_points", 0),
            "status": story.get("status", ""),
            "assignee": story.get("assignee", ""),
            "acceptance_criteria": story.get("acceptance_criteria", []),
            "technical_notes": story.get("technical_notes", "")
        }
        
        content_str = json.dumps(content, sort_keys=True)
        return hashlib.md5(content_str.encode()).hexdigest()
    
    async def _get_jira_issues(self, project_key: str) -> List[Dict[str, Any]]:
        """Get issues from Jira project"""
        try:
            # Use Jira search API to get issues - simplified query to get all project issues
            jql = f"project = {project_key} ORDER BY created DESC"
            search_result = await self.jira.search_issues(jql, max_results=20)
            return search_result.get("issues", [])
        except Exception as e:
            logger.error(f"Error getting Jira issues: {str(e)}")
            return []
    
    async def _sync_story_with_jira(self, local_story: Dict[str, Any], jira_issue: Dict[str, Any], result: SyncResult):
        """Sync a single story with its Jira counterpart"""
        try:
            conflicts = []
            
            # Map Jira fields to local fields
            jira_status = self._map_jira_status(jira_issue.get("fields", {}).get("status", {}).get("name", ""))
            jira_priority = jira_issue.get("fields", {}).get("priority", {}).get("name", "Medium")
            jira_assignee = jira_issue.get("fields", {}).get("assignee", {}).get("displayName", "")
            jira_summary = jira_issue.get("fields", {}).get("summary", "")
            
            # Check for conflicts
            if local_story["status"] != jira_status:
                conflicts.append({
                    "field": "status",
                    "local_value": local_story["status"],
                    "jira_value": jira_status,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            if local_story["title"] != jira_summary:
                conflicts.append({
                    "field": "title", 
                    "local_value": local_story["title"],
                    "jira_value": jira_summary,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            if local_story["priority"] != jira_priority:
                conflicts.append({
                    "field": "priority",
                    "local_value": local_story["priority"],
                    "jira_value": jira_priority,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Update story with conflicts if any
            if conflicts:
                self.stories_collection.update(
                    {"story_id": local_story["id"]},
                    {
                        "sync_conflicts": conflicts,
                        "last_modified": datetime.utcnow().isoformat()
                    }
                )
                result.conflicts.extend([
                    StoryConflict(
                        story_id=local_story["id"],
                        field=c["field"],
                        local_value=c["local_value"],
                        jira_value=c["jira_value"],
                        timestamp=datetime.fromisoformat(c["timestamp"])
                    ) for c in conflicts
                ])
            else:
                # No conflicts, update sync status
                self.stories_collection.update(
                    {"story_id": local_story["id"]},
                    {
                        "jira_sync_status": "synced",
                        "last_modified": datetime.utcnow().isoformat()
                    }
                )
                result.stories_updated += 1
        
        except Exception as e:
            logger.error(f"Error syncing story {local_story['id']}: {str(e)}")
            result.errors.append(f"Story {local_story['id']}: {str(e)}")
    
    async def _create_story_from_jira(self, jira_issue: Dict[str, Any], project: str, result: SyncResult):
        """Create a local story from a Jira issue"""
        try:
            fields = jira_issue.get("fields", {})
            
            story = {
                "id": f"JIRA-{jira_issue['key']}",
                "title": fields.get("summary", ""),
                "description": self._extract_jira_description(fields.get("description", {})),
                "priority": fields.get("priority", {}).get("name", "Medium"),
                "story_points": fields.get("customfield_10016", 0),  # Common story points field
                "component": fields.get("components", [{}])[0].get("name", "Backend") if fields.get("components") else "Backend",
                "assignee": fields.get("assignee", {}).get("displayName", "") if fields.get("assignee") else "",
                "acceptance_criteria": [],
                "technical_notes": "",
                "dependencies": [],
                "status": self._map_jira_status(fields.get("status", {}).get("name", "")),
                "estimated_hours": 0,
                "jira_key": jira_issue["key"],
                "jira_sync_status": "synced"
            }
            
            await self.save_story(story, project)
            result.stories_created += 1
        
        except Exception as e:
            logger.error(f"Error creating story from Jira issue {jira_issue.get('key', 'unknown')}: {str(e)}")
            result.errors.append(f"Jira issue {jira_issue.get('key', 'unknown')}: {str(e)}")
    
    def _map_jira_status(self, jira_status: str) -> str:
        """Map Jira status to Kanban column"""
        status_mapping = {
            "To Do": "Backlog",
            "Backlog": "Backlog", 
            "In Progress": "In Progress",
            "In Review": "In Review",
            "Code Review": "In Review",
            "Done": "Done",
            "Closed": "Done",
            "Resolved": "Done"
        }
        return status_mapping.get(jira_status, "Backlog")
    
    def _extract_jira_description(self, description_obj: Dict[str, Any]) -> str:
        """Extract plain text from Jira's ADF (Atlassian Document Format)"""
        if isinstance(description_obj, str):
            return description_obj
        
        if isinstance(description_obj, dict) and "content" in description_obj:
            text_parts = []
            for content in description_obj["content"]:
                if content.get("type") == "paragraph":
                    for item in content.get("content", []):
                        if item.get("type") == "text":
                            text_parts.append(item.get("text", ""))
            return " ".join(text_parts)
        
        return ""
    
    async def _update_sync_state(self, project: str, external_id: str, sync_time: datetime):
        """Update sync state tracking"""
        try:
            sync_doc = {
                "entity_type": "project",
                "entity_id": project,
                "external_system": "jira",
                "external_id": external_id,
                "last_sync": sync_time.isoformat(),
                "sync_status": "completed"
            }
            
            existing = self.sync_states_collection.find({
                "entity_type": "project",
                "entity_id": project,
                "external_system": "jira"
            }, limit=1)
            
            if existing:
                self.sync_states_collection.update(
                    {"entity_type": "project", "entity_id": project, "external_system": "jira"},
                    sync_doc
                )
            else:
                self.sync_states_collection.insert(sync_doc)
        
        except Exception as e:
            logger.error(f"Error updating sync state: {str(e)}")

    # ================================================================================
    # Sprint Management Methods
    # ================================================================================
    
    async def create_sprint(self, name: str, project: str = "default", 
                           start_date: Optional[datetime] = None, 
                           end_date: Optional[datetime] = None,
                           goal: str = "", duration_weeks: int = 2) -> str:
        """Create a new sprint"""
        try:
            if not start_date:
                start_date = datetime.utcnow()
            if not end_date:
                end_date = start_date + timedelta(weeks=duration_weeks)
            
            sprint_id = f"sprint_{project}_{int(datetime.utcnow().timestamp())}"
            
            sprint_doc = {
                "sprint_id": sprint_id,
                "name": name,
                "project": project,
                "goal": goal,
                "state": "planned",  # planned, active, completed, closed
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "duration_weeks": duration_weeks,
                "story_ids": [],
                "jira_sprint_id": None,
                "jira_sync_status": "not_synced",
                "created": datetime.utcnow().isoformat(),
                "last_modified": datetime.utcnow().isoformat(),
                "sync_conflicts": []
            }
            
            if self.sprints_collection:
                self.sprints_collection.insert(sprint_doc)
                logger.info(f"Created sprint: {sprint_id}")
            else:
                # Fallback to in-memory storage
                self._fallback_sprints[sprint_id] = sprint_doc
                logger.info(f"Created sprint in fallback storage: {sprint_id}")
            
            return sprint_id
            
        except Exception as e:
            logger.error(f"Error creating sprint: {str(e)}")
            raise
    
    async def get_sprints(self, project: str = "default", state: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get sprints for a project"""
        try:
            if self.sprints_collection:
                query_filter = {"project": project}
                if state:
                    query_filter["state"] = state
                
                sprints = list(self.sprints_collection.find(query_filter))
                
                # Add story details to each sprint
                for sprint in sprints:
                    if sprint.get("story_ids"):
                        sprint_stories = []
                        for story_id in sprint["story_ids"]:
                            story = list(self.stories_collection.find({"id": story_id}, limit=1))
                            if story:
                                sprint_stories.append(story[0])
                        sprint["stories"] = sprint_stories
                    else:
                        sprint["stories"] = []
                
                return sprints
            else:
                # Fallback to in-memory storage
                sprints = []
                for sprint_id, sprint_doc in self._fallback_sprints.items():
                    if sprint_doc["project"] == project:
                        if not state or sprint_doc["state"] == state:
                            sprints.append(sprint_doc)
                return sprints
                
        except Exception as e:
            logger.error(f"Error getting sprints: {str(e)}")
            raise
    
    async def add_story_to_sprint(self, story_id: str, sprint_id: str, project: str = "default") -> bool:
        """Add a story to a sprint"""
        try:
            if self.sprints_collection and self.stories_collection:
                # Update sprint
                sprint = list(self.sprints_collection.find({"sprint_id": sprint_id}, limit=1))
                if not sprint:
                    raise ValueError(f"Sprint {sprint_id} not found")
                
                sprint = sprint[0]
                if story_id not in sprint.get("story_ids", []):
                    story_ids = sprint.get("story_ids", [])
                    story_ids.append(story_id)
                    
                    self.sprints_collection.update_match(
                        {"sprint_id": sprint_id},
                        {"story_ids": story_ids, "last_modified": datetime.utcnow().isoformat()}
                    )
                
                # Update story - use update_match for custom field queries
                updated = self.stories_collection.update_match(
                    {"story_id": story_id, "project": project},
                    {"sprint_id": sprint_id, "last_modified": datetime.utcnow().isoformat()}
                )
                
                if updated == 0:
                    # Try with 'id' field as fallback
                    updated = self.stories_collection.update_match(
                        {"id": story_id},
                        {"sprint_id": sprint_id, "last_modified": datetime.utcnow().isoformat()}
                    )
                
                # Log movement
                await self._log_sprint_movement(story_id, "backlog", sprint_id, "added_to_sprint")
                
                logger.info(f"Added story {story_id} to sprint {sprint_id} (updated {updated} documents)")
                return updated > 0
            else:
                # Fallback logic
                if sprint_id in self._fallback_sprints:
                    sprint = self._fallback_sprints[sprint_id]
                    if story_id not in sprint.get("story_ids", []):
                        sprint["story_ids"] = sprint.get("story_ids", []) + [story_id]
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Error adding story to sprint: {str(e)}")
            return False
    
    async def move_story_in_sprint(self, story_id: str, new_status: str, project: str = "default") -> bool:
        """Move a story to a different status within a sprint"""
        try:
            if self.stories_collection:
                # First try with story_id field
                story = list(self.stories_collection.find({"story_id": story_id, "project": project}, limit=1))
                if not story:
                    # Fallback to id field
                    story = list(self.stories_collection.find({"id": story_id}, limit=1))
                
                if not story:
                    raise ValueError(f"Story {story_id} not found")
                
                story = story[0]
                old_status = story.get("status", "Backlog")
                
                # Update story status - use update_match for custom field queries
                updated = self.stories_collection.update_match(
                    {"story_id": story_id, "project": project},
                    {
                        "status": new_status,
                        "last_modified": datetime.utcnow().isoformat()
                    }
                )
                
                if updated == 0:
                    # Fallback to id field
                    updated = self.stories_collection.update_match(
                        {"id": story_id},
                        {
                            "status": new_status,
                            "last_modified": datetime.utcnow().isoformat()
                        }
                    )
                
                # Log movement
                sprint_id = story.get("sprint_id")
                if sprint_id:
                    await self._log_sprint_movement(story_id, old_status, new_status, "status_change", sprint_id)
                
                logger.info(f"Moved story {story_id} from {old_status} to {new_status} (updated {updated} documents)")
                return updated > 0
            else:
                # Fallback logic
                for story_key, story_doc in self._fallback_stories.items():
                    if story_doc["id"] == story_id:
                        story_doc["status"] = new_status
                        story_doc["last_modified"] = datetime.utcnow().isoformat()
                        return True
                return False
                
        except Exception as e:
            logger.error(f"Error moving story in sprint: {str(e)}")
            return False
    
    async def start_sprint(self, sprint_id: str, project: str = "default") -> bool:
        """Start a sprint"""
        try:
            if self.sprints_collection:
                updated = self.sprints_collection.update_match(
                    {"sprint_id": sprint_id},
                    {
                        "state": "active",
                        "actual_start_date": datetime.utcnow().isoformat(),
                        "last_modified": datetime.utcnow().isoformat()
                    }
                )
                
                if updated > 0:
                    # Update all stories in sprint to be in progress
                    sprint = list(self.sprints_collection.find({"sprint_id": sprint_id}, limit=1))
                    if sprint:
                        sprint = sprint[0]
                        for story_id in sprint.get("story_ids", []):
                            story = list(self.stories_collection.find({"story_id": story_id, "project": project}, limit=1))
                            if not story:
                                story = list(self.stories_collection.find({"id": story_id}, limit=1))
                            
                            if story and story[0].get("status") == "Backlog":
                                await self.move_story_in_sprint(story_id, "To Do", project)
                
                logger.info(f"Started sprint {sprint_id} (updated {updated} documents)")
                return updated > 0
            else:
                if sprint_id in self._fallback_sprints:
                    self._fallback_sprints[sprint_id]["state"] = "active"
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Error starting sprint: {str(e)}")
            return False
    
    async def complete_sprint(self, sprint_id: str, project: str = "default") -> Dict[str, Any]:
        """Complete a sprint and return sprint summary"""
        try:
            if self.sprints_collection:
                sprint = list(self.sprints_collection.find({"sprint_id": sprint_id}, limit=1))
                if not sprint:
                    raise ValueError(f"Sprint {sprint_id} not found")
                
                sprint = sprint[0]
                
                # Calculate sprint statistics
                completed_stories = []
                incomplete_stories = []
                
                for story_id in sprint.get("story_ids", []):
                    # Try both field patterns to find stories
                    story = list(self.stories_collection.find({"story_id": story_id, "project": project}, limit=1))
                    if not story:
                        story = list(self.stories_collection.find({"id": story_id}, limit=1))
                    
                    if story:
                        story = story[0]
                        if story.get("status") == "Done":
                            completed_stories.append(story)
                        else:
                            incomplete_stories.append(story)
                
                # Update sprint state
                updated = self.sprints_collection.update_match(
                    {"sprint_id": sprint_id},
                    {
                        "state": "completed",
                        "actual_end_date": datetime.utcnow().isoformat(),
                        "completed_stories": len(completed_stories),
                        "incomplete_stories": len(incomplete_stories),
                        "last_modified": datetime.utcnow().isoformat()
                    }
                )
                
                # Move incomplete stories back to backlog
                for story in incomplete_stories:
                    await self.move_story_in_sprint(story.get("story_id", story.get("id")), "Backlog", project)
                    # Remove from sprint
                    story_id = story.get("story_id", story.get("id"))
                    self.stories_collection.update_match(
                        {"story_id": story_id, "project": project},
                        {"sprint_id": None}
                    )
                    if not story.get("story_id"):  # Try with id field
                        self.stories_collection.update_match(
                            {"id": story_id},
                            {"sprint_id": None}
                        )
                
                summary = {
                    "sprint_id": sprint_id,
                    "completed_stories_count": len(completed_stories),
                    "incomplete_stories_count": len(incomplete_stories),
                    "completion_rate": len(completed_stories) / len(sprint["story_ids"]) * 100 if sprint["story_ids"] else 0,
                    "completed_stories": completed_stories,
                    "incomplete_stories": incomplete_stories
                }
                
                logger.info(f"Completed sprint {sprint_id} with {len(completed_stories)}/{len(sprint['story_ids'])} stories done")
                return summary
            else:
                # Fallback logic
                return {"error": "Sprint completion not available in fallback mode"}
                
        except Exception as e:
            logger.error(f"Error completing sprint: {str(e)}")
            raise
    
    async def _log_sprint_movement(self, story_id: str, from_status: str, to_status: str, 
                                  movement_type: str, sprint_id: str = None):
        """Log story movement for sprint tracking"""
        try:
            movement_doc = {
                "story_id": story_id,
                "sprint_id": sprint_id,
                "from_status": from_status,
                "to_status": to_status,
                "movement_type": movement_type,  # status_change, added_to_sprint, removed_from_sprint
                "timestamp": datetime.utcnow().isoformat(),
                "user": "system"  # Could be enhanced to track actual user
            }
            
            if self.sprint_history_collection:
                self.sprint_history_collection.insert(movement_doc)
            else:
                # Store in fallback
                history_key = f"{story_id}_{int(datetime.utcnow().timestamp())}"
                self._fallback_sprint_history[history_key] = movement_doc
                
        except Exception as e:
            logger.error(f"Error logging sprint movement: {str(e)}")
    
    async def get_sprint_history(self, sprint_id: str = None, story_id: str = None) -> List[Dict[str, Any]]:
        """Get sprint movement history"""
        try:
            if self.sprint_history_collection:
                query_filter = {}
                if sprint_id:
                    query_filter["sprint_id"] = sprint_id
                if story_id:
                    query_filter["story_id"] = story_id
                
                history = list(self.sprint_history_collection.find(query_filter))
                return sorted(history, key=lambda x: x["timestamp"], reverse=True)
            else:
                # Fallback logic
                history = []
                for hist_doc in self._fallback_sprint_history.values():
                    if (not sprint_id or hist_doc.get("sprint_id") == sprint_id) and \
                       (not story_id or hist_doc.get("story_id") == story_id):
                        history.append(hist_doc)
                return sorted(history, key=lambda x: x["timestamp"], reverse=True)
                
        except Exception as e:
            logger.error(f"Error getting sprint history: {str(e)}")
            return []

# Create singleton instance
story_service = StoryService(db_connection, jira_service)
