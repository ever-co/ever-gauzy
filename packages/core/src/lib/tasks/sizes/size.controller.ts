import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards, Delete, Param, Put, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IPagination,
	IPaginationParam,
	ITaskSize,
	ITaskSizeCreateInput,
	ITaskSizeFindInput,
	ITaskSizeUpdateInput,
	ID,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudFactory, BaseQueryDTO } from '../../core/crud';
import { CountQueryDTO } from '../../shared/dto';
import { TenantPermissionGuard, PermissionGuard } from '../../shared/guards';
import { UseValidationPipe, AbstractValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { TaskSizeService } from './size.service';
import { TaskSize } from './size.entity';
import { CreateTaskSizeDTO, TaskSizeQueryDTO, UpdateTaskSizeDTO } from './dto';
import { Permissions } from '../../shared/decorators';
import { TenantOrganizationBaseDTO } from '../../core/dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task Size')
@Controller('/task-sizes')
export class TaskSizeController extends CrudFactory<
	TaskSize,
	IPaginationParam,
	ITaskSizeCreateInput,
	ITaskSizeUpdateInput,
	ITaskSizeFindInput
>(BaseQueryDTO, CreateTaskSizeDTO, UpdateTaskSizeDTO, CountQueryDTO) {
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
	@UseValidationPipe({ whitelist: true })
	async fetchAll(@Query() params: TaskSizeQueryDTO): Promise<IPagination<ITaskSize>> {
		return await this.taskSizeService.fetchAll(params);
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskSize> {
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskSize> {
		return await super.softRecover(id, ...options);
	}
}
