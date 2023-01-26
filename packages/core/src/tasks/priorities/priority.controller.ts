import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
	IPagination,
	IPaginationParam,
	ITaskPriority,
	ITaskPriorityCreateInput,
	ITaskPriorityFindInput,
	ITaskPriorityUpdateInput
} from '@gauzy/contracts';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { TenantPermissionGuard } from './../../shared/guards';
import { CountQueryDTO } from './../../shared/dto';
import { TaskPriority } from './priority.entity';
import { TaskPriorityService } from './priority.service';
import { CreateTaskPriorityDTO, TaskPriorityQuerDTO, UpdateTaskPriorityDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@Controller()
export class TaskPriorityController extends CrudFactory<
	TaskPriority,
	ITaskPriorityCreateInput,
	ITaskPriorityUpdateInput,
	IPaginationParam,
	ITaskPriorityFindInput
>(
	CreateTaskPriorityDTO,
	UpdateTaskPriorityDTO,
	PaginationParams,
	CountQueryDTO
) {

	constructor(
		protected readonly taskPriorityService: TaskPriorityService
	) {
		super(taskPriorityService)
	}

	/**
	 * GET task priorities by filters
	 *
	 * @param params
	 * @returns
	 */
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findTaskPriorities(
		@Query() params: TaskPriorityQuerDTO
	): Promise<IPagination<ITaskPriority>> {
		return await this.taskPriorityService.findTaskPriorities(params);
	}
}
