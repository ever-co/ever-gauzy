/**
 * The Gauzy Inbox → Ever Works mirror (owner decision 2026-10-29) against in-memory stand-ins and the mock Ever Works
 * API (real client, contract v1 inbox write): every guard that keeps an item from being sent (each spec fails without
 * its guard), the copy filed once (`externalId` replay), patched with `If-Match` (a `412` retried on the current
 * version), and an Ever Works user's answer, read and archive applied once to the Gauzy item through the Inbox's own
 * actions, as the recipient.
 */
const mockCaller: { tenantId: string | null; userId: string | null } = { tenantId: null, userId: null };
const mockActingAs: Array<string | null> = [];

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		TenantBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		BaseEntityEventSubscriber: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'UserOrganization',
				'Employee',
				'EmployeeNotification',
				'User',
				'Task',
				'IntegrationTenant',
				'IntegrationSetting',
				'IntegrationEntitySetting'
			].map((name) => [name, entity(name)])
		),
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentUserId: () => mockCaller.userId,
			currentOrganizationId: () => null
		}
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));
// Writes as the recipient: the request context the sync opens is recorded (the platform's own store is not loaded here).
jest.mock('../sync/ever-works-actor', () => {
	const actual = jest.requireActual('../sync/ever-works-actor');
	return {
		...actual,
		runAsGauzyUser: async (_context: unknown, userId: string | null, fn: () => Promise<unknown>) => {
			mockActingAs.push(userId);
			const saved = mockCaller.userId;
			mockCaller.userId = userId;
			try {
				return await fn();
			} finally {
				mockCaller.userId = saved;
			}
		}
	};
});

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import {
	BaseEntityEnum,
	IInboxItem,
	IInboxItemChange,
	IInboxItemFeed,
	IInboxItemRecipient,
	IInboxRecipientActions,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemSourceEnum,
	InboxItemStatusEnum,
	IntegrationEntity,
	TaskSyncScopeEnum
} from '@gauzy/contracts';
import { Employee, Organization, Task } from '@gauzy/core';
import { TestEverWorksClientFactory } from '../client/ever-works-client.factory';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import { EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { DEFAULT_EVER_WORKS_DIRECTIONS } from '../mapping/ever-works-mapping.defaults';
import {
	EverWorksEntityLink,
	EverWorksLinkType,
	EverWorksOutboundChange
} from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { MockEverWorksInboxWrite } from '../testing/mock-ever-works.inbox-write';
import { MOCK_PRESET_SCOPES, MockEverWorksServer } from '../testing/mock-ever-works.server';
import { everWorksKindOf } from './ever-works-inbox-kinds';
import { EverWorksInboxPreference } from './ever-works-inbox-preference.entity';
import { EverWorksInboxPreferencesService } from './ever-works-inbox-preferences.service';
import { choicesOf, parseGauzyInboxExternalId, plainTextAsMarkdown, sharedOf } from './ever-works-inbox-push.mapper';
import { EverWorksInboxPushService } from './ever-works-inbox-push.service';
import { EverWorksInboxService } from './ever-works-inbox.service';
import { EverWorksPeopleService } from '../people/ever-works-people.service';
import { EverWorksInitialSyncService } from '../sync/initial/ever-works-initial-sync.service';
import { EVER_WORKS_SYNC_PHASE_SPECS, EverWorksSyncPhaseSpec } from '../sync/initial/ever-works-sync-phases';

type Row = Record<string, any>;

const TENANT = randomUUID();
const ORG = randomUUID();
const MAPPING = randomUUID();
const ADA = { user: randomUUID(), employee: randomUUID(), ew: 'ew-user-ada' };
const BOB = { user: randomUUID(), employee: randomUUID() }; // a person of the organization, not paired
const CAROL = { user: randomUUID(), employee: randomUUID(), ew: 'ew-user-carol' };

/** `where` as TypeORM reads it: equality, `In(...)`, `IsNull()` and `MoreThan(...)`; any other operator fails the spec. */
function matches(row: Row, where: Row | undefined): boolean {
	return Object.entries(where ?? {}).every(([key, value]) => {
		if (!(value instanceof FindOperator)) return row[key] === value;
		if (value.type === 'in') return (value.value as unknown[]).includes(row[key]);
		if (value.type === 'isNull') return row[key] === null || row[key] === undefined;
		if (value.type === 'moreThan') return row[key] > (value.value as never);
		throw new Error(`The in-memory repository does not read the ${value.type} operator.`);
	});
}

function repository(rows: Row[], unique?: (a: Row, b: Row) => boolean) {
	return {
		find: async (options: { where?: Row } = {}) => rows.filter((row) => matches(row, options.where)),
		findOne: async (options: { where?: Row }) => rows.find((row) => matches(row, options.where)) ?? null,
		update: async (criteria: Row, values: Row) => {
			const hit = rows.filter((row) => matches(row, criteria));
			for (const row of hit) Object.assign(row, values, { updatedAt: new Date() });
			return { affected: hit.length };
		},
		insert: async (row: Row) => {
			if (unique && rows.some((other) => unique(other, row))) throw new Error('UNIQUE constraint failed');
			rows.push({ ...row, createdAt: new Date(), updatedAt: new Date() });
		}
	};
}

function setup(
	options: {
		directions?: Partial<typeof DEFAULT_EVER_WORKS_DIRECTIONS>;
		entitySync?: Row;
		inbox?: boolean;
		pushSince?: string;
		/** The key's scopes (the "Ever Gauzy" preset by default). */
		scopes?: string[];
	} = {}
) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const scopes = options.scopes ?? [...MOCK_PRESET_SCOPES];
	const key = mock.addKey({ organizations: [ewOrg], scopes });
	const inboxWrite = new MockEverWorksInboxWrite(mock);
	const connection = {
		id: 'conn-1',
		tenantId: TENANT,
		status: EverWorksConnectionStatus.ACTIVE,
		// The "Ever Gauzy" preset (inbox:write, and the read scopes a related id needs) and the key's id (whoami).
		scopes: JSON.stringify(scopes),
		keyId: (mock.keys.get(key) as { keyId: string }).keyId
	};
	const context = {
		tenantId: TENANT,
		organizationId: ORG,
		integrationTenantId: MAPPING,
		mapping: {
			id: MAPPING,
			settings: options.pushSince ? [{ settingsName: 'INBOX_PUSH_SINCE', settingsValue: options.pushSince }] : []
		},
		connection,
		everWorksOrganizationId: ewOrg.id,
		everWorksOrganizationSlug: ewOrg.slug,
		directions: { ...DEFAULT_EVER_WORKS_DIRECTIONS, ...options.directions },
		entitySync: options.entitySync ?? {},
		isEnabled: true
	};
	const contexts = {
		forOrganization: async (tenantId: string, organizationId: string) =>
			tenantId === TENANT && organizationId === ORG ? context : null,
		forEverWorksOrganization: async (_c: unknown, ewOrgId: string) => (ewOrgId === ewOrg.id ? context : null),
		forConnection: async () => [context]
	};

	// The tables the services read (in memory).
	const employees: Row[] = [
		{
			id: ADA.employee,
			userId: ADA.user,
			tenantId: TENANT,
			organizationId: ORG,
			isActive: true,
			isArchived: false
		},
		{
			id: BOB.employee,
			userId: BOB.user,
			tenantId: TENANT,
			organizationId: ORG,
			isActive: true,
			isArchived: false
		},
		{
			id: CAROL.employee,
			userId: CAROL.user,
			tenantId: TENANT,
			organizationId: ORG,
			isActive: true,
			isArchived: false
		}
	];
	const links: Row[] = [
		{
			id: randomUUID(),
			integrationTenantId: MAPPING,
			entityType: EverWorksLinkType.MEMBER,
			gauzyId: ADA.employee,
			ewId: ADA.ew,
			ewVersion: null,
			state: 'ok'
		},
		{
			id: randomUUID(),
			integrationTenantId: MAPPING,
			entityType: EverWorksLinkType.MEMBER,
			gauzyId: CAROL.employee,
			ewId: CAROL.ew,
			ewVersion: null,
			state: 'ok'
		}
	];
	const changes: Row[] = [];
	const tasks: Row[] = [];
	const preferences: Row[] = [];
	const organizations: Row[] = [{ id: ORG, tenantId: TENANT, name: 'Acme' }];
	const tables = new Map<unknown, ReturnType<typeof repository>>([
		[Employee, repository(employees)],
		[EverWorksEntityLink, repository(links)],
		[EverWorksOutboundChange, repository(changes)],
		[Task, repository(tasks)],
		[Organization, repository(organizations)],
		[
			EverWorksInboxPreference,
			repository(preferences, (a, b) => a['tenantId'] === b['tenantId'] && a['userId'] === b['userId'])
		]
	]);
	const dataSource = {
		getRepository: (target: unknown) => {
			const table = tables.get(target);
			if (!table) throw new Error('unexpected repository');
			return table;
		}
	};

	// The identity map, with its monotonic version (a write never lowers it).
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['ewId'] === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['gauzyId'] === gauzyId) ??
			null,
		list: async (m: string, type: string) =>
			links.filter((l) => l['integrationTenantId'] === m && l['entityType'] === type),
		snapshot: (link: Row | null) => (link?.['snapshot'] ? JSON.parse(link['snapshot']) : {}),
		record: async (input: Row) => {
			const existing = links.find(
				(l) =>
					l['integrationTenantId'] === input['integrationTenantId'] &&
					l['entityType'] === input['entityType'] &&
					(l['ewId'] === input['ewId'] || l['gauzyId'] === input['gauzyId'])
			);
			if (
				existing &&
				existing['ewVersion'] != null &&
				typeof input['ewVersion'] === 'number' &&
				input['ewVersion'] < existing['ewVersion']
			) {
				throw new Error('stale link write');
			}
			const values = {
				gauzyId: input['gauzyId'],
				ewId: input['ewId'],
				...(input['ewVersion'] !== undefined ? { ewVersion: input['ewVersion'] } : {}),
				...(input['snapshot'] !== undefined ? { snapshot: JSON.stringify(input['snapshot']) } : {}),
				...(input['ewOnly'] !== undefined ? { ewOnly: JSON.stringify(input['ewOnly']) } : {}),
				lastDirection: input['direction'],
				lastSyncedAt: new Date(),
				state: 'ok'
			};
			if (existing) return Object.assign(existing, values);
			const row = {
				id: randomUUID(),
				integrationTenantId: input['integrationTenantId'],
				entityType: input['entityType'],
				...values
			};
			links.push(row);
			return row;
		},
		unlink: async (link: Row) => {
			link['state'] = 'unlinked';
		}
	};

	// The Gauzy Inbox (in memory): the observer seam and the recipient actions, as InboxService acts.
	const items = new Map<string, IInboxItem>();
	const recipients = new Map<string, IInboxItemRecipient & Row>();
	const recipientOf = (itemId: string, userId: string) =>
		[...recipients.values()].find((row) => row.inboxItemId === itemId && row.userId === userId);
	const feed: IInboxItemFeed & { register: jest.Mock } = {
		register: jest.fn(),
		unregister: jest.fn(),
		readRecipient: async (tenantId, recipientId) => {
			const recipient = recipients.get(recipientId);
			const item = recipient ? items.get(recipient.inboxItemId as string) : undefined;
			return recipient && item && recipient.tenantId === tenantId
				? { item: { ...item }, recipient: { ...recipient } }
				: null;
		},
		openRecipientsOf: async (tenantId, organizationId, userIds, opts = {}) => {
			const rows = [...recipients.values()]
				.filter((row) => {
					const item = items.get(row.inboxItemId as string) as IInboxItem;
					return (
						row.tenantId === tenantId &&
						item.organizationId === organizationId &&
						userIds.includes(row.userId) &&
						item.status === InboxItemStatusEnum.OPEN &&
						!row.isArchived
					);
				})
				.filter((row) => !opts.after || (row.id as string) > opts.after)
				.sort((a, b) => String(a.id).localeCompare(String(b.id)));
			const limit = opts.limit ?? 1000;
			const page = rows.slice(0, limit);
			return {
				recipients: page.map((row) => {
					const item = items.get(row.inboxItemId as string) as IInboxItem;
					return {
						id: row.id as string,
						userId: row.userId,
						inboxItemId: item.id as string,
						organizationId: ORG,
						source: item.source,
						kind: item.kind,
						changedAt: new Date(),
						itemUpdatedAt: new Date(),
						externalSource: item.externalSource ?? null,
						taskId: (item.taskId as string) ?? null,
						entity: (item.entity as string) ?? null,
						entityId: (item.entityId as string) ?? null,
						metadata: (item.metadata as Record<string, unknown>) ?? null
					};
				}),
				next: rows.length > limit ? (page[page.length - 1].id as string) : null
			};
		},
		recipientsChangedSince: async (tenantId, since) => ({
			recipients: [...recipients.values()]
				.filter((row) => row.tenantId === tenantId)
				.map((row) => {
					const item = items.get(row.inboxItemId as string) as IInboxItem;
					return {
						id: row.id as string,
						userId: row.userId,
						inboxItemId: item.id as string,
						organizationId: ORG,
						source: item.source,
						kind: item.kind,
						changedAt: item.updatedAt as Date,
						itemUpdatedAt: item.updatedAt as Date,
						externalSource: item.externalSource ?? null,
						taskId: (item.taskId as string) ?? null,
						entity: (item.entity as string) ?? null,
						entityId: (item.entityId as string) ?? null,
						metadata: (item.metadata as Record<string, unknown>) ?? null
					};
				})
				.filter((row) => new Date(row.changedAt).getTime() >= since.getTime()),
			next: null
		}),
		missingRecipients: async (tenantId, ids) =>
			ids.filter((id) => !recipients.has(id) || (recipients.get(id) as Row)['tenantId'] !== tenantId)
	};
	const actions: IInboxRecipientActions & { reply: jest.Mock; setState: jest.Mock } = {
		reply: jest.fn(async (id: string, input: { text?: string; optionId?: string }) => {
			const item = items.get(id) as IInboxItem;
			if (item.status !== InboxItemStatusEnum.OPEN)
				throw new ConflictException('This item was already answered.');
			if (item.requireReason && !input.text)
				throw new BadRequestException('This item asks for a reason with the reply.');
			Object.assign(item, {
				status: InboxItemStatusEnum.ANSWERED,
				response: {
					text: input.text ?? null,
					optionId: input.optionId ?? null,
					answeredByUserId: mockCaller.userId,
					answeredAt: new Date().toISOString(),
					routed: 'local'
				},
				updatedAt: new Date()
			});
			const recipient = recipientOf(id, mockCaller.userId as string);
			if (recipient) recipient.isRead = true;
			return { ...item, recipient: null };
		}) as never,
		setState: jest.fn(async (id: string, input: { isRead?: boolean; isArchived?: boolean }) => {
			const recipient = recipientOf(id, mockCaller.userId as string);
			if (!recipient) throw new Error('not addressed to the caller');
			Object.assign(recipient, input);
			return { ...(items.get(id) as IInboxItem), recipient: null };
		}) as never
	};
	const addItem = (over: Partial<IInboxItem> = {}, users: string[] = [ADA.user]) => {
		const item = {
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORG,
			kind: InboxItemKindEnum.QUESTION,
			source: InboxItemSourceEnum.GAUZY,
			status: InboxItemStatusEnum.OPEN,
			title: 'Ship the release?',
			body: 'The *build* is green.',
			bodyFormat: InboxItemBodyFormatEnum.PLAIN,
			options: [
				{ id: 'yes', label: 'Yes', recommended: true },
				{ id: 'no', label: 'No' }
			],
			priority: 'normal',
			createdAt: new Date('2026-10-29T08:00:00.000Z'),
			updatedAt: new Date(),
			...over
		} as IInboxItem;
		items.set(item.id as string, item);
		const ids: Record<string, string> = {};
		for (const userId of users) {
			const id = randomUUID();
			recipients.set(id, {
				id,
				tenantId: TENANT,
				organizationId: ORG,
				inboxItemId: item.id as string,
				userId,
				isRead: false,
				isArchived: false
			} as never);
			ids[userId] = id;
		}
		return { item, ids, ada: ids[ADA.user] };
	};

	const factory = new TestEverWorksClientFactory(mock.transport(), { allowInsecure: true });
	const connections = {
		client: (_connection: unknown, scopeSlug?: string | null) =>
			factory.create({
				apiBaseUrl: 'http://ever-works.test/api',
				apiKey: key,
				connectionId: 'conn-1',
				scopeSlug: scopeSlug ?? null
			})
	};
	const queued: Row[] = [];
	const queue = {
		enqueue: jest.fn(async (trigger: Row) => {
			queued.push(trigger);
			return true;
		})
	};
	const log = { write: jest.fn(async () => undefined) };
	const preferenceService = new EverWorksInboxPreferencesService(
		dataSource as never,
		contexts as never,
		linkService as never
	);
	const service = new EverWorksInboxPushService(
		dataSource as never,
		contexts as never,
		connections as never,
		linkService as never,
		queue as never,
		log as never,
		preferenceService,
		{ gauzyAppUrl: 'https://app.gauzy.test' } as never,
		options.inbox === false ? null : feed,
		options.inbox === false ? null : actions,
		null
	);
	service.onModuleInit();
	const writer = { create: jest.fn(), upsertExternal: jest.fn() };
	const inboxService = new EverWorksInboxService(
		dataSource as never,
		contexts as never,
		linkService as never,
		connections as never,
		writer as never,
		null,
		service
	);
	const push = (recipientId: string) =>
		service.push(
			{
				tenantId: TENANT,
				organizationId: ORG,
				integrationTenantId: MAPPING,
				entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
				gauzyId: recipientId,
				op: 'upsert'
			} as never,
			{ connection: connection as never, mapping: { id: MAPPING } as never }
		);
	const apply = (envelope: EverWorksEventEnvelope) =>
		inboxService.apply(envelope, { connection: connection as never, event: {} as never, organizationId: ORG });
	const change = (item: IInboxItem, over: Partial<IInboxItemChange> = {}): IInboxItemChange => ({
		tenantId: TENANT,
		organizationId: ORG,
		inboxItemId: item.id as string,
		kind: item.kind,
		source: item.source,
		externalSource: item.externalSource ?? null,
		scope: 'item',
		type: 'created',
		recipients: [...recipients.values()]
			.filter((row) => row.inboxItemId === item.id)
			.map((row) => ({ id: row.id as string, userId: row.userId })),
		...over
	});
	const linkOf = (recipientId: string) =>
		links.find((l) => l['entityType'] === EverWorksLinkType.GAUZY_INBOX_ITEM && l['gauzyId'] === recipientId);
	return {
		mock,
		inboxWrite,
		service,
		preferenceService,
		feed,
		actions,
		writer,
		items,
		recipients,
		links,
		tasks,
		queued,
		queue,
		context,
		addItem,
		push,
		apply,
		change,
		linkOf
	};
}

/** Lets detached capture work finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
	mockCaller.tenantId = null;
	mockCaller.userId = null;
	mockActingAs.length = 0;
});

describe('EverWorksInboxPushService — capture', () => {
	it('registers its observer where the Gauzy Inbox is loaded', () => {
		const { feed, service } = setup();
		expect(feed.register).toHaveBeenCalledWith(service.observer);
	});

	it('queues one change per paired recipient; an unpaired recipient gets nothing', async () => {
		const { addItem, service, change, queued } = setup();
		const { item, ids } = addItem({}, [ADA.user, BOB.user]);
		service.changed(change(item));
		await settle();
		expect(queued).toEqual([
			expect.objectContaining({
				entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
				gauzyId: ids[ADA.user],
				changedFields: ['item']
			})
		]);
	});

	it('never queues an Ever Works item (loop guard), the integration’s own notices, or what the sync itself writes', async () => {
		const { addItem, service, change, queued } = setup();
		const fromEverWorks = addItem({
			source: InboxItemSourceEnum.EVER_WORKS,
			externalSource: 'ever_works',
			externalId: 'ew-1'
		});
		service.changed(change(fromEverWorks.item));
		const notice = addItem({
			kind: InboxItemKindEnum.NOTICE,
			source: InboxItemSourceEnum.SYSTEM,
			externalSource: 'ever_works_notice'
		});
		service.changed(change(notice.item));
		const plain = addItem();
		EverWorksSyncContext.run({ connectionId: 'conn-1' }, () => service.changed(change(plain.item)));
		await settle();
		expect(queued).toEqual([]);
	});

	it('an Ever Works member’s answer applied to a shared item still reaches the other recipients’ copies', async () => {
		const { addItem, service, change, queued } = setup();
		const { item, ids } = addItem({}, [ADA.user, CAROL.user]);
		// Ada's answer, applied as Ada: the item change goes to Carol's copy, never back to Ada's.
		EverWorksSyncContext.run({ connectionId: 'conn-1', gauzyRecipientId: ids[ADA.user] }, () =>
			service.changed(change(item))
		);
		// Ada's own read or archive, applied as Ada: nothing to send anywhere.
		EverWorksSyncContext.run({ connectionId: 'conn-1', gauzyRecipientId: ids[ADA.user] }, () =>
			service.changed(
				change(item, {
					scope: 'recipient',
					stated: ['isArchived'],
					recipients: [{ id: ids[ADA.user], userId: ADA.user }]
				})
			)
		);
		await settle();
		expect(queued.map((trigger) => trigger['gauzyId'])).toEqual([ids[CAROL.user]]);
	});

	it('queues an archive, not a read or a snooze (Ever Works keeps no such state for a filed item)', async () => {
		const { addItem, service, change, queued } = setup();
		const { item, ada } = addItem();
		const recipient = [{ id: ada, userId: ADA.user }];
		service.changed(
			change(item, { scope: 'recipient', type: 'updated', recipients: recipient, stated: ['isRead'] })
		);
		service.changed(
			change(item, { scope: 'recipient', type: 'updated', recipients: recipient, stated: ['snoozedUntil'] })
		);
		await settle();
		expect(queued).toEqual([]);
		service.changed(
			change(item, { scope: 'recipient', type: 'updated', recipients: recipient, stated: ['isArchived'] })
		);
		await settle();
		expect(queued).toHaveLength(1);
	});

	it.each([['ew_to_gauzy'], ['off']] as const)(
		'queues nothing while the inbox direction is %s',
		async (direction) => {
			const { addItem, service, change, queued } = setup({ directions: { inbox: direction } });
			expect(await service.capture(change(addItem().item))).toBe(0);
			expect(queued).toEqual([]);
		}
	);
});

describe('EverWorksInboxPushService — the guards of a push', () => {
	it('never sends an Ever Works item back to Ever Works (loop guard)', async () => {
		const { addItem, push, inboxWrite } = setup();
		const { ada } = addItem({
			source: InboxItemSourceEnum.EVER_WORKS,
			externalSource: 'ever_works',
			externalId: 'ew-7'
		});
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('Ever Works item')
		});
		expect(inboxWrite.created).toHaveLength(0);
	});

	it('sends nothing for a recipient who is not paired', async () => {
		const { addItem, push, inboxWrite } = setup();
		const { ids } = addItem({}, [BOB.user]);
		await expect(push(ids[BOB.user])).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('not paired')
		});
		expect(inboxWrite.created).toHaveLength(0);
	});

	it('sends nothing of a kind the recipient keeps out (emails), and the other kinds still go', async () => {
		const { addItem, push, inboxWrite, preferenceService } = setup();
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		const view = await preferenceService.updateMine({ email: false });
		expect(view.kinds).toMatchObject({ email: false, question: true, notice: true });
		mockCaller.userId = null;

		const email = addItem({
			kind: InboxItemKindEnum.EMAIL,
			source: InboxItemSourceEnum.EMAIL,
			externalSource: 'inbox_email',
			options: null,
			title: 'Invoice 1042'
		});
		await expect(push(email.ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('email')
		});
		expect(inboxWrite.created).toHaveLength(0);

		const question = addItem();
		await expect(push(question.ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.created).toHaveLength(1);
	});

	it.each([['ew_to_gauzy'], ['off']] as const)('sends nothing while the inbox direction is %s', async (direction) => {
		const { addItem, push, inboxWrite } = setup({ directions: { inbox: direction } });
		await expect(push(addItem().ada)).resolves.toMatchObject({ status: 'skipped' });
		expect(inboxWrite.created).toHaveLength(0);
	});

	it('sends with the direction gauzy_to_ew (one way to Ever Works)', async () => {
		const { addItem, push, inboxWrite } = setup({ directions: { inbox: 'gauzy_to_ew' } });
		await expect(push(addItem().ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.created).toHaveLength(1);
	});

	it('sends nothing while the mapping’s InboxItem sync setting is off', async () => {
		const { addItem, push, inboxWrite } = setup({ entitySync: { [IntegrationEntity.INBOX_ITEM]: false } });
		await expect(push(addItem().ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('InboxItem')
		});
		expect(inboxWrite.created).toHaveLength(0);
	});

	it('sends nothing about a task whose sync scope is none; a task kept to the Ever platform still goes, with its Ever Works id', async () => {
		const { addItem, push, inboxWrite, tasks, links } = setup();
		const hidden = randomUUID();
		const platform = randomUUID();
		tasks.push(
			{ id: hidden, tenantId: TENANT, syncScope: TaskSyncScopeEnum.NONE },
			{ id: platform, tenantId: TENANT, syncScope: TaskSyncScopeEnum.EVER_PLATFORM }
		);
		links.push({
			id: randomUUID(),
			integrationTenantId: MAPPING,
			entityType: EverWorksLinkType.TASK,
			gauzyId: platform,
			ewId: 'ew-task-9',
			state: 'ok'
		});

		await expect(push(addItem({ taskId: hidden }).ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('sync scope')
		});
		await expect(push(addItem({ entity: BaseEntityEnum.Task, entityId: hidden }).ada)).resolves.toMatchObject({
			status: 'skipped'
		});
		expect(inboxWrite.created).toHaveLength(0);

		await expect(push(addItem({ taskId: platform }).ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.created[0]).toMatchObject({ related: { taskId: 'ew-task-9' } });
	});

	it('leaves items for a process that hosts the Gauzy Inbox (or skips them where it is off)', async () => {
		const { addItem, push } = setup({ inbox: false });
		await expect(push(addItem().ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('GAUZY_INBOX_ENABLED')
		});
	});
});

describe('EverWorksInboxPushService — filing and patching', () => {
	it('files one copy per person and item; a replay of the same externalId answers the copy filed before', async () => {
		const { addItem, push, inboxWrite, mock, links, linkOf } = setup();
		const { item, ada } = addItem();
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.created[0]).toEqual({
			externalId: `${item.id}:${ada}`,
			recipientUserId: ADA.ew,
			kind: 'question',
			title: 'Ship the release?',
			body: 'The \\*build\\* is green.',
			sourceLabel: 'Ever Gauzy',
			sourceUrl: `https://app.gauzy.test/#/pages/inbox?item=${item.id}`,
			choices: [
				{ id: 'yes', label: 'Yes' },
				{ id: 'no', label: 'No' }
			],
			occurredAt: '2026-10-29T08:00:00.000Z'
		});
		const first = linkOf(ada) as Row;
		expect(first).toMatchObject({ ewVersion: 1, lastDirection: 'outbound' });

		// The link is lost (a push that stopped between Ever Works' answer and the link write), and the replay window of
		// the Idempotency-Key is over: the same externalId answers the copy filed before.
		links.splice(links.indexOf(first), 1);
		mock.expireIdempotencyKeys();
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.created).toHaveLength(2);
		expect(inboxWrite.filed()).toHaveLength(1);
		expect(linkOf(ada)).toMatchObject({ ewId: first['ewId'] });
	});

	it('a Gauzy item to two paired people becomes two Ever Works items, each with its own externalId', async () => {
		const { addItem, push, inboxWrite, links } = setup();
		const { ids, item } = addItem({}, [ADA.user, CAROL.user]);
		await push(ids[ADA.user]);
		await push(ids[CAROL.user]);
		expect(inboxWrite.created.map((body) => [body['externalId'], body['recipientUserId']])).toEqual([
			[`${item.id}:${ids[ADA.user]}`, ADA.ew],
			[`${item.id}:${ids[CAROL.user]}`, CAROL.ew]
		]);
		expect(parseGauzyInboxExternalId(inboxWrite.created[1]['externalId'])).toEqual({
			inboxItemId: item.id,
			recipientId: ids[CAROL.user]
		});
		expect(inboxWrite.filed()).toHaveLength(2);
		expect(links.filter((l) => l['entityType'] === EverWorksLinkType.GAUZY_INBOX_ITEM)).toHaveLength(2);
	});

	it('sends an email with its meta and its body as text', async () => {
		const { addItem, push, inboxWrite } = setup();
		const { ada } = addItem({
			kind: InboxItemKindEnum.EMAIL,
			source: InboxItemSourceEnum.EMAIL,
			externalSource: 'inbox_email',
			options: null,
			title: 'Invoice #1042',
			body: '# Not a heading\n> not a quote\n<b>not bold</b>',
			metadata: { from: 'Ada <ada@example.com>', mailboxAddress: 'billing@inbox.example.test' }
		});
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.created[0]).toMatchObject({
			kind: 'email',
			title: 'Invoice #1042',
			body: '\\# Not a heading  \n\\> not a quote  \n\\<b\\>not bold\\</b\\>',
			email: {
				from: 'Ada <ada@example.com>',
				to: ['billing@inbox.example.test'],
				subject: 'Invoice #1042',
				receivedAt: '2026-10-29T08:00:00.000Z'
			}
		});
		expect(inboxWrite.created[0]).not.toHaveProperty('choices');
	});

	it('patches with If-Match only what changed; a 412 is retried once on the current version, keeping what the person did there', async () => {
		const { addItem, push, inboxWrite, items, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;

		Object.assign(items.get(item.id as string) as IInboxItem, { title: 'Ship the release today?' });
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched).toEqual([{ id: ewId, ifMatch: '"1"', body: { title: 'Ship the release today?' } }]);
		expect(linkOf(ada)).toMatchObject({ ewVersion: 2 });

		// Nothing changed since: nothing is sent (loop guard 2).
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('nothing changed')
		});
		expect(inboxWrite.patched).toHaveLength(1);

		// The person read it in Ever Works (version 3) before Gauzy's next edit went out.
		await inboxWrite.read(ewId);
		Object.assign(items.get(item.id as string) as IInboxItem, {
			body: 'The build is green; the changelog is ready.'
		});
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched.slice(1).map((patch) => patch.ifMatch)).toEqual(['"2"', '"3"']);
		expect(inboxWrite.patched[2].body).toEqual({ body: 'The build is green; the changelog is ready.' });
		const filed = inboxWrite.byExternalId(`${item.id}:${ada}`) as Row;
		expect(filed).toMatchObject({ unread: false, version: 4, body: 'The build is green; the changelog is ready.' });
		expect(linkOf(ada)).toMatchObject({ ewVersion: 4 });
	});

	it('an item answered in Gauzy is resolved there with its answer; archiving it archives the copy', async () => {
		const { addItem, push, inboxWrite, items, recipients } = setup();
		const { item, ada } = addItem();
		await push(ada);
		Object.assign(items.get(item.id as string) as IInboxItem, {
			status: InboxItemStatusEnum.ANSWERED,
			response: { optionId: 'yes', text: 'Go', answeredByUserId: ADA.user, answeredAt: new Date().toISOString() }
		});
		await push(ada);
		expect(inboxWrite.patched[0].body).toEqual({ state: 'resolved', resolution: { choiceId: 'yes', text: 'Go' } });
		(recipients.get(ada) as Row)['isArchived'] = true;
		await push(ada);
		expect(inboxWrite.patched[1].body).toEqual({ state: 'archived' });
	});

	it('waits (no dead letter) while Ever Works does not serve the inbox write yet', async () => {
		const { addItem, push, mock, linkOf } = setup();
		const { ada } = addItem();
		mock.fail({ method: 'POST', path: '/inbox/items', status: 404 });
		await expect(push(ada)).resolves.toMatchObject({ status: 'deferred', message: expect.stringContaining('404') });
		expect(linkOf(ada)).toBeUndefined();
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
	});

	it('clears removed choices, and states the resolved state with a corrected answer', async () => {
		const { addItem, push, inboxWrite, items } = setup();
		const { item, ada } = addItem();
		await push(ada);
		Object.assign(items.get(item.id as string) as IInboxItem, { options: null, kind: InboxItemKindEnum.QUESTION });
		await push(ada);
		expect(inboxWrite.patched[0].body).toEqual({ choices: [] });
		Object.assign(items.get(item.id as string) as IInboxItem, {
			status: InboxItemStatusEnum.ANSWERED,
			response: { text: 'Go', answeredByUserId: ADA.user, answeredAt: new Date().toISOString() }
		});
		await push(ada);
		Object.assign(items.get(item.id as string) as IInboxItem, {
			response: { text: 'Go on Monday', answeredByUserId: ADA.user, answeredAt: new Date().toISOString() }
		});
		await push(ada);
		expect(inboxWrite.patched[2].body).toEqual({ state: 'resolved', resolution: { text: 'Go on Monday' } });
	});

	it('an answer the person gave in Ever Works before a Gauzy edit went out reaches Gauzy (the 412 retry applies it)', async () => {
		const { addItem, push, inboxWrite, items, apply, actions, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		// The person answers (version 2); its event has not been applied yet when Gauzy's edit goes out.
		const answered = await inboxWrite.answer(ewId, { choiceId: 'yes' });
		Object.assign(items.get(item.id as string) as IInboxItem, { title: 'Ship the release today?' });
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched.map((patch) => patch.ifMatch)).toEqual(['"1"', '"2"']);
		expect(actions.reply).toHaveBeenCalledTimes(1);
		expect(items.get(item.id as string)).toMatchObject({
			status: InboxItemStatusEnum.ANSWERED,
			response: expect.objectContaining({ optionId: 'yes' })
		});
		// The answer's own event is below the recorded version now: skipped, and never applied twice.
		await expect(apply(answered)).resolves.toMatchObject({ status: 'skipped' });
		expect(actions.reply).toHaveBeenCalledTimes(1);
		// And nothing is sent back: Gauzy holds what Ever Works holds.
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('nothing changed')
		});
	});

	it('a replay that answers a copy the person archived since applies the archive to Gauzy and never reopens it', async () => {
		const { addItem, push, inboxWrite, links, mock, recipients, linkOf } = setup();
		const { ada } = addItem({ kind: InboxItemKindEnum.NOTICE, options: null });
		await push(ada);
		const first = linkOf(ada) as Row;
		await inboxWrite.archive(first['ewId']);
		// The link was lost after the first filing; the retry's POST replays the archived copy.
		links.splice(links.indexOf(first), 1);
		mock.expireIdempotencyKeys();
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(recipients.get(ada)).toMatchObject({ isArchived: true });
		expect(inboxWrite.patched).toHaveLength(0);
	});

	it('sends nothing more to a copy filed for a member the person is no longer paired with', async () => {
		const { addItem, push, inboxWrite, items, links } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const pairing = links.find(
			(l) => l['entityType'] === EverWorksLinkType.MEMBER && l['gauzyId'] === ADA.employee
		) as Row;
		pairing['ewId'] = 'ew-user-ada-new';
		Object.assign(items.get(item.id as string) as IInboxItem, { title: 'Renamed' });
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('another Ever Works member')
		});
		expect(inboxWrite.patched).toHaveLength(0);
	});

	it('an item archived before it ever went out is not filed', async () => {
		const { addItem, push, inboxWrite, recipients } = setup();
		const { ada } = addItem();
		(recipients.get(ada) as Row)['isArchived'] = true;
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('archived')
		});
		expect(inboxWrite.created).toHaveLength(0);
	});

	it('a replay that answers a copy filed for the member the person was paired with before keeps it theirs', async () => {
		const { addItem, push, inboxWrite, items, links, mock, apply, actions, recipients, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const first = linkOf(ada) as Row;
		// The link was lost, and the person was paired with another Ever Works member before the retry.
		links.splice(links.indexOf(first), 1);
		mock.expireIdempotencyKeys();
		const pairing = links.find(
			(l) => l['entityType'] === EverWorksLinkType.MEMBER && l['gauzyId'] === ADA.employee
		) as Row;
		pairing['ewId'] = 'ew-user-ada-new';
		Object.assign(items.get(item.id as string) as IInboxItem, { title: 'Renamed' });
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('another Ever Works member')
		});
		// Recorded as the previous member's copy: never patched with this person's content, nor its moves applied here.
		expect(JSON.parse(linkOf(ada)?.['ewOnly'] as string)).toMatchObject({ recipientUserId: ADA.ew });
		expect(inboxWrite.patched).toHaveLength(0);
		await expect(apply(await inboxWrite.archive(first['ewId']))).resolves.toMatchObject({ status: 'skipped' });
		expect(actions.setState).not.toHaveBeenCalled();
		expect(recipients.get(ada)).toMatchObject({ isArchived: false });
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('another Ever Works member')
		});
		expect(inboxWrite.patched).toHaveLength(0);
	});

	it('a replay of a question filed without choices patches in the choices Gauzy has now', async () => {
		const { addItem, push, inboxWrite, items, links, mock, linkOf } = setup();
		const { item, ada } = addItem({ options: null });
		await push(ada);
		expect(inboxWrite.created[0]).not.toHaveProperty('choices');
		// The link was lost; Gauzy added options before the retry, whose POST replays the copy filed without any.
		links.splice(links.indexOf(linkOf(ada) as Row), 1);
		mock.expireIdempotencyKeys();
		Object.assign(items.get(item.id as string) as IInboxItem, {
			options: [
				{ id: 'yes', label: 'Yes' },
				{ id: 'no', label: 'No' }
			]
		});
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched.map((patch) => patch.body)).toEqual([
			{
				choices: [
					{ id: 'yes', label: 'Yes' },
					{ id: 'no', label: 'No' }
				]
			}
		]);
	});

	it('a key that writes the inbox but cannot read it sends a 412 once more on the version Ever Works names', async () => {
		const scopes = MOCK_PRESET_SCOPES.filter((scope) => scope !== 'inbox:read');
		const { addItem, push, inboxWrite, items, linkOf } = setup({ scopes });
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		// The member reads the copy (version 2), which this key cannot see.
		await inboxWrite.read(ewId);
		Object.assign(items.get(item.id as string) as IInboxItem, { title: 'Ship the release today?' });
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched.map((patch) => patch.ifMatch)).toEqual(['"1"', '"2"']);
		expect(inboxWrite.byExternalId(`${item.id}:${ada}`)).toMatchObject({
			title: 'Ship the release today?',
			version: 3
		});
		expect(linkOf(ada)).toMatchObject({ ewVersion: 3 });
	});

	it('a copy the member answered comes back out of an archive made in Gauzy, its answer kept', async () => {
		const { addItem, push, inboxWrite, apply, recipients, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		await apply(await inboxWrite.answer(ewId, { choiceId: 'no' }));
		(recipients.get(ada) as Row)['isArchived'] = true;
		await push(ada);
		expect(inboxWrite.byExternalId(`${item.id}:${ada}`)).toMatchObject({ state: 'archived' });
		(recipients.get(ada) as Row)['isArchived'] = false;
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched[inboxWrite.patched.length - 1].body).toEqual({ state: 'resolved' });
		expect(inboxWrite.byExternalId(`${item.id}:${ada}`)).toMatchObject({ state: 'resolved', answerOptionId: 'no' });
	});

	it('archives the copy of a gone recipient row on the current version after a 412 (never a stale If-Match forever)', async () => {
		const { addItem, push, inboxWrite, recipients, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		// The member reads the copy (version 2); its event never reaches Gauzy, whose recipient row is then gone.
		await inboxWrite.read(ewId);
		recipients.delete(ada);
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched.map((patch) => [patch.ifMatch, patch.body])).toEqual([
			['"1"', { state: 'archived' }],
			['"2"', { state: 'archived' }]
		]);
		expect(inboxWrite.byExternalId(`${item.id}:${ada}`)).toMatchObject({ state: 'archived', version: 3 });
		expect(linkOf(ada)).toMatchObject({ ewVersion: 3 });
	});
});

describe('EverWorksInboxPushService — what an Ever Works user does', () => {
	it('an answer is applied once, as the recipient, through the Inbox; its echo and later events never answer again', async () => {
		const { addItem, push, inboxWrite, apply, actions, items, writer, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;

		const answered = await inboxWrite.answer(ewId, { choiceId: 'no', text: 'Wait for QA' });
		await expect(apply(answered)).resolves.toMatchObject({ status: 'applied', message: 'reply' });
		expect(actions.reply).toHaveBeenCalledTimes(1);
		expect(actions.reply).toHaveBeenCalledWith(item.id, { optionId: 'no', text: 'Wait for QA' });
		expect(mockActingAs).toEqual([ADA.user]);
		expect(items.get(item.id as string)).toMatchObject({
			status: InboxItemStatusEnum.ANSWERED,
			response: expect.objectContaining({ optionId: 'no', answeredByUserId: ADA.user })
		});
		expect(writer.upsertExternal).not.toHaveBeenCalled(); // never a second (Ever Works) item in the Gauzy Inbox

		// The same event again (a webhook and the feed): at or below the link's version, skipped.
		await expect(apply(answered)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('version')
		});
		// A later event of the item (the person reads it again): no second reply.
		await expect(apply(await inboxWrite.read(ewId, false))).resolves.toMatchObject({
			status: 'applied',
			message: 'unread'
		});
		expect(actions.reply).toHaveBeenCalledTimes(1);

		// Gauzy now holds the answer Ever Works holds: the next push sends nothing back.
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('nothing changed')
		});
	});

	it('an item answered in Gauzy first keeps Gauzy’s answer', async () => {
		const { addItem, push, inboxWrite, apply, actions, items, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		Object.assign(items.get(item.id as string) as IInboxItem, {
			status: InboxItemStatusEnum.ANSWERED,
			response: { optionId: 'yes', answeredByUserId: ADA.user, answeredAt: new Date().toISOString() }
		});
		// Only the read state of the Ever Works answer comes over; Gauzy's answer stays.
		await expect(
			apply(await inboxWrite.answer(linkOf(ada)?.['ewId'] as string, { choiceId: 'no' }))
		).resolves.toMatchObject({ status: 'applied', message: 'read' });
		expect(actions.reply).not.toHaveBeenCalled();
		expect(items.get(item.id as string)?.response).toMatchObject({ optionId: 'yes' });
	});

	it('an archive in Ever Works archives the Gauzy recipient’s copy, and is not sent back', async () => {
		const { addItem, push, inboxWrite, apply, actions, recipients, linkOf } = setup();
		const { item, ada } = addItem({ kind: InboxItemKindEnum.NOTICE, options: null });
		await push(ada);
		await expect(apply(await inboxWrite.archive(linkOf(ada)?.['ewId'] as string))).resolves.toMatchObject({
			status: 'applied',
			message: 'archive'
		});
		expect(actions.setState).toHaveBeenCalledWith(item.id, { isArchived: true });
		expect(recipients.get(ada)).toMatchObject({ isArchived: true });
		await expect(push(ada)).resolves.toMatchObject({ status: 'skipped' });
		expect(inboxWrite.patched).toHaveLength(0);
	});

	it('an Ever Works answer never unarchives what the person archived in Gauzy meanwhile', async () => {
		const { addItem, push, inboxWrite, apply, actions, recipients, items, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		(recipients.get(ada) as Row)['isArchived'] = true; // archived in Gauzy; its push has not gone out yet
		await expect(
			apply(await inboxWrite.answer(linkOf(ada)?.['ewId'] as string, { choiceId: 'yes' }))
		).resolves.toMatchObject({
			status: 'applied',
			message: 'reply'
		});
		expect(actions.setState).not.toHaveBeenCalled();
		expect(recipients.get(ada)).toMatchObject({ isArchived: true });
		expect(items.get(item.id as string)).toMatchObject({ status: InboxItemStatusEnum.ANSWERED });
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched[inboxWrite.patched.length - 1].body).toEqual({ state: 'archived' });
	});

	it('an unarchive in Ever Works does not acknowledge a Gauzy answer that has not gone out', async () => {
		const { addItem, push, inboxWrite, apply, recipients, items, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		(recipients.get(ada) as Row)['isArchived'] = true;
		await push(ada); // the copy is archived in Ever Works
		// Answered in Gauzy (its push still waiting) while the person unarchives the copy in Ever Works.
		Object.assign(items.get(item.id as string) as IInboxItem, {
			status: InboxItemStatusEnum.ANSWERED,
			response: { optionId: 'yes', answeredByUserId: ADA.user, answeredAt: new Date().toISOString() }
		});
		const unarchived = inboxWrite.unarchive(ewId);
		await expect(apply(await unarchived)).resolves.toMatchObject({ status: 'applied', message: 'unarchive' });
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched[inboxWrite.patched.length - 1].body).toEqual({
			state: 'resolved',
			resolution: { choiceId: 'yes' }
		});
	});

	it('applies only what moved in Ever Works: a Gauzy archive still waiting to be pushed survives an Ever Works read', async () => {
		const { addItem, push, inboxWrite, apply, actions, recipients, linkOf } = setup();
		const { ada } = addItem({ kind: InboxItemKindEnum.NOTICE, options: null });
		await push(ada);
		(recipients.get(ada) as Row)['isArchived'] = true; // archived in Gauzy; its push has not gone out yet
		await expect(apply(await inboxWrite.read(linkOf(ada)?.['ewId'] as string))).resolves.toMatchObject({
			status: 'applied',
			message: 'read'
		});
		expect(actions.setState).toHaveBeenCalledTimes(1);
		expect(recipients.get(ada)).toMatchObject({ isArchived: true, isRead: true });
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched[inboxWrite.patched.length - 1].body).toEqual({ state: 'archived' });
	});

	it('an event of a copy whose link is not recorded yet waits for it (never becomes an Ever Works item in Gauzy)', async () => {
		const { addItem, mock, apply, writer, inboxWrite } = setup();
		const { item, ada } = addItem();
		const orphan = mock.addInboxItem('ew-org-1', {
			recipientUserId: ADA.ew,
			externalId: `${item.id}:${ada}`,
			version: 2
		});
		void inboxWrite;
		const envelope = await mock.emitInbox('inbox.item.updated', orphan);
		await expect(apply(envelope)).resolves.toMatchObject({ status: 'deferred' });
		expect(writer.upsertExternal).not.toHaveBeenCalled();
	});

	it('a copy deleted in Ever Works is unlinked and kept as a tombstone: the Gauzy item stays and is never filed again', async () => {
		const { addItem, push, apply, mock, linkOf, items, inboxWrite } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const link = linkOf(ada) as Row;
		const filed = mock.inboxItems.get(link['ewId']) as Row;
		// A hard delete in Ever Works frees the externalId there (CR-15): only the tombstone keeps Gauzy from filing it again.
		mock.inboxItems.delete(link['ewId']);
		const envelope = await mock.emitInbox('inbox.item.deleted', { ...filed, version: 5, deleted: true });
		await expect(apply(envelope)).resolves.toMatchObject({ status: 'applied' });
		expect(link['state']).toBe('unlinked');
		expect(items.has(item.id as string)).toBe(true);
		Object.assign(items.get(item.id as string) as IInboxItem, { title: 'Edited after the delete' });
		await expect(push(ada)).resolves.toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('no longer synced')
		});
		expect(inboxWrite.created).toHaveLength(1);
	});

	it('never brings back an item its own key filed (integrationKeyId), even for no Gauzy item known here', async () => {
		const { mock, apply, writer, context } = setup();
		const ours = mock.addInboxItem('ew-org-1', {
			recipientUserId: ADA.ew,
			kind: 'notice',
			integrationKeyId: (context.connection as { keyId: string }).keyId,
			externalId: 'not-a-gauzy-copy',
			version: 2
		});
		await expect(apply(await mock.emitInbox('inbox.item.updated', ours))).resolves.toMatchObject({
			status: 'skipped'
		});
		expect(writer.upsertExternal).not.toHaveBeenCalled();
	});

	it('an item another integration filed is an Ever Works item like any other (brought into the Gauzy Inbox)', async () => {
		const { mock, apply, writer } = setup();
		writer.upsertExternal.mockResolvedValue({
			item: { id: randomUUID() },
			created: true,
			recipientUserIds: [ADA.user],
			skippedUserIds: []
		});
		const theirs = mock.addInboxItem('ew-org-1', {
			recipientUserId: ADA.ew,
			kind: 'notice',
			integrationKeyId: 'another-integration-key',
			externalId: 'jira-123',
			version: 1
		});
		await expect(apply(await mock.emitInbox('inbox.item.created', theirs))).resolves.toMatchObject({
			status: 'applied'
		});
		expect(writer.upsertExternal).toHaveBeenCalledTimes(1);
	});

	it('never sends Gauzy’s answer over the one the member gave in Ever Works', async () => {
		const { addItem, push, inboxWrite, apply, actions, items, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		// Answered in Gauzy first (its push not out yet), then the member answers in Ever Works.
		Object.assign(items.get(item.id as string) as IInboxItem, {
			status: InboxItemStatusEnum.ANSWERED,
			response: { optionId: 'yes', answeredByUserId: ADA.user, answeredAt: new Date().toISOString() }
		});
		await apply(await inboxWrite.answer(ewId, { choiceId: 'no' }));
		expect(actions.reply).not.toHaveBeenCalled();
		Object.assign(items.get(item.id as string) as IInboxItem, { title: 'Ship the release today?' });
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched[inboxWrite.patched.length - 1].body).toEqual({ title: 'Ship the release today?' });
		expect(inboxWrite.byExternalId(`${item.id}:${ada}`)).toMatchObject({
			answerOptionId: 'no',
			status: 'answered'
		});
	});

	it('an answer applied once is never applied again to an item its source reopened (a push answer, a later read)', async () => {
		const { addItem, push, inboxWrite, apply, actions, items, linkOf } = setup();
		const { item, ada } = addItem();
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		await expect(apply(await inboxWrite.answer(ewId, { choiceId: 'no' }))).resolves.toMatchObject({
			status: 'applied',
			message: 'reply'
		});
		expect(actions.reply).toHaveBeenCalledTimes(1);
		// The source reopens the Gauzy item; Ever Works still holds the member's answer.
		Object.assign(items.get(item.id as string) as IInboxItem, {
			status: InboxItemStatusEnum.OPEN,
			response: null,
			title: 'Ship the release on Monday?'
		});
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		// A later read of the copy carries the same answer again.
		await apply(await inboxWrite.read(ewId, false));
		expect(actions.reply).toHaveBeenCalledTimes(1);
		expect(items.get(item.id as string)).toMatchObject({ status: InboxItemStatusEnum.OPEN, response: null });
	});

	it('an answer Gauzy refuses (no reason where one is asked) is not acknowledged: the item stays open and it is tried again', async () => {
		const { addItem, push, inboxWrite, apply, actions, items, linkOf } = setup();
		const { item, ada } = addItem({ requireReason: true } as Partial<IInboxItem>);
		await push(ada);
		const ewId = linkOf(ada)?.['ewId'] as string;
		await apply(await inboxWrite.answer(ewId, { choiceId: 'yes' }));
		expect(actions.reply).toHaveBeenCalledTimes(1);
		expect(items.get(item.id as string)).toMatchObject({ status: InboxItemStatusEnum.OPEN });
		// A later event of the copy carries the same answer: tried again, still refused, never taken as applied.
		await apply(await inboxWrite.read(ewId, false));
		expect(actions.reply).toHaveBeenCalledTimes(2);
		// The member answers again with a reason: it goes.
		await expect(
			apply(await inboxWrite.answer(ewId, { choiceId: 'yes', text: 'The changelog is ready' }))
		).resolves.toMatchObject({ status: 'applied' });
		expect(items.get(item.id as string)).toMatchObject({
			status: InboxItemStatusEnum.ANSWERED,
			response: expect.objectContaining({ optionId: 'yes', text: 'The changelog is ready' })
		});
	});

	it('finds a pending copy by its externalId while the connection does not know its key id yet', async () => {
		const { addItem, mock, apply, writer, context } = setup();
		const { item, ada } = addItem();
		(context.connection as { keyId: string | null }).keyId = null;
		const orphan = mock.addInboxItem('ew-org-1', {
			recipientUserId: ADA.ew,
			integrationKeyId: 'the-key-of-this-connection',
			externalId: `${item.id}:${ada}`,
			version: 2
		});
		await expect(apply(await mock.emitInbox('inbox.item.updated', orphan))).resolves.toMatchObject({
			status: 'deferred'
		});
		expect(writer.upsertExternal).not.toHaveBeenCalled();
	});
});

describe('EverWorksInboxPushService — backfill', () => {
	it('reads the exact kind of a notice: a mention still goes with notices off, a plain notice does not', async () => {
		const { addItem, service, context, preferenceService } = setup();
		const mention = addItem({
			kind: InboxItemKindEnum.NOTICE,
			options: null,
			metadata: { notificationType: 'Mention' }
		});
		addItem({ kind: InboxItemKindEnum.NOTICE, options: null });
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		await preferenceService.updateMine({ notice: false });
		expect((await service.backfillPage(context as never, null)).ids).toEqual([mention.ada]);
		await preferenceService.updateMine({ mention: false, assignment: false });
		expect((await service.backfillPage(context as never, null)).ids).toEqual([]);
	});

	it('leaves out what the push refuses: the integration’s own notices and items of a task kept out of every integration', async () => {
		const { addItem, service, context, tasks } = setup();
		const hidden = randomUUID();
		tasks.push({ id: hidden, tenantId: TENANT, syncScope: TaskSyncScopeEnum.NONE });
		const kept = addItem();
		addItem({
			kind: InboxItemKindEnum.NOTICE,
			source: InboxItemSourceEnum.SYSTEM,
			externalSource: 'ever_works_notice',
			options: null
		});
		addItem({ taskId: hidden });
		expect((await service.backfillPage(context as never, null)).ids).toEqual([kept.ada]);
		await expect(service.backfillCounts(context as never)).resolves.toEqual({
			total: 1,
			linked: 0,
			truncated: false
		});
	});

	it('lists the open Gauzy-origin items of paired people, as their preferences allow', async () => {
		const { addItem, service, context, preferenceService } = setup();
		const open = addItem();
		addItem({ status: InboxItemStatusEnum.ANSWERED });
		addItem({ source: InboxItemSourceEnum.EVER_WORKS, externalSource: 'ever_works', externalId: 'ew-3' });
		addItem({}, [BOB.user]);
		const email = addItem({ kind: InboxItemKindEnum.EMAIL, source: InboxItemSourceEnum.EMAIL, options: null });
		expect((await service.backfillPage(context as never, null)).ids.sort()).toEqual([open.ada, email.ada].sort());

		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		await preferenceService.updateMine({ email: false });
		expect((await service.backfillPage(context as never, null)).ids).toEqual([open.ada]);
		await expect(service.backfillCounts(context as never)).resolves.toEqual({
			total: 1,
			linked: 0,
			truncated: false
		});
	});

	it('the preview count reads a bounded number of recipient pages, and says when it stopped there', async () => {
		const { addItem, service, context, feed } = setup();
		addItem();
		const real = feed.openRecipientsOf;
		const endless = jest.fn(async (...args: Parameters<IInboxItemFeed['openRecipientsOf']>) => ({
			...(await real(...args)),
			next: 'more'
		}));
		feed.openRecipientsOf = endless;
		await expect(service.backfillCounts(context as never, 3)).resolves.toMatchObject({ truncated: true });
		expect(endless).toHaveBeenCalledTimes(3);
		feed.openRecipientsOf = real;
		await expect(service.backfillCounts(context as never, 3)).resolves.toMatchObject({ truncated: false });
	});
});

describe('EverWorksInboxPushService — recovery sweep', () => {
	const connection = { id: 'conn-1' } as never;

	it('files a never-sent item only for a change after the inbox started going to Ever Works (no quiet backfill)', async () => {
		const pushSince = new Date(Date.now() - 10 * 60_000);
		const { addItem, service, queued } = setup({ pushSince: pushSince.toISOString() });
		addItem({ title: 'Untouched since before', updatedAt: new Date(pushSince.getTime() - 20 * 60_000) });
		const fresh = addItem({ title: 'Written after', updatedAt: new Date() });
		await service.sweep(connection);
		expect(queued.map((trigger) => trigger['gauzyId'])).toEqual([fresh.ada]);
	});

	it('files no never-sent item while the mapping has no start time of the push (only the live capture does)', async () => {
		const { addItem, service, queued } = setup();
		addItem({ updatedAt: new Date() });
		await service.sweep(connection);
		expect(queued).toEqual([]);
	});

	it('archives the copy of a recipient row that is gone without a notice', async () => {
		const { addItem, push, service, queued, recipients, inboxWrite } = setup();
		const { ada } = addItem({ updatedAt: new Date(Date.now() - 2 * 60 * 60_000) });
		await push(ada);
		recipients.delete(ada); // a replacing re-delivery removed the row; its notice was lost
		await service.sweep(connection);
		expect(queued).toEqual([expect.objectContaining({ gauzyId: ada, changedFields: ['gone'] })]);
		await expect(push(ada)).resolves.toMatchObject({ status: 'pushed' });
		expect(inboxWrite.patched[inboxWrite.patched.length - 1].body).toEqual({ state: 'archived' });
	});
});

describe('dependency injection', () => {
	it('injects the mirror and the preferences by class (a `| null` type would emit Object and inject nothing)', () => {
		const types = (target: unknown) => Reflect.getMetadata('design:paramtypes', target as object) as unknown[];
		expect(types(EverWorksInboxService)).toContain(EverWorksInboxPushService);
		expect(types(EverWorksInitialSyncService)).toContain(EverWorksInboxPushService);
		expect(types(EverWorksPeopleService)).toContain(EverWorksInboxPreferencesService);
	});
});

describe('EverWorksInitialSyncService — the inbox phase', () => {
	const INBOX = EVER_WORKS_SYNC_PHASE_SPECS.find((spec) => spec.name === 'inbox') as EverWorksSyncPhaseSpec;

	/** The initial sync with only what its inbox phase reads; `pages` maps a cursor to one backfill page. */
	function initialSync(pages: Record<string, { ids: string[]; next: string | null }> = {}) {
		const queue = { enqueue: jest.fn(async (_trigger: Row) => true) };
		const inboxPush = {
			canBackfill: true,
			backfillPage: jest.fn(
				async (_context: unknown, after: string | null) => pages[after ?? ''] ?? { ids: [], next: null }
			)
		};
		const sync = new EverWorksInitialSyncService(
			null as never,
			null as never,
			null as never,
			null as never,
			{ hasHandler: () => true } as never,
			{ hasHandler: () => true } as never,
			queue as never,
			null as never,
			inboxPush as never
		);
		return { sync: sync as unknown as Record<string, (...args: unknown[]) => any>, queue, inboxPush };
	}

	const contextWith = (scopes: string[], backfill: boolean) => ({
		tenantId: TENANT,
		organizationId: ORG,
		integrationTenantId: MAPPING,
		connection: { scopes: JSON.stringify(scopes) },
		mapping: { settings: [{ settingsName: 'BACKFILL_GAUZY_INBOX', settingsValue: String(backfill) }] },
		directions: { ...DEFAULT_EVER_WORKS_DIRECTIONS, inbox: 'both' },
		entitySync: {}
	});

	it('sends the open Gauzy items only with the backfill on, and runs each half with its own scope', () => {
		const { sync } = initialSync();
		const plan = (scopes: string[], backfill: boolean) => sync['planOf'](INBOX, contextWith(scopes, backfill));
		expect(plan(['inbox:read', 'inbox:write'], false)).toMatchObject({
			import: true,
			export: false,
			note: expect.stringContaining('backfill of open items is off')
		});
		expect(plan(['inbox:read', 'inbox:write'], true)).toMatchObject({ import: true, export: true });
		expect(plan(['inbox:write'], true)).toMatchObject({ import: false, export: true });
		expect(plan(['inbox:read'], true)).toMatchObject({ import: true, export: false });
		expect(plan(['inbox:write'], false)).toMatchObject({ import: false, export: false, done: true });
	});

	it('queues the backfill page by page and resumes a stopped run from its saved cursor', async () => {
		const { sync, queue, inboxPush } = initialSync({
			'': { ids: ['r1', 'r2'], next: 'r2' },
			r2: { ids: ['r3'], next: null }
		});
		const context = contextWith(['inbox:write'], true);
		const state: Record<string, unknown> = { exported: 0, exportCursor: null };
		const deadline = Date.now() + 60_000;
		// The lease is lost after the first page: the run stops with its cursor saved.
		let owner = 0;
		await expect(sync['exportGauzyInbox'](context, state, deadline, async () => ++owner < 2)).resolves.toBe(false);
		expect(state).toMatchObject({ exported: 2, exportCursor: 'r2' });
		// Another sweep carries on from it, to the end; a finished backfill reads nothing more.
		await expect(sync['exportGauzyInbox'](context, state, deadline, async () => true)).resolves.toBe(true);
		expect(state).toMatchObject({ exported: 3, exportCursor: 'done' });
		await expect(sync['exportGauzyInbox'](context, state, deadline, async () => true)).resolves.toBe(true);
		expect(inboxPush.backfillPage.mock.calls.map((call) => call[1])).toEqual([null, 'r2']);
		expect(queue.enqueue.mock.calls.map((call) => call[0]['gauzyId'])).toEqual(['r1', 'r2', 'r3']);
		expect(queue.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({ entityType: EverWorksLinkType.GAUZY_INBOX_ITEM, changedFields: ['backfill'] })
		);
	});

	it('stops within a page when the lease is lost, and carries on after the last row it queued', async () => {
		const ids = Array.from({ length: 120 }, (_, index) => `r${String(index).padStart(3, '0')}`);
		const { sync, queue } = initialSync({ '': { ids, next: null }, r049: { ids: ids.slice(50), next: null } });
		const context = contextWith(['inbox:write'], true);
		const state: Record<string, unknown> = { exported: 0, exportCursor: null };
		const deadline = Date.now() + 60_000;
		let owner = 0;
		await expect(sync['exportGauzyInbox'](context, state, deadline, async () => ++owner < 2)).resolves.toBe(false);
		expect(state).toMatchObject({ exported: 50, exportCursor: 'r049' });
		await expect(sync['exportGauzyInbox'](context, state, deadline, async () => true)).resolves.toBe(true);
		expect(state).toMatchObject({ exported: 120, exportCursor: 'done' });
		expect(queue.enqueue.mock.calls.map((call) => call[0]['gauzyId'])).toEqual(ids);
	});
});

describe('EverWorksInboxPreferencesService', () => {
	it('sends every kind by default; a person changes only the kinds they state, and sees where their items go', async () => {
		const { preferenceService } = setup();
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		const initial = await preferenceService.mine();
		expect(initial).toMatchObject({
			available: ['notice', 'question', 'approval', 'mention', 'assignment', 'email', 'other'],
			kinds: {
				notice: true,
				question: true,
				approval: true,
				mention: true,
				assignment: true,
				email: true,
				other: true
			},
			updatedAt: null,
			organizations: [
				{ organizationId: ORG, organizationName: 'Acme', paired: true, sending: true, reason: null }
			]
		});
		await preferenceService.updateMine({ email: false, other: false });
		const updated = await preferenceService.updateMine({ other: true });
		expect(updated.kinds).toMatchObject({ email: false, other: true, notice: true });

		mockCaller.userId = BOB.user;
		expect((await preferenceService.mine()).organizations).toEqual([
			expect.objectContaining({ paired: false, sending: false, reason: 'not_paired' })
		]);
		const summaries = await preferenceService.summaries(TENANT, [ADA.user, BOB.user]);
		expect(summaries.get(ADA.user)).toMatchObject({
			customized: true,
			kinds: expect.objectContaining({ email: false })
		});
		expect(summaries.get(BOB.user)).toMatchObject({ customized: false });
		// Every kind back on is still a choice of Ada's own.
		mockCaller.userId = ADA.user;
		await preferenceService.updateMine({ email: true });
		expect((await preferenceService.summaries(TENANT, [ADA.user])).get(ADA.user)).toMatchObject({
			customized: true,
			kinds: expect.objectContaining({ email: true, other: true })
		});
	});

	it('tells why nothing is sent while the connection key may not file inbox items (inbox:write)', async () => {
		const { preferenceService } = setup({ scopes: MOCK_PRESET_SCOPES.filter((scope) => scope !== 'inbox:write') });
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		expect((await preferenceService.mine()).organizations[0]).toMatchObject({
			paired: true,
			sending: false,
			reason: 'missing_scope'
		});
	});

	it('two overlapping saves of different kinds keep both', async () => {
		const { preferenceService } = setup();
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		await Promise.all([
			preferenceService.updateMine({ email: false }),
			preferenceService.updateMine({ notice: false })
		]);
		expect((await preferenceService.mine()).kinds).toMatchObject({ email: false, notice: false, question: true });
	});

	it('a save that fails for another reason than a concurrent insert says so (never "changed meanwhile")', async () => {
		const { preferenceService } = setup();
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		const table = (
			preferenceService as unknown as { repository: () => { insert: () => Promise<void> } }
		).repository();
		const failure = new Error('connection lost');
		jest.spyOn(table, 'insert').mockRejectedValueOnce(failure);
		await expect(preferenceService.updateMine({ email: false })).rejects.toBe(failure);
		// The next save goes through.
		await preferenceService.updateMine({ email: false });
		expect((await preferenceService.mine()).kinds).toMatchObject({ email: false });
	});

	it('tells why nothing is sent while the direction does not write to Ever Works', async () => {
		const { preferenceService } = setup({ directions: { inbox: 'ew_to_gauzy' } });
		mockCaller.tenantId = TENANT;
		mockCaller.userId = ADA.user;
		expect((await preferenceService.mine()).organizations[0]).toMatchObject({
			paired: true,
			sending: false,
			reason: 'direction'
		});
	});
});

describe('the kind mapping and the text', () => {
	it('sends an answer outside the copy’s choices (past the tenth option) as text', () => {
		const options = Array.from({ length: 12 }, (_, index) => ({ id: `o${index}`, label: `Option ${index}` }));
		const shared = sharedOf(
			{
				title: 'Pick one',
				body: '',
				kind: InboxItemKindEnum.QUESTION,
				options,
				status: InboxItemStatusEnum.ANSWERED,
				response: {
					optionId: 'o11',
					text: 'Late pick',
					answeredByUserId: ADA.user,
					answeredAt: new Date().toISOString()
				}
			} as never,
			{ isArchived: false },
			'question'
		);
		expect(shared.choices).toHaveLength(10);
		expect(shared.resolution).toEqual({ text: 'Option 11 — Late pick' });
	});

	it('sends an answer whose option id is over 64 characters as its label, never as another option cut to the same id', () => {
		const short = 'a'.repeat(64);
		const shared = sharedOf(
			{
				title: 'Pick one',
				body: '',
				kind: InboxItemKindEnum.QUESTION,
				options: [
					{ id: short, label: 'Short' },
					{ id: `${short}b`, label: 'Long' }
				],
				status: InboxItemStatusEnum.ANSWERED,
				response: { optionId: `${short}b`, answeredByUserId: ADA.user, answeredAt: new Date().toISOString() }
			} as never,
			{ isArchived: false },
			'question'
		);
		expect(shared.choices).toEqual([{ id: short, label: 'Short' }]);
		expect(shared.resolution).toEqual({ text: 'Long' });
	});

	it('maps Gauzy kinds onto the Ever Works kinds', () => {
		expect(everWorksKindOf(InboxItemKindEnum.QUESTION)).toBe('question');
		expect(everWorksKindOf(InboxItemKindEnum.ESCALATION)).toBe('question');
		expect(everWorksKindOf(InboxItemKindEnum.APPROVAL)).toBe('approval');
		expect(everWorksKindOf(InboxItemKindEnum.EMAIL)).toBe('email');
		expect(everWorksKindOf(InboxItemKindEnum.NOTICE)).toBe('notice');
		expect(everWorksKindOf(InboxItemKindEnum.NOTICE, { notificationType: 'Mention' })).toBe('mention');
		expect(everWorksKindOf(InboxItemKindEnum.NOTICE, { notificationType: 'Assignment' })).toBe('assignment');
		expect(everWorksKindOf('SOMETHING_NEW')).toBe('other');
		// A type naming an inherited member of a plain object is just a notice.
		for (const notificationType of ['constructor', '__proto__', 'toString', 'hasOwnProperty'])
			expect(everWorksKindOf(InboxItemKindEnum.NOTICE, { notificationType })).toBe('notice');
	});

	it('offers Approve / Reject only for an approval that lists no option (the Gauzy Inbox takes them only then)', () => {
		expect(choicesOf({ options: null } as never, 'approval')).toEqual([
			{ id: 'approve', label: 'Approve' },
			{ id: 'reject', label: 'Reject' }
		]);
		expect(choicesOf({ options: [] } as never, 'approval')).toHaveLength(2);
		// Options whose ids Ever Works cannot hold (over 64 characters): no choice there, never ones Gauzy refuses.
		expect(choicesOf({ options: [{ id: 'x'.repeat(65), label: 'Ship it' }] } as never, 'approval')).toBeNull();
		expect(choicesOf({ options: null } as never, 'question')).toBeNull();
	});

	it('keeps plain text from turning into Markdown formatting', () => {
		expect(plainTextAsMarkdown('1. not a list\n- nor this\n*a* _b_ `c` [d](e) | f ~g~')).toBe(
			'1\\. not a list  \n\\- nor this  \n\\*a\\* \\_b\\_ \\`c\\` \\[d\\](e) \\| f \\~g\\~'
		);
		// An entity is text too: `AT&amp;T` and `&copy;` read as written, not as `AT&T` and `©`.
		expect(plainTextAsMarkdown('AT&amp;T &copy;')).toBe('AT\\&amp;T \\&copy;');
		expect(parseGauzyInboxExternalId('not:ours')).toBeNull();
	});
});
