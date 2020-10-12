import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import * as moment from 'moment';
import { TimeSlot } from '../../../time-slot.entity';
import * as _ from 'underscore';
import { TimeSlotMergeCommand } from '../time-slot-merge.command';

@CommandHandler(TimeSlotMergeCommand)
export class TimeSlotMergeHandler
	implements ICommandHandler<TimeSlotMergeCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {}

	public async execute(command: TimeSlotMergeCommand): Promise<TimeSlot[]> {
		const { employeeId, start, end } = command;

		const timerSlots = await this.timeSlotRepository.find({
			where: {
				startedAt: Between(start, end),
				employeeId: employeeId
			},
			relations: ['timeLogs']
		});

		const slots = [];
		if (timerSlots.length > 0) {
			const savePromises = _.chain(timerSlots)
				.groupBy((timerSlot) => {
					const date = moment(timerSlot.startedAt);
					const minutes = date.get('minute');
					date.set('minute', minutes - (minutes % 10));
					return date.format('YYYY-MM-DD HH:mm');
				})
				.mapObject(
					async (timeSlots, slotStart): Promise<any> => {
						let screenshots = [];
						let duration = 0;
						for (let index = 0; index < timeSlots.length; index++) {
							const timeSlot = timeSlots[index];
							duration += timeSlot.duration;
							screenshots = screenshots.concat(
								timeSlot.screenshots
							);
						}
						const newTimeSlot = new TimeSlot({
							..._.omit(timeSlots[0], 'id'),
							duration,
							screenshots,
							startedAt: slotStart
						});
						await this.timeSlotRepository.save(newTimeSlot);
						await this.timeSlotRepository.delete({
							id: In(_.pluck(timeSlots, 'id'))
						});
						return;
					}
				)
				.value();

			console.log({ savePromises });

			await Promise.all(savePromises);
		}
		await this.timeSlotRepository.save(slots);
		return slots;
	}
}
