import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity as MikroOrmEntity, MetadataStorage, MikroORM, PrimaryKey } from '@mikro-orm/core';
import { getMetadataArgsStorage } from 'typeorm';
import type { TableMetadataArgs } from 'typeorm/metadata-args/TableMetadataArgs';
import { JsonArrayColumn, JsonColumn, JsonbColumn } from './json-column.decorator';

/** A decorated class, as TypeORM's metadata args name their `target`. */
type EntityClass = Exclude<TableMetadataArgs['target'], string>;

/**
 * `@JsonColumn` registers with the ORM `DB_ORM` names — the one every other entity decorator follows.
 *
 * It used to read `ORM_TYPE`, which nothing sets, so it always chose TypeORM: under `DB_ORM=mikro-orm` every
 * JSON column got a TypeORM `@Column` (on a skeleton TypeORM never reads through) and no MikroORM property.
 * `Operation.input`, `state` and `result` — the saga's request, its merged state and its outcome — and every
 * other JSON column on the platform were therefore unmapped on the ORM actually running: never written, never
 * read.
 *
 * Under `DB_ORM=mikro-orm` the TypeORM column is registered as well, like every `@MultiORMColumn`: the TypeORM
 * data source runs in both modes (migrations, the seeder, the services still on TypeORM), and a skeleton made
 * each of its inserts omit the column. MikroORM's property stays off under `DB_ORM=typeorm`.
 *
 * The decorators register at class-definition time, so the real entity is re-imported in a fresh module
 * registry per `DB_ORM`, as `product-category.entity.mikro-orm.spec.ts` does. TypeORM's metadata storage and
 * MikroORM's are both globals; MikroORM's files a class under `<className>-<hash of its file>`, which both
 * imports share, so it is cleared before each import and read back by key.
 */

/** The JSON columns of `Operation`, and whether each is declared nullable. */
const OPERATION_JSON_COLUMNS: Record<string, boolean> = { input: false, state: true, result: true };

/** Every metadata MikroORM holds for a class name, whichever file-hash key it was filed under. */
function mikroOrmMetadataFor(className: string): Array<{ properties: Record<string, any> }> {
	const storage: Record<string, { className: string; properties: Record<string, any> }> = (MetadataStorage as any)
		.metadata;
	return Object.entries(storage)
		.filter(([key, meta]) => key.startsWith(`${className}-`) && meta.className === className)
		.map(([, meta]) => meta);
}

/** What {@link importEntitiesUnder} answers: the entities, and the MikroORM of the registry that decorated them. */
interface IIsolatedEntities {
	coreEntities: EntityClass[];
	Operation: EntityClass;
	/**
	 * `MikroORM` and the SQLite driver from the same registry. Discovery has to run through these: MikroORM
	 * finds a decorated class's metadata by a `Symbol` its `MetadataStorage` module creates, so another
	 * registry's copy would look under a different symbol and discover nothing.
	 */
	MikroORM: typeof MikroORM;
	BetterSqliteDriver: typeof BetterSqliteDriver;
}

/** Imports the core entities in a fresh module registry under `orm`. */
function importEntitiesUnder(orm: string): IIsolatedEntities {
	process.env.DB_ORM = orm;
	MetadataStorage.clear();

	let loaded!: IIsolatedEntities;
	jest.isolateModules(() => {
		// The registry first: an entity imported before it can extend a base class that is not defined yet.
		const { coreEntities } = require('../../entities');
		const { Operation } = require('../../../operation/operation.entity');
		loaded = {
			coreEntities,
			Operation,
			MikroORM: require('@mikro-orm/core').MikroORM,
			BetterSqliteDriver: require('@mikro-orm/better-sqlite').BetterSqliteDriver
		};
	});
	return loaded;
}

/** Decorates a fresh class's `payload` with `decorator` under the given `DB_ORM` and `DB_TYPE`. */
function decorateUnder(
	orm: string | undefined,
	dbType: string | undefined,
	decorator: () => PropertyDecorator,
	className: string
): EntityClass {
	setEnv('DB_ORM', orm);
	setEnv('DB_TYPE', dbType);

	// A distinct class name per case: MikroORM files metadata by class name.
	const Fixture = { [className]: class {} }[className];
	decorator()(Fixture.prototype, 'payload');
	return Fixture;
}

/** The TypeORM column args registered for `target.payload`, if any. */
function typeOrmColumn(target: EntityClass, propertyName = 'payload') {
	return getMetadataArgsStorage().columns.find(
		(column) => column.target === target && column.propertyName === propertyName
	);
}

/** The MikroORM property registered for `target.payload`, if any. */
function mikroOrmProperty(target: EntityClass, propertyName = 'payload'): any {
	return MetadataStorage.getMetadataFromDecorator(target as any).properties[propertyName as never];
}

function setEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
}

const ENTITY_GRAPH_TIMEOUT = 15 * 60 * 1000;

describe('@JsonColumn', () => {
	const originalEnv = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE, ORM_TYPE: process.env.ORM_TYPE };

	afterEach(() => {
		setEnv('DB_ORM', originalEnv.DB_ORM);
		setEnv('DB_TYPE', originalEnv.DB_TYPE);
		setEnv('ORM_TYPE', originalEnv.ORM_TYPE);
	});

	describe('on the real Operation entity', () => {
		it(
			'under DB_ORM=typeorm: a TypeORM column for input, state and result, and no MikroORM property',
			() => {
				const { Operation } = importEntitiesUnder('typeorm');

				for (const [propertyName, nullable] of Object.entries(OPERATION_JSON_COLUMNS)) {
					const column = typeOrmColumn(Operation, propertyName);
					expect(column).toBeDefined();
					expect(column!.mode).toBe('regular');
					// DB_TYPE is unset here, which the decorator reads as the embedded default.
					expect(column!.options.type).toBe('simple-json');
					expect(typeof column!.options.transformer).toBe('object');
					expect(column!.options.nullable).toBe(nullable ? true : undefined);
				}

				const metas = mikroOrmMetadataFor('Operation');
				expect(metas.length).toBeGreaterThan(0);
				for (const meta of metas) {
					for (const propertyName of Object.keys(OPERATION_JSON_COLUMNS)) {
						expect(meta.properties[propertyName]).toBeUndefined();
					}
				}
			},
			ENTITY_GRAPH_TIMEOUT
		);

		it(
			'under DB_ORM=mikro-orm: a MikroORM property for input, state and result, the TypeORM column too, and discovery accepts every entity',
			async () => {
				const isolated = importEntitiesUnder('mikro-orm');
				const { coreEntities, Operation } = isolated;

				// The TypeORM column is kept, since TypeORM's data source runs under MikroORM too; the defect was that
				// MikroORM had no property at all.
				for (const [propertyName, nullable] of Object.entries(OPERATION_JSON_COLUMNS)) {
					const column = typeOrmColumn(Operation, propertyName);
					expect(column?.options.type).toBe('simple-json');
					expect(column?.options.nullable).toBe(nullable ? true : undefined);
				}

				const metas = mikroOrmMetadataFor('Operation');
				expect(metas.length).toBeGreaterThan(0);
				for (const meta of metas) {
					for (const [propertyName, nullable] of Object.entries(OPERATION_JSON_COLUMNS)) {
						const property = meta.properties[propertyName];
						expect(property).toBeDefined();
						expect(property.type?.constructor?.name).toBe('JsonType');
						expect(property.type.getColumnType()).toBe('text');
						expect(property.nullable).toBe(nullable ? true : undefined);
					}
				}

				// MikroORM discovery over every core entity accepts the new mappings — the check a MikroORM boot makes.
				const orm = await isolated.MikroORM.init({
					driver: isolated.BetterSqliteDriver,
					dbName: ':memory:',
					entities: coreEntities as any[],
					connect: false,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
				try {
					const discovered = orm.getMetadata().find('Operation');
					expect(discovered).toBeDefined();
					expect(Object.keys(orm.getMetadata().getAll()).length).toBeGreaterThanOrEqual(coreEntities.length);
					for (const [propertyName, nullable] of Object.entries(OPERATION_JSON_COLUMNS)) {
						const property: any = discovered?.properties[propertyName as never];
						expect(property?.customType?.constructor?.name).toBe('JsonType');
						expect(property?.columnTypes).toEqual(['text']);
						expect(!!property?.nullable).toBe(nullable);
					}
				} finally {
					await orm.close(true);
				}
			},
			ENTITY_GRAPH_TIMEOUT
		);
	});

	describe('on a single property', () => {
		it.each([
			['sqlite', 'simple-json', 'text'],
			['better-sqlite3', 'simple-json', 'text'],
			['postgres', 'jsonb', 'jsonb'],
			['mysql', 'json', 'json']
		])(
			'on %s: TypeORM stores %s under either ORM, MikroORM %s under DB_ORM=mikro-orm',
			(dbType, typeOrmType, mikroOrmType) => {
				const typeOrmFixture = decorateUnder(
					'typeorm',
					dbType,
					() => JsonColumn({ nullable: true }),
					`TypeOrmOn_${dbType}`
				);
				expect(typeOrmColumn(typeOrmFixture)?.options.type).toBe(typeOrmType);
				expect(mikroOrmProperty(typeOrmFixture)).toBeUndefined();

				const mikroOrmFixture = decorateUnder(
					'mikro-orm',
					dbType,
					() => JsonColumn({ nullable: true }),
					`MikroOrmOn_${dbType}`
				);
				expect(typeOrmColumn(mikroOrmFixture)?.options.type).toBe(typeOrmType);
				expect(mikroOrmProperty(mikroOrmFixture)?.type.getColumnType()).toBe(mikroOrmType);
				expect(mikroOrmProperty(mikroOrmFixture)?.nullable).toBe(true);

				// `@JsonbColumn` forces jsonb on Postgres only, and takes the dialect's own JSON storage elsewhere.
				// Corrected: this case used to assert jsonb on every dialect, which is the type TypeORM refuses on
				// MySQL, so an entity declaring one (`SearchDocument.attributes`) stopped the API booting there.
				// The migrations create the column as the plain JSON storage below on every other dialect.
				const forcedTypeOrm = decorateUnder(
					'typeorm',
					dbType,
					() => JsonbColumn(),
					`ForcedTypeOrmOn_${dbType}`
				);
				expect(typeOrmColumn(forcedTypeOrm)?.options.type).toBe(dbType === 'postgres' ? 'jsonb' : typeOrmType);
				const forcedMikroOrm = decorateUnder(
					'mikro-orm',
					dbType,
					() => JsonbColumn(),
					`ForcedMikroOrmOn_${dbType}`
				);
				expect(mikroOrmProperty(forcedMikroOrm)?.type.getColumnType()).toBe(
					dbType === 'postgres' ? 'jsonb' : mikroOrmType
				);
			}
		);

		it('with DB_ORM unset registers the TypeORM column exactly as before, whatever ORM_TYPE says', () => {
			setEnv('ORM_TYPE', 'mikro-orm');
			const Fixture = decorateUnder(
				undefined,
				'postgres',
				() => JsonColumn<{ a: number }>({ nullable: true, comment: 'a comment', defaultValue: { a: 1 } }),
				'UnsetOrmFixture'
			);

			const column = typeOrmColumn(Fixture);
			expect(column).toBeDefined();
			expect(column!.mode).toBe('regular');
			expect(column!.options).toEqual(
				expect.objectContaining({ nullable: true, comment: 'a comment', type: 'jsonb' })
			);
			expect(column!.options).not.toHaveProperty('defaultValue');
			expect(column!.options).not.toHaveProperty('forceType');
			const transformer = column!.options.transformer as any;
			expect(transformer.to({ a: 2 })).toEqual({ a: 2 });
			expect(transformer.to(undefined)).toBeNull();
			expect(transformer.from(null)).toEqual({ a: 1 });
			expect(transformer.from('{"a":3}')).toEqual({ a: 3 });
			expect(mikroOrmProperty(Fixture)).toBeUndefined();
		});

		it('with DB_ORM=mikro-orm registers the MikroORM property whether or not ORM_TYPE is set', () => {
			setEnv('ORM_TYPE', undefined);
			const Fixture = decorateUnder(
				'mikro-orm',
				'better-sqlite3',
				() => JsonArrayColumn<string>(),
				'MikroOrmNoOrmTypeFixture'
			);

			// TypeORM's column as well: its data source runs under MikroORM too.
			expect(typeOrmColumn(Fixture)?.options.type).toBe('simple-json');
			const property = mikroOrmProperty(Fixture);
			expect(property).toBeDefined();
			expect(property.type.convertToJSValue(null)).toEqual([]);
		});
	});

	describe('a MikroORM round trip on SQLite', () => {
		let orm: MikroORM;
		let Fixture: new () => { id: string; state?: unknown; input?: unknown; tags?: unknown };

		beforeAll(async () => {
			setEnv('DB_ORM', 'mikro-orm');
			setEnv('DB_TYPE', 'better-sqlite3');

			// Declared here, not at the top of the file, so its decorators run under the environment set above.
			@MikroOrmEntity({ tableName: 'json_column_fixture' })
			class JsonColumnRoundTrip {
				@PrimaryKey({ type: 'string' })
				id!: string;

				@JsonColumn<Record<string, unknown>>({ nullable: true })
				state?: Record<string, unknown> | null;

				@JsonColumn<Record<string, unknown>>({ defaultValue: {} })
				input!: Record<string, unknown>;

				@JsonArrayColumn<string>({ nullable: true })
				tags?: string[];
			}
			Fixture = JsonColumnRoundTrip;

			orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: ':memory:',
				entities: [JsonColumnRoundTrip],
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});
			await orm.schema.createSchema();
		});

		afterAll(async () => {
			await orm?.close(true);
		});

		it('declares the columns, writes JSON text and hydrates the values back', async () => {
			const ddl = await orm.schema.getCreateSchemaSQL();
			expect(ddl).toMatch(/`state` text null/);
			expect(ddl).toMatch(/`input` text not null/);

			const em = orm.em.fork();
			em.persist(
				em.create(Fixture, {
					id: 'with-values',
					state: { cursor: 2, vars: { note: 'x', list: [1, 2] } },
					input: { request: true },
					tags: ['a', 'b']
				} as any)
			);
			em.persist(em.create(Fixture, { id: 'with-nulls', state: null, input: {}, tags: null } as any));
			await em.flush();

			const rows = await orm.em
				.getConnection()
				.execute('SELECT id, state, input, tags FROM json_column_fixture ORDER BY id');
			expect(rows).toEqual([
				{ id: 'with-nulls', state: null, input: '{}', tags: null },
				{
					id: 'with-values',
					state: '{"cursor":2,"vars":{"note":"x","list":[1,2]}}',
					input: '{"request":true}',
					tags: '["a","b"]'
				}
			]);

			const reader = orm.em.fork();
			const withValues: any = await reader.findOneOrFail(Fixture, { id: 'with-values' });
			expect(withValues.state).toEqual({ cursor: 2, vars: { note: 'x', list: [1, 2] } });
			expect(withValues.input).toEqual({ request: true });
			expect(withValues.tags).toEqual(['a', 'b']);

			const withNulls: any = await reader.findOneOrFail(Fixture, { id: 'with-nulls' });
			expect(withNulls.state).toBeNull();
			expect(withNulls.input).toEqual({});
			// MikroORM's hydrator assigns a stored NULL without consulting the type, so the `[]` default
			// `@JsonArrayColumn` gives a TypeORM read does not apply here (see the decorator's header).
			expect(withNulls.tags).toBeNull();
		});

		it('flushes nothing for an untouched row, and writes a changed value', async () => {
			const em = orm.em.fork();
			em.persist(em.create(Fixture, { id: 'dirty-check', state: { step: 1 }, input: { a: 1 } } as any));
			await em.flush();

			const reader = orm.em.fork();
			const row: any = await reader.findOneOrFail(Fixture, { id: 'dirty-check' });
			reader.getUnitOfWork().computeChangeSets();
			expect(reader.getUnitOfWork().getChangeSets()).toHaveLength(0);

			row.state = { ...row.state, step: 2 };
			await reader.flush();

			const [stored] = await orm.em
				.getConnection()
				.execute('SELECT state FROM json_column_fixture WHERE id = ?', ['dirty-check']);
			expect(stored.state).toBe('{"step":2}');
		});
	});
});
