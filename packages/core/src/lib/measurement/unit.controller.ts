import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
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
import { DecimalString, IPagination, ID } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Unit } from './unit.entity';
import { UnitService } from './unit.service';
import { MEASUREMENT_PERMISSIONS } from './measurement.permissions';
import { ConvertQuantityDTO, CreateUnitDTO, UpdateUnitDTO } from './dto';
import { TenantOrganizationBaseDTO } from '../core/dto';

/**
 * The units inside the families, over REST.
 *
 * The conversion endpoint is the platform's single conversion entry point: a document line states the
 * unit it was entered in, a ledger holds one number in its family's reference unit, and everything
 * between the two is this operation. It refuses two units of different families rather than answering
 * with a number that means nothing.
 */
@ApiTags('Unit')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
@Controller('/units')
export class UnitController extends CrudController<Unit> {
	constructor(private readonly unitService: UnitService) {
		super(unitService);
	}

	/**
	 * Lists the units of the caller's organization, optionally of one family.
	 */
	@ApiOperation({ summary: 'List the units of this organization.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found units', type: Unit })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<Unit>): Promise<IPagination<Unit>> {
		return this.unitService.findAll(params);
	}

	/**
	 * Declares a unit inside a family.
	 */
	@ApiOperation({ summary: 'Declare a unit inside a measurement family.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The unit', type: Unit })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The family has no reference unit' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateUnitDTO): Promise<Unit> {
		// A unit is declared against a family that already has a reference: without one the family has no
		// base quantity, and a second reference is what `UQ_unit_reference` refuses outright.
		await this.unitService.getReferenceUnit(entity.categoryId);

		return this.unitService.create(entity as Partial<Unit>);
	}

	/**
	 * Changes a unit's name, symbol, factor or quantity granularity.
	 */
	@ApiOperation({ summary: 'Change a unit.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The unit' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe()
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateUnitDTO): Promise<Unit> {
		const unit = await this.unitService.getUnit(id);

		const values: Partial<Unit> = {};

		if (entity.name !== undefined) values.name = entity.name;
		if (entity.symbol !== undefined) values.symbol = entity.symbol;
		if (entity.decimalPlaces !== undefined) values.decimalPlaces = entity.decimalPlaces;
		if (entity.metadata !== undefined) values.metadata = entity.metadata;

		if (entity.factor !== undefined) {
			// A reference unit's factor is exactly one by definition; changing it would restate what the
			// whole family is measured in, which is a different unit and not an edit.
			if (unit.isReference) {
				throw new BadRequestException(
					'UNIT_REFERENCE_FACTOR_FIXED: a reference unit defines its family and always has a factor of one.'
				);
			}

			values.factor = entity.factor;
		}

		await this.unitService.update(id, values as any);

		return this.unitService.getUnit(id);
	}

	/**
	 * Archives a unit.
	 */
	@ApiOperation({ summary: 'Archive a unit.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The unit was archived' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string) {
		await this.unitService.getUnit(id);

		return this.unitService.softRemove(id);
	}

	/**
	 * Converts a quantity between two units of one family.
	 */
	@ApiOperation({ summary: 'Convert a quantity between two units of one measurement family.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The converted quantity' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'UNIT_CATEGORY_MISMATCH' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	@HttpCode(HttpStatus.OK)
	@Post('convert')
	@UseValidationPipe()
	async convert(@Body() entity: ConvertQuantityDTO): Promise<{ value: DecimalString; fromUnitId: ID; toUnitId: ID }> {
		return {
			value: await this.unitService.convert(entity.value, entity.fromUnitId, entity.toUnitId),
			fromUnitId: entity.fromUnitId,
			toUnitId: entity.toUnitId
		};
	}

	/**
	 * Withdraws a unit without removing the row — the `DELETE /:id/soft` route the CRUD base maps.
	 *
	 * Restated only to state its permission. Left inherited, the route carried none, and `PermissionGuard` —
	 * handler first, then class — authorised it on this class's read grant (`UNITS_VIEW`), so a role that
	 * may only look could withdraw a row. The soft-delete/recover pair requires the controller's own edit grant,
	 * the one `update` states (owner decision 5, 2026-10-13); the status code, the path, the validation and the
	 * service call are the inherited route's own, so the change is who may call it and nothing else. The GraphQL
	 * field that mirrors it states the same grant.
	 *
	 * @param id The row to withdraw.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The withdrawn row.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Unit> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a withdrawn row — the `PUT /:id/recover` route the CRUD base maps.
	 *
	 * Restated for the reason the withdrawal above is: restoring undoes a removal, so it requires the same edit
	 * grant (owner decision 5) rather than the class's read grant (`UNITS_VIEW`) the inherited route stood on.
	 *
	 * @param id The row to restore.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The restored row.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Unit> {
		return await super.softRecover(id, ...options);
	}
}
