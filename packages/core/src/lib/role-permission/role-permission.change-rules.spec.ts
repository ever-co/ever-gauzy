import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RolePermissionService } from './role-permission.service';

/**
 * The role-permission rules hold on every write (SEC-A-07 = SEC-E-04).
 *
 * `createPermission` / `updatePermission` / `deletePermission` keep an ADMIN off the SUPER_ADMIN and ADMIN rows and a
 * SUPER_ADMIN off the SUPER_ADMIN rows. The inherited soft-delete pair skipped them, so an ADMIN could withdraw the
 * SUPER_ADMIN's `CHANGE_ROLES_PERMISSIONS` / `ALL_ORG_EDIT` rows and lock the owner out, or restore ADMIN rows a
 * SUPER_ADMIN had withdrawn; and `updatePermission` checked only the role a row was moved TO, so a SUPER_ADMIN row
 * could be "updated" to an EMPLOYEE row.
 *
 * The real service, with its reads and the base writes stubbed: what is tested is the decision.
 */

const ROLES = {
	super: { id: 'r-super', name: RolesEnum.SUPER_ADMIN },
	admin: { id: 'r-admin', name: RolesEnum.ADMIN },
	employee: { id: 'r-employee', name: RolesEnum.EMPLOYEE }
};
const ROWS: Record<string, { id: string; roleId: string; role: { name: RolesEnum } }> = {
	'p-super': { id: 'p-super', roleId: ROLES.super.id, role: ROLES.super },
	'p-admin': { id: 'p-admin', roleId: ROLES.admin.id, role: ROLES.admin },
	'p-employee': { id: 'p-employee', roleId: ROLES.employee.id, role: ROLES.employee }
};

function actingAs(callerRole: { id: string; name: RolesEnum }, canChangeRoles = true) {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('t-1');
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(callerRole.id);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission: PermissionsEnum) => canChangeRoles && permission === PermissionsEnum.CHANGE_ROLES_PERMISSIONS
	);

	const roleService = {
		findOneByWhereOptions: jest.fn(async () => callerRole),
		findOneByIdString: jest.fn(async (id: string) => Object.values(ROLES).find((role) => role.id === id))
	};
	const service = new RolePermissionService({} as never, {} as never, roleService as never, {} as never);
	const read = jest
		.spyOn(service, 'findOneByOptions')
		.mockImplementation(async (options: any) => ROWS[options?.where?.id] as never);
	const softRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockImplementation(async (id: any) => ROWS[id] as never);
	const softRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockImplementation(async (id: any) => ROWS[id] as never);
	const update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as never);

	return { service, read, softRemove, softRecover, update };
}

afterEach(() => jest.restoreAllMocks());

describe('an ADMIN', () => {
	it.each(['p-super', 'p-admin'])('may not withdraw a %s row, and nothing is written', async (id) => {
		// The failure scenario: an ADMIN withdrew the SUPER_ADMIN's CHANGE_ROLES_PERMISSIONS row.
		const { service, softRemove } = actingAs(ROLES.admin);

		await expect(service.softRemove(id)).rejects.toBeInstanceOf(ForbiddenException);
		expect(softRemove).not.toHaveBeenCalled();
	});

	it('may not restore an ADMIN row a SUPER_ADMIN withdrew, read among the withdrawn rows', async () => {
		const { service, softRecover, read } = actingAs(ROLES.admin);

		await expect(service.softRecover('p-admin')).rejects.toBeInstanceOf(ForbiddenException);
		expect(softRecover).not.toHaveBeenCalled();
		expect(read).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
	});

	it('withdraws and restores a lower role’s row', async () => {
		const { service, softRemove, softRecover } = actingAs(ROLES.admin);

		await service.softRemove('p-employee');
		await service.softRecover('p-employee');

		expect(softRemove).toHaveBeenCalledTimes(1);
		expect(softRecover).toHaveBeenCalledTimes(1);
	});

	it('may not move a SUPER_ADMIN row to another role', async () => {
		// The failure scenario: `updateRolePermission(input: { id: <SUPER_ADMIN row>, roleId: <EMPLOYEE> })`.
		const { service, update } = actingAs(ROLES.admin);

		await expect(service.updatePermission('p-super', { roleId: ROLES.employee.id })).rejects.toBeInstanceOf(BadRequestException);
		expect(update).not.toHaveBeenCalled();
	});

	it('updates a lower role’s row', async () => {
		const { service, update } = actingAs(ROLES.admin);

		await service.updatePermission('p-employee', { roleId: ROLES.employee.id, enabled: false });

		expect(update).toHaveBeenCalledTimes(1);
	});

	it('may not withdraw anything without CHANGE_ROLES_PERMISSIONS', async () => {
		const { service, softRemove } = actingAs(ROLES.admin, false);

		await expect(service.softRemove('p-employee')).rejects.toBeInstanceOf(ForbiddenException);
		expect(softRemove).not.toHaveBeenCalled();
	});
});

describe('a SUPER_ADMIN', () => {
	it('may not withdraw a SUPER_ADMIN row, and withdraws an ADMIN row', async () => {
		const { service, softRemove } = actingAs(ROLES.super);

		await expect(service.softRemove('p-super')).rejects.toBeInstanceOf(ForbiddenException);
		await service.softRemove('p-admin');

		expect(softRemove).toHaveBeenCalledTimes(1);
		expect(softRemove).toHaveBeenCalledWith('p-admin', undefined, undefined);
	});
});

describe('any other role', () => {
	it('may not withdraw a permission row', async () => {
		const { service, softRemove } = actingAs(ROLES.employee);

		await expect(service.softRemove('p-employee')).rejects.toBeInstanceOf(ForbiddenException);
		expect(softRemove).not.toHaveBeenCalled();
	});
});
