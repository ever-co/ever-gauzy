import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TimeSlot } from '../../../time-slot.entity';
import { TimeSlotRangeDeleteCommand } from '../time-slot-range-delete.command';
import * as moment from 'moment';

@CommandHandler(TimeSlotRangeDeleteCommand)
export class TimeSlotRangeDeleteHandler
	implements ICommandHandler<TimeSlotRangeDeleteCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {}

	public async execute(
		command: TimeSlotRangeDeleteCommand
	): Promise<boolean> {
		const { employeeId, start, stop } = command;

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

		await this.timeSlotRepository.delete({
			employeeId: employeeId,
			startedAt: Between(mStart.toDate(), mEnd.toDate())
		});
		return true;
	}
}
