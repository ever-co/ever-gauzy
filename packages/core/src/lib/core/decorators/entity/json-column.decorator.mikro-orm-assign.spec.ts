import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity as MikroOrmEntity, MetadataStorage, MikroORM, PrimaryKey } from '@mikro-orm/core';
import { CrudService } from '../../crud/crud.service';
import { MikroOrmBaseEntityRepository } from '../../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../../utils';
import { JsonArrayColumn, JsonColumn } from './json-column.decorator';

/**
 * A `@JsonColumn` holds an object or an array on MikroORM, and MikroORM's assigner accepts one.
 *
 * **The defect.** The MikroORM type `@JsonColumn` maps a column with answers `compareAsType()` with `'string'`, so
 * that the dirty check compares the serialised text, and a MikroORM `Type`'s `runtimeType` is its compare type
 * unless the type says otherwise. Every JSON column whose TypeScript type the metadata cannot read — an interface,
 * a `Record`, a union such as `JsonData`, all of which reflect as `Object` — was therefore a `string` property to
 * MikroORM. Nothing noticed while rows were only created (`em.create`) or set property by property; but
 * `em.assign`, which `CrudService.save` writes a stored row with under MikroORM, validates a scalar against its
 * runtime type, and it refused every object and array:
 *
 *   ValidationError: Trying to set IdempotencyKey.responseBody of type 'string' to { … } of type 'Object'
 *
 * so no idempotency key was ever settled, and no other JSON column could be saved onto a stored row. The type now
 * answers the runtime type MikroORM's own `JsonType` answers, `any`, and keeps comparing as text.
 *
 * **What is real here.** MikroORM on in-memory better-sqlite3, a class decorated with the platform's own
 * `@JsonColumn` under `DB_ORM=mikro-orm`, and the platform's `CrudService.save`.
 */

interface IJsonRow {
	id: string;
	body?: Record<string, unknown> | string | null;
	input?: Record<string, unknown>;
	tags?: string[] | null;
}

/** The options `CrudService.save` assigns a payload onto a stored row with. */
const SAVE_ASSIGN_OPTIONS = { updateNestedEntities: false, onlyOwnProperties: true, onlyProperties: true };

class JsonRowService extends CrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

function setEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
}

describe('@JsonColumn under MikroORM assign', () => {
	const originalEnv = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };

	let orm: MikroORM<BetterSqliteDriver>;
	let Fixture: new () => IJsonRow;

	const stored = async (id: string): Promise<Record<string, unknown>> =>
		(await orm.em.getConnection().execute('SELECT body, input, tags FROM json_assign_fixture WHERE id = ?', [id]))[0];

	beforeAll(async () => {
		setEnv('DB_ORM', 'mikro-orm');
		setEnv('DB_TYPE', 'better-sqlite3');

		// Declared here, not at the top of the file, so its decorators run under the environment set above. `body`
		// is typed as `IdempotencyKey.responseBody` is (`JsonData`), which reflects as `Object`.
		@MikroOrmEntity({ tableName: 'json_assign_fixture' })
		class JsonAssignFixture implements IJsonRow {
			@PrimaryKey({ type: 'string' })
			id!: string;

			@JsonColumn<Record<string, unknown> | string>({ nullable: true })
			body?: Record<string, unknown> | string | null;

			@JsonColumn<Record<string, unknown>>({ defaultValue: {} })
			input!: Record<string, unknown>;

			@JsonArrayColumn<string>({ nullable: true })
			tags?: string[] | null;
		}
		Fixture = JsonAssignFixture;

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [JsonAssignFixture],
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.schema.createSchema();

		setEnv('DB_ORM', originalEnv.DB_ORM);
		setEnv('DB_TYPE', originalEnv.DB_TYPE);
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(async () => {
		await orm.em.getConnection().execute('DELETE FROM json_assign_fixture');
		await orm.em
			.getConnection()
			.execute('INSERT INTO json_assign_fixture (id, body, input, tags) VALUES (?, ?, ?, ?)', [
				'stored',
				'{"first":true}',
				'{}',
				'["a"]'
			]);
	});

	afterEach(() => jest.restoreAllMocks());

	it('assigns an object, an array and a string to a JSON column of a stored row', async () => {
		const em = orm.em.fork();
		const row = await em.findOneOrFail(Fixture, { id: 'stored' });

		// With `CrudService.save`'s options and with MikroORM's defaults alike.
		expect(() => em.assign(row, { body: { status: 201, lines: [{ sku: 'A-1' }] } } as any, SAVE_ASSIGN_OPTIONS)).not.toThrow();
		expect(() => em.assign(row, { body: [1, 2, 3] } as any)).not.toThrow();
		expect(() => em.assign(row, { body: 'plain text' } as any)).not.toThrow();
		expect(() => em.assign(row, { input: { request: { nested: [true] } }, tags: ['a', 'b'] } as any)).not.toThrow();

		await em.flush();
		expect(await stored('stored')).toEqual({
			body: '"plain text"',
			input: '{"request":{"nested":[true]}}',
			tags: '["a","b"]'
		});
	});

	it("is written by CrudService.save onto a stored row on MikroORM, as TypeORM's save writes it", async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const service = () =>
			new JsonRowService({}, new MikroOrmBaseEntityRepository<IJsonRow>(orm.em.fork() as any, Fixture));

		const body = { id: 'order-1', createdAt: '2026-03-01T10:00:00.000Z', total: 42.5, lines: [{ sku: 'A-1', price: null }] };
		await service().save({ id: 'stored', body, input: { request: true } } as any);

		// The text TypeORM's `simple-json` column holds for the same value.
		expect(await stored('stored')).toEqual({ body: JSON.stringify(body), input: '{"request":true}', tags: '["a"]' });

		const [read] = await service().find({ where: { id: 'stored' } } as any);
		expect(read).toMatchObject({ id: 'stored', body, input: { request: true }, tags: ['a'] });
	});

	it('keeps comparing as text: an equal value assigned onto a stored row writes nothing', async () => {
		const em = orm.em.fork();
		const row = await em.findOneOrFail(Fixture, { id: 'stored' });

		em.assign(row, { body: { first: true }, input: {}, tags: ['a'] } as any, SAVE_ASSIGN_OPTIONS);
		em.getUnitOfWork().computeChangeSets();

		expect(em.getUnitOfWork().getChangeSets()).toHaveLength(0);
	});

	it("answers MikroORM's own JSON runtime type where the TypeScript type reflects as Object, and keeps a readable one", () => {
		const properties = orm.getMetadata().get(Fixture.name).properties as Record<string, { runtimeType?: string }>;

		expect(properties.body.runtimeType).toBe('any');
		expect(properties.input.runtimeType).toBe('any');
		// `string[]` reflects as `Array`, which the metadata reads before the type is asked.
		expect(properties.tags.runtimeType).toBe('array');
	});

	it('builds no MikroORM type at all under DB_ORM=typeorm, so the TypeORM path is untouched', () => {
		setEnv('DB_ORM', 'typeorm');
		try {
			class TypeOrmOnlyJsonFixture {
				body?: Record<string, unknown>;
			}
			JsonColumn({ nullable: true })(TypeOrmOnlyJsonFixture.prototype, 'body');

			expect(MetadataStorage.getMetadataFromDecorator(TypeOrmOnlyJsonFixture as any).properties).not.toHaveProperty('body');
		} finally {
			setEnv('DB_ORM', originalEnv.DB_ORM);
		}
	});
});
