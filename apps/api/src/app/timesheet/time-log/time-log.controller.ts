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
	RolesEnum
} from '@gauzy/models';
import { AuthGuard } from '@nestjs/passport';
import { TimeLogService } from './time-log.service';
import { Permissions } from '../../shared/decorators/permissions';
import { OrganizationPermissionGuard } from '../../shared/guards/auth/organization-permission.guard';
import { UserRole } from '../../shared/decorators/roles';

@ApiTags('TimeLog')
@UseGuards(AuthGuard('jwt'))
@Controller('time-log')
export class TimeLogController {
	constructor(private readonly timeLogService: TimeLogService) {}

	@ApiOperation({ summary: 'Get Timer Logs' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getLogs(
		@Query() entity: IGetTimeLogInput,
		@UserRole() roles: RolesEnum
	): Promise<TimeLog[]> {
		return this.timeLogService.getTimeLogs(entity, roles);
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
