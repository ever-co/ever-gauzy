import { Injectable, BadRequestException } from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { RequestContext } from '../../core/context';
import { Employee } from '../../employee/employee.entity';
import {
	TimeLogType,
	TimerStatus,
	IManualTimeInput,
	IGetTimeLogInput
} from '@gauzy/models';
import * as moment from 'moment';
import { Timesheet } from '../timesheet.entity';

@Injectable()
export class TimerService {
	constructor(
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

		const timesheet = await this.createOrFindTimeSheet(employee);
		let newTimeLog: TimeLog;
		if (!lastLog || lastLog.stoppedAt) {
			newTimeLog = await this.timeLogRepository.save({
				duration: 0,
				timesheetId: timesheet.id,
				isBilled: false,
				startedAt: new Date(),
				employeeId: employee.id,
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

	async addManualTime(request: IManualTimeInput): Promise<TimeLog> {
		if (!request.startedAt || !request.stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}

		const user = RequestContext.currentUser();
		const employee = await this.employeeRepository.findOne({
			userId: user.id
		});
		const confict = await this.timeLogRepository
			.createQueryBuilder()
			.where('"employeeId" = :employeeId', { employeeId: employee.id })
			.andWhere(
				`("startedAt", "stoppedAt") OVERLAPS (\'${moment(
					request.startedAt
				).format('YYYY-MM-DD HH:ss')}\', \'${moment(
					request.stoppedAt
				).format('YYYY-MM-DD HH:ss')}\')`
			)
			.getOne();

		const timesheet = await this.createOrFindTimeSheet(
			employee,
			request.startedAt
		);
		let newTimeLog: TimeLog;
		if (!confict) {
			const duration = moment(request.stoppedAt).diff(
				request.startedAt,
				'seconds'
			);
			newTimeLog = await this.timeLogRepository.save({
				duration,
				startedAt: request.startedAt,
				stoppedAt: request.stoppedAt,
				timesheetId: timesheet.id,
				isBilled: false,
				employeeId: employee.id,
				projectId: request.projectId || null,
				taskId: request.taskId || null,
				clientId: request.clientId || null,
				logType: TimeLogType.MANUAL,
				description: request.description || '',
				isBillable: request.isBillable || false
			});
			return newTimeLog;
		} else {
			throw new BadRequestException(
				"You can't add add twice for same time."
			);
		}
	}

	private async createOrFindTimeSheet(employee, date: Date = new Date()) {
		const from_date = moment(date).startOf('week');
		const to_date = moment(date).endOf('week');

		let timesheet = await this.timesheetRepository.findOne({
			where: {
				startedAt: Between(from_date, to_date),
				employeeId: employee.id
			}
		});

		if (!timesheet) {
			timesheet = await this.timesheetRepository.save({
				employeeId: employee.id,
				startedAt: from_date.toISOString(),
				stoppedAt: from_date.toISOString()
			});
		}
		return timesheet;
	}

	async getLogs(request: IGetTimeLogInput) {
		let employeeId: any;
		console.log(request);
		const startDate = moment(request.startDate).format(
			'YYYY-MM-DD HH:mm:ss'
		);
		const endDate = moment(request.endDate).format('YYYY-MM-DD HH:mm:ss');

		if (!request.employeeId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne({
				userId: user.id
			});
			employeeId = employee.id;
		} else {
			employeeId = request.employeeId;
		}

		console.log({ startDate, endDate });

		let logs = await this.timeLogRepository.find({
			where: {
				startedAt: Between(startDate, endDate),
				employeeId
			},
			relations: ['project', 'task', 'client']
		});

		return logs;
	}
}
