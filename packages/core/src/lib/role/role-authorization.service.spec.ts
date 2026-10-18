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
		['a disabled role permission', { enabled: false }],
		['a deactivated role permission', { isActive: false }],
		['an archived role permission', { isArchived: true }],
		['a role permission whose enabled state is unknown', { enabled: undefined }],
		['a role permission whose active state is unknown', { isActive: null }],
		['a role permission whose archived state is unknown', { isArchived: null }]
	])('drops %s', async (_label, overrides) => {
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

	describe('concurrent misses of one role', () => {
		/** A repository whose `findOne` resolves only when the test says so, to hold several callers in the miss. */
		function buildSlow(role: unknown) {
			let release: () => void = () => undefined;
			const gate = new Promise<void>((resolve) => (release = resolve));
			const { service, typeOrmRoleRepository, cacheManager } = build(role);
			typeOrmRoleRepository.findOne.mockImplementation(async () => {
				await gate;
				return role;
			});
			return { service, typeOrmRoleRepository, cacheManager, release: () => release() };
		}

		it('run the role query once and all receive its state', async () => {
			const { service, typeOrmRoleRepository, cacheManager, release } = buildSlow({
				id: 'role-1',
				name: RolesEnum.EMPLOYEE,
				rolePermissions: [rolePermission(PermissionsEnum.ORG_TEAM_VIEW)]
			});

			const pending = Promise.all([1, 2, 3, 4, 5].map(() => service.getAuthorizationState('role-1')));
			// Every caller has passed the cache miss and is waiting on the one load.
			await new Promise((resolve) => setImmediate(resolve));
			expect(typeOrmRoleRepository.findOne).toHaveBeenCalledTimes(1);

			release();
			const states = await pending;

			expect(states.every((state) => state === states[0])).toBe(true);
			expect(states[0]?.permissions).toEqual([PermissionsEnum.ORG_TEAM_VIEW]);
			expect(cacheManager.set).toHaveBeenCalledTimes(1);
			// The next miss (after the TTL) loads again: nothing is left in flight.
			expect((service as any).loading.size).toBe(0);
		});

		it('are independent per role', async () => {
			const { service, typeOrmRoleRepository, release } = buildSlow({ id: 'role-1', rolePermissions: [] });

			const pending = Promise.all([
				service.getAuthorizationState('role-1'),
				service.getAuthorizationState('role-2')
			]);
			await new Promise((resolve) => setImmediate(resolve));
			expect(typeOrmRoleRepository.findOne).toHaveBeenCalledTimes(2);

			release();
			await pending;
			expect((service as any).loading.size).toBe(0);
		});

		it('all see the failure of the shared load, and the next call loads again', async () => {
			const { service, typeOrmRoleRepository } = build(null);
			typeOrmRoleRepository.findOne
				.mockRejectedValueOnce(new Error('database is away'))
				.mockResolvedValueOnce({ id: 'role-1', name: RolesEnum.ADMIN, rolePermissions: [] });

			const results = await Promise.allSettled([
				service.getAuthorizationState('role-1'),
				service.getAuthorizationState('role-1')
			]);

			expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
			expect((service as any).loading.size).toBe(0);
			await expect(service.getAuthorizationState('role-1')).resolves.toMatchObject({
				role: { name: RolesEnum.ADMIN }
			});
		});
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

		it('removes a role the user already carried when the current role cannot be resolved', async () => {
			const { service } = build(null);
			// A role object already on the user (an eager relation, or one set earlier in the request),
			// while the roleId it now points at no longer resolves.
			const user: any = {
				id: 'user-1',
				roleId: 'role-gone',
				role: { id: 'role-sa', name: RolesEnum.SUPER_ADMIN },
				permissions: [PermissionsEnum.SUPER_ADMIN_EDIT]
			};

			await service.attachAuthorizationState(user);

			expect(user.role).toBeUndefined();
			expect(user.permissions).toEqual([]);
		});
	});
});
