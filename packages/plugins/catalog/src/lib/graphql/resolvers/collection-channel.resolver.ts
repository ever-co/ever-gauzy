import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
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
	 *
	 * @param filter The collection, the channel and the status the publications are narrowed to.
	 * @param limit The page size, when it is stated the offset way.
	 * @param offset The row to start at, when it is stated the offset way.
	 * @param page The page, when it is stated the cursor way.
	 * @param withDeleted Whether the retired publications are included.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collectionChannels')
	async collectionChannels(
		@Args('filter') filter: { collectionId?: ID; channelId?: ID; status?: PublicationStatus } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<CollectionChannel>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.collectionChannelService.findAll({
			where: { ...filter },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return connectionFromOffsetPage<CollectionChannel>(listing, skip);
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

	/**
	 * Retires one collection publication recoverably, keeping the row.
	 *
	 * The route it mirrors is `DELETE /collection-channels/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. The set
	 * mutations above replace a collection's whole publication set, which is the wrong instrument for
	 * withdrawing one row a caller has already been given the identifier of, and no field answered that
	 * row's own lifecycle at all.
	 *
	 * The permission is the controller's own for the route — `COLLECTIONS_DELETE` — because retiring a
	 * publication is what makes a collection stop resolving on the channel it was placed on.
	 *
	 * @param id The collection publication to retire.
	 * @returns The publication, as the soft delete left it.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('softDeleteCollectionChannel')
	async softDeleteCollectionChannel(@Args('id') id: ID): Promise<CollectionChannel> {
		return this.collectionChannelService.softRemove(id);
	}

	/**
	 * Restores a collection publication that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /collection-channels/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. The row comes
	 * back with the status it was retired under, so a caller that withdrew a placement by mistake puts
	 * the collection back on that channel rather than republishing it from scratch.
	 *
	 * @param id The collection publication to restore.
	 * @returns The restored publication.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('recoverCollectionChannel')
	async recoverCollectionChannel(@Args('id') id: ID): Promise<CollectionChannel> {
		return this.collectionChannelService.softRecover(id);
	}
}
