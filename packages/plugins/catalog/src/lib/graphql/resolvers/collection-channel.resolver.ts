import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { PublicationStatus } from '../../catalog.types';
import { CollectionChannel } from '../../collection-channel/collection-channel.entity';
import { CollectionChannelService } from '../../collection-channel/collection-channel.service';

/**
 * Placement of a collection on a channel, over GraphQL.
 *
 * Publication is where a collection is shown, which is a different statement from the collection's own
 * lifecycle; both are reachable here and over REST, and both resolve the same permission.
 */
@Resolver('CollectionChannel')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	): Promise<IPagination<CollectionChannel>> {
		return this.collectionChannelService.paginate({
			where: { ...filter },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
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
