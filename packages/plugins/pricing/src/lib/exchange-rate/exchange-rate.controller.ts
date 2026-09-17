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
import { ExchangeRate } from './exchange-rate.entity';
import { ExchangeRateService } from './exchange-rate.service';
import { CreateExchangeRateDTO, UpdateExchangeRateDTO } from './dto';

/**
 * Exchange rates.
 *
 * Both verbs and both reads live behind the same pair of permissions, and the edit one is
 * administrative: a rate is not a row about one product, it is the conversion applied to every
 * foreign-currency amount the tenant charges. There is no `/sync` route here — a provider sync is a
 * scheduled integration's job, and it writes through this service's own write path so that a synced
 * rate obeys exactly the rules a hand-entered one does.
 */
@ApiTags('ExchangeRate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_VIEW))
@Controller('/exchange-rates')
export class ExchangeRateController extends CrudController<ExchangeRate> {
	constructor(private readonly exchangeRateService: ExchangeRateService) {
		super(exchangeRateService);
	}

	/**
	 * Create a rate.
	 *
	 * @param entity The rate to create.
	 * @returns The created rate.
	 */
	@ApiOperation({ summary: 'Create an exchange rate' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The rate was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The pair, the rate or the window is invalid.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateExchangeRateDTO): Promise<ExchangeRate> {
		return await this.exchangeRateService.createOne(entity);
	}

	/**
	 * Update a rate.
	 *
	 * @param id The rate to update.
	 * @param entity The fields to change.
	 * @returns The updated rate.
	 */
	@ApiOperation({ summary: 'Update an exchange rate' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The rate was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such rate in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateExchangeRateDTO
	): Promise<UpdateResult | ExchangeRate> {
		return await this.exchangeRateService.updateOne(id, entity);
	}

	/**
	 * Delete a rate.
	 *
	 * A rate that priced a past order stays queryable by default: without `force` the row is
	 * soft-deleted, which is what keeps a historical conversion reproducible.
	 *
	 * @param id The rate to delete.
	 * @param force Whether the removal is a hard delete.
	 * @returns The delete result, or the soft-deleted rate.
	 */
	@ApiOperation({ summary: 'Delete an exchange rate' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The rate was deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such rate in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('force') force?: string | boolean
	): Promise<DeleteResult | UpdateResult | ExchangeRate> {
		await this.exchangeRateService.findOneByIdString(id);

		return force === true || force === 'true'
			? await this.exchangeRateService.delete(id)
			: await this.exchangeRateService.softDelete(id);
	}
}
