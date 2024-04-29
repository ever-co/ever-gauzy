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
import { CrudController, PaginationParams } from '../../core/crud';
import { DailyPlan } from './daily-plan.entity';
import { DailyPlanService } from './daily-plan.service';
import { IDailyPlan, IEmployee, ITask } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UseValidationPipe } from 'shared';
import { CreateDailyPlanDTO } from './dto';
import { GetTaskByIdDTO } from '../dto';

@ApiTags('Daily Plan')
// @UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class DailyPlanController extends CrudController<DailyPlan> {
	constructor(private readonly dailyPlanService: DailyPlanService) {
		super(dailyPlanService);
	}

	/**
	 * CREATE Daily Plan
	 * @param entity
	 * @param params
	 * @param options
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
	async create(
		@Body() entity: CreateDailyPlanDTO,
		@Query() params: GetTaskByIdDTO,
		@Query() options: PaginationParams<DailyPlan>
	): Promise<IDailyPlan> {
		return await this.dailyPlanService.createDailyPlan(entity, params, options, entity.taskId);
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
	@Get(':id')
	async getEmployeeDailyPlans(
		@Param('id') employeeId: IEmployee['id'],
		@Query() params: PaginationParams<DailyPlan>
	) {
		return await this.dailyPlanService.getDailyPlansByEmployee(employeeId, params);
	}

	/**
	 * Delete task from a given daily plan
	 *
	 * @param {IDailyPlan['id']} planId
	 * @param {ITask['id']} taskId
	 * @param {PaginationParams<DailyPlan>} params
	 * @returns
	 * @memberof DailyPlanController
	 */
	@ApiOperation({
		summary: 'Remove a task from daily plan'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Task removed',
		type: DailyPlan
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No Record found'
	})
	@Put(':id')
	async removeTaskFromPlan(
		@Param('id') planId: IDailyPlan['id'],
		@Body('taskId') taskId: ITask['id'],
		@Query() params: PaginationParams<DailyPlan>
	) {
		return await this.dailyPlanService.removeTaskFromPlan(planId, taskId, params);
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
	async deletePlan(@Param('id') planId: IDailyPlan['id']) {
		return await this.dailyPlanService.deletePlan(planId);
	}
}
