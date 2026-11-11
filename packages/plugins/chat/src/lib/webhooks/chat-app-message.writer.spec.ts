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
import { ChatNotifierService } from '../services/chat-notifier.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';

const E1 = '7b1a3c0e-0000-4000-8000-000000000001';
const E2 = '7b1a3c0e-0000-4000-8000-000000000002';

function setup(options: { existing?: Record<string, unknown> | null } = {}) {
	const members = [
		{ id: 'mb1', employeeId: E1, userId: 'u1', readCount: 3, mentionCount: 0, notifyLevel: 'all', isFavorite: false, conversationId: 'c1', tenantId: 'ten' },
		{ id: 'mb2', employeeId: E2, userId: 'u2', readCount: 1, mentionCount: 2, notifyLevel: 'all', isFavorite: false, conversationId: 'c1', tenantId: 'ten' }
	];
	const repositories = {
		ChatMessage: {
			create: jest.fn((row: Record<string, unknown>) => row),
			save: jest.fn(async (row: Record<string, unknown>) => ({ ...row, id: 'm1' })),
			findOne: jest.fn(async () => options.existing ?? null)
		},
		ChatConversation: { increment: jest.fn(async () => ({ affected: 1 })), update: jest.fn(async () => ({ affected: 1 })) },
		ChatMember: { increment: jest.fn(async () => ({ affected: 1 })) }
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
	const notifier = { notifyMentions: jest.fn() } as unknown as ChatNotifierService & { notifyMentions: jest.Mock };
	const writer = new ChatAppMessageWriter(dataSource, access, realtime, notifier);
	return { writer, repositories, realtime, notifier };
}

const conversation = { id: 'c1', tenantId: 'ten', organizationId: 'org', kind: 'channel', messageCount: 3 } as unknown as ChatConversation;
const webhook = (canBroadcast: boolean) => ({ id: 'w1', tenantId: 'ten', organizationId: 'org', name: 'Deploys', iconUrl: 'https://cdn.example.com/ci.png', canBroadcast }) as unknown as ChatWebhook;

describe('ChatAppMessageWriter', () => {
	it('writes an app message with no employee author and the webhook name and icon, and moves the counters', async () => {
		const { writer, repositories, realtime, notifier } = setup();
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
		expect(notifier.notifyMentions).toHaveBeenCalledWith(expect.anything(), conversation, [E2]);
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
});
