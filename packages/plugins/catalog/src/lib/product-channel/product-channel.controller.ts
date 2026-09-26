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
import { CreateProductChannelDTO, UpdateProductChannelDTO } from './dto';
import { ProductChannel } from './product-channel.entity';
import { ProductChannelService } from './product-channel.service';

/**
 * The channel side of a product, mounted at the pairing the table stores.
 *
 * The path names the resource — one product's presence on one channel — rather than a caller, and it
 * is deliberately not a nested `/products/:id/...` route: the pairing has its own identity, its own
 * lifecycle columns and its own read, so it is addressable on its own.
 */
@ApiTags('ProductPublication')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
@Controller('/product-channels')
export class ProductChannelController extends CrudController<ProductChannel> {
	constructor(private readonly productChannelService: ProductChannelService) {
		super(productChannelService);
	}

	/**
	 * Creates one product's presence on one channel.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a product publication' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The publication was created', type: ProductChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProductChannelDTO): Promise<ProductChannel> {
		return this.productChannelService.create(entity as any);
	}

	/**
	 * Updates one publication: its status, and the moment it took effect.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a product publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was updated', type: ProductChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProductChannelDTO
	): Promise<any> {
		return this.productChannelService.update(id, entity as any);
	}

	/**
	 * Read the channels a product is published on.
	 */
	@ApiOperation({ summary: 'List the channel publications of a product' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Publication rows found', type: ProductChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Get('by-product/:productId')
	async findByProduct(@Param('productId', UUIDValidationPipe) productId: string): Promise<ProductChannel[]> {
		return this.productChannelService.findByProduct(productId);
	}

	/**
	 * Publish a product on one or more channels.
	 */
	@ApiOperation({ summary: 'Publish a product to channels' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Publications activated', type: ProductChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post('by-product/:productId/publish')
	async publish(
		@Param('productId', UUIDValidationPipe) productId: string,
		@Body() body: { channelIds: ID[]; publishedAt?: Date }
	): Promise<ProductChannel[]> {
		return this.productChannelService.setPublication(
			productId,
			body.channelIds ?? [],
			PublicationStatus.ACTIVE,
			body.publishedAt ? new Date(body.publishedAt) : new Date()
		);
	}

	/**
	 * Withdraw a product from one or more channels.
	 */
	@ApiOperation({ summary: 'Withdraw a product from channels' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Publications withdrawn', type: ProductChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post('by-product/:productId/unpublish')
	async unpublish(
		@Param('productId', UUIDValidationPipe) productId: string,
		@Body() body: { channelIds: ID[]; unpublishedAt?: Date }
	): Promise<ProductChannel[]> {
		return this.productChannelService.setPublication(
			productId,
			body.channelIds ?? [],
			PublicationStatus.ARCHIVED,
			body.unpublishedAt ? new Date(body.unpublishedAt) : new Date()
		);
	}

	/**
	 * Deletes one product publication by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `PRODUCTS_DELETE`, the product's own
	 * delete grant, because a publication row is a join row of one product and the grant that governs
	 * deleting the product governs deleting where it is sold.
	 *
	 * @param id The product publication to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a product publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one product publication by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `PRODUCTS_DELETE`.
	 *
	 * @param id The product publication to soft delete.
	 * @returns The soft-deleted publication.
	 */
	@ApiOperation({ summary: 'Soft delete a product publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted product publication by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `PRODUCTS_DELETE`, on the same path and the same body.
	 *
	 * @param id The product publication to restore.
	 * @returns The restored publication.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted product publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
