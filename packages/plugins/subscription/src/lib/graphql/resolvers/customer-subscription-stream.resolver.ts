import { UseGuards } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import {
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	GraphqlPubSub,
	PermissionGuard,
	Permissions,
	SubscriptionEnvelope,
	TenantPermissionGuard,
	deliverPayloadAsIs,
	tenantScopedTopicStream
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { SubscriptionFeatures } from '../../subscription.features';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SUBSCRIPTION_STREAMED_EVENTS } from '../../subscription-streamed-events';
import { Subscription as CustomerSubscription } from '../../subscription/subscription.entity';
import { SubscriptionService } from '../../subscription/subscription.service';

/**
 * The recurring-billing stream: a typed field over the lifecycle facts the subscription service already appends to the
 * outbox.
 *
 * `Subscription.events(names: ["subscription.*"])` hands a client an untyped envelope; `customerSubscriptionChanged`
 * hands it the customer's subscription, with its items and billing cycles, as `subscription(id:)` reads it, each time
 * it moves — created, activated, paused, resumed, canceled, expired, renewed, or a cycle's payment failed. The facts
 * are the ones `SubscriptionStreamedEvents` declares, which the outbox consumer publishes on `<event>:<tenantId>`: the
 * topics this field opens, so a move never reaches a subscriber from another tenant's topic.
 *
 * **Why the field is not `subscriptionChanged`.** The type is `CustomerSubscription` because `Subscription` is the
 * schema's root operation type; a field named after the root would read as the root type's own change.
 *
 * **Isolation is the kernel's**: `tenantScopedTopicStream` opens the subscriber's own tenant topics only, drops an
 * envelope that states another tenant or none, drops one of another organization, and re-checks the row the read
 * returns. The read is the `subscription` query's own (`findOneDetailed`), run inside the subscriber's context, so it
 * is scoped to the subscriber's tenant and organization and answers exactly what that query would — or nothing.
 *
 * **The gates of the subscription queries**: the tenant and permission guards, the GraphQL feature and the
 * subscription feature, and `SUBSCRIPTIONS_VIEW`.
 *
 * Handover 2026-10-13 §4.J (owner decision 8): `customerSubscriptionChanged` is the typed field for the
 * `subscription` aggregate the plugin already streams (`tools/scripts/subscription-parity-check.mjs`).
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(SubscriptionFeatures.SUBSCRIPTION)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
export class CustomerSubscriptionStreamResolver {
	constructor(
		private readonly subscriptionService: SubscriptionService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * Every lifecycle move of a customer's subscription of the caller's tenant.
	 *
	 * @param subscriptionId Narrows the stream to one subscription.
	 * @param customerId Narrows it to the subscriptions of one customer, read from the subscription itself.
	 * @param action Narrows it to one move — the event name's last segment (`activated`, `payment-failed`, …).
	 * @returns The subscription as `subscription(id:)` reads it when the move is delivered — a later move may already show.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Subscription('customerSubscriptionChanged', { resolve: deliverPayloadAsIs })
	customerSubscriptionChanged(
		@Args('subscriptionId', { type: () => ID }) subscriptionId?: string,
		@Args('customerId', { type: () => ID }) customerId?: string,
		@Args('action') action?: string
	) {
		return tenantScopedTopicStream<SubscriptionEnvelope, CustomerSubscription>(this.pubSub, SUBSCRIPTION_STREAMED_EVENTS, {
			narrow: (envelope) =>
				(!subscriptionId || String(envelope.aggregate?.id ?? '') === String(subscriptionId)) &&
				(!action || envelope.name === `subscription.${action}`),
			read: async (envelope) => {
				const id = envelope.aggregate?.id;
				if (!id) return null;

				const subscription = await this.subscriptionService.findOneDetailed(id);

				// The customer is the subscription's own column, compared on the row that was re-read.
				return !customerId || String(subscription.customerId ?? '') === String(customerId) ? subscription : null;
			}
		});
	}
}
