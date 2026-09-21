import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { PublicationStatus } from '../../catalog.types';
import { CollectionChannel } from '../../collection-channel/collection-channel.entity';
import { CollectionChannelService } from '../../collection-channel/collection-channel.service';

/**
 * Placement of a collection on a channel, over GraphQL.
 *
 * Publication is where a collection is shown, which is a different statement from the collection's own
 * lifecycle; both are reachable here and over REST, and both resolve the same permission.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('CollectionChannel')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class CollectionChannelResolver {
	constructor(private readonly collectionChannelService: CollectionChannelService) {}

	/**
	 * Lists collection publication rows.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collectionChannels')
	async collectionChannels(
		@Args('filter') filter: { collectionId?: ID; channelId?: ID; status?: PublicationStatus } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<GraphqlConnection<CollectionChannel>> {
		const page = await this.collectionChannelService.paginate({
			where: { ...filter },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return connectionFromOffsetPage<CollectionChannel>(page, offset ?? 0);
	}

	/**
	 * Publishes a collection on one channel, keeping the publications it already has.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('assignCollectionChannel')
	async assignCollectionChannel(
		@Args('collectionId') collectionId: ID,
		@Args('input') input: { channelId: ID; status: PublicationStatus; publishedAt?: Date }
	): Promise<CollectionChannel[]> {
		const existing = await this.collectionChannelService.findByCollection(collectionId);
		const others = existing
			.filter((row) => row.channelId !== input.channelId)
			.map((row) => ({ channelId: row.channelId, status: row.status, publishedAt: row.publishedAt }));

		return this.collectionChannelService.replaceChannels(collectionId, [
			...others,
			{ channelId: input.channelId, status: input.status, publishedAt: input.publishedAt }
		]);
	}

	/**
	 * Withdraws a collection from one channel.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('unassignCollectionChannel')
	async unassignCollectionChannel(
		@Args('collectionId') collectionId: ID,
		@Args('channelId') channelId: ID
	): Promise<CollectionChannel[]> {
		const existing = await this.collectionChannelService.findByCollection(collectionId);

		return this.collectionChannelService.replaceChannels(
			collectionId,
			existing
				.filter((row) => row.channelId !== channelId)
				.map((row) => ({ channelId: row.channelId, status: row.status, publishedAt: row.publishedAt }))
		);
	}
}
