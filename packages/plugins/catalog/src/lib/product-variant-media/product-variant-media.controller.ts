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
import { CreateProductVariantMediaDTO, UpdateProductVariantMediaDTO } from './dto';
import { ProductVariantMedia } from './product-variant-media.entity';
import { ProductVariantMediaService } from './product-variant-media.service';

@ApiTags('ProductVariantMedia')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
@Controller('/product-variant-media')
export class ProductVariantMediaController extends CrudController<ProductVariantMedia> {
	constructor(private readonly productVariantMediaService: ProductVariantMediaService) {
		super(productVariantMediaService);
	}

	/**
	 * Creates one gallery row of a variant.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a gallery row of a variant' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The gallery row was created', type: ProductVariantMedia })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProductVariantMediaDTO): Promise<ProductVariantMedia> {
		return this.productVariantMediaService.create(entity as any);
	}

	/**
	 * Updates one gallery row: its position, and whether it is the variant's thumbnail.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a gallery row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The gallery row was updated', type: ProductVariantMedia })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProductVariantMediaDTO
	): Promise<any> {
		return this.productVariantMediaService.update(id, entity as any);
	}

	/**
	 * Read a variant's gallery.
	 */
	@ApiOperation({ summary: 'List the gallery of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Gallery rows found', type: ProductVariantMedia })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Get('by-variant/:variantId')
	async findByVariant(@Param('variantId', UUIDValidationPipe) variantId: string): Promise<ProductVariantMedia[]> {
		return this.productVariantMediaService.findByVariant(variantId);
	}

	/**
	 * Replace a variant's gallery, including which image is its thumbnail.
	 */
	@ApiOperation({ summary: 'Replace the gallery of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Gallery rows replaced', type: ProductVariantMedia })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put('by-variant/:variantId')
	async replaceMedia(
		@Param('variantId', UUIDValidationPipe) variantId: string,
		@Body() body: { imageAssetIds: ID[]; primaryImageAssetId?: ID }
	): Promise<ProductVariantMedia[]> {
		return this.productVariantMediaService.replaceMedia(
			variantId,
			body.imageAssetIds ?? [],
			body.primaryImageAssetId
		);
	}

	/**
	 * Deletes one gallery row of a variant by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `PRODUCTS_DELETE`, the grant the plugin
	 * states for deleting a variant, because a gallery row is a row of one variant and the grant that
	 * governs deleting the variant governs deleting its images.
	 *
	 * @param id The gallery row to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a gallery row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The gallery row was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one gallery row of a variant by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `PRODUCTS_DELETE`.
	 *
	 * @param id The gallery row to soft delete.
	 * @returns The soft-deleted gallery row.
	 */
	@ApiOperation({ summary: 'Soft delete a gallery row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The gallery row was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted gallery row of a variant by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `PRODUCTS_DELETE`, on the same path and the same body.
	 *
	 * @param id The gallery row to restore.
	 * @returns The restored gallery row.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted gallery row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The gallery row was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
