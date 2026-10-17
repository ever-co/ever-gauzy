/**
 * The Ever Works inbox sync (G-P3-3) against in-memory stand-ins and the mock Ever Works server (contract
 * v1-draft.4, CR-4): EW items into the Gauzy Inbox (deferred while the recipient is unmatched), replies acting
 * as the recipient (already decided in Ever Works comes back with its answer), read / archive mirrored.
 */
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
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'UserOrganization',
				'Employee',
				'EmployeeNotification',
				'User',
				'IntegrationTenant',
				'IntegrationSetting'
			].map((name) => [name, entity(name)])
		),
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null }
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import {
	IInboxItem,
	IInboxItemUpsertInput,
	IInboxItemWriter,
	IInboxSourceHandler,
	InboxItemKindEnum,
	InboxItemSourceEnum,
	InboxItemStatusEnum
} from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import { TestEverWorksClientFactory } from '../client/ever-works-client.factory';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import { EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { DEFAULT_EVER_WORKS_DIRECTIONS } from '../mapping/ever-works-mapping.defaults';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { EVER_WORKS_INBOX_EXTERNAL_SOURCE, everWorksStateOf, inboxUpsertOf } from './ever-works-inbox.mapper';
import { EverWorksInboxService } from './ever-works-inbox.service';

const TENANT = 'tenant-1';
const ORG = 'org-1';
const MAPPING = 'mapping-1';
const ADA_USER = 'user-ada';
const ADA_EMPLOYEE = 'employee-ada';

interface LinkRow {
	integrationTenantId: string;
	entityType: string;
	gauzyId: string;
	ewId: string;
	ewVersion: number | null;
	state?: string;
}

function setup(options: { inbox?: boolean } = {}) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({ organizations: [ewOrg] });
	const adaEw = 'ew-user-ada';
	const connection = { id: 'conn-1', tenantId: TENANT, status: EverWorksConnectionStatus.ACTIVE };
	const context = {
		tenantId: TENANT,
		organizationId: ORG,
		integrationTenantId: MAPPING,
		connection,
		everWorksOrganizationId: ewOrg.id,
		everWorksOrganizationSlug: ewOrg.slug,
		directions: { ...DEFAULT_EVER_WORKS_DIRECTIONS },
		isEnabled: true,
		mapping: {}
	};
	const contexts = {
		forEverWorksOrganization: async (_c: unknown, ewOrgId: string) => (ewOrgId === ewOrg.id ? context : null),
		forOrganization: async (tenantId: string, organizationId: string) =>
			tenantId === TENANT && organizationId === ORG ? context : null
	};
	const links: LinkRow[] = [];
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) =>
			links.find((l) => l.integrationTenantId === m && l.entityType === type && l.ewId === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) =>
			links.find((l) => l.integrationTenantId === m && l.entityType === type && l.gauzyId === gauzyId) ?? null,
		record: async (input: Record<string, any>) => {
			const existing = links.find((l) => l.entityType === input['entityType'] && l.ewId === input['ewId']);
			if (existing) Object.assign(existing, { gauzyId: input['gauzyId'], ewVersion: input['ewVersion'] ?? null });
			else
				links.push({
					integrationTenantId: input['integrationTenantId'],
					entityType: input['entityType'],
					gauzyId: input['gauzyId'],
					ewId: input['ewId'],
					ewVersion: input['ewVersion'] ?? null
				});
		}
	};
	const link = (entityType: EverWorksLinkType, gauzyId: string, ewId: string) =>
		links.push({ integrationTenantId: MAPPING, entityType, gauzyId, ewId, ewVersion: null });
	const employees = [{ id: ADA_EMPLOYEE, userId: ADA_USER, tenantId: TENANT, organizationId: ORG }];
	const dataSource = {
		getRepository: (target: unknown) => {
			if (target !== Employee) throw new Error('unexpected repository');
			return {
				findOne: async ({ where }: { where: Record<string, unknown> }) =>
					employees.find((row) =>
						Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v)
					) ?? null
			};
		}
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
	const writes: IInboxItemUpsertInput[] = [];
	const writer: IInboxItemWriter = {
		create: jest.fn(),
		upsertExternal: jest.fn(async (input: IInboxItemUpsertInput) => {
			writes.push(input);
			return {
				item: { id: `g-${input.externalId}` } as never,
				created: writes.length === 1,
				recipientUserIds: input.recipients.map((r) => r.userId),
				skippedUserIds: []
			};
		})
	};
	const registered: IInboxSourceHandler[] = [];
	const registry = {
		register: (handler: IInboxSourceHandler) => void registered.push(handler),
		unregister: jest.fn(),
		get: (source: string) => registered.find((handler) => handler.source === source)
	};
	const service = new EverWorksInboxService(
		dataSource as never,
		contexts as never,
		linkService as never,
		connections as never,
		options.inbox === false ? undefined : writer,
		options.inbox === false ? undefined : registry
	);
	service.onModuleInit();
	const envelope = (type: string, item: Record<string, unknown>): EverWorksEventEnvelope =>
		({
			id: `evt-${Math.random()}`,
			seq: '1',
			type,
			version: 1,
			occurredAt: new Date().toISOString(),
			tenantId: mock.tenant.id,
			organizationId: ewOrg.id,
			aggregate: { type: 'inbox_item', id: item['id'] as string, version: Number(item['version']) },
			actor: { type: 'user', id: adaEw },
			data: { ...item }
		}) as EverWorksEventEnvelope;
	const apply = (e: EverWorksEventEnvelope) =>
		service.apply(e, { connection: connection as never, event: {} as never, organizationId: ORG });
	const gauzyItem = (ewItem: Record<string, unknown>, overrides: Partial<IInboxItem> = {}): IInboxItem =>
		({
			id: `g-${ewItem['id']}`,
			tenantId: TENANT,
			organizationId: ORG,
			kind: InboxItemKindEnum.QUESTION,
			source: InboxItemSourceEnum.EVER_WORKS,
			status: InboxItemStatusEnum.ANSWERED,
			externalSource: EVER_WORKS_INBOX_EXTERNAL_SOURCE,
			externalId: ewItem['id'],
			...overrides
		}) as IInboxItem;
	return { mock, ewOrg, adaEw, service, writes, registered, link, links, envelope, apply, gauzyItem, writer };
}

describe('EverWorksInboxService', () => {
	it('registers the EVER_WORKS source handler where the Gauzy Inbox is loaded', () => {
		const { registered, service } = setup();
		expect(registered).toEqual([service.handler]);
		expect(service.handler.source).toBe(InboxItemSourceEnum.EVER_WORKS);
	});

	it('leaves inbox events for another process where the Inbox is on but not loaded here', async () => {
		const saved = process.env['GAUZY_INBOX_ENABLED'];
		process.env['GAUZY_INBOX_ENABLED'] = 'true';
		try {
			const { mock, ewOrg, envelope, apply } = setup({ inbox: false });
			const item = mock.addInboxItem(ewOrg.id);
			await expect(apply(envelope('inbox.item.created', item))).resolves.toMatchObject({ status: 'deferred' });
		} finally {
			if (saved === undefined) delete process.env['GAUZY_INBOX_ENABLED'];
			else process.env['GAUZY_INBOX_ENABLED'] = saved;
		}
	});

	it('skips inbox events where the Gauzy Inbox is off', async () => {
		const { mock, ewOrg, envelope, apply, registered } = setup({ inbox: false });
		const item = mock.addInboxItem(ewOrg.id);
		await expect(apply(envelope('inbox.item.created', item))).resolves.toMatchObject({ status: 'skipped' });
		expect(registered).toEqual([]);
	});

	it('an item of an unmatched recipient waits (deferred); once matched it arrives with its links', async () => {
		const { mock, ewOrg, adaEw, envelope, apply, writes, link } = setup();
		const item = mock.addInboxItem(ewOrg.id, {
			recipientUserId: adaEw,
			taskId: 'ew-task-1',
			agentId: 'ew-agent-1',
			workId: 'ew-work-9'
		});

		await expect(apply(envelope('inbox.item.created', item))).resolves.toMatchObject({ status: 'deferred' });
		expect(writes).toHaveLength(0);

		link(EverWorksLinkType.MEMBER, ADA_EMPLOYEE, adaEw);
		link(EverWorksLinkType.TASK, 'g-task-1', 'ew-task-1');
		link(EverWorksLinkType.AGENT, 'g-agent-employee-1', 'ew-agent-1');
		await expect(apply(envelope('inbox.item.created', item))).resolves.toEqual({ status: 'applied' });
		expect(writes[0]).toMatchObject({
			tenantId: TENANT,
			organizationId: ORG,
			kind: InboxItemKindEnum.QUESTION,
			source: InboxItemSourceEnum.EVER_WORKS,
			externalSource: 'ever_works',
			externalId: item['id'],
			status: InboxItemStatusEnum.OPEN,
			taskId: 'g-task-1',
			agentEmployeeId: 'g-agent-employee-1',
			projectId: null,
			options: [
				{ id: 'pro', label: 'Pro', recommended: true },
				{ id: 'team', label: 'Team' }
			],
			recipients: [{ userId: ADA_USER, isRead: false, isArchived: false }]
		});

		// The same version again is a no-op.
		await expect(apply(envelope('inbox.item.created', item))).resolves.toMatchObject({ status: 'skipped' });
	});

	it('overlapping snapshots of one item: an older one never replaces a newer one', async () => {
		const { mock, ewOrg, adaEw, envelope, apply, writes, link } = setup();
		link(EverWorksLinkType.MEMBER, ADA_EMPLOYEE, adaEw);
		const item = mock.addInboxItem(ewOrg.id, { recipientUserId: adaEw });
		const v2 = { ...item, version: 2 };
		const v3 = {
			...item,
			version: 3,
			status: 'answered',
			answeredAt: '2026-10-16T09:05:00.000Z',
			answerOptionId: 'pro'
		};

		// The newer one starts first; without one-at-a-time and the re-check, both would pass the version check.
		const [newer, older] = await Promise.all([
			apply(envelope('inbox.item.answered', v3)),
			apply(envelope('inbox.item.state_changed', v2))
		]);
		expect(newer).toEqual({ status: 'applied' });
		expect(older).toMatchObject({ status: 'skipped' });
		expect(writes).toHaveLength(1);
		expect(writes[0]).toMatchObject({ status: InboxItemStatusEnum.ANSWERED });
	});

	it('a reply acts as the recipient; Ever Works routes it, and its answered event would update Gauzy', async () => {
		const { mock, ewOrg, adaEw, service, link, gauzyItem, envelope, apply, writes } = setup();
		link(EverWorksLinkType.MEMBER, ADA_EMPLOYEE, adaEw);
		const item = mock.addInboxItem(ewOrg.id, { recipientUserId: adaEw });
		const before = { ...item };

		await expect(
			service.reply(
				gauzyItem(item),
				{ optionId: 'pro', text: 'Lead with Pro' },
				{ id: ADA_USER, tenantId: TENANT }
			)
		).resolves.toEqual({
			routed: 'resumed'
		});
		const sent = mock.requests.find((r) => r.method === 'POST' && r.path === `/inbox/items/${item['id']}/reply`);
		expect(sent?.headers['x-act-as-user']).toBe(adaEw);
		expect(sent?.headers['idempotency-key']).toMatch(/^[a-f0-9]{64}$/);
		expect(mock.inboxItems.get(item['id'] as string)).toMatchObject({ status: 'answered', answerOptionId: 'pro' });
		expect(mock.events.map((e) => e.type)).toContain('inbox.item.answered');

		// What Ever Works answered with is applied (our own answered event is skipped as an echo).
		expect(writes).toHaveLength(1);
		expect(writes[0]).toMatchObject({
			status: InboxItemStatusEnum.ANSWERED,
			recipients: [{ userId: ADA_USER, isRead: true }]
		});

		// An older event still queued (version 1, open) does not undo the reply: the link holds version 2.
		await expect(apply(envelope('inbox.item.state_changed', before))).resolves.toMatchObject({ status: 'skipped' });
		expect(writes).toHaveLength(1);
	});

	it('already decided in Ever Works: the answer there comes back to be recorded', async () => {
		const { mock, ewOrg, adaEw, service, link, gauzyItem } = setup();
		link(EverWorksLinkType.MEMBER, ADA_EMPLOYEE, adaEw);
		const item = mock.addInboxItem(ewOrg.id, {
			recipientUserId: adaEw,
			status: 'answered',
			answeredAt: '2026-10-16T09:05:00.000Z',
			answerText: 'Decided in the app',
			answerOptionId: 'team'
		});
		await expect(service.reply(gauzyItem(item), { optionId: 'pro' }, { id: ADA_USER })).resolves.toEqual({
			routed: 'already-decided',
			response: { text: 'Decided in the app', optionId: 'team', answeredAt: '2026-10-16T09:05:00.000Z' }
		});

		// Archived there without an answer: refused, so the Gauzy claim is released.
		const archived = mock.addInboxItem(ewOrg.id, { recipientUserId: adaEw, status: 'archived' });
		await expect(service.reply(gauzyItem(archived), { optionId: 'pro' }, { id: ADA_USER })).rejects.toBeInstanceOf(
			ConflictException
		);

		// The re-read fails: retryable, never "archived".
		const unknown = mock.addInboxItem(ewOrg.id, {
			recipientUserId: adaEw,
			status: 'answered',
			answeredAt: '2026-10-16T09:05:00.000Z'
		});
		// A non-retryable failure (the client retries 5xx on its own).
		mock.fail({ method: 'GET', path: `/inbox/items/${unknown['id']}`, status: 404 });
		await expect(service.reply(gauzyItem(unknown), { optionId: 'pro' }, { id: ADA_USER })).rejects.toBeInstanceOf(
			ServiceUnavailableException
		);
	});

	it('refuses a reply it cannot send as the user, and an organization that is not connected', async () => {
		const { mock, ewOrg, adaEw, service, gauzyItem } = setup();
		const item = mock.addInboxItem(ewOrg.id, { recipientUserId: adaEw });
		// Ada is not matched to an Ever Works member.
		await expect(service.reply(gauzyItem(item), { optionId: 'pro' }, { id: ADA_USER })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(
			service.reply(gauzyItem(item, { organizationId: 'org-elsewhere' }), { optionId: 'pro' }, { id: ADA_USER })
		).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it('an undone pairing neither acts as the Ever Works member nor receives their items (security review)', async () => {
		const { mock, ewOrg, adaEw, service, link, gauzyItem, envelope, apply, writes, links } = setup();
		link(EverWorksLinkType.MEMBER, ADA_EMPLOYEE, adaEw);
		const item = mock.addInboxItem(ewOrg.id, { recipientUserId: adaEw });
		// The pairing is undone: Ada's Gauzy account no longer speaks for her Ever Works account…
		const pairing = links.find((row) => row.entityType === EverWorksLinkType.MEMBER) as LinkRow;
		pairing.state = EverWorksLinkState.UNLINKED;
		await expect(service.reply(gauzyItem(item), { optionId: 'pro' }, { id: ADA_USER, tenantId: TENANT })).rejects.toBeInstanceOf(ForbiddenException);
		expect(mock.requests.some((r) => r.method === 'POST' && r.path.endsWith('/reply'))).toBe(false);
		// …her read / archive stays in Gauzy (no PATCH, no error)…
		await expect(service.mirrorState(gauzyItem(item), { userId: ADA_USER } as never, { isRead: true, isArchived: true })).resolves.toBeUndefined();
		expect(mock.requests.some((r) => r.method === 'PATCH' && r.path.endsWith('/state'))).toBe(false);
		// …and her Ever Works items are not delivered to it.
		await expect(apply(envelope('inbox.item.created', item))).resolves.toMatchObject({ status: 'deferred' });
		expect(writes).toHaveLength(0);
	});

	it('mirrors read and archive as the recipient (snoozing stays in Gauzy)', async () => {
		const { mock, ewOrg, adaEw, service, link, gauzyItem, writes } = setup();
		link(EverWorksLinkType.MEMBER, ADA_EMPLOYEE, adaEw);
		// Answered in Ever Works (version 2), which Gauzy has not applied yet.
		const item = mock.addInboxItem(ewOrg.id, {
			recipientUserId: adaEw,
			version: 2,
			status: 'answered',
			answeredAt: '2026-10-16T09:05:00.000Z',
			answerOptionId: 'team'
		});
		const recipient = { userId: ADA_USER } as never;

		await service.mirrorState(gauzyItem(item), recipient, { isRead: true, isArchived: true });
		expect(mock.inboxItems.get(item['id'] as string)).toMatchObject({ unread: false, status: 'archived' });
		// The answer behind the newer version reaches Gauzy with the state change.
		expect(writes[writes.length - 1]).toMatchObject({
			status: InboxItemStatusEnum.ANSWERED,
			response: expect.objectContaining({ optionId: 'team' }),
			recipients: [{ userId: ADA_USER, isRead: true, isArchived: true }]
		});

		const before = mock.requests.length;
		await service.mirrorState(gauzyItem(item), recipient, { snoozedUntil: new Date().toISOString() });
		expect(mock.requests.length).toBe(before);
	});
});

describe('Ever Works inbox mapping', () => {
	const base = {
		id: 'ew-1',
		organizationId: 'ew-org',
		version: 3,
		createdAt: '2026-10-16T09:00:00.000Z',
		updatedAt: '2026-10-16T09:05:00.000Z',
		recipientUserId: 'ew-user',
		kind: 'escalation',
		title: 'Pick a vendor',
		body: 'Two quotes',
		options: null,
		sourceType: 'escalation',
		status: 'archived',
		unread: false,
		answeredAt: '2026-10-16T09:05:00.000Z',
		answerText: 'Vendor B',
		answerOptionId: null,
		agentId: null,
		agentRunId: null,
		taskId: null,
		workId: null,
		escalationId: 'esc-1',
		proposalId: null
	};

	it('an answered, archived escalation: ANSWERED with its answer, archived for the recipient, high priority', () => {
		const input = inboxUpsertOf(
			base,
			{ tenantId: 't', organizationId: 'o', recipientUserId: 'u' },
			{ taskId: null, projectId: null, agentEmployeeId: null }
		);
		expect(input).toMatchObject({
			kind: InboxItemKindEnum.ESCALATION,
			status: InboxItemStatusEnum.ANSWERED,
			priority: 'high',
			response: { text: 'Vendor B', optionId: null, answeredByUserId: 'u', routed: 'ever_works' },
			recipients: [{ userId: 'u', isRead: true, isArchived: true }],
			metadata: {
				everWorks: expect.objectContaining({ escalationId: 'esc-1', sourceType: 'escalation', version: 3 })
			}
		});
	});

	it('a deleted item is cancelled and archived; an unknown kind arrives as a notice', () => {
		const deleted = inboxUpsertOf(
			{ ...base, kind: 'reminder', answeredAt: null },
			{ tenantId: 't', organizationId: 'o', recipientUserId: 'u' },
			{ taskId: null, projectId: null, agentEmployeeId: null },
			{ deleted: true }
		);
		expect(deleted).toMatchObject({
			kind: InboxItemKindEnum.NOTICE,
			status: InboxItemStatusEnum.CANCELLED,
			recipients: [{ isArchived: true }]
		});
	});

	it('maps a recipient change onto the Ever Works state', () => {
		expect(everWorksStateOf({ isRead: true })).toEqual({ unread: false });
		expect(everWorksStateOf({ isArchived: false })).toEqual({ archived: false });
		expect(everWorksStateOf({})).toBeNull();
	});
});
