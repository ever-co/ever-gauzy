// Must stay first: loads the entity graph before the services pull an entity.
import '../core/entities/internal';

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { RequestContext } from '../core/context';
import { EmailResetService } from '../email-reset/email-reset.service';
import { TenantApiKeyController } from '../tenant-api-key/tenant-api-key.controller';
import { TenantApiKeyService } from '../tenant-api-key/tenant-api-key.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { assertFirstPartyRequest } from './oauth-app-first-party';
import { OAuthClientService } from './oauth-client/oauth-client.service';
import { USER_API_TOKEN_CLAIM } from './user-api-token/user-api-token-session';

/**
 * What an API token is exchanged for: an ordinary access token, minted by the code every sign-in mints through, for an
 * owner who is judged by the rules of a sign-in at every exchange, so that a removed person's token stops at once.
 */

const TENANT_A = '7b000000-0000-4000-8000-00000000000a';
const TENANT_B = '7b000000-0000-4000-8000-00000000000b';
const ORG_A = '7b000000-0000-4000-8000-0000000000a1';
const ORG_B = '7b000000-0000-4000-8000-0000000000a2';
const ORG_C = '7b000000-0000-4000-8000-0000000000a3';
const API_TOKEN_ID = '7b000000-0000-4000-8000-00000000ffff';

const person = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	email: `${id}@ever.co`,
	tenantId: TENANT_A,
	lastOrganizationId: ORG_A,
	isActive: true,
	isArchived: false,
	...overrides
});

const employee = (id: string, userId: string, organizationId: string, isActive = true, isArchived = false) => ({
	id,
	userId,
	tenantId: TENANT_A,
	organizationId,
	isActive,
	isArchived
});

const member = (userId: string, organizationId: string) => ({
	userId,
	organizationId,
	tenantId: TENANT_A,
	isActive: true,
	isArchived: false,
	createdAt: new Date(0)
});

/** Equality on every key of a TypeORM-style `where`. */
const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) => row[key] === value);

function build(world: { users?: any[]; employees?: any[]; memberships?: any[] }) {
	const users = world.users ?? [];
	const employees = world.employees ?? [];
	const memberships = world.memberships ?? [];

	const generate = jest.fn(async (_userId: string, _payload: any, _expiresAt?: Date) => 'an-access-token');
	const setCurrentRefreshToken = jest.fn();
	const setUserLastLoginTimestamp = jest.fn();

	const service = Object.create(AuthService.prototype);
	Object.assign(service, {
		logger: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
		ormType: 'typeorm',
		typeOrmUserRepository: { findOne: async ({ where }: any) => users.find((row) => matches(row, where)) ?? null },
		typeOrmEmployeeRepository: {
			find: async ({ where }: any) => employees.filter((row) => matches(row, where)),
			findOne: async ({ where }: any) => employees.find((row) => matches(row, where)) ?? null
		},
		accessTokenService: { generate },
		userOrganizationService: {
			findOneByOptions: async ({ where }: any) => {
				const found = memberships.find((row) => matches(row, where));
				if (!found) throw new Error('not found');
				return found;
			}
		},
		userService: {
			setCurrentRefreshToken,
			setUserLastLoginTimestamp,
			hasActiveOrganizationMembership: async (userId: string, organizationId: string, tenantId: string) =>
				memberships.some((row) => matches(row, { userId, organizationId, tenantId, isActive: true, isArchived: false })),
			findFirstActiveOrganizationId: async (userId: string, tenantId: string) =>
				memberships.find((row) => matches(row, { userId, tenantId, isActive: true, isArchived: false }))?.organizationId ?? null,
			replaceStaleLastOrganization: async () => undefined
		}
	});

	return { service: service as AuthService, generate, setCurrentRefreshToken, setUserLastLoginTimestamp };
}

const expiresAt = new Date(Date.now() + 3600_000);

const exchange = (service: AuthService, userId: string, overrides: Record<string, unknown> = {}) =>
	service.issueUserApiTokenSession({ userId, tenantId: TENANT_A, apiTokenId: API_TOKEN_ID, expiresAt, ...overrides });

describe('AuthService.issueUserApiTokenSession', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentIp').mockReturnValue('127.0.0.1');
		jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('agent');
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('mints an ordinary access token', () => {
		it('with the claims a sign-in gives, the API token claim, and the expiry asked for', async () => {
			const user = person('u1');
			const { service, generate } = build({
				users: [user],
				employees: [employee('e1', 'u1', ORG_A)],
				memberships: [member('u1', ORG_A)]
			});

			await expect(exchange(service, 'u1')).resolves.toBe('an-access-token');

			const [userId, payload, expiry] = generate.mock.calls[0];
			expect(userId).toBe('u1');
			expect(payload).toMatchObject({
				id: 'u1',
				tenantId: TENANT_A,
				organizationId: ORG_A,
				employeeId: 'e1',
				[USER_API_TOKEN_CLAIM]: API_TOKEN_ID
			});
			expect(expiry).toBe(expiresAt);
		});

		it('never touches the user’s own sessions: no refresh token, no last-login write', async () => {
			const { service, setCurrentRefreshToken, setUserLastLoginTimestamp } = build({
				users: [person('u1')],
				memberships: [member('u1', ORG_A)]
			});

			await exchange(service, 'u1');

			expect(setCurrentRefreshToken).not.toHaveBeenCalled();
			expect(setUserLastLoginTimestamp).not.toHaveBeenCalled();
		});

		it('works for an admin with no employee record', async () => {
			const { service, generate } = build({ users: [person('admin')], memberships: [member('admin', ORG_A)] });

			await exchange(service, 'admin');

			expect(generate.mock.calls[0][1]).toMatchObject({ organizationId: ORG_A, employeeId: null });
		});
	});

	describe('chooses the organization', () => {
		it('the one asked for, when the user is an active member of it', async () => {
			const { service, generate } = build({
				users: [person('u1')],
				memberships: [member('u1', ORG_A), member('u1', ORG_B)]
			});

			await exchange(service, 'u1', { organizationId: ORG_B });

			expect(generate.mock.calls[0][1].organizationId).toBe(ORG_B);
		});

		it('refuses one the user is not a member of', async () => {
			const { service, generate } = build({ users: [person('u1')], memberships: [member('u1', ORG_A)] });

			await expect(exchange(service, 'u1', { organizationId: ORG_C })).rejects.toThrow(UnauthorizedException);
			expect(generate).not.toHaveBeenCalled();
		});

		it('refuses one the employee was ended in, even with the membership still there', async () => {
			const { service, generate } = build({
				users: [person('u1')],
				employees: [employee('e-a', 'u1', ORG_A, false, true), employee('e-b', 'u1', ORG_B)],
				memberships: [member('u1', ORG_A), member('u1', ORG_B)]
			});

			await expect(exchange(service, 'u1', { organizationId: ORG_A })).rejects.toThrow(UnauthorizedException);
			expect(generate).not.toHaveBeenCalled();
		});

		it('the stored one when none is asked for', async () => {
			const { service, generate } = build({
				users: [person('u1', { lastOrganizationId: ORG_B })],
				memberships: [member('u1', ORG_A), member('u1', ORG_B)]
			});

			await exchange(service, 'u1');

			expect(generate.mock.calls[0][1].organizationId).toBe(ORG_B);
		});

		it('moves off a stored one the employee was ended in, to where they still work', async () => {
			const { service, generate } = build({
				users: [person('u1', { lastOrganizationId: ORG_A })],
				employees: [employee('e-a', 'u1', ORG_A, false, true), employee('e-b', 'u1', ORG_B)],
				memberships: [member('u1', ORG_A), member('u1', ORG_B)]
			});

			await exchange(service, 'u1');

			expect(generate.mock.calls[0][1]).toMatchObject({ organizationId: ORG_B, employeeId: 'e-b' });
		});

		it('the first active membership when nothing is stored', async () => {
			const { service, generate } = build({
				users: [person('u1', { lastOrganizationId: null })],
				memberships: [member('u1', ORG_C)]
			});

			await exchange(service, 'u1');

			expect(generate.mock.calls[0][1].organizationId).toBe(ORG_C);
		});

		it('no organization for a user with none, as a sign-in gives them', async () => {
			const { service, generate } = build({ users: [person('u1', { lastOrganizationId: null })] });

			await exchange(service, 'u1');

			expect(generate.mock.calls[0][1].organizationId).toBeNull();
		});
	});

	describe('refuses an owner a sign-in would refuse', () => {
		it.each([
			['deactivated', { isActive: false }],
			['archived', { isArchived: true }],
			['with an unknown status', { isActive: null }]
		])('a user who is %s', async (_how, overrides) => {
			const { service, generate } = build({ users: [person('u1', overrides)], memberships: [member('u1', ORG_A)] });

			await expect(exchange(service, 'u1')).rejects.toThrow(UnauthorizedException);
			expect(generate).not.toHaveBeenCalled();
		});

		it('a user who no longer exists (deleted, or soft-deleted: the repository does not return them)', async () => {
			const { service, generate } = build({ users: [] });

			await expect(exchange(service, 'u1')).rejects.toThrow(UnauthorizedException);
			expect(generate).not.toHaveBeenCalled();
		});

		it('a user of another tenant than the token', async () => {
			const { service, generate } = build({ users: [person('u1', { tenantId: TENANT_B })] });

			await expect(exchange(service, 'u1')).rejects.toThrow(UnauthorizedException);
			expect(generate).not.toHaveBeenCalled();
		});

		it.each([
			['deactivated', false, false],
			['ended (inactive and archived)', false, true],
			['archived', true, true]
		])('an employee who is %s everywhere', async (_how, isActive, isArchived) => {
			const { service, generate } = build({
				users: [person('u1')],
				employees: [employee('e1', 'u1', ORG_A, isActive, isArchived)],
				memberships: [member('u1', ORG_A)]
			});

			await expect(exchange(service, 'u1')).rejects.toThrow(UnauthorizedException);
			expect(generate).not.toHaveBeenCalled();
		});

		it('does not refuse an employee ended in one organization and active in another', async () => {
			const { service, generate } = build({
				users: [person('u1', { lastOrganizationId: ORG_B })],
				employees: [employee('e-a', 'u1', ORG_A, false, true), employee('e-b', 'u1', ORG_B)],
				memberships: [member('u1', ORG_B)]
			});

			await expect(exchange(service, 'u1')).resolves.toBe('an-access-token');
			expect(generate).toHaveBeenCalledTimes(1);
		});
	});
});

describe('a session that came from an API token is not the user’s own session', () => {
	const asApiTokenSession = () =>
		jest
			.spyOn(RequestContext, 'currentToken')
			.mockReturnValue(sign({ id: 'u1', tenantId: TENANT_A, [USER_API_TOKEN_CLAIM]: API_TOKEN_ID }, 'secret'));

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('an ordinary session passes, with or without other claims', () => {
		expect(() => assertFirstPartyRequest('Anything')).not.toThrow();

		jest.spyOn(RequestContext, 'currentToken').mockReturnValue(sign({ id: 'u1', tenantId: TENANT_A }, 'secret'));
		expect(() => assertFirstPartyRequest('Anything')).not.toThrow();
	});

	it('such a session is refused, and the message names what was tried', () => {
		asApiTokenSession();

		expect(() => assertFirstPartyRequest('Switching organization')).toThrow(ForbiddenException);
		expect(() => assertFirstPartyRequest('Switching organization')).toThrow(/Switching organization/);
	});

	/**
	 * A refresh token rotates for ever, so a session that could mint one would outlive the API token it came from.
	 * These are every route that mints first-party tokens from an authenticated session.
	 */
	it.each([
		['switching workspace', (service: AuthService) => service.switchWorkspace('t')],
		['switching organization', (service: AuthService) => service.switchOrganization('o')],
		['listing workspaces with their sign-in tokens', (service: AuthService) => service.getUserWorkspaces(false)]
	])('%s is refused before anything is minted', async (_name, call) => {
		asApiTokenSession();
		const generate = jest.fn();
		const service = Object.create(AuthService.prototype);
		Object.assign(service, { logger: { error: jest.fn() }, accessTokenService: { generate } });

		await expect(call(service)).rejects.toThrow(ForbiddenException);
		expect(generate).not.toHaveBeenCalled();
	});

	it('approving an application is refused', async () => {
		asApiTokenSession();
		const service = Object.create(AuthService.prototype);

		await expect(
			(service as AuthService).createOAuthAppAuthorizationCode({ userId: 'u1' } as any)
		).rejects.toThrow(ForbiddenException);
	});

	it.each([
		['asking to move the address', (service: EmailResetService) => service.requestChangeEmail({ email: 'new@ever.co' } as any, null)],
		['confirming the move', (service: EmailResetService) => service.verifyCode({ code: '123456' } as any)]
	])('%s is refused, and nothing answers "OK"', async (_name, call) => {
		asApiTokenSession();
		const service = Object.create(EmailResetService.prototype);

		await expect(call(service)).rejects.toThrow(ForbiddenException);
	});

	/** A credential made here keeps working after the API token is revoked and its session has ended. */
	it.each([
		['creating a tenant API key', () => Object.create(TenantApiKeyService.prototype).generateApiKey({ tenantId: TENANT_A })],
		['registering an OAuth client', () => Object.create(OAuthClientService.prototype).createClient({ name: 'x' })],
		['changing an OAuth client', () => Object.create(OAuthClientService.prototype).updateClient('id', {})],
		['rotating an OAuth client secret', () => Object.create(OAuthClientService.prototype).rotateSecret('id')]
	])('%s is refused', async (_name, call) => {
		asApiTokenSession();

		await expect(call()).rejects.toThrow(ForbiddenException);
	});

	it('the tenant key route answers that refusal, not a server error', async () => {
		asApiTokenSession();
		const controller = new TenantApiKeyController(Object.create(TenantApiKeyService.prototype));

		await expect(controller.generateKeyPair({ tenantId: TENANT_A } as any)).rejects.toThrow(ForbiddenException);
	});

	describe('setting a password or an address on the account', () => {
		const buildUserService = () => {
			const save = jest.fn(async (entity: any) => entity);
			const service = Object.create(UserService.prototype);
			Object.assign(service, {
				findOneByIdString: jest.fn(async () => ({
					id: 'u1',
					email: 'old@ever.co',
					role: { name: 'EMPLOYEE' }
				})),
				findOneByWhereOptions: jest.fn(async () => ({ id: 'u1' })),
				assertOrganizationPreferencesAreMemberships: jest.fn(async () => undefined),
				liftAgentRestrictionsOnMoveIntoEEAOrUK: jest.fn(async () => undefined),
				getPasswordHash: jest.fn(async () => 'hashed'),
				save,
				moveToUnconfirmedAddress: jest.fn(async () => undefined),
				publishEmailChanged: jest.fn()
			});
			return { service: service as UserService, save };
		};

		beforeEach(() => {
			jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role');
			jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('u1');
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		});

		it.each([
			['a new password', { hash: 'new-password' }],
			['clearing the password', { hash: null }],
			['blanking the password', { hash: '' }],
			['a new address', { email: 'new@ever.co' }]
		])('%s is refused for such a session', async (_what, body) => {
			asApiTokenSession();
			const { service, save } = buildUserService();

			await expect(service.updateProfile('u1', { ...body } as any)).rejects.toThrow(ForbiddenException);
			expect(save).not.toHaveBeenCalled();
		});

		it('another profile field is not', async () => {
			asApiTokenSession();
			const { service, save } = buildUserService();

			await service.updateProfile('u1', { firstName: 'Ann', email: 'old@ever.co' } as any);

			expect(save).toHaveBeenCalledTimes(1);
		});

		it('an ordinary session still sets both', async () => {
			jest.spyOn(RequestContext, 'currentToken').mockReturnValue(sign({ id: 'u1' }, 'secret'));
			const { service, save } = buildUserService();

			await service.updateProfile('u1', { hash: 'new-password', email: 'new@ever.co' } as any);

			expect(save).toHaveBeenCalledTimes(1);
		});
	});
});
