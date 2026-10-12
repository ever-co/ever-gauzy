import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UnitCategory } from './unit-category.entity';
import { UnitCategoryService } from './unit-category.service';
import { MEASUREMENT_PERMISSIONS } from './measurement.permissions';
import { CreateUnitCategoryDTO, UpdateUnitCategoryDTO } from './dto';

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
}
