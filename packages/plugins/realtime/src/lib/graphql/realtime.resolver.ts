import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IRealtimeEventEnvelope, PermissionsEnum, REALTIME_SUBSCRIBABLE_EVENTS } from '@gauzy/contracts';
import {
	deliverPayloadAsIs,
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	GraphqlPubSub,
	PermissionGuard,
	Permissions,
	tenantScopedTopicStream,
	TenantPermissionGuard
} from '@gauzy/core';
import type { SubscriptionEnvelope } from '@gauzy/core';
import { resolveRealtimeSelection, toRealtimeEnvelope } from './realtime-envelope';

/**
 * `Subscription.collaborationEvents`: the collaboration events of the caller's tenant and organization.
 *
 * The stream is opened on the caller's tenant topics (`<eventName>:<tenantId>`) through the kernel's
 * `tenantScopedTopicStream`, which captures the subscriber's tenant, organization and user when the field
 * resolves and decides every envelope against them — an addressed event reaches the caller only when they
 * are one of its recipients. The selection is resolved against the plugin's own catalogue only: a client
 * cannot reach the commerce or inbox streams through this field, whatever else the installation streams.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class RealtimeResolver {
	constructor(private readonly pubSub: GraphqlPubSub) {}

	@Permissions(PermissionsEnum.REALTIME_SUBSCRIBE)
	@Subscription('collaborationEvents', { resolve: deliverPayloadAsIs })
	collaborationEvents(
		@Args('names', { type: () => [String] }) names: string[],
		@Args('aggregateId', { type: () => ID, nullable: true }) aggregateId?: string
	): AsyncIterableIterator<IRealtimeEventEnvelope> {
		const selected = resolveRealtimeSelection(names ?? []);
		if (!selected.length) {
			throw new BadRequestException(
				`The selection matches no collaboration event. Select exact names or one-segment patterns among: ${REALTIME_SUBSCRIBABLE_EVENTS.join(
					', '
				)}.`
			);
		}

		return tenantScopedTopicStream<SubscriptionEnvelope, IRealtimeEventEnvelope>(this.pubSub, selected, {
			narrow: (envelope) => !aggregateId || String(envelope.aggregate?.id ?? '') === String(aggregateId),
			read: (envelope) => toRealtimeEnvelope(envelope)
		});
	}
}
