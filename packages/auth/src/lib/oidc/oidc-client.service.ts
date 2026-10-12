import { Injectable } from '@nestjs/common';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { OidcError } from './errors';
import { loadJose } from './jose-loader';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcHttpService } from './oidc-http.service';
import { OidcJwksService } from './oidc-jwks.service';
import {
	OIDC_SIGNING_ALGORITHMS,
	OidcAuthorizeOptions,
	OidcCodeExchangeResult,
	OidcIdTokenValidationOptions,
	OidcIssuerConfig,
	OidcTransaction,
	OidcValidatedIdToken
} from './oidc.types';
import { createCodeChallenge } from './pkce';

/** Default largest distance of `iat` into the future, seconds. */
export const OIDC_MAX_IAT_SKEW_SECONDS = 300;

/** Clock tolerance applied to `exp` / `nbf`, seconds. */
export const OIDC_CLOCK_TOLERANCE_SECONDS = 60;

/**
 * Builds an HTTP Basic credential for `client_secret_basic` (RFC 6749 section 2.3.1): the client id
 * and secret are form-encoded before they are joined and base64-encoded.
 *
 * @param clientId - OAuth client id.
 * @param clientSecret - OAuth client secret.
 * @returns The `Authorization` header value.
 */
export function basicClientCredential(clientId: string, clientSecret: string): string {
	// `application/x-www-form-urlencoded`, exactly as a form serializer writes it (`!'()~` included).
	const encode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);
	const credential = Buffer.from(`${encode(clientId)}:${encode(clientSecret)}`).toString('base64');
	return `Basic ${credential}`;
}

/**
 * Reads the `aud` claim as a list (it may be a single string).
 *
 * @param payload - Verified token payload.
 * @returns The audiences, possibly empty.
 */
function audienceList(payload: JWTPayload): string[] {
	if (Array.isArray(payload.aud)) {
		return payload.aud;
	}
	return payload.aud ? [payload.aud] : [];
}

/**
 * Reads a claim as a non-empty string.
 *
 * @param payload - The token payload.
 * @param name - Claim name.
 * @returns The value, or `undefined`.
 */
function stringClaim(payload: JWTPayload, name: string): string | undefined {
	const value = payload[name];
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * The authorization code flow with PKCE and ID token validation.
 *
 * All verification is local: signatures are checked against the issuer's published keys and the
 * `iss`, `aud`/`azp`, `exp`, `iat` and `nonce` claims are enforced here. The library exposes
 * `email_verified` but never decides on its own whether an e-mail may be trusted; callers do.
 */
@Injectable()
export class OidcClientService {
	constructor(
		private readonly discovery: OidcDiscoveryService,
		private readonly jwks: OidcJwksService,
		private readonly http: OidcHttpService
	) {}

	/**
	 * Builds the authorization request URL.
	 *
	 * @param config - Issuer and client settings.
	 * @param transaction - The transaction created by `OidcTransactionService.begin`.
	 * @param options - Optional `prompt`, `login_hint` and `max_age`.
	 * @returns The URL to redirect the browser to.
	 */
	async buildAuthorizeUrl(
		config: OidcIssuerConfig,
		transaction: OidcTransaction,
		options: OidcAuthorizeOptions = {}
	): Promise<string> {
		const document = await this.discovery.get(config.issuer, config.discoveryDocument);
		const url = new URL(document.authorization_endpoint);
		const params: Record<string, string> = {
			response_type: 'code',
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			scope: config.scopes.join(' '),
			state: transaction.state,
			nonce: transaction.nonce,
			code_challenge: createCodeChallenge(transaction.codeVerifier),
			code_challenge_method: 'S256'
		};
		if (options.prompt) {
			params['prompt'] = options.prompt;
		}
		if (options.loginHint) {
			params['login_hint'] = options.loginHint;
		}
		if (typeof options.maxAge === 'number' && options.maxAge >= 0) {
			params['max_age'] = String(Math.floor(options.maxAge));
		}
		for (const [name, value] of Object.entries(params)) {
			url.searchParams.set(name, value);
		}
		return url.toString();
	}

	/**
	 * Exchanges an authorization code and validates the returned ID token against the transaction nonce.
	 *
	 * @param config - Issuer and client settings.
	 * @param code - The `code` query parameter of the callback.
	 * @param transaction - The verified transaction of the callback.
	 * @returns The validated ID token and the raw tokens (never to be persisted).
	 * @throws OidcError `exchange_failed` when the issuer refuses the code, or a validation error.
	 */
	async exchangeCode(config: OidcIssuerConfig, code: string, transaction: OidcTransaction): Promise<OidcCodeExchangeResult> {
		if (!code || typeof code !== 'string') {
			throw new OidcError('exchange_failed', 'Missing authorization code');
		}
		const document = await this.discovery.get(config.issuer, config.discoveryDocument);

		const form: Record<string, string> = {
			grant_type: 'authorization_code',
			code,
			redirect_uri: config.redirectUri,
			code_verifier: transaction.codeVerifier
		};
		const headers: Record<string, string> = {};
		if (config.clientSecret) {
			headers['Authorization'] = basicClientCredential(config.clientId, config.clientSecret);
		} else {
			form['client_id'] = config.clientId;
		}

		let status: number;
		let data: unknown;
		try {
			({ status, data } = await this.http.postForm(document.token_endpoint, form, headers));
		} catch {
			throw new OidcError('exchange_failed', 'Token endpoint request failed');
		}
		const body = (data ?? {}) as Record<string, unknown>;
		if (status !== 200 || typeof body['id_token'] !== 'string') {
			throw new OidcError('exchange_failed', `Token endpoint answered ${status}`);
		}

		const idToken = await this.validateIdToken(config, body['id_token'], { nonce: transaction.nonce });
		return {
			idToken,
			accessToken: typeof body['access_token'] === 'string' ? body['access_token'] : undefined,
			refreshToken: typeof body['refresh_token'] === 'string' ? body['refresh_token'] : undefined,
			expiresIn: typeof body['expires_in'] === 'number' ? body['expires_in'] : undefined
		};
	}

	/**
	 * Validates an ID token (OpenID Connect Core 1.0, section 3.1.3.7).
	 *
	 * Checks: signature with an asymmetric key of the issuer (`RS256`, `ES256`, `EdDSA`); `iss`
	 * exactly; `aud` contains an accepted audience; with more than one `aud`, `azp` must be present
	 * and accepted; `exp`; `iat` not more than 300 s in the future; `nonce` when expected.
	 *
	 * @param config - Issuer and client settings.
	 * @param idToken - The compact JWS.
	 * @param options - Expected nonce, accepted audiences, `iat` skew.
	 * @returns The normalised token.
	 */
	async validateIdToken(
		config: OidcIssuerConfig,
		idToken: string,
		options: OidcIdTokenValidationOptions = {}
	): Promise<OidcValidatedIdToken> {
		const audiences = options.audiences ?? [config.clientId, ...(config.audienceAllowList ?? [])];
		const payload = await this.verifyJwt(config, idToken, audiences);
		this.assertAuthorizedParty(payload, audiences);

		const now = this.nowSeconds();
		const iat = Number(payload.iat);
		if (!Number.isFinite(iat) || iat > now + (options.maxIatSkewSeconds ?? OIDC_MAX_IAT_SKEW_SECONDS)) {
			throw new OidcError('token_invalid', 'ID token issued in the future');
		}

		if (options.nonce !== undefined && payload['nonce'] !== options.nonce) {
			throw new OidcError('nonce_mismatch', 'ID token nonce does not match');
		}

		return this.normalise(payload);
	}

	/**
	 * Verifies a JWT access token issued by the same issuer (no userinfo round trip).
	 *
	 * The audience check accepts the token only when `aud` contains one of `audiences`; an `azp` or
	 * `client_id` claim, when present, must be one of them too.
	 *
	 * @param config - Issuer settings.
	 * @param token - The compact JWS.
	 * @param audiences - Accepted client ids.
	 * @returns The verified payload.
	 */
	async verifyAccessToken(config: OidcIssuerConfig, token: string, audiences: string[]): Promise<JWTPayload> {
		const payload = await this.verifyJwt(config, token, undefined);
		// The token must be meant for an accepted audience. A client claim (`azp`, `client_id`) never
		// stands in for `aud`: a token minted for another resource is refused even when an accepted
		// client requested it.
		if (!audienceList(payload).some((value) => audiences.includes(value))) {
			throw new OidcError('audience_rejected', 'Access token audience is not accepted');
		}
		const parties = [stringClaim(payload, 'azp'), stringClaim(payload, 'client_id')].filter(Boolean) as string[];
		if (parties.length && !parties.every((value) => audiences.includes(value))) {
			throw new OidcError('audience_rejected', 'Access token authorized party is not accepted');
		}
		const iat = Number(payload.iat);
		if (Number.isFinite(iat) && iat > this.nowSeconds() + OIDC_MAX_IAT_SKEW_SECONDS) {
			throw new OidcError('token_invalid', 'Access token issued in the future');
		}
		return payload;
	}

	/**
	 * Calls the userinfo endpoint. The answer is accepted only for the same subject as the ID token.
	 *
	 * @param config - Issuer settings.
	 * @param accessToken - Bearer token.
	 * @param expectedSubject - `sub` of the ID token.
	 * @returns The userinfo claims.
	 */
	async userinfo(config: OidcIssuerConfig, accessToken: string, expectedSubject: string): Promise<Record<string, unknown>> {
		const document = await this.discovery.get(config.issuer, config.discoveryDocument);
		if (!document.userinfo_endpoint) {
			throw new OidcError('discovery_failed', 'The issuer publishes no userinfo endpoint');
		}
		let status: number;
		let data: unknown;
		try {
			({ status, data } = await this.http.get(document.userinfo_endpoint, { Authorization: `Bearer ${accessToken}` }));
		} catch {
			throw new OidcError('token_invalid', 'Userinfo request failed');
		}
		const body = (data ?? {}) as Record<string, unknown>;
		if (status !== 200 || body['sub'] !== expectedSubject) {
			throw new OidcError('token_invalid', 'Userinfo answer is not for this subject');
		}
		return body;
	}

	/** Current time in seconds; a method so tests can move the clock. */
	protected nowSeconds(): number {
		return Math.floor(Date.now() / 1000);
	}

	/**
	 * Verifies signature, `iss`, `exp` and (when given) `aud`.
	 */
	protected async verifyJwt(config: OidcIssuerConfig, token: string, audiences: string[] | undefined): Promise<JWTPayload> {
		if (!token || typeof token !== 'string') {
			throw new OidcError('token_invalid', 'Missing token');
		}
		const jose = await loadJose();
		const getKey: JWTVerifyGetKey = (header) =>
			this.jwks.getKey(config.issuer, { alg: header.alg, kid: header.kid }, config.discoveryDocument);
		try {
			const { payload } = await jose.jwtVerify(token, getKey, {
				issuer: config.issuer,
				algorithms: [...OIDC_SIGNING_ALGORITHMS],
				clockTolerance: OIDC_CLOCK_TOLERANCE_SECONDS,
				currentDate: new Date(this.nowSeconds() * 1000),
				...(audiences ? { audience: audiences } : {}),
				requiredClaims: ['sub', 'exp', 'iat']
			});
			return payload;
		} catch (error) {
			throw this.mapVerificationError(error);
		}
	}

	private assertAuthorizedParty(payload: JWTPayload, audiences: string[]): void {
		const aud = audienceList(payload);
		const azp = stringClaim(payload, 'azp');
		if (aud.length > 1 && !azp) {
			throw new OidcError('audience_rejected', 'A token for several audiences must name its authorized party');
		}
		if (azp && !audiences.includes(azp)) {
			throw new OidcError('audience_rejected', 'Authorized party is not accepted');
		}
	}

	private normalise(payload: JWTPayload): OidcValidatedIdToken {
		const aud = audienceList(payload);
		const authTime = Number(payload['auth_time']);
		return {
			issuer: String(payload.iss),
			subject: String(payload.sub),
			audience: aud,
			azp: stringClaim(payload, 'azp'),
			sid: stringClaim(payload, 'sid'),
			email: stringClaim(payload, 'email'),
			emailVerified: payload['email_verified'] === true,
			name: stringClaim(payload, 'name'),
			givenName: stringClaim(payload, 'given_name'),
			familyName: stringClaim(payload, 'family_name'),
			picture: stringClaim(payload, 'picture'),
			authTime: Number.isFinite(authTime) ? authTime : undefined,
			iat: Number(payload.iat),
			exp: Number(payload.exp),
			claims: { ...payload }
		};
	}

	private mapVerificationError(error: unknown): OidcError {
		if (error instanceof OidcError) {
			return error;
		}
		const code = String((error as { code?: string })?.code ?? '');
		const claim = String((error as { claim?: string })?.claim ?? '');
		if (code === 'ERR_JWT_EXPIRED') {
			return new OidcError('expired', 'Token expired');
		}
		if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'iss') {
			return new OidcError('issuer_rejected', 'Token issuer is not accepted');
		}
		if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'aud') {
			return new OidcError('audience_rejected', 'Token audience is not accepted');
		}
		return new OidcError('token_invalid', code ? `Token rejected (${code})` : 'Token rejected');
	}
}
