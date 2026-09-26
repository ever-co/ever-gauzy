import {
	And,
	Between,
	DataSource,
	EntitySchema as TypeOrmEntitySchema,
	Equal,
	FindOptionsWhere,
	In,
	IsNull,
	LessThan,
	Like,
	MoreThan,
	MoreThanOrEqual,
	Not,
	Repository
} from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { convertTypeORMWhereToMikroORM, parseTypeORMFindToMikroOrm } from './utils';

/**
 * A negated predicate — `Not(In([...]))`, `Not(Like(...))`, `Not(MoreThan(n))` — selects the same rows on BOTH ORMs.
 *
 * **The defect.** `processFindOperator` translates a negated condition to `{ $not: <condition> }` on its property,
 * and MikroORM's SQL drivers have no `$not` on a property: knex refuses the whole statement with
 * `The operator "not" is not permitted`, whether it is a find, a count, an update or a delete. So under
 * `DB_ORM=mikro-orm` every statement the platform predicates on such a negation failed — among them
 * `RoleService.delete`, whose `name: Not(In(SYSTEM_DEFAULT_ROLES))` guard made every role undeletable, so the
 * authorization probe's throwaway role outlived its run and its name stayed taken. MikroORM negates a condition at
 * the entity level; `convertTypeORMConditionToMikroORM` now lifts each negation there, which is also the SQL TypeORM
 * writes: `not (name in (...))`.
 *
 * Each case states the rows it selects and runs on a real in-memory better-sqlite3 store per ORM, from the same rows.
 * Every MikroORM case fails before the fix with `The operator "not" is not permitted`; the TypeORM cases and the two
 * controls pass before and after it.
 */

/** A row as the stores hold it. */
interface INegationRow {
	id: string;
	name: string | null;
	rank: number | null;
	groupId: string | null;
}

const GROUPS: ReadonlyArray<[id: string, name: string]> = [
	['g1', 'Alpha group'],
	['g2', 'Beta group']
];

/** `r5` has no name, rank or group: a negation of a condition on a NULL is NULL, so neither ORM selects it. */
const ROWS: ReadonlyArray<INegationRow> = [
	{ id: 'r1', name: 'alpha', rank: 1, groupId: 'g1' },
	{ id: 'r2', name: 'beta', rank: 2, groupId: 'g2' },
	{ id: 'r3', name: 'gamma', rank: 3, groupId: 'g1' },
	{ id: 'r4', name: 'delta', rank: 4, groupId: 'g2' },
	{ id: 'r5', name: null, rank: null, groupId: null }
];

const TypeOrmGroupSchema = new TypeOrmEntitySchema<{ id: string; name: string }>({
	name: 'NegationGroup',
	tableName: 'negation_group',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' }
	}
});

const TypeOrmRowSchema = new TypeOrmEntitySchema<INegationRow & { group?: unknown }>({
	name: 'NegationRow',
	tableName: 'negation_row',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar', nullable: true },
		rank: { type: 'integer', nullable: true },
		groupId: { type: 'varchar', nullable: true }
	},
	relations: {
		group: { type: 'many-to-one', target: 'NegationGroup', joinColumn: { name: 'groupId' }, nullable: true }
	}
});

class NegationGroup {
	id!: string;
	name!: string;
}

class NegationRow {
	id!: string;
	name?: string | null;
	rank?: number | null;
	group?: NegationGroup | null;
}

const MikroOrmGroupSchema = new EntitySchema<NegationGroup>({
	class: NegationGroup,
	tableName: 'negation_group',
	properties: {
		id: { type: 'string', primary: true },
		name: { type: 'string' }
	}
});

const MikroOrmRowSchema = new EntitySchema<NegationRow>({
	class: NegationRow,
	tableName: 'negation_row',
	properties: {
		id: { type: 'string', primary: true },
		name: { type: 'string', nullable: true },
		rank: { type: 'integer', nullable: true },
		group: { kind: 'm:1', entity: () => NegationGroup, fieldName: 'groupId', nullable: true }
	}
});

/** Plain SQL, the same on both stores, so the rows do not depend on the code under test. */
const INSERT_GROUP = 'INSERT INTO negation_group (id, name) VALUES (?, ?)';
const INSERT_ROW = 'INSERT INTO negation_row (id, name, rank, groupId) VALUES (?, ?, ?, ?)';

/**
 * The negations the platform writes, each with the rows it selects. The last two are controls: a negated scalar and
 * `Not(IsNull())` translate to `$ne` on the property, which MikroORM has always run.
 */
const CASES: ReadonlyArray<[label: string, where: () => FindOptionsWhere<any>, ids: string[]]> = [
	[
		'Not(In([...])) — the system-role guard of RoleService.delete',
		() => ({ name: Not(In(['alpha', 'beta'])) }),
		['r3', 'r4']
	],
	['Not(Like(...))', () => ({ name: Not(Like('%ta%')) }), ['r1', 'r3']],
	['Not(MoreThan(n))', () => ({ rank: Not(MoreThan(2)) }), ['r1', 'r2']],
	['Not(Between(a, b))', () => ({ rank: Not(Between(2, 3)) }), ['r1', 'r4']],
	[
		'two negations, each on its own property',
		() => ({ name: Not(In(['alpha'])), rank: Not(LessThan(3)) }),
		['r3', 'r4']
	],
	['a negation on a related row’s property', () => ({ group: { name: Not(Like('Beta%')) } }), ['r1', 'r3']],
	[
		'a negation And(...) folds in beside another condition',
		() => ({ rank: And(Not(Equal(3)), MoreThanOrEqual(2)) }),
		['r2', 'r4']
	],
	// And(...) used to merge its parts into one object, so two parts stating the same operator kept only the last.
	['two negations And(...) folds on one property', () => ({ rank: And(Not(Equal(1)), Not(Equal(4))) }), ['r2', 'r3']],
	['two Not(<scalar>) on one property', () => ({ name: And(Not('alpha'), Not('beta')) }), ['r3', 'r4']],
	[
		'two bounds of one kind on one property, the later the weaker',
		() => ({ rank: And(MoreThan(3), MoreThan(1)) }),
		['r4']
	],
	['Not(Not(In([...])))', () => ({ name: Not(Not(In(['alpha', 'beta']))) }), ['r1', 'r2']],
	['control: Not(<scalar>)', () => ({ name: Not('alpha') }), ['r2', 'r3', 'r4']],
	['control: Not(IsNull())', () => ({ name: Not(IsNull()) }), ['r1', 'r2', 'r3', 'r4']]
];

/** The ids a read answered, sorted. */
const idsOf = (rows: ReadonlyArray<{ id: string }>): string[] => rows.map((row) => row.id).sort();

describe('a negated predicate selects the same rows on both ORMs', () => {
	let dataSource: DataSource;
	let typeOrmRows: Repository<INegationRow>;
	let orm: MikroORM<BetterSqliteDriver>;

	/** The where MikroORM is handed for a TypeORM-style one, as every `CrudService` branch hands it. */
	const mikroOrmWhere = (where: FindOptionsWhere<any>) => parseTypeORMFindToMikroOrm<NegationRow>({ where }).where;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TypeOrmGroupSchema, TypeOrmRowSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		typeOrmRows = dataSource.getRepository(TypeOrmRowSchema) as unknown as Repository<INegationRow>;

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [MikroOrmGroupSchema, MikroOrmRowSchema],
			// The platform's own naming strategy (packages/config/src/lib/database.ts).
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true
		});
		const connection = orm.em.getConnection();
		await connection.execute(
			'CREATE TABLE negation_group (id varchar PRIMARY KEY NOT NULL, name varchar NOT NULL)'
		);
		await connection.execute(
			'CREATE TABLE negation_row (id varchar PRIMARY KEY NOT NULL, name varchar NULL, rank integer NULL, groupId varchar NULL REFERENCES negation_group (id))'
		);
		for (const group of GROUPS) {
			await dataSource.query(INSERT_GROUP, group);
			await connection.execute(INSERT_GROUP, group);
		}
	});

	afterAll(async () => {
		await dataSource?.destroy();
		await orm?.close(true);
	});

	beforeEach(async () => {
		const connection = orm.em.getConnection();
		await dataSource.query('DELETE FROM negation_row');
		await connection.execute('DELETE FROM negation_row');
		for (const row of ROWS) {
			const values = [row.id, row.name, row.rank, row.groupId];
			await dataSource.query(INSERT_ROW, values);
			await connection.execute(INSERT_ROW, values);
		}
	});

	it.each(CASES)('%s', async (_label, where, ids) => {
		expect(idsOf(await typeOrmRows.find({ where: where() }))).toEqual(ids);
		expect(idsOf(await orm.em.fork().find(NegationRow, mikroOrmWhere(where())))).toEqual(ids);
	});

	it('counts, updates and deletes by the system-role guard as it selects, on both ORMs', async () => {
		const guard = () => ({ name: Not(In(['alpha', 'beta'])) });

		await expect(typeOrmRows.count({ where: guard() })).resolves.toBe(2);
		await expect(orm.em.fork().count(NegationRow, mikroOrmWhere(guard()))).resolves.toBe(2);

		await expect(typeOrmRows.update(guard(), { rank: 10 })).resolves.toMatchObject({ affected: 2 });
		await expect(orm.em.fork().nativeUpdate(NegationRow, mikroOrmWhere(guard()), { rank: 10 })).resolves.toBe(2);

		await expect(typeOrmRows.delete(guard())).resolves.toMatchObject({ affected: 2 });
		await expect(orm.em.fork().nativeDelete(NegationRow, mikroOrmWhere(guard()))).resolves.toBe(2);

		const left = 'SELECT id FROM negation_row ORDER BY id';
		expect(idsOf(await dataSource.query(left))).toEqual(['r1', 'r2', 'r5']);
		expect(idsOf(await orm.em.getConnection().execute(left))).toEqual(['r1', 'r2', 'r5']);
	});

	it('lifts each negation to the entity level, where MikroORM negates, and leaves the rest of the where alone', () => {
		expect(
			convertTypeORMWhereToMikroORM({
				id: 'r1',
				name: Not(In(['alpha', 'beta'])),
				rank: Not(Like('%1%')),
				groupId: Not(IsNull())
			} as any)
		).toEqual({
			id: 'r1',
			groupId: { $ne: null },
			$and: [{ $not: { name: { $in: ['alpha', 'beta'] } } }, { $not: { rank: { $like: '%1%' } } }]
		});

		// What `And(...)` folded in beside the negation stays on the property.
		expect(convertTypeORMWhereToMikroORM({ rank: And(Not(Equal(3)), MoreThanOrEqual(2)) } as any)).toEqual({
			rank: { $gte: 2 },
			$and: [{ $not: { rank: { $eq: 3 } } }]
		});
	});
});
