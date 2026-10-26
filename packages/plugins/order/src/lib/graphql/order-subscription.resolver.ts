import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	GraphqlPubSub,
	PermissionGuard,
	Permissions,
	SubscriberScope,
	SubscriptionEnvelope,
	TenantPermissionGuard,
	deliverPayloadAsIs,
	tenantScopedTopicStream
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { OrderService } from '../order/order.service';
import { ORDER_EVENTS } from '../order.types';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { ORDER_STREAMED_EVENTS } from '../order-streamed-events';
import { Order } from './types';

/**
 * The order streams: typed fields over the lifecycle facts the order service already appends to the outbox.
 *
 * **Why typed fields when `Subscription.events` already carries `order.*`.** `events(names:)` hands a client an
 * untyped envelope (`data: JSON`); a typed field hands it the order, as the `order` query would read it now. Both
 * follow the same facts: the order service appends each move to the outbox in the transaction that makes it,
 * `OrderStreamedEvents` declares the names, and the outbox consumer publishes each one on
 * `<event>:<tenantId>` (`GraphqlPubSub`) — the topics these fields open. A fact therefore reaches a subscriber
 * only once its transaction committed, and never from another tenant's topic.
 *
 * **Isolation is the kernel's, restated nowhere.** `tenantScopedTopicStream` opens the subscriber's own tenant
 * topics only (captured when the subscription opens), drops an envelope whose own `tenantId` is not the
 * subscriber's or is missing, drops one of another organization when the subscriber acts in one, and re-checks
 * the row `read` returns the same way. `read` re-reads the order through `OrderService`, whose read is scoped to
 * the subscriber's tenant, so a subscriber receives exactly what `order(id:)` would answer it — or nothing.
 *
 * **The same gates as the order queries**: the tenant and permission guards, the GraphQL feature
 * (`FEATURE_GRAPHQL`) and `ORDERS_VIEW` on the class and on each field.
 *
 * Handover 2026-10-13 §4.J (owner decision 8, "Add a gate + build backlog"): `checkoutCompleted` was promised by
 * the design and served by nothing (§7.65 item 19); `orderChanged` is the typed field for the `order` aggregate
 * the plugin already streams (`tools/scripts/subscription-parity-check.mjs`).
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
export class OrderSubscriptionResolver {
	constructor(
		private readonly orderService: OrderService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * Every lifecycle move of an order of the caller's tenant: placed, confirmed, canceled, completed, archived.
	 *
	 * @param orderId Narrows the stream to one order.
	 * @param action Narrows it to one move — the event name's last segment (`placed`, `canceled`, …).
	 * @returns The order in the state the move left it, as `order(id:)` reads it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Subscription('orderChanged', { resolve: deliverPayloadAsIs })
	orderChanged(@Args('orderId', { type: () => ID }) orderId?: string, @Args('action') action?: string) {
		return tenantScopedTopicStream<SubscriptionEnvelope, Order>(this.pubSub, ORDER_STREAMED_EVENTS, {
			narrow: (envelope) =>
				(!orderId || String(envelope.aggregate?.id ?? '') === String(orderId)) &&
				(!action || envelope.name === `order.${action}`),
			read: (envelope, scope) => this.readOrder(envelope, scope)
		});
	}

	/**
	 * A checkout completed: an order was placed.
	 *
	 * Rides `order.placed` — the fact the order service appends when a draft becomes a real order, which is what
	 * a completed checkout produces — so it needs no event of its own.
	 *
	 * @param cartId Narrows the stream to the order one cart was checked out into.
	 * @param channelId Narrows it to one sales channel.
	 * @returns The placed order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Subscription('checkoutCompleted', { resolve: deliverPayloadAsIs })
	checkoutCompleted(@Args('cartId', { type: () => ID }) cartId?: string, @Args('channelId', { type: () => ID }) channelId?: string) {
		return tenantScopedTopicStream<SubscriptionEnvelope, Order>(this.pubSub, ORDER_EVENTS.PLACED, {
			read: async (envelope, scope) => {
				const order = await this.readOrder(envelope, scope);

				// The cart and the channel are the order's own columns, so they are compared on the row that was
				// re-read rather than on the event's payload: the subscriber is told about the order it can read.
				if (!order) return null;
				if (cartId && String(order.cartId ?? '') !== String(cartId)) return null;
				if (channelId && String(order.channelId ?? '') !== String(channelId)) return null;

				return order;
			}
		});
	}

	/**
	 * Re-reads the order an envelope names, as the subscriber.
	 *
	 * @param envelope The fact.
	 * @param scope The subscriber, captured when the stream opened.
	 * @returns The order, or `null` when the envelope names none or the subscriber cannot read it.
	 */
	private async readOrder(envelope: SubscriptionEnvelope, scope: SubscriberScope): Promise<Order | null> {
		const id = envelope.aggregate?.id;

		if (!id) return null;

		return (await this.orderService.findOneByWhereOptions({
			id,
			tenantId: scope.tenantId,
			...(scope.organizationId ? { organizationId: scope.organizationId } : {})
		} as never)) as Order;
	}
}
