import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * The public API of `@gauzy/auth` may only grow. Apps and plugins import these names; removing or
 * renaming one breaks them. This list is every name the package exported before the OpenID Connect
 * library was added (values and types alike).
 */
const VALUES_BEFORE_OIDC = [
	'AUTH_ENV_KEYS',
	'AuthGuards',
	'BaseErrorHandler',
	'BaseSocialAuth',
	'BaseValidator',
	'ConfigManager',
	'Controllers',
	'createSafeErrorResponse',
	'DEFAULT_AUTHORIZATION_CONFIG',
	'isSafeToLogError',
	'loadAuthorizationConfig',
	'oAuth2AuthorizationCodeManager',
	'OAuth2AuthorizationCodeManager',
	'OAuth2AuthorizationServer',
	'oAuth2ClientManager',
	'OAuth2ClientManager',
	'OAuth2TokenManager',
	'OAuthValidator',
	'ResponseBuilder',
	'sanitizeErrorMessage',
	'sanitizeForLogging',
	'SecurityEvents',
	'SecurityLogger',
	'SocialAuthModule',
	'SocialAuthService',
	'Strategies',
	'UserLookupUnavailableError'
];

const TYPES_BEFORE_OIDC = [
	'AuthenticatedUser',
	'AuthorizationCode',
	'AuthorizationConfig',
	'AuthorizationError',
	'AuthorizationRequest',
	'AuthorizationServerConfig',
	'AuthorizeRequest',
	'ClientRegistrationRequest',
	'ClientRegistrationResponse',
	'IntrospectionRequest',
	'IntrospectionResponse',
	'JWKSKey',
	'JWKSResponse',
	'LoginCredentials',
	'OAuth2Client',
	'OAuth2ServerConfig',
	'OAuthAppAuthorizationRequest',
	'OAuthAppConfig',
	'OAuthAppPendingRequest',
	'OAuthAppTokenRequest',
	'OAuthAppTokenResponse',
	'ProtectedResourceMetadata',
	'PublicJWK',
	'RefreshToken',
	'ResourceMetadata',
	'SecurityEvent',
	'ServerConfig',
	'ServerMetadata',
	'StandardError',
	'TokenExchangeRequest',
	'TokenPair',
	'TokenPayload',
	'TokenRequest',
	'TokenResponse',
	'TokenValidationResult',
	'UserInfo',
	'UserInfoResponse',
	'ValidationResult'
];

/** What the OpenID Connect library adds. Internal helpers are deliberately not part of it. */
const OIDC_VALUES = [
	'BACKCHANNEL_LOGOUT_EVENT',
	'createCodeChallenge',
	'createCodeVerifier',
	'isOidcError',
	'OIDC_CLOCK_TOLERANCE_SECONDS',
	'OIDC_DISCOVERY_MAX_STALE_MS',
	'OIDC_DISCOVERY_TTL_MS',
	'OIDC_HTTP_TIMEOUT_MS',
	'OIDC_JWKS_MAX_STALE_MS',
	'OIDC_JWKS_REFETCH_COOLDOWN_MS',
	'OIDC_JWKS_TTL_MS',
	'OIDC_LOGOUT_TOKEN_MAX_AGE_SECONDS',
	'OIDC_MAX_IAT_SKEW_SECONDS',
	'OIDC_MAX_RESPONSE_BYTES',
	'OIDC_MODULE_OPTIONS',
	'OIDC_SIGNING_ALGORITHMS',
	'OIDC_TRANSACTION_COOKIE_PATH',
	'OIDC_TRANSACTION_TTL_MS',
	'OIDC_USER_AGENT',
	'OidcClientService',
	'OidcDiscoveryService',
	'OidcError',
	'OidcHttpService',
	'OidcJwksService',
	'OidcLogoutTokenService',
	'OidcModule',
	'OidcTransactionService'
];

const OIDC_TYPES = [
	'OidcAuthorizeOptions',
	'OidcBeginOptions',
	'OidcCodeExchangeResult',
	'OidcCookieRequest',
	'OidcCookieResponse',
	'OidcDiscoveryDocument',
	'OidcErrorCode',
	'OidcHttpResponse',
	'OidcIdTokenValidationOptions',
	'OidcIssuerConfig',
	'OidcKeySelector',
	'OidcLogoutToken',
	'OidcModuleOptions',
	'OidcSigningAlgorithm',
	'OidcTransaction',
	'OidcTransactionCookieOptions',
	'OidcValidatedIdToken'
];

/**
 * Lists every name `src/index.ts` exports, types included, the way a consumer's compiler sees them.
 *
 * @returns The exported names.
 */
function compiledExportNames(): string[] {
	const entry = path.resolve(__dirname, '..', 'index.ts');
	const program = ts.createProgram([entry], {
		target: ts.ScriptTarget.ES2021,
		module: ts.ModuleKind.CommonJS,
		moduleResolution: ts.ModuleResolutionKind.Node10,
		esModuleInterop: true,
		experimentalDecorators: true,
		skipLibCheck: true,
		noEmit: true,
		types: []
	});
	const checker = program.getTypeChecker();
	const source = program.getSourceFile(entry);
	const moduleSymbol = source ? checker.getSymbolAtLocation(source) : undefined;
	if (!moduleSymbol) {
		throw new Error(`Could not read the exports of ${entry}`);
	}
	return checker.getExportsOfModule(moduleSymbol).map((symbol) => symbol.getName());
}

describe('@gauzy/auth public API', () => {
	let compiled: string[];
	let runtime: Record<string, unknown>;

	beforeAll(async () => {
		compiled = compiledExportNames();
		runtime = (await import('../index')) as unknown as Record<string, unknown>;
	}, 120_000);

	it('still exports every name it exported before', () => {
		const missing = [...VALUES_BEFORE_OIDC, ...TYPES_BEFORE_OIDC].filter((name) => !compiled.includes(name));
		expect(missing).toEqual([]);
	});

	it('still provides every value it provided before at runtime', () => {
		const missing = VALUES_BEFORE_OIDC.filter((name) => runtime[name] === undefined);
		expect(missing).toEqual([]);
	});

	it('adds the OpenID Connect library, values and types', () => {
		const missing = [...OIDC_VALUES, ...OIDC_TYPES].filter((name) => !compiled.includes(name));
		expect(missing).toEqual([]);
		expect(OIDC_VALUES.filter((name) => runtime[name] === undefined)).toEqual([]);
	});

	it('keeps the library helpers internal', () => {
		const internalHelpers = ['constantTimeEquals', 'readCookie', 'stripTrailingSlashes', 'selectKey'];
		expect(internalHelpers.filter((name) => compiled.includes(name))).toEqual([]);
	});

	it('no longer registers the Keycloak strategy by default (it moved to @gauzy/plugin-auth-keycloak)', () => {
		const strategies = runtime['Strategies'] as Array<{ name: string }>;
		const guards = runtime['AuthGuards'] as Array<{ name: string }>;
		expect(strategies.map((strategy) => strategy.name)).not.toContain('KeycloakStrategy');
		expect(guards.map((guard) => guard.name)).toEqual(['MicrosoftAuthGuard']);
	});
});
