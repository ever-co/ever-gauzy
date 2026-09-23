import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { ProductRelationType } from '../../catalog.types';
import { ProductRelation } from '../../product-relation/product-relation.entity';
import { ProductRelationService } from '../../product-relation/product-relation.service';

/**
 * Product-to-product relations over GraphQL.
 *
 * The relation is directed, so a read is always "from" a product. The inverse direction is a separate
 * question and is not served by inverting the result of this one.
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
@Resolver('ProductRelation')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ProductRelationResolver {
	constructor(private readonly productRelationService: ProductRelationService) {}

	/**
	 * Lists product relations, optionally narrowed to a source product and a type.
	 *
	 * @param filter The product, the related product and the type the relations are narrowed to.
	 * @param limit The page size, when it is stated the offset way.
	 * @param offset The row to start at, when it is stated the offset way.
	 * @param page The page, when it is stated the cursor way.
	 * @param withDeleted Whether the retired relations are included.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productRelations')
	async productRelations(
		@Args('filter') filter: { productId?: ID; relatedProductId?: ID; type?: ProductRelationType } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<ProductRelation>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.productRelationService.findAll({
			where: { ...filter },
			relations: ['relatedProduct'],
			order: { type: 'ASC', position: 'ASC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return connectionFromOffsetPage<ProductRelation>(listing, skip);
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

	/**
	 * Retires a relation recoverably, keeping both products and the type that relates them.
	 *
	 * The route it mirrors is `DELETE /product-relations/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without this
	 * field a relation withdrawn over GraphQL could not be brought back over GraphQL, while the hard
	 * `deleteProductRelation` the endpoint does serve drops the row — and a relation is a merchandising
	 * statement about two products that a storefront may still be serving.
	 *
	 * The permission is the controller's own for the route — `PRODUCTS_EDIT` — because retiring a
	 * relation changes what the catalogue recommends beside a product.
	 *
	 * @param id The relation to retire.
	 * @returns The relation, as the soft delete left it.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('softDeleteProductRelation')
	async softDeleteProductRelation(@Args('id') id: ID): Promise<ProductRelation> {
		return this.productRelationService.softRemove(id);
	}

	/**
	 * Restores a relation that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /product-relations/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. The relation comes
	 * back with its type and its position, which is why the route states the editing grant rather than
	 * the reading one.
	 *
	 * @param id The relation to restore.
	 * @returns The restored relation.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('recoverProductRelation')
	async recoverProductRelation(@Args('id') id: ID): Promise<ProductRelation> {
		return this.productRelationService.softRecover(id);
	}
}
