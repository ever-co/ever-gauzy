import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';

// Only DI metadata is needed; the real modules drag in the whole core entity graph, which cannot be
// required in isolation (pre-existing circular import).
jest.mock('./role.entity', () => ({ Role: class Role {} }));
jest.mock('./repository/type-orm-role.repository', () => ({
	TypeOrmRoleRepository: class TypeOrmRoleRepository {}
}));
jest.mock('./repository/mikro-orm-role.repository', () => ({
	MikroOrmRoleRepository: class MikroOrmRoleRepository {}
}));
jest.mock('../core/utils', () => ({
	getORMType: () => 'typeorm',
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	parseTypeORMFindToMikroOrm: (options: any) => ({ where: options.where, mikroOptions: {} })
}));

import { RoleAuthorizationService } from './role-authorization.service';

/**
 * GHSA-m8xc-8pwr-89fj — this is the lookup that replaces the `role` / `permissions` claims of the
 * access token. It has to be fail-closed (no role resolved means no role and no permissions) and it
 * must grant exactly the permissions `RolePermissionService.checkRolePermission` would grant, so that
 * what lands on `request.user` never exceeds what PermissionGuard allows.
 */
describe('RoleAuthorizationService', () => {
	const rolePermission = (permission: PermissionsEnum, overrides: Record<string, unknown> = {}) => ({
		permission,
		enabled: true,
		isActive: true,
		isArchived: false,
		...overrides
	});

	function build(role: unknown) {
		const typeOrmRoleRepository = { findOne: jest.fn(async () => role) };
		const mikroOrmRoleRepository = { findOne: jest.fn(async () => role) };
		const cache = new Map<string, unknown>();
		const cacheManager = {
			get: jest.fn(async (key: string) => cache.get(key)),
			set: jest.fn(async (key: string, value: unknown) => {
				cache.set(key, value);
			})
		};

		const service = new RoleAuthorizationService(
			typeOrmRoleRepository as any,
			mikroOrmRoleRepository as any,
			cacheManager as any
		);

		return { service, typeOrmRoleRepository, cacheManager };
	}

	it('resolves the role name and its enabled permissions', async () => {
		const { service } = build({
			id: 'role-1',
			name: RolesEnum.EMPLOYEE,
			tenantId: 'tenant-1',
			rolePermissions: [
				rolePermission(PermissionsEnum.ORG_TEAM_VIEW),
				rolePermission(PermissionsEnum.PROFILE_EDIT)
			]
		});

		const state = await service.getAuthorizationState('role-1');

		expect(state?.role).toEqual({ id: 'role-1', name: RolesEnum.EMPLOYEE, tenantId: 'tenant-1' });
		expect(state?.permissions).toEqual([PermissionsEnum.ORG_TEAM_VIEW, PermissionsEnum.PROFILE_EDIT]);
	});

	it.each([
		['disabled', { enabled: false }],
		['deactivated', { isActive: false }],
		['archived', { isArchived: true }],
		['of unknown enabled state', { enabled: undefined }],
		['of unknown active state', { isActive: null }],
		['of unknown archived state', { isArchived: null }]
	])('drops a %s role permission', async (_label, overrides) => {
		const { service } = build({
			id: 'role-1',
			name: RolesEnum.EMPLOYEE,
			rolePermissions: [rolePermission(PermissionsEnum.SUPER_ADMIN_EDIT, overrides)]
		});

		const state = await service.getAuthorizationState('role-1');

		expect(state?.permissions).toEqual([]);
	});

	it('fails closed when the role id is missing', async () => {
		const { service, typeOrmRoleRepository } = build(null);

		await expect(service.getAuthorizationState(undefined as any)).resolves.toBeNull();
		await expect(service.getAuthorizationState(null as any)).resolves.toBeNull();
		// Never turn a missing id into a lookup: `findOne({ where: { id: undefined } })` matches the
		// first row in the table (see TYPEORM_NULL_WHERE_ISOLATION).
		expect(typeOrmRoleRepository.findOne).not.toHaveBeenCalled();
	});

	it('fails closed when the role no longer exists', async () => {
		const { service } = build(null);
		await expect(service.getAuthorizationState('role-1')).resolves.toBeNull();
	});

	it('caches the resolved state per role', async () => {
		const { service, typeOrmRoleRepository } = build({
			id: 'role-1',
			name: RolesEnum.ADMIN,
			rolePermissions: []
		});

		await service.getAuthorizationState('role-1');
		await service.getAuthorizationState('role-1');

		expect(typeOrmRoleRepository.findOne).toHaveBeenCalledTimes(1);
	});

	it('still resolves when the cache is unavailable', async () => {
		const { service } = build({ id: 'role-1', name: RolesEnum.ADMIN, rolePermissions: [] });
		(service as any).cacheManager = {
			get: jest.fn(async () => {
				throw new Error('cache is down');
			}),
			set: jest.fn(async () => {
				throw new Error('cache is down');
			})
		};

		await expect(service.getAuthorizationState('role-1')).resolves.toMatchObject({
			role: { name: RolesEnum.ADMIN }
		});
	});

	describe('attachAuthorizationState', () => {
		it('pins the role and permissions onto the user', async () => {
			const { service } = build({
				id: 'role-1',
				name: RolesEnum.EMPLOYEE,
				rolePermissions: [rolePermission(PermissionsEnum.ORG_TEAM_VIEW)]
			});

			// A user object as it arrives from the database, plus the claims its token carried.
			const user: any = { id: 'user-1', roleId: 'role-1', role: { name: RolesEnum.SUPER_ADMIN } };

			await service.attachAuthorizationState(user);

			expect(user.role).toMatchObject({ name: RolesEnum.EMPLOYEE });
			expect(user.permissions).toEqual([PermissionsEnum.ORG_TEAM_VIEW]);
		});

		it('leaves a user without permissions when the role cannot be resolved', async () => {
			const { service } = build(null);
			const user: any = { id: 'user-1', roleId: 'role-gone' };

			await service.attachAuthorizationState(user);

			expect(user.permissions).toEqual([]);
			expect(user.role).toBeUndefined();
		});
	});
});
