/**
 * `withDeleted` as the CRUD base reads it, on both ORMs, against real in-memory SQLite.
 *
 * A list route that passes its raw `@Query()` to the base — every inherited list does, and so does any
 * route mounted with `UseValidationPipe()`, which does not transform — delivers `?withDeleted=false` as
 * the *string* `'false'`. TypeORM's find options and the MikroORM converter both tested the member by
 * truthiness, so the string lifted the soft-delete filter and a caller that asked for live rows was handed
 * the retired ones too. These cases run the kernel's real `CrudService` over a real store per ORM, with the
 * production soft-delete handling on each side (TypeORM's `deleteDate` column, MikroORM's
 * `SoftDeleteHandler`), so the answer is the store's and not a double's.
 */
import '../entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

const RETIRED_AT = new Date('2026-01-01T00:00:00.000Z');
const LIVE_ID = '70000000-0000-4000-8000-000000000001';
const RETIRED_ID = '70000000-0000-4000-8000-000000000002';

const SEED = [
	{ id: LIVE_ID, name: 'live', deletedAt: null },
	{ id: RETIRED_ID, name: 'retired', deletedAt: RETIRED_AT }
];

/** `deleteDate` is what makes TypeORM add its own `deletedAt IS NULL` — the predicate `withDeleted` lifts. */
const RetirableSchema = new EntitySchema<any>({
	name: 'Retirable',
	tableName: 'retirable',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

@SoftDeletable(() => RetirableRow, 'deletedAt', () => new Date())
@Entity({ tableName: 'retirable' })
class RetirableRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string' })
	name!: string;

	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

class RetirableService extends CrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

interface IHarness {
	service(): RetirableService;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [RetirableSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const rows: Repository<any> = dataSource.getRepository('Retirable');
	await rows.save(SEED);

	return {
		service: () => new RetirableService(rows, {}),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [RetirableRow],
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();

	const em = orm.em.fork();
	await em.persistAndFlush(SEED.map((row) => em.create(RetirableRow, row)));

	return {
		// A fresh fork per read, so a row is answered because the store answered it rather than because
		// the seeding context still held it.
		service: () => new RetirableService({}, orm.em.fork().getRepository(RetirableRow)),
		close: () => orm.close(true)
	};
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
])('CrudService reads withDeleted as the boolean it states (%s)', (ormType, createHarness) => {
	let harness: IHarness;

	beforeAll(async () => {
		harness = await createHarness();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
	});

	afterEach(() => jest.restoreAllMocks());

	const namesOf = (rows: Array<{ name: string }>): string[] => rows.map((row) => row.name).sort();

	it('answers live rows only for the string a query parameter delivers for false', async () => {
		// The failure scenario: `?withDeleted=false` arrives as 'false', which is truthy.
		for (const stated of ['false', '0', false, undefined]) {
			const { items, total } = await harness.service().findAll({ withDeleted: stated } as any);

			expect(namesOf(items)).toEqual(['live']);
			expect(total).toBe(1);
			expect(namesOf(await harness.service().find({ withDeleted: stated } as any))).toEqual(['live']);
		}
	});

	it('answers retired rows too when the caller states true, as a boolean or as the query string', async () => {
		for (const stated of ['true', '1', true]) {
			const { items, total } = await harness.service().findAll({ withDeleted: stated } as any);

			expect(namesOf(items)).toEqual(['live', 'retired']);
			expect(total).toBe(2);
			expect(namesOf(await harness.service().find({ withDeleted: stated } as any))).toEqual(['live', 'retired']);
		}
	});

	it('reads one retired row only when the caller states true', async () => {
		await expect(harness.service().findOneByIdString(RETIRED_ID, { withDeleted: 'false' } as any)).rejects.toThrow();
		await expect(harness.service().findOneByIdString(RETIRED_ID, { withDeleted: 'true' } as any)).resolves.toMatchObject({
			id: RETIRED_ID
		});
	});

	it('counts retired rows only when the caller states true', async () => {
		await expect(harness.service().count({ withDeleted: 'false' } as any)).resolves.toBe(1);
		await expect(harness.service().count({ withDeleted: 'true' } as any)).resolves.toBe(2);
	});
});
