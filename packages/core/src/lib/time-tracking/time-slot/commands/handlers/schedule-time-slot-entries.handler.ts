import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Brackets, WhereExpressionBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/utils';
import { ScheduleTimeSlotEntriesCommand } from '../schedule-time-slot-entries.command';
import { RequestContext } from './../../../../core/context';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';

@CommandHandler(ScheduleTimeSlotEntriesCommand)
export class ScheduleTimeSlotEntriesHandler implements ICommandHandler<ScheduleTimeSlotEntriesCommand> {
	constructor(private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository) {}

	/**
	 *
	 * @param command
	 */
	public async execute(command: ScheduleTimeSlotEntriesCommand) {
		const tenantId = RequestContext.currentTenantId();

		const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');

		query.setFindOptions({
			relations: {
				timeLogs: true
			}
		});

		// Scope to current tenant first
		query.where(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });

		// Then find slots with invalid values
		query.andWhere(
			new Brackets((web: WhereExpressionBuilder) => {
				web.orWhere(p(`"${query.alias}"."overall" < :overallMin`), { overallMin: 0 });
				web.orWhere(p(`"${query.alias}"."overall" > :overallMax`), { overallMax: 600 });
				web.orWhere(p(`"${query.alias}"."keyboard" < :keyboardMin`), { keyboardMin: 0 });
				web.orWhere(p(`"${query.alias}"."keyboard" > :keyboardMax`), { keyboardMax: 600 });
				web.orWhere(p(`"${query.alias}"."mouse" < :mouseMin`), { mouseMin: 0 });
				web.orWhere(p(`"${query.alias}"."mouse" > :mouseMax`), { mouseMax: 600 });
				web.orWhere(p(`"${query.alias}"."duration" < :durationMin`), { durationMin: 0 });
				web.orWhere(p(`"${query.alias}"."duration" > :durationMax`), { durationMax: 600 });
			})
		);

		const timeSlots = await query.getMany();
		if (isNotEmpty(timeSlots)) {
			const corrected = timeSlots.map((timeSlot) => ({
				id: timeSlot.id,
				duration: timeSlot.duration < 0 ? 0 : timeSlot.duration > 600 ? 600 : timeSlot.duration,
				overall: timeSlot.overall < 0 ? 0 : timeSlot.overall > 600 ? 600 : timeSlot.overall,
				keyboard: timeSlot.keyboard < 0 ? 0 : timeSlot.keyboard > 600 ? 600 : timeSlot.keyboard,
				mouse: timeSlot.mouse < 0 ? 0 : timeSlot.mouse > 600 ? 600 : timeSlot.mouse
			}));
			await this.typeOrmTimeSlotRepository.save(corrected);
		}
	}
}
