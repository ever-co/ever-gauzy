import { QueryBus } from '@nestjs/cqrs';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ID,
	IPagination,
	IPaginationParam,
	ITaskStatus,
	ITaskStatusCreateInput,
	ITaskStatusFindInput,
	ITaskStatusUpdateInput
} from '@gauzy/contracts';
import { TenantPermissionGuard } from './../../shared/guards';
import { CountQueryDTO } from './../../shared/dto';
import { UseValidationPipe } from '../../shared/pipes';
import { CrudFactory, BaseQueryDTO } from './../../core/crud';
import { TaskStatusService } from './status.service';
import { TaskStatus } from './status.entity';
import { FindStatusesQuery } from './queries';
import { CreateStatusDTO, StatusQueryDTO, UpdatesStatusDTO } from './dto';
import { ReorderRequestDTO } from './dto/reorder.dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task Status')
@Controller('/task-statuses')
export class TaskStatusController extends CrudFactory<
	TaskStatus,
	IPaginationParam,
	ITaskStatusCreateInput,
	ITaskStatusUpdateInput,
	ITaskStatusFindInput
>(BaseQueryDTO, CreateStatusDTO, UpdatesStatusDTO, CountQueryDTO) {
	constructor(private readonly queryBus: QueryBus, protected readonly taskStatusService: TaskStatusService) {
		super(taskStatusService);
	}

	/**
	 * Reorder records based on the given input.
	 * @param request - ReorderRequestDTO containing the reorder instructions.
	 * @returns A success message indicating that the reordering operation completed successfully.
	 */
	@ApiOperation({ summary: 'Reorder records based on given input' }) // Corrects the summary
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Reordering was successful.' // Description for successful response
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. Check your request body.' // Description for bad request
	})
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'An error occurred during reordering.' // Description for internal server error
	})
	@Patch('/reorder')
	@UseValidationPipe({ whitelist: true })
	async reorder(@Body() { reorder }: ReorderRequestDTO) {
		return await this.taskStatusService.reorder(reorder);
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
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'An error occurred during retrieving task statuses.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. Check your request body.'
	})
	@Get('/')
	@UseValidationPipe({ whitelist: true })
	async findTaskStatuses(@Query() params: StatusQueryDTO): Promise<IPagination<ITaskStatus>> {
		return await this.queryBus.execute(new FindStatusesQuery(params));
	}

	/**
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
	@ApiOperation({ summary: 'Make task status default.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Task status marked as default'
	})
	@HttpCode(HttpStatus.OK)
	@Put(':id/default')
	@UseValidationPipe({ whitelist: true })
	async markAsDefault(@Param('id') id: ID, @Body() input: UpdatesStatusDTO): Promise<ITaskStatus[]> {
		return await this.taskStatusService.markAsDefault(id, input);
	}
}
