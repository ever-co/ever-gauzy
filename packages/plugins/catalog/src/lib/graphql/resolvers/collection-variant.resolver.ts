import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionVariant } from '../../collection-variant/collection-variant.entity';
import { CollectionVariantService } from '../../collection-variant/collection-variant.service';

/**
 * Variant membership of a collection over GraphQL.
 *
 * It is a resolver of its own rather than a field on the collection resolver because membership is an
 * aggregate with its own table, its own position column and its own set-replacement semantics — the
 * same reason it has a controller of its own. Both doors therefore reach the same rows.
 */
@Resolver('CollectionVariant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	): Promise<IPagination<CollectionVariant>> {
		return this.collectionVariantService.paginate({
			where: { ...filter },
			order: { position: 'ASC', addedAt: 'ASC' },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
	}
}
