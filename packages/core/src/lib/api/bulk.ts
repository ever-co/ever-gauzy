import type { ApiErrorCode } from '../core/errors/api-error-codes';

/**
 * The bulk contract: one request, one outcome per item.
 *
 * A large edit — a catalogue import, a price refresh, a stock reconciliation — is one request whose
 * result names every item it could not apply, instead of a partial outcome nobody can reconstruct.
 * The contract is platform-wide: any resource may declare a bulk route, and the request, the result
 * and the partial-success semantics are the same everywhere.
 *
 * This module holds the shapes and the decisions that can be taken without a database, so the
 * assembly of a result is a plain function: the same batch always produces the same counters, the
 * same order and the same envelope code, and the executor around it only supplies what each item
 * did.
 */

/**
 * What one item does.
 *
 * `upsert` is the default because a batch that carries a natural key usually does not care whether
 * the row existed; `create` and `update` are for the cases where it does, and `delete` removes the
 * row the item addresses.
 */
export type BulkOperationKind = 'create' | 'update' | 'delete' | 'upsert';

/**
 * How an item addresses the row it applies to.
 *
 * `upsert` merges into the row the natural key names; `replace` overwrites it and is only offered
 * where the resource has such a key.
 */
export type BulkMode = 'upsert' | 'replace';

/**
 * One item of a batch.
 *
 * The item is the resource's own shape with one property the platform adds: `op`. Nothing else is
 * read by the executor, so a batch carries exactly the fields the equivalent single-item request
 * would carry, and a caller that has its rows in a typed array passes them as they are.
 */
export type BulkItemRequest<T> = T & { readonly op?: BulkOperationKind };

/**
 * A batch, as the request body carries it.
 */
export interface BulkRequest<T> {
	/** How the addressed row is written when it already exists; defaults to `upsert`. */
	readonly mode?: BulkMode;
	/** `true` applies the batch in one transaction, `false` (the default) one per item. */
	readonly atomic?: boolean;
	/** `true` validates and prices the batch and writes nothing. */
	readonly dryRun?: boolean;
	/** The items, in caller order; the result refers to them by index. */
	readonly items: readonly BulkItemRequest<T>[];
}

/**
 * One item that applied.
 */
export interface BulkItemResult {
	/** The item's position in the request. */
	readonly index: number;
	/** Id of the row it created or changed, when the resource has one. */
	readonly id?: string;
	/** The resource that changed, so a mixed batch reads unambiguously. */
	readonly resource?: string;
}

/**
 * One item that did not apply, and why.
 */
export interface BulkFailure {
	/** The item's position in the request. */
	readonly index: number;
	/** Id of the row it addressed, when the item carried one. */
	readonly id?: string;
	/** The code the same item would have produced as an individual request. */
	readonly code: ApiErrorCode;
	/** Human-facing message; the code is what a client branches on. */
	readonly message: string;
	/** Free-form detail, documented per code. */
	readonly details?: Record<string, unknown>;
}

/**
 * The outcome of a batch: what applied, what did not, and the counters derived from both.
 */
export interface BulkResult<T> {
	/** True when nothing was written because the request asked for a dry run. */
	readonly dryRun: boolean;
	/** How many items applied. Derived from `succeeded`. */
	readonly succeededCount: number;
	/** How many items did not apply. Derived from `failed`. */
	readonly failedCount: number;
	/** How many items the request carried. */
	readonly total: number;
	/** The items that applied, in request order. */
	readonly succeeded: readonly BulkItemResult[];
	/** The items that did not, in request order. */
	readonly failed: readonly BulkFailure[];
}

/** The largest batch the platform accepts unless a resource declares a smaller one. */
export const BULK_ITEM_CAP = 500;

/** The op an item that declares none is treated as. */
export const DEFAULT_BULK_OPERATION: BulkOperationKind = 'upsert';

/** The write mode a request that declares none is treated as. */
export const DEFAULT_BULK_MODE: BulkMode = 'upsert';

/** Every legal op, for validation messages and for callers that enumerate them. */
export const BULK_OPERATION_KINDS: readonly BulkOperationKind[] = ['create', 'update', 'delete', 'upsert'];

/** Every legal mode. */
export const BULK_MODES: readonly BulkMode[] = ['upsert', 'replace'];

/**
 * The codes this module raises.
 *
 * They are literals rather than catalogue lookups because this module is deliberately free of
 * imports: it is the part of the bulk path that is compiled and executed on its own, which is what
 * makes the assembly of a result provable without a database. Each is typed as an `ApiErrorCode`,
 * so the catalogue stays the source of truth — a code renamed or removed there fails the build here
 * rather than a request in production.
 */
const VALIDATION_FAILED: ApiErrorCode = 'VALIDATION_FAILED';
const VALIDATION_REQUIRED_FIELD: ApiErrorCode = 'VALIDATION_REQUIRED_FIELD';
const VALIDATION_INVALID_ENUM: ApiErrorCode = 'VALIDATION_INVALID_ENUM';
const BULK_LIMIT_EXCEEDED: ApiErrorCode = 'BULK_LIMIT_EXCEEDED';
const BULK_ALL_ITEMS_FAILED: ApiErrorCode = 'BULK_ALL_ITEMS_FAILED';
const INTERNAL_ERROR: ApiErrorCode = 'INTERNAL_ERROR';

/** The statuses a batch answers with, named here for the same reason as the codes above. */
const STATUS_BAD_REQUEST = 400;
const STATUS_CONFLICT = 409;
const STATUS_TOO_LARGE = 413;
const STATUS_UNPROCESSABLE = 422;
const STATUS_OK = 200;

/**
 * A defect that refuses the whole request before a single item is looked at.
 */
export interface BulkRequestDefect {
	/** The status the platform answers with. */
	readonly status: number;
	/** The code the envelope carries. */
	readonly code: ApiErrorCode;
	/** Human-facing message. */
	readonly message: string;
	/** Free-form detail; always names the limit or the field at fault. */
	readonly details?: Record<string, unknown>;
}

/**
 * What a resource declares about its batches.
 */
export interface IBulkLimits {
	/** The largest batch accepted; defaults to {@link BULK_ITEM_CAP}. */
	readonly cap?: number;
	/**
	 * The keys an item of a given op must carry.
	 *
	 * The default is what every resource has in common: an `update` or a `delete` addresses a row, so
	 * it must name one. A resource whose items are addressed by a natural key declares the rest.
	 */
	readonly requiredKeys?: readonly string[] | ((op: BulkOperationKind) => readonly string[]);
}

/**
 * The op an item is treated as.
 *
 * @param item The item.
 * @returns The declared op, or the default when it declares none.
 */
export function operationOf(item: BulkItemRequest<unknown>): BulkOperationKind {
	const declared = item?.op;

	return isBulkOperationKind(declared) ? declared : DEFAULT_BULK_OPERATION;
}

/**
 * Whether a value is a legal op.
 *
 * @param value The value.
 * @returns True when it is one of `create`, `update`, `delete` or `upsert`.
 */
export function isBulkOperationKind(value: unknown): value is BulkOperationKind {
	return typeof value === 'string' && (BULK_OPERATION_KINDS as readonly string[]).includes(value);
}

/**
 * Whether a value is a legal write mode.
 *
 * @param value The value.
 * @returns True when it is `upsert` or `replace`.
 */
export function isBulkMode(value: unknown): value is BulkMode {
	return typeof value === 'string' && (BULK_MODES as readonly string[]).includes(value);
}

/**
 * The defect that refuses a request as a whole, if there is one.
 *
 * It covers what is wrong with the batch rather than with an item: no `items` array, an empty one,
 * more items than the resource accepts, an unknown mode. A well-formed batch returns `undefined`
 * here and is then inspected item by item, so a malformed item is reported as that item's failure
 * and never as a request that cannot be read.
 *
 * @param request The request body.
 * @param limits What the resource declares; defaults to the platform cap.
 * @returns The defect, or undefined when the batch may be inspected item by item.
 */
export function inspectBulkRequest(
	request: BulkRequest<unknown>,
	limits: IBulkLimits = {}
): BulkRequestDefect | undefined {
	const cap = limits.cap ?? BULK_ITEM_CAP;

	if (!request || typeof request !== 'object') {
		return {
			status: STATUS_BAD_REQUEST,
			code: VALIDATION_FAILED,
			message: 'A bulk request must be an object carrying an "items" array.'
		};
	}

	if (!Array.isArray(request.items)) {
		return {
			status: STATUS_BAD_REQUEST,
			code: VALIDATION_REQUIRED_FIELD,
			message: 'A bulk request must carry an "items" array.',
			details: { field: 'items' }
		};
	}

	if (request.items.length === 0) {
		return {
			status: STATUS_BAD_REQUEST,
			code: VALIDATION_REQUIRED_FIELD,
			message: 'A bulk request must carry at least one item.',
			details: { field: 'items', min: 1, actual: 0 }
		};
	}

	if (request.items.length > cap) {
		return {
			status: STATUS_TOO_LARGE,
			code: BULK_LIMIT_EXCEEDED,
			message: `A bulk request carries at most ${cap} items; this one carries ${request.items.length}.`,
			details: { limit: cap, actual: request.items.length }
		};
	}

	if (request.mode !== undefined && !isBulkMode(request.mode)) {
		return {
			status: STATUS_BAD_REQUEST,
			code: VALIDATION_INVALID_ENUM,
			message: `"${String(request.mode)}" is not a bulk mode.`,
			details: { field: 'mode', allowed: [...BULK_MODES] }
		};
	}

	if (request.atomic !== undefined && typeof request.atomic !== 'boolean') {
		return {
			status: STATUS_BAD_REQUEST,
			code: VALIDATION_FAILED,
			message: '"atomic" must be a boolean.',
			details: { field: 'atomic' }
		};
	}

	if (request.dryRun !== undefined && typeof request.dryRun !== 'boolean') {
		return {
			status: STATUS_BAD_REQUEST,
			code: VALIDATION_FAILED,
			message: '"dryRun" must be a boolean.',
			details: { field: 'dryRun' }
		};
	}

	return undefined;
}

/**
 * The items whose shape is wrong, found before any item is applied.
 *
 * The pre-pass is what makes an atomic batch honest: by the time the transaction opens, every item
 * that cannot be read at all is already known, so a rollback never hides an item that was never
 * attempted. A malformed item is reported exactly as a failed one, with its index, so a client
 * renders it beside the items that did apply.
 *
 * @param request The request body.
 * @param limits What the resource declares.
 * @returns One failure per malformed item, in request order.
 */
export function inspectBulkItems(
	request: BulkRequest<unknown>,
	limits: IBulkLimits = {}
): readonly BulkFailure[] {
	const failures: BulkFailure[] = [];
	const items = Array.isArray(request?.items) ? request.items : [];

	items.forEach((item, index) => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			failures.push({
				index,
				code: VALIDATION_FAILED,
				message: `Item ${index} is not an object.`
			});
			return;
		}

		const declared = (item as { op?: unknown }).op;

		if (declared !== undefined && !isBulkOperationKind(declared)) {
			failures.push({
				index,
				code: VALIDATION_INVALID_ENUM,
				message: `Item ${index} declares an unknown operation "${String(declared)}".`,
				details: { field: 'op', allowed: [...BULK_OPERATION_KINDS] }
			});
			return;
		}

		const op = operationOf(item);
		const missing = requiredKeysFor(op, limits).find((key) => !hasValue(item, key));

		if (missing) {
			failures.push({
				index,
				id: readItemId(item),
				code: VALIDATION_REQUIRED_FIELD,
				message: `Item ${index} does not carry "${missing}", which "${op}" requires.`,
				details: { field: missing }
			});
		}
	});

	return failures;
}

/**
 * The keys an item of a given op must carry.
 *
 * @param op The op.
 * @param limits What the resource declares.
 * @returns The required keys, empty when the op needs none.
 */
export function requiredKeysFor(op: BulkOperationKind, limits: IBulkLimits = {}): readonly string[] {
	const declared = limits.requiredKeys;

	if (typeof declared === 'function') {
		return declared(op) ?? [];
	}

	if (Array.isArray(declared)) {
		return declared;
	}

	// Every resource has this much in common: an update or a delete addresses a row, so it names one.
	return op === 'update' || op === 'delete' ? ['id'] : [];
}

/**
 * What the executor collected while it ran the batch.
 */
export interface IBulkResultParts {
	/** How many items the request carried. */
	readonly total: number;
	/** The items that applied. */
	readonly succeeded: readonly BulkItemResult[];
	/** The items that did not. */
	readonly failed: readonly BulkFailure[];
	/** True when nothing was written. */
	readonly dryRun?: boolean;
}

/**
 * Builds the response body from what happened.
 *
 * The counters are **derived** from the two lists rather than accumulated alongside them, so
 * `succeededCount + failedCount === total` holds by construction and a client can assert it. Both
 * lists are ordered by item index, so two runs of the same batch produce the same body whatever
 * order the writes completed in.
 *
 * @param parts What the executor collected.
 * @returns The result body.
 */
export function assembleBulkResult<T>(parts: IBulkResultParts): BulkResult<T> {
	const succeeded = [...(parts.succeeded ?? [])].sort((left, right) => left.index - right.index);
	const failed = [...(parts.failed ?? [])].sort((left, right) => left.index - right.index);

	return {
		dryRun: parts.dryRun ?? false,
		succeededCount: succeeded.length,
		failedCount: failed.length,
		total: parts.total,
		succeeded,
		failed
	};
}

/**
 * The status a finished batch answers with.
 *
 * A batch in which something applied is a success with a report attached — `200` — because the
 * caller's next step is to look at `failed[]`, not to retry the request. `422` says nothing at all
 * applied, and an atomic batch that failed answers `409` because the request was refused rather
 * than partially satisfied.
 *
 * @param result The result body.
 * @param atomic Whether the batch was applied in one transaction.
 * @returns The HTTP status.
 */
export function bulkResponseStatus(result: BulkResult<unknown>, atomic: boolean): number {
	if (result.failedCount === 0) {
		return STATUS_OK;
	}

	if (atomic) {
		return STATUS_CONFLICT;
	}

	return result.succeededCount === 0 ? STATUS_UNPROCESSABLE : STATUS_OK;
}

/**
 * The code the error envelope carries when a batch did not answer `200`.
 *
 * An atomic batch reports the **first** failing item's code, because that is the failure that
 * refused the whole request; a batch in which nothing applied reports `BULK_ALL_ITEMS_FAILED`, with
 * the complete `failed[]` beside it in `details.items` so the client can still render per-item
 * reasons. Both cases keep the item-level detail: the envelope's code says what to do next, and
 * `details.items` says which item caused it.
 *
 * @param result The result body.
 * @param atomic Whether the batch was applied in one transaction.
 * @returns The code.
 */
export function bulkEnvelopeCode(result: BulkResult<unknown>, atomic: boolean): ApiErrorCode {
	if (!atomic) {
		return BULK_ALL_ITEMS_FAILED;
	}

	return result.failed[0]?.code ?? BULK_ALL_ITEMS_FAILED;
}

/**
 * One entry of a batch, in the shape a GraphQL payload carries it.
 */
export interface BulkItemOutcome {
	/** The item's position in the request. */
	readonly index: number;
	/** True when the item applied. */
	readonly ok: boolean;
	/** Id of the row that changed, when the item applied. */
	readonly id?: string;
	/** The resource that changed, when the item applied. */
	readonly resource?: string;
	/** Why the item did not apply, with the item's own code. */
	readonly error?: { readonly code: ApiErrorCode; readonly message: string; readonly details?: Record<string, unknown> };
}

/**
 * The per-item view of a result, one entry per request item, in request order.
 *
 * It exists because the two surfaces must not be able to disagree: the REST body splits an outcome
 * into `succeeded[]` and `failed[]`, while a GraphQL payload carries one entry per input item with
 * either the resource or the item's error. Both are projections of the same result through this
 * function, so the derived counters and the per-item codes are the same numbers on both surfaces.
 *
 * An index the executor never reported — which would be a defect in the executor — is filled with
 * an `INTERNAL_ERROR` entry rather than dropped, because a payload that silently carries fewer
 * entries than the request had items is worse than one that says so.
 *
 * @param result The result body.
 * @returns One outcome per item, in request order.
 */
export function toBulkItemOutcomes<T>(result: BulkResult<T>): readonly BulkItemOutcome[] {
	const outcomes: BulkItemOutcome[] = [];

	for (let index = 0; index < result.total; index += 1) {
		const applied = result.succeeded.find((entry) => entry.index === index);

		if (applied) {
			outcomes.push({ index, ok: true, id: applied.id, resource: applied.resource });
			continue;
		}

		const failure = result.failed.find((entry) => entry.index === index);

		outcomes.push(
			failure
				? {
						index,
						ok: false,
						id: failure.id,
						error: { code: failure.code, message: failure.message, details: failure.details }
					}
				: {
						index,
						ok: false,
						error: {
							code: INTERNAL_ERROR,
							message: `No outcome was recorded for item ${index}.`
						}
					}
		);
	}

	return outcomes;
}

/**
 * Whether an item supplies a key.
 *
 * @param item The item.
 * @param key The key name.
 * @returns True when a value was supplied.
 */
function hasValue(item: BulkItemRequest<unknown>, key: string): boolean {
	const value = (item as Record<string, unknown>)[key];

	return key in item && value !== undefined && value !== null;
}

/**
 * The row id an item addresses, when it carries one.
 *
 * @param item The item.
 * @returns The id, or undefined.
 */
function readItemId(item: BulkItemRequest<unknown>): string | undefined {
	const id = (item as { id?: unknown }).id;

	return typeof id === 'string' ? id : undefined;
}
