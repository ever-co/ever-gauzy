import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { ID, IPagination } from '@gauzy/contracts';
import { EventBus, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { Collection } from '../../collection/collection.entity';
import { CollectionService } from '../../collection/collection.service';
import { CollectionChangedEvent } from '../../events';
import { toAsyncIterable } from '../async-iterable';

/**
 * Collections over GraphQL.
 *
 * The resolver is a thin adapter over the service the REST controller uses: it resolves the same
 * permissions, calls the same methods and returns the same rows, so a GraphQL caller and a REST caller
 * cannot drift apart. The aggregates that hang off a collection — its product and variant membership
 * and its channel publication — each have a resolver of their own, mirroring their controllers.
 */
@Resolver('Collection')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class CollectionResolver {
	constructor(
		private readonly collectionService: CollectionService,
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
	 * Streams the collections that change, optionally narrowed to one collection.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Subscription('collectionChanged')
	collectionChanged(@Args('id') id?: ID): AsyncIterable<CollectionChangedEvent> {
		const source = this.eventBus.ofType(CollectionChangedEvent);

		return toAsyncIterable(id ? source.pipe(filter((event) => event.collectionId === id)) : source);
	}
}
