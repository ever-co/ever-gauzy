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
	// The subject is the allocation, not the CRUD surface, so the base class is replaced by the one
	// thing a subclass inherits from it: a constructor.
	class CrudService {}

	return { CrudService };
});

jest.mock('./sequence.entity', () => {
	// The entity is the persistence boundary: the service hands the class to the manager and the
	// store below answers for it, so the decorators of the real entity are not loaded here.
	class Sequence {}

	return { Sequence };
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SequenceResetPolicy } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { IdempotencyService } from '../idempotency/idempotency.service';
import type { TypeOrmIdempotencyKeyRepository } from '../idempotency/repository/type-orm-idempotency-key.repository';
import { SequenceService } from './sequence.service';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';

/**
 * Allocating a document number from a series.
 *
 * A number a person quotes has to be unique, and two concurrent writers must never be handed the
 * same value. The mechanism the service actually uses is the one asserted here: the read, the
 * increment and the write happen inside a single transaction, and on a dialect that supports row
 * locks the read takes one. The store below behaves like the database on exactly that point —
 * transactions are serialised, reads outside one are not — so a service that stopped allocating
 * inside its transaction would hand out a duplicate and this suite would say so.
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
 * An in-memory stand-in for the series table and the manager that guards it.
 *
 * `transaction` runs one body at a time, which is what a database's writer lock — or a serialising
 * embedded dialect — does. `read`/`write` are the unguarded pair a caller could use instead; they
 * are exposed, and every read and write is recorded with the transaction depth it happened at, so
 * the suite can show where the allocation's read really takes place.
 */
class SeriesStore {
	readonly rows: SeriesRow[] = [];
	readonly locks: string[] = [];
	readonly reads: number[] = [];
	readonly writes: number[] = [];

	private tail: Promise<unknown> = Promise.resolve();
	private depth = 0;

	constructor(rows: Partial<SeriesRow>[] = [{}]) {
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

	private readonly manager = {
		transaction: (work: (manager: unknown) => Promise<unknown>) => this.transaction(work),
		createQueryBuilder: (_entity: unknown, alias: string) => this.queryBuilder(alias),
		save: async (_entity: unknown, row: SeriesRow) => this.persist(row)
	};

	/** The repository the service is constructed with. */
	get repository(): unknown {
		return {
			manager: this.manager,
			findOne: async (options: { where: Row }) => this.find(options.where),
			create: (input: Row) => ({ id: `seq-${this.rows.length + 1}`, ...input }),
			save: async (row: SeriesRow) => this.persist(row)
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

	/** One transaction at a time, as the database serialises writers. */
	private async transaction<T>(work: (manager: unknown) => Promise<T>): Promise<T> {
		const run = this.tail.then(async () => {
			this.depth += 1;

			try {
				return await work(this.manager);
			} finally {
				this.depth -= 1;
			}
		});

		this.tail = run.then(
			() => undefined,
			() => undefined
		);

		return run;
	}

	private queryBuilder(alias: string) {
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

				return builder;
			},
			getOne: async () => this.find(conditions)
		};

		return builder;
	}

	private async find(where: Row): Promise<SeriesRow | null> {
		this.reads.push(this.depth);
		await Promise.resolve();

		return (
			this.rows.find((row) => Object.entries(where).every(([column, value]) => matches(row[column], value))) ??
			null
		);
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

/** A missing column and a null column are the same thing to the database. */
function matches(value: unknown, condition: unknown): boolean {
	return (value ?? null) === (condition ?? null);
}

const ORGANIZATION = '6b1e0f2a-0000-4000-8000-00000000000a';
const CHANNEL = '6b1e0f2a-0000-4000-8000-00000000000b';

/** The dialect the mocked configuration reports, so a case can choose the path it exercises. */
const dialect = (): { current: 'postgres' | 'sqlite' } => (jest.requireMock('@gauzy/config') as any).dialect;

/** The service under test and the store it allocates from. */
function seriesStore(rows: Partial<SeriesRow>[] = [{}]) {
	const store = new SeriesStore(rows);
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

	it('takes a row lock on a dialect that supports one, and relies on the transaction where it does not', async () => {
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

		// No row lock exists on the embedded dialect; the surrounding transaction is the lock, and two
		// concurrent allocations are still handed two different values.
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
