import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	Param,
	Delete,
	HttpCode,
	Put,
	BadRequestException,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IKPI, IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { GoalKPI } from './goal-kpi.entity';
import { GoalKpiService } from './goal-kpi.service';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('GoalKpi')
@UseGuards(TenantPermissionGuard)
@Controller('/goal-kpi')
export class GoalKpiController extends CrudController<GoalKPI> {
	constructor(private readonly goalKpiService: GoalKpiService) {
		super(goalKpiService);
	}

	@ApiOperation({ summary: 'Get all KPI' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found all KPI'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No KPI found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IKPI>> {
		const { findInput } = data;
		return this.goalKpiService.findAll({
			where: { ...findInput },
			relations: ['lead']
		});
	}

	@ApiOperation({ summary: 'Create Goal KPI' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'KPI added successfully',
		type: GoalKPI
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Post()
	async create(@Body() entity: GoalKPI): Promise<IKPI> {
		return this.goalKpiService.create(entity);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Put(':id')
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: GoalKPI): Promise<IKPI> {
		try {
			return await this.goalKpiService.create({ ...entity, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.goalKpiService.delete(id);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could retire the row. It now states `GOALS_EDIT` (owner decision 2, 2026-10-22; GHSA-v79w-54p2-wmh5). The
	 * GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<GoalKPI> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could restore the row. It now states `GOALS_EDIT` (owner decision 2, 2026-10-22; GHSA-v79w-54p2-wmh5). The
	 * GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<GoalKPI> {
		return await super.softRecover(id, ...options);
	}
}
