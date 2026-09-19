import { UseGuards } from '@nestjs/common';
import { Args, Context, ID, Int, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IOperation,
	IOperationStep,
	OperationStepStatus,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from '../core/context/request-context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import type { GraphqlRequestContext } from '../graphql/graphql-context';
import { OperationService } from './operation.service';
import {
	OPERATION_EVENT_NAMES,
	IOperationChangedEnvelope
} from './operation-event.publisher';

/**
 * The fields an operation list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OperationFilter` and `OperationSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * The lease columns are absent from the filterable set for the reason the SDL states: `lockedBy` is a
 * worker identity rather than something a caller addresses an operation by, and "is it stuck" is a
 * question the deadline and the status answer in the vocabulary an operator reads.
 */
const OPERATION_FILTERABLE = {
	id: 'ID',
	type: 'STRING',
	status: 'ENUM',
	aggregateType: 'STRING',
	aggregateId: 'ID',
	parentOperationId: 'ID',
	correlationId: 'ID',
	idempotencyKey: 'STRING',
	deadlineAt: 'DATE',
	startedAt: 'DATE',
	finishedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const OPERATION_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startedAt',
	'finishedAt',
	'deadlineAt',
	'type',
	'status'
] as const;

/**
 * The order the connection means when the caller states none: the queue's own order, newest first —
 * the operation an operator has just started, or the one that just failed, is the one they are
 * looking at. The identifier follows the instant because two operations started in the same
 * millisecond are still two rows, and the last key is what makes the order total and a cursor walk
 * over it stable.
 */
const OPERATION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The step statuses that count towards `progress`.
 *
 * A step that is `COMPLETED` or `SKIPPED` is one the runtime will not invoke again on this walk, which
 * is what progress measures. A `COMPENSATED` step was completed and has since been undone, a
 * `FAILED`/`COMPENSATION_FAILED` one did not get where it was going, and a `RUNNING` one has not
 * finished: none of them is progress towards the operation's goal.
 */
const PROGRESSED_STEP_STATUSES: readonly OperationStepStatus[] = [
	OperationStepStatus.COMPLETED,
	OperationStepStatus.SKIPPED
];

/**
 * The durable-operation resource over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `OperationService` method the `/api/operations` route
 * behind it calls, under the same guard chain and the same permission. The two moves are the service's
 * own `cancel` and `retry`, so the runtime's state machine — not this surface — is what refuses a
 * status an operation cannot reach.
 *
 * **The type this resolver is attached to is a kernel type.** `Operation` and `OperationStep` are
 * declared by `graphql/schema/common.type.gql`, because an async capability anywhere in the platform
 * answers with one; a domain may neither redeclare nor extend a kernel type. What this class therefore
 * does is *resolve* that type from this resource's rows — the three root queries, the three moves, the
 * three streams, and the four field resolvers the kernel's declaration needs (`progress` and `steps`
 * on an operation, `attempt` and `compensationStatus` on a step).
 *
 * **`steps` and `progress` are batched per GraphQL operation.** The kernel type declares
 * `steps: [OperationStep!]!`, so a connection of fifty operations would otherwise be fifty queries;
 * both field resolvers ask the request's relation loader for the same relation, so the page costs one
 * query and the second selection is answered from the first one's cache. The batch is scoped to the
 * caller's own rows by the service read behind it.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once per resolver class so every field below is
 * behind the one capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the
 * handler and then the class, which is why the gate is stated on the class rather than restated on
 * each field — and why it is appended to the guard chain the routes below already carry rather than
 * replacing any part of it.
 */
@Resolver('Operation')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.OPERATIONS_VIEW)
export class OperationResolver {
	constructor(
		private readonly operationService: OperationService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * The operations of the caller's tenant, newest first.
	 */
	@Query('operations')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	async operations(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IOperation>> {
		// The read is the one the REST list route performs, with the route's own defaults: the
		// connection's `filter` is applied to the rows the service answered with, which is the same set
		// the route narrows in the store and the same set it pages.
		const rows = await this.operationService.listOperations();

		return buildConnection<IOperation>({
			rows,
			filterable: OPERATION_FILTERABLE,
			sortable: OPERATION_SORTABLE,
			defaultSort: OPERATION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One operation of the caller's tenant, or `null` when there is none.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('operation')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	async operation(@Args('id', { type: () => ID }) id: Id): Promise<IOperation | null> {
		return this.operationService.findOperation(id);
	}

	/**
	 * The operations of one aggregate, newest first.
	 *
	 * The read the REST list route answers with `aggregateType` and `aggregateId` stated, offered as
	 * its own field because a client looking at one aggregate asks the question directly.
	 */
	@Query('operationsByAggregate')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	async operationsByAggregate(
		@Args('aggregateType', { type: () => String }) aggregateType: string,
		@Args('aggregateId', { type: () => ID }) aggregateId: Id
	): Promise<IOperation[]> {
		return this.operationService.findByAggregate(aggregateType, aggregateId);
	}

	/**
	 * Requests cancellation, which compensates what the operation already applied.
	 *
	 * The same service method the REST route calls, with the same reason: a cancellation is a request
	 * the runtime observes at its next checkpoint, and the answer is the operation as the request left
	 * it rather than a claim about work that has not happened yet.
	 */
	@Mutation('cancelOperation')
	@Permissions(PermissionsEnum.OPERATIONS_CANCEL)
	async cancelOperation(
		@Args('id', { type: () => ID }) id: Id,
		@Args('reason', { type: () => String, nullable: true }) reason?: string
	): Promise<IOperation> {
		return this.operationService.cancel(id, { reason });
	}

	/**
	 * Re-drives an operation that failed, under a fresh attempt budget.
	 *
	 * The delivered method answers what the pass did — the operation, the steps it executed and
	 * whether it reached a terminal status — and the field answers the operation, which is what a move
	 * in this protocol returns: the row as it stands after the move, never a bare boolean.
	 */
	@Mutation('retryOperation')
	@Permissions(PermissionsEnum.OPERATIONS_CANCEL)
	async retryOperation(@Args('id', { type: () => ID }) id: Id): Promise<IOperation> {
		const { operation } = await this.operationService.retry(id);

		return operation;
	}

	/**
	 * Continues an interrupted operation.
	 *
	 * An operation that already reached a terminal status is answered unchanged rather than refused:
	 * there is no move left to make, and the operation as it stands is the honest answer to "continue
	 * this".
	 */
	@Mutation('resumeOperation')
	@Permissions(PermissionsEnum.OPERATIONS_CANCEL)
	async resumeOperation(@Args('id', { type: () => ID }) id: Id): Promise<IOperation> {
		const { operation } = await this.operationService.resume(id);

		return operation;
	}

	/**
	 * How far an operation has come, as a fraction between 0 and 1.
	 *
	 * The kernel declares the member and this resource answers it: a step the runtime will not invoke
	 * again — `COMPLETED` or `SKIPPED` — counts, and the rest does not. An operation with no steps has
	 * made no progress, which is `0` rather than a division by zero.
	 */
	@ResolveField('progress')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	async progress(@Parent() operation: IOperation, @Context() context?: GraphqlRequestContext): Promise<number> {
		const steps = await this.stepsOf(operation, context);

		if (!steps.length) {
			return 0;
		}

		const progressed = steps.filter((step) => PROGRESSED_STEP_STATUSES.includes(step.status)).length;

		return progressed / steps.length;
	}

	/**
	 * The steps of one operation, in execution order.
	 *
	 * The relation is read through the service that owns the step rows — never through the operation
	 * row's own eagerly-loaded member, which no delivered read loads — and through the request's
	 * relation loader, so a page of operations costs one query for all of their plans.
	 */
	@ResolveField('steps')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	async steps(
		@Parent() operation: IOperation,
		@Context() context?: GraphqlRequestContext
	): Promise<IOperationStep[]> {
		return this.stepsOf(operation, context);
	}

	/**
	 * Why an operation failed, in the words the error carries.
	 *
	 * The row stores its last error as the `IOperationError` document the runtime wrote, and the kernel
	 * declares this member as the reason in plain words: the message of that document, or the stored
	 * text itself when it is not a document — a row written by an older build is still readable rather
	 * than silently blank.
	 */
	@ResolveField('failureReason')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	failureReason(@Parent() operation: IOperation): string | null {
		if (!operation.lastError) {
			return null;
		}

		try {
			const parsed = JSON.parse(operation.lastError) as { message?: unknown };

			return typeof parsed?.message === 'string' ? parsed.message : operation.lastError;
		} catch {
			return operation.lastError;
		}
	}

	/**
	 * Streams every step of an operation of the caller's tenant moving.
	 *
	 * The topic is `<eventName>:<tenantId>`, so a subscription is structurally incapable of receiving
	 * another tenant's event even if the filter below were wrong — the filter is the second line, and
	 * it is where the two narrowing arguments are applied. Both only ever narrow what the credential
	 * may already read: a caller without `OPERATIONS_VIEW` is refused by the guard before the stream is
	 * opened, and the tenant is taken from the credential rather than from an argument.
	 *
	 * Without a resolved tenant nothing is subscribed to: the topic of an unauthenticated connection is
	 * one no fact is ever published on, so the stream is silent rather than wide.
	 */
	@Subscription('operationStepChanged', {
		filter: (payload: IOperationChangedEnvelope, variables: { operationId?: Id; stepName?: string }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.operationId || String(payload.operation?.id) === String(variables.operationId)) &&
			(!variables?.stepName || payload.stepName === variables.stepName),
		resolve: (payload: IOperationChangedEnvelope) => payload.operation
	})
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	operationStepChanged(
		@Args('operationId', { type: () => ID, nullable: true }) operationId?: Id,
		@Args('stepName', { type: () => String, nullable: true }) stepName?: string
	): AsyncIterable<IOperationChangedEnvelope> {
		return this.pubSub.asyncIterableIterator<IOperationChangedEnvelope>(
			this.topicOf(OPERATION_EVENT_NAMES.OPERATION_STEP_CHANGED)
		);
	}

	/**
	 * Streams the operations of the caller's tenant that complete.
	 */
	@Subscription('operationCompleted', {
		filter: (payload: IOperationChangedEnvelope, variables: { operationId?: Id }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.operationId || String(payload.operation?.id) === String(variables.operationId)),
		resolve: (payload: IOperationChangedEnvelope) => payload.operation
	})
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	operationCompleted(
		@Args('operationId', { type: () => ID, nullable: true }) operationId?: Id
	): AsyncIterable<IOperationChangedEnvelope> {
		return this.pubSub.asyncIterableIterator<IOperationChangedEnvelope>(
			this.topicOf(OPERATION_EVENT_NAMES.OPERATION_COMPLETED)
		);
	}

	/**
	 * Streams the operations of the caller's tenant that will not complete.
	 *
	 * The payload's `status` says which of the four arrivals it was — entering compensation, settled
	 * compensated, failed with an undo outstanding, or cancelled — because the design names one
	 * failure stream and the fact is the same one in all four cases: the operation did not do what it
	 * was started to do.
	 */
	@Subscription('operationFailed', {
		filter: (payload: IOperationChangedEnvelope, variables: { operationId?: Id }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.operationId || String(payload.operation?.id) === String(variables.operationId)),
		resolve: (payload: IOperationChangedEnvelope) => payload.operation
	})
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	operationFailed(
		@Args('operationId', { type: () => ID, nullable: true }) operationId?: Id
	): AsyncIterable<IOperationChangedEnvelope> {
		return this.pubSub.asyncIterableIterator<IOperationChangedEnvelope>(
			this.topicOf(OPERATION_EVENT_NAMES.OPERATION_FAILED)
		);
	}

	/**
	 * The steps of one operation, batched within the GraphQL operation that asked for them.
	 *
	 * The loader key names the relation and the column it is joined on, so two selections in one
	 * request share one batch and one cache. A context that carries no registry — a direct call, or a
	 * caller that built its own context — reads the steps directly rather than failing, because the
	 * batch is a cost optimisation and never a correctness condition.
	 *
	 * @param operation The operation whose plan is read.
	 * @param context The request's context, when one was supplied.
	 * @returns The steps, ascending by `order`.
	 */
	private async stepsOf(operation: IOperation, context?: GraphqlRequestContext): Promise<IOperationStep[]> {
		const operationId = operation?.id as Id;

		if (!operationId) {
			return [];
		}

		const loaders = context?.loaders;

		if (!loaders) {
			return this.operationService.findSteps(operationId);
		}

		const loader = loaders.for<Id, IOperationStep[]>(
			'operation_step:operationId',
			async (operationIds) => {
				const rows = await this.operationService.findStepsForOperations(operationIds);

				return operationIds.map((id) => rows.filter((row) => String(row.operationId) === String(id)));
			}
		);

		return loader.load(operationId);
	}

	/**
	 * The topic a fact of this tenant travels on.
	 *
	 * @param eventName The catalogued event name.
	 * @returns The topic, `<eventName>:<tenantId>`.
	 */
	private topicOf(eventName: string): string {
		return this.pubSub.topicFor(eventName, String(RequestContext.currentTenantId() ?? ''));
	}
}

/**
 * The fields of one step of an operation.
 *
 * The kernel declares `attempt` and `compensationStatus` on `OperationStep`, and neither is a column
 * of the step row: the row counts attempts and states one status that folds the forward walk and the
 * undo walk together. Both members are therefore answered here rather than by reading a property that
 * does not exist — see {@link attempt} and {@link compensationStatus} for what each projection is.
 *
 * The class carries the guard chain, the permission and the gate its sibling does, because its fields
 * are served through the same endpoint and are as reachable: a field resolver on a kernel type is not
 * a lesser door than a root field.
 */
@Resolver('OperationStep')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.OPERATIONS_VIEW)
export class OperationStepResolver {
	/**
	 * How many times the step has been attempted, including the attempts that failed.
	 */
	@ResolveField('attempt')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	attempt(@Parent() step: IOperationStep): number {
		return step.attemptCount ?? 0;
	}

	/**
	 * Where the step's compensating action stands, when it has one.
	 *
	 * A step states a single status, and the compensation phases are among its values: a step that is
	 * `COMPENSATING`, `COMPENSATED` or `COMPENSATION_FAILED` is one whose undo is running, finished, or
	 * gave up, and those three are the answer verbatim. Every other status says nothing about the
	 * undo — a `COMPLETED` step simply has not been compensated — so the member is absent rather than
	 * answered with a status that would read as a claim about work nobody attempted.
	 */
	@ResolveField('compensationStatus')
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	compensationStatus(@Parent() step: IOperationStep): OperationStepStatus | null {
		switch (step.status) {
			case OperationStepStatus.COMPENSATING:
			case OperationStepStatus.COMPENSATED:
			case OperationStepStatus.COMPENSATION_FAILED:
				return step.status;
			default:
				return null;
		}
	}
}
