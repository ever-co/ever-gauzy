import { Body, Controller, Get, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { PublicationStatus } from '../catalog.types';
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
}
