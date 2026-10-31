import { ForbiddenException } from '@nestjs/common';
import { environment as env, IAuthSwitches } from '@gauzy/config';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { sign } from 'jsonwebtoken';

// Only DI metadata and the ORM switch are needed; the real modules drag in the whole core entity graph, which cannot
// be required in isolation (pre-existing circular import). Same stand-ins as register-authorization.guard.spec.ts.
jest.mock('../../role/repository/type-orm-role.repository', () => ({
	TypeOrmRoleRepository: class TypeOrmRoleRepository {}
}));
jest.mock('../../role/repository/mikro-orm-role.repository', () => ({
	MikroOrmRoleRepository: class MikroOrmRoleRepository {}
}));
jest.mock('../../role/role-authorization.service', () => ({
	RoleAuthorizationService: class RoleAuthorizationService {}
}));
jest.mock('../../organization/repository/type-orm-organization.repository', () => ({
	TypeOrmOrganizationRepository: class TypeOrmOrganizationRepository {}
}));
jest.mock('../../organization/repository/mikro-orm-organization.repository', () => ({
	MikroOrmOrganizationRepository: class MikroOrmOrganizationRepository {}
}));
jest.mock('../../user/repository/type-orm-user.repository', () => ({
	TypeOrmUserRepository: class TypeOrmUserRepository {}
}));
jest.mock('../../user/repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../../tenant/repository/type-orm-tenant.repository', () => ({
	TypeOrmTenantRepository: class TypeOrmTenantRepository {}
}));
jest.mock('../../tenant/repository/mikro-orm-tenant.repository', () => ({
	MikroOrmTenantRepository: class MikroOrmTenantRepository {}
}));
jest.mock('../../core/utils', () => ({
	getORMType: () => 'typeorm',
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' }
}));

import { RequestContext } from '../../core/context';
import { RegisterAuthorizationGuard } from '../../shared/guards/register-authorization.guard';
import { signPurposeToken, TokenPurposeEnum } from '../purpose-token';
import { RegistrationPolicyService, SELF_REGISTRATION_DISABLED_MESSAGE } from './registration-policy.service';
import { SelfRegistrationGuard } from './self-registration.guard';

/**
 * #5784: `POST /auth/register` runs `RegisterAuthorizationGuard` and then `SelfRegistrationGuard`. Both run here for
 * real (with the real `RegistrationPolicyService`), over stand-in repositories, the way the route chains them.
 *
 * While registration is closed, an administrator's token lets a user be created even without privileged fields (which
 * `RegisterAuthorizationGuard` alone does not authenticate); a missing, bad or non-administrator token does not. With
 * registration open nothing changes: no token is read.
 */

const switches = env as unknown as { authSwitches: IAuthSwitches };
const OPEN: IAuthSwitches = { userRegistration: true, tenantsRegistration: true, adminPasswordReset: true };
const CLOSED: IAuthSwitches = { ...OPEN, userRegistration: false };

const ADMIN = { id: 'admin-1', tenantId: 'tenant-1', roleId: 'role-admin', isActive: true, isArchived: false };
const ADMIN_STATE = {
	role: { id: 'role-admin', name: RolesEnum.ADMIN, tenantId: 'tenant-1' },
	permissions: [PermissionsEnum.ORG_USERS_EDIT]
};
const EMPLOYEE_STATE = {
	role: { id: 'role-employee', name: RolesEnum.EMPLOYEE, tenantId: 'tenant-1' },
	permissions: [PermissionsEnum.PROFILE_EDIT]
};

const accessToken = (id = ADMIN.id) => sign({ id, tenantId: 'tenant-1', role: RolesEnum.ADMIN }, env.JWT_SECRET);

/** A tenant-less sign-up body: no privileged field, so RegisterAuthorizationGuard does not authenticate it. */
const signup = () => ({
	user: { email: 'new.person@corp.test', firstName: 'New' },
	password: 'pw',
	confirmPassword: 'pw'
});

function build({ caller = ADMIN as unknown, state = ADMIN_STATE as unknown } = {}) {
	const typeOrmUserRepository = { findOne: jest.fn(async () => caller) };
	const roleAuthorizationService = { getAuthorizationState: jest.fn(async () => state) };
	const registerAuthorization = new RegisterAuthorizationGuard(
		{ findOneByOrFail: jest.fn() } as never,
		{ findOneOrFail: jest.fn() } as never,
		{ findOneByOrFail: jest.fn() } as never,
		{ findOneOrFail: jest.fn() } as never,
		roleAuthorizationService as never,
		{ get: jest.fn(() => typeOrmUserRepository) } as never
	);
	const tenantTable = { exists: jest.fn(async () => true) };
	const policy = new RegistrationPolicyService(tenantTable as never, { count: jest.fn() } as never);
	const selfRegistration = new SelfRegistrationGuard(policy, registerAuthorization);
	return { registerAuthorization, selfRegistration, typeOrmUserRepository, tenantTable };
}

/** A request as the route receives it, with RequestContext populated as RequestContextMiddleware does. */
function request(body: Record<string, unknown>, authorization?: string) {
	const req: { body: Record<string, unknown>; headers: Record<string, string>; user?: unknown } = {
		body,
		headers: authorization ? { authorization } : {}
	};
	const store = new Map<string, unknown>();
	RequestContext.setClsService({
		get: (key: string) => store.get(key),
		set: (key: string, value: unknown) => store.set(key, value)
	} as never);
	store.set(RequestContext.name, new RequestContext({ req: req as never }));
	return { req, context: { switchToHttp: () => ({ getRequest: () => req }) } as never };
}

/** Runs the route's two guards in order, as `@UseGuards(RegisterAuthorizationGuard, SelfRegistrationGuard, …)`. */
async function runGuards(guards: ReturnType<typeof build>, context: never): Promise<boolean> {
	return (
		(await guards.registerAuthorization.canActivate(context)) &&
		(await guards.selfRegistration.canActivate(context))
	);
}

let previousSwitches: IAuthSwitches;

beforeEach(() => {
	previousSwitches = switches.authSwitches;
	switches.authSwitches = { ...OPEN };
});

afterEach(() => {
	switches.authSwitches = previousSwitches;
	RequestContext.setClsService(undefined as never);
});

describe('RegisterAuthorizationGuard + SelfRegistrationGuard — registration closed', () => {
	beforeEach(() => {
		switches.authSwitches = { ...CLOSED };
	});

	it('lets an administrator’s token create a user without privileged fields, attaching nothing', async () => {
		const guards = build();
		const { req, context } = request(signup(), `Bearer ${accessToken()}`);

		await expect(runGuards(guards, context)).resolves.toBe(true);
		// The account is read from the database, and the request stays as an open registration would see it.
		expect(guards.typeOrmUserRepository.findOne).toHaveBeenCalledWith({ where: { id: ADMIN.id } });
		expect(req.user).toBeUndefined();
	});

	it('refuses a sign-up without a token', async () => {
		const { context } = request(signup());

		await expect(runGuards(build(), context)).rejects.toThrow(
			new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE)
		);
	});

	it.each([
		['signed with another secret', sign({ id: ADMIN.id }, 'not-the-secret')],
		['expired', sign({ id: ADMIN.id, exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET)],
		[
			'a password-reset token',
			signPurposeToken(
				TokenPurposeEnum.PASSWORD_RESET,
				{ id: ADMIN.id, tenantId: 'tenant-1' },
				{ expiresIn: '10m' }
			)
		],
		['not a JWT', 'garbage']
	])('treats a token %s as anonymous: 403', async (_case, token) => {
		const guards = build();
		const { context } = request(signup(), `Bearer ${token}`);

		await expect(runGuards(guards, context)).rejects.toThrow(
			new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE)
		);
	});

	it('refuses the token of an account that is not an administrator', async () => {
		const { context } = request(signup(), `Bearer ${accessToken()}`);

		await expect(runGuards(build({ state: EMPLOYEE_STATE }), context)).rejects.toThrow(
			new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE)
		);
	});

	it.each([
		['deactivated', { ...ADMIN, isActive: false }],
		['archived', { ...ADMIN, isArchived: true }],
		['deleted', null]
	])('refuses the token of a %s administrator', async (_case, caller) => {
		const { context } = request(signup(), `Bearer ${accessToken()}`);

		await expect(runGuards(build({ caller }), context)).rejects.toThrow(
			new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE)
		);
	});
});

describe('RegisterAuthorizationGuard + SelfRegistrationGuard — registration open (the default)', () => {
	it('lets a sign-up without a token through, as before', async () => {
		const guards = build();
		const { context } = request(signup());

		await expect(runGuards(guards, context)).resolves.toBe(true);
		expect(guards.tenantTable.exists).not.toHaveBeenCalled();
	});

	it('does not read a token on a body without privileged fields, as before', async () => {
		const guards = build();
		const { req, context } = request(signup(), 'Bearer garbage');

		await expect(runGuards(guards, context)).resolves.toBe(true);
		expect(guards.typeOrmUserRepository.findOne).not.toHaveBeenCalled();
		expect(req.user).toBeUndefined();
	});
});
