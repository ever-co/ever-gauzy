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
import { FulfillmentStatusDetail } from '@gauzy/contracts';
import { Fulfillment } from '../fulfillment/fulfillment.entity';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { FULFILLMENT_EVENTS } from '../fulfillment.types';
import { FULFILLMENT_STREAMED_EVENTS } from '../fulfillment-streamed-events';

/**
 * The shipment streams: typed fields over the lifecycle facts the fulfilment service already appends to the outbox.
 *
 * `Subscription.events(names: ["fulfillment.*"])` hands a client an untyped envelope; these fields hand it the
 * shipment, with its lines, as `fulfillment(id:)` reads it. The facts are the ones `FulfillmentStreamedEvents`
 * declares — created, shipped, in transit, delivered, canceled — which the fulfilment service appends to the outbox
 * through the shipment's own entity manager once the write that earned them returned, and which the outbox consumer
 * publishes on `<event>:<tenantId>`: the topics these fields open. A move therefore reaches a subscriber once it was
 * written, and never from another tenant's topic.
 *
 * **Isolation is the kernel's**: `tenantScopedTopicStream` opens the subscriber's own tenant topics only, drops an
 * envelope that states another tenant or none, drops one of another organization, and re-checks the row the read
 * returns. The read is scoped to the subscriber's tenant and organization explicitly, so a subscriber receives
 * exactly what `fulfillment(id:)` would answer it — or nothing.
 *
 * **The gates of the fulfilment queries**: the tenant and permission guards, the GraphQL feature and
 * `FULFILLMENTS_VIEW`. No code of the plugin's own stands beside `FEATURE_GRAPHQL`, for the reason
 * `FulfillmentResolver` states: the controllers serving the same resources state none.
 *
 * Handover 2026-10-13 §4.J (owner decision 8, "Add a gate + build backlog"): `fulfillmentCreated` was promised by
 * the design and served by nothing (§7.65 item 19); `fulfillmentChanged` is the typed field for the `fulfillment`
 * aggregate the plugin already streams (`tools/scripts/subscription-parity-check.mjs`).
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW)
export class FulfillmentSubscriptionResolver {
	constructor(
		private readonly fulfillmentService: FulfillmentService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * A shipment was created — outbound for an order, or the leg a return travels back on.
	 *
	 * Rides `fulfillment.created`, the fact the fulfilment service appends when a shipment is recorded, so it needs no
	 * event of its own.
	 *
	 * @param orderId Narrows the stream to the shipments of one order.
	 * @param warehouseId Narrows it to one location.
	 * @returns The created shipment, with its lines.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW)
	@Subscription('fulfillmentCreated', { resolve: deliverPayloadAsIs })
	fulfillmentCreated(
		@Args('orderId', { type: () => ID }) orderId?: string,
		@Args('warehouseId', { type: () => ID }) warehouseId?: string
	) {
		return tenantScopedTopicStream<SubscriptionEnvelope, Fulfillment>(
			this.pubSub,
			FULFILLMENT_EVENTS[FulfillmentStatusDetail.PENDING],
			{ read: async (envelope, scope) => this.narrowed(await this.readFulfillment(envelope, scope), orderId, warehouseId) }
		);
	}

	/**
	 * Every lifecycle move of a shipment of the caller's tenant: created, shipped, in transit, delivered, canceled.
	 *
	 * @param fulfillmentId Narrows the stream to one shipment.
	 * @param orderId Narrows it to the shipments of one order, read from the shipment itself.
	 * @param action Narrows it to one move — the event name's last segment (`shipped`, `delivered`, …).
	 * @returns The shipment in the state the move left it, as `fulfillment(id:)` reads it.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.FULFILLMENTS_VIEW)
	@Subscription('fulfillmentChanged', { resolve: deliverPayloadAsIs })
	fulfillmentChanged(
		@Args('fulfillmentId', { type: () => ID }) fulfillmentId?: string,
		@Args('orderId', { type: () => ID }) orderId?: string,
		@Args('action') action?: string
	) {
		return tenantScopedTopicStream<SubscriptionEnvelope, Fulfillment>(this.pubSub, FULFILLMENT_STREAMED_EVENTS, {
			narrow: (envelope) =>
				(!fulfillmentId || String(envelope.aggregate?.id ?? '') === String(fulfillmentId)) &&
				(!action || envelope.name === `fulfillment.${action}`),
			read: async (envelope, scope) => this.narrowed(await this.readFulfillment(envelope, scope), orderId)
		});
	}

	/**
	 * The shipment, when it is of the order and the location the subscriber narrowed by.
	 *
	 * The order and the location are the shipment's own columns, so they are compared on the row that was re-read
	 * rather than on the event's payload: the subscriber is told about the shipment it can read.
	 *
	 * @param fulfillment The re-read shipment, or null.
	 * @param orderId The order the subscriber narrowed by.
	 * @param warehouseId The location the subscriber narrowed by.
	 * @returns The shipment, or null when it is outside the narrowing.
	 */
	private narrowed(fulfillment: Fulfillment | null, orderId?: string, warehouseId?: string): Fulfillment | null {
		if (!fulfillment) return null;
		if (orderId && String(fulfillment.orderId ?? '') !== String(orderId)) return null;
		if (warehouseId && String(fulfillment.warehouseId ?? '') !== String(warehouseId)) return null;

		return fulfillment;
	}

	/**
	 * Re-reads the shipment an envelope names, as the subscriber, with its lines.
	 *
	 * @param envelope The fact.
	 * @param scope The subscriber, captured when the stream opened.
	 * @returns The shipment, or `null` when the envelope names none or the subscriber cannot read it.
	 */
	private async readFulfillment(envelope: SubscriptionEnvelope, scope: SubscriberScope): Promise<Fulfillment | null> {
		const id = envelope.aggregate?.id;

		if (!id) return null;

		return await this.fulfillmentService.findOneByOptions({
			where: {
				id,
				tenantId: scope.tenantId,
				...(scope.organizationId ? { organizationId: scope.organizationId } : {})
			},
			relations: ['lines']
		} as never);
	}
}
