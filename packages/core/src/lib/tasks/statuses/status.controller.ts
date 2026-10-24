import { QueryBus } from '@nestjs/cqrs';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Put,
	Query,
	UseGuards,
	Delete,
	UsePipes,
	Post
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeepPartial, DeleteResult, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
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
import { TenantPermissionGuard } from './../../shared/guards';
import { TaskSettingPermissionGuard, TaskSettingWrite } from '../task-setting-access';
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

/**
 * Every write states `ORG_TASK_SETTING` behind `TaskSettingPermissionGuard`: the grant's holders write every row, as
 * `PermissionGuard` decides it, and a manager of a team may also write the rows of that team (`organizationTeamId`
 * set) without it, as Ever Teams' team settings do (owner decision 2(b), 2026-10-23). `@TaskSettingWrite` tells the
 * guard how each write names its rows.
 */
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
	 *
	 * Rewrites the board's column order of the organization's statuses, so it states `ORG_TASK_SETTING`, the grant
	 * every other write of a status states; with no permission metadata `PermissionGuard` answers `true`, and any
	 * member of the tenant could reorder them (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
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
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(TaskStatusService, 'reorder')
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
	 * Makes a status the default of its scope, clearing the mark from the others.
	 *
	 * States `ORG_TASK_SETTING`, the grant every other write of a status states; with no permission metadata
	 * `PermissionGuard` answers `true`, and any member of the tenant could change the default
	 * (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
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
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(TaskStatusService, 'markAsDefault')
	@Put(':id/default')
	@UseValidationPipe({ whitelist: true })
	async markAsDefault(@Param('id') id: ID, @Body() input: UpdatesStatusDTO): Promise<ITaskStatus[]> {
		return await this.taskStatusService.markAsDefault(id, input);
	}

	/**
	 * Creates a record.
	 *
	 * Overrides the inherited `CrudFactory.create()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could add a task status in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param entity The record to create, validated against `CreateStatusDTO`.
	 * @returns The created record.
	 */
	@ApiOperation({ summary: 'Create new record.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(TaskStatusService, 'create')
	@Post()
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: CreateStatusDTO }))
	async create(@Body() entity: DeepPartial<TaskStatus>): Promise<TaskStatus> {
		return await super.create(entity);
	}

	/**
	 * Updates a record by id.
	 *
	 * Overrides the inherited `CrudFactory.update()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could change a task status in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param id The record to update.
	 * @param entity The changes, validated against `UpdatesStatusDTO`.
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
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(TaskStatusService, 'update')
	@Put(':id')
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: UpdatesStatusDTO }))
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<TaskStatus>
	): Promise<TaskStatus | UpdateResult> {
		return await super.update(id, entity);
	}

	/**
	 * Deletes a record by id.
	 *
	 * Overrides the inherited `CrudFactory.delete()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could remove a task status in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param id The record to delete.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete record.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(TaskStatusService, 'stored')
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
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(TaskStatusService, 'stored')
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
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(TaskStatusService, 'stored')
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskStatus> {
		return await super.softRecover(id, ...options);
	}
}
