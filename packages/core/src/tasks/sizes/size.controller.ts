import {
	Controller,
	Get,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import {
	IPagination,
	IPaginationParam,
	ITaskSize,
	ITaskSizeCreateInput,
	ITaskSizeFindInput,
	ITaskSizeUpdateInput,
} from '@gauzy/contracts';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { CountQueryDTO } from './../../shared/dto';
import { TenantPermissionGuard } from './../../shared/guards';
import { TaskSizeService } from './size.service';
import { TaskSize } from './size.entity';
import { CreateTaskSizeDTO, TaskSizeQuerDTO, UpdateTaskSizeDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskSizeController extends CrudFactory<
	TaskSize,
	ITaskSizeCreateInput,
	ITaskSizeUpdateInput,
	IPaginationParam,
	ITaskSizeFindInput
>(CreateTaskSizeDTO, UpdateTaskSizeDTO, PaginationParams, CountQueryDTO) {
	constructor(protected readonly taskSizeService: TaskSizeService) {
		super(taskSizeService);
	}

	/**
	 * GET task sizes by filters
	 *
	 * @param params
	 * @returns
	 */
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findTaskSizes(
		@Query() params: TaskSizeQuerDTO
	): Promise<IPagination<ITaskSize>> {
		return await this.taskSizeService.findTaskSizes(params);
	}
}
