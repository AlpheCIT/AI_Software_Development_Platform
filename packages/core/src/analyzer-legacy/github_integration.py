"""
GitHub Integration Service for the Code Analyzer platform.
Handles GitHub API interactions, repository management, and webhook processing.
"""

import os
import logging
import asyncio
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import httpx
import base64
import hashlib
import hmac
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class GitHubIntegrationService:
    """Service for handling GitHub API operations and integrations"""
    
    def __init__(self, token: Optional[str] = None):
        """
        Initialize GitHub integration service
        
        Args:
            token: GitHub personal access token or GitHub App token
        """
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CodeAnalyzer/1.0"
        }
        
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"
    
    async def get_repository_info(self, owner: str, repo: str) -> Dict[str, Any]:
        """Get detailed information about a repository"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get repository info for {owner}/{repo}: {str(e)}")
            raise
    
    async def get_repository_contents(self, owner: str, repo: str, path: str = "", ref: str = "main") -> List[Dict[str, Any]]:
        """Get repository contents at a specific path"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
                    headers=self.headers,
                    params={"ref": ref}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get repository contents for {owner}/{repo}/{path}: {str(e)}")
            raise
    
    async def get_file_content(self, owner: str, repo: str, path: str, ref: str = "main") -> str:
        """Get the content of a specific file"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
                    headers=self.headers,
                    params={"ref": ref}
                )
                response.raise_for_status()
                
                file_data = response.json()
                if file_data.get("encoding") == "base64":
                    content = base64.b64decode(file_data["content"]).decode("utf-8")
                    return content
                else:
                    return file_data.get("content", "")
        except Exception as e:
            logger.error(f"Failed to get file content for {owner}/{repo}/{path}: {str(e)}")
            raise
    
    async def get_commits(self, owner: str, repo: str, sha: Optional[str] = None, 
                         since: Optional[datetime] = None, until: Optional[datetime] = None,
                         per_page: int = 30, page: int = 1) -> List[Dict[str, Any]]:
        """Get repository commits"""
        try:
            params = {
                "per_page": per_page,
                "page": page
            }
            
            if sha:
                params["sha"] = sha
            if since:
                params["since"] = since.isoformat()
            if until:
                params["until"] = until.isoformat()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/commits",
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get commits for {owner}/{repo}: {str(e)}")
            raise
    
    async def get_pull_requests(self, owner: str, repo: str, state: str = "open", 
                               per_page: int = 30, page: int = 1) -> List[Dict[str, Any]]:
        """Get repository pull requests"""
        try:
            params = {
                "state": state,
                "per_page": per_page,
                "page": page
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/pulls",
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get pull requests for {owner}/{repo}: {str(e)}")
            raise
    
    async def get_issues(self, owner: str, repo: str, state: str = "open",
                        labels: Optional[List[str]] = None, assignee: Optional[str] = None,
                        per_page: int = 30, page: int = 1) -> List[Dict[str, Any]]:
        """Get repository issues"""
        try:
            params = {
                "state": state,
                "per_page": per_page,
                "page": page
            }
            
            if labels:
                params["labels"] = ",".join(labels)
            if assignee:
                params["assignee"] = assignee
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/issues",
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get issues for {owner}/{repo}: {str(e)}")
            raise
    
    async def create_issue(self, owner: str, repo: str, title: str, body: str,
                          labels: Optional[List[str]] = None, assignees: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create a new issue"""
        try:
            payload = {
                "title": title,
                "body": body
            }
            
            if labels:
                payload["labels"] = labels
            if assignees:
                payload["assignees"] = assignees
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/repos/{owner}/{repo}/issues",
                    headers=self.headers,
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to create issue for {owner}/{repo}: {str(e)}")
            raise
    
    async def create_webhook(self, owner: str, repo: str, webhook_url: str, 
                            events: List[str] = None, secret: Optional[str] = None) -> Dict[str, Any]:
        """Create a webhook for the repository"""
        try:
            if events is None:
                events = ["push", "pull_request", "issues"]
            
            payload = {
                "name": "web",
                "active": True,
                "events": events,
                "config": {
                    "url": webhook_url,
                    "content_type": "json"
                }
            }
            
            if secret:
                payload["config"]["secret"] = secret
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/repos/{owner}/{repo}/hooks",
                    headers=self.headers,
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to create webhook for {owner}/{repo}: {str(e)}")
            raise
    
    async def get_webhooks(self, owner: str, repo: str) -> List[Dict[str, Any]]:
        """Get all webhooks for a repository"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/hooks",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get webhooks for {owner}/{repo}: {str(e)}")
            raise
    
    async def get_repository_languages(self, owner: str, repo: str) -> Dict[str, int]:
        """Get programming languages used in the repository"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/languages",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get languages for {owner}/{repo}: {str(e)}")
            raise
    
    async def get_repository_contributors(self, owner: str, repo: str, 
                                        per_page: int = 30, page: int = 1) -> List[Dict[str, Any]]:
        """Get repository contributors"""
        try:
            params = {
                "per_page": per_page,
                "page": page
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/contributors",
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get contributors for {owner}/{repo}: {str(e)}")
            raise
    
    async def list_user_repositories(self, username: Optional[str] = None, 
                                     type: str = "all", sort: str = "updated",
                                     per_page: int = 30, page: int = 1) -> List[Dict[str, Any]]:
        """List repositories for the authenticated user or a specific user"""
        try:
            if username:
                url = f"{self.base_url}/users/{username}/repos"
            else:
                url = f"{self.base_url}/user/repos"
            
            params = {
                "type": type,  # all, owner, member
                "sort": sort,  # created, updated, pushed, full_name
                "per_page": per_page,
                "page": page
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to list repositories: {str(e)}")
            raise
    
    async def search_repositories(self, query: str, sort: str = "stars", 
                                 order: str = "desc", per_page: int = 30, 
                                 page: int = 1) -> Dict[str, Any]:
        """Search for repositories"""
        try:
            params = {
                "q": query,
                "sort": sort,  # stars, forks, help-wanted-issues, updated
                "order": order,  # asc, desc
                "per_page": per_page,
                "page": page
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/search/repositories",
                    headers=self.headers,
                    params=params
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to search repositories: {str(e)}")
            raise
    
    def parse_repository_url(self, url: str) -> Optional[Dict[str, str]]:
        """Parse GitHub repository URL to extract owner and repo name"""
        try:
            # Handle various GitHub URL formats
            if url.startswith("git@github.com:"):
                # SSH format: git@github.com:owner/repo.git
                parts = url.replace("git@github.com:", "").replace(".git", "").split("/")
                if len(parts) == 2:
                    return {"owner": parts[0], "repo": parts[1]}
            elif "github.com" in url:
                # HTTPS format: https://github.com/owner/repo.git
                parsed = urlparse(url)
                path_parts = parsed.path.strip("/").replace(".git", "").split("/")
                if len(path_parts) >= 2:
                    return {"owner": path_parts[0], "repo": path_parts[1]}
            
            return None
        except Exception as e:
            logger.error(f"Failed to parse repository URL {url}: {str(e)}")
            return None
    
    def verify_webhook_signature(self, payload: bytes, signature: str, secret: str) -> bool:
        """Verify GitHub webhook signature"""
        try:
            if not signature.startswith("sha256="):
                return False
            
            expected_signature = "sha256=" + hmac.new(
                secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(expected_signature, signature)
        except Exception as e:
            logger.error(f"Failed to verify webhook signature: {str(e)}")
            return False
    
    async def analyze_repository_activity(self, owner: str, repo: str, 
                                        days: int = 30) -> Dict[str, Any]:
        """Analyze repository activity over the last N days"""
        try:
            since = datetime.now() - timedelta(days=days)
            
            # Get commits, pull requests, and issues
            commits_task = self.get_commits(owner, repo, since=since, per_page=100)
            prs_task = self.get_pull_requests(owner, repo, state="all", per_page=100)
            issues_task = self.get_issues(owner, repo, state="all", per_page=100)
            
            commits, prs, issues = await asyncio.gather(commits_task, prs_task, issues_task)
            
            # Filter by date
            recent_commits = [
                c for c in commits 
                if datetime.fromisoformat(c["commit"]["author"]["date"].replace("Z", "+00:00")) >= since
            ]
            recent_prs = [
                pr for pr in prs 
                if datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00")) >= since
            ]
            recent_issues = [
                issue for issue in issues 
                if datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00")) >= since
            ]
            
            # Calculate activity metrics
            activity = {
                "period_days": days,
                "commits": {
                    "total": len(recent_commits),
                    "unique_authors": len(set(c["commit"]["author"]["email"] for c in recent_commits))
                },
                "pull_requests": {
                    "total": len(recent_prs),
                    "open": len([pr for pr in recent_prs if pr["state"] == "open"]),
                    "merged": len([pr for pr in recent_prs if pr.get("merged_at")])
                },
                "issues": {
                    "total": len(recent_issues),
                    "open": len([issue for issue in recent_issues if issue["state"] == "open"]),
                    "closed": len([issue for issue in recent_issues if issue["state"] == "closed"])
                }
            }
            
            return activity
            
        except Exception as e:
            logger.error(f"Failed to analyze repository activity for {owner}/{repo}: {str(e)}")
            raise

# Global GitHub service instance
github_service = GitHubIntegrationService()
