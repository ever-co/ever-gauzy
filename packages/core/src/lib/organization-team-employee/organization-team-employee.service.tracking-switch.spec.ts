// Must stay first: the service pulls the core entity graph in.
import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TRACKING_SWITCH_REFUSED } from '../time-tracking/timer/tracking-switch-rule';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

/**
 * ever-co/ever-teams#5015: only someone of a higher role may turn a member's time tracking on or off in a team, and an
 * admin also for another admin. A team manager acted on any membership of the team, their own and the other managers'
 * included. `PUT /organization-team-employee/:id` and the GraphQL `updateOrganizationTeamEmployee` both reach
 * `updateMember`, so the matrix runs through it.
 */
describe('OrganizationTeamEmployeeService.updateMember — who may switch a member’s tracking', () => {
	const tenant = createTenantFixture();
	const teamId = 'team-1';
	const scope = { organizationId: tenant.organizationId, organizationTeamId: teamId };

	const userOf = (employeeId: string, role: RolesEnum) => ({ employeeId, role: { name: role } }) as unknown as IUser;
	const callerOf = (employeeId: string, role: RolesEnum) =>
		createTenantFixture({
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			user: userOf(employeeId, role)
		});

	/** Admins hold CHANGE_SELECTED_EMPLOYEE by default; the others do not. */
	const ADMIN_PERMISSIONS = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
	const callers = {
		admin: { fixture: callerOf('admin-employee', RolesEnum.ADMIN), permissions: ADMIN_PERMISSIONS },
		superAdmin: {
			fixture: callerOf('super-admin-employee', RolesEnum.SUPER_ADMIN),
			permissions: ADMIN_PERMISSIONS
		},
		manager: { fixture: callerOf('manager-employee', RolesEnum.EMPLOYEE), permissions: [] },
		flaggedManager: { fixture: callerOf('flagged-manager-employee', RolesEnum.EMPLOYEE), permissions: [] },
		member: { fixture: callerOf('member-employee', RolesEnum.EMPLOYEE), permissions: [] }
	};
	type Caller = keyof typeof callers;

	/** One membership of the team: the employee's tenant role, and whether the membership manages the team. */
	const membership = (
		id: string,
		employeeId: string,
		userRole: RolesEnum,
		place: { teamRole?: RolesEnum; isManager?: boolean } = {}
	) => ({
		id,
		employeeId,
		organizationTeamId: teamId,
		tenantId: tenant.tenantId,
		organizationId: tenant.organizationId,
		roleId: place.teamRole ? `role-${place.teamRole}` : null,
		role: place.teamRole ? { name: place.teamRole } : null,
		isManager: place.isManager ?? false,
		isTrackingEnabled: true as boolean | null,
		employee: { id: employeeId, user: { role: { name: userRole } } }
	});

	let rows: ReturnType<typeof membership>[];
	let updated: { id: unknown; changes: Record<string, unknown> }[];
	let publish: jest.Mock;
	let service: OrganizationTeamEmployeeService;
	let restore: () => void = () => undefined;

	/** Stands in for nestjs-cls, where the employee-filter bypass is stored per request. */
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	/**
	 * Stands in for the database: the plain values of a `where` must match. The operators the CRUD base adds (the
	 * organization boundary) and the manager check's NULL-tolerant status operators are not evaluated: these rows sit
	 * inside the boundary and leave both statuses unset.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const matches = (row: any, where: any = {}) =>
		Object.entries(where).every(([key, value]) => {
			if (key === 'role') {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return row.role?.name === (value as any)?.name;
			}
			const isOperator = typeof value === 'object' && value !== null;
			if (value === undefined || isOperator) {
				return true;
			}
			return row[key] === value;
		});

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as never;
		rows = [
			membership('row-admin', 'admin-employee', RolesEnum.ADMIN),
			membership('row-super-admin', 'super-admin-employee', RolesEnum.SUPER_ADMIN),
			membership('row-manager', 'manager-employee', RolesEnum.EMPLOYEE, { teamRole: RolesEnum.MANAGER }),
			membership('row-flagged-manager', 'flagged-manager-employee', RolesEnum.EMPLOYEE, { isManager: true }),
			membership('row-member', 'member-employee', RolesEnum.EMPLOYEE),
			membership('row-other-member', 'other-member-employee', RolesEnum.EMPLOYEE),
			membership('row-tenant-manager', 'tenant-manager-employee', RolesEnum.MANAGER)
		];
		updated = [];
		publish = jest.fn();

		jest.spyOn(CrudService.prototype, 'findOneByWhereOptions').mockImplementation(async (where) => {
			const row = rows.find((candidate) => matches(candidate, where));
			if (!row) throw new Error('not found');
			return row as never;
		});
		jest.spyOn(CrudService.prototype, 'update').mockImplementation(async (id, changes) => {
			updated.push({ id, changes: changes as Record<string, unknown> });
			return { affected: 1 } as never;
		});

		service = new OrganizationTeamEmployeeService(
			{
				metadata: { tableName: 'organization_team_employee', hasColumnWithPropertyPath: () => true },
				// The team manager check
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				exists: async ({ where }: { where: any[] }) =>
					where.some((condition) => rows.some((row) => matches(row, condition))),
				// The membership read with its roles
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				findOne: async ({ where }: { where: any }) => rows.find((row) => matches(row, where)) ?? null
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

	/** Runs one update as the given caller. */
	const updateAs = (caller: Caller, memberId: string, changes: Record<string, unknown>) => {
		const { fixture, permissions } = callers[caller];
		({ restore } = asTenantUser(fixture, { permissions }));
		return requestStorage.run(new Map(), () => service.updateMember(memberId, { ...scope, ...changes } as never));
	};

	const rowOf = (id: string) => {
		const row = rows.find((candidate) => candidate.id === id);
		if (!row) throw new Error(`No row ${id}`);
		return row;
	};

	describe('turning tracking off', () => {
		it.each<{ who: string; whom: string; caller: Caller; memberId: string }>([
			{ who: 'an admin', whom: 'another admin', caller: 'admin', memberId: 'row-super-admin' },
			{ who: 'an admin', whom: 'themselves', caller: 'admin', memberId: 'row-admin' },
			{ who: 'a super admin', whom: 'an admin', caller: 'superAdmin', memberId: 'row-admin' },
			{ who: 'an admin', whom: 'a manager', caller: 'admin', memberId: 'row-manager' },
			{
				who: 'an admin',
				whom: 'a manager flagged on the team',
				caller: 'admin',
				memberId: 'row-flagged-manager'
			},
			{ who: 'an admin', whom: 'a member', caller: 'admin', memberId: 'row-member' },
			{ who: 'a manager', whom: 'a member of the team', caller: 'manager', memberId: 'row-member' },
			{
				who: 'a manager flagged on the team',
				whom: 'a member of the team',
				caller: 'flaggedManager',
				memberId: 'row-member'
			}
		])('lets $who switch $whom', async ({ caller, memberId }) => {
			await expect(updateAs(caller, memberId, { isTrackingEnabled: false })).resolves.toBeDefined();

			expect(updated).toHaveLength(1);
			expect(updated[0].changes).toEqual({ ...scope, isTrackingEnabled: false });
		});

		it.each<{ who: string; whom: string; caller: Caller; memberId: string }>([
			{ who: 'a manager', whom: 'themselves', caller: 'manager', memberId: 'row-manager' },
			{ who: 'a manager', whom: 'another manager', caller: 'manager', memberId: 'row-flagged-manager' },
			{
				who: 'a manager flagged on the team',
				whom: 'a manager',
				caller: 'flaggedManager',
				memberId: 'row-manager'
			},
			{ who: 'a manager', whom: 'an admin', caller: 'manager', memberId: 'row-admin' },
			{
				who: 'a manager',
				whom: 'a member whose role is MANAGER',
				caller: 'manager',
				memberId: 'row-tenant-manager'
			},
			{ who: 'a member', whom: 'themselves', caller: 'member', memberId: 'row-member' },
			{ who: 'a member', whom: 'another member', caller: 'member', memberId: 'row-other-member' },
			{ who: 'a member', whom: 'a manager', caller: 'member', memberId: 'row-manager' },
			{ who: 'a member', whom: 'an admin', caller: 'member', memberId: 'row-admin' }
		])('refuses $who switching $whom, and writes nothing', async ({ caller, memberId }) => {
			await expect(updateAs(caller, memberId, { isTrackingEnabled: false })).rejects.toThrow(
				new ForbiddenException(TRACKING_SWITCH_REFUSED)
			);

			expect(updated).toEqual([]);
			expect(publish).not.toHaveBeenCalled();
		});
	});

	describe('turning tracking back on', () => {
		it('makes a manager whose tracking was turned off wait for an admin', async () => {
			rowOf('row-manager').isTrackingEnabled = false;

			await expect(updateAs('manager', 'row-manager', { isTrackingEnabled: true })).rejects.toThrow(
				TRACKING_SWITCH_REFUSED
			);
			expect(updated).toEqual([]);

			await expect(updateAs('admin', 'row-manager', { isTrackingEnabled: true })).resolves.toBeDefined();
			expect(updated).toHaveLength(1);
		});

		it('lets a manager turn a member back on', async () => {
			rowOf('row-member').isTrackingEnabled = false;

			await expect(updateAs('manager', 'row-member', { isTrackingEnabled: true })).resolves.toBeDefined();
			expect(updated).toHaveLength(1);
		});

		it('reads a null as on, as the timer does, so it cannot turn a switched-off manager back on', async () => {
			rowOf('row-flagged-manager').isTrackingEnabled = false;

			await expect(updateAs('manager', 'row-flagged-manager', { isTrackingEnabled: null })).rejects.toThrow(
				TRACKING_SWITCH_REFUSED
			);
			expect(updated).toEqual([]);
		});
	});

	describe('updates that leave the switch as it is', () => {
		it('lets a manager reorder another manager, as before', async () => {
			await expect(updateAs('manager', 'row-flagged-manager', { order: 3 })).resolves.toBeDefined();

			expect(updated).toHaveLength(1);
			expect(updated[0].changes).toEqual({ ...scope, order: 3 });
		});

		it('lets a manager send their own switch back unchanged', async () => {
			await expect(
				updateAs('manager', 'row-manager', { isTrackingEnabled: true, order: 1 })
			).resolves.toBeDefined();

			expect(updated).toHaveLength(1);
		});

		it('still refuses a member changing another membership, as before', async () => {
			await expect(updateAs('member', 'row-other-member', { order: 3 })).rejects.toThrow(ForbiddenException);

			expect(updated).toEqual([]);
		});
	});
});
