/**
 * The Inbox (G-P3-1) on a real database (better-sqlite3, the demo's engine): the three migrations (up, up
 * again, down), the role grants, the recipient-scoped reads with tabs, filters and pages, replies through a
 * source handler (claimed once, released when the source refuses), the recipient state, and the writes of a
 * source (`upsertExternal`: idempotent on the external identity, recipients limited to the tenant's users).
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as the other plugin
 * database suites do: the plugin's entities are mapped below by fixture schemas over the tables its migrations
 * create, and the request context answers with the caller each case states.
 */
const mockCaller: { tenantId: string | null; userId: string | null; permissions: string[] } = {
	tenantId: null,
	userId: null,
	permissions: []
};

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class BaseEntity {}
	return {
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
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
import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	NotFoundException,
	ServiceUnavailableException
} from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import {
	IInboxSourceHandler,
	InboxItemKindEnum,
	InboxItemSourceEnum,
	InboxItemStatusEnum,
	InboxTabEnum,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { InboxItem } from './entities/inbox-item.entity';
import { InboxItemRecipient } from './entities/inbox-item-recipient.entity';
import { INBOX_MIGRATIONS } from './database/inbox-migrations';
import { InboxService } from './inbox.service';
import { InboxSourceHandlerRegistry } from './inbox-source-handler.registry';

jest.setTimeout(60_000);

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORG = randomUUID();
const OTHER_ORG = randomUUID(); // another organization of the same tenant
const FOREIGN_ORG = randomUUID(); // an organization of the other tenant
const ADA = randomUUID();
const BOB = randomUUID();
const EVE = randomUUID(); // a user of the other tenant

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
		deliveredAt: { type: Date, nullable: true }
	}
});

/** The core tables the migrations reference or seed, with the columns they use. */
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
		`CREATE TABLE "user_organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "deletedAt" datetime)`
	);
	await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?), (?)`, [TENANT, OTHER_TENANT]);
	await dataSource.query(`INSERT INTO "organization" ("id", "tenantId") VALUES (?, ?), (?, ?), (?, ?)`, [
		ORG,
		TENANT,
		OTHER_ORG,
		TENANT,
		FOREIGN_ORG,
		OTHER_TENANT
	]);
	// Bob is a member of ORG only.
	await dataSource.query(
		`INSERT INTO "user_organization" ("id", "tenantId", "organizationId", "userId", "isActive") VALUES (?, ?, ?, ?, 1)`,
		[randomUUID(), TENANT, ORG, BOB]
	);
	await dataSource.query(`INSERT INTO "user" ("id", "tenantId") VALUES (?, ?), (?, ?), (?, ?)`, [
		ADA,
		TENANT,
		BOB,
		TENANT,
		EVE,
		OTHER_TENANT
	]);
}

describe('Inbox on SQLite', () => {
	let directory: string;
	let dataSource: DataSource;
	let registry: InboxSourceHandlerRegistry;
	let service: InboxService;

	const as = (userId: string, tenantId = TENANT, permissions: string[] = [PermissionsEnum.INBOX_VIEW]) => {
		mockCaller.userId = userId;
		mockCaller.tenantId = tenantId;
		mockCaller.permissions = permissions;
	};

	const question = (overrides: Record<string, unknown> = {}) =>
		service.create({
			tenantId: TENANT,
			organizationId: ORG,
			kind: InboxItemKindEnum.QUESTION,
			source: InboxItemSourceEnum.GAUZY,
			title: 'Ship the release?',
			options: [
				{ id: 'yes', label: 'Yes', recommended: true },
				{ id: 'no', label: 'No' }
			],
			recipients: [{ userId: ADA }],
			...overrides
		});

	beforeAll(async () => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-'));
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: [itemSchema, recipientSchema],
			migrations: INBOX_MIGRATIONS,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		await createCoreFixture(dataSource);
		await dataSource.runMigrations({ transaction: 'each' });
		registry = new InboxSourceHandlerRegistry();
		service = new InboxService(dataSource, registry);
		as(ADA);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	describe('migrations', () => {
		const tables = async () =>
			(
				await dataSource.query(
					`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'inbox_%' ORDER BY name`
				)
			).map((row: { name: string }) => row.name);

		it('create both tables, and a second run adds nothing', async () => {
			expect(await tables()).toEqual(['inbox_item', 'inbox_item_recipient']);
			for (const Migration of INBOX_MIGRATIONS) {
				await new Migration().up(dataSource.createQueryRunner());
			}
			expect(await tables()).toEqual(['inbox_item', 'inbox_item_recipient']);
		});

		it('keep one recipient row per item and user, and cascade with the item', async () => {
			const { item } = await question();
			await expect(
				dataSource.query(
					`INSERT INTO "inbox_item_recipient" ("id", "tenantId", "inboxItemId", "userId", "isRead") VALUES (?, ?, ?, ?, 0)`,
					[randomUUID(), TENANT, item.id as string, ADA]
				)
			).rejects.toThrow(/UNIQUE/);

			await dataSource.query('PRAGMA foreign_keys = ON');
			await dataSource.query(`DELETE FROM "inbox_item" WHERE "id" = ?`, [item.id as string]);
			expect(
				await dataSource.query(`SELECT 1 FROM "inbox_item_recipient" WHERE "inboxItemId" = ?`, [
					item.id as string
				])
			).toHaveLength(0);
		});

		it('revert: down drops the tables', async () => {
			for (let index = INBOX_MIGRATIONS.length - 1; index >= 0; index--) {
				await new INBOX_MIGRATIONS[index]().down(dataSource.createQueryRunner());
			}
			expect(await tables()).toEqual([]);
		});
	});

	describe('role grants', () => {
		const grants = async () =>
			(
				await dataSource.query(
					`SELECT "role"."name" AS "role", "permission", "enabled" FROM "role_permission" JOIN "role" ON "role"."id" = "role_permission"."roleId" ORDER BY 1, 2`
				)
			).map(
				(row: { role: string; permission: string; enabled: number }) =>
					`${row.role}:${row.permission}:${row.enabled}`
			);

		it('give administrators all three, managers and employees INBOX_VIEW, and leave other roles and decided rows alone', async () => {
			const role = (name: string) => {
				const id = randomUUID();
				return dataSource
					.query(`INSERT INTO "role" ("id", "tenantId", "name") VALUES (?, ?, ?)`, [id, TENANT, name])
					.then(() => id);
			};
			await role(RolesEnum.SUPER_ADMIN);
			await role(RolesEnum.ADMIN);
			const manager = await role(RolesEnum.MANAGER);
			const employee = await role(RolesEnum.EMPLOYEE);
			await role(RolesEnum.VIEWER);
			// A tenant administrator switched INBOX_VIEW off for managers: their decision stays.
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "updatedByUserId") VALUES (?, ?, ?, ?, 0, ?)`,
				[randomUUID(), TENANT, manager, PermissionsEnum.INBOX_VIEW, ADA]
			);
			// A reload migration wrote INBOX_VIEW switched off for employees (nobody decided it): switched on.
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled") VALUES (?, ?, ?, ?, 0)`,
				[randomUUID(), TENANT, employee, PermissionsEnum.INBOX_VIEW]
			);

			const seed = INBOX_MIGRATIONS[2];
			await new seed().up(dataSource.createQueryRunner());
			await new seed().up(dataSource.createQueryRunner());

			expect(await grants()).toEqual([
				`${RolesEnum.ADMIN}:INBOX_MAILBOX_MANAGE:1`,
				`${RolesEnum.ADMIN}:INBOX_MAILBOX_READ_ALL:1`,
				`${RolesEnum.ADMIN}:INBOX_VIEW:1`,
				`${RolesEnum.EMPLOYEE}:INBOX_VIEW:1`,
				`${RolesEnum.MANAGER}:INBOX_VIEW:0`,
				`${RolesEnum.SUPER_ADMIN}:INBOX_MAILBOX_MANAGE:1`,
				`${RolesEnum.SUPER_ADMIN}:INBOX_MAILBOX_READ_ALL:1`,
				`${RolesEnum.SUPER_ADMIN}:INBOX_VIEW:1`
			]);
		});
	});

	describe('reads are scoped to the caller as a recipient', () => {
		it('lists my items newest first, with my state; nobody else sees them', async () => {
			const first = await question({ title: 'First' });
			const second = await question({ title: 'Second', recipients: [{ userId: ADA }, { userId: BOB }] });
			// SQLite's datetime('now') default has second resolution: date the first one a minute earlier.
			await dataSource.query(
				`UPDATE "inbox_item" SET "createdAt" = datetime('now', '-1 minute') WHERE "id" = ?`,
				[first.item.id]
			);

			const page = await service.list();
			expect(page.items.map((item) => item.title)).toEqual(['Second', 'First']);
			expect(page.items[0].recipient).toMatchObject({ isRead: false, isArchived: false });
			expect(page.items[0].options).toEqual([
				{ id: 'yes', label: 'Yes', recommended: true },
				{ id: 'no', label: 'No' }
			]);

			as(BOB);
			expect((await service.list()).items.map((item) => item.id as string)).toEqual([second.item.id as string]);
			await expect(service.get(first.item.id as string)).rejects.toBeInstanceOf(NotFoundException);

			// Another tenant's user, even with the same item id, sees nothing.
			as(EVE, OTHER_TENANT);
			expect((await service.list()).items).toEqual([]);
			await expect(service.get(second.item.id as string)).rejects.toBeInstanceOf(NotFoundException);
		});

		it('lets a reader of every mailbox read (not act on) the mailbox items of their organizations only', async () => {
			const mailbox = randomUUID();
			const shared = await service.create({
				tenantId: TENANT,
				organizationId: ORG,
				kind: InboxItemKindEnum.EMAIL,
				source: InboxItemSourceEnum.EMAIL,
				title: 'Invoice 42',
				mailboxId: mailbox,
				recipients: [{ userId: ADA }]
			});
			const otherOrganization = await service.create({
				tenantId: TENANT,
				organizationId: OTHER_ORG,
				kind: InboxItemKindEnum.EMAIL,
				source: InboxItemSourceEnum.EMAIL,
				title: 'Invoice 43',
				mailboxId: mailbox,
				recipients: [{ userId: ADA }]
			});
			const personal = await question();

			as(BOB, TENANT, [PermissionsEnum.INBOX_VIEW, PermissionsEnum.INBOX_MAILBOX_READ_ALL]);
			await expect(service.get(shared.item.id as string)).resolves.toMatchObject({
				id: shared.item.id as string,
				mailboxId: mailbox,
				recipient: null
			});
			await expect(service.reply(shared.item.id as string, { text: 'Paid' })).rejects.toBeInstanceOf(
				NotFoundException
			);
			// Not a member of that organization.
			await expect(service.get(otherOrganization.item.id as string)).rejects.toBeInstanceOf(NotFoundException);
			// A question addressed to Ada personally stays hers.
			await expect(service.get(personal.item.id as string)).rejects.toBeInstanceOf(NotFoundException);

			// Without the permission, not even the mailbox item.
			as(BOB);
			await expect(service.get(shared.item.id as string)).rejects.toBeInstanceOf(NotFoundException);
		});

		it('filters by tab, kind, link, unread and text, and pages with a cursor', async () => {
			const project = randomUUID();
			await question({ title: 'Deploy the billing fix?', projectId: project });
			await service.create({
				tenantId: TENANT,
				kind: InboxItemKindEnum.NOTICE,
				source: InboxItemSourceEnum.SYSTEM,
				title: 'Budget at 80%',
				body: 'The 100%_cap is near',
				recipients: [{ userId: ADA, isRead: true }]
			});
			const archived = await question({ title: 'Old question' });
			await service.setState(archived.item.id as string, { isArchived: true });

			const titles = async (input: Parameters<InboxService['list']>[0]) =>
				(await service.list(input)).items.map((item) => item.title).sort();

			expect(await titles({})).toEqual(['Budget at 80%', 'Deploy the billing fix?']);
			expect(await titles({ tab: InboxTabEnum.DECISIONS })).toEqual(['Deploy the billing fix?']);
			expect(await titles({ tab: InboxTabEnum.ARCHIVED })).toEqual(['Old question']);
			expect(await titles({ kind: InboxItemKindEnum.NOTICE })).toEqual(['Budget at 80%']);
			expect(await titles({ projectId: project })).toEqual(['Deploy the billing fix?']);
			expect(await titles({ unread: true })).toEqual(['Deploy the billing fix?']);
			expect(await titles({ q: 'BILLING' })).toEqual(['Deploy the billing fix?']);
			// The wildcards of the search are literal.
			expect(await titles({ q: '100%_c' })).toEqual(['Budget at 80%']);
			expect(await titles({ q: '%' })).toEqual(['Budget at 80%']);

			const firstPage = await service.list({ limit: 1 });
			expect(firstPage.items).toHaveLength(1);
			expect(firstPage.nextCursor).not.toBeNull();
			const secondPage = await service.list({ limit: 1, cursor: firstPage.nextCursor as string });
			expect(secondPage.items).toHaveLength(1);
			expect(secondPage.nextCursor).toBeNull();
			expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
			await expect(service.list({ cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(BadRequestException);
		});

		it('counts my unread items and my open decisions', async () => {
			await question();
			const answered = await question({ title: 'Answered' });
			await service.reply(answered.item.id as string, { optionId: 'no' });
			await service.create({
				tenantId: TENANT,
				kind: InboxItemKindEnum.NOTICE,
				source: InboxItemSourceEnum.SYSTEM,
				title: 'FYI',
				recipients: [{ userId: ADA }]
			});
			await expect(service.counts()).resolves.toEqual({ unread: 2, decisionsOpen: 1, byMailbox: [] });
		});
	});

	describe('replies', () => {
		it('a local item is answered once, and a second reply is refused', async () => {
			const { item } = await question();
			const answered = await service.reply(item.id as string, { optionId: 'yes', text: ' Go ' });

			expect(answered.status).toBe(InboxItemStatusEnum.ANSWERED);
			expect(answered.response).toMatchObject({
				optionId: 'yes',
				text: 'Go',
				answeredByUserId: ADA,
				routed: 'local'
			});
			expect(answered.recipient?.isRead).toBe(true);
			await expect(service.reply(item.id as string, { optionId: 'no' })).rejects.toBeInstanceOf(
				ConflictException
			);
		});

		it('validates the reply: an option of the item, a reason when asked, no reply to a notice', async () => {
			const { item } = await question({ requireReason: true });
			await expect(service.reply(item.id as string, {})).rejects.toBeInstanceOf(BadRequestException);
			await expect(service.reply(item.id as string, { optionId: 'maybe', text: 'x' })).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(service.reply(item.id as string, { optionId: 'yes' })).rejects.toThrow(/reason/);

			const notice = await service.create({
				tenantId: TENANT,
				kind: InboxItemKindEnum.NOTICE,
				source: InboxItemSourceEnum.SYSTEM,
				title: 'Read me',
				recipients: [{ userId: ADA }]
			});
			await expect(service.reply(notice.item.id as string, { text: 'ok' })).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it('goes to the source handler synchronously, and stores what it routed', async () => {
			const onReply = jest.fn(async () => ({ routed: 'resumed the agent run' }));
			registry.register({ source: InboxItemSourceEnum.EVER_WORKS, onReply });
			const { item } = await question({
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-1'
			});

			const answered = await service.reply(item.id as string, { optionId: 'yes' });

			expect(onReply).toHaveBeenCalledWith(
				expect.objectContaining({ id: item.id as string, status: InboxItemStatusEnum.ANSWERED }),
				{ optionId: 'yes', text: undefined },
				{ id: ADA, tenantId: TENANT }
			);
			expect(answered.response?.routed).toBe('resumed the agent run');
		});

		it('a reply the source took stays answered even when recording where it went fails', async () => {
			const onReply = jest.fn(async () => ({ routed: 'resumed the agent run' }));
			registry.register({ source: InboxItemSourceEnum.EVER_WORKS, onReply });
			const { item } = await question({ source: InboxItemSourceEnum.EVER_WORKS });
			const items = dataSource.getRepository(InboxItem);
			const update = jest.spyOn(items, 'update').mockRejectedValueOnce(new Error('connection reset'));

			try {
				const answered = await service.reply(item.id as string, { optionId: 'yes' });
				expect(answered.status).toBe(InboxItemStatusEnum.ANSWERED);
				expect(answered.response).toMatchObject({ optionId: 'yes', routed: null });
			} finally {
				update.mockRestore();
			}
			// Not re-opened: a second reply is refused and the source heard of the first one only.
			await expect(service.reply(item.id as string, { optionId: 'no' })).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(onReply).toHaveBeenCalledTimes(1);
		});

		it('when the source refuses, the reply is released and the item is open again', async () => {
			const refusal = new ConflictException('Already decided in Ever Works');
			const onReply = jest.fn().mockRejectedValueOnce(refusal).mockRejectedValueOnce(new Error('socket hang up'));
			registry.register({ source: InboxItemSourceEnum.EVER_WORKS, onReply });
			const { item } = await service.upsertExternal({
				tenantId: TENANT,
				kind: InboxItemKindEnum.APPROVAL,
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-2',
				title: 'Approve the spend',
				recipients: [{ userId: ADA }]
			});

			await expect(service.reply(item.id as string, { optionId: 'approve' })).rejects.toBe(refusal);
			await expect(service.get(item.id as string)).resolves.toMatchObject({
				status: InboxItemStatusEnum.OPEN,
				response: null
			});
			await expect(service.reply(item.id as string, { optionId: 'approve' })).rejects.toBeInstanceOf(
				BadGatewayException
			);
			await expect(service.get(item.id as string)).resolves.toMatchObject({ status: InboxItemStatusEnum.OPEN });
		});

		it('an item of a source that is not connected cannot be answered (and stays open)', async () => {
			const { item } = await question({
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-3'
			});
			await expect(service.reply(item.id as string, { optionId: 'yes' })).rejects.toBeInstanceOf(
				ServiceUnavailableException
			);
			await expect(service.get(item.id as string)).resolves.toMatchObject({ status: InboxItemStatusEnum.OPEN });
		});

		it('two overlapping replies reach the source once', async () => {
			let release: () => void = () => undefined;
			const onReply = jest.fn(
				() => new Promise<{ routed: string }>((resolve) => (release = () => resolve({ routed: 'ok' })))
			);
			registry.register({ source: InboxItemSourceEnum.EVER_WORKS, onReply });
			const { item } = await question({
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-4'
			});

			const first = service.reply(item.id as string, { optionId: 'yes' });
			await new Promise((resolve) => setTimeout(resolve, 20));
			await expect(service.reply(item.id as string, { optionId: 'no' })).rejects.toBeInstanceOf(
				ConflictException
			);
			release();
			await expect(first).resolves.toMatchObject({ response: expect.objectContaining({ optionId: 'yes' }) });
			expect(onReply).toHaveBeenCalledTimes(1);
		});
	});

	describe('recipient state', () => {
		it('read, archive and snooze are mine alone, and reach the source', async () => {
			const onStateChange = jest.fn(async () => undefined);
			registry.register({
				source: InboxItemSourceEnum.EVER_WORKS,
				onReply: jest.fn(),
				onStateChange
			} as IInboxSourceHandler);
			const { item } = await question({
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-5',
				recipients: [{ userId: ADA }, { userId: BOB }]
			});

			await service.setState(item.id as string, { isRead: true });
			const later = new Date(Date.now() + 60 * 60 * 1000);
			await service.setState(item.id as string, { snoozedUntil: later });
			expect((await service.list()).items).toEqual([]); // snoozed: hidden until then
			await service.setState(item.id as string, { snoozedUntil: null });
			expect((await service.list()).items.map((row) => row.id)).toEqual([item.id as string]);
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ id: item.id as string }),
				expect.objectContaining({ userId: ADA }),
				{
					isRead: true
				}
			);

			as(BOB);
			expect((await service.get(item.id as string)).recipient).toMatchObject({
				isRead: false,
				snoozedUntil: null
			});
			await expect(service.setState(item.id as string, {})).rejects.toBeInstanceOf(BadRequestException);
		});

		it('a failing source does not undo the local state', async () => {
			registry.register({
				source: InboxItemSourceEnum.EVER_WORKS,
				onReply: jest.fn(),
				onStateChange: jest.fn().mockRejectedValue(new Error('offline'))
			} as IInboxSourceHandler);
			const { item } = await question({
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-6'
			});
			await expect(service.setState(item.id as string, { isArchived: true })).resolves.toMatchObject({
				recipient: expect.objectContaining({ isArchived: true })
			});
		});

		it('marks all my unread items of a tab read', async () => {
			await question();
			await service.create({
				tenantId: TENANT,
				kind: InboxItemKindEnum.NOTICE,
				source: InboxItemSourceEnum.SYSTEM,
				title: 'FYI',
				recipients: [{ userId: ADA }, { userId: BOB }]
			});
			await expect(service.markAllRead(InboxTabEnum.DECISIONS)).resolves.toEqual({ updated: 1 });
			await expect(service.markAllRead()).resolves.toEqual({ updated: 1 });
			await expect(service.counts()).resolves.toMatchObject({ unread: 0 });
			as(BOB);
			await expect(service.counts()).resolves.toMatchObject({ unread: 1 });
		});
	});

	describe('writes by a source', () => {
		it('upsertExternal is idempotent on the external identity, and keeps the source state', async () => {
			const input = {
				tenantId: TENANT,
				organizationId: ORG,
				kind: InboxItemKindEnum.QUESTION,
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-7',
				title: 'Pick a vendor',
				recipients: [{ userId: ADA }]
			};
			const first = await service.upsertExternal(input);
			const again = await service.upsertExternal({
				...input,
				title: 'Pick a vendor (updated)',
				recipients: [{ userId: ADA, isRead: true }, { userId: BOB }]
			});

			expect(first.created).toBe(true);
			expect(again).toMatchObject({
				created: false,
				item: { id: first.item.id as string, title: 'Pick a vendor (updated)' }
			});
			expect(again.recipientUserIds.sort()).toEqual([ADA, BOB].sort());
			expect(await dataSource.query(`SELECT COUNT(*) AS "n" FROM "inbox_item"`)).toEqual([{ n: 1 }]);
			expect((await service.get(first.item.id as string)).recipient?.isRead).toBe(true);
		});

		it('a re-delivery changes only what it states: an answered item keeps its answer and its links', async () => {
			const project = randomUUID();
			const input = {
				tenantId: TENANT,
				organizationId: ORG,
				kind: InboxItemKindEnum.QUESTION,
				source: InboxItemSourceEnum.GAUZY,
				externalSource: 'ever_works',
				externalId: 'ew-9',
				title: 'Which plan?',
				body: 'Pick one',
				projectId: project,
				options: [{ id: 'a', label: 'A' }],
				recipients: [{ userId: ADA }]
			};
			const { item } = await service.upsertExternal(input);
			await service.reply(item.id as string, { optionId: 'a' });

			// The source's "created" payload delivered again, without status, response or links.
			const again = await service.upsertExternal({
				tenantId: TENANT,
				kind: InboxItemKindEnum.QUESTION,
				source: InboxItemSourceEnum.GAUZY,
				externalSource: 'ever_works',
				externalId: 'ew-9',
				title: 'Which plan? (renamed)',
				recipients: [{ userId: ADA }]
			});
			expect(again.item).toMatchObject({
				title: 'Which plan? (renamed)',
				status: InboxItemStatusEnum.ANSWERED,
				response: expect.objectContaining({ optionId: 'a' }),
				body: 'Pick one',
				projectId: project,
				organizationId: ORG,
				options: [{ id: 'a', label: 'A' }]
			});

			// A stated status and a stated null do change it.
			const reopened = await service.upsertExternal({
				...input,
				status: InboxItemStatusEnum.OPEN,
				response: null,
				projectId: null
			});
			expect(reopened.item).toMatchObject({ status: InboxItemStatusEnum.OPEN, response: null, projectId: null });
		});

		it('refuses an organization that is not one of the item’s tenant', async () => {
			for (const organizationId of [FOREIGN_ORG, randomUUID(), 'not-a-uuid']) {
				await expect(question({ organizationId })).rejects.toBeInstanceOf(BadRequestException);
			}
			await expect(question({ organizationId: OTHER_ORG })).resolves.toMatchObject({ created: true });
			expect(await dataSource.query(`SELECT COUNT(*) AS "n" FROM "inbox_item"`)).toEqual([{ n: 1 }]);
		});

		it('two overlapping deliveries of one source item create it once', async () => {
			const input = {
				tenantId: TENANT,
				kind: InboxItemKindEnum.NOTICE,
				source: InboxItemSourceEnum.EVER_WORKS,
				externalSource: 'ever_works',
				externalId: 'ew-8',
				title: 'Budget alert',
				recipients: [{ userId: ADA }]
			};
			const results = await Promise.all([service.upsertExternal(input), service.upsertExternal(input)]);
			expect(new Set(results.map((result) => result.item.id)).size).toBe(1);
			expect(await dataSource.query(`SELECT COUNT(*) AS "n" FROM "inbox_item_recipient"`)).toEqual([{ n: 1 }]);
		});

		it('leaves out recipients that are not users of the item’s tenant, and refuses an incomplete item', async () => {
			const result = await question({
				recipients: [{ userId: ADA }, { userId: EVE }, { userId: randomUUID() }, { userId: 'not-a-uuid' }]
			});
			expect(result.recipientUserIds).toEqual([ADA]);
			expect(result.skippedUserIds).toHaveLength(3);

			await expect(service.upsertExternal({ tenantId: TENANT, recipients: [] } as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(
				service.create({
					tenantId: TENANT,
					kind: InboxItemKindEnum.NOTICE,
					source: 'SYSTEM',
					title: '  ',
					recipients: []
				})
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});
});
