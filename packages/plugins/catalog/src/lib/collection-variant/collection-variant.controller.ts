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
import { CreateCollectionVariantDTO, UpdateCollectionVariantDTO } from './dto';
import { CollectionVariant } from './collection-variant.entity';
import { CollectionVariantService } from './collection-variant.service';

@ApiTags('CollectionVariant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
@Controller('/collection-variants')
export class CollectionVariantController extends CrudController<CollectionVariant> {
	constructor(private readonly collectionVariantService: CollectionVariantService) {
		super(collectionVariantService);
	}

	/**
	 * Creates one membership of a variant in a collection.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a collection variant membership' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The membership was created', type: CollectionVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_CREATE))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCollectionVariantDTO): Promise<CollectionVariant> {
		return this.collectionVariantService.create(entity as any);
	}

	/**
	 * Updates one membership, which is how a position is moved without rewriting the set.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a collection variant membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was updated', type: CollectionVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCollectionVariantDTO
	): Promise<any> {
		return this.collectionVariantService.update(id, entity as any);
	}

	/**
	 * Read the variants a collection contains, in the order the collection declares.
	 */
	@ApiOperation({ summary: 'List the variants of a collection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Membership rows found', type: CollectionVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Get('by-collection/:collectionId')
	async findByCollection(
		@Param('collectionId', UUIDValidationPipe) collectionId: string
	): Promise<CollectionVariant[]> {
		return this.collectionVariantService.findByCollection(collectionId);
	}

	/**
	 * Replace the manual variant set of a collection.
	 */
	@ApiOperation({ summary: 'Replace the manual variant set of a collection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Membership rows replaced', type: CollectionVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put('by-collection/:collectionId')
	async replaceVariants(
		@Param('collectionId', UUIDValidationPipe) collectionId: string,
		@Body() body: { variantIds: ID[] }
	): Promise<CollectionVariant[]> {
		return this.collectionVariantService.replaceVariants(collectionId, body.variantIds ?? []);
	}
}
