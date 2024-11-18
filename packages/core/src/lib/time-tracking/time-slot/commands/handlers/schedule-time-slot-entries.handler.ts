import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { TimeSlot } from './../../time-slot.entity';
import { ScheduleTimeSlotEntriesCommand } from '../schedule-time-slot-entries.command';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';

@CommandHandler(ScheduleTimeSlotEntriesCommand)
export class ScheduleTimeSlotEntriesHandler implements ICommandHandler<ScheduleTimeSlotEntriesCommand> {

	constructor(
		@InjectRepository(TimeSlot)
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository
	) { }

	/**
	 *
	 * @param command
	 */
	public async execute(command: ScheduleTimeSlotEntriesCommand) {
		const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');
		query.setFindOptions({
			relations: {
				timeLogs: true
			}
		});
		query.where((qb: SelectQueryBuilder<TimeSlot>) => {
			qb.orWhere(p(`"${qb.alias}"."overall" < :overall`), {
				overall: 0
			});
			qb.orWhere(p(`"${qb.alias}"."keyboard" < :keyboard`), {
				keyboard: 0
			});
			qb.orWhere(p(`"${qb.alias}"."mouse" < :mouse`), {
				mouse: 0
			});
			qb.orWhere(p(`"${qb.alias}"."duration" > :duration`), {
				duration: 600
			});
		});
		const timeSlots = await query.getMany();
		if (isNotEmpty(timeSlots)) {
			for await (const timeSlot of timeSlots) {
				await this.typeOrmTimeSlotRepository.save({
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
