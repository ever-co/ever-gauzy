/**
 * A read "by id" with a list condition (alternatives joined by OR), on both ORMs, against real in-memory SQLite.
 *
 * The MikroORM side appended `{ id }` to the list as one more alternative, so `findOneByIdString(A, { where: [{ name:
 * 'b' }] })` read "id = A OR name = 'b'" and could answer row B: a service that narrows its reads with a list (the
 * generic reaction service leaves chat reactions out of each alternative) answered a row its id never named. The
 * TypeORM side spread the list into the object (`{ id, 0: …, 1: … }`). Every alternative now gets the id.
 */
import '../entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { MultiORMEnum, concatIdToWhere } from '../utils';
import { CrudService } from './crud.service';

const A_ID = '71000000-0000-4000-8000-000000000001';
const B_ID = '71000000-0000-4000-8000-000000000002';

const SEED = [
	{ id: A_ID, name: 'a' },
	{ id: B_ID, name: 'b' }
];

const NamedSchema = new EntitySchema<any>({
	name: 'NamedRow',
	tableName: 'named_row',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' }
	}
});

@Entity({ tableName: 'named_row' })
class NamedRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string' })
	name!: string;
}

class NamedService extends CrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

interface IHarness {
	service(): NamedService;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [NamedSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	const rows: Repository<any> = dataSource.getRepository('NamedRow');
	await rows.save(SEED);
	return { service: () => new NamedService(rows, {}), close: () => dataSource.destroy() };
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [NamedRow],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();
	const em = orm.em.fork();
	await em.persistAndFlush(SEED.map((row) => em.create(NamedRow, row)));
	return { service: () => new NamedService({}, orm.em.fork().getRepository(NamedRow)), close: () => orm.close(true) };
}

describe('concatIdToWhere', () => {
	it('puts the id on every alternative of a list, never beside them', () => {
		expect(concatIdToWhere('x', [{ name: 'a' }, { name: 'b' }] as any)).toEqual([
			{ id: 'x', name: 'a' },
			{ id: 'x', name: 'b' }
		]);
	});

	it('reads an empty list or no condition as the id alone, and keeps an object condition beside the id', () => {
		expect(concatIdToWhere('x', [] as any)).toEqual({ id: 'x' });
		expect(concatIdToWhere('x', undefined as any)).toEqual({ id: 'x' });
		expect(concatIdToWhere('x', { name: 'a' } as any)).toEqual({ id: 'x', name: 'a' });
	});

	it('keeps the id over an id a condition states', () => {
		expect(concatIdToWhere('x', [{ id: 'y', name: 'a' }] as any)).toEqual([{ id: 'x', name: 'a' }]);
		expect(concatIdToWhere('x', { id: 'y' } as any)).toEqual({ id: 'x' });
	});
});

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
])('CrudService reads by id with a list condition (%s)', (ormType, createHarness) => {
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

	it('never answers a row the id did not name when another alternative matches it', async () => {
		await expect(harness.service().findOneByIdString(A_ID, { where: [{ name: 'b' }] } as any)).rejects.toThrow();
		const tried = await harness.service().findOneOrFailByIdString(A_ID, { where: [{ name: 'b' }] } as any);
		expect(tried.success).toBe(false);
	});

	it('never answers the row another id in the condition names', async () => {
		await expect(harness.service().findOneByIdString(A_ID, { where: { id: B_ID } } as any)).resolves.toMatchObject({ id: A_ID });
		await expect(harness.service().findOneByIdString(A_ID, { where: [{ id: B_ID }] } as any)).resolves.toMatchObject({ id: A_ID });
	});

	it('answers the row the id names when one alternative matches it', async () => {
		await expect(harness.service().findOneByIdString(A_ID, { where: [{ name: 'b' }, { name: 'a' }] } as any)).resolves.toMatchObject({
			id: A_ID
		});
		const tried = await harness.service().findOneOrFailByIdString(A_ID, { where: [{ name: 'b' }, { name: 'a' }] } as any);
		expect(tried).toMatchObject({ success: true, record: { id: A_ID } });
	});
});
