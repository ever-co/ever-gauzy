/**
 * This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	IEmployeeNotificationCreateInput,
	TimeLogSourceEnum
} from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { RequestContext } from '../../core/context/request-context';
import { CreateTimeLogReminderTable1791000008500 } from '../../database/migrations/1791000008500-CreateTimeLogReminderTable';
import {
	TIMER_REMINDER_MAX_RUN_AGE_MS,
	TIMER_REMINDER_STALE_CLAIM_MS,
	TIMER_REMINDER_SWEEP_PAGE_SIZE
} from './timer-reminder.constants';
import { TimeLogReminder } from './time-log-reminder.entity';
import { TimerReminderService } from './timer-reminder.service';

/**
 * The timer reminder sweep against a real SQLite database: the running logs, the employees and their notification
 * settings as the platform stores them, and the `time_log_reminder` table its migration creates, whose unique key is
 * what files each reminder once. The notification service is doubled (it writes the notification's row, as the real one
 * does): what is under test is what the sweep asks it to file, under which id, for whom, and in which tenant's request
 * context.
 */

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-11T18:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
/** A time as TypeORM writes it on SQLite: UTC, without its zone. */
const stored = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORGANIZATION = randomUUID();
const OTHER_ORGANIZATION = randomUUID();

interface IFiled {
	input: IEmployeeNotificationCreateInput & { id?: string };
	contextTenantId: string | null;
	contextOrganizationId: string | null;
}

describe('TimerReminderService on SQLite', () => {
	let dataSource: DataSource;
	let filed: IFiled[];
	let notifications: { create: jest.Mock };
	/** Writes the notification's row, as `EmployeeNotificationService.create` does. */
	let write: (input: IEmployeeNotificationCreateInput & { id?: string }) => Promise<void>;
	let service: TimerReminderService;
	const originalClsService = RequestContext['clsService'];

	beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));
	afterAll(() => RequestContext.setClsService(originalClsService));

	beforeEach(async () => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: false,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		// The columns the sweep reads, as the platform's own tables have them; the reminders' table from its migration.
		await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "title" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "employeeId" varchar, "taskId" varchar, "startedAt" datetime, "stoppedAt" datetime, "source" varchar, "isRunning" boolean, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_notification_setting" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "employeeId" varchar, "preferences" text, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_notification" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "entityId" varchar, "title" varchar, "deletedAt" datetime)`
		);
		const runner = dataSource.createQueryRunner();
		await new CreateTimeLogReminderTable1791000008500().up(runner);
		await runner.release();
		for (const id of [TENANT, OTHER_TENANT]) await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [id]);
		for (const id of [ORGANIZATION, OTHER_ORGANIZATION])
			await dataSource.query(`INSERT INTO "organization" ("id") VALUES (?)`, [id]);

		filed = [];
		write = async (input) => {
			await dataSource.query(
				`INSERT INTO "employee_notification" ("id", "tenantId", "entityId", "title") VALUES (?, ?, ?, ?)`,
				[input.id ?? randomUUID(), input.tenantId, input.entityId, input.title]
			);
		};
		notifications = {
			create: jest.fn(async (input: IEmployeeNotificationCreateInput & { id?: string }) => {
				filed.push({
					input,
					contextTenantId: RequestContext.currentTenantId(),
					contextOrganizationId: RequestContext.currentOrganizationId()
				});
				await write(input);
				return { ...input };
			})
		};
		service = new TimerReminderService(dataSource, notifications as never);
	});

	afterEach(async () => {
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	async function employee(
		options: {
			tenantId?: string;
			organizationId?: string;
			isActive?: boolean;
			isArchived?: boolean;
			preferences?: unknown;
		} = {}
	): Promise<string> {
		const id = randomUUID();
		const tenantId = options.tenantId ?? TENANT;
		const organizationId = options.organizationId ?? ORGANIZATION;
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "isActive", "isArchived") VALUES (?, ?, ?, ?, ?)`,
			[id, tenantId, organizationId, options.isActive === false ? 0 : 1, options.isArchived ? 1 : 0]
		);
		if (options.preferences !== undefined) {
			await dataSource.query(
				`INSERT INTO "employee_notification_setting" ("id", "tenantId", "organizationId", "employeeId", "preferences") VALUES (?, ?, ?, ?, ?)`,
				[randomUUID(), tenantId, organizationId, id, JSON.stringify(options.preferences)]
			);
		}
		return id;
	}

	async function runningLog(
		employeeId: string,
		options: {
			ranFor: number;
			heartbeat?: Date | null;
			source?: TimeLogSourceEnum;
			isRunning?: boolean;
			tenantId?: string;
			organizationId?: string;
			taskTitle?: string;
			deleted?: boolean;
			id?: string;
		}
	): Promise<string> {
		const id = options.id ?? randomUUID();
		const tenantId = options.tenantId ?? TENANT;
		const startedAt = ago(options.ranFor);
		let taskId: string | null = null;
		if (options.taskTitle) {
			taskId = randomUUID();
			await dataSource.query(`INSERT INTO "task" ("id", "tenantId", "title") VALUES (?, ?, ?)`, [
				taskId,
				tenantId,
				options.taskTitle
			]);
		}
		await dataSource.query(
			`INSERT INTO "time_log" ("id", "tenantId", "organizationId", "employeeId", "taskId", "startedAt", "stoppedAt", "source", "isRunning", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				tenantId,
				options.organizationId ?? ORGANIZATION,
				employeeId,
				taskId,
				stored(startedAt),
				// A running log is written with its stoppedAt at its start; a heartbeat moves it to the server's time
				stored(options.heartbeat ?? startedAt),
				options.source ?? TimeLogSourceEnum.TEAMS,
				options.isRunning === false ? 0 : 1,
				options.deleted ? stored(ago(HOUR)) : null
			]
		);
		return id;
	}

	const claims = () => dataSource.getRepository(TimeLogReminder).find({ order: { level: 'ASC' } });
	const notificationCount = async () =>
		Number((await dataSource.query(`SELECT COUNT(*) AS "count" FROM "employee_notification"`))[0].count);

	/** Lets the sweeps under way run until `isTrue` holds. */
	async function until(isTrue: () => boolean): Promise<void> {
		for (let turn = 0; turn < 500 && !isTrue(); turn++) {
			await new Promise((resolve) => setImmediate(resolve));
		}
		expect(isTrue()).toBe(true);
	}

	/** A claim as a process that stopped between its claim and its filing leaves it. */
	async function strandedClaim(log: string, level: 1 | 2, claimedAt: Date): Promise<string> {
		const employeeNotificationId = randomUUID();
		await dataSource.getRepository(TimeLogReminder).insert({
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			timeLogId: log,
			level,
			employeeNotificationId,
			claimedAt
		});
		return employeeNotificationId;
	}

	it('files the first reminder of a timer past the threshold, once, for the employee and in the tenant of the log', async () => {
		const ada = await employee();
		const log = await runningLog(ada, { ranFor: 9 * HOUR, taskTitle: 'Ship it' });

		const report = await service.sweep(NOW);

		expect(report).toEqual({ checked: 1, reminded: 1, recovered: 0, failed: 0 });
		expect(filed).toHaveLength(1);
		expect(filed[0].input).toEqual({
			id: expect.any(String),
			title: 'Your timer has been running for 8 hours on "Ship it"',
			message: 'Stop it if you are done, or keep it running.',
			type: EmployeeNotificationTypeEnum.TIMER_REMINDER,
			entity: BaseEntityEnum.TimeLog,
			entityId: log,
			receiverEmployeeId: ada,
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
		expect(filed[0].contextTenantId).toBe(TENANT);
		expect(filed[0].contextOrganizationId).toBe(ORGANIZATION);
		// The claim names the id the notification was filed under, and when
		expect(
			(await claims()).map(({ timeLogId, level, tenantId, organizationId, employeeNotificationId, filedAt }) => ({
				timeLogId,
				level,
				tenantId,
				organizationId,
				employeeNotificationId,
				filedAt
			}))
		).toEqual([
			{
				timeLogId: log,
				level: 1,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				employeeNotificationId: filed[0].input.id,
				filedAt: NOW
			}
		]);

		await service.sweep(NOW);
		await service.sweep(new Date(NOW.getTime() + 6 * HOUR));
		expect(filed).toHaveLength(1);
	});

	it('files the second at twice the threshold, never a third, and a timer found past both gets the second alone', async () => {
		const ada = await employee();
		const reminded = await runningLog(ada, { ranFor: 9 * HOUR });
		await service.sweep(NOW);
		const late = await runningLog(await employee(), { ranFor: 20 * HOUR });

		const later = new Date(NOW.getTime() + 8 * HOUR);
		await service.sweep(later);
		await service.sweep(new Date(later.getTime() + 48 * HOUR));

		expect(filed.map(({ input }) => [input.entityId, input.title])).toEqual([
			[reminded, 'Your timer has been running for 8 hours'],
			[late, 'Your timer is still running after 16 hours'],
			[reminded, 'Your timer is still running after 16 hours']
		]);
		expect(filed[1].input.message).toBe(
			'Did you forget it? Stop it, then correct the time in your timesheet if needed.'
		);
		expect((await claims()).filter(({ timeLogId }) => timeLogId === late).map(({ level }) => level)).toEqual([2]);
	});

	it("follows the employee's threshold, and files nothing for one who turned the reminders off or before it", async () => {
		const early = await runningLog(await employee({ preferences: { timerReminderHours: 4 } }), {
			ranFor: 5 * HOUR
		});
		await runningLog(await employee({ preferences: { timerReminderHours: null } }), { ranFor: 30 * HOUR });
		await runningLog(await employee({ preferences: { timerReminderHours: 0 } }), { ranFor: 30 * HOUR });
		await runningLog(await employee({ preferences: { timerReminderHours: 10 } }), { ranFor: 9 * HOUR });
		// No setting at all: the default of eight hours
		await runningLog(await employee(), { ranFor: 7 * HOUR });

		await service.sweep(NOW);

		expect(filed.map(({ input }) => [input.entityId, input.title])).toEqual([
			[early, 'Your timer has been running for 4 hours']
		]);
	});

	it('files every reminder unread, the one of a TEAMS timer whose heartbeat just moved too: an open tab marks it read', async () => {
		// A heartbeat does not tell an open Ever Teams tab from the desktop or the mobile app, so none is read as one
		await runningLog(await employee(), { ranFor: 9 * HOUR, heartbeat: ago(30_000) });
		await runningLog(await employee(), {
			ranFor: 9 * HOUR,
			heartbeat: ago(30_000),
			source: TimeLogSourceEnum.DESKTOP
		});

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ reminded: 2 });
		expect(filed.map(({ input }) => input)).toEqual([
			expect.not.objectContaining({ isRead: expect.anything() }),
			expect.not.objectContaining({ isRead: expect.anything() })
		]);
		expect(notifications.create.mock.calls.every((call) => call.length === 1)).toBe(true);
	});

	it('leaves alone a run started more than a week ago: a log nobody stopped, not one someone is timing', async () => {
		const ada = await employee();
		await runningLog(ada, { ranFor: TIMER_REMINDER_MAX_RUN_AGE_MS + HOUR });
		const recent = await runningLog(ada, { ranFor: TIMER_REMINDER_MAX_RUN_AGE_MS - HOUR });

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ checked: 1, reminded: 1 });
		expect(filed.map(({ input }) => [input.entityId, input.title])).toEqual([
			[recent, 'Your timer is still running after 16 hours']
		]);
	});

	it('files a claim a stopped process left unfiled, once it is stale, under the id the claim chose', async () => {
		const log = await runningLog(await employee(), { ranFor: 9 * HOUR });
		const fresh = await strandedClaim(log, 1, ago(TIMER_REMINDER_STALE_CLAIM_MS - 60_000));

		// Claimed a moment ago: the process that holds it may still be filing it
		expect(await service.sweep(NOW)).toMatchObject({ reminded: 0, failed: 0 });
		expect(filed).toHaveLength(0);

		// Five minutes on, it is taken over and filed under its own id, once
		const later = new Date(NOW.getTime() + 60_000);
		expect(await service.sweep(later)).toMatchObject({ reminded: 1, recovered: 1, failed: 0 });
		expect(filed.map(({ input }) => [input.id, input.entityId, input.title])).toEqual([
			[fresh, log, 'Your timer has been running for 8 hours']
		]);
		expect(
			(await claims()).map(({ employeeNotificationId, filedAt }) => [employeeNotificationId, filedAt])
		).toEqual([[fresh, later]]);
		await service.sweep(new Date(later.getTime() + TIMER_REMINDER_STALE_CLAIM_MS));
		expect(filed).toHaveLength(1);
	});

	it('records, rather than files twice, a stale claim whose notification was written before its process stopped', async () => {
		const log = await runningLog(await employee(), { ranFor: 9 * HOUR });
		const id = await strandedClaim(log, 1, ago(TIMER_REMINDER_STALE_CLAIM_MS + 60_000));
		await write({ id, tenantId: TENANT, entityId: log, title: 'Your timer has been running for 8 hours' } as never);

		expect(await service.sweep(NOW)).toMatchObject({ reminded: 0, failed: 0 });

		expect(filed).toHaveLength(0);
		expect(await notificationCount()).toBe(1);
		expect((await claims()).map(({ filedAt }) => filedAt)).toEqual([NOW]);
	});

	it('still sweeps a run whose second reminder was claimed and left unfiled, and files it', async () => {
		const log = await runningLog(await employee(), { ranFor: 17 * HOUR });
		const id = await strandedClaim(log, 2, ago(TIMER_REMINDER_STALE_CLAIM_MS + 60_000));

		expect(await service.sweep(NOW)).toMatchObject({ checked: 1, reminded: 1, recovered: 1 });
		expect(filed.map(({ input }) => [input.id, input.title])).toEqual([
			[id, 'Your timer is still running after 16 hours']
		]);
	});

	it('takes over a stale claim in one process only when several sweep at once', async () => {
		const log = await runningLog(await employee(), { ranFor: 9 * HOUR });
		await strandedClaim(log, 1, ago(TIMER_REMINDER_STALE_CLAIM_MS + 60_000));
		const other = new TimerReminderService(dataSource, notifications as never);

		await Promise.all([service.sweep(NOW), other.sweep(NOW), service.sweep(NOW)]);

		expect(filed).toHaveLength(1);
		expect(await notificationCount()).toBe(1);
	});

	it('files a reminder another process claimed first not at all: the unique key lets one claim through', async () => {
		const log = await runningLog(await employee(), { ranFor: 9 * HOUR });
		const repository = dataSource.getRepository(TimeLogReminder);
		const insert = repository.insert.bind(repository);
		// Another process claims the same reminder between this sweep's read of the claims and its own insert
		jest.spyOn(repository, 'insert').mockImplementationOnce(async (values) => {
			await insert(values);
			return insert(values);
		});

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ reminded: 0, failed: 0 });
		expect(filed).toHaveLength(0);
		expect((await claims()).map(({ timeLogId, level }) => [timeLogId, level])).toEqual([[log, 1]]);
	});

	it('resumes where the last sweep ran out of time, so a due run further down the list is reminded', async () => {
		// A whole page of runs no reminder is due for (their employee turned the reminders off) comes first
		const off = await employee({ preferences: { timerReminderHours: null } });
		for (let index = 0; index < TIMER_REMINDER_SWEEP_PAGE_SIZE; index++) {
			await runningLog(off, { ranFor: 30 * HOUR });
		}
		const due = await runningLog(await employee(), { ranFor: 9 * HOUR });

		// Out of time after the first page, then again after the first page of the next sweep
		expect(await service.sweep(NOW, 0)).toMatchObject({ checked: TIMER_REMINDER_SWEEP_PAGE_SIZE, reminded: 0 });
		expect(await service.sweep(NOW, 0)).toMatchObject({ checked: 1, reminded: 1 });

		expect(filed.map(({ input }) => input.entityId)).toEqual([due]);
	});

	it('wraps round to the oldest runs within one sweep, up to where it began', async () => {
		const off = await employee({ preferences: { timerReminderHours: null } });
		for (let index = 0; index < TIMER_REMINDER_SWEEP_PAGE_SIZE; index++) {
			await runningLog(off, { ranFor: 20 * HOUR });
		}
		const due = await runningLog(await employee(), { ranFor: 9 * HOUR });
		await service.sweep(NOW, 0);
		// A due run that started before every other one: before where the next sweep resumes
		const oldest = await runningLog(await employee(), { ranFor: 21 * HOUR });

		const report = await service.sweep(NOW);

		// The run after where it resumed, then the oldest round to where it began
		expect(report).toMatchObject({ checked: TIMER_REMINDER_SWEEP_PAGE_SIZE + 2, reminded: 2 });
		expect(filed.map(({ input }) => input.entityId)).toEqual([due, oldest]);
	});

	it('files each reminder once when two sweeps run at the same time', async () => {
		for (let index = 0; index < 5; index++) {
			await runningLog(await employee(), { ranFor: 9 * HOUR });
		}
		const other = new TimerReminderService(dataSource, notifications as never);

		await Promise.all([service.sweep(NOW), other.sweep(NOW), service.sweep(NOW)]);

		expect(filed).toHaveLength(5);
		expect(new Set(filed.map(({ input }) => input.entityId)).size).toBe(5);
		expect(await claims()).toHaveLength(5);
	});

	it('gives the claim back when the notification could not be filed, so the next sweep files it', async () => {
		const log = await runningLog(await employee(), { ranFor: 9 * HOUR });
		notifications.create.mockRejectedValueOnce(new Error('connection reset'));

		const failed = await service.sweep(NOW);

		expect(failed).toMatchObject({ reminded: 0, failed: 1 });
		expect(await claims()).toEqual([]);

		await service.sweep(NOW);
		expect(filed.map(({ input }) => input.entityId)).toEqual([log]);
		expect(await claims()).toHaveLength(1);
	});

	it('gives a claim back only while it still holds it: a filing that hung past a takeover leaves the claim be', async () => {
		await runningLog(await employee(), { ranFor: 9 * HOUR });
		let failFirst: (error: Error) => void = () => undefined;
		let finishSecond: () => void = () => undefined;
		notifications.create
			// The first process's filing hangs past the takeover time, then fails
			.mockImplementationOnce(() => new Promise((_resolve, reject) => (failFirst = reject)))
			// The process that took the claim over files it, a moment later
			.mockImplementationOnce(async (input: IEmployeeNotificationCreateInput & { id?: string }) => {
				await new Promise<void>((resolve) => (finishSecond = resolve));
				filed.push({ input, contextTenantId: TENANT, contextOrganizationId: ORGANIZATION });
				await write(input);
				return { ...input };
			});
		const other = new TimerReminderService(dataSource, notifications as never);

		const first = service.sweep(NOW);
		await until(() => notifications.create.mock.calls.length === 1);
		const second = other.sweep(new Date(NOW.getTime() + TIMER_REMINDER_STALE_CLAIM_MS + 60_000));
		await until(() => notifications.create.mock.calls.length === 2);

		failFirst(new Error('connection reset'));
		expect(await first).toMatchObject({ reminded: 0, failed: 1 });
		// Still there: the claim is the other process's now
		expect(await claims()).toHaveLength(1);

		finishSecond();
		expect(await second).toMatchObject({ reminded: 1, recovered: 1 });
		await service.sweep(new Date(NOW.getTime() + 3 * TIMER_REMINDER_STALE_CLAIM_MS));
		expect(await notificationCount()).toBe(1);
	});

	it('never gives back a claim it took over: the process it was taken from may still file it, under its id', async () => {
		await runningLog(await employee(), { ranFor: 9 * HOUR });
		let finishFirst: () => void = () => undefined;
		notifications.create
			// The first process's filing hangs past the takeover time, then writes its notification
			.mockImplementationOnce(async (input: IEmployeeNotificationCreateInput & { id?: string }) => {
				await new Promise<void>((resolve) => (finishFirst = resolve));
				filed.push({ input, contextTenantId: TENANT, contextOrganizationId: ORGANIZATION });
				await write(input);
				return { ...input };
			})
			// The process that took the claim over fails before it writes anything
			.mockRejectedValueOnce(new Error('connection reset'));
		const other = new TimerReminderService(dataSource, notifications as never);

		const first = service.sweep(NOW);
		await until(() => notifications.create.mock.calls.length === 1);
		const takeover = new Date(NOW.getTime() + TIMER_REMINDER_STALE_CLAIM_MS + 60_000);
		expect(await other.sweep(takeover)).toMatchObject({ reminded: 0, failed: 1 });
		// Kept, though its filing failed: the first process may still write the notification under the claim's id
		expect(await claims()).toHaveLength(1);

		finishFirst();
		expect(await first).toMatchObject({ reminded: 1 });
		// The timer still runs: the next sweeps find the reminder filed, and file no second one under another id
		await other.sweep(new Date(takeover.getTime() + 60_000));
		await other.sweep(new Date(takeover.getTime() + 2 * TIMER_REMINDER_STALE_CLAIM_MS));
		expect(await notificationCount()).toBe(1);
		expect((await claims()).map(({ filedAt }) => filedAt)).toEqual([NOW]);
	});

	it('keeps, as filed, the claim of a notification written before its filing failed: no second filing', async () => {
		await runningLog(await employee(), { ranFor: 9 * HOUR });
		notifications.create.mockImplementationOnce(
			async (input: IEmployeeNotificationCreateInput & { id?: string }) => {
				filed.push({ input, contextTenantId: TENANT, contextOrganizationId: ORGANIZATION });
				await write(input);
				throw new Error('connection reset after the write');
			}
		);

		expect(await service.sweep(NOW)).toMatchObject({ reminded: 1, failed: 0 });
		expect((await claims()).map(({ filedAt }) => filedAt)).toEqual([NOW]);

		await service.sweep(new Date(NOW.getTime() + TIMER_REMINDER_STALE_CLAIM_MS + 60_000));
		expect(filed).toHaveLength(1);
		expect(await notificationCount()).toBe(1);
	});

	it("files each reminder in its own log's tenant, and none for a log whose employee is of another tenant", async () => {
		const ada = await employee();
		const bob = await employee({ tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });
		const own = await runningLog(ada, { ranFor: 9 * HOUR });
		const other = await runningLog(bob, {
			ranFor: 9 * HOUR,
			tenantId: OTHER_TENANT,
			organizationId: OTHER_ORGANIZATION
		});
		// A log of the other tenant naming this tenant's employee: nobody of its tenant to remind
		await runningLog(ada, { ranFor: 9 * HOUR, tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });

		await service.sweep(NOW);

		expect(
			filed.map(({ input, contextTenantId, contextOrganizationId }) => ({
				log: input.entityId,
				receiver: input.receiverEmployeeId,
				tenant: input.tenantId,
				contextTenantId,
				contextOrganizationId
			}))
		).toEqual(
			expect.arrayContaining([
				{
					log: own,
					receiver: ada,
					tenant: TENANT,
					contextTenantId: TENANT,
					contextOrganizationId: ORGANIZATION
				},
				{
					log: other,
					receiver: bob,
					tenant: OTHER_TENANT,
					contextTenantId: OTHER_TENANT,
					contextOrganizationId: OTHER_ORGANIZATION
				}
			])
		);
		expect(filed).toHaveLength(2);
	});

	it('reads the threshold of an employee in their own tenant only', async () => {
		const ada = await employee({ preferences: { timerReminderHours: null } });
		// A setting naming the employee from another tenant does not turn their reminders on or off
		await dataSource.query(
			`INSERT INTO "employee_notification_setting" ("id", "tenantId", "organizationId", "employeeId", "preferences") VALUES (?, ?, ?, ?, ?)`,
			[randomUUID(), OTHER_TENANT, OTHER_ORGANIZATION, ada, JSON.stringify({ timerReminderHours: 2 })]
		);
		await runningLog(ada, { ranFor: 30 * HOUR });

		await service.sweep(NOW);

		expect(filed).toHaveLength(0);
	});

	it('files nothing for a stopped timer, a deleted log, or an employee who is no longer active', async () => {
		await runningLog(await employee(), { ranFor: 9 * HOUR, isRunning: false });
		await runningLog(await employee(), { ranFor: 9 * HOUR, deleted: true });
		await runningLog(await employee({ isActive: false }), { ranFor: 9 * HOUR });
		await runningLog(await employee({ isArchived: true }), { ranFor: 9 * HOUR });

		const report = await service.sweep(NOW);

		expect(report).toEqual({ checked: 0, reminded: 0, recovered: 0, failed: 0 });
		expect(filed).toHaveLength(0);
	});

	it('files nothing, and keeps nothing claimed, where no request context of the tenant can be opened', async () => {
		await runningLog(await employee(), { ranFor: 9 * HOUR });
		RequestContext.setClsService(undefined as never);
		try {
			const report = await service.sweep(NOW);
			expect(report).toMatchObject({ reminded: 0, failed: 1 });
		} finally {
			RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		}
		expect(notifications.create).not.toHaveBeenCalled();
		expect(await claims()).toEqual([]);
	});

	it('reads every running timer, a page at a time, the ones that started together too', async () => {
		const ada = await employee();
		const count = TIMER_REMINDER_SWEEP_PAGE_SIZE + 5;
		for (let index = 0; index < count; index++) {
			await runningLog(ada, { ranFor: 9 * HOUR });
		}

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ checked: count, reminded: count });
		expect(new Set(filed.map(({ input }) => input.entityId)).size).toBe(count);
	});
});
