import { LockMode } from '@mikro-orm/core';
import * as gauzyConfig from '@gauzy/config';
import { IIdempotencyStartInput, IdempotencyOutcome, IdempotencyStatus } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { MultiORMEnum } from '../core/utils';
import { IdempotencyService } from './idempotency.service';
import { MikroOrmIdempotencyKeyRepository } from './repository/mikro-orm-idempotency-key.repository';
import { TypeOrmIdempotencyKeyRepository } from './repository/type-orm-idempotency-key.repository';

/**
 * The idempotency kernel on an installation that runs `DB_ORM=mikro-orm`.
 *
 * Three of the kernel's calls cannot travel the platform's dual-ORM CRUD path — the claim's insert, the
 * sweep and the takeover — and they used to be written on the TypeORM repository alone. On this ORM the
 * columns they name are not in TypeORM's metadata at all (`@MultiORMColumn` decorates one ORM at a time),
 * so every `@Idempotent` route failed on its first claim and the cleanup job never deleted a row. These
 * cases drive the MikroORM arm of each call against an entity manager that behaves the way MikroORM's
 * does in the two ways that matter here: an insert drops the `relationId` mirrors `tenantId` and
 * `organizationId` (`persist: false`), and the unique tuple raises the driver's violation.
 *
 * The TypeORM repository the service is also handed records every member it is asked for, so a case
 * can assert that nothing reached it.
 */

jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	return {
		...actual,
		isPostgres: jest.fn(actual.isPostgres),
		isMySQL: jest.fn(actual.isMySQL)
	};
});

const actualConfig = jest.requireActual('@gauzy/config') as typeof gauzyConfig;
const isPostgresMock = gauzyConfig.isPostgres as unknown as jest.Mock;
const isMySQLMock = gauzyConfig.isMySQL as unknown as jest.Mock;

type Row = Record<string, any>;

const ZERO = '00000000-0000-0000-0000-000000000000';

/** The error the driver raises for a duplicate unique tuple, with the code MikroORM carries over. */
function uniqueViolation(): Error {
	return Object.assign(new Error('duplicate key value violates unique constraint "UQ_idempotency_tenant_org_scope_key"'), {
		code: '23505'
	});
}

/** One row's criteria, in MikroORM's own operators. */
function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where).every(([column, condition]) => {
		if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
			if ('$in' in condition) {
				return (condition.$in as unknown[]).includes(row[column]);
			}

			if ('$lt' in condition) {
				return row[column] != null && new Date(row[column]).getTime() < new Date(condition.$lt).getTime();
			}
		}

		return (row[column] ?? null) === (condition ?? null);
	});
}

/**
 * The `idempotency_key` table as MikroORM reaches it: the repository the dual-ORM path calls, and the
 * entity manager the kernel's own per-ORM calls use.
 */
class MikroKeyStore {
	readonly rows: Row[] = [];
	readonly inserts: Row[] = [];
	readonly finds: Row[] = [];
	readonly deletes: Row[] = [];
	readonly lockingReads: { where: Row; options: Row }[] = [];
	transactions = 0;
	flushes = 0;
	private managed: Row[] = [];

	readonly em = {
		insert: async (_entity: unknown, data: Row) => {
			this.inserts.push(data);

			// `tenantId` and `organizationId` are `relationId` mirrors, which MikroORM maps with
			// `persist: false`: an insert stores what the `tenant` and `organization` relations carry.
			const { tenantId: _tenantId, organizationId: _organizationId, tenant, organization, ...columns } = data;
			const row: Row = { ...columns, tenantId: tenant ?? null, organizationId: organization ?? null };

			// `UQ_idempotency_tenant_org_scope_key`: both scope columns folded, over the live rows.
			const clash = this.rows.some(
				(existing) =>
					(existing.tenantId ?? ZERO) === (row.tenantId ?? ZERO) &&
					(existing.organizationId ?? ZERO) === (row.organizationId ?? ZERO) &&
					existing.scope === row.scope &&
					existing.key === row.key
			);

			if (clash) {
				throw uniqueViolation();
			}

			this.rows.push(row);

			return row.id;
		},
		find: async (_entity: unknown, where: Row, options: Row = {}) => {
			this.finds.push(where);

			const matched = this.rows.filter((row) => matches(row, where));

			return typeof options.limit === 'number' ? matched.slice(0, options.limit) : matched;
		},
		findOne: async (_entity: unknown, where: Row, options: Row = {}) => {
			this.lockingReads.push({ where, options });

			const found = this.rows.find((row) => matches(row, where));

			if (!found) {
				return null;
			}

			// A managed copy: what the caller changes on it reaches the table on flush, not before.
			const copy = { ...found };

			this.managed.push(copy);

			return copy;
		},
		flush: async () => {
			this.flushes += 1;

			for (const entity of this.managed) {
				const index = this.rows.findIndex((row) => row.id === entity.id);

				if (index !== -1) {
					this.rows[index] = { ...entity };
				}
			}

			this.managed = [];
		},
		nativeDelete: async (_entity: unknown, where: Row) => {
			this.deletes.push(where);

			const matched = this.rows.filter((row) => matches(row, where));

			for (const row of matched) {
				this.rows.splice(this.rows.indexOf(row), 1);
			}

			return matched.length;
		},
		transactional: async <R>(work: (em: MikroKeyStore['em']) => Promise<R>): Promise<R> => {
			this.transactions += 1;

			return work(this.em);
		}
	};

	/** The repository the platform's dual-ORM CRUD path reaches on this ORM. */
	readonly repository = {
		getEntityManager: () => this.em,
		find: async (where: Row, options: Row = {}) => {
			const matched = this.rows.filter((row) => matches(row, where)).map((row) => ({ ...row }));

			return typeof options.limit === 'number' ? matched.slice(0, options.limit) : matched;
		},
		findOne: async (where: Row) => {
			const found = this.rows.find((row) => matches(row, where));

			return found ? { ...found } : null;
		},
		upsert: async (entity: Row) => {
			const index = this.rows.findIndex((row) => row.id === entity.id);

			if (index === -1) {
				this.rows.push({ ...entity });
			} else {
				this.rows[index] = { ...entity };
			}

			return entity;
		}
	};
}

/**
 * The service on MikroORM, with a TypeORM repository that records every member it is asked for.
 *
 * `metadata` is the one member a read legitimately touches on either ORM — the relation guard reads it —
 * so it is answered and not recorded.
 */
function mikroStore() {
	const table = new MikroKeyStore();
	const typeOrmReached: string[] = [];
	const typeOrm = new Proxy(
		{},
		{
			get: (_target, property) => {
				if (property !== 'metadata') {
					typeOrmReached.push(String(property));
				}

				return undefined;
			}
		}
	);

	const service = new IdempotencyService(
		typeOrm as unknown as TypeOrmIdempotencyKeyRepository,
		table.repository as unknown as MikroOrmIdempotencyKeyRepository
	);

	jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	// The rows this double answers are plain objects rather than entities MikroORM manages, so the
	// platform's `wrap(entity).toJSON()` has nothing to unwrap; they are handed back as they are.
	jest.spyOn(service as any, 'serialize').mockImplementation((entity: unknown) => entity);

	return { service, table, typeOrmReached };
}

const request = (overrides: Partial<IIdempotencyStartInput> = {}): IIdempotencyStartInput => ({
	scope: 'checkout.complete',
	key: 'key-12345678',
	requestHash: 'a'.repeat(64),
	...overrides
});

function at(iso: string): void {
	jest.useFakeTimers();
	jest.setSystemTime(new Date(iso));
}

afterEach(() => {
	isPostgresMock.mockReturnValue(actualConfig.isPostgres());
	isMySQLMock.mockReturnValue(actualConfig.isMySQL());
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('claiming a key on MikroORM', () => {
	it('stores the claim under the caller\'s tenant and organization, through the relations MikroORM persists', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		const { service, table, typeOrmReached } = mikroStore();

		const first = await service.claim(request());

		expect(first.outcome).toBe(IdempotencyOutcome.CLAIMED);
		// The scope travels as the relations. Control: written as `tenantId`/`organizationId`, the two
		// `persist: false` mirrors, MikroORM drops them and the row is stored with no scope at all.
		expect(table.inserts[0]).toMatchObject({ tenant: 'tenant-1', organization: 'org-1' });
		expect(table.inserts[0]).not.toHaveProperty('tenantId');
		expect(table.inserts[0]).not.toHaveProperty('organizationId');
		expect(table.rows[0]).toMatchObject({ tenantId: 'tenant-1', organizationId: 'org-1' });
		// The id is stated — a column default only on Postgres — and so are the columns a flush would fill.
		expect(table.inserts[0].id).toMatch(/^[0-9a-f-]{36}$/);
		expect(table.inserts[0]).toMatchObject({
			status: IdempotencyStatus.IN_PROGRESS,
			isActive: true,
			isArchived: false,
			createdAt: expect.any(Date),
			updatedAt: expect.any(Date)
		});
		expect(first.record.id).toBe(table.inserts[0].id);

		// The scoped read finds the row the insert stored, so the key is one lock: a second attempt waits.
		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(table.rows).toHaveLength(1);
		expect(typeOrmReached).toEqual([]);
	});

	it('replays a settled key, settling it through the dual-ORM write', async () => {
		const { service, typeOrmReached } = mikroStore();

		const first = await service.claim(request());
		await service.complete(first.record.id as string, { responseStatus: 201, responseBody: { id: 'order-1' } });

		const second = await service.claim(request());

		expect(second.outcome).toBe(IdempotencyOutcome.REPLAYED);
		expect(second.response).toEqual({ status: 201, body: { id: 'order-1' } });
		expect(typeOrmReached).toEqual([]);
	});

	it('hands the store a response as the JSON value it is, and replays a refusal at its status', async () => {
		const { service, table, typeOrmReached } = mikroStore();
		const refusal = { message: 'The cart has no lines.', code: 'VALIDATION_FAILED', details: { lines: [] } };

		const first = await service.claim(request());
		await service.fail(first.record.id as string, { responseStatus: 422, responseBody: refusal });

		// The body reaches the store as an object, on this ORM as on TypeORM: turning it into text is the column
		// type's job (`simple-json` on TypeORM, `@JsonColumn`'s type on MikroORM), and a body stringified here would
		// be stored quoted and replayed as a string. Whether MikroORM's assigner accepts the object is a question
		// for the real store — a stand-in validates no property type — and is answered in
		// `idempotency.service.mikro-orm-store.spec.ts`, where it once refused every response.
		expect(table.rows[0]).toMatchObject({ status: IdempotencyStatus.FAILED, responseStatus: 422, responseBody: refusal });

		const retry = await service.claim(request());

		expect(retry).toMatchObject({ outcome: IdempotencyOutcome.REPLAYED, response: { status: 422, body: refusal } });
		expect(typeOrmReached).toEqual([]);
	});

	it('resolves a lost race into the winner\'s row, read off the driver\'s own violation', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = mikroStore();

		// The winner's row is already there; our own read raced ahead of its insert and saw nothing.
		table.rows.push({
			id: 'winner',
			scope: 'checkout.complete',
			key: 'key-12345678',
			requestHash: 'a'.repeat(64),
			status: IdempotencyStatus.IN_PROGRESS,
			tenantId: null,
			organizationId: null,
			lockedAt: new Date(),
			expiresAt: new Date(Date.now() + 60_000)
		});

		const real = table.repository.find;
		let racingRead = true;

		table.repository.find = async (where: Row, options?: Row) => {
			if (racingRead) {
				racingRead = false;

				return [];
			}

			return real(where, options);
		};

		const outcome = await service.startOrReplay(request());

		// Control: the insert was attempted, which is what makes this a lost race rather than a read that
		// found the winner's row.
		expect(table.inserts).toHaveLength(1);
		expect(outcome.outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(outcome.record.id).toBe('winner');
	});

	it('takes over an abandoned claim under a row lock, inside one transaction', async () => {
		at('2026-03-01T10:00:00Z');
		isPostgresMock.mockReturnValue(true);
		isMySQLMock.mockReturnValue(false);

		const { service, table, typeOrmReached } = mikroStore();

		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);

		at('2026-03-01T10:05:00Z');

		const takenOver = await service.claim(request());

		expect(takenOver.outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect(table.transactions).toBe(1);
		// The read takes the row, which is what stops two requests from both deciding that one abandoned
		// claim is theirs — and the staleness is re-checked on the row read under that lock.
		expect(table.lockingReads[0]).toEqual({
			where: { id: table.rows[0].id, status: IdempotencyStatus.IN_PROGRESS },
			options: { lockMode: LockMode.PESSIMISTIC_WRITE }
		});
		// The renewed lease reached the table through the flush, not merely the returned object.
		expect(table.flushes).toBe(1);
		expect(table.rows[0].lockedAt).toEqual(new Date('2026-03-01T10:05:00.000Z'));
		expect(typeOrmReached).toEqual([]);
	});

	it('takes over without a lock on the embedded dialect, where the transaction is the lock', async () => {
		at('2026-03-01T10:00:00Z');
		isPostgresMock.mockReturnValue(false);
		isMySQLMock.mockReturnValue(false);

		const { service, table } = mikroStore();

		await service.claim(request());
		at('2026-03-01T10:05:00Z');

		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect(table.lockingReads[0].options).toEqual({});
	});

	it('leaves a claim whose holder is still working', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = mikroStore();

		await service.claim(request());
		at('2026-03-01T10:01:00Z');

		// The lease is inside its window, so the kernel never reaches for the lock at all.
		expect((await service.claim(request())).outcome).toBe(IdempotencyOutcome.IN_FLIGHT);
		expect(table.lockingReads).toEqual([]);
		expect(table.flushes).toBe(0);
	});
});

describe('the cleanup sweep on MikroORM', () => {
	const row = (table: MikroKeyStore, overrides: Row): Row => {
		const created = {
			scope: 'checkout.complete',
			key: `key-${overrides.id}`,
			requestHash: 'a'.repeat(64),
			tenantId: null,
			organizationId: null,
			expiresAt: new Date('2026-03-01T09:00:00Z'),
			...overrides
		};

		table.rows.push(created);

		return created;
	};

	it('deletes a settled row past its window and an abandoned lock, and nothing else', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table, typeOrmReached } = mikroStore();

		row(table, { id: 'settled', status: IdempotencyStatus.COMPLETED });
		row(table, { id: 'abandoned', status: IdempotencyStatus.IN_PROGRESS, lockedAt: new Date('2026-03-01T09:50:00Z') });
		row(table, { id: 'holding', status: IdempotencyStatus.IN_PROGRESS, lockedAt: new Date('2026-03-01T09:59:30Z') });
		row(table, { id: 'replayable', status: IdempotencyStatus.COMPLETED, expiresAt: new Date('2026-03-02T09:00:00Z') });

		expect(await service.purgeExpired()).toBe(2);
		// Deleting a live lease would let a retry start a second run of work that is still executing.
		expect(table.rows.map((entry) => entry.id)).toEqual(['holding', 'replayable']);
		expect(typeOrmReached).toEqual([]);
	});

	it('states the range in MikroORM\'s own operators, and asserts it again on the delete', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = mikroStore();

		row(table, { id: 'settled', status: IdempotencyStatus.COMPLETED });
		await service.purgeExpired();

		const now = new Date('2026-03-01T10:00:00Z');

		// Control: an expiry predicate that vanished would select every settled row in the table, whose
		// stored responses are still replayable.
		expect(table.finds[0]).toEqual({
			expiresAt: { $lt: now },
			status: { $in: [IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED] }
		});
		// A delete that named the ids alone would remove a row completed or refreshed in between.
		expect(table.deletes[0]).toEqual({
			id: { $in: ['settled'] },
			expiresAt: { $lt: now },
			status: { $in: [IdempotencyStatus.COMPLETED, IdempotencyStatus.FAILED] }
		});
	});

	it('frees an expired key on claim with the same range, on this ORM too', async () => {
		at('2026-03-01T10:00:00Z');

		const { service, table } = mikroStore();
		const policy = { retentionMs: 60_000 };

		const first = await service.claim(request(), policy);
		await service.complete(first.record.id as string, { responseStatus: 201 });

		at('2026-03-01T10:02:00Z');

		expect((await service.claim(request(), policy)).outcome).toBe(IdempotencyOutcome.CLAIMED);
		expect(table.deletes[0]).toEqual({ id: first.record.id, expiresAt: { $lt: new Date('2026-03-01T10:02:00Z') } });
		expect(table.rows).toHaveLength(1);
	});
});
