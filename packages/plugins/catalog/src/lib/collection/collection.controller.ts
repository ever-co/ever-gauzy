import { Controller, Get, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { Collection } from './collection.entity';
import { CollectionService } from './collection.service';

@ApiTags('Collection')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
@Controller('/collections')
export class CollectionController extends CrudController<Collection> {
	constructor(private readonly collectionService: CollectionService) {
		super(collectionService);
	}

	/**
	 * Read one collection by its slug rather than by its surrogate id.
	 */
	@ApiOperation({ summary: 'Find a collection by slug' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Collection found', type: Collection })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No collection carries that slug' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Get('slug/:slug')
	async findBySlug(@Param('slug') slug: string): Promise<Collection> {
		return this.collectionService.findBySlug(slug);
	}
}
