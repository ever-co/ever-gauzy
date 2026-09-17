import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe } from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../tax.permissions';
import { TaxCalculationResult } from '../tax.types';
import { TaxCalculationDTO } from './dto';
import { TaxRateService } from './tax-rate.service';

/**
 * The tax calculation endpoint.
 *
 * This is a capability endpoint, not a resource: it owns no table and returns no row, so it does not
 * extend the CRUD surface and there is no second resource behind it. It computes tax for a set of
 * amounts a caller already priced — the amounts come from the caller's own totals chain, and what comes
 * back is the breakdown, in the shape of the platform's tax ledger rows, which the caller persists. The
 * guards and the permission are the ones the tax rates are read with, because computing tax is reading
 * them.
 */
@ApiTags('Tax')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
@Controller('/tax')
export class TaxCalculationController {
	constructor(private readonly taxRateService: TaxRateService) {}

	/**
	 * Computes tax for a set of amounts.
	 *
	 * @param request The lines, the currency and the destination they are taxed at.
	 * @returns The lines' tax and the totals over them, in the currency they were given in.
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
