import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { TagProductVariant } from '../../tag-product-variant/tag-product-variant.entity';
import { TagProductVariantService } from '../../tag-product-variant/tag-product-variant.service';

/**
 * Variant-level facets over GraphQL.
 *
 * A facet is a tag: `tag_type` is the facet and `tag` is its value. The pivot is reachable here as
 * well as over REST so a caller filtering a listing by "colour = red AND size = M" can read and write
 * the same rows whichever protocol it speaks.
 */
@Resolver('TagProductVariant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
		@Args('offset') offset?: number
	): Promise<IPagination<TagProductVariant>> {
		return this.tagProductVariantService.paginate({
			where: { ...filter },
			relations: ['tag'],
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
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
