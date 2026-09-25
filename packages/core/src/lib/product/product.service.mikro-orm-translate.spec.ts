import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The translated product reads answer on MikroORM, and answer what they answer on TypeORM.
 *
 * **The defect.** Every translated product read merges the requested language onto the rows the CRUD base
 * answered by calling `translateNested`, the merge `TranslatableBase` declares, on each row. On TypeORM a row is
 * a `Product` instance and carries the method. On MikroORM the CRUD base answers `wrap(entity).toJSON()` — the
 * row's data as a plain object, without the entity's prototype — so the GraphQL `products` field failed with
 * `INTERNAL_ERROR: product.translateNested is not a function`, and so did every route that translates:
 * `GET /products`, `GET /products/pagination`, `GET /products/local/:langCode`, and (as
 * `result.translateNested is not a function`) `GET /products/local/:langCode/:id` and the GraphQL
 * `product(id, language)` field.
 *
 * **What is real here.** One better-sqlite3 database whose tables TypeORM created from the platform's own
 * mapping, as the migrations create them; the core entities imported under `DB_ORM=mikro-orm`, so MikroORM maps
 * them exactly as it does in production (eager translations, relation-id mirrors) and is opened with the platform's
 * own `autoJoinRefsForFilters` (`@gauzy/config`); and the real `ProductService`
 * and `ProductResolver`, run over each ORM's repository in turn against the same rows. The entities are imported
 * in a registry kept open while both ORMs build their metadata and every read runs (see
 * `dual-orm-mapping-parity.spec.ts`), so the reads are collected there and asserted below.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '6a000000-0000-4000-8000-000000000001';
const ORGANIZATION = '6a000000-0000-4000-8000-000000000002';
const TYPE = '6a000000-0000-4000-8000-000000000010';
const CATEGORY = '6a000000-0000-4000-8000-000000000020';
/** A product with a type, a category and two translations. */
const WIDGET = '6a000000-0000-4000-8000-000000000100';
/** A product with neither a type nor a category, and an English translation only. */
const BARE = '6a000000-0000-4000-8000-000000000200';

/** The outcome of one read: what it answered, or the message it failed with. */
interface IOutcome {
	value?: any;
	error?: string;
}

/** The reads each ORM answers, by the surface that performs them. */
interface IReads {
	/** `products` (GraphQL) and `GET /products` with no language header: `findProducts({}, 'en')`. */
	listEnglish: IOutcome;
	/** `GET /products?data={"relations":[...]}` in German: the nested merge of the type and the category. */
	listGermanNested: IOutcome;
	/** `GET /products/local/de`: `findAllProducts`. */
	localGerman: IOutcome;
	/** `GET /products/pagination` in English. */
	pagination: IOutcome;
	/** `GET /products/local/de/:id` and `product(id, language: "de")`, with the relations loaded. */
	byIdGerman: IOutcome;
	/** The same read in English without the relations, of a product that has a type and a category. */
	byIdUnloaded: IOutcome;
	/** The GraphQL `products` field, as the surface smoke sends it: `first: 1`, no language. */
	connection: IOutcome;
	/** The GraphQL `products` field in German, every row. */
	connectionGerman: IOutcome;
	/** Whether the rows the CRUD base answered carried `translateNested` of their own. */
	rowsCarryTheMerge?: boolean;
	/** For each merge the reads performed, whether it ran on a `Product` instance. */
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
function translated(row: any, withRelations = false): Record<string, unknown> {
	const members: Record<string, unknown> = {
		id: row.id,
		code: row.code,
		name: row.name,
		description: row.description
	};
	if (withRelations) {
		members.productType = row.productType;
		members.productCategory = row.productCategory;
	}
	return members;
}

async function readThroughBothOrms(): Promise<{ typeorm: IReads; mikroorm: IReads }> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const database = join(tmpdir(), `product-translate-${process.pid}-${Date.now()}.sqlite`);
	const reads: { typeorm?: IReads; mikroorm?: IReads } = {};

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities');
			const { DataSource } = require('typeorm');
			const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS } = require('@gauzy/config');
			const { CrudService } = require('../core/crud/crud.service');
			const { RequestContext } = require('../core/context/request-context');
			const { MikroOrmBaseEntityRepository } = require('../core/repository/mikro-orm-base-entity.repository');
			const { MultiORMEnum } = require('../core/utils');
			const { Tenant } = require('../tenant/tenant.entity');
			const { Product } = require('./product.entity');
			const { ProductTranslation } = require('./product-translation.entity');
			const { ProductType } = require('../product-type/product-type.entity');
			const { ProductTypeTranslation } = require('../product-type/product-type-translation.entity');
			const { ProductCategory } = require('../product-category/product-category.entity');
			const { ProductCategoryTranslation } = require('../product-category/product-category-translation.entity');
			const { ProductService } = require('./product.service');
			const { ProductResolver } = require('./product.resolver');

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
				// The rows are the catalogue's: the organization they name is not what this suite is about, so
				// the store is not asked to enforce it. The tenant is stored, because TypeORM's tenant scope is a
				// join to it (`tenant: { id }`), and a read of a tenant that is not there answers nothing.
				await dataSource.query('PRAGMA foreign_keys = OFF');
				const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
				const insert = (entity: unknown, rows: object[]) => dataSource.getRepository(entity).insert(rows);

				await insert(Tenant, [{ id: TENANT, name: 'Translated catalogue' }]);
				await insert(ProductType, [{ id: TYPE, ...scope, icon: 'gift' }]);
				await insert(ProductTypeTranslation, [
					{ ...scope, referenceId: TYPE, languageCode: 'en', name: 'Gadget', description: 'A type' },
					{ ...scope, referenceId: TYPE, languageCode: 'de', name: 'Gerät', description: 'Ein Typ' }
				]);
				await insert(ProductCategory, [{ id: CATEGORY, ...scope }]);
				await insert(ProductCategoryTranslation, [
					{ ...scope, referenceId: CATEGORY, languageCode: 'en', name: 'Tools', description: 'A category' },
					{
						...scope,
						referenceId: CATEGORY,
						languageCode: 'de',
						name: 'Werkzeuge',
						description: 'Eine Kategorie'
					}
				]);
				await insert(Product, [
					{
						id: WIDGET,
						...scope,
						code: 'WIDGET',
						productTypeId: TYPE,
						productCategoryId: CATEGORY,
						createdAt: new Date('2026-01-02T00:00:00.000Z')
					},
					{ id: BARE, ...scope, code: 'BARE', createdAt: new Date('2026-01-01T00:00:00.000Z') }
				]);
				await insert(ProductTranslation, [
					{ ...scope, referenceId: WIDGET, languageCode: 'en', name: 'Widget', description: 'A widget' },
					{ ...scope, referenceId: WIDGET, languageCode: 'de', name: 'Dings', description: 'Ein Dings' },
					{ ...scope, referenceId: BARE, languageCode: 'en', name: 'Bare', description: 'Nothing else' }
				]);

				// The caller: a user of the tenant, as the tenant guard leaves the request context.
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ tenantId: TENANT });
				jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
				jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

				const readAll = async (ormType: string): Promise<IReads> => {
					const ormTypeSpy = jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
					const service = new ProductService(
						dataSource.getRepository(Product),
						// A fresh context per ORM, so an answer is the store's rather than an earlier read's.
						new MikroOrmBaseEntityRepository(orm.em.fork(), Product),
						dataSource.getRepository(ProductTranslation)
					);
					const resolver = new ProductResolver(service, {} as never, {} as never);
					const relations = ['productType', 'productCategory'];
					// The merge itself, called through: which objects it ran on is what tells the two paths apart.
					const merge = jest.spyOn(Product.prototype, 'translateNested');

					try {
						const answered = await service.findAll({ where: {} });
						return {
							rowsCarryTheMerge: answered.items.every(
								(row: any) => typeof row.translateNested === 'function'
							),
							listEnglish: await attempt(() => service.findProducts({}, 'en')),
							listGermanNested: await attempt(() => service.findProducts({ relations }, 'de')),
							localGerman: await attempt(() => service.findAllProducts('de', [], null)),
							pagination: await attempt(() => service.pagination({ where: {} }, 'en')),
							byIdGerman: await attempt(() => service.findByIdTranslated('de', WIDGET, relations)),
							byIdUnloaded: await attempt(() => service.findByIdTranslated('en', WIDGET)),
							connection: await attempt(() => resolver.products(undefined, undefined, undefined, 1)),
							connectionGerman: await attempt(() =>
								resolver.products(
									undefined,
									undefined,
									undefined,
									undefined,
									undefined,
									undefined,
									undefined,
									undefined,
									undefined,
									'de'
								)
							),
							mergedOnEntities: merge.mock.contexts.map((row: unknown) => row instanceof Product)
						};
					} finally {
						merge.mockRestore();
						ormTypeSpy.mockRestore();
					}
				};

				reads.typeorm = await readAll(MultiORMEnum.TypeORM);
				reads.mikroorm = await readAll(MultiORMEnum.MikroORM);
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

describe('ProductService — the translated reads on MikroORM', () => {
	let typeorm: IReads;
	let mikroorm: IReads;

	beforeAll(async () => {
		({ typeorm, mikroorm } = await readThroughBothOrms());
	}, TIMEOUT);

	it('reads rows through the CRUD base that carry no merge of their own on MikroORM, and do on TypeORM', () => {
		// The premise of the defect, stated so the suite fails loudly if it stops holding: a MikroORM row is the
		// serialized entity, a TypeORM row the entity itself.
		expect(typeorm.rowsCarryTheMerge).toBe(true);
		expect(mikroorm.rowsCarryTheMerge).toBe(false);
	});

	it('merges on the entity itself on TypeORM, as it always did, and on the serialized row on MikroORM', () => {
		// Control: TypeORM's path is the entity's own method called on the entity, so nothing it answers can have
		// changed. The MikroORM path runs the same method, on the plain row the CRUD base answered.
		expect(typeorm.mergedOnEntities.length).toBeGreaterThan(0);
		expect(typeorm.mergedOnEntities.every(Boolean)).toBe(true);
		expect(mikroorm.mergedOnEntities.length).toBe(typeorm.mergedOnEntities.length);
		expect(mikroorm.mergedOnEntities.some(Boolean)).toBe(false);
	});

	it.each([
		'listEnglish',
		'listGermanNested',
		'localGerman',
		'pagination',
		'byIdGerman',
		'byIdUnloaded',
		'connection',
		'connectionGerman'
	] as const)('answers %s on both ORMs', (read) => {
		expect(typeorm[read].error).toBeUndefined();
		expect(mikroorm[read].error).toBeUndefined();
	});

	it('answers the GraphQL `products` field with the rows TypeORM answers, in the requested language', () => {
		const nodes = (reads: IReads) => reads.connectionGerman.value.nodes.map((row: any) => translated(row));

		expect(nodes(mikroorm)).toEqual(nodes(typeorm));
		expect(nodes(mikroorm)).toEqual([
			{ id: WIDGET, code: 'WIDGET', name: 'Dings', description: 'Ein Dings' },
			// No German translation: the row is answered untranslated, on both ORMs.
			{ id: BARE, code: 'BARE', name: undefined, description: undefined }
		]);
		expect(mikroorm.connection.value.totalCount).toBe(typeorm.connection.value.totalCount);
		expect(mikroorm.connection.value.nodes.map((row: any) => translated(row))).toEqual([
			{ id: WIDGET, code: 'WIDGET', name: 'Widget', description: 'A widget' }
		]);
	});

	it('merges the language onto every row of the list routes as TypeORM does', () => {
		const rows = (outcome: IOutcome, withRelations = false) =>
			[...outcome.value.items]
				.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
				.map((row: any) => translated(row, withRelations));

		for (const read of ['listEnglish', 'localGerman', 'pagination'] as const) {
			expect({ read, rows: rows(mikroorm[read]) }).toEqual({ read, rows: rows(typeorm[read]) });
			expect(mikroorm[read].value.total).toBe(typeorm[read].value.total);
		}
		expect(rows(mikroorm.listEnglish)).toEqual([
			{ id: WIDGET, code: 'WIDGET', name: 'Widget', description: 'A widget' },
			{ id: BARE, code: 'BARE', name: 'Bare', description: 'Nothing else' }
		]);
	});

	it('merges the type and category names of the relations the caller loaded, as TypeORM does', () => {
		const widget = (reads: IReads) =>
			translated(
				reads.listGermanNested.value.items.find((row: any) => row.id === WIDGET),
				true
			);

		expect(widget(mikroorm)).toEqual(widget(typeorm));
		expect(widget(mikroorm)).toEqual({
			id: WIDGET,
			code: 'WIDGET',
			name: 'Dings',
			description: 'Ein Dings',
			productType: 'Gerät',
			productCategory: 'Werkzeuge'
		});
	});

	it('answers the per-language read of one row as TypeORM does, with and without its relations', () => {
		expect(translated(mikroorm.byIdGerman.value, true)).toEqual(translated(typeorm.byIdGerman.value, true));
		expect(translated(mikroorm.byIdGerman.value, true)).toEqual({
			id: WIDGET,
			code: 'WIDGET',
			name: 'Dings',
			description: 'Ein Dings',
			productType: 'Gerät',
			productCategory: 'Werkzeuge'
		});

		// A row whose relations were not loaded has nothing of theirs to merge. TypeORM leaves such a relation
		// off the row; MikroORM's serializer states it as its key (which the CRUD base now leaves out as well), and
		// the merge must not read that as a loaded row.
		expect(translated(mikroorm.byIdUnloaded.value, true)).toEqual(translated(typeorm.byIdUnloaded.value, true));
		expect(translated(mikroorm.byIdUnloaded.value, true)).toEqual({
			id: WIDGET,
			code: 'WIDGET',
			name: 'Widget',
			description: 'A widget',
			productType: undefined,
			productCategory: undefined
		});
	});
});
