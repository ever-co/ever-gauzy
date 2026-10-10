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

	/**
	 * Deletes one collection membership by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `COLLECTIONS_EDIT`, which is what the
	 * `removeCollectionProducts` mutation declares for removing these same rows
	 * (`graphql/resolvers/collection-product.resolver.ts`).
	 *
	 * @param id The collection membership to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a collection membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one collection membership by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `COLLECTIONS_EDIT`.
	 *
	 * @param id The collection membership to soft delete.
	 * @returns The soft-deleted membership.
	 */
	@ApiOperation({ summary: 'Soft delete a collection membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted collection membership by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `COLLECTIONS_EDIT`, on the same path and the same body.
	 *
	 * @param id The collection membership to restore.
	 * @returns The restored membership.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted collection membership' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
