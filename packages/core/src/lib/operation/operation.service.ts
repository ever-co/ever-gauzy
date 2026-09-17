import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, IOperationError, IOperationState, OperationStatus, OperationStepStatus } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { Operation } from './operation.entity';
import { OperationStep } from './operation-step.entity';
import { OperationRegistry } from './operation.registry';
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
 * diagram — and both are admitted deliberately: a step failure moves `RUNNING` to `COMPENSATING`
 * directly, while a manual retry-into-compensation goes through `FAILED`. Anything else is refused,
 * because a status an operator cannot explain is worse than a loud error.
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
	[OperationStatus.FAILED]: [OperationStatus.COMPENSATING, OperationStatus.CANCELED],
	[OperationStatus.COMPENSATING]: [OperationStatus.COMPENSATED, OperationStatus.FAILED],
	[OperationStatus.COMPLETED]: [],
	[OperationStatus.COMPENSATED]: [],
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

	/** Operation-level attempt budget of an operation whose definition declares none. */
	static readonly DEFAULT_MAX_ATTEMPTS = 3;

	constructor(
		readonly typeOrmOperationRepository: TypeOrmOperationRepository,
		readonly mikroOrmOperationRepository: MikroOrmOperationRepository,
		readonly typeOrmOperationStepRepository: TypeOrmOperationStepRepository,
		readonly mikroOrmOperationStepRepository: MikroOrmOperationStepRepository,
		readonly registry: OperationRegistry
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

		const existing = await this.findBySubmission(input);

		if (existing) {
			return { operation: existing, created: false };
		}

		const now = new Date();
		const tenantId = input.tenantId ?? RequestContext.currentTenantId();
		const organizationId = input.organizationId ?? RequestContext.currentOrganizationId();

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
			const raced = await this.findBySubmission(input);

			if (raced) {
				return { operation: raced, created: false };
			}

			throw error;
		}
	}

	/**
	 * Takes the lease of an operation.
	 *
	 * The lease is the third layer of the exclusivity rule and the one that survives a crash: only the
	 * lease holder executes steps, a holder that dies stops renewing, and the operation is then
	 * claimable by another worker, which resumes it from the persisted step statuses.
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

			const lease = operation.state?.lease;

			if (lease && lease.ownerId !== ownerId && new Date(lease.expiresAt).getTime() > Date.now()) {
				return null;
			}

			const state: IOperationState = {
				...(operation.state ?? {}),
				lease: { ownerId, expiresAt: new Date(Date.now() + leaseMs) }
			};

			Object.assign(operation, { state });

			if (operation.status === OperationStatus.PENDING) {
				Object.assign(operation, { status: OperationStatus.RUNNING, startedAt: operation.startedAt ?? new Date() });
			}

			return manager.save(Operation, operation);
		});
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
	 * @param operationId The operation id.
	 * @param options Lease, worker identity and step budget for this pass.
	 * @returns What this pass did.
	 * @throws NotFoundException when the operation does not exist.
	 */
	async resume(
		operationId: ID,
		options: IOperationExecutionOptions = {}
	): Promise<IOperationExecutionResult> {
		const operation = await this.require(operationId);

		if (isTerminalStatus(operation.status)) {
			return { operation, executedSteps: [], finished: true };
		}

		return this.execute(operationId, options);
	}

	/**
	 * Requests cancellation.
	 *
	 * A cancellation is a request the runtime observes between steps, not a kill: an operation that
	 * applied nothing is cancelled outright, and one that already changed something is compensated,
	 * because leaving the aggregate half-changed is exactly what a cancellation must not do.
	 *
	 * @param operationId The operation id.
	 * @param options Worker identity and the reason an operator recorded.
	 * @returns The settled operation.
	 * @throws ConflictException when the operation already reached a terminal status.
	 * @throws NotFoundException when the operation does not exist.
	 */
	async cancel(
		operationId: ID,
		options: { ownerId?: string; reason?: string } = {}
	): Promise<Operation> {
		const operation = await this.require(operationId);

		if (isTerminalStatus(operation.status)) {
			throw new ConflictException(`The operation is ${operation.status.toLowerCase()} and cannot be cancelled.`);
		}

		const requested = await this.saveOperation(operation, {
			state: { ...(operation.state ?? {}), cancelRequested: true }
		});

		const steps = await this.findSteps(operationId);
		const applied = steps.filter((step) => step.status === OperationStepStatus.COMPLETED);

		if (applied.length === 0) {
			return this.settle(requested, OperationStatus.CANCELED, {
				finishedAt: new Date(),
				result: { canceled: true, reason: options.reason ?? null, compensatedSteps: [], notCompensable: [] }
			});
		}

		Object.assign(requested, {
			lastError: JSON.stringify({
				code: 'OPERATION_CANCELED',
				message: options.reason ?? 'The operation was cancelled.',
				retryable: false
			})
		});

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
				await this.saveStep(step, { status: OperationStepStatus.SKIPPED });
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

		const error: IOperationError = parseOperationError(operation.lastError) ?? {
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
	 * Reads an operation.
	 *
	 * @param id The operation id.
	 * @returns The operation, or null.
	 */
	async findById(id: ID): Promise<Operation | null> {
		return this.typeOrmOperationRepository.findOne({ where: { id } as any });
	}

	/**
	 * Finds the operation a retried submission refers to.
	 *
	 * @param type The operation type.
	 * @param idempotencyKey The caller-supplied key.
	 * @returns The operation, or null when the key has never been used for this type.
	 */
	async findByIdempotencyKey(type: string, idempotencyKey: string): Promise<Operation | null> {
		return this.typeOrmOperationRepository.findOne({
			where: {
				type,
				idempotencyKey,
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});
	}

	/**
	 * Finds the live operation of an aggregate.
	 *
	 * This is the exclusivity rule the unique index enforces: at most one of `PENDING`, `RUNNING` or
	 * `COMPENSATING` per aggregate, so two concurrent checkouts of one cart — or two captures of one
	 * order — cannot both proceed.
	 *
	 * @param aggregateType The aggregate kind.
	 * @param aggregateId Id of the aggregate.
	 * @returns The live operation, or null.
	 */
	async findLiveForAggregate(aggregateType: string, aggregateId: ID): Promise<Operation | null> {
		return this.typeOrmOperationRepository
			.createQueryBuilder('operation')
			.where('operation.aggregateType = :aggregateType', { aggregateType })
			.andWhere('operation.aggregateId = :aggregateId', { aggregateId })
			.andWhere('operation.status IN (:...statuses)', { statuses: LIVE_STATUSES })
			.getOne();
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
	 * Reads an operation or fails.
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
		await this.saveStep(step, { status: OperationStepStatus.RUNNING, startedAt: new Date() });

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
				await this.saveStep(step, {
					status: OperationStepStatus.COMPLETED,
					attemptCount: attempt,
					input,
					output: outcome.output ?? {},
					compensationData: outcome.compensationData ?? null,
					finishedAt: new Date(),
					lastError: null
				});

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

		await this.saveStep(step, {
			status: OperationStepStatus.FAILED,
			attemptCount: attempt,
			finishedAt: new Date(),
			lastError: JSON.stringify(failure)
		});

		Object.assign(current, {
			lastError: JSON.stringify(failure),
			attemptCount: (current.attemptCount ?? 0) + 1
		});

		return { operation: await this.typeOrmOperationRepository.save(current), failure };
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

		await this.saveStep(step, { status: OperationStepStatus.COMPENSATING });

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

				await this.saveStep(step, {
					status: OperationStepStatus.COMPENSATED,
					attemptCount: attempt,
					finishedAt: new Date(),
					lastError: null
				});

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
		await this.saveStep(step, {
			status: OperationStepStatus.COMPENSATION_FAILED,
			attemptCount: attempt,
			finishedAt: new Date(),
			lastError: JSON.stringify(failure)
		});

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
	 * @param operation The operation.
	 * @param failure What went wrong.
	 * @returns The operation, now compensating.
	 */
	private async beginCompensation(operation: Operation, failure: IOperationError): Promise<Operation> {
		Object.assign(operation, { lastError: JSON.stringify(failure) });

		return this.settle(operation, OperationStatus.COMPENSATING, {});
	}

	/**
	 * Writes a status transition, refusing an illegal one.
	 *
	 * @param operation The operation.
	 * @param status The status to move to.
	 * @param patch Columns to write with the status.
	 * @returns The saved operation.
	 * @throws OperationIllegalTransitionError when the edge is not in the state machine.
	 */
	private async settle(
		operation: Operation,
		status: OperationStatus,
		patch: Record<string, unknown>
	): Promise<Operation> {
		const from = operation.status;

		if (from !== status && !(LEGAL_TRANSITIONS[from] ?? []).includes(status)) {
			throw new OperationIllegalTransitionError(from, status);
		}

		// A settled operation holds no lease: leaving one behind would make a finished operation look
		// busy to the recovery scan.
		const state = { ...(operation.state ?? {}) };
		delete state.lease;

		return this.saveOperation(operation, { ...patch, status, state });
	}

	/**
	 * Releases the lease without settling the operation.
	 *
	 * @param operation The operation.
	 * @returns The saved operation.
	 */
	private async releaseLease(operation: Operation): Promise<Operation> {
		const state = { ...(operation.state ?? {}) };
		delete state.lease;

		return this.saveOperation(operation, { state });
	}

	/**
	 * Extends the lease, and refuses to continue when it is no longer ours.
	 *
	 * @param operation The operation.
	 * @param ownerId The worker identity.
	 * @param leaseMs The lease window.
	 * @returns The reloaded operation.
	 * @throws OperationLeaseLostError when another worker has taken the operation over.
	 * @throws NotFoundException when the operation no longer exists.
	 */
	private async renewLease(operation: Operation, ownerId: string, leaseMs: number): Promise<Operation> {
		const current = await this.require(operation.id as ID);
		const lease = current.state?.lease;

		if (lease && lease.ownerId !== ownerId) {
			throw new OperationLeaseLostError(current.id as ID, ownerId, lease.ownerId);
		}

		return this.saveOperation(current, {
			state: {
				...(current.state ?? {}),
				lease: { ownerId, expiresAt: new Date(Date.now() + leaseMs) }
			}
		});
	}

	/**
	 * Records a step's output and the variables it mutated on the operation.
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
		return this.saveOperation(operation, {
			lastError: null,
			startedAt: operation.startedAt ?? new Date(),
			state: {
				...(operation.state ?? {}),
				cursor: step.order,
				// The output is merged into the operation's state so a later step receives it, and the
				// variables travel with it: one write, so a crash cannot persist one without the other.
				stepOutputs: { ...asRecord(operation.state?.stepOutputs), [step.name]: step.output ?? {} },
				variables
			}
		});
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
			cancelRequested: () => operation.state?.cancelRequested === true
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
			return {
				code: 'OPERATION_CANCELED',
				message: 'The operation was cancelled before the next step.',
				retryable: false
			};
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
	 * @param step The step, mutated in place so callers see what was stored.
	 * @param values The columns to write.
	 * @returns The saved step.
	 */
	private async saveStep(step: OperationStep, values: Record<string, unknown>): Promise<OperationStep> {
		Object.assign(step, values);

		return this.typeOrmOperationStepRepository.save(step);
	}

	/**
	 * Writes an operation row.
	 *
	 * @param operation The operation, mutated in place so callers see what was stored.
	 * @param values The columns to write.
	 * @returns The saved operation.
	 */
	private async saveOperation(operation: Operation, values: Record<string, unknown>): Promise<Operation> {
		Object.assign(operation, values);

		return this.typeOrmOperationRepository.save(operation);
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
	 * @param input The submission.
	 * @returns The existing operation, or null.
	 */
	private async findBySubmission(input: IOperationStartInput): Promise<Operation | null> {
		if (input.idempotencyKey) {
			const byKey = await this.findByIdempotencyKey(input.type, input.idempotencyKey);

			if (byKey) {
				return byKey;
			}
		}

		if (input.aggregateType && input.aggregateId) {
			return this.findLiveForAggregate(input.aggregateType, input.aggregateId);
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
