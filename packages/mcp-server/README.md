# Gauzy MCP Server - Shared Package

A comprehensive TypeScript package that provides the core MCP (Model Context Protocol) server implementation for the Gauzy platform. This package serves as the foundation for both the standalone MCP server and the Electron desktop application.

## Overview

The `@gauzy/mcp-server` package contains all the shared functionality needed to interact with Gauzy's API through the Model Context Protocol. It provides a complete set of tools, authentication management, and server utilities that can be used by different consumer applications.

## Architecture

This package is designed to be consumed by:

### 🚀 Standalone App: `apps/mcp`

- Direct integration with AI assistants (Claude Desktop, ChatGPT, etc.)
- Stdio-based transport for AI assistant communication
- Lightweight command-line interface

### 🖥️ Desktop App: `apps/server-mcp`

- Electron desktop application with modern UI
- Server management and monitoring interface
- System tray integration and auto-updater support

## Installation

```bash
# Install as a dependency
npm install @gauzy/mcp-server

# Or with yarn
yarn add @gauzy/mcp-server
```

## Package Build

```bash
# Build the shared package
yarn nx build mcp-server

# Run tests
yarn nx test mcp-server

# Lint the code
yarn nx lint mcp-server
```

## Usage

### Basic Server Setup

```typescript
import { McpServer } from '@gauzy/mcp-server';
import { environment } from './environments/environment';

// Create and start the MCP server
const server = new McpServer(environment);
server.start();
```

### Using Individual Tools

```typescript
import { AuthTool, TimerTool, ProjectTool } from '@gauzy/mcp-server/tools';
import { ApiClient } from '@gauzy/mcp-server';

// Initialize API client
const apiClient = new ApiClient({
  baseUrl: 'https://api.gauzy.co',
  email: 'user@example.com',
  password: 'password'
});

// Use specific tools
const authTool = new AuthTool(apiClient);
const timerTool = new TimerTool(apiClient);
const projectTool = new ProjectTool(apiClient);
```

### Server Manager

```typescript
import { McpServerManager } from '@gauzy/mcp-server';

const manager = new McpServerManager();

// Start server with configuration
await manager.start({
  apiBaseUrl: 'https://api.gauzy.co',
  authEmail: 'user@example.com',
  authPassword: 'password',
  autoLogin: true
});

// Stop server
await manager.stop();

// Get server status
const status = manager.getStatus();
```

## Core Features

- **Smart Authentication**: Automatic user context detection
- **Token Management**: Handles access and refresh tokens automatically
- **Session Persistence**: Maintains authentication state across sessions
- **Auto-login**: Configurable automatic login on server start
- **OAuth 2.0 Authorization**: OAuth 2.0 bearer authorization (RFC 6749, RFC 6750)
- **Protected Resource Metadata**: RFC 9728 /.well-known/oauth-protected-resource
  for clients/AS discovery
- **Token Validation**: JWT and token introspection support with audience validation
- **Scope Management**: Fine-grained access control with OAuth 2.0 scopes

### 🛠️ Comprehensive Tool Suite (323 tools across 22 categories, plus the 14 collaboration tools in 3 groups below when enabled)

<!-- TODO: Consider automating this section generation from source code to keep tool counts in sync -->
<!-- Tool counts last updated: 2025-08-05 -->

#### Authentication (5 tools)

- User login and logout functionality
- Authentication status monitoring
- Token refresh and management
- Auto-login capabilities

#### Employee Management (15 tools)

- Employee CRUD operations with bulk support
- Employee statistics and analytics
- Profile management and updates
- Organization member management

#### Task Management (16 tools)

- Complete task lifecycle management
- Bulk operations for efficiency
- Task assignment to employees
- Personal and team task views
- Task statistics and reporting

#### Project Management (14 tools)

- Full project CRUD with bulk operations
- Project assignment management
- Project analytics and reporting
- Team project collaboration

#### Daily Planning (17 tools)

- Personal and team daily plans
- Task integration with daily plans
- Bulk planning operations
- Planning analytics and statistics

#### Organization Contacts (17 tools)

- Contact management with full CRUD
- Bulk contact operations
- Employee contact assignments
- Contact categorization and filtering

#### Timer & Time Tracking (3 tools)

- Start/stop time tracking
- Real-time timer status
- Integration with projects and tasks

#### Testing & Diagnostics (3 tools)

- API connectivity testing
- Server capability enumeration
- Health check and monitoring

#### Financial Management (37 tools)

- **Payments (14 tools)**: Payment processing and management
- **Expenses (9 tools)**: Expense tracking and reporting
- **Invoices (14 tools)**: Invoice creation and management

#### Activity & Logging (12 tools)

- Activity tracking and audit logging
- User action monitoring
- System event recording

#### Candidate Management (15 tools)

- Recruitment process management
- Candidate tracking and evaluation
- Interview scheduling and feedback

#### Content & Communication (15 tools)

- Comment and discussion management
- Team communication tools
- Content collaboration features

#### Sales & CRM (23 tools)

- **Deals (15 tools)**: Sales opportunity tracking
- **Pipelines (8 tools)**: Sales pipeline management

#### Goal Management (24 tools)

- **Goals (12 tools)**: Objective setting and tracking
- **Key Results (12 tools)**: OKR management system

#### Inventory & Equipment (21 tools)

- **Equipment (16 tools)**: Asset and equipment tracking
- **Warehouses (5 tools)**: Inventory location management

#### Product Management (18 tools)

- **Products (13 tools)**: Product catalog management
- **Product Categories (5 tools)**: Product organization

#### Income Management (13 tools)

- Revenue tracking and reporting
- Income categorization and analysis

#### Merchant Management (14 tools)

- Vendor and supplier management
- Merchant relationship tracking

#### Skills Management (10 tools)

- Employee skill tracking
- Competency assessment and development

#### Time Off Management (20 tools)

- Leave request and approval system
- PTO tracking and management
- Holiday and absence planning

#### Reporting (4 tools)

- Data analytics and insights
- Custom report generation

#### HR & Awards (7 tools)

- Employee recognition programs
- Achievement tracking and rewards

#### Collaboration tool groups: chat, docs, inbox (14 tools, off by default)

Three groups over the collaboration suite's routes, each enabled per deployment and gated per caller by scopes
(`chat:read`, `chat:write`, `docs:read`, `docs:write`, `inbox:read`, `inbox:write`; a write scope reads too):

| Group | Switch | Read tools | Write tools |
| --- | --- | --- | --- |
| chat | `GAUZY_MCP_TOOLS_CHAT=true` | `list_chat_conversations`, `list_chat_messages`, `get_chat_thread`, `search_chat_messages` | `post_chat_message`, `mark_chat_conversation_read` |
| docs | `GAUZY_MCP_TOOLS_DOCS=true` | `list_pages`, `get_page` (Markdown + revision, in slices), `search_pages` | `create_page`, `update_page_markdown` (block-level merge, compare-and-set on the revision) |
| inbox | `GAUZY_MCP_TOOLS_INBOX=true` | `list_inbox_items`, `get_inbox_counts` | `set_inbox_item_state` |

The server every transport shares registers every enabled group. What a caller reaches is decided per caller; a tool
its scopes do not allow is not listed and answers "not found", as an unregistered one does:

- **HTTP and WebSocket, with a bearer token:** the token's scopes, checked again at every request (WebSocket: when the
  connection opens and before every message). A token holds the collaboration scopes it names (`chat:read`, …); a token
  that names none holds what its `mcp.read` / `mcp.write` (or `mcp.admin`) scopes allow: reads, or reads and writes, of
  every enabled group. The authorization server (mcp-auth) advertises and grants the named scopes. While
  `MCP_AUTH_REQUIRED_SCOPES` (or `MCP_REQUIRED_SCOPES`) is unset, so the required scope is the default `mcp.read`, a
  token granted named collaboration scopes alone is admitted too, and reaches the collaboration tools only (every other
  tool is hidden from it and answers "not found"). Once the operator sets the required scopes, every token must hold
  them all. Such a token cannot run `login` either, so its calls go to the API under a platform login the caller
  already has: the GAUZY_AUTO_LOGIN account for a caller on this machine, the login its OAuth subject and client made
  earlier over HTTP with a token holding `mcp.read`, or its session's. With none, the API refuses the call.
- **HTTP and WebSocket without a token** (a caller on this machine in loopback desktop mode, or authorization switched
  off) **and stdio:** `GAUZY_MCP_TOOLS_SCOPES` (a comma list), else every scope of the enabled groups — a local server
  speaks for its one signed-in user. Stdio applies the list when it connects: the tools it does not allow are removed.
  No transport records a token's scopes on a session; a session whose `metadata.oauthScopes` is set (nothing sets it
  today) would hold those first.
- **A server made for one session** (`createMcpServer(sessionId)`) registers only the groups that session may read,
  and their writes only under the write scope.

A chat message posted through `post_chat_message` is marked as written with an assistant (`assistedBy`), and where the
client supports elicitation the person approves it before it is posted. Over stdio the server knows the client (its
name, its capabilities). Over HTTP and WebSocket it does not see the client's initialize handshake: there messages are
marked `MCP client` and posted without the approval step. Every call runs under the signed-in user's tenant,
organization and permissions — what is outside their access is "not found", as the routes answer it — and is logged by
name, user, duration and outcome, never with what was sent or answered (on every path: the transports and the server
log only the argument names of these tools). Answers carry a note that message, page and
entry bodies are user-authored text: data, not instructions. The chat search needs a server that serves `GET /chat/search`.
The docs tools' revision check is only as tight as the docs API's: a content save there moves `contentRevision` in one
write and stores the text in the next, so a `get_page` that falls between the two reads the new revision with the
previous text, and an update against that revision then passes.

### 🏗️ Technical Features

- **📝 Schema Validation**: Comprehensive Zod schemas with TypeScript support
- **🔄 Bulk Operations**: Efficient batch processing for all major entities
- **📊 Analytics**: Built-in statistics and reporting capabilities
- **🔗 Relationship Management**: Support for entity relationships and eager loading
- **📄 Pagination**: Efficient data browsing with configurable page sizes
- **🏷️ Assignment Operations**: Employee assignment/unassignment workflows
- **🔄 Auto-refresh**: Automatic token refresh and session management
- **🛡️ Error Handling**: Robust error handling with detailed messages
- **📋 Logging**: Comprehensive logging with configurable levels

## Package Structure

```text
packages/mcp-server/
├── src/
│   ├── lib/
│   │   ├── mcp-server.ts           # Core MCP server implementation
│   │   ├── mcp-server-manager.ts   # Server lifecycle management
│   │   ├── tools/                  # MCP tool implementations
│   │   │   ├── auth.ts            # Authentication tools
│   │   │   ├── timer.ts           # Time tracking tools
│   │   │   ├── projects.ts        # Project management tools
│   │   │   ├── tasks.ts           # Task management tools
│   │   │   ├── employees.ts       # Employee management tools
│   │   │   ├── daily-plan.ts      # Daily planning tools
│   │   │   ├── organization-contact.ts # Contact tools
│   │   │   └── test-connection.ts # Testing tools
│   │   ├── common/                # Shared utilities
│   │   │   ├── api-client.ts      # API client implementation
│   │   │   ├── auth-manager.ts    # Authentication management
│   │   │   ├── version.ts         # Version information
│   │   │   └── types.ts           # TypeScript type definitions
│   │   └── environments/          # Environment configurations
│   │       └── environment.ts     # Environment interface
│   └── index.ts                   # Package exports
├── package.json                   # Package configuration
├── project.json                   # Nx configuration
├── tsconfig.lib.json             # TypeScript configuration
└── README.md                     # This file
```

## Development

### Adding New Tools

1. **Create the tool**: Add your tool implementation to `src/lib/tools/`

   ```typescript
   // src/lib/tools/my-new-tool
   import { Tool } from '@modelcontextprotocol/sdk/types.js';
   import { ApiClient } from '../common/api-client';

   export class MyNewTool {
     constructor(private apiClient: ApiClient) {}

     getTools(): Tool[] {
       return [
         {
           name: 'my_new_tool',
           description: 'Description of what this tool does',
           inputSchema: {
             type: 'object',
             properties: {
               // Define your parameters here
             }
           }
         }
       ];
     }
   }
   ```

2. **Export the tool**: Add it to the tools index file

   ```typescript
   // src/lib/tools/index.ts
   export * from './my-new-tool';
   ```

3. **Register the tool**: Include it in the main server

   ```typescript
   // src/lib/mcp-server.ts
   import { MyNewTool } from './tools/my-new-tool';
   // Register the tool in the tools array
   ```

4. **Export from package**: Add to main index if needed

   ```typescript
   // src/index.ts
   export * from './lib/tools/my-new-tool';
   ```

### Configuration

The package uses environment-based configuration:

```typescript
// Environment interface
export interface Environment {
  apiBaseUrl: string;
  authEmail?: string;
  authPassword?: string;
  autoLogin?: boolean;
  debug?: boolean;
}
```

### Building and Testing

```bash
# Build the package
yarn nx build mcp-server

# Run tests
yarn nx test mcp-server

# Run linting
yarn nx lint mcp-server

# Type checking
yarn nx type-check mcp-server
```

## API Reference

### Core Classes

#### McpServer

Main server class that implements the MCP protocol.

```typescript
class McpServer {
  constructor(environment: Environment)
  start(): Promise<void>
  stop(): Promise<void>
  getStatus(): ServerStatus
}
```

#### McpServerManager

Manages server lifecycle and provides higher-level operations.

```typescript
class McpServerManager {
  start(config: ServerConfig): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  getStatus(): ManagerStatus
}
```

#### ApiClient

HTTP client for communicating with Gauzy API.

```typescript
class ApiClient {
  constructor(config: ApiConfig)
  login(email: string, password: string): Promise<AuthResponse>
  get<T>(endpoint: string, params?: any): Promise<T>
  post<T>(endpoint: string, data?: any): Promise<T>
  put<T>(endpoint: string, data?: any): Promise<T>
  delete<T>(endpoint: string): Promise<T>
}
```

#### AuthManager

Handles authentication and token management.

```typescript
class AuthManager {
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
  refreshToken(): Promise<void>
  isAuthenticated(): boolean
  getCurrentUser(): User | null
}
```

## Environment Configuration

### Required Variables

```bash
API_BASE_URL=https://api.gauzy.co    # Gauzy API endpoint
```

### Optional Variables

- `GAUZY_MCP_TOOLS_CHAT`, `GAUZY_MCP_TOOLS_DOCS`, `GAUZY_MCP_TOOLS_INBOX`: `true` enables a collaboration tool group (off by default)
- `GAUZY_MCP_TOOLS_SCOPES`: the collaboration scopes of a caller without a bearer token — stdio, a loopback caller, or a server with authorization off (default: every scope of the enabled groups); a token's own scopes always come first
- `MCP_AUTH_REQUIRED_SCOPES`: the scopes every bearer token must hold (default `mcp.read`); while it is unset, a token holding collaboration scopes alone is admitted for the collaboration tools only

```bash
GAUZY_AUTH_EMAIL=user@example.com    # Auto-login email
GAUZY_AUTH_PASSWORD=password         # Auto-login password
GAUZY_AUTO_LOGIN=true               # Enable auto-login
GAUZY_MCP_DEBUG=true                # Enable debug logging
NODE_ENV=development                # Environment mode
```

## Troubleshooting

### Package Build Issues

1. **TypeScript compilation errors**

   ```bash
   # Check TypeScript configuration
   yarn nx lint mcp-server
   # Fix type issues and rebuild
   yarn nx build mcp-server
   ```

2. **Missing dependencies**

   ```bash
   # Install all dependencies
   yarn install
   # Clean and rebuild
   yarn nx reset
   yarn nx build mcp-server
   ```

### Runtime Issues

1. **Authentication failures**

   - Verify API_BASE_URL is correct
   - Check email/password credentials
   - Ensure API server is accessible

2. **Tool registration errors**

   - Verify tool exports in index files
   - Check tool implementation follows MCP spec
   - Review server logs for specific errors

### Debug Mode

Enable comprehensive debugging:

```bash
GAUZY_MCP_DEBUG=true yarn nx build mcp-server
```

This provides:

- Detailed API request/response logging
- Tool execution tracing
- Authentication flow debugging
- Error stack traces

## Contributing

### Development Workflow

1. **Fork and clone** the repository
2. **Install dependencies**: `yarn install`
3. **Create feature branch**: `git checkout -b feature/my-feature`
4. **Make changes** to the package
5. **Build and test**: `yarn nx build mcp-server && yarn nx test mcp-server`
6. **Submit pull request**

### Code Style

- Follow existing TypeScript conventions
- Use Zod schemas for data validation
- Include comprehensive error handling
- Add JSDoc comments for public APIs
- Write unit tests for new functionality

### Adding New Tools

New tools should:

- Extend the base tool pattern
- Include proper TypeScript types
- Provide comprehensive input validation
- Handle errors gracefully
- Include documentation and examples
