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
	Delete,
	UsePipes,
	ValidationPipe,
	UseInterceptors
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import {
	IManualTimeInput,
	ITimeLog,
	IGetTimeLogInput,
	OrganizationPermissionsEnum,
	PermissionsEnum,
	IGetTimeLogConflictInput,
	IGetTimeLogReportInput,
	IGetTimeLimitReportInput,
	IProjectBudgetLimitReportInput,
	IClientBudgetLimitReportInput
} from '@gauzy/contracts';
import { TimeLogService } from './time-log.service';
import { Permissions } from './../../shared/decorators';
import { OrganizationPermissionGuard, PermissionGuard, TenantBaseGuard } from './../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { RequestContext } from './../../core/context';
import { DeleteTimeLogDTO, UpdateManualTimeLogDTO } from './dto';
import { TransformInterceptor } from './../../core/interceptors';

@ApiTags('TimeLog')
@UseGuards(TenantBaseGuard)
@UseInterceptors(TransformInterceptor)
@Controller()
export class TimeLogController {
	constructor(
		private readonly timeLogService: TimeLogService
	) { }

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
		return await this.timeLogService.checkConflictTime(entity);
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
	@Get('/report/daily')
	async getDailyReport(@Query() options: IGetTimeLogReportInput) {
		return await this.timeLogService.getDailyReport(options);
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
	@Get('/report/daily-chart')
	async getDailyReportChartData(
		@Query() options: IGetTimeLogReportInput
	): Promise<any> {
		return await this.timeLogService.getDailyReportChartData(options);
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
		return await this.timeLogService.getOwedAmountReport(entity);
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
		return await this.timeLogService.getOwedAmountReportChartData(entity);
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
	@Get('/report/weekly')
	async getWeeklyReport(@Query() options: IGetTimeLogReportInput) {
		return await this.timeLogService.getWeeklyReport(options);
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
	@Get('/time-limit')
	async weeklyLimit(@Query() request?: IGetTimeLimitReportInput) {
		return await this.timeLogService.getTimeLimit(request);
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
	@Get('/project-budget-limit')
	async projectBudgetLimit(
		@Query() request?: IProjectBudgetLimitReportInput
	) {
		return await this.timeLogService.projectBudgetLimit(request);
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
	@Get('/client-budget-limit')
	async clientBudgetLimit(@Query() request?: IClientBudgetLimitReportInput) {
		return await this.timeLogService.clientBudgetLimit(request);
	}

	@ApiOperation({ summary: 'Get Timer Logs' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getLogs(
		@Query() entity: IGetTimeLogInput
	): Promise<ITimeLog[]> {
		return await this.timeLogService.getTimeLogs(entity);
	}

	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query() options: FindOneOptions
	): Promise<ITimeLog> {
		return this.timeLogService.findOneByIdString(id, options);
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
		return await this.timeLogService.addManualTime(entity);
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
	@UseGuards(PermissionGuard, OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MODIFY_TIME)
	@UsePipes(new ValidationPipe({ transform: true }))
	async updateManualTime(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateManualTimeLogDTO
	): Promise<ITimeLog> {
		return await this.timeLogService.updateTime(id, entity);
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
	@UseGuards(PermissionGuard, OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	@UsePipes(new ValidationPipe({ transform: true }))
	async deleteTimeLog(@Query() query: DeleteTimeLogDTO): Promise<DeleteResult | UpdateResult> {
		return await this.timeLogService.deleteTimeLog(query.logIds);
	}
}
