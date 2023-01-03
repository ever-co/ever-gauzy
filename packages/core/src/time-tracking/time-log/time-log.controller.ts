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
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import {
	ITimeLog,
	PermissionsEnum,
	IGetTimeLogConflictInput
} from '@gauzy/contracts';
import { TimeLogService } from './time-log.service';
import { Permissions } from './../../shared/decorators';
import { OrganizationPermissionGuard, PermissionGuard, TenantBaseGuard } from './../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { CreateManualTimeLogDTO, DeleteTimeLogDTO, UpdateManualTimeLogDTO } from './dto';
import { TimeLogLimitQueryDTO, TimeLogQueryDTO } from './dto/query';
import { TimeLogBodyTransformPipe } from './pipes';

@ApiTags('TimeLog')
@UseGuards(TenantBaseGuard, PermissionGuard)
@Permissions(
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.ALL_ORG_VIEW
)
@Controller()
export class TimeLogController {

	constructor(
		private readonly timeLogService: TimeLogService
	) {}

	@ApiOperation({ summary: 'Get Timer Logs Conflict' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('conflict')
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
	@Get('report/daily')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getDailyReport(
		@Query() options: TimeLogQueryDTO
	) {
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
	@Get('report/daily-chart')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getDailyReportChartData(
		@Query() options: TimeLogQueryDTO
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
	@Get('report/owed-report')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getOwedAmountReport(
		@Query() options: TimeLogQueryDTO
	): Promise<any> {
		return await this.timeLogService.getOwedAmountReport(options);
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
	@Get('report/owed-chart-data')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getOwedAmountReportChartData(
		@Query() options: TimeLogQueryDTO
	): Promise<any> {
		return await this.timeLogService.getOwedAmountReportChartData(options);
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getWeeklyReport(
		@Query() options: TimeLogQueryDTO
	) {
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
	@Get('time-limit')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getTimeLimitReport(
		@Query() options: TimeLogLimitQueryDTO
	) {
		return await this.timeLogService.getTimeLimit(options);
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
	@Get('project-budget-limit')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async projectBudgetLimit(
		@Query() options: TimeLogQueryDTO
	) {
		return await this.timeLogService.projectBudgetLimit(options);
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
	@Get('client-budget-limit')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async clientBudgetLimit(
		@Query() options: TimeLogQueryDTO
	) {
		return await this.timeLogService.clientBudgetLimit(options);
	}

	@ApiOperation({ summary: 'Get Timer Logs' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getLogs(
		@Query() options: TimeLogQueryDTO
	): Promise<ITimeLog[]> {
		return await this.timeLogService.getTimeLogs(options);
	}

	@Get(':id')
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
	@Post()
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MANUAL_TIME)
	async addManualTime(
		@Body(TimeLogBodyTransformPipe, new ValidationPipe({ transform: true })) entity: CreateManualTimeLogDTO
	): Promise<ITimeLog> {
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
	@Put(':id')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MODIFY_TIME)
	async updateManualTime(
		@Param('id', UUIDValidationPipe) id: string,
		@Body(TimeLogBodyTransformPipe, new ValidationPipe({ transform: true })) entity: UpdateManualTimeLogDTO
	): Promise<ITimeLog> {
		return await this.timeLogService.updateManualTime(id, entity);
	}

	@ApiOperation({ summary: 'Delete time log' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The time log has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	@Delete()
	@UsePipes(new ValidationPipe())
	async deleteTimeLog(
		@Query() query: DeleteTimeLogDTO
	): Promise<DeleteResult | UpdateResult> {
		return await this.timeLogService.deleteTimeLogs(query);
	}
}
