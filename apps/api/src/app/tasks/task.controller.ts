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
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Task } from './task.entity';
import { CrudController, IPagination } from '../core';
import { TaskService } from './task.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionsEnum } from '@gauzy/models';
import { EmployeeService } from '../employee/employee.service';
import { RequestContext } from '../core/context';

@ApiTags('Tasks')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TaskController extends CrudController<Task> {
	constructor(
		private readonly taskService: TaskService,
		private readonly employeeService: EmployeeService
	) {
		super(taskService);
	}

	@ApiOperation({ summary: 'Find all policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: Task
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllTimeOffPolicies(
		@Query('data') data: string
	): Promise<IPagination<Task>> {
		const { relations, findInput } = JSON.parse(data);
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
	async findMyTasks(): Promise<IPagination<Task>> {
		//If user is not an employee, then this will return 404
		const employee = await this.employeeService.findOne({
			where: {
				user: { id: RequestContext.currentUser().id }
			}
		});
		return this.taskService.getMyTasks(employee.id);
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
		@Query('data') data: string
	): Promise<IPagination<Task>> {
		const { employeeId } = JSON.parse(data);
		return this.taskService.findTeamTasks(employeeId);
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
	async createTask(@Body() entity: Task): Promise<any> {
		return this.taskService.createTask(entity);
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
	async update(@Param('id') id: string, @Body() entity: Task): Promise<any> {
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
	async deleteTask(@Param('id') id: string): Promise<any> {
		return this.taskService.delete(id);
	}
}
