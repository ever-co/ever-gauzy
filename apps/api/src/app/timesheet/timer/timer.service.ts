import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { RequestContext } from '../../core/context';
import { Employee } from '../../employee/employee.entity';
import { TimeLogType, TimerStatus } from '@gauzy/models';
import * as moment from 'moment';
import { Timesheet } from '../timesheet.entity';
import { TimesheetService } from '../timesheet.service';

@Injectable()
export class TimerService {
	constructor(
		@Inject(forwardRef(() => TimesheetService))
		private readonly timesheetService: TimesheetService,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Timesheet)
		private readonly timesheetRepository: Repository<Timesheet>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	async getTimerStatus(): Promise<TimerStatus> {
		const user = RequestContext.currentUser();
		const employee = await this.employeeRepository.findOne({
			userId: user.id
		});

		const todayLog = await this.timeLogRepository.find({
			where: {
				employeeId: employee.id,
				startedAt: MoreThan(moment().format('YYYY-MM-DD'))
			},
			order: {
				startedAt: 'DESC'
			}
		});
		let stauts: TimerStatus = {
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

	async toggleTimeLog(request): Promise<TimeLog> {
		const user = RequestContext.currentUser();
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				employeeId: user.employeeId
			},
			order: {
				startedAt: 'DESC'
			}
		});

		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			user.employeeId,
			request.startedAt
		);

		let newTimeLog: TimeLog;
		if (!lastLog || lastLog.stoppedAt) {
			newTimeLog = await this.timeLogRepository.save({
				duration: 0,
				timesheetId: timesheet.id,
				isBilled: false,
				startedAt: new Date(),
				employeeId: user.employeeId,
				projectId: request.projectId || null,
				taskId: request.taskId || null,
				clientId: request.clientId || null,
				logType: request.logType || TimeLogType.TRACKED,
				description: request.description || '',
				isBillable: request.isBillable || false
			});
		} else {
			const stoppedAt = new Date();
			const diffTime = Math.abs(
				stoppedAt.getTime() - lastLog.startedAt.getTime()
			);
			const duration = Math.ceil(diffTime / 1000);
			await this.timeLogRepository.update(lastLog.id, {
				stoppedAt,
				duration
			});

			await this.timesheetRepository.update(timesheet.id, { duration });
			newTimeLog = await this.timeLogRepository.findOne(lastLog.id);
		}
		return newTimeLog;
	}
}
