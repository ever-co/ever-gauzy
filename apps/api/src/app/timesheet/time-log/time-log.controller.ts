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
	ITimeLog,
	IGetTimeLogInput,
	OrganizationPermissionsEnum,
	PermissionsEnum,
	IGetTimeLogConflictInput,
	IGetTimeLogReportInput,
	IGetTimeLimitReportInput
} from '@gauzy/models';
import { AuthGuard } from '@nestjs/passport';
import { TimeLogService } from './time-log.service';
import { Permissions } from '../../shared/decorators/permissions';
import { OrganizationPermissionGuard } from '../../shared/guards/auth/organization-permission.guard';
import { RequestContext } from '../../core/context';
import { CrudController } from '../../core';
import { FindOneOptions } from 'typeorm';
import { TenantBaseGuard } from '../../shared/guards/auth/tenant-base.guard ';

@ApiTags('TimeLog')
@UseGuards(AuthGuard('jwt'), TenantBaseGuard)
@Controller('time-log')
export class TimeLogController extends CrudController<ITimeLog> {
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
	async getLogs(@Query() entity: IGetTimeLogInput): Promise<ITimeLog[]> {
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
	): Promise<ITimeLog[]> {
		return this.timeLogService.checkConflictTime(entity);
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
	@Get('report/daily')
	async getDailyReport(@Query() options: IGetTimeLogReportInput) {
		return this.timeLogService.getDailyReport(options);
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
	@Get('report/daily-chart')
	async getDailyReportChartData(@Query() options: IGetTimeLogReportInput) {
		return this.timeLogService.getDailyReportChartData(options);
	}

	@ApiOperation({ summary: 'Get Owed Amount Report' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Get report data'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/report/owed-report')
	async getOwedAmountReport(
		@Query() entity: IGetTimeLogReportInput
	): Promise<any> {
		return this.timeLogService.getOwedAmountReport(entity);
	}

	@ApiOperation({ summary: 'Get Owed Amount Report Chart Data' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Get report chart data'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/report/owed-chart-data')
	async getOwedAmountReportChartData(
		@Query() entity: IGetTimeLogReportInput
	): Promise<any> {
		return this.timeLogService.getOwedAmountReportChartData(entity);
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
	@Get('report/weekly')
	async getWeeklyReport(@Query() options: IGetTimeLogReportInput) {
		return this.timeLogService.getWeeklyReport(options);
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
	@ApiOperation({ summary: 'Time Limit' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@UseGuards(AuthGuard('jwt'))
	@Get('time-limit')
	async weeklyLimit(@Query() request?: IGetTimeLimitReportInput) {
		return this.timeLogService.getTimeLimit(request);
	}

	@ApiOperation({ summary: 'Budget limit' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiOperation({ summary: 'Time Limit' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@UseGuards(AuthGuard('jwt'))
	@Get('budget-limit')
	async budgetLimit(@Query() request?: IGetTimeLimitReportInput) {
		return this.timeLogService.budgetLimit(request);
	}

	@Get(':id')
	async findOne(
		@Param('id') id: string,
		@Query() options: FindOneOptions
	): Promise<ITimeLog> {
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
	async addManualTime(@Body() entity: IManualTimeInput): Promise<ITimeLog> {
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
	): Promise<ITimeLog> {
		return this.timeLogService.updateTime(id, entity);
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
