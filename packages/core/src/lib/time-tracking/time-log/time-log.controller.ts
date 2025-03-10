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
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import { ITimeLog, PermissionsEnum, IGetTimeLogConflictInput, ID, IReportDayData, ITimeLimitReport, IReportWeeklyData, IAmountOwedReport, IAmountOwedReportChart, IDailyReportChart } from '@gauzy/contracts';
import { TimeLogService } from './time-log.service';
import { Permissions } from './../../shared/decorators';
import { OrganizationPermissionGuard, PermissionGuard, TenantBaseGuard } from './../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { CreateManualTimeLogDTO, DeleteTimeLogDTO, UpdateManualTimeLogDTO } from './dto';
import { TimeLogLimitQueryDTO, TimeLogQueryDTO } from './dto/query';
import { TimeLogBodyTransformPipe } from './pipes';
import { IGetConflictTimeLogCommand } from './commands';

@ApiTags('TimeLog')
@UseGuards(TenantBaseGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
@Controller()
export class TimeLogController {
	constructor(private readonly _timeLogService: TimeLogService, private readonly _commandBus: CommandBus) {}

	/**
	 * Get conflicting timer logs based on the provided entity.
	 * @param entity The entity with information for checking conflicts.
	 * @returns An array of conflicting timer logs.
	 */
	@ApiOperation({ summary: 'Get Timer Logs Conflict' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved conflicting timer logs',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('conflict')
	async getConflict(@Query() request: IGetTimeLogConflictInput): Promise<ITimeLog[]> {
		return await this._commandBus.execute(new IGetConflictTimeLogCommand(request));
	}

	/**
	 * Get daily report for timer logs based on the provided options.
	 * @param options The options for retrieving the daily report.
	 * @returns The daily report for timer logs.
	 */
	@ApiOperation({ summary: 'Find Timer Log by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the daily report'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found for the provided options'
	})
	@Get('report/daily')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getDailyReport(@Query() options: TimeLogQueryDTO): Promise<IReportDayData> {
		return await this._timeLogService.getDailyReport(options);
	}

	/**
	 * Get chart data for the daily report of timer logs based on the provided options.
	 * @param options The options for retrieving the daily report chart data.
	 * @returns The chart data for the daily report of timer logs.
	 */
	@ApiOperation({ summary: 'Find Timer Log by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the chart data for the daily report'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found for the provided options'
	})
	@Get('report/daily-chart')
	@UseValidationPipe({ whitelist: true })
	async getDailyReportChartData(@Query() options: TimeLogQueryDTO): Promise<IDailyReportChart[]> {
		return await this._timeLogService.getDailyReportCharts(options);
	}

	/**
	 * Get report data for the owed amount based on the provided options.
	 * @param options The options for retrieving the owed amount report data.
	 * @returns The report data for the owed amount.
	 */
	@ApiOperation({ summary: 'Get Owed Amount Report' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the report data for the owed amount'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('report/owed-report')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getOwedAmountReport(@Query() options: TimeLogQueryDTO): Promise<IAmountOwedReport[]> {
		return await this._timeLogService.getOwedAmountReport(options);
	}

	/**
	 * Get chart data for the owed amount report based on the provided options.
	 * @param options The options for retrieving the owed amount report chart data.
	 * @returns The chart data for the owed amount report.
	 */
	@ApiOperation({ summary: 'Get Owed Amount Report Chart Data' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the chart data for the owed amount report'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('report/owed-charts')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getOwedAmountReportChartData(@Query() options: TimeLogQueryDTO): Promise<IAmountOwedReportChart[]> {
		return await this._timeLogService.getOwedAmountReportCharts(options);
	}

	/**
	 * Get the weekly report for timer logs based on the provided options.
	 * @param options The options for retrieving the weekly report.
	 * @returns The weekly report for timer logs if found, otherwise null.
	 */
	@ApiOperation({ summary: 'Get Weekly Report' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the weekly report for timer logs'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found for the specified options'
	})
	@Get('report/weekly')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getWeeklyReport(@Query() options: TimeLogQueryDTO): Promise<IReportWeeklyData[]> {
		return await this._timeLogService.getWeeklyReport(options);
	}

	/**
	 * Get the time limit report for timer logs based on the provided options.
	 * @param options The options for retrieving the time limit report.
	 * @returns The time limit report for timer logs if found, otherwise null.
	 */
	@ApiOperation({ summary: 'Get Time Limit Report' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the time limit report for timer logs'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found for the specified options'
	})
	@Get('time-limit')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getTimeLimitReport(@Query() options: TimeLogLimitQueryDTO): Promise<ITimeLimitReport[]> {
		return await this._timeLogService.getTimeLimit(options);
	}

	/**
	 * Get project budget limit based on the provided options.
	 * @param options The options for retrieving the project budget limit.
	 * @returns The project budget limit if found, otherwise null.
	 */
	@ApiOperation({ summary: 'Get Project Budget Limit' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the project budget limit.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Project budget limit not found.'
	})
	@Get('project-budget-limit')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getProjectBudgetLimit(@Query() options: TimeLogQueryDTO) {
		return await this._timeLogService.getProjectBudgetLimit(options);
	}

	/**
	 * Retrieve the client budget limit based on the provided options.
	 * @param options The options for retrieving the client budget limit.
	 * @returns The client budget limit if found; otherwise, null.
	 */
	@ApiOperation({ summary: 'Get Client Budget Limit' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the client budget limit.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Client budget limit not found.'
	})
	@Get('client-budget-limit')
	@UseValidationPipe({ whitelist: true, transform: true })
	async clientBudgetLimit(@Query() options: TimeLogQueryDTO) {
		return await this._timeLogService.getClientBudgetLimit(options);
	}

	/**
	 * Get timer logs for invoice based on provided options.
	 * @param options The options for querying timer logs.
	 * @returns An array of timer logs entries.
	 */
	@ApiOperation({ summary: 'Get Invoice Timer Logs' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved timer logs',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('invoice')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getINvoiceLogs(@Query() options: TimeLogQueryDTO): Promise<IReportDayData> {
		return await this._timeLogService.getInvoiceLogs(options);
	}

	/**
	 * Get timer logs based on provided options.
	 * @param options The options for querying timer logs.
	 * @returns An array of timer logs.
	 */
	@ApiOperation({ summary: 'Get Timer Logs' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved timer logs',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get()
	@UseValidationPipe({ whitelist: true, transform: true })
	async getLogs(@Query() options: TimeLogQueryDTO): Promise<ITimeLog[]> {
		return await this._timeLogService.getTimeLogs(options);
	}

	/**
	 * Find time log by ID
	 * @param id The ID of the time log.
	 * @param options Additional options for finding the time log.
	 * @returns The found time log.
	 */
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() options: FindOneOptions): Promise<ITimeLog> {
		return await this._timeLogService.findOneByIdString(id, options);
	}

	/**
	 * Add manual time
	 * @param entity The data for creating a manual time log.
	 * @returns The created manual time log.
	 */
	@ApiOperation({ summary: 'Add manual time' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MANUAL_TIME)
	async addManualTime(
		@Body(TimeLogBodyTransformPipe, new ValidationPipe({ transform: true })) entity: CreateManualTimeLogDTO
	): Promise<ITimeLog> {
		return await this._timeLogService.addManualTime(entity);
	}

	/**
	 * Update time log
	 * @param id The ID of the time log entry to be updated.
	 * @param entity The updated data for the manual time log.
	 * @returns The updated time log entry.
	 */
	@ApiOperation({ summary: 'Update time log' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put(':id')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MODIFY_TIME)
	async updateManualTime(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body(TimeLogBodyTransformPipe, new ValidationPipe({ transform: true })) entity: UpdateManualTimeLogDTO
	): Promise<ITimeLog> {
		return await this._timeLogService.updateManualTime(id, entity);
	}

	/**
	 * Deletes a time log based on the provided query parameters.
	 *
	 * @param options - The query parameters for deleting time logs, including conditions like log IDs and force delete flag.
	 * @returns A Promise that resolves to either a DeleteResult or UpdateResult, depending on whether it's a soft or hard delete.
	 * @throws BadRequestException if the input is invalid or deletion fails.
	 */
	@ApiOperation({ summary: 'Delete time log' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The time log has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong.'
	})
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	@Delete()
	@UseValidationPipe({ transform: true })
	async deleteTimeLog(@Query() options: DeleteTimeLogDTO): Promise<DeleteResult | UpdateResult> {
		return await this._timeLogService.deleteTimeLogs(options);
	}
}
