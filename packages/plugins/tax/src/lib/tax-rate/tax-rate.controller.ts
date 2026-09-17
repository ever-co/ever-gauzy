import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../tax.permissions';
import { IResolvedTaxRate, TaxCalculationResult, TaxWriteInput } from '../tax.types';
import { CreateTaxRateDTO, ResolveTaxRateDTO, TaxCalculationDTO, UpdateTaxRateDTO } from './dto';
import { TaxRate } from './tax-rate.entity';
import { TaxRateService } from './tax-rate.service';

/**
 * The tax rate resource.
 *
 * The class carries the reading permission, which is what resolving a rate and computing tax take, so
 * the routes the platform's CRUD surface already provides are read-guarded without restating it; each
 * authoring route below carries the editing permission instead. Both declared permissions are therefore
 * effective: a role that may resolve rates need not be able to author them.
 *
 * Beside the CRUD surface the controller exposes the two operations the capability exists for, both
 * scoped to the resource that owns the rates: resolving the rates that apply to a destination, and
 * computing what a set of amounts comes to under them. Neither is a resource — no row is created and
 * the computation returns the breakdown rather than storing it.
 */
@ApiTags('TaxRate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
@Controller('/tax-rates')
export class TaxRateController extends CrudController<TaxRate> {
	constructor(private readonly taxRateService: TaxRateService) {
		super(taxRateService);
	}

	/**
	 * Create a tax rate.
	 *
	 * @param entity The rate to create.
	 * @returns The created rate.
	 */
	@ApiOperation({ summary: 'Create a new tax rate' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The tax rate was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The rate, the window or the pattern is not usable.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax category in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateTaxRateDTO): Promise<TaxRate> {
		return await this.taxRateService.create(entity as TaxWriteInput<TaxRate>);
	}

	/**
	 * Update a tax rate.
	 *
	 * @param id The rate to update.
	 * @param entity The members to change.
	 * @returns The updated rate.
	 */
	@ApiOperation({ summary: 'Update a tax rate' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax rate was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax rate in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateTaxRateDTO): Promise<TaxRate> {
		return await this.taxRateService.update(id, entity as TaxWriteInput<TaxRate>);
	}

	/**
	 * Retire a tax rate.
	 *
	 * The row is kept rather than removed: a tax line written before the deletion names this rate, and
	 * the breakdown of a placed document has to stay explainable. A rate that must stop applying at a
	 * known moment is ended with `endsAt` instead.
	 *
	 * @param id The rate to retire.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Retire a tax rate' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax rate was retired.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax rate in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.taxRateService.delete(id);
	}

	/**
	 * Resolves the rates that apply to a destination.
	 *
	 * @param request The category to resolve within and the destination to resolve for.
	 * @returns The winning rate, followed by the compound rates of its chain.
	 */
	@ApiOperation({ summary: 'Resolve the rates that apply to a destination' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The resolved rate chain.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No rate matches the destination.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
	@Post('resolve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async resolve(@Body() request: ResolveTaxRateDTO): Promise<IResolvedTaxRate[]> {
		return await this.taxRateService.resolve({
			taxCategoryId: request.taxCategoryId,
			regionId: request.regionId,
			countryCode: request.countryCode,
			provinceCode: request.provinceCode,
			postalCode: request.postalCode,
			regionTaxInclusive: request.regionTaxInclusive,
			now: request.at ? new Date(request.at) : undefined
		});
	}

	/**
	 * Computes tax for a set of amounts.
	 *
	 * The amounts come from the caller's own totals chain; what comes back is the breakdown, in the shape
	 * of the platform's tax ledger rows, which the caller persists through that ledger. This endpoint
	 * stores nothing.
	 *
	 * @param request The lines, the currency and the destination they are taxed at.
	 * @returns The lines' tax and the totals over them.
	 */
	@ApiOperation({ summary: 'Compute tax for a set of amounts' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The computed tax of every line and the totals.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'An amount or a destination is not usable.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
	@Post('calculate')
	@UseValidationPipe({ transform: true, whitelist: true })
	async calculate(@Body() request: TaxCalculationDTO): Promise<TaxCalculationResult> {
		return await this.taxRateService.calculate({
			currency: request.currency,
			lines: (request.lines ?? []).map((line) => ({
				referenceId: line.referenceId,
				taxCategoryId: line.taxCategoryId,
				amount: line.amount,
				regionId: line.regionId,
				countryCode: line.countryCode,
				provinceCode: line.provinceCode,
				postalCode: line.postalCode
			})),
			regionId: request.regionId,
			countryCode: request.countryCode,
			provinceCode: request.provinceCode,
			postalCode: request.postalCode,
			regionTaxInclusive: request.regionTaxInclusive,
			allowUntaxedCatalog: request.allowUntaxedCatalog,
			now: request.at ? new Date(request.at) : undefined
		});
	}
}
