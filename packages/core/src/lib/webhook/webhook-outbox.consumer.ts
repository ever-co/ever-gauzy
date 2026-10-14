import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import {
	EventConsumerKind,
	EventConsumerOrdering,
	ID,
	IEventConsumer,
	IEventConsumerContext,
	IEventEnvelope,
	JsonData
} from '@gauzy/contracts';
import { EventConsumerRegistry } from '../event-outbox/event-consumer.registry';
import { NON_SUBSCRIBABLE_EVENT_NAMES, SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookSubscriptionService } from './webhook-subscription.service';

/**
 * The consumer key the outbound fan-out registers under.
 *
 * The kind prefix makes the key `webhook:fan-out`, which is the namespace an operator filters the
 * delivery ledger by — and the one key under that namespace that is not a subscription identifier,
 * because the fan-out is the step *before* a subscription has been chosen. One `event_delivery` row
 * per event says whether this event was fanned out at all; the per-endpoint record of what was sent
 * and what came back is a `webhook_delivery` row, which is the resource an operator already reads.
 */
export const WEBHOOK_OUTBOX_CONSUMER_KEY = 'fan-out';

/**
 * Turns a durable event into the deliveries its subscribed endpoints are owed.
 *
 * **This is what makes a `webhook_subscription` row mean anything.** The subscription resource, its
 * signing secret, the pattern matcher, the retry ladder and the circuit breaker all existed without
 * it, and every one of them was reachable only from a controller — an operator could create an
 * endpoint, rotate its secret and read an empty delivery log forever, because nothing ever matched an
 * event against the rows. The fan-out is the missing step, and it is a consumer like any other: the
 * dispatcher creates one delivery record for it before it runs, so a crash between matching and
 * enqueueing is a redelivery rather than a silently skipped event.
 *
 * **The scope comes from the event, never from the request context.** A dispatch pass runs in a queue
 * worker, long after the request that appended the event has ended, so there is no caller to scope to;
 * the envelope carries the tenant, the organization and the channel, and the subscription lookup is
 * handed all three. Reading a request context here would match against an absent tenant, which a
 * store reads as "every tenant" — one tenant's payloads posted to another tenant's endpoint.
 *
 * **Reorderable, deliberately.** A webhook receiver is an outside system with its own availability,
 * and each endpoint already has a per-delivery ladder of its own. A strict fan-out would hold the head
 * of an aggregate's queue — and with it every other consumer of that aggregate, the search index and
 * the subscription surface among them — behind one slow partner.
 */
@Injectable()
export class WebhookOutboxConsumer implements IEventConsumer, OnModuleInit {
	private readonly logger = new Logger(WebhookOutboxConsumer.name);

	/** This consumer's key, without its kind prefix. */
	readonly key = WEBHOOK_OUTBOX_CONSUMER_KEY;

	/** Outbound, so the delivery record is `webhook:fan-out`. */
	readonly kind = EventConsumerKind.WEBHOOK;

	/**
	 * Reorderable: an endpoint's own ordering is its delivery rows', and one unreachable partner must
	 * not stop an aggregate's events reaching every other consumer.
	 */
	readonly ordering = EventConsumerOrdering.REORDERABLE;

	/**
	 * Attempts before the fan-out's own delivery record is dead-lettered.
	 *
	 * Short on purpose. The work here is a subscription read and a row insert per match; once those
	 * rows exist each endpoint walks its own seven-attempt ladder, so a long budget here would only
	 * repeat a database write that is failing for a reason no number of attempts changes.
	 */
	readonly maxAttempts = 5;

	/**
	 * @param subscriptions The endpoints an operator configured, and the matcher that selects them.
	 * @param deliveries Where a matched endpoint's delivery is created and attempted.
	 * @param catalogue The events this installation's producers declare.
	 * @param registry The dispatcher's consumer registry. Absent when the outbox runtime is not part of
	 * this deployment, in which case nothing dispatches and there is nothing to register with.
	 */
	constructor(
		private readonly subscriptions: WebhookSubscriptionService,
		private readonly deliveries: WebhookDeliveryService,
		private readonly catalogue: SubscriptionCatalogue,
		@Optional() private readonly registry?: EventConsumerRegistry
	) {}

	/**
	 * The event names to receive.
	 *
	 * Read live rather than captured, so a package that declares its events after this consumer
	 * registered is still fanned out — the registry holds the consumer, and the dispatcher asks it for
	 * its events on every pass.
	 *
	 * **The list is the producers' declarations plus the names the subscription surface deliberately
	 * refuses.** An event is left out of the streamed catalogue when a stream is the wrong medium for
	 * its rate, and the catalogue says so in as many words: those events remain available through the
	 * read APIs and through webhooks. A fan-out that read the streamed catalogue alone would quietly
	 * make "not streamable" mean "not deliverable", which is not what either document says.
	 *
	 * @returns The event names this consumer is dispatched.
	 */
	get events(): string[] {
		return Array.from(new Set([...this.catalogue.names(), ...NON_SUBSCRIBABLE_EVENT_NAMES]));
	}

	/**
	 * Registers with the dispatcher, when there is one.
	 */
	onModuleInit(): void {
		this.register();
	}

	/**
	 * Registers this consumer with the dispatcher.
	 *
	 * Unlike the subscription surface, this consumer never has an empty event list — the names the
	 * stream refuses are webhook-deliverable by definition and are always there — so registration is
	 * not deferred until a producer has declared something. Registering early with a live event list is
	 * what lets a package that bootstraps after this module still be fanned out.
	 *
	 * @returns True when the consumer is registered.
	 */
	register(): boolean {
		if (!this.registry) {
			return false;
		}

		this.registry.register(this);

		return true;
	}

	/**
	 * Creates, and makes the first attempt at, the deliveries one event owes its subscribers.
	 *
	 * The delivery row is created before the endpoint is called and the exact body is stored on it, so
	 * a retry — or an operator's redelivery months later — sends what was originally intended rather
	 * than a body rebuilt from a row that has since changed. The `(subscription, event)` pair is
	 * unique, which is what makes a redelivered *event* produce no second delivery: a re-run of this
	 * handler finds the rows it made last time instead of creating more.
	 *
	 * **A refused attempt is not reported as a failure of this consumer.** The attempt's outcome is
	 * already written onto the delivery row, together with the instant its next attempt is due, and the
	 * endpoint's own consecutive-failure counter has already been moved. Raising here would return the
	 * whole event to the outbox ladder and, on the next pass, produce a second attempt against every
	 * *other* endpoint that had already accepted it — two retry schedules for one delivery, which is
	 * precisely what the row's own `nextAttemptAt` exists to prevent.
	 *
	 * What is raised is a failure to *record* a delivery, because an endpoint that has no row is an
	 * endpoint that will never be called by anything.
	 *
	 * @param event The event envelope.
	 * @param context The delivery context.
	 */
	async handle(event: IEventEnvelope, context: IEventConsumerContext): Promise<void> {
		await context.assertOrder(event);

		if (await context.alreadyDelivered()) {
			return;
		}

		const matches = await this.subscriptions.findMatchingInScope(event.name, {
			tenantId: event.tenantId,
			organizationId: event.organizationId,
			channelId: event.channelId
		});

		if (matches.length === 0) {
			return;
		}

		// Built once for the whole fan-out: every endpoint subscribed to one event receives identical
		// bytes, so two partners comparing notes see one fact rather than two renderings of it.
		const payload = WebhookOutboxConsumer.bodyOf(event);

		for (const subscription of matches) {
			await this.deliverTo(subscription, event, payload);
		}
	}

	/**
	 * Records what one endpoint is owed, and calls it when nothing has called it yet.
	 *
	 * The attempt counter on the row is the gate rather than whether this call created it: a pass that
	 * died between creating the row and calling the endpoint leaves a row nobody has attempted, and
	 * that row is due now. A row that has been attempted belongs to its own schedule, and calling it
	 * again from here would be a second attempt the ladder never scheduled.
	 *
	 * @param subscription The endpoint that matched.
	 * @param event The event envelope.
	 * @param payload The exact body to store and send.
	 */
	private async deliverTo(
		subscription: WebhookSubscription,
		event: IEventEnvelope,
		payload: JsonData
	): Promise<void> {
		const { delivery, created } = await this.deliveries.enqueue({
			subscriptionId: subscription.id,
			eventId: event.id,
			eventName: event.name,
			payload,
			// Stated rather than left to the request context, which a queue worker does not have: the
			// delivery belongs to the tenant whose fact it carries, and a row written without one would be
			// invisible to every operator of the tenant that owns the endpoint.
			tenantId: event.tenantId ?? subscription.tenantId,
			organizationId: event.organizationId ?? subscription.organizationId
		});

		if ((delivery.attemptCount ?? 0) > 0) {
			return;
		}

		try {
			await this.deliveries.deliver(delivery.id as ID);
		} catch (error) {
			// The row exists and is due, so the endpoint is still owed its call; what failed is this
			// attempt, not the fan-out. It is logged rather than raised for the reason `handle` states:
			// raising would re-attempt every endpoint that had already accepted this event.
			this.logger.error(
				`The first attempt at delivery "${String(delivery.id)}" for subscription "${String(
					subscription.id
				)}" could not be made${created ? '' : ' (the row was created by an earlier pass)'}`,
				error
			);
		}
	}

	/**
	 * The body an endpoint receives.
	 *
	 * Written out member by member rather than spread from the envelope, because this is a wire
	 * contract: a member added to the envelope for the platform's own use must not start appearing in
	 * every partner's payload, and a stored body is what a replay sends years later.
	 *
	 * `occurredAt` is normalised to an ISO string here rather than left as whatever the store handed
	 * back. The column is JSON, and the two mappers this build runs return a date column as a `Date` or
	 * as text depending on the dialect — so a body built from the raw value would differ between two
	 * deployments of the same platform, and the signature over those bytes with it.
	 *
	 * @param event The event envelope.
	 * @returns The body to store on the delivery row and post to the endpoint.
	 */
	static bodyOf(event: IEventEnvelope): JsonData {
		const occurredAt = event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt);

		return {
			id: String(event.id),
			name: event.name,
			version: event.version,
			// An unparseable instant is carried across as the text it was rather than dropped or replaced
			// by "now": a receiver can see that the value is wrong, which a substituted one would hide.
			occurredAt: Number.isNaN(occurredAt.getTime()) ? String(event.occurredAt) : occurredAt.toISOString(),
			tenantId: event.tenantId ? String(event.tenantId) : undefined,
			organizationId: event.organizationId ? String(event.organizationId) : undefined,
			channelId: event.channelId ? String(event.channelId) : undefined,
			aggregate: event.aggregate
				? { type: String(event.aggregate.type), id: String(event.aggregate.id) }
				: undefined,
			sequence: event.sequence,
			partitionKey: event.partitionKey,
			correlationId: event.correlationId ? String(event.correlationId) : undefined,
			causationId: event.causationId ? String(event.causationId) : undefined,
			producer: event.producer,
			data: event.data
		} as JsonData;
	}
}
