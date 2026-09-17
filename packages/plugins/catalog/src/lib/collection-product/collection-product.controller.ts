import { Body, Controller, Get, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { CollectionProduct } from './collection-product.entity';
import { CollectionProductService } from './collection-product.service';

@ApiTags('CollectionProduct')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
@Controller('/collection-products')
export class CollectionProductController extends CrudController<CollectionProduct> {
	constructor(private readonly collectionProductService: CollectionProductService) {
		super(collectionProductService);
	}

	/**
	 * Read the products a collection contains, in the order the collection declares.
	 */
	@ApiOperation({ summary: 'List the products of a collection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Membership rows found', type: CollectionProduct })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Get('by-collection/:collectionId')
	async findByCollection(
		@Param('collectionId', UUIDValidationPipe) collectionId: string
	): Promise<CollectionProduct[]> {
		return this.collectionProductService.findByCollection(collectionId);
	}

	/**
	 * Replace the manual product set of a collection.
	 *
	 * The whole set is written at once, because that is the shape of the edit: a merchandiser reorders a
	 * shelf, and the positions of the rows nobody touched have to move with it.
	 */
	@ApiOperation({ summary: 'Replace the manual product set of a collection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Membership rows replaced', type: CollectionProduct })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put('by-collection/:collectionId')
	async replaceProducts(
		@Param('collectionId', UUIDValidationPipe) collectionId: string,
		@Body() body: { productIds: ID[] }
	): Promise<CollectionProduct[]> {
		return this.collectionProductService.replaceProducts(collectionId, body.productIds ?? []);
	}
}
