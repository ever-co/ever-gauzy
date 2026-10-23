import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Query,
	UseGuards,
	Delete,
	Param,
	Put,
	UsePipes,
	Body,
	Post
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeepPartial, DeleteResult, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
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
	 * Creates a record.
	 *
	 * Overrides the inherited `CrudFactory.create()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could add a task priority in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param entity The record to create, validated against `CreateTaskPriorityDTO`.
	 * @returns The created record.
	 */
	@ApiOperation({ summary: 'Create new record.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@Post()
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: CreateTaskPriorityDTO }))
	async create(@Body() entity: DeepPartial<TaskPriority>): Promise<TaskPriority> {
		return await super.create(entity);
	}

	/**
	 * Updates a record by id.
	 *
	 * Overrides the inherited `CrudFactory.update()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could change a task priority in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param id The record to update.
	 * @param entity The changes, validated against `UpdateTaskPriorityDTO`.
	 * @returns The updated record.
	 */
	@ApiOperation({ summary: 'Update an existing record.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully edited.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@Put(':id')
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: UpdateTaskPriorityDTO }))
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<TaskPriority>
	): Promise<TaskPriority | UpdateResult> {
		return await super.update(id, entity);
	}

	/**
	 * Deletes a record by id.
	 *
	 * Overrides the inherited `CrudFactory.delete()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could remove a task priority in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param id The record to delete.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete record.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await super.delete(id);
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
