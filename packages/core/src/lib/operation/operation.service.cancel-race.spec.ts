import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntityManager as TypeOrmEntityManager, EntitySchema } from 'typeorm';
import {
	EntityCaseNamingStrategy,
	EntityManager as MikroOrmEntityManager,
	EntitySchema as MikroOrmEntitySchema,
	MikroORM,
	Type
} from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { IOperationStepContext } from './operation.contract';
import { Operation } from './operation.entity';
import { OperationStep } from './operation-step.entity';
import { OperationRegistry } from './operation.registry';
import { OperationService } from './operation.service';

/**
 * A cancellation that lands while a worker is inside a step, against a real database, under both ORMs.
 *
 * `cancel()` is a request from another caller, and it writes the operation's row while the worker that
 * holds the lease is running a step: `state.cancelRequested`, and — once a step has applied something —
 * the operator's reason as an `OPERATION_CANCELED` `lastError`. The worker's own writes after the step
 * used to save back the whole object it read when it renewed its lease, and TypeORM's `save` writes every
 * column that differs from the row, so the worker's stale `state` and `lastError` went over the
 * cancellation: the flag and the reason were lost, the worker ran the rest of the plan, and `retry()` —
 * whose "cancelled by a caller" refusal reads the flag — re-drove work somebody had deliberately
 * abandoned. A worker that noticed the flag itself, between steps, wrote its own generic message over the
 * operator's reason as well.
 *
 * **Why the database is real.** The defect is which columns reach the row and in what order, and a table
 * double that shares objects with its caller cannot lose an update: the stale object and the stored row are
 * the same object. Every case here reads the outcome back from the table.
 *
 * **The MikroORM half shares one SQLite file between the two ORMs.** Under `DB_ORM=mikro-orm` the
 * runtime's writes of the operation row go through MikroORM, while its reads, its claim and its step rows
 * still travel TypeORM; the two halves have to see one database for a pass to be driven at all. The file
 * lives in the temporary directory and is removed after each case.
 *
 * The tables are mapped by fixture schemas that carry what the runtime reads and writes. The real entities
 * cannot be mapped here: they reach the whole application graph.
 */

type Row = Record<string, any>;

const TYPE = 'ORDER_CHECKOUT';
const REASON = 'the buyer withdrew';

/*
|--------------------------------------------------------------------------
| TypeORM: `Operation` and `OperationStep` bound to schemas of the two tables
|--------------------------------------------------------------------------
*/

// `target` binds each schema to the real class, so the service's own `manager.save(Operation, …)`,
// `createQueryBuilder(Operation, …)` and `update(Operation, …)` resolve to it. A JSON column is
// `simple-json`, which is what `@JsonColumn` maps to on SQLite.
const TypeOrmOperation = new EntitySchema<any>({
	name: 'Operation',
	target: Operation,
	tableName: 'operation',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		type: { type: 'varchar' },
		status: { type: 'varchar', default: 'PENDING' },
		input: { type: 'simple-json', nullable: true },
		state: { type: 'simple-json', nullable: true },
		result: { type: 'simple-json', nullable: true },
		attemptCount: { type: 'int', default: 0 },
		maxAttempts: { type: 'int', default: 3 },
		lockedAt: { type: 'datetime', nullable: true },
		lockedBy: { type: 'varchar', nullable: true },
		leaseExpiresAt: { type: 'datetime', nullable: true },
		lastError: { type: 'text', nullable: true },
		idempotencyKey: { type: 'varchar', nullable: true },
		parentOperationId: { type: 'varchar', nullable: true },
		startedAt: { type: 'datetime', nullable: true },
		finishedAt: { type: 'datetime', nullable: true },
		deadlineAt: { type: 'datetime', nullable: true },
		aggregateType: { type: 'varchar', nullable: true },
		aggregateId: { type: 'varchar', nullable: true },
		correlationId: { type: 'varchar', nullable: true }
	}
});

const TypeOrmOperationStep = new EntitySchema<any>({
	name: 'OperationStep',
	target: OperationStep,
	tableName: 'operation_step',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		operationId: { type: 'varchar' },
		name: { type: 'varchar' },
		order: { type: 'int' },
		status: { type: 'varchar', default: 'PENDING' },
		input: { type: 'simple-json', nullable: true },
		output: { type: 'simple-json', nullable: true },
		compensationData: { type: 'simple-json', nullable: true },
		attemptCount: { type: 'int', default: 0 },
		lastError: { type: 'text', nullable: true },
		startedAt: { type: 'datetime', nullable: true },
		finishedAt: { type: 'datetime', nullable: true }
	}
});

/*
|--------------------------------------------------------------------------
| MikroORM: the operation table under the name the service addresses it by
|--------------------------------------------------------------------------
*/

/**
 * A date as TypeORM's better-sqlite3 driver stores one: `YYYY-MM-DD HH:MM:SS.SSS`, in UTC.
 *
 * MikroORM's own SQLite spelling is a millisecond timestamp. The two ORMs share one file in the MikroORM
 * half, so the fixture writes a date the way the TypeORM half does, and `forceUtcTimezone` makes MikroORM
 * read that zone-less string as UTC rather than in the process's time zone: an instant one half writes — a
 * lease, a deadline — is the same instant to the other on any machine.
 */
class SqliteUtcDateType extends Type<Date | null, string | null> {
	convertToDatabaseValue(value: Date | string | number | null | undefined): string | null {
		return value === null || value === undefined ? null : new Date(value).toISOString().replace('T', ' ').replace('Z', '');
	}

	convertToJSValue(value: Date | string | number | null | undefined): Date | null {
		if (value === null || value === undefined) {
			return null;
		}

		if (value instanceof Date || typeof value === 'number') {
			return new Date(value);
		}

		return new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
	}

	getColumnType(): string {
		return 'datetime';
	}
}

const date = (nullable = true) => ({ type: new SqliteUtcDateType(), nullable });

const MikroOrmOperation = new MikroOrmEntitySchema<any>({
	name: 'Operation',
	tableName: 'operation',
	properties: {
		id: { type: 'string', primary: true },
		createdAt: date(false),
		updatedAt: date(false),
		deletedAt: date(),
		tenantId: { type: 'string', nullable: true },
		organizationId: { type: 'string', nullable: true },
		type: { type: 'string' },
		status: { type: 'string' },
		input: { type: 'json', nullable: true },
		state: { type: 'json', nullable: true },
		result: { type: 'json', nullable: true },
		attemptCount: { type: 'number' },
		maxAttempts: { type: 'number' },
		lockedAt: date(),
		lockedBy: { type: 'string', nullable: true },
		leaseExpiresAt: date(),
		lastError: { type: 'text', nullable: true },
		idempotencyKey: { type: 'string', nullable: true },
		parentOperationId: { type: 'string', nullable: true },
		startedAt: date(),
		finishedAt: date(),
		deadlineAt: date(),
		aggregateType: { type: 'string', nullable: true },
		aggregateId: { type: 'string', nullable: true },
		correlationId: { type: 'string', nullable: true }
	} as any
});

/*
|--------------------------------------------------------------------------
| The harnesses
|--------------------------------------------------------------------------
*/

interface IHarness {
	service: OperationService;
	registry: OperationRegistry;
	/** The operation row as the table holds it, JSON columns parsed. */
	operationRow(id: string): Promise<Row>;
	/** A step row as the table holds it. */
	stepRow(operationId: string, name: string): Promise<Row>;
	/** How many operation-row writes each ORM's targeted update carried. */
	writes(): { typeOrm: number; mikroOrm: number };
	close(): Promise<void>;
}

/** The publisher the service announces through; the facts are not what this suite is about. */
function publisher() {
	return {
		operationStepChanged: jest.fn().mockResolvedValue(true),
		operationCompleted: jest.fn().mockResolvedValue(true),
		operationFailed: jest.fn().mockResolvedValue(true)
	};
}

/** A repository the TypeORM half must never reach: any member it is asked for fails the case. */
function unreachable(name: string): any {
	return new Proxy(
		{},
		{
			get: (_target, property) => {
				throw new Error(`The ${name} was reached (${String(property)}) on a TypeORM installation.`);
			}
		}
	);
}

/** Reads a row back through the data source, outside the service. */
async function readRow(dataSource: DataSource, table: string, where: string, parameters: unknown[]): Promise<Row> {
	const [row] = await dataSource.query(`SELECT * FROM "${table}" WHERE ${where}`, parameters);

	for (const column of ['state', 'result', 'input', 'output', 'compensationData']) {
		if (typeof row?.[column] === 'string') {
			row[column] = JSON.parse(row[column]);
		}
	}

	return row;
}

/** Counts the targeted updates of the `operation` table each ORM issues. */
function countWrites() {
	const typeOrm = jest
		.spyOn(TypeOrmEntityManager.prototype, 'update')
		.mockName('TypeORM update') as jest.SpyInstance;
	const mikroOrm = jest
		.spyOn(MikroOrmEntityManager.prototype, 'nativeUpdate')
		.mockName('MikroORM nativeUpdate') as jest.SpyInstance;
	const onOperation = (spy: jest.SpyInstance) =>
		spy.mock.calls.filter(([target]) => target === Operation || target === 'Operation').length;

	return () => ({ typeOrm: onOperation(typeOrm), mikroOrm: onOperation(mikroOrm) });
}

async function typeOrmDataSource(database: string): Promise<DataSource> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database,
		entities: [TypeOrmOperation, TypeOrmOperationStep],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});

	return dataSource.initialize();
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = await typeOrmDataSource(':memory:');
	const registry = new OperationRegistry();
	const service = new OperationService(
		dataSource.getRepository(Operation) as any,
		unreachable('MikroORM operation repository'),
		dataSource.getRepository(OperationStep) as any,
		unreachable('MikroORM operation-step repository'),
		registry,
		publisher() as never
	);

	jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

	const writes = countWrites();

	return {
		service,
		registry,
		operationRow: (id) => readRow(dataSource, 'operation', '"id" = ?', [id]),
		stepRow: (operationId, name) =>
			readRow(dataSource, 'operation_step', '"operationId" = ? AND "name" = ?', [operationId, name]),
		writes,
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const file = join(tmpdir(), `operation-cancel-race-${randomUUID()}.sqlite`);
	// TypeORM creates the tables; MikroORM maps the one it writes onto the same file.
	const dataSource = await typeOrmDataSource(file);
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: file,
		entities: [MikroOrmOperation],
		// The naming strategy production sets, so a property lands on the column TypeORM created for it.
		namingStrategy: EntityCaseNamingStrategy,
		// TypeORM's dates carry no zone; they are UTC (see `SqliteUtcDateType`).
		forceUtcTimezone: true,
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	const registry = new OperationRegistry();
	const service = new OperationService(
		dataSource.getRepository(Operation) as any,
		new MikroOrmBaseEntityRepository<any>(orm.em as any, 'Operation') as any,
		dataSource.getRepository(OperationStep) as any,
		unreachable('MikroORM operation-step repository'),
		registry,
		publisher() as never
	);

	jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);

	const writes = countWrites();

	return {
		service,
		registry,
		operationRow: (id) => readRow(dataSource, 'operation', '"id" = ?', [id]),
		stepRow: (operationId, name) =>
			readRow(dataSource, 'operation_step', '"operationId" = ? AND "name" = ?', [operationId, name]),
		writes,
		close: async () => {
			await orm.close(true);
			await dataSource.destroy();
			rmSync(file, { force: true });
		}
	};
}

/** What a plan's handlers did. */
interface ITrace {
	invoked: string[];
	compensated: string[];
}

/**
 * Registers a plan over the named steps. `during` runs inside a step, after it was invoked and before it
 * returns: it is where a case lands its cancellation, and a hook that throws fails the step.
 */
function plan(
	harness: IHarness,
	names: string[],
	during: Partial<Record<string, (context: IOperationStepContext) => Promise<void>>> = {}
): ITrace {
	const trace: ITrace = { invoked: [], compensated: [] };

	harness.registry.register(TYPE, {
		steps: names.map((name, index) => ({
			name,
			order: index + 1,
			invoke: async (_input, context) => {
				trace.invoked.push(name);
				await during[name]?.(context);

				return { output: { [name]: 'done' }, compensationData: { step: name } };
			},
			compensate: async () => {
				trace.compensated.push(name);
			}
		}))
	});

	return trace;
}

/** The error a row records, as an object. */
const errorOf = (row: Row): Row => JSON.parse(row.lastError);

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
] as const)('A cancellation that lands while a worker holds the operation (%s, real SQLite)', (orm, createHarness) => {
	let harness: IHarness;

	beforeEach(async () => {
		harness = await createHarness();
	});

	afterEach(async () => {
		await harness?.close();
		jest.restoreAllMocks();
	});

	it('survives the step it landed in, and the step is undone instead of the rest of the plan running', async () => {
		const { service } = harness;
		let answered: Operation | undefined;

		// The cancellation lands inside the first step: nothing is `COMPLETED` yet, but the step is
		// applying its effect under the worker's live lease.
		const trace = plan(harness, ['reserve', 'charge'], {
			reserve: async (context) => {
				answered = await service.cancel(context.operationId, { reason: REASON });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string, { ownerId: 'worker-a' });
		const row = await harness.operationRow(operation.id as string);

		// Control: `cancel()` settled the operation `CANCELED` under the running step, the step's success
		// write then put the worker's `RUNNING` and its flag-less `state` back over it, and `charge` ran.
		// A worker holding a live lease is left to observe the request itself, between steps.
		expect(answered?.status).toBe('RUNNING');
		expect(trace.invoked).toEqual(['reserve']);
		expect(trace.compensated).toEqual(['reserve']);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(row.status).toBe('COMPENSATED');
		expect(row.state.cancelRequested).toBe(true);
		expect(errorOf(row)).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });

		await expect(service.retry(operation.id as string)).rejects.toThrow(/cancelled by a caller/);
	});

	it('survives a later step’s success write, with the operator’s reason, and the undo walks every applied step', async () => {
		const { service } = harness;

		const trace = plan(harness, ['reserve', 'charge', 'confirm'], {
			charge: async (context) => {
				await service.cancel(context.operationId, { reason: REASON });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string, { ownerId: 'worker-a' });
		const row = await harness.operationRow(operation.id as string);

		// Control: the success write of `charge` replaced `state` and cleared `lastError` with the values
		// the worker read before the cancellation, so `confirm` ran and the operation completed.
		expect(trace.invoked).toEqual(['reserve', 'charge']);
		expect(trace.compensated).toEqual(['charge', 'reserve']);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(row.state.cancelRequested).toBe(true);
		// The step's own progress is merged beside the flag, not dropped for it.
		expect(row.state.cursor).toBe(2);
		expect(Object.keys(row.state.stepOutputs)).toEqual(['reserve', 'charge']);
		expect(errorOf(row)).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });
		expect(row.result.error).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });

		await expect(service.retry(operation.id as string)).rejects.toThrow(/cancelled by a caller/);
	});

	it('survives the failure write of the step it landed in, and the operation records the operator’s reason', async () => {
		const { service } = harness;

		const trace = plan(harness, ['reserve', 'charge'], {
			charge: async (context) => {
				await service.cancel(context.operationId, { reason: REASON });

				throw Object.assign(new Error('the card was declined'), { code: 'PAYMENT_DECLINED', retryable: false });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string, { ownerId: 'worker-a' });

		const row = await harness.operationRow(operation.id as string);
		const step = await harness.stepRow(operation.id as string, 'charge');

		// Control: the failure write saved the worker's object back, which dropped the flag and put the
		// step's error over the reason — and `retry()` then re-drove the cancelled work.
		expect(trace.compensated).toEqual(['reserve']);
		expect(row.status).toBe('COMPENSATED');
		expect(row.state.cancelRequested).toBe(true);
		expect(row.attemptCount).toBe(1);
		expect(errorOf(row)).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });
		// Why the step failed stays on the step's own row.
		expect(errorOf(step)).toMatchObject({ code: 'PAYMENT_DECLINED' });

		await expect(service.retry(operation.id as string)).rejects.toThrow(/cancelled by a caller/);
		expect(trace.invoked).toEqual(['reserve', 'charge']);
	});

	it('answers a cancellation a worker notices between steps with the reason the operator gave', async () => {
		const { service } = harness;
		const trace = plan(harness, ['reserve', 'charge']);
		const { operation } = await service.start({ type: TYPE, input: {} });

		// A pass applies the first step and releases the lease; a second worker takes the operation.
		await service.execute(operation.id as string, { ownerId: 'worker-a', maxSteps: 1 });
		expect(await service.claim(operation.id as string, 'worker-b')).not.toBeNull();

		// The operator cancels while worker-b holds it, so the reason is recorded and the undo is left to it.
		const answered = await service.cancel(operation.id as string, { reason: REASON });
		expect(answered.status).toBe('RUNNING');

		const result = await service.execute(operation.id as string, { ownerId: 'worker-b' });
		const row = await harness.operationRow(operation.id as string);

		// Control: the worker's own check wrote "cancelled before the next step" over the operator's words.
		expect(trace.invoked).toEqual(['reserve']);
		expect(trace.compensated).toEqual(['reserve']);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(errorOf(row)).toEqual({ code: 'OPERATION_CANCELED', message: REASON, retryable: false });
	});

	it(`writes the operation row through ${orm === MultiORMEnum.MikroORM ? 'MikroORM' : 'TypeORM'} alone`, async () => {
		const { service } = harness;

		plan(harness, ['reserve', 'charge'], {
			charge: async (context) => {
				await service.cancel(context.operationId, { reason: REASON });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string, { ownerId: 'worker-a' });

		// Every move of the row after `start` is a targeted update, and it is the configured ORM's: under
		// `DB_ORM=mikro-orm` TypeORM carries no column metadata for the entity. (The TypeORM half's MikroORM
		// repository throws on any member it is asked for.)
		const writes = harness.writes();

		if (orm === MultiORMEnum.MikroORM) {
			expect(writes.mikroOrm).toBeGreaterThan(0);
			expect(writes.typeOrm).toBe(0);
		} else {
			expect(writes.typeOrm).toBeGreaterThan(0);
			expect(writes.mikroOrm).toBe(0);
		}
	});
});
