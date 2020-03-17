import { Injectable } from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../core/context';
import { Employee } from '../../employee';
import { TimeLogType } from '@gauzy/models';

@Injectable()
export class TimerService {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	async getTimerStatus(): Promise<TimeLog> {
		const user = RequestContext.currentUser();
		const employee = await this.employeeRepository.findOne({
			userId: user.id
		});
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				employeeId: employee.id
			},
			order: {
				startedAt: 'DESC'
			}
		});

		return lastLog;
	}

	async toggleTimeLog(request): Promise<TimeLog> {
		const user = RequestContext.currentUser();
		const employee = await this.employeeRepository.findOne({
			userId: user.id
		});
		const lastLog = await this.timeLogRepository.findOne({
			where: {
				employeeId: employee.id
			},
			order: {
				startedAt: 'DESC'
			}
		});
		let newTimeLog: TimeLog;
		if (lastLog.stoppedAt) {
			newTimeLog = await this.timeLogRepository.create({
				duration: 0,
				isBilled: false,
				startedAt: new Date(),
				employeeId: employee.id,
				timesheetId: null,
				projectId: request.projectId || null,
				taskId: request.taskId || null,
				clientId: request.clientId || null,
				logType: request.logType || TimeLogType.TRAKED,
				description: request.description || '',
				isBillable: request.isBillable || false
			});
		} else {
			const stoppedAt = new Date();
			const diffTime = Math.abs(
				stoppedAt.getTime() - lastLog.startedAt.getTime()
			);
			const duration = Math.ceil(diffTime / (1000 * 60));
			await this.timeLogRepository.update(lastLog.id, {
				stoppedAt,
				duration
			});
			newTimeLog = await this.timeLogRepository.findOne(lastLog.id);
		}
		return newTimeLog;
	}
}
