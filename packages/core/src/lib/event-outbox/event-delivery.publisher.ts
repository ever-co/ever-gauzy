import { Injectable, OnModuleInit } from '@nestjs/common';
import { ID, IEventDelivery } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
// Imported from the files that declare them rather than from the subscriptions barrel: a domain that
// publishes needs the fan-out and the catalogue, not the hub, the consumer and the transport, and the
// narrower import keeps this domain's own test surface from loading the whole subscription surface.
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import type { SubscriptionEnvelope } from '../graphql/subscriptions/subscription-hub.service';

/**
 * The one fact this domain streams.
 *
 * The name is `<aggregate>.<action>` in lower case, and the aggregate is the table's own name —
 * `event_delivery`, snake_case because it is two words, which is the rule the catalogue states for a
 * multi-word aggregate. The action is deliberately coarse: a delivery moving is one fact whichever
 * move produced it, and the move travels beside it in `action` rather than in the event name, so a
 * client subscribes once instead of once per verb.
 *
 * **This is an operator's stream and not a consumer's.** `17-graphql-api-specification.md` §10.6 is
 * explicit that `eventDeliveryChanged` exists for the staff who watch the reliability machinery, and
 * that no subscription subscribes to another subscription's delivery: the event is not in the
 * catalogue of `12-events-webhooks-and-workflows.md` §3, it is published in process, and the moves
 * below are the only producers — a caller reacting to a business fact has that domain's own
 * subscription, not this one.
 */
export const EVENT_DELIVERY_EVENT_NAMES = {
	/** One consumer's delivery record changed, by an operator's move. */
	EVENT_DELIVERY_CHANGED: 'event_delivery.changed'
} as const;

/**
 * The moves that produce the fact, as the envelope states them.
 *
 * They are values rather than separate event names because they are separate *verbs* on one
 * aggregate: a subscriber that wants both reads `action`, and a subscriber that wants one filters on
 * it. Stated once, here, because the move is what the producer names and what the subscriber filters
 * on — two literals for one decision is how a filter stops matching its own publisher.
 */
export const EVENT_DELIVERY_ACTIONS = {
	/** The record was reset so the retry scan re-drives it. */
	REPLAYED: 'replayed',
	/** The record was dead-lettered by hand, with a reason. */
	MARKED_DEAD: 'marked-dead'
} as const;

/**
 * One of the moves that produces the fact.
 */
export type EventDeliveryAction = (typeof EVENT_DELIVERY_ACTIONS)[keyof typeof EVENT_DELIVERY_ACTIONS];

/**
 * What a subscriber receives for `eventDeliveryChanged`.
 *
 * The envelope is the platform's own — the same shape the outbox consumer hands the hub — with the
 * delivery the fact is about attached, so a subscriber's selection needs no second read. The
 * scoping members (`tenantId`, `organizationId`) travel beside it because the delivery decision is
 * made on them.
 */
export interface IEventDeliveryChangedEnvelope extends SubscriptionEnvelope {
	/** The move that produced the fact: `replayed` or `marked-dead`. */
	readonly action: string;
	/** The delivery record in its post-move state. */
	readonly delivery: IEventDelivery;
}

/**
 * Publishes this domain's changes to the subscription surface.
 *
 * **Why the publisher is a collaborator rather than a line in each route.** A subscription is fed
 * from one place or it is fed inconsistently: the REST route and the GraphQL mutation that perform
 * the same move must both announce it, and a subscriber must not be able to tell which protocol
 * moved the row. Both surfaces reach the move through `EventOutboxService`, which is where this
 * publisher is called from, so neither of them knows how a subscriber is reached.
 *
 * **Why the delivery is carried both as `data` and as `delivery`.** `SubscriptionEnvelope.data` is
 * the catalogued payload — what the kernel's own `events` field hands a subscriber — while
 * `delivery` is what the concept-shaped `eventDeliveryChanged` field resolves against. They are the
 * same row, and a client reads whichever of the two its selection names.
 *
 * **The tenant comes from the request context**, never from an argument: a fact is published on
 * `<eventName>:<tenantId>`, so an event can only ever reach the tenant it belongs to. The row's own
 * tenant is the fallback — a move always runs inside a request — and without either, nothing is
 * published, which is the fail-closed answer rather than a broadcast.
 */
@Injectable()
export class EventDeliveryEventPublisher implements OnModuleInit {
	constructor(
		private readonly pubSub: GraphqlPubSub,
		private readonly catalogue: SubscriptionCatalogue
	) {}

	/**
	 * Declares the event this domain streams.
	 *
	 * The catalogue is what the subscription surface offers and what the kernel's `events` field can
	 * resolve a selection against, so an event a domain publishes but never declares is an event no
	 * client can ask for. Declaring is idempotent: `Set.add` is what the catalogue does with a name it
	 * already holds, so a second boot in the same process is not a failure.
	 */
	onModuleInit(): void {
		this.catalogue.declare(EVENT_DELIVERY_EVENT_NAMES.EVENT_DELIVERY_CHANGED);
	}

	/**
	 * Announces that one consumer's delivery record changed.
	 *
	 * @param delivery The record in its post-move state.
	 * @param action The move that produced the change.
	 * @returns True when the fact was published.
	 */
	async deliveryChanged(delivery: IEventDelivery, action: EventDeliveryAction): Promise<boolean> {
		return this.publish(action, delivery.tenantId, delivery);
	}

	/**
	 * Publishes one envelope on the topic its event and tenant name.
	 *
	 * @param action The move that produced the fact.
	 * @param tenantId The tenant the fact belongs to, as the row carries it.
	 * @param delivery The record in its post-move state.
	 * @returns True when the fact was published.
	 */
	private async publish(
		action: EventDeliveryAction,
		tenantId: ID | undefined,
		delivery: IEventDelivery
	): Promise<boolean> {
		// The caller's own tenant is preferred and the row's is the fallback: a move always runs inside
		// a request, and the row's tenancy is what the write stored. Publishing is skipped when neither
		// is known, because an envelope without a tenant has no topic to travel on.
		const tenant = RequestContext.currentTenantId() ?? tenantId;

		if (!tenant) {
			return false;
		}

		const eventName = EVENT_DELIVERY_EVENT_NAMES.EVENT_DELIVERY_CHANGED;

		const envelope: IEventDeliveryChangedEnvelope & Record<string, unknown> = {
			// An in-process fact has no outbox row behind it, so its identity is the event name, the
			// record it is about and the instant it was published: two moves on one record are two
			// notifications, and neither claims to be a durable event id.
			eventId: `${eventName}:${String(delivery.id)}:${Date.now()}`,
			name: eventName,
			occurredAt: new Date(),
			tenantId: String(tenant),
			organizationId: delivery.organizationId ? String(delivery.organizationId) : undefined,
			channelId: null,
			aggregate: { type: 'EventDelivery', id: String(delivery.id) },
			action,
			data: delivery,
			delivery
		};

		return this.pubSub.publish(eventName, String(tenant), envelope);
	}
}
