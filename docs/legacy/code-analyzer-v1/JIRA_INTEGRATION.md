# Jira Integration for Code Analyzer

This module provides seamless integration between the Code Analyzer and Jira, allowing you to automatically create user stories based on code analysis results.

## Features

- ✅ **Automatic Story Generation** - Convert code analysis findings into actionable user stories
- ✅ **Security Issue Stories** - Create high-priority stories for security vulnerabilities
- ✅ **Performance Stories** - Generate stories for performance optimization opportunities
- ✅ **Technical Debt Stories** - Track code quality and maintainability issues
- ✅ **Batch Creation** - Create multiple stories at once from analysis results
- ✅ **Customizable Templates** - Flexible story templates with acceptance criteria
- ✅ **Project Management** - Support for multiple Jira projects and issue types

## Setup

### 1. Install Dependencies

The Jira integration requires the `jira` Python package:

```bash
pip install jira>=3.4.0
```

This is already included in the `requirements.txt` file.

### 2. Configure Jira Connection

Set up the following environment variables for Jira access:

#### Required Variables:
- `JIRA_SERVER_URL` - Your Jira instance URL (e.g., `https://yourcompany.atlassian.net`)
- `JIRA_USERNAME` - Your Jira username or email address
- `JIRA_API_TOKEN` - Your Jira API token (see below for how to generate)
- `JIRA_PROJECT_KEY` - Default project key for creating issues (e.g., `PROJ`)

#### Optional Variables:
- `JIRA_ASSIGNEE` - Default assignee username for created stories
- `JIRA_EPIC_LINK_FIELD` - Custom field ID for epic links (usually `customfield_10014`)
- `JIRA_STORY_POINTS_FIELD` - Custom field ID for story points (usually `customfield_10016`)

### 3. Generate Jira API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a descriptive label (e.g., "Code Analyzer Integration")
4. Copy the generated token immediately (you won't be able to see it again)

### 4. Docker Configuration

Add the Jira environment variables to your `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      # ... existing variables ...
      - JIRA_SERVER_URL=https://yourcompany.atlassian.net
      - JIRA_USERNAME=your.email@company.com
      - JIRA_API_TOKEN=your_api_token_here
      - JIRA_PROJECT_KEY=PROJ
      - JIRA_ASSIGNEE=your.username
```

## Usage

### 1. Via Streamlit Interface

The easiest way to use the Jira integration is through the Streamlit web interface:

1. Start the application: `docker-compose up`
2. Open the web interface: `http://localhost:8501`
3. Navigate to the "Jira Integration" page
4. View your Jira projects and create stories

### 2. Programmatic Usage

```python
from backend.config import load_config
from backend.jira_integration import JiraIntegrationService
from backend.story_generator import StoryGenerator

# Load configuration
config = load_config()

# Initialize services
jira_service = JiraIntegrationService(config)
story_generator = StoryGenerator(config)

# Create a manual story
story_data = {
    'summary': "Refactor authentication module",
    'description': "Improve security and maintainability of auth system",
    'priority': 'High',
    'story_points': 8,
    'labels': ['security', 'refactoring'],
    'acceptance_criteria': [
        "Remove hardcoded secrets",
        "Implement proper password hashing",
        "Add rate limiting"
    ]
}

result = jira_service.create_user_story(story_data)
print(f"Created story: {result['issue_key']}")

# Generate stories from analysis results
analysis_results = run_code_analysis()  # Your analysis function
stories = story_generator.generate_stories_from_analysis(analysis_results)

for story in stories:
    result = jira_service.create_user_story(story)
    print(f"Created: {result['issue_key']}")
```

### 3. Demo Script

Run the demo script to test your configuration:

```bash
python demo_jira.py
```

This will:
- Test your Jira connection
- Show available projects and issue types
- Demonstrate story creation (without actually creating issues)
- Generate sample stories from mock analysis data

## Story Types Generated

The integration automatically generates different types of user stories based on code analysis findings:

### 🔒 Security Stories
- SQL injection vulnerabilities
- Cross-site scripting (XSS) issues
- Hardcoded secrets and credentials
- Authentication and authorization flaws

### 🏗️ Architecture Stories
- Large files that need refactoring
- Circular dependencies
- Dead code removal
- Component coupling issues

### ⚡ Performance Stories
- Slow database queries
- Memory leaks
- Resource optimization opportunities
- Caching improvements

### 🔧 Maintainability Stories
- High complexity functions
- Code duplication
- Missing documentation
- Technical debt reduction

### 🧪 Testing Stories
- Low test coverage areas
- Missing integration tests
- Test automation improvements
- Quality assurance gaps

## Story Templates

Each generated story includes:

- **Clear Summary** - Descriptive title following user story format
- **Detailed Description** - Context, current issues, and benefits
- **Acceptance Criteria** - Specific, testable requirements
- **Appropriate Labels** - Categorization for filtering and tracking
- **Priority Assignment** - Based on severity and impact
- **Story Point Estimates** - Relative sizing for sprint planning
- **Technical Notes** - Implementation guidance
- **Code Context** - Relevant code snippets when applicable

## Customization

### Custom Field IDs

Different Jira instances may use different custom field IDs. You can configure these:

```bash
# Epic Link field (find your instance's field ID)
export JIRA_EPIC_LINK_FIELD=customfield_10014

# Story Points field (find your instance's field ID)
export JIRA_STORY_POINTS_FIELD=customfield_10016
```

To find your custom field IDs:
1. Go to Jira Administration → Issues → Custom fields
2. Click on the field you want to use
3. Look at the URL - the field ID will be in the format `customfield_XXXXX`

### Story Templates

You can customize story templates by modifying the `StoryGenerator` class in `backend/story_generator.py`:

```python
def _create_custom_story_template(self, issue_data):
    return {
        'summary': f"Custom story: {issue_data['title']}",
        'description': f"Custom description format...",
        'labels': ['custom', 'automated'],
        'priority': 'Medium',
        'story_points': 3
    }
```

## Troubleshooting

### Connection Issues

**Error: "Authentication failed"**
- Verify your username and API token are correct
- Ensure you're using an API token, not your password
- Check that your account has access to the Jira instance

**Error: "Project not found"**
- Verify the project key exists and you have access
- Check permissions for creating issues in the project

### Permission Issues

**Error: "Insufficient permissions"**
- Ensure your account can create issues in the target project
- Check if you have the "Create Issues" permission
- Verify you can access the specified custom fields

### Field Issues

**Error: "Field not found"**
- Custom field IDs vary between Jira instances
- Find the correct field IDs in your Jira administration panel
- Update the environment variables with the correct field IDs

### Network Issues

**Error: "Connection timeout"**
- Check your network connectivity to the Jira server
- Verify the server URL is correct and accessible
- Check if there are any firewall restrictions

## API Reference

### JiraIntegrationService

Main service class for Jira operations.

#### Methods:

- `connect()` - Establish connection to Jira
- `is_connected()` - Check connection status
- `get_projects()` - List accessible projects
- `get_issue_types(project_key)` - Get available issue types
- `create_user_story(story_data)` - Create a single user story
- `get_issue(issue_key)` - Retrieve issue details
- `search_issues(jql)` - Search issues using JQL

### StoryGenerator

Generates user stories from code analysis results.

#### Methods:

- `generate_stories_from_analysis(analysis_results)` - Main generation method
- `_generate_security_stories(results)` - Generate security-related stories
- `_generate_architecture_stories(results)` - Generate architecture stories
- `_generate_performance_stories(results)` - Generate performance stories

## Contributing

To extend the Jira integration:

1. Add new story generators in `StoryGenerator` class
2. Update the analysis pipeline to detect new issue types
3. Customize story templates for your organization's needs
4. Add new Jira field mappings as needed

## License

This Jira integration is part of the Code Analyzer project and follows the same license terms.
