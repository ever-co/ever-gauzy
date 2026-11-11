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
import { DataSource, FindOperator } from 'typeorm';
import { directKeyOf } from '../chat-direct-key';
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

type Conversation = { id: string; tenantId: string; organizationId: string | null; kind: string; directKey: string | null; createdByEmployeeId: string; createdAt: Date };
type EmployeeRow = { id: string; userId: string; tenantId: string; organizationId: string };

/**
 * Users u1 and u2 are employees of two organizations of one tenant (an employee record per organization), and
 * already have a direct conversation in organization A.
 */
const EMPLOYEES: EmployeeRow[] = [
	{ id: 'e1-a', userId: 'u1', tenantId: 'ten', organizationId: 'org-a' },
	{ id: 'e2-a', userId: 'u2', tenantId: 'ten', organizationId: 'org-a' },
	{ id: 'e1-b', userId: 'u1', tenantId: 'ten', organizationId: 'org-b' },
	{ id: 'e2-b', userId: 'u2', tenantId: 'ten', organizationId: 'org-b' }
];

const directOfA = (): Conversation => ({
	id: 'direct-a',
	tenantId: 'ten',
	organizationId: 'org-a',
	kind: 'direct',
	directKey: directKeyOf(['u1', 'u2']),
	createdByEmployeeId: 'e1-a',
	createdAt: new Date(Date.now() - 86_400_000)
});

function directOver(conversations: Conversation[], options: { raceWinner?: Conversation } = {}) {
	const repository = {
		findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => conversations.find((row) => matches(row, where)) ?? null)
	};
	const employees = {
		find: jest.fn(async ({ where }: { where: { id: FindOperator<string[]>; tenantId: string; organizationId?: string } }) =>
			EMPLOYEES.filter((employee) => (where.id.value as unknown as string[]).includes(employee.id) && employee.tenantId === where.tenantId && (!where.organizationId || employee.organizationId === where.organizationId))
		)
	};
	const members = { update: jest.fn(async () => ({ affected: 0 })) };
	const manager = {
		getRepository: (entity: { name?: string }) =>
			entity?.name === 'ChatConversation'
				? {
						create: (row: Partial<Conversation>) => ({ ...row }),
						save: async (row: Partial<Conversation>) => {
							const saved = { ...row, id: `direct-${conversations.length + 1}`, createdAt: new Date() } as Conversation;
							conversations.push(saved);
							return saved;
						}
				  }
				: { create: (row: unknown) => row, save: async (row: unknown) => row }
	};
	const dataSource = {
		getRepository: (entity: { name?: string }) => (entity?.name === 'ChatConversation' ? repository : entity?.name === 'ChatMember' ? members : employees),
		transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => {
			if (options.raceWinner) {
				// Another request created the conversation first: the unique key refuses this one.
				conversations.push(options.raceWinner);
				throw new Error('duplicate key value violates unique constraint "UQ_chat_conversation_organization_direct_key"');
			}
			return work(manager);
		})
	} as unknown as DataSource;
	const realtime = {
		append: jest.fn(async (_manager: unknown, fact: unknown) => fact),
		publish: jest.fn(async (fact: unknown) => fact),
		conversationFact: jest.fn((conversation: Conversation, kind: string) => ({ kind, conversationId: conversation.id }))
	};
	const service = new ChatConversationService(dataSource, {} as ChatAccessService, realtime as unknown as ChatRealtime);
	// What `get` answers, by the rule of `ChatAccessService.conversation`: another organization's conversation is not found.
	jest.spyOn(service, 'get').mockImplementation(async (caller: IChatCaller, id: string) => {
		const row = conversations.find((conversation) => conversation.id === id);
		if (!row || (caller.organizationId && row.organizationId && row.organizationId !== caller.organizationId)) {
			throw new NotFoundException('The requested record was not found');
		}
		return row as never;
	});
	return { service, repository, dataSource: dataSource as unknown as { transaction: jest.Mock }, conversations, realtime, manager };
}

describe('ChatConversationService.direct — one conversation per organization', () => {
	const u1In = (organizationId: string | null): IChatCaller & { employeeId: string } => ({
		tenantId: 'ten',
		organizationId,
		userId: 'u1',
		employeeId: organizationId === 'org-b' ? 'e1-b' : 'e1-a',
		canManage: false
	});

	it('creates the conversation of two people in their second organization, though they have one in the first', async () => {
		const { service, repository, conversations, realtime, manager } = directOver([directOfA()]);
		const result = await service.direct(u1In('org-b'), ['e2-b']);
		expect(result.created).toBe(true);
		// Announced inside the creating transaction (it commits with the conversation), never after it.
		expect(realtime.append).toHaveBeenCalledWith(manager, { kind: 'created', conversationId: 'direct-2' });
		expect(realtime.publish).not.toHaveBeenCalled();
		expect(result.events).toEqual([{ kind: 'created', conversationId: 'direct-2' }]);
		expect(result.conversation).toMatchObject({ organizationId: 'org-b', directKey: directKeyOf(['u1', 'u2']), kind: 'direct' });
		expect(repository.findOne.mock.calls[0][0].where).toEqual({ tenantId: 'ten', organizationId: 'org-b', directKey: directKeyOf(['u1', 'u2']) });
		expect(conversations.map((conversation) => [conversation.id, conversation.organizationId])).toEqual([
			['direct-a', 'org-a'],
			['direct-2', 'org-b']
		]);
	});

	it('finds the conversation of their organization, whoever starts it, and creates nothing', async () => {
		const { service, dataSource } = directOver([directOfA()]);
		const result = await service.direct({ ...u1In('org-a'), userId: 'u2', employeeId: 'e2-a' }, ['e1-a']);
		expect(result).toMatchObject({ created: false, conversation: { id: 'direct-a' } });
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});

	it('answers the loser of a race with the winner of its own organization, not another organization’s', async () => {
		const winner: Conversation = { ...directOfA(), id: 'direct-b', organizationId: 'org-b', createdByEmployeeId: 'e2-b', createdAt: new Date() };
		const { service, repository, realtime } = directOver([directOfA()], { raceWinner: winner });
		const result = await service.direct(u1In('org-b'), ['e2-b']);
		expect(result).toMatchObject({ created: false, conversation: { id: 'direct-b' }, events: [] });
		// The winner announced it; the loser's transaction (and anything it appended) rolled back.
		expect(realtime.publish).not.toHaveBeenCalled();
		expect(repository.findOne.mock.calls[1][0].where).toEqual({ tenantId: 'ten', organizationId: 'org-b', directKey: directKeyOf(['u1', 'u2']) });
	});

	it('keeps the tenant-wide lookup of a caller the request scopes to no organization', async () => {
		const { service, repository, dataSource } = directOver([directOfA()]);
		const result = await service.direct(u1In(null), ['e2-a']);
		expect(result).toMatchObject({ created: false, conversation: { id: 'direct-a' } });
		expect(repository.findOne.mock.calls[0][0].where).toEqual({ tenantId: 'ten', directKey: directKeyOf(['u1', 'u2']) });
		expect(dataSource.transaction).not.toHaveBeenCalled();
	});
});
