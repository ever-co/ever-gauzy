import {
	Controller,
	HttpStatus,
	Post,
	Body,
	Put,
	Param,
	Get,
	Query,
	UseGuards,
	Delete
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IManualTimeInput,
	TimeLog,
	IGetTimeLogInput,
	OrganizationPermissionsEnum,
	PermissionsEnum,
	IGetTimeLogConflictInput
} from '@gauzy/models';
import { AuthGuard } from '@nestjs/passport';
import { TimeLogService } from './time-log.service';
import { Permissions } from '../../shared/decorators/permissions';
import { OrganizationPermissionGuard } from '../../shared/guards/auth/organization-permission.guard';
import { RequestContext } from '../../core/context';
import { CrudController } from '../../core';
import { FindOneOptions } from 'typeorm';

@ApiTags('TimeLog')
@UseGuards(AuthGuard('jwt'))
@Controller('time-log')
export class TimeLogController extends CrudController<TimeLog> {
	constructor(private readonly timeLogService: TimeLogService) {
		super(timeLogService);
	}

	@ApiOperation({ summary: 'Get Timer Logs' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getLogs(@Query() entity: IGetTimeLogInput): Promise<TimeLog[]> {
		return this.timeLogService.getTimeLogs(entity);
	}

	@ApiOperation({ summary: 'Get Timer Logs Conflict' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/conflict')
	async getConflict(
		@Query() entity: IGetTimeLogConflictInput
	): Promise<TimeLog[]> {
		return this.timeLogService.checkConfictTime(entity);
	}

	@ApiOperation({ summary: 'Find Timer Log by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findOne(
		@Param('id') id: string,
		@Query() options: FindOneOptions
	): Promise<TimeLog> {
		return this.timeLogService.findOne(id, options);
	}

	@ApiOperation({ summary: 'Add manual time' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(OrganizationPermissionsEnum.ALLOW_MANUAL_TIME)
	async addManualTime(@Body() entity: IManualTimeInput): Promise<TimeLog> {
		let employeeId: string;
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (entity.employeeId) {
				employeeId = entity.employeeId;
			}
		}
		if (!employeeId) {
			const user = RequestContext.currentUser();
			employeeId = user.employeeId;
		}
		entity.employeeId = employeeId;

		return this.timeLogService.addManualTime(entity);
	}

	@ApiOperation({ summary: 'Update time log' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put('/:id')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(OrganizationPermissionsEnum.ALLOW_MODIFY_TIME)
	async updateManualTime(
		@Param('id') id: string,
		@Body() entity: IManualTimeInput
	): Promise<TimeLog> {
		entity.id = id;
		return this.timeLogService.updateManualTime(entity);
	}

	@ApiOperation({ summary: 'Delete time log' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Delete('/')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(OrganizationPermissionsEnum.ALLOW_DELETE_TIME)
	async deleteTimeTime(@Query() query): Promise<any> {
		return this.timeLogService.deleteTimeLog(query.logIds);
	}
}
