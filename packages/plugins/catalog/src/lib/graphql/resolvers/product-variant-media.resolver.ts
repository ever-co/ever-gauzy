import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { ProductVariantMedia } from '../../product-variant-media/product-variant-media.entity';
import { ProductVariantMediaService } from '../../product-variant-media/product-variant-media.service';

/**
 * Per-variant galleries over GraphQL.
 *
 * The gallery is a set, so attaching, reordering and detaching all take the whole set and return it:
 * the rules that at most one image is primary and that the primary is a member of the gallery are then
 * checked once, in one place, rather than by every caller.
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
@Resolver('ProductVariantMedia')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ProductVariantMediaResolver {
	constructor(private readonly productVariantMediaService: ProductVariantMediaService) {}

	/**
	 * Lists the gallery rows matching the filter.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productVariantMedia')
	async productVariantMedia(
		@Args('filter') filter: { variantId?: ID; imageAssetId?: ID } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection
	): Promise<GraphqlConnection<ProductVariantMedia>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.productVariantMediaService.findAll({
			where: { ...filter },
			order: { position: 'ASC' },
			skip,
			take
		});

		return connectionFromOffsetPage<ProductVariantMedia>(listing, skip);
	}

	/**
	 * Replaces the gallery of a variant, including which image is its thumbnail.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('attachProductVariantMedia')
	async attachProductVariantMedia(
		@Args('variantId') variantId: ID,
		@Args('input') input: Array<{ imageAssetId: ID; position?: number; isPrimary?: boolean }>
	): Promise<ProductVariantMedia[]> {
		const primary = input.find((item) => item.isPrimary);

		return this.productVariantMediaService.replaceMedia(
			variantId,
			input.map((item) => item.imageAssetId),
			primary?.imageAssetId
		);
	}

	/**
	 * Reorders a variant's gallery without changing its membership.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('reorderProductVariantMedia')
	async reorderProductVariantMedia(
		@Args('variantId') variantId: ID,
		@Args('imageAssetIds') imageAssetIds: ID[]
	): Promise<ProductVariantMedia[]> {
		const existing = await this.productVariantMediaService.findByVariant(variantId);
		const primary = existing.find((row) => row.isPrimary);

		return this.productVariantMediaService.replaceMedia(variantId, imageAssetIds, primary?.imageAssetId);
	}

	/**
	 * Detaches one image from a variant's gallery.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('detachProductVariantMedia')
	async detachProductVariantMedia(
		@Args('variantId') variantId: ID,
		@Args('imageAssetId') imageAssetId: ID
	): Promise<ProductVariantMedia[]> {
		await this.productVariantMediaService.detach(variantId, imageAssetId);

		return this.productVariantMediaService.findByVariant(variantId);
	}
}
