/**
 * A timer reminder's email and push on a real database (better-sqlite3, the demo's engine), from the notification to
 * the delivery lane's sweep: filed in the Inbox by the bridge as any notification, decided by the lane's intake, sent
 * or not once its wait is over (ever-co/ever-teams#5022).
 *
 * The platform cannot tell an open Ever Teams tab from the desktop or the mobile app by a timer's heartbeat, so it
 * files every reminder unread. The tab that showed the reminder marks it read through the notification API, which the
 * bridge carries to the Inbox entry: the lane must then send nothing, while a reminder no tab showed still goes by
 * email and push once the wait is over. Every other kind is sent as it always was, read or not.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as the plugin's other
 * database suites do: the employee and notification tables are mapped below by fixture schemas, and the request
 * context answers for the tenant's user.
 */
const mockCaller: { tenantId: string | null; userId: string | null; permissions: string[] } = {
	tenantId: null,
	userId: null,
	permissions: []
};

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class BaseEntity {}
	class Employee {}
	class EmployeeNotification {}
	class EmployeeNotificationCreatedEvent {
		constructor(public readonly notification: unknown) {}
	}
	class EmployeeNotificationUpdatedEvent {
		constructor(public readonly change: unknown) {}
	}
	return {
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		SkipExport: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		Employee,
		EmployeeNotification,
		EmployeeNotificationCreatedEvent,
		EmployeeNotificationUpdatedEvent,
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentUserId: () => mockCaller.userId,
			hasPermission: (permission: string) => mockCaller.permissions.includes(permission)
		}
	};
});

// Each send runs inside a request context of the recipient's tenant; here the context is the test's.
jest.mock('./inbox-delivery-context', () => ({
	InboxDeliveryContextUnavailableError: class InboxDeliveryContextUnavailableError extends Error {},
	deliveryUserOf: jest.fn(() => ({})),
	runInDeliveryContext: jest.fn((_user: unknown, fn: () => Promise<unknown>) => fn())
}));

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntitySchema } from 'typeorm';
import {
	EmployeeNotificationTypeEnum,
	InboxDeliveryChannelEnum,
	InboxDeliveryModeEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { Employee, EmployeeNotification } from '@gauzy/core';
import { INBOX_MIGRATIONS } from '../database/inbox-migrations';
import { CreateInboxDeliveryTable1791000005300 } from '../database/migrations/1791000005300-CreateInboxDeliveryTable';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxService } from '../inbox.service';
import { InboxSourceHandlerRegistry } from '../inbox-source-handler.registry';
import { InboxNotificationBridge } from '../notifications/inbox-notification.bridge';
import { InboxDelivery } from './inbox-delivery.entity';
import { INBOX_DELIVERY_SKIPPED_READ, INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS } from './inbox-delivery.constants';
import { InboxDeliveryMailer } from './inbox-delivery-mailer';
import { InboxDeliveryService } from './inbox-delivery.service';

jest.setTimeout(60_000);

const TENANT = randomUUID();
const ORG = randomUUID();
const ADA = randomUUID(); // the user
const ADA_EMPLOYEE = randomUUID();
const TIME_LOG = randomUUID(); // the run the reminders are about
const TASK = randomUUID();

const SECOND = 1000;

const base = {
	id: { type: String, primary: true, generated: 'uuid' as const },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, nullable: true, default: true },
	isArchived: { type: Boolean, nullable: true, default: false },
	archivedAt: { type: Date, nullable: true },
	deletedAt: { type: Date, nullable: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true }
};

const itemSchema = new EntitySchema({
	name: 'InboxItem',
	target: InboxItem,
	tableName: 'inbox_item',
	columns: {
		...base,
		kind: { type: String },
		source: { type: String },
		status: { type: String, default: 'OPEN' },
		title: { type: String },
		body: { type: String, nullable: true },
		bodyFormat: { type: String, default: 'plain' },
		options: { type: String, nullable: true },
		requireReason: { type: Boolean, default: false },
		response: { type: String, nullable: true },
		priority: { type: String, default: 'normal' },
		dueAt: { type: Date, nullable: true },
		entity: { type: String, nullable: true },
		entityId: { type: String, nullable: true },
		taskId: { type: String, nullable: true },
		projectId: { type: String, nullable: true },
		agentEmployeeId: { type: String, nullable: true },
		mailboxId: { type: String, nullable: true },
		emailId: { type: String, nullable: true },
		externalSource: { type: String, nullable: true },
		externalId: { type: String, nullable: true },
		metadata: { type: String, nullable: true }
	}
});

const recipientSchema = new EntitySchema({
	name: 'InboxItemRecipient',
	target: InboxItemRecipient,
	tableName: 'inbox_item_recipient',
	columns: {
		...base,
		inboxItemId: { type: String },
		userId: { type: String },
		isRead: { type: Boolean, default: false },
		readAt: { type: Date, nullable: true },
		snoozedUntil: { type: Date, nullable: true },
		deliveredAt: { type: Date, nullable: true },
		doneAt: { type: Date, nullable: true }
	}
});

const deliverySchema = new EntitySchema({
	name: 'InboxDelivery',
	target: InboxDelivery,
	tableName: 'inbox_delivery',
	columns: {
		...base,
		inboxItemId: { type: String },
		userId: { type: String },
		employeeId: { type: String, nullable: true },
		channel: { type: String },
		mode: { type: String },
		notificationType: { type: String, nullable: true },
		dueAt: { type: Date, nullable: true },
		digestKey: { type: String, nullable: true },
		sentAt: { type: Date, nullable: true },
		attempts: { type: Number, default: 0 },
		nextAttemptAt: { type: Date, nullable: true },
		lastError: { type: String, nullable: true },
		failedAt: { type: Date, nullable: true }
	}
});

/** The employee, with the heartbeat the push step reads (a focused session holds a push back). */
const employeeSchema = new EntitySchema({
	name: 'Employee',
	target: Employee,
	tableName: 'employee',
	columns: {
		id: { type: String, primary: true },
		tenantId: { type: String, nullable: true },
		userId: { type: String, nullable: true },
		lastSeenAt: { type: Date, nullable: true },
		isIdle: { type: Boolean, nullable: true },
		deletedAt: { type: Date, nullable: true, deleteDate: true }
	}
});

const notificationSchema = new EntitySchema({
	name: 'EmployeeNotification',
	target: EmployeeNotification,
	tableName: 'employee_notification',
	columns: {
		...base,
		deletedAt: { type: Date, nullable: true, deleteDate: true },
		createdAt: { type: Date, nullable: true },
		type: { type: String, nullable: true },
		title: { type: String, nullable: true },
		message: { type: String, nullable: true },
		entity: { type: String, nullable: true },
		entityId: { type: String, nullable: true },
		isRead: { type: Boolean, default: false },
		readAt: { type: Date, nullable: true },
		sentByEmployeeId: { type: String, nullable: true },
		receiverEmployeeId: { type: String, nullable: true }
	}
});

/** The person an email goes to, as the lane reads them (by name, like the application's own entity). */
const userSchema = new EntitySchema({
	name: 'User',
	tableName: 'user',
	columns: {
		id: { type: String, primary: true },
		tenantId: { type: String, nullable: true },
		email: { type: String, nullable: true },
		firstName: { type: String, nullable: true },
		lastName: { type: String, nullable: true },
		preferredLanguage: { type: String, nullable: true },
		timeZone: { type: String, nullable: true }
	}
});

/** The employee's notification setting (none here: the defaults, an email at once and a push to the device). */
const settingSchema = new EntitySchema({
	name: 'EmployeeNotificationSetting',
	tableName: 'employee_notification_setting',
	columns: {
		id: { type: String, primary: true },
		tenantId: { type: String, nullable: true },
		employeeId: { type: String, nullable: true },
		preferences: { type: String, nullable: true }
	}
});

/** The core tables the plugin reads, with the columns it uses. */
async function createCoreFixture(dataSource: DataSource): Promise<void> {
	await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)`);
	await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)`);
	await dataSource.query(
		`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "email" varchar, "firstName" varchar, "lastName" varchar, "preferredLanguage" varchar, "timeZone" varchar)`
	);
	await dataSource.query(
		`CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "deletedAt" datetime)`
	);
	await dataSource.query(
		`CREATE TABLE "role_permission" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "roleId" varchar, "permission" varchar, "enabled" boolean, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedAt" datetime)`
	);
	await dataSource.query(
		`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "userId" varchar, "lastSeenAt" datetime, "isIdle" boolean, "deletedAt" datetime)`
	);
	await dataSource.query(
		`CREATE TABLE "employee_notification" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "deletedAt" datetime, "createdAt" datetime, "updatedAt" datetime, "type" varchar, "title" varchar, "message" varchar, "entity" varchar, "entityId" varchar, "isRead" boolean DEFAULT (0), "readAt" datetime, "sentByEmployeeId" varchar, "receiverEmployeeId" varchar)`
	);
	await dataSource.query(
		`CREATE TABLE "employee_notification_setting" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "employeeId" varchar, "preferences" text)`
	);
	await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [TENANT]);
	await dataSource.query(`INSERT INTO "organization" ("id", "tenantId") VALUES (?, ?)`, [ORG, TENANT]);
	await dataSource.query(
		`INSERT INTO "user" ("id", "tenantId", "email", "firstName", "lastName", "preferredLanguage", "timeZone") VALUES (?, ?, 'ada@example.test', 'Ada', 'Lovelace', 'en', 'UTC')`,
		[ADA, TENANT]
	);
	await dataSource.query(`INSERT INTO "employee" ("id", "tenantId", "userId") VALUES (?, ?, ?)`, [
		ADA_EMPLOYEE,
		TENANT,
		ADA
	]);
}

/** A time as TypeORM writes one on SQLite (UTC, milliseconds, no zone). */
const sqliteTime = (at: Date) => at.toISOString().replace('T', ' ').replace('Z', '');

describe("A timer reminder's email and push, on SQLite", () => {
	let directory: string;
	let dataSource: DataSource;
	let bridge: InboxNotificationBridge;
	let delivery: InboxDeliveryService;
	const mailer = {
		host: () => 'https://app.test',
		sendNotification: jest.fn(async (_recipient: unknown, _line: unknown) => undefined),
		sendDigest: jest.fn(async (_recipient: unknown, _lines: unknown, _total: number) => undefined)
	};
	const pusher = { configured: () => true, send: jest.fn(async (_device: unknown, _payload: unknown) => undefined) };
	const device = { id: randomUUID(), endpoint: 'https://push.test/ada', p256dh: 'p', auth: 'a', failures: 0 };
	const subscriptions = {
		hasAny: jest.fn(async () => true),
		devicesOf: jest.fn(async () => [device]),
		markUsed: jest.fn(async () => undefined),
		gone: jest.fn(async () => undefined),
		recordFailure: jest.fn(async () => false)
	};

	/**
	 * A notification for Ada as `EmployeeNotificationService.create` saves it, filed in the Inbox at once (the live
	 * filing): a timer reminder about the run's time log unless another kind is named.
	 */
	async function notifyAndFile(
		overrides: { type?: string; isRead?: boolean } = {}
	): Promise<{ notification: EmployeeNotification; itemId: string; filedAt: Date }> {
		const id = randomUUID();
		const createdAt = new Date();
		const isTimerReminder =
			(overrides.type ?? EmployeeNotificationTypeEnum.TIMER_REMINDER) ===
			EmployeeNotificationTypeEnum.TIMER_REMINDER;
		await dataSource.query(
			`INSERT INTO "employee_notification" ("id", "tenantId", "organizationId", "createdAt", "updatedAt", "type", "title", "entity", "entityId", "isRead", "receiverEmployeeId") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				TENANT,
				ORG,
				sqliteTime(createdAt),
				sqliteTime(createdAt),
				overrides.type ?? EmployeeNotificationTypeEnum.TIMER_REMINDER,
				isTimerReminder ? 'Your timer has been running for 8 hours' : 'Grace mentioned you',
				isTimerReminder ? 'TimeLog' : 'Task',
				isTimerReminder ? TIME_LOG : TASK,
				overrides.isRead ? 1 : 0,
				ADA_EMPLOYEE
			]
		);
		const notification = (await dataSource
			.getRepository(EmployeeNotification)
			.findOneByOrFail({ id } as never)) as EmployeeNotification;
		await bridge.fileNotification(notification);
		const item = await dataSource.getRepository(InboxItem).findOneByOrFail({ externalId: id } as never);
		return { notification, itemId: String(item.id), filedAt: createdAt };
	}

	/**
	 * What the notification API does when the Ever Teams tab that showed the reminder marks it read
	 * (`PUT /employee-notification/:id { isRead: true }`): the row is written, and its state-change event reaches the
	 * bridge, which carries it to the Inbox entry.
	 */
	async function markReadThroughTheNotificationApi(notification: EmployeeNotification): Promise<void> {
		await dataSource.query(`UPDATE "employee_notification" SET "isRead" = 1, "readAt" = ? WHERE "id" = ?`, [
			sqliteTime(new Date()),
			notification.id
		]);
		await bridge.mirrorNotificationState({
			tenantId: TENANT,
			receiverEmployeeId: ADA_EMPLOYEE,
			ids: [String(notification.id)],
			isRead: true
		});
	}

	const rowsOf = (itemId: string) =>
		dataSource
			.getRepository(InboxDelivery)
			.find({ where: { inboxItemId: itemId } as never, order: { channel: 'ASC' } as never });

	const afterWait = (filedAt: Date, ms = 0) =>
		new Date(filedAt.getTime() + INBOX_DELIVERY_TIMER_REMINDER_GRACE_MS + ms);

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-delivery-'));
		process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'] = 'true';
		process.env['GAUZY_INBOX_WEB_PUSH_ENABLED'] = 'true';
	});

	afterAll(() => {
		delete process.env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'];
		delete process.env['GAUZY_INBOX_WEB_PUSH_ENABLED'];
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		jest.clearAllMocks();
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: [
				itemSchema,
				recipientSchema,
				deliverySchema,
				employeeSchema,
				notificationSchema,
				userSchema,
				settingSchema
			],
			migrations: [...INBOX_MIGRATIONS, CreateInboxDeliveryTable1791000005300],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		await createCoreFixture(dataSource);
		await dataSource.runMigrations({ transaction: 'each' });
		const registry = new InboxSourceHandlerRegistry();
		const inbox = new InboxService(dataSource, registry);
		bridge = new InboxNotificationBridge(dataSource, inbox, registry);
		bridge.onModuleInit();
		delivery = new InboxDeliveryService(
			dataSource,
			mailer as unknown as InboxDeliveryMailer,
			pusher as never,
			subscriptions as never
		);
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA;
		mockCaller.permissions = [PermissionsEnum.INBOX_VIEW];
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it("a desktop timer's reminder that an open tab showed and marked read goes neither by email nor by push", async () => {
		// Filed unread: the platform cannot tell the tab from the desktop app by the run's heartbeat
		const { notification, itemId, filedAt } = await notifyAndFile();
		expect(await delivery.sweep(filedAt)).toMatchObject({ decided: 2, immediateSent: 0, pushesSent: 0 });
		const decided = await rowsOf(itemId);
		expect(decided.map((row) => [row.channel, row.mode, new Date(row.dueAt as Date).getTime()])).toEqual([
			[InboxDeliveryChannelEnum.EMAIL, InboxDeliveryModeEnum.IMMEDIATE, afterWait(filedAt).getTime()],
			[InboxDeliveryChannelEnum.PUSH, InboxDeliveryModeEnum.IMMEDIATE, afterWait(filedAt).getTime()]
		]);

		// The tab shows the toast, finds the platform's copy a sweep later, and marks it read
		await markReadThroughTheNotificationApi(notification);
		expect(
			(await dataSource.getRepository(InboxItemRecipient).findOneByOrFail({ inboxItemId: itemId } as never))
				.isRead
		).toBe(true);

		expect(await delivery.sweep(afterWait(filedAt))).toMatchObject({
			immediateSent: 0,
			pushesSent: 0,
			readSkipped: 2,
			failed: 0
		});
		expect(mailer.sendNotification).not.toHaveBeenCalled();
		expect(pusher.send).not.toHaveBeenCalled();
		const closed = await rowsOf(itemId);
		expect(closed.map((row) => [row.channel, row.sentAt ?? null, row.lastError])).toEqual([
			[InboxDeliveryChannelEnum.EMAIL, null, INBOX_DELIVERY_SKIPPED_READ],
			[InboxDeliveryChannelEnum.PUSH, null, INBOX_DELIVERY_SKIPPED_READ]
		]);
		// Closed for good: a later sweep sends nothing either
		expect(await delivery.sweep(afterWait(filedAt, 60 * SECOND))).toMatchObject({
			immediateSent: 0,
			pushesSent: 0,
			readSkipped: 0
		});
	});

	it('with no tab open, it goes by email and by push once the wait is over, and not before', async () => {
		const { itemId, filedAt } = await notifyAndFile();
		expect(await delivery.sweep(filedAt)).toMatchObject({ decided: 2 });

		expect(await delivery.sweep(afterWait(filedAt, -SECOND))).toMatchObject({ immediateSent: 0, pushesSent: 0 });
		expect(mailer.sendNotification).not.toHaveBeenCalled();

		expect(await delivery.sweep(afterWait(filedAt))).toMatchObject({
			immediateSent: 1,
			pushesSent: 1,
			readSkipped: 0,
			failed: 0
		});
		expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
		expect(mailer.sendNotification.mock.calls[0][1]).toMatchObject({
			itemId,
			title: 'Your timer has been running for 8 hours',
			kindLabel: 'Timer reminder'
		});
		expect(pusher.send).toHaveBeenCalledTimes(1);
		expect((await rowsOf(itemId)).every((row) => !!row.sentAt)).toBe(true);
	});

	it('one the tab marks read after its email and push went changes nothing that was sent', async () => {
		const { notification, itemId, filedAt } = await notifyAndFile();
		await delivery.sweep(filedAt);
		await delivery.sweep(afterWait(filedAt));
		await markReadThroughTheNotificationApi(notification);

		expect(await delivery.sweep(afterWait(filedAt, 60 * SECOND))).toMatchObject({
			immediateSent: 0,
			pushesSent: 0,
			readSkipped: 0
		});
		expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
		expect(pusher.send).toHaveBeenCalledTimes(1);
		expect((await rowsOf(itemId)).map((row) => row.lastError ?? null)).toEqual([null, null]);
	});

	it('one read before the lane takes it in (a tab marked it within the minute) is decided as nothing', async () => {
		const { itemId, filedAt } = await notifyAndFile({ isRead: true });
		expect(await delivery.sweep(filedAt)).toMatchObject({ decided: 2 });
		expect((await rowsOf(itemId)).map((row) => row.mode)).toEqual([
			InboxDeliveryModeEnum.NONE,
			InboxDeliveryModeEnum.NONE
		]);

		await delivery.sweep(afterWait(filedAt));
		expect(mailer.sendNotification).not.toHaveBeenCalled();
		expect(pusher.send).not.toHaveBeenCalled();
	});

	it("one marked read through the notification API that its Inbox entry's row missed is not sent either", async () => {
		const { notification, itemId, filedAt } = await notifyAndFile();
		await delivery.sweep(filedAt);
		// The mark lands on the notification while its entry is being filed: the bridge's mirror misses the entry's row
		await dataSource.query(`UPDATE "employee_notification" SET "isRead" = 1 WHERE "id" = ?`, [notification.id]);
		const recipient = await dataSource
			.getRepository(InboxItemRecipient)
			.findOneByOrFail({ inboxItemId: itemId } as never);
		expect(recipient.isRead).toBe(false);

		expect(await delivery.sweep(afterWait(filedAt))).toMatchObject({
			immediateSent: 0,
			pushesSent: 0,
			readSkipped: 2
		});
		expect(mailer.sendNotification).not.toHaveBeenCalled();
		expect(pusher.send).not.toHaveBeenCalled();
	});

	it('any other kind is emailed and pushed at once, as it always was, read in the app or not', async () => {
		const { notification, itemId, filedAt } = await notifyAndFile({ type: EmployeeNotificationTypeEnum.MENTION });
		await markReadThroughTheNotificationApi(notification);

		expect(await delivery.sweep(filedAt)).toMatchObject({
			decided: 2,
			immediateSent: 1,
			pushesSent: 1,
			readSkipped: 0
		});
		expect((await rowsOf(itemId)).map((row) => new Date(row.dueAt as Date).getTime())).toEqual([
			filedAt.getTime(),
			filedAt.getTime()
		]);
		expect(mailer.sendNotification).toHaveBeenCalledTimes(1);
		expect(pusher.send).toHaveBeenCalledTimes(1);
	});
});
