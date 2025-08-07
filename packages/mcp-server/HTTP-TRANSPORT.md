# MCP HTTP Transport Implementation

This document describes the HTTP transport implementation for the Gauzy MCP Server, enabling it to be hosted publicly and accessible via web clients.

## Overview

The MCP Server now supports both **stdio** and **HTTP** transports:

- **stdio transport**: Traditional MCP communication via standard input/output (for tools like Claude Desktop)
- **HTTP transport**: RESTful HTTP API with optional Server-Sent Events for real-time communication

## Configuration

### Environment Variables

Configure the transport using environment variables:

```bash
# Transport selection
MCP_TRANSPORT=http|stdio|auto  # Default: stdio

# HTTP transport configuration
MCP_HTTP_PORT=3001            # Default: 3001
MCP_HTTP_HOST=localhost       # Default: localhost

# CORS configuration
MCP_CORS_ORIGIN="http://localhost:3000,https://mcp.gauzy.co"  # Default: localhost + mcp.gauzy.co
MCP_CORS_CREDENTIALS=true     # Default: true

# Session management
MCP_SESSION_ENABLED=true      # Default: true
MCP_SESSION_COOKIE_NAME=mcp-session-id  # Default: mcp-session-id
```

### Transport Selection

The server automatically detects the best transport based on:

1. **Explicit configuration**: `MCP_TRANSPORT` environment variable
2. **Auto-detection logic**:
   - CI/test environments → stdio
   - Production/server mode → HTTP  
   - Development with TTY → stdio
   - Development with `MCP_HTTP_PORT` set → HTTP

## HTTP API Endpoints

### Health Check
```
GET /health
```
Returns server status and basic information.

### MCP Protocol
```
POST /mcp
Content-Type: application/json
```
Main endpoint for MCP JSON-RPC requests.

**Request body:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Server-Sent Events
```
GET /mcp/events
```
Real-time event stream for notifications and updates.

### Session Management
```
POST /mcp/session          # Create new session
DELETE /mcp/session/:id    # Delete session
```

## Usage Examples

### 1. Start with HTTP Transport

```bash
# Set environment variables
export MCP_TRANSPORT=http
export MCP_HTTP_PORT=3001
export MCP_HTTP_HOST=0.0.0.0  # Allow external connections

# Start the server
yarn nx serve mcp
```

### 2. Production Deployment

```bash
# Production configuration
export NODE_ENV=production
export MCP_TRANSPORT=http
export MCP_HTTP_PORT=3001
export MCP_HTTP_HOST=0.0.0.0
export MCP_CORS_ORIGIN="https://mcp.gauzy.co,https://api.gauzy.co"

# Build and start
yarn nx build mcp --configuration=production
node dist/index.js
```

### 3. Development with Auto-detection

```bash
# Auto-detect based on environment
export MCP_TRANSPORT=auto

# Will use stdio for local development
yarn nx serve mcp

# Will use HTTP if port is specified
export MCP_HTTP_PORT=3001
yarn nx serve mcp
```

## Integration with mcp-remote

This implementation follows the patterns from [mcp-remote](https://github.com/geelen/mcp-remote):

### Transport Strategies

The server supports different transport strategies:

- **http-first**: Try HTTP, fallback to SSE
- **http-only**: HTTP transport only
- **stdio-only**: stdio transport only

### Client Usage with mcp-remote

```bash
# Connect to your deployed MCP server
npx mcp-remote https://mcp.gauzy.co --transport http-only

# With custom headers
npx mcp-remote https://mcp.gauzy.co --header "Authorization: Bearer token"

# Allow HTTP in trusted networks
npx mcp-remote http://localhost:3001 --allow-http
```

## Security Considerations

### CORS Configuration

The server implements proper CORS handling:

```typescript
cors: {
  origin: ['http://localhost:3000', 'https://mcp.gauzy.co'],
  credentials: true
}
```

### Origin Validation

All HTTP requests validate the `Origin` header against allowed origins.

### Session Management

Optional session support with:
- Session ID generation
- Cookie-based session tracking  
- Session lifecycle management

## Deployment to mcp.gauzy.co

### 1. Docker Configuration

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .
RUN yarn install --frozen-lockfile
RUN yarn nx build mcp --configuration=production

ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_PORT=3001
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_CORS_ORIGIN=https://mcp.gauzy.co

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### 2. Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gauzy-mcp-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gauzy-mcp-server
  template:
    metadata:
      labels:
        app: gauzy-mcp-server
    spec:
      containers:
      - name: mcp-server
        image: gauzy/mcp-server:latest
        ports:
        - containerPort: 3001
        env:
        - name: MCP_TRANSPORT
          value: "http"
        - name: MCP_HTTP_HOST
          value: "0.0.0.0"
        - name: MCP_CORS_ORIGIN
          value: "https://mcp.gauzy.co"
---
apiVersion: v1
kind: Service
metadata:
  name: gauzy-mcp-service
spec:
  selector:
    app: gauzy-mcp-server
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

### 3. Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gauzy-mcp-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - mcp.gauzy.co
    secretName: mcp-gauzy-tls
  rules:
  - host: mcp.gauzy.co
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gauzy-mcp-service
            port:
              number: 80
```

## Architecture

### Transport Factory Pattern

```typescript
const { server, transport } = await createAndStartMcpServer();

// Automatic transport selection
// - stdio for development/CLI usage
// - HTTP for production/web usage
```

### HTTP Transport Class

Key features:
- Express.js-based HTTP server
- JSON-RPC message handling
- CORS configuration
- Session management
- Server-Sent Events support
- Graceful shutdown

### Integration Points

1. **MCP Server Manager**: Updated to support HTTP transport status reporting
2. **Configuration System**: Environment-based transport selection
3. **Graceful Shutdown**: Proper cleanup of HTTP connections
4. **Health Monitoring**: HTTP endpoint for health checks

## Testing

### Local Testing

```bash
# Start HTTP server
export MCP_TRANSPORT=http
yarn nx serve mcp

# Test health endpoint
curl http://localhost:3001/health

# Test MCP protocol
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Integration Testing

```bash
# Test with mcp-remote
npx mcp-remote http://localhost:3001 --allow-http --transport http-only
```

## Future Enhancements

1. **WebSocket Support**: Add WebSocket transport for real-time bidirectional communication
2. **Authentication**: JWT-based authentication for secure access
3. **Rate Limiting**: Request rate limiting for production deployments  
4. **Monitoring**: Metrics and logging integration
5. **Load Balancing**: Multi-instance deployment support
6. **Tool Registry**: Dynamic tool registration via HTTP API

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check `MCP_CORS_ORIGIN` environment variable
2. **Port Conflicts**: Ensure `MCP_HTTP_PORT` is available
3. **Transport Not Starting**: Check logs for configuration errors
4. **Session Issues**: Verify `MCP_SESSION_ENABLED` setting

### Debug Mode

```bash
export GAUZY_MCP_DEBUG=true
export LOG_LEVEL=debug
yarn nx serve mcp
```

### Health Check

Always verify the server is running:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-07T...",
  "transport": "http",
  "server": "gauzy-mcp-server"
}
```