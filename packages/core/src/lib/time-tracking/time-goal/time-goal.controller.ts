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
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, ITimeGoal, ITimeGoalProgress, PermissionsEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { Permissions } from '../../shared/decorators';
import { EmployeeTrackedDataGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UseValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { CreateTimeGoalDTO, TimeGoalProgressQueryDTO, TimeGoalQueryDTO, UpdateTimeGoalDTO } from './dto';
import { TimeGoalService } from './time-goal.service';

/**
 * Time goals and their progress. The routes admit whoever reads the time statistics; what each caller may read and
 * write (her own goals, those of the teams she manages, or everyone's) is decided per goal by the service.
 */
@ApiTags('TimeGoal')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.ALL_ORG_VIEW
)
@Controller('/time-goals')
export class TimeGoalController {
	constructor(private readonly timeGoalService: TimeGoalService) {}

	@ApiOperation({
		summary: 'Progress against time goals',
		description:
			'For each member read and each goal that counts her, the seconds counted and the target over the period of the goal that holds the date, with the state.'
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'The progress rows.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('/progress')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getProgress(@Query() query: TimeGoalProgressQueryDTO): Promise<ITimeGoalProgress[]> {
		return await this.timeGoalService.getProgress(query);
	}

	@ApiOperation({ summary: 'List the time goals the caller may read in an organization' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goals.' })
	@Get('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query: TimeGoalQueryDTO): Promise<IPagination<ITimeGoal>> {
		return await this.timeGoalService.findGoals(query);
	}

	@ApiOperation({ summary: 'Read a time goal' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goal.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No goal the caller may read.' })
	@Get('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: TenantOrganizationBaseDTO
	): Promise<ITimeGoal> {
		return await this.timeGoalService.findGoal(id, query.organizationId);
	}

	@ApiOperation({ summary: 'Create a time goal' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The goal.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller may not set a goal for whom it counts.' })
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateTimeGoalDTO): Promise<ITimeGoal> {
		return await this.timeGoalService.createGoal(entity);
	}

	@ApiOperation({ summary: 'Change what a time goal asks for' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goal.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No goal the caller may read.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller reads the goal but may not change it.' })
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateTimeGoalDTO): Promise<ITimeGoal> {
		return await this.timeGoalService.updateGoal(id, entity);
	}

	@ApiOperation({ summary: 'Archive a time goal' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goal.' })
	@Put('/:id/archive')
	@UseValidationPipe({ whitelist: true })
	async archive(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: TenantOrganizationBaseDTO
	): Promise<ITimeGoal> {
		return await this.timeGoalService.archiveGoal(id, body.organizationId);
	}

	@ApiOperation({ summary: 'Restore an archived time goal' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goal.' })
	@Put('/:id/restore')
	@UseValidationPipe({ whitelist: true })
	async restore(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: TenantOrganizationBaseDTO
	): Promise<ITimeGoal> {
		return await this.timeGoalService.restoreGoal(id, body.organizationId);
	}

	@ApiOperation({ summary: 'Delete a time goal' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The goal is deleted.' })
	@Delete('/:id')
	@UseValidationPipe({ whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: TenantOrganizationBaseDTO
	): Promise<DeleteResult> {
		return await this.timeGoalService.deleteGoal(id, query.organizationId);
	}
}
