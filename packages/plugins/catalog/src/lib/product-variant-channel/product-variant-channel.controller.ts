import { Body, Controller, Get, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { PublicationStatus } from '../catalog.types';
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
