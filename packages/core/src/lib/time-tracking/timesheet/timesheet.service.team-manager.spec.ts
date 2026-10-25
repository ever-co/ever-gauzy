// Must stay first: loads the entity graph before any service pulls an entity (see channel.controller.spec.ts).
import '../../core/entities/internal';

import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema, In, ObjectLiteral, Repository } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ITimesheet, IUpdateTimesheetStatusInput, PermissionsEnum, RolesEnum, TimesheetStatus } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TimesheetUpdateStatusCommand } from './commands';
import { TimesheetUpdateStatusHandler } from './commands/handlers/timesheet-update-status.handler';
import { TimeSheetController } from './timesheet.controller';
import { TimesheetResolver } from './timesheet.resolver';
import { TimeSheetService } from './timesheet.service';

/**
 * Who may approve or deny a timesheet without CAN_APPROVE_TIMESHEET: a team manager, for the members of the
 * teams they manage, never for themselves.
 *
 * These cases run the real status handler, the real `TimeSheetService` and the real `ManagedEmployeeService`
 * against a real SQLite database holding the tenant's users, employees, teams and timesheets.
 */

const TENANT = 'c1400000-0000-4000-8000-00000000000a';
const ORGANIZATION = 'c1400000-0000-4000-8000-0000000000a1';
/** The team the manager manages: the manager and a member. */
const MANAGED_TEAM = 'c1400000-0000-4000-8000-0000000000d1';
/** A team the manager only belongs to, without managing it. */
const OTHER_TEAM = 'c1400000-0000-4000-8000-0000000000d2';

const MANAGER = 'c1400000-0000-4000-8000-0000000000e1';
const MEMBER = 'c1400000-0000-4000-8000-0000000000e2';
/** A member of the team the manager does not manage. */
const OUTSIDER = 'c1400000-0000-4000-8000-0000000000e3';
/** The approver's own employee. */
const APPROVER = 'c1400000-0000-4000-8000-0000000000e4';

const MANAGER_TIMESHEET = 'c1400000-0000-4000-8000-0000000000f1';
const MEMBER_TIMESHEET = 'c1400000-0000-4000-8000-0000000000f2';
const OUTSIDER_TIMESHEET = 'c1400000-0000-4000-8000-0000000000f3';
const APPROVER_TIMESHEET = 'c1400000-0000-4000-8000-0000000000f4';
/** No timesheet of the organization has this id. */
const UNKNOWN_TIMESHEET = 'c1400000-0000-4000-8000-0000000000f9';

const MEMBER_USER = 'user-member';
const MEMBER_EMAIL = `${MEMBER_USER}@example.com`;

/** Every stored timesheet starts submitted and waiting for its approver. */
const WAITING = { status: TimesheetStatus.PENDING, approvedById: null, reason: null };

const TenantSchema = new EntitySchema<ObjectLiteral>({
	name: 'Tenant',
	tableName: 'tenant',
	columns: { id: { primary: true, type: 'varchar' } }
});

/** The user an employee signs in as: the approver a timesheet records, and the address its e-mail goes to. */
const UserSchema = new EntitySchema<ObjectLiteral>({
	name: 'User',
	tableName: 'user',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		firstName: { type: 'varchar', nullable: true },
		lastName: { type: 'varchar', nullable: true },
		email: { type: 'varchar', nullable: true }
	}
});

const EmployeeSchema = new EntitySchema<ObjectLiteral>({
	name: 'Employee',
	tableName: 'employee',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		userId: { type: 'varchar', nullable: true }
	},
	relations: {
		user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' } }
	}
});

const OrganizationTeamSchema = new EntitySchema<ObjectLiteral>({
	name: 'OrganizationTeam',
	tableName: 'organization_team',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

/** The membership columns `ManagedEmployeeService` reads, with the team relation it scopes the organization through. */
const OrganizationTeamEmployeeSchema = new EntitySchema<ObjectLiteral>({
	name: 'OrganizationTeamEmployee',
	tableName: 'organization_team_employee',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		organizationTeamId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		isManager: { type: 'boolean', default: false },
		isActive: { type: 'boolean', nullable: true, default: true },
		isArchived: { type: 'boolean', nullable: true, default: false }
	},
	relations: {
		organizationTeam: {
			type: 'many-to-one',
			target: 'OrganizationTeam',
			joinColumn: { name: 'organizationTeamId' }
		}
	}
});

/**
 * The timesheet, with the two scope relations `TenantAwareCrudService` names beside their columns (`tenant`
 * with `tenantId`, `employee` with `employeeId`) and the approver the handler records.
 */
const TimesheetSchema = new EntitySchema<ObjectLiteral>({
	name: 'Timesheet',
	tableName: 'timesheet',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true },
		status: { type: 'varchar', default: TimesheetStatus.PENDING },
		reason: { type: 'text', nullable: true },
		approvedById: { type: 'varchar', nullable: true },
		approvedAt: { type: 'datetime', nullable: true }
	},
	relations: {
		tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' } },
		employee: { type: 'many-to-one', target: 'Employee', joinColumn: { name: 'employeeId' } },
		approvedBy: { type: 'many-to-one', target: 'User', joinColumn: { name: 'approvedById' } }
	}
});

/** A signed-in caller: an employee of the organization, with the role's permissions. */
interface ICaller {
	id: string;
	employeeId: string;
	role: RolesEnum;
	permissions: PermissionsEnum[];
}

/** Manages `MANAGED_TEAM` and holds what the EMPLOYEE role holds for the status change. */
const TEAM_MANAGER: ICaller = {
	id: 'user-manager',
	employeeId: MANAGER,
	role: RolesEnum.EMPLOYEE,
	permissions: [PermissionsEnum.TIME_TRACKER]
};

/**
 * The same team manager under a role that also lets them pick any employee, still without
 * CAN_APPROVE_TIMESHEET. `RequestContext.currentEmployeeId()` answers null to such a caller.
 */
const SELECTING_TEAM_MANAGER: ICaller = {
	...TEAM_MANAGER,
	permissions: [PermissionsEnum.TIME_TRACKER, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
};

/** An admin who approves timesheets and is an employee of the organization too. */
const APPROVER_ADMIN: ICaller = {
	id: 'user-approver',
	employeeId: APPROVER,
	role: RolesEnum.ADMIN,
	permissions: [
		PermissionsEnum.CAN_APPROVE_TIMESHEET,
		PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
		PermissionsEnum.TIME_TRACKER
	]
};

/** The user each employee signs in as. */
const USER_OF_EMPLOYEE: Record<string, string> = {
	[MANAGER]: TEAM_MANAGER.id,
	[MEMBER]: MEMBER_USER,
	[OUTSIDER]: 'user-outsider',
	[APPROVER]: APPROVER_ADMIN.id
};

/** One in-memory database with the organization's people, their teams and one waiting timesheet each. */
interface IWorld {
	dataSource: DataSource;
	timesheets: Repository<ObjectLiteral>;
	service: TimeSheetService;
	managedEmployees: ManagedEmployeeService;
	handler: TimesheetUpdateStatusHandler;
	emails: { setTimesheetAction: jest.Mock };
}

/** The user row of one employee, with the address the timesheet e-mail goes to. */
function userRow(employeeId: string) {
	const id = USER_OF_EMPLOYEE[employeeId];
	const email = `${id}@example.com`;
	return { id, tenantId: TENANT, firstName: id, lastName: 'Example', email };
}

/** An employee row of the organization, signed in as its user. */
function employeeRow(employeeId: string) {
	const userId = USER_OF_EMPLOYEE[employeeId];
	return { id: employeeId, tenantId: TENANT, organizationId: ORGANIZATION, userId };
}

/** A team of the organization. */
function teamRow(id: string) {
	return { id, tenantId: TENANT, organizationId: ORGANIZATION };
}

/** An active membership of a team. */
function membershipRow(organizationTeamId: string, employeeId: string, isManager = false) {
	return { tenantId: TENANT, organizationId: ORGANIZATION, organizationTeamId, employeeId, isManager };
}

/** A waiting timesheet of one employee. */
function timesheetRow(id: string, employeeId: string) {
	return { id, tenantId: TENANT, organizationId: ORGANIZATION, employeeId, status: TimesheetStatus.PENDING };
}

async function world(): Promise<IWorld> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [
			TenantSchema,
			UserSchema,
			EmployeeSchema,
			OrganizationTeamSchema,
			OrganizationTeamEmployeeSchema,
			TimesheetSchema
		],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const tenants = dataSource.getRepository('Tenant');
	const users = dataSource.getRepository('User');
	const employees = dataSource.getRepository('Employee');
	const teams = dataSource.getRepository('OrganizationTeam');
	const memberships = dataSource.getRepository('OrganizationTeamEmployee');
	const timesheets = dataSource.getRepository('Timesheet');

	const people = [MANAGER, MEMBER, OUTSIDER, APPROVER];
	const userRows = people.map(userRow);
	const employeeRows = people.map(employeeRow);

	await tenants.save([{ id: TENANT }]);
	await users.save(userRows);
	await employees.save(employeeRows);
	await teams.save([teamRow(MANAGED_TEAM), teamRow(OTHER_TEAM)]);
	await memberships.save([
		membershipRow(MANAGED_TEAM, MANAGER, true),
		membershipRow(MANAGED_TEAM, MEMBER),
		membershipRow(OTHER_TEAM, MANAGER),
		membershipRow(OTHER_TEAM, OUTSIDER)
	]);
	await timesheets.save([
		timesheetRow(MANAGER_TIMESHEET, MANAGER),
		timesheetRow(MEMBER_TIMESHEET, MEMBER),
		timesheetRow(OUTSIDER_TIMESHEET, OUTSIDER),
		timesheetRow(APPROVER_TIMESHEET, APPROVER)
	]);

	const managedEmployees = new ManagedEmployeeService(memberships as never, {} as never);
	const service = new TimeSheetService(timesheets as never, {} as never, managedEmployees);
	const emails = { setTimesheetAction: jest.fn() };
	const handler = new TimesheetUpdateStatusHandler(service, emails as never);

	return { dataSource, timesheets, service, managedEmployees, handler, emails };
}

/** The status change both surfaces dispatch, with the body the clients send. */
function changeStatus(target: IWorld, ids: string[], status: TimesheetStatus, reason?: string): Promise<ITimesheet[]> {
	const input = { ids, status, reason, organizationId: ORGANIZATION } as IUpdateTimesheetStatusInput;
	const command = new TimesheetUpdateStatusCommand(input);
	return target.handler.execute(command);
}

/** Reads the member's timesheet through the service, as whoever is in context. */
function readMemberTimesheet(target: IWorld): Promise<ITimesheet[]> {
	const where = { id: In([MEMBER_TIMESHEET]) };
	return target.service.find({ where });
}

/** What a stored timesheet says about its review. */
async function stored(target: IWorld, id: string) {
	const row = await target.timesheets.findOneBy({ id });
	return { status: row.status, approvedById: row.approvedById, reason: row.reason };
}

/** The ids of the rows a read answered. */
function idsOf(rows: ITimesheet[]): string[] {
	return rows.map((row) => row.id);
}

describe('Timesheet status change by a team manager, on a real database', () => {
	// Stand-in for the per-request store the service's own-employee filter switch keeps its state in.
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];
	const worlds: IWorld[] = [];

	/** A fresh database, closed after the case. */
	const fresh = async () => {
		const created = await world();
		worlds.push(created);
		return created;
	};

	/** Runs the rest of the case as this signed-in user, inside one request. */
	const as = <R>(caller: ICaller, callback: () => Promise<R>): Promise<R> => {
		const user = {
			id: caller.id,
			tenantId: TENANT,
			employeeId: caller.employeeId,
			permissions: caller.permissions,
			role: { name: caller.role },
			// The organization of the caller's token, which `JwtStrategy` attaches after checking the membership.
			lastOrganizationId: ORGANIZATION
		};
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({ _req: { user } } as never);
		const store = new Map<string, unknown>();

		return requestStorage.run(store, callback);
	};

	/** What the services read and write through `RequestContext['clsService']`, kept per request. */
	const clsStandIn = {
		get(key: string) {
			const store = requestStorage.getStore();
			return store?.get(key);
		},
		set(key: string, value: unknown) {
			const store = requestStorage.getStore();
			store?.set(key, value);
		}
	};

	beforeEach(() => {
		RequestContext['clsService'] = clsStandIn as never;
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		RequestContext['clsService'] = originalClsService;
		const created = worlds.splice(0);
		for (const target of created) {
			if (target.dataSource.isInitialized) {
				await target.dataSource.destroy();
			}
		}
	});

	describe('TimeSheetService.forManagedEmployeeTimesheets', () => {
		const refusals: Array<[string, string[]]> = [
			['a timesheet of a colleague in a team the caller does not manage', [OUTSIDER_TIMESHEET]],
			['an id no timesheet of the organization has', [UNKNOWN_TIMESHEET]],
			['a list that names the caller’s own timesheet beside a member’s', [MEMBER_TIMESHEET, MANAGER_TIMESHEET]]
		];

		it.each(refusals)('refuses %s and never runs the change', async (_label, ids) => {
			const target = await fresh();
			const change = jest.fn();
			const changeTimesheets = () => target.service.forManagedEmployeeTimesheets(ids, ORGANIZATION, change);

			const refusal = as(TEAM_MANAGER, changeTimesheets);

			await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
			expect(change).not.toHaveBeenCalled();
		});

		it('refuses the caller’s own timesheet, which the team check alone would accept', async () => {
			const target = await fresh();
			const change = jest.fn();
			const checkOwnEmployee = () => target.managedEmployees.canManageEmployees([MANAGER]);
			const changeOwnTimesheet = () =>
				target.service.forManagedEmployeeTimesheets([MANAGER_TIMESHEET], ORGANIZATION, change);

			const teamCheckAcceptsOwn = await as(TEAM_MANAGER, checkOwnEmployee);
			const refusal = as(TEAM_MANAGER, changeOwnTimesheet);

			expect(teamCheckAcceptsOwn).toBe(true);
			await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
			expect(change).not.toHaveBeenCalled();
		});

		it('runs the change for a member of the team the caller manages, outside the caller’s own employee filter', async () => {
			const target = await fresh();
			const read = () => readMemberTimesheet(target);
			const readThroughTeamCheck = () =>
				target.service.forManagedEmployeeTimesheets([MEMBER_TIMESHEET], ORGANIZATION, read);

			const filtered = await as(TEAM_MANAGER, read);
			const reached = await as(TEAM_MANAGER, readThroughTeamCheck);

			// The same read by the same caller, outside the change, stays on the caller's own rows.
			const filteredIds = idsOf(filtered);
			const reachedIds = idsOf(reached);
			expect(filteredIds).toEqual([]);
			expect(reachedIds).toEqual([MEMBER_TIMESHEET]);
		});
	});

	describe('TimesheetUpdateStatusHandler', () => {
		it('records the team manager as the approver of a member’s timesheet and tells the member', async () => {
			const target = await fresh();
			const approveMember = () => changeStatus(target, [MEMBER_TIMESHEET], TimesheetStatus.APPROVED);

			const answered = await as(TEAM_MANAGER, approveMember);

			const member = await stored(target, MEMBER_TIMESHEET);
			expect(member).toEqual({ status: TimesheetStatus.APPROVED, approvedById: TEAM_MANAGER.id, reason: null });
			expect(answered).toHaveLength(1);
			expect(target.emails.setTimesheetAction).toHaveBeenCalledWith(MEMBER_EMAIL, expect.anything());
		});

		it('lets the team manager deny a member’s timesheet with the reason', async () => {
			const target = await fresh();
			const denyMember = () => changeStatus(target, [MEMBER_TIMESHEET], TimesheetStatus.DENIED, 'Missing hours');

			await as(TEAM_MANAGER, denyMember);

			const member = await stored(target, MEMBER_TIMESHEET);
			expect(member).toEqual({ status: TimesheetStatus.DENIED, approvedById: null, reason: 'Missing hours' });
		});

		it('refuses the team manager any status but approved or denied, and writes nothing', async () => {
			const target = await fresh();
			const draftMember = () => changeStatus(target, [MEMBER_TIMESHEET], TimesheetStatus.DRAFT);

			const refusal = as(TEAM_MANAGER, draftMember);

			await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
			const member = await stored(target, MEMBER_TIMESHEET);
			expect(member).toEqual(WAITING);
			expect(target.emails.setTimesheetAction).not.toHaveBeenCalled();
		});

		it('lets a team manager who also holds CHANGE_SELECTED_EMPLOYEE approve a member’s timesheet', async () => {
			const target = await fresh();
			const approveMember = () => changeStatus(target, [MEMBER_TIMESHEET], TimesheetStatus.APPROVED);

			await as(SELECTING_TEAM_MANAGER, approveMember);

			const member = await stored(target, MEMBER_TIMESHEET);
			expect(member).toEqual({ status: TimesheetStatus.APPROVED, approvedById: TEAM_MANAGER.id, reason: null });
		});

		// CHANGE_SELECTED_EMPLOYEE grants no approval: the team check and the own-timesheet refusal still decide.
		const selectingManagerRefusals: Array<[string, string]> = [
			['their own timesheet', MANAGER_TIMESHEET],
			['a timesheet of a colleague in a team they do not manage', OUTSIDER_TIMESHEET]
		];

		it.each(selectingManagerRefusals)(
			'still refuses a team manager who holds CHANGE_SELECTED_EMPLOYEE %s, and writes nothing',
			async (_label, id) => {
				const target = await fresh();
				const approve = () => changeStatus(target, [id], TimesheetStatus.APPROVED);

				const refusal = as(SELECTING_TEAM_MANAGER, approve);

				await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
				const timesheet = await stored(target, id);
				expect(timesheet).toEqual(WAITING);
			}
		);

		it('lets a CAN_APPROVE_TIMESHEET holder move any timesheet to any status, their own included, without the team check', async () => {
			const target = await fresh();
			const teamCheck = jest.spyOn(target.managedEmployees, 'canManageEmployees');
			const approveOwnAndOutsider = () =>
				changeStatus(target, [APPROVER_TIMESHEET, OUTSIDER_TIMESHEET], TimesheetStatus.APPROVED);
			const draftMember = () => changeStatus(target, [MEMBER_TIMESHEET], TimesheetStatus.DRAFT);

			await as(APPROVER_ADMIN, approveOwnAndOutsider);
			await as(APPROVER_ADMIN, draftMember);

			const approvedByAdmin = { status: TimesheetStatus.APPROVED, approvedById: APPROVER_ADMIN.id, reason: null };
			const own = await stored(target, APPROVER_TIMESHEET);
			const outsider = await stored(target, OUTSIDER_TIMESHEET);
			const member = await stored(target, MEMBER_TIMESHEET);
			expect(own).toEqual(approvedByAdmin);
			expect(outsider).toEqual(approvedByAdmin);
			expect(member).toEqual({ status: TimesheetStatus.DRAFT, approvedById: null, reason: null });
			expect(teamCheck).not.toHaveBeenCalled();
		});
	});
});

describe('Timesheet status change, who reaches it', () => {
	const approvalOrTimeTracker = [PermissionsEnum.CAN_APPROVE_TIMESHEET, PermissionsEnum.TIME_TRACKER];
	const approvalOnly = [PermissionsEnum.CAN_APPROVE_TIMESHEET];

	it('admits TIME_TRACKER beside CAN_APPROVE_TIMESHEET on the status route and mutation only', () => {
		const route = Reflect.getMetadata(PERMISSIONS_METADATA, TimeSheetController.prototype.updateTimesheetStatus);
		const mutation = Reflect.getMetadata(PERMISSIONS_METADATA, TimesheetResolver.prototype.updateTimesheetStatus);
		const controllerClass = Reflect.getMetadata(PERMISSIONS_METADATA, TimeSheetController);
		const resolverClass = Reflect.getMetadata(PERMISSIONS_METADATA, TimesheetResolver);

		expect(route).toEqual(approvalOrTimeTracker);
		expect(mutation).toEqual(approvalOrTimeTracker);
		expect(controllerClass).toEqual(approvalOnly);
		expect(resolverClass).toEqual(approvalOnly);
	});
});
