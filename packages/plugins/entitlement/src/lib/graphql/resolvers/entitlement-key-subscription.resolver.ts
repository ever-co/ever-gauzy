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
import { EntitlementFeatures } from '../../entitlement.features';
import { EntitlementKey } from '../../entitlement-key/entitlement-key.entity';
import { EntitlementKeyService } from '../../entitlement-key/entitlement-key.service';
import { EntitlementPermissions } from '../../entitlement.permissions';
import { ENTITLEMENT_STREAMED_EVENTS } from '../../entitlement-streamed-events';

/**
 * The licence-key facts this package streams: the `entitlement_key.*` members of {@link ENTITLEMENT_STREAMED_EVENTS}.
 *
 * Read off the declared catalogue rather than restated, so the field follows exactly what `Subscription.events` may
 * select and no more: `entitlement_key.issued` is withheld there — its payload carries the holder's e-mail — and is
 * therefore never followed here either. Today that leaves `entitlement_key.revoked`.
 */
export const ENTITLEMENT_KEY_STREAM_NAMES: readonly string[] = ENTITLEMENT_STREAMED_EVENTS.filter((name) =>
	name.startsWith('entitlement_key.')
);

/**
 * The licence-key stream: a typed field over the key facts the key service already appends to the outbox.
 *
 * `Subscription.events(names: ["entitlement_key.*"])` hands a client an untyped envelope; `entitlementKeyChanged`
 * hands it the key, as `entitlementKeys` reads it — a row that never carries key material, only the display prefix.
 * The key service appends `entitlement_key.revoked` inside the transaction that withdraws the key (a revocation that
 * rolls back appends nothing), `EntitlementStreamedEvents` declares it, and the outbox consumer publishes it on
 * `<event>:<tenantId>` — the topic this field opens. A withdrawal therefore reaches a subscriber once it committed, and
 * never from another tenant's topic.
 *
 * **Isolation is the kernel's**: `tenantScopedTopicStream` opens the subscriber's own tenant topics only, drops an
 * envelope that states another tenant or none, drops one of another organization, and re-checks the row the read
 * returns. The read is the key service's `findOneScoped`, run inside the subscriber's own context, so it reads the
 * subscriber's tenant and organization and answers what `entitlementKeys` would — or nothing.
 *
 * **The gates of the key queries**: the tenant and permission guards, the GraphQL feature and the entitlement
 * feature, and `ENTITLEMENTS_VIEW`.
 *
 * Handover 2026-10-13 §4.J (owner decision 8): `entitlementKeyChanged` is the typed field for the `entitlement_key`
 * aggregate the plugin already streams (`tools/scripts/subscription-parity-check.mjs`).
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(EntitlementFeatures.ENTITLEMENT)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
export class EntitlementKeySubscriptionResolver {
	constructor(
		private readonly entitlementKeyService: EntitlementKeyService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * Every streamed move of a licence key of the caller's tenant — today, its withdrawal.
	 *
	 * @param entitlementKeyId Narrows the stream to one key.
	 * @param entitlementId Narrows it to the keys of one right, read from the key itself.
	 * @returns The key in the state the move left it.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Subscription('entitlementKeyChanged', { resolve: deliverPayloadAsIs })
	entitlementKeyChanged(
		@Args('entitlementKeyId', { type: () => ID }) entitlementKeyId?: string,
		@Args('entitlementId', { type: () => ID }) entitlementId?: string
	) {
		return tenantScopedTopicStream<SubscriptionEnvelope, EntitlementKey>(this.pubSub, ENTITLEMENT_KEY_STREAM_NAMES, {
			narrow: (envelope) => !entitlementKeyId || String(envelope.aggregate?.id ?? '') === String(entitlementKeyId),
			read: async (envelope) => {
				const id = envelope.aggregate?.id;
				if (!id) return null;

				const key = await this.entitlementKeyService.findOneScoped(id);

				// The right is the key's own column, compared on the row that was re-read.
				return !entitlementId || String(key.entitlementId ?? '') === String(entitlementId) ? key : null;
			}
		});
	}
}
