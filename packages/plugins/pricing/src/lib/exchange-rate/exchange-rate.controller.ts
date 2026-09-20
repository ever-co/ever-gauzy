import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
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

	/**
	 * Soft delete a rate.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `EXCHANGE_RATES_EDIT`, the
	 * grant the plugin's `deleteExchangeRate` mutation carries.
	 *
	 * @param id The rate to soft delete.
	 * @param options The inherited options, forwarded to the base handler.
	 * @returns The soft-deleted rate.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The rate was soft deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such rate in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restore a soft-deleted rate.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `EXCHANGE_RATES_EDIT`, the
	 * grant the plugin's `deleteExchangeRate` mutation carries.
	 *
	 * @param id The rate to restore.
	 * @param options The inherited options, forwarded to the base handler.
	 * @returns The restored rate.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The rate was restored.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such rate in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.EXCHANGE_RATES_EDIT))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
