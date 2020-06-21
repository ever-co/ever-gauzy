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
	PermissionsEnum,
	IGetTimeLogConflictInput,
	IDateRange
} from '@gauzy/models';
import * as moment from 'moment';
import * as _ from 'underscore';
import { CrudService } from '../../core';
import { TimeSheetService } from '../timesheet/timesheet.service';
import { TimeSlotService } from '../time-slot.service';
import { Organization } from '../../organization/organization.entity';
import { Employee } from '../../employee/employee.entity';

@Injectable()
export class TimeLogService extends CrudService<TimeLog> {
	constructor(
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
		let employeeId: string | string[];

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
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
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
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
				'Please select valid Date, start time and end time'
			);
		}

		const employee = await this.employeeRepository.findOne(
			request.employeeId,
			{ relations: ['organization'] }
		);
		const isDateAllow = this.allowDate(
			request.startedAt,
			request.startedAt,
			employee.organization
		);
		if (!isDateAllow) {
			throw new BadRequestException(
				'Please select valid Date, start time and end time'
			);
		}

		const confict = await this.checkConfictTime({
			employeeId: request.employeeId,
			startDate: request.startedAt,
			endDate: request.stoppedAt,
			...(request.id ? { ignoreId: request.id } : {})
		});

		const times: IDateRange = {
			start: new Date(request.startedAt),
			end: new Date(request.stoppedAt)
		};
		for (let index = 0; index < confict.length; index++) {
			await this.updateConflict(times, confict[index]);
		}

		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			request.employeeId,
			request.startedAt
		);

		let newTimeLog: TimeLog;
		if (confict.length === 0) {
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
		}
		// else {
		// 	throw new BadRequestException(
		// 		"You can't add add twice for same time."
		// 	);
		// }
	}

	async updateManualTime(request: IManualTimeInput): Promise<TimeLog> {
		if (!request.startedAt || !request.stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}
		const employee = await this.employeeRepository.findOne(
			request.employeeId,
			{ relations: ['organization'] }
		);
		const isDateAllow = this.allowDate(
			request.startedAt,
			request.stoppedAt,
			employee.organization
		);

		if (!isDateAllow) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}

		const timeLog = await this.timeLogRepository.findOne(request.id);
		const confict = await this.checkConfictTime({
			employeeId: timeLog.employeeId,
			startDate: request.startedAt,
			endDate: request.stoppedAt,
			...(request.id ? { ignoreId: request.id } : {})
		});

		const times: IDateRange = {
			start: new Date(request.startedAt),
			end: new Date(request.stoppedAt)
		};
		for (let index = 0; index < confict.length; index++) {
			await this.updateConflict(times, confict[index]);
		}

		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			timeLog.employeeId,
			times.start
		);

		const timeSlots = this.timeSlotService.generateTimeSlots(
			timeLog.startedAt,
			timeLog.stoppedAt
		);
		let updateTimeSlots = this.timeSlotService.generateTimeSlots(
			times.start,
			times.end
		);

		await this.timeLogRepository.update(
			{ id: request.id },
			{
				startedAt: times.start,
				stoppedAt: times.end,
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
	}

	async deleteTimeLog(ids: string | string[]): Promise<any> {
		const user = RequestContext.currentUser();
		if (typeof ids === 'string') {
			ids = [ids];
		}
		return await this.timeLogRepository.update(
			{
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? {}
					: { employeeId: user.employeeId }),
				id: In(ids)
			},
			{ deletedAt: new Date() }
		);
	}

	private allowDate(start: Date, end: Date, organization: Organization) {
		if (moment(start).isBefore(moment(end))) {
			return false;
		}
		if (organization.futureDateAllowed) {
			return true;
		}
		return moment(end).isSameOrBefore(moment());
	}

	async updateConflict(newTime: IDateRange, timeLog: TimeLog) {
		console.log('updateConflict', { newTime, timeLog });
		const { start, end } = newTime;
		if (moment(timeLog.startedAt).isBetween(moment(start), moment(end))) {
			if (
				moment(timeLog.stoppedAt).isBetween(moment(start), moment(end))
			) {
				/* Delete time log because overlap entire time.
				 * New Start time							New Stop time
				 *  |----------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 *  			|----------------------------|
				 */
				await this.timeLogRepository.delete({
					id: timeLog.id
				});
			} else {
				/* Update start time I.e
				 * New Start time							New Stop time
				 *  |----------------------------------------------|
				 * 						DB Start Time							DB Stop Time
				 *  							|---------------------------------------|
				 */
				await this.timeLogRepository.update(
					{
						startedAt: end
					},
					{
						id: timeLog.id
					}
				);
			}
		} else {
			if (
				moment(timeLog.stoppedAt).isBetween(moment(start), moment(end))
			) {
				/* Split database time in two entries.
				 * 		New Start time				New Stop time
				 *  			|----------------------------|
				 * DB Start Time									DB Stop Time
				 *  |--------------------------------------------------|
				 */
				await this.timeLogRepository.update(
					{
						stoppedAt: start
					},
					{
						id: timeLog.id
					}
				);

				const newLog = _.omit(timeLog, [
					'createdAt',
					'updatedAt',
					'id'
				]);
				newLog.startedAt = end;
				await this.timeLogRepository.insert(newLog);
			} else {
				/* Update stopped time I.e
				 * 			New Start time							New Stop time
				 *  			|----------------------------------------------|
				 * DB Start Time			DB Stop Time
				 *  	|-----------------------|
				 */
				await this.timeLogRepository.update(
					{
						stoppedAt: end
					},
					{
						id: timeLog.id
					}
				);
			}
		}
		return true;
	}

	async checkConfictTime(request: IGetTimeLogConflictInput) {
		const startedAt = moment(request.startDate).toISOString();
		const stoppedAt = moment(request.endDate).toISOString();
		let confictQuery = this.timeLogRepository.createQueryBuilder();

		confictQuery = confictQuery
			.where(`"${confictQuery.alias}"."employeeId" = :employeeId`, {
				employeeId: request.employeeId
			})
			.andWhere(`"${confictQuery.alias}"."deletedAt" IS null`)
			.andWhere(
				`("${confictQuery.alias}"."startedAt", "${confictQuery.alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`
			);

		if (request.relations) {
			request.relations.forEach((relation) => {
				confictQuery = confictQuery.leftJoinAndSelect(
					`${confictQuery.alias}.${relation}`,
					relation
				); // Get all the ProfilePhoto info
			});
		}

		if (request.ignoreId) {
			confictQuery = confictQuery.andWhere(
				`${confictQuery.alias}.id IN (:...id)`,
				{
					id:
						request.ignoreId instanceof Array
							? request.ignoreId
							: [request.ignoreId]
				}
			);
		}
		return await confictQuery.getMany();
	}
}
