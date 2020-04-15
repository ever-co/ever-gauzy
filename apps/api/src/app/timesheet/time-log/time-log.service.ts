import {
	Injectable,
	BadRequestException,
	forwardRef,
	Inject,
	UnauthorizedException
} from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository, InjectConnection } from '@nestjs/typeorm';
import { Repository, Between, In, Connection } from 'typeorm';
import { RequestContext } from '../../core/context';
import { TimeLogType, IManualTimeInput, IGetTimeLogInput } from '@gauzy/models';
import * as moment from 'moment';
import { CrudService } from '../../core';
import { TimeSheetService } from '../timesheet.service';
import { Employee } from '../../employee/employee.entity';
import { TimeSlotService } from '../time-slot.service';

@Injectable()
export class TimeLogService extends CrudService<TimeLog> {
	constructor(
		@InjectConnection() private connection: Connection,

		@Inject(forwardRef(() => TimeSheetService))
		private readonly timesheetService: TimeSheetService,

		@Inject(forwardRef(() => TimeSlotService))
		private readonly timeSlotService: TimeSlotService,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
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

		const employee = await this.employeeRepository.findOne(
			user.employeeId,
			{
				relations: ['organization']
			}
		);

		if (!employee.organization || !employee.organization.allowManualTime) {
			throw new UnauthorizedException(
				'You have not sufficient permission to add time'
			);
		}

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

			let timeSlots = this.timeSlotService.generateTimeSlots(
				request.startedAt,
				request.stoppedAt
			);
			timeSlots = timeSlots.map((slot) => ({
				...slot,
				employeeId: user.employeeId,
				keyboard: 0,
				mouse: 0,
				overall: 0
			}));
			await this.timeSlotService.bulkCreate(timeSlots);
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
		const employee = await this.employeeRepository.findOne(
			user.employeeId,
			{
				relations: ['organization']
			}
		);

		if (!employee.organization || !employee.organization.allowModifyTime) {
			throw new UnauthorizedException(
				'You have not sufficient permission to update time'
			);
		}

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

			let timeLog = await this.timeLogRepository.findOne(request.id);
			let timeSlots = this.timeSlotService.generateTimeSlots(
				timeLog.startedAt,
				timeLog.stoppedAt
			);
			let updateTimeSlots = this.timeSlotService.generateTimeSlots(
				request.startedAt,
				request.stoppedAt
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

			let startTimes = timeSlots
				.filter((timeslot) => {
					return (
						updateTimeSlots.filter(
							(newSlot) =>
								newSlot.startedAt.getTime() ==
								timeslot.startedAt.getTime()
						).length == 0
					);
				})
				.map((timeslot) => new Date(timeslot.startedAt));

			console.log({ timeSlots });
			console.log({ updateTimeSlots });
			console.log({ startTimes });

			if (startTimes.length > 0) {
				let deletedData = await this.timeSlotService.delete({
					employeeId: user.employeeId,
					startedAt: In(startTimes)
				});

				console.log({ deletedData });
			}

			updateTimeSlots = updateTimeSlots.map((slot) => ({
				...slot,
				employeeId: user.employeeId,
				keyboard: 0,
				mouse: 0,
				overall: 0
			}));
			await this.timeSlotService.bulkCreate(updateTimeSlots);

			return await this.timeLogRepository.findOne(request.id);
		} else {
			throw new BadRequestException(
				"You can't add add twice for same time."
			);
		}
	}

	async deleteTimeLog(ids: string | string[]): Promise<any> {
		const user = RequestContext.currentUser();

		const employee = await this.employeeRepository.findOne(
			user.employeeId,
			{
				relations: ['organization']
			}
		);

		if (!employee.organization || !employee.organization.allowManualTime) {
			throw new UnauthorizedException(
				'You have not sufficient permission to add time'
			);
		}

		if (typeof ids == 'string') {
			ids = [ids];
		}
		await this.timeLogRepository.update(
			{
				employeeId: user.employeeId,
				id: In(ids)
			},
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
