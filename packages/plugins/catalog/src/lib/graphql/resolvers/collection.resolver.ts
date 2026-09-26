import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, EventBus, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
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
@Resolver('Collection')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class CollectionResolver {
	constructor(
		private readonly collectionService: CollectionService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists the collections of the caller's organization.
	 *
	 * @param filter How the listing is narrowed.
	 * @param limit The page size, when it is stated the offset way.
	 * @param offset The row to start at, when it is stated the offset way.
	 * @param page The page, when it is stated the cursor way.
	 * @param withDeleted Whether the retired collections are included.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collections')
	async collections(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<Collection>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.collectionService.findAll({
			where: { ...(filter ?? {}) },
			// The merchandiser's own order, then the row's identity: an offset cursor is a position, and a
			// position means nothing in an order the store may rearrange between two pages.
			order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return connectionFromOffsetPage<Collection>(listing, skip);
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
	 * Retires a collection recoverably, keeping the row and the membership that points at it.
	 *
	 * The route it mirrors is `DELETE /collections/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without this
	 * field a collection retired over GraphQL could not be brought back over GraphQL: the recovery below
	 * reads back what this writes, so serving one without the other would leave a caller able to retire a
	 * collection from the endpoint it could not restore it on — while the destructive `deleteCollection`
	 * the endpoint does serve drops the row and every product and variant membership that named it.
	 *
	 * The permission is the controller's own for the route — `COLLECTIONS_DELETE` — because retiring a
	 * collection takes it out of every storefront that resolved it.
	 *
	 * @param id The collection to retire.
	 * @returns The collection, as the soft delete left it.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('softDeleteCollection')
	async softDeleteCollection(@Args('id') id: ID): Promise<Collection> {
		return this.collectionService.softRemove(id);
	}

	/**
	 * Restores a collection that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /collections/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored
	 * collection is a candidate for the channels and categories that name it again, which is why the
	 * route states the deleting grant rather than the reading one.
	 *
	 * @param id The collection to restore.
	 * @returns The restored collection.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('recoverCollection')
	async recoverCollection(@Args('id') id: ID): Promise<Collection> {
		return this.collectionService.softRecover(id);
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
