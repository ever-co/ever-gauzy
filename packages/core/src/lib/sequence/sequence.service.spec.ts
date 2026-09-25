jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	// The dialect is decided once at boot from the environment; here it is decided per case so that
	// the row-locked path and the embedded path are both exercised by this suite.
	const dialect = { current: 'postgres' as 'postgres' | 'sqlite' };

	return {
		...actual,
		isPostgres: () => dialect.current === 'postgres',
		isMySQL: () => false,
		isBetterSqlite3: () => dialect.current === 'sqlite',
		dialect
	};
});

jest.mock('../core/crud/crud.service', () => {
	// The subject is the allocation, not the CRUD base, so the base is replaced by the two members this
	// service actually inherits: a constructor, and the read and the write a claim is answered and
	// settled through — which pass straight to the repository the double was built with, and that
	// repository answers for the table. An empty stand-in carrying only a constructor used to sit here,
	// and `this.find` came back undefined — reported, because the call is in another file, as
	// `this.find is not a function` from the ledger rather than as an incomplete stub here.
	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}

		find(options?: unknown): Promise<any[]> {
			return this.typeOrmRepository.find(options);
		}

		save(entity: unknown): Promise<any> {
			return this.typeOrmRepository.save(entity);
		}
	}

	return { CrudService };
});

jest.mock('./sequence.entity', () => {
	// The entity is the persistence boundary: the service hands the class to the manager and the
	// store below answers for it, so the decorators of the real entity are not loaded here.
	class Sequence {}

	return { Sequence };
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator, PessimisticLockTransactionRequiredError } from 'typeorm';
import { SequenceResetPolicy } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { IdempotencyService } from '../idempotency/idempotency.service';
import type { TypeOrmIdempotencyKeyRepository } from '../idempotency/repository/type-orm-idempotency-key.repository';
import { Sequence } from './sequence.entity';
import { SequenceService } from './sequence.service';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';

/**
 * Allocating a document number from a series.
 *
 * A number a person quotes has to be unique, and two concurrent writers must never be handed the
 * same value. The mechanism the service actually uses is the one asserted here: the read, the
 * increment and the write happen inside a single transaction, on a dialect that supports row locks
 * the read takes one, and the write is predicated on what was read. The store below behaves like the
 * database on exactly those points — by default transactions are serialised, as a row lock serialises
 * them, and reads outside one are not; constructed with `interleaved` transactions it behaves like
 * TypeORM's better-sqlite3 driver, which nests a second transaction inside the first on one
 * connection, so two allocations both read before either writes. A service that stopped allocating
 * inside its transaction, or stopped predicating its write, would hand out a duplicate and this suite
 * would say so.
 *
 * The remaining cases pin what an operator depends on: a stable prefix and padding, a step that
 * reserves a range, a counter per scope that does not leak into another scope, the period a series
 * restarts on, and a series that is created once rather than recreated on every boot.
 */

type Row = Record<string, any>;

interface SeriesRow extends Row {
	id: string;
	key: string;
	channelId: string | null;
	prefix?: string;
	padding: number;
	nextValue: number;
	step: number;
	resetPolicy: SequenceResetPolicy;
	lastResetAt?: Date | null;
	isActive?: boolean;
}

/**
 * How the store runs two transactions that are open at the same time.
 *
 * `serialised` is what a row lock does: the second body starts once the first has finished.
 * `interleaved` is what TypeORM's better-sqlite3 driver does — the one driver behind both the `sqlite`
 * and the `better-sqlite3` configuration — because it holds one query runner per data source and
 * opens a transaction started inside another as a savepoint on it: both bodies run at once, and their
 * statements alternate on one connection.
 */
type TransactionMode = 'serialised' | 'interleaved';

/**
 * An in-memory stand-in for the series table and the manager that guards it.
 *
 * `transaction` runs one body at a time by default, which is what a database's writer lock does, and
 * runs them side by side when the store is built `interleaved`. `read`/`write` are the unguarded pair a
 * caller could use instead; they are exposed, and every read and write is recorded with the
 * transaction depth it happened at, so the suite can show where the allocation's read really takes
 * place.
 */
class SeriesStore {
	readonly rows: SeriesRow[] = [];
	readonly locks: string[] = [];
	readonly reads: number[] = [];
	readonly writes: number[] = [];

	private tail: Promise<unknown> = Promise.resolve();
	private depth = 0;

	constructor(rows: Partial<SeriesRow>[] = [{}], private readonly mode: TransactionMode = 'serialised') {
		for (const row of rows) {
			this.rows.push({
				id: `seq-${this.rows.length + 1}`,
				key: 'ORDER',
				channelId: null,
				prefix: 'SO-',
				padding: 6,
				nextValue: 1,
				step: 1,
				resetPolicy: SequenceResetPolicy.NEVER,
				...row
			} as SeriesRow);
		}
	}

	/** The repository's own manager: no query runner, and therefore no transaction. */
	private readonly manager = this.managerOf(false);

	/** The manager a transaction's body is handed, whose query runner is in an active transaction. */
	readonly transactional = this.managerOf(true);

	/** The repository the service is constructed with. */
	get repository(): unknown {
		return {
			manager: this.manager,
			find: async (options: { where: Row; take?: number }) => this.findAll(options?.where ?? {}),
			findOne: async (options: { where: Row }) => this.find(options.where),
			create: (input: Row) => ({ id: `seq-${this.rows.length + 1}`, ...input }),
			save: async (row: SeriesRow) => this.persist(row)
		};
	}

	/**
	 * A TypeORM-shaped entity manager over the table.
	 *
	 * `queryRunner.isTransactionActive` is the member TypeORM reads before it issues a pessimistic lock,
	 * and it is present only on the manager a transaction hands its body — as on the real one, whose
	 * plain repository manager has no query runner of its own.
	 *
	 * `update` is the conditional write the allocator and the restart both go through. The criteria are
	 * not "which row" but "which row, still holding what I read", so the double matches on every
	 * criterion rather than on the identifier alone: a double that ignored the extra criteria would
	 * report one row affected for a write the database would have refused, and the suite would pass
	 * while the counter handed out duplicates on every dialect without a row lock. The answer is
	 * TypeORM's `UpdateResult` shape, `{ affected }`.
	 */
	private managerOf(inTransaction: boolean) {
		return {
			...(inTransaction ? { queryRunner: { isTransactionActive: true } } : {}),
			transaction: (work: (manager: unknown) => Promise<unknown>) => this.transaction(work),
			createQueryBuilder: (_entity: unknown, alias: string) => this.queryBuilder(alias, inTransaction),
			findOne: async (_entity: unknown, options: { where: Row }) => this.find(options.where),
			save: async (_entity: unknown, row: SeriesRow) => this.persist(row),
			update: async (_entity: unknown, criteria: Row, values: Row) => this.conditionalUpdate(criteria, values)
		};
	}

	/** The read a caller performs when it is not inside a transaction. It hands back a snapshot, as
	 * a database read does, rather than the live row a managed entity would be. */
	async read(key: string): Promise<SeriesRow> {
		await Promise.resolve();

		return { ...((await this.find({ key })) as SeriesRow) };
	}

	/** The write such a caller performs after reading. */
	async write(row: SeriesRow): Promise<void> {
		await Promise.resolve();

		this.persist(row);
	}

	/** One transaction at a time, as a row lock serialises writers — or all at once, when interleaved. */
	private async transaction<T>(work: (manager: unknown) => Promise<T>): Promise<T> {
		const body = async (): Promise<T> => {
			this.depth += 1;

			try {
				return await work(this.transactional);
			} finally {
				this.depth -= 1;
			}
		};

		if (this.mode === 'interleaved') {
			return body();
		}

		const run = this.tail.then(body);

		this.tail = run.then(
			() => undefined,
			() => undefined
		);

		return run;
	}

	private queryBuilder(alias: string, inTransaction: boolean) {
		let locked = false;
		const conditions: Row = {};
		const builder = {
			where: (where: Row) => {
				Object.assign(conditions, where);

				return builder;
			},
			/**
			 * The allocator states the channel condition as a raw fragment rather than as a `where` member,
			 * because "no channel" has to be asked for as `IS NULL`: a `channelId = NULL` comparison matches
			 * nothing in any dialect. The double models the two fragments the service states — a null channel
			 * and a stated one — and refuses anything else rather than quietly matching every row, so a
			 * condition this double does not understand fails the suite instead of passing it.
			 */
			andWhere: (fragment: string, parameters: Row = {}) => {
				if (/IS\s+NULL\s*$/i.test(fragment)) {
					// `matches` treats a missing column and a null column as the same thing, which is what
					// the database does here.
					conditions.channelId = null;
				} else if (parameters.channelId !== undefined) {
					conditions.channelId = parameters.channelId;
				} else {
					throw new Error(`the sequence double was handed a condition it does not model: ${fragment}`);
				}

				return builder;
			},
			setLock: (mode: string) => {
				this.locks.push(`${alias}:${mode}`);
				locked = true;

				return builder;
			},
			getOne: async () => {
				// What TypeORM's `SelectQueryBuilder` does before the statement reaches the driver.
				if (locked && !inTransaction) {
					throw new PessimisticLockTransactionRequiredError();
				}

				return this.find(conditions);
			}
		};

		return builder;
	}

	/**
	 * Every row a criteria object matches, in table order.
	 *
	 * The repository's `find` answers with all of them and its `findOne` with the first, so both go
	 * through here. One matching rule means a case cannot pass against `findOne` and fail against
	 * `find` for a reason that is really about the double rather than about the service.
	 */
	private async findAll(where: Row): Promise<SeriesRow[]> {
		this.reads.push(this.depth);
		await Promise.resolve();

		// 🛑 Snapshots, not the stored rows. A database read hands back values rather than a handle on
		// the stored row, and this double used to hand back the stored object itself — so every mutation
		// the service made to what it had read landed in the table before the write that was supposed to
		// decide it, and a second allocator that read the same row saw the first one's increment without
		// either of them having written anything. That hid exactly the race this suite exists to catch.
		return this.rows
			.filter((row) => Object.entries(where).every(([column, value]) => matches(row[column], value)))
			.map((row) => ({ ...row }));
	}

	private async find(where: Row): Promise<SeriesRow | null> {
		return (await this.findAll(where))[0] ?? null;
	}

	/**
	 * A conditional `UPDATE`: every criterion has to still hold when the statement runs, and only a row
	 * that satisfies all of them is written. The count is the whole answer the caller acts on.
	 */
	private async conditionalUpdate(criteria: Row, values: Row): Promise<{ affected: number }> {
		this.writes.push(this.depth);
		await Promise.resolve();

		let affected = 0;

		for (const row of this.rows) {
			if (Object.entries(criteria).every(([column, value]) => matches(row[column], value))) {
				Object.assign(row, values);
				affected += 1;
			}
		}

		return { affected };
	}

	private persist(row: SeriesRow): SeriesRow {
		this.writes.push(this.depth);

		const index = this.rows.findIndex((existing) => existing.id === row.id);

		if (index === -1) {
			this.rows.push(row);
		} else {
			this.rows[index] = row;
		}

		return row;
	}
}

/**
 * Whether a stored value satisfies one criterion.
 *
 * A missing column and a null column are the same thing to the database. An operator is modelled only
 * where the service states one — `LessThan`, under which a null column matches nothing, as `NULL < x`
 * is unknown in SQL — and any other is refused rather than quietly matched.
 */
function matches(value: unknown, condition: unknown): boolean {
	if (condition instanceof FindOperator) {
		if (condition.type !== 'lessThan') {
			throw new Error(`the sequence double was handed an operator it does not model: ${condition.type}`);
		}

		return value !== null && value !== undefined && comparable(value) < comparable(condition.value);
	}

	return (value ?? null) === (condition ?? null);
}

/** A value an ordering comparison can be made on: a moment as its epoch milliseconds. */
function comparable(value: unknown): number {
	return value instanceof Date ? value.getTime() : Number(value);
}

const ORGANIZATION = '6b1e0f2a-0000-4000-8000-00000000000a';
const CHANNEL = '6b1e0f2a-0000-4000-8000-00000000000b';

/** The dialect the mocked configuration reports, so a case can choose the path it exercises. */
const dialect = (): { current: 'postgres' | 'sqlite' } => (jest.requireMock('@gauzy/config') as any).dialect;

/** The service under test and the store it allocates from. */
function seriesStore(rows: Partial<SeriesRow>[] = [{}], mode: TransactionMode = 'serialised') {
	const store = new SeriesStore(rows, mode);
	// The idempotency ledger an allocation claims its caller's key through. It is the kernel's own
	// service over a table of its own — the keys are a second table, not a second mechanism — so the
	// replay a retry receives is the one the platform really stores.
	const keys = new SeriesStore([]);

	return {
		store,
		service: new SequenceService(
			store.repository as TypeOrmSequenceRepository,
			{} as never,
			new IdempotencyService(keys.repository as unknown as TypeOrmIdempotencyKeyRepository, {} as never)
		)
	};
}

/** A moment inside February 2026, used wherever a period boundary matters. */
const AT = new Date('2026-02-10T09:30:00Z');

afterEach(() => {
	// A case that chose a dialect, or stood a request context up, has to put it back.
	dialect().current = 'postgres';
	jest.restoreAllMocks();
});

describe('allocating a number', () => {
	it('hands out one value per allocation, in order, without repeating or skipping one', async () => {
		const { store, service } = seriesStore();

		const allocated: number[] = [];
		for (let index = 0; index < 100; index += 1) {
			allocated.push((await service.allocate('ORDER')).value);
		}

		expect(allocated).toEqual(Array.from({ length: 100 }, (_unused, index) => index + 1));
		expect(new Set(allocated).size).toBe(100);
		expect(store.rows[0].nextValue).toBe(101);
	});

	it('hands two concurrent allocations two distinct values and advances the series by exactly two', async () => {
		const { store, service } = seriesStore();

		const [first, second] = await Promise.all([service.allocate('ORDER'), service.allocate('ORDER')]);

		expect([first.value, second.value].sort((left, right) => left - right)).toEqual([1, 2]);
		expect(store.rows[0].nextValue).toBe(3);
	});

	it('returns the value it allocated rather than the one the series moved on to', async () => {
		const { store, service } = seriesStore([{ nextValue: 41 }]);

		const first = await service.allocate('ORDER');

		// Control: reporting the advanced counter is the off-by-one that leaves every document
		// numbered one higher than the row that records it.
		expect(first.value).toBe(41);
		expect(store.rows[0].nextValue).toBe(42);
		expect((await service.allocate('ORDER')).value).toBe(42);
	});

	it('reads and writes the series inside the transaction the repository opens', async () => {
		const { store, service } = seriesStore();

		await service.allocate('ORDER');

		expect(store.reads).toEqual([1]);
		expect(store.writes).toEqual([1]);

		// Control: the store serialises transactions and nothing else, so a pair that read outside one
		// is handed the same value twice and the series advances by a single step — the lost update
		// the transaction exists to prevent.
		const unguarded = async (): Promise<number> => {
			const row = await store.read('ORDER');
			const value = row.nextValue;

			await store.write({ ...row, nextValue: value + 1 });

			return value;
		};
		const handedOut = await Promise.all([unguarded(), unguarded()]);

		expect(handedOut).toEqual([2, 2]);
		expect(store.rows[0].nextValue).toBe(3);
		expect(store.reads).toEqual([1, 0, 0]);
	});

	it('takes a row lock on a dialect that supports one, and relies on the conditional write where it does not', async () => {
		dialect().current = 'postgres';
		const locked = seriesStore();

		await locked.service.allocate('ORDER');
		expect(locked.store.locks).toEqual(['sequence:pessimistic_write']);

		dialect().current = 'sqlite';
		const embedded = seriesStore();

		const [first, second] = await Promise.all([
			embedded.service.allocate('ORDER'),
			embedded.service.allocate('ORDER')
		]);

		// No row lock exists on the embedded dialect, and two concurrent allocations are still handed two
		// different values. The store serialises these two; the suite below interleaves them, which is
		// what the embedded driver really does.
		expect(embedded.store.locks).toEqual([]);
		expect([first.value, second.value].sort((left, right) => left - right)).toEqual([1, 2]);
		expect(embedded.store.rows[0].nextValue).toBe(3);
	});

	it('rolls the step, so a reserved range is handed out one block at a time', async () => {
		const { service } = seriesStore([{ nextValue: 1, step: 100 }]);

		expect((await service.allocate('ORDER')).value).toBe(1);
		expect((await service.allocate('ORDER')).value).toBe(101);
		expect((await service.allocate('ORDER')).value).toBe(201);
	});

	it('refuses to allocate from a series that is not active, and costs the series no number', async () => {
		const { store, service } = seriesStore([{ isActive: false, nextValue: 12 }]);

		await expect(service.allocate('ORDER')).rejects.toBeInstanceOf(BadRequestException);
		expect(store.rows[0].nextValue).toBe(12);
	});

	it('refuses to allocate from a series that was never configured', async () => {
		const { service } = seriesStore([{ key: 'RETURN' }]);

		await expect(service.allocate('ORDER')).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.findSeries('ORDER')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('allocating on a dialect whose transactions interleave', () => {
	beforeEach(() => {
		dialect().current = 'sqlite';
		// Every jittered pause before a retry is then zero-length, so no case waits on a real delay.
		jest.spyOn(Math, 'random').mockReturnValue(0);
	});

	it('hands two interleaved allocations two distinct values, where an unconditional write hands both the same one', async () => {
		// Control: the store really interleaves. Two transactions that read the counter and write its
		// successor back unconditionally — what the allocator did before its write was predicated — both
		// read `1`, both hand it out, and the series advances once for two documents.
		const control = new SeriesStore([{}], 'interleaved');
		const manager = (control.repository as { manager: any }).manager;
		const unconditional = (): Promise<number> =>
			manager.transaction(async (transactional: any) => {
				const row = await transactional.createQueryBuilder(Sequence, 'sequence').where({ key: 'ORDER' }).getOne();

				await transactional.save(Sequence, { ...row, nextValue: row.nextValue + 1 });

				return row.nextValue;
			});

		expect(await Promise.all([unconditional(), unconditional()])).toEqual([1, 1]);
		expect(control.rows[0].nextValue).toBe(2);

		const { store, service } = seriesStore([{}], 'interleaved');

		const [first, second] = await Promise.all([service.allocate('ORDER'), service.allocate('ORDER')]);

		// The allocator whose swap lost read the series again and took the next number.
		expect([first.value, second.value].sort((left, right) => left - right)).toEqual([1, 2]);
		expect(store.rows[0].nextValue).toBe(3);
		expect(store.locks).toEqual([]);
	});

	it('absorbs more contenders than a pair within its retry budget, handing each the next number', async () => {
		const { store, service } = seriesStore([{}], 'interleaved');

		const allocated = await Promise.all(Array.from({ length: 5 }, () => service.allocate('ORDER')));

		expect(allocated.map((number) => number.value).sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5]);
		expect(store.rows[0].nextValue).toBe(6);
	});

	it('restarts once when two allocations race into a new period, even though the restart leaves the counter where it was', async () => {
		// The series issued exactly one number in January, so it holds `2` — which is also what a restart
		// leaves behind, `1 + step`. A swap predicated on the counter alone matches for both allocators,
		// and both would hand out `1`; the period is what tells the second one it was overtaken.
		const { store, service } = seriesStore(
			[{ nextValue: 2, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: new Date('2026-01-15T10:00:00Z') }],
			'interleaved'
		);

		const [first, second] = await Promise.all([
			service.allocate('ORDER', { at: AT }),
			service.allocate('ORDER', { at: AT })
		]);

		expect([first.value, second.value].sort((left, right) => left - right)).toEqual([1, 2]);
		expect(store.rows[0]).toMatchObject({ nextValue: 3, lastResetAt: AT });
	});

	it('refuses an operator restart that an allocation overtook, rather than rewinding over the number it handed out', async () => {
		const { service } = seriesStore(
			[{ nextValue: 2, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: new Date('2026-01-15T10:00:00Z') }],
			'interleaved'
		);

		const [allocation, restart] = await Promise.allSettled([
			service.allocate('ORDER', { at: AT }),
			service.resetSeries('seq-1', { at: AT })
		]);

		// The allocation restarted the series and committed first, so the premise the operator's restart
		// was decided on — no restart recorded in this period yet — no longer holds, and it is refused.
		expect(allocation).toMatchObject({ status: 'fulfilled', value: { value: 1 } });
		expect(restart.status).toBe('rejected');
		expect((restart as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
		expect(String((restart as PromiseRejectedResult).reason.message)).toContain('CONCURRENT_MODIFICATION');

		// Control: a restart that had rewound the counter would hand `1` out a second time in February.
		expect((await service.allocate('ORDER', { at: AT })).value).toBe(2);
	});

	it('reports a conflict and hands out nothing when every attempt loses its swap', async () => {
		const { store, service } = seriesStore([{ nextValue: 41 }], 'interleaved');

		// Every write is refused, as though another allocator had always just moved the counter.
		jest.spyOn(store.transactional, 'update').mockResolvedValue({ affected: 0 });

		const error = await service.allocate('ORDER').catch((thrown) => thrown);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as Error).message).toContain('CONCURRENT_MODIFICATION');
		expect(store.reads).toHaveLength(SequenceService.ALLOCATION_ATTEMPTS);
		expect(store.rows[0].nextValue).toBe(41);
	});
});

describe('the scope of a series', () => {
	it('keeps a per-channel counter and the organization-wide counter apart', async () => {
		const { service } = seriesStore([
			{ key: 'ORDER', channelId: null, nextValue: 1 },
			{ key: 'ORDER', channelId: CHANNEL, nextValue: 500 }
		]);

		expect((await service.allocate('ORDER', { channelId: CHANNEL })).value).toBe(500);
		expect((await service.allocate('ORDER')).value).toBe(1);
		expect((await service.allocate('ORDER', { channelId: CHANNEL })).value).toBe(501);
		expect((await service.allocate('ORDER')).value).toBe(2);
	});

	it('falls back to the organization series for a channel that has none of its own', async () => {
		const { service } = seriesStore([{ key: 'ORDER', channelId: null, nextValue: 7 }]);

		const found = await service.findSeries('ORDER', CHANNEL);

		expect(found.channelId ?? null).toBeNull();
		expect((await service.allocate('ORDER', { channelId: CHANNEL })).value).toBe(7);
	});

	it('does not let one key’s counter advance another key’s', async () => {
		const { service } = seriesStore([
			{ key: 'ORDER', nextValue: 1 },
			{ key: 'RETURN', nextValue: 1 }
		]);

		await service.allocate('ORDER');
		await service.allocate('ORDER');

		expect((await service.allocate('RETURN')).value).toBe(1);
		expect((await service.allocate('ORDER')).value).toBe(3);
	});
});

describe('restarting a series', () => {
	it('restarts a monthly series whose last restart was in an earlier month', async () => {
		const { store, service } = seriesStore([
			{ nextValue: 57, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: new Date('2026-01-31T23:59:00Z') }
		]);

		const allocated = await service.allocate('ORDER', { at: AT });

		expect(allocated.value).toBe(1);
		expect(allocated.formatted).toBe('SO-000001');
		expect(store.rows[0].lastResetAt).toEqual(AT);
	});

	it('does not restart a series that is already inside its period', async () => {
		const { service } = seriesStore([
			{ nextValue: 57, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: new Date('2026-02-01T00:00:00Z') }
		]);

		// Control: a check that compared elapsed time instead of period boundaries would restart this
		// series and hand the same number out twice in one month.
		expect((await service.allocate('ORDER', { at: AT })).value).toBe(57);
		expect((await service.allocate('ORDER', { at: AT })).value).toBe(58);
	});

	it('restarts on the UTC boundary of the policy and not a second earlier', async () => {
		const yearly = seriesStore([
			{ nextValue: 9, resetPolicy: SequenceResetPolicy.YEARLY, lastResetAt: new Date('2025-12-31T23:59:59Z') }
		]);
		const daily = seriesStore([
			{ nextValue: 9, resetPolicy: SequenceResetPolicy.DAILY, lastResetAt: new Date('2026-02-09T23:59:59Z') }
		]);
		const sameDay = seriesStore([
			{ nextValue: 9, resetPolicy: SequenceResetPolicy.DAILY, lastResetAt: new Date('2026-02-09T00:00:00Z') }
		]);

		expect((await yearly.service.allocate('ORDER', { at: new Date('2026-01-01T00:00:00Z') })).value).toBe(1);
		expect((await daily.service.allocate('ORDER', { at: AT })).value).toBe(1);
		expect((await sameDay.service.allocate('ORDER', { at: new Date('2026-02-09T23:59:59Z') })).value).toBe(9);
	});

	it('records the period it started in rather than discarding a configured value', async () => {
		const { store, service } = seriesStore([
			{ nextValue: 57, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: null }
		]);

		expect((await service.allocate('ORDER', { at: AT })).value).toBe(57);
		expect(store.rows[0].lastResetAt).toEqual(new Date('2026-02-01T00:00:00Z'));
		expect((await service.allocate('ORDER', { at: AT })).value).toBe(58);
	});

	it('never restarts a series whose policy says never', async () => {
		const { service } = seriesStore([
			{ nextValue: 57, resetPolicy: SequenceResetPolicy.NEVER, lastResetAt: new Date('2020-01-01T00:00:00Z') }
		]);

		expect((await service.allocate('ORDER', { at: AT })).value).toBe(57);
	});
});

describe('formatting a number', () => {
	it('renders a stable prefix and a stable padding', async () => {
		const { service } = seriesStore([{ prefix: 'SO-', padding: 6 }]);

		expect((await service.allocate('ORDER')).formatted).toBe('SO-000001');
		expect((await service.allocate('ORDER')).formatted).toBe('SO-000002');
	});

	it('pads to the width and never truncates a value that outgrew it', () => {
		const { service } = seriesStore([]);

		expect(service.format({ prefix: 'SO-', padding: 6 }, 1)).toBe('SO-000001');
		expect(service.format({ prefix: 'SO-', padding: 6 }, 123456)).toBe('SO-123456');
		expect(service.format({ prefix: 'SO-', padding: 6 }, 1234567)).toBe('SO-1234567');
		expect(service.format({ prefix: undefined, padding: 3 }, 7)).toBe('007');
		expect(service.format({ prefix: undefined, padding: 0 }, 7)).toBe('7');
		expect(service.format({ prefix: undefined, padding: -5 }, 7)).toBe('7');
	});
});

describe('creating a series', () => {
	it('creates a series once, so a seed run on every boot does not restart numbering', async () => {
		const { store, service } = seriesStore([]);

		const created = await service.ensure({ key: 'ORDER', prefix: 'SO-' });
		await service.allocate('ORDER');
		await service.allocate('ORDER');

		const again = await service.ensure({ key: 'ORDER', prefix: 'SO-', nextValue: 1 });

		// Control: an `ensure` that created unconditionally would leave two rows for one key and hand
		// the next document a number the series has already used.
		expect(store.rows).toHaveLength(1);
		expect(again.id).toBe(created.id);
		expect(store.rows[0].nextValue).toBe(3);
	});

	it('fills in the defaults a series is created with, in the scope the request carries', async () => {
		const tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		const { service } = seriesStore([]);

		const created = await service.ensure({ key: 'ORDER' });

		expect(created).toMatchObject({
			key: 'ORDER',
			padding: 6,
			step: 1,
			nextValue: 1,
			resetPolicy: SequenceResetPolicy.NEVER,
			tenantId: 'tenant-1',
			organizationId: ORGANIZATION
		});

		// The series it created is the one the same request context allocates from.
		expect((await service.allocate('ORDER')).value).toBe(1);
	});

	it('creates the series in the scope the caller states, not in an absent one', async () => {
		// `ensure` takes the scope in its input, so that scope is the one it looks the series up in
		// and the one it creates it with. Out of a request — a seed run, a migration, a test — the
		// organization the caller named is the only scope there is, and a series created attached to
		// nobody would be invisible to the request-scoped allocation that follows.
		const { store, service } = seriesStore([]);

		const created = await service.ensure({ key: 'ORDER', organizationId: ORGANIZATION });

		expect(created.organizationId).toBe(ORGANIZATION);

		// The same seed run repeated finds what it created rather than creating a second series for
		// one key and scope, which is what would restart numbering.
		const again = await service.ensure({ key: 'ORDER', organizationId: ORGANIZATION });

		expect(again.id).toBe(created.id);
		expect(store.rows).toHaveLength(1);
	});

	it('returns the number a repeated idempotency key was already allocated', async () => {
		// The key contract lives on the route (the accepted-operation convention), so the allocation
		// accepts a key of its own: a retry is answered with the number the first attempt allocated
		// instead of consuming a second one and numbering one document twice.
		const { store, service } = seriesStore();
		const retry: { channelId?: string; at?: Date; idempotencyKey?: string } = { idempotencyKey: 'checkout-1' };

		const first = await service.allocate('ORDER', retry);
		const second = await service.allocate('ORDER', retry);

		expect(second.value).toBe(first.value);
		expect(second.formatted).toBe(first.formatted);
		// Control: the series advanced once, so the retry cost it nothing.
		expect(store.rows[0].nextValue).toBe(2);

		// A key belonging to another series is not a retry of this one.
		await expect(service.allocate('ORDER', { idempotencyKey: 'checkout-1', channelId: CHANNEL })).rejects.toBeInstanceOf(
			ConflictException
		);
	});
});
