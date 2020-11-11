import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	Put,
	Param,
	HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { TimeOffRequest } from './time-off-request.entity';
import { AuthGuard } from '@nestjs/passport';
import { TimeOffRequestService } from './time-off-request.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { ITimeOffCreateInput, StatusTypesEnum } from '@gauzy/models';
import { ITimeOff, PermissionsEnum } from '@gauzy/models';
import { IPagination } from '../core';
import { CommandBus } from '@nestjs/cqrs';
import { TimeOffStatusCommand } from './commands';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('TimeOffRequest')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class TimeOffRequestController extends CrudController<TimeOffRequest> {
	constructor(
		private readonly requestService: TimeOffRequestService,
		private commandBus: CommandBus
	) {
		super(requestService);
	}

	@ApiOperation({ summary: 'Find all time off requests.' })
	@UseGuards(PermissionGuard)
	@Get()
	async findAllTimeOffRequest(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ITimeOff>> {
		const { relations, findInput, filterDate } = data;
		return this.requestService.getAllTimeOffRequests(
			relations,
			findInput,
			filterDate
		);
	}

	@ApiOperation({ summary: 'Create new time off request / holiday record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The new time off request / holiday record created'
	})
	@UseGuards(PermissionGuard)
	@Post()
	async createTimeOffRequest(
		@Body() entity: ITimeOffCreateInput,
		...options: any[]
	): Promise<TimeOffRequest> {
		return this.requestService.create(entity);
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@Put(':id')
	async timeOffRequestUpdate(
		@Param('id') id: string,
		@Body() entity: ITimeOffCreateInput
	): Promise<TimeOffRequest> {
		return this.requestService.updateTimeOffByAdmin(id, entity);
	}

	@ApiOperation({ summary: 'Time off request approved' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found request time off',
		type: TimeOffRequest
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@Put('approval/:id')
	async timeOffRequestApproved(
		@Param('id') id: string
	): Promise<TimeOffRequest> {
		return this.commandBus.execute(
			new TimeOffStatusCommand(id, StatusTypesEnum.APPROVED)
		);
	}

	@ApiOperation({ summary: 'Time off request denied' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Time off',
		type: TimeOffRequest
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('denied/:id')
	async timeOffRequestDenied(
		@Param('id') id: string
	): Promise<TimeOffRequest> {
		return this.commandBus.execute(
			new TimeOffStatusCommand(id, StatusTypesEnum.DENIED)
		);
	}
}
