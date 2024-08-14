import { QueryBus } from '@nestjs/cqrs';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { UseValidationPipe } from '../../shared/pipes';
import { CrudFactory, PaginationParams } from './../../core/crud';
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
>(PaginationParams, CreateStatusDTO, UpdatesStatusDTO, CountQueryDTO) {
	constructor(private readonly queryBus: QueryBus, protected readonly taskStatusService: TaskStatusService) {
		super(taskStatusService);
	}

	/**
	 * Create task status
	 *
	 * @param entity - object that contains the input values and template to be used
	 * @returns - a promise that resolves after task status created
	 */
	@ApiOperation({ summary: 'Create new task status.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Task status has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateStatusDTO): Promise<ITaskStatus> {
		return await this.taskStatusService.createStatus(entity);
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
}
