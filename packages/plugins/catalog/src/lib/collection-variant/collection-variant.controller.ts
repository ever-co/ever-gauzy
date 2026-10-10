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

	/**
	 * Deletes one collection variant membership by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `COLLECTIONS_DELETE`, the collection's own
	 * delete grant, because a membership row is a join row of one collection and the grant that governs
	 * deleting the collection governs deleting what it contains.
	 *
	 * @param id The collection variant membership to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a collection variant membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one collection variant membership by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `COLLECTIONS_DELETE`.
	 *
	 * @param id The collection variant membership to soft delete.
	 * @returns The soft-deleted membership.
	 */
	@ApiOperation({ summary: 'Soft delete a collection variant membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted collection variant membership by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `COLLECTIONS_DELETE`, on the same path and the same body.
	 *
	 * @param id The collection variant membership to restore.
	 * @returns The restored membership.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted collection variant membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
