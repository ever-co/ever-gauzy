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
import { IResolvedTaxRegime, TaxWriteInput } from '../tax.types';
import { TaxRegimeRate } from '../tax-regime-rate/tax-regime-rate.entity';
import { CreateTaxRegimeDTO, ResolveTaxRegimeDTO, SetTaxRegimeRatesDTO, UpdateTaxRegimeDTO } from './dto';
import { TaxRegime } from './tax-regime.entity';
import { TaxRegimeService } from './tax-regime.service';

/**
 * The tax regime resource.
 *
 * A regime is a resource of its own rather than a detail of a rate, because it is what decides **which**
 * taxes apply to a party or a destination: getting one wrong zeroes a jurisdiction's tax, so the catalogue
 * grants it its own administrative permission rather than folding it into the rate permission.
 *
 * Membership is reached through the regime and never as a resource of its own. The membership row has no
 * lifecycle — it is the statement "this rate belongs to this set" — and a second endpoint that detached a
 * rate would let one caller reshape a set another is authoring, under a permission that guards the set.
 *
 * The class carries the reading permission, so the routes the platform's CRUD surface already provides are
 * read-guarded without restating it; each authoring route below carries the editing permission instead.
 */
@ApiTags('TaxRegime')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_VIEW))
@Controller('/tax-regimes')
export class TaxRegimeController extends CrudController<TaxRegime> {
	constructor(private readonly taxRegimeService: TaxRegimeService) {
		super(taxRegimeService);
	}

	/**
	 * Create a tax regime.
	 *
	 * @param entity The regime to create.
	 * @returns The created regime.
	 */
	@ApiOperation({ summary: 'Create a new tax regime' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The tax regime was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The window or the postal pattern is not usable.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateTaxRegimeDTO): Promise<TaxRegime> {
		return await this.taxRegimeService.create(entity as TaxWriteInput<TaxRegime>);
	}

	/**
	 * Update a tax regime.
	 *
	 * @param id The regime to update.
	 * @param entity The members to change.
	 * @returns The updated regime.
	 */
	@ApiOperation({ summary: 'Update a tax regime' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax regime was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax regime in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateTaxRegimeDTO): Promise<TaxRegime> {
		return await this.taxRegimeService.update(id, entity as TaxWriteInput<TaxRegime>);
	}

	/**
	 * Retire a tax regime.
	 *
	 * The row is kept rather than removed: a tax line records the regime a document was taxed under, and the
	 * first question a tax authority asks is which set applied.
	 *
	 * @param id The regime to retire.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Retire a tax regime' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax regime was retired.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax regime in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return super.delete(id);
	}

	/**
	 * Soft delete a tax regime.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `TAX_REGIMES_EDIT`, the grant the
	 * plugin's `deleteTaxRegime` mutation carries, so both surfaces ask the same caller.
	 *
	 * @param id The regime to soft delete.
	 * @returns The soft-deleted regime.
	 */
	@ApiOperation({ summary: 'Soft delete a tax regime' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax regime was soft deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax regime in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restore a soft-deleted tax regime.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `TAX_REGIMES_EDIT` — restoring is the
	 * same grant exercised backwards, exactly as the delete route above states it.
	 *
	 * @param id The regime to restore.
	 * @returns The restored regime.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted tax regime' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax regime was restored.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax regime in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * Reads the rates a regime selects.
	 *
	 * @param id The regime to read.
	 * @returns The membership rows of the regime.
	 */
	@ApiOperation({ summary: 'List the rates a tax regime selects' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The rates the regime selects.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax regime in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_VIEW))
	@Get(':id/rates')
	async listRates(@Param('id', UUIDValidationPipe) id: ID): Promise<TaxRegimeRate[]> {
		return await this.taxRegimeService.listRates(id);
	}

	/**
	 * Sets which rates a regime selects.
	 *
	 * The set replaces the previous one. A rate that belongs to no regime is general and always a candidate;
	 * a rate attached to a regime is a candidate only for that regime, which is the whole of the mechanism.
	 *
	 * @param id The regime whose membership is being written.
	 * @param entity The complete set of rates the regime should select.
	 * @returns The membership rows after the write.
	 */
	@ApiOperation({ summary: 'Set the rates a tax regime selects' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The membership of the regime was written.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The set is empty, or names no rate of this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/rates')
	@UseValidationPipe({ transform: true, whitelist: true })
	async setRates(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SetTaxRegimeRatesDTO
	): Promise<TaxRegimeRate[]> {
		return await this.taxRegimeService.setRates(id, entity.taxRateIds);
	}

	/**
	 * Resolves the regime that applies to a document.
	 *
	 * The party's own assignment always wins; when it names none, the most specific matching regime of the
	 * destination is selected, and when nothing matches the general set applies. This is a read: no row is
	 * written and nothing is stored.
	 *
	 * @param request The party's assignment and the destination to match.
	 * @returns The selected regime.
	 */
	@ApiOperation({ summary: 'Resolve the tax regime that applies to a document' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The selected regime.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The party assignment names no live regime.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_VIEW))
	@Post('resolve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async resolve(@Body() request: ResolveTaxRegimeDTO): Promise<IResolvedTaxRegime | undefined> {
		return await this.taxRegimeService.resolveRegime({
			taxRegimeId: request.taxRegimeId,
			partyTaxRegistrationPresent: request.partyTaxRegistrationPresent,
			regionId: request.regionId,
			countryCode: request.countryCode,
			provinceCode: request.provinceCode,
			postalCode: request.postalCode,
			now: request.at ? new Date(request.at) : undefined
		});
	}
}
