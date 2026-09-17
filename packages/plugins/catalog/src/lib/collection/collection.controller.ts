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
import { CreateCollectionDTO, UpdateCollectionDTO } from './dto';
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
	 * Creates a collection.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 */
	@ApiOperation({ summary: 'Create a collection' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The collection was created', type: Collection })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_CREATE))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCollectionDTO): Promise<Collection> {
		return this.collectionService.create(entity as any);
	}

	/**
	 * Updates a collection.
	 */
	@ApiOperation({ summary: 'Update a collection' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The collection was updated', type: Collection })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateCollectionDTO): Promise<Collection> {
		return this.collectionService.update(id, entity as any);
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
