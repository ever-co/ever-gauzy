import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Task } from './task.entity';
import { CrudController, IPagination } from '../core';
import { TaskService } from './task.service';

@ApiTags('Tasks')
@Controller()
export class TaskController extends CrudController<Task> {
	constructor(private readonly taskService: TaskService) {
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
}
