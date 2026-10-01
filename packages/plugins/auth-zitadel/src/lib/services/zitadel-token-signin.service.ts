import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OidcClientService, OidcIssuerConfig, isOidcError } from '@gauzy/auth';
import { ZitadelAccountService } from './zitadel-account.service';
import { ZitadelClaimsService } from './zitadel-claims.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelSigninService } from './zitadel-signin.service';
import { ZitadelSigninWorkspaceResponse } from './zitadel-workspace.service';

/** What another first-party client posts to `POST /api/auth/zitadel/token`. */
export interface ZitadelTokenSigninRequest {
	id_token?: string;
	access_token?: string;
}

/** The answers of the token route other than a workspace list. */
export type ZitadelTokenSigninResponse = ZitadelSigninWorkspaceResponse | { confirm_required: true; handoff: string };

/**
 * Reads the `iss` claim of a compact JWS without verifying it, only to pick which configured issuer
 * verifies it. Returns `undefined` for anything that is not a JWS.
 */
export function unverifiedIssuer(token: string): string | undefined {
	const parts = typeof token === 'string' ? token.split('.') : [];
	if (parts.length !== 3) {
		return undefined;
	}
	try {
		const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
		return typeof payload?.iss === 'string' ? payload.iss : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Signs in with a token another first-party client obtained from Ever ID (the server side of Ever
 * Teams posts the person's ID token here and gets the workspace list back).
 *
 * Every token is verified locally against the issuer's keys; its `aud` (or `azp` / `client_id`) must
 * be one of `ZITADEL_ALLOWED_AUDIENCES`, so a token another operator's client received is refused.
 * An access token never leads to a userinfo call and can only sign in to an existing link; the
 * e-mail-dependent paths need an ID token with a verified e-mail. Every refusal answers the same 401.
 */
@Injectable()
export class ZitadelTokenSigninService {
	private readonly logger = new Logger(ZitadelTokenSigninService.name);

	constructor(
		private readonly config: ZitadelConfigService,
		private readonly client: OidcClientService,
		private readonly signin: ZitadelSigninService,
		private readonly accounts: ZitadelAccountService,
		private readonly claims: ZitadelClaimsService
	) {}

	async signIn(body: ZitadelTokenSigninRequest): Promise<ZitadelTokenSigninResponse> {
		const audiences = this.config.settings.allowedAudiences;
		const token = body?.id_token || body?.access_token;
		if (!audiences.length || !token || typeof token !== 'string') {
			throw new UnauthorizedException();
		}
		const issuer = await this.config.issuer(unverifiedIssuer(token));
		if (!issuer) {
			throw new UnauthorizedException();
		}

		if (body.id_token) {
			return this.withIdToken(issuer, body.id_token, audiences);
		}
		return this.withAccessToken(issuer, body.access_token, audiences);
	}

	private async withIdToken(issuer: OidcIssuerConfig, idToken: string, audiences: string[]): Promise<ZitadelTokenSigninResponse> {
		let verified;
		try {
			verified = await this.client.validateIdToken(issuer, idToken, { audiences });
		} catch (error) {
			this.logger.debug(`Token route refused an ID token: ${isOidcError(error) ? error.code : 'error'}`);
			throw new UnauthorizedException();
		}
		const outcome = await this.signin.decide(verified, 'token');
		switch (outcome.type) {
			case 'workspaces':
				return outcome.response;
			case 'confirm':
				return { confirm_required: true, handoff: outcome.key };
			case 'signup':
				throw new HttpException({ code: 'signup_required', handoff: outcome.key }, HttpStatus.NOT_FOUND);
			case 'email_unverified':
				throw new UnauthorizedException();
			default:
				throw new HttpException({ code: 'no_workspace' }, HttpStatus.NOT_FOUND);
		}
	}

	private async withAccessToken(issuer: OidcIssuerConfig, accessToken: string, audiences: string[]): Promise<ZitadelTokenSigninResponse> {
		let payload: Record<string, unknown>;
		try {
			payload = await this.client.verifyAccessToken(issuer, accessToken, audiences);
		} catch (error) {
			this.logger.debug(`Token route refused an access token: ${isOidcError(error) ? error.code : 'error'}`);
			throw new UnauthorizedException();
		}
		// `sub` is a required, verified claim of the access token.
		const identity = { issuer: issuer.issuer, subject: payload.sub as string };
		const linked = await this.accounts.findLinkedUsers(identity.issuer, identity.subject);
		if (!linked.length) {
			throw new UnauthorizedException({ code: 'id_token_required' });
		}
		const sid = typeof payload['sid'] === 'string' ? (payload['sid'] as string) : undefined;
		return this.signin.signInLinked(linked, identity, this.claims.resolve(payload), sid);
	}
}
