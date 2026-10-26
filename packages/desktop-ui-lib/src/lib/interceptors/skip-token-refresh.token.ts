import { HttpContextToken } from '@angular/common/http';

/**
 * Set on a request whose caller handles a 401 itself, so `RefreshTokenInterceptor` passes the 401 straight back to it:
 * no token refresh, no retry and no logout.
 *
 * For `POST /auth/switch-organization` a 401 is how the API refuses the organization picked (not a member of it, or not
 * an active employee there) while the session itself is fine. Refreshing and retrying would only be refused again, and
 * `TokenRefreshExecutor` takes a refused retry for an expired session and logs the user out. Listing the endpoint in
 * `AUTH_ENDPOINTS` is no way out either: a 401 from those logs out straight away.
 */
export const SKIP_TOKEN_REFRESH = new HttpContextToken<boolean>(() => false);
