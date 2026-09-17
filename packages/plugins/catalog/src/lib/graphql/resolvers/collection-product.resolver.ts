import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionProduct } from '../../collection-product/collection-product.entity';
import { CollectionProductService } from '../../collection-product/collection-product.service';

/**
 * Product membership of a collection over GraphQL.
 *
 * Membership is a set rather than a row, so the mutations add and remove whole sets and return the
 * membership that results; that is the same operation the REST controller offers, and it resolves the
 * same permission.
 */
@Resolver('CollectionProduct')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class CollectionProductResolver {
	constructor(private readonly collectionProductService: CollectionProductService) {}

	/**
	 * Lists the manual product membership of the collections that match the filter.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Query('collectionProducts')
	async collectionProducts(
		@Args('filter') filter: { collectionId?: ID; productId?: ID } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPagination<CollectionProduct>> {
		return this.collectionProductService.paginate({
			where: { ...filter },
			order: { position: 'ASC', addedAt: 'ASC' },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
	}

	/**
	 * Curates products into a collection, appending them to the manual set.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('addCollectionProducts')
	async addCollectionProducts(
		@Args('collectionId') collectionId: ID,
		@Args('productIds') productIds: ID[]
	): Promise<CollectionProduct[]> {
		const existing = await this.collectionProductService.findByCollection(collectionId);
		const additions = productIds.filter((id) => !existing.some((row) => row.productId === id));

		return this.collectionProductService.replaceProducts(collectionId, [
			...existing.map((row) => row.productId),
			...additions
		]);
	}

	/**
	 * Removes products from a collection's manual set.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Mutation('removeCollectionProducts')
	async removeCollectionProducts(
		@Args('collectionId') collectionId: ID,
		@Args('productIds') productIds: ID[]
	): Promise<CollectionProduct[]> {
		const existing = await this.collectionProductService.findByCollection(collectionId);

		return this.collectionProductService.replaceProducts(
			collectionId,
			existing.map((row) => row.productId).filter((id) => !productIds.includes(id))
		);
	}
}
