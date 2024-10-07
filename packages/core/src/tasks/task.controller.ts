import {
	Controller,
	HttpStatus,
	Get,
	Query,
	HttpCode,
	Put,
	Param,
	Body,
	UseGuards,
	Post,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { PermissionsEnum, ITask, IPagination, ID } from '@gauzy/contracts';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { CrudController, PaginationParams } from './../core/crud';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskCreateCommand, TaskUpdateCommand } from './commands';
import { CreateTaskDTO, GetTaskByIdDTO, TaskMaxNumberQueryDTO, UpdateTaskDTO } from './dto';

@ApiTags('Tasks')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/tasks')
export class TaskController extends CrudController<Task> {
	constructor(private readonly taskService: TaskService, private readonly commandBus: CommandBus) {
		super(taskService);
	}

	/**
	 * GET task count
	 *
	 * @param options The filter options for counting tasks.
	 * @returns The total number of tasks.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/count')
	@UseValidationPipe()
	@ApiOperation({ summary: 'Get the total count of tasks.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Task count retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	async getCount(@Query() options: CountQueryDTO<Task>): Promise<number> {
		return this.taskService.countBy(options);
	}

	/**
	 * GET tasks by pagination
	 *
	 * @param params The pagination and filter parameters.
	 * @returns A paginated list of tasks.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	@ApiOperation({ summary: 'Get tasks by pagination.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	async pagination(@Query() params: PaginationParams<Task>): Promise<IPagination<ITask>> {
		return this.taskService.pagination(params);
	}

	/**
	 * GET maximum task number
	 *
	 * @param options The query options to filter the tasks by project.
	 * @returns The maximum task number for a given project.
	 */
	@ApiOperation({ summary: 'Get the maximum task number by project.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Maximum task number retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/max-number')
	@UseValidationPipe()
	async getMaxTaskNumberByProject(@Query() options: TaskMaxNumberQueryDTO): Promise<number> {
		return this.taskService.getMaxTaskNumberByProject(options);
	}

	/**
	 * GET my tasks
	 *
	 * @param params The filter and pagination options for retrieving tasks.
	 * @returns A paginated list of tasks assigned to the current user.
	 */
	@ApiOperation({ summary: 'Get tasks assigned to the current user.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/me')
	@UseValidationPipe({ transform: true })
	async findMyTasks(@Query() params: PaginationParams<Task>): Promise<IPagination<ITask>> {
		return this.taskService.getMyTasks(params);
	}

	/**
	 * GET employee tasks
	 *
	 * @param params The filter and pagination options for retrieving employee tasks.
	 * @returns A paginated list of tasks assigned to the specified employee.
	 */
	@ApiOperation({ summary: 'Get tasks assigned to a specific employee.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/employee')
	@UseValidationPipe({ transform: true })
	async findEmployeeTask(@Query() params: PaginationParams<Task>): Promise<IPagination<ITask>> {
		return this.taskService.getEmployeeTasks(params);
	}

	/**
	 * GET my team tasks
	 *
	 * @param params The filter and pagination options for retrieving team tasks.
	 * @returns A paginated list of tasks assigned to the current user's team.
	 */
	@ApiOperation({ summary: "Get tasks assigned to the current user's team." })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/team')
	@UseValidationPipe({ transform: true })
	async findTeamTasks(@Query() params: PaginationParams<Task>): Promise<IPagination<ITask>> {
		return this.taskService.findTeamTasks(params);
	}

	/**
	 * GET module tasks
	 *
	 * @param params The filter and pagination options for retrieving module tasks.
	 * @returns A paginated list of tasks by module.
	 */
	@ApiOperation({ summary: 'Get tasks by module.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/module')
	@UseValidationPipe({ transform: true })
	async findModuleTasks(@Query() params: PaginationParams<Task>): Promise<IPagination<ITask>> {
		return this.taskService.findModuleTasks(params);
	}

	/**
	 * GET task by ID
	 *
	 * @param id The ID of the task.
	 * @param params The options for task retrieval.
	 * @returns The task with the specified ID.
	 */
	@ApiOperation({ summary: 'Get task by ID.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Task retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() params: GetTaskByIdDTO): Promise<Task> {
		return this.taskService.findById(id, params);
	}

	/**
	 * GET tasks by employee
	 *
	 * @param employeeId The ID of the employee.
	 * @param params The pagination and filter parameters for tasks.
	 * @returns A list of tasks assigned to the specified employee.
	 */
	@ApiOperation({ summary: 'Get tasks assigned to a specific employee.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/employee/:id')
	@UseValidationPipe()
	async getAllTasksByEmployee(
		@Param('id') employeeId: ID,
		@Query() params: PaginationParams<Task>
	): Promise<ITask[]> {
		return this.taskService.getAllTasksByEmployee(employeeId, params);
	}

	/**
	 * GET all tasks
	 *
	 * @param params The pagination and filter parameters for retrieving tasks.
	 * @returns A paginated list of all tasks.
	 */
	@ApiOperation({ summary: 'Get all tasks.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No tasks found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Task>): Promise<IPagination<ITask>> {
		return this.taskService.findAll(params);
	}

	/**
	 * POST create a task
	 *
	 * @param entity The data for creating the task.
	 * @returns The created task.
	 */
	@ApiOperation({ summary: 'Create a new task.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The task has been successfully created.'
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTaskDTO): Promise<ITask> {
		return this.commandBus.execute(new TaskCreateCommand(entity));
	}

	/**
	 * PUT update an existing task
	 *
	 * @param id The ID of the task to update.
	 * @param entity The data for updating the task.
	 * @returns The updated task.
	 */
	@ApiOperation({ summary: 'Update an existing task.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The task has been successfully updated.'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateTaskDTO): Promise<ITask> {
		return this.commandBus.execute(new TaskUpdateCommand(id, entity));
	}

	/**
	 * DELETE task by ID
	 *
	 * @param id The ID of the task to delete.
	 * @returns The result of the deletion.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	@Delete('/:id')
	@ApiOperation({ summary: 'Delete a task by ID.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The task has been successfully deleted.'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.taskService.delete(id);
	}

	/**
	 * DELETE employee from team tasks
	 *
	 * Unassigns an employee from tasks associated with a specific organization team.
	 *
	 * @param employeeId The ID of the employee to be unassigned from tasks.
	 * @param organizationTeamId The ID of the organization team from which to unassign the employee.
	 * @returns A Promise that resolves with the result of the unassignment.
	 */
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Delete('/employee/:employeeId')
	@UseValidationPipe({ whitelist: true })
	async deleteEmployeeFromTasks(
		@Param('employeeId', UUIDValidationPipe) employeeId: ID,
		@Query('organizationTeamId', UUIDValidationPipe) organizationTeamId: ID
	): Promise<void> {
		return this.taskService.unassignEmployeeFromTeamTasks(employeeId, organizationTeamId);
	}
}
