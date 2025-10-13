# MCP OAuth 2.0 Authorization Server

Complete OAuth 2.0 authorization server implementation for Gauzy MCP (Model Context Protocol) integrations.

## 🎯 Purpose

This module implements a production-ready OAuth 2.0 authorization server that:

-   Authenticates Gauzy users for MCP tool access
-   Issues JWT access tokens for MCP resources
-   Supports authorization code flow with PKCE
-   Integrates with Gauzy's user management system
-   Deployed as **auth.gauzy.co** (Identity Provider)

## 📁 Directory Structure

```
packages/auth/src/lib/mcp/
├── server/                    # OAuth 2.0 server components
│   ├── oauth-authorization-server.ts    # Main OAuth server
│   ├── oauth-client-manager.ts          # Client registration & validation
│   ├── oauth-token-manager.ts           # JWT token generation & validation
│   ├── oauth-authorization-code-manager.ts  # Authorization code flow
│   ├── oauth-validator.ts               # Token validation
│   └── index.ts
│
├── utils/                     # Utility functions and helpers
│   ├── security-logger.ts     # Security event logging
│   ├── security-utils.ts      # Security utilities
│   ├── base-error-handler.ts  # Error handling
│   ├── base-validator.ts      # Request validation
│   ├── response-builder.ts    # HTTP response formatting
│   ├── config-manager.ts      # Configuration management
│   └── index.ts
│
├── interfaces/                # TypeScript interfaces
│   ├── interfaces.ts          # Core OAuth interfaces
│   ├── authorization-config.ts  # Configuration interfaces
│   └── index.ts
│
├── services/                  # Business logic services
│   ├── gauzy-auth.service.ts  # Gauzy user authentication (TODO)
│   └── index.ts
│
├── index.ts                   # Main module export
├── README.md                  # This file
└── UPDATE_IMPORTS.md          # Refactoring progress & next steps
```

## 🚀 Usage

### In apps/server-auth (Identity Provider)

```typescript
import { OAuth2AuthorizationServer } from '@gauzy/auth';
import { GauzyAuthService } from '@gauzy/auth/services';

// Create OAuth server
const server = new OAuth2AuthorizationServer({
	issuer: 'https://auth.gauzy.co',
	baseUrl: 'https://auth.gauzy.co',
	audience: 'https://mcp.gauzy.co',
	enableClientRegistration: true,
	authorizationEndpoint: '/oauth2/authorize',
	tokenEndpoint: '/oauth2/token',
	jwksEndpoint: '/oauth2/jwks',
	loginEndpoint: '/oauth2/login',
	sessionSecret: process.env.SESSION_SECRET,
	redisUrl: process.env.REDIS_URL
});

// Integrate with Gauzy authentication
const gauzyAuth = new GauzyAuthService();
server.setUserAuthenticator((credentials) => gauzyAuth.authenticateUser(credentials));
server.setUserInfoProvider((userId) => gauzyAuth.getUserInfo(userId));

// Mount OAuth routes
app.use(server.getApp());
```

### In apps/server-mcp (Resource Server)

```typescript
import { OAuthValidator } from '@gauzy/auth';

// Create validator for token verification
const validator = new OAuthValidator({
	enabled: true,
	resourceUri: 'https://mcp.gauzy.co',
	authorizationServers: [
		{
			issuer: 'https://auth.gauzy.co',
			tokenEndpoint: 'https://auth.gauzy.co/oauth2/token',
			jwksUri: 'https://auth.gauzy.co/oauth2/jwks'
		}
	],
	jwt: {
		audience: 'https://mcp.gauzy.co',
		issuer: 'https://auth.gauzy.co',
		algorithms: ['RS256']
	}
});

// Validate incoming requests
const validation = await validator.validateToken(accessToken);
if (!validation.valid) {
	throw new UnauthorizedException(validation.error);
}
```

## 🔑 Key Features

### 1. **OAuth 2.0 Flows**

-   ✅ Authorization Code Flow with PKCE
-   ✅ Client Credentials Grant
-   ✅ Refresh Token Grant
-   ✅ Token Introspection (RFC 7662)

### 2. **Security**

-   ✅ CSRF Protection
-   ✅ PKCE Required for Public Clients
-   ✅ Rate Limiting
-   ✅ Security Headers (Helmet)
-   ✅ Redis Session Store (Production)
-   ✅ JWT with RS256 Signing

### 3. **User Authentication**

-   ✅ Pluggable authentication provider
-   ✅ User consent management
-   ✅ Demo users for development
-   🔄 Gauzy database integration (TODO)

### 4. **Client Management**

-   ✅ Dynamic client registration (RFC 7591)
-   ✅ Public and confidential clients
-   ✅ Redirect URI validation
-   ✅ Scope management
-   ✅ Pre-registered clients (ChatGPT, Claude)

## 🔐 Security Considerations

### Production Deployment

1. **Environment Variables**

    ```env
    SESSION_SECRET=<strong-random-secret>
    REDIS_URL=redis://your-redis-server:6379
    OAUTH_ISSUER=https://auth.gauzy.co
    OAUTH_AUDIENCE=https://mcp.gauzy.co
    NODE_ENV=production
    ```

2. **HTTPS Required**

    - All production deployments MUST use HTTPS
    - OAuth 2.0 spec requires HTTPS for authorization endpoints
    - Configure SSL/TLS certificates properly

3. **Redis Session Store**

    - CRITICAL for production scalability
    - Prevents session loss on server restart
    - Required for multi-instance deployments

4. **PKCE Enforcement**
    - S256 challenge method required in production
    - Plain challenge method only for development
    - Protects against authorization code interception

### Default Clients

The server pre-registers these clients:

1. **ChatGPT MCP Integration**

    - Client ID: `chatgpt-mcp-client`
    - Type: Public
    - Scopes: `mcp.read mcp.write`

2. **Claude MCP Integration**

    - Client ID: `claude-mcp-client`
    - Type: Public
    - Scopes: `mcp.read mcp.write`

3. **Test Client**
    - Client ID: `test-client`
    - Type: Public
    - Scopes: `mcp.read mcp.write`

## 📖 OAuth 2.0 Endpoints

### Authorization Server Metadata

```
GET /.well-known/oauth-authorization-server
```

### Authorization Endpoint

```
GET /oauth2/authorize?
  response_type=code&
  client_id=<CLIENT_ID>&
  redirect_uri=<REDIRECT_URI>&
  scope=mcp.read mcp.write&
  state=<STATE>&
  code_challenge=<CODE_CHALLENGE>&
  code_challenge_method=S256
```

### Token Endpoint

```
POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=<AUTH_CODE>&
redirect_uri=<REDIRECT_URI>&
client_id=<CLIENT_ID>&
code_verifier=<CODE_VERIFIER>
```

### Token Introspection

```
POST /oauth2/introspect
Authorization: Basic <BASE64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

token=<ACCESS_TOKEN>&
token_type_hint=access_token
```

### User Info Endpoint

```
GET /oauth2/userinfo
Authorization: Bearer <ACCESS_TOKEN>
```

### JWKS Endpoint

```
GET /oauth2/jwks
```


## 📝 Next Steps

See [UPDATE_IMPORTS.md](./UPDATE_IMPORTS.md) for detailed refactoring progress and next steps.

**Priority tasks:**

1. ✅ Move OAuth files to `packages/auth/src/lib/mcp/`
2. 🔄 Update import paths in migrated files
3. 🔄 Implement `GauzyAuthService` with database integration
4. 🔄 Refactor `apps/server-auth` to use new structure
5. 🔄 Test end-to-end authentication flow

## 📚 References

-   [RFC 6749 - OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
-   [RFC 7636 - PKCE for OAuth Public Clients](https://datatracker.ietf.org/doc/html/rfc7636)
-   [RFC 7662 - Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
-   [RFC 8414 - Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
-   [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)

## 📄 License

Copyright © 2025 Ever Co. LTD
