import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';

/**
 * Where a durable operation stands.
 *
 * The machine is deliberately small: an operation either has not started, is running, succeeded,
 * failed and is waiting to be undone, is being undone, was undone, or was cancelled. Everything an
 * operator needs in order to explain a stuck aggregate is readable from these seven values.
 */
export enum OperationStatus {
	/** Created, no step started. */
	PENDING = 'PENDING',
	/** At least one step is in progress or completed and a later step has not started yet. */
	RUNNING = 'RUNNING',
	/** Every step completed. Terminal. */
	COMPLETED = 'COMPLETED',
	/** A step failed and compensation has not started. */
	FAILED = 'FAILED',
	/** The backward walk through completed steps is running their compensators. */
	COMPENSATING = 'COMPENSATING',
	/** Every completed step was compensated. Terminal. */
	COMPENSATED = 'COMPENSATED',
	/** Cancelled before completion; compensation, where it was needed, has run. Terminal. */
	CANCELED = 'CANCELED'
}

/**
 * Where a single step of an operation stands.
 */
export enum OperationStepStatus {
	/** Not started. A restart of the operation resumes here. */
	PENDING = 'PENDING',
	/** Invoked and not yet returned. */
	RUNNING = 'RUNNING',
	/** The handler returned successfully; `output` and `compensationData` are populated. */
	COMPLETED = 'COMPLETED',
	/** The handler threw after exhausting its retries. */
	FAILED = 'FAILED',
	/** Not compensated because it declares no compensator, or never ran. */
	SKIPPED = 'SKIPPED',
	/** Its compensator is running. */
	COMPENSATING = 'COMPENSATING',
	/** Its compensator ran successfully. Terminal for this step. */
	COMPENSATED = 'COMPENSATED',
	/** Its compensator threw after exhausting its retries; the aggregate is dirty and named in the result. */
	COMPENSATION_FAILED = 'COMPENSATION_FAILED'
}

/**
 * The lease that makes an operation a distributed lock.
 *
 * Only the lease holder executes steps, so two workers can never drive one operation. A worker that
 * dies stops renewing, the lease expires, and another worker claims the operation and resumes from
 * the persisted step statuses.
 *
 * **It is stored in columns, not in `state`.** `IOperationState` deliberately carries no `lease` member:
 * the sweep that looks for a stuck operation filters on the expiry, and a value inside a JSON document
 * carries no index on any of the three dialects — so the lease is `lockedAt`, `lockedBy` and
 * `leaseExpiresAt` on the operation row, and this interface is the shape the runtime reads and writes
 * them as.
 */
export interface IOperationLease {
	/** Identity of the process holding the lease. */
	ownerId: string;
	/** When the lease stops being valid. */
	expiresAt: Date | string;
}

/**
 * The mutable execution state of an operation.
 *
 * Only the runtime writes it. `cursor` and the per-step rows are what make a resumed operation
 * continue rather than restart, and `variables` is the shared scratch space a step may read and
 * write atomically.
 */
export interface IOperationState {
	/** Index of the step the runtime is at, for operators watching progress. */
	cursor?: number;
	/** Set by a cancellation request; steps check it and the runtime acts on it before the next step. */
	cancelRequested?: boolean;
	/** Set when the operation is parked on an external decision and must not be executed. */
	awaitingApproval?: boolean;
	/** Name of the highest step the compensation walk has processed. */
	lastCompensationCursor?: number;
	/** Output of each completed step, keyed by step name; what a later step receives. */
	stepOutputs?: JsonData;
	/** Shared variables a step reads and writes. */
	variables?: JsonData;
}

/**
 * A failure, stated precisely enough to be actionable.
 */
export interface IOperationError {
	/** Stable machine-readable code, for example `PAYMENT_DECLINED` or `DEADLINE_EXCEEDED`. */
	code: string;
	/** Human-readable message. */
	message: string;
	/** The step that failed, when a step did. */
	stepName?: string;
	/** Whether retrying the operation could succeed. */
	retryable?: boolean;
	/** Steps whose compensator could not undo its effect; the aggregate is dirty for exactly these. */
	compensationFailures?: string[];
}

/**
 * A durable operation: the saga header.
 *
 * Checkout completion, capture, fulfilment creation, return receipt and subscription billing are
 * long, multi-step, cross-aggregate operations that must survive a restart. The header carries the
 * plan's progress, the lock that keeps two of them off one aggregate, and enough undo information
 * for any of them to be reversible.
 */
export interface IOperation extends IBasePerTenantAndOrganizationEntityModel {
	/** Operation type, for example `CHECKOUT_COMPLETE`; a definition must be registered for it. */
	type: string;

	status: OperationStatus;

	/** The request that started the operation. Never mutated after creation. */
	input: JsonData;

	/** Accumulated execution state. Only the runtime writes it. */
	state?: IOperationState;

	/** The terminal outcome, written on `COMPLETED`, `COMPENSATED` or `CANCELED`. */
	result?: JsonData;

	/** Operation-level attempts. */
	attemptCount: number;

	/** Operation-level attempt budget. */
	maxAttempts: number;

	/** The last error, as an `IOperationError`. */
	lastError?: string;

	/** Links the operation to the key that started it; unique per organization and type when set. */
	idempotencyKey?: string;

	/** Set when the operation was started by a step of another operation. */
	parentOperationId?: ID;

	/** When the first step started. */
	startedAt?: Date;

	/** When the operation reached a terminal status. */
	finishedAt?: Date;

	/** Wall-clock limit for the whole operation; past it the operation compensates instead of continuing. */
	deadlineAt?: Date;

	/** The aggregate the operation owns, used for the single-live-operation rule. */
	aggregateType?: string;

	/** Id of that aggregate. */
	aggregateId?: ID;

	/** Ties every event and log line produced by the operation together. */
	correlationId?: ID;
}

/**
 * One step of an operation.
 *
 * Per-step durability is what lets a restart resume at the first non-completed step instead of
 * re-running the whole operation, and `compensationData` is what makes the undo possible without
 * re-deriving anything.
 */
export interface IOperationStep extends IBasePerTenantAndOrganizationEntityModel {
	/** The operation this step belongs to. */
	operationId: ID;

	/** Stable step name, unique per operation, for example `reserve-stock`. */
	name: string;

	/** Execution order; the compensating walk uses the reverse of it. */
	order: number;

	status: OperationStepStatus;

	/** The step's resolved input: a projection of the operation's input plus earlier outputs. */
	input?: JsonData;

	/** What the step produced; merged into the operation's state for later steps. */
	output?: JsonData;

	/** Exactly what the compensator needs: the reservation id, the provider reference, the quantity. */
	compensationData?: JsonData;

	/** Attempts made, including the ones that failed. */
	attemptCount: number;

	/** Last error, as an `IOperationError`. */
	lastError?: string;

	/** When the current attempt started. */
	startedAt?: Date;

	/** When the step reached a terminal status. */
	finishedAt?: Date;
}
