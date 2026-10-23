import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards, Delete, Param, Put, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IPagination,
	IPaginationParam,
	ITaskPriority,
	ITaskPriorityCreateInput,
	ITaskPriorityFindInput,
	ITaskPriorityUpdateInput,
	ID,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudFactory, BaseQueryDTO } from '../../core/crud';
import { TenantPermissionGuard, PermissionGuard } from '../../shared/guards';
import { CountQueryDTO } from '../../shared/dto';
import { UseValidationPipe, AbstractValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { TaskPriority } from './priority.entity';
import { TaskPriorityService } from './priority.service';
import { CreateTaskPriorityDTO, TaskPriorityQueryDTO, UpdateTaskPriorityDTO } from './dto';
import { Permissions } from '../../shared/decorators';
import { TenantOrganizationBaseDTO } from '../../core/dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task Priority')
@Controller('/task-priorities')
export class TaskPriorityController extends CrudFactory<
	TaskPriority,
	IPaginationParam,
	ITaskPriorityCreateInput,
	ITaskPriorityUpdateInput,
	ITaskPriorityFindInput
>(BaseQueryDTO, CreateTaskPriorityDTO, UpdateTaskPriorityDTO, CountQueryDTO) {
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
	@UseValidationPipe({ whitelist: true })
	async fetchAll(@Query() params: TaskPriorityQueryDTO): Promise<IPagination<ITaskPriority>> {
		return await this.taskPriorityService.fetchAll(params);
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskPriority> {
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskPriority> {
		return await super.softRecover(id, ...options);
	}
}
