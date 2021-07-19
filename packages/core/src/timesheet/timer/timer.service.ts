import { Injectable, BadRequestException } from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between, Not } from 'typeorm';
import { RequestContext } from '../../core/context';
import { Employee } from '../../employee/employee.entity';
import {
	TimeLogType,
	ITimerStatus,
	IGetTimeLogConflictInput,
	ITimerToggleInput,
	IDateRange,
	TimeLogSourceEnum,
	ITimerStatusInput
} from '@gauzy/contracts';
import * as moment from 'moment';
import { CommandBus } from '@nestjs/cqrs';
import { IGetConflictTimeLogCommand } from '../time-log/commands/get-conflict-time-log.command';
import { TimeLogCreateCommand } from '../time-log/commands/time-log-create.command';
import { DeleteTimeSpanCommand } from '../time-log/commands/delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log/commands/time-log-update.command';

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
		const user = RequestContext.currentUser();
		const { tenantId } = user;
		const employee = await this.employeeRepository.findOne({
			userId: user.id,
			tenantId
		});

		if (!employee) {
			throw new BadRequestException('Employee not found.');
		}

		const { organizationId, id: employeeId } = employee;

		// Get today's completed timelogs
		const logs = await this.timeLogRepository.find({
			where: {
				deletedAt: IsNull(),
				employeeId,
				source: request.source || TimeLogSourceEnum.BROWSER,
				startedAt: Between(
					moment().startOf('day').format(),
					moment().endOf('day').format()
				),
				stoppedAt: Not(IsNull()),
				tenantId,
				organizationId
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
				startedAt: Between(
					moment().startOf('day').format(), 
					moment().endOf('day').format()
				),
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
		if (logs.length > 0) {
			for await (const log of logs) {
				status.duration += log.duration;
			}
		}

		// Calculate last timelog duration
		if (lastLog) {
			status.lastLog = lastLog;
			if (lastLog.stoppedAt) {
				status.running = false;
			} else {
				status.running = true;
				status.duration = Math.abs((lastLog.startedAt.getTime() - new Date().getTime()) / 1000);
			}
		}
		return status;
	}

	async startTimer(request: ITimerToggleInput): Promise<TimeLog> {
		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		const employee = await this.employeeRepository.findOne({
			userId: user.id,
			tenantId
		});
		if (!employee) {
			throw new BadRequestException('Employee not found.');
		}

		const { organizationId, id: employeeId } = employee;
		const lastLog = await this.getLastRunningLog();

		if (lastLog) {
			await this.stopTimer(request);
		}

		const { source, projectId, taskId, organizationContactId, logType, description, isBillable } = request;
		const newTimeLogInput = {
			organizationId,
			tenantId,
			employeeId,
			startedAt: moment.utc().toDate(),
			duration: 0,
			source: source || TimeLogSourceEnum.BROWSER,
			projectId: projectId || null,
			taskId: taskId || null,
			organizationContactId: organizationContactId || null,
			logType: logType || TimeLogType.TRACKED,
			description: description || '',
			isBillable: isBillable || false
		};

		return await this.commandBus.execute(
			new TimeLogCreateCommand(newTimeLogInput)
		);
	}

	async stopTimer(request: ITimerToggleInput): Promise<TimeLog> {
		const { organizationId } = request;
		const tenantId = RequestContext.currentTenantId();

		let lastLog = await this.getLastRunningLog();

		const stoppedAt = new Date();
		if (lastLog.startedAt === stoppedAt) {
			await this.timeLogRepository.delete(lastLog.id);
			return;
		}

		lastLog = await this.commandBus.execute(
			new TimeLogUpdateCommand(
				{ stoppedAt },
				lastLog.id,
				request.manualTimeSlot
			)
		);

		const conflictInput: IGetTimeLogConflictInput = {
			ignoreId: lastLog.id,
			startDate: lastLog.startedAt,
			endDate: lastLog.stoppedAt,
			employeeId: lastLog.employeeId,
			organizationId: organizationId || lastLog.organizationId,
			tenantId
		};

		const conflict = await this.commandBus.execute(
			new IGetConflictTimeLogCommand(conflictInput)
		);

		const times: IDateRange = {
			start: new Date(lastLog.startedAt),
			end: new Date(lastLog.stoppedAt)
		};

		for (let index = 0; index < conflict.length; index++) {
			await this.commandBus.execute(
				new DeleteTimeSpanCommand(times, conflict[index])
			);
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
		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		const employee = await this.employeeRepository.findOne({
			userId: user.id,
			tenantId
		});
		if (!employee) {
			throw new BadRequestException('Employee not found.');
		}

		const { organizationId, id: employeeId } = employee;
		return await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
				stoppedAt: IsNull(),
				employeeId,
				tenantId,
				organizationId
			},
			order: {
				startedAt: 'DESC',
				createdAt: 'DESC'
			}
		});
	}
}
