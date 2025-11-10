# Refresh Token Implementation

## Overview

This implementation provides a robust, production-ready refresh token system for the desktop application following industry best practices for token management and security.

## Key Features

### 1. **Automatic Token Refresh**
- HTTP interceptor automatically refreshes expired tokens on 401 responses
- Request queuing during token refresh prevents duplicate refresh calls
- Failed requests are automatically retried with new token

### 2. **Proactive Token Refresh**
- Background service checks token expiry every minute
- Refreshes tokens 5 minutes before expiration
- Reduces user-facing 401 errors and interruptions

### 3. **Secure Token Storage**
- Tokens stored in Akita persistent store
- Synchronized with localStorage for persistence
- Token expiry timestamps tracked for intelligent refresh

### 4. **Error Handling**
- Graceful fallback on refresh failures
- Prevents infinite refresh loops on auth endpoints
- Smart logout only when refresh token is invalid

## Architecture

### Components

1. **Store Service** (`store.service.ts`)
   - Manages token and refreshToken state
   - Tracks token expiry timestamps
   - Provides `isTokenExpired()` helper method

2. **Auth Service** (`auth.service.ts`)
   - `refreshToken()` - Calls backend refresh endpoint
   - Returns Observable for better RxJS integration

3. **Auth Strategy** (`auth-strategy.service.ts`)
   - Implements `refreshToken()` method
   - Extracts and stores JWT expiry from token payload
   - Updates both access and refresh tokens in store

4. **Refresh Token Interceptor** (`refresh-token.interceptor.ts`)
   - Intercepts 401 Unauthorized responses
   - Queues requests during token refresh
   - Retries failed requests with new token
   - Skips refresh for auth endpoints to prevent loops

5. **Token Refresh Service** (`token-refresh.service.ts`)
   - Background service for proactive refresh
   - Checks token expiry every 60 seconds
   - Refreshes 5 minutes before expiration

6. **Unauthorized Interceptor** (`unauthorized.interceptor.ts`)
   - Updated to work with refresh token logic
   - Only forces logout when refresh token unavailable
   - Delegates 401 handling to RefreshTokenInterceptor

## Best Practices Implemented

### Security
- ✅ Tokens never exposed in URLs
- ✅ Refresh tokens stored securely
- ✅ Token expiry validation
- ✅ Automatic cleanup on logout

### Performance
- ✅ Single refresh request for multiple 401s
- ✅ Request queuing prevents race conditions
- ✅ Proactive refresh reduces latency
- ✅ Efficient Observable-based implementation

### User Experience
- ✅ Seamless token refresh (no user action needed)
- ✅ Failed requests automatically retried
- ✅ Prevents unnecessary logouts
- ✅ Maintains user session continuity

### Reliability
- ✅ Handles edge cases (no refresh token, expired refresh token)
- ✅ Prevents infinite loops
- ✅ Graceful degradation on failures
- ✅ Comprehensive error logging

## Implementation Details

### Token Expiry Extraction

The system extracts expiry from JWT tokens:

```typescript
private setTokenExpiry(token: string): void {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp) {
        // exp is in seconds, convert to milliseconds
        this.store.tokenExpiresAt = payload.exp * 1000;
    } else {
        // Default to 1 hour if no exp claim
        this.store.tokenExpiresAt = Date.now() + (60 * 60 * 1000);
    }
}
```

### Request Queuing

During token refresh, all requests wait for the new token:

```typescript
if (!this.isRefreshing) {
    this.isRefreshing = true;
    // Perform refresh
} else {
    // Wait for ongoing refresh to complete
    return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => next.handle(addToken(request, token)))
    );
}
```

### Proactive Refresh

Background service prevents expiry:

```typescript
interval(CHECK_INTERVAL).pipe(
    filter(() => !!this.store.refreshToken && this.store.isTokenExpired()),
    switchMap(() => this.authStrategy.refreshToken())
)
```

## Configuration

### Interceptor Order

The interceptors are registered in this order in `app.module.ts`:

1. **TokenInterceptor** - Adds auth token to requests
2. **RefreshTokenInterceptor** - Handles token refresh on 401
3. **TenantInterceptor** - Adds tenant headers
4. **OrganizationInterceptor** - Adds organization headers
5. **ServerErrorInterceptor** - Handles server errors
6. **UnauthorizedInterceptor** - Handles final unauthorized cases

### Timing Configuration

- **Check Interval**: 60 seconds (checks token expiry)
- **Refresh Buffer**: 5 minutes before expiration
- **Default Token TTL**: 1 hour (if not specified in JWT)

## Usage

### On Login

Tokens are automatically stored:

```typescript
this.store.token = token;
this.store.refreshToken = refreshToken;
this.setTokenExpiry(token);
```

### Automatic Refresh

No code changes needed - the interceptor handles it automatically.

### Manual Refresh

If needed, you can manually trigger refresh:

```typescript
this.authStrategy.refreshToken().subscribe(result => {
    if (result.isSuccess()) {
        // Token refreshed
    }
});
```

## API Requirements

The backend must support:

**POST /api/auth/refresh-token**

Request:
```json
{
    "refresh_token": "xxx"
}
```

Response:
```json
{
    "token": "new_access_token",
    "refresh_token": "optional_new_refresh_token"
}
```

## Testing Recommendations

1. **Token Expiry**: Test with short-lived tokens (5 min)
2. **Network Failures**: Simulate network errors during refresh
3. **Concurrent Requests**: Ensure multiple 401s trigger single refresh
4. **Invalid Refresh Token**: Verify proper logout behavior
5. **Proactive Refresh**: Confirm background refresh works

## Troubleshooting

### Token Not Refreshing

- Check if `refreshToken` is stored in localStorage
- Verify backend endpoint `/api/auth/refresh-token` is working
- Check browser console for refresh errors

### Infinite Refresh Loop

- Ensure auth endpoints are excluded in `isAuthEndpoint()`
- Verify backend returns proper status codes

### Logout on Valid Token

- Check `isTokenExpired()` logic
- Verify token expiry is being set correctly
- Ensure refresh token is valid

## Future Enhancements

- [ ] Add token refresh retry logic (exponential backoff)
- [ ] Implement refresh token rotation
- [ ] Add telemetry for refresh success/failure rates
- [ ] Support multiple concurrent users (multi-tenant)
- [ ] Add offline mode token caching
