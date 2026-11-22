// Must stay first: the service pulls the core entity graph in.
import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TrackingTurnedOffEvent } from '../time-tracking/timer/events/tracking-turned-off.event';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

/**
 * ever-co/ever-gauzy#12142: a member removed from a team while their timer ran kept it running. Out of the team, the
 * clients draw no timer for it, so nothing could stop it and the time kept counting. Turning the member's tracking off
 * for the team already stopped that run (TrackingTurnedOffEvent, handled by TimerService.stopRunningTimersOf, which
 * stops only a run of that team); a membership that ends now stops it the same way, through the team edit
 * (`PUT /organization-team/:id`, what "Remove from the team" sends) and the membership delete
 * (`DELETE /organization-team-employee/:id`, a manager's removal or the member leaving).
 */
describe('OrganizationTeamEmployeeService — a membership that ends stops the timer run for that team', () => {
	const manager = createTenantFixture({ user: { employeeId: 'manager-employee' } as IUser });
	const teamId = 'team-1';
	const rows = [
		{
			id: 'row-manager',
			employeeId: 'manager-employee',
			roleId: 'role-manager',
			role: { name: RolesEnum.MANAGER },
			isManager: true
		},
		{ id: 'row-member', employeeId: 'member-employee', roleId: null, role: null, isManager: false },
		{ id: 'row-other', employeeId: 'other-employee', roleId: null, role: null, isManager: false }
	].map((row) => ({
		...row,
		organizationTeamId: teamId,
		organizationId: manager.organizationId,
		tenantId: manager.tenantId
	}));

	/** Stands in for nestjs-cls, where the employee-filter bypass is stored per request. */
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const matches = (row: any, where: any = {}) =>
		(where.organizationTeamId === undefined || row.organizationTeamId === where.organizationTeamId) &&
		(where.employeeId === undefined || row.employeeId === where.employeeId) &&
		(where.id === undefined || (where.id?.value ?? [where.id]).includes(row.id)) &&
		(where.role?.name === undefined || row.role?.name === where.role.name) &&
		(where.isManager === undefined || row.isManager === where.isManager);

	let restore: () => void;
	let deleted: string[];
	let affectedByDelete: number | undefined;
	let publish: jest.Mock;
	let service: OrganizationTeamEmployeeService;

	/** The scope the stop of an employee's run for the team is published with. */
	const stopFor = (employeeId: string) =>
		new TrackingTurnedOffEvent({
			employeeId,
			organizationId: manager.organizationId,
			tenantId: manager.tenantId,
			organizationTeamId: teamId
		});

	const signInAs = (employeeId: string, permissions: PermissionsEnum[] = []) => {
		restore?.();
		const caller = createTenantFixture({
			tenantId: manager.tenantId,
			organizationId: manager.organizationId,
			user: { employeeId } as IUser
		});
		({ restore } = asTenantUser(caller, { permissions }));
	};

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as never;
		({ restore } = asTenantUser(manager));
		deleted = [];
		affectedByDelete = undefined;
		publish = jest.fn();

		jest.spyOn(CrudService.prototype, 'find').mockImplementation(async (options) =>
			rows.filter((row) => matches(row, options?.where))
		);
		jest.spyOn(CrudService.prototype, 'findOneByWhereOptions').mockImplementation(async (where) => {
			const row = rows.find((candidate) => matches(candidate, where));
			if (!row) throw new Error('not found');
			return row as never;
		});
		jest.spyOn(CrudService.prototype, 'update').mockImplementation(async () => ({}) as never);
		jest.spyOn(CrudService.prototype, 'deleteMany').mockImplementation(async (ids) => {
			deleted.push(...ids);
			return { affected: ids.length, raw: [] };
		});
		jest.spyOn(CrudService.prototype, 'delete').mockImplementation(async (where) => {
			const removed = rows.filter((row) => matches(row, where)).map((row) => row.id);
			deleted.push(...removed);
			return { affected: affectedByDelete ?? removed.length, raw: [] };
		});

		service = new OrganizationTeamEmployeeService(
			{
				metadata: { tableName: 'organization_team_employee', hasColumnWithPropertyPath: () => true },
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				exists: async ({ where }: { where: any[] }) =>
					where.some((condition) =>
						rows.some(
							(row) =>
								row.employeeId === condition.employeeId &&
								row.organizationTeamId === condition.organizationTeamId &&
								(condition.role === undefined || row.role?.name === condition.role.name) &&
								(condition.isManager === undefined || row.isManager === condition.isManager)
						)
					)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish } as any,
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

	const editTeam = (managerIds: string[], memberIds: string[], lookup?: { findWorkingEmployeeIds: jest.Mock }) =>
		requestStorage.run(new Map(), () =>
			service.updateOrganizationTeam(
				teamId,
				manager.organizationId,
				[],
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ id: 'role-manager' } as any,
				managerIds,
				memberIds,
				lookup
			)
		);

	const removeMembership = (rowId: string) =>
		requestStorage.run(new Map(), () =>
			service.deleteTeamMember(rowId, { organizationId: manager.organizationId, organizationTeamId: teamId })
		);

	describe('the team edit', () => {
		it('stops the run of the member the edit removes, for this team only', async () => {
			await editTeam(['manager-employee'], ['other-employee']);

			expect(deleted).toEqual(['row-member']);
			expect(publish.mock.calls).toEqual([[stopFor('member-employee')]]);
		});

		it('stops the run of each member it removes', async () => {
			await editTeam(['manager-employee'], []);

			expect(publish.mock.calls).toEqual([[stopFor('member-employee')], [stopFor('other-employee')]]);
		});

		it('stops nothing when it removes nobody', async () => {
			await editTeam(['manager-employee'], ['member-employee', 'other-employee']);

			expect(deleted).toEqual([]);
			expect(publish).not.toHaveBeenCalled();
		});

		it('stops nothing for a member whose work ended, whose membership it keeps', async () => {
			const lookup = { findWorkingEmployeeIds: jest.fn().mockResolvedValue(new Set(['manager-employee'])) };

			await editTeam(['manager-employee'], [], lookup);

			expect(deleted).toEqual([]);
			expect(publish).not.toHaveBeenCalled();
		});
	});

	describe('the membership delete', () => {
		it("stops the run of the member a team manager removes, the manager's own run left alone", async () => {
			await removeMembership('row-member');

			expect(deleted).toEqual(['row-member']);
			expect(publish.mock.calls).toEqual([[stopFor('member-employee')]]);
		});

		it('stops the run of a member who leaves the team', async () => {
			signInAs('member-employee');

			await removeMembership('row-member');

			expect(deleted).toEqual(['row-member']);
			expect(publish.mock.calls).toEqual([[stopFor('member-employee')]]);
		});

		it('stops the run of the member a holder of CHANGE_SELECTED_EMPLOYEE removes', async () => {
			signInAs('admin-employee', [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

			await removeMembership('row-other');

			expect(deleted).toEqual(['row-other']);
			expect(publish.mock.calls).toEqual([[stopFor('other-employee')]]);
		});

		it('stops nothing when the delete removed no row', async () => {
			affectedByDelete = 0;

			await removeMembership('row-member');

			expect(publish).not.toHaveBeenCalled();
		});
	});
});
