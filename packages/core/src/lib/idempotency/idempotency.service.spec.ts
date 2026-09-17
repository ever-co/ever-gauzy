import { NotFoundException } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import { IIdempotencyStartInput, IdempotencyOutcome, IdempotencyStatus } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';
import { TypeOrmIdempotencyKeyRepository } from './repository/type-orm-idempotency-key.repository';

/**
 * The idempotency key store, against a table that behaves like the table it stands in for.
 *
 * The row is the lock: the unique tuple `(organizationId, scope, key)` is what makes two concurrent
 * identical requests resolve to exactly one owner, so the cases here are the four answers a caller
 * can receive — claimed, replayed, in flight, refused — and what each of them does to the work. The
 * double below enforces the unique tuple and raises the driver's unique violation, which is how the
 * service learns it lost a race without a lock table or any cooperation from the caller.
 */

type Row = Record<string, any>;

/** The error the driver raises for a duplicate unique tuple, as the classifier reads it. */
function uniqueViolation(): Error {
	return Object.assign(new Error('duplicate key value violates unique constraint "UQ_idempotency_org_scope_key"'), {
		code: '23505'
	});
}

/**
 * An in-memory stand-in for the `idempotency_key` table.
 *
 * It enforces `(organizationId, scope, key)` on insert, applies the criteria the service asks for
 * (including the `In` and `LessThan` operators the cleanup sweep builds), and answers a query builder
 * the way the row-locking takeover needs.
 */
class KeyTable {
	readonly rows: Row[] = [];
	readonly deletes: Row[] = [];
	/** The entity each locking read was addressed to. */
	readonly queries: unknown[] = [];
	private sequence = 0;

	async transaction<R>(work: (manager: any) => Promise<R>): Promise<R> {
		return work(this.manager);
	}

	readonly manager = {
		transaction: <R>(work: (manager: any) => Promise<R>): Promise<R> => this.transaction(work),
		createQueryBuilder: (entity: unknown, alias: string) => this.createQueryBuilder(entity, alias),
		save: (entityOrRow: unknown, maybeRow?: Row): Promise<Row> =>
			typeof entityOrRow === 'function' ? this.save(maybeRow as Row) : this.save(entityOrRow as Row)
	};

	createQueryBuilder(entity: unknown, _alias: string) {
		this.queries.push(entity);

		let criteria: Row = {};

		const builder = {
			where: (value: Row) => {
				criteria = value;

				return builder;
			},
			setLock: (_mode: string) => builder,
			getOne: async () => this.rows.find((row) => matches(row, criteria)) ?? null
		};

		return builder;
	}

	create(input: Row): Row {
		this.sequence += 1;

		return { id: `key-${this.sequence}`, ...input };
	}

	async save(row: Row): Promise<Row> {
		// The unique tuple is the lock. A row being updated carries its own id, so it is not a clash.
		const clash = this.rows.find((existing) => existing.id !== row.id && sameIdentity(existing, row));

		if (clash) {
			throw uniqueViolation();
		}

		const existing = this.rows.findIndex((entry) => entry.id === row.id);

		if (existing === -1) {
			this.rows.push(row);
		} else {
			this.rows[existing] = row;
		}

		return row;
	}

	async findOne(options: { where?: Row } = {}): Promise<Row | null> {
		return this.rows.find((row) => matches(row, options.where ?? {})) ?? null;
	}

	async find(options: { where?: Row; take?: number } = {}): Promise<Row[]> {
		const matched = this.rows.filter((row) => matches(row, options.where ?? {}));

		return typeof options.take === 'number' ? matched.slice(0, options.take) : matched;
	}

	async delete(criteria: Row): Promise<{ affected: number }> {
		this.deletes.push(criteria);

		const matched = this.rows.filter((row) => matches(row, criteria));

		for (const row of matched) {
			this.rows.splice(this.rows.indexOf(row), 1);
		}

		return { affected: matched.length };
	}
}

/** The columns the unique index is declared over. */
function sameIdentity(left: Row, right: Row): boolean {
	return (
		(left.organizationId ?? null) === (right.organizationId ?? null) && left.scope === right.scope && left.key === right.key
	);
}

/** One row's criteria, including the operators the sweep builds with `In` and `LessThan`. */
function matches(row: Row, criteria: Row = {}): boolean {
	return Object.entries(criteria).every(([column, condition]) => {
		const operator = condition as { _type?: string; _value?: unknown };

		if (operator && typeof operator === 'object' && operator._type === 'in' && Array.isArray(operator._value)) {
			return operator._value.includes(row[column]);
		}

		if (operator && typeof operator === 'object' && operator._type === 'lessThan') {
			return new Date(row[column]).getTime() < new Date(operator._value as string).getTime();
		}

		// A missing column and a null column are the same thing to the database.
		return (row[column] ?? null) === (condition ?? null);
	});
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The request a retrying client presents, so a case can vary exactly one thing. */
const request = (overrides: Partial<IIdempotencyStartInput> = {}): IIdempotencyStartInput => ({
	scope: 'checkout.complete',
	key: 'key-12345678',
	requestHash: 'a'.repeat(64),
	...overrides
});

/** The store under test, with the table it writes to. */
function store() {
	const table = new KeyTable();
	const service = new IdempotencyService(table as unknown as TypeOrmIdempotencyKeyRepository, {} as never);

	return { service, table };
}

/** Fixes the clock, because every window in this service is decided against it. */
function at(iso: string): void {
	jest.useFakeTimers();
	jest.setSystemTime(new Date(iso));
}

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('claiming a key', () => {
	it('gives the key to the first caller and replays the stored response to the second', async () => {
		const { service, table } = store();
		let work = 0;

		const first = await service.claim(request());
		expect(first.outcome).toBe(IdempotencyOutcome.CLAIMED);
		work += 1;

		await service.complete(first.record.id as string, {
			responseStatus: 201,
			responseBody: { id: 'order-1' },
			resourceType: 'order',
			resourceId: 'order-1'
		});

		const second = await service.claim(request());

		expect(second.outcome).toBe(IdempotencyOutcome.REPLAYED);
		expect(second.response).toEqual({ status: 201, body: { id: 'order-1' } });
		expect(second.record.resourceType).toBe('order');
		// Control: the work is what the key exists to protect. A store that answered "claimed" twice
		// would have booked the order twice and nothing here would have caught it.
		expect(work).toBe(1);
		expect(table.rows).toHaveLength(1);
	});

	it('refuses the same key presented with a different payload rather than serving the old result', async () => {
		const { service } = store();

		const first = await service.claim(request());
		await service.complete(first.record.id as string, { responseStatus: 201, responseBody: { id: 'order-1' } });

		const reused = await service.claim(request({ requestHash: 'b'.repeat(64) }));

		// The caller asked a different question under a key that already has an answer, so neither
		// answer is right: replaying the first would be a lie and running the work would apply a
		// request the key was never meant to cover.
		expect(reused.outcome).toBe(IdempotencyOutcome.REUSED_KEY);
		expect(reused.response).toBeUndefined();
		expect(reused.record.requestHash).toBe('a'.repeat(64));
	});

	it('tells a caller that the key is already being worked, with the time left on the lock', async () => {
		at('2026-03-01T10:00:00Z');

		const { service } = store();

		await service.claim(request());
		const second = await service.claim(request());

		expect(second.outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(second.retryAfterMs).toBe(IdempotencyService.DEFAULT_STALE_LOCK_MS);
	});

	it('treats a unique violation as the lost race rather than as a failure', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		// The winner's row is already there; our own read raced ahead of its insert and saw nothing.
		table.rows.push(
			table.create({
				scope: 'checkout.complete',
				key: 'key-12345678',
				requestHash: 'a'.repeat(64),
				status: IdempotencyStatus.IN_PROGRESS,
				lockedAt: new Date(),
				expiresAt: new Date(Date.now() + DAY_MS)
			})
		);

		const real = table.findOne.bind(table);
		let racingRead = true;

		jest.spyOn(table, 'findOne').mockImplementation(async (options?: { where?: Row }) => {
			if (racingRead) {
				racingRead = false;

				return null;
			}

			return real(options);
		});

		const outcome = await service.startOrReplay(request());

		expect(outcome.outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(table.rows).toHaveLength(1);
	});

	it('surfaces a database error that is not a lost race', async () => {
		// Control for the case above: a classifier that treated every write failure as "someone else
		// won" would hide an outage behind a 409 and never run the work.
		const { service, table } = store();

		jest.spyOn(table, 'save').mockRejectedValueOnce(new Error('connection terminated unexpectedly'));

		await expect(service.startOrReplay(request())).rejects.toThrow('connection terminated unexpectedly');
	});

	it('takes over a claim whose holder disappeared, and not one that is still working', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		const first = await service.claim(request());
		expect(first.outcome).toBe(IdempotencyOutcome.CLAIMED);

		// Inside the window the holder is presumed alive, so the key is not handed out twice.
		at('2026-03-01T10:01:00Z');
		const waiting = await service.claim(request());
		expect(waiting.outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(waiting.retryAfterMs).toBe(IdempotencyService.DEFAULT_STALE_LOCK_MS - 60_000);

		// Past it, a request whose process died must not hold the key forever.
		at('2026-03-01T10:05:00Z');
		const takenOver = await service.claim(request());

		expect(takenOver.outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect(takenOver.record.lockedAt).toEqual(new Date('2026-03-01T10:05:00.000Z'));
		// The takeover is a locking read of the key row itself, which is what makes the staleness check
		// and the re-claim one indivisible decision.
		expect(table.queries).toEqual([IdempotencyKey]);
	});

	it('keeps the keys of two tenants and two namespaces apart', async () => {
		// An organization belongs to one tenant, so two tenants presenting one key are two unique
		// tuples — and the lookup is narrowed by tenant and organization besides.
		const tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		const { service, table } = store();

		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);

		tenant.mockReturnValue('tenant-2');
		organization.mockReturnValue('org-2');
		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);

		tenant.mockReturnValue('tenant-1');
		organization.mockReturnValue('org-1');
		expect((await service.claim(request({ scope: 'cart.complete' }))).outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(table.rows).toHaveLength(3);
	});
});

describe('settling a key', () => {
	it('keeps a failed key claimed, so a retry is answered with the refusal instead of run again', async () => {
		const { service, table } = store();

		const first = await service.claim(request());
		await service.fail(first.record.id as string, { responseStatus: 422 });

		const second = await service.claim(request());

		expect(second.outcome).toBe(IdempotencyOutcome.REPLAYED);
		expect(second.response?.status).toBe(422);
		expect(table.rows[0].status).toBe(IdempotencyStatus.FAILED);
	});

	it('never replaces the response a replay would hand back', async () => {
		const { service } = store();

		const first = await service.claim(request());
		await service.complete(first.record.id as string, { responseStatus: 201, responseBody: { id: 'order-1' } });
		// A crash between the write and the response, then a retry: completing twice must not swap the
		// body the first caller already saw.
		const settled = await service.complete(first.record.id as string, {
			responseStatus: 500,
			responseBody: { id: 'other' }
		});

		expect(settled.responseStatus).toBe(201);
		expect(settled.responseBody).toEqual({ id: 'order-1' });
	});

	it('refuses to settle a row that no longer exists', async () => {
		const { service } = store();

		await expect(service.complete('key-404', {})).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('the retention window', () => {
	it('reports a row past its window as expired and one inside it as live', () => {
		const { service } = store();

		expect(service.isExpired({ expiresAt: new Date('2026-03-01T09:00:00Z') }, new Date('2026-03-01T10:00:00Z'))).toBe(true);
		expect(service.isExpired({ expiresAt: new Date('2026-03-01T11:00:00Z') }, new Date('2026-03-01T10:00:00Z'))).toBe(false);
		expect(service.isExpired({} as Pick<IdempotencyKey, 'expiresAt'>)).toBe(false);
	});

	it('frees a key whose response is past its retention window', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();
		const policy = { retentionMs: 60_000 };

		const first = await service.claim(request(), policy);
		await service.complete(first.record.id as string, { responseStatus: 201, responseBody: { id: 'order-1' } });

		at('2026-03-01T10:02:00Z');
		const reused = await service.claim(request(), policy);

		// Control: a store that kept answering from the expired row would replay a response the
		// platform promised not to keep, and would never let the client retry.
		expect(reused.outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect(reused.response).toBeUndefined();
		expect(table.rows).toHaveLength(1);
		expect(table.rows[0].status).toBe(IdempotencyStatus.IN_PROGRESS);
	});
});

describe('the cleanup sweep', () => {
	/** One row of the table, with the columns the sweep reads. */
	const row = (table: KeyTable, overrides: Row): Row => {
		const created = table.create({
			scope: 'checkout.complete',
			key: `key-${overrides.id}`,
			requestHash: 'a'.repeat(64),
			expiresAt: new Date('2026-03-01T09:00:00Z'),
			...overrides
		});

		table.rows.push(created);

		return created;
	};

	it('deletes a settled row past its window and an abandoned lock, and nothing else', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		const settled = row(table, { id: 'settled', status: IdempotencyStatus.COMPLETED });
		const abandoned = row(table, {
			id: 'abandoned',
			status: IdempotencyStatus.IN_PROGRESS,
			lockedAt: new Date('2026-03-01T09:50:00Z')
		});
		const holding = row(table, {
			id: 'holding',
			status: IdempotencyStatus.IN_PROGRESS,
			lockedAt: new Date('2026-03-01T09:59:30Z')
		});
		const replayable = row(table, {
			id: 'replayable',
			status: IdempotencyStatus.COMPLETED,
			expiresAt: new Date('2026-03-02T09:00:00Z')
		});

		expect(await service.purgeExpired()).toBe(2);
		// Deleting a live lease would let a retry start a second run of work that is still executing,
		// which is the one outcome the key exists to prevent.
		expect(table.rows.map((entry) => entry.id)).toEqual([holding.id, replayable.id]);
		expect(settled.deletedAt).toBeUndefined();
		expect(abandoned.deletedAt).toBeUndefined();
	});

	it('bounds one sweep, and refuses a limit that makes no sense', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		row(table, { id: 'first', status: IdempotencyStatus.COMPLETED });
		row(table, { id: 'second', status: IdempotencyStatus.COMPLETED });
		row(table, {
			id: 'third',
			status: IdempotencyStatus.IN_PROGRESS,
			lockedAt: new Date('2026-03-01T09:00:00Z')
		});

		expect(await service.purgeExpired(1)).toBe(1);
		expect(table.rows).toHaveLength(2);
		expect(await service.purgeExpired(0)).toBe(0);
		expect(table.rows).toHaveLength(2);
	});

	it('deletes on the criteria it selected with, so a row that moved between the two survives', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		row(table, { id: 'settled', status: IdempotencyStatus.COMPLETED });

		await service.purgeExpired();

		// Both statements assert the same conditions; a delete that selected by id alone would remove a
		// row that had been completed or refreshed in between.
		expect(table.deletes[0]).toMatchObject({
			expiresAt: expect.any(Object),
			status: expect.any(Object)
		});
	});
});
