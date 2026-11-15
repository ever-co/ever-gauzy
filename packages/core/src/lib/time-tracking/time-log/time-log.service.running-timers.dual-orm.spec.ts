import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * ever-co/ever-gauzy#11886: manual time is refused over every running timer of the employee that started before the
 * range ends, not only over the running logs the overlap lookup returns. That lookup matches the stored range, which ends
 * at a running log's last heartbeat (its start, for a web timer), and on TypeORM needs time slots. The running timers are
 * read here on a real SQLite database, with each ORM: the employee's own, in their organization and tenant, still running,
 * started before the range ends, and without the edited log. For a tracker's upload a tracker's run is left out too: it
 * keeps the end its slots give it. The 409 names the run in the way, the first started, from the logs as each ORM reads
 * them.
 *
 * An employee holds one running timer run at a time, beside the desktop's running uploads (#11826): each run of a timer
 * client below is the running run of its own employee, read for that employee.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '11111111-1111-4111-8111-111111111112';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '44444444-4444-4444-8444-444444444441';
const OTHER_EMPLOYEE = '44444444-4444-4444-8444-444444444442';
/** An employee whose running run is an Ever Teams run. */
const TEAMS_EMPLOYEE = '44444444-4444-4444-8444-444444444443';
/** An employee whose running run is the log being edited. */
const EDITING_EMPLOYEE = '44444444-4444-4444-8444-444444444444';
/** An employee whose running run started after the range. */
const LATE_EMPLOYEE = '44444444-4444-4444-8444-444444444445';

/** The logs of the database, by what each one is. */
const LOG = {
	/** A web timer running since 09:00, which posts no slots: its stored end is its start. */
	webTimer: '66666666-6666-4666-8666-666666666661',
	/** An Ever Teams run since 08:00 whose last heartbeat was at 08:30. */
	teamsLastHeardAt0830: '66666666-6666-4666-8666-666666666662',
	/** The log being edited, running since 09:10. */
	edited: '66666666-6666-4666-8666-666666666663',
	/** A desktop run since 08:00 whose last slot ends at 09:50: a tracker's. */
	desktop: '66666666-6666-4666-8666-666666666664',
	/** A web timer running since 10:30, after the range ends. */
	startedAfter: '66666666-6666-4666-8666-666666666665',
	/** A log from 08:00 to 09:30 that no longer runs. */
	stopped: '66666666-6666-4666-8666-666666666666',
	/** Another employee's web timer, running since 09:00. */
	otherEmployee: '66666666-6666-4666-8666-666666666667',
	/**
	 * A desktop run since 09:00 under the employee's id in another tenant: the tenant alone must leave it out. A desktop
	 * run, as the employee's web timer is the one running timer run their id may hold (#11826).
	 */
	otherTenant: '66666666-6666-4666-8666-666666666668'
};

/** Where the manual range ends. */
const RANGE_END = new Date('2026-01-05T10:00:00.000Z');

type Reads = {
	/** The runs found for the employee of the web timer and the desktop run. */
	found: string[];
	/** The runs found for the Ever Teams run's employee. */
	foundOfTeamsEmployee: string[];
	/** The runs found for the employee of the edited log, without and while editing it. */
	foundOfEditingEmployee: string[];
	foundWhileEditing: string[];
	/** The runs found for the employee whose run started after the range. */
	foundOfLateEmployee: string[];
	foundForTrackerUpload: string[];
	/** The body of the 409 refusing manual time over the first employee's runs, as the client gets it. */
	refusalOfManualTime: unknown;
	/** The body of the 409 refusing a tracker's upload over the Ever Teams run's employee's runs, as the client gets it. */
	refusalOfTrackerUpload: unknown;
};

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-running-timers-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as { mikroOrm: Reads; typeOrm: Reads };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../core/utils');
			const { TimeLog } = require('./time-log.entity');
			const { TypeOrmTimeLogRepository } = require('./repository/type-orm-time-log.repository');
			const { MikroOrmTimeLogRepository } = require('./repository/mikro-orm-time-log.repository');
			const { TimeLogService } = require('./time-log.service');
			const { toSafeHttpException } = require('../../core/interceptors/safe-http-exception');

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();
			// The placeholders below fill NOT NULL references (the employee's user, for one) with rows that do not
			// exist: what is read here is which running logs the lookup returns, not the rows around them.
			await dataSource.query('PRAGMA foreign_keys = OFF');

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
			const log = async (
				id: string,
				source: string,
				startedAt: string,
				stoppedAt: string,
				{ isRunning = true, employeeId = EMPLOYEE, tenantId = TENANT } = {}
			) =>
				insert('time_log', {
					id,
					tenantId,
					organizationId: ORGANIZATION,
					employeeId,
					source,
					logType: 'TRACKED',
					startedAt,
					stoppedAt,
					isRunning: isRunning ? 1 : 0
				});

			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('tenant', { id: OTHER_TENANT, name: 'Other tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('employee', { id: EMPLOYEE, tenantId: TENANT, organizationId: ORGANIZATION });
			await insert('employee', { id: OTHER_EMPLOYEE, tenantId: TENANT, organizationId: ORGANIZATION });
			for (const id of [TEAMS_EMPLOYEE, EDITING_EMPLOYEE, LATE_EMPLOYEE]) {
				await insert('employee', { id, tenantId: TENANT, organizationId: ORGANIZATION });
			}
			await log(LOG.webTimer, 'WEB_TIMER', '2026-01-05 09:00:00', '2026-01-05 09:00:00');
			await log(LOG.teamsLastHeardAt0830, 'TEAMS', '2026-01-05 08:00:00', '2026-01-05 08:30:00', {
				employeeId: TEAMS_EMPLOYEE
			});
			await log(LOG.edited, 'WEB_TIMER', '2026-01-05 09:10:00', '2026-01-05 09:10:00', {
				employeeId: EDITING_EMPLOYEE
			});
			await log(LOG.desktop, 'DESKTOP', '2026-01-05 08:00:00', '2026-01-05 09:50:00');
			await log(LOG.startedAfter, 'WEB_TIMER', '2026-01-05 10:30:00', '2026-01-05 10:30:00', {
				employeeId: LATE_EMPLOYEE
			});
			await log(LOG.stopped, 'WEB_TIMER', '2026-01-05 08:00:00', '2026-01-05 09:30:00', { isRunning: false });
			await log(LOG.otherEmployee, 'WEB_TIMER', '2026-01-05 09:00:00', '2026-01-05 09:00:00', {
				employeeId: OTHER_EMPLOYEE
			});
			await log(LOG.otherTenant, 'DESKTOP', '2026-01-05 09:00:00', '2026-01-05 09:00:00', {
				tenantId: OTHER_TENANT
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const serviceWith = (typeOrmTimeLogRepository: any, mikroOrmTimeLogRepository: any, ormType: unknown) => {
				const service = Object.assign(Object.create(TimeLogService.prototype), {
					typeOrmTimeLogRepository,
					mikroOrmTimeLogRepository
				});
				// A getter on the base service, which reads the process-wide setting
				Object.defineProperty(service, 'ormType', { value: ormType });
				return service;
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const refusalOf = (service: any, running: unknown[]): unknown => {
				try {
					service.assertNoRunningTimerIn(running);
				} catch (error) {
					// Every error body is copied on its way out, then sent as JSON
					return JSON.parse(JSON.stringify(toSafeHttpException(error).getResponse()));
				}
				return undefined;
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const reads = async (service: any): Promise<Reads> => {
				const idsOf = (logs: { id: string }[]) => logs.map((found) => found.id).sort();
				const runsOf = (employeeId: string, ignoreId?: string, isTrackerUpload?: boolean) =>
					service.findRunningTimersStartedBefore(
						RANGE_END,
						employeeId,
						ORGANIZATION,
						TENANT,
						ignoreId,
						isTrackerUpload
					);
				const found = await runsOf(EMPLOYEE);
				const teamsForTrackerUpload = await runsOf(TEAMS_EMPLOYEE, undefined, true);
				return {
					found: idsOf(found),
					foundOfTeamsEmployee: idsOf(await runsOf(TEAMS_EMPLOYEE)),
					foundOfEditingEmployee: idsOf(await runsOf(EDITING_EMPLOYEE)),
					foundWhileEditing: idsOf(await runsOf(EDITING_EMPLOYEE, LOG.edited)),
					foundOfLateEmployee: idsOf(await runsOf(LATE_EMPLOYEE)),
					foundForTrackerUpload: idsOf(await runsOf(EMPLOYEE, undefined, true)),
					refusalOfManualTime: refusalOf(service, found),
					refusalOfTrackerUpload: refusalOf(service, teamsForTrackerUpload)
				};
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
				measurement.mikroOrm = await reads(
					serviceWith({}, new MikroOrmTimeLogRepository(mikroOrm.em.fork(), TimeLog), MultiORMEnum.MikroORM)
				);
			} finally {
				await mikroOrm.close(true);
			}

			measurement.typeOrm = await reads(
				serviceWith(new TypeOrmTimeLogRepository(dataSource.getRepository(TimeLog)), {}, MultiORMEnum.TypeORM)
			);
		});
	} finally {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		fs.rmSync(file, { force: true });
	}

	return measurement;
}

describe('TimeLogService, the running timers a manual range falls over (#11886)', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it("finds each employee's running runs: the web timer and the desktop run, the Ever Teams run last heard before the range, the edited log", () => {
			expect(measured[orm].found).toEqual([LOG.webTimer, LOG.desktop].sort());
			expect(measured[orm].foundOfTeamsEmployee).toEqual([LOG.teamsLastHeardAt0830]);
			expect(measured[orm].foundOfEditingEmployee).toEqual([LOG.edited]);
		});

		it('leaves out the edited log while it is edited', () => {
			expect(measured[orm].foundWhileEditing).toEqual([]);
		});

		it("leaves out the desktop run for a tracker's upload", () => {
			expect(measured[orm].foundForTrackerUpload).toEqual([LOG.webTimer]);
		});

		it('names the run in the way, the first started, in the 409 refusing manual time, as the client gets it', () => {
			expect(measured[orm].refusalOfManualTime).toEqual({
				message: 'A timer is running over this time range. Stop it first, or choose a range outside it.',
				code: 'RUNNING_TIMER_OVERLAP',
				runningTimeLog: { id: LOG.desktop, startedAt: '2026-01-05T08:00:00.000Z', source: 'DESKTOP' }
			});
		});

		it("names the Ever Teams run in the 409 refusing a tracker's upload, as the client gets it", () => {
			expect(measured[orm].refusalOfTrackerUpload).toEqual({
				message: 'A timer is running over this time range. Stop it first, or choose a range outside it.',
				code: 'RUNNING_TIMER_OVERLAP',
				runningTimeLog: { id: LOG.teamsLastHeardAt0830, startedAt: '2026-01-05T08:00:00.000Z', source: 'TEAMS' }
			});
		});

		it("leaves out a run started after the range, a stopped log, and other employees' and tenants'", () => {
			expect(measured[orm].foundOfLateEmployee).toEqual([]);
			for (const left of [LOG.startedAfter, LOG.stopped, LOG.otherEmployee, LOG.otherTenant]) {
				expect(measured[orm].found).not.toContain(left);
			}
		});
	});
});
