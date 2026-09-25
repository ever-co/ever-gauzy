// The dialect the row lock depends on is stated per case; every other case keeps the configured one.
jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	return {
		...actual,
		isPostgres: jest.fn(actual.isPostgres),
		isMySQL: jest.fn(actual.isMySQL)
	};
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema, SelectQueryBuilder } from 'typeorm';
import {
	EntityCaseNamingStrategy,
	EntityManager as MikroOrmEntityManager,
	EntitySchema as MikroOrmEntitySchema,
	LockMode,
	MikroORM,
	Type
} from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import * as gauzyConfig from '@gauzy/config';
import { ID, SequenceResetPolicy } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { Sequence } from './sequence.entity';
import { SequenceService } from './sequence.service';

/**
 * Numbering a document from a series on each ORM, against a real in-memory SQLite database.
 *
 * The series' columns are `@MultiORMColumn`s, which register with the active ORM alone, so under
 * `DB_ORM=mikro-orm` TypeORM knows `Sequence` as a skeleton. `SequenceService` was written on the TypeORM
 * repository — the lookup, the locked read, the compare-and-swap that moves the counter, the restart, the
 * insert that creates a series and the read-back — so on that ORM no document could be numbered at all.
 *
 * Every case runs once per ORM, and each run is handed the other ORM's repository as an object that fails
 * the case the moment it is touched. The MikroORM run is the one that failed: its first lookup reached
 * TypeORM. The TypeORM run is the control, and pins that the TypeORM arm answers what it always did.
 *
 * What is proved on both is the allocation's own guarantee: the counter moves only from the value the
 * allocator read (`02fc2c75cf`), so an allocation whose series moved underneath it writes nothing and reads
 * again rather than handing out a number twice; and a restart is stamped at the whole second
 * (`ca5fa012c6`), so MySQL cannot round it into the next period.
 *
 * The MikroORM store is mapped the way production maps the entity: `tenantId` and `organizationId` are
 * `relationId` mirrors MikroORM does not persist, beside the relations that own their columns, and the
 * manager refuses work outside a request context (`allowGlobalContext: false`), which is where a seed run
 * or a job allocates.
 */

type Row = Record<string, any>;

const isPostgresMock = gauzyConfig.isPostgres as unknown as jest.Mock;
const isMySQLMock = gauzyConfig.isMySQL as unknown as jest.Mock;
const actualConfig = jest.requireActual('@gauzy/config') as typeof gauzyConfig;

const CHANNEL = '6b1e0f2a-0000-4000-8000-00000000000b';
const OTHER_CHANNEL = '6b1e0f2a-0000-4000-8000-00000000000c';
const ZERO = '00000000-0000-0000-0000-000000000000';

/** The table, as the SQLite migration shapes it, with its two partial unique indexes. */
const SEQUENCE_TABLE_DDL: readonly string[] = [
	`CREATE TABLE "sequence" (
		"id" varchar PRIMARY KEY NOT NULL,
		"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
		"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
		"deletedAt" datetime,
		"isActive" boolean DEFAULT (1),
		"isArchived" boolean DEFAULT (0),
		"tenantId" varchar,
		"organizationId" varchar,
		"key" varchar NOT NULL,
		"prefix" varchar,
		"padding" integer NOT NULL DEFAULT (1),
		"nextValue" integer NOT NULL DEFAULT (1),
		"step" integer NOT NULL DEFAULT (1),
		"resetPolicy" varchar NOT NULL DEFAULT ('NEVER'),
		"lastResetAt" datetime,
		"description" varchar,
		"channelId" varchar
	)`,
	`CREATE UNIQUE INDEX "UQ_sequence_org_key_no_channel" ON "sequence" (COALESCE("organizationId", '${ZERO}'), "key") WHERE "channelId" IS NULL AND "deletedAt" IS NULL`,
	`CREATE UNIQUE INDEX "UQ_sequence_org_channel_key" ON "sequence" (COALESCE("organizationId", '${ZERO}'), "channelId", "key") WHERE "channelId" IS NOT NULL AND "deletedAt" IS NULL`
];

/** `target` binds the schema to the real class, so the service's `createQueryBuilder(Sequence, …)` resolves. */
const TypeOrmSequence = new EntitySchema<any>({
	name: 'Sequence',
	target: Sequence,
	tableName: 'sequence',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		isActive: { type: 'boolean', nullable: true, default: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		key: { type: 'varchar' },
		prefix: { type: 'varchar', nullable: true },
		padding: { type: 'int', default: 1 },
		nextValue: { type: 'int', default: 1 },
		step: { type: 'int', default: 1 },
		resetPolicy: { type: 'varchar', default: SequenceResetPolicy.NEVER },
		lastResetAt: { type: 'datetime', nullable: true },
		description: { type: 'varchar', nullable: true },
		channelId: { type: 'varchar', nullable: true }
	}
});

/** A date as TypeORM's better-sqlite3 driver stores one — `YYYY-MM-DD HH:MM:SS.SSS`, in UTC — on both stores. */
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

/** A `relationId` mirror beside the many-to-one that owns its column, as the production mapping pairs them. */
const mirrored = (relation: string, entity: string) => ({
	[relation]: { kind: 'm:1', entity, joinColumn: `${relation}Id`, referenceColumnName: 'id', nullable: true },
	[`${relation}Id`]: { type: 'string', nullable: true, persist: false }
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

const MikroOrmSequence = new MikroOrmEntitySchema<any>({
	name: 'Sequence',
	tableName: 'sequence',
	properties: {
		id: { type: 'string', primary: true },
		createdAt: date(false),
		updatedAt: date(false),
		deletedAt: date(),
		isActive: { type: 'boolean', nullable: true },
		isArchived: { type: 'boolean', nullable: true },
		...mirrored('tenant', 'Tenant'),
		...mirrored('organization', 'Organization'),
		key: { type: 'string' },
		prefix: { type: 'string', nullable: true },
		padding: { type: 'number' },
		nextValue: { type: 'number' },
		step: { type: 'number' },
		resetPolicy: { type: 'string' },
		lastResetAt: date(),
		description: { type: 'string', nullable: true },
		channelId: { type: 'string', nullable: true }
	} as any
});

/** A collaborator the service must never reach here: any member it is asked for fails the case. */
function unreachable(name: string): any {
	return new Proxy(
		{},
		{
			get: (_target, property) => {
				throw new Error(`The ${name} was reached (${String(property)}).`);
			}
		}
	);
}

interface ISeriesStore {
	service: SequenceService;
	/** The series rows as the table holds them, by key and channel. */
	rows(): Promise<Row[]>;
	/**
	 * Makes the next read of the series answer one number behind the table — the read of an allocator
	 * another allocation overtook between its read and its write — and counts every read after it.
	 */
	overtakeNextRead(): { reads(): number };
	/** The lock mode of every series read the configured ORM was asked for, in order. */
	locks(): Array<string | undefined>;
	close(): Promise<void>;
}

async function typeOrmSeriesStore(): Promise<ISeriesStore> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmSequence],
		synchronize: false,
		logging: false,
		invalidWhereValuesBehavior: gauzyConfig.TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});

	await dataSource.initialize();

	for (const statement of SEQUENCE_TABLE_DDL) {
		await dataSource.query(statement);
	}

	const service = new SequenceService(
		dataSource.getRepository(Sequence) as any,
		unreachable('MikroORM sequence repository'),
		unreachable('idempotency service')
	);

	jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

	// The lock is recorded rather than taken: TypeORM refuses one on SQLite, and what is asserted is the
	// decision the service makes for a dialect that has one.
	const locks: Array<string | undefined> = [];
	const getOne = SelectQueryBuilder.prototype.getOne;

	jest.spyOn(SelectQueryBuilder.prototype, 'setLock').mockImplementation(function (this: any, mode: any) {
		this.__lock = mode;

		return this;
	});
	const reads = jest.spyOn(SelectQueryBuilder.prototype, 'getOne').mockImplementation(async function (this: any) {
		if (this.expressionMap?.mainAlias?.name === 'sequence') {
			locks.push(this.__lock);
		}

		return getOne.apply(this);
	});

	return {
		service,
		rows: () => dataSource.query(`SELECT * FROM "sequence" ORDER BY "key", "channelId"`),
		overtakeNextRead: () => {
			const before = reads.mock.calls.length;

			reads.mockImplementationOnce(async function (this: any) {
				const series = await getOne.apply(this);

				return series ? { ...series, nextValue: series.nextValue - 1 } : series;
			});

			return { reads: () => reads.mock.calls.length - before };
		},
		locks: () => locks,
		close: () => dataSource.destroy()
	};
}

async function mikroOrmSeriesStore(): Promise<ISeriesStore> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MikroOrmTenant, MikroOrmOrganization, MikroOrmSequence],
		namingStrategy: EntityCaseNamingStrategy,
		forceUtcTimezone: true,
		allowGlobalContext: false,
		discovery: { warnWhenNoEntities: false }
	});
	const connection = orm.em.getConnection();

	for (const statement of SEQUENCE_TABLE_DDL) {
		await connection.execute(statement, [], 'run');
	}

	const service = new SequenceService(
		unreachable('TypeORM sequence repository'),
		new MikroOrmBaseEntityRepository<any>(orm.em as any, 'Sequence') as any,
		unreachable('idempotency service')
	);

	jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);

	// MikroORM's SQLite platform leaves a lock mode out of the statement, so the read runs as it would
	// and the mode it was asked for is recorded. The outer call is the service's; MikroORM re-enters
	// `findOne` on the fork a read without an identity map runs on, and that call is not counted.
	const locks: Array<string | undefined> = [];
	const findOne = MikroOrmEntityManager.prototype.findOne;
	let depth = 0;

	const reads = jest.spyOn(MikroOrmEntityManager.prototype, 'findOne').mockImplementation(async function (
		this: any,
		...args: any[]
	) {
		const outer = depth === 0;

		if (outer && args[0] === Sequence) {
			locks.push(args[2]?.lockMode === LockMode.PESSIMISTIC_WRITE ? 'pessimistic_write' : undefined);
		}

		depth += 1;

		try {
			return await (findOne as any).apply(this, args);
		} finally {
			depth -= 1;
		}
	});

	return {
		service,
		rows: () => connection.execute(`SELECT * FROM "sequence" ORDER BY "key", "channelId"`, [], 'all'),
		overtakeNextRead: () => {
			const before = reads.mock.calls.length;

			reads.mockImplementationOnce(async function (this: any, ...args: any[]) {
				depth += 1;

				try {
					const series = await (findOne as any).apply(this, args);

					return series ? { ...series, nextValue: series.nextValue - 1 } : series;
				} finally {
					depth -= 1;
				}
			});

			// The re-entrant call on the fork is one more call of the spy per read.
			return { reads: () => (reads.mock.calls.length - before) / 2 };
		},
		locks: () => locks,
		close: () => orm.close(true)
	};
}

/** Acts as a signed-in caller of a tenant and organization, or outside any request (`null`). */
function actAs(tenantId: string | null, organizationId: string | null = null): void {
	jest
		.spyOn(RequestContext, 'currentUser')
		.mockReturnValue(tenantId ? ({ id: `user-of-${tenantId}`, tenantId, lastOrganizationId: organizationId } as never) : null);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId as never);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId as never);
}

/** The instant a stored `datetime` names: both stores keep TypeORM's zone-less UTC text. */
const instantOf = (stored: string | null): string | null => (stored ? `${stored.replace(' ', 'T')}Z` : null);

describe.each([
	[MultiORMEnum.TypeORM, typeOrmSeriesStore],
	[MultiORMEnum.MikroORM, mikroOrmSeriesStore]
] as const)('Numbering documents on %s, against a real SQLite store', (orm, createStore) => {
	let store: ISeriesStore;

	beforeEach(async () => {
		isPostgresMock.mockReturnValue(false);
		isMySQLMock.mockReturnValue(false);
		store = await createStore();
		actAs('tenant-a', 'org-a');
	});

	afterEach(async () => {
		await store?.close();
		jest.restoreAllMocks();
		isPostgresMock.mockImplementation(actualConfig.isPostgres);
		isMySQLMock.mockImplementation(actualConfig.isMySQL);
	});

	describe('allocating a number', () => {
		it('hands out one value per allocation, in order, and writes the counter to the row', async () => {
			await store.service.ensure({ key: 'ORDER', prefix: 'SO-' });

			const numbers = [];

			for (let index = 0; index < 3; index += 1) {
				numbers.push((await store.service.allocate('ORDER')).formatted);
			}

			expect(numbers).toEqual(['SO-000001', 'SO-000002', 'SO-000003']);
			expect(await store.rows()).toMatchObject([
				{ key: 'ORDER', nextValue: 4, tenantId: 'tenant-a', organizationId: 'org-a', channelId: null }
			]);
		});

		it('never hands concurrent allocations one value twice, and advances the series by exactly what it handed out', async () => {
			await store.service.ensure({ key: 'ORDER', prefix: 'SO-' });

			const settled = await Promise.allSettled([1, 2, 3, 4, 5].map(() => store.service.allocate('ORDER')));
			const values = settled
				.filter((outcome): outcome is PromiseFulfilledResult<any> => outcome.status === 'fulfilled')
				.map((outcome) => outcome.value.value as number)
				.sort((left, right) => left - right);

			expect(new Set(values).size).toBe(values.length);

			if (orm === MultiORMEnum.MikroORM) {
				// MikroORM's pool queues each allocation's transaction behind the one holding the connection,
				// so all five are numbered, one after another.
				expect(values).toEqual([1, 2, 3, 4, 5]);
				expect((await store.rows())[0].nextValue).toBe(6);
			}

			// TypeORM's better-sqlite3 driver holds one connection and refuses a `BEGIN` on it while another
			// allocation's transaction is open, so there some of the five fail outright. That is the driver's
			// behaviour, the same before this arm existed; what is asserted of it is the guarantee: no value
			// is handed out twice.
		});

		it('writes nothing for an allocation whose series moved under it, reads again, and takes the next number', async () => {
			await store.service.ensure({ key: 'ORDER', prefix: 'SO-' });
			await store.service.allocate('ORDER');

			// The next read answers `1`, the value the table held before the allocation above committed.
			const overtaken = store.overtakeNextRead();
			const allocated = await store.service.allocate('ORDER');

			// Control: an unconditional write handed out `1` a second time and left the counter at `2`.
			expect(allocated.value).toBe(2);
			expect(overtaken.reads()).toBe(2);
			expect((await store.rows())[0].nextValue).toBe(3);
		});

		it('rolls the step, so a reserved range is handed out one block at a time', async () => {
			await store.service.ensure({ key: 'RANGE', prefix: 'R-', step: 10, nextValue: 100 });

			expect((await store.service.allocate('RANGE')).value).toBe(100);
			expect((await store.service.allocate('RANGE')).value).toBe(110);
			expect((await store.rows())[0].nextValue).toBe(120);
		});

		it('refuses a series that is not active, or that was never configured, and costs no number', async () => {
			await store.service.ensure({ key: 'ORDER', isActive: false });

			await expect(store.service.allocate('ORDER')).rejects.toBeInstanceOf(BadRequestException);
			await expect(store.service.allocate('INVOICE')).rejects.toBeInstanceOf(NotFoundException);
			expect((await store.rows())[0].nextValue).toBe(1);
		});

		it('reads the series FOR UPDATE on Postgres inside the allocation, and without a lock outside a transaction', async () => {
			await store.service.createSeries({ key: 'ORDER', prefix: 'SO-' });

			isPostgresMock.mockReturnValue(true);

			await store.service.createSeries({ key: 'ORDER', channelId: CHANNEL });

			const outside = store.locks().length;

			await store.service.allocate('ORDER', { channelId: CHANNEL });

			// The creations' reads run outside a transaction, where both ORMs refuse a lock; the allocation's
			// read runs inside its own, and takes one.
			expect(outside).toBeGreaterThan(0);
			expect(store.locks().slice(0, outside).every((lock) => lock === undefined)).toBe(true);
			expect(store.locks().slice(outside)).toEqual(['pessimistic_write']);
		});
	});

	describe('the scope of a series', () => {
		it('prefers the channel’s own series, falls back to the organization’s, and never reads another scope', async () => {
			await store.service.ensure({ key: 'ORDER', prefix: 'SO-' });
			await store.service.ensure({ key: 'ORDER', prefix: 'WEB-', channelId: CHANNEL });

			expect((await store.service.findSeries('ORDER', CHANNEL)).prefix).toBe('WEB-');
			expect((await store.service.findSeries('ORDER', OTHER_CHANNEL)).prefix).toBe('SO-');
			expect((await store.service.allocate('ORDER', { channelId: CHANNEL })).formatted).toBe('WEB-000001');
			expect((await store.service.allocate('ORDER', { channelId: OTHER_CHANNEL })).formatted).toBe('SO-000001');

			actAs('tenant-b', 'org-b');

			await expect(store.service.findSeries('ORDER')).rejects.toBeInstanceOf(NotFoundException);
			await expect(store.service.allocate('ORDER')).rejects.toBeInstanceOf(NotFoundException);

			actAs('tenant-a', 'org-b');

			await expect(store.service.allocate('ORDER')).rejects.toBeInstanceOf(NotFoundException);
			expect((await store.rows()).map((row) => row.nextValue)).toEqual([2, 2]);
		});

		it('allocates for a caller with no tenant or no organization on neither ORM, and never from another scope', async () => {
			actAs(null);
			await store.service.ensure({ key: 'IMPORT', prefix: 'IMP-' });

			actAs('tenant-a', 'org-a');
			await store.service.ensure({ key: 'IMPORT', prefix: 'A-' });

			// The TypeORM arm's locked read states the scope as `where({ tenantId: null, … })`, which its
			// builder compiles to `= NULL` and which matches no row; the MikroORM arm finds what it finds —
			// nothing — rather than reading `IS NULL` and numbering the tenant-less series.
			actAs(null);
			expect((await store.service.findSeries('IMPORT')).prefix).toBe('IMP-');
			await expect(store.service.allocate('IMPORT')).rejects.toBeInstanceOf(NotFoundException);

			actAs('tenant-a', null);
			await expect(store.service.allocate('IMPORT')).rejects.toBeInstanceOf(NotFoundException);

			actAs('tenant-a', 'org-a');
			expect((await store.service.allocate('IMPORT')).formatted).toBe('A-000001');
			expect((await store.rows()).map((row) => [row.tenantId, row.nextValue])).toEqual(
				expect.arrayContaining([
					[null, 1],
					['tenant-a', 2]
				])
			);
		});
	});

	describe('restarting a series', () => {
		it('restarts a daily series once per day, stamped at the whole second', async () => {
			await store.service.ensure({
				key: 'DAILY',
				resetPolicy: SequenceResetPolicy.DAILY,
				nextValue: 41,
				lastResetAt: new Date('2026-03-03T00:00:00.000Z')
			});

			const lastSecond = await store.service.allocate('DAILY', { at: new Date('2026-03-04T23:59:59.700Z') });

			// The restart of the 4th, stamped without its fraction: MySQL rounds `.700` into the next second,
			// which is the next day, and the 5th's first allocation would then have taken no restart.
			expect(instantOf((await store.rows())[0].lastResetAt)).toBe('2026-03-04T23:59:59.000Z');

			const sameDay = await store.service.allocate('DAILY', { at: new Date('2026-03-04T23:59:59.900Z') });
			const nextDay = await store.service.allocate('DAILY', { at: new Date('2026-03-05T00:00:00.300Z') });
			const [row] = await store.rows();

			expect([lastSecond.value, sameDay.value, nextDay.value]).toEqual([1, 2, 1]);
			expect(instantOf(row.lastResetAt)).toBe('2026-03-05T00:00:00.000Z');
			expect(row.nextValue).toBe(2);
		});

		it('restarts on demand when the policy says a restart is due, and refuses one that is not', async () => {
			await store.service.ensure({
				key: 'MONTHLY',
				resetPolicy: SequenceResetPolicy.MONTHLY,
				nextValue: 77,
				lastResetAt: new Date('2026-02-01T00:00:00.000Z')
			});

			const [{ id }] = await store.rows();
			const restarted = await store.service.resetSeries(id as ID, { at: new Date('2026-03-10T08:15:30.450Z') });

			expect(restarted).toMatchObject({ id, nextValue: 1 });
			expect(new Date(restarted.lastResetAt).toISOString()).toBe('2026-03-10T08:15:30.000Z');
			expect(instantOf((await store.rows())[0].lastResetAt)).toBe('2026-03-10T08:15:30.000Z');

			await expect(store.service.resetSeries(id as ID, { at: new Date('2026-03-20T00:00:00.000Z') })).rejects.toBeInstanceOf(
				BadRequestException
			);

			actAs('tenant-b', 'org-b');
			await expect(store.service.resetSeries(id as ID, { at: new Date('2026-04-02T00:00:00.000Z') })).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect((await store.rows())[0]).toMatchObject({ nextValue: 1 });
		});

		it('refuses an operator restart that an allocation overtook, rather than rewinding over the number it handed out', async () => {
			await store.service.ensure({
				key: 'MONTHLY',
				resetPolicy: SequenceResetPolicy.MONTHLY,
				nextValue: 77,
				lastResetAt: new Date('2026-02-01T00:00:00.000Z')
			});

			const [{ id }] = await store.rows();

			store.overtakeNextRead();

			await expect(store.service.resetSeries(id as ID, { at: new Date('2026-03-10T00:00:00.000Z') })).rejects.toBeInstanceOf(
				ConflictException
			);
			expect((await store.rows())[0]).toMatchObject({ nextValue: 77 });
			expect(instantOf((await store.rows())[0].lastResetAt)).toBe('2026-02-01T00:00:00.000Z');
		});
	});

	describe('creating a series', () => {
		it('creates a series in the caller’s scope with the documented defaults, once per key and channel', async () => {
			const created = await store.service.createSeries({ key: 'INVOICE', prefix: 'INV-' });
			const channel = await store.service.createSeries({ key: 'INVOICE', prefix: 'WEB-', channelId: CHANNEL });

			expect(created).toMatchObject({ key: 'INVOICE', prefix: 'INV-', padding: 6, nextValue: 1, step: 1 });
			expect(channel.id).not.toBe(created.id);
			await expect(store.service.createSeries({ key: 'INVOICE' })).rejects.toBeInstanceOf(BadRequestException);
			await expect(store.service.createSeries({ key: 'INVOICE', channelId: CHANNEL })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(await store.rows()).toMatchObject([
				{ key: 'INVOICE', channelId: null, tenantId: 'tenant-a', organizationId: 'org-a', padding: 6, resetPolicy: 'NEVER' },
				{ key: 'INVOICE', channelId: CHANNEL, tenantId: 'tenant-a', organizationId: 'org-a', prefix: 'WEB-' }
			]);
		});

		it('ensures a series once, in the scope the caller states when no request carries one', async () => {
			actAs(null);

			const first = await store.service.ensure({ key: 'ORDER', tenantId: 'tenant-x', organizationId: 'org-x' });
			const second = await store.service.ensure({ key: 'ORDER', tenantId: 'tenant-x', organizationId: 'org-x' });

			expect(second.id).toBe(first.id);
			expect(await store.rows()).toMatchObject([
				{ key: 'ORDER', tenantId: 'tenant-x', organizationId: 'org-x', padding: 6, nextValue: 1, step: 1 }
			]);
		});
	});
});
