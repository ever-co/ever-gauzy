/**
 * This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { RequestContext } from '../../core/context/request-context';
import { CreateTaskDueReminderTable1791000012600 } from '../../database/migrations/1791000012600-CreateTaskDueReminderTable';
import { TASK_DUE_REMINDER_STALE_CLAIM_MS } from './task-due-reminder.constants';
import { TaskDueReminder } from './task-due-reminder.entity';
import { TaskDueReminderService } from './task-due-reminder.service';

/**
 * The task due reminder sweep against a real SQLite database: the tasks, their assignees, the employees and their
 * notification settings as the platform stores them, and the `task_due_reminder` table its migration creates, whose
 * unique key is what files each reminder once. The notification service is doubled (it writes the notification's row,
 * as the real one does): what is under test is what the sweep asks it to file, under which id, for whom, and in which
 * tenant's request context.
 */

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-19T12:00:00.000Z');
const inHours = (hours: number) => new Date(NOW.getTime() + hours * HOUR);
/** A time as TypeORM writes it on SQLite: UTC, without its zone. */
const stored = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORGANIZATION = randomUUID();
const OTHER_ORGANIZATION = randomUUID();
const DONE_STATUS = randomUUID();
const OPEN_STATUS = randomUUID();

interface IFiled {
	input: IEmployeeNotificationCreateInput & { id?: string };
	contextTenantId: string | null;
	contextOrganizationId: string | null;
}

describe('TaskDueReminderService on SQLite', () => {
	let dataSource: DataSource;
	let filed: IFiled[];
	let notifications: { create: jest.Mock };
	let service: TaskDueReminderService;
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
		await dataSource.query(
			`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "timeZone" varchar, "lastTeamId" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "isDone" boolean, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "title" varchar, "dueDate" datetime, "status" varchar, "taskStatusId" varchar, "isArchived" boolean DEFAULT (0), "isDraft" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "task_employee" ("taskId" varchar NOT NULL, "employeeId" varchar NOT NULL)`
		);
		await dataSource.query(
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "notificationDefaults" text, "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationTeamId" varchar, "employeeId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_notification_setting" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "employeeId" varchar, "preferences" text, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_notification" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "entityId" varchar, "title" varchar, "deletedAt" datetime)`
		);
		const runner = dataSource.createQueryRunner();
		await new CreateTaskDueReminderTable1791000012600().up(runner);
		await runner.release();
		for (const id of [TENANT, OTHER_TENANT]) await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [id]);
		for (const id of [ORGANIZATION, OTHER_ORGANIZATION])
			await dataSource.query(`INSERT INTO "organization" ("id") VALUES (?)`, [id]);
		await dataSource.query(`INSERT INTO "task_status" ("id", "isDone") VALUES (?, 1), (?, 0)`, [
			DONE_STATUS,
			OPEN_STATUS
		]);

		filed = [];
		notifications = {
			create: jest.fn(async (input: IEmployeeNotificationCreateInput & { id?: string }) => {
				filed.push({
					input,
					contextTenantId: RequestContext.currentTenantId(),
					contextOrganizationId: RequestContext.currentOrganizationId()
				});
				await dataSource.query(
					`INSERT INTO "employee_notification" ("id", "tenantId", "entityId", "title") VALUES (?, ?, ?, ?)`,
					[input.id ?? randomUUID(), input.tenantId, input.entityId, input.title]
				);
				return { ...input };
			})
		};
		service = new TaskDueReminderService(dataSource, notifications as never);
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
			timeZone?: string;
		} = {}
	): Promise<string> {
		const id = randomUUID();
		const userId = randomUUID();
		const tenantId = options.tenantId ?? TENANT;
		const organizationId = options.organizationId ?? ORGANIZATION;
		await dataSource.query(`INSERT INTO "user" ("id", "timeZone") VALUES (?, ?)`, [
			userId,
			options.timeZone ?? null
		]);
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId", "isActive", "isArchived") VALUES (?, ?, ?, ?, ?, ?)`,
			[id, tenantId, organizationId, userId, options.isActive === false ? 0 : 1, options.isArchived ? 1 : 0]
		);
		if (options.preferences !== undefined) {
			await dataSource.query(
				`INSERT INTO "employee_notification_setting" ("id", "tenantId", "organizationId", "employeeId", "preferences") VALUES (?, ?, ?, ?, ?)`,
				[randomUUID(), tenantId, organizationId, id, JSON.stringify(options.preferences)]
			);
		}
		return id;
	}

	async function task(
		assignees: string[],
		options: {
			dueDate: Date | null;
			title?: string;
			status?: string | null;
			taskStatusId?: string | null;
			isArchived?: boolean;
			isDraft?: boolean;
			deleted?: boolean;
			tenantId?: string;
			organizationId?: string;
		}
	): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "task" ("id", "tenantId", "organizationId", "title", "dueDate", "status", "taskStatusId", "isArchived", "isDraft", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				options.tenantId ?? TENANT,
				options.organizationId ?? ORGANIZATION,
				options.title ?? 'Ship the release',
				options.dueDate ? stored(options.dueDate) : null,
				options.status === undefined ? 'open' : options.status,
				options.taskStatusId ?? null,
				options.isArchived ? 1 : 0,
				options.isDraft ? 1 : 0,
				options.deleted ? stored(NOW) : null
			]
		);
		for (const employeeId of assignees) {
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [
				id,
				employeeId
			]);
		}
		return id;
	}

	const claims = () => dataSource.getRepository(TaskDueReminder).find();

	it('reminds each assignee once, a day before by default, in the tenant and organization of the task', async () => {
		const ada = await employee();
		const grace = await employee();
		const shipped = await task([ada, grace], { dueDate: inHours(6) });

		const report = await service.sweep(NOW);

		expect(report).toEqual({ checked: 2, reminded: 2, recovered: 0, failed: 0 });
		expect(filed.map(({ input }) => input.receiverEmployeeId).sort()).toEqual([ada, grace].sort());
		expect(filed[0].input).toEqual({
			id: expect.any(String),
			title: 'The Task "Ship the release" is due in 6 hours',
			message: 'Due at 2026-11-19 18:00 (UTC).',
			type: EmployeeNotificationTypeEnum.TASK_DUE_REMINDER,
			entity: BaseEntityEnum.Task,
			entityId: shipped,
			receiverEmployeeId: expect.any(String),
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
		expect(
			filed.every(
				({ contextTenantId, contextOrganizationId }) =>
					contextTenantId === TENANT && contextOrganizationId === ORGANIZATION
			)
		).toBe(true);
		// Each claim names the id its notification was filed under, and when
		const rows = await claims();
		expect(rows.map(({ employeeNotificationId }) => employeeNotificationId).sort()).toEqual(
			filed.map(({ input }) => input.id).sort()
		);
		expect(rows.every(({ filedAt }) => filedAt?.getTime() === NOW.getTime())).toBe(true);

		await service.sweep(NOW);
		await service.sweep(inHours(3));
		expect(filed).toHaveLength(2);
	});

	it("follows each assignee's threshold, and says nothing before it, once the task is due, or to one who turned it off", async () => {
		const twoHours = await employee({ preferences: { taskDueReminderHours: 2 } });
		const off = await employee({ preferences: { taskDueReminderHours: null } });
		const week = await employee({ preferences: { taskDueReminderHours: 168 } });
		await task([twoHours, off, week], { dueDate: inHours(30) });
		await task([await employee()], { dueDate: inHours(-1), title: 'Overdue' });
		await task([await employee()], { dueDate: inHours(30), title: 'Later' });

		await service.sweep(NOW);

		expect(filed.map(({ input }) => [input.receiverEmployeeId, input.title])).toEqual([
			[week, 'The Task "Ship the release" is due in 30 hours']
		]);
	});

	it("reads a due date that names a day in the assignee's zone: due once their day is over", async () => {
		// Friday the 20th, saved as midnight UTC. At noon UTC on Thursday, Paris has 35 hours left and Los Angeles 44.
		const friday = new Date('2026-11-20T00:00:00.000Z');
		const paris = await employee({ timeZone: 'Europe/Paris', preferences: { taskDueReminderHours: 36 } });
		const losAngeles = await employee({
			timeZone: 'America/Los_Angeles',
			preferences: { taskDueReminderHours: 36 }
		});
		// The zone of the quiet hours wins over the user's, as the delivery lane reads it
		const quiet = await employee({
			timeZone: 'America/Los_Angeles',
			preferences: { taskDueReminderHours: 36, dnd: { start: '22:00', end: '07:00', timeZone: 'Europe/Paris' } }
		});
		await task([paris, losAngeles, quiet], { dueDate: friday });

		await service.sweep(NOW);

		expect(filed.map(({ input }) => input.receiverEmployeeId).sort()).toEqual([paris, quiet].sort());
		expect(filed[0].input.title).toBe('The Task "Ship the release" is due in 35 hours');
		expect(filed[0].input.message).toBe('Due by the end of 2026-11-20.');
	});

	it('says nothing of a task that is done, completed, cancelled, in a done status, archived, a draft or deleted', async () => {
		const ada = await employee();
		for (const status of ['done', 'completed', 'cancelled']) await task([ada], { dueDate: inHours(5), status });
		await task([ada], { dueDate: inHours(5), status: 'custom', taskStatusId: DONE_STATUS });
		await task([ada], { dueDate: inHours(5), isArchived: true });
		await task([ada], { dueDate: inHours(5), isDraft: true });
		await task([ada], { dueDate: inHours(5), deleted: true });
		const open = await task([ada], { dueDate: inHours(5), status: null, taskStatusId: OPEN_STATUS, title: 'Open' });

		await service.sweep(NOW);

		expect(filed.map(({ input }) => input.entityId)).toEqual([open]);
	});

	it('says nothing to an assignee who left, an archived one, or one of another organization', async () => {
		await task(
			[
				await employee({ isActive: false }),
				await employee({ isArchived: true }),
				await employee({ organizationId: OTHER_ORGANIZATION })
			],
			{ dueDate: inHours(5) }
		);

		const report = await service.sweep(NOW);

		expect(report.checked).toBe(0);
		expect(filed).toHaveLength(0);
	});

	it("files a task of another tenant in that tenant's request context", async () => {
		const grace = await employee({ tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });
		await task([grace], { dueDate: inHours(5), tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });

		await service.sweep(NOW);

		expect(filed.map(({ input }) => [input.tenantId, input.organizationId, input.receiverEmployeeId])).toEqual([
			[OTHER_TENANT, OTHER_ORGANIZATION, grace]
		]);
		expect(filed[0].contextTenantId).toBe(OTHER_TENANT);
		expect(filed[0].contextOrganizationId).toBe(OTHER_ORGANIZATION);
	});

	it("follows the team's default threshold where the assignee chose none, and the assignee's own where they did", async () => {
		const teamId = randomUUID();
		await dataSource.query(
			`INSERT INTO "organization_team" ("id", "tenantId", "organizationId", "notificationDefaults") VALUES (?, ?, ?, ?)`,
			[teamId, TENANT, ORGANIZATION, JSON.stringify({ taskDueReminderHours: 48 })]
		);
		const choseNothing = await employee();
		const ownTwoHours = await employee({ preferences: { taskDueReminderHours: 2 } });
		for (const member of [choseNothing, ownTwoHours]) {
			await dataSource.query(
				`INSERT INTO "organization_team_employee" ("id", "tenantId", "organizationTeamId", "employeeId") VALUES (?, ?, ?, ?)`,
				[randomUUID(), TENANT, teamId, member]
			);
		}
		await task([choseNothing, ownTwoHours], { dueDate: inHours(30) });

		await service.sweep(NOW);

		expect(filed.map(({ input }) => input.receiverEmployeeId)).toEqual([choseNothing]);
	});

	it('reminds again of a due date moved since', async () => {
		const ada = await employee();
		const moved = await task([ada], { dueDate: inHours(5) });
		await service.sweep(NOW);

		await dataSource.query(`UPDATE "task" SET "dueDate" = ? WHERE "id" = ?`, [stored(inHours(40)), moved]);
		await service.sweep(inHours(1));
		await service.sweep(inHours(20));

		expect(filed.map(({ input }) => input.title)).toEqual([
			'The Task "Ship the release" is due in 5 hours',
			'The Task "Ship the release" is due in 20 hours'
		]);
		expect(await claims()).toHaveLength(2);
	});

	it('files a reminder once when two processes sweep at the same moment', async () => {
		await task([await employee()], { dueDate: inHours(5) });
		const other = new TaskDueReminderService(dataSource, notifications as never);

		const reports = await Promise.all([service.sweep(NOW), other.sweep(NOW)]);

		expect(filed).toHaveLength(1);
		expect(reports.map(({ reminded }) => reminded).sort()).toEqual([0, 1]);
		expect(await claims()).toHaveLength(1);
	});

	it('gives a claim back when its notification could not be filed, so the next sweep files it', async () => {
		await task([await employee()], { dueDate: inHours(5) });
		notifications.create.mockRejectedValueOnce(new Error('connection reset'));

		const failed = await service.sweep(NOW);
		expect(failed).toMatchObject({ reminded: 0, failed: 1 });
		expect(await claims()).toHaveLength(0);

		const retried = await service.sweep(NOW);
		expect(retried).toMatchObject({ reminded: 1, failed: 0 });
		expect(filed).toHaveLength(1);
	});

	it('takes over a claim a stopped process left unfiled, and files it under the id the claim chose', async () => {
		const ada = await employee();
		const stranded = await task([ada], { dueDate: inHours(5) });
		const employeeNotificationId = randomUUID();
		await dataSource.getRepository(TaskDueReminder).insert({
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			taskId: stranded,
			employeeId: ada,
			dueDate: inHours(5),
			employeeNotificationId,
			claimedAt: new Date(NOW.getTime() - TASK_DUE_REMINDER_STALE_CLAIM_MS - 1000)
		});

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ reminded: 1, recovered: 1 });
		expect(filed.map(({ input }) => input.id)).toEqual([employeeNotificationId]);
		expect((await claims())[0].filedAt?.getTime()).toBe(NOW.getTime());
	});

	it('records a stranded claim whose notification was written just before the stop, without filing it again', async () => {
		const ada = await employee();
		const stranded = await task([ada], { dueDate: inHours(5) });
		const employeeNotificationId = randomUUID();
		await dataSource.query(`INSERT INTO "employee_notification" ("id", "tenantId", "entityId") VALUES (?, ?, ?)`, [
			employeeNotificationId,
			TENANT,
			stranded
		]);
		await dataSource.getRepository(TaskDueReminder).insert({
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			taskId: stranded,
			employeeId: ada,
			dueDate: inHours(5),
			employeeNotificationId,
			claimedAt: new Date(NOW.getTime() - TASK_DUE_REMINDER_STALE_CLAIM_MS - 1000)
		});

		await service.sweep(NOW);

		expect(filed).toHaveLength(0);
		expect((await claims())[0].filedAt?.getTime()).toBe(NOW.getTime());
	});

	it('leaves a fresh unfiled claim to the process that holds it', async () => {
		const ada = await employee();
		const held = await task([ada], { dueDate: inHours(5) });
		await dataSource.getRepository(TaskDueReminder).insert({
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			taskId: held,
			employeeId: ada,
			dueDate: inHours(5),
			employeeNotificationId: randomUUID(),
			claimedAt: new Date(NOW.getTime() - 1000)
		});

		await service.sweep(NOW);

		expect(filed).toHaveLength(0);
	});

	it('resumes where a sweep out of time stopped, so later assignments are reached too', async () => {
		// Two people on many tasks: the first page is all due later than the reminder of the second person
		const ada = await employee({ preferences: { taskDueReminderHours: 1 } });
		for (let index = 0; index < 200; index++) await task([ada], { dueDate: inHours(2 + index / 1000) });
		const grace = await employee();
		const late = await task([grace], { dueDate: inHours(10) });

		// No time budget: each sweep reads one page
		const first = await service.sweep(NOW, 0);
		const second = await service.sweep(NOW, 0);

		expect(first).toMatchObject({ checked: 200, reminded: 0 });
		expect(second).toMatchObject({ checked: 1, reminded: 1 });
		expect(filed.map(({ input }) => input.entityId)).toEqual([late]);
	});

	it('reads through more assignments than a page holds', async () => {
		const ada = await employee();
		for (let index = 0; index < 205; index++) await task([ada], { dueDate: inHours(1 + index / 100) });

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ checked: 205, reminded: 205 });
	});
});
