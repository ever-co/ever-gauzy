import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { TimeSlot } from './../../time-slot.entity';
import { TimeSlotRangeDeleteCommand } from '../time-slot-range-delete.command';
import { RequestContext } from './../../../../core/context';

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

		const { input, forceDirectDelete } = command;
		const { organizationId, employeeId, timeLog, timeSlotsIds = [] } = input;

		const timeSlots = await this.timeSlotRepository.find({
			where: (qb: SelectQueryBuilder<TimeSlot>) => {
				if (isNotEmpty(timeSlotsIds)) {
					qb.andWhere(`"${qb.alias}"."id" IN (:...timeSlotsIds)`, {
						timeSlotsIds
					});
				}
				qb.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, {
					employeeId
				});
				qb.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
					organizationId
				});
				qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
					tenantId
				});
				console.log('Time Slots Delete Range Query', qb.getQueryAndParameters());
			},
			relations: ['screenshots', 'timeLogs']
		});
		console.log({ timeSlots, forceDirectDelete }, 'Time Slots Delete Range');

		if (isNotEmpty(timeSlots)) {
			if (forceDirectDelete) {
				await this.timeSlotRepository.remove(timeSlots);
				return true;
			} else {
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
		return false;
	}
}
