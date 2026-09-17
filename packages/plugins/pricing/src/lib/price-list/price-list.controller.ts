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
import { PriceList } from './price-list.entity';
import { PriceListService } from './price-list.service';
import { CreatePriceListDTO, SimulatePriceListDTO, UpdatePriceListDTO } from './dto';

/**
 * Price lists.
 *
 * The list is the resource an operator authors, so it carries the authoring verbs plus the two
 * transitions that change what the storefront charges: `activate` publishes a built list, and
 * `simulate` dry-runs one against a context without writing anything. Simulation has its own
 * permission because it is a merchandising tool rather than an edit — a role that may look at what a
 * list would do need not be able to change it.
 *
 * There is one API surface: this controller. A caller outside the platform reaches the same routes
 * with a tenant API key and is constrained by the permissions of the role that key is bound to.
 */
@ApiTags('PriceList')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_VIEW))
@Controller('/price-lists')
export class PriceListController extends CrudController<PriceList> {
	constructor(private readonly priceListService: PriceListService) {
		super(priceListService);
	}

	/**
	 * Create a price list.
	 *
	 * @param entity The list to create.
	 * @returns The created list.
	 */
	@ApiOperation({ summary: 'Create a new price list' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The price list was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The list is not a valid price list.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_CREATE))
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePriceListDTO): Promise<PriceList> {
		return await this.priceListService.createOne(entity);
	}

	/**
	 * Update a price list.
	 *
	 * @param id The list to update.
	 * @param entity The fields to change.
	 * @returns The updated list.
	 */
	@ApiOperation({ summary: 'Update a price list' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The price list was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such price list in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdatePriceListDTO): Promise<UpdateResult | PriceList> {
		return await this.priceListService.updateOne(id, entity);
	}

	/**
	 * Delete a price list.
	 *
	 * Without `force` the list is soft-deleted and everything it carried stays queryable; with it the
	 * list and its prices are removed, which is what the foreign key cascades.
	 *
	 * @param id The list to delete.
	 * @param force Whether the removal is a hard delete.
	 * @returns The delete result, or the soft-deleted list.
	 */
	@ApiOperation({ summary: 'Delete a price list' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The price list was deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such price list in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_DELETE))
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('force') force?: string | boolean
	): Promise<DeleteResult | UpdateResult | PriceList> {
		return await this.priceListService.deletePriceList(id, { force: force === true || force === 'true' });
	}

	/**
	 * Activate a price list.
	 *
	 * @param id The list to activate.
	 * @returns The list, as it now stands.
	 */
	@ApiOperation({ summary: 'Activate a price list' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The price list is now active.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The list window has already closed.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post(':id/activate')
	async activate(@Param('id', UUIDValidationPipe) id: ID): Promise<PriceList> {
		return await this.priceListService.activate(id);
	}

	/**
	 * Dry-run the resolution of a price list against a context.
	 *
	 * @param id The list to simulate.
	 * @param entity The context to price against.
	 * @returns One resolution per variant the list prices.
	 */
	@ApiOperation({ summary: 'Simulate price resolution for a price list' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The resolutions the list would produce.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such price list in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_SIMULATE))
	@HttpCode(HttpStatus.CREATED)
	@Post(':id/simulate')
	@UseValidationPipe({ transform: true, whitelist: true })
	async simulate(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: SimulatePriceListDTO): Promise<IResolvedPrice[]> {
		return await this.priceListService.simulate(id, entity);
	}
}
