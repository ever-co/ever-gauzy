import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DATABASE_UNAVAILABLE_MESSAGE } from '../../core/errors/database-unavailable';

// Only DI metadata is needed here; the real modules drag in the whole core entity graph, which cannot
// be required in isolation (pre-existing circular import).
jest.mock('../../user/user.service', () => ({ UserService: class UserService {} }));
jest.mock('../../refresh-token/refresh-token.service', () => ({
	RefreshTokenService: class RefreshTokenService {}
}));

import { JwtRefreshTokenStrategy } from './jwt-refresh-token.strategy';

/**
 * GHSA-3cgp-wmrg-4fqg — the refresh strategy resolves an identity and attaches it to the request, so it
 * must apply the same account-status predicates as login and as the access-token strategy. Today the
 * downstream `getJwtAccessToken` filter happens to block a deactivated user from minting a new access
 * token; a strategy that hands out an authenticated identity in the first place is one refactor away
 * from that being the only thing standing in the way.
 */
describe('JwtRefreshTokenStrategy.validate', () => {
	const activeUser = { id: 'user-1', tenantId: 'tenant', isActive: true, isArchived: false };

	function build(user: any = { ...activeUser }) {
		const userService = { findOneByIdString: jest.fn(async () => user) };
		const refreshTokenService = {
			verify: jest.fn(async () => ({ isValid: true, token: { userId: 'user-1' }, reason: null }))
		};
		const strategy = new JwtRefreshTokenStrategy(userService as any, refreshTokenService as any);
		return { strategy, userService, refreshTokenService };
	}

	/**
	 * Runs the strategy the way passport-jwt does (`passReqToCallback`): through the verify callback the
	 * `PassportStrategy` mixin registered, which reports what `validate` returned or threw to passport's
	 * `done`. Every call is recorded, and there must be exactly one.
	 */
	async function run(strategy: JwtRefreshTokenStrategy, payload: any) {
		const calls: Array<{ err: unknown; user: unknown }> = [];
		await (strategy as any)._verify(
			{ body: { refresh_token: 'refresh-token' } },
			payload,
			(err: unknown, user: unknown) => calls.push({ err, user })
		);
		expect(calls).toHaveLength(1);
		return calls[0];
	}

	it('authenticates an active user', async () => {
		const { strategy } = build();
		const { err, user } = await run(strategy, { id: 'user-1' });
		expect(err).toBeNull();
		expect(user).toMatchObject({ id: 'user-1' });
	});

	it.each([
		['a deactivated user', { ...activeUser, isActive: false }],
		['an archived user', { ...activeUser, isArchived: true }],
		['a user whose isActive is unknown', { ...activeUser, isActive: undefined }],
		['a user whose isArchived is unknown', { ...activeUser, isArchived: undefined }],
		['a user whose isArchived is null', { ...activeUser, isArchived: null }],
		['a missing user', null]
	])('rejects %s', async (_label, user) => {
		const { strategy } = build(user);
		const { err, user: authenticated } = await run(strategy, { id: 'user-1' });
		expect(err).toBeInstanceOf(UnauthorizedException);
		expect(authenticated).toBeNull();
	});

	it('still rejects an identity mismatch between the payload and the stored token', async () => {
		const { strategy } = build();
		const { err, user } = await run(strategy, { id: 'someone-else' });
		expect(err).toBeInstanceOf(UnauthorizedException);
		expect(user).toBeNull();
	});

	describe('passport contract', () => {
		const request = { body: { refresh_token: 'refresh-token' } } as any;

		it('returns the user', async () => {
			const { strategy } = build();
			await expect(strategy.validate(request, { id: 'user-1' })).resolves.toMatchObject({ id: 'user-1' });
		});

		it('throws the refusal it decided exactly as it was built', async () => {
			const { strategy, refreshTokenService } = build();
			refreshTokenService.verify.mockResolvedValue({
				isValid: false,
				token: null,
				reason: 'Token revoked'
			} as any);

			await expect(strategy.validate(request, { id: 'user-1' })).rejects.toMatchObject({
				response: { statusCode: 401, message: 'Token revoked' }
			});
		});

		it('turns a lookup that threw into a 401 carrying its message', async () => {
			const { strategy, userService } = build();
			userService.findOneByIdString.mockRejectedValue(new Error('lookup failed'));

			const result = strategy.validate(request, { id: 'user-1' });
			await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(result).rejects.toMatchObject({
				response: { statusCode: 401, message: 'Unauthorized', error: 'lookup failed' }
			});
		});
	});

	/**
	 * A refresh that could not be judged because the database was unreachable is a 503: a 401 here makes the
	 * client discard its tokens, so an outage would sign every user out. Other failures keep their 401.
	 */
	describe('database outages', () => {
		const request = { body: { refresh_token: 'refresh-token' } } as any;

		it('answers an unreachable database while verifying the refresh token with a 503', async () => {
			const { strategy, refreshTokenService } = build();
			refreshTokenService.verify.mockRejectedValue(new Error('timeout exceeded when trying to connect'));

			const result = strategy.validate(request, { id: 'user-1' });
			await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
			await expect(result).rejects.toMatchObject({
				response: { statusCode: 503, message: DATABASE_UNAVAILABLE_MESSAGE }
			});
		});

		it('answers an unreachable database while loading the user with a 503', async () => {
			const { strategy, userService } = build();
			userService.findOneByIdString.mockRejectedValue(
				new QueryFailedError('SELECT 1', [], new Error('Connection terminated unexpectedly'))
			);

			await expect(strategy.validate(request, { id: 'user-1' })).rejects.toBeInstanceOf(
				ServiceUnavailableException
			);
		});

		it('still answers any other failure with a 401', async () => {
			const { strategy, refreshTokenService } = build();
			refreshTokenService.verify.mockRejectedValue(new Error('database is down'));

			await expect(strategy.validate(request, { id: 'user-1' })).rejects.toMatchObject({
				response: { statusCode: 401, message: 'Unauthorized', error: 'database is down' }
			});
		});
	});
});
