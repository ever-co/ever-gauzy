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
import { CommandBus } from '@nestjs/cqrs';
import {
	IPagination,
	ITimeOff as ITimeOffRequest,
	ITimeOffCreateInput,
	ITimeOffUpdateInput,
	PermissionsEnum,
	StatusTypesEnum
} from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffStatusCommand } from './commands';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('TimeOffRequest')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TimeOffRequestController extends CrudController<TimeOffRequest> {
	constructor(
		private readonly timeOffRequestService: TimeOffRequestService,
		private readonly commandBus: CommandBus
	) {
		super(timeOffRequestService);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@Put('approval/:id')
	async timeOffRequestApproved(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ITimeOffRequest> {
		return this.commandBus.execute(
			new TimeOffStatusCommand(id, StatusTypesEnum.APPROVED)
		);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@Put('denied/:id')
	async timeOffRequestDenied(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ITimeOffRequest> {
		return this.commandBus.execute(
			new TimeOffStatusCommand(id, StatusTypesEnum.DENIED)
		);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TIME_OFF_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ITimeOffRequest>> {
		const { relations, findInput, filterDate } = data;
		return this.timeOffRequestService.getAllTimeOffRequests(
			relations,
			findInput,
			filterDate
		);
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
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@Post()
	async create(
		@Body() entity: ITimeOffCreateInput
	): Promise<ITimeOffRequest> {
		return this.timeOffRequestService.create(entity);
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.TIME_OFF_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ITimeOffUpdateInput
	): Promise<ITimeOffRequest> {
		return this.timeOffRequestService.updateTimeOffByAdmin(id, entity);
	}
}
