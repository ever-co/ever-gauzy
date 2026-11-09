/**
 * `ChatMessageService.remove` under two overlapping deletes of one message: only the request whose conditional UPDATE
 * marked the message deleted moves the counters.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as in the resolver spec.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, hasPermission: () => false }
	};
	// Any other name: a function that serves as a no-op decorator and as a base class.
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {}) });
});

import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { TaskService } from '@gauzy/core';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatMessageService } from './chat-message.service';
import { ChatNotifierService } from './chat-notifier.service';
import { ChatRealtime } from '../realtime/chat-realtime';

const author: IChatCaller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };

/**
 * `remove` over repository doubles: `affected` is what the conditional UPDATE of the message answers — 1 when this
 * request deleted it, 0 when a concurrent delete of the same message got there first.
 */
function removeOver(affected: number) {
	const message = { id: 'm1', conversationId: 'c1', authorUserId: 'u1', kind: 'message', threadRootId: null, alsoInConversation: false, deletedAt: null, mentionEmployeeIds: null, mentionsChannel: false, mentionsHere: false, tenantId: 'ten', organizationId: 'org' };
	const conversation = { id: 'c1', messageCount: 5 };
	const members = [
		{ id: 'mb1', employeeId: 'e1', userId: 'u1', readCount: 5, mentionCount: 0 },
		{ id: 'mb2', employeeId: 'e2', userId: 'u2', readCount: 2, mentionCount: 1 }
	];
	const repositories = {
		ChatMessage: { update: jest.fn(async (_criteria: Record<string, unknown>, _patch: Record<string, unknown>) => ({ affected, raw: [], generatedMaps: [] })) },
		DocumentLink: { delete: jest.fn(async () => ({ affected: 0, raw: [] })) },
		ChatConversation: {
			decrement: jest.fn(async () => ({ affected: 1 })),
			findOne: jest.fn(async () => ({ id: 'c1', messageCount: 4 })),
			update: jest.fn(async () => ({ affected: 0 }))
		},
		ChatMember: { decrement: jest.fn(async () => ({ affected: 1 })), update: jest.fn(async () => ({ affected: 0 })) }
	};
	const manager = {
		getRepository: (entity: string | { name?: string }) => repositories[(typeof entity === 'string' ? entity : entity?.name) as keyof typeof repositories]
	};
	const dataSource = { transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => work(manager)) } as unknown as DataSource;
	const access = { members: jest.fn(async () => members) } as unknown as ChatAccessService;
	const realtime = {
		messageFact: jest.fn((name: string) => ({ name })),
		publish: jest.fn(async (fact: { name: string }) => ({ name: fact.name, data: {} }))
	} as unknown as ChatRealtime;
	const service = new ChatMessageService(dataSource, access, realtime, {} as ChatNotifierService, {} as TaskService, {} as CommandBus);
	// The lookups before the transaction: the message (not deleted when read) and its place in the timeline.
	Object.assign(service as unknown as Record<string, unknown>, {
		messageForWrite: jest.fn(async () => ({ message: { ...message }, conversation: { ...conversation } })),
		timelinePosition: jest.fn(async () => 3)
	});
	return { service, repositories, realtime };
}

describe('ChatMessageService.remove', () => {
	it('deletes only a message still there, and moves the counters when it did', async () => {
		const { service, repositories } = removeOver(1);
		const result = await service.remove(author, 'm1');
		expect(repositories.ChatMessage.update).toHaveBeenCalledTimes(1);
		expect(repositories.ChatMessage.update.mock.calls[0][0]).toEqual({ id: 'm1', deletedAt: expect.objectContaining({ _type: 'isNull' }) });
		expect(repositories.ChatConversation.decrement).toHaveBeenCalledWith({ id: 'c1' }, 'messageCount', 1);
		expect(repositories.ChatMember.decrement).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'c1' }), 'readCount', 1);
		expect(repositories.DocumentLink.delete).toHaveBeenCalledTimes(1);
		expect(result.events.map((event) => event.name)).toEqual(['chat_message.deleted']);
	});

	it('leaves the counters alone when a concurrent delete of the same message got there first', async () => {
		const { service, repositories, realtime } = removeOver(0);
		const result = await service.remove(author, 'm1');
		expect(repositories.ChatConversation.decrement).not.toHaveBeenCalled();
		expect(repositories.ChatConversation.update).not.toHaveBeenCalled();
		expect(repositories.ChatMember.decrement).not.toHaveBeenCalled();
		expect(repositories.ChatMember.update).not.toHaveBeenCalled();
		expect(repositories.DocumentLink.delete).not.toHaveBeenCalled();
		// The request that deleted it told the members; this one has nothing to tell.
		expect(realtime.publish).not.toHaveBeenCalled();
		expect(result).toEqual({ events: [] });
	});
});

/**
 * `read` of a whole conversation over repository doubles: each followed thread keeps, of its unread replies, only the
 * ones that live in the thread only (their notifications stay unread too, see `ChatNotifierService`).
 * `threadOnly` is what counting the thread-only replies of each root answers.
 */
function readOver(follows: Array<{ id: string; rootMessageId: string; unreadReplies: number; lastReadReplyAt: Date | null }>, threadOnly: Record<string, number>) {
	const counted: Array<{ root: unknown; since: unknown }> = [];
	const replies = () => {
		const state: { root?: unknown; since?: unknown } = {};
		const builder = {
			where: (_sql: string, params?: Record<string, unknown>) => (Object.assign(state, { root: params?.['rootMessageId'] }), builder),
			andWhere: (_sql: unknown, params?: Record<string, unknown>) => (params && 'since' in params ? (state.since = params['since']) : undefined, builder),
			getCount: async () => (counted.push({ root: state.root, since: state.since }), threadOnly[String(state.root)] ?? 0)
		};
		return builder;
	};
	const repositories = {
		ChatMessage: { findOne: jest.fn(async () => ({ id: 'm9' })), createQueryBuilder: jest.fn(replies) },
		ChatMember: { update: jest.fn(async () => ({ affected: 1 })) },
		ChatThreadFollow: {
			find: jest.fn(async () => follows.filter((follow) => follow.unreadReplies > 0)),
			decrement: jest.fn(async () => ({ affected: 1 })),
			update: jest.fn(async () => ({ affected: 1 }))
		}
	};
	const dataSource = {
		getRepository: (entity: string | { name?: string }) => repositories[(typeof entity === 'string' ? entity : entity?.name) as keyof typeof repositories]
	} as unknown as DataSource;
	const access = {
		requireMember: jest.fn(async () => ({ conversation: { id: 'c1', messageCount: 5 }, member: { id: 'mb1', employeeId: 'e1', readCount: 2, mentionCount: 1 } }))
	} as unknown as ChatAccessService;
	const realtime = {
		memberStateFact: jest.fn(() => ({ name: 'chat_member.state_changed' })),
		publish: jest.fn(async (fact: { name: string }) => ({ name: fact.name, data: {} }))
	} as unknown as ChatRealtime;
	const notifier = { markConversationRead: jest.fn(async () => 0) };
	const service = new ChatMessageService(dataSource, access, realtime, notifier as unknown as ChatNotifierService, {} as TaskService, {} as CommandBus);
	Object.assign(service as unknown as Record<string, unknown>, { followIdsIn: jest.fn(async () => follows.map((follow) => follow.id)) });
	return { service, repositories, notifier, counted };
}

describe('ChatMessageService.read (the whole conversation)', () => {
	const caller = { ...author, employeeId: 'e1' } as IChatCaller & { employeeId: string };
	const since = new Date('2026-11-01T00:00:00.000Z');

	it('keeps the thread-only replies of a followed thread unread, and reads the ones also sent to the conversation', async () => {
		// f1: 3 unread, 1 of them thread-only → 2 read. f2: 2 unread, both thread-only → untouched. f3: 1 unread, none
		// thread-only → read.
		const { service, repositories, notifier, counted } = readOver(
			[
				{ id: 'f1', rootMessageId: 'r1', unreadReplies: 3, lastReadReplyAt: since },
				{ id: 'f2', rootMessageId: 'r2', unreadReplies: 2, lastReadReplyAt: null },
				{ id: 'f3', rootMessageId: 'r3', unreadReplies: 1, lastReadReplyAt: since }
			],
			{ r1: 1, r2: 2, r3: 0 }
		);
		await service.read(caller as never, 'c1');
		const decrements = repositories.ChatThreadFollow.decrement.mock.calls as unknown as Array<[Record<string, unknown>, string, number]>;
		expect(decrements.map(([criteria, column, by]) => [criteria['id'], column, by])).toEqual([
			['f1', 'unreadReplies', 2],
			['f3', 'unreadReplies', 1]
		]);
		// Never below zero: the decrement only applies while the counter still holds what it subtracts.
		expect(decrements[0][0]['unreadReplies']).toEqual(expect.objectContaining({ _type: 'moreThanOrEqual', _value: 2 }));
		// Counted from each follow's read mark, which the conversation read does not move.
		expect(counted).toEqual([
			{ root: 'r1', since },
			{ root: 'r2', since: undefined },
			{ root: 'r3', since }
		]);
		expect(repositories.ChatThreadFollow.update).not.toHaveBeenCalled();
		// The notifications of the same replies: those of the conversation's timeline are read, thread-only ones stay.
		expect(notifier.markConversationRead).toHaveBeenCalledWith('c1', { tenantId: 'ten', employeeId: 'e1' }, null);
	});

	it('never raises a counter when the thread holds more thread-only replies than the follow counts', async () => {
		const { service, repositories } = readOver([{ id: 'f1', rootMessageId: 'r1', unreadReplies: 1, lastReadReplyAt: null }], { r1: 4 });
		await service.read(caller as never, 'c1');
		expect(repositories.ChatThreadFollow.decrement).not.toHaveBeenCalled();
		expect(repositories.ChatThreadFollow.update).not.toHaveBeenCalled();
	});
});
