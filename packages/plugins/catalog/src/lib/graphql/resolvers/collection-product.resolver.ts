import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionProduct } from '../../collection-product/collection-product.entity';
import { CollectionProductService } from '../../collection-product/collection-product.service';

/**
 * Product membership of a collection over GraphQL.
 *
 * Membership is a set rather than a row, so the mutations add and remove whole sets and return the
 * membership that results; that is the same operation the REST controller offers, and it resolves the
 * same permission.
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
@Resolver('CollectionProduct')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection
	): Promise<GraphqlConnection<CollectionProduct>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.collectionProductService.findAll({
			where: { ...filter },
			order: { position: 'ASC', addedAt: 'ASC' },
			skip,
			take
		});

		return connectionFromOffsetPage<CollectionProduct>(listing, skip);
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
