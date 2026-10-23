import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	HttpCode,
	Delete,
	Param,
	Put,
	Query,
	BadRequestException,
	UsePipes
} from '@nestjs/common';
import { IGoalTimeFrame, IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GoalTimeFrameService } from './goal-time-frame.service';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { CreateGoalTimeFrameDTO, UpdateGoalTimeFrameDTO } from './dto';
import { Permissions } from './../shared/decorators';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('GoalTimeFrame')
@UseGuards(TenantPermissionGuard)
@Controller('/goal-time-frame')
export class GoalTimeFrameController extends CrudController<GoalTimeFrame> {
	constructor(private readonly goalTimeFrameService: GoalTimeFrameService) {
		super(goalTimeFrameService);
	}

	@ApiOperation({ summary: 'Get all Goal Time Frames' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found all Time Frames'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Time Frame found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IGoalTimeFrame>> {
		const { findInput } = data;
		return this.goalTimeFrameService.findAll({
			where: { ...findInput }
		});
	}

	@ApiOperation({ summary: 'Create Goal Time Frame' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Time Frame added successfully',
		type: GoalTimeFrame
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateGoalTimeFrameDTO): Promise<IGoalTimeFrame> {
		return this.goalTimeFrameService.create(entity);
	}

	@ApiOperation({ summary: 'Find Goal Time Frames with name' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found all Time Frames'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Time Frame found'
	})
	@Get(':name')
	async getByName(@Param('name') name: string): Promise<IPagination<IGoalTimeFrame>> {
		return this.goalTimeFrameService.findAll({ where: { name: name } });
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
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateGoalTimeFrameDTO
	): Promise<IGoalTimeFrame> {
		try {
			return await this.goalTimeFrameService.create({ ...entity, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.goalTimeFrameService.delete(id);
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<GoalTimeFrame> {
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<GoalTimeFrame> {
		return await super.softRecover(id, ...options);
	}
}
