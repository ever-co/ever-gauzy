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
