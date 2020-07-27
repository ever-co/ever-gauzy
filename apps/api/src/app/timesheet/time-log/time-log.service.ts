import {
	Injectable,
	BadRequestException,
	forwardRef,
	Inject
} from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
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
import { TimeSlotService } from '../time-slot/time-slot.service';
import { Organization } from '../../organization/organization.entity';
import { Employee } from '../../employee/employee.entity';
import { DBHelper } from '../../core/DBHelper';

@Injectable()
export class TimeLogService extends CrudService<TimeLog> {
	private timeLogDBHelper: DBHelper<TimeLog>;
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

		this.timeLogDBHelper = new DBHelper<TimeLog>(this.timeLogRepository);
	}

	async getTimeLogs(request: IGetTimeLogInput) {
		let employeeIds: string[];

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (request.employeeIds) {
				employeeIds = request.employeeIds;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
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
				'organizationContact',
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.organization', 'employee.user']
					: [])
			],
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
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
				if (employeeIds) {
					qb.andWhere('"employeeId" IN (:...employeeId)', {
						employeeId: employeeIds
					});
				}
				// if (request.organizationId) {
				// 	qb.andWhere(
				// 		'"employee"."organizationId" = :organizationId',
				// 		{ organizationId: request.organizationId }
				// 	);
				// }

				if (request.projectIds) {
					qb.andWhere(
						`"${qb.alias}"."projectId" IN (:...projectIds)`,
						{ projectIds: request.projectIds }
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
			request.stoppedAt,
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
			await this.deleteTimeSpan(times, confict[index]);
		}

		return this.dbInsert(request);
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
			await this.deleteTimeSpan(times, confict[index]);
		}
		this.dbUpdate(
			{
				startedAt: request.startedAt,
				stoppedAt: request.stoppedAt,
				projectId: request.projectId || null,
				taskId: request.taskId || null,
				organizationContactId: request.organizationContactId || null,
				logType: TimeLogType.MANUAL,
				description: request.description || '',
				isBillable: request.isBillable || false
			},
			timeLog
		);
		return await this.timeLogRepository.findOne(request.id);
	}

	async deleteTimeLog(ids: string | string[]): Promise<any> {
		const user = RequestContext.currentUser();
		if (typeof ids === 'string') {
			ids = [ids];
		}

		const timeSlots = await this.timeLogRepository.find({
			...(RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
				? {}
				: { employeeId: user.employeeId }),
			id: In(ids)
		});

		return await this.dbDelete(timeSlots);
	}

	async dbInsert(request: Partial<TimeLog>): Promise<any> {
		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			request.employeeId,
			request.startedAt
		);

		const newTimeLog = await this.timeLogRepository.save({
			startedAt: request.startedAt,
			stoppedAt: request.stoppedAt,
			timesheetId: timesheet.id,
			isBilled: false,
			employeeId: request.employeeId,
			projectId: request.projectId || null,
			taskId: request.taskId || null,
			organizationContactId: request.organizationContactId || null,
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

		this.timeLogDBHelper.find(newTimeLog.id).sync('timeSlots', timeSlots);

		return newTimeLog;
	}

	async dbUpdate(request: Partial<TimeLog>, timeLog: TimeLog): Promise<any> {
		const updatedTimeLog = Object.assign(timeLog, request);
		const timesheet = await this.timesheetService.createOrFindTimeSheet(
			timeLog.employeeId,
			updatedTimeLog.startedAt
		);

		const timeSlots = this.timeSlotService.generateTimeSlots(
			timeLog.startedAt,
			timeLog.stoppedAt
		);
		let updateTimeSlots = this.timeSlotService.generateTimeSlots(
			updatedTimeLog.startedAt,
			updatedTimeLog.stoppedAt
		);

		await this.timeLogRepository.update(
			{ id: timeLog.id },
			{
				timesheetId: timesheet.id,
				...request
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
	}

	async dbDelete(
		ids: string | string[] | TimeLog | TimeLog[],
		forceDelete = false
	): Promise<any> {
		let timeLogs: TimeLog[];
		if (typeof ids === 'string') {
			timeLogs = await this.timeLogRepository.find({ id: ids });
		} else if (ids instanceof Array && typeof ids[0] === 'string') {
			timeLogs = await this.timeLogRepository.find({
				id: In(ids as string[])
			});
		} else if (ids instanceof TimeLog) {
			timeLogs = [ids];
		} else {
			timeLogs = ids as TimeLog[];
		}
		for (let index = 0; index < timeLogs.length; index++) {
			const timeLog = timeLogs[index];
			await this.timeSlotService.rangeDelete(
				timeLog.employeeId,
				timeLog.startedAt,
				timeLog.stoppedAt
			);
		}
		if (forceDelete) {
			return await this.timeLogRepository.delete({
				id: In(_.pluck(timeLogs, 'id'))
			});
		} else {
			return await this.timeLogRepository.update(
				{ id: In(_.pluck(timeLogs, 'id')) },
				{ deletedAt: new Date() }
			);
		}
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
				);
			});
		}

		if (request.ignoreId) {
			confictQuery = confictQuery.andWhere(
				`${confictQuery.alias}.id NOT IN (:...id)`,
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

	private allowDate(start: Date, end: Date, organization: Organization) {
		if (!moment(start).isBefore(moment(end))) {
			return false;
		}
		if (organization.futureDateAllowed) {
			return true;
		}
		return moment(end).isSameOrBefore(moment());
	}

	async deleteTimeSpan(newTime: IDateRange, timeLog: TimeLog) {
		const { start, end } = newTime;

		console.log({
			startedAt: timeLog.startedAt,
			stoppedAt: timeLog.stoppedAt,
			start,
			end
		});
		if (
			moment(timeLog.startedAt).isBetween(
				moment(start),
				moment(end),
				null,
				'[]'
			)
		) {
			if (
				moment(timeLog.stoppedAt).isBetween(
					moment(start),
					moment(end),
					null,
					'[]'
				)
			) {
				/* Delete time log because overlap entire time.
				 * New Start time							New Stop time
				 *  |----------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 *  			|----------------------------|
				 */
				console.log('Delete time log because overlap entire time');
				await this.dbDelete(timeLog.id, true);
			} else {
				/* Update start time
				 * New Start time							New Stop time
				 *  |----------------------------------------------|
				 * 						DB Start Time							DB Stop Time
				 *  							|---------------------------------------|
				 */
				console.log('Update start time');
				const reamingDueration = moment(timeLog.stoppedAt).diff(
					moment(end),
					'seconds'
				);
				console.log('reamingDueration', reamingDueration);
				if (reamingDueration > 0) {
					await this.dbUpdate(
						{
							startedAt: end
						},
						timeLog
					);
				} else {
					/* Delete if reaming dueration 0 seconds */
					await this.dbDelete(timeLog, true);
				}
			}
		} else {
			if (
				moment(timeLog.stoppedAt).isBetween(
					moment(start),
					moment(end),
					null,
					'[]'
				)
			) {
				/* Update stopped time
				 * 			New Start time							New Stop time
				 *  			|----------------------------------------------|
				 * DB Start Time			DB Stop Time
				 *  	|-----------------------|
				 */
				console.log('Update stopped time');
				const reamingDueration = moment(end).diff(
					moment(timeLog.startedAt),
					'seconds'
				);
				console.log('reamingDueration', reamingDueration);
				if (reamingDueration > 0) {
					await this.timeLogRepository.update(
						{
							id: timeLog.id
						},
						{
							stoppedAt: start
						}
					);
				} else {
					/* Delete if reaming dueration 0 seconds */
					await this.dbDelete(timeLog);
				}
			} else {
				/* Split database time in two entries.
				 * 		New Start time				New Stop time
				 *  			|----------------------------|
				 * DB Start Time									DB Stop Time
				 *  |--------------------------------------------------|
				 */
				console.log('Split database time in two entries');
				const reamingDueration = moment(end).diff(
					moment(timeLog.startedAt),
					'seconds'
				);
				console.log('reamingDueration', reamingDueration);
				if (reamingDueration > 0) {
					await this.timeLogRepository.update(
						{
							id: timeLog.id
						},
						{
							stoppedAt: start
						}
					);
				} else {
					/* Delete if reaming dueration 0 seconds */
					await this.dbDelete(timeLog, true);
				}

				this.timeSlotService.rangeDelete(
					timeLog.employeeId,
					start,
					end
				);

				const newLog = _.omit(timeLog, [
					'createdAt',
					'updatedAt',
					'id'
				]);
				newLog.startedAt = end;
				const newLogreamingDueration = moment(newLog.stoppedAt).diff(
					moment(newLog.startedAt),
					'seconds'
				);

				console.log(
					'newLogreamingDueration',
					newLogreamingDueration,
					newLog
				);
				/* Insert if reaming dueration is more 0 seconds */
				if (newLogreamingDueration > 0) {
					await this.timeLogRepository.insert(newLog);
				}
			}
		}
		return true;
	}
}
