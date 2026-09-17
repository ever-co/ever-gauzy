import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';

// Only DI metadata and the ORM switch are needed; the real modules drag in the whole core entity
// graph, which cannot be required in isolation (pre-existing circular import).
jest.mock('../../employee/repository/type-orm-employee.repository', () => ({
	TypeOrmEmployeeRepository: class TypeOrmEmployeeRepository {}
}));
jest.mock('../../employee/repository/mikro-orm-employee.repository', () => ({
	MikroOrmEmployeeRepository: class MikroOrmEmployeeRepository {}
}));
jest.mock('../../core/utils', () => ({
	getORMType: () => 'typeorm',
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' }
}));

import { RequestContext } from '../../core/context';
import { OrganizationPermissionGuard } from './organization-permission.guard';

/**
 * GHSA-m8xc-8pwr-89fj — OrganizationPermissionGuard now branches on the role the user holds in the
 * database (attached to `request.user` by JwtStrategy). When that role cannot be resolved,
 * `RequestContext.currentRoleName()` is null, and `null !== EMPLOYEE` used to send the request into the
 * permissive non-employee branch. A check that cannot reach a verdict must deny.
 */
describe('OrganizationPermissionGuard', () => {
	/** Builds a guard whose route declares `permissions`, for a request authenticated as `user`. */
	function build(user: unknown, permissions: PermissionsEnum[] = [PermissionsEnum.ALLOW_DELETE_TIME]) {
		const store = new Map<string, unknown>();

		RequestContext.setClsService({
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
		} as any);
		store.set(RequestContext.name, new RequestContext({ req: { headers: {}, user } as any }));

		const cacheManager = { get: jest.fn(async () => null), set: jest.fn(async () => undefined) };
		const reflector = { getAllAndOverride: jest.fn(() => permissions) };
		const guard = new OrganizationPermissionGuard(cacheManager as any, reflector as any, {} as any, {} as any);
		const checkOrganizationPermission = jest
			.spyOn(guard, 'checkOrganizationPermission')
			.mockResolvedValue(false);
		const context = { getHandler: () => jest.fn(), getClass: () => jest.fn() } as any;

		return { guard, context, checkOrganizationPermission, cacheManager };
	}

	afterEach(() => {
		RequestContext.setClsService(undefined as any);
	});

	it.each([
		['a user whose role no longer resolves', { id: 'user-1', roleId: 'role-gone', permissions: [] }],
		['a user with no role at all', { id: 'user-1', roleId: null, permissions: [] }],
		['a user whose role object carries no name', { id: 'user-1', roleId: 'role-1', role: { id: 'role-1' } }]
	])('denies %s instead of taking the non-employee branch', async (_label, user) => {
		const { guard, context, checkOrganizationPermission } = build(user);

		await expect(guard.canActivate(context)).resolves.toBe(false);
		expect(checkOrganizationPermission).not.toHaveBeenCalled();
	});

	it('denies an unauthenticated request', async () => {
		const { guard, context } = build(undefined);
		await expect(guard.canActivate(context)).resolves.toBe(false);
	});

	it('checks the organization permission for an employee', async () => {
		const { guard, context, checkOrganizationPermission } = build({
			id: 'user-1',
			tenantId: 'tenant-1',
			employeeId: 'emp-1',
			role: { id: 'role-employee', name: RolesEnum.EMPLOYEE }
		});

		await expect(guard.canActivate(context)).resolves.toBe(false);
		expect(checkOrganizationPermission).toHaveBeenCalledWith('tenant-1', 'emp-1', [
			PermissionsEnum.ALLOW_DELETE_TIME
		]);
	});

	it('keeps authorizing a resolved non-employee role (unchanged behaviour)', async () => {
		const { guard, context, checkOrganizationPermission } = build({
			id: 'user-1',
			tenantId: 'tenant-1',
			role: { id: 'role-manager', name: RolesEnum.MANAGER }
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(checkOrganizationPermission).not.toHaveBeenCalled();
	});

	it('allows a route that declares no permissions', async () => {
		const { guard, context } = build({ id: 'user-1' }, []);
		await expect(guard.canActivate(context)).resolves.toBe(true);
	});
});
