import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { ProductRelationType } from '../../catalog.types';
import { ProductRelation } from '../../product-relation/product-relation.entity';
import { ProductRelationService } from '../../product-relation/product-relation.service';

/**
 * Product-to-product relations over GraphQL.
 *
 * The relation is directed, so a read is always "from" a product. The inverse direction is a separate
 * question and is not served by inverting the result of this one.
 */
@Resolver('ProductRelation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class ProductRelationResolver {
	constructor(private readonly productRelationService: ProductRelationService) {}

	/**
	 * Lists product relations, optionally narrowed to a source product and a type.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productRelations')
	async productRelations(
		@Args('filter') filter: { productId?: ID; relatedProductId?: ID; type?: ProductRelationType } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPagination<ProductRelation>> {
		return this.productRelationService.paginate({
			where: { ...filter },
			relations: ['relatedProduct'],
			order: { type: 'ASC', position: 'ASC' },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
	}

	/**
	 * Creates a directed relation between two products.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('createProductRelation')
	async createProductRelation(@Args('input') input: Partial<ProductRelation>): Promise<ProductRelation> {
		return this.productRelationService.create(input);
	}

	/**
	 * Changes the type or the display order of a relation.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('updateProductRelation')
	async updateProductRelation(
		@Args('id') id: ID,
		@Args('input') input: Partial<ProductRelation>
	): Promise<ProductRelation> {
		return this.productRelationService.update(id, input);
	}

	/**
	 * Deletes a relation.
	 *
	 * @returns True once the relation is gone.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('deleteProductRelation')
	async deleteProductRelation(@Args('id') id: ID): Promise<boolean> {
		await this.productRelationService.delete(id);

		return true;
	}
}
