import { UnauthorizedException } from '@nestjs/common';

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

	async function run(strategy: JwtRefreshTokenStrategy, payload: any) {
		let result: { err: unknown; user: unknown } | undefined;
		await strategy.validate({ body: { refresh_token: 'refresh-token' } } as any, payload, (err, user) => {
			result = { err, user };
		});
		return result!;
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
		expect(authenticated).toBe(false);
	});

	it('still rejects an identity mismatch between the payload and the stored token', async () => {
		const { strategy } = build();
		const { err, user } = await run(strategy, { id: 'someone-else' });
		expect(err).toBeInstanceOf(UnauthorizedException);
		expect(user).toBe(false);
	});
});
