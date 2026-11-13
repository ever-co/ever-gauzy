import { BadRequestException, Inject, Optional, UseGuards } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IRealtimeEventEnvelope, PermissionsEnum } from '@gauzy/contracts';
import {
	currentSubscriberUserId,
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
import { RealtimeAudience } from '../realtime-audience';
import {
	audienceEventOfEnvelope,
	collaborationEventNames,
	resolveRealtimeSelection,
	toRealtimeEnvelope
} from './realtime-envelope';

/**
 * `Subscription.collaborationEvents`: the collaboration events of the caller's tenant and organization.
 *
 * The stream is opened on the caller's tenant topics (`<eventName>:<tenantId>`) through the kernel's
 * `tenantScopedTopicStream`, which captures the subscriber's tenant, organization and user when the field
 * resolves and decides every envelope against them — an addressed event reaches the caller only when they
 * are one of its recipients. Every envelope the stream admits is then put to the audience checks
 * ({@link RealtimeAudience}) inside the subscriber's request context, when it is handed over rather than when it
 * was written: a page, a task or a comment thread the subscriber cannot read, and a chat conversation they are no
 * longer a member of, are not delivered. The selection is resolved against the collaboration families only — the
 * plugin's own events and the chat and inbox events those plugins declare when loaded: a client cannot reach the
 * commerce streams through this field, whatever else the installation streams.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class RealtimeResolver {
	constructor(
		private readonly pubSub: GraphqlPubSub,
		// The token is named: the type `SubscriptionCatalogue | undefined` is emitted as `Object`, which Nest cannot
		// resolve, so the optional catalogue was always undefined and the field offered the built-in names only —
		// every chat and inbox selection was refused and the subscription completed at once.
		@Optional() @Inject(SubscriptionCatalogue) private readonly catalogue: SubscriptionCatalogue | undefined,
		private readonly audience: RealtimeAudience
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

		// The subscriber's user, captured with the scope when the field resolves (the stream checks recipients by it).
		const userId = currentSubscriberUserId();
		return tenantScopedTopicStream<SubscriptionEnvelope, IRealtimeEventEnvelope>(this.pubSub, selected, {
			recipientUserId: userId,
			narrow: (envelope) => !aggregateId || String(envelope.aggregate?.id ?? '') === String(aggregateId),
			// Runs in the subscriber's async context; a check that throws drops the event (the stream's own rule).
			read: async (envelope, scope) => {
				const value = toRealtimeEnvelope(envelope);
				if (!value) {
					return undefined;
				}
				const [admitted] = await this.audience.admitted([audienceEventOfEnvelope(envelope)], {
					tenantId: scope.tenantId,
					organizationId: scope.organizationId ?? null,
					userId
				});
				return admitted ? value : undefined;
			}
		});
	}
}
