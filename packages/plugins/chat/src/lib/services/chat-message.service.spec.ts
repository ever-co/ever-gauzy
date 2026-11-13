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
import { ChatDraftUploadService } from './chat-draft-upload.service';
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
		append: jest.fn(async (_manager: unknown, fact: { name: string }) => ({ name: fact.name, data: {} })),
		publish: jest.fn(async (fact: { name: string }) => ({ name: fact.name, data: {} }))
	};
	const service = new ChatMessageService(dataSource, access, realtime as unknown as ChatRealtime, {} as ChatNotifierService, {} as TaskService, {} as CommandBus, {} as ChatDraftUploadService);
	// The lookups before the transaction: the message (not deleted when read) and its place in the timeline.
	Object.assign(service as unknown as Record<string, unknown>, {
		messageForWrite: jest.fn(async () => ({ message: { ...message }, conversation: { ...conversation } })),
		timelinePosition: jest.fn(async () => 3)
	});
	return { service, repositories, realtime, manager };
}

describe('ChatMessageService.remove', () => {
	it('deletes only a message still there, and moves the counters when it did', async () => {
		const { service, repositories, realtime, manager } = removeOver(1);
		const result = await service.remove(author, 'm1');
		// The fact is appended with the delete's own transaction, so it commits with the delete or not at all.
		expect(realtime.append).toHaveBeenCalledWith(manager, expect.objectContaining({ name: 'chat_message.deleted' }));
		expect(realtime.publish).not.toHaveBeenCalled();
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
		expect(realtime.append).not.toHaveBeenCalled();
		expect(realtime.publish).not.toHaveBeenCalled();
		expect(result).toEqual({ events: [] });
	});
});

/**
 * `read` of a whole conversation over repository doubles: each followed thread keeps, of its unread replies, only the
 * ones that live in the thread only (their notifications stay unread too, see `ChatNotifierService`).
 * `threadOnly` is what counting the thread-only replies of each root answers. The follow rows are kept in `rows`, and
 * the counter write is a compare-and-set on them, as the conditional UPDATE is; `beforeWrite` runs before each write
 * (a reply or another read landing in between).
 */
function readOver(
	follows: Array<{ id: string; rootMessageId: string; unreadReplies: number; lastReadReplyAt: Date | null }>,
	threadOnly: Record<string, number>,
	beforeWrite: (rows: Map<string, { unreadReplies: number }>, attempt: number) => void = () => undefined
) {
	const rows = new Map(follows.map((follow) => [follow.id, { ...follow }]));
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
	let writes = 0;
	const repositories = {
		ChatMessage: { findOne: jest.fn(async () => ({ id: 'm9' })), createQueryBuilder: jest.fn(replies) },
		ChatMember: { update: jest.fn(async () => ({ affected: 1 })) },
		ChatThreadFollow: {
			find: jest.fn(async () => [...rows.values()].filter((row) => row.unreadReplies > 0).map((row) => ({ ...row }))),
			findOne: jest.fn(async ({ where }: { where: { id: string } }) => ({ ...rows.get(where.id)! })),
			update: jest.fn(async (criteria: { id: string; unreadReplies: number }, patch: { unreadReplies: number }) => {
				beforeWrite(rows, writes++);
				const row = rows.get(criteria.id);
				if (!row || row.unreadReplies !== criteria.unreadReplies) return { affected: 0 };
				row.unreadReplies = patch.unreadReplies;
				return { affected: 1 };
			}),
			decrement: jest.fn()
		}
	};
	const repositoryOf = (entity: string | { name?: string }) => repositories[(typeof entity === 'string' ? entity : entity?.name) as keyof typeof repositories];
	// The member row and its fact are written in one transaction; its manager reads the same doubles.
	const manager = { getRepository: repositoryOf };
	const dataSource = {
		getRepository: repositoryOf,
		transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => work(manager))
	} as unknown as DataSource;
	const access = {
		requireMember: jest.fn(async () => ({ conversation: { id: 'c1', messageCount: 5 }, member: { id: 'mb1', employeeId: 'e1', readCount: 2, mentionCount: 1 } }))
	} as unknown as ChatAccessService;
	const realtime = {
		memberStateFact: jest.fn(() => ({ name: 'chat_member.state_changed' })),
		append: jest.fn(async (_manager: unknown, fact: { name: string }) => ({ name: fact.name, data: {} })),
		publish: jest.fn(async (fact: { name: string }) => ({ name: fact.name, data: {} }))
	} as unknown as ChatRealtime;
	const notifier = { markConversationRead: jest.fn(async () => 0) };
	const service = new ChatMessageService(dataSource, access, realtime, notifier as unknown as ChatNotifierService, {} as TaskService, {} as CommandBus, {} as ChatDraftUploadService);
	Object.assign(service as unknown as Record<string, unknown>, { followIdsIn: jest.fn(async () => follows.map((follow) => follow.id)) });
	const unreadOf = (id: string) => rows.get(id)?.unreadReplies;
	return { service, repositories, notifier, counted, unreadOf };
}

describe('ChatMessageService.read (the whole conversation)', () => {
	const caller = { ...author, employeeId: 'e1' } as IChatCaller & { employeeId: string };
	const since = new Date('2026-11-01T00:00:00.000Z');

	it('keeps the thread-only replies of a followed thread unread, and reads the ones also sent to the conversation', async () => {
		// f1: 3 unread, 1 of them thread-only → 1. f2: 2 unread, both thread-only → untouched. f3: 1 unread, none
		// thread-only → 0.
		const { service, repositories, notifier, counted, unreadOf } = readOver(
			[
				{ id: 'f1', rootMessageId: 'r1', unreadReplies: 3, lastReadReplyAt: since },
				{ id: 'f2', rootMessageId: 'r2', unreadReplies: 2, lastReadReplyAt: null },
				{ id: 'f3', rootMessageId: 'r3', unreadReplies: 1, lastReadReplyAt: since }
			],
			{ r1: 1, r2: 2, r3: 0 }
		);
		await service.read(caller as never, 'c1');
		expect([unreadOf('f1'), unreadOf('f2'), unreadOf('f3')]).toEqual([1, 2, 0]);
		// A compare-and-set on the value read, never a relative decrement, and the read mark is not written.
		const writes = repositories.ChatThreadFollow.update.mock.calls as unknown as Array<[Record<string, unknown>, Record<string, unknown>]>;
		expect(writes.map(([criteria, patch]) => [criteria['id'], criteria['unreadReplies'], patch])).toEqual([
			['f1', 3, { unreadReplies: 1 }],
			['f3', 1, { unreadReplies: 0 }]
		]);
		expect(repositories.ChatThreadFollow.decrement).not.toHaveBeenCalled();
		// Counted from each follow's read mark, which the conversation read does not move.
		expect(counted).toEqual([
			{ root: 'r1', since },
			{ root: 'r2', since: undefined },
			{ root: 'r3', since }
		]);
		// The notifications of the same replies: those of the conversation's timeline are read, thread-only ones stay.
		expect(notifier.markConversationRead).toHaveBeenCalledWith('c1', { tenantId: 'ten', employeeId: 'e1' }, null);
	});

	it('does not subtract twice when another read of the same follow got there first (a second tab)', async () => {
		// Both reads saw 3 unread with 2 thread-only: the other one wrote 2 first; this one's write misses, it reads the
		// follow again (2) and has nothing left to subtract.
		const { service, repositories, unreadOf } = readOver([{ id: 'f1', rootMessageId: 'r1', unreadReplies: 3, lastReadReplyAt: since }], { r1: 2 }, (rows, attempt) => {
			if (attempt === 0) rows.get('f1')!.unreadReplies = 2;
		});
		await service.read(caller as never, 'c1');
		expect(unreadOf('f1')).toBe(2);
		expect(repositories.ChatThreadFollow.update).toHaveBeenCalledTimes(1);
		expect(repositories.ChatThreadFollow.findOne).toHaveBeenCalledTimes(1);
	});

	it('keeps a reply counted meanwhile: the write misses and the follow is counted again', async () => {
		// 2 unread, 0 thread-only; a thread-only reply lands before the write (3 unread, 1 thread-only on the recount).
		const threadOnly = { r1: 0 };
		const { service, repositories, unreadOf } = readOver([{ id: 'f1', rootMessageId: 'r1', unreadReplies: 2, lastReadReplyAt: since }], threadOnly, (rows, attempt) => {
			if (attempt === 0) {
				rows.get('f1')!.unreadReplies = 3;
				threadOnly.r1 = 1;
			}
		});
		await service.read(caller as never, 'c1');
		expect(unreadOf('f1')).toBe(1);
		expect(repositories.ChatThreadFollow.update).toHaveBeenCalledTimes(2);
	});

	it('leaves the followed threads alone on a partial read, and hands the notifier the message read up to', async () => {
		const { service, repositories, notifier } = readOver([{ id: 'f1', rootMessageId: 'r1', unreadReplies: 3, lastReadReplyAt: since }], { r1: 0 });
		const anchor = { id: 'm5', conversationId: 'c1', createdAt: since };
		repositories.ChatMessage.findOne.mockResolvedValueOnce(anchor as never);
		Object.assign(service as unknown as Record<string, unknown>, { timelinePosition: jest.fn(async () => 4), countMentions: jest.fn(async () => 0) });
		await service.read(caller as never, 'c1', 'm5');
		expect(repositories.ChatThreadFollow.find).not.toHaveBeenCalled();
		expect(repositories.ChatThreadFollow.update).not.toHaveBeenCalled();
		expect(notifier.markConversationRead).toHaveBeenCalledWith('c1', { tenantId: 'ten', employeeId: 'e1' }, anchor);
	});

	it('never raises a counter when the thread holds more thread-only replies than the follow counts', async () => {
		const { service, repositories, unreadOf } = readOver([{ id: 'f1', rootMessageId: 'r1', unreadReplies: 1, lastReadReplyAt: null }], { r1: 4 });
		await service.read(caller as never, 'c1');
		expect(unreadOf('f1')).toBe(1);
		expect(repositories.ChatThreadFollow.update).not.toHaveBeenCalled();
	});
});

describe('ChatMessageService follow (a follow that starts unread)', () => {
	function followOver() {
		const save = jest.fn(async (row: unknown) => row);
		const repository = { findOne: jest.fn(async () => null), create: jest.fn((row: unknown) => row), save, update: jest.fn() };
		const manager = { getRepository: () => repository };
		const service = new ChatMessageService({} as DataSource, {} as ChatAccessService, {} as ChatRealtime, {} as ChatNotifierService, {} as TaskService, {} as CommandBus, {} as ChatDraftUploadService);
		const follow = (root: Record<string, unknown>, read: boolean) =>
			(service as unknown as { follow: (...args: unknown[]) => Promise<void> }).follow(manager, root, { tenantId: 'ten', organizationId: 'org', employeeId: 'e2', userId: 'u2' }, read);
		return { follow, save };
	}

	it("starts after the thread's previous reply, so a conversation read never counts older replies on it", async () => {
		const { follow, save } = followOver();
		const previousReply = new Date('2026-11-02T10:00:00.000Z');
		await follow({ id: 'r1', createdAt: new Date('2026-11-01T00:00:00.000Z'), lastReplyAt: previousReply }, false);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ unreadReplies: 0, lastReadReplyAt: previousReply }));
	});

	it('starts at the root when the thread had no reply yet', async () => {
		const { follow, save } = followOver();
		const rootAt = new Date('2026-11-01T00:00:00.000Z');
		await follow({ id: 'r1', createdAt: rootAt, lastReplyAt: null }, false);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ lastReadReplyAt: rootAt }));
	});
});

describe('ChatMessageService.markThreadRead', () => {
	it('clears the thread notifications also when no follow row changed (a thread read after its follow was removed)', async () => {
		const update = jest.fn(async () => ({ affected: 0 }));
		const dataSource = { getRepository: () => ({ update }) } as unknown as DataSource;
		const notifier = { markThreadRead: jest.fn(async () => 0) };
		const service = new ChatMessageService(dataSource, {} as ChatAccessService, {} as ChatRealtime, notifier as unknown as ChatNotifierService, {} as TaskService, {} as CommandBus, {} as ChatDraftUploadService);
		Object.assign(service as unknown as Record<string, unknown>, { messageForCaller: jest.fn(async () => ({ id: 'r1', threadRootId: null })) });

		await expect(service.markThreadRead(author, 'r1')).resolves.toEqual({ updated: false });

		expect(update).toHaveBeenCalledWith({ rootMessageId: 'r1', employeeId: 'e1', tenantId: 'ten' }, expect.objectContaining({ unreadReplies: 0 }));
		expect(notifier.markThreadRead).toHaveBeenCalledWith('r1', { tenantId: 'ten', employeeId: 'e1' });
	});
});
