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
		const { organizationId, employeeId, start, stop, timeLog } = command;

		let startMinute = moment(start).utc().get('minute');
		startMinute = startMinute - (startMinute % 10);

		let mStart: any = moment
			.utc(start)
			.set('minute', startMinute)
			.set('second', 0)
			.set('millisecond', 0);

		let endMinute = moment(stop).utc().get('minute');
		endMinute = endMinute - (endMinute % 10);

		let mEnd: any = moment
			.utc(stop)
			.set('minute', endMinute + 10)
			.set('second', 0)
			.set('millisecond', 0);
		
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
				qb.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
					organizationId
				});
				qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
					tenantId
				});
			},
			relations: ['screenshots', 'timeLogs']
		});
		for await (const timeSlot of timeSlots) {
			const { timeLogs } = timeSlot;
			if (timeLogs.length === 1) {
				const [ firstTimeLog ] = timeLogs;
				if (firstTimeLog.id === timeLog.id) {
					await this.timeSlotRepository.remove(timeSlot);
				}
			}
		}
		return true;
	}
}
