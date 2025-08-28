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

### 🔐 Authentication Management

- **Smart Authentication**: Automatic user context detection
- **Token Management**: Handles access and refresh tokens automatically
- **Session Persistence**: Maintains authentication state across sessions
- **Auto-login**: Configurable automatic login on server start

### 🛠️ Comprehensive Tool Suite (323 tools across 22 categories)

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
   // src/lib/tools/my-new-tool.ts
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
   export * from './my-new-tool.js';
   ```

3. **Register the tool**: Include it in the main server

   ```typescript
   // src/lib/mcp-server.ts
   import { MyNewTool } from './tools/my-new-tool.js';
   // Register in the tools array
   ```

4. **Export from package**: Add to main index if needed

   ```typescript
   // src/index.ts
   export * from './lib/tools/my-new-tool.js';
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
