import { DataSource, EntitySchema as TypeOrmEntitySchema, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { ReactionEntityEnum } from '@gauzy/contracts';
import { parseTypeORMFindToMikroOrm } from '../core/utils';
import { CHAT_REACTIONS_REFUSAL, isChatReaction, withoutChatReactions } from './reaction-chat-scope';

/** The condition as `ReactionService` hands it to the CRUD base. */
const scoped = (where?: FindOptionsWhere<any> | FindOptionsWhere<any>[]) => withoutChatReactions<any>(where);

/**
 * The generic reaction routes leave chat messages' reactions out (`withoutChatReactions`): every condition they read
 * or delete by is run here on a real in-memory better-sqlite3 store per ORM, from the same rows, and selects every
 * reaction the caller's own condition selects — except a chat message's. The non-chat rows a condition selects are
 * the rows it selected before.
 */

interface IReactionRow {
	id: string;
	entity: string;
	employeeId: string;
}

const ROWS: ReadonlyArray<IReactionRow> = [
	{ id: 'task-1', entity: ReactionEntityEnum.Task, employeeId: 'e1' },
	{ id: 'comment-1', entity: ReactionEntityEnum.Comment, employeeId: 'e1' },
	{ id: 'chat-1', entity: ReactionEntityEnum.ChatMessage, employeeId: 'e1' },
	{ id: 'chat-2', entity: ReactionEntityEnum.ChatMessage, employeeId: 'e2' },
	{ id: 'task-2', entity: ReactionEntityEnum.Task, employeeId: 'e2' }
];

const TypeOrmReactionSchema = new TypeOrmEntitySchema<IReactionRow>({
	name: 'ChatScopeReaction',
	tableName: 'chat_scope_reaction',
	columns: {
		id: { primary: true, type: 'varchar' },
		entity: { type: 'varchar' },
		employeeId: { type: 'varchar' }
	}
});

class ChatScopeReaction {
	id!: string;
	entity!: string;
	employeeId!: string;
}

const MikroOrmReactionSchema = new EntitySchema<ChatScopeReaction>({
	class: ChatScopeReaction,
	tableName: 'chat_scope_reaction',
	properties: {
		id: { type: 'string', primary: true },
		entity: { type: 'string' },
		employeeId: { type: 'string' }
	}
});

const INSERT = 'INSERT INTO chat_scope_reaction (id, entity, employeeId) VALUES (?, ?, ?)';

/** The caller's condition, the rows it selected before, and the rows it selects with chat reactions left out. */
const CASES: ReadonlyArray<[label: string, where: () => FindOptionsWhere<any> | undefined, ids: string[]]> = [
	['no condition (GET /reaction, reactions, reactionCount)', () => undefined, ['comment-1', 'task-1', 'task-2']],
	['a condition on another column', () => ({ employeeId: 'e1' }), ['comment-1', 'task-1']],
	['entity = Task (unchanged)', () => ({ entity: ReactionEntityEnum.Task }), ['task-1', 'task-2']],
	['entity = ChatMessage (none)', () => ({ entity: ReactionEntityEnum.ChatMessage }), []],
	[
		'entity IN (Task, ChatMessage)',
		() => ({ entity: In([ReactionEntityEnum.Task, ReactionEntityEnum.ChatMessage]) }),
		['task-1', 'task-2']
	],
	['entity NOT Comment', () => ({ entity: Not(ReactionEntityEnum.Comment) }), ['task-1', 'task-2']]
];

const idsOf = (rows: ReadonlyArray<{ id: string }>): string[] => rows.map((row) => row.id).sort();

describe('withoutChatReactions selects every reaction the condition selects but a chat message’s, on both ORMs', () => {
	let dataSource: DataSource;
	let typeOrmRows: Repository<IReactionRow>;
	let orm: MikroORM<BetterSqliteDriver>;

	const mikroOrmWhere = (where: FindOptionsWhere<any> | FindOptionsWhere<any>[]) =>
		parseTypeORMFindToMikroOrm<ChatScopeReaction>({ where } as never).where;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TypeOrmReactionSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		typeOrmRows = dataSource.getRepository(TypeOrmReactionSchema) as unknown as Repository<IReactionRow>;
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [MikroOrmReactionSchema],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true
		});
		await orm.em
			.getConnection()
			.execute(
				'CREATE TABLE chat_scope_reaction (id varchar PRIMARY KEY NOT NULL, entity varchar NOT NULL, employeeId varchar NOT NULL)'
			);
	});

	afterAll(async () => {
		await dataSource?.destroy();
		await orm?.close(true);
	});

	beforeEach(async () => {
		const connection = orm.em.getConnection();
		await dataSource.query('DELETE FROM chat_scope_reaction');
		await connection.execute('DELETE FROM chat_scope_reaction');
		for (const row of ROWS) {
			await dataSource.query(INSERT, [row.id, row.entity, row.employeeId]);
			await connection.execute(INSERT, [row.id, row.entity, row.employeeId]);
		}
	});

	it.each(CASES)('%s', async (_label, where, ids) => {
		expect(idsOf(await typeOrmRows.find({ where: scoped(where()) }))).toEqual(ids);
		expect(idsOf(await orm.em.fork().find(ChatScopeReaction, mikroOrmWhere(scoped(where()))))).toEqual(ids);
		expect(await typeOrmRows.count({ where: scoped(where()) })).toBe(ids.length);
	});

	it('gives each alternative of a list the condition, and reads an empty list as none', async () => {
		const alternatives = () => [{ employeeId: 'e2' }, { entity: ReactionEntityEnum.Comment }];
		expect(idsOf(await typeOrmRows.find({ where: scoped(alternatives()) }))).toEqual(['comment-1', 'task-2']);
		expect(idsOf(await orm.em.fork().find(ChatScopeReaction, mikroOrmWhere(scoped(alternatives()))))).toEqual([
			'comment-1',
			'task-2'
		]);
		expect(scoped([])).toEqual({ entity: Not(ReactionEntityEnum.ChatMessage) });
	});

	it('deletes the caller’s own reaction by id, but never a chat message’s, on both ORMs (DELETE /reaction/:id)', async () => {
		const own = (id: string) => scoped({ id, employeeId: 'e1' });
		await expect(typeOrmRows.delete(own('chat-1'))).resolves.toMatchObject({ affected: 0 });
		await expect(orm.em.fork().nativeDelete(ChatScopeReaction, mikroOrmWhere(own('chat-1')))).resolves.toBe(0);
		await expect(typeOrmRows.delete(own('task-1'))).resolves.toMatchObject({ affected: 1 });
		await expect(orm.em.fork().nativeDelete(ChatScopeReaction, mikroOrmWhere(own('task-1')))).resolves.toBe(1);
		const left = 'SELECT id FROM chat_scope_reaction';
		expect(idsOf(await dataSource.query(left))).toEqual(['chat-1', 'chat-2', 'comment-1', 'task-2']);
		expect(idsOf(await orm.em.getConnection().execute(left))).toEqual(['chat-1', 'chat-2', 'comment-1', 'task-2']);
	});

	it('names a chat message’s reaction, whatever form its kind takes', () => {
		expect(isChatReaction({ entity: ReactionEntityEnum.ChatMessage })).toBe(true);
		expect(isChatReaction({ entity: 'ChatMessage' })).toBe(true);
		expect(isChatReaction({ entity: ReactionEntityEnum.Task })).toBe(false);
		expect(isChatReaction(null)).toBe(false);
		expect(CHAT_REACTIONS_REFUSAL).toMatch(/chat API/);
	});
});
