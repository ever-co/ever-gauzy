import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { ProductVariantMedia } from '../../product-variant-media/product-variant-media.entity';
import { ProductVariantMediaService } from '../../product-variant-media/product-variant-media.service';

/**
 * Per-variant galleries over GraphQL.
 *
 * The gallery is a set, so attaching, reordering and detaching all take the whole set and return it:
 * the rules that at most one image is primary and that the primary is a member of the gallery are then
 * checked once, in one place, rather than by every caller.
 */
@Resolver('ProductVariantMedia')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
		@Args('offset') offset?: number
	): Promise<IPagination<ProductVariantMedia>> {
		return this.productVariantMediaService.paginate({
			where: { ...filter },
			order: { position: 'ASC' },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
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
