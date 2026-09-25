import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The translated product-type reads answer on MikroORM, and answer what they answer on TypeORM.
 *
 * **The defect.** Every translated product-type read merges the requested language onto the rows the CRUD base
 * answered by calling `translate`, the merge `TranslatableBase` declares, on each row. On TypeORM a row is a
 * `ProductType` instance and carries the method. On MikroORM the CRUD base answers `wrap(entity).toJSON()` — the
 * row's data as a plain object, without the entity's prototype — so every read that merged a language failed with
 * `type.translate is not a function`: `GET /product-types`, `GET /product-types/pagination` and the GraphQL
 * `productTypes` field, and the create command behind `POST /product-types` and `createProductType`, which merges
 * the row `create()` answered.
 *
 * **What is real here.** One better-sqlite3 database whose tables TypeORM created from the platform's own mapping,
 * as the migrations create them; the core entities imported under `DB_ORM=mikro-orm`, so MikroORM maps them as it
 * does in production (eager translations, relation-id mirrors) and is opened with the platform's own
 * `autoJoinRefsForFilters` (`@gauzy/config`); and the real `ProductTypeService` and create handler, run over each
 * ORM's repository in turn against the same rows. The entities are imported in a registry kept open while both ORMs
 * build their metadata and every read runs (see `product.service.mikro-orm-translate.spec.ts`), so the reads are
 * collected there and asserted below. Nothing is stood in for: the translations a MikroORM create cascades get their key from `BaseEntity.id`'s
 * `onCreate` on SQLite, as they get it from the table's default on PostgreSQL.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '6b000000-0000-4000-8000-000000000001';
const ORGANIZATION = '6b000000-0000-4000-8000-000000000002';
/** A type with an English and a German translation. */
const GADGET = '6b000000-0000-4000-8000-000000000010';
/** A type with an English translation only. */
const PLAIN = '6b000000-0000-4000-8000-000000000020';

/** The outcome of one read: what it answered, or the message it failed with. */
interface IOutcome {
	value?: any;
	error?: string;
}

/** The reads each ORM answers, by the surface that performs them. */
interface IReads {
	/** `GET /product-types` and the GraphQL `productTypes` field, in German. */
	listGerman: IOutcome;
	/** `GET /product-types/pagination`, in German. */
	paginationGerman: IOutcome;
	/** `GET /product-types` in a language no type is translated into. */
	listFrench: IOutcome;
	/** `POST /product-types` and `createProductType`, in German: the create command. */
	createdGerman: IOutcome;
	/** Whether the rows the CRUD base answered carried `translate` of their own. */
	rowsCarryTheMerge?: boolean;
	/** For each merge the reads performed, whether it ran on a `ProductType` instance. */
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
		icon: row.icon,
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

async function readThroughBothOrms(): Promise<{ typeorm: IReads; mikroorm: IReads }> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const database = join(tmpdir(), `product-type-translate-${process.pid}-${Date.now()}.sqlite`);
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
			const { ProductType } = require('./product-type.entity');
			const { ProductTypeTranslation } = require('./product-type-translation.entity');
			const { ProductTypeService } = require('./product-type.service');
			const { ProductTypeCreateHandler } = require('./commands/handlers/product-type.create.handler');
			const { ProductTypeCreateCommand } = require('./commands/product-type.create.command');

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
				const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
				const insert = (entity: unknown, rows: object[]) => dataSource.getRepository(entity).insert(rows);

				await insert(Tenant, [{ id: TENANT, name: 'Translated types' }]);
				await insert(ProductType, [
					{ id: GADGET, ...scope, icon: 'gift' },
					{ id: PLAIN, ...scope, icon: 'car' }
				]);
				await insert(ProductTypeTranslation, [
					{ ...scope, referenceId: GADGET, languageCode: 'en', name: 'Gadget', description: 'A type' },
					{ ...scope, referenceId: GADGET, languageCode: 'de', name: 'Gerät', description: 'Ein Typ' },
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
					const service = new ProductTypeService(
						dataSource.getRepository(ProductType),
						// A fresh context per run, so an answer is the store's rather than an earlier read's.
						new MikroOrmBaseEntityRepository(orm.em.fork(), ProductType)
					);
					const merge = jest.spyOn(ProductType.prototype, 'translate');

					try {
						const answer = await work(service);
						return {
							answer,
							mergedOnEntities: merge.mock.contexts.map((row: unknown) => row instanceof ProductType)
						};
					} finally {
						merge.mockRestore();
						ormTypeSpy.mockRestore();
					}
				};

				// Every read on both ORMs before either creates a row, so both read the same rows.
				const readAll = (ormType: string) =>
					onOrm(ormType, async (service) => {
						const answered = await service.findAll({ where: { id: GADGET } });
						return {
							rowsCarryTheMerge: answered.items.every((row: any) => typeof row.translate === 'function'),
							listGerman: await attempt(() => service.findProductTypes({ where: {} }, 'de')),
							paginationGerman: await attempt(() => service.pagination({ where: {} }, 'de')),
							listFrench: await attempt(() => service.findProductTypes({ where: {} }, 'fr'))
						};
					});
				const createOn = (ormType: string) =>
					onOrm(ormType, (service) =>
						attempt(() =>
							new ProductTypeCreateHandler(service).execute(
								new ProductTypeCreateCommand(
									{
										organizationId: ORGANIZATION,
										icon: 'bike',
										translations: [
											{
												languageCode: 'en',
												name: `Bike (${ormType})`,
												description: 'Two wheels'
											},
											{
												languageCode: 'de',
												name: `Fahrrad (${ormType})`,
												description: 'Zwei Räder'
											}
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

describe('ProductTypeService — the translated reads on MikroORM', () => {
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
			{ icon: 'gift', name: 'Gerät', description: 'Ein Typ', languageCode: undefined, translations: undefined },
			// No German translation: the row is answered untranslated, with its translations, on both ORMs.
			{ icon: 'car', name: undefined, description: undefined, languageCode: undefined, translations: 'kept' }
		]);
	});

	it('answers a language nothing is translated into with the rows and their translations, as TypeORM does', () => {
		const languages = (row: any) =>
			row.translations.map((translation: any) => `${translation.languageCode}:${translation.name}`).sort();

		expect(rowsOf(mikroorm.listFrench).map(translated)).toEqual(rowsOf(typeorm.listFrench).map(translated));
		expect(rowsOf(mikroorm.listFrench).map(languages)).toEqual(rowsOf(typeorm.listFrench).map(languages));
		expect(rowsOf(mikroorm.listFrench).map(languages)).toEqual([['de:Gerät', 'en:Gadget'], ['en:Plain']]);
	});

	it('answers the create command with the created type in the requested language, as TypeORM does', () => {
		const created = (reads: IReads, orm: string) => ({
			...translated(reads.createdGerman.value),
			name: String(reads.createdGerman.value.name).replace(` (${orm})`, '')
		});

		expect(created(mikroorm, 'mikro-orm')).toEqual(created(typeorm, 'typeorm'));
		expect(created(mikroorm, 'mikro-orm')).toEqual({
			icon: 'bike',
			name: 'Fahrrad',
			description: 'Zwei Räder',
			languageCode: undefined,
			translations: undefined
		});
		expect(mikroorm.createdGerman.value.id).toEqual(expect.any(String));
	});
});
