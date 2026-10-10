import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards, Delete, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { TenantPermissionGuard, PermissionGuard } from '../../shared/guards';
import { CrudFactory, BaseQueryDTO } from './../../core/crud';
import { IssueType } from './issue-type.entity';
import { IssueTypeService } from './issue-type.service';
import { CreateIssueTypeDTO, IssueTypeQueryDTO, UpdateIssueTypeDTO } from './dto';
import { Permissions } from '../../shared/decorators';
import { TenantOrganizationBaseDTO } from '../../core/dto';

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_SETTING)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<IssueType> {
		return await super.softRecover(id, ...options);
	}
}
