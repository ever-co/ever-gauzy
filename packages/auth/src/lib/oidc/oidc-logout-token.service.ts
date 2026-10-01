import { Injectable } from '@nestjs/common';
import type { JWTVerifyGetKey } from 'jose';
import { OidcError } from './errors';
import { loadJose } from './jose-loader';
import { OidcJwksService } from './oidc-jwks.service';
import { OIDC_SIGNING_ALGORITHMS, OidcIssuerConfig, OidcLogoutToken } from './oidc.types';

/**
 * The event a back-channel logout token must carry (Back-Channel Logout 1.0, section 2.4). It is an
 * identifier fixed by the specification, compared as a string and never requested, so its `http`
 * scheme is not a transport.
 */
export const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout'; // NOSONAR

/** A logout token older than this is refused, seconds. */
export const OIDC_LOGOUT_TOKEN_MAX_AGE_SECONDS = 300;

/** Clock tolerance for tokens dated slightly in the future, seconds. */
const FUTURE_TOLERANCE_SECONDS = 60;

/** A claim as a non-empty string, or `undefined`. */
function nonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

/** True for an `events` claim (a JSON object) that contains the back-channel logout event. */
function isBackchannelLogoutEvents(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value) && BACKCHANNEL_LOGOUT_EVENT in value;
}

/** Maps a verification failure of `jose` to the library's error codes. */
function toLogoutTokenError(error: unknown): OidcError {
	if (error instanceof OidcError) {
		return error;
	}
	const { code, claim } = (error ?? {}) as { code?: string; claim?: string };
	if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'iss') {
		return new OidcError('issuer_rejected', 'Logout token issuer is not accepted');
	}
	if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'aud') {
		return new OidcError('audience_rejected', 'Logout token audience is not accepted');
	}
	return new OidcError('token_invalid', code ? `Logout token rejected (${code})` : 'Logout token rejected');
}

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
		const payload = await this.verifySignature(config, logoutToken);
		const iat = this.checkIssuedAt(payload['iat']);

		const jti = nonEmptyString(payload['jti']);
		if (!jti) {
			throw new OidcError('token_invalid', 'Logout token has no jti');
		}
		const events = payload['events'];
		if (!isBackchannelLogoutEvents(events)) {
			throw new OidcError('token_invalid', 'Logout token carries no back-channel logout event');
		}
		if ('nonce' in payload) {
			throw new OidcError('token_invalid', 'A logout token must not carry a nonce');
		}
		const subject = nonEmptyString(payload['sub']);
		const sid = nonEmptyString(payload['sid']);
		if (!subject && !sid) {
			throw new OidcError('token_invalid', 'Logout token names neither a subject nor a session');
		}

		return {
			// Verified against the configured issuer above.
			issuer: payload['iss'] as string,
			subject,
			sid,
			jti,
			iat,
			events: Object.keys(events)
		};
	}

	/** Verifies the signature, issuer and audience against the issuer's published keys. */
	private async verifySignature(config: OidcIssuerConfig, logoutToken: string): Promise<Record<string, unknown>> {
		const jose = await loadJose();
		const getKey: JWTVerifyGetKey = (header) =>
			this.jwks.getKey(config.issuer, { alg: header.alg, kid: header.kid }, config.discoveryDocument);
		try {
			const verified = await jose.jwtVerify(logoutToken, getKey, {
				issuer: config.issuer,
				audience: config.clientId,
				algorithms: [...OIDC_SIGNING_ALGORITHMS],
				currentDate: new Date(this.nowSeconds() * 1000),
				clockTolerance: FUTURE_TOLERANCE_SECONDS,
				requiredClaims: ['iat', 'jti']
			});
			return verified.payload as Record<string, unknown>;
		} catch (error) {
			throw toLogoutTokenError(error);
		}
	}

	/** A logout token must be recent: at most 300 s old, and not from the future. */
	private checkIssuedAt(value: unknown): number {
		const now = this.nowSeconds();
		const iat = Number(value);
		if (!Number.isFinite(iat) || now - iat > OIDC_LOGOUT_TOKEN_MAX_AGE_SECONDS) {
			throw new OidcError('expired', 'Logout token is too old');
		}
		if (iat > now + FUTURE_TOLERANCE_SECONDS) {
			throw new OidcError('token_invalid', 'Logout token issued in the future');
		}
		return iat;
	}

	/** Current time in seconds; a method so tests can move the clock. */
	protected nowSeconds(): number {
		return Math.floor(Date.now() / 1000);
	}
}
