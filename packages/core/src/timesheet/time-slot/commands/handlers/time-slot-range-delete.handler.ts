import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
			mStart = mStart.utc().format('YYYY-MM-DD HH:mm:ss');
			mEnd = mEnd.utc().format('YYYY-MM-DD HH:mm:ss');
		} else {
			mStart = mStart.toDate();
			mEnd = mEnd.toDate();
		}

		console.log('TimeSlot Delete Range:', { mStart, mEnd });
		const timeslots = await this.timeSlotRepository.find({
			where: (qb: SelectQueryBuilder<TimeSlot>) => {
				qb.andWhere(
					`"${qb.alias}"."startedAt" >= :startDate AND "${qb.alias}"."startedAt" < :endDate`,
					{ startDate: mStart, endDate: mEnd }
				);
				qb.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, {
					employeeId
				});
			},
			relations: ['screenshots']
		});
		console.log('Delete TimeSlot Range:', timeslots);
		await this.timeSlotRepository.remove(timeslots);
		return true;
	}
}
