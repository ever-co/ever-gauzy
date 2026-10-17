import { Injectable, OnModuleInit } from '@nestjs/common';
import { IOperation, IOperationStep } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
// Imported from the files that declare them rather than from the subscriptions barrel: a domain that
// publishes needs the fan-out and the catalogue, not the hub, the consumer and the transport, and the
// narrower import keeps this domain's own test surface from loading the whole subscription surface.
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import type { SubscriptionEnvelope } from '../graphql/subscriptions/subscription-hub.service';

/**
 * The three facts this domain streams.
 *
 * An event name is `<aggregate>.<action>` in lower case, which is the shape the catalogue asserts and
 * the shape a client selects with a prefix pattern. The durable operation has no catalogued event of
 * its own — the platform's event catalogue names the facts an operation *produces* (`order.placed`,
 * `checkout.failed`) rather than the operation's own progress — so these three are announced on the
 * aggregate's name in the catalogue's own spelling, exactly as the sales context announces
 * `channel.changed` and the party kernel announces `contact_group.changed`.
 *
 * `step-changed` follows `checkout.step-completed`'s shape rather than inventing a second one: the
 * aggregate is the operation, and the action segment names the part of it that moved.
 */
export const OPERATION_EVENT_NAMES = {
	/** A step of an operation moved: it started, succeeded, failed, or was compensated. */
	OPERATION_STEP_CHANGED: 'operation.step-changed',
	/** An operation reached `COMPLETED`: every step of its plan ran. */
	OPERATION_COMPLETED: 'operation.completed',
	/** An operation will not complete: it entered compensation, or settled without completing. */
	OPERATION_FAILED: 'operation.failed'
} as const;

/**
 * Every fact the operation subscriptions carry.
 *
 * The order is the order the three subscription fields are declared in, and it is stated once so the
 * publisher and the resolvers cannot disagree about which facts this domain streams.
 */
export const OPERATION_SUBSCRIBED_EVENT_NAMES: readonly string[] = [
	OPERATION_EVENT_NAMES.OPERATION_STEP_CHANGED,
	OPERATION_EVENT_NAMES.OPERATION_COMPLETED,
	OPERATION_EVENT_NAMES.OPERATION_FAILED
];

/**
 * What a subscriber receives for `operationStepChanged`, `operationCompleted` and `operationFailed`.
 *
 * The envelope is the platform's own — the same shape the outbox consumer hands the hub — with the
 * operation the fact is about attached, so a subscriber's selection needs no second read beyond the
 * one the field resolvers make: `progress` and `steps` are answered from the operation's own rows in
 * their state at delivery, which is what "the operation as it stands" means for a stream.
 *
 * The scoping members (`tenantId`, `organizationId`) travel beside it because the delivery decision
 * is made on them, and `channelId` is `null`: an operation is executed for an organization rather
 * than for a storefront, so a channel-narrowed subscription admits it and there is nothing here to
 * narrow it to.
 */
export interface IOperationChangedEnvelope extends SubscriptionEnvelope {
	/** The action that produced the fact: `started`, `completed`, `failed`, `compensated`, … */
	readonly action: string;
	/** The operation in its post-write state. */
	readonly operation: IOperation;
	/** The step that moved, on `operation.step-changed` only. */
	readonly step?: IOperationStep;
	/** The name of that step, on `operation.step-changed` only. */
	readonly stepName?: string;
}

/**
 * Publishes this domain's facts to the subscription surface.
 *
 * **Why the publisher is a provider rather than a line in each handler.** A subscription is fed from
 * one place or it is fed inconsistently: the REST route and the GraphQL mutation that perform the
 * same write must both announce it, and a client must not be able to tell which protocol wrote a row
 * by whether it received an event. Both surfaces call the same service, so the announcements are made
 * there — in the service's own step and settlement writes — and neither surface knows how a
 * subscriber is reached.
 *
 * **Why the operation is attached as well as the named members.** `SubscriptionEnvelope.data` is the
 * catalogued payload — what the kernel's own `events` field hands a subscriber — while `operation`
 * and `step` are what the concept-shaped subscription fields resolve against. They are the same rows,
 * and a client reads whichever of the two its selection names.
 *
 * **The tenant comes from the request context**, never from an argument: a fact is published on
 * `<eventName>:<tenantId>`, so an event can only ever reach the tenant it belongs to. The row's own
 * tenancy is the fallback, which matters here more than elsewhere: an operation is driven by a worker
 * as often as by a request, and a worker announces the fact of the tenant the row belongs to. Without
 * either, nothing is published, which is the fail-closed answer rather than a broadcast.
 */
@Injectable()
export class OperationEventPublisher implements OnModuleInit {
	constructor(
		private readonly pubSub: GraphqlPubSub,
		private readonly catalogue: SubscriptionCatalogue
	) {}

	/**
	 * Declares the events this domain streams.
	 *
	 * The catalogue is what the subscription surface offers and what the kernel's `events` field can
	 * resolve a selection against, so an event a domain publishes but never declares is an event no
	 * client can ask for. Declaring is idempotent: the catalogue adds a name it already holds, so a
	 * second boot in the same process is not a failure.
	 */
	onModuleInit(): void {
		this.catalogue.declare(...OPERATION_SUBSCRIBED_EVENT_NAMES);
	}

	/**
	 * Announces that a step of an operation moved.
	 *
	 * @param operation The operation in its post-write state.
	 * @param step The step in its post-write state.
	 * @param action The action that produced the move.
	 * @returns True when the fact was published.
	 */
	async operationStepChanged(operation: IOperation, step: IOperationStep, action: string): Promise<boolean> {
		return this.publish(OPERATION_EVENT_NAMES.OPERATION_STEP_CHANGED, action, operation, {
			// The catalogued payload of a step fact is the step: a consumer of `operation.step-changed`
			// is told which step moved and how, and the operation travels beside it for the subscriber
			// that is watching the whole run.
			data: step,
			step,
			stepName: step.name
		});
	}

	/**
	 * Announces that an operation completed.
	 *
	 * @param operation The operation in its post-write state.
	 * @returns True when the fact was published.
	 */
	async operationCompleted(operation: IOperation): Promise<boolean> {
		return this.publish(OPERATION_EVENT_NAMES.OPERATION_COMPLETED, 'completed', operation);
	}

	/**
	 * Announces that an operation will not complete.
	 *
	 * The three moves that reach this fact are stated as the action rather than as three events,
	 * because they are one fact about the operation — it did not do what it was started to do — and a
	 * client that cares which of them it was narrows on the action or reads the payload's `status`.
	 *
	 * @param operation The operation in its post-write state.
	 * @param action `compensating` when the undo began, `compensated` when it finished, `failed` when
	 * the undo is outstanding, `canceled` when a caller's cancellation settled it.
	 * @returns True when the fact was published.
	 */
	async operationFailed(operation: IOperation, action: string): Promise<boolean> {
		return this.publish(OPERATION_EVENT_NAMES.OPERATION_FAILED, action, operation);
	}

	/**
	 * Publishes one envelope on the topic its event and tenant name.
	 *
	 * @param eventName The catalogued event name.
	 * @param action The action that produced the fact.
	 * @param operation The operation the fact is about, in its post-write state.
	 * @param extra Members only some of the facts carry.
	 * @returns True when the fact was published.
	 */
	private async publish(
		eventName: string,
		action: string,
		operation: IOperation,
		extra: { data?: unknown; step?: IOperationStep; stepName?: string } = {}
	): Promise<boolean> {
		// The caller's own tenant is preferred and the row's is the fallback: a request-driven write runs
		// inside a request context, while the worker that drives an operation on its own sweep runs
		// without one. Publishing is skipped when neither is known, because an envelope without a tenant
		// has no topic to travel on.
		const tenant = RequestContext.currentTenantId() ?? operation?.tenantId;

		if (!tenant || !operation?.id) {
			return false;
		}

		const envelope: IOperationChangedEnvelope = {
			eventId: `${eventName}:${operation.id}:${Date.now()}`,
			name: eventName,
			occurredAt: new Date(),
			tenantId: String(tenant),
			organizationId: operation.organizationId ? String(operation.organizationId) : undefined,
			channelId: null,
			aggregate: { type: 'Operation', id: String(operation.id) },
			action,
			data: extra.data ?? operation,
			operation,
			...(extra.step ? { step: extra.step } : {}),
			...(extra.stepName ? { stepName: extra.stepName } : {})
		};

		return this.pubSub.publish(eventName, String(tenant), envelope);
	}
}
