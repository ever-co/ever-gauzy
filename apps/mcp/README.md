# Gauzy MCP Server - Standalone App

A comprehensive MCP (Model Context Protocol) server for integration with AI assistants like Claude Desktop, ChatGPT, and other AI tools. Supports multiple transport layers for different use cases.

## Overview

The Gauzy MCP server provides multiple transport options to interact with your Gauzy platform:

- **Stdio Transport** - For direct integration with AI assistants like Claude Desktop
- **HTTP Transport** - REST API with JSON-RPC 2.0 over HTTP for web applications and testing
- **WebSocket Transport** - Real-time bidirectional communication for live applications

All transports offer access to project management, time tracking, employee management, and other Gauzy features.

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

The server supports three transport modes configured via environment variables:

#### 1. Stdio Transport (Default)

Best for Claude Desktop and AI assistant integration:

```bash
# Start with stdio transport (default)
yarn nx serve mcp

# Or explicitly set stdio mode
MCP_TRANSPORT=stdio yarn nx serve mcp

# Test the server connection
yarn nx serve mcp --args="--test"
```

#### 2. HTTP Transport

REST API with JSON-RPC 2.0 for web applications:

```bash
# Start HTTP transport server
MCP_TRANSPORT=http
MCP_SERVER_MODE=http
yarn nx serve mcp

# Server runs on http://localhost:3001 by default
# MCP endpoint: POST http://localhost:3001/mcp
```

#### 3. WebSocket Transport

Real-time bidirectional communication:

```bash
# Start WebSocket transport server
MCP_TRANSPORT=websocket
MCP_SERVER_MODE=websocket
yarn nx serve mcp

# Server runs on ws://localhost:3002/ws by default (use wss:// when MCP_WS_TLS=true)
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

## Transport Configuration

### Stdio Transport (Default)

Best for AI assistant integration. Configure via environment variables or `.env.local`:

```bash
# Basic configuration
MCP_TRANSPORT=stdio
API_BASE_URL=http://localhost:3000
GAUZY_AUTH_EMAIL=<your-email>
GAUZY_AUTH_PASSWORD=<your-password>

# Optional
GAUZY_AUTO_LOGIN=true                     # Enable automatic login
GAUZY_MCP_DEBUG=true                      # Enable debug logging
```

### HTTP Transport Configuration

Configure HTTP transport in `.env.local`:

```bash
# Transport settings
MCP_TRANSPORT=http
MCP_SERVER_MODE=http

# Server configuration
MCP_HTTP_PORT=3001
MCP_HTTP_HOST=localhost

# Security settings
MCP_CORS_ORIGIN=http://localhost:3000,http://localhost:4200
MCP_CORS_CREDENTIALS=true

# Session management
MCP_SESSION_ENABLED=true
MCP_SESSION_COOKIE_NAME=mcp-session-id
MCP_SESSION_TTL=1800000                   # 30 minutes

# Rate limiting and security
THROTTLE_ENABLED=true
THROTTLE_TTL=60000                        # 1 minute
THROTTLE_LIMIT=100                        # requests per minute
MCP_TRUSTED_PROXIES=192.168.1.1,10.0.0.1

# Required Gauzy API settings
API_BASE_URL=https://apidemo.gauzy.co
GAUZY_AUTH_EMAIL=<your-email>
GAUZY_AUTH_PASSWORD=<your-password>
GAUZY_AUTO_LOGIN=true
```

#### Testing HTTP Transport

Use Postman, curl, or any HTTP client:

```bash
# List available tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# Call a tool (e.g., login)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "login",
      "arguments": {
          "email": "<your-email>",
          "password": "<your-password>"
      }
    }
  }'
```

### WebSocket Transport Configuration

Configure WebSocket transport in `.env.local`:

```bash
# Transport settings
MCP_TRANSPORT=websocket
MCP_SERVER_MODE=websocket

# Server configuration
MCP_WS_PORT=3002
MCP_WS_HOST=localhost
MCP_WS_PATH=/ws

# TLS/SSL settings (recommended for production)
MCP_WS_TLS=true
MCP_WS_KEY_PATH=/path/to/your/certs/key.pem
MCP_WS_CERT_PATH=/path/to/your/certs/cert.pem

# WebSocket features
MCP_WS_COMPRESSION=true
MCP_WS_PER_MESSAGE_DEFLATE=true
MCP_WS_MAX_PAYLOAD=16777216               # 16MB

# Security settings
MCP_WS_ALLOWED_ORIGINS=*                  # Use specific origins in production
MCP_WS_SESSION_ENABLED=true
MCP_WS_SESSION_COOKIE_NAME=mcp-ws-session-id
MCP_WS_TRUSTED_PROXIES=192.168.1.1,10.0.0.1

# Required Gauzy API settings
API_BASE_URL=https://apidemo.gauzy.co
GAUZY_AUTH_EMAIL=<your-email>
GAUZY_AUTH_PASSWORD=<your-password>
GAUZY_AUTO_LOGIN=true
```

#### Testing WebSocket Transport

Using wscat (install with `npm install -g wscat`):

```bash
# Connect to WebSocket (with TLS)
wscat -c wss://localhost:3002/ws --no-check

# Or without TLS (set MCP_WS_TLS=false)
wscat -c ws://localhost:3002/ws

# Send MCP protocol messages:
# Initialize connection
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}

# List tools
{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}

# Call a tool
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "login", "arguments": {"email": "<your-email>", "password": "<your-password>"}}}
```

#### Browser WebSocket Testing

```javascript
// Default (TLS disabled): ws://. Use wss:// when MCP_WS_TLS=true
const ws = new WebSocket('ws://localhost:3002/ws');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Received:', JSON.parse(event.data));

// Initialize
ws.send(JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {},
           clientInfo: { name: "browser-client", version: "1.0.0" }}
}));

// List tools
ws.send(JSON.stringify({
  jsonrpc: "2.0", id: 2, method: "tools/list", params: {}
}));
```

### SSL Certificate Generation (WebSocket TLS)

For WebSocket TLS, generate self-signed certificates for development:

```bash
# Create certificates directory
mkdir -p packages/mcp-server/certs

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout packages/mcp-server/certs/key.pem -out packages/mcp-server/certs/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Set correct permissions
chmod 600 packages/mcp-server/certs/key.pem
chmod 644 packages/mcp-server/certs/cert.pem
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

#### General Issues

1. **Connection Failed**
   - Verify `API_BASE_URL` points to your running Gauzy API
   - Check that your credentials are correct
   - Ensure the API server is accessible

2. **Authentication Errors**
   - Verify `GAUZY_AUTH_EMAIL` and `GAUZY_AUTH_PASSWORD`
   - Check if your account has the necessary permissions
   - Try logging in through the web interface first

#### Stdio Transport Issues

3. **AI Assistant Not Connecting**
   - Verify the path to `dist/apps/mcp/index.js` is correct
   - Check that Node.js is in your system PATH
   - Review your AI assistant's MCP configuration

#### HTTP Transport Issues

4. **HTTP Server Won't Start**
   - Check if port 3001 is already in use: `lsof -ti:3001`
   - Kill existing process: `kill -9 $(lsof -ti:3001)`
   - Try a different port: `MCP_HTTP_PORT=3002`

5. **CORS Errors**
   - Update `MCP_CORS_ORIGIN` to include your client domain
   - For development: `MCP_CORS_ORIGIN=*`
   - For production: Use specific origins only

6. **Tool Execution Errors**
   - Ensure server restarted after configuration changes
   - Check JSON-RPC format matches examples
   - Verify content-type is `application/json`

#### WebSocket Transport Issues

7. **WebSocket Connection Rejected**
   - **"Unauthorized origin"**: Set `MCP_WS_ALLOWED_ORIGINS=*` for development
   - **SSL Certificate errors**: Use `--no-check` flag with wscat
   - **Port already in use**: Kill process: `kill -9 $(lsof -ti:3002)`

8. **SSL/TLS Issues**
   - For development: Set `MCP_WS_TLS=false` to disable SSL
   - Verify certificate paths are absolute: `/full/path/to/cert.pem`
   - Regenerate certificates if expired or corrupted

9. **WebSocket Disconnects Immediately**
   - Check server logs for specific error messages
   - Verify WebSocket path includes `/ws`: `wss://localhost:3002/ws`
   - Ensure server is fully started before connecting

### Debug Mode

Enable debug logging for any transport:

```bash
# Stdio transport
GAUZY_MCP_DEBUG=true yarn nx serve mcp

# HTTP transport
GAUZY_MCP_DEBUG=true MCP_TRANSPORT=http yarn nx serve mcp

# WebSocket transport
GAUZY_MCP_DEBUG=true MCP_TRANSPORT=websocket yarn nx serve mcp
```

This provides detailed information about:

- Transport layer connections and messages
- API requests and responses to Gauzy
- Authentication status and session management
- Tool execution details and results
- Error messages and stack traces
- WebSocket connection lifecycle (for WebSocket transport)
- HTTP request/response details (for HTTP transport)

### Transport Comparison

| Feature | Stdio | HTTP | WebSocket |
|---------|-------|------|-----------|
| **Use Case** | AI Assistants | Web Apps, APIs | Real-time Apps |
| **Protocol** | Standard I/O | JSON-RPC over HTTP | JSON-RPC over WebSocket |
| **Connection** | Process-based | Request/Response | Persistent Connection |
| **Real-time** | No | No | Yes |
| **Session Support** | N/A | Yes (Cookies) | Yes (Connection-based) |
| **CORS** | N/A | Yes | Yes |
| **Security** | Process isolation | HTTPS + Sessions | WSS + Origin validation |
| **Rate Limiting** | N/A | Yes | Yes |
| **Best For** | Claude Desktop | REST clients, Postman | Live dashboards, browsers |
| **Port** | N/A | 3001 (default) | 3002 (default) |

### Quick Setup Commands

```bash
# Stdio (Claude Desktop)
yarn nx build mcp --configuration=production
# Add to ~/.claude_desktop_config.json

# HTTP (Testing/Development)
echo "MCP_TRANSPORT=http" >> .env.local
yarn nx serve mcp

# WebSocket (Real-time Apps)
echo "MCP_TRANSPORT=websocket" >> .env.local
yarn nx serve mcp
```

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
