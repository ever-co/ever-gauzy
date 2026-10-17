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
import { OrderReturn } from '../../order-return/order-return.entity';
import { OrderReturnService } from '../../order-return/order-return.service';
import { RETURNS_STREAMED_EVENTS } from '../../returns-streamed-events';
import { ReturnsFeatures } from '../../returns.features';
import { ReturnsPermissions } from '../../returns.permissions';

/**
 * The return stream: a typed field over the lifecycle facts the return service already appends to the outbox.
 *
 * `Subscription.events(names: ["return.*"])` hands a client an untyped envelope; `orderReturnChanged` hands it the
 * return, as `orderReturn(id:)` reads it, each time the return moves — requested, approved, rejected, canceled,
 * received, refunded, closed. The facts are the ones `ReturnsStreamedEvents` declares: the return service appends
 * each move in the transaction that makes it and the outbox consumer publishes it on `<event>:<tenantId>`, the
 * topics this field opens, so a move reaches a subscriber once it committed and never from another tenant's topic.
 *
 * **Isolation is the kernel's**: `tenantScopedTopicStream` opens the subscriber's own tenant topics only, drops an
 * envelope that states another tenant or none, drops one of another organization, and re-checks the row `read`
 * returns. `read` is the `orderReturn` query's own read (`findOneDetailed`), scoped to the subscriber's tenant and
 * organization, so the stream answers exactly what that query would — or nothing.
 *
 * **The gates of the return queries**: the tenant and permission guards, the GraphQL feature and the returns
 * feature, and `RETURNS_VIEW`.
 *
 * Handover 2026-10-13 §4.J (owner decision 8): `orderReturnChanged` was promised by the design and served by
 * nothing (§7.65 item 19); `returns-streamed-events.ts` already named it as the field that follows these facts.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
export class OrderReturnSubscriptionResolver {
	constructor(
		private readonly orderReturnService: OrderReturnService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * Every lifecycle move of a return of the caller's tenant.
	 *
	 * @param orderReturnId Narrows the stream to one return.
	 * @param orderId Narrows it to the returns of one order, read from the return itself.
	 * @param action Narrows it to one move — the event name's last segment (`approved`, `received`, …).
	 * @returns The return in the state the move left it.
	 */
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	@Subscription('orderReturnChanged', { resolve: deliverPayloadAsIs })
	orderReturnChanged(
		@Args('orderReturnId', { type: () => ID }) orderReturnId?: string,
		@Args('orderId', { type: () => ID }) orderId?: string,
		@Args('action') action?: string
	) {
		return tenantScopedTopicStream<SubscriptionEnvelope, OrderReturn>(this.pubSub, RETURNS_STREAMED_EVENTS, {
			narrow: (envelope) =>
				(!orderReturnId || String(envelope.aggregate?.id ?? '') === String(orderReturnId)) &&
				(!action || envelope.name === `return.${action}`),
			read: async (envelope) => {
				const id = envelope.aggregate?.id;
				if (!id) return null;

				const orderReturn = await this.orderReturnService.findOneDetailed(id);

				// The order is the return's own column, compared on the row that was re-read.
				return !orderId || String(orderReturn.orderId ?? '') === String(orderId) ? orderReturn : null;
			}
		});
	}
}
