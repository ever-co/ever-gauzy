import { Body, Controller, Get, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { CreateCollectionProductDTO, UpdateCollectionProductDTO } from './dto';
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
	 * Creates one membership of a product in a collection.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a collection membership' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The membership was created', type: CollectionProduct })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_CREATE))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCollectionProductDTO): Promise<CollectionProduct> {
		return this.collectionProductService.create(entity as any);
	}

	/**
	 * Updates one membership, which is how a position is moved without rewriting the set.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a collection membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was updated', type: CollectionProduct })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCollectionProductDTO
	): Promise<any> {
		return this.collectionProductService.update(id, entity as any);
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
