/**
 * Public surface of the OpenID Connect client library.
 *
 * Only what a sign-in plugin needs is exported; internal helpers stay inside their files so they can
 * change without touching the `@gauzy/auth` API.
 */
export { OidcError, isOidcError } from './errors';
export type { OidcErrorCode } from './errors';
export * from './oidc.types';
export * from './oidc-module.options';
export { createCodeChallenge, createCodeVerifier } from './pkce';
export { OidcHttpService, OIDC_HTTP_TIMEOUT_MS, OIDC_MAX_RESPONSE_BYTES, OIDC_USER_AGENT } from './oidc-http.service';
export type { OidcHttpResponse } from './oidc-http.service';
export { OidcDiscoveryService, OIDC_DISCOVERY_MAX_STALE_MS, OIDC_DISCOVERY_TTL_MS } from './oidc-discovery.service';
export {
	OidcJwksService,
	OIDC_JWKS_MAX_STALE_MS,
	OIDC_JWKS_REFETCH_COOLDOWN_MS,
	OIDC_JWKS_TTL_MS
} from './oidc-jwks.service';
export type { OidcKeySelector } from './oidc-jwks.service';
export {
	OidcTransactionService,
	OIDC_TRANSACTION_COOKIE_PATH,
	OIDC_TRANSACTION_TTL_MS
} from './oidc-transaction.service';
export type { OidcCookieRequest, OidcCookieResponse } from './oidc-transaction.service';
export { OidcClientService, OIDC_CLOCK_TOLERANCE_SECONDS, OIDC_MAX_IAT_SKEW_SECONDS } from './oidc-client.service';
export {
	OidcLogoutTokenService,
	BACKCHANNEL_LOGOUT_EVENT,
	OIDC_LOGOUT_TOKEN_MAX_AGE_SECONDS
} from './oidc-logout-token.service';
export { OidcModule } from './oidc.module';
