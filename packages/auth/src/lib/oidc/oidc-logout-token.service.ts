import { Injectable } from '@nestjs/common';
import type { JWTVerifyGetKey } from 'jose';
import { OidcError } from './errors';
import { loadJose } from './jose-loader';
import { OidcJwksService } from './oidc-jwks.service';
import { OIDC_SIGNING_ALGORITHMS, OidcIssuerConfig, OidcLogoutToken } from './oidc.types';

/** The event a back-channel logout token must carry (Back-Channel Logout 1.0, section 2.4). */
export const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

/** A logout token older than this is refused, seconds. */
export const OIDC_LOGOUT_TOKEN_MAX_AGE_SECONDS = 300;

/** Clock tolerance for tokens dated slightly in the future, seconds. */
const FUTURE_TOLERANCE_SECONDS = 60;

/**
 * Validates back-channel logout tokens (OpenID Connect Back-Channel Logout 1.0, section 2.6).
 *
 * Checks: signature with the issuer's keys; `iss`; `aud` contains the client id; `iat` present and
 * not older than 300 s; `jti` present; the `events` claim contains the back-channel logout event;
 * `sub` or `sid` present; no `nonce`. Replay protection (remembering `jti`) is the caller's job,
 * because only the caller has durable storage.
 */
@Injectable()
export class OidcLogoutTokenService {
	constructor(private readonly jwks: OidcJwksService) {}

	/**
	 * Validates a logout token.
	 *
	 * @param config - Issuer and client settings.
	 * @param logoutToken - The compact JWS posted by the issuer.
	 * @returns The verified token.
	 * @throws OidcError `token_invalid`, `expired`, `issuer_rejected` or `audience_rejected`.
	 */
	async validate(config: OidcIssuerConfig, logoutToken: string): Promise<OidcLogoutToken> {
		if (!logoutToken || typeof logoutToken !== 'string') {
			throw new OidcError('token_invalid', 'Missing logout token');
		}
		const jose = await loadJose();
		const getKey: JWTVerifyGetKey = (header) =>
			this.jwks.getKey(config.issuer, { alg: header.alg, kid: header.kid }, config.discoveryDocument);

		let payload: Record<string, unknown>;
		try {
			const verified = await jose.jwtVerify(logoutToken, getKey, {
				issuer: config.issuer,
				audience: config.clientId,
				algorithms: [...OIDC_SIGNING_ALGORITHMS],
				currentDate: new Date(this.nowSeconds() * 1000),
				clockTolerance: FUTURE_TOLERANCE_SECONDS,
				requiredClaims: ['iat', 'jti']
			});
			payload = verified.payload as Record<string, unknown>;
		} catch (error) {
			const code = String((error as { code?: string })?.code ?? '');
			const claim = String((error as { claim?: string })?.claim ?? '');
			if (error instanceof OidcError) {
				throw error;
			}
			if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'iss') {
				throw new OidcError('issuer_rejected', 'Logout token issuer is not accepted');
			}
			if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'aud') {
				throw new OidcError('audience_rejected', 'Logout token audience is not accepted');
			}
			throw new OidcError('token_invalid', code ? `Logout token rejected (${code})` : 'Logout token rejected');
		}

		const now = this.nowSeconds();
		const iat = Number(payload['iat']);
		if (!Number.isFinite(iat) || now - iat > OIDC_LOGOUT_TOKEN_MAX_AGE_SECONDS) {
			throw new OidcError('expired', 'Logout token is too old');
		}
		if (iat > now + FUTURE_TOLERANCE_SECONDS) {
			throw new OidcError('token_invalid', 'Logout token issued in the future');
		}

		const jti = payload['jti'];
		if (typeof jti !== 'string' || !jti) {
			throw new OidcError('token_invalid', 'Logout token has no jti');
		}

		const events = payload['events'];
		if (!events || typeof events !== 'object' || Array.isArray(events) || !(BACKCHANNEL_LOGOUT_EVENT in events)) {
			throw new OidcError('token_invalid', 'Logout token carries no back-channel logout event');
		}

		if ('nonce' in payload) {
			throw new OidcError('token_invalid', 'A logout token must not carry a nonce');
		}

		const subject = typeof payload['sub'] === 'string' && payload['sub'] ? (payload['sub'] as string) : undefined;
		const sid = typeof payload['sid'] === 'string' && payload['sid'] ? (payload['sid'] as string) : undefined;
		if (!subject && !sid) {
			throw new OidcError('token_invalid', 'Logout token names neither a subject nor a session');
		}

		return {
			issuer: String(payload['iss']),
			subject,
			sid,
			jti,
			iat,
			events: Object.keys(events)
		};
	}

	/** Current time in seconds; a method so tests can move the clock. */
	protected nowSeconds(): number {
		return Math.floor(Date.now() / 1000);
	}
}
