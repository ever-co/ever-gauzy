/**
 * G-P4-6 agent email bridge, Gauzy → Ever Works (plan 04 §6, CR-11) against in-memory stand-ins and the mock Ever Works
 * API (real client): a mailbox routed to an agent queues each delivered message; the push hands it to the agent once
 * (`POST /email/inbound`, idempotent per message) and links it; a key without `email:write`, an agent not paired here
 * and a message without a sender are refused and logged; Ever Works' own refusal (no inbound assignment) is terminal.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null },
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'Employee',
				'EmployeeNotification',
				'User',
				'UserOrganization',
				'IntegrationTenant',
				'IntegrationSetting'
			].map((name) => [name, entity(name)])
		)
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { IInboxEmailHandoff } from '@gauzy/contracts';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MockEverWorksEmail } from '../testing/mock-ever-works.email';
import { MOCK_PRESET_SCOPES, MockEverWorksServer } from '../testing/mock-ever-works.server';
import { agentOfMailbox, EverWorksAgentEmailService, inboundEmailBody } from './ever-works-agent-email.service';

type Row = Record<string, any>;

const EMAIL_ID = '7f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

function message(over: Partial<IInboxEmailHandoff> = {}): IInboxEmailHandoff {
	return {
		tenantId: 't1',
		organizationId: 'o1',
		mailboxId: 'mb1',
		mailboxAddress: 'support.acme@inbox.example.test',
		mailboxSettings: { everWorksAgentId: 'ew-agent-1' },
		emailId: EMAIL_ID,
		inboxItemId: 'item-1',
		from: 'ada@example.com',
		to: ['support.acme@inbox.example.test'],
		cc: [],
		subject: 'Refund for order 1042',
		text: 'Hi, can I get a refund for order 1042?',
		html: null,
		messageId: 'CAF1x2y3@mail.example.com',
		inReplyTo: null,
		references: [],
		attachments: [{ filename: 'receipt.pdf', contentType: 'application/pdf', size: 1200 }],
		receivedAt: '2026-10-17T08:00:00.000Z',
		...over
	};
}

function setup(options: { scopes?: string[]; stored?: IInboxEmailHandoff | null; handoffs?: boolean } = {}) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({
		organizations: [ewOrg],
		scopes: options.scopes ?? [...MOCK_PRESET_SCOPES, 'email:write']
	});
	const email = new MockEverWorksEmail(mock);
	mock.addAgent(ewOrg.id, { id: 'ew-agent-1' });
	email.inboundAgents.add('ew-agent-1');
	const client = new EverWorksClient({
		apiBaseUrl: 'https://api.example.test/api',
		apiKey: key,
		transport: mock.transport(),
		connectionId: 'c1',
		scopeSlug: 'acme',
		retry: { maxAttempts: 1 },
		sleep: async () => undefined
	});
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: 'm1',
		mapping: { id: 'm1', settings: [] },
		connection: { id: 'c1', scopes: JSON.stringify(options.scopes ?? ['email:read', 'email:write']) },
		everWorksOrganizationId: ewOrg.id,
		everWorksOrganizationSlug: 'acme',
		directions: {},
		isEnabled: true
	};
	const links: Row[] = [
		{
			integrationTenantId: 'm1',
			entityType: EverWorksLinkType.AGENT,
			gauzyId: 'g-agent-employee-1',
			ewId: 'ew-agent-1',
			state: 'ok'
		}
	];
	const find = (type: string, field: 'ewId' | 'gauzyId', value: string) =>
		links.find((l) => l['integrationTenantId'] === 'm1' && l['entityType'] === type && l[field] === value) ?? null;
	const linkService = {
		byEw: async (_m: string, type: string, ewId: string) => find(type, 'ewId', ewId),
		byGauzy: async (_m: string, type: string, gauzyId: string) => find(type, 'gauzyId', gauzyId),
		record: jest.fn(async (input: Row) => {
			links.push({ ...input, state: 'ok' });
			return input;
		})
	};
	const queue = { enqueue: jest.fn(async () => true) };
	const log = { write: jest.fn(async () => undefined) };
	const registry = {
		register: jest.fn(),
		unregister: jest.fn(),
		read: jest.fn(async () => (options.stored === undefined ? message() : options.stored)),
		deliveredSince: jest.fn(async () => [] as Row[])
	};
	// The outbound changes the recovery sweep looks at (any state).
	const changes: Row[] = [];
	const dataSource = {
		getRepository: () => ({
			find: async ({ where }: { where: Row }) =>
				changes.filter((row) => (where['gauzyId'] as { value: string[] }).value.includes(row['gauzyId']))
		})
	};
	const service = new EverWorksAgentEmailService(
		dataSource as never,
		{ forOrganization: async () => context, forConnection: async () => [context] } as never,
		{ client: () => client } as never,
		linkService as never,
		queue as never,
		log as never,
		(options.handoffs === false ? undefined : registry) as never
	);
	const change = { id: 'ch1', tenantId: 't1', organizationId: 'o1', gauzyId: EMAIL_ID, op: 'upsert' } as never;
	const pushContext = { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never;
	return { service, mock, email, links, linkService, queue, log, registry, change, pushContext, changes };
}

describe('EverWorksAgentEmailService — a Gauzy mailbox routed to an Ever Works agent', () => {
	it('registers its hand-off listener with the Inbox email features, and only when they are loaded', () => {
		const loaded = setup();
		loaded.service.onModuleInit();
		expect(loaded.registry.register).toHaveBeenCalledWith(loaded.service.listener);
		loaded.service.onModuleDestroy();
		expect(loaded.registry.unregister).toHaveBeenCalledWith('ever-works-agent-email');
		const off = setup({ handoffs: false });
		expect(() => off.service.onModuleInit()).not.toThrow();
	});

	it('queues a durable hand-off for a routed mailbox only', async () => {
		const { service, queue } = setup();
		await service.delivered({
			tenantId: 't1',
			organizationId: 'o1',
			mailboxId: 'mb1',
			mailboxSettings: { everWorksAgentId: 'ew-agent-1' },
			emailId: EMAIL_ID,
			inboxItemId: null
		});
		expect(queue.enqueue).toHaveBeenCalledWith({
			tenantId: 't1',
			organizationId: 'o1',
			entityType: EverWorksLinkType.AGENT_EMAIL,
			gauzyId: EMAIL_ID
		});
		await service.delivered({
			tenantId: 't1',
			organizationId: 'o1',
			mailboxId: 'mb2',
			mailboxSettings: { other: true },
			emailId: 'e2',
			inboxItemId: null
		});
		await service.delivered({
			tenantId: 't1',
			organizationId: 'o1',
			mailboxId: 'mb3',
			mailboxSettings: null,
			emailId: 'e3',
			inboxItemId: null
		});
		expect(queue.enqueue).toHaveBeenCalledTimes(1);
	});

	it('hands the message to the agent once (POST /email/inbound, idempotent), links it and logs the dispatch', async () => {
		const { service, email, links, change, pushContext, log } = setup();
		expect(await service.push(change, pushContext)).toMatchObject({ status: 'pushed' });
		expect(email.received).toHaveLength(1);
		expect(email.received[0]).toMatchObject({
			agentId: 'ew-agent-1',
			message: {
				from: 'ada@example.com',
				to: ['support.acme@inbox.example.test'],
				subject: 'Refund for order 1042',
				messageId: 'CAF1x2y3@mail.example.com',
				attachments: [{ filename: 'receipt.pdf', contentType: 'application/pdf', url: null }]
			}
		});
		const link = links.find((l) => l['entityType'] === EverWorksLinkType.AGENT_EMAIL);
		expect(link).toMatchObject({ gauzyId: EMAIL_ID, ewId: [...email.messages.keys()][0], direction: 'outbound' });
		expect(link?.['snapshot']).toMatchObject({ agentId: 'ew-agent-1', dispatch: { mode: 'task-spawn' } });
		expect(log.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent_email', status: 'ok' }));
		// A second push of the same message (a re-queued change) sends nothing.
		expect(await service.push(change, pushContext)).toMatchObject({
			status: 'skipped',
			message: 'already handed to Ever Works'
		});
		expect(email.received).toHaveLength(1);
	});

	it('the mailbox may name the agent by its agent employee in Gauzy', async () => {
		const { service, email, change, pushContext } = setup({
			stored: message({ mailboxSettings: { everWorksAgentId: 'g-agent-employee-1' } })
		});
		expect(await service.push(change, pushContext)).toMatchObject({ status: 'pushed' });
		expect(email.received[0]).toMatchObject({ agentId: 'ew-agent-1' });
	});

	it('refuses and logs what no retry changes: no email:write, an agent not paired here, no sender, a mailbox no longer routed', async () => {
		const noScope = setup({ scopes: ['email:read'] });
		expect(await noScope.service.push(noScope.change, noScope.pushContext)).toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('email:write')
		});
		expect(noScope.log.write).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'agent_email', status: 'skipped' })
		);
		expect(noScope.email.received).toHaveLength(0);

		const stranger = setup({ stored: message({ mailboxSettings: { everWorksAgentId: 'ew-agent-unknown' } }) });
		expect(await stranger.service.push(stranger.change, stranger.pushContext)).toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('no Ever Works agent paired')
		});

		const unlinked = setup();
		unlinked.links[0]['state'] = EverWorksLinkState.UNLINKED;
		expect(await unlinked.service.push(unlinked.change, unlinked.pushContext)).toMatchObject({ status: 'skipped' });

		const anonymous = setup({ stored: message({ from: null }) });
		expect(await anonymous.service.push(anonymous.change, anonymous.pushContext)).toMatchObject({
			status: 'skipped',
			message: 'the message has no sender address'
		});

		const notRouted = setup({ stored: message({ mailboxSettings: {} }) });
		expect(await notRouted.service.push(notRouted.change, notRouted.pushContext)).toMatchObject({
			status: 'skipped'
		});

		const gone = setup({ stored: null });
		expect(await gone.service.push(gone.change, gone.pushContext)).toMatchObject({ status: 'skipped' });
	});

	it("Ever Works' refusal (the agent has no inbound assignment) reaches the pusher as a terminal 422", async () => {
		const { service, email, change, pushContext, links } = setup();
		email.inboundAgents.clear();
		const refused = await service.push(change, pushContext).catch((error) => error);
		expect(refused).toBeInstanceOf(EverWorksApiError);
		expect(refused).toMatchObject({ status: 422, code: 'domain_rule' });
		expect(refused.retryable).toBe(false);
		expect(links.some((l) => l['entityType'] === EverWorksLinkType.AGENT_EMAIL)).toBe(false);
	});

	it('the recovery sweep queues a routed message whose notice was missed, and nothing already queued or handed off', async () => {
		const { service, registry, queue, links, changes } = setup();
		const notice = (emailId: string, settings: Row | null = { everWorksAgentId: 'ew-agent-1' }) => ({
			tenantId: 't1',
			organizationId: 'o1',
			mailboxId: 'mb1',
			mailboxSettings: settings,
			emailId,
			inboxItemId: null
		});
		registry.deliveredSince.mockResolvedValue([
			notice('missed'),
			notice('queued'),
			notice('handed-off'),
			notice('not-routed', {}),
			{ ...notice('other-org'), organizationId: 'o9' }
		]);
		changes.push({ gauzyId: 'queued' });
		links.push({
			integrationTenantId: 'm1',
			entityType: EverWorksLinkType.AGENT_EMAIL,
			gauzyId: 'handed-off',
			ewId: 'ew-mail-9',
			state: 'ok'
		});
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(registry.deliveredSince).toHaveBeenCalledWith('t1', expect.any(Date), 500);
		expect(queue.enqueue).toHaveBeenCalledTimes(1);
		expect(queue.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({ gauzyId: 'missed', entityType: EverWorksLinkType.AGENT_EMAIL })
		);
	});

	it('defers where the Inbox email features are not loaded (another process takes it)', async () => {
		const { service, change, pushContext } = setup({ handoffs: false });
		expect(await service.push(change, pushContext)).toMatchObject({ status: 'deferred' });
	});

	it('the InboundEmail body keeps the contract limits and falls back to the mailbox address', () => {
		expect(agentOfMailbox({ everWorksAgentId: '  ew-agent-1 ' })).toBe('ew-agent-1');
		expect(agentOfMailbox({ everWorksAgentId: 42 })).toBeNull();
		const body = inboundEmailBody(
			'ew-agent-1',
			message({
				to: [],
				subject: 's'.repeat(1200),
				references: Array.from({ length: 150 }, (_, n) => `<r${n}@x>`),
				attachments: Array.from({ length: 25 }, (_, n) => ({
					filename: `f${n}.txt`,
					contentType: '',
					size: null
				}))
			})
		);
		expect(body?.message.to).toEqual(['support.acme@inbox.example.test']);
		expect(body?.message.subject).toHaveLength(998);
		expect(body?.message.references).toHaveLength(100);
		expect(body?.message.attachments).toHaveLength(20);
		expect(body?.message.attachments?.[0]).toEqual({
			filename: 'f0.txt',
			contentType: 'application/octet-stream',
			url: null
		});
		expect(inboundEmailBody('ew-agent-1', message({ from: 'x' }))).toBeNull();
	});
});
