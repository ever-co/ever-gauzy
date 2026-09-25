import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FindManyOptions, FindOptionsWhere, In, IsNull } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EntityData, FilterQuery, LockMode, ReferenceKind } from '@mikro-orm/core';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, IOperationError, OperationStatus, OperationStepStatus } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { MultiORMEnum } from '../core/utils';
import { Operation } from './operation.entity';
import { OperationStep } from './operation-step.entity';
import { OperationRegistry } from './operation.registry';
import { OperationEventPublisher } from './operation-event.publisher';
import {
	IOperationExecutionOptions,
	IOperationExecutionResult,
	IOperationLogger,
	IOperationStartInput,
	IOperationStartResult,
	IOperationStepContext,
	IOperationStepDefinition,
	IOperationStepResult,
	IStepRetryPolicy
} from './operation.contract';
import { TypeOrmOperationRepository } from './repository/type-orm-operation.repository';
import { TypeOrmOperationStepRepository } from './repository/type-orm-operation-step.repository';
import { MikroOrmOperationRepository } from './repository/mikro-orm-operation.repository';
import { MikroOrmOperationStepRepository } from './repository/mikro-orm-operation-step.repository';

/** Statuses an operation never leaves. */
const TERMINAL_STATUSES: OperationStatus[] = [
	OperationStatus.COMPLETED,
	OperationStatus.COMPENSATED,
	OperationStatus.CANCELED
];

/** Statuses that count as "live" for the one-operation-per-aggregate rule. */
const LIVE_STATUSES: OperationStatus[] = [
	OperationStatus.PENDING,
	OperationStatus.RUNNING,
	OperationStatus.COMPENSATING
];

/**
 * The state machine.
 *
 * It is the union of the two forms the platform documents — the transition table and the runtime
 * diagram — plus the moves an operator makes through {@link OperationService.retry}, and all three
 * are admitted deliberately: a step failure moves `RUNNING` to `COMPENSATING` directly, while a
 * manual retry-into-compensation goes through `FAILED`, and a retry of an operation whose undo is
 * owed puts it back on that walk (`COMPENSATED` → `FAILED`) rather than leaving it finished while
 * its compensators still have work. The last group is the only one no step of the runtime writes:
 * a retry is not the runtime deciding, it is an operator asking for the plan again, and the edges it
 * needs are stated here so the one move an operator can make is as explainable as the rest.
 *
 * Anything else is refused, because a status an operator cannot explain is worse than a loud error.
 */
const LEGAL_TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
	[OperationStatus.PENDING]: [OperationStatus.RUNNING, OperationStatus.CANCELED],
	[OperationStatus.RUNNING]: [
		OperationStatus.PENDING,
		OperationStatus.COMPLETED,
		OperationStatus.FAILED,
		OperationStatus.COMPENSATING,
		OperationStatus.CANCELED
	],
	// The operator's retry: the undo is outstanding and the compensation walk is what may run on it.
	[OperationStatus.FAILED]: [OperationStatus.COMPENSATING, OperationStatus.CANCELED, OperationStatus.PENDING],
	[OperationStatus.COMPENSATING]: [OperationStatus.COMPENSATED, OperationStatus.FAILED],
	[OperationStatus.COMPLETED]: [],
	// The operator's retry: an operation whose compensation failed still owes its undo.
	[OperationStatus.COMPENSATED]: [OperationStatus.FAILED, OperationStatus.PENDING],
	[OperationStatus.CANCELED]: []
};

/**
 * Raised when the runtime is asked to move an operation along an illegal edge of the state machine.
 */
export class OperationIllegalTransitionError extends ConflictException {
	readonly code = 'OPERATION_ILLEGAL_TRANSITION';

	constructor(readonly from: OperationStatus, readonly to: OperationStatus) {
		super(`An operation cannot move from ${from} to ${to}.`);
		this.name = 'OperationIllegalTransitionError';
	}
}

/**
 * Raised when a worker discovers that its lease was taken over while it was working.
 *
 * The worker must stop rather than continue: two executors driving one operation is exactly what the
 * lease exists to prevent, and the loser of that race is the one that notices.
 */
export class OperationLeaseLostError extends ConflictException {
	readonly code = 'OPERATION_LEASE_LOST';

	constructor(readonly operationId: ID, readonly ownerId: string, readonly holderId: string) {
		super(`The operation "${operationId}" is no longer leased to "${ownerId}".`);
		this.name = 'OperationLeaseLostError';
	}
}

/**
 * Executes durable operations: the plan, the progress and the undo.
 *
 * The service owns the state machine and nothing else. It does not know what a step does, it does not
 * enqueue its own work and it does not decide when to run — a caller (a job, a controller or a test)
 * drives it through `execute`, `resume`, `cancel` and `compensate`. What it guarantees is that a step
 * outcome is persisted before the next step starts, that the completed steps of a failed operation
 * are undone in reverse, and that only one worker at a time is executing a given operation.
 *
 * **It is also where the three streamed facts are produced.** A step moving, an operation completing
 * and an operation failing are announced from the two places every one of those writes already goes
 * through — {@link saveStep} and {@link settle} — rather than from the surfaces around it, so the
 * REST route and the GraphQL mutation that perform the same write announce it identically and a
 * subscriber cannot tell which protocol wrote the row.
 */
@Injectable()
export class OperationService extends CrudService<Operation> {
	/** Wall-clock budget of an operation whose definition declares none. */
	static readonly DEFAULT_DEADLINE_MS = 15 * 60 * 1000;

	/**
	 * How long a worker's lease is valid.
	 *
	 * Short enough that a worker that dies is replaced within a minute, long enough that a slow step
	 * does not lose its operation to a healthy worker.
	 */
	static readonly DEFAULT_LEASE_MS = 60_000;

	/**
	 * The patch that leaves no lease behind.
	 *
	 * Stated once rather than written out at each of the three places an operation stops holding one, so
	 * "a finished or released operation carries no lease" is one fact in the code as well as one rule on
	 * the table (`CHK_operation_status_terminal`).
	 */
	private static readonly NO_LEASE = { lockedAt: null, lockedBy: null, leaseExpiresAt: null } as const;

	/** Operation-level attempt budget of an operation whose definition declares none. */
	static readonly DEFAULT_MAX_ATTEMPTS = 3;

	/**
	 * How long a step's cancellation answer may be reused before the row is read again.
	 *
	 * A step polls `context.cancelRequested()` in its own loop, and the answer has to come from the
	 * store — a closure over the object the attempt started with can never change. One second is the
	 * compromise: a cancellation is observed within it, and a tight loop costs one query per second
	 * instead of one per iteration.
	 */
	static readonly CANCEL_CHECK_INTERVAL_MS = 1_000;

	/** The service's own logger, for the degradations it reports rather than raises. */
	private readonly logger = new Logger(OperationService.name);

	constructor(
		readonly typeOrmOperationRepository: TypeOrmOperationRepository,
		readonly mikroOrmOperationRepository: MikroOrmOperationRepository,
		readonly typeOrmOperationStepRepository: TypeOrmOperationStepRepository,
		readonly mikroOrmOperationStepRepository: MikroOrmOperationStepRepository,
		readonly registry: OperationRegistry,
		readonly operationEventPublisher: OperationEventPublisher
	) {
		super(typeOrmOperationRepository, mikroOrmOperationRepository);
	}

	/**
	 * Creates an operation with its step definitions.
	 *
	 * A submission that repeats an earlier one does not start a second operation: the same
	 * `idempotencyKey` for the same type returns the original, and a second live operation for one
	 * aggregate is refused by the exclusivity rule. Both cases answer `created: false`, which is the
	 * correct answer for a retried client.
	 *
	 * @param input The operation to start.
	 * @returns The operation, and whether this call created it.
	 * @throws OperationTypeUnknownError when no definition is registered for the type.
	 */
	async start(input: IOperationStartInput): Promise<IOperationStartResult> {
		const definition = this.registry.require(input.type);

		// The scope is resolved before the lookup rather than after it, because the lookup and the
		// insert have to agree: a submission that stated its own organization was looked up in the
		// request context's and written into the stated one, so a retry never found the operation
		// its first attempt created and was refused by that operation's own row.
		const now = new Date();
		const tenantId = input.tenantId ?? RequestContext.currentTenantId();
		const organizationId = input.organizationId ?? RequestContext.currentOrganizationId();
		const scope = { tenantId, organizationId };

		const existing = await this.findBySubmission(input, scope);

		if (existing) {
			return { operation: existing, created: false };
		}

		const operation = this.typeOrmOperationRepository.create({
			type: input.type,
			status: OperationStatus.PENDING,
			input: input.input ?? {},
			state: { cursor: 0, variables: {} },
			attemptCount: 0,
			maxAttempts: input.maxAttempts ?? definition.maxAttempts ?? OperationService.DEFAULT_MAX_ATTEMPTS,
			idempotencyKey: input.idempotencyKey,
			parentOperationId: input.parentOperationId,
			startedAt: now,
			deadlineAt: new Date(
				now.getTime() + (input.deadlineMs ?? definition.defaultDeadlineMs ?? OperationService.DEFAULT_DEADLINE_MS)
			),
			aggregateType: input.aggregateType,
			aggregateId: input.aggregateId,
			correlationId: input.correlationId ?? randomUUID(),
			tenantId,
			organizationId
		} as Partial<Operation>);

		try {
			// The header and its steps are written in one transaction, so an operation is never visible
			// without the plan it is supposed to execute.
			const created = await this.typeOrmOperationRepository.manager.transaction(async (manager) => {
				const saved = await manager.save(Operation, operation);

				const steps = definition.steps.map((step) =>
					manager.create(OperationStep, {
						operationId: saved.id,
						name: step.name,
						order: step.order,
						status: OperationStepStatus.PENDING,
						attemptCount: 0,
						tenantId,
						organizationId
					} as Partial<OperationStep>)
				);

				await manager.save(OperationStep, steps);

				return saved;
			});

			return { operation: created, created: true };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			// A concurrent submission won the race: either it took the aggregate or it holds the same
			// idempotency key, and its operation is the answer to this request.
			const raced = await this.findBySubmission(input, scope);

			if (raced) {
				return { operation: raced, created: false };
			}

			// The tuple is taken and the caller's own scope holds nothing for it. Either the winner was
			// deleted between the insert and this read, or the tuple that refused the insert is the
			// aggregate's: `UQ_operation_aggregate_live` carries neither tenant nor organization, so a
			// live operation of another tenant on the aggregate this submission names refuses it. The
			// key cannot be the cause any more — `UQ_operation_tenant_idem` folds the tenant and the
			// organization exactly as {@link findBySubmission} reads them, so a key another scope used
			// is neither found above nor in the way of the insert. Both remaining cases are conflicts and
			// neither is a server fault, so the raw driver error is not the answer: it would surface as a
			// `500` on an ordinary submission. Nothing about the other row is named.
			throw new ConflictException(
				`This submission of "${input.type}" could not be started because its idempotency key or its aggregate is already held. Submit it under a different key, or once the aggregate's live operation has finished.`
			);
		}
	}

	/**
	 * Takes the lease of an operation.
	 *
	 * The lease is the third layer of the exclusivity rule and the one that survives a crash: only the
	 * lease holder executes steps, a holder that dies stops renewing, and the operation is then
	 * claimable by another worker, which resumes it from the persisted step statuses.
	 *
	 * **The lease lives in the row's own columns**, not in `state`: `lockedAt`, `lockedBy` and
	 * `leaseExpiresAt` are what a stuck-operation report names and what the sweep filters on, and a value
	 * inside a JSON document carries no index on any of the three dialects. The decision and the write are
	 * one statement inside the transaction, so two workers cannot both read a free lease and both take it.
	 *
	 * @param operationId The operation id.
	 * @param ownerId Identity of the worker claiming it.
	 * @param leaseMs How long the lease is valid.
	 * @returns The claimed operation, or null when it is terminal or held by a live lease.
	 */
	async claim(
		operationId: ID,
		ownerId: string,
		leaseMs: number = OperationService.DEFAULT_LEASE_MS
	): Promise<Operation | null> {
		return this.typeOrmOperationRepository.manager.transaction(async (manager) => {
			const query = manager.createQueryBuilder(Operation, 'operation').where({ id: operationId });

			const operation =
				isPostgres() || isMySQL()
					? // `pessimistic_write` maps to FOR UPDATE on both dialects, so the lease check and the
					  // lease write are one indivisible decision.
					  await query.setLock('pessimistic_write').getOne()
					: // The embedded dialect serializes writers, so the transaction is the lock.
					  await query.getOne();

			if (!operation || isTerminalStatus(operation.status)) {
				return null;
			}

			// An operation parked on an external decision must not be driven: it is resumed by the
			// decision, not by a worker that happens to pass by.
			if (operation.state?.awaitingApproval) {
				return null;
			}

			if (this.isLeasedByAnother(operation, ownerId)) {
				return null;
			}

			Object.assign(operation, this.leaseOf(ownerId, leaseMs));

			if (operation.status === OperationStatus.PENDING) {
				Object.assign(operation, { status: OperationStatus.RUNNING, startedAt: operation.startedAt ?? new Date() });
			}

			return manager.save(Operation, operation);
		});
	}

	/**
	 * The operations whose worker has stopped reporting, oldest lease first.
	 *
	 * The sweep the durable-operation runtime needs: an operation is stalled when its status is **live** —
	 * `PENDING`, `RUNNING` or `COMPENSATING`, the three the exclusivity rule treats as in flight — and the
	 * lease it holds has lapsed. A terminal operation is not stalled, it is finished, and an operation with
	 * no lease at all is one nobody has started rather than one somebody abandoned; both are excluded by
	 * the predicate rather than by a filter the caller has to remember.
	 *
	 * The read is the one `IDX_operation_lease` exists for: the index is partial on exactly this predicate,
	 * so the sweep reads the few stuck rows rather than every operation ever run. Nothing is *changed* here
	 * — a sweep that reclaimed as a side effect would make its own report unreadable — so a caller that
	 * wants to take one over calls {@link claim}, which decides under the row's lock.
	 *
	 * @param options.staleMs How long a lease may be unexpired-but-unrenewed before the row counts as
	 * stalled; `0` means the lease's own expiry is the whole test.
	 * @param options.limit The most rows to answer with.
	 * @param options.now The instant to compare against; defaults to the clock, and is stated in tests.
	 * @returns The stalled operations, the one whose lease lapsed longest ago first.
	 */
	async findStalled(options: { staleMs?: number; limit?: number; now?: Date } = {}): Promise<Operation[]> {
		const now = options.now ?? new Date();
		const cutoff = new Date(now.getTime() - (options.staleMs ?? 0));

		return this.typeOrmOperationRepository
			.createQueryBuilder('operation')
			.where('operation.status IN (:...live)', {
				live: [OperationStatus.PENDING, OperationStatus.RUNNING, OperationStatus.COMPENSATING]
			})
			// `operation.leaseExpiresAt` rather than `operation."leaseExpiresAt"`: the builder resolves
			// a property name to the column and quotes it for the configured dialect, while a raw
			// fragment is passed through untouched — and MySQL reads those quotes as a string literal,
			// so the sweep raised a syntax error there and never ran.
			.andWhere('operation.leaseExpiresAt IS NOT NULL')
			.andWhere('operation.leaseExpiresAt < :cutoff', { cutoff })
			.orderBy('operation.leaseExpiresAt', 'ASC')
			.take(options.limit ?? 100)
			.getMany();
	}

	/**
	 * Drives an operation as far as it can go.
	 *
	 * Steps run in strictly ascending order and each outcome is persisted before the next step starts,
	 * which is what makes a restart resume instead of restart. The next step is only started when
	 * every lower-ordered step is completed or skipped, and the cancellation flag and the deadline are
	 * checked between steps — a step already running is bounded by its own timeout, never killed.
	 *
	 * @param operationId The operation id.
	 * @param options Lease, worker identity and step budget for this pass.
	 * @returns What this pass did.
	 * @throws NotFoundException when the operation does not exist.
	 */
	async execute(
		operationId: ID,
		options: IOperationExecutionOptions = {}
	): Promise<IOperationExecutionResult> {
		const ownerId = options.ownerId ?? randomUUID();
		const leaseMs = options.leaseMs ?? OperationService.DEFAULT_LEASE_MS;
		const executedSteps: string[] = [];

		let operation = await this.claim(operationId, ownerId, leaseMs);

		if (!operation) {
			// Either another worker is driving it or it is already terminal. Reporting the current state
			// is the honest answer; pretending to have executed steps would be a lie.
			const current = await this.require(operationId);

			return { operation: current, executedSteps, finished: isTerminalStatus(current.status) };
		}

		if (operation.status === OperationStatus.FAILED || operation.status === OperationStatus.COMPENSATING) {
			// No step is started on an operation that owes an undo: its remaining work is the undo.
			return {
				operation: await this.compensate(operationId, { ownerId, leaseMs }),
				executedSteps,
				finished: true
			};
		}

		const definition = this.registry.require(operation.type);
		const maxSteps = options.maxSteps ?? Number.MAX_SAFE_INTEGER;
		let failure: IOperationError | undefined;

		while (executedSteps.length < maxSteps) {
			const steps = await this.findSteps(operationId);
			const next = steps.find(
				(step) => step.status !== OperationStepStatus.COMPLETED && step.status !== OperationStepStatus.SKIPPED
			);

			if (!next) {
				// Every step is done: the operation is complete, which is also the recovery path for a
				// crash that happened after the last step but before the status write.
				break;
			}

			failure = this.checkBeforeStep(operation);

			if (failure) {
				break;
			}

			const stepDefinition = definition.steps.find((candidate) => candidate.name === next.name);

			if (!stepDefinition) {
				// The persisted step no longer exists in the definition — a deployment removed it while
				// this operation was in flight. The operation cannot continue, and it says so.
				failure = {
					code: 'OPERATION_STEP_UNKNOWN',
					message: `The step "${next.name}" is no longer part of the definition of "${operation.type}".`,
					stepName: next.name,
					retryable: false
				};
				break;
			}

			const outcome = await this.runStep(operation, next, stepDefinition, ownerId, leaseMs);
			operation = outcome.operation;

			if (outcome.failure) {
				failure = outcome.failure;
				break;
			}

			executedSteps.push(next.name);
		}

		if (failure) {
			// A failed step is assumed to have applied nothing, so only the steps that completed are
			// compensated — the backwards walk is the runtime's job, never the step's.
			operation = await this.beginCompensation(operation, failure);

			return { operation: await this.compensate(operationId, { ownerId, leaseMs }), executedSteps, finished: true };
		}

		const steps = await this.findSteps(operationId);
		const outstanding = steps.some(
			(step) => step.status !== OperationStepStatus.COMPLETED && step.status !== OperationStepStatus.SKIPPED
		);

		if (outstanding) {
			// The caller's step budget ran out. The lease is released so another pass can continue, and
			// the operation stays running.
			const released = await this.releaseLease(operation);

			return { operation: released, executedSteps, finished: false };
		}

		return { operation: await this.complete(operation, executedSteps), executedSteps, finished: true };
	}

	/**
	 * Continues an interrupted operation.
	 *
	 * Recovery needs no external coordination and no in-memory state: the persisted step statuses say
	 * where to continue, so resuming is executing under a fresh lease. A worker that died mid-step
	 * leaves a step that is retried, and its idempotency key is what makes that retry safe.
	 *
	 * The recovery sweep calls this, and so does the `resumeOperation` mutation, which carries a
	 * credential and takes the id from its arguments — so the operation is read inside the caller's
	 * scope (see {@link requireInScope}).
	 *
	 * @param operationId The operation id.
	 * @param options Lease, worker identity and step budget for this pass.
	 * @returns What this pass did.
	 * @throws NotFoundException when the operation does not exist inside the caller's scope.
	 */
	async resume(
		operationId: ID,
		options: IOperationExecutionOptions = {}
	): Promise<IOperationExecutionResult> {
		const operation = await this.requireInScope(operationId);

		if (isTerminalStatus(operation.status)) {
			return { operation, executedSteps: [], finished: true };
		}

		return this.execute(operationId, options);
	}

	/**
	 * Re-drives an operation that failed, under a fresh attempt budget.
	 *
	 * A resume continues an operation nobody finished; a retry is an operator saying the work may run
	 * again, and the two differ in exactly one thing: the budget. The steps the retry will run — every
	 * step the walk finds outstanding, plus the compensators that gave up — have their attempt counters
	 * reset, so the retry does not immediately exhaust the same budget the previous pass did.
	 *
	 * **Which walk runs falls out of the persisted step statuses, and that is the point.** An
	 * operation whose compensation finished has every completed step undone, so re-running it starts
	 * at the first step the walk finds outstanding — the plan again, on a clean aggregate. An
	 * operation that owes an undo is handed back to the compensation walk instead, because a step
	 * whose compensator gave up has already applied its effect and re-invoking the *step* is not what
	 * finishing that operation means. Nothing here decides which of the two it is: the rows do, by
	 * the same rule `execute` applies to every other pass.
	 *
	 * Two states are refused rather than re-driven. A completed operation has nothing to retry, and an
	 * operation a caller cancelled is not a failure: resurrecting work somebody deliberately abandoned
	 * is not what this door is for. An operation the runtime is still driving is refused as well — a
	 * retry releases the lease it finds, so driving one would take it away from the worker holding it,
	 * and the move for continuing an operation that has not stopped is `resume`, which waits for the
	 * lease instead of clearing it.
	 *
	 * @param operationId The operation id.
	 * @param options Lease, worker identity and step budget for this pass.
	 * @returns What the retry's pass did.
	 * @throws ConflictException when the operation completed, was cancelled by a caller, or is still
	 * being driven.
	 * @throws NotFoundException when the operation does not exist inside the caller's scope.
	 */
	async retry(operationId: ID, options: IOperationExecutionOptions = {}): Promise<IOperationExecutionResult> {
		const operation = await this.requireInScope(operationId);

		if (operation.status === OperationStatus.COMPLETED) {
			throw new ConflictException(`The operation "${operationId}" is completed and has nothing to retry.`);
		}

		if (operation.status === OperationStatus.CANCELED || operation.state?.cancelRequested) {
			throw new ConflictException(
				`The operation "${operationId}" was cancelled by a caller, and a retry does not undo that.`
			);
		}

		if (operation.status === OperationStatus.RUNNING || operation.status === OperationStatus.COMPENSATING) {
			throw new ConflictException(
				`The operation "${operationId}" is ${operation.status.toLowerCase()} and has not stopped; resume it instead.`
			);
		}

		const steps = await this.findSteps(operationId);
		const unpaid = steps.filter((step) => step.status === OperationStepStatus.COMPENSATION_FAILED);

		if (unpaid.length > 0) {
			// The undo is the outstanding work: the compensators that gave up get the fresh budget, and
			// the operation is stated as owing one — which is the status the platform gives a step whose
			// compensation failed, and the one `execute` hands straight to the compensation walk.
			for (const step of unpaid) {
				await this.saveStep(step, { attemptCount: 0, lastError: null });
			}

			await this.settle(operation, OperationStatus.FAILED, {});

			return this.execute(operationId, options);
		}

		for (const step of steps) {
			// A step the runtime will not invoke again on this walk keeps what it has: its record is the
			// plan's history, and a retry has nothing to grant it.
			if (step.status === OperationStepStatus.COMPLETED || step.status === OperationStepStatus.SKIPPED) {
				continue;
			}

			// Everything else is outstanding, and everything outstanding gets the fresh budget: `runStep`
			// counts the attempts a step has already made against its own budget, so a step whose budget
			// was spent could not run again without this — whether it failed, was left in flight by a
			// worker that died, or had its effect undone by the compensation walk.
			await this.saveStep(step, {
				// A step that failed applied nothing, so it is simply pending again; a step whose effect
				// was undone keeps that record until it is applied again.
				...(step.status === OperationStepStatus.FAILED ? { status: OperationStepStatus.PENDING } : {}),
				attemptCount: 0,
				lastError: null
			});
		}

		await this.settle(operation, OperationStatus.PENDING, {});

		return this.execute(operationId, options);
	}

	/**
	 * Requests cancellation.
	 *
	 * A cancellation is a request the runtime observes between steps, not a kill: an operation that
	 * applied nothing is cancelled outright, and one that already changed something is compensated,
	 * because leaving the aggregate half-changed is exactly what a cancellation must not do.
	 *
	 * **An operation another worker is driving is left to that worker.** Its step may be applying an
	 * effect right now, and nothing the step table says yet counts it: a step in flight is `RUNNING`, not
	 * `COMPLETED`. Settling such an operation `CANCELED` underneath the worker told the caller nothing
	 * was left behind while the step went on to apply its effect — and the worker, still holding a
	 * `RUNNING` object, then wrote that status back over the cancellation and ran the rest of the plan.
	 * So when a live lease belongs to somebody else, the request and its reason are recorded and the
	 * operation is answered as it stands; the worker reads both at its next check between steps and
	 * walks the undo itself, under the operator's reason (see {@link recordedCancellation}).
	 *
	 * @param operationId The operation id.
	 * @param options Worker identity and the reason an operator recorded.
	 * @returns The settled operation, or — while another worker holds it — the operation with the
	 * request recorded.
	 * @throws ConflictException when the operation already reached a terminal status.
	 * @throws NotFoundException when the operation does not exist inside the caller's scope.
	 */
	async cancel(
		operationId: ID,
		options: { ownerId?: string; reason?: string } = {}
	): Promise<Operation> {
		const operation = await this.requireInScope(operationId);

		if (isTerminalStatus(operation.status)) {
			throw new ConflictException(`The operation is ${operation.status.toLowerCase()} and cannot be cancelled.`);
		}

		// The flag is merged into the row's `state` as it stands under the lock, not into the copy read
		// above: a worker's step writes the same JSON column, and replacing it with this copy would drop
		// the progress that worker recorded in between. The terminal check is repeated there because the
		// row may have settled since it was read.
		const requested = await this.mergeOperation(operation, (row) => {
			if (isTerminalStatus(row.status)) {
				throw new ConflictException(`The operation is ${row.status.toLowerCase()} and cannot be cancelled.`);
			}

			return { state: { ...(row.state ?? {}), cancelRequested: true } };
		});

		const steps = await this.findSteps(operationId);
		const applied = steps.filter((step) => step.status === OperationStepStatus.COMPLETED);

		// The lease is judged on the row the flag was written to, so a worker that claims after it reads
		// the flag before its first step, and one that claimed before it is seen holding the lease here.
		if (applied.length === 0 && !this.isLeasedByAnother(requested, options.ownerId ?? '')) {
			return this.settle(requested, OperationStatus.CANCELED, {
				finishedAt: new Date(),
				result: { canceled: true, reason: options.reason ?? null, compensatedSteps: [], notCompensable: [] }
			});
		}

		// 🛑 **Written, not assigned.** `compensate` below re-reads the row through `claim()`, so a
		// reason left on this in-memory object was discarded before anything could read it: the walk
		// then found no error on a running operation and fell back to its own generic
		// `OPERATION_COMPENSATION_REQUESTED`, and both the REST read and the `operationFailed`
		// subscription reported "compensated on request" for a deliberate cancellation with an
		// operator's reason attached. A worker holding the lease reads it from the row as well.
		await this.mergeOperation(requested, () => ({
			lastError: JSON.stringify({
				code: 'OPERATION_CANCELED',
				message: options.reason ?? 'The operation was cancelled.',
				retryable: false
			})
		}));

		// While another worker holds the lease the claim inside refuses, and the walk is that worker's.
		return this.compensate(operationId, { ownerId: options.ownerId });
	}

	/**
	 * Walks backwards through the completed steps, running their compensators.
	 *
	 * The set is the steps whose status is `COMPLETED` — including steps completed by an earlier
	 * attempt or an earlier process — in strictly descending `order`. A compensator that fails is
	 * retried under its own policy and, if it still fails, the operation is still settled: the step is
	 * marked `COMPENSATION_FAILED` and named in the result, because the runtime never pretends the
	 * aggregate is clean.
	 *
	 * @param operationId The operation id.
	 * @param options Lease and worker identity.
	 * @returns The settled operation.
	 * @throws NotFoundException when the operation does not exist.
	 */
	async compensate(
		operationId: ID,
		options: IOperationExecutionOptions = {}
	): Promise<Operation> {
		const ownerId = options.ownerId ?? randomUUID();
		const leaseMs = options.leaseMs ?? OperationService.DEFAULT_LEASE_MS;

		let operation = await this.claim(operationId, ownerId, leaseMs);

		if (!operation) {
			return this.require(operationId);
		}

		if (operation.status !== OperationStatus.COMPENSATING) {
			operation = await this.beginCompensation(
				operation,
				parseOperationError(operation.lastError) ?? {
					code: 'OPERATION_COMPENSATION_REQUESTED',
					message: 'The operation was compensated on request.',
					retryable: false
				}
			);
		}

		const definition = this.registry.require(operation.type);
		const compensated: string[] = [];
		const skipped: string[] = [];
		const failures: string[] = [];

		// The walk settles with the cause it began with. Each compensator's lease renewal brings the
		// object up to the row, and a caller that asks for a cancellation while the undo is already
		// underway records its own reason there — which is not why this operation is being undone.
		const cause = parseOperationError(operation.lastError);

		const steps = (await this.findSteps(operationId))
			.filter(
				(step) =>
					step.status === OperationStepStatus.COMPLETED ||
					step.status === OperationStepStatus.COMPENSATION_FAILED
			)
			.sort((left, right) => right.order - left.order);

		for (const step of steps) {
			const stepDefinition = definition.steps.find((candidate) => candidate.name === step.name);

			if (!stepDefinition?.compensate) {
				// A non-compensable step is recorded as skipped and listed in the result, so an operator
				// can see exactly what was left behind instead of assuming the undo was complete.
				await this.saveStep(step, { status: OperationStepStatus.SKIPPED }, operation);
				skipped.push(step.name);
				continue;
			}

			const undone = await this.runCompensation(operation, step, stepDefinition, ownerId, leaseMs);

			if (undone) {
				compensated.push(step.name);
			} else {
				failures.push(step.name);
			}
		}

		const error: IOperationError = cause ?? {
			code: 'OPERATION_COMPENSATED',
			message: 'The operation was compensated.',
			retryable: false
		};

		if (failures.length) {
			error.compensationFailures = failures;
		}

		return this.settle(operation, OperationStatus.COMPENSATED, {
			finishedAt: new Date(),
			lastError: JSON.stringify(error),
			result: {
				error,
				compensatedSteps: compensated,
				notCompensable: skipped,
				compensationFailures: failures
			}
		});
	}

	/**
	 * Reads an operation by identifier alone, with no scope at all.
	 *
	 * **The unscoped reader, and it is unscoped deliberately.** The runtime reads an operation from a
	 * worker, a dispatcher and a resumption sweep, none of which has a credential: a scoped read there
	 * would answer nothing and the operation would never be executed. Every caller of this is a system
	 * path that already holds the identifier because the runtime gave it to it.
	 *
	 * 🛑 **It is therefore not the reader a request-facing move may use.** `cancel()`, `retry()` and
	 * `resume()` are reached from `POST /operations/:id/cancel` and `/retry` and from the three GraphQL
	 * mutations, which carry a credential and take the id from the caller; reading through this one let
	 * a user of one tenant compensate, re-drive or drive another tenant's saga. Those go through
	 * {@link requireInScope}.
	 *
	 * @param id The operation id.
	 * @returns The operation, or null.
	 */
	async findById(id: ID): Promise<Operation | null> {
		return this.typeOrmOperationRepository.findOne({ where: { id } as any });
	}

	/**
	 * The tenant the caller is acting in, which every management read below is narrowed by.
	 *
	 * **The tenant and not the organization, which is the platform's own reading of a resource's
	 * scope.** `TenantAwareCrudService` narrows by `tenantId` (plus the caller's employee where the
	 * table carries one) and by nothing else, and an operation is a row of that shape. Narrowing by
	 * the organization as well would hide the rows the kernel is free to write without one: an
	 * operation a step of another operation started runs in a worker, and a worker has no
	 * organization in its context unless the job carried one — and a management queue that silently
	 * drops rows is worse than one an operator of the tenant reads. The permission is a tenant-level
	 * one for the same reason: `OPERATIONS_VIEW` is granted to a role, not to an organization.
	 *
	 * The row's own tenancy is the `tenantId` column, which the partial indexes over this table
	 * already carry, so the narrowing costs no join. A member that no credential resolved is left out
	 * rather than written as `undefined`, because a repository handed an explicit `undefined` asks for
	 * the rows whose column *is* null — a different question from "do not narrow on this column" — and
	 * the reads that require a tenant refuse instead of asking it (see {@link scopeOfTheCaller}).
	 */
	protected get scope(): Partial<Pick<Operation, 'tenantId'>> {
		const tenantId = RequestContext.currentTenantId();

		return {
			...(tenantId ? { tenantId } : {})
		};
	}

	/**
	 * The operations of the caller's own scope, narrowed by the caller's own criterion.
	 *
	 * The management read of this resource, and the one the REST list route and the GraphQL connection
	 * both answer from: one read, one scope, two protocols. The default order is the queue's own —
	 * newest first, the operation an operator has just started or the one that just failed — and it is
	 * the read's rather than a surface's, so the two surfaces list the same rows in the same order. A
	 * caller that states its own `order` keeps it.
	 *
	 * @param options Find options, as the caller states them.
	 * @returns The operations the caller's scope holds.
	 */
	async listOperations(options: FindManyOptions<Operation> = {}): Promise<Operation[]> {
		const scope = this.scopeOfTheCaller();

		if (!scope) {
			return [];
		}

		return this.find({
			order: { createdAt: 'DESC' },
			...options,
			where: withScope(options.where, scope)
		} as never);
	}

	/**
	 * The operations of one aggregate, newest first.
	 *
	 * The exclusivity rule's own read, widened: at most one of these is live at a time, and the rest is
	 * the aggregate's history — which is what an operator looking at a cart, an order or a subscription
	 * asks for, and what the single-live-operation lock leaves behind when it refuses a second one.
	 *
	 * @param aggregateType The aggregate kind, for example `order`.
	 * @param aggregateId Id of the aggregate.
	 * @returns The operations of that aggregate, newest first.
	 */
	async findByAggregate(aggregateType: string, aggregateId: ID): Promise<Operation[]> {
		const scope = this.scopeOfTheCaller();

		if (!scope) {
			return [];
		}

		return this.find({
			where: { aggregateType, aggregateId, ...scope },
			order: { createdAt: 'DESC' }
		} as never);
	}

	/**
	 * Reads one operation of the caller's own scope, answering null when there is none.
	 *
	 * @param id The operation id.
	 * @returns The operation, or null.
	 */
	async findOperation(id: ID): Promise<Operation | null> {
		const scope = this.scopeOfTheCaller();

		if (!scope) {
			return null;
		}

		const operations = await this.find({ where: { id, ...scope } } as never);

		return operations.length > 0 ? operations[0] : null;
	}

	/**
	 * The scope of the caller, or `undefined` when no credential resolved one.
	 *
	 * The management reads answer nothing without it rather than everything: they are reachable only
	 * through a guarded surface, so a caller that reaches them with no tenant is a caller whose
	 * guards did not run — and a read that invented a scope for it would be a second authorisation
	 * model sitting beside the guards.
	 *
	 * @returns The scope, or undefined.
	 */
	private scopeOfTheCaller(): FindOptionsWhere<Operation> | undefined {
		const scope = this.scope;

		return scope.tenantId ? (scope as FindOptionsWhere<Operation>) : undefined;
	}

	/**
	 * The steps of several operations, in execution order.
	 *
	 * The batched spelling of {@link findSteps}, for a reader that answers the steps of many operations
	 * in one response — a connection of operations, each selecting its own plan. One query for the set
	 * rather than one per row is what keeps a page of them from being a page of round trips.
	 *
	 * @param operationIds The operations whose steps are read.
	 * @returns The steps of all of them, ascending by `order`.
	 */
	async findStepsForOperations(operationIds: readonly ID[]): Promise<OperationStep[]> {
		if (!operationIds.length) {
			return [];
		}

		return this.typeOrmOperationStepRepository.find({
			where: { operationId: In([...operationIds]) } as any,
			order: { order: 'ASC' } as any
		});
	}

	/**
	 * Finds the operation a retried submission refers to.
	 *
	 * 🛑 **Scoped by tenant, and it narrows rather than widens when there is none.** This read feeds
	 * the write path — `start()` returns whatever it answers as `{ created: false }` — and it carried no
	 * tenant at all, only `organizationId: RequestContext.currentOrganizationId()`. That is `null` for a
	 * worker, a job, or any credential with no organization selected, which the connection's
	 * `null: 'sql-null'` setting reads as `"organizationId" IS NULL`: every tenant's
	 * organization-less rows. `idempotencyKey` is caller-supplied, so another tenant's operation — its
	 * `input` JSON, its aggregate, its error — was returned to a caller that named its key, and that
	 * caller's own work silently never started.
	 *
	 * A lookup with no tenant asks for the tenant-less rows (`"tenantId" IS NULL`), which are the rows
	 * an insert with no tenant writes: the read that decides whether an operation already exists and
	 * the insert that creates one stay in the same scope, and neither can reach a tenant's row. The
	 * organization is stated as `IsNull()` rather than as a possibly-`null` value for the same reason:
	 * "the column is null" is the question, and it is spelled as one.
	 *
	 * **The index selects by the same tuple.** `UQ_operation_tenant_idem` is
	 * `(COALESCE("tenantId", <zero uuid>), COALESCE("organizationId", <zero uuid>), "type",
	 * "idempotencyKey")` while a key is set, so the rows this read can find are exactly the rows that
	 * can refuse the insert after it. The index it replaced in `1791000000557`, `UQ_operation_idem`,
	 * folded the organization alone: two tenants whose callers had no organization shared a tuple, this
	 * read missed the foreign row, and the insert was then refused by it — a `409` for a key the caller
	 * had never used.
	 *
	 * @param type The operation type.
	 * @param idempotencyKey The caller-supplied key.
	 * @param scope The tenant and organization to look within; defaults to the request context's.
	 * @returns The operation, or null when the key has never been used for this type in that scope.
	 */
	async findByIdempotencyKey(
		type: string,
		idempotencyKey: string,
		scope: { tenantId?: ID | null; organizationId?: ID | null } = {}
	): Promise<Operation | null> {
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		return this.typeOrmOperationRepository.findOne({
			where: {
				type,
				idempotencyKey,
				tenantId: tenantId ? tenantId : IsNull(),
				organizationId: organizationId ? organizationId : IsNull()
			} as FindOptionsWhere<Operation>
		});
	}

	/**
	 * Finds the live operation of an aggregate.
	 *
	 * This is the exclusivity rule the unique index enforces: at most one of `PENDING`, `RUNNING` or
	 * `COMPENSATING` per aggregate, so two concurrent checkouts of one cart — or two captures of one
	 * order — cannot both proceed.
	 *
	 * 🛑 **Scoped by tenant for the same reason {@link findByIdempotencyKey} is.** The read had no
	 * tenant predicate, so any caller that knew — or guessed — an aggregate id read the other tenant's
	 * live operation, and `start()` handed that row back as the answer to its own submission. The
	 * aggregate id is a uuid and therefore globally unique in practice, which is why the index needs
	 * no tenant; a *read* that feeds an answer to a caller is a different question from an index, and
	 * it needs one. With no tenant it asks for the tenant-less rows, as the idempotency lookup does.
	 *
	 * @param aggregateType The aggregate kind.
	 * @param aggregateId Id of the aggregate.
	 * @param scope The tenant to look within; defaults to the request context's.
	 * @returns The live operation, or null.
	 */
	async findLiveForAggregate(
		aggregateType: string,
		aggregateId: ID,
		scope: { tenantId?: ID | null } = {}
	): Promise<Operation | null> {
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const query = this.typeOrmOperationRepository
			.createQueryBuilder('operation')
			.where('operation.aggregateType = :aggregateType', { aggregateType })
			.andWhere('operation.aggregateId = :aggregateId', { aggregateId })
			.andWhere('operation.status IN (:...statuses)', { statuses: LIVE_STATUSES });

		return (
			tenantId
				? query.andWhere('operation.tenantId = :tenantId', { tenantId })
				: query.andWhere('operation.tenantId IS NULL')
		).getOne();
	}

	/**
	 * Reads the steps of an operation in execution order.
	 *
	 * @param operationId The operation id.
	 * @returns The steps, ascending by `order`.
	 */
	async findSteps(operationId: ID): Promise<OperationStep[]> {
		return this.typeOrmOperationStepRepository.find({
			where: { operationId } as any,
			order: { order: 'ASC' } as any
		});
	}

	/**
	 * Reads an operation or fails, with no scope.
	 *
	 * The runtime's reader: `execute`, `compensate` and `renewLease` run on a worker or a sweep, which
	 * holds no credential and therefore resolves no tenant, and a scoped read there would answer nothing
	 * and the operation would never be driven. Every caller of this already holds the identifier
	 * because the runtime handed it over.
	 *
	 * A move a *request* reaches uses {@link requireInScope} instead.
	 *
	 * @param id The operation id.
	 * @returns The operation.
	 * @throws NotFoundException when it does not exist.
	 */
	private async require(id: ID): Promise<Operation> {
		const operation = await this.findById(id);

		if (!operation) {
			throw new NotFoundException(`The operation "${id}" does not exist.`);
		}

		return operation;
	}

	/**
	 * Reads an operation the caller is allowed to move, or fails.
	 *
	 * 🛑 **The reader every request-facing move uses.** `cancel()`, `retry()` and `resume()` are reached
	 * from `POST /operations/:id/cancel`, `POST /operations/:id/retry` and the `cancelOperation`,
	 * `retryOperation` and `resumeOperation` mutations, and none of those re-checks the scope of the id
	 * it was handed. Reading through the unscoped {@link require} let a user of tenant A, holding
	 * nothing but `OPERATIONS_CANCEL` in their own tenant, cancel tenant B's running order saga — its
	 * completed steps compensated and its aggregate rolled back by a stranger — drive B's interrupted
	 * one onwards, or re-drive B's failed one under a fresh attempt budget. The read routes were
	 * already scoped through {@link findOperation}; this is the same scope, applied to the moves.
	 *
	 * The row is read through the runtime's own repository rather than through the ORM-dispatching
	 * {@link findOperation}, because the move that follows writes it back through that repository: the
	 * object it acts on is the same kind of object whichever ORM serves the management reads.
	 *
	 * **Only the runtime itself reads unscoped.** A caller with no user at all is a worker or a sweep —
	 * a parent operation cancelling the child it started, a recovery pass resuming what it found
	 * stalled — and it keeps the unscoped read those paths need. A caller that *is* signed in but
	 * resolved no tenant is refused rather than widened: the guards in front of these moves refuse such
	 * a request, so reaching here with one means the guards did not run.
	 *
	 * The refusal is a `404` and not a `403`, because a caller is never told that another tenant holds
	 * the identifier it asked about.
	 *
	 * @param id The operation id.
	 * @returns The operation.
	 * @throws NotFoundException when no operation of that id is in the caller's scope.
	 */
	private async requireInScope(id: ID): Promise<Operation> {
		const scope = this.scopeOfTheCaller();

		if (!scope && !RequestContext.currentUser()) {
			return this.require(id);
		}

		const operation = scope
			? await this.typeOrmOperationRepository.findOne({ where: { id, ...scope } as FindOptionsWhere<Operation> })
			: null;

		if (!operation) {
			throw new NotFoundException(`The operation "${id}" does not exist.`);
		}

		return operation;
	}

	/**
	 * Runs one step, with its retry policy and its timeout.
	 *
	 * @param operation The operation.
	 * @param step The persisted step.
	 * @param definition The registered handler.
	 * @param ownerId The lease holder.
	 * @param leaseMs The lease window.
	 * @returns The operation after the attempt, and the failure when the step could not complete.
	 */
	private async runStep(
		operation: Operation,
		step: OperationStep,
		definition: IOperationStepDefinition,
		ownerId: string,
		leaseMs: number
	): Promise<{ operation: Operation; failure?: IOperationError }> {
		const retry = definition.retry;
		const maxAttempts = Math.max(1, retry?.maxAttempts ?? 1);
		const variables = asRecord(operation.state?.variables);

		let attempt = step.attemptCount ?? 0;
		let current = operation;
		let failure: IOperationError | undefined;

		// The row says RUNNING before the handler is invoked, so a crash mid-step is visible as a step
		// that was attempted rather than one that never started.
		await this.saveStep(step, { status: OperationStepStatus.RUNNING, startedAt: new Date() }, operation);

		while (attempt < maxAttempts) {
			attempt += 1;

			try {
				current = await this.renewLease(current, ownerId, leaseMs);

				const context = this.createStepContext(current, step, attempt, variables);
				const input = await this.resolveStepInput(current, step);
				const result = await this.runWithTimeout(
					Promise.resolve(definition.invoke(input, context)),
					definition.timeoutMs,
					step.name
				);

				// A step that returned nothing performed its effect without producing output, which is
				// not a failure: the empty result stands in for it and the columns take their defaults.
				const outcome: IOperationStepResult = isStepResult(result) ? result : {};

				// The output and the compensator's data are persisted in one write: a step that applied
				// an effect must never be recorded as successful without what it takes to undo it.
				await this.saveStep(
					step,
					{
						status: OperationStepStatus.COMPLETED,
						attemptCount: attempt,
						input,
						output: outcome.output ?? {},
						compensationData: outcome.compensationData ?? null,
						finishedAt: new Date(),
						lastError: null
					},
					current
				);

				return { operation: await this.recordStepSuccess(current, step, variables) };
			} catch (error) {
				failure = toOperationError(error, step.name);

				if (failure.retryable === false || attempt >= maxAttempts) {
					break;
				}

				await this.wait(stepBackoff(retry, attempt));
			}
		}

		failure = failure ?? {
			code: 'OPERATION_STEP_FAILED',
			message: `The step "${step.name}" did not complete.`,
			stepName: step.name,
			retryable: false
		};

		await this.saveStep(
			step,
			{
				status: OperationStepStatus.FAILED,
				attemptCount: attempt,
				finishedAt: new Date(),
				lastError: JSON.stringify(failure)
			},
			current
		);

		// 🛑 **Merged, not saved back.** `current` is the row as it was when this attempt renewed its
		// lease, and a caller may have cancelled since: saving the object whole put its flag-less `state`
		// over `state.cancelRequested` and the step's error over the operator's reason, so the undo that
		// follows was recorded as a plain failure and `retry()` re-drove work a caller had abandoned. Only
		// the two columns this failure owns are written, from the row as it stands; the step's own error
		// is on the step's row, written just above, whichever reason the operation keeps.
		const failed = await this.mergeOperation(current, (row) => ({
			lastError: recordedCancellation(row) ? row.lastError : JSON.stringify(failure),
			attemptCount: (row.attemptCount ?? 0) + 1
		}));

		return { operation: failed, failure };
	}

	/**
	 * Runs one step's compensator, with the step's retry policy.
	 *
	 * A compensation may itself be retried and must therefore tolerate being called twice: releasing
	 * an already released reservation is a no-op that reports success.
	 *
	 * @param operation The operation.
	 * @param step The persisted step.
	 * @param definition The registered handler.
	 * @param ownerId The lease holder.
	 * @param leaseMs The lease window.
	 * @returns True when the step was undone, false when the compensator gave up.
	 */
	private async runCompensation(
		operation: Operation,
		step: OperationStep,
		definition: IOperationStepDefinition,
		ownerId: string,
		leaseMs: number
	): Promise<boolean> {
		const retry = definition.retry;
		const maxAttempts = Math.max(1, retry?.maxAttempts ?? 1);
		const variables = asRecord(operation.state?.variables);

		let attempt = 0;
		let failure: IOperationError | undefined;

		await this.saveStep(step, { status: OperationStepStatus.COMPENSATING }, operation);

		while (attempt < maxAttempts) {
			attempt += 1;

			try {
				await this.renewLease(operation, ownerId, leaseMs);

				const context = this.createStepContext(operation, step, attempt, variables);

				await this.runWithTimeout(
					Promise.resolve(definition.compensate!(step.compensationData, context)),
					definition.timeoutMs,
					step.name
				);

				await this.saveStep(
					step,
					{
						status: OperationStepStatus.COMPENSATED,
						attemptCount: attempt,
						finishedAt: new Date(),
						lastError: null
					},
					operation
				);

				return true;
			} catch (error) {
				failure = toOperationError(error, step.name);

				if (failure.retryable === false || attempt >= maxAttempts) {
					break;
				}

				await this.wait(stepBackoff(retry, attempt));
			}
		}

		// The aggregate is dirty for exactly this step, and both the step row and the operation's
		// result say so.
		await this.saveStep(
			step,
			{
				status: OperationStepStatus.COMPENSATION_FAILED,
				attemptCount: attempt,
				finishedAt: new Date(),
				lastError: JSON.stringify(failure)
			},
			operation
		);

		return false;
	}

	/**
	 * Settles a fully executed operation.
	 *
	 * @param operation The operation.
	 * @param executedSteps The steps this pass completed.
	 * @returns The completed operation.
	 */
	private async complete(operation: Operation, executedSteps: string[]): Promise<Operation> {
		const steps = await this.findSteps(operation.id as ID);
		const last = steps
			.filter((step) => step.status === OperationStepStatus.COMPLETED)
			.sort((left, right) => right.order - left.order)[0];

		return this.settle(operation, OperationStatus.COMPLETED, {
			finishedAt: new Date(),
			lastError: null,
			result: { steps: executedSteps, output: last?.output ?? {} }
		});
	}

	/**
	 * Moves a failed operation into compensation.
	 *
	 * **The operator's reason outranks the runtime's.** When a caller asked for the cancellation and
	 * recorded why, that `OPERATION_CANCELED` is what the operation is undone under, whatever the runtime
	 * found — its own "cancelled before the next step", a step that failed after the request landed, a
	 * deadline. Writing `failure` regardless replaced the words an operator typed with a generic message
	 * whenever a worker, rather than `cancel()` itself, was the one that noticed. The choice is made on
	 * the row under its lock, so a reason recorded after this worker last read the row still wins.
	 *
	 * @param operation The operation.
	 * @param failure What the runtime found.
	 * @returns The operation, now compensating.
	 */
	private async beginCompensation(operation: Operation, failure: IOperationError): Promise<Operation> {
		return this.settle(operation, OperationStatus.COMPENSATING, (row) => ({
			lastError: JSON.stringify(recordedCancellation(row) ?? failure)
		}));
	}

	/**
	 * Writes a status transition, refusing an illegal one.
	 *
	 * Every status an operation settles into passes through here, which is why the two operation-level
	 * facts are announced from this one place: an operation that reached a terminal status says so
	 * once, whichever walk brought it there, and the announcement is made after the write rather than
	 * before it — a subscriber is told what happened, never what is about to.
	 *
	 * **The edge is judged on the row, under its lock**, not on the status of the object the caller
	 * holds. A worker's object says `RUNNING` for as long as its step runs, so an edge judged on it after
	 * somebody else settled the row — a cancellation, a takeover — passed as `RUNNING → COMPENSATING` and
	 * wrote `COMPENSATING` over a `CANCELED` operation, an edge the machine does not have. Now that write
	 * is refused as the illegal transition it is, and nothing is written.
	 *
	 * @param operation The operation.
	 * @param status The status to move to.
	 * @param patch Columns to write with the status, or a function of the row that computes them.
	 * @returns The saved operation.
	 * @throws OperationIllegalTransitionError when the edge is not in the state machine.
	 */
	private async settle(
		operation: Operation,
		status: OperationStatus,
		patch: Record<string, unknown> | ((row: Operation) => Record<string, unknown>)
	): Promise<Operation> {
		let from = operation.status;

		const saved = await this.mergeOperation(operation, (row) => {
			from = row.status;

			if (from !== status && !(LEGAL_TRANSITIONS[from] ?? []).includes(status)) {
				throw new OperationIllegalTransitionError(from, status);
			}

			// A settled operation holds no lease: leaving one behind would make a finished operation look
			// busy to the recovery scan, and the table's own `CHK_operation_status_terminal` refuses it.
			return { ...(typeof patch === 'function' ? patch(row) : patch), status, ...OperationService.NO_LEASE };
		});

		if (saved.status !== from) {
			await this.announceSettlement(saved);
		}

		return saved;
	}

	/**
	 * Announces where an operation has arrived, when the move is one a subscriber can act on.
	 *
	 * Three statuses are facts a client waits for: an operation that completed, an operation that
	 * entered the compensation walk, and an operation that finished compensating or was cancelled.
	 * The rest of the machine is progress rather than outcome — a plan that became executable again
	 * is reported by the retry's own answer and by the step stream — so it is deliberately silent.
	 *
	 * A cancellation arrives on the failure stream, and that is the honest reading of the three facts
	 * the design names: there is no `operationCanceled` stream, and an operation a caller cancelled is
	 * one that will not do what it was started to do. The payload says which it was — its `status` is
	 * `CANCELED` — so a client never has to infer it from the stream's name.
	 *
	 * @param operation The settled operation.
	 */
	private async announceSettlement(operation: Operation): Promise<void> {
		switch (operation.status) {
			case OperationStatus.COMPLETED:
				await this.operationEventPublisher.operationCompleted(operation);
				return;
			case OperationStatus.COMPENSATING:
				await this.operationEventPublisher.operationFailed(operation, 'compensating');
				return;
			case OperationStatus.FAILED:
				await this.operationEventPublisher.operationFailed(operation, 'failed');
				return;
			case OperationStatus.COMPENSATED:
				await this.operationEventPublisher.operationFailed(operation, 'compensated');
				return;
			case OperationStatus.CANCELED:
				await this.operationEventPublisher.operationFailed(operation, 'canceled');
				return;
			default:
				// `PENDING` and `RUNNING` are the two the runtime moves an operation through on its way
				// to one of the facts above, and neither is a fact of its own.
				return;
		}
	}

	/**
	 * Releases the lease without settling the operation.
	 *
	 * @param operation The operation.
	 * @returns The saved operation.
	 */
	private async releaseLease(operation: Operation): Promise<Operation> {
		return this.mergeOperation(operation, () => ({ ...OperationService.NO_LEASE }));
	}

	/**
	 * Extends the lease, and refuses to continue when it is no longer ours.
	 *
	 * The check and the renewal are one decision under the row's lock, and only the three lease columns
	 * are written: the rest of the row is whoever wrote it last, and a cancellation among it has to reach
	 * the step this renewal is about to start rather than be saved over by it.
	 *
	 * @param operation The operation, brought up to the stored row in place.
	 * @param ownerId The worker identity.
	 * @param leaseMs The lease window.
	 * @returns The reloaded operation.
	 * @throws OperationLeaseLostError when another worker has taken the operation over.
	 * @throws NotFoundException when the operation no longer exists.
	 */
	private async renewLease(operation: Operation, ownerId: string, leaseMs: number): Promise<Operation> {
		return this.mergeOperation(operation, (row) => {
			if (row.lockedBy && row.lockedBy !== ownerId) {
				throw new OperationLeaseLostError(row.id as ID, ownerId, row.lockedBy);
			}

			return this.leaseOf(ownerId, leaseMs);
		});
	}

	/**
	 * The columns that take a lease, as one patch.
	 *
	 * @param ownerId The worker taking it.
	 * @param leaseMs How long it is valid.
	 * @returns The three columns the lease is.
	 */
	private leaseOf(ownerId: string, leaseMs: number): Pick<Operation, 'lockedAt' | 'lockedBy' | 'leaseExpiresAt'> {
		const now = Date.now();

		return { lockedAt: new Date(now), lockedBy: ownerId, leaseExpiresAt: new Date(now + leaseMs) };
	}

	/**
	 * Whether a live lease on the row belongs to somebody else.
	 *
	 * The two halves are stated separately because they answer different questions: a lease held by
	 * *this* worker is the worker resuming its own operation, which is allowed, while a lease held by
	 * another worker is only respected while it has not lapsed.
	 *
	 * @param operation The row as it was read inside the transaction.
	 * @param ownerId The worker asking.
	 * @returns Whether the operation is held by another worker whose lease is still valid.
	 */
	private isLeasedByAnother(operation: Operation, ownerId: string): boolean {
		if (!operation.lockedBy || operation.lockedBy === ownerId) {
			return false;
		}

		return Boolean(operation.leaseExpiresAt && new Date(operation.leaseExpiresAt).getTime() > Date.now());
	}

	/**
	 * Records a step's output and the variables it mutated on the operation.
	 *
	 * 🛑 **Merged into the row as it stands, not saved from the object the step started with.** That
	 * object was read when the attempt renewed its lease, and a caller's `cancel()` writes the same row
	 * while the step runs. Saving it whole — TypeORM's `save` writes every column that differs from the
	 * row — replaced `state` with a copy that had no `cancelRequested` and cleared the operator's
	 * `OPERATION_CANCELED` reason, so the cancellation was lost: the next check between steps passed, the
	 * rest of the plan ran, and `retry()`, whose refusal reads the flag, would re-drive the operation.
	 * Now the keys this step owns are merged into the stored `state`, beside whatever else is there.
	 *
	 * @param operation The operation.
	 * @param step The step that completed.
	 * @param variables The shared variables, as the step left them.
	 * @returns The saved operation.
	 */
	private async recordStepSuccess(
		operation: Operation,
		step: OperationStep,
		variables: Record<string, unknown>
	): Promise<Operation> {
		return this.mergeOperation(operation, (row) => ({
			// A success clears the error an earlier attempt left behind — never the reason a caller gave
			// for cancelling, which is what the next check between steps answers with.
			lastError: recordedCancellation(row) ? row.lastError : null,
			startedAt: row.startedAt ?? new Date(),
			state: {
				...(row.state ?? {}),
				cursor: step.order,
				// The output is merged into the operation's state so a later step receives it, and the
				// variables travel with it: one write, so a crash cannot persist one without the other.
				stepOutputs: { ...asRecord(row.state?.stepOutputs), [step.name]: step.output ?? {} },
				variables
			}
		}));
	}

	/**
	 * Builds the input a step receives.
	 *
	 * Inputs are explicit: a step gets the operation's input, the shared variables and the outputs of
	 * the steps before it, and nothing else. A step that read the database for state it was not given
	 * would make the operation unreconstructible from its own rows.
	 *
	 * @param operation The operation.
	 * @param step The step about to run.
	 * @returns The resolved input.
	 */
	private async resolveStepInput(operation: Operation, step: OperationStep): Promise<Record<string, unknown>> {
		const steps = await this.findSteps(operation.id as ID);
		const outputs: Record<string, unknown> = {};

		for (const candidate of steps) {
			if (candidate.name !== step.name && candidate.status === OperationStepStatus.COMPLETED) {
				outputs[candidate.name] = candidate.output ?? {};
			}
		}

		return {
			...asRecord(operation.input),
			variables: asRecord(operation.state?.variables),
			outputs
		};
	}

	/**
	 * Builds the context a step runs with.
	 *
	 * @param operation The operation.
	 * @param step The step.
	 * @param attempt The 1-based attempt.
	 * @param variables The shared variables.
	 * @returns The context.
	 */
	private createStepContext(
		operation: Operation,
		step: OperationStep,
		attempt: number,
		variables: Record<string, unknown>
	): IOperationStepContext {
		const operationId = operation.id as ID;
		// The answer the check starts from, and the moment it was read. The operation this attempt was
		// handed was read from the row when the attempt renewed its lease, so it is a fresh start.
		let cancelSnapshot = operation.state?.cancelRequested === true;
		let snapshotTakenAt = Date.now();

		return {
			operationId,
			stepName: step.name,
			attempt,
			// Stable across the retries of this step and across processes, so a step that calls a provider
			// passes it as the provider's own idempotency key and a step that writes locally guards on it.
			idempotencyKey: `${operationId}:${step.name}`,
			manager: this.typeOrmOperationRepository.manager,
			logger: this.stepLogger(operationId, step.name, attempt),
			variables,
			deadlineAt: operation.deadlineAt ? new Date(operation.deadlineAt) : undefined,
			// 🛑 **Read from the store, not from the object the step started with.** `cancel()` writes
			// `state.cancelRequested` onto a row it loaded itself, so a closure over the operation this
			// attempt was handed answered `false` for the whole run: a step declaring a ten-minute
			// timeout and polling this every second never saw a cancellation an operator requested two
			// minutes in, ran to completion and applied its full effect. The contract calls this "steps
			// check it at safe points", and a safe point is worth nothing if the answer is a constant.
			//
			// The read is cached for {@link CANCEL_CHECK_INTERVAL_MS} so that a polling loop costs one
			// query per interval rather than one per iteration, and a failed read keeps the last answer:
			// a store that cannot be reached is not a cancellation, and inventing one would abandon work
			// nobody asked to stop. The read is the runtime's unscoped one, because a step runs on a
			// worker that holds no credential.
			cancelRequested: async (): Promise<boolean> => {
				if (Date.now() - snapshotTakenAt < OperationService.CANCEL_CHECK_INTERVAL_MS) {
					return cancelSnapshot;
				}

				snapshotTakenAt = Date.now();

				try {
					const row = await this.findById(operationId);

					cancelSnapshot = row?.state?.cancelRequested === true || row?.status === OperationStatus.CANCELED;
				} catch (error) {
					this.logger.warn(
						`operation=${operationId} step=${step.name} the cancellation flag could not be read (${
							error instanceof Error ? error.message : String(error)
						}); the last known answer stands.`
					);
				}

				return cancelSnapshot;
			}
		};
	}

	/**
	 * Builds a logger pre-populated with the operation's correlation fields.
	 *
	 * @param operationId The operation id.
	 * @param stepName The step name.
	 * @param attempt The 1-based attempt.
	 * @returns The logger.
	 */
	private stepLogger(operationId: ID, stepName: string, attempt: number): IOperationLogger {
		const logger = new Logger('OperationService');
		const prefix = `operation=${operationId} step=${stepName} attempt=${attempt}`;
		const line = (message: string, meta?: Record<string, unknown>): string =>
			meta ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;

		return {
			info: (message, meta) => logger.log(line(message, meta)),
			warn: (message, meta) => logger.warn(line(message, meta)),
			error: (message, meta) => logger.error(line(message, meta))
		};
	}

	/**
	 * Decides whether the next step may start.
	 *
	 * @param operation The operation.
	 * @returns The reason not to continue, or undefined.
	 */
	private checkBeforeStep(operation: Operation): IOperationError | undefined {
		if (operation.state?.cancelRequested) {
			// The operator's own reason when `cancel()` recorded one; the generic message only when it
			// did not get that far.
			return (
				recordedCancellation(operation) ?? {
					code: 'OPERATION_CANCELED',
					message: 'The operation was cancelled before the next step.',
					retryable: false
				}
			);
		}

		if (operation.deadlineAt && new Date(operation.deadlineAt).getTime() <= Date.now()) {
			// The deadline is checked before a step, never during one: a step already running is bounded
			// by its own timeout, and killing it would leave an unknown amount of external effect behind.
			return {
				code: 'DEADLINE_EXCEEDED',
				message: 'The operation passed its deadline and was not continued.',
				retryable: false
			};
		}

		return undefined;
	}

	/**
	 * Bounds one attempt.
	 *
	 * @param work The handler's promise.
	 * @param timeoutMs The step's timeout, when it declares one.
	 * @param stepName The step name, for the error.
	 * @returns The handler's result.
	 */
	private async runWithTimeout<T>(work: Promise<T>, timeoutMs: number | undefined, stepName: string): Promise<T> {
		if (!timeoutMs || timeoutMs <= 0) {
			return work;
		}

		let timer: ReturnType<typeof setTimeout> | undefined;

		const timeout = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(() => {
				const error = new Error(`The step "${stepName}" did not finish within ${timeoutMs} ms.`);
				Object.assign(error, { code: 'STEP_TIMEOUT', retryable: true });
				reject(error);
			}, timeoutMs);
		});

		try {
			// A timed-out attempt is abandoned rather than cancelled — the handler keeps running — which
			// is precisely why a step carries its idempotency key to whatever it calls.
			return await Promise.race([work, timeout]);
		} finally {
			if (timer) {
				clearTimeout(timer);
			}
		}
	}

	/**
	 * Writes a step row.
	 *
	 * The one place a step moves, which is why the step-changed fact is announced from here rather
	 * than from each of the callers: every write of a step status — a start, a success, a failure, the
	 * compensation walk — passes through this method, so no path can move a step without a subscriber
	 * hearing about it, and none can announce one twice.
	 *
	 * @param step The step, mutated in place so callers see what was stored.
	 * @param values The columns to write.
	 * @param operation The operation the step belongs to, when the caller holds it. A write that
	 * states no operation is a bookkeeping write — a budget reset — rather than a move, and announces
	 * nothing: the step did not run, so there is no fact.
	 * @returns The saved step.
	 */
	private async saveStep(
		step: OperationStep,
		values: Record<string, unknown>,
		operation?: Operation
	): Promise<OperationStep> {
		Object.assign(step, values);

		const saved = await this.typeOrmOperationStepRepository.save(step);

		if (operation) {
			await this.operationEventPublisher.operationStepChanged(operation, saved, stepActionOf(saved.status));
		}

		return saved;
	}

	/**
	 * Writes the columns a move owns onto an operation row, and no other column.
	 *
	 * 🛑 **Every write of the row after `start` comes through here, because saving an object back loses
	 * updates.** A worker holds the object it read when it renewed its lease for as long as its step runs,
	 * and `cancel()` writes the same row from another request in between. The step's writes used to save
	 * that object whole, and TypeORM's `save` writes every column that differs from the row: the worker's
	 * stale `state` went over `state.cancelRequested`, its stale `lastError` over the operator's
	 * `OPERATION_CANCELED` reason, and its `RUNNING` over a `CANCELED` status.
	 *
	 * So a move names only its own columns, computed from the row **as it stands now**: the row is read
	 * under its write lock — `FOR UPDATE` on Postgres and MySQL; the embedded dialect serializes writers,
	 * so there the transaction is the lock, as in {@link claim} — `merge` computes the patch from that
	 * read, and one `UPDATE` sets exactly the patch's columns. A column another writer owns is never
	 * written back, and `state`, the one column two writers share, is merged key by key instead of
	 * replaced. `merge` may refuse by throwing, and then nothing is written.
	 *
	 * **Each ORM writes through its own arm.** `@MultiORMColumn` registers only the active ORM's column,
	 * so under `DB_ORM=mikro-orm` TypeORM carries no metadata for the columns this table declares with it,
	 * and a TypeORM `update` could not name them. Neither arm goes through `CrudService.update`, which
	 * answers a failed write as a client's `400`: a runtime write that fails is a server fault and
	 * surfaces as one.
	 *
	 * @param operation The operation, brought up to the stored row in place so the caller sees what was
	 * stored.
	 * @param merge The columns to write, computed from the row as it stands under the lock.
	 * @returns The operation, as stored.
	 * @throws NotFoundException when the row no longer exists.
	 */
	private async mergeOperation(
		operation: Operation,
		merge: (row: Operation) => Record<string, unknown>
	): Promise<Operation> {
		const id = operation.id as ID;
		const locking = isPostgres() || isMySQL();

		const { row, patch } =
			this.ormType === MultiORMEnum.MikroORM
				? await this.mikroOrmOperationRepository.getEntityManager().transactional(async (em) => {
						// Read from the table, not from an identity map. The transaction's fork starts from
						// the caller's context, where an earlier read of this row may still sit, and without a
						// lock mode — the embedded dialect — MikroORM answers a primary-key read from it
						// without a query: the patch would be computed from the stale row this method exists
						// to stop writing from. Nor is the row left managed, so nothing is merged back into
						// the caller's context when the transaction ends.
						const row = await em.findOne(Operation, { id } as FilterQuery<Operation>, {
							disableIdentityMap: true,
							...(locking ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {})
						});

						if (!row) {
							throw new NotFoundException(`The operation "${id}" does not exist.`);
						}

						const patch = merge(row);

						if (Object.keys(patch).length) {
							// `nativeUpdate` sets exactly these columns. It runs no `onUpdate` hook, so the
							// audit column TypeORM's `update` maintains is stated here.
							await em.nativeUpdate(
								Operation,
								{ id } as FilterQuery<Operation>,
								{ ...patch, updatedAt: new Date() } as EntityData<Operation>
							);
						}

						// The caller's object takes the row's columns, as the TypeORM arm's read answers
						// them: a relation MikroORM hydrates as a reference or an uninitialised collection is
						// not part of the row this decision was made on.
						const columns = em
							.getMetadata()
							.get<Operation>(Operation.name)
							.props.filter((prop) => prop.kind === ReferenceKind.SCALAR && row[prop.name] !== undefined)
							.map((prop) => [prop.name, row[prop.name]]);

						return { row: Object.fromEntries(columns) as Partial<Operation>, patch };
				  })
				: await this.typeOrmOperationRepository.manager.transaction(async (manager) => {
						const query = manager.createQueryBuilder(Operation, 'operation').where({ id });
						const row = locking ? await query.setLock('pessimistic_write').getOne() : await query.getOne();

						if (!row) {
							throw new NotFoundException(`The operation "${id}" does not exist.`);
						}

						const patch = merge(row);

						if (Object.keys(patch).length) {
							await manager.update(Operation, { id }, patch as QueryDeepPartialEntity<Operation>);
						}

						return { row, patch };
				  });

		return Object.assign(operation, row, patch);
	}

	/**
	 * Pauses, so a retry does not hammer a dependency that is already failing.
	 *
	 * @param ms The delay.
	 */
	private async wait(ms: number): Promise<void> {
		if (ms <= 0) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * The operation a submission already refers to, if any.
	 *
	 * The scope is resolved once by {@link start} and passed in, so the lookup that decides whether an
	 * operation already exists and the insert that creates one are scoped identically. Reading with the
	 * request context's scope while inserting with the submission's — which is what happened when
	 * `input.organizationId` was stated — would look in one scope and write in another.
	 *
	 * @param input The submission.
	 * @param scope The tenant and organization the submission is being made in.
	 * @returns The existing operation, or null.
	 */
	private async findBySubmission(
		input: IOperationStartInput,
		scope: { tenantId?: ID | null; organizationId?: ID | null }
	): Promise<Operation | null> {
		if (input.idempotencyKey) {
			const byKey = await this.findByIdempotencyKey(input.type, input.idempotencyKey, scope);

			if (byKey) {
				return byKey;
			}
		}

		if (input.aggregateType && input.aggregateId) {
			return this.findLiveForAggregate(input.aggregateType, input.aggregateId, scope);
		}

		return null;
	}
}

/**
 * Whether a status is terminal.
 *
 * @param status The status.
 * @returns True when the operation never leaves it.
 */
function isTerminalStatus(status: OperationStatus): boolean {
	return TERMINAL_STATUSES.includes(status);
}

/**
 * Whether a step returned a result.
 *
 * A step may finish without returning anything, which is not a failure: it performed its effect
 * and had no output to report. The runtime reads such a step as the empty result.
 *
 * @param value What the handler returned.
 * @returns True when there is a result to read the output and the compensator's data from.
 */
function isStepResult(value: unknown): value is IOperationStepResult {
	return !!value && typeof value === 'object';
}

/**
 * Reads a JSON column as an object.
 *
 * @param value The stored value.
 * @returns The value as an object, or an empty object.
 */
function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Reads a stored `IOperationError`.
 *
 * @param value The stored text.
 * @returns The error, or undefined when the text is absent or unreadable.
 */
function parseOperationError(value?: string): IOperationError | undefined {
	if (!value) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(value) as IOperationError;

		return parsed && typeof parsed === 'object' ? parsed : undefined;
	} catch {
		return undefined;
	}
}

/**
 * The reason a caller gave when it asked for the cancellation, when the row carries one.
 *
 * `cancel()` records an `OPERATION_CANCELED` error beside `state.cancelRequested`, and that pair is the
 * operator's: a worker's write keeps it rather than clearing it or putting its own error over it, and the
 * compensation walk the cancellation starts is recorded under it. An error of any other code on a row that
 * carries the flag is the runtime's, from before the request, and is not a reason anybody gave.
 *
 * @param operation The row, as read.
 * @returns The recorded cancellation, or undefined.
 */
function recordedCancellation(operation: Pick<Operation, 'state' | 'lastError'>): IOperationError | undefined {
	if (!operation.state?.cancelRequested) {
		return undefined;
	}

	const error = parseOperationError(operation.lastError);

	return error?.code === 'OPERATION_CANCELED' ? error : undefined;
}

/**
 * Turns a caught error into the shape a row stores.
 *
 * A step classifies its own failure by throwing an error that carries `code` and `retryable`: a
 * declined card is not retried five times, and a timeout is.
 *
 * @param error The caught error.
 * @param stepName The step that threw.
 * @returns The error, as an `IOperationError`.
 */
function toOperationError(error: unknown, stepName: string): IOperationError {
	const candidate = asRecord(error);

	return {
		code: typeof candidate.code === 'string' ? candidate.code : 'OPERATION_STEP_FAILED',
		message: error instanceof Error ? error.message : typeof error === 'string' ? error : 'The step failed.',
		stepName,
		retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : true
	};
}

/**
 * The delay before the next attempt.
 *
 * @param policy The step's retry policy.
 * @param attempt The attempt that just failed, 1-based.
 * @returns The delay in milliseconds.
 */
function stepBackoff(policy: IStepRetryPolicy | undefined, attempt: number): number {
	if (!policy) {
		return 0;
	}

	const base = policy.strategy === 'exponential' ? policy.baseMs * Math.pow(2, Math.max(0, attempt - 1)) : policy.baseMs;
	const capped = policy.maxMs ? Math.min(base, policy.maxMs) : base;
	const jitter = policy.jitter ? capped * policy.jitter * (Math.random() * 2 - 1) : 0;

	return Math.max(0, Math.round(capped + jitter));
}

/**
 * The action a step's status states, as the streamed fact spells it.
 *
 * Stated as one map rather than as a word at each call site, because the action is what a subscriber
 * narrows the stream by: a step that moved and the word for the move have to agree, and one table is
 * the only shape in which they can.
 */
const STEP_ACTIONS: Record<OperationStepStatus, string> = {
	[OperationStepStatus.PENDING]: 'pending',
	[OperationStepStatus.RUNNING]: 'started',
	[OperationStepStatus.COMPLETED]: 'completed',
	[OperationStepStatus.FAILED]: 'failed',
	[OperationStepStatus.SKIPPED]: 'skipped',
	[OperationStepStatus.COMPENSATING]: 'compensating',
	[OperationStepStatus.COMPENSATED]: 'compensated',
	[OperationStepStatus.COMPENSATION_FAILED]: 'compensation-failed'
};

/**
 * The action for a step's status.
 *
 * @param status The status the step was written with.
 * @returns The action `operation.step-changed` carries for it.
 */
function stepActionOf(status: OperationStepStatus): string {
	return STEP_ACTIONS[status] ?? 'changed';
}

/**
 * Adds the caller's scope to a criterion.
 *
 * A criterion may be one object or a list of them — the store reads a list as a disjunction — and
 * every member of it has to be scoped, because an alternative that escaped the scope would be a way
 * to read another tenant's row by writing the right `or`.
 *
 * @param where The criterion the caller stated.
 * @param scope The scope to add to it.
 * @returns The criterion, scoped.
 */
function withScope(
	where: FindOptionsWhere<Operation> | FindOptionsWhere<Operation>[] | undefined,
	scope: FindOptionsWhere<Operation>
): FindOptionsWhere<Operation> | FindOptionsWhere<Operation>[] {
	if (Array.isArray(where)) {
		return where.map((alternative) => ({ ...alternative, ...scope }));
	}

	return { ...(where ?? {}), ...scope };
}
