import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Task } from './task.entity';
import { CrudController, IPagination } from '../core';
import { TaskService } from './task.service';
import { Task as ITask } from '@gauzy/models';

@ApiTags('Tasks')
@Controller()
export class TaskController extends CrudController<Task> {
	constructor(private readonly taskService: TaskService) {
		super(taskService);
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
	async findAllTasks(): Promise<IPagination<ITask>> {
		return this.taskService.getAllTasks();
	}
}
