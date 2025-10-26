# Gauzy MCP Server

A comprehensive MCP (Model Context Protocol) server for integration with
AI assistants like Claude Desktop, ChatGPT, and other AI tools. Supports
multiple transport layers with enterprise-grade OAuth 2.0 security for
different use cases.

🌐 **Live Demo**: [https://mcpdemo.gauzy.co](https://mcpdemo.gauzy.co)
🔒 **Production**: [https://mcp.gauzy.co](https://mcp.gauzy.co)

## Overview

The Gauzy MCP server provides multiple transport options to interact with
your Gauzy platform:

- **Stdio Transport** - For direct integration with AI assistants like
  Claude Desktop
- **HTTP Transport** - REST API with JSON-RPC 2.0 over HTTP for web
  applications and testing
- **WebSocket Transport** - Real-time bidirectional communication for
  live applications

HTTP and WebSocket transports offer access to project management, time
tracking, employee management, and other Gauzy features with optional
OAuth 2.0 authorization. User sessions are stored in Redis for scalable
session management across multiple server instances.

## Quick Start

### Prerequisites

- Node.js (version 18 or higher)
- Redis server (for session storage in HTTP/WebSocket modes)
- Access to a running Gauzy API server
- Valid Gauzy credentials

### Installation & Build

```bash
# Build the shared MCP server package (required dependency)
yarn build:mcp-server

# Build the standalone MCP server
yarn build:mcp
```

### Running the Server

The server supports three transport modes configured via environment
variables:

#### 1. Stdio Transport (Default)

Best for Claude Desktop and AI assistant integration:

```bash
# Start with stdio transport (default)
yarn start:mcp

# Or explicitly set stdio mode
MCP_TRANSPORT=stdio yarn start:mcp
```

#### 2. HTTP Transport

REST API with JSON-RPC 2.0 for web applications:

```bash
# Start HTTP transport server
MCP_TRANSPORT=http \
MCP_SERVER_MODE=http \
yarn start:mcp

# Server runs on http://localhost:3001 by default
# MCP endpoint: POST http://localhost:3001/sse
# NOTE: /sse is the HTTP JSON-RPC endpoint (not SSE)
```

#### 3. WebSocket Transport

Real-time bidirectional communication:

```bash
# Start WebSocket transport server
MCP_TRANSPORT=websocket \
MCP_SERVER_MODE=websocket \
yarn start:mcp

# Server runs on ws://localhost:3002/sse by default
# Use wss:// when MCP_WS_TLS=true
# NOTE: "/sse" is the WebSocket upgrade route (not HTTP SSE)
```

### Integration with AI Assistants

#### Claude Desktop

1. Build the server for production:
   ```bash
   yarn nx build mcp --configuration=production
   # or
   yarn build:mcp:prod
   ```

2. Add to your Claude Desktop configuration
   (`~/.claude_desktop_config.json`):

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

The server communicates via stdio transport, making it compatible with
any AI assistant that supports the MCP standard. Refer to your AI
assistant's documentation for specific integration steps.

## Transport Configuration

### Stdio Transport (Default)

Best for AI assistant integration. Configure via environment variables
or `.env.local`:

```bash
# Basic configuration
MCP_TRANSPORT=stdio
API_BASE_URL=http://localhost:3000
GAUZY_AUTH_EMAIL=<your-email>
GAUZY_AUTH_PASSWORD=<your-password>

# Optional
GAUZY_AUTO_LOGIN=true # Enable automatic login
GAUZY_MCP_DEBUG=true # Enable debug logging
```

### HTTP Transport Configuration

Configure HTTP transport in environment file `.env.local` or `.env`:

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

# OAuth 2.0 Authorization (Optional)
MCP_AUTH_ENABLED=false # Enable OAuth 2.0 authorization
MCP_AUTH_RESOURCE_URI=https://mcp.gauzy.co
MCP_AUTH_REQUIRED_SCOPES=mcp.read,mcp.write
# JSON-encoded array of authorization servers
MCP_AUTH_SERVERS='[]' # see the file .env.sample on how to configure it
MCP_AUTH_JWT_AUDIENCE=https://mcp.gauzy.co
MCP_AUTH_JWT_ISSUER=https://auth.gauzy.co
MCP_AUTH_JWT_ALGORITHMS=RS256,ES256 # Supported JWT algorithms
# JWT validation options (choose one):
MCP_AUTH_JWT_JWKS_URI=https://auth.gauzy.co/.well-known/jwks.json
# MCP_AUTH_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...

# Token Introspection (Alternative to JWT validation)
MCP_AUTH_INTROSPECTION_ENDPOINT=https://auth.gauzy.co/token/introspect
MCP_AUTH_INTROSPECTION_CLIENT_ID=mcp-client
MCP_AUTH_INTROSPECTION_CLIENT_SECRET=client-secret

# OAuth caching and performance
MCP_AUTH_TOKEN_CACHE_TTL=300 # Token validation cache TTL (seconds)
MCP_AUTH_METADATA_CACHE_TTL=3600 # Metadata cache TTL (seconds)

# OAuth server options
MCP_AUTH_ALLOW_EMBEDDED_SERVER=true # Allow embedded auth server
MCP_AUTH_SESSION_SECRET=your-session-secret-key # Session secret

# Session management (stored in Redis)
MCP_SESSION_ENABLED=true
MCP_SESSION_COOKIE_NAME=mcp-session-id
MCP_SESSION_TTL=1800000 # 30 minutes (milliseconds)
REDIS_URL=redis://localhost:6379 # Redis connection for sessions

# Rate limiting and security
THROTTLE_ENABLED=true
THROTTLE_TTL=60000 # 1 minute (milliseconds)
THROTTLE_LIMIT=100 # requests per minute
MCP_TRUSTED_PROXIES=192.168.1.1,10.0.0.1

# Required Gauzy API settings
API_BASE_URL=https://apidemo.gauzy.co
GAUZY_AUTH_EMAIL=<your-email>
GAUZY_AUTH_PASSWORD=<your-password>
GAUZY_AUTO_LOGIN=true
```

#### Testing HTTP Transport

##### Without OAuth 2.0 Authorization

Use Postman, curl, or any HTTP client:

```bash
# List available tools
curl -X POST http://localhost:3001/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
# NOTE: /sse is the HTTP JSON-RPC endpoint (not SSE)

# Call a tool (e.g., login)
curl -X POST http://localhost:3001/sse \
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
# NOTE: /sse is the HTTP JSON-RPC endpoint (not SSE)
```

##### With OAuth 2.0 Authorization

When `MCP_AUTH_ENABLED=true`, you need to include a Bearer token:

```bash
# Get OAuth 2.0 Protected Resource Metadata (RFC 9728)
curl -X GET http://localhost:3001/.well-known/oauth-protected-resource \
  -H "Accept: application/json"

# Make authorized request with Bearer token
curl -X POST http://localhost:3001/sse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
# NOTE: /sse is the HTTP JSON-RPC endpoint (not SSE)

# Without valid token, you'll get 401 Unauthorized with
# WWW-Authenticate header:
# WWW-Authenticate: Bearer resource_metadata="http://localhost:3001/
#   .well-known/oauth-protected-resource", error="invalid_token"
```

### WebSocket Transport Configuration

Configure WebSocket transport in environment file `.env.local` or `.env`:

```bash
# Transport settings
MCP_TRANSPORT=websocket
MCP_SERVER_MODE=websocket

# Server configuration
MCP_WS_PORT=3002
MCP_WS_HOST=localhost
MCP_WS_PATH=/sse

# TLS/SSL settings (recommended for production)
MCP_WS_TLS=true
MCP_WS_KEY_PATH=/path/to/your/certs/key.pem
MCP_WS_CERT_PATH=/path/to/your/certs/cert.pem

# WebSocket features
MCP_WS_COMPRESSION=true
MCP_WS_PER_MESSAGE_DEFLATE=true
MCP_WS_MAX_PAYLOAD=16777216 # 16MB

# OAuth 2.0 Authorization (Optional)
MCP_AUTH_ENABLED=false # Enable OAuth 2.0 authorization
MCP_AUTH_RESOURCE_URI=https://mcp.gauzy.co
MCP_AUTH_REQUIRED_SCOPES=mcp.read,mcp.write
# JSON-encoded array of authorization servers
MCP_AUTH_SERVERS='[]' # see the file .env.sample on how to configure it
MCP_AUTH_JWT_AUDIENCE=https://mcp.gauzy.co
MCP_AUTH_JWT_ISSUER=https://auth.gauzy.co
MCP_AUTH_JWT_ALGORITHMS=RS256,ES256 # Supported JWT algorithms
MCP_AUTH_JWT_JWKS_URI=https://auth.gauzy.co/.well-known/jwks.json
# OAuth caching and performance
MCP_AUTH_TOKEN_CACHE_TTL=300 # Token validation cache TTL (seconds)
MCP_AUTH_METADATA_CACHE_TTL=3600 # Metadata cache TTL (seconds)

# Security settings
MCP_WS_ALLOWED_ORIGINS=* # Use specific origins in production
MCP_WS_SESSION_ENABLED=true
MCP_WS_SESSION_COOKIE_NAME=mcp-ws-session-id
MCP_WS_TRUSTED_PROXIES=192.168.1.1,10.0.0.1
REDIS_URL=redis://localhost:6379 # Redis connection for sessions

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
wscat -c wss://localhost:3002/sse --no-check

# Or without TLS (set MCP_WS_TLS=false)
wscat -c ws://localhost:3002/sse

# Send MCP protocol messages:
# Initialize connection
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "test-client",
      "version": "1.0.0"
    }
  }
}

# List tools
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}

# Call a tool
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "login",
    "arguments": {
      "email": "<your-email>",
      "password": "<your-password>"
    }
  }
}
```

#### Browser WebSocket Testing

```javascript
// Default (TLS disabled): ws://. Use wss:// when MCP_WS_TLS=true
const ws = new WebSocket('ws://localhost:3002/sse');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Received:', JSON.parse(event.data));

// Initialize
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "browser-client",
      version: "1.0.0"
    }
  }
}));

// List tools
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {}
}));
```

### SSL Certificate Generation (WebSocket TLS)

For WebSocket TLS, generate self-signed certificates for development:

```bash
# Create certificates directory
mkdir -p packages/mcp-server/certs

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout packages/mcp-server/certs/key.pem \
  -out packages/mcp-server/certs/cert.pem \
  -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

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
   - Ensure Redis is running: `redis-server` or check `redis-cli ping`

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
   - **"Unauthorized origin"**: Set `MCP_WS_ALLOWED_ORIGINS=*` for
     development
   - **SSL Certificate errors**: Use `--no-check` flag with wscat
   - **Port already in use**: Kill process: `kill -9 $(lsof -ti:3002)`
   - **Session errors**: Ensure Redis is running: `redis-server` or
     check `redis-cli ping`

8. **SSL/TLS Issues**
   - For development: Set `MCP_WS_TLS=false` to disable SSL
   - Verify certificate paths are absolute: `/full/path/to/cert.pem`
   - Regenerate certificates if expired or corrupted

9. **WebSocket Disconnects Immediately**
   - Check server logs for specific error messages
   - Verify WebSocket path includes `/sse`: `wss://localhost:3002/sse`
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
- Authentication status and Redis session management
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
| **Session Support** | N/A | Yes (Redis) | Yes (Redis) |
| **CORS** | N/A | Yes | Yes |
| **OAuth 2.0** | Not supported | Yes (Bearer tokens) | Yes (Bearer tokens) |
| **Security** | Process isolation | HTTPS + Sessions | WSS + OAuth |
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

## OAuth 2.0 Authorization

The Gauzy MCP server supports enterprise-grade OAuth 2.0 authorization
following:

- RFC 6749 (OAuth 2.0 Authorization Framework)
- RFC 9728 (OAuth 2.0 Protected Resource Metadata)
- RFC 8707 (Resource Indicators)

This enables secure access control for MCP clients like ChatGPT and
other AI assistants.

### MCP Authorization Server (`apps/mcp-auth`)

The project includes a dedicated OAuth 2.0 authorization server in
`apps/mcp-auth` that provides authentication and token management for
the MCP server. This separation of concerns allows independent scaling
and security management.

#### Setting Up the MCP Auth Server

1. **Build the Auth Server**:

   ```bash
   # Development build
   yarn build:mcp-auth

   # Production build
   yarn build:mcp-auth:prod
   ```

2. **Configure Environment Variables** (`.env.local` or `.env`):

   ```bash
   # Auth Server Configuration
   MCP_AUTH_PORT=3003
   MCP_AUTH_SESSION_SECRET=your-secure-session-secret-key

   # Required Gauzy API settings
   API_BASE_URL=http://localhost:3000
   GAUZY_AUTH_EMAIL=<your-email>
   GAUZY_AUTH_PASSWORD=<your-password>
   ```

3. **Start the Auth Server**:

   ```bash
   yarn start:mcp-auth
   ```

   The server will start on `http://localhost:3003` with the following
   endpoints:

   - **Authorization**: `POST /oauth2/authorize`
   - **Token**: `POST /oauth2/token`
   - **User Info**: `GET /oauth2/userinfo`
   - **JWKS**: `GET /.well-known/jwks.json`
   - **Client Registration**: `POST /oauth2/register`
   - **Token Introspection**: `POST /oauth2/introspect`
   - **Metadata**: `GET /.well-known/oauth-authorization-server`

4. **Configure MCP Server to Use Auth Server**:

   In your MCP server configuration (`.env.local`):

   ```bash
   # Enable OAuth 2.0 authorization
   MCP_AUTH_ENABLED=true

   # Resource and scope configuration
   MCP_AUTH_RESOURCE_URI=http://localhost:3001/sse
   MCP_AUTH_REQUIRED_SCOPES=mcp.read,mcp.write

   # JWT validation settings
   MCP_AUTH_JWT_ALGORITHMS=RS256
   MCP_AUTH_JWT_AUDIENCE=http://localhost:3001/sse
   MCP_AUTH_JWT_ISSUER=http://localhost:3003
   MCP_AUTH_JWT_JWKS_URI=http://localhost:3003/.well-known/jwks.json

   # Cache settings
   MCP_AUTH_TOKEN_CACHE_TTL=300 # 5 minutes
   MCP_AUTH_METADATA_CACHE_TTL=3600 # 1 hour

   # Authorization server metadata
   MCP_AUTH_SERVERS='[
     {
       "issuer": "http://localhost:3003",
       "authorizationEndpoint": "http://localhost:3003/oauth2/authorize",
       "tokenEndpoint": "http://localhost:3003/oauth2/token",
       "grantTypesSupported": [
         "authorization_code",
         "client_credentials",
         "refresh_token"
       ],
       "responseTypesSupported": [
         "code"
       ],
       "scopesSupported": [
         "mcp.read",
         "mcp.write",
         "mcp.admin"
       ],
       "codeChallengeMethodsSupported": [
         "S256"
       ]
     }
   ]'
   ```

5. **Test the Integration**:

   ```bash
   # Get authorization server metadata
   curl http://localhost:3003/.well-known/oauth-authorization-server

   # Get JWKS (public keys for token verification)
   curl http://localhost:3003/.well-known/jwks.json

   # Test MCP server with authorization
   curl -X POST http://localhost:3001/sse \
     -H "Authorization: Bearer <your-access-token>" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```

#### Running Both Servers Together

For a complete OAuth 2.0 setup, run both servers:

```bash
# Terminal 1: Start Auth Server
yarn start:mcp-auth

# Terminal 2: Start MCP Server with HTTP transport
MCP_TRANSPORT=http MCP_AUTH_ENABLED=true yarn start:mcp
```

### Live Environments

- **Production**: `https://mcp.gauzy.co` - Secure production MCP server
  with full OAuth 2.0 authorization
- **Demo**: `https://mcpdemo.gauzy.co` - Public demo environment for
  testing and evaluation
- **Authorization Server**: `https://auth.gauzy.co` - Production
  OAuth 2.0 authorization server
- **Demo Auth**: `https://authdemo.gauzy.co` - Demo authorization
  server for testing

### Authorization Features

- **Bearer Token Authentication** - Standard RFC 6750 Bearer token
  support
- **JWT Token Validation** - Local JWT validation with public key or
  JWKS endpoint
- **Token Introspection** - RFC 7662 token introspection for opaque
  tokens
- **Protected Resource Metadata** - RFC 9728 metadata endpoint for
  clients
- **Scope-based Access Control** - Fine-grained permissions using
  OAuth 2.0 scopes
- **Audience Validation** - RFC 8707 resource indicators for token
  audience claims

### Configuration

#### Demo Environment Configuration

For testing with the live demo environment:

```bash
# .env.local - Demo/Development with JWT validation
MCP_AUTH_ENABLED=true
MCP_AUTH_RESOURCE_URI=https://mcpdemo.gauzy.co
MCP_AUTH_REQUIRED_SCOPES=mcp.read,mcp.write
# JSON-encoded array of authorization servers
MCP_AUTH_SERVERS='[]' # see the file .env.sample on how to configure it
MCP_AUTH_JWT_AUDIENCE=https://mcpdemo.gauzy.co
MCP_AUTH_JWT_ISSUER=https://authdemo.gauzy.co
MCP_AUTH_JWT_ALGORITHMS=RS256,ES256
MCP_AUTH_JWT_JWKS_URI=https://authdemo.gauzy.co/.well-known/jwks.json
MCP_AUTH_TOKEN_CACHE_TTL=300 # 5 minutes cache
MCP_AUTH_METADATA_CACHE_TTL=3600 # 1 hour cache
```

#### Production Environment Configuration

For production deployment at `https://mcp.gauzy.co`:

```bash
# .env - Production with JWKS and introspection
MCP_AUTH_ENABLED=true
MCP_AUTH_RESOURCE_URI=https://mcp.gauzy.co
MCP_AUTH_REQUIRED_SCOPES=mcp.read,mcp.write,mcp.admin
# JSON-encoded array of authorization servers
MCP_AUTH_SERVERS='[]' # see the file .env.sample on how to configure it
MCP_AUTH_JWT_AUDIENCE=https://mcp.gauzy.co
MCP_AUTH_JWT_ISSUER=https://auth.gauzy.co
MCP_AUTH_JWT_ALGORITHMS=RS256,ES256,PS256
MCP_AUTH_JWT_JWKS_URI=https://auth.gauzy.co/.well-known/jwks.json
MCP_AUTH_INTROSPECTION_ENDPOINT=https://auth.gauzy.co/token/introspect
MCP_AUTH_INTROSPECTION_CLIENT_ID=gauzy-mcp-server
MCP_AUTH_INTROSPECTION_CLIENT_SECRET=secure-client-secret
MCP_AUTH_TOKEN_CACHE_TTL=600 # 10 minutes cache
MCP_AUTH_METADATA_CACHE_TTL=7200 # 2 hours cache
MCP_AUTH_ALLOW_EMBEDDED_SERVER=false # Disable for production
MCP_AUTH_SESSION_SECRET=production-session-secret-key
```

### Testing Authorization

#### Using Postman

1. **Get Protected Resource Metadata**:

   ```bash
   # Demo Environment
   curl -X GET https://mcpdemo.gauzy.co/.well-known/oauth-protected-resource \
     -H "Accept: application/json"

   # Production Environment
   curl -X GET https://mcp.gauzy.co/.well-known/oauth-protected-resource \
     -H "Accept: application/json"

   # Local Development
   curl -X GET http://localhost:3001/.well-known/oauth-protected-resource \
     -H "Accept: application/json"
   ```

2. **Make Authorized Request**:

   ```bash
   # Demo Environment
   curl -X POST https://mcpdemo.gauzy.co/sse \
     -H "Authorization: Bearer <your-jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/list",
       "params": {}
     }'

   # Production Environment
   curl -X POST https://mcp.gauzy.co/sse \
     -H "Authorization: Bearer <your-jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/list",
       "params": {}
     }'
   ```

#### Error Responses

- **401 Unauthorized** - Missing or invalid token:

  ```http
  HTTP/1.1 401 Unauthorized
  WWW-Authenticate: Bearer resource_metadata="https://mcp.gauzy.co/
    .well-known/oauth-protected-resource", error="invalid_token",
    error_description="Token validation failed"
  ```

- **403 Forbidden** - Insufficient scopes:

  ```json
  {
    "error": "insufficient_scope",
    "error_description": "Request requires higher privileges than provided",
    "scope": "mcp.read mcp.write"
  }
  ```

### Authorization Server Setup

The Gauzy MCP server is pre-configured to work with the Gauzy OAuth 2.0
authorization infrastructure:

- **Production**: `https://auth.gauzy.co` - Enterprise-grade OAuth 2.0
  server
- **Demo**: `https://authdemo.gauzy.co` - Public demo authorization
  server

#### Compatible Authorization Servers

The MCP server works with any OAuth 2.0 compliant authorization server:

- **Keycloak** - Open source identity and access management
- **Auth0** - Cloud-based identity platform
- **OAuth2 Server** - Custom implementation
- **AWS Cognito** - AWS managed identity service
- **Gauzy Auth** - Built-in Gauzy platform authorization (recommended)

### Security Best Practices

- **Use HTTPS in production** - Protect tokens in transit
- **Implement proper token expiration** - Short-lived access tokens
  (5-15 minutes)
- **Use refresh tokens** - For long-term access without storing
  credentials
- **Validate audience claims** - Prevent token misuse across services
- **Monitor token usage** - Track access patterns and detect anomalies
- **Secure private keys** - Use HSM or secure key storage in production
- **Regular key rotation** - Rotate signing keys periodically

### Disabled Authorization

When `MCP_AUTH_ENABLED=false` (default), the server operates without
authentication, suitable for:

- Local development and testing
- Trusted network environments
- Internal tools with existing authentication layers

## Security Notes

- Store credentials securely (consider using environment files that are
  not committed to version control)
- Use HTTPS for production API URLs
- Regularly rotate passwords and API keys
- Monitor access logs for suspicious activity
- When using OAuth 2.0, follow the security best practices outlined in
  the Authorization section above

## Support

For issues specific to the standalone MCP server:

1. Check the troubleshooting section above
2. Review the shared MCP server package documentation
3. Verify your Gauzy API server is running and accessible
4. Check Claude Desktop or your AI assistant's logs for additional
   error details
