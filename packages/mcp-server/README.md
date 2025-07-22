# Gauzy MCP Server

This document describes the architecture for the Gauzy MCP (Model Context Protocol) Server, which has been separated into two distinct applications with a shared package for common functionality.

## Architecture Overview

### 📦 Shared Package: `packages/mcp-server`

-   **Purpose**: Contains all shared MCP server functionality, tools, and utilities
-   **Location**: `packages/mcp-server/`
-   **Exports**: Core MCP server, tools, common utilities, and server manager

### 🚀 Standalone App: `apps/mcp`

-   **Purpose**: Standalone MCP server for AI assistants (Claude Desktop, ChatGPT, etc.)
-   **Location**: `apps/mcp/`
-   **Usage**: Direct integration with AI assistant desktop apps
-   **Dependencies**: Uses `@gauzy/mcp-server` shared package

### 🖥️ Desktop App: `apps/server-mcp`

-   **Purpose**: Electron desktop application with MCP server integration
-   **Location**: `apps/server-mcp/`
-   **Features**: Modern UI/UX, server management, status monitoring
-   **Dependencies**: Uses `@gauzy/mcp-server` shared package

## Quick Start

### 1. Build the Shared Package

```bash
# Build the shared MCP server package
yarn nx build mcp-server
```

### 2. Standalone MCP Server (for AI Assistants)

#### Build

```bash
# Build the standalone MCP server
yarn nx build mcp

# Or build for production
yarn nx build mcp --configuration=production
```

#### Run

```bash
# Start the standalone server
yarn nx serve mcp

# Test the server
yarn nx serve mcp --args="--test"
```

#### Integration with AI Assistants

1. Build the server: `yarn nx build mcp --configuration=production`
2. Configure your AI assistant (Claude Desktop, etc.) with the path: `dist/apps/mcp/index.js`
3. The server will communicate via stdio transport

### 3. Desktop App (Electron)

#### Build

```bash
# Build the Electron app
yarn nx build server-mcp

# Build for production
yarn nx build server-mcp --configuration=production
```

#### Run

```bash
# Start the Electron desktop app
yarn nx serve server-mcp

# Or use the electron-specific build
yarn nx build-electron server-mcp
yarn start:electron
```

## Features

### Shared Package (`@gauzy/mcp-server`)

-   ✅ Core MCP server implementation
-   ✅ Authentication tools
-   ✅ Timer tools
-   ✅ Project management tools
-   ✅ Task management tools
-   ✅ Employee management tools
-   ✅ Daily plan tools
-   ✅ Organization contact tools
-   ✅ Test connection tools
-   ✅ API client utilities
-   ✅ Security configuration
-   ✅ Server manager for lifecycle management

### Standalone App (`apps/mcp`)

-   ✅ Lightweight stdio-based server
-   ✅ Direct integration with AI assistants
-   ✅ Command-line interface
-   ✅ Test mode for validation
-   ✅ Graceful shutdown handling

### Desktop App (`apps/server-mcp`)

-   ✅ Modern Electron interface
-   ✅ Real-time server status monitoring
-   ✅ Server restart functionality
-   ✅ Live log viewing
-   ✅ System tray integration
-   ✅ Auto-updater support
-   ✅ Enhanced UI/UX with animations
-   ✅ Cross-platform compatibility

## Development

### Project Structure

```
ever-gauzy/
├── packages/mcp-server/             # Shared MCP server package
│   ├── src/lib/
│   │   ├── mcp-server.ts           # Core server implementation
│   │   ├── mcp-server-manager.ts   # Server lifecycle management
│   │   ├── tools/                  # All MCP tools
│   │   └── common/                 # Shared utilities
│   └── src/index.ts                # Package exports
├── apps/mcp/                       # Standalone MCP server
│   ├── src/index.ts                # Main entry point
│   └── project.json                # Nx configuration
└── apps/server-mcp/                # Electron desktop app
    ├── src/
    │   ├── electron-main.ts        # Electron main process
    │   ├── static/index.html       # Enhanced UI
    │   └── preload/                # Preload scripts
    └── project.json                # Nx configuration
```

### Adding New Tools

1. Add the tool implementation to `packages/mcp-server/src/lib/tools/`
2. Export it from `packages/mcp-server/src/lib/tools/index.ts`
3. Register it in `packages/mcp-server/src/lib/mcp-server.ts`
4. Both apps will automatically have access to the new tool

### Environment Configuration

Both apps use the same environment configuration pattern:

-   Development: `apps/[app-name]/src/environments/environment.ts`
-   Production: `apps/[app-name]/src/environments/environment.prod.ts`

Required environment variables:

```bash
API_BASE_URL=http://localhost:3000
GAUZY_AUTO_LOGIN=true
GAUZY_AUTH_EMAIL=your-email@example.com
GAUZY_AUTH_PASSWORD=your-password
```

## Benefits of the New Architecture

### 🎯 **Separation of Concerns**

-   Standalone server for AI assistant integration
-   Desktop app for user-friendly management
-   Shared package eliminates code duplication

### 🔧 **Maintainability**

-   Single source of truth for MCP server logic
-   Easier to add new tools and features
-   Consistent behavior across both apps

### 🚀 **Scalability**

-   Independent development of each app
-   Shared package can be published and reused
-   Clear dependency management

### 🎨 **User Experience**

-   Enhanced desktop interface with modern UI
-   Real-time status monitoring
-   Intuitive server management

## Troubleshooting

### Common Issues

1. **Module not found errors**

    - Ensure the shared package is built: `yarn nx build mcp-server`
    - Check that dependencies are properly installed

2. **Electron app not starting**

    - Verify webpack configuration
    - Check that all assets are properly copied
    - Ensure preload scripts are accessible

3. **MCP server connection issues**
    - Verify environment variables are set
    - Check API endpoint accessibility
    - Review authentication credentials

### Debug Mode

Enable debug mode by setting:

```bash
GAUZY_MCP_DEBUG=true
```

This will provide detailed logging for troubleshooting.

## Contributing

When contributing to the MCP server:

1. **For shared functionality**: Add to `packages/mcp-server/`
2. **For standalone app**: Modify `apps/mcp/`
3. **For desktop app**: Modify `apps/server-mcp/`
4. **For new tools**: Add to shared package and register in core server
