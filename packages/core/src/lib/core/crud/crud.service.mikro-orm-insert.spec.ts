import '../entities/internal';

import { BadRequestException } from '@nestjs/common';
import { DataSource, DeleteDateColumn, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { ChangeSetType, EntityCaseNamingStrategy, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../decorators/entity';
import { MikroOrmBaseEntityRepository } from '../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { createNewMikroOrmEntity } from './mikro-orm-insert.helper';

/**
 * `CrudService.create` and `createMany` insert the rows they are given under MikroORM, on every dialect.
 *
 * **The defect.** The MikroORM branch builds a new row with `em.create(data, { partial: true, managed: true })`.
 * A managed create of a payload that states its primary key registers the entity as already stored, so the
 * flush has nothing to write for it: `create({ id, ... })` answered with the entity and no row existed. A
 * payload without a key relied on the `gen_random_uuid()` default `BaseEntity.id` is mapped with, which only
 * PostgreSQL has, so on SQLite and MySQL the INSERT was refused — and the branch then logged the error and
 * fell through into the TypeORM branch, which under `DB_ORM=mikro-orm` holds only the entity's skeleton.
 *
 * **What is real here.** The store is MikroORM on in-memory better-sqlite3 — the driver the platform's
 * MikroORM configuration uses for both `sqlite` and `better-sqlite3` — with the row declared through the
 * platform's own decorators under `DB_ORM=mikro-orm`, the naming strategy the platform configures, and the
 * table as the platform's SQLite migrations leave it: no default on the identifier. PostgreSQL and MySQL are
 * exercised through MikroORM itself, initialised for those drivers without a connection, by asking its unit
 * of work what it would INSERT; that is the whole of what the dialect decides.
 */

/** Sets `DB_ORM` for the decorators applied while `define` runs, which is when they choose their ORM. */
function mappedFor<R>(orm: MultiORMEnum, define: () => R): R {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = orm;
	try {
		return define();
	} finally {
		if (previous === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = previous;
		}
	}
}

/** A row as the store holds it. */
interface IInsertRow {
	id?: string;
	name?: string;
	tenantId?: string;
}

/** The two classes as MikroORM sees them in production: the relation owns `tenantId`, the property mirrors it. */
const MIKRO_ORM = mappedFor(MultiORMEnum.MikroORM, () => {
	@MultiORMEntity('insert_tenant')
	class MikroOrmInsertTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => MikroOrmInsertRow, 'deletedAt', () => new Date())
	@MultiORMEntity('insert_row')
	class MikroOrmInsertRow implements IInsertRow {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn({ nullable: true })
		name?: string;

		@MultiORMManyToOne(() => MikroOrmInsertTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: MikroOrmInsertTenant;

		@RelationId((it: MikroOrmInsertRow) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;
	}

	return { Tenant: MikroOrmInsertTenant, Row: MikroOrmInsertRow };
});

/** The same two classes as TypeORM sees them, for the control that the TypeORM branch still inserts. */
const TYPEORM = mappedFor(MultiORMEnum.TypeORM, () => {
	@MultiORMEntity('insert_tenant')
	class TypeOrmInsertTenant {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;
	}

	@SoftDeletable(() => TypeOrmInsertRow, 'deletedAt', () => new Date())
	@MultiORMEntity('insert_row')
	class TypeOrmInsertRow implements IInsertRow {
		@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
		@PrimaryGeneratedColumn('uuid')
		id?: string;

		@DeleteDateColumn()
		@Property({ nullable: true })
		deletedAt?: Date;

		@MultiORMColumn({ nullable: true })
		name?: string;

		@MultiORMManyToOne(() => TypeOrmInsertTenant, { nullable: true, onDelete: 'CASCADE' })
		tenant?: TypeOrmInsertTenant;

		@RelationId((it: TypeOrmInsertRow) => it.tenant)
		@MultiORMColumn({ nullable: true, relationId: true })
		tenantId?: string;
	}

	return { Tenant: TypeOrmInsertTenant, Row: TypeOrmInsertRow };
});

const TENANT = '67000000-0000-4000-8000-00000000000a';
const MISSING_TENANT = '67000000-0000-4000-8000-0000000000ff';
const STORED = '67000000-0000-4000-8000-000000000001';
const STATED = '67000000-0000-4000-8000-000000000002';
const STATED_TOO = '67000000-0000-4000-8000-000000000003';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class InsertRowService extends CrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

describe('CrudService inserts the rows it creates under MikroORM', () => {
	let orm: MikroORM<BetterSqliteDriver>;

	/** Stands in for TypeORM under `DB_ORM=mikro-orm`; the MikroORM branch must never reach it. */
	const typeOrm = { create: jest.fn((row: unknown) => row), save: jest.fn(async (row: unknown) => row) };

	const rows = async (): Promise<Array<IInsertRow>> =>
		orm.em.getConnection().execute('SELECT id, name, tenantId FROM insert_row ORDER BY name');
	const tenants = async (): Promise<number> =>
		Number((await orm.em.getConnection().execute('SELECT count(*) AS count FROM insert_tenant'))[0].count);

	/** A service over a fresh context, so an answer is the store's rather than an earlier call's identity map. */
	const service = () =>
		new InsertRowService(typeOrm, new MikroOrmBaseEntityRepository<IInsertRow>(orm.em.fork(), MIKRO_ORM.Row));

	beforeAll(async () => {
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [MIKRO_ORM.Tenant, MIKRO_ORM.Row],
			extensions: [SoftDeleteHandler],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		const connection = orm.em.getConnection();
		// As the platform's SQLite migrations leave the tables: no default on the identifier.
		await connection.execute('CREATE TABLE insert_tenant (id varchar PRIMARY KEY NOT NULL)');
		await connection.execute(
			`CREATE TABLE insert_row (
				id varchar PRIMARY KEY NOT NULL,
				deletedAt datetime NULL,
				name varchar NULL,
				tenantId varchar NULL REFERENCES insert_tenant (id) ON DELETE CASCADE
			)`
		);
		await connection.execute('INSERT INTO insert_tenant (id) VALUES (?)', [TENANT]);
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(async () => {
		await orm.em.getConnection().execute('DELETE FROM insert_row');
		await orm.em
			.getConnection()
			.execute('INSERT INTO insert_row (id, name, tenantId) VALUES (?, ?, ?)', [STORED, 'stored', TENANT]);
		typeOrm.create.mockClear();
		typeOrm.save.mockClear();
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('inserts a new row whose payload states its id, and keeps a nested `{ id }` a reference', async () => {
		const created = await service().create({ id: STATED, name: 'stated', tenant: { id: TENANT } } as any);

		expect(created).toMatchObject({ id: STATED, name: 'stated' });
		expect(await rows()).toContainEqual({ id: STATED, name: 'stated', tenantId: TENANT });
		// The tenant is referenced, not inserted a second time.
		await expect(tenants()).resolves.toBe(1);
	});

	it('inserts a new row with no id, with a uuid generated for the default SQLite does not have', async () => {
		const created = await service().create({ name: 'unstated', tenant: { id: TENANT } } as any);

		expect(created.id).toMatch(UUID);
		expect(await rows()).toContainEqual({ id: created.id, name: 'unstated', tenantId: TENANT });
	});

	it('inserts every row of a batch, stated ids and generated ones alike', async () => {
		const created = await service().createMany([
			{ id: STATED, name: 'batch-stated', tenant: { id: TENANT } },
			{ id: STATED_TOO, name: 'batch-stated-too' },
			{ name: 'batch-unstated', tenant: { id: TENANT } }
		] as any);

		expect(created.map((row) => row.id)).toEqual([STATED, STATED_TOO, expect.stringMatching(UUID)]);
		expect((await rows()).map((row) => row.name)).toEqual([
			'batch-stated',
			'batch-stated-too',
			'batch-unstated',
			'stored'
		]);
	});

	it('still writes the stored row a payload names by id, rather than inserting another', async () => {
		await service().create({ id: STORED, name: 'renamed' } as any);

		expect(await rows()).toEqual([{ id: STORED, name: 'renamed', tenantId: TENANT }]);
	});

	it('writes a foreign key the payload states only by its relation-id mirror, as TypeORM does', async () => {
		// `tenantId` is `persist: false` under MikroORM; `em.create()` used to leave the relation unset, so the
		// key was written as NULL here (and a required one failed the flush: every MikroORM login's refresh token).
		const created = await service().create({ name: 'mirror', tenantId: TENANT } as any);

		expect(created.tenantId).toBe(TENANT);
		expect(await rows()).toContainEqual({ id: created.id, name: 'mirror', tenantId: TENANT });
		await expect(tenants()).resolves.toBe(1);
	});

	it('writes NULL for a mirror stated as null, and keeps a stated relation over its mirror', async () => {
		const cleared = await service().create({ name: 'mirror-null', tenantId: null } as any);
		const both = await service().create({ name: 'mirror-both', tenant: { id: TENANT }, tenantId: TENANT } as any);

		expect(await rows()).toEqual(
			expect.arrayContaining([
				{ id: cleared.id, name: 'mirror-null', tenantId: null },
				{ id: both.id, name: 'mirror-both', tenantId: TENANT }
			])
		);
	});

	it('writes the mirrors of every row of a batch', async () => {
		const created = await service().createMany([
			{ name: 'batch-mirror', tenantId: TENANT },
			{ id: STATED, name: 'batch-mirror-stated', tenantId: TENANT }
		] as any);

		expect(await rows()).toEqual(
			expect.arrayContaining([
				{ id: created[0].id, name: 'batch-mirror', tenantId: TENANT },
				{ id: STATED, name: 'batch-mirror-stated', tenantId: TENANT }
			])
		);
	});

	it('is refused on the foreign key a mirror names when that row does not exist, so the key really is written', async () => {
		await expect(service().create({ name: 'mirror-refused', tenantId: MISSING_TENANT } as any)).rejects.toThrow(
			BadRequestException
		);

		expect((await rows()).map((row) => row.name)).toEqual(['stored']);
	});

	it('saves back the row create() answered — its relation beside its mirror — where upsert refused it', async () => {
		// `serialize()` answers `wrap(entity).toJSON()`: the unpopulated relation as its key, beside the mirror.
		// Handed both, MikroORM's upsert wrote the relation as a column of its own ("no column named tenant").
		const created = await service().create({ name: 'round-trip', tenantId: TENANT } as any);
		expect(created).toMatchObject({ tenant: TENANT, tenantId: TENANT });

		await service().save({ ...created, name: 'round-tripped' });
		await service().saveMany([{ ...created, name: 'round-tripped-again' }]);

		expect(await rows()).toContainEqual({ id: created.id, name: 'round-tripped-again', tenantId: TENANT });
	});

	it('saves a new row without an id as TypeORM does: a generated uuid, where upsert sent none', async () => {
		const saved = await service().save({ name: 'saved-new', tenantId: TENANT } as any);

		expect(saved.id).toMatch(UUID);
		expect(await rows()).toContainEqual({ id: saved.id, name: 'saved-new', tenantId: TENANT });
	});

	it('ignores payload keys that are no property, as TypeORM does, where upsert wrote them as columns', async () => {
		// A route's DTO can carry fields the entity does not map (`category`, `type` on a product).
		await service().save({ id: STORED, name: 'renamed-by-save', category: 'shoes', type: 'boots' } as any);

		expect(await rows()).toEqual([{ id: STORED, name: 'renamed-by-save', tenantId: TENANT }]);
	});

	it('updates a soft-deleted row its id names rather than inserting a second one, as TypeORM does', async () => {
		await orm.em.getConnection().execute('UPDATE insert_row SET deletedAt = ? WHERE id = ?', [Date.now(), STORED]);

		await service().save({ id: STORED, name: 'retired-renamed' } as any);

		expect(await rows()).toEqual([{ id: STORED, name: 'retired-renamed', tenantId: TENANT }]);
	});

	it('saves a batch of new and stored rows together', async () => {
		const saved = await service().saveMany([
			{ id: STORED, name: 'batch-renamed' },
			{ name: 'batch-new', tenantId: TENANT }
		] as any);

		expect(saved.map((row) => row.name)).toEqual(['batch-renamed', 'batch-new']);
		// `rows()` answers by name.
		expect(await rows()).toEqual([
			{ id: saved[1].id, name: 'batch-new', tenantId: TENANT },
			{ id: STORED, name: 'batch-renamed', tenantId: TENANT }
		]);
	});

	it('updates by a payload naming a relation and its mirror, the relation winning a disagreement', async () => {
		const other = '67000000-0000-4000-8000-00000000000b';
		await orm.em.getConnection().execute('INSERT OR IGNORE INTO insert_tenant (id) VALUES (?)', [other]);

		await service().update(STORED, { tenant: { id: other }, tenantId: TENANT } as any);
		expect(await rows()).toEqual([{ id: STORED, name: 'stored', tenantId: other }]);

		await service().update(STORED, { tenant: TENANT, tenantId: TENANT } as any);
		expect(await rows()).toEqual([{ id: STORED, name: 'stored', tenantId: TENANT }]);
	});

	it('reports a refused insert as a failure, and never answers it through the TypeORM branch', async () => {
		// The tenant does not exist, so the store refuses the row on its foreign key.
		await expect(service().create({ name: 'refused', tenant: { id: MISSING_TENANT } } as any)).rejects.toThrow(
			BadRequestException
		);

		expect(typeOrm.create).not.toHaveBeenCalled();
		expect(typeOrm.save).not.toHaveBeenCalled();
		expect((await rows()).map((row) => row.name)).toEqual(['stored']);
	});
});

/**
 * What each dialect is asked to INSERT for a new row.
 *
 * MikroORM is initialised for PostgreSQL and MySQL without a connection, with the same mapping, and its unit
 * of work is asked for the change set a flush would execute. PostgreSQL evaluates the `gen_random_uuid()`
 * default, so the key is left to it, as TypeORM leaves it there; MySQL and SQLite have no such default, so the
 * key is generated, as TypeORM generates it there. A stated key is written on every dialect.
 */
describe.each([
	['PostgreSQL', PostgreSqlDriver, false],
	['MySQL', MySqlDriver, true],
	['SQLite and better-sqlite3', BetterSqliteDriver, true]
] as const)('createNewMikroOrmEntity on %s', (_label, driver, generatesKey) => {
	let orm: MikroORM;

	beforeAll(async () => {
		orm = await MikroORM.init({
			driver: driver as any,
			dbName: driver === BetterSqliteDriver ? ':memory:' : 'offline',
			connect: false,
			entities: [MIKRO_ORM.Tenant, MIKRO_ORM.Row],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		} as any);
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	/** The change sets a flush of the given payload would execute. */
	function changeSetsFor(payload: object) {
		const em = orm.em.fork();
		const entity = createNewMikroOrmEntity(em.getRepository(MIKRO_ORM.Row), payload, {
			partial: true,
			managed: true
		});
		em.persist(entity);
		const unitOfWork = em.getUnitOfWork();
		unitOfWork.computeChangeSets();
		return unitOfWork.getChangeSets().map((changeSet) => ({
			type: changeSet.type,
			entity: changeSet.name,
			payload: changeSet.payload as Record<string, unknown>
		}));
	}

	it(
		generatesKey ? 'generates the key the dialect has no default for' : 'leaves the key to the database default',
		() => {
			const [insert, ...others] = changeSetsFor({ name: 'new', tenant: { id: TENANT } });

			expect(others).toEqual([]);
			expect(insert).toMatchObject({ type: ChangeSetType.CREATE, entity: MIKRO_ORM.Row.name });
			expect(insert.payload.tenant).toBe(TENANT);
			if (generatesKey) {
				expect(insert.payload.id).toMatch(UUID);
			} else {
				expect(insert.payload).not.toHaveProperty('id');
			}
		}
	);

	it('writes a stated key, and only the row itself', () => {
		const changeSets = changeSetsFor({ id: STATED, name: 'stated', tenant: { id: TENANT } });

		expect(changeSets).toEqual([
			{
				type: ChangeSetType.CREATE,
				entity: MIKRO_ORM.Row.name,
				payload: expect.objectContaining({ id: STATED, name: 'stated', tenant: TENANT })
			}
		]);
	});

	it('CONTROL: the managed create it replaces writes nothing at all for a stated key', () => {
		const em = orm.em.fork();
		em.persist(em.create(MIKRO_ORM.Row, { id: STATED, name: 'stated' } as any, { partial: true, managed: true }));
		const unitOfWork = em.getUnitOfWork();
		unitOfWork.computeChangeSets();

		expect(unitOfWork.getChangeSets()).toEqual([]);
	});
});

/** The TypeORM branch of the same calls, which this change leaves alone, still inserts both kinds of row. */
describe('CrudService inserts the rows it creates under TypeORM (control)', () => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TYPEORM.Tenant, TYPEORM.Row],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.query('INSERT INTO insert_tenant (id) VALUES (?)', [TENANT]);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(() => jest.restoreAllMocks());

	it('inserts a row with a stated id and a row without one', async () => {
		const service = new InsertRowService(dataSource.getRepository(TYPEORM.Row), {});

		await service.create({ id: STATED, name: 'stated', tenant: { id: TENANT } } as any);
		const [generated] = await service.createMany([{ name: 'generated', tenant: { id: TENANT } }] as any);

		expect(generated.id).toMatch(UUID);
		expect(await dataSource.query('SELECT id, name, tenantId FROM insert_row ORDER BY name')).toEqual([
			{ id: generated.id, name: 'generated', tenantId: TENANT },
			{ id: STATED, name: 'stated', tenantId: TENANT }
		]);
	});
});
