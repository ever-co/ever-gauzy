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
import { CreateProductVariantChannelDTO, UpdateProductVariantChannelDTO } from './dto';
import { ProductVariantChannel } from './product-variant-channel.entity';
import { ProductVariantChannelService } from './product-variant-channel.service';

/**
 * The channel side of a variant, mounted at the pairing the table stores.
 */
@ApiTags('ProductVariantPublication')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
@Controller('/product-variant-channels')
export class ProductVariantChannelController extends CrudController<ProductVariantChannel> {
	constructor(private readonly productVariantChannelService: ProductVariantChannelService) {
		super(productVariantChannelService);
	}

	/**
	 * Creates one variant's presence on one channel.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a variant publication' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The publication was created', type: ProductVariantChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProductVariantChannelDTO): Promise<ProductVariantChannel> {
		return this.productVariantChannelService.create(entity as any);
	}

	/**
	 * Updates one publication: its status, and the moment it took effect.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a variant publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was updated', type: ProductVariantChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProductVariantChannelDTO
	): Promise<any> {
		return this.productVariantChannelService.update(id, entity as any);
	}

	/**
	 * Read the channels a variant is published on.
	 */
	@ApiOperation({ summary: 'List the channel publications of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Publication rows found', type: ProductVariantChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Get('by-variant/:variantId')
	async findByVariant(
		@Param('variantId', UUIDValidationPipe) variantId: string
	): Promise<ProductVariantChannel[]> {
		return this.productVariantChannelService.findByVariant(variantId);
	}

	/**
	 * Replace the publication set of a variant.
	 *
	 * Writing the whole set is what makes "sold online only" expressible: a variant that is listed on one
	 * channel and absent from another is the difference between the two sets, not a flag on a row.
	 */
	@ApiOperation({ summary: 'Replace the channel publications of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Publication rows replaced', type: ProductVariantChannel })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put('by-variant/:variantId')
	async replacePublications(
		@Param('variantId', UUIDValidationPipe) variantId: string,
		@Body() body: { items: Array<{ channelId: ID; status: PublicationStatus; publishedAt?: Date }> }
	): Promise<ProductVariantChannel[]> {
		return this.productVariantChannelService.replacePublications(variantId, body.items ?? []);
	}

	/**
	 * Deletes one variant publication by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `PRODUCTS_DELETE`, the grant the plugin
	 * states for deleting a variant, because a publication row is a join row of one variant and the grant
	 * that governs deleting the variant governs deleting where it is sold.
	 *
	 * @param id The variant publication to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a variant publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one variant publication by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `PRODUCTS_DELETE`.
	 *
	 * @param id The variant publication to soft delete.
	 * @returns The soft-deleted publication.
	 */
	@ApiOperation({ summary: 'Soft delete a variant publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted variant publication by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `PRODUCTS_DELETE`, on the same path and the same body.
	 *
	 * @param id The variant publication to restore.
	 * @returns The restored publication.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted variant publication' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The publication was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
