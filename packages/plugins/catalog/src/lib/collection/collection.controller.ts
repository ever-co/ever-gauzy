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

	/**
	 * Deletes a collection by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `COLLECTIONS_DELETE`, the one the
	 * `deleteCollection` mutation declares for the same operation (`graphql/resolvers/collection.resolver.ts`).
	 *
	 * @param id The collection to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a collection' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The collection was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a collection by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `COLLECTIONS_DELETE`.
	 *
	 * @param id The collection to soft delete.
	 * @returns The soft-deleted collection.
	 */
	@ApiOperation({ summary: 'Soft delete a collection' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The collection was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted collection by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `COLLECTIONS_DELETE`, on the same path and the same body.
	 *
	 * @param id The collection to restore.
	 * @returns The restored collection.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted collection' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The collection was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
