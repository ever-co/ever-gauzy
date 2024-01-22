import {
	Injectable,
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, IsNull, Between, Not, In } from 'typeorm';
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
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Employee, TimeLog } from './../../core/entities/internal';
import { RequestContext } from '../../core/context';
import { getDateRangeFormat, validateDateRange } from './../../core/utils';
import {
	DeleteTimeSpanCommand,
	IGetConflictTimeLogCommand,
	ScheduleTimeLogEntriesCommand,
	TimeLogCreateCommand,
	TimeLogUpdateCommand,
} from './../time-log/commands';
import { prepareSQLQuery as p } from './../../database/database.helper';

@Injectable()
export class TimerService {
	constructor(
		@InjectRepository(TimeLog) private readonly timeLogRepository: Repository<TimeLog>,
		@InjectRepository(Employee) private readonly employeeRepository: Repository<Employee>,
		private readonly commandBus: CommandBus
	) { }

	/**
	 * Get timer status
	 *
	 * @param request
	 * @returns
	 */
	async getTimerStatus(
		request: ITimerStatusInput
	): Promise<ITimerStatus> {
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, source, todayStart, todayEnd } = request;

		let employee: IEmployee;

		/** SUPER_ADMIN have ability to see employees timer status by specific employee (employeeId) */
		const permission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		if (!!permission && isNotEmpty(request.employeeId)) {
			const { employeeId } = request;
			/** Get specific employee */
			employee = await this.employeeRepository.findOneBy({
				id: employeeId,
				tenantId,
				organizationId,
			});
		} else {
			const userId = RequestContext.currentUserId();
			/** EMPLOYEE have ability to see only own timer status */
			employee = await this.employeeRepository.findOneBy({
				userId,
				tenantId,
				organizationId,
			});
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

		// Get today's completed timelogs
		const logs = await this.timeLogRepository.find({
			join: {
				alias: 'time_log',
				innerJoin: {
					timeSlots: 'time_log.timeSlots',
				},
			},
			where: {
				...(source ? { source } : {}),
				startedAt: Between<Date>(start as Date, end as Date),
				stoppedAt: Not(IsNull()),
				employeeId,
				tenantId,
				organizationId,
				isRunning: false,
				isActive: true,
				isArchived: false
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC',
			},
		});

		// Get today's last log (running or completed)
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				...(source ? { source } : {}),
				startedAt: Between<Date>(start as Date, end as Date),
				stoppedAt: Not(IsNull()),
				employeeId,
				tenantId,
				organizationId,
				isActive: true,
				isArchived: false
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC',
			},
			...(request['relations'] ? { relations: request['relations'], } : {}),
		});

		const status: ITimerStatus = {
			duration: 0,
			running: false,
			lastLog: null,
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
		 * If source, logType not found in request then reject the request.
		 */
		const c1 = Object.values(TimeLogSourceEnum).includes(source);
		const c2 = Object.values(TimeLogType).includes(logType);
		if (!c1 || !c2) {
			throw new BadRequestException();
		}

		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const employee = await this.employeeRepository.findOneBy({
			userId,
			tenantId,
		});
		if (!employee) {
			throw new NotFoundException(
				"We couldn't find the employee you were looking for."
			);
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
			await this.commandBus.execute(
				new ScheduleTimeLogEntriesCommand(lastLog)
			);
		}

		await this.employeeRepository.update(
			{ id: employeeId },
			{
				isOnline: true, // Employee status (Online/Offline)
				isTrackingTime: true, // Employee time tracking status
			}
		);

		const {
			projectId,
			taskId,
			organizationContactId,
			organizationTeamId,
			description,
			isBillable,
			version,
		} = request;

		const now = moment.utc().toDate();
		const startedAt = request.startedAt
			? moment.utc(request.startedAt).toDate()
			: now;

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
				isRunning: true,
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
		const { organizationId } = request;

		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const userId = RequestContext.currentUserId();

		const employee = await this.employeeRepository.findOneBy({
			userId,
			tenantId,
		});
		if (!employee) {
			throw new NotFoundException(
				"We couldn't find the employee you were looking for."
			);
		}

		const { id: employeeId } = employee;
		await this.employeeRepository.update(
			{ id: employeeId },
			{
				isOnline: false, // Employee status (Online/Offline)
				isTrackingTime: false, // Employee time tracking status
			}
		);

		let lastLog = await this.getLastRunningLog(request);
		if (!lastLog) {
			/**
			 * If you want to stop timer, but employee timer is already stopped.
			 * So, we have to first create start timer entry in database, then update stop timer entry.
			 * It will manage to create proper entires in database
			 */
			await this.startTimer(request);
			lastLog = await this.getLastRunningLog(request);
		}

		const now = moment.utc().toDate();
		const stoppedAt = request.stoppedAt
			? moment.utc(request.stoppedAt).toDate()
			: now;

		/** Function that performs the date range validation */
		try {
			validateDateRange(lastLog.startedAt, stoppedAt);
		} catch (error) {
			throw new BadRequestException(error);
		}

		lastLog = await this.commandBus.execute(
			new TimeLogUpdateCommand(
				{
					stoppedAt,
					isRunning: false,
				},
				lastLog.id,
				request.manualTimeSlot
			)
		);
		console.log('Stop Timer Time Log', { lastLog });

		try {
			const conflicts = await this.commandBus.execute(
				new IGetConflictTimeLogCommand({
					ignoreId: lastLog.id,
					startDate: lastLog.startedAt,
					endDate: lastLog.stoppedAt,
					employeeId: lastLog.employeeId,
					organizationId: organizationId || lastLog.organizationId,
					tenantId,
				})
			);
			console.log('Get Conflicts Time Logs', conflicts, {
				ignoreId: lastLog.id,
				startDate: lastLog.startedAt,
				endDate: lastLog.stoppedAt,
				employeeId: lastLog.employeeId,
				organizationId:
					request.organizationId || lastLog.organizationId,
				tenantId,
			});
			if (isNotEmpty(conflicts)) {
				const times: IDateRange = {
					start: new Date(lastLog.startedAt),
					end: new Date(lastLog.stoppedAt),
				};
				if (isNotEmpty(conflicts)) {
					await Promise.all(
						await conflicts.map(async (timeLog: ITimeLog) => {
							const { timeSlots = [] } = timeLog;
							timeSlots.map(async (timeSlot: ITimeSlot) => {
								await this.commandBus.execute(
									new DeleteTimeSpanCommand(
										times,
										timeLog,
										timeSlot
									)
								);
							});
						})
					);
				}
			}
		} catch (error) {
			console.error(
				'Error while deleting time span during conflicts timelogs',
				error
			);
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
	private async getLastRunningLog(request: ITimerToggleInput) {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		const employee = await this.employeeRepository.findOne({
			where: {
				userId,
				tenantId,
			},
			relations: {
				user: true,
			},
		});
		if (!employee) {
			throw new NotFoundException(
				"We couldn't find the employee you were looking for."
			);
		}
		if (!employee.isTrackingEnabled) {
			throw new ForbiddenException(
				`The time tracking functionality has been disabled for you.`
			);
		}
		const { id: employeeId } = employee;
		return await this.timeLogRepository.findOne({
			where: {
				stoppedAt: Not(IsNull()),
				employeeId,
				tenantId,
				organizationId: request.organizationId,
				isRunning: true,
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC',
			},
		});
	}

	/**
	 * Get timer worked status
	 *
	 * @param request The input parameters for the query.
	 * @returns The timer status for the employee.
	 */
	public async getTimerWorkedStatus(
		request: ITimerStatusInput
	): Promise<ITimerStatus[]> {
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, organizationTeamId, source } = request;

		// Define the array to store employeeIds
		let employeeIds: string[] = [];

		const permissions = [
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW
		];

		// Check if the current user has any of the specified permissions
		if (RequestContext.hasAnyPermission(permissions)) {
			// If yes, set employeeIds based on request.employeeIds or request.employeeId
			employeeIds = request.employeeIds ? request.employeeIds.filter(Boolean) : [request.employeeId].filter(Boolean);
		} else {
			// EMPLOYEE have the ability to see only their own timer status
			const employeeId = RequestContext.currentEmployeeId();
			employeeIds = [employeeId];
		}

		/**
		 * Get last logs (running or completed)
		 */
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		// query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');
		query.setFindOptions({
			...(request['relations'] ? { relations: request['relations'] } : {}),
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
			...(isNotEmpty(organizationTeamId) ? { organizationTeamId } : {}),
		});
		query.orderBy(p(`"${query.alias}"."employeeId"`), 'ASC'); // Adjust ORDER BY to match the SELECT list
		query.addOrderBy(p(`"${query.alias}"."startedAt"`), 'DESC');
		query.addOrderBy(p(`"${query.alias}"."createdAt"`), 'DESC');

		// Get last logs group by employees (running or completed)
		const lastLogs = await query.distinctOn([p(`"${query.alias}"."employeeId"`)]).getMany();

		/** Transform an array of ITimeLog objects into an array of ITimerStatus objects. */
		const statistics: ITimerStatus[] = lastLogs.map((lastLog: ITimeLog) => {
			return {
				duration: lastLog?.duration || 0,
				running: lastLog?.isRunning || false,
				lastLog: lastLog || null,
				timerStatus: lastLog?.isRunning ? 'running' : moment(lastLog?.stoppedAt).diff(new Date(), 'day') > 0 ? 'idle' : 'pause',
			};
		});

		/**
		 * @returns An array of ITimerStatus objects.
		 */
		return statistics;
	}
}
