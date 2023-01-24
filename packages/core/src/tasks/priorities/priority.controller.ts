import { Controller, UseGuards } from '@nestjs/common';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IPaginationParam,
	ITaskPriorityCreateInput,
	ITaskPriorityUpdateInput
} from '@gauzy/contracts';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { TenantPermissionGuard } from './../../shared/guards';
import { CountQueryDTO } from './../../shared/dto';
import { TaskPriority } from './priority.entity';
import { TaskPriorityService } from './priority.service';

@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskPriorityController extends
	CrudFactory<TaskPriority, ITaskPriorityCreateInput, ITaskPriorityUpdateInput, IPaginationParam, IBasePerTenantAndOrganizationEntityModel>(
		TaskPriority,
		TaskPriority,
		PaginationParams,
		CountQueryDTO
	) {

	constructor(
		protected readonly taskPriorityService: TaskPriorityService
	) {
		super(taskPriorityService)
	}
}
