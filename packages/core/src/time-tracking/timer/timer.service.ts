import { Injectable, NotFoundException, NotAcceptableException } from '@nestjs/common';
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
	ITimeLog
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
	TimeLogUpdateCommand
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

		const employee = await this.employeeRepository.findOneBy({
			userId,
			tenantId
		});

		if (!employee) {
			throw new NotFoundException('Employee not found.');
		}

		const { organizationId, id: employeeId } = employee;
		const { start, end } = getDateRange();

		// Get today's completed timelogs
		const logs = await this.timeLogRepository.find({
			join: {
				alias: 'timeLog',
				innerJoin: {
					timeSlots: 'timeLog.timeSlots'
				}
			},
			where: {
				deletedAt: IsNull(),
				employeeId,
				source: request.source || TimeLogSourceEnum.BROWSER,
				startedAt: Between(start, end),
				stoppedAt: Not(IsNull()),
				tenantId,
				organizationId,
				isRunning: false
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC'
			}
		});

		// Get today's last log (running or completed)
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
				employeeId,
				source: request.source || TimeLogSourceEnum.BROWSER,
				startedAt: Between(start, end),
				stoppedAt: Not(IsNull()),
				tenantId,
				organizationId
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC'
			}
		});

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

	async startTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		const employee = await this.employeeRepository.findOneBy({
			userId,
			tenantId
		});
		if (!employee) {
			throw new NotFoundException('Employee not found.');
		}

		const { organizationId, id: employeeId } = employee;
		const lastLog = await this.getLastRunningLog();

		console.log('Start Timer Request', {
			request,
			lastLog
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

		const now = moment.utc().toDate();
		const { source, projectId, taskId, organizationContactId, logType, description, isBillable } = request;
		const timeLog = {
			organizationId,
			tenantId,
			employeeId,
			startedAt: now,
			stoppedAt: now,
			duration: 0,
			source: source || TimeLogSourceEnum.BROWSER,
			projectId: projectId || null,
			taskId: taskId || null,
			organizationContactId: organizationContactId || null,
			logType: logType || TimeLogType.TRACKED,
			description: description || null,
			isBillable: isBillable || false,
			isRunning: true
		};

		return await this.commandBus.execute(
			new TimeLogCreateCommand(timeLog)
		);
	}

	async stopTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		const { organizationId } = request;
		const tenantId = RequestContext.currentTenantId();

		let lastLog = await this.getLastRunningLog();
		if (!lastLog) {
			/**
			 * If you want to stop timer, but employee timer is already stopped.
			 * So, we have to first create start timer entry in database, then update stop timer entry.
			 * It will manage to create proper entires in database
			 */
			await this.startTimer(request);
			lastLog = await this.getLastRunningLog();
		}

		console.log('Stop Timer Request', {
			request,
			lastLog
		});
		const stoppedAt = moment.utc().toDate();
		lastLog = await this.commandBus.execute(
			new TimeLogUpdateCommand(
				{ stoppedAt, isRunning: false },
				lastLog.id,
				request.manualTimeSlot
			)
		);

		console.log('Stop Timer Updated Time Log', {
			lastLog
		});

		const conflicts = await this.commandBus.execute(
			new IGetConflictTimeLogCommand({
				ignoreId: lastLog.id,
				startDate: lastLog.startedAt,
				endDate: lastLog.stoppedAt,
				employeeId: lastLog.employeeId,
				organizationId: organizationId || lastLog.organizationId,
				tenantId
			} as IGetTimeLogConflictInput)
		);
		console.log('Get Conflicts Time Logs', conflicts);
		if (isNotEmpty(conflicts)) {
			const times: IDateRange = {
				start: new Date(lastLog.startedAt),
				end: new Date(lastLog.stoppedAt)
			};
			if (isNotEmpty(conflicts)) {
				for await (const timeLog of conflicts) {
					const { timeSlots = [] } = timeLog;
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(
							new DeleteTimeSpanCommand(
								times,
								timeLog,
								timeSlot
							)
						);
					}
				}
			}
		}
		return lastLog;
	}

	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		const lastLog = await this.getLastRunningLog();
		if (!lastLog) {
			return this.startTimer(request);
		} else {
			return this.stopTimer(request);
		}
	}

	/*
	* Get employee last running timer
	*/
	private async getLastRunningLog() {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		const employee = await this.employeeRepository.findOne({
			where: {
				userId,
				tenantId
			},
			relations: {
				user: true
			}
		});
		if (!employee) {
			throw new NotFoundException('Employee not found.');
		}
		if (!employee.isTrackingEnabled) {
			throw new NotAcceptableException(`Time tracker has been disabled for ${employee.fullName}`);
		}
		const { organizationId, id: employeeId } = employee;
		return await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
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
}
