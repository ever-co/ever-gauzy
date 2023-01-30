import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
@ApiTags('Task Priority')
@Controller()
export class TaskPriorityController extends CrudFactory<
	TaskPriority,
	IPaginationParam,
	ITaskPriorityCreateInput,
	ITaskPriorityUpdateInput,
	ITaskPriorityFindInput
>(PaginationParams, CreateTaskPriorityDTO, UpdateTaskPriorityDTO, CountQueryDTO) {
	constructor(protected readonly taskPriorityService: TaskPriorityService) {
		super(taskPriorityService);
	}

	/**
	 * GET task priorities by filters
	 * If parameters not match, retrieve global task priorities
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find task priorities by filters.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task priorities by filters.'
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findTaskPriorities(@Query() params: TaskPriorityQuerDTO): Promise<IPagination<ITaskPriority>> {
		return await this.taskPriorityService.findTaskPriorities(params);
	}
}
