import { Controller, UseGuards, } from '@nestjs/common';
import { TenantPermissionGuard } from './../../shared/guards';
import { CrudController } from './../../core/crud';
import { TaskSizeService } from './size.service';
import { TaskSize } from './size.entity';

@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskSizeController extends CrudController<TaskSize> {

	constructor(
		protected readonly taskSizeService: TaskSizeService
	) {
		super(taskSizeService)
	}
}
