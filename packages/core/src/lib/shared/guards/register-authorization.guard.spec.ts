import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { sign } from 'jsonwebtoken';

// Only DI metadata and the ORM switch are needed; the real modules drag in the whole core entity
// graph, which cannot be required in isolation (pre-existing circular import).
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
jest.mock('../../core/utils', () => ({
	getORMType: () => 'typeorm',
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' }
}));

import { RequestContext } from '../../core/context';
import { RegisterAuthorizationGuard } from './register-authorization.guard';

/**
 * `POST /auth/register` is @Public(), so JwtStrategy never runs for it and this guard is the only thing
 * that authenticates an administrator creating a user with an assigned role. It used to take that
 * decision from the token's `role` and `tenantId` claims (GHSA-m8xc-8pwr-89fj) and never re-read the
 * account at all (GHSA-3cgp-wmrg-4fqg), so a demoted or deactivated admin kept the privilege until
 * their token expired. It now resolves the caller from the database and publishes that DB-fresh state
 * on `request.user`, which is what AuthRegisterHandler's SUPER_ADMIN_EDIT check then reads.
 */
describe('RegisterAuthorizationGuard', () => {
	/** A token minted while the caller was still a super admin. Signed with the real secret. */
	const staleSuperAdminToken = sign(
		{
			id: 'caller-1',
			tenantId: 'tenant-1',
			role: RolesEnum.SUPER_ADMIN,
			permissions: [PermissionsEnum.SUPER_ADMIN_EDIT]
		},
		env.JWT_SECRET
	);

	const superAdminState = {
		role: { id: 'role-sa', name: RolesEnum.SUPER_ADMIN, tenantId: 'tenant-1' },
		permissions: [PermissionsEnum.SUPER_ADMIN_EDIT]
	};

	const employeeState = {
		role: { id: 'role-employee', name: RolesEnum.EMPLOYEE, tenantId: 'tenant-1' },
		permissions: [PermissionsEnum.PROFILE_EDIT]
	};

	function build(caller: unknown, state: unknown) {
		const typeOrmUserRepository = { findOne: jest.fn(async () => caller) };
		const roleAuthorizationService = { getAuthorizationState: jest.fn(async () => state) };
		const typeOrmRoleRepository = {
			findOneByOrFail: jest.fn(async () => ({ id: 'role-target', tenantId: 'tenant-1' }))
		};
		const mikroOrmRoleRepository = { findOneOrFail: jest.fn() };
		const typeOrmOrganizationRepository = { findOneByOrFail: jest.fn() };
		const mikroOrmOrganizationRepository = { findOneOrFail: jest.fn() };
		// The guard resolves the user repository lazily through the module reference (see findCaller).
		const moduleRef = { get: jest.fn(() => typeOrmUserRepository) };

		const guard = new RegisterAuthorizationGuard(
			typeOrmRoleRepository as any,
			mikroOrmRoleRepository as any,
			typeOrmOrganizationRepository as any,
			mikroOrmOrganizationRepository as any,
			roleAuthorizationService as any,
			moduleRef as any
		);

		return { guard, typeOrmUserRepository, roleAuthorizationService };
	}

	/**
	 * A registration request that assigns a role, i.e. one carrying privileged fields. The guard reads
	 * the bearer token through RequestContext, which RequestContextMiddleware populates before any
	 * guard runs, so the cls store is installed here too.
	 */
	function context(body: Record<string, unknown>, token: string | null = staleSuperAdminToken) {
		const request = {
			body,
			headers: token ? { authorization: `Bearer ${token}` } : {}
		};

		const store = new Map<string, unknown>();
		RequestContext.setClsService({
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
		} as any);
		store.set(RequestContext.name, new RequestContext({ req: request as any }));

		return {
			request,
			executionContext: { switchToHttp: () => ({ getRequest: () => request }) } as any
		};
	}

	afterEach(() => {
		RequestContext.setClsService(undefined as any);
	});

	const activeSuperAdmin = { id: 'caller-1', tenantId: 'tenant-1', roleId: 'role-sa', isActive: true, isArchived: false };

	/**
	 * GHSA-28wv-vrxj-rp4q — a password-reset token is signed with the same secret and carries the
	 * account `id`, so for a real super admin it used to pass as that admin's access token.
	 */
	it('refuses a non-access token (password reset) that names a super admin', async () => {
		const resetToken = sign({ purpose: 'password-reset', id: 'caller-1', tenantId: 'tenant-1' }, env.JWT_SECRET);

		// CONTROL: the same request with the admin's access token is authorized, so only the token
		// type makes the difference below.
		const control = build(activeSuperAdmin, superAdminState);
		await expect(
			control.guard.canActivate(
				context({ user: { email: 'new@ever.co', roleId: 'role-target' } }).executionContext
			)
		).resolves.toBe(true);

		const { guard, typeOrmUserRepository } = build(activeSuperAdmin, superAdminState);
		const { executionContext } = context({ user: { email: 'new@ever.co', roleId: 'role-target' } }, resetToken);

		await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
		expect(typeOrmUserRepository.findOne).not.toHaveBeenCalled();
	});

	it('refuses an access token signed with a non-HS256 algorithm', async () => {
		const hs512 = sign({ id: 'caller-1', tenantId: 'tenant-1' }, env.JWT_SECRET, { algorithm: 'HS512' });
		const { guard } = build(activeSuperAdmin, superAdminState);
		const { executionContext } = context({ user: { email: 'new@ever.co', roleId: 'role-target' } }, hs512);

		await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('lets pure public self-registration through untouched', async () => {
		const { guard, typeOrmUserRepository } = build(activeSuperAdmin, superAdminState);
		const { executionContext } = context({ user: { email: 'new@ever.co' } }, null);

		await expect(guard.canActivate(executionContext)).resolves.toBe(true);
		expect(typeOrmUserRepository.findOne).not.toHaveBeenCalled();
	});

	it('authorizes a caller who is still a super admin, and publishes their DB state on the request', async () => {
		const { guard, roleAuthorizationService } = build(activeSuperAdmin, superAdminState);
		// A spoofed createdByUserId in the body must be overwritten with the authenticated caller.
		const { request, executionContext } = context({
			user: { email: 'new@ever.co', roleId: 'role-target' },
			createdByUserId: 'attacker-id'
		});

		await expect(guard.canActivate(executionContext)).resolves.toBe(true);
		expect(roleAuthorizationService.getAuthorizationState).toHaveBeenCalledWith('role-sa');
		expect((request as any).user).toEqual({
			id: 'caller-1',
			tenantId: 'tenant-1',
			roleId: 'role-sa',
			role: superAdminState.role,
			permissions: superAdminState.permissions
		});
		// Never trust the body's createdByUserId.
		expect((request.body as any).createdByUserId).toBe('caller-1');
	});

	it('refuses a caller demoted to EMPLOYEE whose token still claims SUPER_ADMIN', async () => {
		const { guard } = build({ ...activeSuperAdmin, roleId: 'role-employee' }, employeeState);
		const { executionContext } = context({ user: { email: 'new@ever.co', roleId: 'role-target' } });

		await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it.each([
		['deactivated', { ...activeSuperAdmin, isActive: false }],
		['archived', { ...activeSuperAdmin, isArchived: true }],
		['with a null archive status', { ...activeSuperAdmin, isArchived: null }],
		['with an undefined archive status', { ...activeSuperAdmin, isArchived: undefined }],
		// The repository answers null for a missing row, and for a soft-deleted one (@DeleteDateColumn).
		['missing', null]
	])('refuses a caller that is %s, holding a still-valid token', async (_label, caller) => {
		const { guard, roleAuthorizationService } = build(caller, superAdminState);
		const { executionContext } = context({ user: { email: 'new@ever.co', roleId: 'role-target' } });

		await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
		expect(roleAuthorizationService.getAuthorizationState).not.toHaveBeenCalled();
	});

	it('refuses a caller whose role cannot be resolved', async () => {
		const { guard } = build(activeSuperAdmin, null);
		const { executionContext } = context({ user: { email: 'new@ever.co', roleId: 'role-target' } });

		await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('still refuses an unauthenticated privileged registration', async () => {
		const { guard } = build(activeSuperAdmin, superAdminState);
		const { executionContext } = context({ user: { email: 'new@ever.co', roleId: 'role-target' } }, null);

		await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(ForbiddenException);
	});
});
