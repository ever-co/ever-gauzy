import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../pricing.permissions';
import { IResolvedPrice } from '../pricing.types';
import { ProductPrice } from './product-price.entity';
import { ProductPriceService, IProductPriceBulkResult } from './product-price.service';
import {
	BulkUpsertProductPricesDTO,
	CreateProductPriceDTO,
	ResolveProductPricesDTO,
	UpdateProductPriceDTO
} from './dto';

/**
 * Product prices: what one unit of a product variant costs.
 *
 * Two routes here are not ordinary CRUD and both have their own permission. `POST /bulk` writes a
 * whole price matrix and can retire rows in `REPLACE` mode, which is why it sits in the
 * administration group rather than with single-row editing. `POST /resolve` is the read that the
 * storefront and the cart both use — it names the context and receives the effective price, so a
 * caller never has to reproduce the resolution order to display a price.
 */
@ApiTags('ProductPrice')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
@Controller('/product-prices')
export class ProductPriceController extends CrudController<ProductPrice> {
	constructor(private readonly productPriceService: ProductPriceService) {
		super(productPriceService);
	}

	/**
	 * Create a price.
	 *
	 * @param entity The price to create.
	 * @returns The created price.
	 */
	@ApiOperation({ summary: 'Create a product price' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The price was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The price overlaps a tier or misses its margin floor.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProductPriceDTO): Promise<ProductPrice> {
		return await this.productPriceService.createOne(entity);
	}

	/**
	 * Update a price.
	 *
	 * @param id The price to update.
	 * @param entity The fields to change.
	 * @returns The updated price.
	 */
	@ApiOperation({ summary: 'Update a product price' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The price was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such price in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProductPriceDTO
	): Promise<UpdateResult | ProductPrice> {
		return await this.productPriceService.updateOne(id, entity);
	}

	/**
	 * Delete a price.
	 *
	 * A price that was charged is retained by default: without `force` the row is soft-deleted, so the
	 * amount a past resolution used stays queryable.
	 *
	 * @param id The price to delete.
	 * @param force Whether the removal is a hard delete.
	 * @returns The delete result, or the soft-deleted price.
	 */
	@ApiOperation({ summary: 'Delete a product price' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The price was deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such price in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('force') force?: string | boolean
	): Promise<DeleteResult | UpdateResult | ProductPrice> {
		await this.productPriceService.findOneByIdString(id);

		return force === true || force === 'true'
			? await this.productPriceService.delete(id)
			: await this.productPriceService.softDelete(id);
	}

	/**
	 * Write a price matrix.
	 *
	 * @param entity The rows, the mode and the atomicity flag.
	 * @returns The rows written and the rows refused.
	 */
	@ApiOperation({ summary: 'Bulk upsert product prices' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The batch was applied, with its per-row report.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'An atomic batch contained a row that cannot be written.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_BULK_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post('/bulk')
	@UseValidationPipe({ transform: true, whitelist: true })
	async bulkUpsert(@Body() entity: BulkUpsertProductPricesDTO): Promise<IProductPriceBulkResult> {
		return await this.productPriceService.bulkUpsert(entity);
	}

	/**
	 * Resolve the effective price of the requested variants.
	 *
	 * @param entity The context to price against.
	 * @returns One resolution per variant that has a price.
	 */
	@ApiOperation({ summary: 'Resolve effective prices for a context' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The resolutions for the requested variants.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
	@HttpCode(HttpStatus.CREATED)
	@Post('/resolve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async resolve(@Body() entity: ResolveProductPricesDTO): Promise<IResolvedPrice[]> {
		return await this.productPriceService.resolvePrices({
			variantIds: entity.variantIds,
			currency: entity.currency,
			quantity: entity.quantity,
			channelId: entity.channelId,
			regionId: entity.regionId,
			customerId: entity.customerId,
			customerGroupIds: entity.customerGroupIds,
			date: entity.date
		});
	}
}
