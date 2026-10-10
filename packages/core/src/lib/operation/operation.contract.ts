import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import { EntityManager as TypeOrmEntityManager } from 'typeorm';
import { ID, JsonData } from '@gauzy/contracts';
import { MultiORMEnum } from '../core/utils';
import { Operation } from './operation.entity';

/**
 * How a step that threw is retried.
 */
export interface IStepRetryPolicy {
	/** Total attempts, including the first one. */
	maxAttempts: number;
	/** Delay before the second attempt, in milliseconds. */
	baseMs: number;
	/** Ceiling for the computed delay. */
	maxMs?: number;
	/** `fixed` repeats `baseMs`; `exponential` doubles it per attempt. */
	strategy?: 'fixed' | 'exponential';
	/** Fraction of the delay applied as random spread, for example `0.2` for ±20 %. */
	jitter?: number;
}

/**
 * The logger a step is handed.
 *
 * It is pre-populated with the operation's correlation fields, so every line a step writes can be
 * traced back to the operation without the step having to remember them.
 */
export interface IOperationLogger {
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * The manager a step's local writes go through, and the ORM it belongs to.
 *
 * **The manager is the configured ORM's, and `orm` says which one it is.** `@MultiORMColumn` and the
 * relation decorators register an entity with the active ORM alone, so under `DB_ORM=mikro-orm` TypeORM
 * knows no column the kernel's entities declare with them: a TypeORM manager handed to a step there could
 * not write a row of any of them. A step narrows on `orm` and receives the manager of that ORM, typed as
 * one:
 *
 * - **`typeorm`** — the data source's own `EntityManager`, shared by every step. Each statement commits
 *   on its own; `manager.transaction(...)` groups several.
 * - **`mikro-orm`** — a fork of the installation's `EntityManager`, made for this attempt alone. Its
 *   identity map starts empty and is the step's own, so nothing a step loads leaks into a request or
 *   into the next attempt, and it is usable on a worker, where the global manager refuses work without
 *   a request context. Nothing is flushed for the step: a native statement (`insert`, `nativeUpdate`)
 *   commits on its own, a `flush()` commits what the step persisted, and `transactional(...)` groups
 *   several.
 *
 * On both ORMs it is **the connection's manager, not a transaction around the attempt**: the row that
 * records the step as `COMPLETED` is a further commit after the step returns. A process that dies between
 * the two leaves an effect with the step still `RUNNING`; a resume invokes the step again, which is why a
 * local write guards on {@link IOperationStepContext.idempotencyKey} exactly as a provider call does.
 */
export type IOperationStepManager =
	| {
			/** The installation runs TypeORM. */
			readonly orm: MultiORMEnum.TypeORM;
			/** The data source's own manager. */
			readonly manager: TypeOrmEntityManager;
	  }
	| {
			/** The installation runs MikroORM. */
			readonly orm: MultiORMEnum.MikroORM;
			/** A fork of the installation's manager, made for this attempt. */
			readonly manager: MikroOrmEntityManager;
	  };

/**
 * What a step is handed while it runs, apart from its manager.
 */
export interface IOperationStepContextMembers {
	/** The operation this step belongs to. */
	readonly operationId: ID;
	/** The step's stable name. */
	readonly stepName: string;
	/** 1-based attempt of this step, counting the attempts of earlier processes. */
	readonly attempt: number;
	/**
	 * A key that is stable across retries of this step, so a step that calls a provider can pass it
	 * as the provider's own idempotency key and a step that writes locally can use it as a guard.
	 */
	readonly idempotencyKey: string;
	readonly logger: IOperationLogger;
	/** The operation's shared variables; mutated values are persisted with the step's outcome. */
	readonly variables: Record<string, unknown>;
	/** The operation deadline, so a step can fail fast instead of starting work that cannot finish. */
	readonly deadlineAt?: Date;
	/**
	 * True when a cancellation has been requested; steps check it at safe points.
	 *
	 * **Awaited, because the answer is read from the operation's row rather than from a snapshot.** A
	 * cancellation is requested by another process, against a row this attempt does not hold, so an
	 * answer computed once when the step started is a constant that can only ever say "no" — a step
	 * with a ten-minute timeout polling it would never observe a cancellation made two minutes in. The
	 * runtime caches the read for a second, so a tight polling loop costs a query per second rather
	 * than one per iteration, and a step may simply `await` it at every safe point. The answer is always
	 * a promise: a step that tests it without `await` is testing an object, which is always truthy.
	 */
	cancelRequested(): Promise<boolean>;
}

/**
 * What a step is handed while it runs: its members, and the manager of the ORM the installation runs
 * (see {@link IOperationStepManager}).
 */
export type IOperationStepContext = IOperationStepContextMembers & IOperationStepManager;

/**
 * What a step returns.
 */
export interface IOperationStepResult<O = JsonData, C = JsonData> {
	/** What the step produced; merged into the operation's state for later steps. */
	output?: O;
	/** Everything the compensator needs to undo the step. */
	compensationData?: C;
}

/**
 * A step of an operation: the work, its undo, and how it is retried and bounded.
 */
export interface IOperationStepDefinition<I = any, O = any, C = any> {
	/** Stable step name, unique within the operation. */
	name: string;
	/** Execution order; the compensating walk uses the reverse of it. */
	order: number;
	/**
	 * Performs the step.
	 *
	 * Invoked at least once and possibly more, so it must reach the same state whether it runs once
	 * or three times; `context.idempotencyKey` is the tool for that.
	 */
	invoke(input: I, context: IOperationStepContext): Promise<IOperationStepResult<O, C> | void>;
	/**
	 * Undoes `invoke`, receiving exactly the `compensationData` it returned.
	 *
	 * Omitting it declares the step non-compensable, which is only allowed where the effect is
	 * additive and harmless: the runtime records such a step as skipped during compensation and
	 * lists it in the operation's result, so an operator can see what was left behind.
	 */
	compensate?(data: C, context: IOperationStepContext): Promise<void>;
	retry?: IStepRetryPolicy;
	/** Bounds a single attempt. A timed-out attempt is retried, not cancelled in the provider. */
	timeoutMs?: number;
	/** True when the step enqueues follow-up work instead of doing it inline. */
	async?: boolean;
}

/**
 * What a plugin registers for one operation type.
 */
export interface IOperationDefinition {
	/** The steps, in ascending `order`; two steps may not share an order. */
	steps: IOperationStepDefinition[];
	/** Operation-level attempt budget; defaults to 3. */
	maxAttempts?: number;
	/** Wall-clock limit applied when the caller does not supply one. */
	defaultDeadlineMs?: number;
}

/**
 * A request to start an operation.
 */
export interface IOperationStartInput {
	/** Operation type; a definition must be registered for it. */
	type: string;
	/** The immutable request that started the operation. */
	input: JsonData;
	/** The aggregate the operation owns, when it owns one. */
	aggregateType?: string;
	/** Id of that aggregate. */
	aggregateId?: ID;
	/** Caller-supplied key; a second submission with the same key returns the original operation. */
	idempotencyKey?: string;
	/** The operation that started this one. */
	parentOperationId?: ID;
	/** Overrides the definition's deadline. */
	deadlineMs?: number;
	/** Overrides the definition's attempt budget. */
	maxAttempts?: number;
	/** Ties the operation's events and logs together; generated when absent. */
	correlationId?: ID;
	/** Overrides the tenant taken from the request context. */
	tenantId?: ID;
	/** Overrides the organization taken from the request context. */
	organizationId?: ID;
}

/**
 * The operation a submission resolved to, and whether this call created it.
 *
 * `created: false` is the answer to a retried request and to a second concurrent submission for the
 * same aggregate: the caller gets the operation that already exists instead of a second one.
 */
export interface IOperationStartResult {
	operation: Operation;
	created: boolean;
}

/**
 * How a caller drives an operation.
 */
export interface IOperationExecutionOptions {
	/** Identity of the process taking the lease; generated when absent. */
	ownerId?: string;
	/** How long the lease is valid; defaults to the service's window. */
	leaseMs?: number;
	/** Stops after this many steps, so a long operation can be driven in slices. */
	maxSteps?: number;
}

/**
 * What one pass of the executor did.
 */
export interface IOperationExecutionResult {
	operation: Operation;
	/** Steps this pass completed, in order. */
	executedSteps: string[];
	/** True when the operation reached a terminal status. */
	finished: boolean;
}
