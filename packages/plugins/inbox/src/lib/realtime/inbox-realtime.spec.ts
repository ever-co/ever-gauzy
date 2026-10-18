/**
 * Real time for the Inbox (G-P3-6): `inbox_item.created` is declared with the subscription catalogue, appended to
 * the outbox when an item is created — addressed to its recipients and without its content — and never fails the
 * Inbox write. The last cases run `InboxService` on SQLite (the plugin's migrations), as the database suite does.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application).
 */
const mockDeclared: unknown[][] = [];
const mockCaller: { tenantId: string | null; userId: string | null } = { tenantId: null, userId: null };

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class BaseEntity {}
	class SubscriptionCatalogue {}
	class GraphqlSubscriptionConsumer {}
	class EventOutboxService {}
	return {
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		SubscriptionCatalogue,
		GraphqlSubscriptionConsumer,
		EventOutboxService,
		declareStreamedEvents: (...args: unknown[]) => void mockDeclared.push(args),
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentUserId: () => mockCaller.userId,
			hasPermission: () => false
		}
	};
});

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntitySchema } from 'typeorm';
import { InboxItemKindEnum, InboxItemSourceEnum } from '@gauzy/contracts';
import { EventOutboxService, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';
import { INBOX_MIGRATIONS } from '../database/inbox-migrations';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxService } from '../inbox.service';
import { InboxSourceHandlerRegistry } from '../inbox-source-handler.registry';
import { INBOX_ITEM_CREATED, INBOX_STREAMED_EVENTS, InboxRealtime, inboxItemCreatedData } from './inbox-realtime';

jest.setTimeout(60_000);

type Appended = { manager: unknown; input: Record<string, any> };

/** A process's providers, as `ModuleRef.get(token, { strict: false })` answers them. */
function moduleRefOf(providers: Map<unknown, unknown>) {
	return {
		get: (token: unknown) => {
			if (!providers.has(token)) throw new Error('Nest could not find the provider.');
			return providers.get(token);
		}
	};
}

function outboxDouble(fail = false) {
	const appended: Appended[] = [];
	const outbox = {
		append: async (manager: unknown, input: Record<string, any>) => {
			if (fail) throw new Error('database is down');
			appended.push({ manager, input });
			return {};
		}
	};
	return { outbox, appended };
}

const ITEM = {
	id: 'item-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	kind: InboxItemKindEnum.QUESTION,
	source: InboxItemSourceEnum.EVER_WORKS,
	status: 'OPEN',
	priority: 'high',
	mailboxId: null,
	title: 'Approve the deploy of the payment service?',
	body: 'Secret plan details'
} as unknown as InboxItem;

describe('InboxRealtime', () => {
	const manager = { name: 'manager' };
	const dataSource = { manager } as unknown as DataSource;

	beforeEach(() => {
		mockDeclared.length = 0;
	});

	it('declares inbox_item.created where the process serves subscriptions, and nothing where it does not', () => {
		const catalogue = new SubscriptionCatalogue();
		const consumer = new GraphqlSubscriptionConsumer(undefined as never, undefined as never);
		new InboxRealtime(
			dataSource,
			moduleRefOf(
				new Map<unknown, unknown>([
					[SubscriptionCatalogue, catalogue],
					[GraphqlSubscriptionConsumer, consumer]
				])
			) as never
		).onModuleInit();
		expect(mockDeclared).toEqual([[catalogue, consumer, ...INBOX_STREAMED_EVENTS]]);
		expect(INBOX_STREAMED_EVENTS).toEqual([INBOX_ITEM_CREATED]);

		mockDeclared.length = 0;
		// A process without the subscription surface (the worker): nothing to declare, and no failure.
		new InboxRealtime(dataSource, moduleRefOf(new Map()) as never).onModuleInit();
		expect(mockDeclared).toEqual([]);
	});

	it('appends inbox_item.created addressed to the recipients, with the item identity and no content', async () => {
		const { outbox, appended } = outboxDouble();
		const realtime = new InboxRealtime(
			dataSource,
			moduleRefOf(new Map<unknown, unknown>([[EventOutboxService, outbox]])) as never
		);

		await realtime.itemCreated(ITEM, ['user-a', 'user-b', 'user-a']);

		expect(appended).toHaveLength(1);
		expect(appended[0].manager).toBe(manager);
		expect(appended[0].input).toEqual({
			name: 'inbox_item.created',
			aggregateType: 'inbox_item',
			aggregateId: 'item-1',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			data: {
				id: 'item-1',
				kind: 'QUESTION',
				source: InboxItemSourceEnum.EVER_WORKS,
				status: 'OPEN',
				priority: 'high',
				organizationId: 'org-1',
				mailboxId: null,
				recipientUserIds: ['user-a', 'user-b']
			}
		});
		// The outbox row is listed to operators and may reach a webhook: the item's text never travels in it.
		expect(JSON.stringify(appended[0].input)).not.toMatch(/Approve the deploy|Secret plan/);
	});

	it('appends nothing for an item nobody receives, or where the process has no outbox; a failed append is not thrown', async () => {
		const { outbox, appended } = outboxDouble();
		const realtime = new InboxRealtime(
			dataSource,
			moduleRefOf(new Map<unknown, unknown>([[EventOutboxService, outbox]])) as never
		);
		await realtime.itemCreated(ITEM, []);
		expect(appended).toEqual([]);

		await expect(
			new InboxRealtime(dataSource, moduleRefOf(new Map()) as never).itemCreated(ITEM, ['user-a'])
		).resolves.toBeUndefined();

		const failing = outboxDouble(true);
		const broken = new InboxRealtime(
			dataSource,
			moduleRefOf(new Map<unknown, unknown>([[EventOutboxService, failing.outbox]])) as never
		);
		await expect(broken.itemCreated(ITEM, ['user-a'])).resolves.toBeUndefined();
	});

	it('leaves the organization to the item: a tenant-wide item states none', async () => {
		const { outbox, appended } = outboxDouble();
		const realtime = new InboxRealtime(
			dataSource,
			moduleRefOf(new Map<unknown, unknown>([[EventOutboxService, outbox]])) as never
		);
		await realtime.itemCreated({ ...ITEM, organizationId: null } as unknown as InboxItem, ['user-a']);
		expect(appended[0].input).not.toHaveProperty('organizationId');
		// Stated as tenant-wide, so the outbox does not take the writing request's organization instead.
		expect(appended[0].input['tenantWide']).toBe(true);
		expect(
			inboxItemCreatedData({ ...ITEM, organizationId: undefined } as unknown as InboxItem, []).organizationId
		).toBeNull();
	});
});

describe('InboxService announces created items (SQLite)', () => {
	const TENANT = randomUUID();
	const ORG = randomUUID();
	const ADA = randomUUID();
	const BOB = randomUUID();
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
	const text = { type: String, nullable: true };
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
			body: text,
			bodyFormat: { type: String, default: 'plain' },
			options: text,
			requireReason: { type: Boolean, default: false },
			response: text,
			priority: { type: String, default: 'normal' },
			dueAt: { type: Date, nullable: true },
			entity: text,
			entityId: text,
			taskId: text,
			projectId: text,
			agentEmployeeId: text,
			mailboxId: text,
			emailId: text,
			externalSource: text,
			externalId: text,
			metadata: text
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

	let directory: string;
	let dataSource: DataSource;
	let service: InboxService;
	let appended: Appended[];

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-realtime-'));
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
		// The core tables the migrations reference or seed.
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
		await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [TENANT]);
		await dataSource.query(`INSERT INTO "organization" ("id", "tenantId") VALUES (?, ?)`, [ORG, TENANT]);
		await dataSource.query(`INSERT INTO "user" ("id", "tenantId") VALUES (?, ?), (?, ?)`, [
			ADA,
			TENANT,
			BOB,
			TENANT
		]);
		await dataSource.runMigrations({ transaction: 'each' });
		const double = outboxDouble();
		appended = double.appended;
		const realtime = new InboxRealtime(
			dataSource,
			moduleRefOf(new Map<unknown, unknown>([[EventOutboxService, double.outbox]])) as never
		);
		service = new InboxService(dataSource, new InboxSourceHandlerRegistry(), realtime);
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA;
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	const notice = (overrides: Record<string, unknown> = {}) =>
		service.upsertExternal({
			tenantId: TENANT,
			organizationId: ORG,
			kind: InboxItemKindEnum.NOTICE,
			source: InboxItemSourceEnum.EVER_WORKS,
			externalSource: 'ever_works',
			externalId: 'ew-item-1',
			title: 'The nightly run finished',
			recipients: [{ userId: ADA }, { userId: BOB }, { userId: randomUUID() }],
			...overrides
		} as never);

	it('appends one inbox_item.created for a new item, addressed to the users it reached', async () => {
		const { item, created } = await notice();
		expect(created).toBe(true);
		expect(appended).toHaveLength(1);
		expect(appended[0].input).toMatchObject({
			name: INBOX_ITEM_CREATED,
			aggregateId: item.id,
			tenantId: TENANT,
			organizationId: ORG
		});
		// The user that is not one of the tenant's is left out, as from the item itself.
		expect([...appended[0].input['data'].recipientUserIds].sort()).toEqual([ADA, BOB].sort());
	});

	it('a re-delivery that adds a recipient tells that recipient only (review F104)', async () => {
		// The first delivery could reach Ada only (Carol is not a user of the tenant yet: a pairing made later).
		const carol = randomUUID();
		const { item } = await notice({ recipients: [{ userId: ADA }, { userId: carol }] });
		expect(appended).toHaveLength(1);
		expect(appended[0].input['data'].recipientUserIds).toEqual([ADA]);
		await dataSource.query(`INSERT INTO "user" ("id", "tenantId") VALUES (?, ?)`, [carol, TENANT]);
		const again = await notice({ recipients: [{ userId: ADA }, { userId: carol }] });
		expect(again.created).toBe(false);
		expect(appended).toHaveLength(2);
		expect(appended[1].input).toMatchObject({ name: INBOX_ITEM_CREATED, aggregateId: item.id });
		expect(appended[1].input['data'].recipientUserIds).toEqual([carol]);
	});

	it('an item whose first delivery stored no recipient is announced once the re-delivery adds them (review F104)', async () => {
		// The recipients' write failed after the item was stored; the source retries.
		await dataSource.query(
			`INSERT INTO "inbox_item" ("id", "tenantId", "organizationId", "kind", "source", "title", "externalSource", "externalId") VALUES (?, ?, ?, 'NOTICE', 'EVER_WORKS', 'Stored alone', 'ever_works', 'ew-item-9')`,
			[randomUUID(), TENANT, ORG]
		);
		const { created } = await notice({ externalId: 'ew-item-9', recipients: [{ userId: BOB }] });
		expect(created).toBe(false);
		expect(appended).toHaveLength(1);
		expect(appended[0].input['data'].recipientUserIds).toEqual([BOB]);
	});

	it('appends nothing when a source re-delivers the same item, or creates one nobody can receive', async () => {
		await notice();
		await notice({ title: 'The nightly run finished (edited)' });
		expect(appended).toHaveLength(1);

		await notice({ externalId: 'ew-item-2', recipients: [{ userId: randomUUID() }] });
		expect(appended).toHaveLength(1);
	});
});
