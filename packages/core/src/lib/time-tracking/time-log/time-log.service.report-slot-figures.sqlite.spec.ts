import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The time-log reports (daily, weekly, daily chart, owed amount, weekly limit) on a real SQLite database: the slots
 * are no longer joined onto the log rows (a row per log × slot, squared where the slots were also loaded), the logs
 * are filtered with an EXISTS sub-query and the slots' figures loaded apart. The numbers must be the ones the joins
 * produced, so the fixture holds every case the join semantics decided:
 *
 * - a log is reported when at least one of its slots (not deleted, of the organization) is in the activity range;
 * - a log's activity is averaged over ALL its slots that are not deleted, whatever the activity range (the joined
 *   relation carried the soft-delete condition only);
 * - a slot linked to two logs (it spans their boundary) counts under both;
 * - a log without slots, a deleted log and a deleted slot are left out.
 *
 * The expected figures are worked out by hand from the fixture, as the joins answered them.
 */
const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USERS = ['44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442'];
const EMPLOYEES = ['55555555-5555-4555-8555-555555555551', '55555555-5555-4555-8555-555555555552'];
const PROJECT = '66666666-6666-4666-8666-666666666661';
const LOGS = ['77777777-7777-4777-8777-777777777771', '77777777-7777-4777-8777-777777777772', '77777777-7777-4777-8777-777777777773', '77777777-7777-4777-8777-777777777774', '77777777-7777-4777-8777-777777777775', '77777777-7777-4777-8777-777777777776'];
const SLOTS = ['88888888-8888-4888-8888-888888888881', '88888888-8888-4888-8888-888888888882', '88888888-8888-4888-8888-888888888883', '88888888-8888-4888-8888-888888888884', '88888888-8888-4888-8888-888888888885', '88888888-8888-4888-8888-888888888886'];

type Measured = {
	daily: any;
	dailyNarrow: any;
	dailyByEmployee: any;
	weekly: any;
	chart: any;
	owed: any;
	statements: { daily: string[]; weekly: string[]; chart: string[] };
};

async function measure(): Promise<Measured> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'typeorm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-log-report-slots-${process.pid}-${Date.now()}.sqlite3`);
	const measured = { statements: {} } as Measured;
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { DataSource } = require('typeorm');
			const { MultiORMEnum } = require('../../core/utils');
			const { CrudService } = require('../../core/crud/crud.service');
			const { RequestContext } = require('../../core/context');
			const { TimeLog } = require('./time-log.entity');
			const { TimeLogService } = require('./time-log.service');
			const { GetTimeLogGroupByDateHandler } = require('./commands/handlers/get-time-log-group-by-date.handler');
			const { GetTimeLogGroupByEmployeeHandler } = require('./commands/handlers/get-time-log-group-by-employee.handler');
			const { GetTimeLogGroupByDateCommand } = require('./commands/get-time-log-group-by-date.command');
			const { GetTimeLogGroupByEmployeeCommand } = require('./commands/get-time-log-group-by-employee.command');

			const statements: string[] = [];
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true,
				logging: true,
				logger: {
					logQuery: (query: string) => statements.push(query),
					logQueryError: () => undefined,
					logQuerySlow: () => undefined,
					logSchemaBuild: () => undefined,
					logMigration: () => undefined,
					log: () => undefined
				}
			});
			await dataSource.initialize();

			// The custom-fields placeholder column the migrations add, which synchronize leaves out.
			for (const table of ['employee', 'time_log', 'time_slot', 'organization_project']) {
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
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('organization_project', { ...scope, id: PROJECT, name: 'Project' });
			for (const [index, name] of ['Ada', 'Grace'].entries()) {
				await insert('user', { id: USERS[index], tenantId: TENANT, firstName: name, lastName: 'L' });
				await insert('employee', { ...scope, id: EMPLOYEES[index], userId: USERS[index] });
			}

			// Logs (UTC). L1 Ada 09:00–10:00 (3600 s), L2 Ada 14:00–14:30 (1800 s), L3 Grace 14:25–15:00 (2100 s), all on
			// 2026-03-02; L4 Grace 2026-03-03 10:00–11:00 MANUAL without slots; L5 Ada 2026-03-03 09:00–09:20 (1200 s);
			// L6 Ada 2026-03-03 12:00–13:00, deleted.
			const logs: Array<[string, string, string, string, string, string | null]> = [
				[LOGS[0], EMPLOYEES[0], '2026-03-02 09:00:00', '2026-03-02 10:00:00', 'TRACKED', null],
				[LOGS[1], EMPLOYEES[0], '2026-03-02 14:00:00', '2026-03-02 14:30:00', 'TRACKED', null],
				[LOGS[2], EMPLOYEES[1], '2026-03-02 14:25:00', '2026-03-02 15:00:00', 'TRACKED', null],
				[LOGS[3], EMPLOYEES[1], '2026-03-03 10:00:00', '2026-03-03 11:00:00', 'MANUAL', null],
				[LOGS[4], EMPLOYEES[0], '2026-03-03 09:00:00', '2026-03-03 09:20:00', 'TRACKED', null],
				[LOGS[5], EMPLOYEES[0], '2026-03-03 12:00:00', '2026-03-03 13:00:00', 'TRACKED', '2026-03-04 00:00:00']
			];
			for (const [id, employeeId, startedAt, stoppedAt, logType, deletedAt] of logs) {
				await insert('time_log', {
					...scope,
					id,
					employeeId,
					projectId: PROJECT,
					startedAt,
					stoppedAt,
					logType,
					source: 'DESKTOP',
					isBillable: 1,
					isRunning: 0,
					description: `log ${id.slice(-1)}`,
					...(deletedAt ? { deletedAt } : {})
				});
			}
			// Slots (overall / duration, each 600 s): S1 300 and S2 100 on L1, S3 0 on L1 but deleted; S4 500 on L2 AND L3
			// (it spans their boundary); S5 50 on L3; S6 600 on L5. L4 has none.
			const slots: Array<[string, string, string, number, string | null]> = [
				[SLOTS[0], EMPLOYEES[0], '2026-03-02 09:00:00', 300, null],
				[SLOTS[1], EMPLOYEES[0], '2026-03-02 09:10:00', 100, null],
				[SLOTS[2], EMPLOYEES[0], '2026-03-02 09:20:00', 0, '2026-03-02 09:30:00'],
				[SLOTS[3], EMPLOYEES[0], '2026-03-02 14:20:00', 500, null],
				[SLOTS[4], EMPLOYEES[1], '2026-03-02 14:30:00', 50, null],
				[SLOTS[5], EMPLOYEES[0], '2026-03-03 09:00:00', 600, null]
			];
			for (const [id, employeeId, startedAt, overall, deletedAt] of slots) {
				await insert('time_slot', {
					...scope,
					id,
					employeeId,
					startedAt,
					duration: 600,
					overall,
					keyboard: 0,
					mouse: 0,
					...(deletedAt ? { deletedAt } : {})
				});
			}
			for (const [timeSlotId, timeLogId] of [
				[SLOTS[0], LOGS[0]],
				[SLOTS[1], LOGS[0]],
				[SLOTS[2], LOGS[0]],
				[SLOTS[3], LOGS[1]],
				[SLOTS[3], LOGS[2]],
				[SLOTS[4], LOGS[2]],
				[SLOTS[5], LOGS[4]]
			]) {
				await insert('time_slot_time_logs', { timeSlotId, timeLogId });
			}

			// Ada, who may read every employee's time.
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USERS[0],
				tenantId: TENANT,
				employeeId: EMPLOYEES[0]
			} as any);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEES[0]);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

			const commandBus = {
				execute: async (command: any) => {
					if (command instanceof GetTimeLogGroupByDateCommand) return new GetTimeLogGroupByDateHandler().execute(command);
					if (command instanceof GetTimeLogGroupByEmployeeCommand) return new GetTimeLogGroupByEmployeeHandler().execute(command);
					throw new Error(`unexpected command ${command?.constructor?.name}`);
				}
			};
			const service = new TimeLogService(
				dataSource.getRepository(TimeLog),
				{} as any,
				{} as any,
				{} as any,
				{} as any,
				commandBus as any,
				{ canManageEmployees: async () => true } as any
			);

			const request = {
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				startDate: '2026-03-01T00:00:00.000Z',
				endDate: '2026-03-06T00:00:00.000Z',
				timeZone: 'Etc/UTC',
				activityLevel: { start: 0, end: 100 }
			};
			const read = async <T>(run: () => Promise<T>): Promise<{ result: T; statements: string[] }> => {
				statements.length = 0;
				const result = await run();
				return { result, statements: [...statements] };
			};

			const daily = await read(() => service.getDailyReport({ ...request, groupBy: 'date' } as any));
			measured.daily = daily.result;
			measured.statements.daily = daily.statements;
			measured.dailyNarrow = (
				await read(() => service.getDailyReport({ ...request, groupBy: 'date', activityLevel: { start: 0, end: 50 } } as any))
			).result;
			measured.dailyByEmployee = (await read(() => service.getDailyReport({ ...request, groupBy: 'employee' } as any))).result;
			const weekly = await read(() => service.getWeeklyReport(request as any));
			measured.weekly = weekly.result;
			measured.statements.weekly = weekly.statements;
			const chart = await read(() => service.getDailyReportCharts(request as any));
			measured.chart = chart.result;
			measured.statements.chart = chart.statements;
			measured.owed = (await read(() => service.getOwedAmountReport(request as any))).result;
		});
	} finally {
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(file, { force: true });
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		jest.restoreAllMocks();
	}
	return measured;
}

describe('time-log reports on SQLite: the slots are loaded apart, the figures are the joins’', () => {
	let measured: Measured;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	const day = (report: any[], date: string) => report.find((row) => row.date === date);

	it('daily report by date: every log with a slot in range, the activity over all of each log’s live slots', () => {
		expect(measured.daily.map((row: any) => row.date)).toEqual(['2026-03-02', '2026-03-03']);

		// 2026-03-02: L1 (3600) + L2 (1800) + L3 (2100); slots S1, S2 | S4 | S4, S5 → (300+100+500+500+50) / (5 × 600)
		const march2 = day(measured.daily, '2026-03-02');
		expect(march2.sum).toBe(7500);
		expect(march2.activity).toBe(48.33);
		expect(march2.logs).toHaveLength(1);
		expect(march2.logs[0].project.id).toBe(PROJECT);
		const [ada, grace] = march2.logs[0].employeeLogs.sort((a: any, b: any) => a.employee.id.localeCompare(b.employee.id));
		expect(ada.employee.user.firstName).toBe('Ada');
		expect(ada.sum).toBe(5400);
		expect(ada.activity).toBe(50); // S1, S2, S4 → 900 / 1800
		expect(ada.tasks.map((task: any) => task.duration)).toEqual([3600, 1800]);
		expect(grace.employee.user.firstName).toBe('Grace');
		expect(grace.sum).toBe(2100);
		expect(grace.activity).toBe(45.83); // S4, S5 → 550 / 1200

		// 2026-03-03: L5 only (L4 has no slot, L6 is deleted)
		const march3 = day(measured.daily, '2026-03-03');
		expect(march3.sum).toBe(1200);
		expect(march3.activity).toBe(100);
		expect(march3.logs[0].employeeLogs).toHaveLength(1);
	});

	it('a narrower activity range leaves out the logs without a slot in it, and still averages every live slot of the others', () => {
		// 0–50% is overall 0–300: L1 (S1 300, S2 100) and L3 (S5 50) stay; L2 (S4 500) and L5 (S6 600) go.
		expect(measured.dailyNarrow.map((row: any) => row.date)).toEqual(['2026-03-02']);
		const march2 = day(measured.dailyNarrow, '2026-03-02');
		expect(march2.sum).toBe(5700);
		expect(march2.activity).toBe(39.58); // S1, S2, S4, S5 → 950 / 2400: S4 counts under L3 although it is out of range
		const [ada, grace] = march2.logs[0].employeeLogs.sort((a: any, b: any) => a.employee.id.localeCompare(b.employee.id));
		expect(ada.activity).toBe(33.33); // S1, S2 → 400 / 1200 (S3 is deleted)
		expect(grace.activity).toBe(45.83);
	});

	it('daily report by employee carries the same sums and activity', () => {
		const [ada, grace] = measured.dailyByEmployee.sort((a: any, b: any) => a.employee.id.localeCompare(b.employee.id));
		expect(ada.sum).toBe(6600);
		expect(ada.activity).toBe(62.5); // S1, S2, S4, S6 → 1500 / 2400
		expect(grace.sum).toBe(2100);
		expect(grace.activity).toBe(45.83);
	});

	it('weekly report: the week’s sum and activity per employee', () => {
		const [ada, grace] = measured.weekly.sort((a: any, b: any) => a.employee.id.localeCompare(b.employee.id));
		expect(ada.sum).toBe(6600);
		expect(ada.activity).toBe(62.5);
		expect(ada.dates['2026-03-02'].sum).toBe(5400);
		expect(ada.dates['2026-03-03'].sum).toBe(1200);
		// The week's rows carry each log with its slot figures, as the joins loaded them
		expect(ada.dates['2026-03-02'].logs.map((log: any) => log.timeSlots.map((slot: any) => slot.overall))).toEqual([
			[300, 100],
			[500]
		]);
		// Each slot carries the `percentage` the subscriber derived on the joined slots (overall / duration, rounded)
		expect(ada.dates['2026-03-02'].logs[0].timeSlots).toEqual([
			{ id: SLOTS[0], overall: 300, duration: 600, percentage: 50 },
			{ id: SLOTS[1], overall: 100, duration: 600, percentage: 17 }
		]);
		expect(grace.sum).toBe(2100);
		expect(grace.activity).toBe(45.83);
	});

	it('daily chart and owed amount: the hours of every log with a slot in range', () => {
		expect(day(measured.chart, '2026-03-02').value.TRACKED).toBe(2.1); // 7500 s
		expect(day(measured.chart, '2026-03-03').value.TRACKED).toBe(0.3); // 1200 s
		expect(day(measured.chart, '2026-03-03').value.MANUAL).toBe(0); // L4 has no slot
		const owedMarch2 = day(measured.owed, '2026-03-02');
		expect(owedMarch2.employees.map((row: any) => row.duration).sort()).toEqual([2100, 5400]);
	});

	it('reads the logs without joining the slots, then their figures in one query', () => {
		for (const statements of Object.values(measured.statements)) {
			const logRead = statements.find((sql) => /FROM "time_log" "time_log"/.test(sql));
			expect(logRead).toBeDefined();
			expect(logRead).toMatch(/EXISTS/);
			expect(logRead).not.toMatch(/JOIN "time_slot" "timeSlots"/);
			expect(logRead).not.toMatch(/time_log__time_log_timeSlots/);
		}
		// The figures query selects from the junction table (the EXISTS sub-query of the log read names it too)
		const isFigures = (sql: string) => /^SELECT "slotLog"\."timeLogId"/.test(sql);
		const figures = measured.statements.daily.filter(isFigures);
		expect(figures).toHaveLength(1);
		expect(figures[0]).toMatch(/"slot"\."deletedAt" IS NULL/);
		expect(figures[0]).not.toMatch(/overall" BETWEEN/);
		expect(measured.statements.weekly.filter(isFigures)).toHaveLength(1);
		expect(measured.statements.chart.some(isFigures)).toBe(false);
	});
});
