import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchFilterOperator } from '@gauzy/contracts';
import { SearchService } from '@gauzy/plugin-search';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatMessageService } from './chat-message.service';
import { ChatSearchService } from './chat-search.service';

const caller: IChatCaller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };

function searchOver(options: { memberOf?: string[]; hits?: Array<{ entityId: string }>; total?: number; rows?: Array<{ id: string; conversationId: string; deletedAt?: Date | null }> } = {}) {
	const members = { find: jest.fn(async (_options: { where: Record<string, unknown> }) => (options.memberOf ?? ['c1', 'c2']).map((conversationId) => ({ conversationId }))) };
	const messages = { find: jest.fn(async () => options.rows ?? []) };
	const dataSource = { getRepository: (entity: { name?: string }) => (entity?.name === 'ChatMember' ? members : messages) } as unknown as DataSource;
	const search = jest.fn(async () => ({ items: options.hits ?? [], total: options.total ?? (options.hits ?? []).length, facets: [], searchedEntities: ['chat_message'], pageInfo: {} }));
	const withRelations = jest.fn(async (_caller: IChatCaller, rows: Array<{ id: string }>) => rows.map((row) => ({ ...row, reactions: [], taskReferences: [], following: false })));
	const service = new ChatSearchService(dataSource, {} as ChatAccessService, { withRelations } as unknown as ChatMessageService, { searchWithin: search } as unknown as SearchService);
	return { service, search, members, messages, withRelations };
}

describe('ChatSearchService', () => {
	it('searches the caller\'s conversations only, and answers the hits as messages in the index\'s order', async () => {
		const { service, search, withRelations } = searchOver({
			hits: [{ entityId: 'm2' }, { entityId: 'm1' }, { entityId: 'm9' }],
			total: 3,
			rows: [{ id: 'm1', conversationId: 'c1' }, { id: 'm2', conversationId: 'c2' }]
		});
		const result = await service.search(caller, { q: 'deploy', limit: 10 });
		expect(search).toHaveBeenCalledWith(expect.objectContaining({
			q: 'deploy',
			entities: ['chat_message'],
			filters: [{ attribute: 'conversationId', operator: SearchFilterOperator.IN, value: ['c1', 'c2'], entity: 'chat_message' }],
			take: 10,
			skip: 0
		}));
		// m9 is not a row any more (deleted since it was indexed): left out; the order is the index's.
		expect(result.messages.map((message) => message.id)).toEqual(['m2', 'm1']);
		expect(result.total).toBe(3);
		expect(result.hasMore).toBe(false);
		expect(withRelations).toHaveBeenCalledTimes(1);
	});

	it('reads the memberships I have not left, and asks the scoped search (the declaration is private)', async () => {
		const { service, members, search } = searchOver({ hits: [] });
		await service.search(caller, { q: 'hello' });
		expect(members.find).toHaveBeenCalledTimes(1);
		expect(members.find.mock.calls[0][0].where).toMatchObject({ tenantId: 'ten', userId: 'u1', leftAt: { _type: 'isNull' } });
		expect(search).toHaveBeenCalledTimes(1);
	});

	it('narrows to one conversation of mine, and answers 404 for one I am not in', async () => {
		const { service, search } = searchOver({ memberOf: ['c1'] });
		await service.search(caller, { q: 'x', conversationId: 'c1' });
		expect(search).toHaveBeenCalledWith(expect.objectContaining({ filters: [expect.objectContaining({ value: ['c1'] })] }));
		await expect(service.search(caller, { q: 'x', conversationId: 'c2' })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('never queries the index with no conversation, and refuses an empty query', async () => {
		const { service, search } = searchOver({ memberOf: [] });
		expect(await service.search(caller, { q: 'x' })).toEqual({ messages: [], total: 0, hasMore: false });
		expect(search).not.toHaveBeenCalled();
		await expect(service.search(caller, { q: '  ' })).rejects.toThrow('A search needs a query.');
	});

	it('refuses a skip past the cap, and says no more hits once the next page would start past it', async () => {
		const { service } = searchOver({ hits: [{ entityId: 'm1' }], total: 20_000, rows: [{ id: 'm1', conversationId: 'c1' }] });
		await expect(service.search(caller, { q: 'hello', skip: 10_001 })).rejects.toBeInstanceOf(BadRequestException);
		const last = await service.search(caller, { q: 'hello', skip: 9_990, limit: 20 });
		expect(last.hasMore).toBe(false);
	});

	it('pages with skip and says whether more hits follow', async () => {
		const { service } = searchOver({ hits: [{ entityId: 'm3' }], total: 7, rows: [{ id: 'm3', conversationId: 'c1' }] });
		const result = await service.search(caller, { q: 'x', limit: 1, skip: 2 });
		expect(result.hasMore).toBe(true);
	});
});
