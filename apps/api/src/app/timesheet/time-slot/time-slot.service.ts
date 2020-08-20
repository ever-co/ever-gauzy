import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Between, In } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { TimeSlot } from '../time-slot.entity';
import { moment } from '../../core/moment-extend';
import * as _ from 'underscore';
import { RequestContext } from '../../core/context/request-context';
import { PermissionsEnum, IGetTimeSlotInput } from '@gauzy/models';
import { TimeSlotMinute } from '../time-slot-minute.entity';
import { generateTimeSlots } from './utils';
import { Activity } from '../activity.entity';
import { DeleteTimeSpanCommand } from '../time-log/commands/delete-time-span.command';
import { CommandBus } from '@nestjs/cqrs';

@Injectable()
export class TimeSlotService extends CrudService<TimeSlot> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,
		@InjectRepository(TimeSlotMinute)
		private readonly timeSlotMinuteRepository: Repository<TimeSlotMinute>,
		private readonly commandBus: CommandBus
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

				if (request.projectIds) {
					qb.andWhere('"timeLog"."projectId" IN (:...projectIds)', {
						projectIds: request.projectIds
					});
				}

				if (request.activityLevel) {
					qb.andWhere(
						`"${qb.alias}"."overall" BETWEEN :start AND :end`,
						request.activityLevel
					);
				}
				if (request.source) {
					if (request.source instanceof Array) {
						qb.andWhere('"timeLog"."source" IN (:...source)', {
							source: request.source
						});
					} else {
						qb.andWhere('"timeLog"."source" = :source', {
							source: request.source
						});
					}
				}
				if (request.logType) {
					if (request.logType instanceof Array) {
						qb.andWhere('"timeLog"."logType" IN (:...logType)', {
							logType: request.logType
						});
					} else {
						qb.andWhere('"timeLog"."logType" = :logType', {
							logType: request.logType
						});
					}
				}
			}
		});
		return logs;
	}

	async bulkCreateOrUpdate(slots) {
		if (slots.length === 0) {
			return [];
		}

		const insertedSlots = await this.timeSlotRepository.find({
			where: {
				startedAt: In(_.pluck(slots, 'startedAt'))
			}
		});

		if (insertedSlots.length > 0) {
			slots = slots.map((slot) => {
				const oldSlot = insertedSlots.find(
					(insertedSlot) =>
						moment(insertedSlot.startedAt).format(
							'YYYY-MM-DD HH:mm'
						) === moment(slot.startedAt).format('YYYY-MM-DD HH:mm')
				);
				if (oldSlot) {
					oldSlot.keyboard = slot.keyboard;
					oldSlot.mouse = slot.mouse;
					oldSlot.overall = slot.overall;
					return oldSlot;
				} else {
					return slot;
				}
			});
		}

		await this.timeSlotRepository.save(slots);
		return slots;
	}

	async bulkCreate(slots) {
		if (slots.length === 0) {
			return [];
		}

		const insertedSlots = await this.timeSlotRepository.find({
			where: {
				startedAt: In(_.pluck(slots, 'startedAt'))
			}
		});

		if (insertedSlots.length > 0) {
			slots = slots.filter(
				(slot) =>
					!insertedSlots.find(
						(insertedSlot) =>
							moment(insertedSlot.startedAt).format(
								'YYYY-MM-DD HH:mm'
							) ===
							moment(slot.startedAt).format('YYYY-MM-DD HH:mm')
					)
			);
		}

		if (slots.length > 0) {
			await this.timeSlotRepository.save(slots);
		}
		slots = insertedSlots.concat(slots);
		return slots;
	}

	async rangeDelete(employeeId: string, start: Date, stop: Date) {
		const mStart = moment(start);
		mStart.set(
			'minute',
			mStart.get('minute') - (mStart.get('minute') % 10)
		);
		mStart.set('second', 0);
		mStart.set('millisecond', 0);

		const mEnd = moment(stop);
		mEnd.set('minute', mEnd.get('minute') + (mEnd.get('minute') % 10) - 1);
		mEnd.set('second', 59);
		mEnd.set('millisecond', 0);

		const deleteResult = await this.timeSlotRepository.delete({
			employeeId: employeeId,
			startedAt: Between(mStart.toDate(), mEnd.toDate())
		});
		return deleteResult;
	}

	generateTimeSlots(start: Date, end: Date) {
		return generateTimeSlots(start, end);
	}

	async create(request: TimeSlot) {
		// if (!request.timeLogs || request.timeLogs.length === 0) {
		// 	throw new BadRequestException("Timelogs are require");
		// }

		if (
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const user = RequestContext.currentUser();
			request.employeeId = user.employeeId;
		}

		request.startedAt = moment(request.startedAt)
			//.set('minute', 0)
			.set('millisecond', 0)
			.toDate();

		let timeSlot = await this.timeSlotRepository.findOne({
			where: {
				employeeId: request.employeeId,
				startedAt: request.startedAt
			}
		});

		if (timeSlot) {
			timeSlot = await this.update(timeSlot.id, request);
		} else {
			timeSlot = new TimeSlot(request);
			if (request.activites) {
				request.activites = request.activites.map((activity) => {
					activity = new Activity(activity);
					activity.employeeId = timeSlot.employeeId;
					return activity;
				});
				timeSlot.activites = request.activites;
				await this.activityRepository.save(timeSlot.activites);
			}
			await this.timeSlotRepository.save(timeSlot);
		}

		timeSlot = await this.timeSlotRepository.findOne(timeSlot.id, {
			relations: ['timeLogs', 'screenshots', 'activites']
		});

		return timeSlot;
	}

	async update(id: string, request: TimeSlot) {
		let employeeId = request.employeeId;
		if (
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const user = RequestContext.currentUser();
			employeeId = user.employeeId;
		}

		let timeSlot = await this.timeSlotRepository.findOne({
			where: {
				...(employeeId ? { employeeId: employeeId } : {}),
				id: id
			}
		});

		if (timeSlot) {
			if (request.startedAt) {
				request.startedAt = moment(request.startedAt)
					//.set('minute', 0)
					.set('millisecond', 0)
					.toDate();
			}

			let newActivites = [];
			if (request.activites) {
				newActivites = request.activites.map((activity) => {
					activity = new Activity(activity);
					activity.employeeId = timeSlot.employeeId;
					return activity;
				});
				await this.activityRepository.save(newActivites);
				request.activites = (timeSlot.activites || []).concat(
					newActivites
				);
			}
			await this.timeSlotRepository.update(id, request);

			timeSlot = await this.timeSlotRepository.findOne(id, {
				relations: ['timeLogs', 'screenshots', 'activites']
			});
			return timeSlot;
		} else {
			return null;
		}
	}

	/*
	 *create time slot minute activity for specific timeslot
	 */
	async createTimeSlotMinute({ keyboard, mouse, datetime, timeSlot }) {
		const timeMinute = await this.timeSlotMinuteRepository.findOne({
			where: {
				timeSlot,
				datetime
			}
		});

		if (timeMinute) {
			const request = {
				keyboard,
				mouse,
				datetime,
				timeSlot,
				timeSlotId: timeMinute.id
			};
			return await this.updateTimeSlotMinute(timeMinute.id, request);
		} else {
			return await this.timeSlotMinuteRepository.save({
				keyboard,
				mouse,
				datetime,
				timeSlot
			});
		}
	}

	/*
	 * Update timeslot minute activity for specific timeslot
	 */
	async updateTimeSlotMinute(id: string, request: TimeSlotMinute) {
		let timeMinute = await this.timeSlotMinuteRepository.findOne({
			where: {
				id: id
			}
		});

		if (timeMinute) {
			delete request.timeSlotId;
			await this.timeSlotMinuteRepository.update(id, request);

			timeMinute = await this.timeSlotMinuteRepository.findOne(id, {
				relations: ['timeSlot']
			});
			return timeMinute;
		} else {
			return null;
		}
	}

	async deleteTimeSlot(ids: string[]) {
		const timeSlots = await this.timeSlotRepository.find({
			where: { id: In(ids) }
		});
		for (let i = 0; i < ids.length; i++) {
			const timeSlot = await this.timeSlotRepository.findOne({
				where: {
					startedAt: timeSlots[i].startedAt
				},
				relations: ['timeLogs']
			});
			console.log('deleteTimeSlot', ids[i], { timeSlot });
			if (timeSlot && timeSlot.timeLogs.length > 0) {
				const deleteSlotPromise = timeSlot.timeLogs.map(
					async (timeLog) => {
						await this.commandBus.execute(
							new DeleteTimeSpanCommand(
								{
									start: timeSlot.startedAt,
									end: timeSlot.stoppedAt
								},
								timeLog
							)
						);
						return;
					}
				);

				await Promise.all(deleteSlotPromise);
			}
		}
		return true;
	}
}
