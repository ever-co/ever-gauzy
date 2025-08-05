# Gauzy MCP Server - Desktop App

A modern Electron desktop application that provides an intuitive interface for managing and monitoring your Gauzy MCP (Model Context Protocol) server.

## Overview

This desktop application offers a user-friendly way to run, monitor, and manage your Gauzy MCP server. It features a modern UI with real-time status monitoring, log viewing, and easy server management - perfect for users who prefer a graphical interface over command-line tools.

## Features

-   **🖥️ Modern Desktop Interface**: Clean, intuitive UI built with Electron
-   **📊 Real-time Monitoring**: Live server status and performance metrics
-   **📝 Live Log Viewing**: Real-time log streaming with filtering and search
-   **🔄 Server Management**: Easy start, stop, and restart functionality
-   **⚙️ Configuration Management**: Built-in settings for API endpoints and credentials
-   **🔔 System Tray Integration**: Run in background with system tray access
-   **🔄 Auto-updater Support**: Automatic updates for the latest features
-   **🎨 Enhanced UI/UX**: Smooth animations and responsive design
-   **🌐 Cross-platform**: Works on Windows, macOS, and Linux

## Quick Start

### Prerequisites

-   Node.js (version 18 or higher)
-   Access to a running Gauzy API server
-   Valid Gauzy credentials

### Installation & Build

```bash
# Build the shared MCP server package (required dependency)
yarn nx build mcp-server

# Build the Electron desktop app
yarn nx build server-mcp --configuration=production

# Or build specifically for Electron
yarn nx build-electron server-mcp
```

### Running the Application

```bash
# Development mode
yarn nx serve server-mcp
```

## Application Interface

### Main Dashboard

The main interface provides:

-   **Server Status Panel**: Current server state, uptime, and connection status
-   **Control Panel**: Start/stop/restart buttons with status indicators
-   **Configuration Panel**: API settings, credentials, and server options
-   **Log Viewer**: Real-time log display with filtering capabilities

### System Tray

When minimized, the app runs in the system tray with options to:

-   Show/hide the main window
-   View server status
-   Quick start/stop server
-   Exit application

### Settings Panel

Configure your MCP server through the built-in settings:

-   **API Configuration**: Set your Gauzy API URL
-   **Authentication**: Manage login credentials securely
-   **Server Options**: Configure startup behavior and logging
-   **Auto-launch**: Set the app to start with your system

## Configuration

### Environment Variables

The desktop app uses the same environment configuration as the standalone server:

```bash
# Required
API_BASE_URL=http://localhost:3000        # Gauzy API URL
GAUZY_AUTH_EMAIL=<your-email>             # Gauzy login email
GAUZY_AUTH_PASSWORD=<your-password>       # Gauzy password

# Optional
GAUZY_AUTO_LOGIN=true                     # Enable automatic login
GAUZY_MCP_DEBUG=true                      # Enable debug logging
GAUZY_MCP_AUTO_START=true                 # Auto-start server on app launch
```


### Configuration File

Settings are automatically saved to:

-   **Windows**: `%APPDATA%/gauzy-mcp-server/config.json`
-   **macOS**: `~/Library/Application Support/gauzy-mcp-server/config.json`
-   **Linux**: `~/.config/gauzy-mcp-server/config.json`

## Integration with AI Assistants

The desktop app runs the same MCP server as the standalone version, making it compatible with:

### Claude Desktop

1. Start the desktop app and ensure the server is running
2. Note the server path shown in the app (typically: `dist/apps/mcp/index.js`)
3. Add to your Claude Desktop configuration:

```json
{
"mcpServers": {
        "gauzy": {
            "command": "node",
            "args": ["/path/shown/in/desktop/app"],
            "env": {
                "API_BASE_URL": "http://localhost:3000",
                "GAUZY_AUTH_EMAIL": "<your-email>",
                "GAUZY_AUTH_PASSWORD": "<your-password>"
            }
        }
    }
}
```

### Other AI Assistants

The underlying MCP server uses stdio transport, making it compatible with any AI assistant supporting the MCP standard.

## Available MCP Tools

The desktop app provides access to all Gauzy MCP tools through its managed server:

### 🔑 Authentication Flow

The server uses a streamlined authentication approach:

1. **Login**: Uses email/password to authenticate with Gauzy API
2. **User Context Capture**: Automatically gets tenant ID and organization ID from `/api/user/me`
3. **Parameter Injection**: All tools automatically use your organization/tenant context
4. **Token Management**: Handles refresh tokens and session management automatically

### 🛠️ Available Tools (91 tools across 8 categories)

-   **🧑‍💼 Employee Tools (15 tools)**: Complete employee management
-   **📋 Task Tools (16 tools)**: Comprehensive task operations
-   **🗂️ Project Tools (15 tools)**: Full project lifecycle management
-   **📅 Daily Plan Tools (17 tools)**: Daily planning and task scheduling
-   **🏢 Organization Contact Tools (17 tools)**: Contact management
-   **⏱️ Timer Tools (3 tools)**: Time tracking functionality
-   **🔧 Test Tools (3 tools)**: Connection and capability testing
-   **🔐 Authentication Tools (5 tools)**: Login, logout, and session management

## Development

### Project Structure

```text
apps/server-mcp/
├── src/
│   ├── electron-main.ts         # Electron main process
│   ├── static/
│   │   └── index.html          # Enhanced UI interface
│   └── preload/
│       └── preload.ts          # Preload scripts for security
├── project.json                # Nx configuration
├── webpack.config.js           # Webpack configuration
└── README.md                   # This file
```

### Local Development

```bash
# Development mode with hot reload
yarn nx serve server-mcp

# Build for testing
yarn nx build server-mcp

# Build Electron executable
yarn nx build-electron server-mcp

# Run tests
yarn nx test server-mcp
```

### Building Distributables

```bash
# Build for current platform
yarn nx build-electron server-mcp

# Build for all platforms (requires platform-specific setup)
yarn nx build-electron server-mcp --all-platforms
```

## Troubleshooting

### Common Issues

1. **App Won't Start**

    - Check Node.js version (18+ required)
    - Verify all dependencies are installed: `yarn install`
    - Try rebuilding: `yarn nx build server-mcp`

2. **MCP Server Connection Issues**

    - Verify API_BASE_URL in settings
    - Check authentication credentials
    - Review logs in the app's log viewer
    - Ensure the Gauzy API server is running

3. **System Tray Not Working**

    - Check if system tray is enabled on your OS
    - Try restarting the application
    - Verify app permissions

4. **Auto-updater Issues**
    - Check internet connection
    - Verify app permissions for downloads
    - Check firewall/antivirus settings

### Debug Mode

Enable debug mode through the app settings or environment variable:

```bash
GAUZY_MCP_DEBUG=true yarn nx serve server-mcp
```

Debug mode provides:

-   Detailed logging in the app's log viewer
-   Network request/response details
-   Server lifecycle events
-   Error stack traces

### Log Files

Application logs are saved to:

-   **Windows**: `%APPDATA%/gauzy-mcp-server/logs/`
-   **macOS**: `~/Library/Logs/gauzy-mcp-server/`
-   **Linux**: `~/.local/share/gauzy-mcp-server/logs/`

## Security & Privacy

-   **Credential Storage**: Login credentials are encrypted when stored locally
-   **Network Security**: Uses HTTPS for production API connections
-   **Process Isolation**: Electron security best practices implemented
-   **Update Security**: Signed updates and certificate verification
-   **Local Data**: All data remains local; no telemetry sent to external servers

## Performance

The desktop app is optimized for:

-   **Low Memory Usage**: Efficient resource management
-   **Fast Startup**: Quick application launch
-   **Responsive UI**: Smooth animations and interactions
-   **Background Operation**: Minimal CPU usage when minimized

## Support

For desktop app-specific issues:

1. Check the app's built-in log viewer
2. Review the troubleshooting section above
3. Verify the underlying MCP server package is working
4. Check system requirements and permissions
5. Try restarting the application
