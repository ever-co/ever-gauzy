import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IsNull, Between, Not, In } from 'typeorm';
import * as moment from 'moment';
import {
	TimeLogType,
	ITimerStatus,
	ITimerToggleInput,
	IDateRange,
	TimeLogSourceEnum,
	ITimerStatusInput,
	ITimeLog,
	PermissionsEnum,
	ITimeSlot,
	IEmployee,
	IEmployeeFindInput,
	ID
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
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
	DeleteTimeSpanCommand,
	IGetConflictTimeLogCommand,
	ScheduleTimeLogEntriesCommand,
	TimeLogCreateCommand,
	TimeLogUpdateCommand
} from '../time-log/commands';
import { MikroOrmTimeLogRepository, TypeOrmTimeLogRepository } from '../time-log/repository';
import { TypeOrmEmployeeRepository, MikroOrmEmployeeRepository } from '../../employee/repository';
import { addRelationsToQuery, buildCommonQueryParameters, buildLogQueryParameters } from './timer.helper';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

@Injectable()
export class TimerService {
	protected ormType: MultiORM = ormType;

	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _commandBus: CommandBus
	) { }

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

	/**
	 * Get timer status
	 *
	 * @param request
	 * @returns
	 */
	async getTimerStatus(request: ITimerStatusInput): Promise<ITimerStatus> {
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
			startedAt: Between<Date>(start as Date, end as Date),
			stoppedAt: Not(IsNull()),
			employeeId,
			tenantId,
			organizationId
		};

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				/**
				 * Get today's completed timelogs
				 */
				const parseQueryParams = parseTypeORMFindToMikroOrm<TimeLog>(buildLogQueryParameters(queryParams));
				const items = await this.mikroOrmTimeLogRepository.findAll(parseQueryParams);
				// Optionally wrapSerialize is a function that serializes the entity
				logs = items.map((entity: TimeLog) => wrapSerialize(entity)) as TimeLog[];

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
				break;

			case MultiORMEnum.TypeORM:
				// Get today's completed timelogs
				logs = await this.typeOrmTimeLogRepository.find(buildLogQueryParameters(queryParams));

				const lastLogQueryParamsTypeOrm = buildCommonQueryParameters(queryParams); // Common query parameters for time log operations.
				addRelationsToQuery(lastLogQueryParamsTypeOrm, request); // Adds relations from the request to the query parameters.

				// Get today's last log (running or completed)
				lastLog = await this.typeOrmTimeLogRepository.findOne(lastLogQueryParamsTypeOrm);
				break;

			default:
				throw new Error(`Not implemented for ${ormType}`);
		}

		const status: ITimerStatus = {
			duration: 0,
			running: false,
			lastLog: null
		};

		// Calculate completed timelogs duration
		status.duration += logs.filter(Boolean).reduce((sum, log) => sum + log.duration, 0);

		// Calculate last TimeLog duration
		if (lastLog) {
			status.lastLog = lastLog;
			status.running = lastLog.isRunning;

			if (status.running) {
				status.duration += Math.abs(moment().diff(moment(lastLog.startedAt), 'seconds'));
			}
		}

		return status;
	}

	/**
	 * Start time tracking for an employee.
	 *
	 * @param request The timer toggle input details.
	 * @returns A Promise resolving to the created ITimeLog entry.
	 */
	async startTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		console.log(
			'----------------------------------Started Timer Date----------------------------------',
			moment.utc(request.startedAt).toDate()
		);

		// Retrieve the tenant ID from the current context or the provided one in the request
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

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

		// Retrieve the employee information
		const employee = await this.findEmployee();

		// Throw an exception if the employee is not found or tracking is disabled
		if (!employee.isTrackingEnabled) {
			throw new ForbiddenException(`The time tracking functionality has been disabled for you.`);
		}

		// Get the employee ID
		const { id: employeeId, organizationId } = employee;

		try {
			// Retrieve any existing running logs for the employee
			const logs = await this.getLastRunningLogs();

			// If there are existing running logs, stop them before starting a new one
			if (logs.length > 0) {
				await this.stopPreviousRunningTimers(employeeId, organizationId, tenantId);
			}
		} catch (error) {
			console.error('Error while getting last running logs', error);
		}

		// Determine the start date and time in UTC
		const startedAt = request.startedAt ? moment.utc(request.startedAt).toDate() : moment.utc().toDate();

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

		// Return the newly created time log entry
		return timeLog;
	}

	/**
	 * Stop time tracking for the current employee.
	 *
	 * @param request The input data for stopping the timer.
	 * @returns A Promise resolving to the updated ITimeLog entry.
	 */
	async stopTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		console.log(
			'----------------------------------Stopped Timer Date----------------------------------',
			moment.utc(request.stoppedAt).toDate()
		);

		// Retrieve tenant ID
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		// Fetch the employee details
		const employee = await this.findEmployee();

		// Check if time tracking is enabled for the employee
		if (!employee.isTrackingEnabled) {
			throw new ForbiddenException('The time tracking functionality has been disabled for you.');
		}

		// Retrieve the last running log or start a new timer if none exist
		let lastLog = await this.getLastRunningLog();
		if (!lastLog) {
			console.log('No running log found. Starting a new timer before stopping it.');
			lastLog = await this.startTimer(request);
		}

		const organizationId = employee.organizationId ?? lastLog.organizationId;
		const stoppedAt = moment.utc(request.stoppedAt ?? moment.utc()).toDate();

		// Validate the date range
		validateDateRange(lastLog.startedAt, stoppedAt);

		// Update the time log entry to mark it as stopped
		lastLog = await this._commandBus.execute(
			new TimeLogUpdateCommand(
				{
					stoppedAt,
					isRunning: false
				},
				lastLog.id,
				request.manualTimeSlot
			)
		);
		console.log('Stop Timer Time Log', { lastLog });

		// Update the employee's tracking status
		await this._employeeService.update(employee.id, {
			isOnline: false, // Employee status (Online/Offline)
			isTrackingTime: false // Employee time tracking status
		});

		// Handle conflicting time logs
		await this.handleConflictingTimeLogs(lastLog, tenantId, organizationId);

		return lastLog;
	}

	/**
	 * Handles any conflicting time logs that overlap with the current time log entry.
	 *
	 * @param lastLog The last running time log entry.
	 * @param tenantId The tenant ID.
	 * @param organizationId The organization ID.
	 */
	private async handleConflictingTimeLogs(
		lastLog: ITimeLog,
		tenantId: ID,
		organizationId: ID
	): Promise<void> {
		try {
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

			console.log('Conflicting Time Logs:', conflicts, {
				ignoreId: lastLog.id,
				startDate: lastLog.startedAt,
				endDate: lastLog.stoppedAt,
				employeeId: lastLog.employeeId,
				organizationId: organizationId || lastLog.organizationId,
				tenantId
			});

			if (isNotEmpty(conflicts)) {
				const times: IDateRange = {
					start: new Date(lastLog.startedAt),
					end: new Date(lastLog.stoppedAt)
				};

				// Delete conflicting time slots
				await Promise.all(
					conflicts.flatMap((timeLog: ITimeLog) => {
						const { timeSlots = [] } = timeLog;
						return timeSlots.map((timeSlot: ITimeSlot) =>
							this._commandBus.execute(new DeleteTimeSpanCommand(times, timeLog, timeSlot))
						);
					})
				);
			}
		} catch (error) {
			console.error('Error while handling conflicts in time logs:', error);
		}
	}

	/**
	 * Toggle time tracking start/stop
	 *
	 * @param request
	 * @returns
	 */
	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		const lastLog = await this.getLastRunningLog();
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
			// Execute the ScheduleTimeLogEntriesCommand to stop all previous running timers
			await this._commandBus.execute(new ScheduleTimeLogEntriesCommand(
				employeeId,
				organizationId,
				tenantId
			));
		} catch (error) {
			// Log the error or handle it appropriately
			console.log('Failed to stop previous running timers:', error);
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
	 * @returns A single time log if `fetchAll` is `false`, or an array of time logs if `fetchAll` is `true`
	 */
	private async getRunningLogs(fetchAll: boolean = false): Promise<ITimeLog | ITimeLog[]> {
		const tenantId = RequestContext.currentTenantId(); // Retrieve the tenant ID from the current context

		// Extract employeeId and organizationId
		const { id: employeeId, organizationId } = await this.findEmployee();

		// Define common query conditions
		const whereClause = {
			employeeId,
			tenantId,
			organizationId,
			isRunning: true,
			stoppedAt: Not(IsNull()), // Logs should have a non-null `stoppedAt`
		};

		// Determine whether to fetch a single log or multiple logs
		return fetchAll
			? await this.typeOrmTimeLogRepository.find({
				where: whereClause,
				order: { startedAt: 'DESC', createdAt: 'DESC' }
			})
			: await this.typeOrmTimeLogRepository.findOne({
				where: whereClause,
				order: { startedAt: 'DESC', createdAt: 'DESC' }
			});
	}

	/**
	 * Get the employee's last running timer log
	 *
	 * @returns The last running ITimeLog entry for the current employee
	 */
	private async getLastRunningLog(): Promise<ITimeLog> {
		// Retrieve the last running log by using the `getRunningLogs` method with `fetchAll` set to false
		const lastRunningLog = await this.getRunningLogs();

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
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, organizationTeamId, source } = request;

		// Define the array to store employeeIds
		let employeeIds: ID[] = [];

		const permissions = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW];

		// Check if the current user has any of the specified permissions
		if (RequestContext.hasAnyPermission(permissions)) {
			// If yes, set employeeIds based on request.employeeIds or request.employeeId
			employeeIds = request.employeeIds
				? request.employeeIds.filter(Boolean)
				: [request.employeeId].filter(Boolean);
		} else {
			// EMPLOYEE have the ability to see only their own timer status
			const employeeId = RequestContext.currentEmployeeId();
			employeeIds = [employeeId];
		}

		let lastLogs: TimeLog[] = [];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
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
					{ column: 'employeeId', order: 'ASC' },
					{ column: 'startedAt', order: 'DESC' },
					{ column: 'createdAt', order: 'DESC' }
				]);

				// Execute the raw SQL query and get the results
				const rawResults: TimeLog[] = (await knex.raw(sqlQuery.toString())).rows || [];
				const timeLogIds = rawResults.map((entry: TimeLog) => entry.id);

				// Converts TypeORM find options to a format compatible with MikroORM for a given entity.
				const { mikroOptions } = parseTypeORMFindToMikroOrm<TimeLog>({
					...(request.relations ? { relations: request.relations } : {})
				});

				// Get last logs group by employees (running or completed);
				lastLogs = (await this.mikroOrmTimeLogRepository.find({ id: { $in: timeLogIds } }, mikroOptions)).map(
					(item: TimeLog) => wrapSerialize(item)
				);
				break;
			case MultiORMEnum.TypeORM:
				/**
				 * Get last logs (running or completed)
				 */
				const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
				// query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');
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
				query.orderBy(p(`"${query.alias}"."employeeId"`), 'ASC'); // Adjust ORDER BY to match the SELECT list
				query.addOrderBy(p(`"${query.alias}"."startedAt"`), 'DESC');
				query.addOrderBy(p(`"${query.alias}"."createdAt"`), 'DESC');

				// Get last logs group by employees (running or completed)
				lastLogs = await query.distinctOn([p(`"${query.alias}"."employeeId"`)]).getMany();
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
			const timerStatus = running ? 'running' : moment().diff(stoppedAt, 'days') > 0 ? 'idle' : 'pause';

			return {
				duration,
				running,
				lastLog: lastLog ?? null,
				timerStatus
			};
		});

		/**
		 * @returns An array of ITimerStatus objects.
		 */
		return statistics;
	}
}
