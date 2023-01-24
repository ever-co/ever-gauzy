import { Controller, UseGuards, } from '@nestjs/common';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IPaginationParam,
	ITaskSizeCreateInput,
	ITaskSizeUpdateInput
} from '@gauzy/contracts';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { CountQueryDTO } from './../../shared/dto';
import { TenantPermissionGuard } from './../../shared/guards';
import { TaskSizeService } from './size.service';
import { TaskSize } from './size.entity';

@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskSizeController extends
	CrudFactory<TaskSize, ITaskSizeCreateInput, ITaskSizeUpdateInput, IPaginationParam, IBasePerTenantAndOrganizationEntityModel>(
		TaskSize,
		TaskSize,
		PaginationParams,
		CountQueryDTO
	) {

	constructor(
		protected readonly taskSizeService: TaskSizeService
	) {
		super(taskSizeService)
	}
}
