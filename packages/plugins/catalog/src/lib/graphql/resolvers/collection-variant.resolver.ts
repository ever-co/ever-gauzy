import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, FEATURE_GRAPHQL, IConnectionPageSelection, resolveConnectionWindow, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionVariant } from '../../collection-variant/collection-variant.entity';
import { CollectionVariantService } from '../../collection-variant/collection-variant.service';

/**
 * Variant membership of a collection over GraphQL.
 *
 * It is a resolver of its own rather than a field on the collection resolver because membership is an
 * aggregate with its own table, its own position column and its own set-replacement semantics — the
 * same reason it has a controller of its own. Both doors therefore reach the same rows.
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
@Resolver('CollectionVariant')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class CollectionVariantResolver {
	constructor(private readonly collectionVariantService: CollectionVariantService) {}

	/**
	 * Lists variant membership rows.
	 *
	 * @param filter The collection and the variant the membership is narrowed to.
	 * @param limit The page size, when it is stated the offset way.
	 * @param offset The row to start at, when it is stated the offset way.
	 * @param page The page, when it is stated the cursor way.
	 * @param withDeleted Whether the retired membership rows are included.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collectionVariants')
	async collectionVariants(
		@Args('filter') filter: { collectionId?: ID; variantId?: ID } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<CollectionVariant>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.collectionVariantService.findAll({
			where: { ...filter },
			// Closed by the row's identity: two members added at one position in one instant are otherwise a
			// tie the store may break differently on each page, and the walk repeats one and skips the other.
			order: { position: 'ASC', addedAt: 'ASC', id: 'ASC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return connectionFromOffsetPage<CollectionVariant>(listing, skip);
	}

	/**
	 * Replaces the manual variant set of one collection, in the order the caller states.
	 *
	 * The route it mirrors is `PUT /collection-variants/by-collection/:collectionId`, which writes the
	 * whole set — additions, removals and the new positions — inside one transaction, because a shelf is
	 * reordered as a whole and an endpoint that edits one membership leaves the positions of the rows
	 * nobody touched to be repaired by whoever notices. When this field was added no field reached it: the
	 * document's `addCollectionVariants` and `removeCollectionVariants` had no resolver, so the resource's set
	 * had no working door over GraphQL at all. This field is the door the service defines; the add and the
	 * removal below now answer too, as that same set write expressed as an addition and a removal.
	 *
	 * The permission is the controller's own for the route — `COLLECTIONS_EDIT` — because writing the set
	 * changes what the collection contains, and the call is the one the route makes: the same method, the
	 * same two arguments. The route declares no `@Idempotent` scope and no `@Versioned` expectation, so
	 * neither does the field.
	 *
	 * @param collectionId The collection whose membership is being written.
	 * @param variantIds The complete set of variant ids the collection should contain, in order.
	 * @returns The membership rows after the write.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('replaceCollectionVariants')
	async replaceCollectionVariants(
		@Args('collectionId') collectionId: ID,
		@Args('variantIds') variantIds: ID[]
	): Promise<CollectionVariant[]> {
		return this.collectionVariantService.replaceVariants(collectionId, variantIds);
	}

	/**
	 * Curates variants into a collection, appending the ones it does not hold yet.
	 *
	 * The schema has declared this field since the catalogue wave and nothing answered it, so introspection
	 * advertised a mutation that failed when called. It is now the set write expressed as an addition: the service
	 * keeps the current set in its order, appends each named variant that is not a member, and writes the result
	 * through the same `replaceVariants` the route `PUT /collection-variants/by-collection/:collectionId` and
	 * `replaceCollectionVariants` reach — one transaction, the caller's collection only, and its rows only. It is
	 * the variant-level twin of `addCollectionProducts`.
	 *
	 * The permission is the set route's own — `COLLECTIONS_EDIT` — and the class carries the tenant guard, the
	 * permission guard and the `FEATURE_GRAPHQL` gate, as every field here does.
	 *
	 * @param collectionId The collection whose membership is being extended.
	 * @param variantIds The variants to curate into it.
	 * @returns The membership rows after the write.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('addCollectionVariants')
	async addCollectionVariants(
		@Args('collectionId') collectionId: ID,
		@Args('variantIds') variantIds: ID[]
	): Promise<CollectionVariant[]> {
		return this.collectionVariantService.addVariants(collectionId, variantIds);
	}

	/**
	 * Removes variants from a collection's manual set, keeping the order of the ones that stay.
	 *
	 * Declared by the schema and unanswered until now, like `addCollectionVariants`; it is the set write expressed
	 * as a removal, through the same `replaceVariants`, under the same `COLLECTIONS_EDIT` grant the set route states
	 * and the product-level `removeCollectionProducts` states. A named variant that is not a member is ignored.
	 *
	 * @param collectionId The collection whose membership is being reduced.
	 * @param variantIds The variants to take out of it.
	 * @returns The membership rows after the write.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('removeCollectionVariants')
	async removeCollectionVariants(
		@Args('collectionId') collectionId: ID,
		@Args('variantIds') variantIds: ID[]
	): Promise<CollectionVariant[]> {
		return this.collectionVariantService.removeVariants(collectionId, variantIds);
	}

	/**
	 * Retires one variant membership row recoverably, keeping the variant in the collection's set.
	 *
	 * The route it mirrors is `DELETE /collection-variants/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. When it was added
	 * the document's set mutations for this membership had no resolver, so this resource had no write field at
	 * all — and the row's own lifecycle, the one a caller holding a membership identifier reaches, had none on
	 * either spelling.
	 *
	 * The permission is the controller's own for the route — `COLLECTIONS_DELETE` — because retiring a
	 * membership changes what the collection contains.
	 *
	 * @param id The membership to retire.
	 * @returns The membership, as the soft delete left it.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('softDeleteCollectionVariant')
	async softDeleteCollectionVariant(@Args('id') id: ID): Promise<CollectionVariant> {
		return this.collectionVariantService.softRemove(id);
	}

	/**
	 * Restores a variant membership row that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /collection-variants/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. The variant
	 * is a member of the collection again at the position it held, which is why the route states the
	 * deleting grant rather than the reading one.
	 *
	 * @param id The membership to restore.
	 * @returns The restored membership.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Mutation('recoverCollectionVariant')
	async recoverCollectionVariant(@Args('id') id: ID): Promise<CollectionVariant> {
		return this.collectionVariantService.softRecover(id);
	}
}
