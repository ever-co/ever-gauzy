import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { TagProductVariant } from '../../tag-product-variant/tag-product-variant.entity';
import { TagProductVariantService } from '../../tag-product-variant/tag-product-variant.service';

/**
 * Variant-level facets over GraphQL.
 *
 * A facet is a tag: `tag_type` is the facet and `tag` is its value. The pivot is reachable here as
 * well as over REST so a caller filtering a listing by "colour = red AND size = M" can read and write
 * the same rows whichever protocol it speaks.
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
@Resolver('TagProductVariant')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TagProductVariantResolver {
	constructor(private readonly tagProductVariantService: TagProductVariantService) {}

	/**
	 * Lists the facet values carried by variants.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productVariantFacets')
	async productVariantFacets(
		@Args('filter') filter: { productVariantId?: ID; tagId?: ID } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<TagProductVariant>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.tagProductVariantService.findAll({
			where: { ...filter },
			relations: ['tag'],
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return connectionFromOffsetPage<TagProductVariant>(listing, skip);
	}

	/**
	 * Attaches facet values to a variant, keeping the ones it already carries.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('attachProductVariantFacets')
	async attachProductVariantFacets(
		@Args('variantId') variantId: ID,
		@Args('tagIds') tagIds: ID[]
	): Promise<TagProductVariant[]> {
		const existing = await this.tagProductVariantService.findByVariant(variantId);
		const additions = tagIds.filter((id) => !existing.some((row) => row.tagId === id));

		return this.tagProductVariantService.replaceTags(variantId, [
			...existing.map((row) => row.tagId),
			...additions
		]);
	}

	/**
	 * Detaches facet values from a variant.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('detachProductVariantFacets')
	async detachProductVariantFacets(
		@Args('variantId') variantId: ID,
		@Args('tagIds') tagIds: ID[]
	): Promise<TagProductVariant[]> {
		const existing = await this.tagProductVariantService.findByVariant(variantId);

		return this.tagProductVariantService.replaceTags(
			variantId,
			existing.map((row) => row.tagId).filter((id) => !tagIds.includes(id))
		);
	}
}
