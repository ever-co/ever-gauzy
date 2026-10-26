/**
 * The Inbox email hand-off seam (plan 04 §5.3 step 7, P4c): listeners are told about every delivered message and can
 * never fail the delivery; `read` answers a stored, delivered inbound message of the tenant with its addresses,
 * threading headers and (non-inline) attachment metadata, and nothing for anything else.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, hasPermission: () => false }
	};
});

import 'reflect-metadata';
import { InboxEmailDirectionEnum, InboxEmailStatusEnum } from '@gauzy/contracts';
import { InboxEmail } from '../entities/inbox-email.entity';
import { InboxEmailAttachment } from '../entities/inbox-email-attachment.entity';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { InboxEmailHandoffs } from './inbox-email-handoffs';

type Row = Record<string, any>;

function setup(email: Row | null) {
	const mailbox: Row = {
		id: 'mb1',
		tenantId: 't1',
		address: 'support.acme@inbox.example.test',
		settings: JSON.stringify({ everWorksAgentId: 'ew-agent-1' })
	};
	const attachments: Row[] = [
		{
			emailId: 'e1',
			tenantId: 't1',
			filename: 'receipt.pdf',
			contentType: 'application/pdf',
			size: 1200,
			isInline: false
		},
		{ emailId: 'e1', tenantId: 't1', filename: 'logo.png', contentType: 'image/png', size: 300, isInline: true }
	];
	const repositories = new Map<unknown, Row>([
		[
			InboxEmail,
			{
				findOne: async ({ where }: { where: Row }) =>
					email && email['id'] === where['id'] && email['tenantId'] === where['tenantId'] ? email : null,
				// The recovery read: the stand-in answers the stored message of the tenant when it is delivered.
				find: async ({ where }: { where: Row }) =>
					email && email['tenantId'] === where['tenantId'] && email['status'] === where['status']
						? [email]
						: []
			}
		],
		[
			InboxMailbox,
			{
				findOne: async ({ where }: { where: Row }) =>
					mailbox['id'] === where['id'] && mailbox['tenantId'] === where['tenantId'] ? mailbox : null,
				find: async ({ where }: { where: Row }) => (mailbox['tenantId'] === where['tenantId'] ? [mailbox] : [])
			}
		],
		[
			InboxEmailAttachment,
			{
				find: async ({ where }: { where: Row }) =>
					attachments.filter((a) => a['emailId'] === where['emailId'] && a['tenantId'] === where['tenantId'])
			}
		]
	]);
	const dataSource = { getRepository: (target: unknown) => repositories.get(target) };
	return { handoffs: new InboxEmailHandoffs(dataSource as never), mailbox };
}

const stored: Row = {
	id: 'e1',
	tenantId: 't1',
	organizationId: 'o1',
	mailboxId: 'mb1',
	inboxItemId: 'item-1',
	direction: InboxEmailDirectionEnum.IN,
	status: InboxEmailStatusEnum.PROCESSED,
	sender: JSON.stringify({ address: 'ada@example.com', name: 'Ada' }),
	toAddresses: JSON.stringify([{ address: 'support.acme@inbox.example.test' }]),
	ccAddresses: JSON.stringify([{ address: 'ops@example.com' }, { name: 'no address' }]),
	subject: 'Refund',
	textBody: 'Hi',
	htmlSanitized: '<p>Hi</p>',
	messageId: '<m1@example.com>',
	inReplyTo: '<m0@example.com>',
	referenceIds: JSON.stringify(['<m0@example.com>', 7]),
	receivedAt: new Date('2026-10-17T08:00:00.000Z')
};

describe('InboxEmailHandoffs', () => {
	it('tells every listener about a delivered message; a failing listener fails neither the others nor the delivery', async () => {
		const { handoffs, mailbox } = setup(stored);
		const seen: unknown[] = [];
		handoffs.register({ id: 'broken', delivered: async () => Promise.reject(new Error('down')) });
		handoffs.register({ id: 'bridge', delivered: async (email) => void seen.push(email) });
		await expect(handoffs.delivered(stored as never, mailbox as never, 'item-1')).resolves.toBeUndefined();
		expect(seen).toEqual([
			{
				tenantId: 't1',
				organizationId: 'o1',
				mailboxId: 'mb1',
				mailboxSettings: { everWorksAgentId: 'ew-agent-1' },
				emailId: 'e1',
				inboxItemId: 'item-1'
			}
		]);
		handoffs.unregister('bridge');
		await handoffs.delivered(stored as never, mailbox as never, null);
		expect(seen).toHaveLength(1);
	});

	it('reads a delivered inbound message for its hand-off: addresses, threading, non-inline attachments', async () => {
		const { handoffs } = setup(stored);
		expect(await handoffs.read('t1', 'e1')).toEqual({
			tenantId: 't1',
			organizationId: 'o1',
			mailboxId: 'mb1',
			mailboxAddress: 'support.acme@inbox.example.test',
			mailboxSettings: { everWorksAgentId: 'ew-agent-1' },
			emailId: 'e1',
			inboxItemId: 'item-1',
			from: 'ada@example.com',
			to: ['support.acme@inbox.example.test'],
			cc: ['ops@example.com'],
			subject: 'Refund',
			text: 'Hi',
			html: '<p>Hi</p>',
			messageId: '<m1@example.com>',
			inReplyTo: '<m0@example.com>',
			references: ['<m0@example.com>'],
			attachments: [{ filename: 'receipt.pdf', contentType: 'application/pdf', size: 1200 }],
			receivedAt: new Date('2026-10-17T08:00:00.000Z')
		});
	});

	it('lists the delivered messages of a tenant since a time, with their mailbox settings (the recovery sweep)', async () => {
		const { handoffs } = setup(stored);
		expect(await handoffs.deliveredSince('t1', new Date(0), 100)).toEqual([
			{
				tenantId: 't1',
				organizationId: 'o1',
				mailboxId: 'mb1',
				mailboxSettings: { everWorksAgentId: 'ew-agent-1' },
				emailId: 'e1',
				inboxItemId: 'item-1'
			}
		]);
		expect(await handoffs.deliveredSince('t2', new Date(0), 100)).toEqual([]);
		expect(
			await setup({ ...stored, status: InboxEmailStatusEnum.QUARANTINED }).handoffs.deliveredSince(
				't1',
				new Date(0),
				100
			)
		).toEqual([]);
	});

	it('answers nothing for another tenant, a message not delivered (quarantined, failed), an outbound or a deleted one', async () => {
		expect(await setup(stored).handoffs.read('t2', 'e1')).toBeNull();
		expect(
			await setup({ ...stored, status: InboxEmailStatusEnum.QUARANTINED }).handoffs.read('t1', 'e1')
		).toBeNull();
		expect(await setup({ ...stored, status: InboxEmailStatusEnum.FAILED }).handoffs.read('t1', 'e1')).toBeNull();
		expect(await setup({ ...stored, direction: InboxEmailDirectionEnum.OUT }).handoffs.read('t1', 'e1')).toBeNull();
		expect(await setup({ ...stored, deletedAt: new Date() }).handoffs.read('t1', 'e1')).toBeNull();
		expect(await setup(null).handoffs.read('t1', 'e1')).toBeNull();
	});
});
