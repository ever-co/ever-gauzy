import { Injectable, BadRequestException } from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { RequestContext } from '../../core/context';
import { Employee } from '../../employee/employee.entity';
import {
	TimeLogType,
	ITimerStatus,
	IGetTimeLogConflictInput,
	ITimerToggleInput,
	IDateRange
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

	async getTimerStatus(): Promise<ITimerStatus> {
		const user = RequestContext.currentUser();
		const employee = await this.employeeRepository.findOne({
			userId: user.id
		});

		if (!employee) {
			throw new BadRequestException('Employee not found.');
		}

		const todayLog = await this.timeLogRepository.find({
			where: {
				employeeId: employee.id,
				startedAt: MoreThan(moment().format('YYYY-MM-DD'))
			},
			order: {
				startedAt: 'DESC'
			}
		});
		const stauts: ITimerStatus = {
			duration: 0,
			running: false,
			lastLog: null
		};
		if (todayLog.length > 0) {
			const lastLog = todayLog[0];
			stauts.lastLog = lastLog;

			if (lastLog.stoppedAt) {
				stauts.running = false;
			} else {
				stauts.running = true;
				stauts.duration = Math.abs(
					(lastLog.startedAt.getTime() - new Date().getTime()) / 1000
				);
			}
			for (let index = 0; index < todayLog.length; index++) {
				stauts.duration += todayLog[index].duration;
			}
		}
		return stauts;
	}

	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		const user = RequestContext.currentUser();
		let lastLog = await this.timeLogRepository.findOne({
			where: {
				employeeId: user.employeeId,
				stoppedAt: IsNull()
			},
			order: {
				startedAt: 'DESC'
			}
		});

		if (!lastLog) {
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
		} else {
			const stoppedAt = new Date();
			if (lastLog.startedAt === stoppedAt) {
				await this.timeLogRepository.delete(lastLog.id);
				return;
			}

			lastLog = await this.commandBus.execute(
				new TimeLogUpdateCommand({ stoppedAt }, lastLog.id)
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
	}
}
