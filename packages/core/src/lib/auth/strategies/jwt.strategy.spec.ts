import { UnauthorizedException } from '@nestjs/common';

// The strategy only needs these for DI metadata; loading the real modules drags in the whole core
// entity graph, which cannot be required in isolation (pre-existing circular import).
jest.mock('../auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../../user-organization/user-organization.services', () => ({
	UserOrganizationService: class UserOrganizationService {}
}));

import { JwtStrategy } from './jwt.strategy';

/**
 * Regression suite for the id-less JWT acceptance bug (found while fixing GHSA-44pv-34gx-q9p4).
 *
 * Every JWT signed with JWT_SECRET reaches JwtStrategy.validate — including invite, estimate, team-join,
 * appointment and magic-code tokens, none of which carry an `id` claim. The lookup then ran
 * `findOneBy({ id: undefined })`, which TypeORM turns into `SELECT ... LIMIT 1`, so such a token
 * authenticated as the FIRST user in the table. The strategy must refuse a payload that names no user.
 */
describe('JwtStrategy.validate', () => {
	const firstUser = { id: 'first-user', tenantId: 'tenant', email: 'admin@ever.co' };

	function build() {
		const authService = { getAuthenticatedUser: jest.fn(async () => firstUser) };
		const employeeService = { findOneByIdString: jest.fn() };
		const userOrganizationService = { findOneByOptions: jest.fn() };
		const strategy = new JwtStrategy(authService as any, employeeService as any, userOrganizationService as any);
		return { strategy, authService };
	}

	async function run(strategy: JwtStrategy, payload: any) {
		let result: { err: unknown; user: unknown } | undefined;
		await strategy.validate(payload, (err, user) => {
			result = { err, user };
		});
		return result!;
	}

	it.each([
		['an invite token', { email: 'invitee@ever.co', code: '123456' }],
		['an estimate-email token', { invoiceId: 'inv', organizationId: 'org', tenantId: 'tenant', email: 'x@y.z' }],
		['a team-join token', { email: 'x@y.z', tenantId: 't', organizationId: 'o', organizationTeamId: 'team', code: 'c' }],
		['an appointment token', { appointmentId: 'appointment-1' }],
		['a magic-code token (userId, not id)', { userId: 'u', email: 'x@y.z', tenantId: 't', code: 'c' }],
		['an empty payload', {}]
	])('rejects %s without touching the user store', async (_label, payload) => {
		const { strategy, authService } = build();
		const { err, user } = await run(strategy, payload);
		expect(err).toBeInstanceOf(UnauthorizedException);
		expect(user).toBe(false);
		expect(authService.getAuthenticatedUser).not.toHaveBeenCalled();
	});

	it('still authenticates a real access token (id claim)', async () => {
		const { strategy, authService } = build();
		const { err, user } = await run(strategy, { id: 'first-user', tenantId: 'tenant' });
		expect(err).toBeNull();
		expect(user).toMatchObject({ id: 'first-user' });
		expect(authService.getAuthenticatedUser).toHaveBeenCalledWith('first-user', undefined);
	});

	it('still authenticates a third-party token (thirdPartyId claim)', async () => {
		const { strategy, authService } = build();
		const { err } = await run(strategy, { thirdPartyId: 'github-1' });
		expect(err).toBeNull();
		expect(authService.getAuthenticatedUser).toHaveBeenCalledWith(undefined, 'github-1');
	});
});
