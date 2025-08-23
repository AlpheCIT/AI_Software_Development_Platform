"""
Jira Duplicate Detection and Management Service
Handles detection, display, and cleanup of duplicate Jira issues.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import difflib
from collections import defaultdict

logger = logging.getLogger(__name__)

class JiraDuplicateDetector:
    """Service for detecting and managing duplicate Jira issues"""
    
    def __init__(self, jira_service):
        self.jira_service = jira_service
        self.similarity_threshold = 0.8  # 80% similarity for duplicate detection
    
    def calculate_title_similarity(self, title1: str, title2: str) -> float:
        """Calculate similarity between two titles using SequenceMatcher"""
        if not title1 or not title2:
            return 0.0
        
        # Normalize titles for comparison
        t1 = title1.lower().strip()
        t2 = title2.lower().strip()
        
        if t1 == t2:
            return 1.0
        
        # Use difflib to calculate similarity
        matcher = difflib.SequenceMatcher(None, t1, t2)
        return matcher.ratio()
    
    def calculate_description_similarity(self, desc1: str, desc2: str) -> float:
        """Calculate similarity between two descriptions"""
        if not desc1 or not desc2:
            return 0.0
        
        # Normalize descriptions
        d1 = desc1.lower().strip()
        d2 = desc2.lower().strip()
        
        if d1 == d2:
            return 1.0
        
        # Use first 500 characters for comparison to avoid very long descriptions
        d1_short = d1[:500]
        d2_short = d2[:500]
        
        matcher = difflib.SequenceMatcher(None, d1_short, d2_short)
        return matcher.ratio()
    
    def detect_duplicates_in_stories(self, stories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect duplicate stories based on title and description similarity"""
        duplicates = []
        processed_pairs = set()
        
        for i, story1 in enumerate(stories):
            for j, story2 in enumerate(stories[i + 1:], i + 1):
                pair_key = tuple(sorted([story1.get('id', ''), story2.get('id', '')]))
                if pair_key in processed_pairs:
                    continue
                processed_pairs.add(pair_key)
                
                # Calculate similarities
                title_sim = self.calculate_title_similarity(
                    story1.get('title', ''), 
                    story2.get('title', '')
                )
                desc_sim = self.calculate_description_similarity(
                    story1.get('description', ''), 
                    story2.get('description', '')
                )
                
                # Combined similarity score (weighted)
                combined_sim = (title_sim * 0.7) + (desc_sim * 0.3)
                
                if combined_sim >= self.similarity_threshold:
                    duplicate_info = {
                        'id': f"dup_{i}_{j}",
                        'story1': story1,
                        'story2': story2,
                        'title_similarity': round(title_sim * 100, 1),
                        'description_similarity': round(desc_sim * 100, 1),
                        'overall_similarity': round(combined_sim * 100, 1),
                        'detected_at': datetime.now().isoformat(),
                        'resolution_status': 'pending'
                    }
                    duplicates.append(duplicate_info)
        
        return duplicates
    
    async def detect_jira_duplicates(self, project_key: str) -> List[Dict[str, Any]]:
        """Detect duplicate issues directly in Jira"""
        try:
            # Search for all issues in the project
            jql = f"project = {project_key} ORDER BY created DESC"
            search_result = await self.jira_service.search_issues(jql, max_results=1000)
            
            issues = search_result.get('issues', [])
            duplicates = []
            processed_pairs = set()
            
            for i, issue1 in enumerate(issues):
                for j, issue2 in enumerate(issues[i + 1:], i + 1):
                    pair_key = tuple(sorted([issue1.get('key', ''), issue2.get('key', '')]))
                    if pair_key in processed_pairs:
                        continue
                    processed_pairs.add(pair_key)
                    
                    # Extract issue details
                    title1 = issue1.get('fields', {}).get('summary', '')
                    title2 = issue2.get('fields', {}).get('summary', '')
                    desc1 = self._extract_description(issue1.get('fields', {}).get('description', ''))
                    desc2 = self._extract_description(issue2.get('fields', {}).get('description', ''))
                    
                    # Calculate similarities
                    title_sim = self.calculate_title_similarity(title1, title2)
                    desc_sim = self.calculate_description_similarity(desc1, desc2)
                    combined_sim = (title_sim * 0.7) + (desc_sim * 0.3)
                    
                    if combined_sim >= self.similarity_threshold:
                        duplicate_info = {
                            'id': f"jira_dup_{i}_{j}",
                            'issue1': {
                                'key': issue1.get('key'),
                                'title': title1,
                                'description': desc1,
                                'status': issue1.get('fields', {}).get('status', {}).get('name', ''),
                                'created': issue1.get('fields', {}).get('created', ''),
                                'assignee': self._extract_assignee(issue1.get('fields', {}).get('assignee')),
                                'url': f"{self.jira_service.server_url}/browse/{issue1.get('key')}"
                            },
                            'issue2': {
                                'key': issue2.get('key'),
                                'title': title2,
                                'description': desc2,
                                'status': issue2.get('fields', {}).get('status', {}).get('name', ''),
                                'created': issue2.get('fields', {}).get('created', ''),
                                'assignee': self._extract_assignee(issue2.get('fields', {}).get('assignee')),
                                'url': f"{self.jira_service.server_url}/browse/{issue2.get('key')}"
                            },
                            'title_similarity': round(title_sim * 100, 1),
                            'description_similarity': round(desc_sim * 100, 1),
                            'overall_similarity': round(combined_sim * 100, 1),
                            'detected_at': datetime.now().isoformat(),
                            'resolution_status': 'pending',
                            'recommendation': self._get_merge_recommendation(issue1, issue2)
                        }
                        duplicates.append(duplicate_info)
            
            # Sort by similarity score (highest first)
            duplicates.sort(key=lambda x: x['overall_similarity'], reverse=True)
            
            return duplicates
            
        except Exception as e:
            logger.error(f"Error detecting Jira duplicates: {str(e)}")
            return []
    
    def _extract_description(self, description_obj) -> str:
        """Extract plain text from Jira description object"""
        if isinstance(description_obj, str):
            return description_obj
        
        if isinstance(description_obj, dict):
            # Handle ADF (Atlassian Document Format)
            if 'content' in description_obj:
                return self._extract_text_from_adf(description_obj)
        
        return str(description_obj) if description_obj else ''
    
    def _extract_text_from_adf(self, adf_obj) -> str:
        """Extract plain text from Atlassian Document Format"""
        if not isinstance(adf_obj, dict):
            return str(adf_obj)
        
        text_parts = []
        
        if 'content' in adf_obj:
            for item in adf_obj['content']:
                if isinstance(item, dict):
                    if item.get('type') == 'text':
                        text_parts.append(item.get('text', ''))
                    elif 'content' in item:
                        text_parts.append(self._extract_text_from_adf(item))
        
        return ' '.join(text_parts).strip()
    
    def _extract_assignee(self, assignee_obj) -> str:
        """Extract assignee name from Jira assignee object"""
        if not assignee_obj:
            return 'Unassigned'
        
        if isinstance(assignee_obj, dict):
            return assignee_obj.get('displayName', assignee_obj.get('name', 'Unknown'))
        
        return str(assignee_obj)
    
    def _get_merge_recommendation(self, issue1: Dict, issue2: Dict) -> Dict[str, Any]:
        """Generate recommendation for merging duplicate issues"""
        created1 = issue1.get('fields', {}).get('created', '')
        created2 = issue2.get('fields', {}).get('created', '')
        
        # Recommend keeping the older issue
        if created1 and created2:
            if created1 < created2:
                primary = issue1
                secondary = issue2
            else:
                primary = issue2
                secondary = issue1
        else:
            # If no creation dates, default to first issue
            primary = issue1
            secondary = issue2
        
        return {
            'action': 'merge',
            'keep': primary.get('key'),
            'remove': secondary.get('key'),
            'reason': 'Keep older issue and merge information',
            'steps': [
                f"1. Review and merge comments from {secondary.get('key')} to {primary.get('key')}",
                f"2. Update {primary.get('key')} with any missing information",
                f"3. Add comment in {primary.get('key')} referencing the duplicate",
                f"4. Close {secondary.get('key')} as duplicate"
            ]
        }
    
    async def mark_as_duplicate(self, primary_key: str, duplicate_key: str, comment: str = None) -> bool:
        """Mark an issue as duplicate of another"""
        try:
            # Add comment to primary issue
            primary_comment = comment or f"Merged duplicate issue {duplicate_key}"
            await self.jira_service.add_comment(primary_key, primary_comment)
            
            # Add comment to duplicate and close it
            duplicate_comment = f"Marked as duplicate of {primary_key}. {comment or ''}"
            await self.jira_service.add_comment(duplicate_key, duplicate_comment)
            
            # Try to close the duplicate issue
            # Note: This might require specific workflow transitions
            transitions = await self.jira_service.get_transitions(duplicate_key)
            close_transition = None
            
            for transition in transitions:
                transition_name = transition.get('name', '').lower()
                if any(keyword in transition_name for keyword in ['close', 'done', 'resolve']):
                    close_transition = transition
                    break
            
            if close_transition:
                await self.jira_service.transition_issue(
                    duplicate_key, 
                    close_transition['id'],
                    f"Closed as duplicate of {primary_key}"
                )
            
            logger.info(f"Successfully marked {duplicate_key} as duplicate of {primary_key}")
            return True
            
        except Exception as e:
            logger.error(f"Error marking {duplicate_key} as duplicate: {str(e)}")
            return False
    
    def generate_duplicate_report(self, duplicates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate a comprehensive duplicate report"""
        if not duplicates:
            return {
                'total_duplicates': 0,
                'highest_similarity': 0,
                'average_similarity': 0,
                'summary': 'No duplicates detected',
                'duplicates': []
            }
        
        similarities = [dup['overall_similarity'] for dup in duplicates]
        
        return {
            'total_duplicates': len(duplicates),
            'highest_similarity': max(similarities),
            'average_similarity': round(sum(similarities) / len(similarities), 1),
            'by_similarity_range': {
                '90-100%': len([s for s in similarities if s >= 90]),
                '80-89%': len([s for s in similarities if 80 <= s < 90]),
                '70-79%': len([s for s in similarities if 70 <= s < 80])
            },
            'summary': f"Found {len(duplicates)} potential duplicates with average {round(sum(similarities) / len(similarities), 1)}% similarity",
            'duplicates': duplicates
        }
