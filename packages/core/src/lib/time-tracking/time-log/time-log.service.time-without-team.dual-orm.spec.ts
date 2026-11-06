import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
	IReportDayGroupByClient,
	IReportDayGroupByDate,
	IReportDayGroupByEmployee,
	IReportDayGroupByProject,
	IReportDayTaskRow
} from '@gauzy/contracts';

/**
 * A team-scoped report counts the logs filed under the team. A member who tracked from a client that sent no team
 * (the desktop timer, the agent) left logs under no team at all, and no team-scoped report showed them to the team's
 * manager. With `includeTimeWithoutTeam`, the report also counts the time the members of the caller's teams logged
 * without a team, and the daily report states each row's team so a client can group that time as "No team". Without
 * it, a report answers exactly as before.
 *
 * Run on one SQLite database with the tables TypeORM creates, through both ORMs, with the real manager rules
 * (`ManagedEmployeeService`) over the stored memberships. The entities are imported under `DB_ORM=mikro-orm`, as in
 * `time-log.service.reports.dual-orm.spec.ts`.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const MANAGER = '44444444-4444-4444-8444-444444444441';
const MEMBER = '44444444-4444-4444-8444-444444444442';
const OUTSIDER = '44444444-4444-4444-8444-444444444443';
const LONER = '44444444-4444-4444-8444-444444444444';
const TEAM_MANAGED = '55555555-5555-4555-8555-555555555551';
const TEAM_OTHER = '55555555-5555-4555-8555-555555555552';
const DAY = '2026-01-10';
const CONTACT = '99999999-9999-4999-8999-999999999991';

/**
 * The client members a daily report row states, as the shared contract types them. A `Record` over the contract's
 * keys, so widening or narrowing the type without this list fails the typecheck.
 */
const ROW_CLIENT_MEMBERS: Record<keyof NonNullable<IReportDayTaskRow['client']>, true> = {
	id: true,
	name: true,
	imageUrl: true
};

/** The logs, by what they show in the report: who, under which team, and for how long. */
const LOGS = {
	memberInTeam: { employeeId: MEMBER, organizationTeamId: TEAM_MANAGED, minutes: 50 },
	memberWithoutTeam: { employeeId: MEMBER, organizationTeamId: null, minutes: 40 },
	managerWithoutTeam: { employeeId: MANAGER, organizationTeamId: null, minutes: 30 },
	outsiderWithoutTeam: { employeeId: OUTSIDER, organizationTeamId: null, minutes: 20 },
	outsiderInOtherTeam: { employeeId: OUTSIDER, organizationTeamId: TEAM_OTHER, minutes: 15 },
	lonerWithoutTeam: { employeeId: LONER, organizationTeamId: null, minutes: 10 }
};

type LogName = keyof typeof LOGS;

/** What one caller's reads answered, or how they failed. */
interface ICallerReads {
	listOff: any;
	listOn: any;
	dailyOff: any;
	dailyOn: any;
	byEmployeeOn: any;
	byClientOn: any;
	byProjectOn: any;
	ownTimeOn: any;
}

type Reads = Record<'manager' | 'organizationWide', ICallerReads>;

/** The log names a list answered, from the description each log is stored with. */
function namesOf(list: any): LogName[] {
	return list.map((log: any) => log.description).sort();
}

/** Every task row of a daily report grouped by date, as the shared report contract types it. */
function taskRowsOf(daily: IReportDayGroupByDate[]): IReportDayTaskRow[] {
	const projects = daily.flatMap((day) => day.logs);
	const employeeLogs = projects.flatMap((project) => project.employeeLogs);
	return employeeLogs.flatMap((employeeLog) => employeeLog.tasks);
}

/** Every task row of a daily report grouped by employee, as the shared report contract types it. */
function employeeTaskRowsOf(daily: IReportDayGroupByEmployee[]): IReportDayTaskRow[] {
	const days = daily.flatMap((employee) => employee.logs);
	const projectLogs = days.flatMap((day) => day.projectLogs);
	return projectLogs.flatMap((projectLog) => projectLog.tasks);
}

/** Every task row of a daily report grouped by project, as the shared report contract types it. */
function projectTaskRowsOf(daily: IReportDayGroupByProject[]): IReportDayTaskRow[] {
	const days = daily.flatMap((project) => project.logs);
	const employeeLogs = days.flatMap((day) => day.employeeLogs);
	return employeeLogs.flatMap((employeeLog) => employeeLog.tasks);
}

/** Every task row of a daily report grouped by client, as the shared report contract types it. */
function clientTaskRowsOf(daily: IReportDayGroupByClient[]): IReportDayTaskRow[] {
	const projects: IReportDayGroupByClient['logs'] = daily.flatMap((client) => client.logs);
	const days = projects.flatMap((project) => project.logs);
	const employeeLogs = days.flatMap((day) => day.projectLogs);
	return employeeLogs.flatMap((employeeLog) => employeeLog.tasks);
}

/** Each row's team, by the log it reports. */
function teamByRow(rows: IReportDayTaskRow[]): Record<string, string | null> {
	const entries = rows.map((row) => [row.description, row.organizationTeamId]);
	return Object.fromEntries(entries);
}

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-without-team-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as { mikroOrm: Reads; typeOrm: Reads };
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { PermissionsEnum } = require('@gauzy/contracts');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../core/utils');
			const { CrudService } = require('../../core/crud/crud.service');
			const { RequestContext } = require('../../core/context');
			const { ManagedEmployeeService } = require('../../employee/managed-employee.service');
			const { TimeLog } = require('./time-log.entity');
			const { TimeLogService } = require('./time-log.service');
			const { MikroOrmTimeLogRepository } = require('./repository/mikro-orm-time-log.repository');
			const {
				GetTimeLogGroupByClientCommand,
				GetTimeLogGroupByDateCommand,
				GetTimeLogGroupByEmployeeCommand,
				GetTimeLogGroupByProjectCommand
			} = require('./commands');
			const { GetTimeLogGroupByDateHandler } = require('./commands/handlers/get-time-log-group-by-date.handler');
			const {
				GetTimeLogGroupByEmployeeHandler
			} = require('./commands/handlers/get-time-log-group-by-employee.handler');
			const {
				GetTimeLogGroupByClientHandler
			} = require('./commands/handlers/get-time-log-group-by-client.handler');
			const {
				GetTimeLogGroupByProjectHandler
			} = require('./commands/handlers/get-time-log-group-by-project.handler');
			const {
				OrganizationTeamEmployee
			} = require('../../organization-team-employee/organization-team-employee.entity');
			const {
				OrganizationProjectEmployee
			} = require('../../organization-project/organization-project-employee.entity');

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();

			// The custom-fields placeholder column the migrations add (`AlterCustomFieldsDefaultColumn`), which
			// synchronize leaves out because the bootstrap registers custom fields with TypeORM, not the decorators.
			for (const table of [
				'employee',
				'organization_team',
				'organization_project',
				'organization_contact',
				'task'
			]) {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
					await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
				}
			}

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					values[column.name] = /int|bool|numeric|decimal|real|float/.test(type)
						? 0
						: /date|time/.test(type)
							? '2026-01-01 00:00:00'
							: 'x';
				}
				const keys = Object.keys(values);
				await dataSource.query(
					`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys
						.map(() => '?')
						.join(', ')})`,
					keys.map((key) => values[key])
				);
			};

			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await dataSource.query('PRAGMA foreign_keys = OFF');
			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization', currency: 'EUR' });
			await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
			for (const id of [MANAGER, MEMBER, OUTSIDER, LONER]) {
				await insert('employee', { ...scope, id, userId: USER });
			}
			await insert('organization_contact', { ...scope, id: CONTACT, name: 'Acme' });
			await insert('organization_team', { ...scope, id: TEAM_MANAGED, name: 'Managed' });
			await insert('organization_team', { ...scope, id: TEAM_OTHER, name: 'Other' });
			const memberships: Array<[string, string, boolean]> = [
				[MANAGER, TEAM_MANAGED, true],
				[MEMBER, TEAM_MANAGED, false],
				[OUTSIDER, TEAM_OTHER, false]
			];
			for (const [index, [employeeId, organizationTeamId, isManager]] of memberships.entries()) {
				await insert('organization_team_employee', {
					...scope,
					id: `66666666-6666-4666-8666-66666666666${index}`,
					employeeId,
					organizationTeamId,
					isManager,
					isActive: true,
					isArchived: false
				});
			}

			for (const [index, [name, log]] of Object.entries(LOGS).entries()) {
				const id = `77777777-7777-4777-8777-77777777777${index}`;
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				const startedAt = `${DAY} 0${index}:00:00`;
				const stoppedAt = `${DAY} 0${index}:${String(log.minutes).padStart(2, '0')}:00`;
				await insert('time_log', {
					...scope,
					id,
					employeeId: log.employeeId,
					organizationTeamId: log.organizationTeamId,
					organizationContactId: CONTACT,
					description: name,
					startedAt,
					stoppedAt
				});
				await insert('time_slot', { ...scope, id: slot, employeeId: log.employeeId, startedAt });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: id });
			}

			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

			const managedEmployees = new ManagedEmployeeService(
				dataSource.getRepository(OrganizationTeamEmployee),
				dataSource.getRepository(OrganizationProjectEmployee)
			);
			const handlers: Array<[new (...args: any[]) => unknown, { execute(command: unknown): Promise<unknown> }]> =
				[
					[GetTimeLogGroupByDateCommand, new GetTimeLogGroupByDateHandler()],
					[GetTimeLogGroupByEmployeeCommand, new GetTimeLogGroupByEmployeeHandler()],
					[GetTimeLogGroupByClientCommand, new GetTimeLogGroupByClientHandler()],
					[GetTimeLogGroupByProjectCommand, new GetTimeLogGroupByProjectHandler()]
				];
			const commandBus = {
				execute: async (command: unknown) => {
					const handler = handlers.find(([type]) => command instanceof type)?.[1];
					if (!handler) {
						throw new Error('Unexpected command');
					}
					return await handler.execute(command);
				}
			};
			const service = (mikroOrmRepository: unknown) =>
				new TimeLogService(
					dataSource.getRepository(TimeLog),
					mikroOrmRepository,
					{} as any,
					{} as any,
					{} as any,
					commandBus as any,
					managedEmployees
				);

			const period = {
				organizationId: ORGANIZATION,
				startDate: '2026-01-01T00:00:00.000Z',
				endDate: '2026-01-31T00:00:00.000Z',
				timeZone: 'UTC'
			};

			/** Reads the list and the daily report as one caller, without and with the time without a team. */
			const readsAs = async (target: () => any, request: Record<string, unknown>): Promise<ICallerReads> => {
				const read = async (run: () => Promise<any>) => {
					try {
						return JSON.parse(JSON.stringify(await run()));
					} catch (error) {
						return { error: (error as Error).message };
					}
				};
				const off = { ...period, ...request };
				const on = { ...off, includeTimeWithoutTeam: true };
				return {
					listOff: await read(() => target().getTimeLogs(off)),
					listOn: await read(() => target().getTimeLogs(on)),
					dailyOff: await read(() => target().getDailyReport(off)),
					dailyOn: await read(() => target().getDailyReport(on)),
					byEmployeeOn: await read(() => target().getDailyReport({ ...on, groupBy: 'employee' })),
					byClientOn: await read(() => target().getDailyReport({ ...on, groupBy: 'client' })),
					byProjectOn: await read(() => target().getDailyReport({ ...on, groupBy: 'project' })),
					ownTimeOn: await read(() => target().getTimeLogs({ ...on, employeeIds: [MANAGER] }))
				};
			};

			/** As the manager of one team, without CHANGE_SELECTED_EMPLOYEE, then as an organization-wide caller. */
			const reads = async (target: () => any): Promise<Reads> => {
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
					id: USER,
					tenantId: TENANT,
					employeeId: MANAGER
				} as any);
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
				const manager = await readsAs(target, { teamIds: [TEAM_MANAGED], employeeIds: [MANAGER, MEMBER] });

				jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
					(permission: unknown) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				);
				const organizationWide = await readsAs(target, { teamIds: [TEAM_MANAGED] });
				return { manager, organizationWide };
			};

			const mikroOrm = await MikroORM.init({
				...dbMikroOrmConnectionConfig,
				dbName: file,
				entities: coreEntities,
				allowGlobalContext: true,
				colors: false,
				discovery: { warnWhenNoEntities: false }
			});
			try {
				measurement.mikroOrm = await reads(() =>
					service(new MikroOrmTimeLogRepository(mikroOrm.em.fork(), TimeLog))
				);
			} finally {
				await mikroOrm.close(true);
			}

			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			measurement.typeOrm = await reads(() => service(undefined));
		});
	} finally {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		try {
			fs.unlinkSync(file);
		} catch {
			// Nothing to remove: the database was never created.
		}
	}

	return measurement;
}

describe('TimeLogService team-scoped reports with the time logged without a team', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	it('answers each row client with every member the shared contract states, and TypeORM with no contact details', () => {
		const contractMembers = Object.keys(ROW_CLIENT_MEMBERS);

		for (const orm of ['mikroOrm', 'typeOrm'] as const) {
			const client = taskRowsOf(measured[orm].manager.dailyOn)[0].client;
			expect(client).toMatchObject({ id: CONTACT, name: 'Acme' });
			expect(Object.keys(client)).toEqual(expect.arrayContaining(contractMembers));
		}
		const typeOrmClient = taskRowsOf(measured.typeOrm.manager.dailyOn)[0].client;
		expect(typeOrmClient.imageUrl).toBeNull();
		expect(typeOrmClient).not.toHaveProperty('primaryEmail');
		expect(typeOrmClient).not.toHaveProperty('contactType');
	});

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it("answers only the team's logs without the parameter, with rows that state no team", () => {
			for (const caller of ['manager', 'organizationWide'] as const) {
				const { listOff, dailyOff } = measured[orm][caller];
				expect(listOff.error).toBeUndefined();
				expect(namesOf(listOff)).toEqual(['memberInTeam']);

				expect(dailyOff.error).toBeUndefined();
				const rows = taskRowsOf(dailyOff);
				expect(rows.map((row) => row.description)).toEqual(['memberInTeam']);
				expect(rows[0]).not.toHaveProperty('organizationTeamId');
			}
		});

		it("adds the time the manager's members logged without a team, and no one else's", () => {
			const { listOn } = measured[orm].manager;
			expect(listOn.error).toBeUndefined();
			expect(namesOf(listOn)).toEqual(['managerWithoutTeam', 'memberInTeam', 'memberWithoutTeam']);

			const teamByLog = Object.fromEntries(listOn.map((log: any) => [log.description, log.organizationTeamId]));
			expect(teamByLog).toEqual({
				memberInTeam: TEAM_MANAGED,
				memberWithoutTeam: null,
				managerWithoutTeam: null
			});
		});

		it("keeps the employees the report asks for, without the other members' time without a team", () => {
			for (const caller of ['manager', 'organizationWide'] as const) {
				const { ownTimeOn } = measured[orm][caller];
				expect(ownTimeOn.error).toBeUndefined();
				expect(namesOf(ownTimeOn)).toEqual(['managerWithoutTeam']);
			}
		});

		it('answers the groups of time without a project with no project, in every grouping', () => {
			const { dailyOn, byEmployeeOn, byClientOn, byProjectOn } = measured[orm].manager;
			const byDate: IReportDayGroupByDate[] = dailyOn;
			const byEmployee: IReportDayGroupByEmployee[] = byEmployeeOn;
			const byClient: IReportDayGroupByClient[] = byClientOn;
			const byProject: IReportDayGroupByProject[] = byProjectOn;
			expect(byProjectOn.error).toBeUndefined();

			expect(byDate[0].logs[0].project).toBeNull();
			expect(byEmployee[0].logs[0].projectLogs[0].project).toBeNull();
			expect(byClient[0].logs[0].project).toBeNull();
			expect(byProject).toHaveLength(1);
			expect(byProject[0].project).toBeNull();
		});

		it("adds the requested team's members' time without a team for an organization-wide caller, and no one else's", () => {
			const { listOn } = measured[orm].organizationWide;
			expect(listOn.error).toBeUndefined();
			expect(namesOf(listOn)).toEqual(['managerWithoutTeam', 'memberInTeam', 'memberWithoutTeam']);
		});

		it('states each row team in the employee, client and project groupings, along the paths the contract types', () => {
			const expected = { memberInTeam: TEAM_MANAGED, memberWithoutTeam: null, managerWithoutTeam: null };
			const { byEmployeeOn, byClientOn, byProjectOn } = measured[orm].manager;
			expect(byEmployeeOn.error).toBeUndefined();
			expect(byClientOn.error).toBeUndefined();
			expect(byProjectOn.error).toBeUndefined();

			expect(teamByRow(employeeTaskRowsOf(byEmployeeOn))).toEqual(expected);
			expect(teamByRow(clientTaskRowsOf(byClientOn))).toEqual(expected);
			expect(teamByRow(projectTaskRowsOf(byProjectOn))).toEqual(expected);
		});

		it('states each daily report row team, null for the time without a team', () => {
			for (const caller of ['manager', 'organizationWide'] as const) {
				const { dailyOn } = measured[orm][caller];
				expect(dailyOn.error).toBeUndefined();
				const teamByRow = Object.fromEntries(
					taskRowsOf(dailyOn).map((row) => [row.description, row.organizationTeamId])
				);
				expect(teamByRow).toEqual({
					memberInTeam: TEAM_MANAGED,
					memberWithoutTeam: null,
					managerWithoutTeam: null
				});
			}
		});
	});
});
