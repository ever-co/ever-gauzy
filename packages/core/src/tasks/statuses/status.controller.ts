import { QueryBus } from '@nestjs/cqrs';
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
		super(taskStatusService)
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findAllStatuses(
		@Query() params: StatusQuerDTO
	): Promise<IPagination<ITaskStatus>> {
		return await this.queryBus.execute(
			new FindStatusesQuery(params)
		);
	}
}
