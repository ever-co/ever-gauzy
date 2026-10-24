import '../core/entities/internal';

import { UnauthorizedException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';
import { isDeactivatedEmployee } from './deactivated-employee';

/**
 * A deactivated employee cannot sign in to Gauzy (owner decision 6, core follow-up of ever-co/ever-gauzy#11324).
 *
 * `login()` and `workspaceSigninVerifyToken()` meant to refuse an inactive employee, but they asked
 * `EmployeeService.findOneByUserId`, which reads ACTIVE records only: a deactivated employee read as "no
 * employee" and signed in like an admin. The rule is now judged on ALL of the user's employee records, once,
 * where every access token is minted (`getJwtAccessToken`): a user whose records are all inactive or archived
 * is refused; a user with no record, or with one still active in another organization, is not.
 */

const TENANT_A = '6e000000-0000-4000-8000-00000000000a';
const TENANT_B = '6e000000-0000-4000-8000-00000000000b';
const ORG_A = '6e000000-0000-4000-8000-0000000000a1';
const ORG_B = '6e000000-0000-4000-8000-0000000000a2';
const ORG_C = '6e000000-0000-4000-8000-0000000000b1';

const user = (id: string, email: string, tenantId: string, lastOrganizationId: string) => ({
	id,
	email,
	tenantId,
	lastOrganizationId,
	hash: 'stored-hash',
	isActive: true,
	isArchived: false
});

/** Deactivated in one organization, archived in the other: no active record left. */
const DEACTIVATED = user('u-deactivated', 'gone@ever.co', TENANT_A, ORG_A);
/** Deactivated in ORG_A, still active in ORG_B. */
const MOVED = user('u-moved', 'moved@ever.co', TENANT_A, ORG_A);
/** An active employee of ORG_A. */
const ACTIVE = user('u-active', 'active@ever.co', TENANT_A, ORG_A);
/** No employee record at all: a tenant admin. */
const ADMIN = user('u-admin', 'admin@ever.co', TENANT_A, ORG_A);
/** The same person in two tenants: a deactivated employee in A, an admin in B. */
const PAT_IN_A = user('u-pat-a', 'pat@ever.co', TENANT_A, ORG_A);
const PAT_IN_B = user('u-pat-b', 'pat@ever.co', TENANT_B, ORG_C);

const USERS = [DEACTIVATED, MOVED, ACTIVE, ADMIN, PAT_IN_A, PAT_IN_B];

const employee = (id: string, userId: string, organizationId: string, isActive: boolean, isArchived: boolean) => ({
	id,
	userId,
	tenantId: TENANT_A,
	organizationId,
	isActive,
	isArchived
});

const EMPLOYEES = [
	employee('e-deactivated-a', DEACTIVATED.id, ORG_A, false, false),
	employee('e-deactivated-b', DEACTIVATED.id, ORG_B, true, true),
	employee('e-moved-a', MOVED.id, ORG_A, false, false),
	employee('e-moved-b', MOVED.id, ORG_B, true, false),
	employee('e-active-a', ACTIVE.id, ORG_A, true, false),
	employee('e-pat-a', PAT_IN_A.id, ORG_A, false, false)
];

/** Equality on every key of a TypeORM-style `where`. */
const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) => row[key] === value);

/**
 * An AuthService over in-memory user and employee tables, with the REAL `getJwtAccessToken`. Only the
 * collaborators these paths touch are wired; `generate` records each access token minted.
 */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const generate = jest.fn(async (userId: string) => `access-for-${userId}`);
	const attempt = {
		fail: jest.fn(async () => undefined),
		succeed: jest.fn(async () => undefined),
		release: jest.fn(async () => undefined)
	};
	const employeeRepository = {
		findOne: jest.fn(async ({ where }) => EMPLOYEES.find((row) => matches(row, where)) ?? null),
		find: jest.fn(async ({ where }) => EMPLOYEES.filter((row) => matches(row, where)))
	};
	const userService = {
		// login(): every active account with that email, most recently updated first.
		find: jest.fn(async ({ where }) => USERS.filter((row) => row.email === where.email)),
		setCurrentRefreshToken: jest.fn(async () => undefined),
		setUserLastLoginTimestamp: jest.fn(async () => undefined),
		setLastOrganizationAndTeam: jest.fn(async () => undefined)
	};
	const rotateRefreshToken = jest.fn(async (_token: string, refreshed: { id: string }) => `rotated-${refreshed.id}`);

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		typeOrmUserRepository: {
			findOne: jest.fn(async ({ where }) => USERS.find((row) => matches(row, where)) ?? null),
			findOneOrFail: jest.fn(async ({ where }) => {
				const found = USERS.find((row) => matches(row, where));
				if (!found) throw new Error('EntityNotFound');
				return found;
			})
		},
		typeOrmEmployeeRepository: employeeRepository,
		// What the sign-in paths used to ask: ACTIVE records only, so a deactivated employee reads as none.
		employeeService: {
			findOneByUserId: jest.fn(
				async (userId: string) =>
					EMPLOYEES.find((row) => row.userId === userId && row.isActive && !row.isArchived) ?? null
			)
		},
		accessTokenService: { generate },
		loginAttemptService: { begin: jest.fn(async () => attempt) },
		passwordHashService: { verify: jest.fn(async () => true), needsRehash: jest.fn(() => false) },
		userService,
		getJwtRefreshToken: jest.fn(async (refreshed: { id: string }) => `refresh-for-${refreshed.id}`),
		rotateRefreshToken,
		resolveDefaultOrganizationId: jest.fn(async () => null),
		hasActiveOrganizationMembership: jest.fn(async () => false)
	});
	return { service, generate, attempt, employeeRepository, userService, rotateRefreshToken };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.7');
	jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('jest');
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('isDeactivatedEmployee', () => {
	it('is false for a user with no employee record (an admin, a viewer)', () => {
		expect(isDeactivatedEmployee([])).toBe(false);
	});

	it.each([
		['inactive', [{ isActive: false, isArchived: false }]],
		['archived', [{ isActive: true, isArchived: true }]],
		[
			'inactive in one organization and archived in another',
			[
				{ isActive: false, isArchived: false },
				{ isActive: true, isArchived: true }
			]
		]
	])('is true when every record is %s', (_label, records) => {
		expect(isDeactivatedEmployee(records)).toBe(true);
	});

	it('is false while one record is still active and unarchived', () => {
		expect(
			isDeactivatedEmployee([
				{ isActive: false, isArchived: false },
				{ isActive: true, isArchived: false }
			])
		).toBe(false);
	});
});

describe('AuthService.getJwtAccessToken refuses a deactivated employee', () => {
	it('mints no token for a user whose employee records are all inactive or archived', async () => {
		const { service, generate } = buildAuthService();

		await expect(service.getJwtAccessToken(DEACTIVATED, ORG_A)).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(service.getJwtAccessToken(DEACTIVATED)).rejects.toBeInstanceOf(UnauthorizedException);

		expect(generate).not.toHaveBeenCalled();
	});

	it('mints a token for an employee still active in another organization', async () => {
		const { service, generate } = buildAuthService();

		await expect(service.getJwtAccessToken(MOVED, ORG_A)).resolves.toBe(`access-for-${MOVED.id}`);
		expect(generate).toHaveBeenCalledTimes(1);
	});

	it('mints a token for a user with no employee record', async () => {
		const { service } = buildAuthService();

		await expect(service.getJwtAccessToken(ADMIN, ORG_A)).resolves.toBe(`access-for-${ADMIN.id}`);
	});

	it('does not read the other records when the active employee is found', async () => {
		const { service, employeeRepository } = buildAuthService();

		await expect(service.getJwtAccessToken(ACTIVE, ORG_A)).resolves.toBe(`access-for-${ACTIVE.id}`);
		expect(employeeRepository.find).not.toHaveBeenCalled();
	});

	it('refuses rather than mints when the employee records cannot be read', async () => {
		const { service, generate, employeeRepository } = buildAuthService();
		employeeRepository.find.mockRejectedValueOnce(new Error('connection terminated'));

		await expect(service.getJwtAccessToken(ADMIN, ORG_A)).rejects.toBeInstanceOf(UnauthorizedException);
		expect(generate).not.toHaveBeenCalled();
	});
});

describe('AuthService.login (POST /auth/login)', () => {
	it('refuses a deactivated employee with the right password — CONTROL: the old check read them as no employee', async () => {
		const { service, generate, employeeRepository } = buildAuthService();

		// CONTROL: the check `login()` used to rely on finds no employee to judge.
		await expect((service as any).employeeService.findOneByUserId(DEACTIVATED.id)).resolves.toBeNull();

		await expect(service.login({ email: DEACTIVATED.email, password: 'right' })).rejects.toBeInstanceOf(
			UnauthorizedException
		);
		expect(employeeRepository.find).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: DEACTIVATED.id } })
		);
		expect(generate).not.toHaveBeenCalled();
	});

	it('signs in an employee still active in another organization', async () => {
		const { service } = buildAuthService();

		const result = await service.login({ email: MOVED.email, password: 'right' });

		expect(result.token).toBe(`access-for-${MOVED.id}`);
	});

	it("picks the person's other account when the most recent one is a deactivated employee", async () => {
		const { service, generate } = buildAuthService();

		const result = await service.login({ email: PAT_IN_A.email, password: 'right' });

		expect(result.user.id).toBe(PAT_IN_B.id);
		expect(result.token).toBe(`access-for-${PAT_IN_B.id}`);
		expect(generate).toHaveBeenCalledTimes(1);
	});
});

describe('AuthService.workspaceSigninVerifyToken (POST /auth/signin.workspace)', () => {
	it('refuses a deactivated employee holding a valid workspace token', async () => {
		const { service, generate } = buildAuthService();
		const token = (service as any).generateToken({ ...DEACTIVATED, tenant: { id: TENANT_A } }, 'ABC123');

		await expect(
			service.workspaceSigninVerifyToken({ email: DEACTIVATED.email, token } as any)
		).rejects.toBeInstanceOf(UnauthorizedException);
		expect(generate).not.toHaveBeenCalled();
	});

	it('signs in an active employee with the same kind of token', async () => {
		const { service } = buildAuthService();
		const token = (service as any).generateToken({ ...ACTIVE, tenant: { id: TENANT_A } }, 'ABC123');

		const result = await service.workspaceSigninVerifyToken({ email: ACTIVE.email, token } as any);

		expect(result.token).toBe(`access-for-${ACTIVE.id}`);
	});
});

describe('token refresh refuses a deactivated employee', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG_A);
	});

	it('POST /auth/refresh-token (rotateTokens) answers 401 and leaves the refresh token unrotated', async () => {
		const { service, generate, rotateRefreshToken, userService } = buildAuthService();
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(DEACTIVATED as any);

		await expect(service.rotateTokens('presented-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);

		expect(generate).not.toHaveBeenCalled();
		expect(rotateRefreshToken).not.toHaveBeenCalled();
		expect(userService.setCurrentRefreshToken).not.toHaveBeenCalled();
	});

	it('getAccessTokenFromRefreshToken answers 401', async () => {
		const { service, generate } = buildAuthService();
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(DEACTIVATED as any);

		await expect(service.getAccessTokenFromRefreshToken()).rejects.toBeInstanceOf(UnauthorizedException);
		expect(generate).not.toHaveBeenCalled();
	});

	it('still refreshes an employee active in another organization', async () => {
		const { service } = buildAuthService();
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(MOVED as any);

		await expect(service.rotateTokens('presented-refresh-token')).resolves.toEqual({
			token: `access-for-${MOVED.id}`,
			refresh_token: `rotated-${MOVED.id}`
		});
	});
});
