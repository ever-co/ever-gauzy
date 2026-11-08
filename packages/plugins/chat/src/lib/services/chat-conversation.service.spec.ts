/**
 * Chat categories keep to the caller's organization: `CHAT_MANAGE` is held per role (a `MANAGER` has it), so a
 * manager of one organization must not rename or delete another organization's categories by their ids.
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

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatConversationService } from './chat-conversation.service';
import { ChatRealtime } from '../realtime/chat-realtime';

type Row = { id: string; tenantId: string; organizationId?: string | null; name: string; position: number };

/** A manager (`CHAT_MANAGE`) of organization A. */
const managerOfA: IChatCaller = { tenantId: 'ten', organizationId: 'org-a', userId: 'u1', employeeId: 'e1', canManage: true };

type Channel = { id: string; tenantId: string; organizationId: string; kind: string; categoryId: string | null };

const matches = (row: object, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);

/** The categories of two organizations of one tenant, and a channel of each organization filed under its own. */
function categoriesOver(rows: Row[]) {
	const channels: Channel[] = [
		{ id: 'conv-a', tenantId: 'ten', organizationId: 'org-a', kind: 'channel', categoryId: 'cat-a' },
		{ id: 'conv-a2', tenantId: 'ten', organizationId: 'org-a', kind: 'channel', categoryId: 'cat-a2' },
		{ id: 'conv-b', tenantId: 'ten', organizationId: 'org-b', kind: 'channel', categoryId: 'cat-b' }
	];
	const categories = {
		findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null),
		save: jest.fn(async (row: Row) => row),
		remove: jest.fn(async (row: Row) => row)
	};
	const conversations = {
		update: jest.fn(async (where: Record<string, unknown>, patch: Partial<Channel>) => {
			const hit = channels.filter((channel) => matches(channel, where));
			hit.forEach((channel) => Object.assign(channel, patch));
			return { affected: hit.length };
		}),
		save: jest.fn(async (row: Channel) => row)
	};
	const dataSource = {
		getRepository: (entity: { name?: string }) => (entity?.name === 'ChatCategory' ? categories : conversations),
		transaction: jest.fn(async () => {
			throw new Error('nothing is written in these tests');
		})
	} as unknown as DataSource;
	const access = { requireManager: jest.fn(async (id: string) => ({ conversation: { ...channels.find((channel) => channel.id === id) }, member: null })) };
	const service = new ChatConversationService(dataSource, access as unknown as ChatAccessService, {} as ChatRealtime);
	return { service, categories, conversations, channels, dataSource: dataSource as unknown as { transaction: jest.Mock } };
}

describe('ChatConversationService categories', () => {
	const rows = (): Row[] => [
		{ id: 'cat-a', tenantId: 'ten', organizationId: 'org-a', name: 'Team A', position: 0 },
		{ id: 'cat-a2', tenantId: 'ten', organizationId: 'org-a', name: 'Team A, too', position: 1 },
		{ id: 'cat-b', tenantId: 'ten', organizationId: 'org-b', name: 'Team B', position: 0 }
	];

	it('renames a category of the caller\'s organization', async () => {
		const { service, categories } = categoriesOver(rows());
		const saved = await service.updateCategory(managerOfA, 'cat-a', { name: ' Renamed ' });
		expect(saved.name).toBe('Renamed');
		expect(categories.findOne.mock.calls[0][0].where).toEqual({ id: 'cat-a', tenantId: 'ten', organizationId: 'org-a' });
	});

	it('answers 404 to a manager renaming another organization\'s category, and writes nothing', async () => {
		const { service, categories } = categoriesOver(rows());
		await expect(service.updateCategory(managerOfA, 'cat-b', { name: 'Taken over' })).rejects.toBeInstanceOf(NotFoundException);
		expect(categories.save).not.toHaveBeenCalled();
	});

	it('answers 404 to a manager deleting another organization\'s category, and leaves its channels categorized', async () => {
		const { service, categories, conversations, channels } = categoriesOver(rows());
		await expect(service.deleteCategory(managerOfA, 'cat-b')).rejects.toBeInstanceOf(NotFoundException);
		expect(conversations.update).not.toHaveBeenCalled();
		expect(categories.remove).not.toHaveBeenCalled();
		expect(channels.find((channel) => channel.id === 'conv-b')?.categoryId).toBe('cat-b');
	});

	it('deletes a category of the caller\'s organization; its channels stay, uncategorized, and no other category\'s', async () => {
		const { service, categories, conversations, channels } = categoriesOver(rows());
		await service.deleteCategory(managerOfA, 'cat-a');
		expect(conversations.update).toHaveBeenCalledWith({ categoryId: 'cat-a', tenantId: 'ten' }, { categoryId: null });
		expect(categories.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'cat-a' }));
		expect(channels.map((channel) => [channel.id, channel.categoryId])).toEqual([
			['conv-a', null],
			['conv-a2', 'cat-a2'],
			['conv-b', 'cat-b']
		]);
	});

	it('refuses to file a new channel under another organization\'s category, before anything is written', async () => {
		const { service, dataSource } = categoriesOver(rows());
		const caller = managerOfA as IChatCaller & { employeeId: string };
		await expect(service.createChannel(caller, { name: 'ops', categoryId: 'cat-b' })).rejects.toBeInstanceOf(NotFoundException);
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});

	it('refuses to move a channel under another organization\'s category, before anything is written', async () => {
		const { service, conversations, channels } = categoriesOver(rows());
		await expect(service.updateConversation(managerOfA, 'conv-a', { name: 'renamed', categoryId: 'cat-b' })).rejects.toBeInstanceOf(NotFoundException);
		expect(conversations.save).not.toHaveBeenCalled();
		expect(conversations.update).not.toHaveBeenCalled();
		expect(channels.find((channel) => channel.id === 'conv-a')?.categoryId).toBe('cat-a');
	});

	it('keeps the tenant-wide reach of a caller the request scopes to no organization', async () => {
		const { service, categories } = categoriesOver(rows());
		await service.updateCategory({ ...managerOfA, organizationId: null }, 'cat-b', { position: 3 });
		expect(categories.findOne.mock.calls[0][0].where).toEqual({ id: 'cat-b', tenantId: 'ten' });
		expect(categories.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'cat-b', position: 3 }));
	});

	it('still needs CHAT_MANAGE', async () => {
		const { service, categories } = categoriesOver(rows());
		await expect(service.updateCategory({ ...managerOfA, canManage: false }, 'cat-a', { name: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.deleteCategory({ ...managerOfA, canManage: false }, 'cat-a')).rejects.toBeInstanceOf(ForbiddenException);
		expect(categories.findOne).not.toHaveBeenCalled();
	});
});
