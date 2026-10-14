import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination, ID } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UnitCategory } from './unit-category.entity';
import { UnitCategoryService } from './unit-category.service';
import { MEASUREMENT_PERMISSIONS } from './measurement.permissions';
import { CreateUnitCategoryDTO, UpdateUnitCategoryDTO } from './dto';
import { TenantOrganizationBaseDTO } from '../core/dto';

/**
 * The measurement families, over REST.
 *
 * The path is the plural concept — `/unit-categories` — with no capability segment: a family is read
 * by inventory, purchasing, projects and time tracking, so a path naming any one of them would be a
 * boundary drawn by audience rather than by concept.
 */
@ApiTags('UnitCategory')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
@Controller('/unit-categories')
export class UnitCategoryController extends CrudController<UnitCategory> {
	constructor(private readonly unitCategoryService: UnitCategoryService) {
		super(unitCategoryService);
	}

	/**
	 * Lists the families of the caller's organization.
	 */
	@ApiOperation({ summary: 'List the measurement families of this organization.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found measurement families', type: UnitCategory })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<UnitCategory>): Promise<IPagination<UnitCategory>> {
		return this.unitCategoryService.findAll(params);
	}

	/**
	 * Declares a family together with the reference unit that defines it.
	 */
	@ApiOperation({ summary: 'Declare a measurement family with the reference unit that defines it.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The measurement family', type: UnitCategory })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The code is taken, or no reference unit was given' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateUnitCategoryDTO): Promise<UnitCategory> {
		return this.unitCategoryService.createCategoryWithReference(entity);
	}

	/**
	 * Renames a family, or changes its tenant extras.
	 */
	@ApiOperation({ summary: 'Change a measurement family.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The measurement family' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateUnitCategoryDTO
	): Promise<UnitCategory> {
		await this.unitCategoryService.getCategory(id);
		await this.unitCategoryService.update(id, {
			...(entity.name === undefined ? {} : { name: entity.name }),
			...(entity.metadata === undefined ? {} : { metadata: entity.metadata })
		} as any);

		return this.unitCategoryService.getCategory(id);
	}

	/**
	 * Archives a family. A seeded family is archived, never deleted: the units inside it are what every
	 * quantity expressed in the family means, and a factor cannot be removed from under them.
	 */
	@ApiOperation({ summary: 'Archive a measurement family.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The family was archived' })
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string) {
		await this.unitCategoryService.getCategory(id);

		return this.unitCategoryService.softRemove(id);
	}

	/**
	 * Withdraws a unit category without removing the row — the `DELETE /:id/soft` route the CRUD base maps.
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<UnitCategory> {
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<UnitCategory> {
		return await super.softRecover(id, ...options);
	}
}
