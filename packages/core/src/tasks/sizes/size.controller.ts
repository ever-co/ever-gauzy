import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IPagination,
	IPaginationParam,
	ITaskSize,
	ITaskSizeCreateInput,
	ITaskSizeFindInput,
	ITaskSizeUpdateInput
} from '@gauzy/contracts';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { CountQueryDTO } from './../../shared/dto';
import { TenantPermissionGuard } from './../../shared/guards';
import { TaskSizeService } from './size.service';
import { TaskSize } from './size.entity';
import { CreateTaskSizeDTO, TaskSizeQuerDTO, UpdateTaskSizeDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task Size')
@Controller()
export class TaskSizeController extends CrudFactory<
	TaskSize,
	IPaginationParam,
	ITaskSizeCreateInput,
	ITaskSizeUpdateInput,
	ITaskSizeFindInput
>(PaginationParams, CreateTaskSizeDTO, UpdateTaskSizeDTO, CountQueryDTO) {
	constructor(protected readonly taskSizeService: TaskSizeService) {
		super(taskSizeService);
	}

	/**
	 * GET task sizes by filters
	 * If parameters not match, retrieve global task sizes
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find task sizes by filters.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task sizes by filters.'
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findTaskSizes(@Query() params: TaskSizeQuerDTO): Promise<IPagination<ITaskSize>> {
		return await this.taskSizeService.findTaskSizes(params);
	}
}
