import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import {
	EventConsumerKind,
	EventConsumerOrdering,
	IEventConsumer,
	IEventConsumerContext,
	IEventEnvelope
} from '@gauzy/contracts';
import { EventConsumerRegistry } from '../../event-outbox/event-consumer.registry';
import { SubscriptionCatalogue } from './subscription-catalogue';
import { GraphqlSubscriptionHub, SubscriptionEnvelope } from './subscription-hub.service';

/**
 * The consumer key the subscription surface registers under.
 *
 * A subscription is a delivery consumer like any other: the dispatcher creates one delivery record
 * per event for this key before the consumer runs, which is what makes a redelivery after a crash
 * visible rather than silent. The kind prefix makes the key `subscriber:graphql`, which is the
 * namespace an operator filters the delivery ledger by.
 */
export const GRAPHQL_SUBSCRIPTION_CONSUMER_KEY = 'graphql';

/**
 * The event names the subscription surface asks the dispatcher for.
 *
 * The catalogue is read live rather than captured, so a package that declares its events at
 * bootstrap is delivered to even though this consumer registered before it did.
 */
@Injectable()
export class GraphqlSubscriptionConsumer implements IEventConsumer, OnModuleInit {
	/** This consumer's key, without its kind prefix. */
	readonly key = GRAPHQL_SUBSCRIPTION_CONSUMER_KEY;
	/** In-process, so the delivery record is `subscriber:graphql`. */
	readonly kind = EventConsumerKind.SUBSCRIBER;
	/**
	 * Reorderable: a subscription is a notification and its messages are coalesced anyway, so one
	 * slow client must not hold the head of a partition for every other consumer of that aggregate.
	 */
	readonly ordering = EventConsumerOrdering.REORDERABLE;
	/** Attempts before the delivery is dead-lettered. */
	readonly maxAttempts = 5;

	/**
	 * @param hub Where authorised events are delivered.
	 * @param catalogue The events this installation streams.
	 * @param registry The dispatcher's consumer registry. Absent when the outbox runtime is not part
	 * of this deployment, in which case the bus bridge is the only route events take.
	 */
	constructor(
		private readonly hub: GraphqlSubscriptionHub,
		private readonly catalogue: SubscriptionCatalogue,
		@Optional() private readonly registry?: EventConsumerRegistry
	) {}

	/**
	 * The events to receive. Read at dispatch time, so a declaration made after bootstrap is honoured.
	 */
	get events(): string[] {
		return [...this.catalogue.names()];
	}

	/**
	 * Registers with the dispatcher, when there is one and something is streamable.
	 */
	onModuleInit(): void {
		this.register();
	}

	/**
	 * Registers this consumer with the dispatcher.
	 *
	 * Registration is skipped while nothing is declared: the registry refuses a consumer that
	 * declares no events, and a consumer that could never run is worse than an unregistered one. A
	 * package that declares its events later calls this again.
	 *
	 * @returns True when the consumer is registered.
	 */
	register(): boolean {
		if (!this.registry || this.catalogue.size === 0) {
			return false;
		}

		this.registry.register(this);
		return true;
	}

	/**
	 * Publishes one durable event to the tenants' subscribers.
	 *
	 * The handler cannot know which tenants care, so it publishes and the hub delivers: the event
	 * travels on `<eventName>:<tenantId>` and each open subscription decides on it again. A failure
	 * to publish is thrown, not swallowed, so the delivery record shows it and the retry scan picks
	 * it up.
	 *
	 * @param event The event envelope.
	 * @param context The delivery context.
	 */
	async handle(event: IEventEnvelope, context: IEventConsumerContext): Promise<void> {
		await context.assertOrder(event);

		if (await context.alreadyDelivered()) {
			return;
		}

		const envelope: SubscriptionEnvelope = {
			eventId: String(event.id),
			name: event.name,
			occurredAt: event.occurredAt,
			tenantId: event.tenantId ? String(event.tenantId) : undefined,
			organizationId: event.organizationId ? String(event.organizationId) : undefined,
			channelId: event.channelId ? String(event.channelId) : null,
			aggregate: event.aggregate
				? { type: String(event.aggregate.type), id: String(event.aggregate.id) }
				: undefined,
			sequence: event.sequence,
			data: event.data
		};

		await this.hub.publish(envelope);
	}
}
