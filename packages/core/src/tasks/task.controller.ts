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
	Delete,
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import {
	PermissionsEnum,
	ITask,
	IPagination,
	IEmployee
} from '@gauzy/contracts';
import { UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { CrudController, PaginationParams } from './../core/crud';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskCreateCommand, TaskUpdateCommand } from './commands';
import { CreateTaskDTO, TaskMaxNumberQueryDTO, UpdateTaskDTO } from './dto';

@ApiTags('Tasks')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class TaskController extends CrudController<Task> {
	constructor(
		private readonly taskService: TaskService,
		private readonly commandBus: CommandBus
	) {
		super(taskService);
	}

	/**
	 * GET task count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('count')
	@UsePipes(new ValidationPipe())
	async getCount(@Query() options: CountQueryDTO<Task>): Promise<number> {
		return await this.taskService.countBy(options);
	}

	/**
	 * GET tasks by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() params: PaginationParams<Task>
	): Promise<IPagination<ITask>> {
		return await this.taskService.pagination(params);
	}

	/**
	 * GET maximum task number
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find maximum task number.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found maximum task number',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('max-number')
	@UsePipes(new ValidationPipe())
	async getMaxTaskNumberByProject(
		@Query() options: TaskMaxNumberQueryDTO
	): Promise<number> {
		return await this.taskService.getMaxTaskNumberByProject(options);
	}

	/**
	 * GET my tasks
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find my tasks.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tasks',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('me')
	@UsePipes(new ValidationPipe({ transform: true }))
	async findMyTasks(
		@Query() params: PaginationParams<Task>
	): Promise<IPagination<ITask>> {
		return await this.taskService.getMyTasks(params);
	}

	/**
	 * GET employee tasks
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find employee tasks.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tasks',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('employee')
	@UsePipes(new ValidationPipe({ transform: true }))
	async findEmployeeTask(
		@Query() params: PaginationParams<Task>
	): Promise<IPagination<ITask>> {
		return await this.taskService.getEmployeeTasks(params);
	}

	/**
	 * GET my team tasks
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find my team tasks.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tasks',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('team')
	@UsePipes(new ValidationPipe({ transform: true }))
	async findTeamTasks(
		@Query() params: PaginationParams<Task>
	): Promise<IPagination<ITask>> {
		return await this.taskService.findTeamTasks(params);
	}

	/**
	 * GET tasks by employee
	 *
	 * @param employeeId
	 * @param findInput
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find Employee Task.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Employee Task',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('employee/:id')
	@UsePipes(new ValidationPipe())
	async getAllTasksByEmployee(
		@Param('id') employeeId: IEmployee['id'],
		@Query() params: PaginationParams<Task>
	): Promise<ITask[]> {
		return await this.taskService.getAllTasksByEmployee(employeeId, params);
	}

	@ApiOperation({ summary: 'Find all tasks.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tasks',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<Task>
	): Promise<IPagination<ITask>> {
		return await this.taskService.findAll(params);
	}

	@ApiOperation({ summary: 'create a task' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async create(
		@Body() entity: CreateTaskDTO
	): Promise<ITask> {
		return await this.commandBus.execute(
			new TaskCreateCommand(entity)
		);
	}

	@ApiOperation({ summary: 'Update an existing task' })
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put(':id')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: ITask['id'],
		@Body() entity: UpdateTaskDTO
	): Promise<ITask> {
		return await this.commandBus.execute(
			new TaskUpdateCommand(id, entity)
		);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: ITask['id']
	): Promise<DeleteResult> {
		return await this.taskService.delete(id);
	}
}
