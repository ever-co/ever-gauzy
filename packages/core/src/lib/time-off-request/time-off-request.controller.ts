import { Controller, UseGuards, HttpStatus, Post, Body, Get, Query, Put, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import {
	IPagination,
	ITimeOff as ITimeOffRequest,
	ITimeOffCreateInput,
	ITimeOffUpdateInput,
	PermissionsEnum,
	RolesEnum,
	StatusTypesEnum,
	ID
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffStatusCommand } from './commands';
import { PermissionGuard, RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions, Roles } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';

@ApiTags('TimeOffRequest')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
@Controller('/time-off-request')
export class TimeOffRequestController extends CrudController<TimeOffRequest> {
	constructor(
		private readonly timeOffRequestService: TimeOffRequestService,
		private readonly commandBus: CommandBus
	) {
		super(timeOffRequestService);
	}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: PaginationParams<TimeOffRequest>): Promise<IPagination<ITimeOffRequest>> {
		return await this.timeOffRequestService.pagination(options);
	}

	/**
	 * UPDATE time off request approved
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Time off request approved' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Approved time off request',
		type: TimeOffRequest
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	@Put('approval/:id')
	async timeOffRequestApproved(@Param('id', UUIDValidationPipe) id: ID): Promise<ITimeOffRequest> {
		return this.commandBus.execute(new TimeOffStatusCommand(id, StatusTypesEnum.APPROVED));
	}

	/**
	 * UPDATE time off request denied
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Time off request denied' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Denied time off request',
		type: TimeOffRequest
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	@Put('denied/:id')
	async timeOffRequestDenied(@Param('id', UUIDValidationPipe) id: ID): Promise<ITimeOffRequest> {
		return this.commandBus.execute(new TimeOffStatusCommand(id, StatusTypesEnum.DENIED));
	}

	/**
	 * GET all time off requests
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all time off requests.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found time off requests',
		type: TimeOffRequest
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<ITimeOffRequest>> {
		const { relations, findInput } = data;
		return await this.timeOffRequestService.getAllTimeOffRequests(relations, findInput);
	}

	/**
	 * CREATE new time off request/holiday
	 *
	 * @param entity
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new time off request / holiday record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The new time off request / holiday record created'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_ADD)
	@Post()
	async create(@Body() entity: ITimeOffCreateInput): Promise<ITimeOffRequest> {
		return await this.timeOffRequestService.create(entity);
	}

	/**
	 * UPDATE time off request by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Time off request update' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found request time off',
		type: TimeOffRequest
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_DELETE)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ITimeOffUpdateInput
	): Promise<ITimeOffRequest> {
		return await this.timeOffRequestService.updateTimeOffByAdmin(id, entity);
	}
}
