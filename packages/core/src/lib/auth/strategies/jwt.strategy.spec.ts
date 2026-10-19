// cspell:ignore verif
import { NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { sign } from 'jsonwebtoken';
import { DatabaseError } from 'pg';
import { QueryFailedError } from 'typeorm';
import { DATABASE_UNAVAILABLE_MESSAGE } from '../../core/errors/database-unavailable';

// The strategy only needs these for DI metadata; loading the real modules drags in the whole core
// entity graph, which cannot be required in isolation (pre-existing circular import).
jest.mock('../auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../../user-organization/user-organization.services', () => ({
	UserOrganizationService: class UserOrganizationService {}
}));
jest.mock('../../role/role-authorization.service', () => ({
	RoleAuthorizationService: class RoleAuthorizationService {}
}));

import { Test } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { EmployeeService } from '../../employee/employee.service';
import { RoleAuthorizationService } from '../../role/role-authorization.service';
import { UserOrganizationService } from '../../user-organization/user-organization.services';
import { AuthenticatedUserCache, AuthenticatedUserCacheProvider } from './authenticated-user-cache';
import { JwtStrategy } from './jwt.strategy';

/**
 * Regression suite for the id-less JWT acceptance bug (found while fixing GHSA-44pv-34gx-q9p4) and for
 * the stale-token authorization bugs GHSA-3cgp-wmrg-4fqg / GHSA-m8xc-8pwr-89fj.
 *
 * Every JWT signed with JWT_SECRET reaches JwtStrategy.validate — including invite, estimate, team-join,
 * appointment and magic-code tokens, none of which carry an `id` claim. The lookup then ran
 * `findOneBy({ id: undefined })`, which TypeORM turns into `SELECT ... LIMIT 1`, so such a token
 * authenticated as the FIRST user in the table. The strategy must refuse a payload that names no user.
 *
 * The strategy is also the only place that re-reads the account on every request, so it is where a
 * deactivated / archived user has to be refused and where the DB-fresh role and permissions get pinned
 * onto `request.user`.
 */
describe('JwtStrategy.validate', () => {
	const activeUser = {
		id: 'first-user',
		tenantId: 'tenant',
		email: 'admin@ever.co',
		roleId: 'role-1',
		isActive: true,
		isArchived: false
	};

	function build(user: any = { ...activeUser }, authenticatedUsers?: AuthenticatedUserCache) {
		const authService = { getAuthenticatedUser: jest.fn(async () => user) };
		const employeeService = { findOneByIdString: jest.fn() };
		const userOrganizationService = { findOneByOptions: jest.fn() };
		const roleAuthorizationService = {
			attachAuthorizationState: jest.fn(async (u: any) => {
				u.role = { id: 'role-1', name: 'EMPLOYEE' };
				u.permissions = ['ORG_TEAM_VIEW'];
				return u;
			})
		};
		const strategy = new JwtStrategy(
			authService as any,
			employeeService as any,
			userOrganizationService as any,
			roleAuthorizationService as any,
			authenticatedUsers
		);
		return { strategy, authService, employeeService, userOrganizationService, roleAuthorizationService };
	}

	/**
	 * Runs the strategy the way passport-jwt does: through the verify callback the `PassportStrategy` mixin
	 * registered, which calls `validate` and reports its outcome to passport's `done` — `done(null, user)` for
	 * a returned user, `done(err, null)` for a thrown error. Every call is recorded, and there must be
	 * exactly one: a second one is what turned every authenticated request into a success followed by a
	 * thrown-and-swallowed `UnauthorizedException`.
	 */
	async function run(strategy: JwtStrategy, payload: any) {
		const calls: Array<{ err: unknown; user: unknown }> = [];
		await (strategy as any)._verify(payload, (err: unknown, user: unknown) => calls.push({ err, user }));
		expect(calls).toHaveLength(1);
		return calls[0];
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
		expect(user).toBeNull();
		expect(authService.getAuthenticatedUser).not.toHaveBeenCalled();
	});

	/**
	 * GHSA-28wv-vrxj-rp4q — every purpose-specific token is signed with the same JWT_SECRET. A
	 * password-reset token even carries `id`, so the id-presence check above does not stop it.
	 */
	describe('purpose-typed tokens (GHSA-28wv-vrxj-rp4q)', () => {
		it.each([
			['a password-reset token', { purpose: 'password-reset', id: 'first-user', tenantId: 'tenant' }],
			[
				'an invoice share token',
				{ purpose: 'invoice-share', id: 'first-user', organizationId: 'o', tenantId: 'tenant' }
			],
			['a refresh token', { id: 'first-user', tenantId: 'tenant', tokenType: 'REFRESH_TOKEN_TYPE' }]
		])('rejects %s even though it names a user id', async (_label, payload: any) => {
			// CONTROL: the payload passes the pre-existing id-presence check, so only the type check stops it.
			expect(payload.id).toBeTruthy();

			const { strategy, authService } = build();
			const { err, user } = await run(strategy, payload);
			expect(err).toBeInstanceOf(UnauthorizedException);
			expect(user).toBeNull();
			expect(authService.getAuthenticatedUser).not.toHaveBeenCalled();
		});

		it('authenticates an access token carrying the access token type', async () => {
			const { strategy } = build();
			const { err, user } = await run(strategy, {
				id: 'first-user',
				tenantId: 'tenant',
				tokenType: 'ACCESS_TOKEN_TYPE'
			});
			expect(err).toBeNull();
			expect(user).toMatchObject({ id: 'first-user' });
		});

		it('only verifies HS256 signatures', () => {
			const { strategy } = build();
			expect((strategy as any)._verifOpts.algorithms).toEqual(['HS256']);
		});
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

	/**
	 * GHSA-3cgp-wmrg-4fqg — deactivating or archiving an account is an off-boarding control and must
	 * end the session on the next request, not whenever the token happens to expire.
	 */
	describe('deactivated and archived accounts (GHSA-3cgp-wmrg-4fqg)', () => {
		it.each([
			['a deactivated user', { ...activeUser, isActive: false }],
			['an archived user', { ...activeUser, isArchived: true }],
			['a user whose isActive is unknown', { ...activeUser, isActive: undefined }],
			['a user whose isActive is null', { ...activeUser, isActive: null }],
			['a user whose isArchived is unknown', { ...activeUser, isArchived: undefined }],
			['a user whose isArchived is null', { ...activeUser, isArchived: null }]
		])('rejects %s holding a still-valid token', async (_label, user) => {
			const { strategy, roleAuthorizationService } = build(user);
			const { err, user: authenticated } = await run(strategy, { id: 'first-user', tenantId: 'tenant' });
			expect(err).toBeInstanceOf(UnauthorizedException);
			expect(authenticated).toBeNull();
			// Nothing about the request may be set up for a user we just refused.
			expect(roleAuthorizationService.attachAuthorizationState).not.toHaveBeenCalled();
		});

		it.each([
			['deactivated', { id: 'emp-1', userId: 'first-user', isActive: false, isArchived: false }],
			['archived', { id: 'emp-1', userId: 'first-user', isActive: true, isArchived: true }],
			['with an unknown status', { id: 'emp-1', userId: 'first-user' }],
			['with a null archive status', { id: 'emp-1', userId: 'first-user', isActive: true, isArchived: null }]
		])('rejects a token carrying an employee that is %s', async (_label, employee) => {
			const { strategy, employeeService } = build();
			employeeService.findOneByIdString.mockResolvedValue(employee);

			const { err, user } = await run(strategy, { id: 'first-user', tenantId: 'tenant', employeeId: 'emp-1' });

			expect(err).toBeInstanceOf(UnauthorizedException);
			expect(user).toBeNull();
		});

		it('still authenticates a token carrying an active employee', async () => {
			const { strategy, employeeService } = build();
			employeeService.findOneByIdString.mockResolvedValue({
				id: 'emp-1',
				userId: 'first-user',
				isActive: true,
				isArchived: false
			});

			const { err, user } = await run(strategy, { id: 'first-user', tenantId: 'tenant', employeeId: 'emp-1' });

			expect(err).toBeNull();
			expect(user).toMatchObject({ id: 'first-user', employeeId: 'emp-1' });
		});
	});

	/**
	 * The `organizationId` claim is re-resolved against `user_organization` on every request, and an
	 * `employeeId` claim must belong to the organization the same token names.
	 */
	describe('organization claim', () => {
		it('rejects an organization the user is not a member of', async () => {
			const { strategy, userOrganizationService } = build();
			userOrganizationService.findOneByOptions.mockResolvedValue(null);

			const { err, user } = await run(strategy, {
				id: 'first-user',
				tenantId: 'tenant',
				organizationId: 'org-1'
			});

			expect(err).toBeInstanceOf(UnauthorizedException);
			expect(user).toBeNull();
		});

		it('rejects an employee that belongs to another organization', async () => {
			const { strategy, employeeService, userOrganizationService } = build();
			employeeService.findOneByIdString.mockResolvedValue({
				id: 'emp-1',
				userId: 'first-user',
				organizationId: 'org-2',
				isActive: true,
				isArchived: false
			});
			userOrganizationService.findOneByOptions.mockResolvedValue({ id: 'user-org-1' });

			const { err, user } = await run(strategy, {
				id: 'first-user',
				tenantId: 'tenant',
				employeeId: 'emp-1',
				organizationId: 'org-1'
			});

			expect(err).toBeInstanceOf(UnauthorizedException);
			expect(user).toBeNull();
			// The membership lookup runs concurrently and SUCCEEDS here, but its result is never consulted: the
			// claims contradict each other, and that is what refuses the token, as it always did.
			expect(err).toMatchObject({ message: 'Employee does not belong to the claimed organization' });
		});

		it('attaches the organization the user is an active member of', async () => {
			const { strategy, userOrganizationService } = build();
			userOrganizationService.findOneByOptions.mockResolvedValue({ id: 'user-org-1' });

			const { err, user } = await run(strategy, {
				id: 'first-user',
				tenantId: 'tenant',
				organizationId: 'org-1'
			});

			expect(err).toBeNull();
			expect(user).toMatchObject({ id: 'first-user', lastOrganizationId: 'org-1' });
			expect(userOrganizationService.findOneByOptions).toHaveBeenCalledWith({
				where: {
					userId: 'first-user',
					organizationId: 'org-1',
					tenantId: 'tenant',
					isActive: true,
					isArchived: false
				}
			});
		});
	});

	/**
	 * The employee and membership lookups are independent round trips, so they run concurrently — but their
	 * outcomes are still judged in the original order, so a token that fails several checks is refused with
	 * the same exception as before, whichever lookup happens to settle first.
	 */
	describe('employee and membership lookups', () => {
		const payload = { id: 'first-user', tenantId: 'tenant', employeeId: 'emp-1', organizationId: 'org-1' };
		const activeEmployee = {
			id: 'emp-1',
			userId: 'first-user',
			organizationId: 'org-1',
			isActive: true,
			isArchived: false
		};

		/** A promise that settles only when the test says so. */
		function deferred<T>() {
			let resolve!: (value: T) => void;
			let reject!: (reason: unknown) => void;
			const promise = new Promise<T>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			return { promise, resolve, reject };
		}

		it('issues both lookups before either one has answered', async () => {
			const { strategy, employeeService, userOrganizationService } = build();
			const employee = deferred<any>();
			const membership = deferred<any>();
			employeeService.findOneByIdString.mockReturnValue(employee.promise);
			userOrganizationService.findOneByOptions.mockReturnValue(membership.promise);

			const result = run(strategy, payload);
			await new Promise((resolve) => setImmediate(resolve));

			expect(employeeService.findOneByIdString).toHaveBeenCalledWith('emp-1');
			expect(userOrganizationService.findOneByOptions).toHaveBeenCalledWith({
				where: {
					userId: 'first-user',
					organizationId: 'org-1',
					tenantId: 'tenant',
					isActive: true,
					isArchived: false
				}
			});

			employee.resolve(activeEmployee);
			membership.resolve({ id: 'user-org-1' });
			const { err, user } = await result;
			expect(err).toBeNull();
			expect(user).toMatchObject({ employeeId: 'emp-1', lastOrganizationId: 'org-1' });
		});

		it('refuses with the employee check when both checks fail, even if the membership lookup fails first', async () => {
			const { strategy, employeeService, userOrganizationService } = build();
			const employee = deferred<any>();
			employeeService.findOneByIdString.mockReturnValue(employee.promise);
			// Settles (rejects, as the CRUD service does on a miss) before the employee lookup answers.
			userOrganizationService.findOneByOptions.mockRejectedValue(new Error('The requested record was not found'));

			const unhandled = jest.fn();
			process.on('unhandledRejection', unhandled);
			try {
				const result = run(strategy, payload);
				await new Promise((resolve) => setImmediate(resolve));
				employee.resolve({ ...activeEmployee, isActive: false });

				const { err, user } = await result;
				expect(user).toBeNull();
				// The deactivated-employee refusal (no description), not the wrapped membership miss.
				expect(err).toBeInstanceOf(UnauthorizedException);
				expect(err).toMatchObject({
					response: { statusCode: 401, message: 'unauthorized', error: 'Unauthorized' }
				});

				await new Promise((resolve) => setImmediate(resolve));
				expect(unhandled).not.toHaveBeenCalled();
			} finally {
				process.off('unhandledRejection', unhandled);
			}
		});

		it('propagates the employee lookup error when both lookups throw, whichever throws first', async () => {
			const { strategy, employeeService, userOrganizationService } = build();
			const employee = deferred<any>();
			employeeService.findOneByIdString.mockReturnValue(employee.promise);
			userOrganizationService.findOneByOptions.mockRejectedValue(new Error('membership lookup failed'));

			const result = run(strategy, payload);
			await new Promise((resolve) => setImmediate(resolve));
			employee.reject(new Error('employee lookup failed'));

			const { err } = await result;
			expect(err).toMatchObject({
				response: { statusCode: 401, message: 'unauthorized', error: 'Unauthorized' }
			});
		});

		it('refuses with the membership check when the employee passes', async () => {
			const { strategy, employeeService, userOrganizationService } = build();
			employeeService.findOneByIdString.mockResolvedValue(activeEmployee);
			userOrganizationService.findOneByOptions.mockResolvedValue(null);

			const { err } = await run(strategy, payload);
			expect(err).toMatchObject({ message: 'User does not have access to organization' });
		});

		it('does not look up a claim the token does not carry', async () => {
			const { strategy, employeeService, userOrganizationService } = build();
			employeeService.findOneByIdString.mockResolvedValue({ ...activeEmployee });

			const { err } = await run(strategy, { id: 'first-user', tenantId: 'tenant', employeeId: 'emp-1' });
			expect(err).toBeNull();
			expect(userOrganizationService.findOneByOptions).not.toHaveBeenCalled();

			const second = build();
			second.userOrganizationService.findOneByOptions.mockResolvedValue({ id: 'user-org-1' });
			await run(second.strategy, { id: 'first-user', tenantId: 'tenant', organizationId: 'org-1' });
			expect(second.employeeService.findOneByIdString).not.toHaveBeenCalled();
		});
	});

	/**
	 * A token that could not be judged because the database was unreachable is answered 503, not 401: a 401
	 * tells the client its valid token is bad, so it drops it and re-authenticates — during pool saturation,
	 * a refresh storm on top of the outage. Only errors positively identified as connection/pool/timeout
	 * failures are mapped; every refusal and every other error keeps its 401.
	 */
	describe('database outages', () => {
		const payload = { id: 'first-user', tenantId: 'tenant', employeeId: 'emp-1', organizationId: 'org-1' };
		const activeEmployee = {
			id: 'emp-1',
			userId: 'first-user',
			organizationId: 'org-1',
			isActive: true,
			isArchived: false
		};

		const adminShutdown = () => {
			const error = new DatabaseError('terminating connection due to administrator command', 0, 'error');
			error.code = '57P01';
			return error;
		};
		const outages: Array<[string, () => unknown]> = [
			['an exhausted pool', () => new Error('timeout exceeded when trying to connect')],
			[
				'a lost connection (TypeORM)',
				() => new QueryFailedError('SELECT 1', [], new Error('Connection terminated unexpectedly'))
			],
			['a server shutting down (57P01)', () => new QueryFailedError('SELECT 1', [], adminShutdown())],
			[
				'a refused connection',
				() =>
					Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), {
						code: 'ECONNREFUSED',
						syscall: 'connect'
					})
			]
		];

		/** A strategy whose every lookup succeeds for `payload`, with the one named lookup failing. */
		function buildFailing(lookup: string, error: unknown) {
			const built = build();
			built.employeeService.findOneByIdString.mockResolvedValue(activeEmployee);
			built.userOrganizationService.findOneByOptions.mockResolvedValue({ id: 'user-org-1' });
			const failing = {
				user: built.authService.getAuthenticatedUser,
				role: built.roleAuthorizationService.attachAuthorizationState,
				employee: built.employeeService.findOneByIdString,
				membership: built.userOrganizationService.findOneByOptions
			}[lookup] as jest.Mock;
			failing.mockRejectedValue(error);
			return built;
		}

		describe.each(['user', 'role', 'employee', 'membership'])('in the %s lookup', (lookup) => {
			it.each(outages)('answers %s with a 503 that names no driver detail', async (_label, outage) => {
				const { strategy } = buildFailing(lookup, outage());

				const exception = await strategy.validate(payload).catch((error) => error);
				expect(exception).toBeInstanceOf(ServiceUnavailableException);
				expect(exception.getStatus()).toBe(503);
				expect(exception.getResponse()).toEqual({
					statusCode: 503,
					message: DATABASE_UNAVAILABLE_MESSAGE,
					error: 'Service Unavailable'
				});
			});

			it('still answers any other failure with a 401', async () => {
				const { strategy } = buildFailing(lookup, new Error('database is down'));
				await expect(strategy.validate(payload)).rejects.toMatchObject({
					response: { statusCode: 401, message: 'unauthorized', error: 'Unauthorized' }
				});
			});
		});

		it('still answers a missing record with a 401', async () => {
			const { strategy } = buildFailing('employee', new NotFoundException('The requested record was not found'));
			await expect(strategy.validate(payload)).rejects.toMatchObject({
				response: { statusCode: 401, message: 'unauthorized', error: 'Unauthorized' }
			});
		});

		it('still refuses with a 401 when a check fails before the unreachable lookup is consulted', async () => {
			const { strategy, employeeService } = buildFailing(
				'membership',
				new Error('timeout exceeded when trying to connect')
			);
			employeeService.findOneByIdString.mockResolvedValue({ ...activeEmployee, isActive: false });

			await expect(strategy.validate(payload)).rejects.toMatchObject({
				response: { statusCode: 401, message: 'unauthorized', error: 'Unauthorized' }
			});
		});

		it('reports the 503 to passport once, as the error', async () => {
			const { strategy } = buildFailing('user', new Error('timeout exceeded when trying to connect'));
			const { err, user } = await run(strategy, payload);
			expect(err).toBeInstanceOf(ServiceUnavailableException);
			expect(user).toBeNull();
		});
	});

	/**
	 * GHSA-m8xc-8pwr-89fj — the request user is what every authorization check reads, so it must carry
	 * the role and permissions the user has NOW, not the ones their token was minted with.
	 */
	describe('database-fresh role and permissions (GHSA-m8xc-8pwr-89fj)', () => {
		it('pins the current role and permissions onto the request user', async () => {
			const { strategy, roleAuthorizationService } = build();

			// A token minted while the user was still a super admin.
			const { err, user } = await run(strategy, {
				id: 'first-user',
				tenantId: 'tenant',
				role: 'SUPER_ADMIN',
				permissions: ['SUPER_ADMIN_EDIT']
			});

			expect(err).toBeNull();
			expect(roleAuthorizationService.attachAuthorizationState).toHaveBeenCalledTimes(1);
			// ...resolves to what the database says today, never to the claims above.
			expect(user).toMatchObject({ role: { name: 'EMPLOYEE' }, permissions: ['ORG_TEAM_VIEW'] });
		});

		it('refuses the request when the role lookup fails (throws)', async () => {
			const { strategy, roleAuthorizationService } = build();
			roleAuthorizationService.attachAuthorizationState.mockRejectedValue(new Error('database is down'));

			const { err, user } = await run(strategy, { id: 'first-user', tenantId: 'tenant' });

			expect(err).toBeInstanceOf(UnauthorizedException);
			expect(user).toBeNull();
		});

		it('authenticates with no role and no permissions when the role does not resolve (returns null)', async () => {
			// The other fail-closed shape: the lookup succeeds but finds nothing (roleId NULL, role row
			// gone). The request is still authenticated — authorization is what fails, downstream.
			const { strategy, roleAuthorizationService } = build({ ...activeUser, roleId: null });
			roleAuthorizationService.attachAuthorizationState.mockImplementation(async (u: any) => {
				delete u.role;
				u.permissions = [];
				return u;
			});

			const { err, user } = await run(strategy, { id: 'first-user', tenantId: 'tenant', role: 'SUPER_ADMIN' });

			expect(err).toBeNull();
			expect((user as any).role).toBeUndefined();
			expect((user as any).permissions).toEqual([]);
		});
	});

	/**
	 * The `PassportStrategy` mixin calls passport's `done` with whatever `validate` returns or throws. A
	 * `validate` that also called `done` itself reported every request twice: passport-jwt turned the second
	 * report — `done(null, undefined)` — into `fail()`, and Nest's AuthGuard answered that by constructing
	 * and throwing an `UnauthorizedException` on every authenticated request, swallowed only because the
	 * guard's promise had already settled.
	 */
	describe('passport contract', () => {
		it('returns the authenticated user', async () => {
			const { strategy } = build();
			await expect(strategy.validate({ id: 'first-user', tenantId: 'tenant' })).resolves.toMatchObject({
				id: 'first-user'
			});
		});

		it.each([
			['a payload that names no user', { email: 'x@y.z' }, 'unauthorized'],
			['a purpose-typed token', { purpose: 'password-reset', id: 'first-user' }, 'unauthorized']
		])('throws the refusal for %s', async (_label, payload, message) => {
			const { strategy } = build();
			await expect(strategy.validate(payload)).rejects.toThrow(new UnauthorizedException(message));
		});

		it('throws the claim refusals exactly as they are built, not re-wrapped', async () => {
			const { strategy, employeeService, userOrganizationService } = build();
			employeeService.findOneByIdString.mockResolvedValue({
				id: 'emp-1',
				userId: 'first-user',
				organizationId: 'org-2',
				isActive: true,
				isArchived: false
			});
			userOrganizationService.findOneByOptions.mockResolvedValue(null);

			const crossOrganization = strategy.validate({
				id: 'first-user',
				tenantId: 'tenant',
				employeeId: 'emp-1',
				organizationId: 'org-1'
			});
			await expect(crossOrganization).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(crossOrganization).rejects.toMatchObject({
				response: { statusCode: 401, message: 'Employee does not belong to the claimed organization' }
			});

			const notAMember = strategy.validate({ id: 'first-user', tenantId: 'tenant', organizationId: 'org-1' });
			await expect(notAMember).rejects.toMatchObject({
				response: { statusCode: 401, message: 'User does not have access to organization' }
			});
		});

		it('turns a lookup that threw into a 401 carrying its message', async () => {
			const { strategy, authService } = build();
			authService.getAuthenticatedUser.mockRejectedValue(new Error('lookup failed'));

			const result = strategy.validate({ id: 'first-user', tenantId: 'tenant' });
			await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(result).rejects.toMatchObject({
				response: { statusCode: 401, message: 'unauthorized', error: 'Unauthorized' }
			});
		});

		it('reports a valid bearer token to passport as one success and nothing else', async () => {
			const { strategy } = build();
			const token = sign({ id: 'first-user', tenantId: 'tenant' }, environment.JWT_SECRET, {
				algorithm: 'HS256'
			});
			const reports: string[] = [];
			const settled = new Promise<void>((resolve) => {
				Object.assign(strategy, {
					success: () => (reports.push('success'), resolve()),
					fail: () => (reports.push('fail'), resolve()),
					error: () => (reports.push('error'), resolve())
				});
			});

			strategy.authenticate({ headers: { authorization: `Bearer ${token}` } } as any, {});
			await settled;
			// Give a second report — the one the old implicit `return undefined` produced — time to arrive.
			await new Promise((resolve) => setImmediate(resolve));

			expect(reports).toEqual(['success']);
		});

		it('reports a refused bearer token to passport as one error and nothing else', async () => {
			const { strategy } = build({ ...activeUser, isActive: false });
			const token = sign({ id: 'first-user', tenantId: 'tenant' }, environment.JWT_SECRET, {
				algorithm: 'HS256'
			});
			const reports: Array<[string, unknown?]> = [];
			const settled = new Promise<void>((resolve) => {
				Object.assign(strategy, {
					success: () => (reports.push(['success']), resolve()),
					fail: () => (reports.push(['fail']), resolve()),
					error: (err: unknown) => (reports.push(['error', err]), resolve())
				});
			});

			strategy.authenticate({ headers: { authorization: `Bearer ${token}` } } as any, {});
			await settled;
			await new Promise((resolve) => setImmediate(resolve));

			expect(reports).toHaveLength(1);
			expect(reports[0][0]).toBe('error');
			expect(reports[0][1]).toBeInstanceOf(UnauthorizedException);
		});
	});

	/**
	 * The database part of the judgement — the user row, its role and permissions, the employee and the
	 * membership — is reused for the next requests that carry the same claims (JWT_AUTHENTICATED_USER_TTL_MS),
	 * and concurrent requests with one token share a single lookup. A refusal is never reused.
	 */
	describe('module wiring', () => {
		it('is built by Nest with the module-wide cache', async () => {
			// The cache's constructor takes plain options: registered as a class provider, Nest tried to resolve them
			// as a dependency and the API did not start. The factory provider is what AuthModule registers.
			const moduleRef = await Test.createTestingModule({
				providers: [
					AuthenticatedUserCacheProvider,
					JwtStrategy,
					{ provide: AuthService, useValue: {} },
					{ provide: EmployeeService, useValue: {} },
					{ provide: UserOrganizationService, useValue: {} },
					{ provide: RoleAuthorizationService, useValue: {} }
				]
			}).compile();

			const strategy = moduleRef.get(JwtStrategy);
			const cache = moduleRef.get(AuthenticatedUserCache);
			expect(cache).toBeInstanceOf(AuthenticatedUserCache);
			expect((strategy as any).authenticatedUsers).toBe(cache);
		});
	});

	describe('validated context reuse', () => {
		const payload = { id: 'first-user', tenantId: 'tenant', employeeId: 'emp-1', organizationId: 'org-1' };
		const activeEmployee = {
			id: 'emp-1',
			userId: 'first-user',
			organizationId: 'org-1',
			isActive: true,
			isArchived: false
		};

		function buildReusing(user: any = { ...activeUser }, cache?: AuthenticatedUserCache) {
			const built = build(user, cache ?? new AuthenticatedUserCache({ ttlMs: 10_000, ormType: 'typeorm' }));
			built.employeeService.findOneByIdString.mockResolvedValue(activeEmployee);
			built.userOrganizationService.findOneByOptions.mockResolvedValue({ id: 'user-org-1' });
			return built;
		}

		it('judges the second request with the same claims without touching the database', async () => {
			const { strategy, authService, employeeService, userOrganizationService, roleAuthorizationService } =
				buildReusing();

			const first = await run(strategy, payload);
			const second = await run(strategy, payload);

			expect(first.err).toBeNull();
			expect(second.err).toBeNull();
			expect(second.user).toEqual(first.user);
			expect(second.user).toMatchObject({
				id: 'first-user',
				employeeId: 'emp-1',
				lastOrganizationId: 'org-1',
				role: { name: 'EMPLOYEE' },
				permissions: ['ORG_TEAM_VIEW']
			});
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(1);
			expect(roleAuthorizationService.attachAuthorizationState).toHaveBeenCalledTimes(1);
			expect(employeeService.findOneByIdString).toHaveBeenCalledTimes(1);
			expect(userOrganizationService.findOneByOptions).toHaveBeenCalledTimes(1);
		});

		it('gives each request its own request user', async () => {
			const { strategy } = buildReusing();
			const first = await run(strategy, payload);
			const second = await run(strategy, payload);
			expect(second.user).not.toBe(first.user);
		});

		it('shares one lookup between concurrent requests carrying the same token', async () => {
			const { strategy, authService } = buildReusing();

			const outcomes = await Promise.all([
				strategy.validate(payload),
				strategy.validate(payload),
				strategy.validate(payload)
			]);

			expect(outcomes.map((user) => user.id)).toEqual(['first-user', 'first-user', 'first-user']);
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(1);
		});

		it('judges a token that names another organization or employee on its own', async () => {
			const { strategy, authService } = buildReusing();
			await run(strategy, payload);
			await run(strategy, { ...payload, organizationId: 'org-2' });
			await run(strategy, { ...payload, employeeId: undefined });
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(3);
		});

		it('never reuses a refusal: a reactivated account is served at once', async () => {
			const { strategy, authService } = buildReusing({ ...activeUser, isActive: false });

			const refused = await run(strategy, payload);
			expect(refused.err).toBeInstanceOf(UnauthorizedException);

			authService.getAuthenticatedUser.mockResolvedValue({ ...activeUser });
			const served = await run(strategy, payload);
			expect(served.err).toBeNull();
			expect(served.user).toMatchObject({ id: 'first-user' });
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(2);
		});

		it('never reuses a token refused for its employee or membership claim', async () => {
			const { strategy, authService, employeeService } = buildReusing();
			employeeService.findOneByIdString.mockResolvedValueOnce({ ...activeEmployee, isActive: false });

			const refused = await run(strategy, payload);
			expect(refused.err).toBeInstanceOf(UnauthorizedException);

			const served = await run(strategy, payload);
			expect(served.err).toBeNull();
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(2);
		});

		it('never reuses a lookup that failed: the next request is judged again', async () => {
			const { strategy, authService } = buildReusing();
			authService.getAuthenticatedUser.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'));

			const failed = await run(strategy, payload);
			expect(failed.err).toBeInstanceOf(ServiceUnavailableException);

			const served = await run(strategy, payload);
			expect(served.err).toBeNull();
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(2);
		});

		it('judges every request against the database when the reuse is off', async () => {
			const { strategy, authService } = buildReusing(
				{ ...activeUser },
				new AuthenticatedUserCache({ ttlMs: 0, ormType: 'typeorm' })
			);
			await run(strategy, payload);
			await run(strategy, payload);
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(2);
		});

		it('judges the claims that need no database on every request, before any reuse', async () => {
			const { strategy, authService } = buildReusing();
			await run(strategy, payload);
			const { err } = await run(strategy, { ...payload, purpose: 'password-reset' });
			expect(err).toBeInstanceOf(UnauthorizedException);
			expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(1);
		});
	});
});
