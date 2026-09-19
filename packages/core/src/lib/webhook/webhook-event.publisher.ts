import { Injectable, OnModuleInit } from '@nestjs/common';
import { ID, WebhookDeliveryStatus } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
// Imported from the files that declare them rather than from the subscriptions barrel: a domain that
// publishes needs the fan-out and the catalogue, not the hub, the consumer and the transport, and the
// narrower import keeps this domain's own test surface from loading the whole subscription surface.
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import type { SubscriptionEnvelope } from '../graphql/subscriptions/subscription-hub.service';
// Type-only, so the two services that produce these facts stay out of this module's runtime graph:
// they import this file for the publisher, and a value import back would close a cycle. The
// projections are also what travels on the wire, never the stored row — a fact is a broadcast within
// a tenant, so the members declared here are the ones the API itself answers with.
import type { IRedactedWebhookSubscription } from './webhook-subscription.service';
import type { IRedactedWebhookDelivery } from './webhook-delivery.service';

/**
 * The facts this domain streams.
 *
 * An event name is `<aggregate>.<action>` in lower case, which is the shape the catalogue asserts and
 * the shape a client selects with a prefix pattern. The two names are the platform's own event
 * catalogue's — `webhook.failed` and `webhook.disabled` are what the delivery path and the circuit
 * breaker emit — rather than a second vocabulary invented for the subscription surface.
 *
 * **`webhook.delivered` is deliberately absent.** The catalogue emits it for the platform's own
 * delivery metrics, and the GraphQL specification states that a successful delivery is not
 * subscribable: a stream that fires on every accepted attempt is a load generator, and the delivery
 * query already answers what happened. What a client genuinely cannot poll for is the opposite fact —
 * an endpoint that has started refusing — which is the one exception the specification carves out.
 */
export const WEBHOOK_EVENT_NAMES = {
	/** An attempt was refused, or the delivery ran out of attempts. */
	WEBHOOK_FAILED: 'webhook.failed',
	/** The circuit breaker or an operator switched a subscription off. */
	WEBHOOK_DISABLED: 'webhook.disabled'
} as const;

/**
 * Every fact this domain declares to the subscription catalogue.
 *
 * The order is the order the two subscription fields open their topics in, and it is stated once so
 * the resolver and the publisher cannot disagree about which facts this domain streams.
 */
export const WEBHOOK_SUBSCRIBED_EVENT_NAMES: readonly string[] = [
	WEBHOOK_EVENT_NAMES.WEBHOOK_FAILED,
	WEBHOOK_EVENT_NAMES.WEBHOOK_DISABLED
];

/**
 * What a subscriber receives for `webhookDeliveryFailed`.
 *
 * The envelope is the platform's own — the same shape the outbox consumer hands the hub — with the
 * delivery the fact is about attached, so a subscriber's selection needs no second read. The row
 * attached is the **projection the API answers with**, never the stored row: the stored row carries
 * the exact body that was sent, and that is the one member this platform does not hand to a stream.
 */
export interface IWebhookDeliveryFailedEnvelope extends SubscriptionEnvelope {
	/** What the row reached: `failed` while another attempt is scheduled, `dead` when there is none. */
	readonly action: string;
	/** The delivery in its post-attempt state. */
	readonly delivery: IRedactedWebhookDelivery;
}

/**
 * What a subscriber receives for `webhookSubscriptionDisabled`.
 */
export interface IWebhookSubscriptionDisabledEnvelope extends SubscriptionEnvelope {
	/** Always `disabled`: this fact has one cause and one direction. */
	readonly action: string;
	/** The subscription in its post-write state, with its secret replaced by a fingerprint. */
	readonly subscription: IRedactedWebhookSubscription;
	/** Why it was switched off, for the operator who re-enables it. */
	readonly reason?: string;
}

/**
 * One envelope's worth of parts, so the two announcements below read as what they carry rather than
 * as the order of six positional arguments.
 */
interface IWebhookAnnouncement {
	/** The catalogued event name. */
	readonly eventName: string;
	/** What happened, in one word, for a subscriber that branches on it. */
	readonly action: string;
	/** The row the fact is about, read for its identity and its tenancy. */
	readonly scoping: { readonly id?: ID; readonly tenantId?: ID; readonly organizationId?: ID };
	/** The catalogued payload: what a consumer of the event itself is told. */
	readonly data: Record<string, unknown>;
	/** The concept-shaped members the subscription field resolves against. */
	readonly members: Record<string, unknown>;
}

/**
 * Publishes this domain's own changes to the subscription surface.
 *
 * **Why the publisher is a provider rather than a line in each handler.** A subscription is fed from
 * one place or it is fed inconsistently: the REST route, the GraphQL mutation and the worker that
 * retries a delivery must all announce the same fact, and a client must not be able to tell which of
 * them wrote a row by whether it received an event. None of them knows how a subscriber is reached —
 * the services they share are what announce, and this collaborator is how.
 *
 * **Why the producers sit in the services.** The delivery path writes through
 * `WebhookDeliveryService` whichever surface asked it to, and the operator's switch and the circuit
 * breaker both write through `WebhookSubscriptionService`. Announcing anywhere else would give the
 * platform a second code path over the same fact, and the fact would then be missing from whichever
 * path did not announce it.
 *
 * **The tenant comes from the request context**, never from an argument: a fact is published on
 * `<eventName>:<tenantId>`, so an event can only ever reach the tenant it belongs to. The row's own
 * tenancy is the fallback, which is the case that matters most here — the retry that produces a
 * failure runs in the worker, where there is no request to read a context from. Without either,
 * nothing is published, which is the fail-closed answer rather than a broadcast.
 */
@Injectable()
export class WebhookEventPublisher implements OnModuleInit {
	constructor(
		private readonly pubSub: GraphqlPubSub,
		private readonly catalogue: SubscriptionCatalogue
	) {}

	/**
	 * Declares the events this domain streams.
	 *
	 * The catalogue is what the subscription surface offers and what the kernel's `events` field
	 * resolves a selection against, so an event a domain publishes but never declares is an event no
	 * client can ask for. Declaring is idempotent: the catalogue adds a name it already holds, so a
	 * second boot in the same process is not a failure.
	 */
	onModuleInit(): void {
		this.catalogue.declare(...WEBHOOK_SUBSCRIBED_EVENT_NAMES);
	}

	/**
	 * Announces that an attempt was refused, or that the delivery ran out of attempts.
	 *
	 * The fact is announced per attempt rather than once per delivery, because that is how the
	 * platform's catalogue states it: the payload carries the attempt number and the instant the next
	 * one is due, so a subscriber watching an endpoint degrade sees the ladder rather than a single
	 * verdict at the end of it. A delivery that reaches `DEAD` is announced too — it is the same fact
	 * with nothing left to schedule, and an integration owner told only about the retryable failures
	 * would never learn that its events had stopped arriving.
	 *
	 * @param delivery The delivery in its post-attempt state, as the API answers with it.
	 * @param attempt The 1-based attempt number that was refused.
	 * @returns True when the fact was published.
	 */
	async deliveryFailed(delivery: IRedactedWebhookDelivery, attempt: number): Promise<boolean> {
		return this.publish({
			eventName: WEBHOOK_EVENT_NAMES.WEBHOOK_FAILED,
			action: delivery?.status === WebhookDeliveryStatus.DEAD ? 'dead' : 'failed',
			scoping: delivery,
			// The catalogued payload of `webhook.failed`, and not the row: what a consumer of that event
			// is told is which endpoint refused which event, how, and when it is tried again.
			data: {
				subscriptionId: String(delivery?.subscriptionId ?? ''),
				eventId: String(delivery?.eventId ?? ''),
				eventName: delivery?.eventName,
				responseStatus: delivery?.responseStatus ?? null,
				error: delivery?.lastError ?? null,
				attempt,
				nextAttemptAt: delivery?.nextAttemptAt ?? null
			},
			members: { delivery }
		});
	}

	/**
	 * Announces that a subscription was switched off.
	 *
	 * Announced from both causes — the operator's own switch and the circuit breaker's auto-disable —
	 * because a subscriber watching an integration must learn that its endpoint stopped being called
	 * whichever of the two decided it, and because a switch that produced no fact would be a
	 * subscriber that never learns a subscription it watches is gone.
	 *
	 * @param subscription The subscription in its post-write state, as the API answers with it.
	 * @param reason Why it was switched off.
	 * @returns True when the fact was published.
	 */
	async subscriptionDisabled(subscription: IRedactedWebhookSubscription, reason?: string): Promise<boolean> {
		return this.publish({
			eventName: WEBHOOK_EVENT_NAMES.WEBHOOK_DISABLED,
			action: 'disabled',
			scoping: subscription,
			// The catalogued payload of `webhook.disabled`: the switch, when it was thrown, how many
			// refusals it took, and when the endpoint last accepted anything.
			data: {
				subscriptionId: String(subscription?.id ?? ''),
				disabledAt: subscription?.disabledAt ?? null,
				consecutiveFailures: subscription?.failureCount ?? 0,
				lastSuccessAt: subscription?.lastSuccessAt ?? null
			},
			members: { subscription, ...(reason ? { reason } : {}) }
		});
	}

	/**
	 * Publishes one envelope on the topic its event and tenant name.
	 *
	 * @param announcement The envelope's parts.
	 * @returns True when the fact was published.
	 */
	private async publish(announcement: IWebhookAnnouncement): Promise<boolean> {
		const { eventName, action, scoping, data, members } = announcement;
		// The caller's own tenant is preferred and the row's is the fallback: the operator's write runs
		// inside a request, while the retry that records a failure runs in the worker and has none.
		const tenant = RequestContext.currentTenantId() ?? scoping?.tenantId;

		if (!tenant || !scoping?.id) {
			return false;
		}

		const envelope: SubscriptionEnvelope & Record<string, unknown> = {
			eventId: `${eventName}:${scoping.id}:${Date.now()}`,
			name: eventName,
			occurredAt: new Date(),
			tenantId: String(tenant),
			organizationId: scoping.organizationId ? String(scoping.organizationId) : undefined,
			// A webhook subscription belongs to the tenant rather than to a channel, so the fact carries
			// no channel: a channel-narrowed subscription admits it, and there is nothing to narrow to.
			channelId: null,
			// The aggregate both facts belong to is the subscription, which is what the platform's own
			// catalogue states for `webhook.failed` and `webhook.disabled` alike.
			aggregate: { type: 'WebhookSubscription', id: String(scoping.id) },
			action,
			data,
			...members
		};

		return this.pubSub.publish(eventName, String(tenant), envelope);
	}
}
