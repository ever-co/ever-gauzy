import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { IUser, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

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
	let service: OrganizationTeamEmployeeService;

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as never;
		({ restore } = asTenantUser(manager));
		deleted = [];

		jest.spyOn(CrudService.prototype, 'find').mockImplementation(async (options) =>
			rows.filter((row) => matches(row, options?.where))
		);
		jest.spyOn(CrudService.prototype, 'findOneByWhereOptions').mockImplementation(async (where) => {
			const row = rows.find((candidate) => matches(candidate, where));
			if (!row) throw new Error('not found');
			return row as never;
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
			{ delete: jest.fn() } as any
		);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		restore();
		jest.restoreAllMocks();
	});

	it('removes a member deselected while editing the team', async () => {
		await requestStorage.run(new Map(), () =>
			service.updateOrganizationTeam(
				teamId,
				manager.organizationId,
				[],
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ id: 'role-manager' } as any,
				['manager-employee'],
				[]
			)
		);

		expect(deleted).toEqual(['row-member']);
	});

	it('removes another member through DELETE /organization-team-employee/:id', async () => {
		const options = { organizationId: manager.organizationId, organizationTeamId: teamId };
		const result = await requestStorage.run(new Map(), () => service.deleteTeamMember('row-member', options));

		expect(deleted).toEqual(['row-member']);
		expect(result).toMatchObject({ affected: 1 });
	});
});
