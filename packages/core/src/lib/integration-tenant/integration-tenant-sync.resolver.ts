import { UseGuards } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { ID as Id, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriberScope, deliverPayloadAsIs, tenantScopedTopicStream } from '../graphql/subscriptions/plugin-subscription';
import type { SubscriptionEnvelope } from '../graphql/subscriptions/subscription-hub.service';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationTenantService } from './integration-tenant.service';
import { INTEGRATION_TENANT_SYNCED } from './integration-tenant-sync.service';

/**
 * What `Subscription.integrationSyncCompleted` delivers: the connection, re-read as the subscriber, and what the run
 * stated about itself.
 */
export interface IIntegrationSyncCompleted {
	/** The connection that finished synchronising, as `integrationTenant(id:)` reads it. */
	readonly integrationTenant: IntegrationTenant;
	/** The provider, as the connection names it. */
	readonly name: string;
	/** When the run finished. */
	readonly syncedAt: Date | string;
	/** How many records of each kind the run handled. */
	readonly counts: Record<string, number>;
	/** The connection's tenant, which the kernel checks against the subscriber's once more. */
	readonly tenantId: Id;
	/** The connection's organization, which the kernel checks against the subscriber's. */
	readonly organizationId?: Id;
}

/**
 * The integration stream: a typed field over the `integration_tenant.synced` fact each integration appends when one
 * of its synchronisations finishes (`IntegrationTenantSyncService.recordSyncCompleted`).
 *
 * `Subscription.events(names: ["integration_tenant.synced"])` hands a client the untyped envelope;
 * `integrationSyncCompleted` hands it the connection as `integrationTenant(id:)` reads it, beside what the run stated —
 * the provider, the moment and the counts. The fact is appended in the transaction that stamps the connection's
 * `lastSyncedAt`, and the outbox consumer publishes it on `integration_tenant.synced:<tenantId>`: the topic this field
 * opens. So a run reaches a subscriber once its stamp committed, and never from another tenant's topic.
 *
 * **Isolation is the kernel's**: `tenantScopedTopicStream` opens the subscriber's own tenant topic only, drops an
 * envelope that states another tenant or none, drops one of another organization, and re-checks the value the read
 * returns. The read re-reads the connection scoped to the subscriber's tenant and organization explicitly, so a
 * subscriber is told only about a connection `integrationTenant(id:)` would answer it.
 *
 * **The gates of the connection queries**: the tenant and permission guards, the GraphQL feature, and
 * `INTEGRATION_VIEW` — the grant the list and the node state.
 *
 * Handover 2026-10-13 §4.J (owner decision 8): `integrationSyncCompleted` was promised by the design and served by
 * nothing, because no integration published a sync-completed fact (§7.68 class 5).
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
export class IntegrationTenantSyncResolver {
	constructor(
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * Every finished synchronisation of an integration connection of the caller's tenant.
	 *
	 * @param integrationTenantId Narrows the stream to one connection.
	 * @param name Narrows it to one provider (`GITHUB`, `HUBSTAFF`, …), read from the connection itself.
	 * @returns The connection, the provider, the moment and the counts.
	 */
	@Subscription('integrationSyncCompleted', { resolve: deliverPayloadAsIs })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	integrationSyncCompleted(
		@Args('integrationTenantId', { type: () => ID, nullable: true }) integrationTenantId?: Id,
		@Args('name', { type: () => String, nullable: true }) name?: string
	) {
		return tenantScopedTopicStream<SubscriptionEnvelope, IIntegrationSyncCompleted>(this.pubSub, INTEGRATION_TENANT_SYNCED, {
			narrow: (envelope) => !integrationTenantId || String(envelope.aggregate?.id ?? '') === String(integrationTenantId),
			read: (envelope, scope) => this.readCompletion(envelope, scope, name)
		});
	}

	/**
	 * The connection an envelope names, re-read as the subscriber, with what the run stated.
	 *
	 * @param envelope The fact.
	 * @param scope The subscriber, captured when the stream opened.
	 * @param name The provider the subscriber narrowed by.
	 * @returns The completion, or `null` when the subscriber cannot read the connection or narrowed it away.
	 */
	private async readCompletion(
		envelope: SubscriptionEnvelope,
		scope: SubscriberScope,
		name?: string
	): Promise<IIntegrationSyncCompleted | null> {
		const id = envelope.aggregate?.id;

		if (!id) return null;

		const connection = await this.integrationTenantService.findOneByWhereOptions({
			id,
			tenantId: scope.tenantId,
			...(scope.organizationId ? { organizationId: scope.organizationId } : {})
		} as never);

		if (!connection) return null;
		// The provider is the connection's own column, compared on the row that was re-read.
		if (name && String(connection.name ?? '') !== String(name)) return null;

		const data = (envelope.data ?? {}) as { syncedAt?: Date | string; counts?: Record<string, number> };

		return {
			integrationTenant: connection,
			name: connection.name,
			syncedAt: data.syncedAt ?? envelope.occurredAt,
			counts: data.counts ?? {},
			tenantId: connection.tenantId,
			organizationId: connection.organizationId
		};
	}
}
