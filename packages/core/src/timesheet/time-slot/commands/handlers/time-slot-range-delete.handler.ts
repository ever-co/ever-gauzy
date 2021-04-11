import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TimeSlot } from '../../../time-slot.entity';
import { TimeSlotRangeDeleteCommand } from '../time-slot-range-delete.command';
import * as moment from 'moment';
import { ConfigService } from '@gauzy/config';

@CommandHandler(TimeSlotRangeDeleteCommand)
export class TimeSlotRangeDeleteHandler
	implements ICommandHandler<TimeSlotRangeDeleteCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		private readonly configService: ConfigService
	) {}

	public async execute(
		command: TimeSlotRangeDeleteCommand
	): Promise<boolean> {
		const { employeeId, start, stop } = command;

		let mStart: any = moment(start);
		mStart.set(
			'minute',
			mStart.get('minute') - (mStart.get('minute') % 10)
		);
		mStart.set('second', 0);
		mStart.set('millisecond', 0);

		let mEnd: any = moment(stop);
		mEnd.set('minute', mEnd.get('minute') + (mEnd.get('minute') % 10) - 1);
		mEnd.set('second', 59);
		mEnd.set('millisecond', 0);

		if (this.configService.dbConnectionOptions.type === 'sqlite') {
			mStart = mStart.format('YYYY-MM-DD HH:mm:ss');
			mEnd = mEnd.format('YYYY-MM-DD HH:mm:ss');
		} else {
			mStart = mStart.toDate();
			mEnd = mEnd.toDate();
		}

		const timeslots = await this.timeSlotRepository.find({
			where : {
				employeeId: employeeId,
				startedAt: Between(mStart, mEnd)
			},
			relations: ['screenshots']
		});
		await this.timeSlotRepository.remove(timeslots);
		return true;
	}
}
