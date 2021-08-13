import {
	Controller,
	HttpStatus,
	Get,
	Query,
	HttpCode,
	Put,
	Param,
	Body,
	BadRequestException,
	UseGuards,
	Post,
	Delete,
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Task } from './task.entity';
import { CrudController, PaginationParams } from '../core';
import { TaskService } from './task.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import {
	PermissionsEnum,
	IGetTaskByEmployeeOptions,
	ITask,
	ITaskUpdateInput,
	ITaskCreateInput,
	IPagination
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CommandBus } from '@nestjs/cqrs';
import { TaskCreateCommand } from './commands';

@ApiTags('Tasks')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskController extends CrudController<Task> {
	constructor(
		private readonly taskService: TaskService,
		private readonly commandBus: CommandBus
	) {
		super(taskService);
	}

	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<ITask>
	): Promise<IPagination<ITask>> {
		return this.taskService.pagination(filter);
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
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ITask>> {
		const { relations, findInput } = data;
		return this.taskService.findAll({
			where: findInput,
			relations
		});
	}

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
	@Get('me')
	async findMyTasks(
		@Query() data: any
	): Promise<IPagination<ITask>> {
		return this.taskService.getMyTasks(data);
	}

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
	@Get('team')
	async findTeamTasks(
		@Query() data: any
	): Promise<IPagination<ITask>> {
		return this.taskService.findTeamTasks(data);
	}

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
	@Get('employee/:id')
	async getAllTasksByEmployee(
		@Param('id') employeeId: string,
		@Body() findInput: IGetTaskByEmployeeOptions
	): Promise<ITask[]> {
		return this.taskService.getAllTasksByEmployee(employeeId, findInput);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_TASK_EDIT)
	@Post()
	async create(@Body() entity: ITaskCreateInput): Promise<ITask> {
		return await this.commandBus.execute(
			new TaskCreateCommand({
				...entity,
				creator: RequestContext.currentUser()
			})
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_TASK_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ITaskUpdateInput
	): Promise<ITask> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return await this.taskService.create({
				id,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_TASK_EDIT)
	@Delete(':id')
	async deleteTask(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.taskService.delete(id);
	}
}
