import '../core/entities/internal';

import { UnauthorizedException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';
import { isPlaceholderAccount } from './placeholder-account';

/**
 * A member without an account (a placeholder, ever-co/ever-gauzy#11913) never signs in. Its user has no email and no
 * password, so no sign-in path finds it by email; and every path that ends with a session mints its access token in
 * `getJwtAccessToken` (password, email code, social, workspace pick, token refresh, API token exchange), which refuses
 * the account of a placeholder whatever the state of its records.
 */

const TENANT = '7e000000-0000-4000-8000-00000000000a';
const ORG_A = '7e000000-0000-4000-8000-0000000000a1';
const ORG_B = '7e000000-0000-4000-8000-0000000000a2';

const user = (id: string, lastOrganizationId: string) => ({
	id,
	email: null as string | null,
	tenantId: TENANT,
	lastOrganizationId,
	hash: null as string | null,
	isActive: true,
	isArchived: false
});

/** A member without an account in ORG_A. */
const AMINA = user('u-amina', ORG_A);
/** A member without an account whose record was archived: no active record is found for it. */
const ARCHIVED_PLACEHOLDER = user('u-archived-placeholder', ORG_A);
/** A member with an account in ORG_A. */
const MARIE = { ...user('u-marie', ORG_A), email: 'marie@ever.co', hash: 'stored-hash' };

const USERS = [AMINA, ARCHIVED_PLACEHOLDER, MARIE];

const employee = (
	id: string,
	userId: string,
	organizationId: string,
	state: { isActive: boolean; isArchived: boolean; isPlaceholder: boolean }
) => ({ id, userId, tenantId: TENANT, organizationId, ...state });

const EMPLOYEES = [
	employee('e-amina', AMINA.id, ORG_A, { isActive: true, isArchived: false, isPlaceholder: true }),
	employee('e-archived-placeholder', ARCHIVED_PLACEHOLDER.id, ORG_A, {
		isActive: true,
		isArchived: true,
		isPlaceholder: true
	}),
	employee('e-marie', MARIE.id, ORG_A, { isActive: true, isArchived: false, isPlaceholder: false })
];

/** Equality on every key of a TypeORM-style `where`. */
const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) => row[key] === value);

/** An AuthService over in-memory user and employee tables, with the REAL `getJwtAccessToken`. */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const generate = jest.fn(async (userId: string) => `access-for-${userId}`);
	const employeeRepository = {
		findOne: jest.fn(async ({ where }) => EMPLOYEES.find((row) => matches(row, where)) ?? null),
		find: jest.fn(async ({ where }) => EMPLOYEES.filter((row) => matches(row, where)))
	};
	const userService = {
		setCurrentRefreshToken: jest.fn(async () => undefined),
		setUserLastLoginTimestamp: jest.fn(async () => undefined),
		setLastOrganizationAndTeam: jest.fn(async () => undefined),
		hasActiveOrganizationMembership: jest.fn(async () => true),
		findFirstActiveOrganizationId: jest.fn(async () => null),
		replaceStaleLastOrganization: jest.fn(async () => undefined)
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
		accessTokenService: { generate },
		userService,
		getJwtRefreshToken: jest.fn(async (refreshed: { id: string }) => `refresh-for-${refreshed.id}`),
		rotateRefreshToken,
		resolveDefaultOrganizationId: jest.fn(async () => null),
		hasActiveOrganizationMembership: jest.fn(async () => false)
	});
	return { service, generate, employeeRepository, rotateRefreshToken };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.7');
	jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('jest');
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('isPlaceholderAccount', () => {
	it('is false for a user with no employee record, or with members that have an account', () => {
		expect(isPlaceholderAccount([])).toBe(false);
		expect(isPlaceholderAccount([{ isPlaceholder: false }, {}])).toBe(false);
	});

	it('is true as soon as one record is a member without an account', () => {
		expect(isPlaceholderAccount([{ isPlaceholder: false }, { isPlaceholder: true }])).toBe(true);
	});
});

describe('AuthService.getJwtAccessToken refuses a member without an account', () => {
	it('mints no token for a placeholder, with or without an organization', async () => {
		const { service, generate } = buildAuthService();

		await expect(service.getJwtAccessToken(AMINA, ORG_A)).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(service.getJwtAccessToken(AMINA)).rejects.toBeInstanceOf(UnauthorizedException);

		expect(generate).not.toHaveBeenCalled();
	});

	it('mints no token for a placeholder whose record is not the active one found', async () => {
		const { service, generate } = buildAuthService();

		await expect(service.getJwtAccessToken(ARCHIVED_PLACEHOLDER, ORG_A)).rejects.toBeInstanceOf(
			UnauthorizedException
		);
		await expect(service.getJwtAccessToken(AMINA, ORG_B)).rejects.toBeInstanceOf(UnauthorizedException);

		expect(generate).not.toHaveBeenCalled();
	});

	it('mints a token for a member with an account, without reading their other records', async () => {
		const { service, employeeRepository } = buildAuthService();

		await expect(service.getJwtAccessToken(MARIE, ORG_A)).resolves.toBe(`access-for-${MARIE.id}`);
		expect(employeeRepository.find).not.toHaveBeenCalled();
	});
});

describe('a token refresh refuses a member without an account', () => {
	it('POST /auth/refresh-token answers 401 and leaves the refresh token unrotated', async () => {
		const { service, generate, rotateRefreshToken } = buildAuthService();
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG_A);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(AMINA as never);

		await expect(service.rotateTokens('presented-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);

		expect(generate).not.toHaveBeenCalled();
		expect(rotateRefreshToken).not.toHaveBeenCalled();
	});
});
