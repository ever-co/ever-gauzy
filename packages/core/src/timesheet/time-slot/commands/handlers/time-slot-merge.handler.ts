import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { TimeSlot } from '../../../time-slot.entity';
import * as _ from 'underscore';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';
import { Screenshot } from '../../../screenshot.entity';
import { TimeLog } from '../../../time-log.entity';
import { getConfig } from '@gauzy/config';
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

		console.log(
			`Timeslot merge startDate=${startDate} and endDate=${endDate}`
		);

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
			},
			relations: ['timeLogs', 'screenshots']
		});

		console.log('Previous inserted timeslots:', timerSlots);

		const createdTimeslots: any = [];
		if (timerSlots.length > 0) {
			const savePromises = _.chain(timerSlots)
				.groupBy((timeSlots) => {
					let date = moment.utc(timeSlots.startedAt);
					const minutes = date.get('minute');
					date = date
						.set('minute', minutes - (minutes % 10))
						.set('second', 0)
						.set('millisecond', 0);
					return date.format('YYYY-MM-DD HH:mm:ss');
				})
				.mapObject(async (timeSlots, slotStart) => {
					let timeLogs: TimeLog[] = [];
					let screenshots: Screenshot[] = [];
					let duration = 0;
					for (let index = 0; index < timeSlots.length; index++) {
						const timeSlot = timeSlots[index];
						duration =
							duration + parseInt(timeSlot.duration + '', 10);
						screenshots = screenshots.concat(timeSlot.screenshots);
						timeLogs = timeLogs.concat(timeSlot.timeLogs);
					}

					screenshots = screenshots.map(
						(screenshot) =>
							new Screenshot(_.omit(screenshot, ['timeSlotId']))
					);

					const newTimeSlot = new TimeSlot({
						..._.omit(timeSlots[0]),
						duration,
						screenshots,
						timeLogs,
						startedAt: moment(slotStart).toDate()
					});
					await this.timeSlotRepository.save(newTimeSlot);
					createdTimeslots.push(newTimeSlot);

					const ids = _.pluck(timeSlots, 'id');
					ids.splice(0, 1);
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
