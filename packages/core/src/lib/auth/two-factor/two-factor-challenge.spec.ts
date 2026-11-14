import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { TWO_FACTOR_REQUIRED_CODE } from '@gauzy/contracts';
import { isAccessTokenPayload, signPurposeToken, TokenPurposeEnum, verifyPurposeToken } from '../purpose-token';
import {
	signTwoFactorChallenge,
	TWO_FACTOR_CHALLENGE_EXPIRED_MESSAGE,
	TWO_FACTOR_REQUIRED_MESSAGE,
	TwoFactorRequiredException,
	twoFactorRequiredFor,
	verifyTwoFactorChallenge
} from './two-factor-challenge';

const CLAIMS = {
	userId: '9d000000-0000-4000-8000-0000000000b1',
	email: 'marie@example.com',
	tenantId: '9d000000-0000-4000-8000-00000000000a'
};

describe('two-factor challenge', () => {
	afterEach(() => jest.restoreAllMocks());

	it('carries the user and the scope of the session to come', () => {
		const { challenge } = signTwoFactorChallenge({ ...CLAIMS, lastOrganizationId: 'org-1', lastTeamId: 'team-1' });

		expect(verifyTwoFactorChallenge(challenge)).toEqual({
			...CLAIMS,
			lastOrganizationId: 'org-1',
			lastTeamId: 'team-1'
		});
	});

	it('keeps a tenant-less user tenant-less, and leaves out a scope it was not given', () => {
		const { challenge } = signTwoFactorChallenge({ ...CLAIMS, tenantId: null });

		expect(verifyTwoFactorChallenge(challenge)).toEqual({ ...CLAIMS, tenantId: null });
	});

	it('is neither an access token nor a workspace sign-in token', () => {
		const { challenge } = signTwoFactorChallenge(CLAIMS);
		const payload = verifyPurposeToken(challenge, TokenPurposeEnum.TWO_FACTOR_CHALLENGE);

		expect(isAccessTokenPayload(payload)).toBe(false);
		expect(() => verifyPurposeToken(challenge, TokenPurposeEnum.WORKSPACE_SIGNIN)).toThrow();
	});

	it('refuses a token minted for another purpose', () => {
		const workspaceToken = signPurposeToken(TokenPurposeEnum.WORKSPACE_SIGNIN, CLAIMS, { expiresIn: '5m' });

		expect(() => verifyTwoFactorChallenge(workspaceToken)).toThrow(UnauthorizedException);
		expect(() => verifyTwoFactorChallenge('not-a-token')).toThrow(UnauthorizedException);
	});

	it('stops being accepted after five minutes, and says so', () => {
		const signedAt = Date.UTC(2026, 10, 13, 9, 0, 0);
		jest.spyOn(Date, 'now').mockReturnValue(signedAt);
		const { challenge, expiresAt } = signTwoFactorChallenge(CLAIMS);

		expect(expiresAt.toISOString()).toBe('2026-11-13T09:05:00.000Z');
		jest.spyOn(Date, 'now').mockReturnValue(signedAt + 5 * 60 * 1000 + 1000);

		expect(() => verifyTwoFactorChallenge(challenge)).toThrow(TWO_FACTOR_CHALLENGE_EXPIRED_MESSAGE);
	});

	it('answers a 403 that says why and carries the challenge', () => {
		const exception = twoFactorRequiredFor(CLAIMS);

		expect(exception).toBeInstanceOf(TwoFactorRequiredException);
		expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
		const body = exception.getResponse() as Record<string, unknown>;
		expect(body).toEqual(
			expect.objectContaining({
				statusCode: 403,
				code: TWO_FACTOR_REQUIRED_CODE,
				message: TWO_FACTOR_REQUIRED_MESSAGE
			})
		);
		expect(verifyTwoFactorChallenge(body['challenge'])).toEqual(CLAIMS);
		expect(new Date(String(body['expiresAt'])).getTime()).toBeGreaterThan(Date.now());
	});
});
