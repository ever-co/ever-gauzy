import { QueryBus } from '@nestjs/cqrs';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IPagination,
	IPaginationParam,
	ITaskStatus,
	ITaskStatusCreateInput,
	ITaskStatusFindInput,
	ITaskStatusUpdateInput
} from '@gauzy/contracts';
import { TenantPermissionGuard } from './../../shared/guards';
import { CountQueryDTO } from './../../shared/dto';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { TaskStatusService } from './status.service';
import { TaskStatus } from './status.entity';
import { FindStatusesQuery } from './queries';
import { CreateStatusDTO, StatusQuerDTO, UpdatesStatusDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task Status')
@Controller()
export class TaskStatusController extends CrudFactory<
	TaskStatus,
	ITaskStatusCreateInput,
	ITaskStatusUpdateInput,
	IPaginationParam,
	ITaskStatusFindInput
>(
	CreateStatusDTO,
	UpdatesStatusDTO,
	PaginationParams,
	CountQueryDTO
) {
	constructor(
		private readonly queryBus: QueryBus,
		protected readonly taskStatusService: TaskStatusService
	) {
		super(taskStatusService);
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find task statuses by filters.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task statuses by filters.'
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findTaskStatuses(
		@Query() params: StatusQuerDTO
	): Promise<IPagination<ITaskStatus>> {
		return await this.queryBus.execute(new FindStatusesQuery(params));
	}
}
