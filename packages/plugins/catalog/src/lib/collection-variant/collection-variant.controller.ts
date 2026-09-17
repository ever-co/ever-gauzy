import { Body, Controller, Get, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
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
