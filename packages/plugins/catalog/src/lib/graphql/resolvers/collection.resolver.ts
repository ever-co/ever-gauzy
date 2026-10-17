import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, deliverPayloadAsIs, FEATURE_GRAPHQL, IConnectionPageSelection, resolveConnectionWindow, EventBus, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard, tenantScopedEventStream } from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionChannel } from '../../collection-channel/collection-channel.entity';
import { CollectionChannelService } from '../../collection-channel/collection-channel.service';
import { Collection } from '../../collection/collection.entity';
import { CollectionService } from '../../collection/collection.service';
import { CollectionChangedEvent } from '../../events';

/**
 * A collection write as the GraphQL inputs state it.
 *
 * `imageAssetId` is the inputs' earlier spelling of the entity's `imageId`.
 */
export type CollectionWriteInput = Partial<Collection> & { imageAssetId?: ID | null };

/**
 * Translates a GraphQL collection input into the entity's own names.
 *
 * The inputs declared the hero image as `imageAssetId`, a property the entity does not have, and the field
 * handed the input to the service unchanged — so the ORM dropped it and an image set over GraphQL never
 * reached the row, while REST wrote the same column as `imageId` (review R2-22). `imageId` is now declared
 * too and wins when both are stated; a stated `imageAssetId` (null included, which clears the image) is
 * written to `imageId` otherwise.
 *
 * @param input The input the field received.
 * @returns The same write under the entity's names.
 */
export function toCollectionWrite(input: CollectionWriteInput | null | undefined): Partial<Collection> {
	const { imageAssetId, ...write } = (input ?? {}) as CollectionWriteInput;

	if (imageAssetId !== undefined && write.imageId === undefined) {
		return { ...write, imageId: imageAssetId } as Partial<Collection>;
	}

	return write;
}

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
	/**
	 * The channel rows each collection object of an answer was resolved with, so `channels`, its deprecated
	 * alias and `publishedAt` selected together read them once. Keyed by the parent object, which lives for
	 * one response.
	 */
	private readonly channelReads = new WeakMap<Collection, Promise<CollectionChannel[]>>();

	constructor(
		private readonly collectionService: CollectionService,
		private readonly eventBus: EventBus,
		private readonly collectionChannelService?: CollectionChannelService
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
	async createCollection(@Args('input') input: CollectionWriteInput): Promise<Collection> {
		return this.collectionService.create(toCollectionWrite(input));
	}

	/**
	 * Updates a collection.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('updateCollection')
	async updateCollection(@Args('id') id: ID, @Args('input') input: CollectionWriteInput): Promise<Collection> {
		return this.collectionService.update(id, toCollectionWrite(input));
	}

	/**
	 * Deletes a collection.
	 *
	 * The answer is whether a row was removed — `affected > 0`, the rule the order plugin's deletes answer
	 * with. The service's `delete` is the kernel's, which checks no existence: an identifier that names no
	 * collection of the caller matches nothing and raises nothing, and this field used to answer `true` for it
	 * while `DELETE`'s own result said `affected: 0`.
	 *
	 * @returns True when the collection was removed, false when the identifier matched none.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('deleteCollection')
	async deleteCollection(@Args('id') id: ID): Promise<boolean> {
		const result = await this.collectionService.delete(id);

		return Number(result?.affected ?? 0) > 0;
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
	 * Streams the collections of the subscriber's tenant that change, optionally narrowed to one collection.
	 *
	 * 🛑 **The stream used to deliver every tenant's collections.** It read the bus and narrowed on the
	 * `id` argument alone, so a subscriber holding the view grant was handed each change any tenant made
	 * — and, with no `resolve`, an error frame per change in place of the row, which still told it when
	 * another tenant was editing. The kernel's tenant-scoped stream now admits only an event whose tenant
	 * is the subscriber's (captured when the subscription opened, never read from the publisher's request
	 * the bus calls back in), and each event is re-read as the subscriber with its tenant stated, so the
	 * row delivered is the one `collection(id)` would answer and the event is dropped when that read finds
	 * nothing.
	 *
	 * @param id The collection to narrow the stream to, when one is named.
	 * @returns The changed collections, as the subscriber may read them.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Subscription('collectionChanged', { resolve: deliverPayloadAsIs })
	collectionChanged(@Args('id') id?: ID): AsyncIterableIterator<Collection> {
		const changes = this.eventBus.ofType(CollectionChangedEvent);

		return tenantScopedEventStream<CollectionChangedEvent, Collection>(changes, {
			narrow: (event) => !id || event.collectionId === id,
			tenantOf: (event) => event.tenantId,
			organizationOf: (event) => event.organizationId,
			read: (event, scope) =>
				this.collectionService.findOneByWhereOptions({ id: event.collectionId, tenantId: scope.tenantId })
		});
	}

	/**
	 * The deprecated name of `imageId`.
	 *
	 * The type declared `imageAssetId` while the entity's column is `imageId`, so the default resolver read a
	 * property no row has and the field answered null for every collection, an image or not (review R2-22).
	 *
	 * @param collection The collection being read.
	 * @returns The id of its hero image, or null.
	 */
	@ResolveField('imageAssetId')
	imageAssetId(@Parent() collection: Collection): ID | null {
		return collection.imageId ?? null;
	}

	/**
	 * The collection's channel publications — the entity's `channels` relation.
	 *
	 * The rows the read already loaded are answered as they are; otherwise they are read the way
	 * `GET /collection-channels/by-collection/:collectionId` reads them, inside the caller's tenant and
	 * organization.
	 *
	 * @param collection The collection being read.
	 * @returns Its publication rows.
	 */
	@ResolveField('channels')
	async channels(@Parent() collection: Collection): Promise<CollectionChannel[]> {
		return this.channelsOf(collection);
	}

	/**
	 * The deprecated name of `channels`. The default resolver read `channelPublications`, a property the
	 * entity does not have, and answered null for every collection (review R2-22).
	 *
	 * @param collection The collection being read.
	 * @returns Its publication rows.
	 */
	@ResolveField('channelPublications')
	async channelPublications(@Parent() collection: Collection): Promise<CollectionChannel[]> {
		return this.channelsOf(collection);
	}

	/**
	 * When the collection first went live on any channel.
	 *
	 * The collection has no `publishedAt` column — publication is per channel, and each channel row keeps the
	 * instant it first became ACTIVE, never cleared by a later withdrawal — so the type's field used to answer
	 * null for every collection (review R2-22). It is the earliest of those instants.
	 *
	 * @param collection The collection being read.
	 * @returns The earliest channel publication instant, or null when it was never published.
	 */
	@ResolveField('publishedAt')
	async publishedAt(@Parent() collection: Collection): Promise<Date | null> {
		const instants = (await this.channelsOf(collection))
			.map((row) => (row.publishedAt ? new Date(row.publishedAt).getTime() : NaN))
			.filter((instant) => !Number.isNaN(instant));

		return instants.length ? new Date(Math.min(...instants)) : null;
	}

	/**
	 * @param collection The collection being read.
	 * @returns Its channel rows: the loaded relation when the read carried it, else one scoped read per
	 * collection object, shared by every field that needs them.
	 */
	private channelsOf(collection: Collection): Promise<CollectionChannel[]> {
		if (Array.isArray(collection?.channels)) {
			return Promise.resolve(collection.channels);
		}

		if (!collection?.id || !this.collectionChannelService) {
			return Promise.resolve([]);
		}

		let read = this.channelReads.get(collection);

		if (!read) {
			read = this.collectionChannelService.findByCollection(collection.id);
			this.channelReads.set(collection, read);
		}

		return read;
	}
}
