import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TimeSlot } from './../../time-slot.entity';
import { ScheduleTimeSlotEntriesCommand } from '../schedule-time-slot-entries.command';
import { isNotEmpty } from '@gauzy/common';

@CommandHandler(ScheduleTimeSlotEntriesCommand)
export class ScheduleTimeSlotEntriesHandler 
	implements ICommandHandler<ScheduleTimeSlotEntriesCommand> {

	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {}

	public async execute(command: ScheduleTimeSlotEntriesCommand) {
		const timeSlots = await this.timeSlotRepository.find({
            where: (query: SelectQueryBuilder<TimeSlot>) => {
                query.orWhere(`"${query.alias}"."overall" < :overall`, {
                    overall: 0
                });
                query.orWhere(`"${query.alias}"."keyboard" < :keyboard`, {
                    keyboard: 0
                });
                query.orWhere(`"${query.alias}"."mouse" < :mouse`, {
                    mouse: 0
                });
                query.orWhere(`"${query.alias}"."duration" > :duration`, {
                    duration: 600
                });
            },
            relations: ['timeLogs']
        });
		if (isNotEmpty(timeSlots)) {
			for await (const timeSlot of timeSlots) {
				await this.timeSlotRepository.save({
					id: timeSlot.id,
					duration: (timeSlot.duration < 0) ? 0 : (timeSlot.duration > 600) ? 600 : timeSlot.duration,
					overall: (timeSlot.overall < 0) ? 0 : (timeSlot.overall > 600) ? 600 : timeSlot.overall,
					keyboard: (timeSlot.keyboard < 0) ? 0 : (timeSlot.keyboard > 600) ? 600 : timeSlot.keyboard,
					mouse: (timeSlot.mouse < 0) ? 0 : (timeSlot.mouse > 600) ? 600 : timeSlot.mouse
				});
			}
		}
	}
}
