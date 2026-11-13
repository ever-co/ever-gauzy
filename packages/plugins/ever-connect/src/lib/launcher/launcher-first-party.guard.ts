import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { assertFirstPartyRequest } from '@gauzy/core';

/**
 * The access-token claims that mark a token as not the person's own first-party session: a third-party OAuth app's
 * token (`oauthApp`, the approved client and scopes) and a session started from a personal API token (`apiTokenId`).
 * The names are Gauzy's own (`OAUTH_APP_TOKEN_CLAIM` and `USER_API_TOKEN_CLAIM` in core's authentication).
 */
export const NOT_FIRST_PARTY_CLAIMS: readonly string[] = ['oauthApp', 'apiTokenId'];

/** The payload of a bearer JWT, unverified (the authentication guard already verified it), or `null`. */
function bearerPayload(authorization: string | string[] | undefined): Record<string, unknown> | null {
	const value = Array.isArray(authorization) ? authorization[0] : authorization;
	const match = /^Bearer\s+([^.\s]+)\.([^.\s]+)\.([^.\s]*)$/i.exec(value ?? '');
	if (!match) {
		return null;
	}
	try {
		const payload = JSON.parse(Buffer.from(match[2], 'base64url').toString('utf8'));
		return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
	} catch {
		return null;
	}
}

/**
 * The App Launcher reads the person's apps with their own Ever ID session, so only the person's own first-party
 * session may ask for them: a request authenticated by a third-party OAuth app's token (whatever scopes it was
 * granted, an identity-only `profile email` app included) or by a session started from a personal API token gets 403
 * `first_party_only`, before anything is read.
 *
 * It applies Gauzy's own check (`assertFirstPartyRequest`, which reads the grant the authentication recorded) and
 * also reads the bearer token's claims itself, so the refusal holds even where an operator turned the OAuth app scope
 * enforcement off (`OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT=false`, which stops the grant being recorded).
 */
@Injectable()
export class LauncherFirstPartyGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const recordedGrant = request?.user?.oauthApp !== undefined && request?.user?.oauthApp !== null;
		const payload = bearerPayload(request?.headers?.['authorization']);
		const claimed =
			!!payload &&
			NOT_FIRST_PARTY_CLAIMS.some((claim) => payload[claim] !== undefined && payload[claim] !== null);
		let refusedByGauzy = false;
		try {
			assertFirstPartyRequest('The App Launcher');
		} catch {
			refusedByGauzy = true;
		}
		if (recordedGrant || claimed || refusedByGauzy) {
			throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'first_party_only' });
		}
		return true;
	}
}
