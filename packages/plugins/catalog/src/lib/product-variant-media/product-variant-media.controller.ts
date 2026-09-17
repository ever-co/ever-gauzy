import { Body, Controller, Get, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
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
}
