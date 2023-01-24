import { Controller, UseGuards } from '@nestjs/common';
import { TenantPermissionGuard } from './../../shared/guards';
import { CrudController } from './../../core/crud';
import { TaskPriorityService } from './priority.service';
import { TaskPriority } from './priority.entity';

@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskPriorityController extends CrudController<TaskPriority> {

	constructor(
		protected readonly taskPriorityService: TaskPriorityService
	) {
		super(taskPriorityService)
	}
}
