import type { IOperation, IOperationError, IOperationStep, JsonData } from '@gauzy/contracts';
import { OperationStatus, OperationStepStatus } from '@gauzy/contracts';

/**
 * The async operation response convention.
 *
 * A write that cannot finish inside a request budget — completing a checkout, capturing a payment,
 * receiving a return, reindexing a search index — is **accepted** rather than performed: the request
 * answers `202` with a handle, and the caller polls or subscribes to the operation the handle names.
 * The operation itself is the platform's durable-operation runtime: the plan, the progress and the
 * undo information are rows (`operation`, `operation_step`) and the steps are registered handlers.
 * Nothing here re-implements any of it. What this module fixes is the **wire contract** every
 * initiating route and every caller agrees on:
 *
 * - a handler returns an {@link OperationRef}; the interceptor mounted by the convention turns it
 *   into a `202` with `Location` and `Retry-After`;
 * - the body is {@link AsyncAccepted}, and it repeats the location so a client that cannot read
 *   headers still works;
 * - the handle resolves through {@link toOperationView}, which is what `GET /api/operations/:id`
 *   returns and what a GraphQL caller receives as the mutation's payload;
 * - a retried request that carries the same `Idempotency-Key` resolves to the **same** operation,
 *   because the runtime resolves a submission by its key before it creates anything.
 *
 * The convention is one decorator plus one return shape. A handler that returns anything else is
 * untouched, which is what makes the convention adoptable one route at a time.
 */

/**
 * The statuses a caller sees on the handle.
 *
 * This is the caller-facing view of the runtime's state machine, not the machine itself: the runtime
 * has a seventh status — the backward walk that undoes a failed operation — and it is reported as
 * `RUNNING`, because from the caller's side the operation has not settled and the answer to "should
 * I poll again" is yes. The full machine is readable from the operation resource.
 */
export type AsyncOperationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED' | 'CANCELED';

/** Every caller-facing status, for schema generation and for callers that enumerate them. */
export const ASYNC_OPERATION_STATUSES: readonly AsyncOperationStatus[] = [
	'PENDING',
	'RUNNING',
	'COMPLETED',
	'FAILED',
	'COMPENSATED',
	'CANCELED'
];

/** Where the operations of the platform are readable. */
export const DEFAULT_OPERATIONS_PATH = '/api/operations';

/** How long a caller is asked to wait before its first poll, in seconds. */
export const DEFAULT_RETRY_AFTER_SECONDS = 1;

/**
 * What a handler that accepts work returns.
 *
 * It is a reference and not the operation: the caller already knows the id it was handed, so a
 * handler returning the whole row would invite a route to include fields the operation resource owns
 * — and the resource, not the route, is where the operation's shape is decided.
 */
export interface OperationRef {
	/** The durable operation that was started. */
	readonly operationId: string;
	/** The operation type the runtime registered; falls back to the route's declaration. */
	readonly type?: string;
	/** Where the operation stands; falls back to `PENDING`, which is where a new one is. */
	readonly status?: AsyncOperationStatus;
}

/**
 * The `202` body.
 *
 * `location` is repeated in the body so a client that cannot read headers still works — a browser
 * fetch in a cross-origin context, a proxy that drops the header, a test harness that only kept the
 * payload.
 */
export interface AsyncAccepted {
	readonly operationId: string;
	readonly type: string;
	readonly status: AsyncOperationStatus;
	/** Where the operation is readable: `/api/operations/<id>`. */
	readonly location: string;
}

/**
 * The handle, resolved: the body and the two headers that go with it.
 */
export interface LocatedOperation {
	/** The exact body of the `202`, and nothing else. */
	readonly accepted: AsyncAccepted;
	/** Value of the `Location` header; always equal to `accepted.location`. */
	readonly location: string;
	/** Value of the `Retry-After` header, in seconds. */
	readonly retryAfterSeconds: number;
}

/**
 * How a handle is located.
 */
export interface ILocateOperationOptions {
	/** The operation type the route declares; a reference that names another is a defect. */
	readonly declaredType?: string;
	/** Derives the location; defaults to `/api/operations/<id>`. */
	readonly locationOf?: (ref: OperationRef) => string;
	/** Overrides `Retry-After`; defaults to one second. */
	readonly retryAfterSeconds?: number;
}

/** The metadata key a route's accepted-operation declaration is stored under. */
export const ACCEPTED_OPERATION_METADATA = 'api:accepted-operation';

/**
 * What a route declares when it accepts work instead of performing it.
 *
 * It is read by the interceptor the declaration mounts, so a route states the convention once and
 * gets the status, the headers, the body and the mandatory idempotency key from it — there is no
 * second place for a route to forget one of the four.
 */
export interface IAcceptedOperationOptions {
	/** The operation type this route starts; the handler may name it instead, but they must agree. */
	readonly type: string;
	/** Derives the location of the handle; defaults to the operations resource's mount point. */
	readonly locationOf?: (ref: OperationRef) => string;
	/** How long the caller is asked to wait before polling, in seconds. */
	readonly retryAfterSeconds?: number;
	/**
	 * Whether the request must carry an `Idempotency-Key`; defaults to true.
	 *
	 * It defaults to required because the whole point of accepting work is that the caller may not
	 * learn the outcome of its own request: a retry without a key would start a second operation over
	 * the same aggregate, and the aggregate's own exclusivity rule would answer with a conflict
	 * rather than with the operation the caller already has.
	 */
	readonly requireIdempotencyKey?: boolean;
}

/**
 * One step of an operation, as a caller reads it.
 */
export interface OperationStepView {
	/** The step's stable name. */
	readonly name: string;
	readonly status: OperationStepStatus;
	/** Attempts made, including the ones that failed. */
	readonly attemptCount: number;
	/** 1-based execution order, so a caller can see where the operation is without reading `status`. */
	readonly order: number;
	readonly startedAt?: string;
	readonly finishedAt?: string;
}

/**
 * The handle resolved to what a caller polls.
 *
 * A GraphQL caller receives the same body through the mutation's payload and then reads it through
 * the operation field; a REST caller gets it from `GET /api/operations/:id`. Both are built here, so
 * a field cannot appear on one surface and not on the other.
 */
export interface OperationView {
	readonly id: string;
	readonly type: string;
	readonly status: OperationStatus;
	/**
	 * True when the runtime never leaves this status.
	 *
	 * A `FAILED` operation is **not** terminal: the runtime still owes an undo, and it settles as
	 * `COMPENSATED` or `CANCELED` afterwards. Reporting it as finished would tell a caller to read a
	 * result that does not exist yet.
	 */
	readonly terminal: boolean;
	readonly progress: { readonly completedSteps: number; readonly totalSteps: number };
	readonly aggregateType?: string;
	readonly aggregateId?: string;
	readonly correlationId?: string;
	readonly startedAt?: string;
	readonly finishedAt?: string;
	readonly deadlineAt?: string;
	readonly steps: readonly OperationStepView[];
	/** Present once the operation completed. */
	readonly result?: JsonData;
	/** Present when the operation ended otherwise; parsed from the runtime's `lastError`. */
	readonly error?: IOperationError;
	/** The validator a poll sends back as `If-None-Match`; equal bodies share it. */
	readonly etag: string;
}

/** The statuses the runtime never leaves. */
const TERMINAL_STATUSES: readonly OperationStatus[] = [
	OperationStatus.COMPLETED,
	OperationStatus.COMPENSATED,
	OperationStatus.CANCELED
];

/**
 * The caller-facing status of a runtime status.
 *
 * @param status The runtime's status.
 * @returns The status a handle reports.
 */
export function asyncStatusOf(status: OperationStatus): AsyncOperationStatus {
	// The backward walk is reported as running: the operation has not settled, and a caller that
	// stopped polling here would never learn how it ended.
	if (status === OperationStatus.COMPENSATING) {
		return 'RUNNING';
	}

	return status as AsyncOperationStatus;
}

/**
 * Whether a runtime status is terminal.
 *
 * @param status The runtime's status.
 * @returns True when the runtime never leaves it.
 */
export function isTerminalStatus(status: OperationStatus): boolean {
	return TERMINAL_STATUSES.includes(status);
}

/**
 * The reference a started operation resolves to.
 *
 * It is the bridge between the runtime and the convention: a handler calls the operation service,
 * hands the returned row to this function, and returns the reference. Nothing else about the
 * operation row reaches the response.
 *
 * @param operation The operation the runtime started or resumed.
 * @returns The reference.
 */
export function operationRefOf(operation: Pick<IOperation, 'id' | 'type' | 'status'>): OperationRef {
	return {
		operationId: String(operation.id),
		type: operation.type,
		status: asyncStatusOf(operation.status)
	};
}

/**
 * Where an operation is readable.
 *
 * @param operationId The operation id.
 * @param basePath The mount point of the operations resource.
 * @returns The absolute path.
 */
export function operationLocation(operationId: string, basePath: string = DEFAULT_OPERATIONS_PATH): string {
	return `${basePath}/${operationId}`;
}

/**
 * Whether a value a handler returned is an operation reference.
 *
 * The test is the id and nothing else: a route may let its decorator declare the type, and a handler
 * that returns a resource row — which has an `id` but no `operationId` — must pass through untouched.
 *
 * @param value The value.
 * @returns True when the value is a reference the convention applies to.
 */
export function isOperationRef(value: unknown): value is OperationRef {
	return (
		!!value &&
		typeof value === 'object' &&
		typeof (value as OperationRef).operationId === 'string' &&
		(value as OperationRef).operationId.length > 0
	);
}

/**
 * Resolves a reference into the response the caller receives.
 *
 * A route may declare the operation type it starts, and a handler may name it; when both do and they
 * disagree, the response would describe an operation the route does not own, so the mismatch is
 * refused instead of being papered over. It is a server-side defect, not a client error, and it is
 * loud for exactly that reason.
 *
 * @param ref The reference a handler returned.
 * @param options The route's declaration.
 * @returns The located handle.
 * @throws Error when neither the reference nor the route names a type, or when the two disagree.
 */
export function locateOperation(ref: OperationRef, options: ILocateOperationOptions = {}): LocatedOperation {
	const type = ref.type ?? options.declaredType;

	if (!type) {
		throw new Error('An accepted operation must declare its type, on the route or on the reference.');
	}

	if (ref.type && options.declaredType && ref.type !== options.declaredType) {
		throw new Error(
			`The route declares the operation type "${options.declaredType}" but the handler started "${ref.type}".`
		);
	}

	const location = options.locationOf
		? options.locationOf({ ...ref, type })
		: operationLocation(ref.operationId);

	return {
		accepted: {
			operationId: ref.operationId,
			type,
			status: ref.status ?? 'PENDING',
			location
		},
		location,
		retryAfterSeconds: options.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS
	};
}

/**
 * Resolves an operation row into what a caller polls.
 *
 * The steps are supplied by the caller — the runtime reads them with `findSteps` — because a view
 * built without them would report a progress of zero out of zero, which is worse than no progress at
 * all: a caller would conclude the operation had no work to do. Terminal operations carry the
 * runtime's `result`, and the last error is parsed into the structured shape a client branches on.
 *
 * @param operation The operation row.
 * @param steps The operation's steps, in execution order.
 * @returns The view, with the validator a conditional poll sends back.
 */
export function toOperationView(operation: IOperation, steps: readonly IOperationStep[]): OperationView {
	const completed = steps.filter(
		(step) => step.status === OperationStepStatus.COMPLETED || step.status === OperationStepStatus.SKIPPED
	).length;
	const error = parseOperationError(operation.lastError);

	const body = {
		id: String(operation.id),
		type: operation.type,
		status: operation.status,
		terminal: isTerminalStatus(operation.status),
		progress: { completedSteps: completed, totalSteps: steps.length },
		...(operation.aggregateType !== undefined && { aggregateType: operation.aggregateType }),
		...(operation.aggregateId !== undefined && { aggregateId: String(operation.aggregateId) }),
		...(operation.correlationId !== undefined && { correlationId: String(operation.correlationId) }),
		...(operation.startedAt !== undefined && { startedAt: toIsoString(operation.startedAt) }),
		...(operation.finishedAt !== undefined && { finishedAt: toIsoString(operation.finishedAt) }),
		...(operation.deadlineAt !== undefined && { deadlineAt: toIsoString(operation.deadlineAt) }),
		steps: steps.map((step) => ({
			name: step.name,
			status: step.status,
			attemptCount: step.attemptCount,
			order: step.order,
			...(step.startedAt !== undefined && { startedAt: toIsoString(step.startedAt) }),
			...(step.finishedAt !== undefined && { finishedAt: toIsoString(step.finishedAt) })
		})),
		...(operation.result !== undefined && operation.result !== null && { result: operation.result }),
		...(error !== undefined && { error })
	};

	return { ...body, etag: weakEtag(body) };
}

/**
 * A weak validator over a value.
 *
 * A poll that sends the validator back gets a `304` while the operation has not moved, which turns
 * the polling loop a long operation invites into a conditional request. The value is hashed rather
 * than serialized into the header because a header holds one line and an operation's body does not.
 * A 32-bit hash is the right size here: a collision costs one skipped update to a caller that will
 * poll again, and the alternative is carrying the operation's whole body in `If-None-Match`.
 *
 * @param value The value to validate.
 * @returns The weak entity tag, quoted as the header syntax requires.
 */
export function weakEtag(value: unknown): string {
	return `W/"${fnv1a(stableStringify(value))}"`;
}

/**
 * Serializes a value with its object keys in a stable order.
 *
 * `JSON.stringify` follows insertion order, so the same operation could hash differently depending
 * on how its view was assembled — and a validator that changes when nothing changed defeats its own
 * purpose.
 *
 * @param value The value.
 * @returns The canonical text.
 */
function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value) ?? 'null';
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
	}

	if (value instanceof Date) {
		return JSON.stringify(value.toISOString());
	}

	const entries = Object.keys(value as Record<string, unknown>)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);

	return `{${entries.join(',')}}`;
}

/**
 * The FNV-1a hash of a string, in lower-case hexadecimal.
 *
 * @param text The text.
 * @returns Eight hexadecimal characters.
 */
function fnv1a(text: string): string {
	let hash = 0x811c9dc5;

	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		// The 32-bit FNV prime, applied without overflowing the double the bitwise operators work on.
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}

	return hash.toString(16).padStart(8, '0');
}

/**
 * Formats a date column, which a driver may hand back as a string.
 *
 * @param value The date.
 * @returns The ISO string, or the original value when it cannot be read as a date.
 */
function toIsoString(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);

	return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/**
 * Reads the runtime's stored error.
 *
 * @param value The `lastError` column.
 * @returns The error, or undefined when the column is absent or unreadable.
 */
function parseOperationError(value?: string): IOperationError | undefined {
	if (!value) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(value) as IOperationError;

		return parsed && typeof parsed === 'object' && typeof parsed.code === 'string' ? parsed : undefined;
	} catch {
		return undefined;
	}
}
