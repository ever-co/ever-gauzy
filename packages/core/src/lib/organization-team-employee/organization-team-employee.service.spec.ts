import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { And, Equal, IsNull, Or } from 'typeorm';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

/**
 * The organization boundary `TenantAwareCrudService` adds to a statement for a caller who is not a tenant admin: their
 * token organization or none, beside the organization the statement itself names.
 */
const insideBoundary = (tokenOrganizationId: string, statedOrganizationId?: string) => {
	const allowed = Or(Equal(tokenOrganizationId), IsNull());
	return {
		organizationId: statedOrganizationId === undefined ? allowed : And(Equal(statedOrganizationId), allowed)
	};
};

/**
 * #9052 — removing a member from a team reported success but kept the member.
 *
 * A team manager with the default EMPLOYEE role lacks CHANGE_SELECTED_EMPLOYEE, so TenantAwareCrudService adds
 * `employeeId = <manager>` to every query. The member lookups bypassed that filter, but the delete that followed
 * did not: it only matched the manager's own row, deleted nothing and still returned success.
 *
 * The rows below stand in for the database; the CrudService stand-ins apply the `employeeId` condition the way
 * the database would, and record what the delete was asked to remove.
 */
describe('OrganizationTeamEmployeeService — a team manager removing another member (#9052)', () => {
	const manager = createTenantFixture({ user: { employeeId: 'manager-employee' } as IUser });
	const teamId = 'team-1';
	const rows = [
		{
			id: 'row-manager',
			employeeId: 'manager-employee',
			roleId: 'role-manager',
			role: { name: RolesEnum.MANAGER }
		},
		{ id: 'row-member', employeeId: 'member-employee', roleId: null, role: null }
	].map((row) => ({ ...row, organizationTeamId: teamId, organizationId: manager.organizationId }));

	/** Stands in for nestjs-cls, where the employee-filter bypass is stored per request. */
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const matches = (row: any, where: any = {}) =>
		(where.employeeId === undefined || row.employeeId === where.employeeId) &&
		(where.id === undefined || (where.id?.value ?? [where.id]).includes(row.id)) &&
		(where.role?.name === undefined || row.role?.name === where.role.name);

	let restore: () => void;
	let deleted: string[];
	let updated: { id: unknown; changes: Record<string, unknown> }[];
	let entitySubscriptionService: { deleteForEmployee: jest.Mock };
	let service: OrganizationTeamEmployeeService;

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as never;
		({ restore } = asTenantUser(manager));
		deleted = [];
		updated = [];
		entitySubscriptionService = { deleteForEmployee: jest.fn() };

		jest.spyOn(CrudService.prototype, 'find').mockImplementation(async (options) =>
			rows.filter((row) => matches(row, options?.where))
		);
		jest.spyOn(CrudService.prototype, 'findOneByWhereOptions').mockImplementation(async (where) => {
			const row = rows.find((candidate) => matches(candidate, where));
			if (!row) throw new Error('not found');
			return row as never;
		});
		jest.spyOn(CrudService.prototype, 'findOneByIdString').mockImplementation(async (id, options) => {
			const row = rows.find((candidate) => matches(candidate, { ...options?.where, id }));
			if (!row) throw new Error('not found');
			return row as never;
		});
		jest.spyOn(CrudService.prototype, 'update').mockImplementation(async (id, changes) => {
			updated.push({ id, changes: changes as Record<string, unknown> });
			return {} as never;
		});
		jest.spyOn(CrudService.prototype, 'deleteMany').mockImplementation(async (ids) => {
			deleted.push(...ids);
			return { affected: ids.length, raw: [] };
		});
		jest.spyOn(CrudService.prototype, 'delete').mockImplementation(async (where) => {
			const removed = rows.filter((row) => matches(row, where)).map((row) => row.id);
			deleted.push(...removed);
			return { affected: removed.length, raw: [] };
		});

		service = new OrganizationTeamEmployeeService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'organization_team_employee', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ unassignEmployeeFromTeamTasks: jest.fn() } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			entitySubscriptionService as any
		);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		restore();
		jest.restoreAllMocks();
	});

	const editTeam = (managerIds: string[], memberIds: string[]) =>
		requestStorage.run(new Map(), () =>
			service.updateOrganizationTeam(
				teamId,
				manager.organizationId,
				[],
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ id: 'role-manager' } as any,
				managerIds,
				memberIds
			)
		);

	it('reads every member for a single add, past the manager’s own employee filter', async () => {
		// Read through the employee filter, a manager would see only their own row, and a set rebuilt from
		// it would remove every other member when it is handed back to the set-based edit.
		const sets = await requestStorage.run(new Map(), () => service.findMemberSets(teamId, manager.organizationId));

		expect([...sets.memberIds].sort()).toEqual(['manager-employee', 'member-employee']);
		expect(sets.managerIds).toEqual(['manager-employee']);
	});

	it('removes a member deselected while editing the team, and their team subscription', async () => {
		await editTeam(['manager-employee'], []);

		expect(deleted).toEqual(['row-member']);
		expect(entitySubscriptionService.deleteForEmployee).toHaveBeenCalledWith(
			expect.objectContaining({ entityId: teamId, employeeId: 'member-employee' })
		);
	});

	it("changes another member's role while editing the team", async () => {
		// The member is promoted to manager
		await editTeam(['manager-employee', 'member-employee'], []);

		expect(deleted).toEqual([]);
		// TenantAwareCrudService.update scopes a write by id to the caller's tenant, so the statement
		// names the member's row together with the tenant rather than the bare id.
		expect(updated).toEqual([
			{
				id: { id: 'row-member', tenantId: manager.tenantId, ...insideBoundary(manager.organizationId) },
				changes: { role: { id: 'role-manager' }, isManager: true }
			}
		]);
	});

	it('removes another member through DELETE /organization-team-employee/:id', async () => {
		const options = { organizationId: manager.organizationId, organizationTeamId: teamId };
		const result = await requestStorage.run(new Map(), () => service.deleteTeamMember('row-member', options));

		expect(deleted).toEqual(['row-member']);
		expect(result).toMatchObject({ affected: 1 });
	});
});

/**
 * #10706 — a team manager with the default EMPLOYEE role got a 403 when reordering a member, toggling their
 * tracking or setting their active task.
 *
 * The manager check passed, but the write that followed still carried the automatic `employeeId = <manager>`
 * filter, so it only matched the manager's own row; and the GraphQL fields read the member back through the
 * same filter. The stand-ins below apply the `employeeId` and team conditions the way the database would.
 */
describe('OrganizationTeamEmployeeService — a team manager changing another member (#10706)', () => {
	const tenant = createTenantFixture();
	const teamId = 'team-1';
	const otherTeamId = 'team-2';
	const asEmployee = (employeeId: string) =>
		createTenantFixture({
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			user: { employeeId } as IUser
		});
	const manager = asEmployee('manager-employee');
	const member = asEmployee('member-employee');
	const otherTeamManager = asEmployee('other-manager-employee');

	const rows = [
		{
			id: 'row-manager',
			employeeId: 'manager-employee',
			organizationTeamId: teamId,
			role: { name: RolesEnum.MANAGER }
		},
		{ id: 'row-member', employeeId: 'member-employee', organizationTeamId: teamId, role: null },
		{
			id: 'row-other-manager',
			employeeId: 'other-manager-employee',
			organizationTeamId: otherTeamId,
			role: { name: RolesEnum.MANAGER }
		}
	].map((row) => ({ ...row, tenantId: tenant.tenantId, organizationId: tenant.organizationId }));

	/** Stands in for nestjs-cls, where the employee-filter bypass is stored per request. */
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const matches = (row: any, where: any = {}) =>
		(where.employeeId === undefined || row.employeeId === where.employeeId) &&
		(where.organizationTeamId === undefined || row.organizationTeamId === where.organizationTeamId) &&
		(where.id === undefined || row.id === where.id) &&
		(where.role?.name === undefined || row.role?.name === where.role.name);

	let restore: () => void = () => undefined;
	let updated: { id: unknown; changes: Record<string, unknown> }[];
	let service: OrganizationTeamEmployeeService;

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as never;
		updated = [];

		jest.spyOn(CrudService.prototype, 'findOneByWhereOptions').mockImplementation(async (where) => {
			const row = rows.find((candidate) => matches(candidate, where));
			if (!row) throw new Error('not found');
			return row as never;
		});
		jest.spyOn(CrudService.prototype, 'findOneByIdString').mockImplementation(async (id, options) => {
			const row = rows.find((candidate) => matches(candidate, { ...options?.where, id }));
			if (!row) throw new Error('not found');
			return row as never;
		});
		jest.spyOn(CrudService.prototype, 'update').mockImplementation(async (id, changes) => {
			updated.push({ id, changes: changes as Record<string, unknown> });
			return {} as never;
		});

		service = new OrganizationTeamEmployeeService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'organization_team_employee', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ unassignEmployeeFromTeamTasks: jest.fn() } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ deleteForEmployee: jest.fn() } as any
		);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		restore();
		jest.restoreAllMocks();
	});

	/** Runs one request as the given caller. */
	const as = <R>(
		caller: ReturnType<typeof asEmployee>,
		call: () => Promise<R>,
		permissions: PermissionsEnum[] = []
	): Promise<R> => {
		({ restore } = asTenantUser(caller, { permissions }));
		return requestStorage.run(new Map(), call);
	};

	const inTeam = (organizationTeamId: string) => ({ organizationId: tenant.organizationId, organizationTeamId });

	describe('PUT /organization-team-employee/:id (reorder, tracking)', () => {
		it("lets a manager change another member of the team, scoped to the team and not to the manager's row", async () => {
			await expect(
				as(manager, () => service.update('row-member', { ...inTeam(teamId), order: 2 }))
			).resolves.toBeDefined();

			expect(updated).toEqual([
				{
					id: {
						id: 'row-member',
						tenantId: tenant.tenantId,
						...inTeam(teamId),
						...insideBoundary(tenant.organizationId, tenant.organizationId)
					},
					changes: { ...inTeam(teamId), order: 2 }
				}
			]);
		});

		/** A body that also names a tenant and an organization, as the REST DTO admits. */
		const withScopeFields = {
			...inTeam(teamId),
			order: 2,
			isTrackingEnabled: false,
			activeTaskId: 'task-1',
			tenantId: null,
			tenant: { id: 'other-tenant' },
			organization: { id: 'other-organization' }
		} as never;

		it.each([
			['a manager of the team', []],
			['a caller with CHANGE_SELECTED_EMPLOYEE', [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]]
		])(
			"writes only the membership's own fields for %s: the tenant and organization in the body are not written",
			async (_, permissions: PermissionsEnum[]) => {
				await expect(
					as(manager, () => service.update('row-member', withScopeFields), permissions)
				).resolves.toBeDefined();

				expect(updated).toEqual([
					{
						id: {
							id: 'row-member',
							tenantId: tenant.tenantId,
							...inTeam(teamId),
							...insideBoundary(tenant.organizationId, tenant.organizationId)
						},
						changes: { ...inTeam(teamId), order: 2, isTrackingEnabled: false, activeTaskId: 'task-1' }
					}
				]);
			}
		);

		it('refuses a plain member changing another member', async () => {
			await expect(
				as(member, () => service.update('row-manager', { ...inTeam(teamId), order: 2 }))
			).rejects.toThrow(ForbiddenException);
			expect(updated).toEqual([]);
		});

		it('refuses a manager of another team, whichever team the request names', async () => {
			await expect(
				as(otherTeamManager, () => service.update('row-member', { ...inTeam(teamId), order: 2 }))
			).rejects.toThrow(ForbiddenException);
			// Naming the team they manage passes the manager check, but the member is not on that team.
			await expect(
				as(otherTeamManager, () => service.update('row-member', { ...inTeam(otherTeamId), order: 2 }))
			).rejects.toThrow(ForbiddenException);
			expect(updated).toEqual([]);
		});
	});

	describe('PUT /organization-team-employee/:id/active-task', () => {
		it("lets a manager set another member's active task", async () => {
			await expect(
				as(manager, () => service.updateActiveTask('row-member', { ...inTeam(teamId), activeTaskId: 'task-1' }))
			).resolves.toBeDefined();

			expect(updated).toEqual([
				{
					id: {
						id: 'row-member',
						tenantId: tenant.tenantId,
						...inTeam(teamId),
						...insideBoundary(tenant.organizationId, tenant.organizationId)
					},
					changes: { activeTaskId: 'task-1' }
				}
			]);
		});

		it('refuses a manager of another team naming their own team', async () => {
			await expect(
				as(otherTeamManager, () =>
					service.updateActiveTask('row-member', { ...inTeam(otherTeamId), activeTaskId: 'task-1' })
				)
			).rejects.toThrow(ForbiddenException);
			expect(updated).toEqual([]);
		});
	});

	describe('reading the member back (the GraphQL update fields)', () => {
		it('answers a manager the member of their team', async () => {
			await expect(as(manager, () => service.findOneByIdString('row-member'))).resolves.toMatchObject({
				id: 'row-member'
			});
		});

		it('keeps the miss for a plain member reading another member', async () => {
			await expect(as(member, () => service.findOneByIdString('row-manager'))).rejects.toThrow('not found');
		});

		it('keeps the miss for a manager of another team', async () => {
			await expect(as(otherTeamManager, () => service.findOneByIdString('row-member'))).rejects.toThrow(
				'not found'
			);
		});
	});
});
