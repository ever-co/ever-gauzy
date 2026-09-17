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
}
