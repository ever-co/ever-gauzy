import { CrudController } from './../core/crud';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalService } from './request-approval.service';
import {
	IRequestApproval,
	PermissionsEnum,
	IRequestApprovalCreateInput,
	RequestApprovalStatusTypesEnum,
	IPagination,
	ID
} from '@gauzy/contracts';
import { Query, HttpStatus, UseGuards, Get, Post, Body, HttpCode, Put, Param, Controller, Delete, UsePipes } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { RequestApprovalStatusCommand } from './commands';
import { ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('RequestApproval')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/request-approval')
export class RequestApprovalController extends CrudController<RequestApproval> {
	constructor(
		private readonly requestApprovalService: RequestApprovalService,
		private readonly commandBus: CommandBus
	) {
		super(requestApprovalService);
	}

	/**
	 * GET all request approval by employee
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	@Get('employee/:id')
	findRequestApprovalsByEmployeeId(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IRequestApproval>> {
		const { relations, findInput } = data;
		return this.requestApprovalService.findRequestApprovalsByEmployeeId(id, relations, findInput);
	}

	/**
	 * UPDATE employee accept request approval
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'employee accept request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put('approval/:id')
	async employeeApprovalRequestApproval(@Param('id', UUIDValidationPipe) id: string): Promise<IRequestApproval> {
		return await this.commandBus.execute(
			new RequestApprovalStatusCommand(id, RequestApprovalStatusTypesEnum.APPROVED)
		);
	}

	/**
	 * UPDATE employee refuse request approval
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'employee refuse request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put('refuse/:id')
	async employeeRefuseRequestApproval(@Param('id', UUIDValidationPipe) id: string): Promise<IRequestApproval> {
		return await this.commandBus.execute(
			new RequestApprovalStatusCommand(id, RequestApprovalStatusTypesEnum.REFUSED)
		);
	}

	/**
	 * GET all request approvals
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all request approvals.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	@Get()
	findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IRequestApproval>> {
		/*
		 * The list can be asked for without the `?data=` envelope, and it has to be: a caller reading the
		 * register — the purchase-order flow, an approver's own screen — asks for the collection, not for
		 * a query document. Destructuring the parameter directly answered `500 Cannot destructure property
		 * 'organizationId' of 'findInput' as it is undefined` for exactly that request, so an unstated
		 * envelope now means "no filter, no relations" rather than a crash.
		 */
		const { relations = [], findInput = {} } = data ?? {};

		return this.requestApprovalService.findAllRequestApprovals({ relations }, findInput);
	}

	/**
	 * CREATE request approval
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'create a request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Post()
	async create(@Body() entity: IRequestApprovalCreateInput): Promise<IRequestApproval> {
		return this.requestApprovalService.createRequestApproval(entity);
	}

	/**
	 * UPDATE request approval by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'update a request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IRequestApprovalCreateInput
	): Promise<IRequestApproval> {
		return this.requestApprovalService.updateRequestApproval(id, entity);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `REQUEST_APPROVAL_EDIT`: the grant its create, update,
	 * approve and refuse routes state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<RequestApproval> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `REQUEST_APPROVAL_EDIT`: the grant its create, update,
	 * approve and refuse routes state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<RequestApproval> {
		return await super.softRecover(id, ...options);
	}
}
