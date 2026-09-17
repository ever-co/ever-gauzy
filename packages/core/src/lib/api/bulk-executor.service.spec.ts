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

/** The status a rejected batch answered with, so the statuses the contract fixes are asserted too. */
const statusOf = async (promise: Promise<unknown>): Promise<number> => {
	try {
		await promise;

		return 0;
	} catch (error) {
		return (error as ApiException).getStatus();
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
