import { Injectable, BadRequestException } from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between } from 'typeorm';
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
} from '@gauzy/models';
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

		const todayLog = await this.timeLogRepository.find({
			where: {
				deletedAt: IsNull(),
				employeeId: employee.id,
				source: request.source || TimeLogSourceEnum.BROWSER,
				startedAt: Between(
					moment().startOf('day'),
					moment().endOf('day')
				),
				tenantId
			},
			order: {
				startedAt: 'DESC'
			}
		});
		const status: ITimerStatus = {
			duration: 0,
			running: false,
			lastLog: null
		};
		if (todayLog.length > 0) {
			const lastLog = todayLog[0];
			status.lastLog = lastLog;

			if (lastLog.stoppedAt) {
				status.running = false;
			} else {
				status.running = true;
				status.duration = Math.abs(
					(lastLog.startedAt.getTime() - new Date().getTime()) / 1000
				);
			}
			for (let index = 0; index < todayLog.length; index++) {
				status.duration += todayLog[index].duration;
			}
		}
		return status;
	}

	async startTimer(request: ITimerToggleInput): Promise<TimeLog> {
		const user = RequestContext.currentUser();
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
				employeeId: user.employeeId,
				stoppedAt: IsNull()
			},
			order: {
				startedAt: 'DESC'
			}
		});

		if (lastLog) {
			await this.stopTimer(request);
		}

		let organizationId;
		if (!request.organizationId) {
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			organizationId = employee.organizationId;
		} else {
			organizationId = request.organizationId;
		}

		const newTimeLogInput = {
			organizationId,
			tenantId: RequestContext.currentTenantId(),
			startedAt: moment.utc().toDate(),
			duration: 0,
			employeeId: user.employeeId,
			source: request.source || TimeLogSourceEnum.BROWSER,
			projectId: request.projectId || null,
			taskId: request.taskId || null,
			organizationContactId: request.organizationContactId || null,
			logType: request.logType || TimeLogType.TRACKED,
			description: request.description || '',
			isBillable: request.isBillable || false
		};

		return await this.commandBus.execute(
			new TimeLogCreateCommand(newTimeLogInput)
		);
	}

	async stopTimer(request: ITimerToggleInput): Promise<TimeLog> {
		const user = RequestContext.currentUser();
		let lastLog = await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
				employeeId: user.employeeId,
				stoppedAt: IsNull()
			},
			order: {
				startedAt: 'DESC'
			}
		});

		const stoppedAt = new Date();
		if (lastLog.startedAt === stoppedAt) {
			await this.timeLogRepository.delete(lastLog.id);
			return;
		}

		lastLog = await this.commandBus.execute(
			new TimeLogUpdateCommand(
				{ stoppedAt, manualTimeSlot: request.manualTimeSlot },
				lastLog.id
			)
		);

		const conflictInput: IGetTimeLogConflictInput = {
			ignoreId: lastLog.id,
			startDate: lastLog.startedAt,
			endDate: lastLog.stoppedAt,
			employeeId: lastLog.employeeId
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
		const user = RequestContext.currentUser();
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				deletedAt: IsNull(),
				employeeId: user.employeeId,
				stoppedAt: IsNull()
			},
			order: {
				startedAt: 'DESC'
			}
		});

		if (!lastLog) {
			return this.startTimer(request);
		} else {
			return this.stopTimer(request);
		}
	}
}
