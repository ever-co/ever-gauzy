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
import { PublicationStatus } from '../catalog.types';
import { CreateCollectionChannelDTO, UpdateCollectionChannelDTO } from './dto';
import { CollectionChannel } from './collection-channel.entity';
import { CollectionChannelService } from './collection-channel.service';

@ApiTags('CollectionChannel')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
@Controller('/collection-channels')
export class CollectionChannelController extends CrudController<CollectionChannel> {
	constructor(private readonly collectionChannelService: CollectionChannelService) {
		super(collectionChannelService);
	}

	/**
	 * Creates where a collection is published.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a collection publication' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The publication was created', type: CollectionChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_CREATE))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCollectionChannelDTO): Promise<CollectionChannel> {
		return this.collectionChannelService.create(entity as any);
	}

	/**
	 * Updates one publication row.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a collection publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was updated', type: CollectionChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCollectionChannelDTO
	): Promise<any> {
		return this.collectionChannelService.update(id, entity as any);
	}

	/**
	 * Read where a collection is published.
	 */
	@ApiOperation({ summary: 'List the channel publications of a collection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Publication rows found', type: CollectionChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW))
	@Get('by-collection/:collectionId')
	async findByCollection(
		@Param('collectionId', UUIDValidationPipe) collectionId: string
	): Promise<CollectionChannel[]> {
		return this.collectionChannelService.findByCollection(collectionId);
	}

	/**
	 * Replace where a collection is published.
	 */
	@ApiOperation({ summary: 'Replace the channel publications of a collection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Publication rows replaced', type: CollectionChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put('by-collection/:collectionId')
	async replaceChannels(
		@Param('collectionId', UUIDValidationPipe) collectionId: string,
		@Body() body: { items: Array<{ channelId: ID; status: PublicationStatus; publishedAt?: Date }> }
	): Promise<CollectionChannel[]> {
		return this.collectionChannelService.replaceChannels(collectionId, body.items ?? []);
	}
}
