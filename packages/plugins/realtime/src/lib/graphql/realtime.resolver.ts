import { BadRequestException, Optional, UseGuards } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IRealtimeEventEnvelope, PermissionsEnum } from '@gauzy/contracts';
import {
	deliverPayloadAsIs,
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	GraphqlPubSub,
	PermissionGuard,
	Permissions,
	SubscriptionCatalogue,
	tenantScopedTopicStream,
	TenantPermissionGuard
} from '@gauzy/core';
import type { SubscriptionEnvelope } from '@gauzy/core';
import { collaborationEventNames, resolveRealtimeSelection, toRealtimeEnvelope } from './realtime-envelope';

/**
 * `Subscription.collaborationEvents`: the collaboration events of the caller's tenant and organization.
 *
 * The stream is opened on the caller's tenant topics (`<eventName>:<tenantId>`) through the kernel's
 * `tenantScopedTopicStream`, which captures the subscriber's tenant, organization and user when the field
 * resolves and decides every envelope against them — an addressed event reaches the caller only when they
 * are one of its recipients. The selection is resolved against the collaboration families only — the plugin's
 * own events and the chat and inbox events those plugins declare when loaded: a client cannot reach the
 * commerce streams through this field, whatever else the installation streams.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class RealtimeResolver {
	constructor(
		private readonly pubSub: GraphqlPubSub,
		@Optional() private readonly catalogue?: SubscriptionCatalogue
	) {}

	@Permissions(PermissionsEnum.REALTIME_SUBSCRIBE)
	@Subscription('collaborationEvents', { resolve: deliverPayloadAsIs })
	collaborationEvents(
		@Args('names', { type: () => [String] }) names: string[],
		@Args('aggregateId', { type: () => ID, nullable: true }) aggregateId?: string
	): AsyncIterableIterator<IRealtimeEventEnvelope> {
		const offered = collaborationEventNames(this.catalogue?.names() ?? []);
		const selected = resolveRealtimeSelection(names ?? [], offered);
		if (!selected.length) {
			throw new BadRequestException(
				`The selection matches no collaboration event. Select exact names or one-segment patterns among: ${offered.join(', ')}.`
			);
		}

		return tenantScopedTopicStream<SubscriptionEnvelope, IRealtimeEventEnvelope>(this.pubSub, selected, {
			narrow: (envelope) => !aggregateId || String(envelope.aggregate?.id ?? '') === String(aggregateId),
			read: (envelope) => toRealtimeEnvelope(envelope)
		});
	}
}
