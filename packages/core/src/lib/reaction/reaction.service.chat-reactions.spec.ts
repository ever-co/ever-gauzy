/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema, FindOptionsWhere, Repository } from 'typeorm';
import { ReactionEntityEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { ReactionService } from './reaction.service';

/**
 * The generic reaction routes (`/reaction`, the `reaction*` GraphQL fields) never read nor edit a chat message's
 * reaction: those go through the chat API, which checks the caller's membership of the conversation. `create`
 * already refused the kind; the reads and the other writes did not, so any employee of the tenant could list every
 * chat reaction (emoji, employee, message id) of conversations they are not in, and change the emoji of their own
 * chat reaction after leaving the conversation.
 *
 * The CRUD base is played by a real in-memory store: each base read runs the condition `ReactionService` hands it,
 * so what a route answers is what that condition selects.
 */

interface IReactionRow {
	id: string;
	tenantId: string;
	entity: string;
	entityId: string;
	employeeId: string;
	emoji: string;
}

const ROWS: ReadonlyArray<IReactionRow> = [
	{
		id: 'task-mine',
		tenantId: 't1',
		entity: ReactionEntityEnum.Task,
		entityId: 'task-1',
		employeeId: 'employee-me',
		emoji: '👍'
	},
	{
		id: 'comment-theirs',
		tenantId: 't1',
		entity: ReactionEntityEnum.Comment,
		entityId: 'comment-1',
		employeeId: 'employee-other',
		emoji: '🎉'
	},
	{
		id: 'chat-mine',
		tenantId: 't1',
		entity: ReactionEntityEnum.ChatMessage,
		entityId: 'message-1',
		employeeId: 'employee-me',
		emoji: '👀'
	},
	{
		id: 'chat-theirs',
		tenantId: 't1',
		entity: ReactionEntityEnum.ChatMessage,
		entityId: 'message-2',
		employeeId: 'employee-other',
		emoji: '❤️'
	}
];

const ReactionRowSchema = new EntitySchema<IReactionRow>({
	name: 'ChatReactionsReactionRow',
	tableName: 'reaction',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		entity: { type: 'varchar' },
		entityId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		emoji: { type: 'varchar' }
	}
});

const idsOf = (rows: ReadonlyArray<{ id?: string }>): string[] => rows.map((row) => row.id as string).sort();

describe('ReactionService — the generic routes leave chat messages’ reactions to the chat API', () => {
	let dataSource: DataSource;
	let store: Repository<IReactionRow>;
	let service: ReactionService;
	let baseUpdate: jest.SpyInstance;
	let baseSoftRemove: jest.SpyInstance;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [ReactionRowSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		store = dataSource.getRepository(ReactionRowSchema) as unknown as Repository<IReactionRow>;
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await store.clear();
		await store.insert([...ROWS]);
		service = Object.create(ReactionService.prototype);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('t1');
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-me');
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		const base = TenantAwareCrudService.prototype;
		const list = async (filter?: { where?: FindOptionsWhere<IReactionRow> }) => {
			const items = await store.find({ where: filter?.where });
			return { items, total: items.length };
		};
		jest.spyOn(base, 'findAll').mockImplementation(list as never);
		jest.spyOn(base, 'paginate').mockImplementation(list as never);
		jest.spyOn(base, 'countBy').mockImplementation((async (where?: FindOptionsWhere<IReactionRow>) =>
			store.count({ where })) as never);
		jest.spyOn(base, 'findOneByIdString').mockImplementation((async (
			id: string,
			options?: { where?: FindOptionsWhere<IReactionRow> }
		) => {
			const row = await store.findOne({ where: { ...(options?.where ?? {}), id } });
			if (!row) throw new NotFoundException('The requested record was not found');
			return row;
		}) as never);
		jest.spyOn(base, 'findOneByWhereOptions').mockImplementation((async (where: FindOptionsWhere<IReactionRow>) =>
			store.findOne({ where })) as never);
		jest.spyOn(base, 'delete').mockImplementation((async (
			id: string,
			options?: { where?: FindOptionsWhere<IReactionRow> }
		) => store.delete({ ...(options?.where ?? {}), id })) as never);
		baseUpdate = jest.spyOn(base, 'update').mockImplementation((async (id: string, input: { emoji: string }) => {
			await store.update({ id }, { emoji: input.emoji });
			return store.findOneBy({ id });
		}) as never);
		baseSoftRemove = jest
			.spyOn(CrudService.prototype, 'softRemove')
			.mockResolvedValue({ deletedAt: new Date() } as never);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lists, pages and counts every reaction but a chat message’s (GET /reaction, /pagination, /count; reactions, reactionCount)', async () => {
		expect(idsOf((await service.findAll()).items)).toEqual(['comment-theirs', 'task-mine']);
		expect(idsOf((await service.findAll({ withDeleted: true } as never)).items)).toEqual([
			'comment-theirs',
			'task-mine'
		]);
		expect(idsOf((await service.paginate({ take: 10 } as never)).items)).toEqual(['comment-theirs', 'task-mine']);
		expect(await service.countBy()).toBe(2);
	});

	it('keeps the caller’s own condition, and answers no chat reaction even when asked for them', async () => {
		expect(idsOf((await service.findAll({ where: { entity: ReactionEntityEnum.Task } } as never)).items)).toEqual([
			'task-mine'
		]);
		expect(
			idsOf((await service.findAll({ where: { entity: ReactionEntityEnum.ChatMessage } } as never)).items)
		).toEqual([]);
		expect(idsOf((await service.paginate({ where: { entityId: 'message-2' } } as never)).items)).toEqual([]);
		expect(await service.countBy({ employeeId: 'employee-me' } as never)).toBe(1);
		expect(await service.countBy({ entity: ReactionEntityEnum.ChatMessage } as never)).toBe(0);
	});

	it('reads a chat message’s reaction by id as one that does not exist (GET /reaction/:id, reaction), and any other as before', async () => {
		await expect(service.findOneByIdString('chat-theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.findOneByIdString('chat-mine', {} as never)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.findOneByIdString('comment-theirs')).resolves.toMatchObject({
			id: 'comment-theirs',
			emoji: '🎉'
		});
	});

	it('refuses to change the emoji of the caller’s own chat reaction (PUT /reaction/:id, updateReaction), and writes nothing', async () => {
		await expect(service.update('chat-mine', { emoji: '🔥' } as never)).rejects.toThrow(
			'Reactions to chat messages are managed through the chat API.'
		);
		await expect(service.update('chat-mine', { emoji: '🔥' } as never)).rejects.toBeInstanceOf(BadRequestException);
		expect(baseUpdate).not.toHaveBeenCalled();
		expect((await store.findOneBy({ id: 'chat-mine' }))?.emoji).toBe('👀');
	});

	it('still changes the emoji of the caller’s own other reaction, and refuses another employee’s as before', async () => {
		await expect(service.update('task-mine', { emoji: '🔥' } as never)).resolves.toMatchObject({
			id: 'task-mine',
			emoji: '🔥'
		});
		await expect(service.update('comment-theirs', { emoji: '🔥' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect((await store.findOneBy({ id: 'comment-theirs' }))?.emoji).toBe('🎉');
	});

	it('leaves the caller’s own chat reaction to the chat API on delete and on withdraw (DELETE /reaction/:id, /soft)', async () => {
		await expect(service.delete('chat-mine')).resolves.toMatchObject({ affected: 0 });
		await expect(service.softRemove('chat-mine')).rejects.toBeInstanceOf(NotFoundException);
		expect(baseSoftRemove).not.toHaveBeenCalled();
		expect(await store.findOneBy({ id: 'chat-mine' })).not.toBeNull();
		await expect(service.delete('task-mine')).resolves.toMatchObject({ affected: 1 });
	});
});
