import 'reflect-metadata';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';

jest.mock('../repositories/repositories.service', () => ({
	RepositoriesService: class RepositoriesService {}
}));
jest.mock('../../core', () => ({
	RequestContext: {
		currentTenantId: () => 'tenant-1',
		currentUserId: () => 'u0000000-0000-4000-8000-00000000000u'
	}
}));
// `getORMType` is the real function's rule — `DB_ORM`, TypeORM by default — without loading the module
// that defines it, whose imports pull in the whole configuration.
jest.mock('../../core/utils', () => ({
	convertToDatetime: (value: unknown) => value,
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	getORMType: () => (process.env.DB_ORM === 'mikro-orm' ? 'mikro-orm' : 'typeorm')
}));
jest.mock('../../core/entities/internal', () => ({ Organization: class Organization {} }));
jest.mock('../../core/file-storage', () => ({ FileStorage: class FileStorage {} }));
jest.mock('./commands', () => ({ ImportEntityFieldMapOrCreateCommand: class ImportEntityFieldMapOrCreateCommand {} }));
jest.mock('../import-record', () => ({
	ImportRecordFindOrFailCommand: class ImportRecordFindOrFailCommand {},
	ImportRecordUpdateOrCreateCommand: class ImportRecordUpdateOrCreateCommand {}
}));

import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DataSource, EntitySchema, QueryRunner } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/knex';
import { AddProductCategoryClosure1791000000550 } from '../../database/migrations/1791000000550-AddProductCategoryClosure';
import { ImportService } from './import.service';
import { ProductCategoryClosureRebuild } from './product-category-closure-rebuild';

/**
 * The tenant import and the category tree's closure table, against real SQLite, once per ORM.
 *
 * The import writes `product_category` through its generic path — one repository write per CSV row —
 * and never through `ProductCategoryService`, which is what keeps `product_category_closure` in step with
 * `parentId` everywhere else. So an imported category got no pair naming its parent or any ancestor: the
 * self-pair alone where TypeORM's closure executor wrote the row (it reads the `parent` relation, never
 * `parentId`), and nothing at all where no ORM closure strategy did. Every descendant read, and the cycle
 * guard that reads the same pairs, then saw each imported category as a tree of one.
 *
 * What is pinned here is that, once the table is imported, the importing tenant's pairs are exactly the
 * closure `parentId` describes — on the ORM `DB_ORM` selects, through that ORM's own manager — and that
 * nothing of another tenant is read, repaired or rewritten on the way. Each harness writes an imported row
 * the way its path does: the TypeORM one through a repository `save` over a fixture mapped as
 * `ProductCategory` is (`@Tree('closure-table')`, `@TreeParent` joined on `parentId`), so TypeORM's own
 * executor runs; the MikroORM one as a plain insert, since that ORM has no closure strategy.
 *
 * Postgres and MySQL are not available to this suite; the rebuild's statements use only constructs all four
 * dialects accept, as `ProductCategoryClosure` and `1791000000555` do, and the dialect-specific parts —
 * quoting and placeholders — are exactly what each ORM's runner supplies.
 */

type Row = { id: string; tenantId?: string; parentId?: string | null };

/** The table `product_category` is, reduced to the columns the tree reads. */
const CREATE_CATEGORY_TABLE =
	'CREATE TABLE "product_category" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "parentId" varchar, "deletedAt" datetime)';

/** The same mapping TypeORM gives `ProductCategory`: a closure-table tree whose parent joins on `parentId`. */
const TreeFixture = new EntitySchema<{ id: string; tenantId?: string; parentId?: string | null; parent?: any; children?: any[] }>({
	name: 'ImportClosureTreeFixture',
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
			target: 'ImportClosureTreeFixture',
			treeParent: true,
			joinColumn: { name: 'parentId' },
			onDelete: 'SET NULL'
		},
		children: { type: 'one-to-many', target: 'ImportClosureTreeFixture', treeChildren: true, inverseSide: 'parent' }
	}
});

/** The pairs as `ancestor>descendant`, sorted, so an assertion reads as the tree it describes. */
function asPairs(rows: Array<{ ancestor: string; descendant: string }>): string[] {
	return rows.map((row) => `${row.ancestor}>${row.descendant}`).sort();
}

/** The closure of a tree given as `child: parent`, self-pairs included. */
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

const PAIRS_SQL = 'SELECT "id_ancestor" AS "ancestor", "id_descendant" AS "descendant" FROM "product_category_closure"';

interface IHarness {
	/** `DB_ORM` for this harness. */
	readonly orm: 'typeorm' | 'mikro-orm';
	/** What the import's per-row write does on this path. */
	importRow(row: Row): Promise<void>;
	/** Writes rows and pairs directly, to stand for what a database already holds. */
	seed(rows: Row[], pairs?: string[]): Promise<void>;
	pairs(): Promise<string[]>;
	parentOf(id: string): Promise<string | null>;
	/** The two repositories the import service reaches the category table through. */
	repositories(): Record<string, unknown>;
	close(): Promise<void>;
}

/** A repository the ORM that `DB_ORM` does not select must never be asked for. */
function forbidden(name: string) {
	return {
		get manager(): never {
			throw new Error(`${name} was used on the wrong ORM`);
		},
		getEntityManager(): never {
			throw new Error(`${name} was used on the wrong ORM`);
		}
	};
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TreeFixture],
		synchronize: true,
		logging: false
	});
	await dataSource.initialize();
	// 550 adds no parent constraint on SQLite, so a stored `parentId` may name a row that is not there;
	// the constraint `synchronize` gives the fixture would refuse to seed that state at all.
	await dataSource.query('PRAGMA foreign_keys = OFF');

	const query = (sql: string, parameters: unknown[] = []) => dataSource.query(sql, parameters);

	return {
		orm: 'typeorm',
		// The handler's own write: `repository.save(repository.create(entity))`, `parentId` as a column.
		importRow: async (row) => {
			const repository = dataSource.getRepository(TreeFixture);
			await repository.save(repository.create({ id: row.id, tenantId: TENANT, parentId: row.parentId ?? null }));
		},
		seed: async (rows, pairs = []) => {
			for (const row of rows) {
				await query('INSERT INTO "product_category" ("id", "tenantId", "parentId") VALUES (?, ?, ?)', [
					row.id,
					row.tenantId ?? TENANT,
					row.parentId ?? null
				]);
			}
			for (const pair of pairs) {
				await query('INSERT INTO "product_category_closure" ("id_ancestor", "id_descendant") VALUES (?, ?)', pair.split('>'));
			}
		},
		pairs: async () => asPairs(await query(PAIRS_SQL)),
		parentOf: async (id) => (await query('SELECT "parentId" FROM "product_category" WHERE "id" = ?', [id]))[0]?.parentId ?? null,
		repositories: () => ({
			typeOrmProductCategoryRepository: { manager: dataSource.manager },
			mikroOrmProductCategoryRepository: forbidden('mikroOrmProductCategoryRepository')
		}),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	// MikroORM needs one entity to start; the tables are created from 550's own DDL below.
	const placeholder = new MikroOrmEntitySchema({
		name: 'ImportClosureSpecPlaceholder',
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
	const run = (sql: string, parameters: unknown[] = []) => em.execute(sql, parameters, 'run');

	await run(CREATE_CATEGORY_TABLE);
	await new AddProductCategoryClosure1791000000550().sqliteUpQueryRunner({
		query: (sql: string) => run(sql)
	} as unknown as QueryRunner);

	const exists = async (id: string) =>
		(await em.execute('SELECT "id" FROM "product_category" WHERE "id" = ?', [id], 'all')).length > 0;

	return {
		orm: 'mikro-orm',
		// No closure strategy on this path: the row goes in, and no pair with it.
		importRow: async (row) => {
			if (await exists(row.id)) {
				await run('UPDATE "product_category" SET "parentId" = ? WHERE "id" = ?', [row.parentId ?? null, row.id]);
			} else {
				await run('INSERT INTO "product_category" ("id", "tenantId", "parentId") VALUES (?, ?, ?)', [
					row.id,
					TENANT,
					row.parentId ?? null
				]);
			}
		},
		seed: async (rows, pairs = []) => {
			for (const row of rows) {
				await run('INSERT INTO "product_category" ("id", "tenantId", "parentId") VALUES (?, ?, ?)', [
					row.id,
					row.tenantId ?? TENANT,
					row.parentId ?? null
				]);
			}
			for (const pair of pairs) {
				await run('INSERT INTO "product_category_closure" ("id_ancestor", "id_descendant") VALUES (?, ?)', pair.split('>'));
			}
		},
		pairs: async () => asPairs(await em.execute(PAIRS_SQL, [], 'all')),
		parentOf: async (id) =>
			(await em.execute('SELECT "parentId" FROM "product_category" WHERE "id" = ?', [id], 'all'))[0]?.parentId ?? null,
		repositories: () => ({
			typeOrmProductCategoryRepository: forbidden('typeOrmProductCategoryRepository'),
			mikroOrmProductCategoryRepository: { getEntityManager: () => em }
		}),
		close: () => orm.close(true)
	};
}

describe.each([
	['TypeORM', typeOrmHarness],
	['MikroORM', mikroOrmHarness]
])('ImportService: an imported category tree under %s (real SQLite)', (_orm, createHarness) => {
	const originalOrm = process.env.DB_ORM;
	let harness: IHarness;
	let service: ImportService;
	let extractPath: string;

	/** Writes `product_category.csv` as an export does and runs the import over it. */
	async function importCategories(rows: Row[]): Promise<void> {
		const csv = ['id,tenantId,parentId', ...rows.map((row) => `${row.id},${TENANT},${row.parentId ?? ''}`)].join('\n');

		await fsp.writeFile(path.join(extractPath, 'product_category.csv'), csv + '\n', 'utf8');
		await service.parse(extractPath);
	}

	/** The pairs whose descendant is one of `ids`, as `ancestor>descendant`. */
	async function pairsBelow(ids: string[]): Promise<string[]> {
		return (await harness.pairs()).filter((pair) => ids.includes(pair.split('>')[1]));
	}

	beforeEach(async () => {
		harness = await createHarness();
		process.env.DB_ORM = harness.orm;
		extractPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'gauzy-import-closure-'));

		const repositoriesService: any = {
			buildRepositoriesRelationsGraph: jest.fn(async () => [
				{
					repository: { metadata: { tableName: 'product_category' } },
					isStatic: false,
					relations: [],
					isCheckRelation: false
				}
			]),
			...harness.repositories()
		};

		service = new ImportService({ execute: jest.fn() } as any, repositoriesService);

		// Stop at the row: the id and parent mapping the command handlers do is not what is under test, so
		// the archive's ids are the stored ids, and the row is written the way its path writes it.
		jest.spyOn(service, 'migrateImportEntityRecord').mockImplementation(async (_item, data: Record<string, string>) => {
			await harness.importRow({ id: data['id'], parentId: data['parentId'] || null });
			return true;
		});
	});

	afterEach(async () => {
		if (originalOrm === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = originalOrm;
		}
		await fsp.rm(extractPath, { recursive: true, force: true }).catch(() => undefined);
		await harness?.close();
	});

	it('gives every imported category the pairs its parentId describes, self-pairs included', async () => {
		await importCategories([
			{ id: 'ROOT' },
			{ id: 'BRANCH', parentId: 'ROOT' },
			{ id: 'LEAF', parentId: 'BRANCH' },
			{ id: 'OTHER' }
		]);

		expect(await harness.pairs()).toEqual(closureOf({ ROOT: null, BRANCH: 'ROOT', LEAF: 'BRANCH', OTHER: null }));
		// The pairs the import never wrote: the leaf under its parent and its grandparent.
		expect(await harness.pairs()).toEqual(expect.arrayContaining(['ROOT>LEAF', 'BRANCH>LEAF']));
	});

	it('replaces the pairs of a category a re-import moved, rather than adding to them', async () => {
		// A database that already holds the tree, with its closure complete.
		await harness.seed(
			[{ id: 'ROOT' }, { id: 'OTHER' }, { id: 'BRANCH', parentId: 'ROOT' }, { id: 'LEAF', parentId: 'BRANCH' }],
			closureOf({ ROOT: null, OTHER: null, BRANCH: 'ROOT', LEAF: 'BRANCH' })
		);

		await importCategories([{ id: 'ROOT' }, { id: 'OTHER' }, { id: 'BRANCH', parentId: 'OTHER' }, { id: 'LEAF', parentId: 'BRANCH' }]);

		expect(await harness.pairs()).toEqual(closureOf({ ROOT: null, OTHER: null, BRANCH: 'OTHER', LEAF: 'BRANCH' }));
		expect(await harness.pairs()).not.toContain('ROOT>LEAF');
	});

	it('clears a parent outside the tenant and breaks a loop, as 555 does, and keeps what hangs below the loop', async () => {
		await harness.seed([{ id: 'FOREIGN_ROOT', tenantId: OTHER_TENANT }], ['FOREIGN_ROOT>FOREIGN_ROOT']);
		// A loop reaches the table the way a re-import writes one: rows imported before, each parent
		// then rewritten to a row that is already there.
		await harness.seed(
			[{ id: 'LOOP_A' }, { id: 'LOOP_B', parentId: 'LOOP_A' }, { id: 'UNDER_LOOP', parentId: 'LOOP_A' }],
			closureOf({ LOOP_A: null, LOOP_B: 'LOOP_A', UNDER_LOOP: 'LOOP_A' })
		);

		await importCategories([
			{ id: 'ADOPTED', parentId: 'FOREIGN_ROOT' },
			{ id: 'LOOP_A', parentId: 'LOOP_B' },
			{ id: 'LOOP_B', parentId: 'LOOP_A' },
			{ id: 'UNDER_LOOP', parentId: 'LOOP_A' }
		]);

		expect(await harness.parentOf('ADOPTED')).toBeNull();
		expect(await harness.parentOf('LOOP_A')).toBeNull();
		expect(await harness.parentOf('LOOP_B')).toBeNull();
		expect(await harness.parentOf('UNDER_LOOP')).toBe('LOOP_A');

		expect(await pairsBelow(['ADOPTED', 'LOOP_A', 'LOOP_B', 'UNDER_LOOP'])).toEqual(
			closureOf({ ADOPTED: null, LOOP_A: null, LOOP_B: null, UNDER_LOOP: 'LOOP_A' })
		);
	});

	it("never reads, repairs or rewrites another tenant's categories", async () => {
		// Another tenant's tree, deliberately wrong in the three ways the rebuild repairs: a child with its
		// self-pair only, a loop, and a parent that does not exist. A rebuild that reached past the importing
		// tenant would "fix" every one of them.
		const foreignRows: Row[] = [
			{ id: 'F_ROOT', tenantId: OTHER_TENANT },
			{ id: 'F_CHILD', tenantId: OTHER_TENANT, parentId: 'F_ROOT' },
			{ id: 'F_LOOP_A', tenantId: OTHER_TENANT, parentId: 'F_LOOP_B' },
			{ id: 'F_LOOP_B', tenantId: OTHER_TENANT, parentId: 'F_LOOP_A' },
			{ id: 'F_ORPHAN', tenantId: OTHER_TENANT, parentId: 'F_REMOVED' }
		];
		const foreignPairs = ['F_CHILD>F_CHILD', 'F_LOOP_A>F_LOOP_A', 'F_ROOT>F_ROOT'];

		await harness.seed(foreignRows, foreignPairs);

		await importCategories([{ id: 'ROOT' }, { id: 'LEAF', parentId: 'ROOT' }]);

		expect(await pairsBelow(foreignRows.map((row) => row.id))).toEqual(foreignPairs);

		for (const row of foreignRows) {
			expect(await harness.parentOf(row.id)).toBe(row.parentId ?? null);
		}

		// Control: the importing tenant's own tree was rebuilt in the same run.
		expect(await pairsBelow(['ROOT', 'LEAF'])).toEqual(closureOf({ ROOT: null, LEAF: 'ROOT' }));
	});

	it("rebuilds in one transaction on the ORM's own manager, so a rebuild that fails leaves the previous pairs", async () => {
		const before = closureOf({ ROOT: null, CHILD: 'ROOT' });
		await harness.seed([{ id: 'ROOT' }, { id: 'CHILD', parentId: 'ROOT' }], before);

		// Fails after the pairs were removed and written again, before the rebuild finishes.
		const failing = jest
			.spyOn(ProductCategoryClosureRebuild.prototype as any, 'countOnALoop')
			.mockRejectedValueOnce(new Error('the rebuild failed half-way'));

		try {
			// The import moves CHILD to the top, which the half-done rebuild had already written.
			await expect(importCategories([{ id: 'ROOT' }, { id: 'CHILD' }])).rejects.toThrow('the rebuild failed half-way');
		} finally {
			failing.mockRestore();
		}

		expect(await harness.pairs()).toEqual(before);
	});

	it('leaves the closure alone when the archive carries no product_category.csv', async () => {
		// Pairs a rebuild would change: the child has its self-pair only.
		await harness.seed([{ id: 'ROOT' }, { id: 'CHILD', parentId: 'ROOT' }], ['CHILD>CHILD', 'ROOT>ROOT']);

		await service.parse(extractPath);

		expect(await harness.pairs()).toEqual(['CHILD>CHILD', 'ROOT>ROOT']);
	});
});

/**
 * The reader that has to see what the import leaves behind: TypeORM's own tree repository, over the same
 * fixture, which is how `ProductCategoryService.findDescendants` reads the subtree on `DB_ORM=typeorm`.
 */
describe("ImportService: an imported category tree read through TypeORM's tree repository (real SQLite)", () => {
	const originalOrm = process.env.DB_ORM;
	let dataSource: DataSource;
	let extractPath: string;

	beforeEach(async () => {
		delete process.env.DB_ORM;
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TreeFixture],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		extractPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'gauzy-import-closure-'));
	});

	afterEach(async () => {
		if (originalOrm !== undefined) {
			process.env.DB_ORM = originalOrm;
		}
		await fsp.rm(extractPath, { recursive: true, force: true }).catch(() => undefined);
		await dataSource?.destroy();
	});

	it('finds the imported descendants of an imported root', async () => {
		const service = new ImportService({ execute: jest.fn() } as any, {
			buildRepositoriesRelationsGraph: jest.fn(async () => [
				{ repository: { metadata: { tableName: 'product_category' } }, isStatic: false, relations: [], isCheckRelation: false }
			]),
			typeOrmProductCategoryRepository: { manager: dataSource.manager },
			mikroOrmProductCategoryRepository: forbidden('mikroOrmProductCategoryRepository')
		} as any);
		const repository = dataSource.getRepository(TreeFixture);

		jest.spyOn(service, 'migrateImportEntityRecord').mockImplementation(async (_item, data: Record<string, string>) => {
			await repository.save(repository.create({ id: data['id'], tenantId: TENANT, parentId: data['parentId'] || null }));
			return true;
		});

		await fsp.writeFile(
			path.join(extractPath, 'product_category.csv'),
			`id,tenantId,parentId\nROOT,${TENANT},\nBRANCH,${TENANT},ROOT\nLEAF,${TENANT},BRANCH\n`,
			'utf8'
		);
		await service.parse(extractPath);

		const descendants = await dataSource.getTreeRepository(TreeFixture).findDescendants({ id: 'ROOT' } as any);

		expect(descendants.map((row) => row.id).sort()).toEqual(['BRANCH', 'LEAF', 'ROOT']);
	});
});
