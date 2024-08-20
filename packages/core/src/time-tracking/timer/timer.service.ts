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
	IEmployeeFindInput
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
		readonly commandBus: CommandBus
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
	 * Start time tracking
	 *
	 * @param request
	 * @returns
	 */
	async startTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		console.log(
			'----------------------------------Started Timer Date----------------------------------',
			moment.utc(request.startedAt).toDate()
		);
		const { organizationId, source, logType } = request;

		/**
		 * If source or logType is not found in the request, reject the request.
		 */
		const c1 = Object.values(TimeLogSourceEnum).includes(source);
		const c2 = Object.values(TimeLogType).includes(logType);

		if (!c1 || !c2) {
			throw new BadRequestException();
		}

		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const employee = await this.typeOrmEmployeeRepository.findOneBy({
			userId,
			tenantId
		});
		if (!employee) {
			throw new NotFoundException("We couldn't find the employee you were looking for.");
		}

		const { id: employeeId } = employee;
		const lastLog = await this.getLastRunningLog(request);

		console.log('Start Timer Time Log', { request, lastLog });

		if (lastLog) {
			/**
			 * If you want to start timer, but employee timer is already started.
			 * So, we have to first update stop timer entry in database, then create start timer entry.
			 * It will manage to create proper entires in database
			 */
			console.log('Schedule Time Log Entries Command', lastLog);
			await this.commandBus.execute(new ScheduleTimeLogEntriesCommand(lastLog));
		}

		await this.typeOrmEmployeeRepository.update(
			{ id: employeeId },
			{
				isOnline: true, // Employee status (Online/Offline)
				isTrackingTime: true // Employee time tracking status
			}
		);

		// Get the request parameters
		const { projectId, taskId, organizationContactId, organizationTeamId } = request;
		const { description, isBillable, version } = request;

		// Get the current date
		const now = moment.utc().toDate();
		const startedAt = request.startedAt ? moment.utc(request.startedAt).toDate() : now;

		// Create the timeLog
		return await this.commandBus.execute(
			new TimeLogCreateCommand({
				organizationId,
				tenantId,
				employeeId,
				startedAt: startedAt,
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
	}

	/**
	 * Stop time tracking
	 *
	 * @param request
	 * @returns
	 */
	async stopTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		console.log(
			'----------------------------------Stopped Timer Date----------------------------------',
			moment.utc(request.stoppedAt).toDate()
		);

		// Get the user ID
		const userId = RequestContext.currentUserId();
		// Get the tenant ID
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		// Get the employee
		const employee = await this.typeOrmEmployeeRepository.findOneBy({
			userId,
			tenantId
		});
		if (!employee) {
			throw new NotFoundException("We couldn't find the employee you were looking for.");
		}

		// Get the employee ID
		const { id: employeeId } = employee;

		// Update the employee
		await this.typeOrmEmployeeRepository.update(
			{ id: employeeId },
			{
				isOnline: false, // Employee status (Online/Offline)
				isTrackingTime: false // Employee time tracking status
			}
		);

		let lastLog = await this.getLastRunningLog(request);
		if (!lastLog) {
			/**
			 * If you want to stop timer, but employee timer is already stopped.
			 * So, we have to first create start timer entry in database, then update stop timer entry.
			 * It will manage to create proper entires in database
			 */
			lastLog = await this.startTimer(request);
		}

		// Get the organization ID
		const organizationId = request.organizationTeamId || employee.organizationId;

		// Get the lastLog
		lastLog = await this.typeOrmTimeLogRepository.findOne({
			where: { id: lastLog.id, tenantId, organizationId, employeeId },
			relations: { timeSlots: true }
		});

		// Calculate the duration and stoppedAt date
		const duration = lastLog.timeSlots.reduce<number>((sum, { duration }) => sum + duration, 0);
		let stoppedAt = moment.utc(lastLog.startedAt).add(duration, 'seconds').toDate();

		// If the minutes difference is greater than 20, update the stoppedAt date
		if (moment.utc().diff(stoppedAt, 'minutes') <= 20) {
			// Get the stoppedAt date
			const now = moment.utc().toDate();
			stoppedAt = moment.utc(request.stoppedAt ?? now).toDate();
		}

		/** Function that performs the date range validation */
		try {
			validateDateRange(lastLog.startedAt, stoppedAt);
		} catch (error) {
			throw new BadRequestException(error);
		}

		// Update the lastLog
		lastLog = await this.commandBus.execute(
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

		try {
			// Get conflicts time logs
			const conflicts = await this.commandBus.execute(
				new IGetConflictTimeLogCommand({
					ignoreId: lastLog.id,
					startDate: lastLog.startedAt,
					endDate: lastLog.stoppedAt,
					employeeId: lastLog.employeeId,
					organizationId: organizationId || lastLog.organizationId,
					tenantId
				})
			);

			console.log('Get Conflicts Time Logs', conflicts, {
				ignoreId: lastLog.id,
				startDate: lastLog.startedAt,
				endDate: lastLog.stoppedAt,
				employeeId: lastLog.employeeId,
				organizationId: request.organizationId || lastLog.organizationId,
				tenantId
			});

			// If there are conflicts, delete them
			if (isNotEmpty(conflicts)) {
				const times: IDateRange = {
					start: new Date(lastLog.startedAt),
					end: new Date(lastLog.stoppedAt)
				};

				// Delete conflicts
				await Promise.all(
					conflicts.flatMap((timeLog: ITimeLog) => {
						const { timeSlots = [] } = timeLog;
						return timeSlots.map((timeSlot: ITimeSlot) =>
							this.commandBus.execute(new DeleteTimeSpanCommand(times, timeLog, timeSlot))
						);
					})
				);
			}
		} catch (error) {
			console.error('Error while deleting time span during conflicts timelogs', error);
		}

		return lastLog;
	}

	/**
	 * Toggle time tracking start/stop
	 *
	 * @param request
	 * @returns
	 */
	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		const lastLog = await this.getLastRunningLog(request);
		if (!lastLog) {
			return this.startTimer(request);
		} else {
			return this.stopTimer(request);
		}
	}

	/**
	 * Get employee last running timer
	 *
	 * @param request
	 * @returns
	 */
	private async getLastRunningLog(request: ITimerToggleInput): Promise<ITimeLog> {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		// Replace 'Employee' with your actual Employee entity type
		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: { userId, tenantId },
			relations: { user: true }
		});

		// If employee is not found, throw a NotFoundException
		if (!employee) {
			throw new NotFoundException("We couldn't find the employee you were looking for.");
		}

		// Employee time tracking status
		if (!employee.isTrackingEnabled) {
			throw new ForbiddenException(`The time tracking functionality has been disabled for you.`);
		}

		// Get the employee ID
		const { id: employeeId } = employee;

		// Get the organization ID
		const organizationId = request.organizationTeamId || employee.organizationId;

		// Return the last running log
		return await this.typeOrmTimeLogRepository.findOne({
			where: {
				stoppedAt: Not(IsNull()),
				employeeId,
				tenantId,
				organizationId,
				isRunning: true
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC'
			}
		});
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
		let employeeIds: string[] = [];

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
