import { QueryBus } from '@nestjs/cqrs';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Put, Query, UseGuards, Delete, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ID,
	IPagination,
	IPaginationParam,
	ITaskStatus,
	ITaskStatusCreateInput,
	ITaskStatusFindInput,
	ITaskStatusUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { TenantPermissionGuard, PermissionGuard } from './../../shared/guards';
import { CountQueryDTO } from './../../shared/dto';
import { UseValidationPipe, AbstractValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { CrudFactory, BaseQueryDTO } from './../../core/crud';
import { TaskStatusService } from './status.service';
import { TaskStatus } from './status.entity';
import { FindStatusesQuery } from './queries';
import { CreateStatusDTO, StatusQueryDTO, UpdatesStatusDTO } from './dto';
import { ReorderRequestDTO } from './dto/reorder.dto';
import { Permissions } from '../../shared/decorators';
import { TenantOrganizationBaseDTO } from '../../core/dto';

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

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudFactory.softRemove()` route only to attach a permission. The base declares the
	 * route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of
	 * the tenant could retire the row. It now states `ORG_TASK_SETTING`: the task-settings grant
	 * (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskStatus> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudFactory.softRecover()` route only to attach a permission. The base declares the
	 * route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of
	 * the tenant could restore the row. It now states `ORG_TASK_SETTING`: the task-settings grant
	 * (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskStatus> {
		return await super.softRecover(id, ...options);
	}
}
