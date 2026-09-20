import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
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

	/**
	 * Deletes one collection publication by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `COLLECTIONS_DELETE`, the collection's own
	 * delete grant, because a publication row is a join row of one collection and the grant that governs
	 * deleting the collection governs deleting where it is published.
	 *
	 * @param id The collection publication to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a collection publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one collection publication by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `COLLECTIONS_DELETE`.
	 *
	 * @param id The collection publication to soft delete.
	 * @returns The soft-deleted publication.
	 */
	@ApiOperation({ summary: 'Soft delete a collection publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted collection publication by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `COLLECTIONS_DELETE`, on the same path and the same body.
	 *
	 * @param id The collection publication to restore.
	 * @returns The restored publication.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted collection publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
