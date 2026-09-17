import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe } from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../tax.permissions';
import { IResolvedTaxRate } from '../tax.types';
import { ResolveTaxRateDTO } from './dto';
import { TaxRate } from './tax-rate.entity';
import { TaxRateService } from './tax-rate.service';

/**
 * The tax rate resource.
 *
 * Beside the platform's CRUD surface the controller exposes the resolution the whole capability exists
 * for: given a category and a destination it returns the rates that apply, most specific zone first.
 * Resolution is a read, so it is guarded by the view permission rather than the edit one.
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
}
