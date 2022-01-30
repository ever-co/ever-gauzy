import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { TimeSlot } from './../../time-slot.entity';
import { TimeSlotRangeDeleteCommand } from '../time-slot-range-delete.command';
import { RequestContext } from './../../../../core/context';
import { getDateFormat } from './../../../../core/utils';

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

		const tenantId = RequestContext.currentTenantId();
		const { employeeId, start, stop } = command;

		let mStart: any = moment.utc(start);
		mStart.set('minute', mStart.get('minute') - (mStart.get('minute') % 10));
		mStart.set('second', 0).set('millisecond', 0);

		let mEnd: any = moment.utc(stop);
		mEnd.set('minute', mEnd.get('minute') + (mEnd.get('minute') % 10) - 1);
		mEnd.set('second', 59).set('millisecond', 0);

		const { start: startDate, end: endDate } = getDateFormat(
			mStart,
			mEnd
		);
		const timeSlots = await this.timeSlotRepository.find({
			where: (qb: SelectQueryBuilder<TimeSlot>) => {
				qb.andWhere(`"${qb.alias}"."startedAt" >= :startDate AND "${qb.alias}"."startedAt" < :endDate`, {
					startDate,
					endDate
				});
				qb.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, {
					employeeId
				});
				qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
					tenantId
				});
			},
			relations: ['screenshots']
		});
		await this.timeSlotRepository.remove(timeSlots);
		return true;
	}
}
