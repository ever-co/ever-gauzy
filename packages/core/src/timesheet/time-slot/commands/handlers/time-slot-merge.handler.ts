import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import * as _ from 'underscore';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';
import { getConfig } from '@gauzy/config';
import { IActivity, IScreenshot, ITimeLog } from '@gauzy/contracts';
import { Activity, Screenshot, TimeSlot } from './../../../../core/entities/internal';
const config = getConfig();

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

		const startDate = moment(start)
			.utc()
			.set('minute', startMinute)
			.set('second', 0)
			.set('millisecond', 0);

		let endMinute = moment(end).utc().get('minute');
		endMinute = endMinute - (endMinute % 10);

		const endDate = moment(end)
			.utc()
			.set('minute', endMinute + 10)
			.set('second', 0)
			.set('millisecond', 0);

		const timerSlots = await this.timeSlotRepository.find({
			where: (query: SelectQueryBuilder<TimeSlot>) => {
				if (config.dbConnectionOptions.type === 'sqlite') {
					query.where(
						`"${query.alias}"."startedAt" >= :startDate AND "${query.alias}"."startedAt" <= :endDate`,
						{
							startDate: startDate.format('YYYY-MM-DD HH:mm:ss'),
							endDate: endDate.format('YYYY-MM-DD HH:mm:ss')
						}
					);
				} else {
					query.where(
						`"${query.alias}"."startedAt" >= :startDate AND "${query.alias}"."startedAt" <= :endDate`,
						{
							startDate: startDate.toDate(),
							endDate: endDate.toDate()
						}
					);
				}
				query.andWhere(`"${query.alias}"."employeeId" = :employeeId`, {
					employeeId
				});
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
