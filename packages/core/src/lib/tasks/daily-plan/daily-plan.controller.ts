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
import { DeleteResult, UpdateResult } from 'typeorm';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IDailyPlan, IDailyPlanTasksUpdateInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../../core/crud';
import { UseValidationPipe } from '../../shared/pipes';
import { CreateDailyPlanDTO, RemoveTaskFromManyPlansDTO, UpdateDailyPlanDTO } from './dto';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { DailyPlan } from './daily-plan.entity';
import { DailyPlanService } from './daily-plan.service';

@ApiTags('Daily Plan')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_UPDATE)
@Controller('/daily-plan')
export class DailyPlanController extends CrudController<DailyPlan> {
	constructor(private readonly dailyPlanService: DailyPlanService) {
		super(dailyPlanService);
	}

	/**
	 * Retrieves the daily plans for the currently authenticated user.
	 *
	 * This endpoint allows users to fetch their own daily plans with support for pagination.
	 *
	 * @param params - Pagination and filtering parameters for retrieving daily plans.
	 * @returns A paginated list of daily plans for the authenticated user.
	 */
	@ApiOperation({
		summary: 'Find my daily plans.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found plans',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	@Get('/me')
	@UseValidationPipe()
	async getMyPlans(@Query() params: BaseQueryDTO<DailyPlan>): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getMyPlans(params);
	}

	/**
	 * Retrieves daily plans for the team members based on the provided query parameters.
	 *
	 * Accessible by users with appropriate permissions. Supports pagination and filtering.
	 *
	 * @param params - Pagination and filtering parameters for fetching team daily plans.
	 * @returns A paginated list of team daily plans.
	 */
	@ApiOperation({
		summary: 'Find team daily plans.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found plans',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Get('/team')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	@UseValidationPipe()
	async getTeamDailyPlans(@Query() params: BaseQueryDTO<DailyPlan>): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getTeamDailyPlans(params);
	}

	/**
	 * Retrieves daily plans for a specific employee.
	 *
	 * Requires appropriate permissions. Supports pagination.
	 *
	 * @param employeeId - The ID of the employee whose daily plans are to be fetched.
	 * @param params - Pagination and filtering parameters.
	 * @returns A paginated list of daily plans for the specified employee.
	 */
	@ApiOperation({
		summary: 'Find employee daily plans.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found plans',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	@Get('/employee/:id')
	async getEmployeeDailyPlans(
		@Param('id') employeeId: ID,
		@Query() params: BaseQueryDTO<DailyPlan>
	): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getDailyPlansByEmployee(params, employeeId);
	}

	/**
	 * Retrieves daily plans associated with a specific task.
	 *
	 * Requires appropriate permissions. Supports pagination and filtering.
	 *
	 * @param taskId - The ID of the task whose related daily plans are to be retrieved.
	 * @param params - Pagination and filtering parameters.
	 * @returns A paginated list of daily plans linked to the given task.
	 */
	@ApiOperation({
		summary: 'Find task daily plans.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found plans',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	@Get('/task/:id')
	async getDailyPlansForTaskId(
		@Param('id') taskId: ID,
		@Query() params: BaseQueryDTO<IDailyPlan>
	): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getDailyPlansByTask(params, taskId);
	}

	/**
	 * Add a task to a specified daily plan.
	 *
	 * Requires appropriate permissions to edit or create a daily plan.
	 *
	 * @param planId - The unique identifier of the daily plan to which the task will be added.
	 * @param input - The task input including taskId, employeeId, and organizationId.
	 * @returns The updated daily plan with the newly added task.
	 */
	@ApiOperation({
		summary: 'Add a task to daily plan'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Task added successfully.',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No record found with the given ID.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_CREATE, PermissionsEnum.DAILY_PLAN_UPDATE)
	@Post('/:id/task')
	async addTaskToDailyPlan(@Param('id') planId: ID, @Body() input: IDailyPlanTasksUpdateInput): Promise<IDailyPlan> {
		return await this.dailyPlanService.addTaskToPlan(planId, input);
	}

	/**
	 * Remove a task from a specified daily plan.
	 *
	 * Requires appropriate permissions to modify the daily plan.
	 *
	 * @param planId - The ID of the daily plan from which the task will be removed.
	 * @param input - Object containing taskId and other related identifiers to perform the removal.
	 * @returns The updated daily plan after removing the task.
	 */
	@ApiOperation({
		summary: 'Remove a task from daily plan'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Task successfully removed from the daily plan.',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No record found with the given ID.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_CREATE, PermissionsEnum.DAILY_PLAN_UPDATE)
	@Put('/:id/task')
	async removeTaskFromDailyPlan(
		@Param('id') planId: ID,
		@Body() input: IDailyPlanTasksUpdateInput
	): Promise<IDailyPlan> {
		return await this.dailyPlanService.removeTaskFromPlan(planId, input);
	}

	/**
	 * Delete a task from multiple daily plans.
	 *
	 * Requires appropriate data such as employee ID and organization ID to identify which plans to update.
	 *
	 * @param taskId - The unique identifier of the task to be removed from daily plans.
	 * @param input - An object containing details (e.g. employeeId, organizationId) to locate affected plans.
	 * @returns An array of updated daily plans after the task has been removed.
	 */
	@ApiOperation({
		summary: 'Remove a task from daily plans'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Task successfully removed from the daily plans.',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No record found with the given ID.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_CREATE, PermissionsEnum.DAILY_PLAN_UPDATE)
	@Put('/:taskId/remove')
	async removeTaskFromManyPlans(
		@Param('taskId') taskId: ID,
		@Body() input: RemoveTaskFromManyPlansDTO
	): Promise<IDailyPlan[]> {
		return this.dailyPlanService.removeTaskFromManyPlans(taskId, input);
	}

	/**
	 * Retrieves all daily plans based on the provided query parameters.
	 *
	 * Requires appropriate permissions to view organization data.
	 * Supports pagination and filtering.
	 *
	 * @param params - Query parameters for pagination and optional filtering.
	 * @returns A paginated list of all daily plans.
	 */
	@ApiOperation({
		summary: 'Find daily plans.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found plans',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Get('/')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DAILY_PLAN_READ)
	@UseValidationPipe()
	async get(@Query() params: BaseQueryDTO<DailyPlan>): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getAllPlans(params);
	}

	/**
	 * Creates a new daily plan.
	 *
	 * Requires appropriate permissions to create a daily plan.
	 * Validates and transforms input data using a validation pipe.
	 *
	 * @param entity - The data required to create a daily plan.
	 * @returns The newly created daily plan.
	 */
	@ApiOperation({ summary: 'Create new Daily Plan' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Daily Plan has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The request body must contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_CREATE)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateDailyPlanDTO): Promise<IDailyPlan> {
		return await this.dailyPlanService.createDailyPlan(entity);
	}

	/**
	 * Updates an existing daily plan by ID.
	 *
	 * Requires appropriate permissions to update a daily plan.
	 * Applies validation and transformation to the request body.
	 *
	 * @param id - The ID of the daily plan to update.
	 * @param entity - The updated data for the daily plan.
	 * @returns The updated daily plan or the update result from TypeORM.
	 */
	@ApiOperation({
		summary: 'Update daily plan'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plan updated',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_UPDATE)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id') id: ID, @Body() entity: UpdateDailyPlanDTO): Promise<IDailyPlan | UpdateResult> {
		return await this.dailyPlanService.updateDailyPlan(id, entity);
	}

	/**
	 * Deletes a daily plan by its ID.
	 *
	 * Requires appropriate permissions to perform the deletion.
	 *
	 * @param planId - The ID of the daily plan to be deleted.
	 * @returns A result object indicating the outcome of the delete operation.
	 */
	@ApiOperation({
		summary: 'Delete Daily plan'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plan deleted',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DAILY_PLAN_DELETE)
	@Delete('/:id')
	async delete(@Param('id') planId: ID): Promise<DeleteResult> {
		return await this.dailyPlanService.delete(planId);
	}
}
