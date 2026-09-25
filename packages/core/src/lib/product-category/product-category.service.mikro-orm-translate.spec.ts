import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The translated product-category reads answer on MikroORM, and answer what they answer on TypeORM.
 *
 * **The defect.** Every translated category read merges the requested language onto the rows the CRUD base answered
 * by calling `translate`, the merge `TranslatableBase` declares, on each row. On TypeORM a row is a
 * `ProductCategory` instance and carries the method. On MikroORM the CRUD base answers `wrap(entity).toJSON()` — the
 * row's data as a plain object, without the entity's prototype — so every read that merged a language failed with
 * `category.translate is not a function`: `GET /product-categories`, `GET /product-categories/pagination` and the
 * GraphQL `productCategories` field, and the create command behind `POST /product-categories` and
 * `createProductCategory`, which merges the row the service's `create()` answered.
 *
 * **What is real here.** One better-sqlite3 database whose tables TypeORM created from the platform's own mapping,
 * as the migrations create them (the closure table included); the core entities imported under `DB_ORM=mikro-orm`,
 * so MikroORM maps them as it does in production (eager translations, relation-id mirrors) and is opened with the
 * platform's own `autoJoinRefsForFilters` (`@gauzy/config`); and the real `ProductCategoryService` and create
 * handler, run over each ORM's repository in turn against the same rows. The entities are imported in a registry
 * kept open while both ORMs build their metadata and every read runs (see
 * `product.service.mikro-orm-translate.spec.ts`), so the reads are collected there and asserted below. The one
 * thing stood in for is the translations table's key default, which the table has on PostgreSQL and not on SQLite
 * (see {@link withDatabaseSuppliedKey}).
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '6c000000-0000-4000-8000-000000000001';
const ORGANIZATION = '6c000000-0000-4000-8000-000000000002';
/** A category with an English and a German translation. */
const TOOLS = '6c000000-0000-4000-8000-000000000010';
/** A category with an English translation only. */
const PLAIN = '6c000000-0000-4000-8000-000000000020';

/** The outcome of one read: what it answered, or the message it failed with. */
interface IOutcome {
	value?: any;
	error?: string;
}

/** The reads each ORM answers, by the surface that performs them. */
interface IReads {
	/** `GET /product-categories` and the GraphQL `productCategories` field, in German. */
	listGerman: IOutcome;
	/** `GET /product-categories/pagination`, in German. */
	paginationGerman: IOutcome;
	/** `GET /product-categories` in a language no category is translated into. */
	listFrench: IOutcome;
	/** `POST /product-categories` and `createProductCategory`, in German: the create command. */
	createdGerman: IOutcome;
	/** Whether the rows the CRUD base answered carried `translate` of their own. */
	rowsCarryTheMerge?: boolean;
	/** For each merge the reads performed, whether it ran on a `ProductCategory` instance. */
	mergedOnEntities?: boolean[];
}

async function attempt(read: () => Promise<unknown>): Promise<IOutcome> {
	try {
		return { value: await read() };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

/** The members the translation decides, of one answered row. */
function translated(row: any): Record<string, unknown> {
	return {
		slug: row.slug,
		name: row.name,
		description: row.description,
		languageCode: row.languageCode,
		translations: row.translations === undefined ? undefined : 'kept'
	};
}

/** The rows of a list read, in a stable order. */
function rowsOf(outcome: IOutcome): any[] {
	return [...outcome.value.items].sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
}

/**
 * Every member TypeORM's answer states that is not a date, as MikroORM's answer states it.
 *
 * The two ORMs read a stored timestamp differently on SQLite, which is not what this suite is about; every other
 * member TypeORM answers — the row's own columns and every member of the translation the merge copied onto it —
 * has to be there on MikroORM with the same value. MikroORM's answer may state more (a relation stored as NULL is
 * answered as null, where TypeORM leaves it off), which is the CRUD base's serialized row, not the merge's doing.
 */
function membersTypeOrmStates(typeormRow: any, mikroormRow: any): { typeorm: any; mikroorm: any } {
	const keys = Object.keys(typeormRow).filter((key) => key !== 'translations' && !(typeormRow[key] instanceof Date));
	return {
		typeorm: Object.fromEntries(keys.map((key) => [key, typeormRow[key]])),
		mikroorm: Object.fromEntries(keys.map((key) => [key, mikroormRow[key]]))
	};
}

/** A version-4 uuid, as an SQLite expression. */
const SQLITE_UUID =
	"lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || " +
	"substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))";

/**
 * Gives a table's primary key the database default it has on PostgreSQL.
 *
 * MikroORM maps `BaseEntity.id` with `defaultRaw: 'gen_random_uuid()'` and leaves the key of a new row out of its
 * INSERT; `CrudService.create` states it for the row it creates, but not for the rows that row's collections
 * cascade (a category's translations), so on SQLite — which has no such default — creating a category with
 * translations fails with `NOT NULL constraint failed: product_category_translation.id` before the command merges
 * anything. That is the kernel's to fix and not what this suite is about: the translations table is given the
 * default PostgreSQL gives it, so the create command runs on MikroORM as it does there, and its merge is what is
 * compared.
 *
 * @param dataSource The TypeORM data source that created the table.
 * @param table The table.
 */
async function withDatabaseSuppliedKey(dataSource: any, table: string): Promise<void> {
	const [{ sql }] = await dataSource.query(
		`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = ?`,
		[table]
	);
	const indexes: { sql: string }[] = await dataSource.query(
		`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = ? AND "sql" IS NOT NULL`,
		[table]
	);
	const key = '"id" varchar PRIMARY KEY NOT NULL';
	if (!String(sql).includes(key)) {
		throw new Error(`The key of "${table}" is not the one this suite expects: ${sql}`);
	}

	await dataSource.query(`DROP TABLE "${table}"`);
	await dataSource.query(String(sql).replace(key, `${key} DEFAULT (${SQLITE_UUID})`));
	for (const index of indexes) {
		await dataSource.query(index.sql);
	}
}

async function readThroughBothOrms(): Promise<{ typeorm: IReads; mikroorm: IReads }> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const database = join(tmpdir(), `product-category-translate-${process.pid}-${Date.now()}.sqlite`);
	const reads: { typeorm?: IReads; mikroorm?: IReads } = {};

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities');
			const { DataSource } = require('typeorm');
			const {
				MikroORM,
				EntityCaseNamingStrategy,
				RequestContext: MikroOrmRequestContext
			} = require('@mikro-orm/core');
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS } = require('@gauzy/config');
			const { CrudService } = require('../core/crud/crud.service');
			const { RequestContext } = require('../core/context/request-context');
			const { MikroOrmBaseEntityRepository } = require('../core/repository/mikro-orm-base-entity.repository');
			const { MultiORMEnum } = require('../core/utils');
			const { Tenant } = require('../tenant/tenant.entity');
			const { ProductCategory } = require('./product-category.entity');
			const { ProductCategoryTranslation } = require('./product-category-translation.entity');
			const { ProductCategoryService } = require('./product-category.service');
			const { ProductCategoryCreateHandler } = require('./commands/handlers/product-category.create.handler');
			const { ProductCategoryCreateCommand } = require('./commands/product-category.create.command');

			// The tables as TypeORM creates them from the platform's mapping.
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database,
				entities: coreEntities,
				synchronize: true,
				migrationsRun: false,
				logging: false
			});
			await dataSource.initialize();

			const orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: database,
				entities: coreEntities,
				persistOnCreate: true,
				extensions: [SoftDeleteHandler],
				// Join only what a read populates, as the platform's MikroORM does (see `database-helpers.ts`).
				autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
				namingStrategy: EntityCaseNamingStrategy,
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});

			try {
				// The organization the rows name is not what this suite is about, so neither ORM's connection is
				// asked to enforce it. The tenant is stored, because TypeORM's tenant scope is a join to it.
				await dataSource.query('PRAGMA foreign_keys = OFF');
				await orm.em.getConnection().execute('PRAGMA foreign_keys = OFF');
				await withDatabaseSuppliedKey(dataSource, 'product_category_translation');

				const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
				const insert = (entity: unknown, rows: object[]) => dataSource.getRepository(entity).insert(rows);

				await insert(Tenant, [{ id: TENANT, name: 'Translated categories' }]);
				await insert(ProductCategory, [
					{ id: TOOLS, ...scope, slug: 'tools' },
					{ id: PLAIN, ...scope, slug: 'plain' }
				]);
				await insert(ProductCategoryTranslation, [
					{ ...scope, referenceId: TOOLS, languageCode: 'en', name: 'Tools', description: 'A category' },
					{
						...scope,
						referenceId: TOOLS,
						languageCode: 'de',
						name: 'Werkzeuge',
						description: 'Eine Kategorie'
					},
					{ ...scope, referenceId: PLAIN, languageCode: 'en', name: 'Plain', description: 'Nothing else' }
				]);

				// The caller: a user of the tenant, as the tenant guard leaves the request context.
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ tenantId: TENANT });
				jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
				jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

				/**
				 * Runs `work` with the real service on one ORM, and records which objects the merge ran on.
				 *
				 * The merge is spied on, called through: which objects it ran on is what tells the two paths apart.
				 */
				const onOrm = async <R>(ormType: string, work: (service: any) => Promise<R>) => {
					const ormTypeSpy = jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
					// The repository is the application's entity manager's, as Nest injects it, and each run is one
					// request context: the service's create opens a transaction and writes the row through the
					// repository inside it, which only the context-aware manager joins (a fork of its own would wait
					// for SQLite's one connection the transaction holds). A fresh context per run also makes an
					// answer the store's rather than an earlier read's.
					const service = new ProductCategoryService(
						dataSource.getRepository(ProductCategory),
						new MikroOrmBaseEntityRepository(orm.em, ProductCategory)
					);
					const merge = jest.spyOn(ProductCategory.prototype, 'translate');

					try {
						const answer = await MikroOrmRequestContext.create(orm.em, () => work(service));
						return {
							answer,
							mergedOnEntities: merge.mock.contexts.map((row: unknown) => row instanceof ProductCategory)
						};
					} finally {
						merge.mockRestore();
						ormTypeSpy.mockRestore();
					}
				};

				// Every read on both ORMs before either creates a row, so both read the same rows.
				const readAll = (ormType: string) =>
					onOrm(ormType, async (service) => {
						const answered = await service.findAll({ where: { id: TOOLS } });
						return {
							rowsCarryTheMerge: answered.items.every((row: any) => typeof row.translate === 'function'),
							listGerman: await attempt(() => service.findProductCategories({ where: {} }, 'de')),
							paginationGerman: await attempt(() => service.pagination({ where: {} }, 'de')),
							listFrench: await attempt(() => service.findProductCategories({ where: {} }, 'fr'))
						};
					});
				const createOn = (ormType: string) =>
					onOrm(ormType, (service) =>
						attempt(() =>
							new ProductCategoryCreateHandler(service).execute(
								new ProductCategoryCreateCommand(
									{
										organizationId: ORGANIZATION,
										slug: `garden-${ormType}`,
										translations: [
											{ languageCode: 'en', name: 'Garden', description: 'Outdoors' },
											{ languageCode: 'de', name: 'Garten', description: 'Draußen' }
										]
									} as never,
									'de' as never
								)
							)
						)
					);

				const readTypeOrm = await readAll(MultiORMEnum.TypeORM);
				const readMikroOrm = await readAll(MultiORMEnum.MikroORM);
				const createTypeOrm = await createOn(MultiORMEnum.TypeORM);
				const createMikroOrm = await createOn(MultiORMEnum.MikroORM);

				reads.typeorm = {
					...readTypeOrm.answer,
					createdGerman: createTypeOrm.answer,
					mergedOnEntities: [...readTypeOrm.mergedOnEntities, ...createTypeOrm.mergedOnEntities]
				};
				reads.mikroorm = {
					...readMikroOrm.answer,
					createdGerman: createMikroOrm.answer,
					mergedOnEntities: [...readMikroOrm.mergedOnEntities, ...createMikroOrm.mergedOnEntities]
				};
			} finally {
				jest.restoreAllMocks();
				await orm.close(true);
				await dataSource.destroy();
			}
		});
	} finally {
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
		for (const file of [database, `${database}-wal`, `${database}-shm`]) {
			rmSync(file, { force: true });
		}
	}

	return reads as { typeorm: IReads; mikroorm: IReads };
}

describe('ProductCategoryService — the translated reads on MikroORM', () => {
	let typeorm: IReads;
	let mikroorm: IReads;

	beforeAll(async () => {
		({ typeorm, mikroorm } = await readThroughBothOrms());
	}, TIMEOUT);

	it('reads rows through the CRUD base that carry no merge of their own on MikroORM, and do on TypeORM', () => {
		// The premise of the defect, stated so the suite fails loudly if it stops holding.
		expect(typeorm.rowsCarryTheMerge).toBe(true);
		expect(mikroorm.rowsCarryTheMerge).toBe(false);
	});

	it('merges on the entity itself on TypeORM, as it always did, and on the serialized row on MikroORM', () => {
		expect(typeorm.mergedOnEntities.length).toBeGreaterThan(0);
		expect(typeorm.mergedOnEntities.every(Boolean)).toBe(true);
		expect(mikroorm.mergedOnEntities.length).toBe(typeorm.mergedOnEntities.length);
		expect(mikroorm.mergedOnEntities.some(Boolean)).toBe(false);
	});

	it.each(['listGerman', 'paginationGerman', 'listFrench', 'createdGerman'] as const)(
		'answers %s on both ORMs',
		(read) => {
			expect(typeorm[read].error).toBeUndefined();
			expect(mikroorm[read].error).toBeUndefined();
		}
	);

	it('merges the language onto every row of the list routes as TypeORM does', () => {
		for (const read of ['listGerman', 'paginationGerman'] as const) {
			const mikroormRows = rowsOf(mikroorm[read]);
			const typeormRows = rowsOf(typeorm[read]);

			expect({ read, rows: mikroormRows.map(translated) }).toEqual({ read, rows: typeormRows.map(translated) });
			expect(mikroorm[read].value.total).toBe(typeorm[read].value.total);
			typeormRows.forEach((row, index) => {
				const { typeorm: stated, mikroorm: answered } = membersTypeOrmStates(row, mikroormRows[index]);
				expect({ read, id: row.id, answered }).toEqual({ read, id: row.id, answered: stated });
			});
		}

		expect(rowsOf(mikroorm.listGerman).map(translated)).toEqual([
			{
				slug: 'tools',
				name: 'Werkzeuge',
				description: 'Eine Kategorie',
				languageCode: undefined,
				translations: undefined
			},
			// No German translation: the row is answered untranslated, with its translations, on both ORMs.
			{ slug: 'plain', name: undefined, description: undefined, languageCode: undefined, translations: 'kept' }
		]);
	});

	it('answers a language nothing is translated into with the rows and their translations, as TypeORM does', () => {
		const languages = (row: any) =>
			row.translations.map((translation: any) => `${translation.languageCode}:${translation.name}`).sort();

		expect(rowsOf(mikroorm.listFrench).map(translated)).toEqual(rowsOf(typeorm.listFrench).map(translated));
		expect(rowsOf(mikroorm.listFrench).map(languages)).toEqual(rowsOf(typeorm.listFrench).map(languages));
		expect(rowsOf(mikroorm.listFrench).map(languages)).toEqual([['de:Werkzeuge', 'en:Tools'], ['en:Plain']]);
	});

	it('answers the create command with the created category in the requested language, as TypeORM does', () => {
		const created = (reads: IReads, orm: string) => ({
			...translated(reads.createdGerman.value),
			slug: String(reads.createdGerman.value.slug).replace(`-${orm}`, '')
		});

		expect(created(mikroorm, 'mikro-orm')).toEqual(created(typeorm, 'typeorm'));
		expect(created(mikroorm, 'mikro-orm')).toEqual({
			slug: 'garden',
			name: 'Garten',
			description: 'Draußen',
			languageCode: undefined,
			translations: undefined
		});
		expect(mikroorm.createdGerman.value.id).toEqual(expect.any(String));
	});
});
