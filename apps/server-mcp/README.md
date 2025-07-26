# Gauzy MCP Server

A Model Context Protocol (MCP) server for Gauzy that provides LLMs like Claude with direct access to your Gauzy instance data and operations. This server implements comprehensive CRUD operations, bulk functionality, statistics endpoints, and robust authentication management.

## Quick Start

### 1. Environment Setup

Create a `.env` file in `apps/server-mcp/`:

```bash
# Required: Gauzy API Configuration
API_BASE_URL=https://apidemo.gauzy.co

# Required: Authentication (for auto-login)
GAUZY_AUTO_LOGIN=true
GAUZY_AUTH_EMAIL=your-email@example.com
GAUZY_AUTH_PASSWORD=your-password

# Optional: Debug and Development
GAUZY_MCP_DEBUG=true
NODE_ENV=development
```

**Note**: Tenant ID and Organization ID are no longer needed in environment variables! They are automatically captured from your authenticated user account.

### 2. Installation & Build

```bash
# Install dependencies
yarn install

# Build the server
npm run build

# Run in development mode
npm run dev
```

### 3. Usage with Claude Desktop

Once authenticated, you can use natural language prompts without specifying tenant or organization IDs:

```text
// ✅ Simple and natural - context is automatic
"Get my timer status"
"Show me all tasks in progress"
"Create a new project called 'Website Redesign'"
"Get employee statistics for John Doe"

// ❌ No longer needed - these are injected automatically
"Get timer status with organizationId abc123 and tenantId def456"
```

## 🔑 Authentication Flow

The server uses a streamlined authentication approach:

1. **Login**: Uses email/password to authenticate with Gauzy API
2. **User Context Capture**: Automatically gets tenant ID and organization ID from `/api/user/me`
3. **Parameter Injection**: All tools automatically use your organization/tenant context
4. **Token Management**: Handles refresh tokens and session management automatically

### Authentication Tools

-   `login` - Login with email and password
-   `logout` - Clear authentication and tokens
-   `get_auth_status` - Check current authentication status
-   `refresh_auth_token` - Manually refresh access token
-   `auto_login` - Attempt automatic login (if configured)

## 🛠️ Available Tools

The server provides **91 tools** across **8 categories**, all automatically scoped to your authenticated user context:

### 🧑‍💼 Employee Tools (15 tools)

-   **Listing**: `get_employees`, `get_employee_count`, `get_employees_pagination`
-   **Individual**: `get_employee`, `get_current_employee`, `get_employee_statistics`
-   **Management**: `create_employee`, `update_employee`, `update_employee_profile`
-   **Advanced**: `bulk_create_employees`, `soft_delete_employee`, `restore_employee`

### 📋 Task Tools (16 tools)

-   **Listing**: `get_tasks`, `get_task_count`, `get_tasks_pagination`, `get_my_tasks`, `get_team_tasks`
-   **Individual**: `get_task`, `create_task`, `update_task`, `delete_task`
-   **Bulk Operations**: `bulk_create_tasks`, `bulk_update_tasks`, `bulk_delete_tasks`
-   **Analytics**: `get_task_statistics`
-   **Assignment**: `assign_task_to_employee`, `unassign_task_from_employee`

### 🗂️ Project Tools (15 tools)

-   **Listing**: `get_projects`, `get_project_count`, `get_projects_pagination`, `get_my_projects`
-   **Individual**: `get_project`, `create_project`, `update_project`, `delete_project`
-   **Bulk Operations**: `bulk_create_projects`, `bulk_update_projects`, `bulk_delete_projects`
-   **Analytics**: `get_project_statistics`
-   **Assignment**: `assign_project_to_employee`, `unassign_project_from_employee`

### 📅 Daily Plan Tools (17 tools)

-   **Listing**: `get_daily_plans`, `get_my_daily_plans`, `get_team_daily_plans`
-   **Individual**: `get_daily_plan`, `create_daily_plan`, `update_daily_plan`, `delete_daily_plan`
-   **Task Management**: `add_task_to_daily_plan`, `remove_task_from_daily_plan`
-   **Bulk Operations**: `bulk_create_daily_plans`, `bulk_update_daily_plans`, `bulk_delete_daily_plans`
-   **Analytics**: `get_daily_plan_statistics`, `get_daily_plan_count`

### 🏢 Organization Contact Tools (17 tools)

-   **Listing**: `get_organization_contacts`, `get_organization_contact_count`
-   **Individual**: `get_organization_contact`, `create_organization_contact`
-   **Management**: `update_organization_contact`, `delete_organization_contact`
-   **Bulk Operations**: `bulk_create_organization_contacts`, `bulk_update_organization_contacts`
-   **Assignment**: `assign_contact_to_employee`, `unassign_contact_from_employee`

### ⏱️ Timer Tools (3 tools)

-   `timer_status` - Get current timer status
-   `start_timer` - Start time tracking
-   `stop_timer` - Stop time tracking

### 🔧 Test Tools (3 tools)

-   `test_api_connection` - Test API connectivity
-   `get_server_info` - Get server information
-   `test_mcp_capabilities` - List all available tools

## ✨ Key Features

-   **🔐 Smart Authentication**: Automatic user context detection
-   **📝 Schema Validation**: Comprehensive Zod schemas with enums
-   **🔄 Bulk Operations**: Efficient batch processing for all entities
-   **📊 Statistics & Analytics**: Built-in reporting tools
-   **🔗 Relationship Loading**: Support for entity relations
-   **📄 Pagination**: Efficient data browsing with page/limit
-   **🏷️ Assignment Operations**: Employee assignment/unassignment
-   **🔄 Auto-refresh**: Automatic token management

## 🎯 User Experience

**Before Refactoring**:

```text
User: "Get timer status with organizationId: abc-123 and tenantId: def-456"
```

**After Refactoring**:

```text
User: "Get my timer status"
System: ✅ Automatically uses your organization and tenant context
```

The server automatically:

-   Detects your organization and tenant from authenticated user data
-   Injects these parameters into all relevant API calls
-   Provides clear error messages if authentication is required
-   Maintains proper context throughout your session

## 🚀 Benefits

1. **Simplified Usage**: No more parameter guessing or UUID lookup
2. **Context Awareness**: All tools work within your authenticated context
3. **Error Prevention**: Clear messages when authentication is needed
4. **Session Management**: Automatic token refresh and management
5. **Natural Language**: Use conversational prompts in Claude Desktop
