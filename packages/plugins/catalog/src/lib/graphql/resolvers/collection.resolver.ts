import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { ID, IPagination } from '@gauzy/contracts';
import { EventBus, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { Collection } from '../../collection/collection.entity';
import { CollectionService } from '../../collection/collection.service';
import { CollectionChannelService } from '../../collection-channel/collection-channel.service';
import { CollectionProductService } from '../../collection-product/collection-product.service';
import { CollectionProduct } from '../../collection-product/collection-product.entity';
import { PublicationStatus } from '../../catalog.types';
import { CollectionChangedEvent } from '../../events';
import { toAsyncIterable } from '../async-iterable';

/**
 * Collections over GraphQL.
 *
 * The resolver is a thin adapter over the services the REST controllers use: it resolves the same
 * permissions, calls the same methods and returns the same rows, so a GraphQL caller and a REST caller
 * cannot drift apart. Membership and publication are written through the resolvers because they are
 * sets rather than rows — the mutations say so in their names.
 */
@Resolver('Collection')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class CollectionResolver {
	constructor(
		private readonly collectionService: CollectionService,
		private readonly collectionProductService: CollectionProductService,
		private readonly collectionChannelService: CollectionChannelService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists the collections of the caller's organization.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collections')
	async collections(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPagination<Collection>> {
		return this.collectionService.paginate({
			where: { ...(filter ?? {}) },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
	}

	/**
	 * Reads one collection by id.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collection')
	async collection(@Args('id') id: ID): Promise<Collection> {
		return this.collectionService.findOneByIdString(id);
	}

	/**
	 * Reads one collection by its slug.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collectionBySlug')
	async collectionBySlug(@Args('slug') slug: string): Promise<Collection> {
		return this.collectionService.findBySlug(slug);
	}

	/**
	 * Lists the manual product membership of the collections that match the filter.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collectionProducts')
	async collectionProducts(
		@Args('filter') filter: { collectionId?: ID; productId?: ID } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPagination<CollectionProduct>> {
		return this.collectionProductService.paginate({
			where: { ...filter },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
	}

	/**
	 * Creates a collection.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_CREATE))
	@Mutation('createCollection')
	async createCollection(@Args('input') input: Partial<Collection>): Promise<Collection> {
		return this.collectionService.create(input);
	}

	/**
	 * Updates a collection.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('updateCollection')
	async updateCollection(@Args('id') id: ID, @Args('input') input: Partial<Collection>): Promise<Collection> {
		return this.collectionService.update(id, input);
	}

	/**
	 * Deletes a collection.
	 *
	 * @returns True once the collection is gone.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('deleteCollection')
	async deleteCollection(@Args('id') id: ID): Promise<boolean> {
		await this.collectionService.delete(id);

		return true;
	}

	/**
	 * Curates products into a collection, appending them to the manual set.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('addCollectionProducts')
	async addCollectionProducts(
		@Args('collectionId') collectionId: ID,
		@Args('productIds') productIds: ID[]
	): Promise<CollectionProduct[]> {
		const existing = await this.collectionProductService.findByCollection(collectionId);
		const additions = productIds.filter((id) => !existing.some((row) => row.productId === id));

		return this.collectionProductService.replaceProducts(collectionId, [
			...existing.map((row) => row.productId),
			...additions
		]);
	}

	/**
	 * Removes products from a collection's manual set.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('removeCollectionProducts')
	async removeCollectionProducts(
		@Args('collectionId') collectionId: ID,
		@Args('productIds') productIds: ID[]
	): Promise<CollectionProduct[]> {
		const existing = await this.collectionProductService.findByCollection(collectionId);

		return this.collectionProductService.replaceProducts(
			collectionId,
			existing.map((row) => row.productId).filter((id) => !productIds.includes(id))
		);
	}

	/**
	 * Publishes a collection on one channel, keeping the publications it already has.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('assignCollectionChannel')
	async assignCollectionChannel(
		@Args('collectionId') collectionId: ID,
		@Args('input') input: { channelId: ID; status: PublicationStatus; publishedAt?: Date }
	) {
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
	async unassignCollectionChannel(@Args('collectionId') collectionId: ID, @Args('channelId') channelId: ID) {
		const existing = await this.collectionChannelService.findByCollection(collectionId);

		return this.collectionChannelService.replaceChannels(
			collectionId,
			existing
				.filter((row) => row.channelId !== channelId)
				.map((row) => ({ channelId: row.channelId, status: row.status, publishedAt: row.publishedAt }))
		);
	}

	/**
	 * Streams the collections that change, optionally narrowed to one collection.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Subscription('collectionChanged')
	collectionChanged(@Args('id') id?: ID): AsyncIterable<CollectionChangedEvent> {
		const source = this.eventBus.ofType(CollectionChangedEvent);

		return toAsyncIterable(id ? source.pipe(filter((event) => event.collectionId === id)) : source);
	}
}
