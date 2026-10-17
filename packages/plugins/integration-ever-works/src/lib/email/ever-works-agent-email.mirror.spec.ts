/**
 * G-P4-6 part 2: the read-only mirror of Ever Works agent mail (plan 04 §6, CR-11). `email.message.*` events become
 * Gauzy Inbox EMAIL items of the paired owner under "Ever Works — <agent>" only where the `agentEmail` direction is on;
 * a message Gauzy handed off itself is skipped; an unpaired owner waits; an omitted body is read from Ever Works.
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
import { InboxItemKindEnum, InboxItemSourceEnum } from '@gauzy/contracts';
import { Employee, User } from '@gauzy/core';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksStaleLinkError } from '../sync/links/ever-works-link.service';
import { EVER_WORKS_EMAIL_EXTERNAL_SOURCE, EverWorksAgentEmailMirror } from './ever-works-agent-email.mirror';

type Row = Record<string, any>;

const message = (over: Row = {}) => ({
	id: 'ew-mail-1',
	organizationId: 'ew-org-1',
	version: 3,
	createdAt: '2026-10-17T08:00:00.000Z',
	updatedAt: '2026-10-17T08:00:05.000Z',
	ownerUserId: 'ew-ann',
	agentId: 'ew-agent-1',
	taskId: 'ew-task-1',
	conversationId: null,
	direction: 'outbound',
	status: 'sent',
	deliveryStatus: 'delivered',
	from: 'builder@agents.example.test',
	to: ['ada@example.com'],
	cc: [],
	subject: 'Your refund',
	text: 'Done: refunded.',
	html: null,
	messageId: '<x@y>',
	inReplyTo: null,
	references: [],
	attachments: [],
	sentAt: '2026-10-17T08:00:04.000Z',
	receivedAt: null,
	webUrl: null,
	...over
});
const envelope = (data: Row, version = 3) => ({
	id: `evt-${version}`,
	seq: String(version),
	type: 'email.message.sent',
	version: 1,
	occurredAt: new Date().toISOString(),
	tenantId: 'ewt',
	organizationId: 'ew-org-1',
	aggregate: { type: 'email_message', id: data['id'] ?? 'ew-mail-1', version },
	actor: { type: 'agent', id: 'ew-agent-1' },
	data
});

function setup(options: { direction?: string; inbox?: boolean } = {}) {
	const links: Row[] = [
		{
			integrationTenantId: 'm1',
			entityType: EverWorksLinkType.MEMBER,
			ewId: 'ew-ann',
			gauzyId: 'emp-ann',
			state: 'ok'
		},
		{
			integrationTenantId: 'm1',
			entityType: EverWorksLinkType.AGENT,
			ewId: 'ew-agent-1',
			gauzyId: 'emp-agent',
			state: 'ok',
			snapshot: JSON.stringify({ name: 'Builder' })
		},
		{
			integrationTenantId: 'm1',
			entityType: EverWorksLinkType.TASK,
			ewId: 'ew-task-1',
			gauzyId: 'task-1',
			state: 'ok'
		}
	];
	const find = (type: string, ewId: string) =>
		links.find((l) => l['entityType'] === type && l['ewId'] === ewId) ?? null;
	const linkService = {
		byEw: async (_m: string, type: string, ewId: string) => find(type, ewId),
		snapshot: (link: Row | null) => (link?.['snapshot'] ? JSON.parse(link['snapshot']) : {}),
		record: jest.fn(async (input: Row) => {
			const existing = find(input['entityType'], input['ewId']);
			if (existing) Object.assign(existing, input);
			else links.push({ ...input, state: 'ok' });
			return input;
		})
	};
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: 'm1',
		connection: { id: 'c1' },
		everWorksOrganizationSlug: 'acme',
		directions: { agentEmail: options.direction ?? 'ew_to_gauzy' },
		isEnabled: true
	};
	const employees: Row[] = [{ id: 'emp-ann', userId: 'user-ann', tenantId: 't1', organizationId: 'o1' }];
	const users: Row[] = [{ id: 'user-ann', tenantId: 't1' }];
	const dataSource = {
		getRepository: (target: unknown) => ({
			findOne: async ({ where }: { where: Row }) => {
				const rows = target === Employee ? employees : target === User ? users : [];
				return rows.find((row) => row['id'] === where['id'] && row['tenantId'] === where['tenantId']) ?? null;
			}
		})
	};
	const upserts: Row[] = [];
	const inbox = {
		upsertExternal: jest.fn(async (input: Row) => {
			upserts.push(input);
			return {
				item: { id: 'item-1' },
				created: upserts.length === 1,
				recipientUserIds: input['recipients'].map((r: Row) => r['userId'])
			};
		}),
		create: jest.fn()
	};
	const request = jest.fn(async () => message({ text: 'The full body.' }));
	const mirror = new EverWorksAgentEmailMirror(
		dataSource as never,
		{ forEverWorksOrganization: async () => context } as never,
		linkService as never,
		{ client: () => ({ request }) } as never,
		(options.inbox === false ? undefined : inbox) as never
	);
	return { mirror, links, upserts, inbox, request, users, linkService };
}

const applyContext = { connection: { id: 'c1' }, event: {}, organizationId: 'o1' } as never;

describe('EverWorksAgentEmailMirror — EW agent mail as read-only Gauzy Inbox copies', () => {
	it('mirrors a message as an EMAIL item of the paired owner, under "Ever Works — <agent>", linked to the agent and the task', async () => {
		const { mirror, upserts, links } = setup();
		expect(await mirror.apply(envelope(message()) as never, applyContext)).toMatchObject({ status: 'applied' });
		expect(upserts[0]).toMatchObject({
			tenantId: 't1',
			organizationId: 'o1',
			kind: InboxItemKindEnum.EMAIL,
			source: InboxItemSourceEnum.EVER_WORKS,
			externalSource: EVER_WORKS_EMAIL_EXTERNAL_SOURCE,
			externalId: 'ew-mail-1',
			title: 'Your refund',
			body: 'Done: refunded.',
			taskId: 'task-1',
			agentEmployeeId: 'emp-agent',
			metadata: {
				mailbox: 'Ever Works — Builder',
				readOnly: true,
				from: 'builder@agents.example.test',
				direction: 'outbound'
			},
			recipients: [{ userId: 'user-ann' }]
		});
		expect(links.find((l) => l['entityType'] === EverWorksLinkType.AGENT_EMAIL_MIRROR)).toMatchObject({
			gauzyId: 'item-1',
			ewId: 'ew-mail-1',
			ewVersion: 3
		});
		// The same version again (a feed replay) is skipped; a newer one updates the copy.
		expect(await mirror.apply(envelope(message()) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(await mirror.apply(envelope(message({ status: 'bounced' }), 4) as never, applyContext)).toMatchObject({
			status: 'applied'
		});
		expect(upserts).toHaveLength(2);
	});

	it('is off by default (the agentEmail direction) and then skips, never defers', async () => {
		const { mirror, upserts } = setup({ direction: 'off' });
		expect(await mirror.apply(envelope(message()) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(upserts).toHaveLength(0);
	});

	it('skips a message Gauzy handed to the agent itself (it is in the Gauzy Inbox already)', async () => {
		const { mirror, links, upserts } = setup();
		links.push({
			integrationTenantId: 'm1',
			entityType: EverWorksLinkType.AGENT_EMAIL,
			ewId: 'ew-mail-1',
			gauzyId: 'inbox-email-1',
			state: 'ok'
		});
		expect(await mirror.apply(envelope(message({ direction: 'inbound' })) as never, applyContext)).toMatchObject({
			status: 'skipped'
		});
		expect(upserts).toHaveLength(0);
	});

	it('an owner not paired yet waits (deferred); an undone agent pairing leaves the agent link out', async () => {
		const { mirror, links, upserts } = setup();
		expect(await mirror.apply(envelope(message({ ownerUserId: 'ew-bob' })) as never, applyContext)).toMatchObject({
			status: 'deferred'
		});
		(links.find((l) => l['entityType'] === EverWorksLinkType.AGENT) as Row)['state'] = EverWorksLinkState.UNLINKED;
		expect(await mirror.apply(envelope(message()) as never, applyContext)).toMatchObject({ status: 'applied' });
		expect(upserts[0]).toMatchObject({ agentEmployeeId: null, metadata: { mailbox: 'Ever Works — agent' } });
	});

	it('never addresses a copy to a user of another tenant (the paired employee’s user is checked)', async () => {
		const { mirror, users, upserts } = setup();
		users[0]['tenantId'] = 't9';
		expect(await mirror.apply(envelope(message()) as never, applyContext)).toMatchObject({ status: 'deferred' });
		expect(upserts).toHaveLength(0);
	});

	it('a newer version applied meanwhile by another process: the copy is rewritten from Ever Works and the event skipped', async () => {
		const { mirror, upserts, request, linkService } = setup();
		linkService.record.mockRejectedValueOnce(new EverWorksStaleLinkError('l1' as never, 'ew-mail-1', 9, 3));
		request.mockResolvedValueOnce(message({ version: 9, subject: 'Your refund (final)' }) as never);
		expect(await mirror.apply(envelope(message()) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(request).toHaveBeenCalledWith('GET', '/email/messages/ew-mail-1');
		expect(upserts.map((row) => row['title'])).toEqual(['Your refund', 'Your refund (final)']);
	});

	it('reads an omitted body (over 256 KiB) from GET /email/messages/:id', async () => {
		const { mirror, upserts, request } = setup();
		await mirror.apply(envelope(message({ text: null, bodyOmitted: true })) as never, applyContext);
		expect(request).toHaveBeenCalledWith('GET', '/email/messages/ew-mail-1');
		expect(upserts[0]).toMatchObject({ body: 'The full body.' });
	});

	it('without the Gauzy Inbox: skipped when it is off, deferred when it is on but not loaded here', async () => {
		const saved = process.env['GAUZY_INBOX_ENABLED'];
		try {
			delete process.env['GAUZY_INBOX_ENABLED'];
			expect(
				await setup({ inbox: false }).mirror.apply(envelope(message()) as never, applyContext)
			).toMatchObject({ status: 'skipped' });
			process.env['GAUZY_INBOX_ENABLED'] = 'true';
			expect(
				await setup({ inbox: false }).mirror.apply(envelope(message()) as never, applyContext)
			).toMatchObject({ status: 'deferred' });
		} finally {
			if (saved === undefined) delete process.env['GAUZY_INBOX_ENABLED'];
			else process.env['GAUZY_INBOX_ENABLED'] = saved;
		}
	});
});
