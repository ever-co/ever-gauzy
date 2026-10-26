import { QueryBus } from '@nestjs/cqrs';
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
	ITaskRelatedIssueType,
	ITaskRelatedIssueTypeCreateInput,
	ITaskRelatedIssueTypeFindInput,
	ITaskRelatedIssueTypeUpdateInput,
	ID,
	PermissionsEnum
} from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { TaskSettingPermissionGuard, TaskSettingWrite } from '../task-setting-access';
import { CountQueryDTO } from '../../shared/dto';
import { UseValidationPipe, AbstractValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { CrudFactory, BaseQueryDTO } from '../../core/crud';
import { TaskRelatedIssueTypeService } from './related-issue-type.service';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { FindRelatedIssueTypesQuery } from './queries';
import { CreateRelatedIssueTypeDTO, RelatedIssueTypeQueryDTO, UpdatesRelatedIssueTypeDTO } from './dto';
import { Permissions } from '../../shared/decorators';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Every write states `ORG_TASK_SETTING` behind `TaskSettingPermissionGuard`: the grant's holders write every row, as
 * `PermissionGuard` decides it, and a manager of a team may also write the rows of that team (`organizationTeamId`
 * set) without it, as Ever Teams' team settings do (owner decision 2(b), 2026-10-23). `@TaskSettingWrite` tells the
 * guard how each write names its rows.
 */
@UseGuards(TenantPermissionGuard)
@ApiTags('Task RelatedIssueTypes')
@Controller('/task-related-issue-types')
export class TaskRelatedIssueTypeController extends CrudFactory<
	TaskRelatedIssueType,
	IPaginationParam,
	ITaskRelatedIssueTypeCreateInput,
	ITaskRelatedIssueTypeUpdateInput,
	ITaskRelatedIssueTypeFindInput
>(BaseQueryDTO, CreateRelatedIssueTypeDTO, UpdatesRelatedIssueTypeDTO, CountQueryDTO) {
	constructor(
		private readonly queryBus: QueryBus,
		protected readonly TaskRelatedIssueTypeService: TaskRelatedIssueTypeService
	) {
		super(TaskRelatedIssueTypeService);
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
	@UseValidationPipe({ whitelist: true })
	async findTaskRelatedIssueType(
		@Query() params: RelatedIssueTypeQueryDTO
	): Promise<IPagination<ITaskRelatedIssueType>> {
		return await this.queryBus.execute(new FindRelatedIssueTypesQuery(params));
	}

	/**
	 * Creates a record.
	 *
	 * Overrides the inherited `CrudFactory.create()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could add a related-issue type in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param entity The record to create, validated against `CreateRelatedIssueTypeDTO`.
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
	@TaskSettingWrite(TaskRelatedIssueTypeService, 'create')
	@Post()
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: CreateRelatedIssueTypeDTO }))
	async create(@Body() entity: DeepPartial<TaskRelatedIssueType>): Promise<TaskRelatedIssueType> {
		return await super.create(entity);
	}

	/**
	 * Updates a record by id.
	 *
	 * Overrides the inherited `CrudFactory.update()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could change a related-issue type in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param id The record to update.
	 * @param entity The changes, validated against `UpdatesRelatedIssueTypeDTO`.
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
	@TaskSettingWrite(TaskRelatedIssueTypeService, 'update')
	@Put(':id')
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: UpdatesRelatedIssueTypeDTO }))
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<TaskRelatedIssueType>
	): Promise<TaskRelatedIssueType | UpdateResult> {
		return await super.update(id, entity);
	}

	/**
	 * Deletes a record by id.
	 *
	 * Overrides the inherited `CrudFactory.delete()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could remove a related-issue type in the organization's task settings. It now states `ORG_TASK_SETTING`: the
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
	@TaskSettingWrite(TaskRelatedIssueTypeService, 'stored')
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
	@TaskSettingWrite(TaskRelatedIssueTypeService, 'stored')
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskRelatedIssueType> {
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
	@TaskSettingWrite(TaskRelatedIssueTypeService, 'stored')
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TaskRelatedIssueType> {
		return await super.softRecover(id, ...options);
	}
}
