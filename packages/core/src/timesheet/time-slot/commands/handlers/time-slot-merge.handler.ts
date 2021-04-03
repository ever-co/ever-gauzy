import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder, Brackets, MoreThanOrEqual, Between, LessThanOrEqual } from 'typeorm';
import * as moment from 'moment';
import * as _ from 'underscore';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';
import { IActivity, IScreenshot, ITimeLog } from '@gauzy/contracts';
import { Activity, Screenshot, TimeSlot } from './../../../../core/entities/internal';
import { format } from 'date-fns';

/*
* Convert ISO format to DB date format 
*/
export function isoToDbFormat(isoDate: string) {
	return format(new Date(isoDate), 'yyyy-MM-dd kk:mm:ss.SSS');
}

@CommandHandler(TimeSlotMergeCommand)
export class TimeSlotMergeHandler
	implements ICommandHandler<TimeSlotMergeCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {}

	public async execute(command: TimeSlotMergeCommand) {
		let { employeeId, start, end } = command;

		let startMinute = moment(start).utc().get('minute');
		startMinute = startMinute - (startMinute % 10);

		let startDate: any = moment(start)
			.utc()
			.set('minute', startMinute)
			.set('second', 0)
			.set('millisecond', 0);

		let endMinute = moment(end).utc().get('minute');
		endMinute = endMinute - (endMinute % 10);

		let endDate: any = moment(end)
			.utc()
			.set('minute', endMinute + 10)
			.set('second', 0)
			.set('millisecond', 0);

		startDate = isoToDbFormat(startDate);
		endDate = isoToDbFormat(endDate);

		const timerSlots = await this.timeSlotRepository.find({
			where: (query: SelectQueryBuilder<TimeSlot>) => {
				query.andWhere(
					new Brackets((query: any) => {
						query.orWhere({
							startedAt: MoreThanOrEqual(startDate)
						});
						query.orWhere({
							startedAt: Between(startDate, endDate)
						});
						query.orWhere({
							startedAt: LessThanOrEqual(endDate)
						});
					})
				);
				query.andWhere(`"${query.alias}"."employeeId" = :employeeId`, {
					employeeId
				});
				query.addOrderBy(`"${query.alias}"."createdAt"`, 'ASC');
				console.log(query.getQueryAndParameters());
			},
			relations: ['timeLogs', 'screenshots', 'activities']
		});

		console.log('Previous inserted timeslots:', timerSlots);

		const createdTimeslots: any = [];
		if (timerSlots.length > 0) {
			const savePromises = _.chain(timerSlots)
				.groupBy((timeSlot) => {
					let date = moment(timeSlot.startedAt);
					const minutes = date.get('minute');
					date = date
						.set('minute', minutes - (minutes % 10))
						.set('second', 0)
						.set('millisecond', 0);
					return date.format('YYYY-MM-DD HH:mm:ss');
				})
				.mapObject(async (timeSlots, slotStart) => {
					const oldTimeslots = JSON.parse(JSON.stringify(timeSlots));
					const [ oldTimeslot ] = oldTimeslots;

					let timeLogs: ITimeLog[] = [];
					let screenshots: IScreenshot[] = [];
					let activities: IActivity[] = [];

					let duration = 0;
					let keyboard = 0;
					let mouse = 0;
					let overall = 0;

					for (let index = 0; index < oldTimeslots.length; index++) {
						const timeSlot = oldTimeslots[index];

						duration = duration + parseInt(timeSlot.duration + '', 10);
						keyboard = (keyboard + parseInt(timeSlot.keyboard + '', 10));
						mouse = mouse + parseInt(timeSlot.mouse + '', 10);
						overall = overall + parseInt(timeSlot.overall + '', 10);

						screenshots = screenshots.concat(timeSlot.screenshots);
						timeLogs = timeLogs.concat(timeSlot.timeLogs);
						activities = activities.concat(timeSlot.activities);
					}

					const timeSlotslength = oldTimeslots.length;
					const activity = {
						duration,
						keyboard: Math.round(keyboard / timeSlotslength),
						mouse: Math.round(mouse / timeSlotslength),
						overall: Math.round(overall / timeSlotslength),
					}

					/*
					* Map old screenshots newely created timeslot 
					*/
					screenshots = screenshots.map(
						(item) => new Screenshot(_.omit(item, ['timeSlotId']))
					);

					/*
					* Map old activities newely created timeslot 
					*/
					activities = activities.map(
						(item) => new Activity(_.omit(item, ['timeSlotId']))
					);
 
					const newTimeSlot = new TimeSlot({
						..._.omit(oldTimeslot),
						...activity,
						screenshots,
						activities,
						timeLogs,
						startedAt: moment(slotStart).toDate()
					});
					await this.timeSlotRepository.save(newTimeSlot);
					createdTimeslots.push(newTimeSlot);

					const ids = _.pluck(oldTimeslots, 'id');
					ids.splice(0, 1);
					console.log('Timeslots Ids Will Be Deleted:', ids);

					if (ids.length > 0) {
						await this.timeSlotRepository.delete({
							id: In(ids)
						});
					}
				})
				.values()
				.value();
			await Promise.all(savePromises);
		}
		return createdTimeslots;
	}
}
