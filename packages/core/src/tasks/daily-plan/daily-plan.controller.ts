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
import { UpdateResult } from 'typeorm';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IDailyPlan,
	IDailyPlanTasksUpdateInput,
	IEmployee,
	IPagination,
	ITask,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../../core/crud';
import { UseValidationPipe } from '../../shared/pipes';
import { DailyPlan } from './daily-plan.entity';
import { DailyPlanService } from './daily-plan.service';
import { CreateDailyPlanDTO, RemoveTaskFromManyPlansDTO, UpdateDailyPlanDTO } from './dto';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';

@ApiTags('Daily Plan')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class DailyPlanController extends CrudController<DailyPlan> {
	constructor(private readonly dailyPlanService: DailyPlanService) {
		super(dailyPlanService);
	}

	/**
	 * GET my daily plans
	 *
	 * @param options
	 * @returns
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
	@Get('me')
	@UseValidationPipe()
	async getMyPlans(@Query() params: PaginationParams<DailyPlan>) {
		return await this.dailyPlanService.getMyPlans(params);
	}

	/**
	 * GET daily plans for a given employee
	 *
	 * @param options
	 * @param employeeId
	 * @returns
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
	@Get('employee/:id')
	async getEmployeeDailyPlans(
		@Param('id') employeeId: IEmployee['id'],
		@Query() params: PaginationParams<DailyPlan>
	): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getDailyPlansByEmployee(params, employeeId);
	}

	/**
	 * GET daily plans for a given task
	 *
	 * @param options
	 * @param taskId
	 * @returns
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
	@Get('task/:id')
	async getDailyPlansForTaskId(
		@Param('id') taskId: ITask['id'],
		@Query() params: PaginationParams<IDailyPlan>
	): Promise<IPagination<IDailyPlan>> {
		return await this.dailyPlanService.getDailyPlansByTask(params, taskId);
	}

	/**
	 * Add a task to a specified daily plan.
	 *
	 * @param planId - The unique identifier of the daily plan to which the task will be added.
	 * @param input - An object containing details about the task to add, including task ID, employee ID, and organization ID.
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
	@Post(':id/task') // Route for adding a task to a daily plan
	async addTaskToDailyPlan(
		@Param('id') planId: IDailyPlan['id'], // Extract the plan ID from the URL parameter
		@Body() input: IDailyPlanTasksUpdateInput // Data for updating the daily plan
	): Promise<IDailyPlan> {
		// Call the service method to add a task to the daily plan
		return await this.dailyPlanService.addTaskToPlan(planId, input);
	}

	/**
	 * Remove a task from a specified daily plan.
	 *
	 * @param planId - The ID of the daily plan from which a task will be removed.
	 * @param taskId - The ID of the task to be removed from the daily plan.
	 * @param params - Additional query parameters for pagination or filtering.
	 * @returns The updated daily plan after the task is removed.
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
	@Put(':id/task') // Endpoint for removing a task from a daily plan
	async removeTaskFromDailyPlan(
		@Param('id') planId: IDailyPlan['id'], // Extract the daily plan ID from the URL parameter
		@Body() input: IDailyPlanTasksUpdateInput // Data for updating the daily plan
	): Promise<IDailyPlan> {
		// Call the service to remove the task from the daily plan
		return await this.dailyPlanService.removeTaskFromPlan(planId, input);
	}

	/**
	 * Delete task from a many daily plans
	 *
	 * @param  taskId The unique identifier of the task to removed from daily plans.
	 * @param input - An object containing details about the plans to update, including employee ID, and organization ID.
	 * @returns The updated daily plans without the deleted task.
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
	@Put(':taskId/remove') // Endpoint for removing a task from many daily plans
	async removeTaskFromManyPlans(
		@Param('taskId') taskId: ITask['id'],
		@Body() input: RemoveTaskFromManyPlansDTO
	): Promise<IDailyPlan[]> {
		return this.dailyPlanService.removeTaskFromManyPlans(taskId, input);
	}

	/**
	 * GET daily plans
	 *
	 * @param options
	 * @returns
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
	@Get()
	@UseValidationPipe()
	async get(@Query() params: PaginationParams<DailyPlan>) {
		return await this.dailyPlanService.getAllPlans(params);
	}

	/**
	 * CREATE Daily Plan
	 * @param entity Data to create or update the DailyPlan
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
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateDailyPlanDTO): Promise<IDailyPlan> {
		return await this.dailyPlanService.createDailyPlan(entity);
	}

	/**
	 * UPDATE Daily Plan
	 * @param entity - An object with data to update.
	 * @param id - The ID of the daily plan from which a task will be removed.
	 * @returns the updated daily plan or the update result from typeorm
	 * @memberof DailyPlanController
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
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Query('id') id: IDailyPlan['id'],
		@Body() entity: UpdateDailyPlanDTO
	): Promise<IDailyPlan | UpdateResult> {
		return await this.dailyPlanService.updateDailyPlan(id, entity);
	}

	/**
	 * DELETE plan
	 *
	 * @param {IDailyPlan['id']} planId
	 * @returns
	 * @memberof DailyPlanController
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
	@Delete(':id')
	async delete(@Param('id') planId: IDailyPlan['id']) {
		return await this.dailyPlanService.deletePlan(planId);
	}
}
