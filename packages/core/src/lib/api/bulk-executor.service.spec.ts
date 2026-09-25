import { PermissionsEnum } from '@gauzy/contracts';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { BulkExecutor, IBulkExecutionOptions } from './bulk-executor.service';
import { BulkItemRequest, BulkRequest, BulkResult, toBulkItemOutcomes } from './bulk';
import { FieldVisibility } from './field-visibility.service';

/** The fixture item: the conventions do not depend on which resource declares them. */
interface Line {
	op?: 'create' | 'update' | 'delete' | 'upsert';
	id?: string;
	sku?: string;
	price?: string;
}

const visibilityFor = (granted: PermissionsEnum[]): FieldVisibility =>
	({
		canSee: (permission: PermissionsEnum) => granted.includes(permission),
		assertCanSee: (permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		}
	}) as unknown as FieldVisibility;

/**
 * A transactional runner that behaves like one: work that throws commits nothing.
 *
 * It is what makes the atomic cases assertable without a database — the writes an item performed are
 * visible only when the work it ran inside returned.
 */
const transactional = (writes: string[]) => {
	const commits: string[][] = [];

	const runner = async <R>(work: (manager: any) => Promise<R>): Promise<R> => {
		const before = [...writes];

		try {
			const result = await work(undefined);

			commits.push([...writes]);

			return result;
		} catch (error) {
			writes.splice(0, writes.length, ...before);

			throw error;
		}
	};

	return { runner, commits };
};

const valid: Line[] = Array.from({ length: 8 }, (_unused, index) => ({
	op: 'create' as const,
	sku: `SKU-${index}`,
	price: '10.000000'
}));

/**
 * The HTTP view of a thrown error: the accessor every `HttpException` carries.
 *
 * It is described here so the assertion reads the status the response really has, without the spec
 * depending on how the exception's base class is spelled.
 */
interface IHttpFailure {
	getStatus?(): number;
}

/** The status a rejected batch answered with, so the statuses the contract fixes are asserted too. */
const statusOf = async (promise: Promise<unknown>): Promise<number | undefined> => {
	try {
		await promise;

		return undefined;
	} catch (error) {
		return (error as IHttpFailure).getStatus?.();
	}
};

describe('BulkExecutor', () => {
	it('reports one outcome per item for a batch of eight valid and two invalid items', async () => {
		const writes: string[] = [];
		const { runner } = transactional(writes);
		const executor = new BulkExecutor(visibilityFor([]));

		const request: BulkRequest<Line> = {
			items: [...valid, { op: 'merge' } as unknown as Line, { op: 'update' } as Line]
		};

		const result = await executor.execute<Line>(
			request,
			async (item: BulkItemRequest<Line>, context) => {
				writes.push(String(item.sku));

				return { index: context.index, id: `id-${context.index}`, resource: 'line' };
			},
			{ resource: 'line', transaction: runner }
		);

		expect(result.succeededCount).toBe(8);
		expect(result.failedCount).toBe(2);
		expect(result.total).toBe(10);
		expect(result.succeededCount + result.failedCount).toBe(result.total);
		expect(writes).toHaveLength(8);
		expect(result.failed.map((failure) => failure.index)).toEqual([8, 9]);
		expect(result.failed[0]).toMatchObject({ code: 'VALIDATION_INVALID_ENUM', details: { field: 'op' } });
		expect(result.failed[1]).toMatchObject({ code: 'VALIDATION_REQUIRED_FIELD', details: { field: 'id' } });
	});

	it('answers 422 BULK_ALL_ITEMS_FAILED when no item applied', async () => {
		const writes: string[] = [];
		const { runner } = transactional(writes);
		const executor = new BulkExecutor(visibilityFor([]));

		const promise = executor.execute<Line>(
			{ items: [{ op: 'create', sku: 'A' }, { op: 'create', sku: 'B' }] },
			async () => {
				throw new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'Duplicate.', { field: 'sku' });
			},
			{ resource: 'line', transaction: runner }
		);

		await expect(promise).rejects.toMatchObject({
			code: ApiErrorCode.BULK_ALL_ITEMS_FAILED,
			details: { total: 2, failedCount: 2 }
		});
	});

	it('refuses a batch above the cap with 413 and the limit in details', async () => {
		const executor = new BulkExecutor(visibilityFor([]));
		const items = Array.from({ length: 501 }, () => ({ op: 'create' as const, sku: 'SKU' }));

		const promise = executor.execute<Line>({ items }, async () => undefined, { resource: 'line' });

		await expect(promise).rejects.toMatchObject({
			code: ApiErrorCode.BULK_LIMIT_EXCEEDED,
			details: { limit: 500, actual: 501 }
		});
		expect(await statusOf(promise)).toBe(413);
	});

	it('rolls an atomic batch back when one item fails, and reports every outcome', async () => {
		const writes: string[] = [];
		const { runner, commits } = transactional(writes);
		const executor = new BulkExecutor(visibilityFor([]));

		const promise = executor.execute<Line>(
			{ atomic: true, items: [{ op: 'create', sku: 'A' }, { op: 'create', sku: 'B' }] },
			async (item) => {
				if (item.sku === 'B') {
					throw new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'Duplicate SKU.', { field: 'sku' });
				}

				writes.push(String(item.sku));

				return { index: 0, id: 'a', resource: 'line' };
			},
			{ resource: 'line', transaction: runner }
		);

		await expect(promise).rejects.toMatchObject({
			code: ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
			details: { failedCount: 1, total: 2 }
		});
		expect(await statusOf(promise)).toBe(409);

		// Nothing is committed and nothing survives the rollback: an atomic batch is all or nothing.
		expect(commits).toHaveLength(0);
		expect(writes).toEqual([]);
	});

	/**
	 * A TypeORM-shaped transactional manager: `query` runs on the transaction's own query runner, and
	 * `queryRunner.isTransactionActive` says the transaction is open. It records every statement, and
	 * behaves like PostgreSQL on the one point the savepoints exist for: after a statement fails, every
	 * later statement is refused with `25P02` until the transaction is rolled back to a savepoint.
	 */
	const postgresLikeManager = () => {
		const statements: string[] = [];
		let aborted = false;
		const refuse = () => {
			throw new Error('current transaction is aborted, commands ignored until end of transaction block');
		};

		const manager = {
			queryRunner: { isTransactionActive: true },
			statements,
			query: async (sql: string) => {
				statements.push(sql);

				if (/^ROLLBACK TO SAVEPOINT /.test(sql)) {
					aborted = false;

					return;
				}

				if (aborted) {
					refuse();
				}
			},
			/** A write the handler performs; `fails` makes it the statement that aborts the transaction. */
			write: async (fails = false) => {
				if (aborted) {
					refuse();
				}

				if (fails) {
					aborted = true;

					throw new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'Duplicate SKU.', { field: 'sku' });
				}
			}
		};

		const runner = async <R>(work: (candidate: any) => Promise<R>): Promise<R> => work(manager);

		return { manager, runner };
	};

	it('takes a savepoint per item of an atomic batch, and rolls back to it when the item fails', async () => {
		const { manager, runner } = postgresLikeManager();
		const executor = new BulkExecutor(visibilityFor([]));

		const promise = executor.execute<Line>(
			{
				atomic: true,
				items: [
					{ op: 'create', sku: 'A' },
					{ op: 'create', sku: 'B' },
					{ op: 'create', sku: 'C' }
				]
			},
			async (item, context) => {
				await (context.manager as unknown as typeof manager).write(item.sku === 'B');

				return { index: context.index, id: String(item.sku), resource: 'line' };
			},
			{ resource: 'line', transaction: runner }
		);

		await expect(promise).rejects.toMatchObject({ code: ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION });

		// The item that applied releases its savepoint; the item that failed rolls back to its own, so
		// the item after it is applied against a live transaction rather than an aborted one. The names
		// carry the item index and nothing a caller supplied.
		expect(manager.statements).toEqual([
			'SAVEPOINT gauzy_bulk_item_0',
			'RELEASE SAVEPOINT gauzy_bulk_item_0',
			'SAVEPOINT gauzy_bulk_item_1',
			'ROLLBACK TO SAVEPOINT gauzy_bulk_item_1',
			'SAVEPOINT gauzy_bulk_item_2',
			'RELEASE SAVEPOINT gauzy_bulk_item_2'
		]);
	});

	it('reports every item of an atomic batch by its own reason on PostgreSQL, not by the first failure', async () => {
		// Without the savepoint, the items after the duplicate would reach their writes on an aborted
		// transaction, fail on 25P02, and be reported as `INTERNAL_ERROR` — reasons the client cannot act on.
		const { manager, runner } = postgresLikeManager();
		const executor = new BulkExecutor(visibilityFor([]));

		const promise = executor.execute<Line>(
			{
				atomic: true,
				items: [
					{ op: 'create', sku: 'DUPLICATE' },
					{ op: 'create', sku: 'BAD-PRICE' },
					{ op: 'create', sku: 'NO-NAME' }
				]
			},
			async (item, context) => {
				await (context.manager as unknown as typeof manager).write(item.sku === 'DUPLICATE');

				if (item.sku === 'BAD-PRICE') {
					throw new ApiException(400, ApiErrorCode.VALIDATION_FAILED, 'The price is not a decimal.', {
						field: 'price'
					});
				}

				throw new ApiException(400, ApiErrorCode.VALIDATION_REQUIRED_FIELD, 'A name is required.', {
					field: 'name'
				});
			},
			{ resource: 'line', transaction: runner }
		);

		const failure = (await promise.catch((error) => error)) as ApiException;
		const items = (failure.details as { items: { index: number; code: ApiErrorCode }[] }).items;

		expect(items.map((item) => item.code)).toEqual([
			ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
			ApiErrorCode.VALIDATION_FAILED,
			ApiErrorCode.VALIDATION_REQUIRED_FIELD
		]);
	});

	it('takes the savepoint through a MikroORM manager’s transaction context, never through its bare connection', async () => {
		// `em.execute` hands the driver the fork's transaction context; `em.getConnection().execute` does
		// not, so a savepoint taken there would land on another pooled connection — or, on an embedded
		// database's single connection, wait for the one the transaction already holds.
		const executed: string[] = [];
		const outside: string[] = [];
		const manager = {
			isInTransaction: () => true,
			execute: async (sql: string, _params?: unknown[], method?: string) => void executed.push(`${method}:${sql}`),
			getConnection: () => ({ execute: async (sql: string) => void outside.push(sql) })
		};
		const runner = async <R>(work: (candidate: any) => Promise<R>): Promise<R> => work(manager);
		const executor = new BulkExecutor(visibilityFor([]));

		const result = await executor.execute<Line>(
			{ atomic: true, items: [{ op: 'create', sku: 'A' }] },
			async (item, context) => ({ index: context.index, id: String(item.sku), resource: 'line' }),
			{ resource: 'line', transaction: runner }
		);

		expect(result.succeededCount).toBe(1);
		expect(executed).toEqual(['run:SAVEPOINT gauzy_bulk_item_0', 'run:RELEASE SAVEPOINT gauzy_bulk_item_0']);
		expect(outside).toEqual([]);
	});

	it('takes no savepoint through a manager that is not in a transaction, or that cannot say so', async () => {
		// A savepoint outside a transaction is an error on PostgreSQL and a stray statement elsewhere, so a
		// manager whose query runner is not in a transaction — like a double with no runner at all — is
		// applied against directly, which is the behaviour the executor had before the savepoints.
		const statements: string[] = [];
		const manager = { queryRunner: { isTransactionActive: false }, query: async (sql: string) => void statements.push(sql) };
		const runner = async <R>(work: (candidate: any) => Promise<R>): Promise<R> => work(manager);
		const executor = new BulkExecutor(visibilityFor([]));

		const result = await executor.execute<Line>(
			{ atomic: true, items: [{ op: 'create', sku: 'A' }, { op: 'create', sku: 'B' }] },
			async (item, context) => ({ index: context.index, id: String(item.sku), resource: 'line' }),
			{ resource: 'line', transaction: runner }
		);

		expect(result.succeededCount).toBe(2);
		expect(statements).toEqual([]);
	});

	it('ends the batch rather than applying later items when a savepoint cannot be rolled back to', async () => {
		// MySQL rolls a whole transaction back on a deadlock, and every savepoint with it. An item applied
		// after that would be written outside any transaction, where the batch's rollback cannot reach it.
		const applied: string[] = [];
		const manager = {
			queryRunner: { isTransactionActive: true },
			query: async (sql: string) => {
				if (/^ROLLBACK TO SAVEPOINT /.test(sql)) {
					throw new Error('SAVEPOINT gauzy_bulk_item_0 does not exist');
				}
			}
		};
		const runner = async <R>(work: (candidate: any) => Promise<R>): Promise<R> => work(manager);
		const executor = new BulkExecutor(visibilityFor([]));

		const promise = executor.execute<Line>(
			{ atomic: true, items: [{ op: 'create', sku: 'DEADLOCKED' }, { op: 'create', sku: 'B' }] },
			async (item, context) => {
				if (item.sku === 'DEADLOCKED') {
					throw new Error('Deadlock found when trying to get lock; try restarting transaction');
				}

				applied.push(String(item.sku));

				return { index: context.index, id: String(item.sku), resource: 'line' };
			},
			{ resource: 'line', transaction: runner }
		);

		await expect(promise).rejects.toThrow('does not exist');
		expect(applied).toEqual([]);
	});

	it('refuses an atomic batch that the route cannot run transactionally', async () => {
		const executor = new BulkExecutor(visibilityFor([]));

		await expect(
			executor.execute<Line>({ atomic: true, items: [{ op: 'create', sku: 'A' }] }, async () => undefined, {
				resource: 'line'
			})
		).rejects.toMatchObject({ code: ApiErrorCode.INTERNAL_ERROR });
	});

	it('writes nothing on a dry run and tells the handler it is one', async () => {
		const contexts: { dryRun: boolean; manager: unknown }[] = [];
		const { runner, commits } = transactional([]);
		const executor = new BulkExecutor(visibilityFor([]));

		const result = await executor.execute<Line>(
			{ dryRun: true, items: [{ op: 'create', sku: 'A' }, { op: 'create', sku: 'B' }] },
			async (item, context) => {
				contexts.push({ dryRun: context.dryRun, manager: context.manager });

				return { index: context.index, id: `preview-${item.sku}`, resource: 'line' };
			},
			{ resource: 'line', transaction: runner }
		);

		expect(result.dryRun).toBe(true);
		expect(result.succeededCount).toBe(2);
		expect(contexts).toEqual([
			{ dryRun: true, manager: undefined },
			{ dryRun: true, manager: undefined }
		]);
		expect(commits).toHaveLength(0);
	});

	it('keeps an item that applied when a later item fails', async () => {
		const writes: string[] = [];
		const { runner } = transactional(writes);
		const executor = new BulkExecutor(visibilityFor([]));

		const result = await executor.execute<Line>(
			{ items: [{ op: 'create', sku: 'A' }, { op: 'create', sku: 'B' }] },
			async (item, context) => {
				if (item.sku === 'B') {
					throw new Error('driver said: relation "line" does not exist');
				}

				writes.push(String(item.sku));

				return { index: context.index, id: 'a', resource: 'line' };
			},
			{ resource: 'line', transaction: runner }
		);

		expect(result.succeededCount).toBe(1);
		expect(result.failedCount).toBe(1);
		expect(writes).toEqual(['A']);
		// A non-ApiException is an internal defect: the item says so without reproducing driver text,
		// which would otherwise bypass the platform's error redaction by riding inside a 200 body.
		expect(result.failed[0].code).toBe(ApiErrorCode.INTERNAL_ERROR);
		expect(result.failed[0].message).not.toContain('driver said');
	});

	it('rolls back what a failing item wrote before it failed, when each item has its own transaction', async () => {
		// The item's error is caught into the report, so a transaction whose work simply returned would
		// commit the half of the item that ran before the throw: a row the caller is told was not
		// written, and writes a second time when it retries the item.
		const writes: string[] = [];
		const { runner, commits } = transactional(writes);
		const executor = new BulkExecutor(visibilityFor([]));

		const result = await executor.execute<Line>(
			{ items: [{ op: 'create', sku: 'A' }, { op: 'create', sku: 'B' }] },
			async (item, context) => {
				writes.push(`${item.sku}:row`);

				if (item.sku === 'B') {
					throw new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'Duplicate translation.', {
						field: 'translations'
					});
				}

				writes.push(`${item.sku}:translations`);

				return { index: context.index, id: String(item.sku), resource: 'line' };
			},
			{ resource: 'line', transaction: runner }
		);

		expect(result.succeededCount).toBe(1);
		expect(result.failed).toEqual([
			expect.objectContaining({ index: 1, code: ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION })
		]);
		expect(writes).toEqual(['A:row', 'A:translations']);
		expect(commits).toHaveLength(1);
	});

	it('authorises the whole request once, before the first item', async () => {
		const seen: number[] = [];
		const executor = new BulkExecutor(visibilityFor([]));

		await expect(
			executor.execute<Line>(
				{ items: [{ op: 'create', sku: 'A' }, { op: 'create', sku: 'B' }] },
				async (_item, context) => {
					seen.push(context.index);
				},
				{ resource: 'line', permission: PermissionsEnum.INVOICES_EDIT }
			)
		).rejects.toMatchObject({ code: ApiErrorCode.PERMISSION_DENIED });

		expect(seen).toEqual([]);
	});

	it('produces the same per-item outcomes the GraphQL payload derives its counters from', async () => {
		const writes: string[] = [];
		const { runner } = transactional(writes);
		const executor = new BulkExecutor(visibilityFor([]));

		const result: BulkResult<Line> = await executor.execute<Line>(
			{ items: [{ op: 'create', sku: 'A' }, { op: 'update' }, { op: 'create', sku: 'C' }] },
			async (item, context) => ({ index: context.index, id: `id-${item.sku ?? 'x'}`, resource: 'line' }),
			{ resource: 'line', transaction: runner }
		);

		const outcomes = toBulkItemOutcomes(result);

		expect(outcomes).toHaveLength(3);
		expect(outcomes.map((outcome) => outcome.index)).toEqual([0, 1, 2]);
		expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, true]);
		expect(outcomes[1].error?.code).toBe(ApiErrorCode.VALIDATION_REQUIRED_FIELD);
	});
});
