import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import * as gauzyConfig from '@gauzy/config';
import { IIdempotencyStartInput, IdempotencyOutcome, IdempotencyStatus } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { parseTypeORMFindToMikroOrm } from '../core/utils';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';
import { TypeOrmIdempotencyKeyRepository } from './repository/type-orm-idempotency-key.repository';

/**
 * The idempotency key store, against a table that behaves like the table it stands in for.
 *
 * The row is the lock: the unique tuple `(tenantId, organizationId, scope, key)` is what makes two
 * concurrent identical requests resolve to exactly one owner, so the cases here are the four answers a caller
 * can receive — claimed, replayed, in flight, refused — and what each of them does to the work. The
 * double below enforces the unique tuple and raises the driver's unique violation, which is how the
 * service learns it lost a race without a lock table or any cooperation from the caller.
 *
 * The double is reached through the platform's dual-ORM CRUD path, because that is where the
 * storage half of the service now lives: the calls the service makes arrive as `find`,
 * `findOneByIdString`, `save` and `delete`, and the cases below assert them there rather than
 * against the repository the service used to hold directly. The three calls that could not move —
 * the claim's insert, the sweep and the takeover — are pinned by their reason in
 * `the calls the dual-ORM surface cannot carry`.
 */

/**
 * The dialect the takeover is running against.
 *
 * `@gauzy/config` reads `DB_TYPE` once, when it is loaded, so a case cannot switch dialect by setting
 * an environment variable later; the two helpers it exposes are therefore mocked with call-through
 * defaults, and a case that asserts on the row lock states the dialect it needs.
 */
jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	return {
		...actual,
		isPostgres: jest.fn(actual.isPostgres),
		isMySQL: jest.fn(actual.isMySQL)
	};
});

/** The dialect this environment really is, so a case that changes it can put it back. */
const actualConfig = jest.requireActual('@gauzy/config') as typeof gauzyConfig;

const isPostgresMock = gauzyConfig.isPostgres as unknown as jest.Mock;
const isMySQLMock = gauzyConfig.isMySQL as unknown as jest.Mock;

/**
 * Puts the service on a dialect that can take a row lock, or on one that cannot.
 *
 * @param supported Whether the dialect locks a row when it is asked to.
 */
function onDialect(supported: boolean): void {
	isPostgresMock.mockReturnValue(supported);
	isMySQLMock.mockReturnValue(false);
}

type Row = Record<string, any>;

/**
 * Watches one method of the platform's dual-ORM CRUD surface, which is where the storage half of the
 * service now lives.
 *
 * The spy calls through to the real implementation, so a case can assert that a storage call was made
 * at the surface the platform offers — `find`, `findOneByIdString`, `save`, `delete` — rather than
 * against a repository the service no longer holds directly.
 *
 * `crud.service` is required lazily rather than imported at the top. It is one end of an import cycle
 * with the entity graph this suite loads (entity graph → `@gauzy/core` CRUD barrel → the
 * tenant-aware subclass → `crud.service`), and reaching it as the first module of that cycle leaves
 * the subclass extending an undefined class before the cycle has settled.
 *
 * @param method The dual-ORM method to watch.
 * @returns The spy, which calls through.
 */
function watchingDualOrmMethod(
	method: 'find' | 'findOneByIdString' | 'save' | 'delete'
): jest.SpyInstance {
	const { CrudService } = require('../core/crud/crud.service') as typeof import('../core/crud/crud.service');

	return jest.spyOn(CrudService.prototype, method);
}

/** The error the driver raises for a duplicate unique tuple, as the classifier reads it. */
function uniqueViolation(): Error {
	return Object.assign(new Error('duplicate key value violates unique constraint "UQ_idempotency_org_scope_key"'), {
		code: '23505'
	});
}

/**
 * An in-memory stand-in for the `idempotency_key` table.
 *
 * It enforces `(tenantId, organizationId, scope, key)` on insert, applies the criteria the service asks for
 * (including the `In` and `LessThan` operators the cleanup sweep builds), and answers a query builder
 * the way the row-locking takeover needs — recording, for every such read, the criteria and the lock
 * the service asked it for.
 */
class KeyTable {
	readonly rows: Row[] = [];
	readonly deletes: Row[] = [];
	/** The entity each locking read was addressed to. */
	readonly queries: unknown[] = [];
	/** Every read the takeover made through a query builder, with the lock it asked for. */
	readonly lockingReads: { criteria: Row; lock?: string }[] = [];
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
		let lock: string | undefined;

		const builder = {
			where: (value: Row) => {
				criteria = value;

				return builder;
			},
			setLock: (mode: string) => {
				lock = mode;

				return builder;
			},
			getOne: async () => {
				this.lockingReads.push({ criteria, lock });

				return this.rows.find((row) => matches(row, criteria)) ?? null;
			}
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

	async findAndCount(options: { where?: Row; take?: number; skip?: number } = {}): Promise<[Row[], number]> {
		const matched = this.rows.filter((row) => matches(row, options.where ?? {}));
		const skip = typeof options.skip === 'number' ? options.skip : 0;
		const window = typeof options.take === 'number' ? matched.slice(skip, skip + options.take) : matched.slice(skip);

		// The total is the rows the criteria select rather than the rows this page carries, which is what
		// the operator's read reports as the page's total and what an assertion about narrowing needs.
		return [window, matched.length];
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

/**
 * The columns the unique index is declared over.
 *
 * The tenant is one of them, and a null in either scope column is folded to one value the way the
 * index folds it — `ScopeIdempotencyKeyByTenant1791000000557`, whose own spec runs the index itself.
 */
function sameIdentity(left: Row, right: Row): boolean {
	return (
		(left.tenantId ?? null) === (right.tenantId ?? null) &&
		(left.organizationId ?? null) === (right.organizationId ?? null) &&
		left.scope === right.scope &&
		left.key === right.key
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
	// The two dialect helpers are `jest.fn`s from a module factory rather than spies, so
	// `jest.restoreAllMocks` leaves them alone; they are put back to the real dialect here.
	isPostgresMock.mockReturnValue(actualConfig.isPostgres());
	isMySQLMock.mockReturnValue(actualConfig.isMySQL());
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

		// The race is staged on the read the service actually makes, which is the platform's dual-ORM
		// one: a spy left on a repository method the service no longer reaches would leave this case
		// passing through the read-found-the-winner path, which is a different case altogether.
		const real = table.find.bind(table);
		const insert = jest.spyOn(table, 'save');
		let racingRead = true;

		jest.spyOn(table, 'find').mockImplementation(async (options?: { where?: Row; take?: number }) => {
			if (racingRead) {
				racingRead = false;

				return [];
			}

			return real(options);
		});

		const outcome = await service.startOrReplay(request());

		expect(outcome.outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		// Control: the insert was attempted, which is what makes this a lost race rather than a read
		// that found the winner's row — the row count below is satisfied either way.
		expect(insert).toHaveBeenCalledTimes(1);
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

	it('lets two tenants with no organization selected use one key, because the read and the lock agree', async () => {
		// A service account, an integration, a token issued without `lastOrganizationId`: the organization
		// is null for each. The read that finds a key is scoped by tenant, so the lock has to be too — an
		// index that folded the organization but carried no tenant let the first tenant's row refuse the
		// second tenant's insert, and the second tenant's scoped read then found nothing to answer with.
		const tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);

		const { service, table } = store();

		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);

		tenant.mockReturnValue('tenant-2');
		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);

		// Control: inside one tenant the key is still one lock.
		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(table.rows.map((row) => row.tenantId)).toEqual(['tenant-1', 'tenant-2']);
	});

	it('reads the key back through the platform\'s dual-ORM read, scoped by the credential', async () => {
		const { service } = store();
		const read = watchingDualOrmMethod('find');

		const first = await service.claim(request());
		expect(first.outcome).toBe(IdempotencyOutcome.CLAIMED);

		await service.complete(first.record.id as string, { responseStatus: 201, responseBody: { id: 'order-1' } });
		read.mockClear();

		const second = await service.startOrReplay(request());

		// Control: the ported read answered with the stored row, so a read that found nothing would be
		// caught here — while the arguments below are what pins the scoping itself, because a read
		// with no criteria at all would have found this single row just as well.
		expect(second.outcome).toBe(IdempotencyOutcome.REPLAYED);
		// The call is pinned through the dual-ORM method the service now reaches for, with the exact
		// arguments it passes: one bounded read, the scope and the key as stated, and the tenant and
		// the organization as the credential states them.
		expect(read).toHaveBeenCalledTimes(1);
		expect(read.mock.calls[0][0]).toEqual({
			where: {
				scope: 'checkout.complete',
				key: 'key-12345678',
				tenantId: null,
				organizationId: null
			},
			take: 1
		});
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

	it('replays a failure that recorded no status as a failure, not as a success', async () => {
		const { service } = store();

		// `fail()` takes its status as optional, so a key can be settled as failed without one.
		const refused = await service.claim(request());
		await service.fail(refused.record.id as string);

		const retry = await service.claim(request());

		// Control: answering `200` here — what every status-less row used to replay as — would tell a client
		// whose request the server refused that it had been accepted.
		expect(retry.outcome).toBe(IdempotencyOutcome.REPLAYED);
		expect(retry.response?.status).toBe(500);

		// A completed row that recorded no status is still the success it was.
		const accepted = await service.claim(request({ key: 'key-87654321' }));
		await service.complete(accepted.record.id as string);

		expect((await service.claim(request({ key: 'key-87654321' }))).response?.status).toBe(200);
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

	it('reads a row back by its identifier through the dual-ORM path, and answers a missing row with null', async () => {
		const { service, table } = store();
		const readById = watchingDualOrmMethod('findOneByIdString');

		const first = await service.claim(request());

		// Control: the row that comes back is the stored one, so a read that answered null for
		// everything would fail here instead of passing the miss below by accident.
		expect((await service.findById(first.record.id as string))?.id).toBe(first.record.id);
		expect(readById).toHaveBeenCalledWith(first.record.id);

		// A miss is an ordinary answer — `settle` reads a row back to find out whether it is still
		// there — while the platform's read by identifier answers a miss by raising. The case above
		// pins that the service's own refusal still reaches the caller; this one pins that the port
		// maps the platform's refusal back to null rather than letting it escape in its place.
		expect(await service.findById('key-404')).toBeNull();
		// Control: the row is still there after both reads, because a read is a read — neither the hit
		// nor the miss removed or rewrote anything.
		expect(table.rows).toHaveLength(1);
	});

	it('settles a key through the platform\'s dual-ORM write', async () => {
		const { service, table } = store();
		const write = watchingDualOrmMethod('save');

		const first = await service.claim(request());
		write.mockClear();

		const settled = await service.complete(first.record.id as string, {
			responseStatus: 201,
			responseBody: { id: 'order-1' }
		});

		expect(write).toHaveBeenCalledTimes(1);
		expect(settled.status).toBe(IdempotencyStatus.COMPLETED);
		// Control: the write reached the row rather than only the returned value — a settle routed
		// somewhere the store does not see would leave the key in progress and replay nothing.
		expect(table.rows[0].status).toBe(IdempotencyStatus.COMPLETED);
		expect(table.rows[0].responseStatus).toBe(201);
		expect(table.rows[0].responseBody).toEqual({ id: 'order-1' });
	});
});

describe('the retention window', () => {
	it('reports a row past its window as expired and one inside it as live', () => {
		const { service } = store();

		expect(service.isExpired({ expiresAt: new Date('2026-03-01T09:00:00Z') }, new Date('2026-03-01T10:00:00Z'))).toBe(true);
		expect(service.isExpired({ expiresAt: new Date('2026-03-01T11:00:00Z') }, new Date('2026-03-01T10:00:00Z'))).toBe(false);
		expect(service.isExpired({} as Pick<IdempotencyKey, 'expiresAt'>)).toBe(false);
	});

	it('does not free a key whose lease is still running, even past its retention window', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();
		const policy = { retentionMs: 60_000 };

		const first = await service.claim(request(), policy);
		expect(first.outcome).toBe(IdempotencyOutcome.CLAIMED);

		// The work outlives the window its response would be replayable in. That is a long request,
		// not an abandoned one: the row is still the holder's lease.
		at('2026-03-01T10:02:00Z');

		const second = await service.claim(request(), policy);

		// Control: clearing the expired row here would put two writers on one key, which is the single
		// outcome the key exists to prevent. The caller is told to come back instead.
		expect(second.outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(table.rows).toHaveLength(1);
		expect(table.rows[0].id).toBe(first.record.id);
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

describe('the operator surface', () => {
	/** The caller the operator reads are scoped by. */
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');
	});

	/** One stored key, with the columns the operator reads answer. */
	const stored = (table: KeyTable, overrides: Row = {}): Row => {
		const created = table.create({
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			scope: 'checkout.complete',
			key: 'key-12345678',
			requestHash: 'a'.repeat(64),
			status: IdempotencyStatus.COMPLETED,
			responseStatus: 201,
			responseBody: { id: 'order-1', total: '10.000000' },
			resourceType: 'order',
			resourceId: 'order-1',
			expiresAt: new Date('2026-03-02T10:00:00Z'),
			createdAt: new Date('2026-03-01T10:00:00Z'),
			...overrides
		});

		table.rows.push(created);

		return created;
	};

	it('lists the caller\'s keys and never the response a key holds', async () => {
		const { service, table } = store();

		stored(table);
		stored(table, { id: undefined, scope: 'order.capture', key: 'key-87654321' });

		const page = await service.listKeys();

		expect(page.total).toBe(2);
		expect(page.items).toHaveLength(2);
		// The stored response is the calling client's own data. The permission to release a key is a
		// permission to unblock a retry, not a permission to read what the retry produced.
		expect(page.items[0]).not.toHaveProperty('responseBody');
		expect(page.items[0]).toHaveProperty('resourceId', 'order-1');
	});

	it('narrows the list by the columns an operator searches by', async () => {
		const { service, table } = store();

		stored(table);
		stored(table, { id: undefined, scope: 'order.capture', key: 'key-87654321', resourceType: 'payment' });

		expect((await service.listKeys({ scope: 'order.capture' })).total).toBe(1);
		expect((await service.listKeys({ key: 'key-12345678' })).total).toBe(1);
		expect((await service.listKeys({ status: IdempotencyStatus.IN_PROGRESS })).total).toBe(0);
		expect((await service.listKeys({ resourceType: 'order' })).total).toBe(1);
	});

	it('answers another organization\'s key as absent rather than refusing it', async () => {
		const { service, table } = store();

		const mine = stored(table);
		stored(table, { id: 'theirs', organizationId: 'org-2', key: 'key-99999999' });

		expect(await service.findKeyOrFail(mine.id as string)).toMatchObject({ id: mine.id });
		// A refusal that said "this key belongs to somebody else" would be a disclosure. `404` says no
		// such key is stored, which is exactly what is true for this caller.
		await expect(service.findKeyOrFail('theirs')).rejects.toThrow(/RESOURCE_NOT_FOUND/);
	});

	it('releases a settled key by removing it, so the retry is a first attempt again', async () => {
		const { service, table } = store();

		const released = stored(table);

		await service.release(released.id as string);

		expect(table.rows).toHaveLength(0);
		// What the caller is answered is the row as it stood, without the response it held.
		expect(released.responseBody).toBeDefined();
	});

	it('removes the row through the platform\'s dual-ORM delete, on plain values', async () => {
		const { service, table } = store();
		const remove = watchingDualOrmMethod('delete');

		const released = stored(table);

		await service.release(released.id as string);

		// The removal is the delete whose criteria are plain values — the row id, and nothing a
		// statement cannot carry — so it travels the dual-ORM path and works on either ORM.
		expect(remove).toHaveBeenCalledTimes(1);
		expect(remove.mock.calls[0][0]).toEqual({ id: released.id });
		// Control: the row is gone from the table, not merely reported as released.
		expect(table.rows).toHaveLength(0);
	});

	it('refuses to release a claim whose work is still running', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		const live = stored(table, {
			status: IdempotencyStatus.IN_PROGRESS,
			lockedAt: new Date('2026-03-01T09:59:30Z'),
			responseStatus: undefined,
			responseBody: undefined
		});

		const refusal = await service.release(live.id as string).catch((error) => error);

		// The same refusal the retry-safety interceptor answers a concurrent duplicate with, because it
		// is the same fact: a claim is live and removing it would let the work run twice.
		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.IDEMPOTENCY_IN_PROGRESS);
		expect((refusal as ApiException).getStatus()).toBe(409);
		// Control: the row is what the refusal protects.
		expect(table.rows).toHaveLength(1);
	});

	it('releases a claim whose lease has gone stale, because nothing is executing it any more', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		const abandoned = stored(table, {
			status: IdempotencyStatus.IN_PROGRESS,
			lockedAt: new Date('2026-03-01T09:50:00Z')
		});

		await service.release(abandoned.id as string);

		expect(table.rows).toHaveLength(0);
	});
});

describe('the calls the dual-ORM surface cannot carry', () => {
	it('translates the range the sweep selects on, so the predicate survives either ORM', () => {
		const now = new Date('2026-03-01T10:00:00Z');

		const converted = parseTypeORMFindToMikroOrm({
			where: {
				expiresAt: LessThan(now),
				status: In([IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED])
			}
		}).where as Row;

		// This case used to pin the opposite: `processFindOperator` handled isNull, not, in, equal,
		// between, moreThan and moreThanOrEqual, and sent every other operator to a default branch that
		// warned to the console and answered an *empty* condition. An empty condition on a property is
		// not a narrower read — it is no condition at all — so on the dual-ORM path the expiry predicate
		// vanished and the sweep would have deleted rows whose stored response was still inside its
		// window, which is the first of the two eligibility rules this kernel keeps.
		//
		// The converter now knows the operator, so the predicate survives. Control: the `In` half is
		// asserted too, so this case cannot pass by the converter having failed outright.
		expect(converted['status']).toEqual({ $in: [IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED] });
		expect(converted['expiresAt']).toEqual({ $lt: now });
	});

	it('keeps the claim\'s insert on the repository, because the CRUD write path buries the lost race', async () => {
		const { service, table } = store();
		const driverError = uniqueViolation();

		// What the insert raises today, and what the claim decision is read from: the driver's own
		// error. Control: a classifier that answered false here would make the assertion below say
		// nothing about the port.
		expect(isUniqueViolation(driverError)).toBe(true);

		jest.spyOn(table, 'save').mockRejectedValueOnce(driverError);

		const throughTheCrudPath = await service
			.save({
				scope: 'checkout.complete',
				key: 'key-12345678',
				requestHash: 'a'.repeat(64),
				expiresAt: new Date()
			})
			.catch((error) => error);

		// The platform's write path answers a failed write with a client-facing message rather than
		// with the driver's error...
		expect(throughTheCrudPath).toBeInstanceOf(BadRequestException);
		// ...so the classifier that tells "another request won the race" apart from "the store is
		// broken" stops recognizing it: routed through that path, a lost race would be answered with a
		// `400` instead of resolving into the winner's stored row, and the in-flight refusal would
		// never be reached. The MikroORM arm of the same path is an upsert besides, which merges into
		// the row the race was lost to rather than raising the violation the outcome is decided by.
		// This case is the reason the insert still calls the repository, and it fails the moment
		// `core/crud` lets a driver error through — which is the change that would let it be ported.
		expect(isUniqueViolation(throughTheCrudPath)).toBe(false);
	});

	it('keeps the takeover on the repository, because the lock is what makes it a takeover', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = store();

		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);

		// On PostgreSQL and MySQL the read takes the row, which is what stops two requests from both
		// deciding that one abandoned claim is theirs to take.
		at('2026-03-01T10:05:00Z');
		onDialect(true);

		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect(table.lockingReads[0].criteria).toEqual({ id: 'key-1', status: IdempotencyStatus.IN_PROGRESS });
		// The lock is a database feature the platform's cross-ORM query builder does not carry —
		// `IQueryBuilder` has no `setLock` — so the takeover stays on the repository manager, and this
		// assertion is what would have to be deleted for a port to claim otherwise.
		expect(table.lockingReads[0].lock).toBe('pessimistic_write');

		// A store that cannot lock answers the same outcome: the embedded dialect serializes writers,
		// so the surrounding transaction is the lock. Control: the row is re-claimed here exactly as
		// it was above, so the difference between the two reads is the lock and nothing else — which
		// is the guarantee a port would have to give up, and why the call stays where it is.
		at('2026-03-01T10:10:00Z');
		onDialect(false);

		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect(table.lockingReads[1].lock).toBeUndefined();
		expect(table.lockingReads[1].criteria).toEqual({ id: 'key-1', status: IdempotencyStatus.IN_PROGRESS });
	});
});
