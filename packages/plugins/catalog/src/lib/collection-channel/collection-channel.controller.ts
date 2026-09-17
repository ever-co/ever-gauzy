import { Body, Controller, Get, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { PublicationStatus } from '../catalog.types';
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
