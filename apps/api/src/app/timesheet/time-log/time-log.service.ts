import {
	Injectable,
	BadRequestException,
	forwardRef,
	Inject
} from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RequestContext } from '../../core/context';
import {
	TimeLogType,
	IManualTimeInput,
	IGetTimeLogInput,
	RolesEnum
} from '@gauzy/models';
import * as moment from 'moment';
import { CrudService } from '../../core';
import { TimeSheetService } from '../timesheet/timesheet.service';
import { TimeSlotService } from '../time-slot.service';

@Injectable()
export class TimeLogService extends CrudService<TimeLog> {
	constructor(
		@Inject(forwardRef(() => TimeSheetService))
		private readonly timesheetService: TimeSheetService,

		@Inject(forwardRef(() => TimeSlotService))
		private readonly timeSlotService: TimeSlotService,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {
		super(timeLogRepository);
	}

	async getTimeLogs(request: IGetTimeLogInput, role?: RolesEnum) {
		let employeeId: string | string[];
		if (role === RolesEnum.ADMIN) {
			if (request.employeeId) {
				employeeId = request.employeeId;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeId = user.employeeId;
		}

		const logs = await this.timeLogRepository.find({
			join: {
				alias: 'time_logs',
				innerJoin: {
					employee: 'time_logs.employee'
				}
			},
			relations: [
				'project',
				'task',
				'client',
				...(role === RolesEnum.ADMIN
					? ['employee', 'employee.organization', 'employee.user']
					: [])
			],
			where: (qb) => {
				qb.where({
					deletedAt: null
				});
				if (request.timesheetId) {
					qb.andWhere('"timesheetId" = :timesheetId', {
						timesheetId: request.timesheetId
					});
				}
				if (request.startDate && request.endDate) {
					const startDate = moment(request.startDate).format(
						'YYYY-MM-DD HH:mm:ss'
					);
					const endDate = moment(request.endDate).format(
						'YYYY-MM-DD HH:mm:ss'
					);
					qb.andWhere('"startedAt" Between :startDate AND :endDate', {
						startDate,
						endDate
					});
				}
				qb.andWhere('"deletedAt" IS NULL');
				if (employeeId) {
					if (employeeId instanceof Array) {
						qb.andWhere('"employeeId" IN (:...employeeId)', {
							employeeId: employeeId
						});
					} else {
						qb.andWhere('"employeeId" = :employeeId', {
							employeeId
						});
					}
				}
				if (request.organizationId) {
					qb.andWhere(
						'"employee"."organizationId" = :organizationId',
						{ organizationId: request.organizationId }
					);
				}
				if (request.activityLevel) {
					// qb.andWhere('"overall" BETWEEN :start AND :end', request.activityLevel);
				}
				if (request.source) {
					if (request.source instanceof Array) {
						qb.andWhere('"source" IN (:...source)', {
							source: request.source
						});
					} else {
						qb.andWhere('"source" = :source', {
							source: request.source
						});
					}
				}
				if (request.logType) {
					if (request.logType instanceof Array) {
						qb.andWhere('"logType" IN (:...logType)', {
							logType: request.logType
						});
					} else {
						qb.andWhere('"logType" = :logType', {
							logType: request.logType
						});
					}
				}
			}
		});
		return logs;
	}

	async addManualTime(request: IManualTimeInput): Promise<TimeLog> {
		if (!request.startedAt || !request.stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}

		const confict = await this.checkConfictTime(
			request,
			request.employeeId
		);
		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			request.employeeId,
			request.startedAt
		);

		let newTimeLog: TimeLog;
		if (!confict) {
			newTimeLog = await this.timeLogRepository.save({
				startedAt: request.startedAt,
				stoppedAt: request.stoppedAt,
				timesheetId: timesheet.id,
				isBilled: false,
				employeeId: request.employeeId,
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
				employeeId: request.employeeId,
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
		const timeLog = await this.timeLogRepository.findOne(request.id);

		const confict = await this.checkConfictTime(
			request,
			timeLog.employeeId
		);

		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			timeLog.employeeId,
			request.startedAt
		);

		if (!confict) {
			const timeSlots = this.timeSlotService.generateTimeSlots(
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
					startedAt: request.startedAt,
					stoppedAt: request.stoppedAt,
					timesheetId: timesheet.id,
					projectId: request.projectId || null,
					taskId: request.taskId || null,
					clientId: request.clientId || null,
					logType: TimeLogType.MANUAL,
					description: request.description || '',
					isBillable: request.isBillable || false
				}
			);

			const startTimes = timeSlots
				.filter((timeslot) => {
					return (
						updateTimeSlots.filter(
							(newSlot) =>
								newSlot.startedAt.getTime() ===
								timeslot.startedAt.getTime()
						).length === 0
					);
				})
				.map((timeslot) => new Date(timeslot.startedAt));

			if (startTimes.length > 0) {
				await this.timeSlotService.delete({
					employeeId: timeLog.employeeId,
					startedAt: In(startTimes)
				});
			}

			updateTimeSlots = updateTimeSlots.map((slot) => ({
				...slot,
				employeeId: timeLog.employeeId,
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

		// const employee = await this.employeeRepository.findOne(
		// 	user.employeeId,
		// 	{
		// 		relations: ['organization']
		// 	}
		// );

		// if (!employee.organization || !employee.organization.allowManualTime) {
		// 	throw new UnauthorizedException(
		// 		'You have not sufficient permission to add time'
		// 	);
		// }

		if (typeof ids === 'string') {
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
