/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before the services (and the repositories they import) are evaluated.
 */
import '../core/entities/internal';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { MultiORMEnum } from '../core/utils';
import { CrudService } from '../core/crud/crud.service';
import { TenantRoleBulkCreateCommand } from '../role/commands/tenant-role-bulk-create.command';
import { TenantRoleBulkCreateHandler } from '../role/commands/handlers/tenant-role-bulk-create.handler';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermissionService } from './role-permission.service';

/**
 * Completing the roles and permissions of a tenant an earlier, failed onboarding created.
 *
 * Such a tenant may hold some of its rows: the role step may have run, and migrations add permission rows to
 * every tenant (e.g. `GrantManagerTaskSettingAndAvailabilityPermissions`). Re-running the plain role step would
 * duplicate every role and hit the `(tenantId, roleId, permission)` unique index; the `onlyMissing` mode adds
 * only what is missing and leaves every existing row and its `enabled` flag alone.
 */

const TENANT = { id: '11111111-1111-4111-8111-111111111111' } as any;
const ADMIN = { id: 'role-admin', name: RolesEnum.ADMIN };
const EMPLOYEE = { id: 'role-employee', name: RolesEnum.EMPLOYEE };

function buildRolePermissionService(held: Array<{ roleId: string; permission: string }>) {
	const service: any = Object.create(RolePermissionService.prototype);
	service._roleService = { findAll: jest.fn(async () => ({ items: [ADMIN, EMPLOYEE] })) };
	service.find = jest.fn(async () => held.map((row) => ({ ...row })));
	service.typeOrmRepository = { save: jest.fn(async (rows: any[]) => rows) };
	return service as RolePermissionService & Record<string, any>;
}

const allPermissions = Object.values(PermissionsEnum);

beforeEach(() => {
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
});

afterEach(() => jest.restoreAllMocks());

describe('RolePermissionService.updateRolesAndPermissions', () => {
	it('writes every default permission of every role, without reading existing rows, by default', async () => {
		const service = buildRolePermissionService([]);

		const rows = await service.updateRolesAndPermissions([TENANT]);

		expect(service.find).not.toHaveBeenCalled();
		expect(rows).toHaveLength(2 * allPermissions.length);
	});

	it('adds only the (role, permission) pairs the tenant is missing, soft-deleted rows counted as held', async () => {
		const held = [
			{ roleId: ADMIN.id, permission: PermissionsEnum.ORG_TASK_SETTING },
			{ roleId: EMPLOYEE.id, permission: PermissionsEnum.ORG_EXPENSES_VIEW }
		];
		const service = buildRolePermissionService(held);

		const rows = await service.updateRolesAndPermissions([TENANT], { onlyMissing: true });

		expect(service.find).toHaveBeenCalledWith({ where: { tenantId: TENANT.id }, withDeleted: true });
		expect(rows).toHaveLength(2 * allPermissions.length - held.length);
		const written = new Set(rows.map((row) => `${row.roleId}:${row.permission}`));
		for (const { roleId, permission } of held) {
			expect(written.has(`${roleId}:${permission}`)).toBe(false);
		}
	});

	it('gives each added row the default enabled flag of its role', async () => {
		const service = buildRolePermissionService([]);

		const rows = await service.updateRolesAndPermissions([TENANT], { onlyMissing: true });

		const defaults = DEFAULT_ROLE_PERMISSIONS.find(
			({ role }) => role === RolesEnum.EMPLOYEE
		).defaultEnabledPermissions;
		for (const row of rows.filter((r) => r.roleId === EMPLOYEE.id)) {
			expect(row.enabled).toBe(defaults.includes(row.permission as PermissionsEnum));
		}
	});
});

describe('TenantRoleBulkCreateHandler', () => {
	function buildHandler(heldRoles: Array<{ name: RolesEnum }>) {
		const roleService = {
			find: jest.fn(async () => heldRoles),
			createBulk: jest.fn(async (tenants: any[], names: RolesEnum[] = Object.values(RolesEnum)) =>
				names.map((name) => ({ id: `role-${name}`, name, tenant: tenants[0] }))
			)
		};
		const rolePermissionService = { updateRolesAndPermissions: jest.fn(async () => []) };
		const handler = new TenantRoleBulkCreateHandler(roleService as any, rolePermissionService as any);
		return { handler, roleService, rolePermissionService };
	}

	it('creates every default role and its permissions for a new tenant', async () => {
		const { handler, roleService, rolePermissionService } = buildHandler([]);

		await handler.execute(new TenantRoleBulkCreateCommand([TENANT]));

		expect(roleService.find).not.toHaveBeenCalled();
		expect(roleService.createBulk).toHaveBeenCalledWith([TENANT]);
		expect(rolePermissionService.updateRolesAndPermissions).toHaveBeenCalledWith([TENANT], { onlyMissing: false });
	});

	it('creates only the roles an unfinished tenant does not hold, withdrawn ones counted as held', async () => {
		const { handler, roleService, rolePermissionService } = buildHandler([
			{ name: RolesEnum.SUPER_ADMIN },
			{ name: RolesEnum.ADMIN }
		]);

		const created = await handler.execute(new TenantRoleBulkCreateCommand([TENANT], { onlyMissing: true }));

		expect(roleService.find).toHaveBeenCalledWith({ where: { tenantId: TENANT.id }, withDeleted: true });
		const missing = Object.values(RolesEnum).filter(
			(name) => name !== RolesEnum.SUPER_ADMIN && name !== RolesEnum.ADMIN
		);
		expect(roleService.createBulk).toHaveBeenCalledWith([TENANT], missing);
		expect(created.map((role) => role.name)).toEqual(missing);
		expect(rolePermissionService.updateRolesAndPermissions).toHaveBeenCalledWith([TENANT], { onlyMissing: true });
	});

	it('creates no role when the tenant holds them all, and still completes the permissions', async () => {
		const { handler, roleService, rolePermissionService } = buildHandler(
			Object.values(RolesEnum).map((name) => ({ name }))
		);

		await expect(
			handler.execute(new TenantRoleBulkCreateCommand([TENANT], { onlyMissing: true }))
		).resolves.toEqual([]);

		expect(roleService.createBulk).not.toHaveBeenCalled();
		expect(rolePermissionService.updateRolesAndPermissions).toHaveBeenCalledWith([TENANT], { onlyMissing: true });
	});
});
