import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
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
			order: { position: 'ASC', addedAt: 'ASC' },
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
	 * nobody touched to be repaired by whoever notices. No field reached it: this document declares
	 * `addCollectionVariants` and `removeCollectionVariants`, and neither has a resolver, so the
	 * resource's set had no working door over GraphQL at all — the pair is recorded as unbound in
	 * `tools/scripts/graphql-field-binding-check.mjs`, with the note "the variant service replaces a whole
	 * membership set; an add is not defined". This field is the door the service does define.
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
	 * Retires one variant membership row recoverably, keeping the variant in the collection's set.
	 *
	 * The route it mirrors is `DELETE /collection-variants/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. The document
	 * declares the set mutations for this membership, but no resolver implements them, so until now this
	 * resource had no write field at all — and the row's own lifecycle, the one a caller holding a
	 * membership identifier reaches, had none on either spelling.
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
