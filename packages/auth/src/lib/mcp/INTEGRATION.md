# MCP OAuth Integration Guide

## Overview

The MCP OAuth 2.0 Authorization Server is implemented in `@gauzy/auth` package, while user authentication is handled by `UserService` in `@gauzy/core`. This design avoids circular dependencies between packages.

## Architecture

```
┌─────────────────────────────────────┐
│   Application Layer (apps/)         │
│   - Wires OAuth Server + UserService│
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
┌─────▼──────┐   ┌─────▼──────┐
│ @gauzy/auth│   │ @gauzy/core│
│ OAuth Server│  │ UserService│
│ (Generic)   │  │ (DB Access)│
└─────────────┘  └─────────────┘
```

## Integration Steps

### 1. Import Required Dependencies

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { OAuth2AuthorizationServer } from '@gauzy/auth';
import { UserService } from '@gauzy/core';
```

### 2. Create OAuth Service in Your Application

```typescript
@Injectable()
export class McpOAuthService implements OnModuleInit {
  private oauthServer: OAuth2AuthorizationServer;

  constructor(
    private readonly userService: UserService
  ) {
    // Initialize OAuth server with configuration
    this.oauthServer = new OAuth2AuthorizationServer({
      issuer: process.env.OAUTH_ISSUER || 'https://api.gauzy.co',
      baseUrl: process.env.OAUTH_BASE_URL || 'http://localhost:3001',
      audience: process.env.OAUTH_AUDIENCE || 'gauzy-mcp-api',
      enableClientRegistration: true,
      authorizationEndpoint: '/oauth2/authorize',
      tokenEndpoint: '/oauth2/token',
      jwksEndpoint: '/oauth2/jwks',
      loginEndpoint: '/oauth2/login',
      registrationEndpoint: '/oauth2/register',
      introspectionEndpoint: '/oauth2/introspect',
      userInfoEndpoint: '/oauth2/userinfo',
      sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
      redisUrl: process.env.REDIS_URL // Optional
    });
  }

  onModuleInit() {
    // Wire UserService methods with OAuth server
    this.setupAuthentication();
  }

  private setupAuthentication() {
    // Set user authenticator
    this.oauthServer.setUserAuthenticator(async (credentials) => {
      const { email, password } = credentials;

      // Use UserService to authenticate
      const user = await this.userService.authenticateMcpUser(email, password);

      if (!user) {
        return null;
      }

      // Get organization ID
      const organizationId = user.organizations?.[0]?.organization?.id ||
                            user['defaultOrganizationId'];

      // Transform to OAuth format
      return {
        userId: user.id,
        email: user.email,
        name: user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email,
        organizationId,
        tenantId: user.tenantId,
        roles: user.role ? [user.role.name] : [],
        emailVerified: !!user['emailVerifiedAt'],
        picture: user['imageUrl']
      };
    });

    // Set user info provider
    this.oauthServer.setUserInfoProvider(async (userId) => {
      // Use UserService to get user info
      const user = await this.userService.getMcpUserInfo(userId);

      if (!user) {
        return null;
      }

      // Get organization ID
      const organizationId = user.organizations?.[0]?.organization?.id ||
                            user['defaultOrganizationId'];

      // Transform to OAuth format
      return {
        userId: user.id,
        email: user.email,
        name: user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email,
        organizationId,
        tenantId: user.tenantId,
        roles: user.role ? [user.role.name] : [],
        emailVerified: !!user['emailVerifiedAt'],
        picture: user['imageUrl']
      };
    });
  }

  /**
   * Get the Express app with OAuth routes
   */
  getOAuthApp() {
    return this.oauthServer.getApp();
  }

  /**
   * Get server statistics
   */
  getStats() {
    return this.oauthServer.getStats();
  }
}
```

### 3. Register OAuth Service in Your Module

```typescript
import { Module } from '@nestjs/common';
import { UserModule } from '@gauzy/core';
import { McpOAuthService } from './mcp-oauth.service';

@Module({
  imports: [UserModule],
  providers: [McpOAuthService],
  exports: [McpOAuthService]
})
export class McpOAuthModule {}
```

### 4. Mount OAuth Routes in Your Main Application

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { McpOAuthService } from './mcp-oauth/mcp-oauth.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get OAuth service
  const oauthService = app.get(McpOAuthService);

  // Mount OAuth routes
  app.use('/oauth', oauthService.getOAuthApp());

  await app.listen(3001);
  console.log('OAuth server running on http://localhost:3001');
}

bootstrap();
```

## UserService MCP Methods

The following methods are available in `UserService` (`@gauzy/core`):

### `authenticateMcpUser(email: string, password: string): Promise<IUser | null>`

Authenticates a user by email and password for MCP OAuth.

**Parameters:**
- `email`: User's email address
- `password`: User's plaintext password

**Returns:** User object if authentication succeeds, `null` otherwise

**Example:**
```typescript
const user = await userService.authenticateMcpUser('user@example.com', 'password123');
if (user) {
  console.log('Authentication successful:', user.email);
}
```

### `getMcpUserInfo(userId: string): Promise<IUser | null>`

Retrieves user information by user ID for MCP OAuth token claims.

**Parameters:**
- `userId`: The user's unique identifier

**Returns:** User object with relations (role, tenant, organizations) or `null` if not found

**Example:**
```typescript
const userInfo = await userService.getMcpUserInfo('user-uuid-here');
if (userInfo) {
  console.log('User info:', userInfo);
}
```

## Environment Variables

```bash
# OAuth Configuration
OAUTH_ISSUER=https://api.gauzy.co
OAUTH_BASE_URL=http://localhost:3001
OAUTH_AUDIENCE=gauzy-mcp-api
SESSION_SECRET=your-secure-session-secret-here

# Optional: Redis for production
REDIS_URL=redis://localhost:6379
```

## Testing the Integration

1. **Start your application:**
   ```bash
   yarn start:dev
   ```

2. **Test authorization endpoint:**
   ```
   GET http://localhost:3001/oauth/oauth2/authorize?
     response_type=code&
     client_id=YOUR_CLIENT_ID&
     redirect_uri=http://localhost:3000/callback&
     scope=mcp.read&
     state=random-state
   ```

3. **Login with Gauzy credentials:**
   - The OAuth server will redirect to the login page
   - Use your Gauzy user credentials (email/password)
   - Grant consent to the application

4. **Exchange authorization code for tokens:**
   ```bash
   curl -X POST http://localhost:3001/oauth/oauth2/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=AUTHORIZATION_CODE" \
     -d "redirect_uri=http://localhost:3000/callback" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET"
   ```

## Benefits of This Architecture

✅ **No Circular Dependencies:** `@gauzy/auth` doesn't import from `@gauzy/core`

✅ **Clean Separation:** OAuth logic is generic, user logic is specific to Gauzy

✅ **Reusable:** OAuth server can be used with any user system via the adapter pattern

✅ **Testable:** Each component can be tested independently

✅ **Type-Safe:** Full TypeScript support with proper interfaces

## Troubleshooting

### "Circular dependency" error persists

Make sure there are no imports of `@gauzy/core` anywhere in `packages/auth/src/**/*.ts` files (excluding documentation).

### "User authenticator not configured" error

This means you forgot to call `setUserAuthenticator()` on the OAuth server in your `onModuleInit()` method.

### Database connection issues

Ensure your NestJS application has properly configured TypeORM with the User entity before initializing the OAuth service.
