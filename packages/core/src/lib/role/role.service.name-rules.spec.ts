/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `role-entity.resolver.spec.ts`.
 */
import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context';
import { RoleController } from './role.controller';
import { RoleEntityResolver } from './role-entity.resolver';
import { RoleService } from './role.service';

/**
 * R7-01 (P0, review of #10254): **privilege escalation ADMIN → SUPER_ADMIN in one call.**
 *
 * A role's NAME is an authorization identity: `RequestContext.hasRoles` compares `role.name`, and `RoleGuard`, the
 * `TenantPermissionGuard` super-admin bypass and the role-permission rules all key on it. An ADMIN holds
 * `CHANGE_ROLES_PERMISSIONS` by default, and `updateRole(input:{ id:"<ADMIN role id>", name:"SUPER_ADMIN" })` —
 * which ran no uniqueness check and no rename guard — made every ADMIN a SUPER_ADMIN (`deleteTenant` included).
 * REST had a two-step version: rename the real SUPER_ADMIN role away, then rename ADMIN to its name.
 *
 * The rules now live in `RoleService`, which both surfaces call, so they are identical on REST and GraphQL:
 *   - the platform's role names (`RolesEnum`, case-insensitively) are reserved — no caller creates a role under one or
 *     renames a role to one (the default roles come only from the SUPER_ADMIN-only bulk path);
 *   - a role whose name is one of them, or that is a system role, cannot be renamed or withdrawn through a caller's
 *     request (its removal was already refused); restoring one withdrawn before this change stays possible;
 *   - a name is unique in its tenant.
 */
const TENANT = 'tenant-1';
const ROLES = [
	{ id: 'role-super-admin', name: RolesEnum.SUPER_ADMIN, isSystem: true, tenantId: TENANT },
	{ id: 'role-admin', name: RolesEnum.ADMIN, isSystem: true, tenantId: TENANT },
	{ id: 'role-manager', name: RolesEnum.MANAGER, isSystem: false, tenantId: TENANT },
	{ id: 'role-auditor', name: 'AUDITOR', isSystem: false, tenantId: TENANT },
	{ id: 'role-reviewer', name: 'REVIEWER', isSystem: false, tenantId: TENANT },
	// Withdrawn, not removed: its name stays taken, or restoring it would create the duplicate.
	{ id: 'role-retired', name: 'RETIRED', isSystem: false, tenantId: TENANT, deletedAt: new Date('2026-01-01') }
];

function service(): { service: RoleService; baseCreate: jest.SpyInstance; baseUpdate: jest.SpyInstance; baseSoftRemove: jest.SpyInstance } {
	const instance = Object.create(RoleService.prototype) as RoleService;
	(instance as any).findOneByIdString = jest.fn(async (id: string, options?: { withDeleted?: boolean }) => {
		const role = ROLES.find((candidate) => candidate.id === id);
		if (!role) throw new Error('not found');
		return { ...role };
	});
	(instance as any).find = jest.fn(async (options: { where: { name: string }; withDeleted?: boolean }) =>
		ROLES.filter((role) => role.name === options.where.name && (options.withDeleted || !('deletedAt' in role))).map(
			(role) => ({ ...role })
		)
	);
	const baseCreate = jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity: any) => ({ id: 'role-new', ...entity }));
	const baseUpdate = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as any);
	const baseSoftRemove = jest.spyOn(TenantAwareCrudService.prototype as any, 'softRemove').mockResolvedValue({ deletedAt: new Date() } as any);
	return { service: instance, baseCreate, baseUpdate, baseSoftRemove };
}

describe('Role names are authorization identities — R7-01', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	describe('the exact escalation, on both surfaces', () => {
		it('GraphQL: refuses `updateRole(input:{ id:<ADMIN role>, name:"SUPER_ADMIN" })` and writes nothing', async () => {
			const { service: roles, baseUpdate } = service();
			const resolver = new RoleEntityResolver(roles as never);

			await expect(resolver.updateRole({ id: 'role-admin', name: 'SUPER_ADMIN' } as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(baseUpdate).not.toHaveBeenCalled();
		});

		it('REST: refuses `PUT /roles/<ADMIN role>` { name: "SUPER_ADMIN" } and writes nothing', async () => {
			const { service: roles, baseUpdate } = service();
			const controller = Object.create(RoleController.prototype);
			Object.defineProperty(controller, 'roleService', { value: roles });

			await expect(controller.update('role-admin', { name: 'SUPER_ADMIN' })).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseUpdate).not.toHaveBeenCalled();
		});

		it('refuses the two-step version: the SUPER_ADMIN role cannot be renamed away, on either surface', async () => {
			const { service: roles, baseUpdate } = service();
			const resolver = new RoleEntityResolver(roles as never);

			await expect(roles.update('role-super-admin', { name: 'FORMER' } as any)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(resolver.updateRole({ id: 'role-super-admin', name: 'FORMER' } as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(baseUpdate).not.toHaveBeenCalled();
		});
	});

	describe('creating', () => {
		it.each(['SUPER_ADMIN', 'super_admin', ' Admin ', 'MANAGER', 'interviewer'])(
			'refuses a role named after a platform role (%s)',
			async (name) => {
				const { service: roles, baseCreate } = service();

				await expect(roles.create({ name } as any)).rejects.toBeInstanceOf(BadRequestException);
				expect(baseCreate).not.toHaveBeenCalled();
			}
		);

		it('refuses a name the tenant already uses', async () => {
			const { service: roles, baseCreate } = service();

			await expect(roles.create({ name: 'AUDITOR' } as any)).rejects.toBeInstanceOf(BadRequestException);
			expect(baseCreate).not.toHaveBeenCalled();
		});

		it('refuses the name of a withdrawn role, reading withdrawn roles to know it is taken', async () => {
			const { service: roles, baseCreate } = service();

			await expect(roles.create({ name: 'RETIRED' } as any)).rejects.toBeInstanceOf(BadRequestException);
			expect((roles as any).find).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'RETIRED' }, withDeleted: true }));
			expect(baseCreate).not.toHaveBeenCalled();
		});

		it('creates a custom role under a free name, trimmed', async () => {
			const { service: roles, baseCreate } = service();

			await expect(roles.create({ name: ' Accountant ' } as any)).resolves.toMatchObject({ name: 'Accountant' });
			expect(baseCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Accountant' }));
		});
	});

	describe('renaming', () => {
		it.each([
			['role-admin', 'ADMINISTRATORS'],
			['role-manager', 'TEAM LEAD']
		])('refuses to rename a platform role (%s → %s)', async (id, name) => {
			const { service: roles, baseUpdate } = service();

			await expect(roles.update(id, { name } as any)).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseUpdate).not.toHaveBeenCalled();
		});

		it.each(['ADMIN', 'Super_Admin', 'EMPLOYEE'])('refuses to rename a custom role to a platform role name (%s)', async (name) => {
			const { service: roles, baseUpdate } = service();

			await expect(roles.update('role-auditor', { name } as any)).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseUpdate).not.toHaveBeenCalled();
		});

		it('refuses to rename a custom role to a name the tenant already uses', async () => {
			const { service: roles, baseUpdate } = service();

			await expect(roles.update('role-auditor', { name: 'REVIEWER' } as any)).rejects.toBeInstanceOf(BadRequestException);
			expect(baseUpdate).not.toHaveBeenCalled();
		});

		it('refuses to rename a custom role to the name of a withdrawn role', async () => {
			const { service: roles, baseUpdate } = service();

			await expect(roles.update('role-auditor', { name: 'RETIRED' } as any)).rejects.toBeInstanceOf(BadRequestException);
			expect(baseUpdate).not.toHaveBeenCalled();
		});

		it('renames a custom role to a free name, and lets a role keep its own name', async () => {
			const { service: roles, baseUpdate } = service();

			await expect(roles.update('role-auditor', { name: 'Internal Auditor' } as any)).resolves.toBeDefined();
			await expect(roles.update('role-auditor', { name: 'AUDITOR' } as any)).resolves.toBeDefined();
			await expect(roles.update('role-admin', { name: 'ADMIN' } as any)).resolves.toBeDefined();
			expect(baseUpdate).toHaveBeenCalledTimes(3);
		});

		it('refuses to change whether a role is a system role', async () => {
			const { service: roles, baseUpdate } = service();

			await expect(roles.update('role-auditor', { isSystem: true } as any)).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseUpdate).not.toHaveBeenCalled();
		});
	});

	describe('withdrawing', () => {
		it('refuses to withdraw a platform role — its removal is already refused, its withdrawal locked its holders out', async () => {
			const { service: roles, baseSoftRemove } = service();

			await expect(roles.softRemove('role-super-admin')).rejects.toBeInstanceOf(ForbiddenException);
			await expect(roles.softRemove('role-manager')).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseSoftRemove).not.toHaveBeenCalled();
		});

		it('withdraws a custom role', async () => {
			const { service: roles, baseSoftRemove } = service();

			await expect(roles.softRemove('role-auditor')).resolves.toBeDefined();
			expect(baseSoftRemove).toHaveBeenCalled();
		});
	});
});
