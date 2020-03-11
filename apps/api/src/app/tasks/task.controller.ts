import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Task } from './task.entity';
import { CrudController } from '../core';
import { TaskService } from './task.service';

@ApiTags('Tasks')
@Controller()
export class TaskController extends CrudController<Task> {
	constructor(private readonly taskService: TaskService) {
		super(taskService);
	}
}
