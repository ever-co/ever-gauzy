import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Between } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { TimeSlot } from '../time-slot.entity';
import * as moment from 'moment';
import { RequestContext } from '../../core/context/request-context';
import { PermissionsEnum, IGetTimeSlotInput } from '@gauzy/models';

@Injectable()
export class TimeSlotService extends CrudService<TimeSlot> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {
		super(timeSlotRepository);
	}

	async getTimeSlots(request: IGetTimeSlotInput) {
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

		const logs = await this.timeSlotRepository.find({
			join: {
				alias: 'time_slots',
				leftJoin: {
					employee: 'time_slots.employee',
					timeLog: 'time_slots.timeLogs'
				}
			},
			relations: [
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.user']
					: []),
				...(request.relations ? request.relations : [])
			],
			where: (qb: SelectQueryBuilder<TimeSlot>) => {
				if (request.startDate && request.endDate) {
					const startDate = moment(request.startDate).format(
						'YYYY-MM-DD HH:mm:ss'
					);
					const endDate = moment(request.endDate).format(
						'YYYY-MM-DD HH:mm:ss'
					);
					qb.andWhere(
						`"${qb.alias}"."startedAt" Between :startDate AND :endDate`,
						{
							startDate,
							endDate
						}
					);
				}
				if (employeeIds) {
					qb.andWhere(
						`"${qb.alias}"."employeeId" IN (:...employeeId)`,
						{
							employeeId: employeeIds
						}
					);
				}
				if (request.organizationId) {
					qb.andWhere(
						'"employee"."organizationId" = :organizationId',
						{ organizationId: request.organizationId }
					);
				}
				if (request.activityLevel) {
					qb.andWhere(
						`"${qb.alias}"."overall" BETWEEN :start AND :end`,
						request.activityLevel
					);
				}
				if (request.source) {
					if (request.source instanceof Array) {
						qb.andWhere('"timeLog.source" IN (:...source)', {
							source: request.source
						});
					} else {
						qb.andWhere('"timeLog.source" = :source', {
							source: request.source
						});
					}
				}
				if (request.logType) {
					if (request.logType instanceof Array) {
						qb.andWhere('"timeLog.logType" IN (:...logType)', {
							logType: request.logType
						});
					} else {
						qb.andWhere('"timeLog.logType" = :logType', {
							logType: request.logType
						});
					}
				}
			}
		});
		return logs;
	}

	bulkCreateOrUpdate(slots) {
		if (slots.length === 0) {
			return null;
		}
		return this.timeSlotRepository
			.createQueryBuilder()
			.insert()
			.values(slots)
			.onConflict(
				'("employeeId", "startedAt") DO UPDATE SET "keyboard" = EXCLUDED.keyboard, "mouse" = EXCLUDED.mouse, "overall" = EXCLUDED.overall'
			)
			.returning('*')
			.execute();
	}

	bulkCreate(slots) {
		if (slots.length === 0) {
			return null;
		}
		return this.timeSlotRepository
			.createQueryBuilder()
			.insert()
			.values(slots)
			.onConflict('("employeeId", "startedAt") DO NOTHING')
			.returning('*')
			.execute();
	}

	rangeDelete(employeeId: string, start: Date, stop: Date) {
		return this.timeSlotRepository.delete({
			employeeId: employeeId,
			startedAt: Between(start, stop)
		});
	}

	generateTimeSlots(start: Date, end: Date) {
		let mStart = moment(start);
		const mEnd = moment(end);
		const slots = [];
		while (mStart.isBefore(mEnd)) {
			let tempEnd: moment.Moment;
			let duration = 0;

			/* Check start time is Rounded 10 minutes slot I.E 10:20, false if 10:14 */
			if (mStart.get('minute') % 10 === 0) {
				tempEnd = mStart.clone().add(10, 'minute');
				if (tempEnd.isBefore(mEnd)) {
					duration = tempEnd.diff(mStart, 'seconds');
				} else {
					duration = mEnd.diff(mStart, 'seconds');
				}
			} else {
				/* Calculate duearion for without round time IE. 10:14-10:20 */
				const tempStart = mStart
					.clone()
					.set(
						'minute',
						mStart.get('minute') - (mStart.minutes() % 10)
					);

				/* Added 10 min for next slot */
				tempEnd = tempStart.clone().add(10, 'minute');

				if (mEnd.isBefore(tempEnd)) {
					duration = mEnd.diff(mStart, 'seconds');
				} else {
					duration = tempEnd.diff(mStart, 'seconds');
				}
				mStart = tempStart;
			}

			slots.push({
				startedAt: mStart.toDate(),
				stoppedAt: tempEnd.toDate(),
				duration: Math.abs(duration)
			});

			mStart = tempEnd.clone();
		}
		return slots;
	}
}
