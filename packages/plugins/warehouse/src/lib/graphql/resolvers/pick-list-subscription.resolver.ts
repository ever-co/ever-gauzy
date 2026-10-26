import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
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
import { PickList } from '../../pick-list/pick-list.entity';
import { PickListService } from '../../pick-list/pick-list.service';
import { WarehouseFeatures } from '../../warehouse.features';
import { WarehousePermissions } from '../../warehouse.permissions';
import { WAREHOUSE_STREAMED_EVENTS } from '../../warehouse-streamed-events';

/**
 * The pick-list stream: a typed field over the moves the pick-list service appends to the outbox.
 *
 * A pick list is the unit of work on the floor, and until the service appended its moves nothing outside the package
 * could follow one. Each move — created, assigned, started, picked, canceled — is now appended in the transaction that
 * makes it (`PickListService.move`), `WarehouseStreamedEvents` declares the names, and the outbox consumer publishes
 * each on `<event>:<tenantId>`: the topics this field opens. A move therefore reaches a subscriber once it committed,
 * and never from another tenant's topic.
 *
 * **Isolation is the kernel's**: `tenantScopedTopicStream` opens the subscriber's own tenant topics only, drops an
 * envelope that states another tenant or none, drops one of another organization, and re-checks the row the read
 * returns. The read is the `pickList` query's own (`findOneDetailed`), run inside the subscriber's context, so it is
 * scoped to the subscriber's tenant and organization and answers what that query would — or nothing.
 *
 * **The gates of the pick-list queries**: the tenant and permission guards, the GraphQL feature and the warehouse
 * feature, and `PICK_LISTS_VIEW`.
 *
 * Handover 2026-10-13 §4.J (owner decision 8, "Add a gate + build backlog"): `pickListChanged` was promised by the
 * design and served by nothing, because the warehouse published no event at all (§7.65 item 19).
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
export class PickListSubscriptionResolver {
	constructor(
		private readonly pickListService: PickListService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * Every move of a pick list of the caller's tenant.
	 *
	 * @param pickListId Narrows the stream to one list.
	 * @param warehouseId Narrows it to the lists of one location, read from the list itself.
	 * @param waveId Narrows it to the lists of one wave, read from the list itself.
	 * @param assignedToUserId Narrows it to the lists one picker owns, read from the list itself.
	 * @param action Narrows it to one move — the event name's last segment (`assigned`, `picked`, …).
	 * @returns The list as `pickList(id:)` reads it when the move is delivered — a later move may already show.
	 */
	@Permissions(WarehousePermissions.PICK_LISTS_VIEW)
	@Subscription('pickListChanged', { resolve: deliverPayloadAsIs })
	pickListChanged(
		@Args('pickListId', { type: () => ID }) pickListId?: string,
		@Args('warehouseId', { type: () => ID }) warehouseId?: string,
		@Args('waveId', { type: () => ID }) waveId?: string,
		@Args('assignedToUserId', { type: () => ID }) assignedToUserId?: string,
		@Args('action') action?: string
	) {
		return tenantScopedTopicStream<SubscriptionEnvelope, PickList>(this.pubSub, WAREHOUSE_STREAMED_EVENTS, {
			narrow: (envelope) =>
				(!pickListId || String(envelope.aggregate?.id ?? '') === String(pickListId)) &&
				(!action || envelope.name === `pick_list.${action}`),
			read: async (envelope) => {
				const id = envelope.aggregate?.id;
				if (!id) return null;

				const list = await this.pickListService.findOneDetailed(id);

				// The location, the wave and the picker are the list's own columns, compared on the row that was
				// re-read rather than on the event's payload.
				if (warehouseId && String(list.warehouseId ?? '') !== String(warehouseId)) return null;
				if (waveId && String(list.waveId ?? '') !== String(waveId)) return null;
				if (assignedToUserId && String(list.assignedToUserId ?? '') !== String(assignedToUserId)) return null;

				return list;
			}
		});
	}
}
