import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
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
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collectionVariants')
	async collectionVariants(
		@Args('filter') filter: { collectionId?: ID; variantId?: ID } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<GraphqlConnection<CollectionVariant>> {
		const page = await this.collectionVariantService.paginate({
			where: { ...filter },
			order: { position: 'ASC', addedAt: 'ASC' },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return connectionFromOffsetPage<CollectionVariant>(page, offset ?? 0);
	}
}
