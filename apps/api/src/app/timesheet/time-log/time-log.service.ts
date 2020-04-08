import {
	Injectable,
	BadRequestException,
	forwardRef,
	Inject
} from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { RequestContext } from '../../core/context';
import { TimeLogType, IManualTimeInput, IGetTimeLogInput } from '@gauzy/models';
import * as moment from 'moment';
import { CrudService } from '../../core';
import { TimeSheetService } from '../timesheet.service';

@Injectable()
export class TimeLogService extends CrudService<TimeLog> {
	constructor(
		@Inject(forwardRef(() => TimeSheetService))
		private readonly timesheetService: TimeSheetService,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {
		super(timeLogRepository);
	}

	async getTimeLogs(request: IGetTimeLogInput) {
		let employeeId: any;
		const startDate = moment(request.startDate).format(
			'YYYY-MM-DD HH:mm:ss'
		);
		const endDate = moment(request.endDate).format('YYYY-MM-DD HH:mm:ss');

		if (!request.employeeId) {
			const user = RequestContext.currentUser();

			employeeId = user.employeeId;
		} else {
			employeeId = request.employeeId;
		}

		let logs = await this.timeLogRepository.find({
			where: {
				startedAt: Between(startDate, endDate),
				deletedAt: null,
				employeeId
			},
			relations: ['project', 'task', 'client']
		});
		return logs;
	}

	async addManualTime(request: IManualTimeInput): Promise<TimeLog> {
		if (!request.startedAt || !request.stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}

		const user = RequestContext.currentUser();

		const confict = await this.checkConfictTime(request, user.employeeId);
		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			user.employeeId,
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
				employeeId: user.employeeId,
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

	async updateManualTime(request: IManualTimeInput): Promise<TimeLog> {
		if (!request.startedAt || !request.stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}

		const user = RequestContext.currentUser();
		// const employee = await this.employeeRepository.findOne({
		//     userId: user.id
		// });

		const confict = await this.checkConfictTime(request, user.employeeId);

		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			user.employeeId,
			request.startedAt
		);

		if (!confict) {
			const duration = moment(request.stoppedAt).diff(
				request.startedAt,
				'seconds'
			);
			await this.timeLogRepository.update(
				{ id: request.id },
				{
					duration,
					startedAt: request.startedAt,
					stoppedAt: request.stoppedAt,
					timesheetId: timesheet.id,
					employeeId: user.employeeId,
					projectId: request.projectId || null,
					taskId: request.taskId || null,
					clientId: request.clientId || null,
					logType: TimeLogType.MANUAL,
					description: request.description || '',
					isBillable: request.isBillable || false
				}
			);
			return await this.timeLogRepository.findOne(request.id);
		} else {
			throw new BadRequestException(
				"You can't add add twice for same time."
			);
		}
	}

	async deleteTimeLog(ids: string | string[]): Promise<any> {
		if (typeof ids == 'string') {
			ids = [ids];
		}
		await this.timeLogRepository.update(
			{ id: In(ids) },
			{ deletedAt: new Date() }
		);
		return true;
	}

	private async checkConfictTime(
		request: IManualTimeInput,
		employeeId: string
	) {
		let confictQuery = this.timeLogRepository
			.createQueryBuilder()
			.where('"employeeId" = :employeeId', { employeeId: employeeId })
			.andWhere('"deletedAt" = :deletedAt', { deletedAt: null })
			.andWhere(
				`("startedAt", "stoppedAt") OVERLAPS (\'${moment(
					request.startedAt
				).format('YYYY-MM-DD HH:ss')}\', \'${moment(
					request.stoppedAt
				).format('YYYY-MM-DD HH:ss')}\')`
			);
		if (request.id) {
			confictQuery = confictQuery.andWhere('id != :id', {
				id: request.id
			});
		}
		return await confictQuery.getOne();
	}
}
