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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import { ITimeLog, PermissionsEnum, ID, IManualTimeInput } from '@gauzy/contracts';
import {
	BulkExecutor,
	BulkOperation,
	BulkResult,
	IBulkCreateRequest,
	applyAsSingleCreate,
	assertSingleRouteGuard,
	bulkCreateRequest,
	bulkOptionsOf,
	singleRouteBody
} from './../../api';
import { Idempotent } from './../../idempotency/idempotent.decorator';
import { TimeLog } from './time-log.entity';
import { TimeLogService } from './time-log.service';
import { OrganizationPolicyTarget, Permissions } from './../../shared/decorators';
import {
	OrganizationPermissionGuard,
	PermissionGuard,
	TenantBaseGuard,
	EmployeeTrackedDataGuard
} from './../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { CreateManualTimeLogDTO, DeleteTimeLogDTO, UpdateManualTimeLogDTO } from './dto';
import { GetTimeLogConflictQueryDTO, TimeLogLimitQueryDTO, TimeLogListQueryDTO, TimeLogQueryDTO } from './dto/query';
import { TimeLogBodyTransformPipe } from './pipes';

@ApiTags('TimeLog')
@UseGuards(TenantBaseGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
@Controller('/timesheet/time-log')
export class TimeLogController {
	constructor(
		private readonly _timeLogService: TimeLogService,
		private readonly bulkExecutor: BulkExecutor,
		private readonly organizationPermissionGuard: OrganizationPermissionGuard
	) {}

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
	@UseValidationPipe({ whitelist: true, transform: true })
	async getConflict(@Query() request: GetTimeLogConflictQueryDTO): Promise<ITimeLog[]> {
		// Goes through the service, never the command bus directly: the command uses `employeeId`,
		// `organizationId` and `tenantId` exactly as given, and this route is reachable by any
		// TIME_TRACKER holder — i.e. every ordinary employee.
		return await this._timeLogService.getConflictTimeLogs(request);
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('report/daily')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getDailyReport(@Query() options: TimeLogQueryDTO): Promise<any | null> {
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('report/daily-chart')
	@UseValidationPipe({ whitelist: true })
	async getDailyReportChartData(@Query() options: TimeLogQueryDTO): Promise<any | null> {
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('report/owed-report')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getOwedAmountReport(@Query() options: TimeLogQueryDTO): Promise<any | null> {
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('report/owed-charts')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getOwedAmountReportChartData(@Query() options: TimeLogQueryDTO): Promise<any | null> {
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('report/weekly')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getWeeklyReport(@Query() options: TimeLogQueryDTO): Promise<any | null> {
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('time-limit')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getTimeLimitReport(@Query() options: TimeLogLimitQueryDTO): Promise<any | null> {
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
	@UseGuards(EmployeeTrackedDataGuard)
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get('client-budget-limit')
	@UseValidationPipe({ whitelist: true, transform: true })
	async clientBudgetLimit(@Query() options: TimeLogQueryDTO) {
		return await this._timeLogService.getClientBudgetLimit(options);
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
	@UseGuards(EmployeeTrackedDataGuard)
	@Get()
	@UseValidationPipe({ whitelist: true, transform: true })
	async getLogs(@Query() options: TimeLogListQueryDTO): Promise<ITimeLog[]> {
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
		@Body(TimeLogBodyTransformPipe, new ValidationPipe({ transform: true, whitelist: true })) entity: CreateManualTimeLogDTO
	): Promise<ITimeLog> {
		return await this._timeLogService.addManualTime(entity);
	}

	/**
	 * Add manual time in bulk
	 *
	 * One request records many hand-entered intervals and answers one outcome per item. The batch is the
	 * platform's — `@BulkOperation` declares what this route accepts, the executor is configured from that
	 * declaration, authorises the whole request once and refuses a batch it cannot read before writing
	 * anything.
	 *
	 * **Each item is `POST /timesheet/time-log`**, in the order that route runs:
	 *
	 * 1. the organization-policy guard, asked again with the item as the body — the guard reads the
	 *    organization a body names, and a batch's body names none, so the route's own guard alone would
	 *    judge every item by the caller's organization and none by its own;
	 * 2. the route's own pipes — the one that puts the caller's own employee on an item that names none
	 *    when the caller may not choose one, then the route's validation, which states the log type and the
	 *    source for itself;
	 * 3. the route's handler, `addManualTime`: the employee resolved in the caller's tenant, the refusal
	 *    for an employee the caller may not record time for, the organization's future-date rule, and the
	 *    removal of the time the interval overlaps.
	 *
	 * The items are applied one after another, so an item's overlap is resolved against the intervals the
	 * items before it recorded — exactly what the same intervals recorded one by one would leave.
	 *
	 * The route carries the guard and the permission the single route carries. A batch records what it can
	 * and reports the rest; **`atomic: true` is refused before item 0** (`BULK_ATOMIC_UNSUPPORTED`, declared
	 * `atomic: false`): each item runs the manual-time create, which writes through its own repositories,
	 * so the batch cannot be rolled back as one. The route declares no dry run and no write mode either (see
	 * `bulkCreateRequest`).
	 *
	 * @param request The batch: the items, each the body `POST /timesheet/time-log` takes.
	 * @returns What applied, what did not, and the counts derived from both.
	 */
	@ApiOperation({ summary: 'Add manual time in bulk' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The batch was applied, with one outcome per item' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request or an item could not be read, or it asked for "atomic" (BULK_ATOMIC_UNSUPPORTED)'
	})
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'BULK_LIMIT_EXCEEDED' })
	@ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'BULK_ALL_ITEMS_FAILED' })
	@Post('/bulk')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MANUAL_TIME)
	@Idempotent({ scope: 'time_log.bulk', required: false, resourceType: 'time_log' })
	@BulkOperation({
		resource: 'time_log',
		// The platform's cap for every resource but the price and stock matrices: an item is one interval,
		// with the slots it overlaps trimmed.
		maxItems: 200,
		permission: PermissionsEnum.ALLOW_MANUAL_TIME,
		// Each item is the manual-time create, which writes through its own repositories: no batch transaction.
		atomic: false
	})
	async bulk(@Body() request: IBulkCreateRequest<IManualTimeInput>): Promise<BulkResult<IManualTimeInput>> {
		const batch = bulkCreateRequest(request);

		return await this.bulkExecutor.execute<IManualTimeInput>(
			batch,
			(item, context) => applyAsSingleCreate(item, context, (body) => this.addManualTimeAsSingleRoute(body)),
			bulkOptionsOf(TimeLogController, 'bulk')
		);
	}

	/**
	 * Records one item of a batch exactly as `POST /timesheet/time-log` records its body: the route's
	 * organization-policy guard on the item, the route's own pipes, then the route's handler.
	 *
	 * @param body The item, as the single route's body.
	 * @returns The time log recorded.
	 */
	private async addManualTimeAsSingleRoute(body: IManualTimeInput): Promise<ITimeLog> {
		await assertSingleRouteGuard(this.organizationPermissionGuard, TimeLogController, 'addManualTime', body);

		return await this.addManualTime(
			await singleRouteBody<CreateManualTimeLogDTO>(TimeLogController, 'addManualTime')(body)
		);
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
	@OrganizationPolicyTarget(TimeLog)
	async updateManualTime(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body(TimeLogBodyTransformPipe, new ValidationPipe({ transform: true, whitelist: true })) entity: UpdateManualTimeLogDTO
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
	// The ids to delete live in the query, and the service filters the rows it deletes by the QUERY
	// organizationId; resolve the organization of every addressed log so a body organizationId cannot
	// decide the verdict for rows of another organization (GHSA-rmq9-85v7-f365).
	@OrganizationPolicyTarget(TimeLog, 'logIds', 'query')
	@Delete()
	@UseValidationPipe({ transform: true })
	async deleteTimeLog(@Query() options: DeleteTimeLogDTO): Promise<DeleteResult | UpdateResult> {
		return await this._timeLogService.deleteTimeLogs(options);
	}
}
