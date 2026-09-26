import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
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
import { TAX_PERMISSION_VALUES, taxPermission } from '../tax.permissions';
import { IResolvedTaxRate, TaxCalculationResult, TaxWriteInput } from '../tax.types';
import { TaxRatePart } from '../tax-rate-part/tax-rate-part.entity';
import { CreateTaxRateDTO, ResolveTaxRateDTO, TaxCalculationDTO, UpdateTaxRateDTO } from './dto';
import { SetTaxRatePartsDTO } from '../tax-rate-part/dto';
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
 *
 * A rate's **parts** are reached here too, and deliberately not as a resource of their own. A part exists
 * only as one element of its rate's ordered list, it has no lifecycle, and the person who writes it is the
 * person who authors the rate; a separate permission would let a role reshape the arithmetic of a rate it
 * may not create.
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
		return super.delete(id);
	}

	/**
	 * Soft delete a tax rate.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `TAX_RATES_EDIT`, the grant the plugin's
	 * `deleteTaxRate` mutation carries, so both surfaces ask the same caller.
	 *
	 * @param id The rate to soft delete.
	 * @returns The soft-deleted rate.
	 */
	@ApiOperation({ summary: 'Soft delete a tax rate' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax rate was soft deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax rate in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restore a soft-deleted tax rate.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `TAX_RATES_EDIT` — restoring is the same
	 * grant exercised backwards, exactly as the delete route above states it.
	 *
	 * @param id The rate to restore.
	 * @returns The restored rate.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted tax rate' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax rate was restored.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax rate in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * Reads the ordered parts a rate is made of.
	 *
	 * @param id The rate to read.
	 * @returns The parts of the rate, ordered by their sequence.
	 */
	@ApiOperation({ summary: 'List the parts a tax rate is made of' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The parts of the rate.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax rate in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW))
	@Get(':id/parts')
	async listParts(@Param('id', UUIDValidationPipe) id: ID): Promise<TaxRatePart[]> {
		return await this.taxRateService.listParts(id);
	}

	/**
	 * Replaces the ordered parts a rate is made of.
	 *
	 * The breakdown is written as a set: the shares of the parts have to add up, so adding one changes what
	 * the others carry. An empty list returns the rate to its one implied part — `TAX`, 100 %, base 1 —
	 * which is the breakdown every rate had before parts existed.
	 *
	 * @param id The rate whose parts are being written.
	 * @param entity The complete ordered list the rate should carry.
	 * @returns The parts after the write.
	 */
	@ApiOperation({ summary: 'Replace the parts a tax rate is made of' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The parts of the rate were written.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The list is not a usable breakdown.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax rate in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/parts')
	@UseValidationPipe({ transform: true, whitelist: true })
	async setParts(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SetTaxRatePartsDTO
	): Promise<TaxRatePart[]> {
		return await this.taxRateService.setParts(id, entity.parts as TaxWriteInput<TaxRatePart>[]);
	}

	/**
	 * Resolves the rates that apply to a destination.
	 *
	 * The regime is selected before the rates are: the party's own assignment first, then the most specific
	 * matching regime of the destination, and the general set when nothing matches.
	 *
	 * @param request The category to resolve within, the party's assignment and the destination.
	 * @returns The rates of the winning level, in the order they are applied.
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
			taxRegimeId: request.taxRegimeId,
			partyTaxRegistrationPresent: request.partyTaxRegistrationPresent,
			documentDirection: request.documentDirection,
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
				quantity: line.quantity,
				regionId: line.regionId,
				countryCode: line.countryCode,
				provinceCode: line.provinceCode,
				postalCode: line.postalCode
			})),
			taxRegimeId: request.taxRegimeId,
			partyTaxRegistrationPresent: request.partyTaxRegistrationPresent,
			documentDirection: request.documentDirection,
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
