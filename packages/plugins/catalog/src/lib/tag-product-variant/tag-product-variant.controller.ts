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
import { CreateTagProductVariantDTO, UpdateTagProductVariantDTO } from './dto';
import { TagProductVariant } from './tag-product-variant.entity';
import { TagProductVariantService } from './tag-product-variant.service';

@ApiTags('ProductVariantFacet')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
@Controller('/product-variant-tags')
export class TagProductVariantController extends CrudController<TagProductVariant> {
	constructor(private readonly tagProductVariantService: TagProductVariantService) {
		super(tagProductVariantService);
	}

	/**
	 * Creates one facet row of a variant.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a facet row of a variant' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The facet row was created', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateTagProductVariantDTO): Promise<TagProductVariant> {
		return this.tagProductVariantService.create(entity as any);
	}

	/**
	 * Updates one facet row: its value, and its position among the variant's facets.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a facet row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The facet row was updated', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTagProductVariantDTO
	): Promise<any> {
		return this.tagProductVariantService.update(id, entity as any);
	}

	/**
	 * Read the facet values of one variant.
	 */
	@ApiOperation({ summary: 'List the facet values of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Facet rows found', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Get('by-variant/:variantId')
	async findByVariant(@Param('variantId', UUIDValidationPipe) variantId: string): Promise<TagProductVariant[]> {
		return this.tagProductVariantService.findByVariant(variantId);
	}

	/**
	 * Replace the facet values of one variant.
	 */
	@ApiOperation({ summary: 'Replace the facet values of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Facet rows replaced', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put('by-variant/:variantId')
	async replaceTags(
		@Param('variantId', UUIDValidationPipe) variantId: string,
		@Body() body: { tagIds: ID[] }
	): Promise<TagProductVariant[]> {
		return this.tagProductVariantService.replaceTags(variantId, body.tagIds ?? []);
	}

	/**
	 * Deletes one facet row of a variant by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `PRODUCTS_DELETE`, the grant the plugin
	 * states for deleting a variant, because a facet row is a pivot of one variant and the grant that
	 * governs deleting the variant governs deleting its facets.
	 *
	 * @param id The facet row to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a facet row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The facet row was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one facet row of a variant by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `PRODUCTS_DELETE`.
	 *
	 * @param id The facet row to soft delete.
	 * @returns The soft-deleted facet row.
	 */
	@ApiOperation({ summary: 'Soft delete a facet row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The facet row was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted facet row of a variant by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `PRODUCTS_DELETE`, on the same path and the same body.
	 *
	 * @param id The facet row to restore.
	 * @returns The restored facet row.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted facet row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The facet row was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
