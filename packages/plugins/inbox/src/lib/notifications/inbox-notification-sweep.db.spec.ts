/**
 * The notification filing on a real database (better-sqlite3, the demo's engine): the recovery sweep that files the
 * notifications the live filing missed (the Inbox spec §4 Reliability: no lost entries), and the many-to-one record
 * of the mentions folded into one entry (FR-4) through which every read / archive change reaches every notification
 * row the entry stands for, both ways (FR-15).
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as the plugin's other
 * database suites do: the employee and notification tables are mapped below by fixture schemas, and the request
 * context answers with the caller each case states.
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

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import {
	EmployeeNotificationTypeEnum,
	IInboxItemUpsertInput,
	INBOX_NOTIFICATION_EXTERNAL_SOURCE,
	PermissionsEnum
} from '@gauzy/contracts';
import { Employee, EmployeeNotification } from '@gauzy/core';
import { INBOX_MIGRATIONS } from '../database/inbox-migrations';
import { CreateInboxSweepCheckpointTable1791000006540 } from '../database/migrations/1791000006540-CreateInboxSweepCheckpointTable';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxSweepCheckpoint } from '../entities/inbox-sweep-checkpoint.entity';
import { INBOX_NOTIFICATION_SWEEP_CHECKPOINT, INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS } from '../inbox.constants';
import { InboxService } from '../inbox.service';
import { InboxSourceHandlerRegistry } from '../inbox-source-handler.registry';
import { InboxNotificationBridge, notificationItemInput, twinNotificationIdsOf } from './inbox-notification.bridge';
import { InboxNotificationSweepService } from './inbox-notification-sweep.service';

jest.setTimeout(60_000);

const TENANT = randomUUID();
const ORG = randomUUID();
const ADA = randomUUID(); // a user
const ADA_EMPLOYEE = randomUUID();
const BOB_EMPLOYEE = randomUUID(); // an employee with no user
const SENDER = randomUUID();
const TASK = randomUUID();

const MINUTE = 60_000;
/** That many minutes ago. */
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE);

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

const checkpointSchema = new EntitySchema({
	name: 'InboxSweepCheckpoint',
	target: InboxSweepCheckpoint,
	tableName: 'inbox_sweep_checkpoint',
	columns: {
		id: { type: String, primary: true },
		cursorAt: { type: Date, nullable: true },
		cursorId: { type: String, nullable: true },
		heldId: { type: String, nullable: true },
		heldAttempts: { type: Number, default: 0 },
		updatedAt: { type: Date, nullable: true }
	}
});

const employeeSchema = new EntitySchema({
	name: 'Employee',
	target: Employee,
	tableName: 'employee',
	columns: {
		id: { type: String, primary: true },
		tenantId: { type: String, nullable: true },
		userId: { type: String, nullable: true },
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

/** A time as TypeORM writes one on SQLite (UTC, milliseconds, no zone). */
const sqliteTime = (at: Date) => at.toISOString().replace('T', ' ').replace('Z', '');

/** The core tables the plugin reads, with the columns it uses. */
async function createCoreFixture(dataSource: DataSource): Promise<void> {
	await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)`);
	await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)`);
	await dataSource.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)`);
	await dataSource.query(
		`CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "deletedAt" datetime)`
	);
	await dataSource.query(
		`CREATE TABLE "role_permission" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "roleId" varchar, "permission" varchar, "enabled" boolean, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedAt" datetime)`
	);
	await dataSource.query(
		`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "userId" varchar, "deletedAt" datetime)`
	);
	await dataSource.query(
		`CREATE TABLE "employee_notification" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "deletedAt" datetime, "createdAt" datetime, "updatedAt" datetime, "type" varchar, "title" varchar, "message" varchar, "entity" varchar, "entityId" varchar, "isRead" boolean DEFAULT (0), "readAt" datetime, "sentByEmployeeId" varchar, "receiverEmployeeId" varchar)`
	);
	await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [TENANT]);
	await dataSource.query(`INSERT INTO "organization" ("id", "tenantId") VALUES (?, ?)`, [ORG, TENANT]);
	await dataSource.query(`INSERT INTO "user" ("id", "tenantId") VALUES (?, ?)`, [ADA, TENANT]);
	await dataSource.query(`INSERT INTO "employee" ("id", "tenantId", "userId") VALUES (?, ?, ?), (?, ?, NULL)`, [
		ADA_EMPLOYEE,
		TENANT,
		ADA,
		BOB_EMPLOYEE,
		TENANT
	]);
}

describe('The notification filing on SQLite', () => {
	let directory: string;
	let dataSource: DataSource;
	let registry: InboxSourceHandlerRegistry;
	let inbox: InboxService;
	let bridge: InboxNotificationBridge;
	let sweeps: InboxNotificationSweepService;

	/** A notification row, as `EmployeeNotificationService.create` saves it (and no filing yet). */
	async function notify(
		overrides: {
			type?: string;
			entityId?: string;
			receiverEmployeeId?: string;
			createdAt?: Date;
			isRead?: boolean;
		} = {}
	): Promise<EmployeeNotification> {
		const id = randomUUID();
		const createdAt = overrides.createdAt ?? ago(6);
		await dataSource.query(
			`INSERT INTO "employee_notification" ("id", "tenantId", "organizationId", "createdAt", "updatedAt", "type", "title", "entity", "entityId", "isRead", "sentByEmployeeId", "receiverEmployeeId") VALUES (?, ?, ?, ?, ?, ?, ?, 'Task', ?, ?, ?, ?)`,
			[
				id,
				TENANT,
				ORG,
				sqliteTime(createdAt),
				sqliteTime(createdAt),
				overrides.type ?? EmployeeNotificationTypeEnum.ASSIGNMENT,
				'Grace mentioned you',
				overrides.entityId ?? TASK,
				overrides.isRead ? 1 : 0,
				SENDER,
				overrides.receiverEmployeeId ?? ADA_EMPLOYEE
			]
		);
		return (await dataSource
			.getRepository(EmployeeNotification)
			.findOneByOrFail({ id } as never)) as EmployeeNotification;
	}

	const mention = (overrides: Parameters<typeof notify>[0] = {}) =>
		notify({ type: EmployeeNotificationTypeEnum.MENTION, ...overrides });

	const itemsOf = () =>
		dataSource.getRepository(InboxItem).find({ where: { externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE } });

	const rowOf = async (id: unknown) =>
		(await dataSource
			.getRepository(EmployeeNotification)
			.findOneByOrFail({ id } as never)) as EmployeeNotification & {
			isRead: boolean;
			isArchived: boolean;
			readAt?: Date | null;
		};

	const recipientOf = async (itemId: unknown) =>
		dataSource.getRepository(InboxItemRecipient).findOneByOrFail({ inboxItemId: itemId as string, userId: ADA });

	/**
	 * The live filing of a notification at the moment it was created: filed now, then dated as it would have been
	 * (the entry and its recipient row are created with the notification), so the ten-minute window sees it there.
	 */
	async function fileLive(notification: EmployeeNotification): Promise<void> {
		await bridge.fileNotification(notification);
		const at = sqliteTime(new Date(notification.createdAt as Date));
		await dataSource.query(
			`UPDATE "inbox_item" SET "createdAt" = ? WHERE "externalSource" = ? AND "externalId" = ?`,
			[at, INBOX_NOTIFICATION_EXTERNAL_SOURCE, notification.id]
		);
		await dataSource.query(
			`UPDATE "inbox_item_recipient" SET "createdAt" = ? WHERE "inboxItemId" IN (SELECT "id" FROM "inbox_item" WHERE "externalSource" = ? AND "externalId" = ?)`,
			[at, INBOX_NOTIFICATION_EXTERNAL_SOURCE, notification.id]
		);
	}

	/** A sweep now: the notifications made in the tests are older than the grace period (five minutes). */
	const sweepNow = (batch?: number) => sweeps.sweep(new Date(), batch);

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-sweep-'));
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: [itemSchema, recipientSchema, checkpointSchema, employeeSchema, notificationSchema],
			migrations: INBOX_MIGRATIONS,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		await createCoreFixture(dataSource);
		await dataSource.runMigrations({ transaction: 'each' });
		registry = new InboxSourceHandlerRegistry();
		inbox = new InboxService(dataSource, registry);
		bridge = new InboxNotificationBridge(dataSource, inbox, registry);
		bridge.onModuleInit();
		sweeps = new InboxNotificationSweepService(dataSource, bridge);
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA;
		mockCaller.permissions = [PermissionsEnum.INBOX_VIEW];
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await dataSource.destroy();
	});

	describe('the recovery sweep (no lost entries)', () => {
		it('files a notification whose live filing never happened, once', async () => {
			const lost = await notify();
			expect(await itemsOf()).toHaveLength(0);

			const report = await sweepNow();
			expect(report).toMatchObject({ read: 1, filed: 1, present: 0, held: false });
			const items = await itemsOf();
			expect(items.map((item) => item.externalId)).toEqual([lost.id]);
			expect((await recipientOf(items[0].id)).isRead).toBe(false);

			// The next sweep starts after it: nothing to read, nothing filed twice.
			expect(await sweepNow()).toMatchObject({ read: 0, filed: 0 });
			expect(await itemsOf()).toHaveLength(1);
		});

		it('leaves what the live filing filed alone, and never makes two entries of one notification', async () => {
			const filed = await notify({ createdAt: ago(7) });
			await fileLive(filed);
			const lost = await notify();

			expect(await sweepNow()).toMatchObject({ read: 2, present: 1, filed: 1 });
			expect((await itemsOf()).map((item) => item.externalId).sort()).toEqual([filed.id, lost.id].sort());

			// The live filing arriving late (after the sweep) finds the entry and adds nothing.
			await bridge.fileNotification(lost);
			expect(await bridge.settleNotification(lost)).toBe('present');
			expect(await itemsOf()).toHaveLength(2);
		});

		it('files a notification the receiver already read or archived as it stands', async () => {
			const read = await notify({ isRead: true, createdAt: ago(7) });
			const archived = await notify();
			await dataSource.query(`UPDATE "employee_notification" SET "isArchived" = 1 WHERE "id" = ?`, [archived.id]);

			await sweepNow();
			const items = await itemsOf();
			const byId = new Map(items.map((item) => [item.externalId, item]));
			expect((await recipientOf(byId.get(String(read.id))?.id)).isRead).toBe(true);
			expect((await recipientOf(byId.get(String(archived.id))?.id)).isArchived).toBe(true);
		});

		it('leaves the notifications of the grace period to the live filing', async () => {
			await notify({ createdAt: ago(1) });
			expect(await sweepNow()).toMatchObject({ read: 0 });
			expect(await sweeps.sweep(new Date(Date.now() + 5 * MINUTE))).toMatchObject({ read: 1, filed: 1 });
		});

		it('resumes from its checkpoint however long the worker was down (no age limit)', async () => {
			const weekAgo = new Date(Date.now() - 7 * 24 * 60 * MINUTE);
			// The worker last settled a notification a week ago, and has not swept since.
			const settled = await notify({ createdAt: new Date(weekAgo.getTime() - MINUTE) });
			await dataSource
				.getRepository(InboxSweepCheckpoint)
				.update(
					{ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT },
					{ cursorAt: settled.createdAt as Date, cursorId: String(settled.id) }
				);
			const old = await notify({ createdAt: weekAgo });
			const recent = await notify();

			expect(await sweepNow()).toMatchObject({ read: 2, filed: 2 });
			expect((await itemsOf()).map((item) => item.externalId).sort()).toEqual([old.id, recent.id].sort());
			const checkpoint = await dataSource
				.getRepository(InboxSweepCheckpoint)
				.findOneByOrFail({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT });
			expect(checkpoint.cursorId).toBe(recent.id);
		});

		it('starts where the Inbox was switched on (the place its migration wrote), not at the first notification ever', async () => {
			const before = await notify({ createdAt: ago(60) });
			const first = await notify({ createdAt: ago(8) });
			// The Inbox filed its first notification eight minutes ago: the one of an hour ago predates it (and its window).
			await fileLive(first);
			const lost = await notify();

			expect(await sweepNow()).toMatchObject({ read: 2, present: 1, filed: 1 });
			expect((await itemsOf()).map((item) => item.externalId)).not.toContain(before.id);
			expect((await itemsOf()).map((item) => item.externalId)).toContain(lost.id);
		});

		it('pages through notifications created at the same instant without repeating or skipping one', async () => {
			const at = ago(7);
			const ids: string[] = [];
			for (let index = 0; index < 5; index++) {
				ids.push(String((await notify({ createdAt: at, entityId: randomUUID() })).id));
			}
			const reports = [await sweepNow(2), await sweepNow(2), await sweepNow(2), await sweepNow(2)];
			expect(reports.map((report) => report.filed)).toEqual([2, 2, 1, 0]);
			expect((await itemsOf()).map((item) => item.externalId).sort()).toEqual(ids.sort());
		});

		it('passes over a notification with no user to address, as the live filing does', async () => {
			await notify({ receiverEmployeeId: BOB_EMPLOYEE, createdAt: ago(7) });
			const next = await notify();
			expect(await sweepNow()).toMatchObject({ read: 2, unaddressed: 1, filed: 1 });
			expect((await itemsOf()).map((item) => item.externalId)).toEqual([next.id]);
		});

		it('holds a notification it could not file and tries it again; gives it up after the last attempt', async () => {
			const stuck = await notify({ createdAt: ago(7) });
			const after = await notify();
			const settle = bridge.settleNotification.bind(bridge);
			jest.spyOn(bridge, 'settleNotification').mockImplementation(async (notification, now) => {
				if (notification.id === stuck.id) throw new Error('connection reset');
				return settle(notification, now);
			});

			for (let attempt = 1; attempt < INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS; attempt++) {
				expect(await sweepNow()).toMatchObject({ held: true, filed: 0 });
			}
			expect(await itemsOf()).toHaveLength(0);
			const held = await dataSource
				.getRepository(InboxSweepCheckpoint)
				.findOneByOrFail({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT });
			expect(held).toMatchObject({ heldId: stuck.id, heldAttempts: INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS - 1 });

			expect(await sweepNow()).toMatchObject({ held: false, skipped: 1, filed: 1 });
			expect((await itemsOf()).map((item) => item.externalId)).toEqual([after.id]);
			const moved = await dataSource
				.getRepository(InboxSweepCheckpoint)
				.findOneByOrFail({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT });
			expect(moved).toMatchObject({ heldId: null, heldAttempts: 0, cursorId: after.id });
		});

		it('files a held notification once its filing works again', async () => {
			const stuck = await notify();
			const settle = bridge.settleNotification.bind(bridge);
			const spy = jest.spyOn(bridge, 'settleNotification').mockRejectedValueOnce(new Error('deadlock'));
			expect(await sweepNow()).toMatchObject({ held: true });
			spy.mockImplementation(settle);
			expect(await sweepNow()).toMatchObject({ held: false, filed: 1 });
			expect((await itemsOf()).map((item) => item.externalId)).toEqual([stuck.id]);
		});

		it('gives up at once a notification the Inbox refuses', async () => {
			const refused = await notify({ createdAt: ago(7) });
			const after = await notify();
			const settle = bridge.settleNotification.bind(bridge);
			jest.spyOn(bridge, 'settleNotification').mockImplementation(async (notification, now) => {
				if (notification.id === refused.id)
					throw new BadRequestException('The organization of an inbox item must be one of its tenant’s.');
				return settle(notification, now);
			});
			expect(await sweepNow()).toMatchObject({ skipped: 1, filed: 1, held: false });
			expect((await itemsOf()).map((item) => item.externalId)).toEqual([after.id]);
		});
		it('the migration writes the first place: where the Inbox started filing, so failed first filings are caught up', async () => {
			const checkpoints = dataSource.getRepository(InboxSweepCheckpoint);
			expect(await checkpoints.findOneByOrFail({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT })).toMatchObject({
				cursorId: null,
				heldAttempts: 0
			});
			// An Inbox that filed its first notification an hour ago, and whose next filings all failed.
			await checkpoints.delete({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT });
			const before = await notify({ createdAt: ago(90) });
			const first = await notify({ createdAt: ago(60) });
			await fileLive(first);
			const lost = await notify({ createdAt: ago(50) });
			await new CreateInboxSweepCheckpointTable1791000006540().up(dataSource.createQueryRunner());
			const seeded = await checkpoints.findOneByOrFail({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT });
			expect(Math.abs(new Date(seeded.cursorAt as Date).getTime() - ago(60).getTime())).toBeLessThan(MINUTE);

			// A second run moves nothing.
			await checkpoints.update({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT }, { cursorId: String(first.id) });
			await new CreateInboxSweepCheckpointTable1791000006540().up(dataSource.createQueryRunner());
			expect((await checkpoints.findOneByOrFail({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT })).cursorId).toBe(
				first.id
			);
			await checkpoints.update({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT }, { cursorId: null });

			expect(await sweepNow()).toMatchObject({ read: 2, present: 1, filed: 1 });
			expect((await itemsOf()).map((item) => item.externalId).sort()).toEqual([first.id, lost.id].sort());
			expect((await itemsOf()).map((item) => item.externalId)).not.toContain(before.id);
		});

		it('dates a recovered entry as its notification', async () => {
			const lost = await notify({ createdAt: ago(45) });
			await dataSource
				.getRepository(InboxSweepCheckpoint)
				.update({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT }, { cursorAt: ago(60) });
			await sweepNow();
			const [item] = await itemsOf();
			expect(new Date(item.createdAt as Date).getTime()).toBe(new Date(lost.createdAt as Date).getTime());
			expect(new Date((await recipientOf(item.id)).createdAt as Date).getTime()).toBe(
				new Date(lost.createdAt as Date).getTime()
			);
		});

		it('completes an entry a failed write left without its recipient row', async () => {
			const lost = await notify();
			// The item was saved, its recipient row was not (`InboxService.write` saves the item first).
			await inbox.upsertExternal({
				...(notificationItemInput(lost, ADA) as IInboxItemUpsertInput),
				recipients: []
			});
			expect(await itemsOf()).toHaveLength(1);
			expect(await dataSource.getRepository(InboxItemRecipient).count()).toBe(0);

			expect(await sweepNow()).toMatchObject({ read: 1, present: 0, filed: 1 });
			const items = await itemsOf();
			expect(items.map((item) => item.externalId)).toEqual([lost.id]);
			expect((await recipientOf(items[0].id)).isRead).toBe(false);
			expect(await bridge.settleNotification(lost)).toBe('present');
		});
	});

	describe('folded mentions (FR-4) and the sweep', () => {
		it('does not file a twin the live filing folded: it is recorded on the entry', async () => {
			const first = await mention({ createdAt: ago(8) });
			await fileLive(first);
			const twin = await mention({ createdAt: ago(7) });
			await fileLive(twin);

			const [item] = await itemsOf();
			expect(await itemsOf()).toHaveLength(1);
			expect(twinNotificationIdsOf(item.metadata)).toEqual([twin.id]);

			expect(await sweepNow()).toMatchObject({ read: 2, present: 2, filed: 0, folded: 0 });
			expect(await itemsOf()).toHaveLength(1);
		});

		it('folds a lost twin into the entry of its mention, as the live filing would have', async () => {
			const first = await mention({ createdAt: ago(8) });
			await fileLive(first);
			// Folded before the record existed, or lost between its commit and its filing: no record either way.
			const twin = await mention({ createdAt: ago(7) });

			expect(await sweepNow()).toMatchObject({ present: 1, folded: 1, filed: 0 });
			const items = await itemsOf();
			expect(items.map((item) => item.externalId)).toEqual([first.id]);
			expect(twinNotificationIdsOf(items[0].metadata)).toEqual([twin.id]);
			// Folded once: the next sweeps leave it.
			expect(await sweepNow()).toMatchObject({ read: 0 });
			expect(await bridge.settleNotification(twin)).toBe('present');
		});

		it('folds two lost mentions of one record into one entry, however late the sweep', async () => {
			await dataSource
				.getRepository(InboxSweepCheckpoint)
				.update({ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT }, { cursorAt: ago(60) });
			const first = await mention({ createdAt: ago(40) });
			const twin = await mention({ createdAt: ago(38) });

			expect(await sweepNow()).toMatchObject({ read: 2, filed: 1, folded: 1 });
			const items = await itemsOf();
			expect(items.map((item) => item.externalId)).toEqual([first.id]);
			expect(twinNotificationIdsOf(items[0].metadata)).toEqual([twin.id]);
		});

		it("gives a recorded twin the entry's state again (a fold that stopped between its two writes)", async () => {
			const first = await mention({ createdAt: ago(8) });
			await fileLive(first);
			const twin = await mention({ createdAt: ago(7) });
			await fileLive(twin);
			const [item] = await itemsOf();
			await inbox.setState(item.id as never, { isRead: true });
			await dataSource.query(`UPDATE "employee_notification" SET "isRead" = 0, "readAt" = NULL WHERE "id" = ?`, [
				twin.id
			]);

			expect(await sweepNow()).toMatchObject({ present: 2, filed: 0, folded: 0 });
			expect((await rowOf(twin.id)).isRead).toBe(true);
		});

		it('files a mention of another record, or ten minutes away from its twin, as an entry of its own', async () => {
			const first = await mention({ createdAt: ago(30) });
			await fileLive(first);
			const elsewhere = await mention({ entityId: randomUUID(), createdAt: ago(7) });
			const later = await mention();
			expect(await sweepNow()).toMatchObject({ filed: 2, folded: 0 });
			expect((await itemsOf()).map((item) => item.externalId).sort()).toEqual(
				[first.id, elsewhere.id, later.id].sort()
			);
		});
	});

	describe('the rows an entry stands for (a folded twin is mirrored too)', () => {
		/** An entry of two mentions: the first filed, the second folded into it. */
		async function foldedPair() {
			const first = await mention({ createdAt: ago(8) });
			await fileLive(first);
			const twin = await mention({ createdAt: ago(7) });
			await fileLive(twin);
			const [item] = await itemsOf();
			return { first, twin, item };
		}

		it('an Inbox read, unread, archive and unarchive reach the folded twin as well', async () => {
			const { first, twin, item } = await foldedPair();

			await inbox.setState(item.id as never, { isRead: true });
			expect((await rowOf(first.id)).isRead).toBe(true);
			expect((await rowOf(twin.id)).isRead).toBe(true);
			expect((await rowOf(twin.id)).readAt).toBeTruthy();

			await inbox.setState(item.id as never, { isRead: false });
			expect((await rowOf(first.id)).isRead).toBe(false);
			expect((await rowOf(twin.id)).isRead).toBe(false);
			expect((await rowOf(twin.id)).readAt).toBeNull();

			await inbox.setState(item.id as never, { isArchived: true });
			expect((await rowOf(twin.id)).isArchived).toBe(true);
			await inbox.setState(item.id as never, { isArchived: false });
			expect((await rowOf(twin.id)).isArchived).toBe(false);
		});

		it('mark-all-read in the Inbox reaches the folded twin', async () => {
			const { twin } = await foldedPair();
			await inbox.markAllRead();
			// The sources are told in the background, one item after the other.
			for (let tries = 0; tries < 50 && !(await rowOf(twin.id)).isRead; tries++) {
				await new Promise((resolve) => setTimeout(resolve, 20));
			}
			expect((await rowOf(twin.id)).isRead).toBe(true);
		});

		it('a change of the twin through the notification API reaches the entry and the first mention', async () => {
			const { first, twin, item } = await foldedPair();

			await bridge.mirrorNotificationState({
				tenantId: TENANT,
				receiverEmployeeId: ADA_EMPLOYEE,
				ids: [twin.id],
				isRead: true
			} as never);
			expect((await recipientOf(item.id)).isRead).toBe(true);
			expect((await rowOf(first.id)).isRead).toBe(true);

			await bridge.mirrorNotificationState({
				tenantId: TENANT,
				receiverEmployeeId: ADA_EMPLOYEE,
				ids: [twin.id],
				isArchived: true
			} as never);
			expect((await recipientOf(item.id)).isArchived).toBe(true);
			expect((await rowOf(first.id)).isArchived).toBe(true);
		});

		it('a change of the first mention through the notification API reaches the folded twin', async () => {
			const { first, twin, item } = await foldedPair();
			await bridge.mirrorNotificationState({
				tenantId: TENANT,
				receiverEmployeeId: ADA_EMPLOYEE,
				ids: [first.id],
				isRead: true
			} as never);
			expect((await recipientOf(item.id)).isRead).toBe(true);
			expect((await rowOf(twin.id)).isRead).toBe(true);
		});

		it('a twin folded into an entry already read takes its state, so both lists agree', async () => {
			const first = await mention({ createdAt: ago(8) });
			await fileLive(first);
			const [item] = await itemsOf();
			await inbox.setState(item.id as never, { isRead: true });

			const twin = await mention({ createdAt: ago(7) });
			await fileLive(twin);
			expect((await rowOf(twin.id)).isRead).toBe(true);
			expect((await recipientOf(item.id)).isRead).toBe(true);
		});
	});
});
