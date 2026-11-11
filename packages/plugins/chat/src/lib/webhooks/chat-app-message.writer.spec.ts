/**
 * `ChatAppMessageWriter.post`: an app message moves the same counters and appends the same facts as a member's send
 * (message count, mention counts, `chat_message.created` to every member, each member's state after the commit), with
 * no employee author, the webhook's name and icon, and a broadcast only from a webhook allowed to broadcast.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application).
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentUser: () => null, hasPermission: () => false }
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {
		return undefined;
	}) });
});

import { DataSource } from 'typeorm';
import { ChatMessageKindEnum } from '@gauzy/contracts';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatWebhook } from '../entities/chat-webhook.entity';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService } from '../services/chat-access.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';

const E1 = '7b1a3c0e-0000-4000-8000-000000000001';
const E2 = '7b1a3c0e-0000-4000-8000-000000000002';

function setup(options: { existing?: Record<string, unknown> | null; stored?: Record<string, unknown> | null; archived?: boolean; claimed?: boolean; deletedMeanwhile?: boolean } = {}) {
	const members = [
		{ id: 'mb1', employeeId: E1, userId: 'u1', readCount: 3, mentionCount: 0, notifyLevel: 'all', isFavorite: false, conversationId: 'c1', tenantId: 'ten' },
		{ id: 'mb2', employeeId: E2, userId: 'u2', readCount: 1, mentionCount: 2, notifyLevel: 'all', isFavorite: false, conversationId: 'c1', tenantId: 'ten' }
	];
	const repositories = {
		ChatMessage: {
			create: jest.fn((row: Record<string, unknown>) => row),
			save: jest.fn(async (row: Record<string, unknown>) => ({ ...row, id: 'm1' })),
			findOne: jest.fn(async (query: { where: Record<string, unknown> }) =>
				'nonce' in query.where ? (options.existing ?? null) : options.stored === undefined ? { id: 'm1', conversationId: 'c1', tenantId: 'ten', kind: 'app', body: 'old' } : options.stored
			),
			update: jest.fn(async () => ({ affected: options.deletedMeanwhile ? 0 : 1 }))
		},
		ChatConversation: {
			increment: jest.fn(async () => ({ affected: 1 })),
			update: jest.fn(async () => ({ affected: 1 })),
			findOne: jest.fn(async () => ({ id: 'c1', archivedAt: options.archived ? new Date() : null }))
		},
		ChatMember: { increment: jest.fn(async () => ({ affected: 1 })) },
		ChatWebhookInteraction: { update: jest.fn(async () => ({ affected: options.claimed ? 0 : 1 })) }
	};
	const manager = { getRepository: (entity: { name?: string }) => (repositories as Record<string, unknown>)[entity?.name as string] };
	const dataSource = {
		options: { type: 'postgres' },
		transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => work(manager)),
		getRepository: (entity: { name?: string }) => (repositories as Record<string, unknown>)[entity?.name as string]
	} as unknown as DataSource;
	const access = { members: jest.fn(async () => members) } as unknown as ChatAccessService;
	const realtime = {
		messageFact: jest.fn((name: string, message: unknown, recipients: string[]) => ({ name, message, recipients })),
		memberStateFact: jest.fn((member: unknown) => ({ name: 'chat_member.state_changed', member })),
		append: jest.fn(async (_manager: unknown, fact: { name: string }) => ({ name: fact.name, data: {} })),
		publish: jest.fn(async (fact: { name: string }) => ({ name: fact.name, data: {} }))
	} as unknown as ChatRealtime & { messageFact: jest.Mock; memberStateFact: jest.Mock; publish: jest.Mock };
	const writer = new ChatAppMessageWriter(dataSource, access, realtime);
	return { writer, repositories, realtime };
}

const conversation = { id: 'c1', tenantId: 'ten', organizationId: 'org', kind: 'channel', messageCount: 3 } as unknown as ChatConversation;
const webhook = (canBroadcast: boolean) => ({ id: 'w1', tenantId: 'ten', organizationId: 'org', name: 'Deploys', iconUrl: 'https://cdn.example.com/ci.png', canBroadcast }) as unknown as ChatWebhook;

describe('ChatAppMessageWriter', () => {
	it('writes an app message with no employee author and the webhook name and icon, and moves the counters', async () => {
		const { writer, repositories, realtime } = setup();
		const blocks = [{ type: 'header', text: 'Build 412' }];
		const post = await writer.post(webhook(false), conversation, { body: `Build 412 passed, <@${E2}>`, blocks: blocks as never, nonce: 'n-1' });
		expect(post.duplicate).toBe(false);
		const row = repositories.ChatMessage.create.mock.calls[0][0] as Record<string, unknown>;
		expect(row).toEqual(
			expect.objectContaining({
				kind: ChatMessageKindEnum.APP,
				authorEmployeeId: undefined,
				authorUserId: undefined,
				webhookId: 'w1',
				appName: 'Deploys',
				appIconUrl: 'https://cdn.example.com/ci.png',
				blocks: JSON.stringify(blocks),
				nonce: 'n-1',
				mentionEmployeeIds: JSON.stringify([E2]),
				mentionsChannel: false
			})
		);
		expect(repositories.ChatConversation.increment).toHaveBeenCalledWith({ id: 'c1' }, 'messageCount', 1);
		// Only the mentioned member's badge moves; nobody's read position does (the author is no member).
		expect(repositories.ChatMember.increment).toHaveBeenCalledTimes(1);
		expect(realtime.messageFact).toHaveBeenCalledWith('chat_message.created', expect.anything(), ['u1', 'u2']);
		expect(realtime.publish).toHaveBeenCalledTimes(2);
		expect(realtime.memberStateFact.mock.calls.map(([member]) => (member as { mentionCount: number }).mentionCount)).toEqual([0, 3]);
	});

	it('counts @channel for everyone only from a webhook allowed to broadcast', async () => {
		const quiet = setup();
		await quiet.writer.post(webhook(false), conversation, { body: '<!channel> deploy', blocks: [], nonce: null });
		expect((quiet.repositories.ChatMessage.create.mock.calls[0][0] as Record<string, unknown>)['mentionsChannel']).toBe(false);
		expect(quiet.repositories.ChatMember.increment).not.toHaveBeenCalled();
		const loud = setup();
		await loud.writer.post(webhook(true), conversation, { body: '<!channel> deploy', blocks: [], nonce: null });
		expect((loud.repositories.ChatMessage.create.mock.calls[0][0] as Record<string, unknown>)['mentionsChannel']).toBe(true);
		expect(loud.repositories.ChatMember.increment).toHaveBeenCalledWith({ id: expect.anything() }, 'mentionCount', 1);
	});

	it('answers the first post for a nonce posted before, and writes nothing', async () => {
		const { writer, repositories } = setup({ existing: { id: 'm0', nonce: 'n-1' } });
		const post = await writer.post(webhook(false), conversation, { body: 'again', blocks: [], nonce: 'n-1' });
		expect(post).toEqual({ message: { id: 'm0', nonce: 'n-1' }, duplicate: true, events: [] });
		expect(repositories.ChatMessage.save).not.toHaveBeenCalled();
		expect(repositories.ChatMessage.findOne).toHaveBeenCalledWith({ where: { webhookId: 'w1', nonce: 'n-1', tenantId: 'ten' }, withDeleted: true });
	});

	describe('replaceOnce (the reply to an interaction)', () => {
		const content = { body: 'Acknowledged by Ana', blocks: [{ type: 'context', elements: ['by Ana'] }] as never, nonce: null };

		it('claims the interaction and changes the message in one transaction, appending chat_message.updated', async () => {
			const { writer, repositories, realtime } = setup();
			const replaced = await writer.replaceOnce('m1', 'i-1', content);
			expect(replaced?.message.body).toBe('Acknowledged by Ana');
			expect(repositories.ChatWebhookInteraction.update).toHaveBeenCalledWith({ id: 'i-1', replyAppliedAt: expect.anything() }, { replyAppliedAt: expect.any(Date) });
			expect(repositories.ChatMessage.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), expect.objectContaining({ body: 'Acknowledged by Ana', editedAt: expect.any(Date) }));
			expect(realtime.messageFact).toHaveBeenCalledWith('chat_message.updated', expect.anything(), ['u1', 'u2']);
		});

		it('changes nothing, and claims nothing, for a message gone or a conversation archived meanwhile', async () => {
			const gone = setup({ stored: null });
			expect(await gone.writer.replaceOnce('m1', 'i-1', content)).toBeNull();
			const archived = setup({ archived: true });
			expect(await archived.writer.replaceOnce('m1', 'i-1', content)).toBeNull();
			for (const run of [gone, archived]) {
				expect(run.repositories.ChatWebhookInteraction.update).not.toHaveBeenCalled();
				expect(run.repositories.ChatMessage.update).not.toHaveBeenCalled();
			}
		});

		it('answers nothing and appends nothing when the message was deleted between the read and the write', async () => {
			const { writer, realtime } = setup({ deletedMeanwhile: true });
			expect(await writer.replaceOnce('m1', 'i-1', content)).toBeNull();
			expect(realtime.messageFact).not.toHaveBeenCalled();
		});

		it('leaves the message alone when the reply of this interaction was applied already', async () => {
			const { writer, repositories } = setup({ claimed: true });
			expect(await writer.replaceOnce('m1', 'i-1', content)).toBeNull();
			expect(repositories.ChatMessage.update).not.toHaveBeenCalled();
		});
	});
});
