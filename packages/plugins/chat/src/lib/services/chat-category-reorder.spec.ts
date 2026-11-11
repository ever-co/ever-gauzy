/**
 * `ChatConversationService.reorderCategories`: one transaction, only what changed written, moved channels told.
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
		MikroOrmBaseEntityRepository: class {}
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {}) });
});

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatConversationService } from './chat-conversation.service';

const manager: IChatCaller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: true };

function over() {
	const categories = [
		{ id: 'k1', name: 'A', position: 0 },
		{ id: 'k2', name: 'B', position: 1 },
		{ id: 'k3', name: 'C', position: 2 }
	];
	const channels = [
		{ id: 'c1', kind: 'channel', categoryId: 'k1', position: 0, tenantId: 'ten', organizationId: 'org' },
		{ id: 'c2', kind: 'channel', categoryId: 'k1', position: 1, tenantId: 'ten', organizationId: 'org' },
		{ id: 'c3', kind: 'channel', categoryId: null, position: 0, tenantId: 'ten', organizationId: 'org' }
	];
	const writes: Array<{ table: string; id: string; patch: Record<string, unknown> }> = [];
	const repository = (table: string, rows: Array<{ id: string }>) => ({
		find: jest.fn(async ({ where }: { where: { id?: { _value?: string[] } } }) => {
			const wanted = where?.id?._value;
			return rows.filter((row) => !wanted || wanted.includes(row.id)).map((row) => ({ ...row }));
		}),
		update: jest.fn(async (criteria: { id: string }, patch: Record<string, unknown>) => {
			writes.push({ table, id: criteria.id, patch });
			return { affected: 1 };
		})
	});
	const repositories: Record<string, unknown> = { ChatCategory: repository('category', categories), ChatConversation: repository('conversation', channels) };
	const em = { getRepository: (entity: { name?: string }) => repositories[String(entity?.name)] };
	const dataSource = { ...em, transaction: jest.fn(async (work: (m: typeof em) => Promise<unknown>) => work(em)) } as unknown as DataSource;
	const access = { members: jest.fn(async (_tenantId: string, id: string) => [{ userId: `${id}-member` }]) } as unknown as ChatAccessService;
	const realtime = {
		conversationFact: jest.fn((conversation: { id: string }, change: string, recipients: string[]) => ({ id: conversation.id, change, recipients })),
		append: jest.fn(async (_m: unknown, fact: { id: string; change: string; recipients: string[] }) => ({ name: 'chat_conversation.changed', data: fact }))
	};
	return { service: new ChatConversationService(dataSource, access, realtime as unknown as ChatRealtime), writes, dataSource };
}

describe('ChatConversationService.reorderCategories', () => {
	it('saves the new order in one transaction, writing only the positions that changed', async () => {
		const { service, writes, dataSource } = over();
		const result = await service.reorderCategories(manager, {
			categoryIds: ['k2', 'k1', 'k3'],
			channels: [
				{ categoryId: 'k1', conversationIds: ['c2', 'c1'] },
				{ categoryId: 'k2', conversationIds: ['c3'] }
			]
		});
		expect((dataSource.transaction as jest.Mock).mock.calls).toHaveLength(1);
		expect(result.categories.map((category) => [category.id, category.position])).toEqual([
			['k2', 0],
			['k1', 1],
			['k3', 2]
		]);
		expect(writes).toEqual([
			{ table: 'category', id: 'k2', patch: { position: 0 } },
			{ table: 'category', id: 'k1', patch: { position: 1 } },
			{ table: 'conversation', id: 'c2', patch: { categoryId: 'k1', position: 0 } },
			{ table: 'conversation', id: 'c1', patch: { categoryId: 'k1', position: 1 } },
			{ table: 'conversation', id: 'c3', patch: { categoryId: 'k2', position: 0 } }
		]);
		expect(result.conversations).toEqual([
			{ id: 'c2', categoryId: 'k1', position: 0 },
			{ id: 'c1', categoryId: 'k1', position: 1 },
			{ id: 'c3', categoryId: 'k2', position: 0 }
		]);
		expect(result.events.map((event) => (event.data as { id: string; recipients: string[] }).recipients)).toEqual([['c2-member'], ['c1-member'], ['c3-member']]);
	});

	it('keeps a category the order leaves out after the named ones, and writes nothing when nothing moves', async () => {
		const { service, writes } = over();
		const result = await service.reorderCategories(manager, { categoryIds: ['k1', 'k2'] });
		expect(result.categories.map((category) => category.id)).toEqual(['k1', 'k2', 'k3']);
		expect(writes).toEqual([]);
		expect(result.events).toEqual([]);
	});

	it('moves a channel out of its category (null)', async () => {
		const { service, writes } = over();
		await service.reorderCategories(manager, { categoryIds: ['k1', 'k2', 'k3'], channels: [{ categoryId: null, conversationIds: ['c1', 'c3'] }] });
		expect(writes).toEqual([
			{ table: 'conversation', id: 'c1', patch: { categoryId: null, position: 0 } },
			{ table: 'conversation', id: 'c3', patch: { categoryId: null, position: 1 } }
		]);
	});

	it('refuses a caller without CHAT_MANAGE, a name given twice, and what is not the organization’s', async () => {
		await expect(over().service.reorderCategories({ ...manager, canManage: false }, { categoryIds: ['k1'] })).rejects.toBeInstanceOf(ForbiddenException);
		await expect(over().service.reorderCategories(manager, { categoryIds: ['k1', 'k1'] })).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			over().service.reorderCategories(manager, { categoryIds: ['k1'], channels: [{ categoryId: 'k1', conversationIds: ['c1', 'c1'] }] })
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(over().service.reorderCategories(manager, { categoryIds: ['k9'] })).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			over().service.reorderCategories(manager, { categoryIds: ['k1'], channels: [{ categoryId: 'k9', conversationIds: ['c1'] }] })
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			over().service.reorderCategories(manager, { categoryIds: ['k1'], channels: [{ categoryId: 'k1', conversationIds: ['c9'] }] })
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
