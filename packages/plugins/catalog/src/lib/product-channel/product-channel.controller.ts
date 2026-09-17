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
}
