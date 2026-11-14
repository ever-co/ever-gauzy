// The dialect helpers read DB_TYPE once, when @gauzy/config loads: the entities map for the embedded database.
jest.mock('@gauzy/config', () => {
	process.env.DB_TYPE = 'better-sqlite3';
	return jest.requireActual('@gauzy/config');
});

import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import {
	ID,
	ITimeGoalCreateInput,
	ITimeGoalProgress,
	PermissionsEnum,
	TimeGoalComparisonEnum,
	TimeGoalPeriodEnum,
	TimeGoalScopeEnum,
	TimeGoalStateEnum,
	WeekDaysEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import {
	Employee,
	Organization,
	OrganizationContact,
	OrganizationProject,
	OrganizationProjectEmployee,
	OrganizationTeam,
	OrganizationTeamEmployee,
	Tenant,
	TimeGoal,
	TimeLog,
	User
} from '../../core/entities/internal';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TimeGoalService } from './time-goal.service';

/** Booting the whole entity graph on SQLite takes a while. */
const TIMEOUT = 600_000;
const HOUR = 3600;

const TENANT = '15000000-0000-4000-8000-000000000001';
const ORGANIZATION = '15000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION = '15000000-0000-4000-8000-000000000003';
const TEAM = '15000000-0000-4000-8000-000000000010';
const OTHER_TEAM = '15000000-0000-4000-8000-000000000011';
const MARIE = '15000000-0000-4000-8000-000000000020';
const PAUL = '15000000-0000-4000-8000-000000000021';
const MANAGER = '15000000-0000-4000-8000-000000000022';
const OUTSIDER = '15000000-0000-4000-8000-000000000023';
const ADMIN = '15000000-0000-4000-8000-000000000024';
const CLIENT_A = '15000000-0000-4000-8000-000000000030';
const CLIENT_A_WEBSITE = '15000000-0000-4000-8000-000000000040';
const MEETINGS = '15000000-0000-4000-8000-000000000041';
const OTHER_ORGANIZATION_PROJECT = '15000000-0000-4000-8000-000000000042';

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/int|number|numeric|decimal|real|float|double/.test(name)) return 0;
	if (/bool/.test(name)) return false;
	if (/date|time/.test(name)) return new Date('2026-01-01T00:00:00Z');
	if (/json/.test(name)) return {};
	return 'x';
}

describe('TimeGoalService on SQLite', () => {
	/** The request context a real request runs in: the base service keeps its bypasses there. */
	const cls = new ClsService(new AsyncLocalStorage());
	const originalClsService = RequestContext['clsService'];
	const inRequest = (work: () => Promise<void>) => () => cls.run(work);
	let dataSource: DataSource;
	let service: TimeGoalService;
	let logCount = 0;

	/** Inserts a row with the columns given and a placeholder in every other NOT NULL column without a default. */
	async function insertRow(entity: EntityTarget<ObjectLiteral>, row: Record<string, unknown>): Promise<void> {
		const metadata = dataSource.getMetadata(entity);
		const values: Record<string, unknown> = { ...row };
		for (const column of metadata.columns) {
			const needsNoValue =
				column.isNullable ||
				column.default !== undefined ||
				column.isGenerated ||
				column.isCreateDate ||
				column.isUpdateDate ||
				column.isVirtual ||
				!!column.relationMetadata;
			if (column.propertyName in values || needsNoValue) continue;
			values[column.propertyName] = placeholder(column.type);
		}
		await dataSource.createQueryBuilder().insert().into(entity).values(values).execute();
	}

	/** Acts as an employee of the organization, with the permissions given. */
	function actAs(employeeId: ID | null, permissions: PermissionsEnum[] = []): void {
		const actsForEveryEmployee = permissions.includes(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: `user-of-${employeeId}`,
			tenantId: TENANT,
			employeeId
		} as never);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(actsForEveryEmployee ? null : employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission as PermissionsEnum)
		);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
	}

	/** A time log of an employee, from a local time in Kinshasa (UTC+1) and for a number of hours. */
	async function track(
		employeeId: ID,
		date: string,
		time: string,
		hours: number,
		options: { projectId?: ID | null; isBillable?: boolean; running?: boolean } = {}
	): Promise<void> {
		const startedAt = new Date(`${date}T${time}:00+01:00`);
		const stoppedAt = options.running ? null : new Date(startedAt.getTime() + hours * HOUR * 1000);
		logCount++;
		await insertRow(TimeLog, {
			id: `15000000-0000-4000-9000-${String(logCount).padStart(12, '0')}`,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			employeeId,
			startedAt,
			stoppedAt,
			isRunning: options.running === true,
			isBillable: options.isBillable ?? true,
			projectId: options.projectId === undefined ? CLIENT_A_WEBSITE : options.projectId
		});
	}

	/** A goal, created as the actor in place. */
	async function goal(input: Partial<ITimeGoalCreateInput>) {
		return await service.createGoal({
			name: 'Goal',
			comparison: TimeGoalComparisonEnum.AT_LEAST,
			targetHours: 20,
			period: TimeGoalPeriodEnum.WEEK,
			scope: TimeGoalScopeEnum.EMPLOYEE,
			organizationId: ORGANIZATION,
			...input
		} as ITimeGoalCreateInput);
	}

	/** The progress rows of one employee, by goal name. */
	function rowsOf(progress: ITimeGoalProgress[], employeeId: ID): Record<string, ITimeGoalProgress> {
		return Object.fromEntries(
			progress.filter((row) => row.employeeId === employeeId).map((row) => [row.goal.name, row])
		);
	}

	beforeAll(async () => {
		RequestContext.setClsService(cls);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const { coreEntities } = require('../../core/entities');
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			synchronize: true,
			entities: coreEntities,
			logging: false
		});
		await dataSource.initialize();
		// Only the rows the goals read are written; the rest of each graph is irrelevant here.
		await dataSource.query('PRAGMA foreign_keys = OFF');

		await insertRow(Tenant, { id: TENANT, name: 'Tenant' });
		await insertRow(Organization, {
			id: ORGANIZATION,
			tenantId: TENANT,
			name: 'Studio',
			timeZone: 'Africa/Kinshasa',
			startWeekOn: WeekDaysEnum.MONDAY
		});
		await insertRow(Organization, { id: OTHER_ORGANIZATION, tenantId: TENANT, name: 'Labs' });
		for (const [id, timeZone] of [
			[MARIE, 'Africa/Kinshasa'],
			[PAUL, null],
			[MANAGER, 'Africa/Kinshasa'],
			[OUTSIDER, 'Africa/Kinshasa'],
			[ADMIN, 'Africa/Kinshasa']
		] as const) {
			await insertRow(User, { id: `user-of-${id}`, tenantId: TENANT, timeZone });
			await insertRow(Employee, { id, tenantId: TENANT, organizationId: ORGANIZATION, userId: `user-of-${id}` });
		}
		for (const id of [TEAM, OTHER_TEAM]) {
			await insertRow(OrganizationTeam, {
				id,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: id === TEAM ? 'Product' : 'Sales',
				isActive: true,
				isArchived: false
			});
		}
		const memberships: Array<[ID, ID, boolean]> = [
			[MARIE, TEAM, false],
			[PAUL, TEAM, false],
			[MANAGER, TEAM, true],
			[OUTSIDER, OTHER_TEAM, false]
		];
		for (const [employeeId, organizationTeamId, isManager] of memberships) {
			await insertRow(OrganizationTeamEmployee, {
				id: `15000000-0000-4000-a000-${employeeId.slice(-12)}`,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				organizationTeamId,
				employeeId,
				isManager,
				isActive: true,
				isArchived: false
			});
		}
		await insertRow(OrganizationContact, {
			id: CLIENT_A,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Client A'
		});
		await insertRow(OrganizationProject, {
			id: CLIENT_A_WEBSITE,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Client A website',
			organizationContactId: CLIENT_A
		});
		await insertRow(OrganizationProject, {
			id: MEETINGS,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Meetings'
		});
		await insertRow(OrganizationProject, {
			id: OTHER_ORGANIZATION_PROJECT,
			tenantId: TENANT,
			organizationId: OTHER_ORGANIZATION,
			name: 'Elsewhere'
		});

		const managedEmployees = new ManagedEmployeeService(
			dataSource.getRepository(OrganizationTeamEmployee) as never,
			dataSource.getRepository(OrganizationProjectEmployee) as never
		);
		service = new TimeGoalService(dataSource.getRepository(TimeGoal) as never, {} as never, managedEmployees);
	}, TIMEOUT);

	afterAll(async () => {
		RequestContext.setClsService(originalClsService);
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM "time_goal_project"');
		await dataSource.query('DELETE FROM "time_goal_organization_contact"');
		await dataSource.query('DELETE FROM "time_goal"');
		await dataSource.query('DELETE FROM "time_log"');
	});

	it(
		"counts Marie's hours on Client A this week: 12 of 20 by Wednesday, achieved with 21 by Friday",
		inRequest(async () => {
			actAs(MARIE);
			await goal({ name: 'Client A, at least 20 h a week', organizationContactIds: [CLIENT_A] });
			await track(MARIE, '2026-11-09', '09:00', 4);
			await track(MARIE, '2026-11-10', '09:00', 4);
			await track(MARIE, '2026-11-11', '09:00', 4);
			await track(MARIE, '2026-11-11', '14:00', 3, { projectId: MEETINGS });

			const wednesday = rowsOf(
				await service.getProgress({ organizationId: ORGANIZATION, date: '2026-11-11' }),
				MARIE
			)['Client A, at least 20 h a week'];
			expect(wednesday.trackedSeconds).toBe(12 * HOUR);
			expect(wednesday.targetSeconds).toBe(20 * HOUR);
			expect(wednesday.state).toBe(TimeGoalStateEnum.IN_PROGRESS);
			expect([wednesday.startDate, wednesday.endDate, wednesday.timeZone]).toEqual([
				'2026-11-09',
				'2026-11-15',
				'Africa/Kinshasa'
			]);

			await track(MARIE, '2026-11-12', '09:00', 5);
			await track(MARIE, '2026-11-13', '09:00', 4);

			const friday = rowsOf(
				await service.getProgress({ organizationId: ORGANIZATION, date: '2026-11-13' }),
				MARIE
			)['Client A, at least 20 h a week'];
			expect(friday.trackedSeconds).toBe(21 * HOUR);
			expect(friday.state).toBe(TimeGoalStateEnum.ACHIEVED);
		}),
		TIMEOUT
	);

	it(
		'turns "Meetings, at most 2 h a day" to exceeded on a day with 2 h 30 on Meetings, and on track on another',
		inRequest(async () => {
			actAs(MARIE);
			await goal({
				name: 'Meetings, at most 2 h a day',
				comparison: TimeGoalComparisonEnum.AT_MOST,
				targetHours: 2,
				period: TimeGoalPeriodEnum.DAY,
				projectIds: [MEETINGS]
			});
			await track(MARIE, '2026-11-10', '09:00', 2.5, { projectId: MEETINGS });
			await track(MARIE, '2026-11-10', '13:00', 4);

			const tuesday = rowsOf(
				await service.getProgress({ organizationId: ORGANIZATION, date: '2026-11-10' }),
				MARIE
			)['Meetings, at most 2 h a day'];
			expect(tuesday.trackedSeconds).toBe(2.5 * HOUR);
			expect(tuesday.state).toBe(TimeGoalStateEnum.EXCEEDED);
			expect([tuesday.startDate, tuesday.endDate]).toEqual(['2026-11-10', '2026-11-10']);

			const monday = rowsOf(
				await service.getProgress({ organizationId: ORGANIZATION, date: '2026-11-09' }),
				MARIE
			)['Meetings, at most 2 h a day'];
			expect(monday.trackedSeconds).toBe(0);
			expect(monday.state).toBe(TimeGoalStateEnum.ON_TRACK);
		}),
		TIMEOUT
	);

	it(
		'leaves non-billable time out of a billable-only goal, and counts a running timer up to now',
		inRequest(async () => {
			actAs(MARIE);
			await goal({ name: 'Billable', billableOnly: true });
			await goal({ name: 'All' });
			await track(MARIE, '2026-11-10', '09:00', 3);
			await track(MARIE, '2026-11-10', '13:00', 2, { isBillable: false });
			await track(MARIE, '2026-11-11', '09:00', 0, { running: true });

			const now = new Date('2026-11-11T09:30:00.000Z');
			const rows = rowsOf(
				await service.getProgress({ organizationId: ORGANIZATION, date: '2026-11-11' }, now),
				MARIE
			);

			expect(rows['Billable'].trackedSeconds).toBe(3 * HOUR + 1.5 * HOUR);
			expect(rows['All'].trackedSeconds).toBe(5 * HOUR + 1.5 * HOUR);
		}),
		TIMEOUT
	);

	it(
		"keeps Paul away from Marie's goals: no read, no change, no progress, no goal set for her",
		inRequest(async () => {
			actAs(MARIE);
			const marieGoal = await goal({ name: "Marie's goal" });
			await track(MARIE, '2026-11-10', '09:00', 4);

			actAs(PAUL);
			await expect(service.findGoal(marieGoal.id, ORGANIZATION)).rejects.toBeInstanceOf(NotFoundException);
			await expect(
				service.updateGoal(marieGoal.id, { organizationId: ORGANIZATION, targetHours: 1 })
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.deleteGoal(marieGoal.id, ORGANIZATION)).rejects.toBeInstanceOf(NotFoundException);
			await expect(goal({ name: 'For Marie', employeeId: MARIE })).rejects.toBeInstanceOf(ForbiddenException);

			const list = await service.findGoals({ organizationId: ORGANIZATION });
			expect(list.items.map(({ name }) => name)).toEqual([]);

			const progress = await service.getProgress({
				organizationId: ORGANIZATION,
				date: '2026-11-10',
				employeeIds: [MARIE]
			});
			expect(progress.filter(({ employeeId }) => employeeId === MARIE)).toEqual([]);
		}),
		TIMEOUT
	);

	it(
		"lets the team's manager read and change Marie's goals and read her progress",
		inRequest(async () => {
			actAs(MARIE);
			const marieGoal = await goal({ name: "Marie's goal" });
			await track(MARIE, '2026-11-10', '09:00', 4);

			actAs(MANAGER);
			expect((await service.findGoal(marieGoal.id, ORGANIZATION)).name).toBe("Marie's goal");
			expect((await service.findGoals({ organizationId: ORGANIZATION })).items.map(({ name }) => name)).toEqual([
				"Marie's goal"
			]);
			const updated = await service.updateGoal(marieGoal.id, { organizationId: ORGANIZATION, targetHours: 30 });
			expect(updated.targetHours).toBe(30);

			const progress = await service.getProgress({
				organizationId: ORGANIZATION,
				date: '2026-11-10',
				organizationTeamId: TEAM
			});
			const marie = rowsOf(progress, MARIE)["Marie's goal"];
			expect(marie.trackedSeconds).toBe(4 * HOUR);
			expect(marie.targetSeconds).toBe(30 * HOUR);

			const forMarie = await goal({ name: 'Set by the manager', employeeId: MARIE });
			expect(forMarie.employeeId).toBe(MARIE);
		}),
		TIMEOUT
	);

	it(
		"counts each member of a team in a team goal, set by the team's manager only",
		inRequest(async () => {
			actAs(MARIE);
			await expect(
				goal({ name: 'Team', scope: TimeGoalScopeEnum.TEAM, organizationTeamId: TEAM })
			).rejects.toBeInstanceOf(ForbiddenException);

			actAs(MANAGER);
			await expect(
				goal({ name: 'Other team', scope: TimeGoalScopeEnum.TEAM, organizationTeamId: OTHER_TEAM })
			).rejects.toBeInstanceOf(ForbiddenException);
			const teamGoal = await goal({ name: 'Team', scope: TimeGoalScopeEnum.TEAM, organizationTeamId: TEAM });
			expect([teamGoal.employeeId, teamGoal.organizationTeamId]).toEqual([null, TEAM]);
			await track(MARIE, '2026-11-10', '09:00', 4);
			await track(PAUL, '2026-11-10', '09:00', 2);

			const progress = await service.getProgress({
				organizationId: ORGANIZATION,
				date: '2026-11-10',
				organizationTeamId: TEAM
			});
			expect(rowsOf(progress, MARIE)['Team'].trackedSeconds).toBe(4 * HOUR);
			expect(rowsOf(progress, PAUL)['Team'].trackedSeconds).toBe(2 * HOUR);
			expect(rowsOf(progress, OUTSIDER)).toEqual({});

			actAs(PAUL);
			expect((await service.findGoals({ organizationId: ORGANIZATION })).items.map(({ name }) => name)).toEqual([
				'Team'
			]);
			actAs(OUTSIDER);
			expect((await service.findGoals({ organizationId: ORGANIZATION })).items).toEqual([]);
		}),
		TIMEOUT
	);

	it(
		'lets only someone who acts for every employee set an organization goal, which counts every member',
		inRequest(async () => {
			actAs(MANAGER);
			await expect(goal({ name: 'Everyone', scope: TimeGoalScopeEnum.ORGANIZATION })).rejects.toBeInstanceOf(
				ForbiddenException
			);

			actAs(ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			await goal({ name: 'Everyone', scope: TimeGoalScopeEnum.ORGANIZATION });

			actAs(OUTSIDER);
			const own = await service.getProgress({ organizationId: ORGANIZATION, date: '2026-11-10' });
			expect(Object.keys(rowsOf(own, OUTSIDER))).toEqual(['Everyone']);
		}),
		TIMEOUT
	);

	it(
		'archives a goal out of the list and the progress, and restores it',
		inRequest(async () => {
			actAs(MARIE);
			const marieGoal = await goal({ name: 'Archived' });

			await service.archiveGoal(marieGoal.id, ORGANIZATION);
			expect((await service.findGoals({ organizationId: ORGANIZATION })).items).toEqual([]);
			expect(
				(await service.findGoals({ organizationId: ORGANIZATION, includeArchived: true })).items.map(
					({ isArchived }) => isArchived
				)
			).toEqual([true]);
			expect(await service.getProgress({ organizationId: ORGANIZATION, date: '2026-11-10' })).toEqual([]);

			await service.restoreGoal(marieGoal.id, ORGANIZATION);
			expect((await service.findGoals({ organizationId: ORGANIZATION })).items.map(({ name }) => name)).toEqual([
				'Archived'
			]);
		}),
		TIMEOUT
	);

	it(
		'updates the projects of a goal, and deletes a goal with its links',
		inRequest(async () => {
			actAs(MARIE);
			const marieGoal = await goal({
				name: 'Linked',
				projectIds: [MEETINGS],
				organizationContactIds: [CLIENT_A]
			});
			expect(marieGoal.projects?.map(({ id }) => id)).toEqual([MEETINGS]);

			const updated = await service.updateGoal(marieGoal.id, {
				organizationId: ORGANIZATION,
				projectIds: [CLIENT_A_WEBSITE]
			});
			expect(updated.projects?.map(({ id }) => id)).toEqual([CLIENT_A_WEBSITE]);
			expect(updated.organizationContacts?.map(({ id }) => id)).toEqual([CLIENT_A]);

			// The links go with the goal through their foreign keys, which this database otherwise leaves off.
			await dataSource.query('PRAGMA foreign_keys = ON');
			await service.deleteGoal(marieGoal.id, ORGANIZATION);
			await dataSource.query('PRAGMA foreign_keys = OFF');
			expect(await dataSource.getRepository(TimeGoal).count()).toBe(0);
			const [{ count }] = await dataSource.query('SELECT COUNT(*) AS count FROM "time_goal_project"');
			expect(Number(count)).toBe(0);
		}),
		TIMEOUT
	);

	it(
		'refuses a target over its period, a team goal without its team, and a project of another organization',
		inRequest(async () => {
			actAs(MARIE);
			await expect(goal({ period: TimeGoalPeriodEnum.DAY, targetHours: 25 })).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(goal({ scope: TimeGoalScopeEnum.TEAM })).rejects.toBeInstanceOf(BadRequestException);
			await expect(goal({ projectIds: [OTHER_ORGANIZATION_PROJECT] })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(await dataSource.getRepository(TimeGoal).count()).toBe(0);
		}),
		TIMEOUT
	);
});
