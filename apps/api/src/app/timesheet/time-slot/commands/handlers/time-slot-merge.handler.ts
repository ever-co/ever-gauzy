import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { TimeSlot } from '../../../time-slot.entity';
import * as _ from 'underscore';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';
import { Screenshot } from '../../../screenshot.entity';
import { TimeLog } from '../../../time-log.entity';

@CommandHandler(TimeSlotMergeCommand)
export class TimeSlotMergeHandler
	implements ICommandHandler<TimeSlotMergeCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Screenshot)
		private readonly screenshotRepository: Repository<Screenshot>
	) {}

	public async execute(command: TimeSlotMergeCommand) {
		let { employeeId, start, end } = command;

		let startMinute = moment(start).get('minute');
		startMinute = startMinute - (startMinute % 10);
		start = moment(start)
			.set('minute', startMinute)
			.set('millisecond', 0)
			.toDate();

		let endMinute = moment(end).get('minute');
		endMinute = endMinute - (endMinute % 10);
		end = moment(end)
			.set('minute', endMinute + 10)
			.set('millisecond', 0)
			.toDate();

		const timerSlots = await this.timeSlotRepository.find({
			where: (qb: SelectQueryBuilder<TimeSlot>) => {
				qb.where(
					`"${qb.alias}"."startedAt" >= :start AND "${qb.alias}"."startedAt" <= :end`,
					{ start, end }
				).andWhere(`"${qb.alias}"."employeeId" >= :employeeId`, {
					employeeId
				});
			},
			// where: {
			// 	startedAt: Between(start, end),
			// 	employeeId: employeeId
			// },
			relations: ['timeLogs', 'screenshots']
		});

		if (timerSlots.length > 0) {
			const savePromises = _.chain(timerSlots)
				.groupBy((timerSlot) => {
					const date = moment.utc(timerSlot.startedAt);
					const minutes = date.get('minute');
					date.set('minute', minutes - (minutes % 10));
					date.set('millisecond', 0);
					return date.format('YYYY-MM-DD HH:mm');
				})
				.mapObject(async (timeSlots, slotStart) => {
					let timeLogs: TimeLog[] = [];
					let screenshots: Screenshot[] = [];
					let duration = 0;
					for (let index = 0; index < timeSlots.length; index++) {
						const timeSlot = timeSlots[index];
						duration += timeSlot.duration;
						screenshots = screenshots.concat(timeSlot.screenshots);
						timeLogs = timeLogs.concat(timeSlot.timeLogs);
					}

					timeLogs = _.uniq(timeLogs, (timeLog) => timeLog.id);
					screenshots = screenshots.map(
						(screenshot) =>
							new Screenshot(
								_.omit(screenshot, ['id', 'timeSlotId'])
							)
					);

					const newTimeSlot = new TimeSlot({
						..._.omit(timeSlots[0], 'id'),
						duration,
						screenshots,
						timeLogs,
						startedAt: new Date(slotStart)
					});
					await this.screenshotRepository.save(screenshots);
					const data = await this.timeSlotRepository.delete({
						id: In(_.pluck(timeSlots, 'id'))
					});
					console.log({ data }, _.pluck(timeSlots, 'id'));
					await this.timeSlotRepository.save(newTimeSlot);
					console.log({ newTimeSlot });
					return timeSlots;
				})
				.values()
				.value();
			await Promise.all(savePromises);
		}
	}
}
