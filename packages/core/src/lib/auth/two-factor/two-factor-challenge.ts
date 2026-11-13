import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ID, ITwoFactorChallenge, TWO_FACTOR_REQUIRED_CODE } from '@gauzy/contracts';
import {
	isNonEmptyString,
	PurposeTokenError,
	signPurposeToken,
	TokenPurposeEnum,
	verifyPurposeToken
} from '../purpose-token';

/**
 * The step between a sign-in whose first factor was right and the session, for an account with two-factor
 * authentication on: the sign-in answers a 403 carrying a short-lived challenge, and `POST /auth/two-factor/verify`
 * trades the challenge and a code for the session.
 *
 * The challenge is a purpose token: it proves the first factor of ONE user for a few minutes, and it is neither an
 * access token (`isAccessTokenPayload` refuses its purpose) nor a workspace sign-in token (`verifyToken` refuses it).
 */

/** How long a sign-in waits for its code. */
export const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 5 * 60;

/** What every sign-in that asks for a code says, for apps that cannot ask for it yet and show it as an error. */
export const TWO_FACTOR_REQUIRED_MESSAGE =
	'Two-factor authentication is on for this account. Enter the code from your authenticator app to finish signing in.';

/** What a challenge says when it is used too late. */
export const TWO_FACTOR_CHALLENGE_EXPIRED_MESSAGE = 'This sign-in waited too long for its code. Sign in again.';

/** What a challenge carries: the user it was issued for, and the scope their session will have. */
export interface TwoFactorChallengeClaims {
	userId: ID;
	email: string;
	tenantId: ID | null;
	/** The organization the sign-in asked for, checked again when the session is issued. */
	lastOrganizationId?: ID;
	/** The team the sign-in asked for. */
	lastTeamId?: ID;
}

/**
 * Signs a challenge for a user whose first factor was just proven.
 *
 * @param claims The user and the scope of the session to come.
 * @param now The moment of signing, for the expiry answered to the client.
 */
export function signTwoFactorChallenge(
	claims: TwoFactorChallengeClaims,
	now: number = Date.now()
): { challenge: string; expiresAt: Date } {
	const payload: Record<string, unknown> = {
		userId: claims.userId,
		email: claims.email,
		tenantId: claims.tenantId
	};
	if (isNonEmptyString(claims.lastOrganizationId)) {
		payload['lastOrganizationId'] = claims.lastOrganizationId;
	}
	if (isNonEmptyString(claims.lastTeamId)) {
		payload['lastTeamId'] = claims.lastTeamId;
	}
	const challenge = signPurposeToken(TokenPurposeEnum.TWO_FACTOR_CHALLENGE, payload, {
		expiresIn: TWO_FACTOR_CHALLENGE_TTL_SECONDS
	});
	const expiresAt = new Date(now + TWO_FACTOR_CHALLENGE_TTL_SECONDS * 1000);
	return { challenge, expiresAt };
}

/**
 * Reads a challenge back.
 *
 * @param challenge The challenge a sign-in answered.
 * @returns What it carries.
 * @throws UnauthorizedException when it is not a valid, unexpired challenge.
 */
export function verifyTwoFactorChallenge(challenge: unknown): TwoFactorChallengeClaims {
	let payload: Record<string, unknown>;
	try {
		payload = verifyPurposeToken<Record<string, unknown>>(challenge, TokenPurposeEnum.TWO_FACTOR_CHALLENGE, {
			requiredClaims: ['userId', 'email']
		});
	} catch (error) {
		const isExpired = error instanceof PurposeTokenError && error.reason === 'expired';
		if (isExpired) {
			throw new UnauthorizedException(TWO_FACTOR_CHALLENGE_EXPIRED_MESSAGE);
		}
		throw new UnauthorizedException();
	}
	const tenantId = payload['tenantId'];
	const hasTenant = isNonEmptyString(tenantId);
	// A tenant-less user (not onboarded yet) carries `tenantId: null`; anything else must be a real id.
	if (!hasTenant && tenantId !== null) {
		throw new UnauthorizedException();
	}
	const claims: TwoFactorChallengeClaims = {
		userId: payload['userId'] as ID,
		email: payload['email'] as string,
		tenantId: hasTenant ? (tenantId as ID) : null
	};
	if (isNonEmptyString(payload['lastOrganizationId'])) {
		claims.lastOrganizationId = payload['lastOrganizationId'];
	}
	if (isNonEmptyString(payload['lastTeamId'])) {
		claims.lastTeamId = payload['lastTeamId'];
	}
	return claims;
}

/**
 * The 403 a sign-in answers instead of a session when the account has two-factor authentication on.
 *
 * Its body says why in `message` (apps that cannot ask for the code show it as they show any refused sign-in) and
 * carries the challenge for the ones that can.
 */
export class TwoFactorRequiredException extends ForbiddenException {
	constructor(challenge: string, expiresAt: Date) {
		const body: ITwoFactorChallenge = {
			statusCode: 403,
			error: 'Forbidden',
			code: TWO_FACTOR_REQUIRED_CODE,
			message: TWO_FACTOR_REQUIRED_MESSAGE,
			challenge,
			expiresAt: expiresAt.toISOString()
		};
		super(body);
	}
}

/**
 * The 403 for a user whose first factor was just proven.
 *
 * @param claims The user and the scope of the session to come.
 */
export function twoFactorRequiredFor(claims: TwoFactorChallengeClaims): TwoFactorRequiredException {
	const { challenge, expiresAt } = signTwoFactorChallenge(claims);
	return new TwoFactorRequiredException(challenge, expiresAt);
}
