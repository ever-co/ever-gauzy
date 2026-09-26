import 'reflect-metadata';
import { DataSource, EntitySchema, QueryRunner } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/knex';
import { AddProductCategoryClosure1791000000550 } from '../database/migrations/1791000000550-AddProductCategoryClosure';
import { RebuildProductCategoryClosure1791000000555 } from '../database/migrations/1791000000555-RebuildProductCategoryClosure';
import {
	IProductCategoryClosureRunner,
	mikroOrmClosureRunner,
	ProductCategoryClosure,
	typeOrmClosureRunner
} from './product-category-closure';

/**
 * The closure table of the category tree, against real SQLite (schema §2.2, task CE-97).
 *
 * What this suite pins is the SQL, run for real, through both ORMs' runners: that a create records
 * every (ancestor, descendant) pair and not only the self-pair (C7-3), that a move cuts a subtree from
 * its old ancestors and ties it to its new ones without touching its inside, that a delete leaves each
 * child's subtree as a tree of its own, that none of it reaches a row of another tenant, and that the
 * rebuild migration brings a database that already ran 550 — with only self-pairs, a dangling parent
 * and a loop in it — to the tree `parentId` describes.
 *
 * The TypeORM half also reads the pairs back through TypeORM's own `TreeRepository`, over a fixture
 * mapped exactly as `ProductCategory` is (`@Tree('closure-table')`, `@TreeParent` joined on
 * `parentId`): the reader the service uses is the reader that has to see what these statements write.
 *
 * Postgres and MySQL are not available to this suite; the statements use only constructs all four
 * dialects accept (see `ProductCategoryClosure`), and the dialect-specific parts — quoting and
 * placeholders — are exactly what each runner supplies.
 */

const T1 = 'tenant-1';
const T2 = 'tenant-2';

/** The table `product_category` is, reduced to the columns the tree reads. */
const CREATE_CATEGORY_TABLE =
	'CREATE TABLE "product_category" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "parentId" varchar, "deletedAt" datetime)';

type Row = { id: string; tenantId?: string | null; parentId?: string | null };

/** The pairs as `ancestor>descendant`, sorted, so an assertion reads as the tree it describes. */
function asPairs(rows: Array<{ ancestor: string; descendant: string }>): string[] {
	return rows.map((row) => `${row.ancestor}>${row.descendant}`).sort();
}

/** The closure of a tree given as `child: parent`, self-pairs included — the answer every case expects. */
function closureOf(tree: Record<string, string | null>): string[] {
	const pairs: string[] = [];

	for (const node of Object.keys(tree)) {
		let current: string | null = node;
		const seen = new Set<string>();

		while (current && !seen.has(current)) {
			seen.add(current);
			pairs.push(`${current}>${node}`);
			current = tree[current] ?? null;
		}
	}

	return pairs.sort();
}

/**
 * The same scenarios, once per ORM. `harness` owns a database with `product_category` and the closure
 * table 550 creates, and answers the runner, the rows and the pairs.
 */
interface IHarness {
	runner(): IProductCategoryClosureRunner;
	insert(rows: Row[]): Promise<void>;
	pairs(): Promise<string[]>;
	/** Runs `work` in a transaction on the harness's own manager, handing it that manager's runner. */
	transaction(work: (runner: IProductCategoryClosureRunner) => Promise<void>): Promise<void>;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
	await dataSource.initialize();
	await dataSource.query(CREATE_CATEGORY_TABLE);

	const queryRunner = dataSource.createQueryRunner();
	await new AddProductCategoryClosure1791000000550().up(queryRunner);
	await queryRunner.release();

	return {
		runner: () => typeOrmClosureRunner(dataSource.manager),
		insert: async (rows) => {
			for (const row of rows) {
				await dataSource.query('INSERT INTO "product_category" ("id", "tenantId", "parentId") VALUES (?, ?, ?)', [
					row.id,
					row.tenantId ?? T1,
					row.parentId ?? null
				]);
			}
		},
		pairs: async () =>
			asPairs(
				await dataSource.query(
					'SELECT "id_ancestor" AS "ancestor", "id_descendant" AS "descendant" FROM "product_category_closure"'
				)
			),
		transaction: (work) => dataSource.manager.transaction((manager) => work(typeOrmClosureRunner(manager))),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	// MikroORM needs one entity to start; the table itself is created from 550's own DDL below.
	const placeholder = new MikroOrmEntitySchema({
		name: 'ClosureSpecPlaceholder',
		properties: { id: { type: 'string', primary: true } }
	});
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [placeholder],
		namingStrategy: EntityCaseNamingStrategy,
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	const em = orm.em as MikroOrmEntityManager;

	await em.execute(CREATE_CATEGORY_TABLE, [], 'run');
	// 550's SQLite DDL, run through MikroORM's connection: the migration only ever calls `query`.
	await new AddProductCategoryClosure1791000000550().sqliteUpQueryRunner({
		query: (sql: string) => em.execute(sql, [], 'run')
	} as unknown as QueryRunner);

	return {
		runner: () => mikroOrmClosureRunner(em),
		insert: async (rows) => {
			for (const row of rows) {
				await em.execute(
					'INSERT INTO "product_category" ("id", "tenantId", "parentId") VALUES (?, ?, ?)',
					[row.id, row.tenantId ?? T1, row.parentId ?? null],
					'run'
				);
			}
		},
		pairs: async () =>
			asPairs(
				await em.execute(
					'SELECT "id_ancestor" AS "ancestor", "id_descendant" AS "descendant" FROM "product_category_closure"'
				)
			),
		transaction: (work) => em.transactional((tx) => work(mikroOrmClosureRunner(tx as MikroOrmEntityManager))),
		close: () => orm.close(true)
	};
}

describe.each([
	['TypeORM', typeOrmHarness],
	['MikroORM', mikroOrmHarness]
])('ProductCategoryClosure through the %s runner (real SQLite)', (_orm, createHarness) => {
	let harness: IHarness;
	let closure: ProductCategoryClosure;

	/** ROOT > BRANCH > LEAF, and OTHER beside it, each attached as the service attaches a new row. */
	async function plantTree(): Promise<void> {
		await harness.insert([{ id: 'ROOT' }, { id: 'OTHER' }]);
		await closure.attach('ROOT', null, T1);
		await closure.attach('OTHER', null, T1);

		await harness.insert([{ id: 'BRANCH', parentId: 'ROOT' }]);
		await closure.attach('BRANCH', 'ROOT', T1);

		await harness.insert([{ id: 'LEAF', parentId: 'BRANCH' }]);
		await closure.attach('LEAF', 'BRANCH', T1);
	}

	beforeEach(async () => {
		harness = await createHarness();
		closure = new ProductCategoryClosure(harness.runner());
	});

	afterEach(async () => {
		await harness?.close();
	});

	it('records a new category with a pair for its parent and every ancestor above it, not only its self-pair (C7-3)', async () => {
		await plantTree();

		expect(await harness.pairs()).toEqual(
			closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' })
		);
		// The two pairs the defect never wrote: the leaf's grandparent and parent.
		expect(await harness.pairs()).toEqual(expect.arrayContaining(['ROOT>LEAF', 'BRANCH>LEAF']));
	});

	it('writes nothing twice when a pair is already there', async () => {
		await plantTree();

		await closure.attach('LEAF', 'BRANCH', T1);

		expect(await harness.pairs()).toEqual(
			closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' })
		);
	});

	it('moves a subtree: cut from the old ancestors, tied to the new ones, the inside untouched', async () => {
		await plantTree();

		await closure.move('BRANCH', 'OTHER', T1);

		expect(await harness.pairs()).toEqual(
			closureOf({ ROOT: null, OTHER: null, BRANCH: 'OTHER', LEAF: 'BRANCH' })
		);
	});

	it('moves a subtree to the top level', async () => {
		await plantTree();

		await closure.move('BRANCH', null, T1);

		expect(await harness.pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: null, LEAF: 'BRANCH' }));
	});

	it('takes a category about to be removed out of the tree, leaving each child a tree of its own', async () => {
		await plantTree();

		await closure.detach('BRANCH', T1);

		// No pair names BRANCH, and nothing above it still reaches LEAF; LEAF keeps its self-pair.
		expect(await harness.pairs()).toEqual(['LEAF>LEAF', 'OTHER>OTHER', 'ROOT>ROOT']);
	});

	it('never writes a pair to, or takes one from, a row of another tenant', async () => {
		await plantTree();
		await harness.insert([{ id: 'FOREIGN', tenantId: T2 }]);
		await closure.attach('FOREIGN', null, T2);

		// A caller in tenant 2 naming tenant 1's rows: nothing is linked, nothing is cut.
		await closure.attach('LEAF', 'FOREIGN', T2);
		await closure.move('BRANCH', 'FOREIGN', T2);
		await closure.detach('ROOT', T2);

		expect(await harness.pairs()).toEqual(
			closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH', FOREIGN: null })
		);

		// Control: the same move in the right tenant does change the pairs, so the refusal above was the
		// tenant condition and not a statement that does nothing.
		await closure.move('BRANCH', 'OTHER', T1);
		expect(await harness.pairs()).toContain('OTHER>LEAF');
	});

	it('writes inside the transaction of the manager it was built from, so a rollback takes the pairs too', async () => {
		await plantTree();

		await expect(
			harness.transaction(async (runner) => {
				await new ProductCategoryClosure(runner).move('BRANCH', 'OTHER', T1);
				throw new Error('the write after the move failed');
			})
		).rejects.toThrow('the write after the move failed');

		expect(await harness.pairs()).toEqual(
			closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' })
		);
	});
});

/**
 * The same fixture TypeORM maps `ProductCategory` with: a closure-table tree whose parent relation is
 * joined on the `parentId` column the entity also declares.
 */
const TreeFixture = new EntitySchema<{ id: string; tenantId?: string; parentId?: string | null; parent?: any; children?: any[] }>({
	name: 'ClosureTreeFixture',
	tableName: 'product_category',
	trees: [{ type: 'closure-table' }],
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		parentId: { type: 'varchar', nullable: true }
	},
	relations: {
		parent: {
			type: 'many-to-one',
			target: 'ClosureTreeFixture',
			treeParent: true,
			joinColumn: { name: 'parentId' },
			onDelete: 'SET NULL'
		},
		children: { type: 'one-to-many', target: 'ClosureTreeFixture', treeChildren: true, inverseSide: 'parent' }
	}
});

describe("ProductCategoryClosure and TypeORM's own closure strategy (real SQLite)", () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TreeFixture],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
	});

	afterEach(async () => {
		await dataSource?.destroy();
	});

	const descendantsOf = async (id: string) =>
		(await dataSource.getTreeRepository(TreeFixture).findDescendants({ id } as any)).map((row) => row.id).sort();

	it('CONTROL: a row inserted with only `parentId` gets its self-pair and nothing else (the C7-3 defect)', async () => {
		const rows = dataSource.getRepository(TreeFixture);

		await rows.save({ id: 'ROOT', tenantId: T1 });
		await rows.save({ id: 'CHILD', tenantId: T1, parentId: 'ROOT' });

		// The column is stored — and the tree reader cannot see the child, because the executor reads
		// the `parent` relation, not the column.
		expect((await rows.findOneBy({ id: 'CHILD' }))?.parentId).toBe('ROOT');
		expect(await descendantsOf('ROOT')).toEqual(['ROOT']);
	});

	it("is read by TypeORM's tree repository: a child attached from `parentId` is ROOT's descendant", async () => {
		const rows = dataSource.getRepository(TreeFixture);
		const closure = new ProductCategoryClosure(typeOrmClosureRunner(dataSource.manager));

		await rows.save({ id: 'ROOT', tenantId: T1 });
		await rows.save({ id: 'CHILD', tenantId: T1, parentId: 'ROOT' });
		await closure.attach('CHILD', 'ROOT', T1);

		expect(await descendantsOf('ROOT')).toEqual(['CHILD', 'ROOT']);
	});

	it('agrees with the pairs TypeORM writes itself when the relation is set, without a duplicate key', async () => {
		const rows = dataSource.getRepository(TreeFixture);
		const closure = new ProductCategoryClosure(typeOrmClosureRunner(dataSource.manager));

		await rows.save({ id: 'ROOT', tenantId: T1 });
		await rows.save({ id: 'CHILD', tenantId: T1, parent: { id: 'ROOT' } });
		// What the service's TypeORM create relies on: the executor wrote ROOT>CHILD with the row.
		expect(await descendantsOf('ROOT')).toEqual(['CHILD', 'ROOT']);

		// And the maintenance on top of it is a no-op rather than a primary-key violation.
		await expect(closure.attach('CHILD', 'ROOT', T1)).resolves.toBeUndefined();

		await rows.save({ id: 'OTHER', tenantId: T1 });
		await dataSource.query('UPDATE "product_category" SET "parentId" = ? WHERE "id" = ?', ['OTHER', 'CHILD']);
		await closure.move('CHILD', 'OTHER', T1);

		expect(await descendantsOf('ROOT')).toEqual(['ROOT']);
		expect(await descendantsOf('OTHER')).toEqual(['CHILD', 'OTHER']);
	});
});

describe('1791000000555-RebuildProductCategoryClosure (real SQLite)', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const pairs = async () =>
		asPairs(
			await dataSource.query(
				'SELECT "id_ancestor" AS "ancestor", "id_descendant" AS "descendant" FROM "product_category_closure"'
			)
		);
	const parentOf = async (id: string) =>
		(await dataSource.query('SELECT "parentId" FROM "product_category" WHERE "id" = ?', [id]))[0]?.parentId ?? null;

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		await dataSource.query(CREATE_CATEGORY_TABLE);

		// A database as it stood before 550: `parentId` already existed, with no constraint, so it holds
		// a tree, a parent that was removed, a parent in another tenant and — as SQLite could store while
		// the cycle guard read an empty closure — a loop.
		const rows: Row[] = [
			{ id: 'ROOT' },
			{ id: 'BRANCH', parentId: 'ROOT' },
			{ id: 'LEAF', parentId: 'BRANCH' },
			{ id: 'ORPHAN', parentId: 'REMOVED' },
			{ id: 'FOREIGN', tenantId: T2, parentId: 'ROOT' },
			{ id: 'LOOP_A', parentId: 'LOOP_B' },
			{ id: 'LOOP_B', parentId: 'LOOP_A' },
			{ id: 'UNDER_LOOP', parentId: 'LOOP_A' }
		];

		for (const row of rows) {
			await dataSource.query('INSERT INTO "product_category" ("id", "tenantId", "parentId") VALUES (?, ?, ?)', [
				row.id,
				row.tenantId ?? T1,
				row.parentId ?? null
			]);
		}

		queryRunner = dataSource.createQueryRunner();
		await new AddProductCategoryClosure1791000000550().up(queryRunner);
	});

	afterEach(async () => {
		await queryRunner?.release();
		await dataSource?.destroy();
	});

	it('CONTROL: 550 alone leaves an existing tree with self-pairs only', async () => {
		expect(await pairs()).not.toContain('ROOT>BRANCH');
		expect(await pairs()).not.toContain('ROOT>LEAF');
	});

	it('writes every pair `parentId` describes, and repairs the dangling parent, the foreign parent and the loop', async () => {
		await new RebuildProductCategoryClosure1791000000555().up(queryRunner);

		expect(await parentOf('ORPHAN')).toBeNull();
		expect(await parentOf('FOREIGN')).toBeNull();
		expect(await parentOf('LOOP_A')).toBeNull();
		expect(await parentOf('LOOP_B')).toBeNull();
		// Below the loop is not on it: it keeps its parent.
		expect(await parentOf('UNDER_LOOP')).toBe('LOOP_A');
		expect(await parentOf('LEAF')).toBe('BRANCH');

		expect(await pairs()).toEqual(
			closureOf({
				ROOT: null,
				BRANCH: 'ROOT',
				LEAF: 'BRANCH',
				ORPHAN: null,
				FOREIGN: null,
				LOOP_A: null,
				LOOP_B: null,
				UNDER_LOOP: 'LOOP_A'
			})
		);
	});

	it('is a no-op the second time', async () => {
		await new RebuildProductCategoryClosure1791000000555().up(queryRunner);
		const first = await pairs();

		await new RebuildProductCategoryClosure1791000000555().up(queryRunner);

		expect(await pairs()).toEqual(first);
	});

	it('answers a deep tree in full', async () => {
		// A chain deeper than the categories above, so the passes have to repeat.
		const chain = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5'];

		for (const [index, id] of chain.entries()) {
			await dataSource.query('INSERT INTO "product_category" ("id", "tenantId", "parentId") VALUES (?, ?, ?)', [
				id,
				T1,
				index === 0 ? null : chain[index - 1]
			]);
		}

		await new RebuildProductCategoryClosure1791000000555().up(queryRunner);

		expect(await pairs()).toEqual(expect.arrayContaining(['D0>D5', 'D1>D5', 'D4>D5', 'D0>D1']));
		expect((await pairs()).filter((pair) => pair.endsWith('>D5'))).toHaveLength(6);
	});
});
