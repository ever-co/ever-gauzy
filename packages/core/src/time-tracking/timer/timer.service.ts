import {
	Injectable,
	NotFoundException,
	ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, IsNull, Between, Not } from 'typeorm';
import * as moment from 'moment';
import {
	TimeLogType,
	ITimerStatus,
	IGetTimeLogConflictInput,
	ITimerToggleInput,
	IDateRange,
	TimeLogSourceEnum,
	ITimerStatusInput,
	ITimeLog,
	PermissionsEnum,
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Employee, TimeLog } from './../../core/entities/internal';
import { RequestContext } from '../../core/context';
import { getDateRange } from './../../core/utils';
import {
	DeleteTimeSpanCommand,
	IGetConflictTimeLogCommand,
	ScheduleTimeLogEntriesCommand,
	TimeLogCreateCommand,
	TimeLogUpdateCommand,
} from './../time-log/commands';

@Injectable()
export class TimerService {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		private readonly commandBus: CommandBus
	) {}

	async getTimerStatus(request: ITimerStatusInput): Promise<ITimerStatus> {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		let employee = await this.employeeRepository.findOneBy({
			userId,
			tenantId,
		});

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			) &&
			isNotEmpty(request.employeeId)
		) {
			employee = await this.employeeRepository.findOneBy({
				id: request.employeeId,
				tenantId,
			});
		}

		if (!employee) {
			throw new NotFoundException(
				"We couldn't find the employee you were looking for."
			);
		}

		const { id: employeeId } = employee;
		const { start, end } = getDateRange();

		// Get today's completed timelogs
		const logs = await this.timeLogRepository.find({
			join: {
				alias: 'timeLog',
				innerJoin: {
					timeSlots: 'timeLog.timeSlots',
				},
			},
			where: {
				deletedAt: IsNull(),
				source: request.source || TimeLogSourceEnum.WEB_TIMER,
				startedAt: Between(start, end),
				stoppedAt: Not(IsNull()),
				employeeId,
				tenantId,
				organizationId: request.organizationId,
				isRunning: false,
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC',
			},
		});

		// Get today's last log (running or completed)
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
				source: request.source || TimeLogSourceEnum.WEB_TIMER,
				startedAt: Between(start, end),
				stoppedAt: Not(IsNull()),
				employeeId,
				tenantId,
				organizationId: request.organizationId,
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC',
			},
			...(request['relations']
				? {
						relations: request['relations'],
				  }
				: {}),
			relationLoadStrategy: 'query',
		});

		const status: ITimerStatus = {
			duration: 0,
			running: false,
			lastLog: null,
		};

		// Calculate completed timelogs duration
		status.duration += logs
			.filter(Boolean)
			.reduce((sum, log) => sum + log.duration, 0);

		// Calculate last TimeLog duration
		if (lastLog) {
			console.log(
				'----------------------------------Timer Status----------------------------------',
				lastLog.isRunning
			);
			status.lastLog = lastLog;
			status.running = lastLog.isRunning;
			if (status.running) {
				status.duration += Math.abs(
					moment().diff(moment(lastLog.startedAt), 'seconds')
				);
			}
		}
		return status;
	}

	async startTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

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

		console.log('Start Timer Request', {
			request,
			lastLog,
		});

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

		const {
			source,
			projectId,
			taskId,
			organizationContactId,
			logType,
			description,
			isBillable,
			organizationId,
			startedAt,
			stoppedAt,
		} = request;
		const timeStarted = startedAt ? startedAt : moment.utc().toDate();
		const timeStopped = stoppedAt ? stoppedAt : moment.utc().toDate();

		return await this.commandBus.execute(
			new TimeLogCreateCommand({
				organizationId,
				tenantId,
				employeeId,
				startedAt: timeStarted,
				stoppedAt: timeStopped,
				duration: 0,
				source: source || TimeLogSourceEnum.WEB_TIMER,
				projectId: projectId || null,
				taskId: taskId || null,
				organizationContactId: organizationContactId || null,
				logType: logType || TimeLogType.TRACKED,
				description: description || null,
				isBillable: isBillable || false,
				version: request.version || null,
				isRunning: true,
			})
		);
	}

	async stopTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		const tenantId = RequestContext.currentTenantId();

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

		console.log('Stop Timer Request', {
			request,
			lastLog,
		});
		const stoppedAt = request.stoppedAt
			? request.stoppedAt
			: moment.utc().toDate();
		lastLog = await this.commandBus.execute(
			new TimeLogUpdateCommand(
				{ stoppedAt, isRunning: false },
				lastLog.id,
				request.manualTimeSlot
			)
		);

		console.log('Stop Timer Updated Time Log', {
			lastLog,
		});

		const conflicts = await this.commandBus.execute(
			new IGetConflictTimeLogCommand({
				ignoreId: lastLog.id,
				startDate: lastLog.startedAt,
				endDate: lastLog.stoppedAt,
				employeeId: lastLog.employeeId,
				organizationId:
					request.organizationId || lastLog.organizationId,
				tenantId,
			} as IGetTimeLogConflictInput)
		);
		console.log('Get Conflicts Time Logs', conflicts);
		if (isNotEmpty(conflicts)) {
			const times: IDateRange = {
				start: new Date(lastLog.startedAt),
				end: new Date(lastLog.stoppedAt),
			};
			if (isNotEmpty(conflicts)) {
				for await (const timeLog of conflicts) {
					const { timeSlots = [] } = timeLog;
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(
							new DeleteTimeSpanCommand(times, timeLog, timeSlot)
						);
					}
				}
			}
		}
		return lastLog;
	}

	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		const lastLog = await this.getLastRunningLog(request);
		if (!lastLog) {
			return this.startTimer(request);
		} else {
			return this.stopTimer(request);
		}
	}

	/*
	 * Get employee last running timer
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
				deletedAt: IsNull(),
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

	public async getTimerWorkedStatus(request: ITimerStatusInput) {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		let employee = await this.employeeRepository.findOneBy({
			userId,
			tenantId,
		});

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			) &&
			isNotEmpty(request.employeeId)
		) {
			employee = await this.employeeRepository.findOneBy({
				id: request.employeeId,
				tenantId,
			});
		}
		if (!employee) {
			throw new NotFoundException(
				"We couldn't find the employee you were looking for."
			);
		}

		const { id: employeeId } = employee;
		const status: ITimerStatus = {
			duration: 0,
			running: false,
			lastLog: null,
		};
		/**
		 * Get last log (running or completed)
		 */
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
				source: request.source || TimeLogSourceEnum.WEB_TIMER,
				startedAt: Not(IsNull()),
				stoppedAt: Not(IsNull()),
				employeeId,
				tenantId,
				organizationId: request.organizationId,
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC',
			},
			...(request['relations']
				? {
						relations: request['relations'],
				  }
				: {}),
			relationLoadStrategy: 'query',
		});
		/**
		 * calculate last timelog duration
		 */
		if (lastLog) {
			status.lastLog = lastLog;
			status.running = lastLog.isRunning;
			status.duration = lastLog.duration;
		}
		return status;
	}
}
