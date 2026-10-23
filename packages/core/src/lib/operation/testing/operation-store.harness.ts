import { DataSource, EntitySchema } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM, Type } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../../core/utils';
import { Operation } from '../operation.entity';
import { OperationStep } from '../operation-step.entity';
import { OperationRegistry } from '../operation.registry';
import { OperationService } from '../operation.service';

/**
 * The durable-operation runtime over a real in-memory SQLite database, on either ORM.
 *
 * **One table shape for both ORMs.** The two tables are created by the same DDL on each side — the
 * columns the SQLite migrations give them, and the constraints the runtime's guarantees rest on:
 * `UQ_operation_tenant_idem` and `UQ_operation_aggregate_live` as `1791000000557` and `1791000000030` state
 * them, `UQ_operation_step`, and `CHK_operation_status_terminal`, which the migrations add on Postgres and
 * MySQL only and which is stated here too so a settlement that left a lease behind is refused on SQLite as
 * it is there. A `step_ledger` table stands in for the local writes a step makes through its manager.
 *
 * **Each ORM is mapped the way production maps it, and the other ORM is unreachable.** The real entities
 * cannot be mapped here — they reach the whole application graph — so fixture schemas carry what the
 * runtime reads and writes. The MikroORM schemas keep the two properties of the production mapping that
 * decide what a MikroORM arm has to do: every `relationId` mirror (`tenantId`, `organizationId`,
 * `parentOperationId`, `operationId`) is `persist: false` beside the many-to-one that owns its column, as
 * `@MultiORMColumn({ relationId: true })` maps it, and the manager refuses work outside a request context
 * (`allowGlobalContext: false`, MikroORM's default), which is where a worker runs. The service is handed the
 * other ORM's repositories as objects that fail the case the moment any member of them is touched.
 */

/** A row as the table holds it. */
export type Row = Record<string, any>;

/** The zero uuid the idempotency index folds a missing scope member into. */
const ZERO = '00000000-0000-0000-0000-000000000000';

/**
 * The tables, as the SQLite migrations shape them, plus the constraints named above.
 */
export const OPERATION_TABLES_DDL: readonly string[] = [
	`CREATE TABLE "operation" (
		"id" varchar PRIMARY KEY NOT NULL,
		"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
		"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
		"deletedAt" datetime,
		"isActive" boolean DEFAULT (1),
		"isArchived" boolean DEFAULT (0),
		"tenantId" varchar,
		"organizationId" varchar,
		"type" varchar(64) NOT NULL,
		"status" varchar NOT NULL DEFAULT ('PENDING'),
		"input" text NOT NULL DEFAULT ('{}'),
		"state" text,
		"result" text,
		"attemptCount" integer NOT NULL DEFAULT (0),
		"maxAttempts" integer NOT NULL DEFAULT (3),
		"lockedAt" datetime,
		"lockedBy" varchar(128),
		"leaseExpiresAt" datetime,
		"lastError" text,
		"idempotencyKey" varchar(255),
		"parentOperationId" varchar,
		"startedAt" datetime,
		"finishedAt" datetime,
		"deadlineAt" datetime,
		"aggregateType" varchar(64),
		"aggregateId" varchar,
		"correlationId" varchar,
		CONSTRAINT "FK_operation_parent" FOREIGN KEY ("parentOperationId") REFERENCES "operation" ("id") ON DELETE SET NULL,
		CONSTRAINT "CHK_operation_status_terminal" CHECK ("lockedAt" IS NULL OR "status" NOT IN ('COMPLETED', 'FAILED', 'COMPENSATED', 'CANCELED'))
	)`,
	`CREATE UNIQUE INDEX "UQ_operation_tenant_idem" ON "operation" (COALESCE("tenantId", '${ZERO}'), COALESCE("organizationId", '${ZERO}'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`,
	`CREATE UNIQUE INDEX "UQ_operation_aggregate_live" ON "operation" ("aggregateType", "aggregateId") WHERE "aggregateType" IS NOT NULL AND "status" IN ('PENDING','RUNNING','COMPENSATING') AND "deletedAt" IS NULL`,
	`CREATE TABLE "operation_step" (
		"id" varchar PRIMARY KEY NOT NULL,
		"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
		"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
		"deletedAt" datetime,
		"isActive" boolean DEFAULT (1),
		"isArchived" boolean DEFAULT (0),
		"tenantId" varchar,
		"organizationId" varchar,
		"operationId" varchar NOT NULL,
		"name" varchar(64) NOT NULL,
		"order" integer NOT NULL,
		"status" varchar NOT NULL DEFAULT ('PENDING'),
		"input" text,
		"output" text,
		"compensationData" text,
		"attemptCount" integer NOT NULL DEFAULT (0),
		"lastError" text,
		"startedAt" datetime,
		"finishedAt" datetime,
		CONSTRAINT "FK_operation_step_operation" FOREIGN KEY ("operationId") REFERENCES "operation" ("id") ON DELETE CASCADE
	)`,
	`CREATE UNIQUE INDEX "UQ_operation_step" ON "operation_step" ("operationId", "name") WHERE "deletedAt" IS NULL`,
	`CREATE TABLE "step_ledger" ("entry" varchar PRIMARY KEY NOT NULL, "operationId" varchar NOT NULL)`
];

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
| MikroORM: the two tables as the production mapping reaches them
|--------------------------------------------------------------------------
*/

/**
 * A date as TypeORM's better-sqlite3 driver stores one: `YYYY-MM-DD HH:MM:SS.SSS`, in UTC.
 *
 * MikroORM's own SQLite spelling is a millisecond timestamp. The fixture writes a date the way the TypeORM
 * half does, so the two tables hold the same text on either side, and `forceUtcTimezone` makes MikroORM
 * read that zone-less string as UTC rather than in the process's time zone.
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

/**
 * A `relationId` mirror and the many-to-one that owns its column, as `@MultiORMColumn({ relationId: true })`
 * and `@MultiORMManyToOne` map the pair under MikroORM: the relation writes the column (`joinColumn`
 * `<property>Id`), and the mirror is `persist: false` — hydrated from the column and usable in a criterion,
 * but dropped from what a flush writes.
 */
const mirrored = (relation: string, entity: string, nullable = true) => ({
	[relation]: { kind: 'm:1', entity, joinColumn: `${relation}Id`, referenceColumnName: 'id', nullable },
	[`${relation}Id`]: { type: 'string', nullable, persist: false }
});

/** What every row of the two tables carries: the base entity's columns and the tenant-organization scope. */
const base = () => ({
	id: { type: 'string', primary: true },
	createdAt: date(false),
	updatedAt: date(false),
	deletedAt: date(),
	isActive: { type: 'boolean', nullable: true },
	isArchived: { type: 'boolean', nullable: true },
	...mirrored('tenant', 'Tenant'),
	...mirrored('organization', 'Organization')
});

const MikroOrmTenant = new MikroOrmEntitySchema<any>({
	name: 'Tenant',
	tableName: 'tenant',
	properties: { id: { type: 'string', primary: true } } as any
});

const MikroOrmOrganization = new MikroOrmEntitySchema<any>({
	name: 'Organization',
	tableName: 'organization',
	properties: { id: { type: 'string', primary: true } } as any
});

const MikroOrmOperation = new MikroOrmEntitySchema<any>({
	name: 'Operation',
	tableName: 'operation',
	properties: {
		...base(),
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
		...mirrored('parentOperation', 'Operation'),
		childOperations: { kind: '1:m', entity: 'Operation', mappedBy: 'parentOperation' },
		steps: { kind: '1:m', entity: 'OperationStep', mappedBy: 'operation' },
		startedAt: date(),
		finishedAt: date(),
		deadlineAt: date(),
		aggregateType: { type: 'string', nullable: true },
		aggregateId: { type: 'string', nullable: true },
		correlationId: { type: 'string', nullable: true }
	} as any
});

const MikroOrmOperationStep = new MikroOrmEntitySchema<any>({
	name: 'OperationStep',
	tableName: 'operation_step',
	properties: {
		...base(),
		...mirrored('operation', 'Operation', false),
		name: { type: 'string' },
		order: { type: 'number' },
		status: { type: 'string' },
		input: { type: 'json', nullable: true },
		output: { type: 'json', nullable: true },
		compensationData: { type: 'json', nullable: true },
		attemptCount: { type: 'number' },
		lastError: { type: 'text', nullable: true },
		startedAt: date(),
		finishedAt: date()
	} as any
});

/*
|--------------------------------------------------------------------------
| The stores
|--------------------------------------------------------------------------
*/

/** The runtime over one real database, and what a case reads the outcome back with. */
export interface IOperationStore {
	/** The ORM the service was built for. */
	readonly orm: MultiORMEnum;
	readonly service: OperationService;
	readonly registry: OperationRegistry;
	/** The installation's own MikroORM manager, on the MikroORM store. */
	readonly mikroOrm?: MikroORM;
	/** Runs raw SQL on the store's connection, outside the service. */
	query(sql: string, parameters?: unknown[]): Promise<Row[]>;
	/** The operation row as the table holds it, JSON columns parsed. */
	operationRow(id: string): Promise<Row>;
	/** The step rows of an operation as the table holds them, ascending by `order`. */
	stepRows(operationId: string): Promise<Row[]>;
	close(): Promise<void>;
}

/** A repository the service must never reach on this ORM: any member it is asked for fails the case. */
export function unreachable(name: string): any {
	return new Proxy(
		{},
		{
			get: (_target, property) => {
				throw new Error(`The ${name} was reached (${String(property)}).`);
			}
		}
	);
}

/** The publisher the service announces through; the facts are not what these suites are about. */
function publisher() {
	return {
		operationStepChanged: jest.fn().mockResolvedValue(true),
		operationCompleted: jest.fn().mockResolvedValue(true),
		operationFailed: jest.fn().mockResolvedValue(true)
	};
}

/** Parses the JSON text columns of a raw row. */
function parsed(row: Row | undefined): Row {
	for (const column of ['state', 'result', 'input', 'output', 'compensationData']) {
		if (typeof row?.[column] === 'string') {
			row[column] = JSON.parse(row[column]);
		}
	}

	return row as Row;
}

/** The two raw readers every store answers with, over its own `query`. */
function readers(query: IOperationStore['query']): Pick<IOperationStore, 'operationRow' | 'stepRows'> {
	return {
		operationRow: async (id) => parsed((await query(`SELECT * FROM "operation" WHERE "id" = ?`, [id]))[0]),
		stepRows: async (operationId) =>
			(await query(`SELECT * FROM "operation_step" WHERE "operationId" = ? ORDER BY "order" ASC`, [operationId])).map(
				parsed
			)
	};
}

/**
 * The runtime on TypeORM: TypeORM's repositories over the tables, MikroORM's unreachable.
 *
 * @returns The store.
 */
export async function typeOrmOperationStore(): Promise<IOperationStore> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmOperation, TypeOrmOperationStep],
		synchronize: false,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});

	await dataSource.initialize();

	for (const statement of OPERATION_TABLES_DDL) {
		await dataSource.query(statement);
	}

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

	const query: IOperationStore['query'] = (sql, parameters = []) => dataSource.query(sql, parameters);

	return {
		orm: MultiORMEnum.TypeORM,
		service,
		registry,
		query,
		...readers(query),
		close: () => dataSource.destroy()
	};
}

/**
 * The runtime on MikroORM: MikroORM's manager over the tables, TypeORM's repositories unreachable.
 *
 * @returns The store.
 */
export async function mikroOrmOperationStore(): Promise<IOperationStore> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MikroOrmTenant, MikroOrmOrganization, MikroOrmOperation, MikroOrmOperationStep],
		// The naming strategy production sets, so a property lands on the column of the same name.
		namingStrategy: EntityCaseNamingStrategy,
		// The fixture's dates carry no zone; they are UTC (see `SqliteUtcDateType`).
		forceUtcTimezone: true,
		// MikroORM's default, stated: a worker has no request context, and the runtime must not need one.
		allowGlobalContext: false,
		discovery: { warnWhenNoEntities: false }
	});

	const connection = orm.em.getConnection();

	for (const statement of OPERATION_TABLES_DDL) {
		await connection.execute(statement, [], 'run');
	}

	const registry = new OperationRegistry();
	const service = new OperationService(
		unreachable('TypeORM operation repository'),
		new MikroOrmBaseEntityRepository<any>(orm.em as any, 'Operation') as any,
		unreachable('TypeORM operation-step repository'),
		unreachable('MikroORM operation-step repository'),
		registry,
		publisher() as never
	);

	jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);

	const query: IOperationStore['query'] = async (sql, parameters = []) =>
		/^\s*select/i.test(sql) ? connection.execute(sql, parameters, 'all') : [await connection.execute(sql, parameters, 'run')];

	return {
		orm: MultiORMEnum.MikroORM,
		service,
		registry,
		mikroOrm: orm,
		query,
		...readers(query),
		close: () => orm.close(true)
	};
}
