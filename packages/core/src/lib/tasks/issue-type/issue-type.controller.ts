import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
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
	IIssueType,
	IIssueTypeCreateInput,
	IIssueTypeFindInput,
	IIssueTypeUpdateInput,
	IPagination,
	IPaginationParam,
	ID,
	PermissionsEnum
} from '@gauzy/contracts';
import { CountQueryDTO } from '../../shared/dto';
import { UseValidationPipe, AbstractValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { TenantPermissionGuard } from '../../shared/guards';
import { TaskSettingPermissionGuard, TaskSettingWrite } from '../task-setting-access';
import { CrudFactory, BaseQueryDTO } from './../../core/crud';
import { IssueType } from './issue-type.entity';
import { IssueTypeService } from './issue-type.service';
import { CreateIssueTypeDTO, IssueTypeQueryDTO, UpdateIssueTypeDTO } from './dto';
import { Permissions } from '../../shared/decorators';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Every write states `ORG_TASK_SETTING` behind `TaskSettingPermissionGuard`: the grant's holders write every row, as
 * `PermissionGuard` decides it, and a manager of a team may also write the rows of that team (`organizationTeamId`
 * set) without it, as Ever Teams' team settings do (owner decision 2(b), 2026-10-23). `@TaskSettingWrite` tells the
 * guard how each write names its rows.
 */
@UseGuards(TenantPermissionGuard)
@ApiTags('Issue Type')
@Controller('/issue-types')
export class IssueTypeController extends CrudFactory<
	IssueType,
	IPaginationParam,
	IIssueTypeCreateInput,
	IIssueTypeUpdateInput,
	IIssueTypeFindInput
>(BaseQueryDTO, CreateIssueTypeDTO, UpdateIssueTypeDTO, CountQueryDTO) {
	constructor(protected readonly issueTypeService: IssueTypeService) {
		super(issueTypeService);
	}

	/**
	 * Makes an issue type the default of its scope, clearing the mark from the others.
	 *
	 * States `ORG_TASK_SETTING`, the grant every other write of an issue type states; with no permission metadata
	 * `PermissionGuard` answers `true`, and any member of the tenant could change the default
	 * (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
	@ApiOperation({ summary: 'Make issue type default.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Task issue type marked as default'
	})
	@HttpCode(HttpStatus.OK)
	@UseGuards(TaskSettingPermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@TaskSettingWrite(IssueTypeService, 'markAsDefault')
	@Put(':id/default')
	@UseValidationPipe({ whitelist: true })
	async markAsDefault(@Param('id') id: IIssueType['id'], @Body() input: UpdateIssueTypeDTO): Promise<IIssueType[]> {
		return await this.issueTypeService.markAsDefault(id, input);
	}

	/**
	 * GET issue types by filters
	 * If parameters not match, retrieve global task sizes
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find issue types by filters.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task issue type by filters.'
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UseValidationPipe({ whitelist: true })
	async findAllIssueTypes(@Query() params: IssueTypeQueryDTO): Promise<IPagination<IIssueType>> {
		return await this.issueTypeService.fetchAll(params);
	}

	/**
	 * Creates a record.
	 *
	 * Overrides the inherited `CrudFactory.create()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could add an issue type in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param entity The record to create, validated against `CreateIssueTypeDTO`.
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
	@TaskSettingWrite(IssueTypeService, 'create')
	@Post()
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: CreateIssueTypeDTO }))
	async create(@Body() entity: DeepPartial<IssueType>): Promise<IssueType> {
		return await super.create(entity);
	}

	/**
	 * Updates a record by id.
	 *
	 * Overrides the inherited `CrudFactory.update()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could change an issue type in the organization's task settings. It now states `ORG_TASK_SETTING`: the
	 * task-settings grant (GHSA-v79w-54p2-wmh5; owner decision 2, 2026-10-22).
	 *
	 * @param id The record to update.
	 * @param entity The changes, validated against `UpdateIssueTypeDTO`.
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
	@TaskSettingWrite(IssueTypeService, 'update')
	@Put(':id')
	@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: UpdateIssueTypeDTO }))
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<IssueType>
	): Promise<IssueType | UpdateResult> {
		return await super.update(id, entity);
	}

	/**
	 * Deletes a record by id.
	 *
	 * Overrides the inherited `CrudFactory.delete()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could remove an issue type in the organization's task settings. It now states `ORG_TASK_SETTING`: the
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
	@TaskSettingWrite(IssueTypeService, 'stored')
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
	@TaskSettingWrite(IssueTypeService, 'stored')
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<IssueType> {
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
	@TaskSettingWrite(IssueTypeService, 'stored')
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<IssueType> {
		return await super.softRecover(id, ...options);
	}
}
