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

function categoriesOver(rows: Row[]) {
	const matches = (row: Row, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
	const categories = {
		findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null),
		save: jest.fn(async (row: Row) => row),
		remove: jest.fn(async (row: Row) => row)
	};
	const conversations = { update: jest.fn(async () => ({ affected: 0 })) };
	const dataSource = {
		getRepository: (entity: { name?: string }) => (entity?.name === 'ChatCategory' ? categories : conversations)
	} as unknown as DataSource;
	const service = new ChatConversationService(dataSource, {} as ChatAccessService, {} as ChatRealtime);
	return { service, categories, conversations };
}

describe('ChatConversationService categories', () => {
	const rows = (): Row[] => [
		{ id: 'cat-a', tenantId: 'ten', organizationId: 'org-a', name: 'Team A', position: 0 },
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
		const { service, categories, conversations } = categoriesOver(rows());
		await expect(service.deleteCategory(managerOfA, 'cat-b')).rejects.toBeInstanceOf(NotFoundException);
		expect(conversations.update).not.toHaveBeenCalled();
		expect(categories.remove).not.toHaveBeenCalled();
	});

	it('deletes a category of the caller\'s organization; its channels stay, uncategorized', async () => {
		const { service, categories, conversations } = categoriesOver(rows());
		await service.deleteCategory(managerOfA, 'cat-a');
		expect(conversations.update).toHaveBeenCalledWith({ categoryId: 'cat-a', tenantId: 'ten' }, { categoryId: null });
		expect(categories.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'cat-a' }));
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
