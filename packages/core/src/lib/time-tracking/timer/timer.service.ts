import {
	Injectable,
	NotFoundException,
	ForbiddenException,
	NotAcceptableException,
	Logger,
	InternalServerErrorException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IsNull, Not, In, And, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import * as moment from 'moment';
import {
	TimeLogType,
	ITimerStatus,
	ITimerToggleInput,
	TimeLogSourceEnum,
	ITimerStatusInput,
	ITimeLog,
	PermissionsEnum,
	ITimeSlot,
	IEmployee,
	IEmployeeFindInput,
	ID,
	ITimerStatusWithWeeklyLimits,
	TimeErrorsEnum
} from '@gauzy/contracts';
import { SortOrderEnum } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { TimeLog } from '../../core/entities/internal';
import { RequestContext } from '../../core/context';
import {
	MultiORM,
	MultiORMEnum,
	getDateRangeFormat,
	getORMType,
	parseTypeORMFindToMikroOrm,
	wrapSerialize,
	validateDateRange
} from '../../core/utils';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { EmployeeService } from '../../employee/employee.service';
import {
	IGetConflictTimeLogCommand,
	ScheduleTimeLogEntriesCommand,
	TimeLogCreateCommand,
	TimeLogDeleteCommand,
	TimeLogUpdateCommand
} from '../time-log/commands';
import { TypeOrmTimeLogRepository } from '../time-log/repository/type-orm-time-log.repository';
import { MikroOrmTimeLogRepository } from '../time-log/repository/mikro-orm-time-log.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../../employee/repository/mikro-orm-employee.repository';
import { addRelationsToQuery, buildCommonQueryParameters, buildLogQueryParameters } from './timer.helper';
import { TimerWeeklyLimitService } from './timer-weekly-limit.service';
import { TaskService } from '../../tasks';
import { OrganizationProjectService } from '../../organization-project';
import { SocketService } from '../../socket/socket.service';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

@Injectable()
export class TimerService {
	private readonly logger = new Logger(`GZY - ${TimerService.name}`);
	protected ormType: MultiORM = ormType;

	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _timerWeeklyLimitService: TimerWeeklyLimitService,
		private readonly _commandBus: CommandBus,
		private readonly _taskService: TaskService,
		private readonly _socketService: SocketService,
		private readonly _organizationProjectService: OrganizationProjectService
	) {}

	/**
	 * Fetches an employee based on the provided query.
	 *
	 * @param query - The query parameters to find the employee.
	 * @returns A Promise resolving to the employee entity or null.
	 */
	async fetchEmployee(query: IEmployeeFindInput): Promise<IEmployee | null> {
		// Replace 'Employee' with your actual Employee entity type
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.findOneByOptions(query);
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmployeeRepository.findOneByOptions(query);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	// TODO: Verify in stage 3 — implement save logic integration with the desktop app
	/**
	 * Implementation of timer status logic
	 * This is intended to be used directly by the command handler
	 */
	// async getTimerStatus(request: ITimerStatusInput): Promise<ITimerStatusWithWeeklyLimits> {
	// 	const tenantId = RequestContext.currentTenantId() || request.tenantId;
	// 	const { organizationId, source, todayStart, todayEnd } = request;

	// 	let employee: IEmployee;

	// 	/** SUPER_ADMIN have ability to see employees timer status by specific employee (employeeId) */
	// 	const permission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

	// 	if (!!permission && isNotEmpty(request.employeeId)) {
	// 		const { employeeId } = request;
	// 		employee = await this.fetchEmployee({ id: employeeId, tenantId, organizationId });
	// 	} else {
	// 		const userId = RequestContext.currentUserId();
	// 		employee = await this.fetchEmployee({ userId, tenantId, organizationId });
	// 	}

	// 	if (!employee) {
	// 		throw new NotFoundException("We couldn't find the employee you were looking for.");
	// 	}

	// 	const { id: employeeId } = employee;

	// 	/** */
	// 	const { start, end } = getDateRangeFormat(
	// 		moment.utc(todayStart || moment().startOf('day')),
	// 		moment.utc(todayEnd || moment().endOf('day'))
	// 	);

	// 	let logs: TimeLog[] = [];
	// 	let lastLog: TimeLog;

	// 	// Define common parameters for querying
	// 	const queryParams = {
	// 		...(source ? { source } : {}),
	// 		startedAt: Between<Date>(start as Date, end as Date),
	// 		stoppedAt: Not(IsNull()),
	// 		employeeId,
	// 		tenantId,
	// 		organizationId,
	// 		timeZone: request?.timeZone
	// 	};

	// 	switch (this.ormType) {
	// 		case MultiORMEnum.MikroORM:
	// 			{
	// 				/**
	// 				 * Get today's completed timelogs
	// 				 */
	// 				const parseQueryParams = parseTypeORMFindToMikroOrm<TimeLog>(buildLogQueryParameters(queryParams));
	// 				const items = await this.mikroOrmTimeLogRepository.findAll(parseQueryParams);
	// 				// Optionally wrapSerialize is a function that serializes the entity
	// 				logs = items.map((entity: TimeLog) => wrapSerialize(entity));
	// 				/**
	// 				 * Get today's last log (running or completed)
	// 				 */
	// 				// Common query parameters for time log operations.
	// 				const lastLogQueryParamsMikroOrm = buildCommonQueryParameters(queryParams);
	// 				// Adds relations from the request to the query parameters.
	// 				addRelationsToQuery(lastLogQueryParamsMikroOrm, request);
	// 				// Converts TypeORM-style query parameters to a format compatible with MikroORM.
	// 				const parseMikroOrmOptions = parseTypeORMFindToMikroOrm<TimeLog>(lastLogQueryParamsMikroOrm);

	// 				// Get today's last log (running or completed)
	// 				lastLog = (await this.mikroOrmTimeLogRepository.findOne(
	// 					parseMikroOrmOptions.where,
	// 					parseMikroOrmOptions.mikroOptions
	// 				)) as TimeLog;
	// 			}
	// 			break;
	// 		case MultiORMEnum.TypeORM: {
	// 			// Get today's completed timelogs (not running timers)
	// 			const previousLogsParams = buildLogQueryParameters(queryParams);
	// 			previousLogsParams.where.isRunning = false;
	// 			logs = await this.typeOrmTimeLogRepository.find(previousLogsParams);
	// 			const lastLogQueryParamsTypeOrm = buildCommonQueryParameters(queryParams); // Common query parameters for time log operations.
	// 			addRelationsToQuery(lastLogQueryParamsTypeOrm, request); // Adds relations from the request to the query parameters.
	// 			// Get today's last log (running or completed)
	// 			lastLog = await this.typeOrmTimeLogRepository.findOne(lastLogQueryParamsTypeOrm);
	// 			break;
	// 		}

	// 		default:
	// 			// Unsupported ORM type – should not happen unless new type is added and not handled
	// 			throw new Error(`Not implemented for ${this.ormType}`);
	// 	}

	// 	// If last log is not found, we need to check if there is any running log
	// 	// If there is a running log, that means that the timer is still running
	// 	// since previous day, so, we need to stop it saving the time and start new
	// 	// timer for the current day
	// 	if (!lastLog) {
	// 		const runningLog = (await this.getRunningLogs()) as ITimeLog;
	// 		if (runningLog) {
	// 			const newTimerStartedAt = moment.utc(todayStart || moment().startOf('day'));

	// 			// Ensure that the new timer won't be started in the past
	// 			if (moment(runningLog.startedAt).isBefore(newTimerStartedAt)) {
	// 				// Stop the current running log and save the time at end of day
	// 				const stoppedAt = moment(runningLog.startedAt).endOf('day').subtract(1, 'millisecond').toDate();
	// 				await this.stopTimer({
	// 					tenantId,
	// 					organizationId,
	// 					startedAt: runningLog.startedAt,
	// 					stoppedAt,
	// 					timeZone: request?.timeZone
	// 				});

	// 				// Add small delta to avoid overlap
	// 				const safeStart = moment
	// 					.max(moment(newTimerStartedAt), moment(stoppedAt).add(1, 'millisecond'))
	// 					.toDate();

	// 				// Start new timer for the current day
	// 				lastLog = await this.startTimer({
	// 					tenantId,
	// 					organizationId,
	// 					projectId: runningLog.projectId,
	// 					taskId: runningLog.taskId,
	// 					description: runningLog.description,
	// 					logType: runningLog.logType,
	// 					source: runningLog.source,
	// 					tags: (runningLog.tags ?? []).map((tag) => tag.id),
	// 					isBillable: runningLog.isBillable,
	// 					startedAt: safeStart,
	// 					timeZone: request?.timeZone
	// 				});
	// 			}
	// 		}
	// 	}

	// 	const now = moment();

	// 	// If the timer is running, ensure that the employee is assigned to the project/task of the running timer
	// 	if (lastLog?.isRunning) {
	// 		const projects = await this._organizationProjectService.findByEmployee(employeeId, {
	// 			tenantId,
	// 			organizationId,
	// 			relations: ['members']
	// 		});
	// 		const isAssignedToProject = projects.some((project) => project.id === lastLog.projectId);

	// 		if (!isAssignedToProject) {
	// 			await this.stopTimer({
	// 				tenantId,
	// 				organizationId,
	// 				startedAt: lastLog.startedAt,
	// 				stoppedAt: now.toDate(),
	// 				timeZone: request?.timeZone
	// 			});
	// 			throw new ForbiddenException(TimeErrorsEnum.INVALID_PROJECT_PERMISSIONS);
	// 		}

	// 		const tasks = await this._taskService.getAllTasksByEmployee(employeeId, {
	// 			where: {
	// 				id: lastLog.taskId,
	// 				projectId: lastLog.projectId,
	// 				organizationId,
	// 				tenantId
	// 			},
	// 			take: 1,
	// 			skip: 0,
	// 			withDeleted: false,
	// 			order: {
	// 				createdAt: SortOrderEnum.DESC
	// 			}
	// 		});
	// 		const isAssignedToTask = tasks.some((task) => task.id === lastLog.taskId);

	// 		if (!isAssignedToTask) {
	// 			await this.stopTimer({
	// 				tenantId,
	// 				organizationId,
	// 				startedAt: lastLog.startedAt,
	// 				stoppedAt: now.toDate(),
	// 				timeZone: request?.timeZone
	// 			});
	// 			throw new ForbiddenException(TimeErrorsEnum.INVALID_TASK_PERMISSIONS);
	// 		}
	// 	}

	// 	// Get weekly statistics
	// 	let weeklyLimitStatus = await this._timerWeeklyLimitService.checkWeeklyLimit(
	// 		employee,
	// 		start as Date,
	// 		request?.timeZone,
	// 		true
	// 	);

	// 	// If the user reached the weekly limit, then stop the current timer
	// 	let lastLogStopped = false;
	// 	if (lastLog?.isRunning) {
	// 		const remainingWeeklyLimit =
	// 			weeklyLimitStatus.remainWeeklyTime - now.diff(moment(lastLog.stoppedAt), 'seconds');
	// 		if (lastLog?.isRunning && remainingWeeklyLimit <= 0) {
	// 			lastLogStopped = true;
	// 			lastLog = await this.stopTimer({
	// 				tenantId,
	// 				organizationId,
	// 				startedAt: lastLog.startedAt,
	// 				stoppedAt: now.toDate(),
	// 				timeZone: request?.timeZone
	// 			});
	// 			// Recalculate the weekly limit status
	// 			weeklyLimitStatus = await this._timerWeeklyLimitService.checkWeeklyLimit(
	// 				employee,
	// 				start as Date,
	// 				request?.timeZone,
	// 				true
	// 			);
	// 		}
	// 	}

	// 	const status: ITimerStatusWithWeeklyLimits = {
	// 		duration: 0,
	// 		running: false,
	// 		lastLog: null,
	// 		reWeeklyLimit: employee.reWeeklyLimit,
	// 		workedThisWeek: weeklyLimitStatus.workedThisWeek
	// 	};

	// 	// Calculate completed timelogs duration
	// 	status.duration += logs.filter(Boolean).reduce((sum, log) => sum + log.duration, 0);

	// 	// Calculate last TimeLog duration
	// 	if (lastLog) {
	// 		status.lastLog = lastLog;
	// 		status.running = lastLog.isRunning;

	// 		// Include the last log into duration if it's running or was stopped
	// 		if (status.running || lastLogStopped) {
	// 			status.duration += Math.abs(
	// 				(lastLogStopped ? moment(lastLog.stoppedAt) : now).diff(moment(lastLog.startedAt), 'seconds')
	// 			);
	// 		}

	// 		// If timer is running, then add the non saved duration to the workedThisWeek
	// 		if (lastLog.isRunning) {
	// 			status.workedThisWeek += now.diff(moment(lastLog.stoppedAt), 'seconds');
	// 		}
	// 	}

	// 	return status;
	// }

	/**
	 * Implementation of timer status logic
	 * This is intended to be used directly by the command handler
	 */
	async getTimerStatus(request: ITimerStatusInput): Promise<ITimerStatusWithWeeklyLimits> {
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, source, todayStart, todayEnd } = request;

		let employee: IEmployee;

		/** SUPER_ADMIN have ability to see employees timer status by specific employee (employeeId) */
		const permission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		if (!!permission && isNotEmpty(request.employeeId)) {
			const { employeeId } = request;
			employee = await this.fetchEmployee({ id: employeeId, tenantId, organizationId });
		} else {
			const userId = RequestContext.currentUserId();
			employee = await this.fetchEmployee({ userId, tenantId, organizationId });
		}

		if (!employee) {
			throw new NotFoundException("We couldn't find the employee you were looking for.");
		}

		const { id: employeeId } = employee;

		/** */
		const { start, end } = getDateRangeFormat(
			moment.utc(todayStart || moment().startOf('day')),
			moment.utc(todayEnd || moment().endOf('day'))
		);

		let logs: TimeLog[] = [];
		let lastLog: TimeLog;

		// Define common parameters for querying
		const queryParams = {
			...(source ? { source } : {}),
			startedAt: LessThanOrEqual(end as Date), // Include logs that started before or during the selected day
			stoppedAt: And(MoreThanOrEqual(start as Date), Not(IsNull())), // Include logs that ended on or after the selected day and are completed
			employeeId,
			tenantId,
			organizationId,
			timeZone: request?.timeZone
		};

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				{
					/**
					 * Get today's completed timelogs
					 */
					const parseQueryParams = parseTypeORMFindToMikroOrm<TimeLog>(buildLogQueryParameters(queryParams));
					const items = await this.mikroOrmTimeLogRepository.findAll(parseQueryParams);
					// Optionally wrapSerialize is a function that serializes the entity
					logs = items.map((entity: TimeLog) => wrapSerialize(entity));
					/**
					 * Get today's last log (running or completed)
					 */
					// Common query parameters for time log operations.
					const lastLogQueryParamsMikroOrm = buildCommonQueryParameters(queryParams);
					// Adds relations from the request to the query parameters.
					addRelationsToQuery(lastLogQueryParamsMikroOrm, request);
					// Converts TypeORM-style query parameters to a format compatible with MikroORM.
					const parseMikroOrmOptions = parseTypeORMFindToMikroOrm<TimeLog>(lastLogQueryParamsMikroOrm);

					// Get today's last log (running or completed)
					lastLog = (await this.mikroOrmTimeLogRepository.findOne(
						parseMikroOrmOptions.where,
						parseMikroOrmOptions.mikroOptions
					)) as TimeLog;

					// If the last log is not running, check if there is another running timer
					if (!lastLog?.isRunning) {
						const runningLog = await this.getRunningLogs();
						this.logger.debug('Replacing lastLog with runningLog', { lastLog, runningLog });
						if (runningLog) {
							lastLog = runningLog as TimeLog;
						}
					}
				}
				break;
			case MultiORMEnum.TypeORM: {
				// Get today's completed timelogs (not running timers)
				const previousLogsParams = buildLogQueryParameters(queryParams);
				previousLogsParams.where.isRunning = false;
				logs = await this.typeOrmTimeLogRepository.find(previousLogsParams);
				const lastLogQueryParamsTypeOrm = buildCommonQueryParameters(queryParams); // Common query parameters for time log operations.
				addRelationsToQuery(lastLogQueryParamsTypeOrm, request); // Adds relations from the request to the query parameters.
				// Get today's last log (running or completed)
				lastLog = await this.typeOrmTimeLogRepository.findOne(lastLogQueryParamsTypeOrm);

				// If the last log is not running, check if there is another running timer
				if (!lastLog?.isRunning) {
					const runningLog = await this.getRunningLogs();
					this.logger.debug('Replacing lastLog with runningLog', { lastLog, runningLog });

					if (runningLog) {
						lastLog = runningLog as TimeLog;
					}
				}
				break;
			}

			default:
				// Unsupported ORM type – should not happen unless new type is added and not handled
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		// If last log is not found, we need to check if there is any running log
		// If there is a running log, that means that the timer is still running
		// since previous day, so, we need to stop it saving the time and start new
		// timer for the current day
		if (!lastLog) {
			const runningLog = (await this.getRunningLogs()) as ITimeLog;
			if (runningLog) {
				const newTimerStartedAt = moment.utc(todayStart || moment().startOf('day'));

				// Ensure that the new timer won't be started in the past
				if (moment(runningLog.startedAt).isBefore(newTimerStartedAt)) {
					// Stop the current running log and save the time at end of day
					const stoppedAt = moment(runningLog.startedAt).endOf('day').subtract(1, 'millisecond').toDate();
					await this.stopTimer({
						tenantId,
						organizationId,
						startedAt: runningLog.startedAt,
						stoppedAt,
						timeZone: request?.timeZone
					});

					// Add small delta to avoid overlap
					const safeStart = moment
						.max(moment(newTimerStartedAt), moment(stoppedAt).add(1, 'millisecond'))
						.toDate();

					// Start new timer for the current day
					lastLog = await this.startTimer({
						tenantId,
						organizationId,
						projectId: runningLog.projectId,
						taskId: runningLog.taskId,
						description: runningLog.description,
						logType: runningLog.logType,
						source: runningLog.source,
						tags: (runningLog.tags ?? []).map((tag) => tag.id),
						isBillable: runningLog.isBillable,
						startedAt: safeStart,
						timeZone: request?.timeZone
					});
				}
			}
		}

		const now = moment();

		// If the timer is running, ensure that the employee is assigned to the project/task of the running timer
		if (lastLog?.isRunning) {
			const projects = await this._organizationProjectService.findByEmployee(employeeId, {
				tenantId,
				organizationId,
				relations: ['members']
			});
			const isAssignedToProject = projects.some((project) => project.id === lastLog.projectId);

			if (!isAssignedToProject) {
				await this.stopTimer({
					tenantId,
					organizationId,
					startedAt: lastLog.startedAt,
					stoppedAt: now.toDate(),
					timeZone: request?.timeZone
				});
				throw new ForbiddenException(TimeErrorsEnum.INVALID_PROJECT_PERMISSIONS);
			}

			const tasks = await this._taskService.getAllTasksByEmployee(employeeId, {
				where: {
					id: lastLog.taskId,
					projectId: lastLog.projectId,
					organizationId,
					tenantId
				},
				take: 1,
				skip: 0,
				withDeleted: false,
				order: {
					createdAt: SortOrderEnum.DESC
				}
			});
			const isAssignedToTask = tasks.some((task) => task.id === lastLog.taskId);

			if (!isAssignedToTask) {
				await this.stopTimer({
					tenantId,
					organizationId,
					startedAt: lastLog.startedAt,
					stoppedAt: now.toDate(),
					timeZone: request?.timeZone
				});
				throw new ForbiddenException(TimeErrorsEnum.INVALID_TASK_PERMISSIONS);
			}
		}

		// Get weekly statistics
		const weeklyLimitStatus = await this._timerWeeklyLimitService.checkWeeklyLimit(
			employee,
			start as Date,
			request?.timeZone,
			true
		);

		// If the user reached the weekly limit, then stop the current timer
		let lastLogStopped = false;

		// Global map to track timers & new week notifications
		const runningWeeklyLimitTimeouts: Map<string, NodeJS.Timeout> = new Map();
		const weeklyResetTimeouts: Map<string, NodeJS.Timeout> = new Map();

		// Weekly limit exceeded → stop the current timer immediately
		if (lastLog?.isRunning) {
			const remainingWeeklyLimit =
				weeklyLimitStatus.remainWeeklyTime - now.diff(moment(lastLog.stoppedAt), 'seconds');

			if (remainingWeeklyLimit <= 0) {
				lastLogStopped = true;
				lastLog = await this.stopTimer({
					tenantId,
					organizationId,
					startedAt: lastLog.startedAt,
					stoppedAt: now.toDate(), // stop immediately
					timeZone: request?.timeZone
				});

				// Clear any previously scheduled timeout for this employee
				const existingTimeout = runningWeeklyLimitTimeouts.get(employeeId);
				if (existingTimeout) {
					clearTimeout(existingTimeout);
					runningWeeklyLimitTimeouts.delete(employeeId);
				}
			} else if (remainingWeeklyLimit <= 21 * 60) {
				// Less than 21 minutes remaining → schedule a single socket event
				const existingTimeout = runningWeeklyLimitTimeouts.get(employeeId);

				if (!existingTimeout) {
					const timeout = setTimeout(() => {
						// Attempt to send timer update via socket; do not send event if socket not connected
						this._socketService.sendTimerChanged(employeeId);

						runningWeeklyLimitTimeouts.delete(employeeId);
					}, remainingWeeklyLimit * 1000); // convert seconds to milliseconds

					runningWeeklyLimitTimeouts.set(employeeId, timeout);
				}
			} else {
				// More than 21 minutes remaining → clear any old timeout
				const existingTimeout = runningWeeklyLimitTimeouts.get(employeeId);
				if (existingTimeout) {
					clearTimeout(existingTimeout);
					runningWeeklyLimitTimeouts.delete(employeeId);
				}
			}
		}

		// Weekly reset event (minimal load)
		if (!weeklyResetTimeouts.has(employeeId)) {
			const nowLocal = moment.tz(request?.timeZone);
			const nextMonday = nowLocal.clone().startOf('isoWeek').add(1, 'week');
			const msUntilNextMondayEvent = nextMonday.diff(nowLocal) - 21 * 60 * 1000; // 20 min before Monday

			if (msUntilNextMondayEvent <= 0 && nextMonday.diff(nowLocal) > 0) {
				const timeout = setTimeout(() => {
					this._socketService.sendTimerChanged(employeeId);
					weeklyResetTimeouts.delete(employeeId);
				}, msUntilNextMondayEvent);
				weeklyResetTimeouts.set(employeeId, timeout);
			}
		}

		// Prepare the timer status object
		const status: ITimerStatusWithWeeklyLimits = {
			duration: 0,
			running: false,
			lastLog: null,
			reWeeklyLimit: employee.reWeeklyLimit,
			workedThisWeek: weeklyLimitStatus.workedThisWeek || 0
		};

		status.lastLog = lastLog;
		status.running = lastLog?.isRunning;
		// Calculate completed timelogs duration
		status.duration += logs.filter(Boolean).reduce((sum, log) => sum + log.duration, 0);

		// Calculate last TimeLog duration
		if (lastLog) {
			// Include the last log into duration if it's running or was stopped
			if (status.running || lastLogStopped) {
				const started = moment(lastLog.startedAt);
				const until = lastLogStopped ? moment(lastLog.stoppedAt) : now;

				// Ensure that duration is cut at today's midnight (local timezone)
				const todayMidnight = moment.tz(request?.timeZone).startOf('day');
				const effectiveStart = started.isBefore(todayMidnight) ? todayMidnight : started;
				status.duration += Math.abs(until.diff(effectiveStart, 'seconds'));

				// Add the last log duration to workedThisWeek regardless of running/stopped
				status.workedThisWeek += Math.abs(until.diff(started, 'seconds'));
			}
		}

		return status;
	}

	/**
	 * Check timelogs running object for periodic time log save
	 * The end time will be updated to allow the UI to reflect the time saved
	 *
	 * @param lastLog
	 * @returns
	 */
	async checkForPeriodicSave(lastLog: TimeLog) {
		// Check if periodic time save is enabled and the timer is valid and running for the source WEB_TIMER
		if (!env.periodicTimeSave || !lastLog || !lastLog.isRunning || lastLog.source !== TimeLogSourceEnum.WEB_TIMER)
			return;

		const now = moment();
		const durationSinceLastEndTime = Math.abs(now.diff(moment(lastLog.stoppedAt), 'seconds'));
		if (durationSinceLastEndTime > env.periodicTimeSaveTimeframe) {
			const newStoppedAt = now.toDate();
			const partialTimeLog: Partial<ITimeLog> = {
				stoppedAt: newStoppedAt
			};
			await this._commandBus.execute(new TimeLogUpdateCommand(partialTimeLog, lastLog.id));
		}
	}

	/**
	 * Implementation of start timer logic
	 * This is intended to be used directly by the command handler
	 *
	 * @param request The timer toggle input details.
	 * @returns A Promise resolving to the created ITimeLog entry.
	 */
	async startTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		console.log(
			`-------------Start Timer Request (${moment.utc(request.startedAt).toDate()})-------------`,
			JSON.stringify(request)
		);

		// Destructure the necessary parameters from the request
		const {
			source,
			logType,
			projectId,
			taskId,
			organizationContactId,
			organizationTeamId,
			description,
			isBillable,
			version
		} = request;

		// Retrieve the tenant ID from the current context or the provided one in the request
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;

		// Determine the start date and time in UTC
		const startedAt = moment.utc(request.startedAt ?? moment.utc()).toDate();
		this.logger.verbose(`New timer started at: ${startedAt}`);

		// Retrieve the employee information
		const employee = await this.findEmployee();

		// Throw an exception if the employee is not found or tracking is disabled
		if (!employee.isTrackingEnabled) {
			throw new ForbiddenException(`The time tracking functionality has been disabled for you.`);
		}

		// Get the employee ID
		const { id: employeeId, organizationId } = employee;

		// Validate assigned task
		if (taskId && projectId) {
			const tasks = await this._taskService.getAllTasksByEmployee(employeeId, {
				where: {
					id: taskId,
					projectId,
					organizationId,
					tenantId
				},
				take: 1,
				skip: 0,
				withDeleted: false,
				order: {
					createdAt: SortOrderEnum.DESC
				}
			});
			const isAssignedToTask = tasks.some((task) => task.id === taskId);
			if (!isAssignedToTask) {
				throw new ForbiddenException(TimeErrorsEnum.INVALID_TASK_PERMISSIONS);
			}
		}

		// Validate assigned project
		if (projectId) {
			const projects = await this._organizationProjectService.findByEmployee(employeeId, {
				tenantId,
				organizationId,
				relations: ['members']
			});
			const isAssignedToProject = projects.some((project) => project.id === projectId);
			if (!isAssignedToProject) {
				throw new ForbiddenException(TimeErrorsEnum.INVALID_PROJECT_PERMISSIONS);
			}
		}

		// Stop any previous running timers
		await this.stopPreviousRunningTimers(employeeId, organizationId, tenantId);

		// Check if the employee has reached the weekly limit
		await this._timerWeeklyLimitService.checkWeeklyLimit(employee, startedAt, request?.timeZone);

		// Check for conflicting time logs
		// Creating a temporary/fake time log object with only the required fields
		// This is used to detect any overlapping/conflicting logs for the employee
		// forceDelete = true ensures that any conflicts are resolved by deleting overlapping logs
		await this.handleConflictingTimeLogs(
			{
				...({} as ITimeLog), // fake object with only required fields
				id: null, // no existing log to ignore, as this is a new entry
				startedAt,
				stoppedAt: startedAt, // using startedAt as stoppedAt because duration is zero
				employeeId,
				organizationId
			},
			tenantId,
			organizationId,
			true // forceDelete: remove all conflicting logs
		);

		// Create a new time log entry using the command bus
		const timeLog = await this._commandBus.execute(
			new TimeLogCreateCommand({
				organizationId,
				tenantId,
				employeeId,
				startedAt,
				stoppedAt: startedAt,
				duration: 0,
				source: source || TimeLogSourceEnum.WEB_TIMER,
				logType: logType || TimeLogType.TRACKED,
				projectId: projectId || null,
				taskId: taskId || null,
				organizationContactId: organizationContactId || null,
				organizationTeamId: organizationTeamId || null,
				description: description || null,
				isBillable: isBillable || false,
				version: version || null,
				isRunning: true
			})
		);

		// Update the employee's tracking status to reflect they are now tracking time
		await this._employeeService.update(employeeId, {
			isOnline: true,
			isTrackingTime: true
		});

		this.logger.verbose(`Last created time log: ${JSON.stringify(timeLog)}`);

		// Send a real-time event to the specified user via socket.
		// No error is thrown if the user is not currently connected.
		this._socketService.sendTimerChanged(employeeId);

		// Return the newly created time log entry
		return timeLog;
	}

	/**
	 * Implementation of stop timer logic
	 * This is intended to be used directly by the command handler
	 */
	async stopTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		console.log(
			`-------------Stop Timer Request (${moment.utc(request.stoppedAt).toDate()})-------------`,
			JSON.stringify(request)
		);

		// Validate the date range and check if the timer is running
		validateDateRange(request.startedAt, request.stoppedAt);

		// Fetch the employee details
		const employee = await this.findEmployee();
		// Check if time tracking is enabled for the employee
		if (!employee.isTrackingEnabled) {
			throw new ForbiddenException('The time tracking functionality has been disabled for you.');
		}

		// Retrieve tenant ID
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
		// Retrieve the employee ID and organization ID
		const { id: employeeId, organizationId } = employee;

		// Retrieve the last running log
		const includeTimeSlots = true;
		let lastLog = await this.getLastRunningLog(includeTimeSlots);

		// If no running log is found, throw a NotAcceptableException
		if (!lastLog) {
			this.logger.warn(`No running log found. Can't stop timer because it was already stopped.`);
			throw new NotAcceptableException(`No running log found. Can't stop timer because it was already stopped.`);
		}

		// Check if the employee has reached the weekly limit
		const weeklyLimitStatus = await this._timerWeeklyLimitService.checkWeeklyLimit(
			employee,
			lastLog.startedAt,
			request?.timeZone,
			true
		);
		this.logger.verbose(`Remaining weekly limit: ${weeklyLimitStatus.remainWeeklyTime}`);

		// Calculate stoppedAt date or use current date if not provided
		let stoppedAt = await this.calculateStoppedAt(request, lastLog);
		stoppedAt = this._timerWeeklyLimitService.adjustStoppedAtBasedOnWeeklyLimit(
			stoppedAt,
			lastLog,
			weeklyLimitStatus.remainWeeklyTime
		);
		this.logger.verbose(`Last stopped at: ${stoppedAt}`);

		// Log the case where stoppedAt is less than startedAt
		if (stoppedAt < lastLog.startedAt) {
			this.logger.warn(
				`stoppedAt (${stoppedAt}) is less than startedAt (${lastLog.startedAt}), skipping stoppedAt update.`
			);
		}

		// Calculate the duration of the log in seconds
		const duration = moment(stoppedAt).diff(moment(lastLog.startedAt), 'seconds');

		// Handle zero-duration logs
		if (duration <= 0) {
			this.logger.verbose('Skipping 0-duration time log');
			try {
				await this._commandBus.execute(new TimeLogDeleteCommand(lastLog, {}, true));
				this.logger.verbose(`Deleted zero-duration TimeLog ${lastLog.id}`);
			} catch (e) {
				this.logger.error(`Failed to delete zero-duration TimeLog ${lastLog.id}`, e);
				throw new InternalServerErrorException(`Failed to delete zero-duration time log.`);
			}
			return lastLog;
		}

		// Determine start and stop day boundaries using the user's local timezone
		// ⚠️ Added logic to handle cases where the web app was closed or inactive,
		// ensuring proper handling of timers that span across midnight
		const tz = request.timeZone || 'UTC';
		const startDay = moment.tz(lastLog.startedAt, tz).startOf('day');
		const stopDay = moment.tz(stoppedAt, tz).startOf('day');

		// Split logs if the time spans across multiple days
		if (!startDay.isSame(stopDay)) {
			const endOfStartDay = startDay.clone().endOf('day').subtract(4, 'seconds');
			const startOfNextDay = stopDay.clone().startOf('day');

			// Update the first log to end at the end of the start day
			const firstLog = await this._commandBus.execute(
				new TimeLogUpdateCommand(
					{ isRunning: false, stoppedAt: endOfStartDay.toDate() },
					lastLog.id,
					request.manualTimeSlot
				)
			);
			await this.handleConflictingTimeLogs(firstLog, tenantId, organizationId, true);

			// Create a new log for the next day starting at the beginning of that day
			const secondLog = await this._commandBus.execute(
				new TimeLogCreateCommand({
					employeeId,
					organizationId,
					tenantId,
					projectId: lastLog.projectId,
					taskId: lastLog.taskId,
					source: lastLog.source,
					startedAt: startOfNextDay.toDate(),
					stoppedAt,
					isRunning: false,
					logType: TimeLogType.TRACKED
				})
			);
			await this.handleConflictingTimeLogs(secondLog, tenantId, organizationId, true);

			this.logger.verbose('Time log was split over midnight and conflicts checked for both parts');

			return lastLog;
		}

		// Construct the update payload, conditionally excluding stoppedAt if it shouldn't be updated
		const partialTimeLog: Partial<ITimeLog> = {
			isRunning: false,
			...(stoppedAt >= lastLog.startedAt && { stoppedAt }) // Only include stoppedAt if it's valid
		};

		this.logger.verbose(`Partial time log: ${JSON.stringify(partialTimeLog)}`);

		// Execute the command to update the time log entry
		lastLog = await this._commandBus.execute(
			new TimeLogUpdateCommand(partialTimeLog, lastLog.id, request.manualTimeSlot)
		);

		if (!lastLog || lastLog.isRunning) {
			this.logger.error(
				`Failed to stop timer for log ${lastLog?.id}. Payload: ${JSON.stringify(partialTimeLog)}`
			);
			throw new InternalServerErrorException(`Failed to stop timer. Please try again.`);
		}

		// Update the employee's tracking status to reflect they are now tracking time
		await this._employeeService.update(employeeId, {
			isOnline: false, // Employee status (Online/Offline)
			isTrackingTime: false // Employee time tracking status
		});

		// Stop previous running timers
		await this.stopPreviousRunningTimers(employeeId, organizationId, tenantId);

		// Handle conflicting time logs
		await this.handleConflictingTimeLogs(lastLog, tenantId, organizationId, true);

		// Send a real-time event to the specified user via socket.
		// No error is thrown if the user is not currently connected.
		this._socketService.sendTimerChanged(employeeId);

		// Return the last log
		return lastLog;
	}

	/**
	 * Handles any conflicting time logs that overlap with the current time log entry.
	 *
	 * @param lastLog The last running time log entry.
	 * @param tenantId The tenant ID.
	 * @param organizationId The organization ID.
	 * @param forceDelete Flag indicating whether to force delete the conflicts.
	 */
	private async handleConflictingTimeLogs(
		lastLog: ITimeLog,
		tenantId: ID,
		organizationId: ID,
		forceDelete = false
	): Promise<void> {
		try {
			// Validate the date range and check if the timer is running
			validateDateRange(lastLog.startedAt, lastLog.stoppedAt);

			// Retrieve conflicting time logs
			const conflicts = await this._commandBus.execute(
				new IGetConflictTimeLogCommand({
					ignoreId: lastLog.id,
					startDate: lastLog.startedAt,
					endDate: lastLog.stoppedAt,
					employeeId: lastLog.employeeId,
					organizationId: organizationId || lastLog.organizationId,
					tenantId
				})
			);

			if (!conflicts?.length) {
				return;
			}

			this.logger.verbose('Conflicting Time Logs:', conflicts, {
				ignoreId: lastLog.id,
				startDate: lastLog.startedAt,
				endDate: lastLog.stoppedAt,
				employeeId: lastLog.employeeId,
				organizationId: organizationId || lastLog.organizationId,
				tenantId
			});

			// Loop through each conflicting time log
			for await (const timeLog of conflicts) {
				if (!timeLog) {
					this.logger.warn('Skipping null TimeLog from conflicts query');
					continue;
				}

				try {
					// Delete conflicting time slots
					await this._commandBus.execute(new TimeLogDeleteCommand(timeLog, {}, forceDelete));
					this.logger.verbose(`Deleted conflicting TimeLog ${timeLog.id}`);
				} catch (e) {
					this.logger.error(`Failed to delete conflicting TimeLog ${timeLog.id}`, e);
					throw new InternalServerErrorException(`Failed to delete conflicting TimeLog ${timeLog.id}`);
				}
			}
		} catch (error) {
			this.logger.error('Error while handling conflicts in time logs', error);
			throw error;
		}
	}

	/**
	 * Calculates the stoppedAt time for the current time log based on the request and the last running time log.
	 * It adjusts the stoppedAt time based on various conditions, such as the time log source (e.g., DESKTOP) and time slots.
	 *
	 * - If the source is DESKTOP and the last time slot was created more than 10 minutes ago,
	 *   the stoppedAt time is adjusted based on the last time slot's duration.
	 * - If no time slots exist and the last log's startedAt time exceeds 10 minutes from the current time,
	 *   the stoppedAt time is adjusted by 10 seconds from the startedAt time.
	 *
	 * @param {ITimerToggleInput} request - The input data for stopping the timer, including stoppedAt and source.
	 * @param {ITimeLog} lastLog - The last running time log, which may include time slots for more detailed tracking.
	 * @returns {Promise<Date>} - A promise that resolves to the calculated stoppedAt date, adjusted as necessary.
	 */
	async calculateStoppedAt(request: ITimerToggleInput, lastLog: ITimeLog): Promise<Date> {
		// Retrieve stoppedAt date or default to the current date if not provided
		let stoppedAt = moment.utc(request.stoppedAt ?? moment.utc()).toDate();

		// Handle the DESKTOP source case
		if (request.source === TimeLogSourceEnum.DESKTOP) {
			// Retrieve the most recent time slot from the last log
			lastLog.timeSlots?.sort((a: ITimeSlot, b: ITimeSlot) => moment(b.startedAt).diff(a.startedAt));
			const lastTimeSlot: ITimeSlot | undefined = lastLog.timeSlots?.[0];
			// Example:
			// If lastLog.timeSlots = [{ startedAt: "2024-09-24 19:50:00", duration: 600 }, { startedAt: "2024-09-24 19:40:00", duration: 600 }]
			// The sorted result will be [{ startedAt: "2024-09-24 19:50:00", duration: 600 }, { startedAt: "2024-09-24 19:40:00", duration: 600 }]
			// Hence, lastTimeSlot will be the one with startedAt = "2024-09-24 19:50:00".

			// Check if the last time slot was created more than 10 minutes ago
			if (lastTimeSlot) {
				// Retrieve the last time slot's startedAt date
				const lastTimeSlotStartedAt = moment.utc(lastTimeSlot.startedAt);

				// Retrieve the request stopped moment
				const requestStoppedAt = moment.utc(stoppedAt);

				// Retrieve the last time slot's duration
				const duration = lastTimeSlot.duration;

				// Example:
				// If lastTimeSlotStartedAt = "2024-09-24 19:50:00" and duration = 600 (10 minutes)
				// and the current time is "2024-09-24 20:10:00", the difference is 20 minutes, which is more than 10 minutes.

				// Check if the last time slot was created more than 10 minutes ago
				if (requestStoppedAt.diff(lastTimeSlotStartedAt, 'minutes') > 10) {
					// Calculate the potential stoppedAt time using the total duration
					stoppedAt = lastTimeSlotStartedAt.add(duration, 'seconds').toDate();
					// Example: stoppedAt = "2024-09-24 20:00:00"
				}
			} else {
				// Retrieve the last log's startedAt date
				const lastLogStartedAt = moment.utc(lastLog.startedAt);

				// Example:
				// If lastLog.startedAt = "2024-09-24 19:30:00" and there are no time slots,
				// and the current time is "2024-09-24 20:00:00", the difference is 30 minutes.

				// If no time slots exist and the difference is more than 10 minutes, adjust the stoppedAt
				if (moment.utc().diff(lastLogStartedAt, 'minutes') > 10) {
					stoppedAt = moment.utc(lastLog.startedAt).add(10, 'seconds').toDate();
					// Example: stoppedAt will be "2024-09-24 19:30:10"
				}
			}
		}

		this.logger.verbose(`Last calculated stoppedAt: ${stoppedAt}`);
		// Example log output: "Last calculated stoppedAt: 2024-09-24 20:00:00"
		return stoppedAt;
	}

	/**
	 * Toggle time tracking start/stop
	 *
	 * @param request The timer toggle request input
	 * @returns The started or stopped TimeLog
	 */
	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		// Retrieve the last running time log
		const lastLog = await this.getLastRunningLog();

		// Start a new timer if no running log exists, otherwise stop the current timer
		if (!lastLog) {
			return this.startTimer(request);
		} else {
			return this.stopTimer(request);
		}
	}

	/**
	 * Stops all previous running timers for the specified employee.
	 *
	 * @param employeeId - The ID of the employee whose timers need to be stopped
	 * @param organizationId - The ID of the organization to which the employee belongs
	 * @param tenantId - The ID of the tenant context
	 */
	async stopPreviousRunningTimers(employeeId: ID, organizationId: ID, tenantId: ID): Promise<void> {
		try {
			this.logger.verbose('Stopping previous running timers...');
			// Retrieve any existing running logs for the employee
			const logs = await this.getLastRunningLogs();
			this.logger.verbose(`Last Running Logs Count: ${logs.length}`);

			// If there are existing running logs, stop them before starting a new one
			if (logs.length > 0) {
				// Execute the ScheduleTimeLogEntriesCommand to stop all previous running timers
				await this._commandBus.execute(new ScheduleTimeLogEntriesCommand(employeeId, organizationId, tenantId));
			}
			this.logger.verbose('Stopped previous running timers...');
		} catch (error) {
			// Log the error or handle it appropriately
			this.logger.error('Failed to stop previous running timers', error);
		}
	}

	/**
	 * Retrieves the current employee record based on the user and tenant context.
	 *
	 * @returns The employee record if found.
	 * @throws NotFoundException if the employee record is not found.
	 */
	async findEmployee(): Promise<IEmployee> {
		const userId = RequestContext.currentUserId(); // Get the current user ID
		const tenantId = RequestContext.currentTenantId(); // Get the current tenant ID

		// Fetch the employee record using userId and tenantId
		const employee = await this._employeeService.findOneByUserId(userId, { where: { tenantId } });

		if (!employee) {
			throw new NotFoundException('Employee record not found. Please verify your details and try again.');
		}

		return employee;
	}

	/**
	 * Get the last running log or all pending running logs for the current employee
	 *
	 * @param fetchAll - Set to `true` to fetch all pending logs, otherwise fetch the last running log
	 * @param includeTimeSlots - Set to `true` to include the associated time slots in the result
	 * @returns A single time log if `fetchAll` is `false`, or an array of time logs if `fetchAll` is `true`
	 */
	private async getRunningLogs(fetchAll = false, includeTimeSlots = false): Promise<ITimeLog | ITimeLog[]> {
		const tenantId = RequestContext.currentTenantId(); // Retrieve the tenant ID from the current context

		// Extract employeeId and organizationId
		const { id: employeeId, organizationId } = await this.findEmployee();

		// Define common query conditions
		const whereClause = {
			employeeId,
			tenantId,
			organizationId,
			isRunning: true,
			stoppedAt: Not(IsNull()) // Logs should have a non-null `stoppedAt`
		};

		// Determine whether to fetch a single log or multiple logs
		return fetchAll
			? await this.typeOrmTimeLogRepository.find({
					where: whereClause,
					order: { startedAt: SortOrderEnum.DESC, createdAt: SortOrderEnum.DESC }
			  })
			: await this.typeOrmTimeLogRepository.findOne({
					where: whereClause,
					order: { startedAt: SortOrderEnum.DESC, createdAt: SortOrderEnum.DESC },
					// Determine relations if includeTimeSlots is true
					...(includeTimeSlots && { relations: { timeSlots: true } })
			  });
	}

	/**
	 * Get the employee's last running timer log
	 *
	 * @returns The last running ITimeLog entry for the current employee
	 */
	private async getLastRunningLog(includeTimeSlots = false): Promise<ITimeLog> {
		// Retrieve the last running log by using the `getRunningLogs` method with `fetchAll` set to false
		const lastRunningLog = await this.getRunningLogs(false, includeTimeSlots);

		// Ensure that the returned log is of type ITimeLog
		return lastRunningLog as ITimeLog;
	}

	/**
	 * Get all pending running logs for the current employee
	 *
	 * @returns An array of pending time logs
	 */
	private async getLastRunningLogs(): Promise<ITimeLog[]> {
		// Retrieve the last running log by using the `getRunningLogs` method with `fetchAll` set to false
		const logs = await this.getRunningLogs(true);

		// Ensure that the returned logs are of type ITimeLog[]
		return logs as ITimeLog[];
	}

	/**
	 * Get timer worked status
	 *
	 * @param request The input parameters for the query.
	 * @returns The timer status for the employee.
	 */
	public async getTimerWorkedStatus(request: ITimerStatusInput): Promise<ITimerStatus[]> {
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
		const { organizationId, organizationTeamId, source } = request;

		// Define the array to store employeeIds
		let employeeIds: ID[] = [];

		const permissions = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW];

		// Check if the current user has any of the specified permissions
		if (RequestContext.hasAnyPermission(permissions)) {
			// Set employeeIds based on request.employeeIds or request.employeeId
			employeeIds = (request.employeeIds ?? [request.employeeId]).filter(Boolean);
		} else {
			// EMPLOYEE have the ability to see only their own timer status
			employeeIds = [RequestContext.currentEmployeeId()];
		}

		let lastLogs: TimeLog[] = [];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				{
					const knex = this.mikroOrmTimeLogRepository.getKnex();

					// Construct your SQL query using knex
					let sqlQuery = knex('time_log').select(knex.raw('DISTINCT ON ("time_log"."employeeId") *'));

					// Builds an SQL query with specific where clauses.
					sqlQuery.whereNotNull('startedAt');
					sqlQuery.whereNotNull('stoppedAt');
					sqlQuery.whereIn('employeeId', employeeIds);
					sqlQuery.andWhere({
						tenantId,
						organizationId,
						isActive: true,
						isArchived: false
					});

					if (source) {
						sqlQuery = sqlQuery.andWhere({ source });
					}
					if (organizationTeamId) {
						sqlQuery = sqlQuery.andWhere({ organizationTeamId });
					}

					// Adds ordering to the SQL query.
					sqlQuery = sqlQuery.orderBy([
						{ column: 'employeeId', order: SortOrderEnum.ASC },
						{ column: 'startedAt', order: SortOrderEnum.DESC },
						{ column: 'createdAt', order: SortOrderEnum.DESC }
					]);

					// Execute the raw SQL query and get the results
					const rawResults: TimeLog[] = (await knex.raw(sqlQuery)).rows || [];
					const timeLogIds = rawResults.map((entry: TimeLog) => entry.id);

					// Converts TypeORM find options to a format compatible with MikroORM for a given entity.
					const { mikroOptions } = parseTypeORMFindToMikroOrm<TimeLog>({
						...(request.relations ? { relations: request.relations } : {})
					});

					// Get last logs group by employees (running or completed);
					lastLogs = (
						await this.mikroOrmTimeLogRepository.find({ id: { $in: timeLogIds } }, mikroOptions)
					).map((item: TimeLog) => wrapSerialize(item));
				}
				break;
			case MultiORMEnum.TypeORM:
				{
					/**
					 * Get last logs (running or completed)
					 */
					const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
					query.setFindOptions({
						...(request['relations'] ? { relations: request['relations'] } : {})
					});
					query.where({
						startedAt: Not(IsNull()),
						stoppedAt: Not(IsNull()),
						employeeId: In(employeeIds),
						tenantId,
						organizationId,
						isActive: true,
						isArchived: false,
						...(isNotEmpty(source) ? { source } : {}),
						...(isNotEmpty(organizationTeamId) ? { organizationTeamId } : {})
					});
					query.orderBy(p(`"${query.alias}"."employeeId"`), SortOrderEnum.ASC); // Adjust ORDER BY to match the SELECT list
					query.addOrderBy(p(`"${query.alias}"."startedAt"`), SortOrderEnum.DESC);
					query.addOrderBy(p(`"${query.alias}"."createdAt"`), SortOrderEnum.DESC);

					// Get last logs group by employees (running or completed)
					lastLogs = await query.distinctOn([p(`"${query.alias}"."employeeId"`)]).getMany();
				}
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		/** Transform an array of ITimeLog objects into an array of ITimerStatus objects. */
		const statistics: ITimerStatus[] = lastLogs.map((lastLog: ITimeLog) => {
			const duration = lastLog?.duration ?? 0;
			const running = lastLog?.isRunning ?? false;
			const stoppedAt = lastLog?.stoppedAt ? moment(lastLog.stoppedAt) : moment().subtract(1, 'day'); // Default to 1 day ago if stoppedAt is not present

			// Calculate the timer status
			const statusByStoppedAt = moment().diff(stoppedAt, 'days') > 0 ? 'idle' : 'pause';
			const timerStatus = running ? 'running' : statusByStoppedAt;

			return {
				duration,
				running,
				lastLog: lastLog ?? null,
				timerStatus,
				reWeeklyLimit: lastLog?.employee?.reWeeklyLimit ?? 0,
				workedThisWeek: 0
			};
		});

		/**
		 * @returns An array of ITimerStatus objects.
		 */
		return statistics;
	}
}
