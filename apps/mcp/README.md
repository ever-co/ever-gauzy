# Gauzy MCP Server - Standalone App

A lightweight standalone MCP (Model Context Protocol) server for direct integration with AI assistants like Claude Desktop, ChatGPT, and other AI tools.

## Overview

This standalone MCP server provides a stdio-based interface that AI assistants can use to interact with your Gauzy platform. It offers direct access to project management, time tracking, employee management, and other Gauzy features through a simple command-line interface.

## Quick Start

### Prerequisites

- Node.js (version 18 or higher)
- Access to a running Gauzy API server
- Valid Gauzy credentials

### Installation & Build

```bash
# Build the shared MCP server package (required dependency)
yarn nx build mcp-server

# Build the standalone MCP server
yarn nx build mcp --configuration=production
```

### Running the Server

```bash
# Start the server for development
yarn nx serve mcp

# Test the server connection
yarn nx serve mcp --args="--test"
```

### Integration with AI Assistants

#### Claude Desktop

1. Build the server for production:
   ```bash
   yarn nx build mcp --configuration=production
   ```

2. Add to your Claude Desktop configuration (`~/.claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "gauzy": {
         "command": "node",
         "args": ["/path/to/your/project/dist/apps/mcp/index.js"],
         "env": {
           "API_BASE_URL": "http://localhost:3000",
           "GAUZY_AUTH_EMAIL": "your-email@example.com",
           "GAUZY_AUTH_PASSWORD": "your-password"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop

#### Other AI Assistants

The server communicates via stdio transport, making it compatible with any AI assistant that supports the MCP standard. Refer to your AI assistant's documentation for specific integration steps.

## Environment Configuration

Set these environment variables either in your system or in the Claude Desktop configuration:

```bash
# Required
API_BASE_URL=http://localhost:3000        # Gauzy API URL
GAUZY_AUTH_EMAIL=<your-email>             # Gauzy login email
GAUZY_AUTH_PASSWORD=<your-password>       # Gauzy password

# Optional
GAUZY_AUTO_LOGIN=true                     # Enable automatic login
GAUZY_MCP_DEBUG=true                      # Enable debug logging
```

## Available Tools

The standalone server provides access to all Gauzy MCP tools:

### Authentication

- **test_connection**: Test API connectivity and authentication

### Time Management

- **start_timer**: Start time tracking for projects/tasks
- **stop_timer**: Stop active time tracking
- **get_active_timer**: Get current timer status

### Project Management

- **get_projects**: List all projects
- **create_project**: Create new projects
- **update_project**: Update project details

### Task Management

- **get_tasks**: List tasks with filtering
- **create_task**: Create new tasks
- **update_task**: Update task details

### Employee Management

- **get_employees**: Access employee information
- **create_employee**: Add new employees

### Daily Planning

- **get_daily_plan**: Get daily plans for employees
- **create_daily_plan**: Create daily plans

### Organization Contacts

- **get_organization_contacts**: Manage organization contacts

## Command Line Options

```bash
# Test mode - validates connection and exits
node dist/apps/mcp/index.js --test

# Debug mode - enables verbose logging
GAUZY_MCP_DEBUG=true node dist/apps/mcp/index.js

# Custom configuration
API_BASE_URL=https://api.gauzy.co node dist/apps/mcp/index.js
```

## Development

### Project Structure

```text
apps/mcp/
├── src/
│   └── index.ts              # Main entry point
├── project.json              # Nx configuration
└── README.md                 # This file
```

### Local Development

```bash
# Watch mode for development
yarn nx serve mcp

# Build for testing
yarn nx build mcp

# Run tests
yarn nx test mcp
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify `API_BASE_URL` points to your running Gauzy API
   - Check that your credentials are correct
   - Ensure the API server is accessible

2. **Authentication Errors**
   - Verify `GAUZY_AUTH_EMAIL` and `GAUZY_AUTH_PASSWORD`
   - Check if your account has the necessary permissions
   - Try logging in through the web interface first

3. **AI Assistant Not Connecting**
   - Verify the path to `dist/apps/mcp/index.js` is correct
   - Check that Node.js is in your system PATH
   - Review your AI assistant's MCP configuration

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
GAUZY_MCP_DEBUG=true yarn nx serve mcp
```

This will provide detailed information about:
- API requests and responses
- Authentication status
- Tool execution details
- Error messages and stack traces

## Security Notes

- Store credentials securely (consider using environment files that are not committed to version control)
- Use HTTPS for production API URLs
- Regularly rotate passwords and API keys
- Monitor access logs for suspicious activity

## Support

For issues specific to the standalone MCP server:
1. Check the troubleshooting section above
2. Review the shared MCP server package documentation
3. Verify your Gauzy API server is running and accessible
4. Check Claude Desktop or your AI assistant's logs for additional error details
