import { Injectable } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { EntityManager } from 'typeorm';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { FieldVisibility } from './field-visibility.service';
import {
	BULK_ITEM_CAP,
	BulkFailure,
	BulkItemRequest,
	BulkItemResult,
	BulkMode,
	BulkOperationKind,
	BulkRequest,
	BulkResult,
	DEFAULT_BULK_MODE,
	IBulkLimits,
	assembleBulkResult,
	bulkEnvelopeCode,
	bulkResponseStatus,
	inspectBulkItems,
	inspectBulkRequest,
	operationOf
} from './bulk';

/**
 * What one item is applied with.
 */
export interface IBulkItemContext {
	/** The item's position in the request; the outcome refers to it by this index. */
	readonly index: number;
	/** What the item asked for, with the batch's default already applied. */
	readonly op: BulkOperationKind;
	/** How an addressed row is written. */
	readonly mode: BulkMode;
	/**
	 * True when the request asked for a dry run.
	 *
	 * A dry run executes no transaction and writes nothing, so the handler must validate and price
	 * the item and stop there. It is told rather than guessed at because only the resource knows
	 * what "priced but not written" means for its own rows.
	 */
	readonly dryRun: boolean;
	/** True when the item is applied inside the batch-wide transaction. */
	readonly atomic: boolean;
	/** The item's transactional manager, when the route supplied a transactional runner. */
	readonly manager?: EntityManager;
}

/**
 * Applies one item and reports what it changed.
 *
 * It receives exactly the item the caller sent plus the resolved context, so the handler is a thin
 * adapter onto the same service method the single-item route uses — which is what makes a batch
 * produce the same codes, the same events and the same authorisation answer as the items would one
 * by one.
 */
export type BulkItemHandler<T> = (item: BulkItemRequest<T>, context: IBulkItemContext) => Promise<BulkItemResult | void>;

/**
 * Runs work inside one transaction and hands it the manager to write through.
 *
 * It is supplied by the route because only the route knows its resource's ORM path: the platform
 * runs dual ORM, so a generic executor cannot open the right transaction by itself. A route that
 * supplies none gets per-item application with whatever atomicity its own service methods provide.
 */
export type IBulkTransactionRunner = <R>(work: (manager: EntityManager) => Promise<R>) => Promise<R>;

/**
 * What a route declares about its batch.
 */
export interface IBulkExecutionOptions {
	/** The resource that changes, as the result and the errors name it: `variant`. */
	readonly resource: string;
	/**
	 * The single permission the whole request is authorised against.
	 *
	 * It is evaluated once, before item 0, because a batch is one request and not a sequence of
	 * them: a caller either holds the permission for the operation or does not, and evaluating it
	 * per item would make an 8-item batch eight authorisation decisions with eight answers.
	 */
	readonly permission?: PermissionsEnum;
	/** The largest batch this resource accepts; defaults to the platform cap. */
	readonly cap?: number;
	/** The keys an item of a given op must carry, beyond the platform defaults. */
	readonly requiredKeys?: IBulkLimits['requiredKeys'];
	/** The transactional runner the resource's writes go through. */
	readonly transaction?: IBulkTransactionRunner;
}

/**
 * Applies a batch and reports one outcome per item.
 *
 * The executor owns the order of the four things a batch has to get right:
 *
 * 1. **Authorisation**, once, before the first item.
 * 2. **The shape of the request and of every item**, before any write, so a batch that cannot be
 *    read is never half-applied and an atomic batch never rolls back over an item that was never
 *    attempted.
 * 3. **Application**, one transaction per item by default, one for the whole batch when the request
 *    asks for it and the route can provide it.
 * 4. **The result**, whose counters are derived from the outcomes rather than accumulated beside
 *    them.
 *
 * It returns the result body for a batch in which at least one item applied, and throws for the
 * cases whose HTTP status is not `200`: an unreadable request, an over-large batch, an atomic batch
 * that was refused, and a batch in which nothing applied. The thrown exception carries the complete
 * `failed[]` in `details.items`, so a client renders per-item reasons whichever way the batch ended.
 */
@Injectable()
export class BulkExecutor {
	constructor(private readonly visibility: FieldVisibility) {}

	/**
	 * Runs a batch.
	 *
	 * @param request The request body.
	 * @param handler Applies one item.
	 * @param options What the route declares.
	 * @returns The result body: what applied, what did not, and the counters derived from both.
	 * @throws ApiException `403` when the caller does not hold the route's permission, `400` when the
	 * request or an item cannot be read, `413` above the cap, `409` for a refused atomic batch, and
	 * `422` when no item applied. `500` when an atomic batch was requested without a transactional
	 * runner, because the guarantee the caller asked for cannot be provided.
	 */
	public async execute<T>(
		request: BulkRequest<T>,
		handler: BulkItemHandler<T>,
		options: IBulkExecutionOptions
	): Promise<BulkResult<T>> {
		const atomic = request?.atomic === true;
		const dryRun = request?.dryRun === true;
		const mode = request?.mode ?? DEFAULT_BULK_MODE;
		const limits: IBulkLimits = { cap: options.cap ?? BULK_ITEM_CAP, requiredKeys: options.requiredKeys };

		// One decision for the whole request, before item 0.
		if (options.permission) {
			this.visibility.assertCanSee(options.permission, { resource: options.resource, mode: 'write' });
		}

		const defect = inspectBulkRequest(request, limits);

		if (defect) {
			throw new ApiException(defect.status, defect.code, defect.message, defect.details);
		}

		const total = request.items.length;
		const failed: BulkFailure[] = [...inspectBulkItems(request, limits)];
		const succeeded: BulkItemResult[] = [];
		const malformed = new Set(failed.map((failure) => failure.index));

		if (atomic && failed.length > 0) {
			// Nothing has been written and nothing will be: the malformed items are the whole answer.
			const refused = assembleBulkResult<T>({ total, succeeded, failed, dryRun });

			throw new ApiException(
				bulkResponseStatus(refused, true),
				bulkEnvelopeCode(refused, true),
				`The batch was refused: ${failed.length} of ${total} items could not be read.`,
				{ items: refused.failed, total, dryRun }
			);
		}

		if (atomic && !dryRun && !options.transaction) {
			// Refusing is the honest answer: the caller asked for all-or-nothing and this route cannot
			// provide it. Applying the batch item by item while answering as though it were atomic would
			// be a guarantee the platform does not keep.
			throw new ApiException(
				500,
				ApiErrorCode.INTERNAL_ERROR,
				'An atomic batch requires a transactional runner, and this route supplied none.',
				{ resource: options.resource }
			);
		}

		const pending = request.items
			.map((item, index) => ({ item, index }))
			.filter((entry) => !malformed.has(entry.index));

		const apply = async (item: BulkItemRequest<T>, index: number, manager?: EntityManager): Promise<void> => {
			const context: IBulkItemContext = { index, op: operationOf(item), mode, dryRun, atomic, manager };

			try {
				// A handler may return nothing — an item whose only outcome is "it applied" — so the
				// result is read defensively rather than assumed.
				const outcome = (await handler(item, context)) as BulkItemResult | undefined;

				succeeded.push({ index, id: outcome?.id, resource: outcome?.resource ?? options.resource });
			} catch (error) {
				failed.push(toBulkFailure(error, index, item));
			}
		};

		if (dryRun) {
			// A dry run opens no transaction and hands no manager: the handler validates and prices, and
			// an item that cannot be priced fails exactly as it would have.
			for (const entry of pending) {
				await apply(entry.item, entry.index);
			}
		} else if (atomic) {
			await this.runAtomic(options, failed, pending, apply);
		} else {
			for (const entry of pending) {
				await this.runOne(options, entry.item, entry.index, apply);
			}
		}

		const result = assembleBulkResult<T>({ total, succeeded, failed, dryRun });
		const status = bulkResponseStatus(result, atomic);

		if (status !== 200) {
			throw new ApiException(
				status,
				bulkEnvelopeCode(result, atomic),
				atomic
					? `The batch was refused: ${result.failedCount} of ${total} items could not be applied, so none was.`
					: `No item of the batch could be applied: ${result.failedCount} of ${total} failed.`,
				{
					items: result.failed,
					succeeded: result.succeeded,
					succeededCount: result.succeededCount,
					failedCount: result.failedCount,
					total,
					dryRun
				}
			);
		}

		return result;
	}

	/**
	 * Applies every item inside one transaction, or none of them.
	 *
	 * Each item's failure is caught so the report is complete, and the transaction is then rolled
	 * back deliberately: a batch that cannot be applied whole must not be applied partly, and the
	 * caller has to be told which item refused it rather than being handed a rolled-back transaction
	 * with one error in it.
	 *
	 * @param options What the route declares.
	 * @param failed The failures collected so far, appended to by the items.
	 * @param pending The items to apply.
	 * @param apply Applies one item.
	 */
	private async runAtomic<T>(
		options: IBulkExecutionOptions,
		failed: BulkFailure[],
		pending: readonly { item: BulkItemRequest<T>; index: number }[],
		apply: (item: BulkItemRequest<T>, index: number, manager?: EntityManager) => Promise<void>
	): Promise<void> {
		try {
			await options.transaction!(async (manager) => {
				for (const entry of pending) {
					await apply(entry.item, entry.index, manager);
				}

				if (failed.length > 0) {
					throw new BulkRollbackSignal();
				}
			});
		} catch (error) {
			if (!(error instanceof BulkRollbackSignal)) {
				throw error;
			}
		}
	}

	/**
	 * Applies one item in its own transaction, so a failing item never rolls back a succeeding one.
	 *
	 * @param options What the route declares.
	 * @param item The item.
	 * @param index The item's position.
	 * @param apply Applies the item.
	 */
	private async runOne<T>(
		options: IBulkExecutionOptions,
		item: BulkItemRequest<T>,
		index: number,
		apply: (item: BulkItemRequest<T>, index: number, manager?: EntityManager) => Promise<void>
	): Promise<void> {
		if (!options.transaction) {
			await apply(item, index);

			return;
		}

		await options.transaction(async (manager) => {
			await apply(item, index, manager);
		});
	}
}

/**
 * Rolls an atomic batch back once every item has been attempted.
 *
 * It never escapes the executor: it is the signal that turns "some items failed" into "the
 * transaction must not commit", while the failures themselves travel in the result.
 */
class BulkRollbackSignal extends Error {}

/**
 * Turns a caught error into the item's failure.
 *
 * An item that throws an `ApiException` reports exactly the code, message and details the same item
 * would have produced as an individual request, because a client's handling of an item must not
 * depend on whether it arrived alone or in a batch. Anything else is an internal defect, and the
 * outcome says so **without** reproducing the error's text: an item failure travels inside a `200`
 * body, so the platform's error path — which redacts driver messages — would never see it, and the
 * one place that must not leak a query or a connection string is a success response.
 *
 * @param error The caught error.
 * @param index The item's position.
 * @param item The item.
 * @returns The failure, ready to be reported beside the items that applied.
 */
function toBulkFailure(error: unknown, index: number, item: BulkItemRequest<unknown>): BulkFailure {
	const declaredId = (item as { id?: unknown })?.id;
	const id = typeof declaredId === 'string' ? declaredId : undefined;

	if (error instanceof ApiException) {
		return { index, id, code: error.code, message: error.message, details: error.details };
	}

	return {
		index,
		id,
		code: ApiErrorCode.INTERNAL_ERROR,
		message: `Item ${index} could not be applied.`
	};
}
