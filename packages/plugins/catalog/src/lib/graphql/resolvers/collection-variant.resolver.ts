import { Args, Query, Resolver } from '@nestjs/graphql';
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
}
