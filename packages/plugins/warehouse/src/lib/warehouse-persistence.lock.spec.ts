/**
 * `IWarehouseTransaction.lock` — the row a write takes first so that writes on the same row run one after the other —
 * on both ORMs, against real SQLite.
 *
 * On PostgreSQL and MySQL the read is `SELECT … FOR UPDATE`: TypeORM's `pessimistic_write`, MikroORM's
 * `LockMode.PESSIMISTIC_WRITE` (which MikroORM hands to knex's `forUpdate`). SQLite has no row lock — it serializes
 * writers on the whole database — so there the transaction is the lock: TypeORM is asked for none, because it refuses
 * the clause on SQLite (the control below), and MikroORM's lock compiles to nothing (knex's SQLite compiler drops it).
 *
 * These cases prove that the call is accepted and answers the row on the embedded dialect, and what each ORM is asked
 * for on a server one. The waiting itself needs a server database, and is not faked here.
 */
jest.mock('@gauzy/core', () => {
	const utils = jest.requireActual('@gauzy/core/src/lib/core/utils');

	return {
		MultiORMEnum: utils.MultiORMEnum,
		convertTypeORMWhereToMikroORM: utils.convertTypeORMWhereToMikroORM,
		parseOrderOptions: utils.parseOrderOptions
	};
});

import 'reflect-metadata';
import { DataSource, EntitySchema, LockNotSupportedOnGivenDriverError, Repository } from 'typeorm';
import {
	EntityCaseNamingStrategy,
	EntityManager as MikroOrmEntityManager,
	EntitySchema as MikroOrmEntitySchema,
	LockMode,
	MikroORM
} from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { EntityRepository } from '@mikro-orm/knex';
import { runWarehouseTransaction } from './warehouse-persistence';

/** One row of one table: what a lock is taken on. */
class Held {
	id!: string;
	tenantId?: string | null;
	status?: string | null;
}

const ROW = '00000000-0000-4000-8000-0000000000c1';
const TENANT = '00000000-0000-4000-8000-0000000000c2';

/** The other ORM's half of `runWarehouseTransaction`, which a case must never reach. */
const unreachable = (): never => {
	throw new Error('the other ORM was reached');
};

describe('IWarehouseTransaction.lock under TypeORM', () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [
				new EntitySchema<Held>({
					name: 'Held',
					target: Held,
					tableName: 'held',
					columns: {
						id: { type: String, primary: true },
						tenantId: { type: String, nullable: true },
						status: { type: String, nullable: true }
					}
				})
			],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		await dataSource.query('INSERT INTO "held" ("id", "tenantId", "status") VALUES (?, ?, ?)', [
			ROW,
			TENANT,
			'OPEN'
		]);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await dataSource.destroy();
	});

	it('answers the row inside the transaction on SQLite, asking for no lock clause', async () => {
		const findOne = jest.spyOn(Repository.prototype, 'findOne');

		const held = await runWarehouseTransaction(
			'typeorm',
			() => dataSource.manager,
			unreachable,
			(transaction) => transaction.lock(Held, { id: ROW, tenantId: TENANT })
		);

		expect(held).toMatchObject({ id: ROW, tenantId: TENANT, status: 'OPEN' });
		expect(findOne).toHaveBeenCalledTimes(1);
		expect(findOne.mock.calls[0][0]).toEqual({ where: { id: ROW, tenantId: TENANT } });
	});

	it('control: TypeORM refuses a pessimistic lock on SQLite, which is why none is asked for there', async () => {
		await expect(
			dataSource.manager.transaction((manager) =>
				manager.getRepository(Held).findOne({ where: { id: ROW }, lock: { mode: 'pessimistic_write' } })
			)
		).rejects.toBeInstanceOf(LockNotSupportedOnGivenDriverError);
	});

	it.each(['postgres', 'mysql', 'mariadb'])(
		'on %s it reads the row with pessimistic_write — SELECT … FOR UPDATE',
		async (type) => {
			// A server database cannot be opened here: its manager is stood in for, and what it is asked is recorded.
			const findOne = jest.fn(async () => ({ id: ROW }));
			const manager = { dataSource: { options: { type } }, getRepository: () => ({ findOne }) };

			await runWarehouseTransaction(
				'typeorm',
				() => ({ transaction: (work: (inner: unknown) => Promise<unknown>) => work(manager) }) as never,
				unreachable,
				(transaction) => transaction.lock(Held, { id: ROW })
			);

			expect(findOne).toHaveBeenCalledWith({ where: { id: ROW }, lock: { mode: 'pessimistic_write' } });
		}
	);
});

describe('IWarehouseTransaction.lock under MikroORM', () => {
	let orm: MikroORM;

	beforeEach(async () => {
		orm = await MikroORM.init({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [
				new MikroOrmEntitySchema<Held>({
					class: Held,
					tableName: 'held',
					properties: {
						id: { type: 'string', primary: true },
						tenantId: { type: 'string', nullable: true },
						status: { type: 'string', nullable: true }
					}
				})
			],
			// The naming strategy production sets, so a property lands on the column it names.
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: false,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.getSchemaGenerator().createSchema();
		await orm.em
			.fork()
			.getConnection()
			.execute('INSERT INTO "held" ("id", "tenantId", "status") VALUES (?, ?, ?)', [ROW, TENANT, 'OPEN']);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await orm.close(true);
	});

	it('answers the row in TypeORM’s shape inside the transaction, asking for PESSIMISTIC_WRITE — which SQLite accepts', async () => {
		const findOne = jest.spyOn(MikroOrmEntityManager.prototype, 'findOne');

		const held = await runWarehouseTransaction(
			'mikro-orm',
			unreachable,
			() => new EntityRepository<Held>(orm.em as never, Held),
			(transaction) => transaction.lock(Held, { id: ROW, tenantId: TENANT })
		);

		expect(held).toEqual({ id: ROW, tenantId: TENANT, status: 'OPEN' });
		expect(findOne.mock.calls[0][2]).toMatchObject({ lockMode: LockMode.PESSIMISTIC_WRITE });
	});

	it('control: MikroORM refuses that lock outside a transaction — the warehouse only ever takes it inside one', async () => {
		await expect(
			orm.em.fork().findOne(Held, { id: ROW }, { lockMode: LockMode.PESSIMISTIC_WRITE })
		).rejects.toThrow(/transaction/i);
	});
});
